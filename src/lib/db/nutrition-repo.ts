import type { SQLiteDatabase } from 'expo-sqlite';

import type { NutritionEntry } from '@/lib/types';

export async function logMeal(
  db: SQLiteDatabase,
  date: string,
  mealName: string,
  calories: number,
  protein: number,
  carbs: number,
  fats: number,
  options: { foodId?: string | null; servings?: number | null } = {},
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO nutrition_entry (date, meal_name, calories, protein, carbs, fats, food_id, servings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date,
      mealName,
      calories,
      protein,
      carbs,
      fats,
      options.foodId ?? null,
      options.servings ?? null,
    ],
  );
  return result.lastInsertRowId;
}

// Convenience: log a meal from a Food row + servings multiplier. Computes
// macros from the food's per-default-serving values × servings, so the saved
// nutrition_entry stays accurate even if the food row changes later.
export async function logMealFromFood(
  db: SQLiteDatabase,
  date: string,
  food: {
    id: string;
    name: string;
    kcal: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  },
  servings: number,
): Promise<number> {
  return logMeal(
    db,
    date,
    food.name,
    food.kcal * servings,
    food.protein_g * servings,
    food.carbs_g * servings,
    food.fat_g * servings,
    { foodId: food.id, servings },
  );
}

export async function getDailyTotals(
  db: SQLiteDatabase,
  date: string,
): Promise<{ calories: number; protein: number; carbs: number; fats: number }> {
  const result = await db.getFirstAsync<{
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  }>(
    `SELECT
       COALESCE(SUM(calories), 0) as calories,
       COALESCE(SUM(protein), 0) as protein,
       COALESCE(SUM(carbs), 0) as carbs,
       COALESCE(SUM(fats), 0) as fats
     FROM nutrition_entry WHERE date = ?`,
    [date],
  );
  return result ?? { calories: 0, protein: 0, carbs: 0, fats: 0 };
}

export async function getMealsForDate(db: SQLiteDatabase, date: string): Promise<NutritionEntry[]> {
  return db.getAllAsync<NutritionEntry>(
    'SELECT * FROM nutrition_entry WHERE date = ? ORDER BY created_at',
    [date],
  );
}

export async function deleteMeal(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM nutrition_entry WHERE id = ?', [id]);
}

// Per-day rollup for the last N days. Used by coach service to compute averages.
export async function getNutritionSummary(
  db: SQLiteDatabase,
  days: number = 7,
): Promise<{ days_logged: number; avg_calories: number; avg_protein: number; avg_carbs: number; avg_fats: number }> {
  const result = await db.getFirstAsync<{
    days_logged: number;
    avg_calories: number;
    avg_protein: number;
    avg_carbs: number;
    avg_fats: number;
  }>(
    `SELECT
       COUNT(DISTINCT date) as days_logged,
       COALESCE(AVG(daily_cal), 0) as avg_calories,
       COALESCE(AVG(daily_protein), 0) as avg_protein,
       COALESCE(AVG(daily_carbs), 0) as avg_carbs,
       COALESCE(AVG(daily_fats), 0) as avg_fats
     FROM (
       SELECT date,
              SUM(calories) as daily_cal,
              SUM(protein) as daily_protein,
              SUM(carbs) as daily_carbs,
              SUM(fats) as daily_fats
       FROM nutrition_entry
       WHERE date >= date('now', '-' || ? || ' days')
       GROUP BY date
     )`,
    [days],
  );
  return result ?? { days_logged: 0, avg_calories: 0, avg_protein: 0, avg_carbs: 0, avg_fats: 0 };
}
