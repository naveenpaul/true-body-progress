import type { SQLiteDatabase } from 'expo-sqlite';

import type { EquipmentType, Exercise } from '@/lib/types';

export async function getAllExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>('SELECT * FROM exercise ORDER BY name');
}

export async function getExerciseById(db: SQLiteDatabase, id: number): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercise WHERE id = ?', [id]);
}

export async function getExercisesByMuscleGroup(db: SQLiteDatabase, muscleGroup: string): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercise
     WHERE primary_muscle_group = ? OR secondary_muscle_group = ?
     ORDER BY name`,
    [muscleGroup, muscleGroup],
  );
}

export async function searchExercises(db: SQLiteDatabase, query: string): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(
    'SELECT * FROM exercise WHERE name LIKE ? ORDER BY name',
    [`%${query}%`],
  );
}

export async function createCustomExercise(
  db: SQLiteDatabase,
  name: string,
  primaryMuscleGroup: string,
  secondaryMuscleGroup: string | null,
  equipmentType: EquipmentType,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO exercise (name, primary_muscle_group, secondary_muscle_group, equipment_type, is_custom)
     VALUES (?, ?, ?, ?, 1)`,
    [name, primaryMuscleGroup, secondaryMuscleGroup, equipmentType],
  );
  return result.lastInsertRowId;
}
