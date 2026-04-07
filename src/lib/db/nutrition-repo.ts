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
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO nutrition_entry (date, meal_name, calories, protein, carbs, fats)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, mealName, calories, protein, carbs, fats],
  );
  return result.lastInsertRowId;
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
