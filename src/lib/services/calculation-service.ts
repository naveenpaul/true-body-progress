import type { Gender, GoalType } from '@/lib/types';

// Mifflin-St Jeor formula
export function calculateBMR(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_MULTIPLIERS;

export function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender,
  activityLevel: ActivityLevel = 'moderate',
): number {
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

export function calculateTargetCalories(
  tdee: number,
  goalType: GoalType,
): number {
  switch (goalType) {
    case 'fat_loss': return tdee - 400;
    case 'muscle_gain': return tdee + 300;
    case 'recomposition': return tdee - 100;
  }
}

export function calculateMacroTargets(
  targetCalories: number,
  weightKg: number,
  goalType: GoalType,
): { protein: number; carbs: number; fats: number } {
  const proteinPerKg = goalType === 'fat_loss' ? 2.0 : goalType === 'muscle_gain' ? 1.6 : 1.8;
  const protein = Math.round(weightKg * proteinPerKg);

  const fatCalories = targetCalories * 0.25;
  const fats = Math.round(fatCalories / 9);

  const proteinCalories = protein * 4;
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbs = Math.round(Math.max(0, carbCalories / 4));

  return { protein, carbs, fats };
}

export function calculateWeeklyChange(
  weights: Array<{ date: string; weight: number }>,
): number | null {
  if (weights.length < 2) return null;
  const recent = weights[weights.length - 1].weight;
  const weekAgo = weights.find((_, i) => i <= weights.length - 7);
  if (!weekAgo) return recent - weights[0].weight;
  return Math.round((recent - weekAgo.weight) * 10) / 10;
}
