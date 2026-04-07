import type { SQLiteDatabase } from 'expo-sqlite';

const DEFAULT_EXERCISES = [
  // Chest
  { name: 'Bench Press', primary: 'chest', secondary: 'triceps', equipment: 'barbell' },
  { name: 'Incline Bench Press', primary: 'chest', secondary: 'shoulders', equipment: 'barbell' },
  { name: 'Dumbbell Bench Press', primary: 'chest', secondary: 'triceps', equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Press', primary: 'chest', secondary: 'shoulders', equipment: 'dumbbell' },
  { name: 'Cable Fly', primary: 'chest', secondary: null, equipment: 'cable' },
  { name: 'Chest Press Machine', primary: 'chest', secondary: 'triceps', equipment: 'machine' },
  { name: 'Push Up', primary: 'chest', secondary: 'triceps', equipment: 'bodyweight' },
  { name: 'Dips', primary: 'chest', secondary: 'triceps', equipment: 'bodyweight' },

  // Back
  { name: 'Deadlift', primary: 'back', secondary: 'hamstrings', equipment: 'barbell' },
  { name: 'Barbell Row', primary: 'back', secondary: 'biceps', equipment: 'barbell' },
  { name: 'Dumbbell Row', primary: 'back', secondary: 'biceps', equipment: 'dumbbell' },
  { name: 'Lat Pulldown', primary: 'back', secondary: 'biceps', equipment: 'cable' },
  { name: 'Seated Cable Row', primary: 'back', secondary: 'biceps', equipment: 'cable' },
  { name: 'T-Bar Row', primary: 'back', secondary: 'biceps', equipment: 'barbell' },
  { name: 'Pull Up', primary: 'back', secondary: 'biceps', equipment: 'bodyweight' },
  { name: 'Chin Up', primary: 'back', secondary: 'biceps', equipment: 'bodyweight' },

  // Shoulders
  { name: 'Overhead Press', primary: 'shoulders', secondary: 'triceps', equipment: 'barbell' },
  { name: 'Dumbbell Shoulder Press', primary: 'shoulders', secondary: 'triceps', equipment: 'dumbbell' },
  { name: 'Lateral Raise', primary: 'shoulders', secondary: null, equipment: 'dumbbell' },
  { name: 'Front Raise', primary: 'shoulders', secondary: null, equipment: 'dumbbell' },
  { name: 'Face Pull', primary: 'shoulders', secondary: null, equipment: 'cable' },
  { name: 'Reverse Fly', primary: 'shoulders', secondary: null, equipment: 'dumbbell' },

  // Arms
  { name: 'Barbell Curl', primary: 'biceps', secondary: null, equipment: 'barbell' },
  { name: 'Dumbbell Curl', primary: 'biceps', secondary: null, equipment: 'dumbbell' },
  { name: 'Hammer Curl', primary: 'biceps', secondary: null, equipment: 'dumbbell' },
  { name: 'Cable Curl', primary: 'biceps', secondary: null, equipment: 'cable' },
  { name: 'Tricep Pushdown', primary: 'triceps', secondary: null, equipment: 'cable' },
  { name: 'Skull Crusher', primary: 'triceps', secondary: null, equipment: 'barbell' },
  { name: 'Overhead Tricep Extension', primary: 'triceps', secondary: null, equipment: 'dumbbell' },

  // Legs
  { name: 'Squat', primary: 'quadriceps', secondary: 'glutes', equipment: 'barbell' },
  { name: 'Front Squat', primary: 'quadriceps', secondary: 'core', equipment: 'barbell' },
  { name: 'Leg Press', primary: 'quadriceps', secondary: 'glutes', equipment: 'machine' },
  { name: 'Romanian Deadlift', primary: 'hamstrings', secondary: 'glutes', equipment: 'barbell' },
  { name: 'Leg Curl', primary: 'hamstrings', secondary: null, equipment: 'machine' },
  { name: 'Leg Extension', primary: 'quadriceps', secondary: null, equipment: 'machine' },
  { name: 'Bulgarian Split Squat', primary: 'quadriceps', secondary: 'glutes', equipment: 'dumbbell' },
  { name: 'Calf Raise', primary: 'calves', secondary: null, equipment: 'machine' },
  { name: 'Hip Thrust', primary: 'glutes', secondary: 'hamstrings', equipment: 'barbell' },
  { name: 'Lunges', primary: 'quadriceps', secondary: 'glutes', equipment: 'dumbbell' },

  // Core
  { name: 'Plank', primary: 'core', secondary: null, equipment: 'bodyweight' },
  { name: 'Hanging Leg Raise', primary: 'core', secondary: null, equipment: 'bodyweight' },
  { name: 'Cable Crunch', primary: 'core', secondary: null, equipment: 'cable' },
  { name: 'Ab Wheel Rollout', primary: 'core', secondary: null, equipment: 'bodyweight' },
];

export async function seedExercises(db: SQLiteDatabase): Promise<void> {
  const count = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercise WHERE is_custom = 0',
  );
  if (count && count.count > 0)
    return;

  await db.withTransactionAsync(async () => {
    for (const ex of DEFAULT_EXERCISES) {
      await db.runAsync(
        `INSERT INTO exercise (name, primary_muscle_group, secondary_muscle_group, equipment_type, is_custom)
         VALUES (?, ?, ?, ?, 0)`,
        [ex.name, ex.primary, ex.secondary, ex.equipment],
      );
    }
  });
}
