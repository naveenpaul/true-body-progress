import type { ActiveSet } from './set-utils';
import type { HistoryRangeKey } from '@/lib/dates';
import type { Exercise, Routine, RoutineExerciseInput, RoutineExerciseWithName, WorkoutSession, WorkoutSetWithExercise } from '@/lib/types';
import { create } from 'zustand';
import { getHistoryRange, today } from '@/lib/dates';
import { expoDb } from '@/lib/db';
import * as bodyMetricsRepo from '@/lib/db/body-metrics-repo';
import * as exerciseRepo from '@/lib/db/exercise-repo';
import * as routineRepo from '@/lib/db/routine-repo';
import * as workoutRepo from '@/lib/db/workout-repo';
import { storage } from '@/lib/storage';
import { createSelectors } from '@/lib/utils';

import { isSetFilled, routineChanged, summarizeActiveSets } from './set-utils';

const REST_SOUND_KEY = 'rest_sound_enabled';

type WorkoutState = {
  isActive: boolean;
  startTime: number | null;
  activeSets: ActiveSet[];
  // Routine the active workout was started from (null = empty workout), and its
  // exercise plan at start, used to offer "update routine?" on save.
  activeRoutineId: number | null;
  activeRoutineName: string | null;
  activeRoutinePlan: RoutineExerciseInput[];

  // Routines
  routines: Routine[];
  lastRoutineId: number | null;
  loadRoutines: () => Promise<void>;
  createRoutine: (name: string, exercises: RoutineExerciseInput[]) => Promise<number>;
  updateRoutine: (id: number, name: string, exercises: RoutineExerciseInput[]) => Promise<void>;
  deleteRoutine: (id: number) => Promise<void>;
  moveRoutine: (id: number, direction: -1 | 1) => Promise<void>;
  getRoutineExercises: (id: number) => Promise<RoutineExerciseWithName[]>;
  recentSessions: WorkoutSession[];
  exercises: Exercise[];
  volumeByMuscle: Array<{ muscle_group: string; date: string; volume: number }>;

  sessionsLimit: number;

  // History filters
  historyRange: HistoryRangeKey;
  historyExerciseId: number | null;
  historyRoutineId: number | null;
  setHistoryRoutine: (routineId: number | null) => Promise<void>;
  setHistoryRange: (range: HistoryRangeKey) => Promise<void>;
  setHistoryExercise: (exerciseId: number | null) => Promise<void>;

  // Rest timer
  restDuration: number; // seconds, user-configurable default
  restEndsAt: number | null; // epoch ms when current rest ends, null if idle
  restSoundEnabled: boolean;
  setRestSoundEnabled: (enabled: boolean) => void;
  startRest: () => void;
  cancelRest: () => void;
  setRestDuration: (seconds: number) => void;

  // Copy first set's weight/reps to every other set of an exercise
  copyFirstSetToAll: (exerciseId: number) => void;

  loadExercises: () => Promise<void>;
  loadRecentSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  loadVolumeByMuscle: (days?: number) => Promise<void>;
  startWorkout: (routineId?: number) => Promise<void>;
  addExercise: (exerciseId: number, target?: Omit<RoutineExerciseInput, 'exercise_id'>) => Promise<void>;
  // Whether the active workout's exercises differ from its routine's plan.
  activeRoutineChanged: () => boolean;
  updateSet: (index: number, updates: Partial<ActiveSet>) => void;
  addSet: (exerciseId: number) => void;
  removeSet: (index: number) => void;
  removeExercise: (exerciseId: number) => void;
  completeSet: (index: number) => void;
  // updateRoutine: also overwrite the routine with this workout's exercise list.
  saveWorkout: (opts?: { updateRoutine?: boolean }) => Promise<number>;
  cancelWorkout: () => void;
  getSessionSets: (sessionId: number) => Promise<WorkoutSetWithExercise[]>;
  updateHistorySet: (setId: number, updates: { reps: number; weight: number; duration_sec?: number | null; distance_m?: number | null }) => Promise<void>;
  deleteHistorySet: (setId: number) => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
};

function historyFilter(state: Pick<WorkoutState, 'historyRange' | 'historyExerciseId' | 'historyRoutineId'>): workoutRepo.SessionFilter {
  const range = getHistoryRange(state.historyRange);
  return {
    from: range?.from,
    to: range?.to,
    exerciseId: state.historyExerciseId ?? undefined,
    routineId: state.historyRoutineId ?? undefined,
  };
}

