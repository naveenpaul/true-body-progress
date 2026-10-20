// Turns free-text meal descriptions ("2 chapathis, 100gms methi sabzi") into
// macros. Groq only reads the text: it splits each meal into items with gram
// weights and picks the matching food from the app's food database. The
// nutrition numbers come from that database, so the same food always gets the
// same values and trends don't wobble between syncs. Groq supplies per-100g
// values only for items with no match; the caller saves those so they're
// reused next time.

import { getLLMConfig, GROQ_BASE, reasoningParams } from './llm-client';

export type Macros = { calories: number; protein: number; carbs: number; fats: number; fiber: number };

// Bump when the estimation method changes; older entries get re-estimated.
export const ESTIMATOR_VERSION = 2;

export type ReferenceFood = {
  id: string;
  name: string;
  per100g: Macros;
  servingGrams: number | null; // default serving, used when Groq gives no weight
};

export type ParsedItem = {
  item: string;
  grams: number;
  food_id: string | null;
  per100g?: Partial<Macros> | null;
};

export type LearnedFood = { key: string; name: string; per100g: Macros };

export type MealEstimate = {
  macros: Record<string, Macros>;
  learned: LearnedFood[];
};

// Always offered, so Groq can split dishes ("biryani with 50g chicken") into
// components and add oil for oily food even when the text doesn't name them.
const ALWAYS_OFFER = ['in-biryani-rice', 'in-chicken-pieces', 'in-beef-pieces', 'in-cooking-oil', 'in-sabzi-home'];
const MAX_CANDIDATES = 80;

// Diary words → words used in food names.
const ALIASES: Record<string, string[]> = {
  'chapathi': ['chapati', 'roti'],
  'chapatti': ['chapati', 'roti'],
  'phulka': ['roti'],
  'tea': ['chai'],
  'curds': ['curd'],
  'dahi': ['curd'],
  'sprouts': ['sprouted'],
  'sprite': ['soda'],
  '7up': ['soda'],
  'chikoo': ['sapota'],
  'heerekai': ['sabzi'],
  'lauki': ['sabzi'],
  'methi': ['sabzi'],
  'palak': ['sabzi'],
  'cabbage': ['sabzi'],
  'chavlekai': ['sabzi'],
  'tahari': ['biryani'],
  'pulav': ['pulao'],
  'matki': ['moth'],
  'cowpea': ['lobia'],
  'popcorn': ['theatre'],
  'kabuli': ['chana'],
  'omelette': ['omelette', 'egg'],
};

// Everyday diary items pinned to one food, so they get the same numbers every
// day no matter which close match the model picks. Keys are normalizeItemKey().
const PINNED_FOODS: Record<string, string> = {
  'tea': 'in-chai-milk',
  'chai': 'in-chai-milk',
  'milk tea': 'in-chai-milk',
  'chapathi': 'in-roti-wheat',
  'chapati': 'in-roti-wheat',
  'roti': 'in-roti-wheat',
  'kabuli chana': 'in-chana-masala',
  'chana': 'in-chana-masala',
  'dal': 'in-dal-toor',
  'thick dal': 'in-dal-toor',
  'toor dal': 'in-dal-toor',
  'whole toor dal': 'in-dal-toor',
  'bhindi': 'in-paneer-bhindi',
  'bhindi sabzi': 'in-paneer-bhindi',
  'omelette': 'in-egg-omelette',
  'egg omelette': 'in-egg-omelette',
  'sprout': 'in-sprouted-moong',
  'moong sprout': 'in-sprouted-moong',
  'sprouted moong': 'in-sprouted-moong',
};

const STOPWORDS = new Set(['with', 'and', 'the', 'cooked', 'home', 'made', 'style', 'plain', 'small', 'medium', 'large', 'gms', 'gm', 'mgs', 'cup', 'cups', 'bowl', 'around', 'some', 'restaurant', 'oily', 'fatty']);
const WORD_RE = /[a-z0-9]+/g;

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('es'))
    return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s'))
    return word.slice(0, -1);
  return word;
}

const DIGIT_START_RE = /^\d/;

function rawWords(text: string): string[] {
  return (text.toLowerCase().match(WORD_RE) ?? [])
    .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !DIGIT_START_RE.test(w));
}

function words(text: string): string[] {
  return rawWords(text).map(stem);
}

export function normalizeItemKey(name: string): string {
  return words(name).join(' ');
}

// Foods whose name shares a word with the meal text, best matches first.
export function pickCandidates(texts: string[], foods: ReferenceFood[]): ReferenceFood[] {
  const textWords = new Set<string>();
  for (const raw of texts.flatMap(rawWords)) {
    textWords.add(stem(raw));
    for (const alias of [...(ALIASES[raw] ?? []), ...(ALIASES[stem(raw)] ?? [])])
      textWords.add(stem(alias));
  }
  const scored = foods
    .map(f => ({ f, score: words(f.name).filter(w => textWords.has(w)).length }))
    .filter(s => s.score > 0 || ALWAYS_OFFER.includes(s.f.id))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_CANDIDATES).map(s => s.f);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toMacros(p: Partial<Macros> | null | undefined): Macros {
  return {
    calories: num(p?.calories),
    protein: num(p?.protein),
    carbs: num(p?.carbs),
    fats: num(p?.fats),
    fiber: num(p?.fiber),
  };
}

