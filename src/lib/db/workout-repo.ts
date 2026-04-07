import type { SQLiteDatabase } from 'expo-sqlite';

import type { WorkoutSession, WorkoutSet, WorkoutSetWithExercise } from '@/lib/types';

export async function saveWorkout(
  db: SQLiteDatabase,
  date: string,
  durationSec: number,
  sets: Array<{ exercise_id: number; set_number: number; reps: number; weight: number; rpe: number | null }>,
  notes?: string,
): Promise<number> {
  let sessionId = 0;

  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO workout_session (date, duration, notes) VALUES (?, ?, ?)',
      [date, durationSec, notes ?? null],
    );
    sessionId = result.lastInsertRowId;

    for (const set of sets) {
      await db.runAsync(
        `INSERT INTO workout_set (session_id, exercise_id, set_number, reps, weight, rpe)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [sessionId, set.exercise_id, set.set_number, set.reps, set.weight, set.rpe],
      );
    }
  });

  return sessionId;
}

export async function getRecentSessions(db: SQLiteDatabase, limit: number = 10): Promise<WorkoutSession[]> {
  return db.getAllAsync<WorkoutSession>(
    'SELECT * FROM workout_session ORDER BY date DESC LIMIT ?',
    [limit],
  );
}

export async function getSessionSets(db: SQLiteDatabase, sessionId: number): Promise<WorkoutSetWithExercise[]> {
  return db.getAllAsync<WorkoutSetWithExercise>(
    `SELECT ws.*, e.name as exercise_name, e.equipment_type
     FROM workout_set ws
     JOIN exercise e ON ws.exercise_id = e.id
     WHERE ws.session_id = ?
     ORDER BY ws.exercise_id, ws.set_number`,
    [sessionId],
  );
}

export async function getLastSetsForExercise(db: SQLiteDatabase, exerciseId: number): Promise<WorkoutSet[]> {
  const lastSession = await db.getFirstAsync<{ session_id: number }>(
    `SELECT session_id FROM workout_set
     WHERE exercise_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [exerciseId],
  );
  if (!lastSession) return [];

  return db.getAllAsync<WorkoutSet>(
    `SELECT * FROM workout_set
     WHERE session_id = ? AND exercise_id = ?
     ORDER BY set_number`,
    [lastSession.session_id, exerciseId],
  );
}

export async function getStrengthTrend(
  db: SQLiteDatabase,
  exerciseId: number,
  days: number = 90,
): Promise<Array<{ date: string; max_weight: number; max_reps: number }>> {
  return db.getAllAsync(
    `SELECT ws2.date, MAX(wset.weight) as max_weight, MAX(wset.reps) as max_reps
     FROM workout_set wset
     JOIN workout_session ws2 ON wset.session_id = ws2.id
     WHERE wset.exercise_id = ?
       AND ws2.date >= date('now', '-' || ? || ' days')
     GROUP BY ws2.date
     ORDER BY ws2.date`,
    [exerciseId, days],
  );
}

export async function deleteSession(db: SQLiteDatabase, sessionId: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_session WHERE id = ?', [sessionId]);
}
