// Coach service: combines rule engine + structured LLM insight

import type { SQLiteDatabase } from 'expo-sqlite';

import type { CoachInsight, CoachSnapshot } from './llm-client';

import type { Suggestion, User } from '@/lib/types';
import { addDays, today } from '@/lib/dates';
import * as bodyMetricsRepo from '@/lib/db/body-metrics-repo';
import * as nutritionRepo from '@/lib/db/nutrition-repo';
import * as workoutRepo from '@/lib/db/workout-repo';
import { getAllSuggestions } from '@/lib/rules';

import { buildNutritionTrends, describeTrends, trendLookbackDays } from '@/lib/services/nutrition-trends';
import { getCoachInsight, isLLMConfigured } from './llm-client';

export async function getCoachSuggestions(
  db: SQLiteDatabase,
  user: User,
): Promise<{ suggestions: Suggestion[]; insight: CoachInsight | null; snapshot: CoachSnapshot | null }> {
  const suggestions = await getAllSuggestions(db);

  const end = today();
  const [latest, weightTrend, waistTrend, workoutSummary, nutritionSummary, dailyNutrition] = await Promise.all([
    bodyMetricsRepo.getLatest(db),
    bodyMetricsRepo.getWeightTrend(db, 30),
    bodyMetricsRepo.getWaistTrend(db, 30),
    workoutRepo.getWorkoutSummary(db, 28),
    nutritionRepo.getNutritionSummary(db, 7),
    nutritionRepo.getDailyNutrition(db, addDays(end, -trendLookbackDays(14))),
  ]);

  const weightChange30d = weightTrend.length >= 2
    ? weightTrend.at(-1)!.weight - weightTrend[0].weight
    : null;
  const waistChange30d = waistTrend.length >= 2
    ? waistTrend.at(-1)!.waist - waistTrend[0].waist
    : null;

  const snapshot: CoachSnapshot = {
    name: user.name,
    goal: user.goal_type,
    age: user.age,
    heightCm: user.height_cm,
    targetWeightKg: user.target_weight,
    currentWeightKg: latest?.weight ?? null,
    weightChange30dKg: weightChange30d,
    waistChange30dCm: waistChange30d,
    sessionsLast4w: workoutSummary.session_count,
    totalSetsLast4w: workoutSummary.total_sets,
    totalVolumeKg: workoutSummary.total_volume,
    topExercises: workoutSummary.top_exercises,
    daysLoggedLast7: nutritionSummary.days_logged,
    avgCalories: nutritionSummary.avg_calories,
    avgProteinG: nutritionSummary.avg_protein,
    nutritionTrends: describeTrends(buildNutritionTrends(dailyNutrition, end, 14)),
    ruleFindings: suggestions.map(s => ({ title: s.title, body: s.body })),
  };

  if (!isLLMConfigured())
    return { suggestions, insight: null, snapshot };

  const insight = await getCoachInsight(snapshot);
  return { suggestions, insight, snapshot };
}