const CLEARED_WORKOUT = {
  isActive: false,
  startTime: null,
  activeSets: [],
  restEndsAt: null,
  activeRoutineId: null,
  activeRoutineName: null,
  activeRoutinePlan: [],
} satisfies Partial<WorkoutState>;

const _useWorkoutStore = create<WorkoutState>((set, get) => ({
  isActive: false,
  startTime: null,
  activeSets: [],
  activeRoutineId: null,
  activeRoutineName: null,
  activeRoutinePlan: [],
  routines: [],
  lastRoutineId: null,
  recentSessions: [],
  exercises: [],
  volumeByMuscle: [],
  sessionsLimit: 20,
  historyRange: 'all',
  historyExerciseId: null,
  historyRoutineId: null,

  restDuration: 90,
  restEndsAt: null,
  restSoundEnabled: storage.getBoolean(REST_SOUND_KEY) ?? true,

  setRestSoundEnabled: (enabled) => {
    storage.setBoolean(REST_SOUND_KEY, enabled);
    set({ restSoundEnabled: enabled });
  },

  loadRoutines: async () => {
    const [routines, lastRoutineId] = await Promise.all([
      routineRepo.getAllRoutines(expoDb),
      workoutRepo.getLastRoutineId(expoDb),
    ]);
    set({ routines, lastRoutineId });
  },

  createRoutine: async (name, exercises) => {
    const id = await routineRepo.createRoutine(expoDb, name, exercises);
    await get().loadRoutines();
    return id;
  },

  updateRoutine: async (id, name, exercises) => {
    await routineRepo.updateRoutine(expoDb, id, name, exercises);
    await get().loadRoutines();
  },

  deleteRoutine: async (id) => {
    await routineRepo.deleteRoutine(expoDb, id);
    if (get().historyRoutineId === id)
      set({ historyRoutineId: null });
    await Promise.all([get().loadRoutines(), get().loadRecentSessions()]);
  },

  moveRoutine: async (id, direction) => {
    await routineRepo.moveRoutine(expoDb, id, direction);
    await get().loadRoutines();
  },

  getRoutineExercises: async (id) => {
    return routineRepo.getRoutineExercises(expoDb, id);
  },

  activeRoutineChanged: () => {
    const { activeRoutineId, activeRoutinePlan, activeSets } = get();
    return activeRoutineId != null && activeSets.length > 0 && routineChanged(activeRoutinePlan, activeSets);
  },

  startRest: () => {
    set((state) => {
      // Attribute this rest interval to the most recent set with valid reps
      // that hasn't already had a rest recorded against it. This is the "set
      // I just finished" — the rest is the gap between this set and the next.
      const lastIdx = (() => {
        for (let i = state.activeSets.length - 1; i >= 0; i--) {
          const s = state.activeSets[i];
          if (s.reps > 0 && s.rest_time_sec == null)
            return i;
        }
        return -1;
      })();
      const activeSets = lastIdx >= 0
        ? state.activeSets.map((s, i) =>
            i === lastIdx ? { ...s, rest_time_sec: state.restDuration } : s,
          )
        : state.activeSets;
      return {
        restEndsAt: Date.now() + state.restDuration * 1000,
        activeSets,
      };
    });
  },

  cancelRest: () => {
    set({ restEndsAt: null });
  },

  setRestDuration: (seconds) => {
    set({ restDuration: Math.max(10, Math.floor(seconds)) });
  },

  copyFirstSetToAll: (exerciseId) => {
    set((state) => {
      const sets = state.activeSets;
      const first = sets.find(s => s.exercise_id === exerciseId);
      if (!first)
        return state;
      return {
        activeSets: sets.map(s =>
          s.exercise_id === exerciseId
            ? { ...s, weight: first.weight, reps: first.reps }
            : s,
        ),
      };
    });
  },

  loadExercises: async () => {
    const exercises = await exerciseRepo.getAllExercises(expoDb);
    set({ exercises });
  },

  loadRecentSessions: async () => {
    const limit = get().sessionsLimit;
    const recentSessions = await workoutRepo.getRecentSessions(expoDb, limit, historyFilter(get()));
    set({ recentSessions });
  },

  setHistoryRange: async (range) => {
    set({ historyRange: range, sessionsLimit: 20 });
    await get().loadRecentSessions();
  },

  setHistoryRoutine: async (routineId) => {
    set({ historyRoutineId: routineId, sessionsLimit: 20 });
    await get().loadRecentSessions();
  },

  setHistoryExercise: async (exerciseId) => {
    set({ historyExerciseId: exerciseId, sessionsLimit: 20 });
    await get().loadRecentSessions();
  },

  loadVolumeByMuscle: async (days = 60) => {
    const volumeByMuscle = await workoutRepo.getVolumeByMuscleGroup(expoDb, days);
    set({ volumeByMuscle });
  },

  loadMoreSessions: async () => {
    const nextLimit = get().sessionsLimit + 20;
    const recentSessions = await workoutRepo.getRecentSessions(expoDb, nextLimit, historyFilter(get()));
    set({ sessionsLimit: nextLimit, recentSessions });
  },

  startWorkout: async (routineId) => {
    const routine = routineId != null ? get().routines.find(r => r.id === routineId) : undefined;
    set({
      isActive: true,
      startTime: Date.now(),
      activeSets: [],
      activeRoutineId: routine?.id ?? null,
      activeRoutineName: routine?.name ?? null,
      activeRoutinePlan: [],
    });
    if (!routine)
      return;

    const plan = await routineRepo.getRoutineExercises(expoDb, routine.id);
    // Load sequentially so exercises appear in routine order.
    for (const ex of plan)
      await get().addExercise(ex.exercise_id, { target_sets: ex.target_sets, rep_min: ex.rep_min, rep_max: ex.rep_max });
    // Snapshot what was actually loaded (an exercise could have been deleted).
    set(state => ({ activeRoutinePlan: summarizeActiveSets(state.activeSets) }));
  },

  addExercise: async (exerciseId, target) => {
    const exercise = await exerciseRepo.getExerciseById(expoDb, exerciseId);
    if (!exercise)
      return;

    const prevSets = await workoutRepo.getLastSetsForExercise(expoDb, exerciseId);
    const tracking = exercise.tracking_type ?? 'weight_reps';
    // Routine target wins; otherwise repeat last time's set count (min 3, or 1 for cardio).
    const numSets = target?.target_sets ?? Math.max(prevSets.length, tracking === 'cardio' ? 1 : 3);

    const newSets: ActiveSet[] = [];
    for (let i = 0; i < numSets; i++) {
      // Extra sets beyond last time start from the last previous set.
      const prev = prevSets[i] ?? prevSets.at(-1);
      const exact = prevSets[i];
      newSets.push({
        exercise_id: exerciseId,
        exercise_name: exercise.name,
        tracking_type: tracking,
        set_number: i + 1,
        reps: prev?.reps ?? 0,
        weight: prev?.weight ?? 0,
        duration_sec: prev?.duration_sec ?? null,
        distance_m: prev?.distance_m ?? null,
        rpe: null,
        rest_time_sec: null,
        completed: false,
        prev_reps: exact?.reps ?? null,
        prev_weight: exact?.weight ?? null,
        prev_duration_sec: exact?.duration_sec ?? null,
        prev_distance_m: exact?.distance_m ?? null,
        rep_min: target?.rep_min ?? null,
        rep_max: target?.rep_max ?? null,
      });
    }

    set(state => ({ activeSets: [...state.activeSets, ...newSets] }));
  },

  updateSet: (index, updates) => {
    set((state) => {
      const activeSets = [...state.activeSets];
      activeSets[index] = { ...activeSets[index], ...updates };
      return { activeSets };
    });
  },

  addSet: (exerciseId) => {
    set((state) => {
      const exerciseSets = state.activeSets.filter(s => s.exercise_id === exerciseId);
      const lastSet = exerciseSets.at(-1);
      const newSet: ActiveSet = {
        exercise_id: exerciseId,
        exercise_name: lastSet?.exercise_name ?? '',
        tracking_type: lastSet?.tracking_type ?? 'weight_reps',
        set_number: exerciseSets.length + 1,
        reps: lastSet?.reps ?? 0,
        weight: lastSet?.weight ?? 0,
        duration_sec: lastSet?.duration_sec ?? null,
        distance_m: lastSet?.distance_m ?? null,
        rpe: null,
        rest_time_sec: null,
        completed: false,
        prev_reps: null,
        prev_weight: null,
        prev_duration_sec: null,
        prev_distance_m: null,
        rep_min: lastSet?.rep_min ?? null,
        rep_max: lastSet?.rep_max ?? null,
      };
      const activeSets = [...state.activeSets];
      if (lastSet) {
        // Insert directly after the last set of this exercise
        const lastIndex = activeSets.lastIndexOf(lastSet);
        activeSets.splice(lastIndex + 1, 0, newSet);
      }
      else {
        // No existing sets for this exercise: append to the end
        activeSets.push(newSet);
      }
      return { activeSets };
    });
  },

  removeSet: (index) => {
    set((state) => {
      const removed = state.activeSets[index];
      if (!removed)
        return state;
      // Renumber the remaining sets of that exercise so they stay 1..n.
      let n = 0;
      const activeSets = state.activeSets
        .filter((_, i) => i !== index)
        .map(s => (s.exercise_id === removed.exercise_id ? { ...s, set_number: ++n } : s));
      return { activeSets };
    });
  },

  removeExercise: (exerciseId) => {
    set(state => ({ activeSets: state.activeSets.filter(s => s.exercise_id !== exerciseId) }));
  },

  completeSet: (index) => {
    set((state) => {
      const target = state.activeSets[index];
      // Block completing empty sets — saveWorkout filters reps<=0 out, so allowing
      // a ✓ tap on an empty row would silently drop it on save.
      if (!target || !isSetFilled(target))
        return state;
      const activeSets = [...state.activeSets];
      activeSets[index] = { ...target, completed: true };
      return { activeSets };
    });
  },

  saveWorkout: async (opts) => {
    const state = get();
    if (!state.startTime)
      return 0;

    // Save every set whose main metric is entered. The "completed" flag is no
    // longer surfaced in the UI — typing values is the implicit done signal.
    const completedSets = state.activeSets.filter(isSetFilled);

    // Snapshot body weight so bodyweight-exercise volume reflects it.
    const needsBodyweight = completedSets.some(s => s.tracking_type === 'bodyweight_reps');
    const bodyweightKg = needsBodyweight ? (await bodyMetricsRepo.getLatest(expoDb))?.weight ?? null : null;
    const isTimed = (s: ActiveSet) => s.tracking_type === 'time' || s.tracking_type === 'cardio';

    const sessionId = await workoutRepo.saveWorkout(
      expoDb,
      today(),
      completedSets.map(s => ({
        exercise_id: s.exercise_id,
        set_number: s.set_number,
        reps: isTimed(s) ? 0 : s.reps,
        weight: s.tracking_type === 'cardio' ? 0 : s.weight,
        rpe: s.rpe,
        rest_time_sec: s.rest_time_sec,
        duration_sec: isTimed(s) ? s.duration_sec : null,
        distance_m: s.tracking_type === 'cardio' ? s.distance_m : null,
        bodyweight_kg: s.tracking_type === 'bodyweight_reps' ? bodyweightKg : null,
      })),
      undefined,
      state.activeRoutineId,
    );

    if (opts?.updateRoutine && state.activeRoutineId != null && state.activeRoutineName) {
      await routineRepo.updateRoutine(
        expoDb,
        state.activeRoutineId,
        state.activeRoutineName,
        summarizeActiveSets(state.activeSets),
      );
    }

    set({ ...CLEARED_WORKOUT });
    await get().loadRoutines();
    return sessionId;
  },

  cancelWorkout: () => {
    set({ ...CLEARED_WORKOUT });
  },

  getSessionSets: async (sessionId) => {
    return workoutRepo.getSessionSets(expoDb, sessionId);
  },

  updateHistorySet: async (setId, updates) => {
    await workoutRepo.updateSet(expoDb, setId, updates);
    await get().loadRecentSessions();
  },

  deleteHistorySet: async (setId) => {
    await workoutRepo.deleteSet(expoDb, setId);
    await get().loadRecentSessions();
  },

  deleteSession: async (sessionId) => {
    await workoutRepo.deleteSession(expoDb, sessionId);
    await get().loadRecentSessions();
  },
}));

export const useWorkoutStore = createSelectors(_useWorkoutStore);
