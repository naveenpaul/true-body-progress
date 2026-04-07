import type { SQLiteDatabase } from 'expo-sqlite';

import type { Gender, GoalType, UnitSystem, User } from '@/lib/types';

export async function getUser(db: SQLiteDatabase): Promise<User | null> {
  return db.getFirstAsync<User>('SELECT * FROM user_profile LIMIT 1');
}

export async function createUser(
  db: SQLiteDatabase,
  name: string,
  heightCm: number,
  age: number,
  gender: Gender,
  goalType: GoalType,
  targetWeight: number,
  preferredUnits: UnitSystem = 'metric',
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO user_profile (name, height_cm, age, gender, goal_type, target_weight, preferred_units)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, heightCm, age, gender, goalType, targetWeight, preferredUnits],
  );
  return result.lastInsertRowId;
}

export async function updateUser(
  db: SQLiteDatabase,
  updates: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (fields.length === 0)
    return;

  fields.push('updated_at = datetime(\'now\')');
  await db.runAsync(
    `UPDATE user_profile SET ${fields.join(', ')} WHERE id = (SELECT id FROM user_profile LIMIT 1)`,
    values,
  );
}
