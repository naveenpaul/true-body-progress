import type { Suggestion } from '@/lib/types';

type StrengthInput = {
  exerciseName: string;
  recentSets: Array<{ reps: number; weight: number; rpe: number | null; date: string }>;
};

export function evaluateStrength(input: StrengthInput): Suggestion | null {
  const { exerciseName, recentSets } = input;
  if (recentSets.length === 0)
    return null;

  const topSets = recentSets.slice(-3);

  // If RPE is consistently 9-10, suggest deload
  const highRPECount = topSets.filter(s => s.rpe !== null && s.rpe >= 9).length;
  if (highRPECount >= 2) {
    return {
      id: `strength-deload-${exerciseName}`,
      type: 'strength',
      title: `Deload ${exerciseName}`,
      body: `RPE has been 9-10 for ${highRPECount} recent sets. Drop weight by 10% next session and focus on form.`,
      priority: 2,
    };
  }

  // If hitting 12+ reps consistently, suggest increase
  const highRepCount = topSets.filter(s => s.reps >= 12).length;
  if (highRepCount >= 2) {
    const currentWeight = topSets.at(-1)!.weight;
    const increment = currentWeight >= 40 ? 2.5 : 1.25;
    return {
      id: `strength-increase-${exerciseName}`,
      type: 'strength',
      title: `Increase ${exerciseName}`,
      body: `You've hit 12+ reps in ${highRepCount} recent sets at ${currentWeight}kg. Try ${currentWeight + increment}kg next session.`,
      priority: 3,
    };
  }

  // If reps dropping below 6, suggest decrease
  const lowRepCount = topSets.filter(s => s.reps < 6).length;
  if (lowRepCount >= 2) {
    const currentWeight = topSets.at(-1)!.weight;
    return {
      id: `strength-decrease-${exerciseName}`,
      type: 'strength',
      title: `Lower weight on ${exerciseName}`,
      body: `Struggling to hit 6 reps at ${currentWeight}kg. Drop to ${currentWeight - 2.5}kg and build back up.`,
      priority: 3,
    };
  }

  return null;
}
