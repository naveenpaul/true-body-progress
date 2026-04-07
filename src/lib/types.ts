// Core data types for the Gym app

export type GoalType = 'fat_loss' | 'muscle_gain' | 'recomposition';
export type Gender = 'male' | 'female';
export type UnitSystem = 'metric' | 'imperial';
export type EquipmentType = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight';

export type User = {
  id: number;
  name: string;
  height_cm: number;
  age: number;
  gender: Gender;
  goal_type: GoalType;
  target_weight: number;
  preferred_units: UnitSystem;
  created_at: string;
  updated_at: string;
};

export type Exercise = {
  id: number;
  name: string;
  primary_muscle_group: string;
  secondary_muscle_group: string | null;
  equipment_type: EquipmentType;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutSession = {
  id: number;
  date: string;
  duration: number; // seconds
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkoutSet = {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  reps: number;
  weight: number; // always stored in kg
  rpe: number | null; // 1-10
  rest_time_sec: number | null;
  created_at: string;
  updated_at: string;
};

export type BodyMetric = {
  id: number;
  date: string;
  weight: number | null; // stored in kg
  waist: number | null; // stored in cm
  body_fat: number | null; // percentage
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NutritionEntry = {
  id: number;
  date: string;
  meal_name: string;
  calories: number;
  protein: number; // grams
  carbs: number; // grams
  fats: number; // grams
  created_at: string;
  updated_at: string;
};

export type Suggestion = {
  id: string;
  type: 'strength' | 'fat_loss' | 'recovery' | 'celebration';
  title: string;
  body: string;
  priority: number; // 1 = highest
};

export type WorkoutSetWithExercise = WorkoutSet & {
  exercise_name: string;
  equipment_type: EquipmentType;
};
