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

  const [weightTrend, waistTrend, recentSessions] = await Promise.all([
    bodyMetricsRepo.getWeightTrend(db, 30),
    bodyMetricsRepo.getWaistTrend(db, 30),
    workoutRepo.getRecentSessions(db, 10),
  ]);

  // Fat loss rule
  const fatLossSuggestion = evaluateFatLoss({ weightTrend, waistTrend });
  if (fatLossSuggestion) suggestions.push(fatLossSuggestion);

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
    if (!exercise) continue;

    const lastSets = await workoutRepo.getLastSetsForExercise(db, exerciseId);
    const strengthSuggestion = evaluateStrength({
      exerciseName: exercise.name,
      recentSets: lastSets.map(s => ({
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
        date: s.created_at,
      })),
    });
    if (strengthSuggestion) suggestions.push(strengthSuggestion);
  }

  // Recovery rule
  const sessionsWithExercises = await Promise.all(
    recentSessions.slice(0, 5).map(async (session) => {
      const sets = await workoutRepo.getSessionSets(db, session.id);
      const exerciseDetails = await Promise.all(
        [...new Set(sets.map(s => s.exercise_id))].map(id => exerciseRepo.getExerciseById(db, id)),
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
    recentSessions.slice(0, 5).map(async (session) => {
      const sets = await workoutRepo.getSessionSets(db, session.id);
      const totalVolume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
      return { date: session.date, total_volume: totalVolume };
    }),
  );

  const recoverySuggestion = evaluateRecovery({
    recentSessions: sessionsWithExercises,
    performanceTrend,
  });
  if (recoverySuggestion) suggestions.push(recoverySuggestion);

  return suggestions.sort((a, b) => a.priority - b.priority);
}
