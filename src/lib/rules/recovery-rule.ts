import type { Suggestion } from '@/lib/types';

type RecoveryInput = {
  recentSessions: Array<{
    date: string;
    exercises: Array<{ primary_muscle_group: string; secondary_muscle_group: string | null }>;
  }>;
  performanceTrend: Array<{ date: string; total_volume: number }>;
};

export function evaluateRecovery(input: RecoveryInput): Suggestion | null {
  const { recentSessions, performanceTrend } = input;

  if (recentSessions.length === 0) return null;

  // Check for same muscle group trained < 48h apart
  if (recentSessions.length >= 2) {
    const latest = recentSessions[recentSessions.length - 1];
    const previous = recentSessions[recentSessions.length - 2];
    const hoursBetween
      = (new Date(latest.date).getTime() - new Date(previous.date).getTime()) / (1000 * 60 * 60);

    if (hoursBetween < 48) {
      const latestMuscles = new Set(
        latest.exercises.flatMap(e =>
          [e.primary_muscle_group, e.secondary_muscle_group].filter(Boolean) as string[],
        ),
      );
      const overlap = previous.exercises.filter(e =>
        latestMuscles.has(e.primary_muscle_group),
      );

      if (overlap.length > 0) {
        const muscleNames = [...new Set(overlap.map(e => e.primary_muscle_group))].join(', ');
        return {
          id: 'recovery-overlap',
          type: 'recovery',
          title: 'Muscle overlap warning',
          body: `You trained ${muscleNames} less than 48 hours ago. Consider targeting different muscles or taking a rest day.`,
          priority: 1,
        };
      }
    }
  }

  // Check for performance decline over 3+ sessions
  if (performanceTrend.length >= 3) {
    const last3 = performanceTrend.slice(-3);
    const declining = last3.every((session, i) => {
      if (i === 0) return true;
      return session.total_volume < last3[i - 1].total_volume;
    });

    if (declining) {
      return {
        id: 'recovery-rest',
        type: 'recovery',
        title: 'Recovery needed',
        body: 'Performance has dropped for 3 consecutive sessions. Take a rest day or do a deload week.',
        priority: 1,
      };
    }
  }

  return null;
}
