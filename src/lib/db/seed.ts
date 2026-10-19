import type { SQLiteDatabase } from 'expo-sqlite';

import type { EquipmentType, FoodSeed, TrackingType } from '@/lib/types';

import {
  initFoodsFts,
  rebuildFoodsFtsIfEmpty,
  seedFoodsFromJson,
} from './foods-repo';
import chineseFoods from './seed-foods/chinese.json';
import genericFoods from './seed-foods/generic.json';
import indianFoods from './seed-foods/indian.json';
import koreanFoods from './seed-foods/korean.json';
import usFoods from './seed-foods/us.json';

type ExerciseSeed = {
  name: string;
  primary: string;
  secondary: string | null;
  equipment: EquipmentType;
  tracking?: TrackingType; // defaults to weight_reps
};

const DEFAULT_EXERCISES: ExerciseSeed[] = [
  // Chest
  { name: 'Bench Press', primary: 'chest', secondary: 'triceps', equipment: 'barbell' },
  { name: 'Incline Bench Press', primary: 'chest', secondary: 'shoulders', equipment: 'barbell' },
  { name: 'Dumbbell Bench Press', primary: 'chest', secondary: 'triceps', equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Press', primary: 'chest', secondary: 'shoulders', equipment: 'dumbbell' },
  { name: 'Incline Cable Fly', primary: 'chest', secondary: 'shoulders', equipment: 'cable' },
  { name: 'Cable Fly', primary: 'chest', secondary: null, equipment: 'cable' },
  { name: 'Chest Press Machine', primary: 'chest', secondary: 'triceps', equipment: 'machine' },
  { name: 'Push Up', primary: 'chest', secondary: 'triceps', equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Dips', primary: 'chest', secondary: 'triceps', equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Decline Bench Press', primary: 'chest', secondary: 'triceps', equipment: 'barbell' },
  { name: 'Pec Deck', primary: 'chest', secondary: null, equipment: 'machine' },
  { name: 'Dumbbell Fly', primary: 'chest', secondary: null, equipment: 'dumbbell' },
  { name: 'Smith Machine Incline Press', primary: 'chest', secondary: 'shoulders', equipment: 'smith_machine' },

  // Back
  { name: 'Deadlift', primary: 'back', secondary: 'hamstrings', equipment: 'barbell' },
  { name: 'Barbell Row', primary: 'back', secondary: 'biceps', equipment: 'barbell' },
  { name: 'Dumbbell Row', primary: 'back', secondary: 'biceps', equipment: 'dumbbell' },
  { name: 'Lat Pulldown', primary: 'back', secondary: 'biceps', equipment: 'cable' },
  { name: 'Seated Cable Row', primary: 'back', secondary: 'biceps', equipment: 'cable' },
  { name: 'T-Bar Row', primary: 'back', secondary: 'biceps', equipment: 'barbell' },
  { name: 'Pull Up', primary: 'back', secondary: 'biceps', equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Chin Up', primary: 'back', secondary: 'biceps', equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Straight-Arm Pulldown', primary: 'back', secondary: null, equipment: 'cable' },
  { name: 'Chest-Supported Row', primary: 'back', secondary: 'biceps', equipment: 'machine' },
  { name: 'Rack Pull', primary: 'back', secondary: 'glutes', equipment: 'barbell' },
  { name: 'Barbell Shrug', primary: 'back', secondary: null, equipment: 'barbell' },
  { name: 'Dumbbell Shrug', primary: 'back', secondary: null, equipment: 'dumbbell' },
  { name: 'Back Extension', primary: 'back', secondary: 'glutes', equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Machine Row', primary: 'back', secondary: 'biceps', equipment: 'machine' },
  { name: 'Single-Arm Lat Pulldown', primary: 'back', secondary: 'biceps', equipment: 'cable' },
  { name: 'Pendlay Row', primary: 'back', secondary: 'biceps', equipment: 'barbell' },
  { name: 'Sumo Deadlift', primary: 'back', secondary: 'glutes', equipment: 'barbell' },

  // Shoulders
  { name: 'Overhead Press', primary: 'shoulders', secondary: 'triceps', equipment: 'barbell' },
  { name: 'Dumbbell Shoulder Press', primary: 'shoulders', secondary: 'triceps', equipment: 'dumbbell' },
  { name: 'Lateral Raise', primary: 'shoulders', secondary: null, equipment: 'dumbbell' },
  { name: 'Front Raise', primary: 'shoulders', secondary: null, equipment: 'dumbbell' },
  { name: 'Face Pull', primary: 'shoulders', secondary: null, equipment: 'cable' },
  { name: 'Reverse Fly', primary: 'shoulders', secondary: null, equipment: 'dumbbell' },
  { name: 'Lu Raise', primary: 'shoulders', secondary: null, equipment: 'dumbbell' },
  { name: 'Cable Lateral Raise', primary: 'shoulders', secondary: null, equipment: 'cable' },
  { name: 'Machine Lateral Raise', primary: 'shoulders', secondary: null, equipment: 'machine' },
  { name: 'Arnold Press', primary: 'shoulders', secondary: 'triceps', equipment: 'dumbbell' },
  { name: 'Machine Shoulder Press', primary: 'shoulders', secondary: 'triceps', equipment: 'machine' },
  { name: 'Upright Row', primary: 'shoulders', secondary: 'back', equipment: 'barbell' },
  { name: 'Rear Delt Machine Fly', primary: 'shoulders', secondary: 'back', equipment: 'machine' },
  { name: 'Landmine Press', primary: 'shoulders', secondary: 'chest', equipment: 'barbell' },
  { name: 'Band Pull-Apart', primary: 'shoulders', secondary: 'back', equipment: 'band' },

  // Arms
  { name: 'Barbell Curl', primary: 'biceps', secondary: null, equipment: 'barbell' },
  { name: 'Dumbbell Curl', primary: 'biceps', secondary: null, equipment: 'dumbbell' },
  { name: 'Hammer Curl', primary: 'biceps', secondary: null, equipment: 'dumbbell' },
  { name: 'Cable Curl', primary: 'biceps', secondary: null, equipment: 'cable' },
  { name: 'Tricep Pushdown', primary: 'triceps', secondary: null, equipment: 'cable' },
  { name: 'Skull Crusher', primary: 'triceps', secondary: null, equipment: 'barbell' },
  { name: 'Overhead Tricep Extension', primary: 'triceps', secondary: null, equipment: 'dumbbell' },
  { name: 'Preacher Curl', primary: 'biceps', secondary: null, equipment: 'barbell' },
  { name: 'Incline Dumbbell Curl', primary: 'biceps', secondary: null, equipment: 'dumbbell' },
  { name: 'Concentration Curl', primary: 'biceps', secondary: null, equipment: 'dumbbell' },
  { name: 'Reverse Curl', primary: 'biceps', secondary: null, equipment: 'barbell' },
  { name: 'Close-Grip Bench Press', primary: 'triceps', secondary: 'chest', equipment: 'barbell' },
  { name: 'Cable Overhead Tricep Extension', primary: 'triceps', secondary: null, equipment: 'cable' },
  { name: 'Tricep Kickback', primary: 'triceps', secondary: null, equipment: 'dumbbell' },
  { name: 'EZ Bar Curl', primary: 'biceps', secondary: null, equipment: 'ez_bar' },
  { name: 'EZ Bar Skull Crusher', primary: 'triceps', secondary: null, equipment: 'ez_bar' },

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
  { name: 'Hack Squat', primary: 'quadriceps', secondary: 'glutes', equipment: 'machine' },
  { name: 'Goblet Squat', primary: 'quadriceps', secondary: 'glutes', equipment: 'dumbbell' },
  { name: 'Smith Machine Squat', primary: 'quadriceps', secondary: 'glutes', equipment: 'smith_machine' },
  { name: 'Seated Leg Curl', primary: 'hamstrings', secondary: null, equipment: 'machine' },
  { name: 'Good Morning', primary: 'hamstrings', secondary: 'back', equipment: 'barbell' },
  { name: 'Seated Calf Raise', primary: 'calves', secondary: null, equipment: 'machine' },
  { name: 'Hip Abduction', primary: 'glutes', secondary: null, equipment: 'machine' },
  { name: 'Hip Adduction', primary: 'quadriceps', secondary: null, equipment: 'machine' },
  { name: 'Glute Kickback', primary: 'glutes', secondary: 'hamstrings', equipment: 'cable' },
  { name: 'Walking Lunges', primary: 'quadriceps', secondary: 'glutes', equipment: 'dumbbell' },
  { name: 'Step-Ups', primary: 'quadriceps', secondary: 'glutes', equipment: 'dumbbell' },
  { name: 'Leg Press Calf Raise', primary: 'calves', secondary: null, equipment: 'machine' },
  { name: 'Nordic Curl', primary: 'hamstrings', secondary: null, equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Kettlebell Swing', primary: 'glutes', secondary: 'hamstrings', equipment: 'kettlebell' },
  { name: 'Wall Sit', primary: 'quadriceps', secondary: null, equipment: 'bodyweight', tracking: 'time' },

  // Core
  { name: 'Plank', primary: 'core', secondary: null, equipment: 'bodyweight', tracking: 'time' },
  { name: 'Hanging Leg Raise', primary: 'core', secondary: null, equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Cable Crunch', primary: 'core', secondary: null, equipment: 'cable' },
  { name: 'Ab Wheel Rollout', primary: 'core', secondary: null, equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Crunch', primary: 'core', secondary: null, equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Russian Twist', primary: 'core', secondary: null, equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Side Plank', primary: 'core', secondary: null, equipment: 'bodyweight', tracking: 'time' },
  { name: 'Cable Woodchopper', primary: 'core', secondary: null, equipment: 'cable' },
  { name: 'Decline Crunch', primary: 'core', secondary: null, equipment: 'bodyweight', tracking: 'bodyweight_reps' },
  { name: 'Dead Hang', primary: 'back', secondary: null, equipment: 'bodyweight', tracking: 'time' },

  // Cardio
  { name: 'Treadmill Run', primary: 'cardio', secondary: null, equipment: 'cardio_machine', tracking: 'cardio' },
  { name: 'Incline Treadmill Walk', primary: 'cardio', secondary: null, equipment: 'cardio_machine', tracking: 'cardio' },
  { name: 'Stationary Bike', primary: 'cardio', secondary: null, equipment: 'cardio_machine', tracking: 'cardio' },
  { name: 'Rowing Machine', primary: 'cardio', secondary: null, equipment: 'cardio_machine', tracking: 'cardio' },
  { name: 'Elliptical', primary: 'cardio', secondary: null, equipment: 'cardio_machine', tracking: 'cardio' },
  { name: 'Stair Climber', primary: 'cardio', secondary: null, equipment: 'cardio_machine', tracking: 'cardio' },
  { name: 'Jump Rope', primary: 'cardio', secondary: null, equipment: 'bodyweight', tracking: 'cardio' },
  { name: 'Outdoor Run', primary: 'cardio', secondary: null, equipment: 'bodyweight', tracking: 'cardio' },
];

// Bumped whenever bundled foods change in a way that should re-seed.
// We INSERT OR IGNORE on stable string ids so re-running is safe — bumping
// this just lets us add new builtin rows without nuking custom foods.
const FOODS_SEED_VERSION = 4;

export async function seedFoods(db: SQLiteDatabase): Promise<void> {
  await initFoodsFts(db);
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS kv_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  );

  const versionRow = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM kv_meta WHERE key = 'foods_seed_version'`,
  );
  const currentVersion = versionRow ? Number(versionRow.value) : 0;
  if (currentVersion >= FOODS_SEED_VERSION) {
    await rebuildFoodsFtsIfEmpty(db);
    return;
  }

  const allRows: FoodSeed[] = [
    ...(indianFoods as FoodSeed[]),
    ...(usFoods as FoodSeed[]),
    ...(chineseFoods as FoodSeed[]),
    ...(koreanFoods as FoodSeed[]),
    ...(genericFoods as FoodSeed[]),
  ];
  await seedFoodsFromJson(db, allRows);
  await rebuildFoodsFtsIfEmpty(db);

  await db.runAsync(
    `INSERT INTO kv_meta (key, value) VALUES ('foods_seed_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(FOODS_SEED_VERSION)],
  );
}

// Inserts any builtin exercise whose name isn't already in the table, so new
// exercises added here reach existing installs on update. Existing builtin
// rows only get their equipment/tracking type synced; ids never change, so
// history stays intact. Custom exercises are never touched.
export async function seedExercises(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const ex of DEFAULT_EXERCISES) {
      const tracking = ex.tracking ?? 'weight_reps';
      await db.runAsync(
        `INSERT INTO exercise (name, primary_muscle_group, secondary_muscle_group, equipment_type, tracking_type, is_custom)
         SELECT ?, ?, ?, ?, ?, 0
         WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE name = ? COLLATE NOCASE)`,
        [ex.name, ex.primary, ex.secondary, ex.equipment, tracking, ex.name],
      );
      await db.runAsync(
        `UPDATE exercise SET equipment_type = ?, tracking_type = ?
         WHERE name = ? COLLATE NOCASE AND is_custom = 0
           AND (equipment_type != ? OR tracking_type != ?)`,
        [ex.equipment, tracking, ex.name, ex.equipment, tracking],
      );
    }
  });
}
