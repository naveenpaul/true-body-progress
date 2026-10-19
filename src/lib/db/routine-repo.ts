import type { SQLiteDatabase } from 'expo-sqlite';

import type { Routine, RoutineExerciseInput, RoutineExerciseWithName } from '@/lib/types';

export async function getAllRoutines(db: SQLiteDatabase): Promise<Routine[]> {
  return db.getAllAsync<Routine>(
    `SELECT r.*,
            (SELECT COUNT(*) FROM routine_exercise re WHERE re.routine_id = r.id) as exercise_count,
            (SELECT GROUP_CONCAT(name, ', ') FROM (
               SELECT e.name FROM routine_exercise re
               JOIN exercise e ON e.id = re.exercise_id
               WHERE re.routine_id = r.id
               ORDER BY re.position
             )) as exercise_names
     FROM routine r
     ORDER BY r.position, r.id`,
  );
}

export async function getRoutineExercises(db: SQLiteDatabase, routineId: number): Promise<RoutineExerciseWithName[]> {
  return db.getAllAsync<RoutineExerciseWithName>(
    `SELECT re.*, e.name as exercise_name, e.tracking_type
     FROM routine_exercise re
     JOIN exercise e ON e.id = re.exercise_id
     WHERE re.routine_id = ?
     ORDER BY re.position`,
    [routineId],
  );
}

async function insertExercises(db: SQLiteDatabase, routineId: number, exercises: RoutineExerciseInput[]): Promise<void> {
  for (const [position, ex] of exercises.entries()) {
    await db.runAsync(
      `INSERT INTO routine_exercise (routine_id, exercise_id, position, target_sets, rep_min, rep_max)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [routineId, ex.exercise_id, position, ex.target_sets, ex.rep_min, ex.rep_max],
    );
  }
}

export async function createRoutine(db: SQLiteDatabase, name: string, exercises: RoutineExerciseInput[]): Promise<number> {
  let routineId = 0;
  await db.withTransactionAsync(async () => {
    const next = await db.getFirstAsync<{ pos: number }>('SELECT COALESCE(MAX(position) + 1, 0) as pos FROM routine');
    const result = await db.runAsync(
      'INSERT INTO routine (name, position) VALUES (?, ?)',
      [name, next?.pos ?? 0],
    );
    routineId = result.lastInsertRowId;
    await insertExercises(db, routineId, exercises);
  });
  return routineId;
}

// Replaces the routine's name and full exercise list. Past workouts keep their
// own sets, so editing a routine never changes history.
export async function updateRoutine(
  db: SQLiteDatabase,
  routineId: number,
  name: string,
  exercises: RoutineExerciseInput[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE routine SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, routineId],
    );
    await db.runAsync('DELETE FROM routine_exercise WHERE routine_id = ?', [routineId]);
    await insertExercises(db, routineId, exercises);
  });
}

export async function deleteRoutine(db: SQLiteDatabase, routineId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    // workout_session.routine_id was added via ALTER TABLE, which SQLite can't
    // give ON DELETE SET NULL — unlink history by hand so the delete isn't
    // blocked by the FK and past workouts survive.
    await db.runAsync('UPDATE workout_session SET routine_id = NULL WHERE routine_id = ?', [routineId]);
    await db.runAsync('DELETE FROM routine WHERE id = ?', [routineId]);
  });
}

// Swap a routine with its neighbour to reorder the rotation.
export async function moveRoutine(db: SQLiteDatabase, routineId: number, direction: -1 | 1): Promise<void> {
  const routines = await db.getAllAsync<{ id: number }>('SELECT id FROM routine ORDER BY position, id');
  const idx = routines.findIndex(r => r.id === routineId);
  const target = idx + direction;
  if (idx < 0 || target < 0 || target >= routines.length)
    return;
  const ordered = [...routines];
  [ordered[idx], ordered[target]] = [ordered[target], ordered[idx]];
  await db.withTransactionAsync(async () => {
    for (const [position, r] of ordered.entries())
      await db.runAsync('UPDATE routine SET position = ? WHERE id = ?', [position, r.id]);
  });
}

// Next routine in the rotation: the one after the most recently trained
// routine, wrapping around. Falls back to the first routine.
export function pickNextRoutine(routines: Routine[], lastRoutineId: number | null): Routine | null {
  if (routines.length === 0)
    return null;
  const idx = routines.findIndex(r => r.id === lastRoutineId);
  return idx < 0 ? routines[0] : routines[(idx + 1) % routines.length];
}
