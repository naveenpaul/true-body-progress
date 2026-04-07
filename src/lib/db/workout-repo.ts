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
  // LEFT JOIN so deleting an exercise doesn't silently hide history that referenced it.
  return db.getAllAsync<WorkoutSetWithExercise>(
    `SELECT ws.*,
            COALESCE(e.name, '(deleted exercise)') as exercise_name,
            e.equipment_type
     FROM workout_set ws
     LEFT JOIN exercise e ON ws.exercise_id = e.id
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
  if (!lastSession)
    return [];

  return db.getAllAsync<WorkoutSet>(
    `SELECT * FROM workout_set
     WHERE session_id = ? AND exercise_id = ?
     ORDER BY set_number`,
    [lastSession.session_id, exerciseId],
  );
}

// Returns sets across the last N sessions for an exercise, ordered oldest-first.
// Used by the strength rule to evaluate trends across multiple workouts, not just one.
export async function getRecentSetsForExercise(
  db: SQLiteDatabase,
  exerciseId: number,
  sessionLimit: number = 3,
): Promise<Array<WorkoutSet & { date: string }>> {
  return db.getAllAsync<WorkoutSet & { date: string }>(
    `SELECT ws.*, s.date
     FROM workout_set ws
     JOIN workout_session s ON ws.session_id = s.id
     WHERE ws.exercise_id = ?
       AND s.id IN (
         SELECT DISTINCT s2.id FROM workout_session s2
         JOIN workout_set ws2 ON ws2.session_id = s2.id
         WHERE ws2.exercise_id = ?
         ORDER BY s2.date DESC LIMIT ?
       )
     ORDER BY s.date ASC, ws.set_number ASC`,
    [exerciseId, exerciseId, sessionLimit],
  );
}

// Returns per-day strength stats for an exercise.
// - total_volume: sum of weight*reps across all sets that day (the trend metric)
// - top_set_weight / top_set_reps: the single heaviest set that day (NOT max-of-each
//   independently, which would fabricate a set that never happened)
export async function getStrengthTrend(
  db: SQLiteDatabase,
  exerciseId: number,
  days: number = 90,
): Promise<Array<{ date: string; total_volume: number; top_set_weight: number; top_set_reps: number }>> {
  return db.getAllAsync(
    `SELECT
       ws.date,
       SUM(wset.weight * wset.reps) as total_volume,
       (SELECT w2.weight FROM workout_set w2
          JOIN workout_session s2 ON w2.session_id = s2.id
          WHERE w2.exercise_id = wset.exercise_id AND s2.date = ws.date
          ORDER BY w2.weight DESC, w2.reps DESC LIMIT 1) as top_set_weight,
       (SELECT w2.reps FROM workout_set w2
          JOIN workout_session s2 ON w2.session_id = s2.id
          WHERE w2.exercise_id = wset.exercise_id AND s2.date = ws.date
          ORDER BY w2.weight DESC, w2.reps DESC LIMIT 1) as top_set_reps
     FROM workout_set wset
     JOIN workout_session ws ON wset.session_id = ws.id
     WHERE wset.exercise_id = ?
       AND ws.date >= date('now', '-' || ? || ' days')
     GROUP BY ws.date
     ORDER BY ws.date`,
    [exerciseId, days],
  );
}

export async function deleteSession(db: SQLiteDatabase, sessionId: number): Promise<void> {
  await db.runAsync('DELETE FROM workout_session WHERE id = ?', [sessionId]);
}
