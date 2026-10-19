import type { RoutineExerciseInput, TrackingType } from '@/lib/types';

export type ActiveSet = {
  exercise_id: number;
  exercise_name: string;
  tracking_type: TrackingType;
  set_number: number;
  reps: number;
  weight: number; // kg; added weight for bodyweight exercises
  duration_sec: number | null;
  distance_m: number | null;
  rpe: number | null;
  rest_time_sec: number | null;
  completed: boolean;
  prev_reps: number | null;
  prev_weight: number | null;
  prev_duration_sec: number | null;
  prev_distance_m: number | null;
  // Routine targets, copied onto every set of the exercise.
  rep_min: number | null;
  rep_max: number | null;
};

// A set counts (and gets saved) once its main metric is entered.
export function isSetFilled(s: Pick<ActiveSet, 'tracking_type' | 'reps' | 'duration_sec' | 'distance_m'>): boolean {
  switch (s.tracking_type) {
    case 'time':
      return (s.duration_sec ?? 0) > 0;
    case 'cardio':
      return (s.duration_sec ?? 0) > 0 || (s.distance_m ?? 0) > 0;
    default:
      return s.reps > 0;
  }
}

// Exercises in on-screen order with how many sets each has.
export function summarizeActiveSets(sets: ActiveSet[]): RoutineExerciseInput[] {
  const out: RoutineExerciseInput[] = [];
  for (const s of sets) {
    const existing = out.find(e => e.exercise_id === s.exercise_id);
    if (existing)
      existing.target_sets += 1;
    else
      out.push({ exercise_id: s.exercise_id, target_sets: 1, rep_min: s.rep_min, rep_max: s.rep_max });
  }
  return out;
}

// True when the workout's exercise list (order, set counts) no longer matches
// the routine it was started from.
export function routineChanged(plan: RoutineExerciseInput[], sets: ActiveSet[]): boolean {
  const actual = summarizeActiveSets(sets);
  if (actual.length !== plan.length)
    return true;
  return actual.some((a, i) => a.exercise_id !== plan[i].exercise_id || a.target_sets !== plan[i].target_sets);
}

// Suggested load jump once the top of the rep range is hit on every set.
export function progressionIncrementKg(weightKg: number): number {
  return weightKg >= 40 ? 2.5 : 1;
}

// "Add weight" hint: last time, every set reached the top of the target range.
export function shouldIncreaseWeight(sets: ActiveSet[]): boolean {
  const first = sets[0];
  if (!first || first.tracking_type !== 'weight_reps' || first.rep_max == null)
    return false;
  const withPrev = sets.filter(s => s.prev_reps != null);
  return withPrev.length > 0 && withPrev.every(s => (s.prev_reps ?? 0) >= first.rep_max!);
}

export function formatSeconds(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// Accepts "90", "1:30" or "1.5" (minutes with a decimal is ambiguous, so a
// plain number is seconds). Returns 0 for anything unparseable.
export function parseDuration(input: string): number {
  const trimmed = input.trim();
  if (trimmed.includes(':')) {
    const [m, s] = trimmed.split(':');
    const mins = Number.parseInt(m || '0', 10);
    const secs = Number.parseInt(s || '0', 10);
    return Number.isNaN(mins) || Number.isNaN(secs) ? 0 : mins * 60 + secs;
  }
  const n = Number.parseFloat(trimmed.replace(',', '.'));
  return Number.isNaN(n) ? 0 : Math.round(n);
}
