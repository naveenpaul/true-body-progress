import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const userProfile = sqliteTable('user_profile', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  heightCm: real('height_cm').notNull(),
  age: integer('age').notNull(),
  gender: text('gender', { enum: ['male', 'female'] }).notNull(),
  goalType: text('goal_type', {
    enum: ['fat_loss', 'muscle_gain', 'recomposition'],
  }).notNull(),
  targetWeight: real('target_weight').notNull(),
  preferredUnits: text('preferred_units', { enum: ['metric', 'imperial'] })
    .notNull()
    .default('metric'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const exercise = sqliteTable('exercise', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  primaryMuscleGroup: text('primary_muscle_group').notNull(),
  secondaryMuscleGroup: text('secondary_muscle_group'),
  equipmentType: text('equipment_type', {
    enum: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'smith_machine', 'ez_bar', 'band', 'cardio_machine'],
  }).notNull(),
  // How sets are logged: weight×reps, bodyweight(+added)×reps, a timed hold,
  // or cardio (time + distance).
  trackingType: text('tracking_type', {
    enum: ['weight_reps', 'bodyweight_reps', 'time', 'cardio'],
  }).notNull().default('weight_reps'),
  isCustom: integer('is_custom').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const workoutSession = sqliteTable(
  'workout_session',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    notes: text('notes'),
    // Routine this workout was started from. Null for empty/ad-hoc workouts
    // and for history logged before routines existed.
    routineId: integer('routine_id').references(() => routine.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    dateIdx: index('idx_workout_session_date').on(table.date),
    routineIdx: index('idx_workout_session_routine').on(table.routineId),
  }),
);

export const workoutSet = sqliteTable(
  'workout_set',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => workoutSession.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercise.id),
    setNumber: integer('set_number').notNull(),
    reps: integer('reps').notNull(),
    weight: real('weight').notNull(),
    rpe: real('rpe'),
    restTimeSec: integer('rest_time_sec'),
    // Timed holds and cardio. Null for weight×reps sets.
    durationSec: integer('duration_sec'),
    distanceM: real('distance_m'),
    // Snapshot of the user's body weight when a bodyweight exercise was logged,
    // so volume = (bodyweight + added weight) × reps stays correct historically.
    bodyweightKg: real('bodyweight_kg'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    exerciseSessionIdx: index('idx_workout_set_exercise_session').on(
      table.exerciseId,
      table.sessionId,
    ),
    sessionIdx: index('idx_workout_set_session').on(table.sessionId),
  }),
);

export const bodyMetric = sqliteTable(
  'body_metric',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    weight: real('weight'),
    waist: real('waist'),
    bodyFat: real('body_fat'),
    notes: text('notes'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    dateIdx: index('idx_body_metric_date').on(table.date),
  }),
);

export const nutritionEntry = sqliteTable(
  'nutrition_entry',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    date: text('date').notNull(),
    mealName: text('meal_name').notNull(),
    calories: real('calories').notNull(),
    protein: real('protein').notNull(),
    carbs: real('carbs').notNull(),
    fats: real('fats').notNull(),
    // Optional link to a food row when added via picker. Null for legacy /
    // freeform entries. servings is the multiplier on food.default_serving_qty.
    foodId: text('food_id').references(() => food.id, { onDelete: 'set null' }),
    servings: real('servings'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    dateIdx: index('idx_nutrition_entry_date').on(table.date),
    foodIdx: index('idx_nutrition_entry_food').on(table.foodId),
  }),
);

// Curated + custom food database. Seeded from JSON on first launch (see
// seed-foods/*.json). String IDs are stable across seed updates so user
// nutrition_entries keep their references when we ship new builtin data.
export const food = sqliteTable(
  'food',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    nameLower: text('name_lower').notNull(),
    cuisine: text('cuisine', {
      enum: ['indian', 'us', 'chinese', 'korean', 'generic', 'custom'],
    }).notNull(),
    category: text('category').notNull(),
    defaultServingQty: real('default_serving_qty').notNull(),
    defaultServingUnit: text('default_serving_unit').notNull(),
    defaultServingGrams: real('default_serving_grams'),
    kcal: real('kcal').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    fiberG: real('fiber_g'),
    source: text('source', {
      enum: ['builtin-unverified', 'builtin-verified', 'custom'],
    }).notNull(),
    isFavorite: integer('is_favorite').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    nameLowerIdx: index('idx_food_name_lower').on(table.nameLower),
    cuisineIdx: index('idx_food_cuisine').on(table.cuisine),
    favoriteIdx: index('idx_food_favorite').on(table.isFavorite),
  }),
);

// Saved workout templates ("Push Day"). position orders them for the
// Push → Pull → Legs rotation suggestion.
export const routine = sqliteTable('routine', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const routineExercise = sqliteTable(
  'routine_exercise',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineId: integer('routine_id')
      .notNull()
      .references(() => routine.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercise.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    targetSets: integer('target_sets').notNull().default(3),
    // Optional rep range, e.g. 8–12. Drives the "add weight" hint.
    repMin: integer('rep_min'),
    repMax: integer('rep_max'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    routineIdx: index('idx_routine_exercise_routine').on(table.routineId, table.position),
  }),
);
