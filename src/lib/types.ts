// Core data types for the Gym app

export type GoalType = 'fat_loss' | 'muscle_gain' | 'recomposition';
export type Gender = 'male' | 'female';
export type UnitSystem = 'metric' | 'imperial';
export type EquipmentType
  = | 'barbell'
    | 'dumbbell'
    | 'cable'
    | 'machine'
    | 'bodyweight'
    | 'kettlebell'
    | 'smith_machine'
    | 'ez_bar'
    | 'band'
    | 'cardio_machine';

// weight_reps: kg × reps. bodyweight_reps: (body weight + added kg) × reps.
// time: a timed hold (plank). cardio: duration + distance.
export type TrackingType = 'weight_reps' | 'bodyweight_reps' | 'time' | 'cardio';

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
  tracking_type: TrackingType;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
};

export type WorkoutSession = {
  id: number;
  date: string;
  notes: string | null;
  routine_id: number | null;
  created_at: string;
  updated_at: string;
  // Populated by getRecentSessions
  routine_name?: string | null;
  set_count?: number;
  total_volume?: number;
  total_reps?: number;
  exercise_names?: string | null;
};

export type WorkoutSet = {
  id: number;
  session_id: number;
  exercise_id: number;
  set_number: number;
  reps: number;
  weight: number; // always stored in kg (added weight for bodyweight exercises)
  rpe: number | null; // 1-10
  rest_time_sec: number | null;
  duration_sec: number | null; // timed holds + cardio
  distance_m: number | null; // cardio, stored in metres
  bodyweight_kg: number | null; // body weight snapshot for bodyweight exercises
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
  fiber: number | null; // grams; null on entries logged before fiber was tracked
  food_id: string | null;
  servings: number | null;
  source: 'notion' | null;
  source_ref: string | null; // "<notion page id>:<column>"
  source_text: string | null; // the Notion cell text the macros were estimated from
  estimate_version: number | null; // meal estimator version for Notion entries
  created_at: string;
  updated_at: string;
};

export type Cuisine = 'indian' | 'us' | 'chinese' | 'korean' | 'generic' | 'custom';
export type FoodSource = 'builtin-unverified' | 'builtin-verified' | 'custom';

export type Food = {
  id: string;
  name: string;
  name_lower: string;
  cuisine: Cuisine;
  category: string;
  default_serving_qty: number;
  default_serving_unit: string; // "katori", "roti", "cup", "piece", "g"
  default_serving_grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  source: FoodSource;
  is_favorite: number; // 0 | 1
  created_at: string;
  updated_at: string;
};

// Shape used by seed JSON files. Omits server-managed columns.
export type FoodSeed = {
  id: string;
  name: string;
  cuisine: Cuisine;
  category: string;
  default_serving_qty: number;
  default_serving_unit: string;
  default_serving_grams: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
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
  tracking_type: TrackingType;
};

export type Routine = {
  id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
  // Populated by getAllRoutines
  exercise_count?: number;
  exercise_names?: string | null;
};

export type RoutineExercise = {
  id: number;
  routine_id: number;
  exercise_id: number;
  position: number;
  target_sets: number;
  rep_min: number | null;
  rep_max: number | null;
};

export type RoutineExerciseWithName = RoutineExercise & {
  exercise_name: string;
  tracking_type: TrackingType;
};

// Shape used when creating/replacing a routine's exercise list.
export type RoutineExerciseInput = {
  exercise_id: number;
  target_sets: number;
  rep_min: number | null;
  rep_max: number | null;
};