// Totals a meal from parsed items. Matched items use the food database (by id,
// or by exact name when Groq left the id out); others use Groq's per-100g
// values and are returned as `learned`. Returns null if any item can't be
// valued, so the meal is retried next sync instead of being undercounted.
export function resolveItems(items: ParsedItem[], foods: ReferenceFood[]): { total: Macros; learned: LearnedFood[] } | null {
  const byId = new Map(foods.map(f => [f.id, f]));
  const byName = new Map(foods.map(f => [normalizeItemKey(f.name), f]));
  const total: Macros = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
  const learned: LearnedFood[] = [];
  for (const it of items) {
    const key = normalizeItemKey(it.item ?? '');
    const pinned = PINNED_FOODS[key] ? byId.get(PINNED_FOODS[key]) : undefined;
    const food = pinned ?? (it.food_id ? byId.get(it.food_id) : undefined) ?? byName.get(key);
    const grams = num(it.grams) || (food?.servingGrams ?? 0);
    let per100g: Macros | null = food?.per100g ?? null;
    if (!per100g && it.per100g && num(it.per100g.calories) > 0) {
      per100g = toMacros(it.per100g);
      if (key)
        learned.push({ key, name: it.item, per100g });
    }
    if (!per100g || grams === 0) {
      console.warn(`[meal-estimator] could not value "${it.item}" (${it.food_id ?? 'no match'}, ${it.grams}g)`);
      return null;
    }
    const factor = grams / 100;
    total.calories += per100g.calories * factor;
    total.protein += per100g.protein * factor;
    total.carbs += per100g.carbs * factor;
    total.fats += per100g.fats * factor;
    total.fiber += per100g.fiber * factor;
  }
  return { total, learned };
}

const SYSTEM_PROMPT = `You read an Indian food diary. Split each meal into the food items eaten and give each item's eaten weight in grams. For each item pick the best matching food from the FOODS list (by id), or null if nothing there is the same food.

Rules:
- grams is always a number. Use stated grams/ml ("mg"/"mgs" in the diary means grams). Otherwise use these weights: chapathi 40g, jowar roti 45g, idli 35g (small idli 25g), egg 50g, white bread slice 25g, banana 120g, small orange 100g, cup of tea 150ml, osmania biscuit 12g, pani puri 15g each, mysore pak 30g each, restaurant biryani plate 350g, medium tub of popcorn 90g.
- If a dish states how much meat is in it ("300g biryani with 50g chicken"), output the meat as its own item (chicken/beef pieces) with that weight, and the rest as the base (e.g. biryani rice) weighing the dish minus the meat. If no meat weight is stated, use the dish's own entry (e.g. Chicken Biryani).
- If a dish lists its components ("tahari with 75g beef and 200g cooked rice"), output only those components; never add the dish again on top.
- For restaurant, "oily" or "fatty" dishes add a Cooking Oil item weighing 5% of the dish weight (8% if "oily"/"fatty"; e.g. 350g fatty biryani -> 28g oil). Home cooking already includes normal oil.
- Plain "tea" is Masala Chai (with milk & sugar); home made kabuli chana is Chana Masala; plain "dal" is Toor Dal; an omelette without cheese is the plain Egg Omelette.
- Prefer a specific match (e.g. "Toor Dal", "Chana Masala" for home made kabuli chana) over a generic one. Vegetable sabzis without their own entry use the home vegetable sabzi.
- When food_id is null, per100g is REQUIRED: the item's nutrition per 100g as eaten (cooked, with its water/gravy). When food_id is set, per100g is null.

Reply with JSON only: {"meals":{"<meal key>":[{"item":"...","grams":n,"food_id":"<id>"|null,"per100g":{"calories":n,"protein":n,"carbs":n,"fats":n,"fiber":n}|null}]}} using exactly the given meal keys.`;

const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function parseEstimate(content: string, keys: string[], foods: ReferenceFood[]): MealEstimate {
  const parsed = JSON.parse(content) as { meals?: Record<string, unknown> };
  const result: MealEstimate = { macros: {}, learned: [] };
  for (const key of keys) {
    const items = parsed.meals?.[key];
    if (!Array.isArray(items) || items.length === 0)
      continue;
    const resolved = resolveItems(items as ParsedItem[], foods);
    if (!resolved || resolved.total.calories === 0)
      continue;
    result.macros[key] = resolved.total;
    result.learned.push(...resolved.learned);
  }
  return result;
}

// One request per day's meals. Throws if Groq isn't configured or keeps failing.
export async function estimateMeals(meals: Record<string, string>, foods: ReferenceFood[]): Promise<MealEstimate> {
  const config = getLLMConfig();
  if (!config)
    throw new Error('Groq is not configured (EXPO_PUBLIC_GROQ_KEY)');

  const candidates = pickCandidates(Object.values(meals), foods);
  const foodList = candidates.map(f => `${f.id}: ${f.name}`).join('\n');

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `FOODS:\n${foodList}\n\nMEALS:\n${JSON.stringify(meals)}` },
        ],
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        ...reasoningParams(config.model),
      }),
    });

    // Free-tier rate limits: wait as told and retry.
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000, 30000));
      continue;
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Groq ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (!content)
      throw new Error('Groq returned no content');
    return parseEstimate(content, Object.keys(meals), foods);
  }
}
