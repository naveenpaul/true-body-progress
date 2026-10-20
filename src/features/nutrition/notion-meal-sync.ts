import type { SQLiteDatabase } from 'expo-sqlite';

import type { MealEstimate } from '@/lib/ai/meal-estimator';
import type { NotionMealRef } from '@/lib/db/nutrition-repo';
import type { MealColumn, NotionMealRow } from '@/lib/notion/notion-client';
import { estimateMeals, ESTIMATOR_VERSION } from '@/lib/ai/meal-estimator';
import { daysAgo } from '@/lib/dates';
import * as foodsRepo from '@/lib/db/foods-repo';
import * as nutritionRepo from '@/lib/db/nutrition-repo';
import { fetchMealRows, MEAL_COLUMNS } from '@/lib/notion/notion-client';

// Notion is the source of truth for meals; the app keeps a local copy with
// estimated macros. Only cells whose text changed (or that an older estimator
// version produced) are re-estimated, so a re-sync costs one Groq call per
// edited day.

const SYNC_WINDOW_DAYS = 90;

export type SyncPlan = {
  estimate: Array<{ pageId: string; date: string; meals: Partial<Record<MealColumn, string>> }>;
  moveDate: Array<{ id: number; date: string }>;
  remove: number[];
};

export type SyncResult = { updated: number; removed: number; failedDays: number };

export const mealRef = (pageId: string, col: MealColumn) => `${pageId}:${col}`;

export function planSync(rows: NotionMealRow[], existing: NotionMealRef[]): SyncPlan {
  const byRef = new Map(existing.map(e => [e.source_ref, e]));
  const seen = new Set<string>();
  const plan: SyncPlan = { estimate: [], moveDate: [], remove: [] };

  for (const row of rows) {
    const changed: Partial<Record<MealColumn, string>> = {};
    for (const col of MEAL_COLUMNS) {
      const text = row.meals[col];
      if (!text)
        continue;
      const ref = mealRef(row.pageId, col);
      seen.add(ref);
      const prev = byRef.get(ref);
      if (!prev || prev.source_text !== text || (prev.estimate_version ?? 1) < ESTIMATOR_VERSION)
        changed[col] = text;
      else if (prev.date !== row.date)
        plan.moveDate.push({ id: prev.id, date: row.date });
    }
    if (Object.keys(changed).length > 0)
      plan.estimate.push({ pageId: row.pageId, date: row.date, meals: changed });
  }

  // Cleared cells and deleted/undated rows.
  for (const e of existing) {
    if (!seen.has(e.source_ref))
      plan.remove.push(e.id);
  }
  return plan;
}

export function isNotionConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_NOTION_TOKEN && !!process.env.EXPO_PUBLIC_NOTION_MEALS_DB;
}

let inFlight: Promise<SyncResult> | null = null;

// Concurrent callers (screen mount + pull-to-refresh) share one run.
export function syncNotionMeals(
  db: SQLiteDatabase,
  onProgress?: (done: number, total: number) => void,
): Promise<SyncResult> {
  inFlight ??= runSync(db, onProgress).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(db: SQLiteDatabase, onProgress?: (done: number, total: number) => void): Promise<SyncResult> {
  const token = process.env.EXPO_PUBLIC_NOTION_TOKEN;
  const databaseId = process.env.EXPO_PUBLIC_NOTION_MEALS_DB;
  if (!token || !databaseId)
    throw new Error('Notion is not configured (EXPO_PUBLIC_NOTION_TOKEN / EXPO_PUBLIC_NOTION_MEALS_DB)');

  const since = daysAgo(SYNC_WINDOW_DAYS);
  const [rows, existing, foods] = await Promise.all([
    fetchMealRows(token, databaseId, since),
    nutritionRepo.getNotionMealsSince(db, since),
    foodsRepo.getReferenceFoods(db),
  ]);
  const plan = planSync(rows, existing);

  for (const id of plan.remove)
    await nutritionRepo.deleteMeal(db, id);
  for (const { id, date } of plan.moveDate)
    await nutritionRepo.setMealDate(db, id, date);

  // Newest days first so today shows up quickly; one Groq call per day.
  const days = [...plan.estimate].sort((a, b) => b.date.localeCompare(a.date));
  let updated = 0;
  let failedDays = 0;
  onProgress?.(0, days.length);
  for (const [i, day] of days.entries()) {
    let estimate: MealEstimate;
    try {
      estimate = await estimateMeals(day.meals as Record<string, string>, foods);
      if (estimate.learned.length > 0) {
        await foodsRepo.saveLearnedFoods(db, estimate.learned);
        // Later days in this sync reuse the same numbers for these items.
        for (const l of estimate.learned) {
          if (!foods.some(f => f.id === `est:${l.key}`))
            foods.push({ id: `est:${l.key}`, name: l.name, per100g: l.per100g, servingGrams: null });
        }
      }
    }
    catch (err) {
      // Leave this day's old values; the unchanged text check retries it next sync.
      console.warn(`[notion-sync] estimate failed for ${day.date}:`, err);
      failedDays++;
      onProgress?.(i + 1, days.length);
      continue;
    }
    for (const col of MEAL_COLUMNS) {
      const text = day.meals[col];
      const macros = estimate.macros[col];
      if (!text || !macros)
        continue;
      await nutritionRepo.upsertNotionMeal(db, {
        sourceRef: mealRef(day.pageId, col),
        date: day.date,
        mealName: col,
        text,
        ...macros,
        estimateVersion: ESTIMATOR_VERSION,
      });
      updated++;
    }
    onProgress?.(i + 1, days.length);
  }

  return { updated, removed: plan.remove.length, failedDays };
}
