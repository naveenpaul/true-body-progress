// Turns free-text meal descriptions ("2 chapathis, 100gms methi sabzi") into
// macro estimates via Groq. The model itemizes each meal as grams + per-100g
// values and we do the multiplication here; asking for totals directly
// noticeably underestimated oily/restaurant food.

import { getLLMConfig, GROQ_BASE, reasoningParams } from './llm-client';

export type Macros = { calories: number; protein: number; carbs: number; fats: number; fiber: number };

type EstimatedItem = {
  item: string;
  grams: number;
  per100g: Macros;
};

const SYSTEM_PROMPT = `You are a careful dietitian estimating nutrition from an Indian food diary. Split each meal into its food items. For every item give the eaten weight in grams (use the stated grams/ml; otherwise a typical Indian portion, e.g. chapathi 40g, idli 40g, white bread slice 25g, banana 120g, cup of tea 150ml) and the nutrition per 100g (calories, protein, carbs, fats, dietary fiber) for that item as described. "Tea" is Indian milk tea with sugar. "Home made" means normal home oil. "Oily", "fatty" and restaurant dishes are calorie-dense (e.g. restaurant biryani ~200 kcal/100g, theatre popcorn ~500 kcal/100g with a medium bowl ~90g). When an item names a component inside a dish ("300g biryani with 50g chicken"), the component is part of the dish weight, not extra. Reply with JSON only: {"meals":{"<meal key>":[{"item":"...","grams":n,"per100g":{"calories":n,"protein":n,"carbs":n,"fats":n,"fiber":n}}]}} using exactly the given meal keys.`;

const MAX_ATTEMPTS = 3;

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function sumItems(items: EstimatedItem[]): Macros {
  const total: Macros = { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };
  for (const it of items) {
    const factor = num(it.grams) / 100;
    total.calories += num(it.per100g?.calories) * factor;
    total.protein += num(it.per100g?.protein) * factor;
    total.carbs += num(it.per100g?.carbs) * factor;
    total.fats += num(it.per100g?.fats) * factor;
    total.fiber += num(it.per100g?.fiber) * factor;
  }
  return total;
}

// Parses the model's JSON reply. Keys the model dropped or mangled are left
// out, so the caller treats them as "not estimated" rather than 0 kcal.
export function parseEstimate(content: string, keys: string[]): Record<string, Macros> {
  const parsed = JSON.parse(content) as { meals?: Record<string, unknown> };
  const result: Record<string, Macros> = {};
  for (const key of keys) {
    const items = parsed.meals?.[key];
    if (Array.isArray(items) && items.length > 0)
      result[key] = sumItems(items as EstimatedItem[]);
  }
  return result;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// One request per day's meals. Throws if Groq isn't configured or keeps failing.
export async function estimateMeals(meals: Record<string, string>): Promise<Record<string, Macros>> {
  const config = getLLMConfig();
  if (!config)
    throw new Error('Groq is not configured (EXPO_PUBLIC_GROQ_KEY)');

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
          { role: 'user', content: JSON.stringify(meals) },
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
    return parseEstimate(content, Object.keys(meals));
  }
}
