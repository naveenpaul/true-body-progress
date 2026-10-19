import type { ActiveSet } from './set-utils';

import { pickNextRoutine } from '@/lib/db/routine-repo';

import {
  formatSeconds,
  isSetFilled,
  parseDuration,
  routineChanged,
  shouldIncreaseWeight,
  summarizeActiveSets,
} from './set-utils';

function mkSet(overrides: Partial<ActiveSet> = {}): ActiveSet {
  return {
    exercise_id: 1,
    exercise_name: 'Bench',
    tracking_type: 'weight_reps',
    set_number: 1,
    reps: 0,
    weight: 0,
    duration_sec: null,
    distance_m: null,
    rpe: null,
    rest_time_sec: null,
    completed: false,
    prev_reps: null,
    prev_weight: null,
    prev_duration_sec: null,
    prev_distance_m: null,
    rep_min: null,
    rep_max: null,
    ...overrides,
  };
}

describe('isSetFilled', () => {
  it('needs reps for weight and bodyweight sets', () => {
    expect(isSetFilled(mkSet({ reps: 0, weight: 60 }))).toBe(false);
    expect(isSetFilled(mkSet({ reps: 8 }))).toBe(true);
    expect(isSetFilled(mkSet({ tracking_type: 'bodyweight_reps', reps: 10 }))).toBe(true);
  });

  it('needs a duration for timed holds', () => {
    expect(isSetFilled(mkSet({ tracking_type: 'time', reps: 5 }))).toBe(false);
    expect(isSetFilled(mkSet({ tracking_type: 'time', duration_sec: 60 }))).toBe(true);
  });

  it('accepts duration or distance for cardio', () => {
    expect(isSetFilled(mkSet({ tracking_type: 'cardio' }))).toBe(false);
    expect(isSetFilled(mkSet({ tracking_type: 'cardio', distance_m: 5000 }))).toBe(true);
    expect(isSetFilled(mkSet({ tracking_type: 'cardio', duration_sec: 1200 }))).toBe(true);
  });
});

describe('routineChanged', () => {
  const sets = [
    mkSet({ exercise_id: 1 }),
    mkSet({ exercise_id: 1, set_number: 2 }),
    mkSet({ exercise_id: 2 }),
  ];
  const plan = summarizeActiveSets(sets);

  it('summarizes exercises in order with set counts', () => {
    expect(plan.map(p => [p.exercise_id, p.target_sets])).toEqual([[1, 2], [2, 1]]);
  });

  it('is false when nothing structural changed (values may differ)', () => {
    expect(routineChanged(plan, sets.map(s => ({ ...s, reps: 10, weight: 50 })))).toBe(false);
  });

  it('detects added sets, removed exercises and reordering', () => {
    expect(routineChanged(plan, [...sets, mkSet({ exercise_id: 2, set_number: 2 })])).toBe(true);
    expect(routineChanged(plan, sets.slice(0, 2))).toBe(true);
    expect(routineChanged(plan, [sets[2], sets[0], sets[1]])).toBe(true);
  });
});

describe('shouldIncreaseWeight', () => {
  it('suggests more weight when every previous set hit the top of the range', () => {
    const sets = [
      mkSet({ rep_max: 12, prev_reps: 12, prev_weight: 50 }),
      mkSet({ rep_max: 12, prev_reps: 12, prev_weight: 50 }),
    ];
    expect(shouldIncreaseWeight(sets)).toBe(true);
  });

  it('does not when any set fell short, or no range / no history', () => {
    expect(shouldIncreaseWeight([
      mkSet({ rep_max: 12, prev_reps: 12 }),
      mkSet({ rep_max: 12, prev_reps: 10 }),
    ])).toBe(false);
    expect(shouldIncreaseWeight([mkSet({ prev_reps: 12 })])).toBe(false);
    expect(shouldIncreaseWeight([mkSet({ rep_max: 12 })])).toBe(false);
    expect(shouldIncreaseWeight([mkSet({ tracking_type: 'bodyweight_reps', rep_max: 12, prev_reps: 12 })])).toBe(false);
  });
});

describe('durations', () => {
  it('parses seconds and m:ss', () => {
    expect(parseDuration('90')).toBe(90);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('2:')).toBe(120);
    expect(parseDuration('abc')).toBe(0);
  });

  it('formats as m:ss', () => {
    expect(formatSeconds(90)).toBe('1:30');
    expect(formatSeconds(5)).toBe('0:05');
  });
});

describe('pickNextRoutine', () => {
  const routines = [
    { id: 10, name: 'Push', position: 0, created_at: '', updated_at: '' },
    { id: 11, name: 'Pull', position: 1, created_at: '', updated_at: '' },
    { id: 12, name: 'Legs', position: 2, created_at: '', updated_at: '' },
  ];

  it('suggests the routine after the last one trained, wrapping around', () => {
    expect(pickNextRoutine(routines, 10)?.name).toBe('Pull');
    expect(pickNextRoutine(routines, 12)?.name).toBe('Push');
  });

  it('falls back to the first routine', () => {
    expect(pickNextRoutine(routines, null)?.name).toBe('Push');
    expect(pickNextRoutine(routines, 999)?.name).toBe('Push');
    expect(pickNextRoutine([], null)).toBeNull();
  });
});
