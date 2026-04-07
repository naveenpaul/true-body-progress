import type { SQLiteDatabase } from 'expo-sqlite';

import type { Suggestion } from '@/lib/types';

import * as bodyMetricsRepo from '@/lib/db/body-metrics-repo';
import * as exerciseRepo from '@/lib/db/exercise-repo';
import * as workoutRepo from '@/lib/db/workout-repo';

import { evaluateFatLoss } from './fat-loss-rule';
import { evaluateRecovery } from './recovery-rule';
import { evaluateStrength } from './strength-rule';

export async function getAllSuggestions(db: SQLiteDatabase): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  const [weightTrend, waistTrend, recentSessionsDesc] = await Promise.all([
    bodyMetricsRepo.getWeightTrend(db, 30),
    bodyMetricsRepo.getWaistTrend(db, 30),
    workoutRepo.getRecentSessions(db, 10),
  ]);

  // getRecentSessions returns newest-first. The strength/recovery rules below assume
  // oldest-first ("recent" = end of array), so flip once here at the boundary.
  const recentSessions = [...recentSessionsDesc].reverse();

  // Fat loss rule
  const fatLossSuggestion = evaluateFatLoss({ weightTrend, waistTrend });
  if (fatLossSuggestion)
    suggestions.push(fatLossSuggestion);

  // Strength rules per exercise
  const exerciseIds = new Set<number>();
  for (const session of recentSessions) {
    const sets = await workoutRepo.getSessionSets(db, session.id);
    for (const set of sets) {
      exerciseIds.add(set.exercise_id);
    }
  }

  for (const exerciseId of exerciseIds) {
    const exercise = await exerciseRepo.getExerciseById(db, exerciseId);
    if (!exercise)
      continue;

    const recentSets = await workoutRepo.getRecentSetsForExercise(db, exerciseId, 3);
    const strengthSuggestion = evaluateStrength({
      exerciseName: exercise.name,
      recentSets: recentSets.map(s => ({
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
        date: s.date,
      })),
    });
    if (strengthSuggestion)
      suggestions.push(strengthSuggestion);
  }

  // Recovery rule
  const sessionsWithExercises = await Promise.all(
    recentSessions.slice(-5).map(async (session) => {
      const sets = await workoutRepo.getSessionSets(db, session.id);
      const exerciseDetails = await Promise.all(
        Array.from(new Set(sets.map(s => s.exercise_id)), id => exerciseRepo.getExerciseById(db, id)),
      );
      return {
        date: session.date,
        exercises: exerciseDetails.filter(Boolean).map(e => ({
          primary_muscle_group: e!.primary_muscle_group,
          secondary_muscle_group: e!.secondary_muscle_group,
        })),
      };
    }),
  );

  const performanceTrend = await Promise.all(
    recentSessions.slice(-5).map(async (session) => {
      const sets = await workoutRepo.getSessionSets(db, session.id);
      const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      return { date: session.date, total_volume: totalVolume };
    }),
  );

  const recoverySuggestion = evaluateRecovery({
    recentSessions: sessionsWithExercises,
    performanceTrend,
  });
  if (recoverySuggestion)
    suggestions.push(recoverySuggestion);

  return suggestions.sort((a, b) => a.priority - b.priority);
}
