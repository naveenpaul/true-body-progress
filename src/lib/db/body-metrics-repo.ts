import type { SQLiteDatabase } from 'expo-sqlite';

import type { BodyMetric } from '@/lib/types';

export async function logMetric(
  db: SQLiteDatabase,
  date: string,
  weight?: number,
  waist?: number,
  bodyFat?: number,
  notes?: string,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO body_metric (date, weight, waist, body_fat, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [date, weight ?? null, waist ?? null, bodyFat ?? null, notes ?? null],
  );
  return result.lastInsertRowId;
}

export async function getLatest(db: SQLiteDatabase): Promise<BodyMetric | null> {
  return db.getFirstAsync<BodyMetric>(
    'SELECT * FROM body_metric ORDER BY date DESC LIMIT 1',
  );
}

export async function getWeightTrend(
  db: SQLiteDatabase,
  days: number = 30,
): Promise<Array<{ date: string; weight: number }>> {
  return db.getAllAsync(
    `SELECT date, weight FROM body_metric
     WHERE weight IS NOT NULL AND date >= date('now', '-' || ? || ' days')
     ORDER BY date`,
    [days],
  );
}

export async function getWaistTrend(
  db: SQLiteDatabase,
  days: number = 30,
): Promise<Array<{ date: string; waist: number }>> {
  return db.getAllAsync(
    `SELECT date, waist FROM body_metric
     WHERE waist IS NOT NULL AND date >= date('now', '-' || ? || ' days')
     ORDER BY date`,
    [days],
  );
}

export async function getRecentMetrics(db: SQLiteDatabase, limit: number = 10): Promise<BodyMetric[]> {
  return db.getAllAsync<BodyMetric>(
    'SELECT * FROM body_metric ORDER BY date DESC LIMIT ?',
    [limit],
  );
}
