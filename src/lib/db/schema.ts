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
    enum: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'],
  }).notNull(),
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
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    dateIdx: index('idx_workout_session_date').on(table.date),
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
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  table => ({
    dateIdx: index('idx_nutrition_entry_date').on(table.date),
  }),
);
