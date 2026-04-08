import type { Exercise, WorkoutSession, WorkoutSetWithExercise } from '@/lib/types';

import { create } from 'zustand';
import { today } from '@/lib/dates';
import { expoDb } from '@/lib/db';
import * as exerciseRepo from '@/lib/db/exercise-repo';
import * as workoutRepo from '@/lib/db/workout-repo';
import { createSelectors } from '@/lib/utils';

type ActiveSet = {
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight: number;
  rpe: number | null;
  rest_time_sec: number | null;
  completed: boolean;
  prev_reps: number | null;
  prev_weight: number | null;
};

type WorkoutState = {
  isActive: boolean;
  startTime: number | null;
  activeSets: ActiveSet[];
  recentSessions: WorkoutSession[];
  exercises: Exercise[];

  sessionsLimit: number;

  // Rest timer
  restDuration: number; // seconds, user-configurable default
  restEndsAt: number | null; // epoch ms when current rest ends, null if idle
  startRest: () => void;
  cancelRest: () => void;
  setRestDuration: (seconds: number) => void;

  // Copy first set's weight/reps to every other set of an exercise
  copyFirstSetToAll: (exerciseId: number) => void;

  loadExercises: () => Promise<void>;
  loadRecentSessions: () => Promise<void>;
  loadMoreSessions: () => Promise<void>;
  startWorkout: () => void;
  addExercise: (exerciseId: number) => Promise<void>;
  updateSet: (index: number, updates: Partial<ActiveSet>) => void;
  addSet: (exerciseId: number) => void;
  removeSet: (index: number) => void;
  completeSet: (index: number) => void;
  saveWorkout: () => Promise<number>;
  cancelWorkout: () => void;
  getSessionSets: (sessionId: number) => Promise<WorkoutSetWithExercise[]>;
  updateHistorySet: (setId: number, updates: { reps: number; weight: number }) => Promise<void>;
  deleteHistorySet: (setId: number) => Promise<void>;
  deleteSession: (sessionId: number) => Promise<void>;
};

const _useWorkoutStore = create<WorkoutState>((set, get) => ({
  isActive: false,
  startTime: null,
  activeSets: [],
  recentSessions: [],
  exercises: [],
  sessionsLimit: 20,

  restDuration: 90,
  restEndsAt: null,

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
    const recentSessions = await workoutRepo.getRecentSessions(expoDb, limit);
    set({ recentSessions });
  },

  loadMoreSessions: async () => {
    const nextLimit = get().sessionsLimit + 20;
    const recentSessions = await workoutRepo.getRecentSessions(expoDb, nextLimit);
    set({ sessionsLimit: nextLimit, recentSessions });
  },

  startWorkout: () => {
    set({ isActive: true, startTime: Date.now(), activeSets: [] });
  },

  addExercise: async (exerciseId: number) => {
    const exercise = await exerciseRepo.getExerciseById(expoDb, exerciseId);
    if (!exercise)
      return;

    const prevSets = await workoutRepo.getLastSetsForExercise(expoDb, exerciseId);
    const numSets = Math.max(prevSets.length, 3);

    const newSets: ActiveSet[] = [];
    for (let i = 0; i < numSets; i++) {
      const prev = prevSets[i];
      newSets.push({
        exercise_id: exerciseId,
        exercise_name: exercise.name,
        set_number: i + 1,
        reps: prev?.reps ?? 0,
        weight: prev?.weight ?? 0,
        rpe: null,
        rest_time_sec: null,
        completed: false,
        prev_reps: prev?.reps ?? null,
        prev_weight: prev?.weight ?? null,
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
        set_number: exerciseSets.length + 1,
        reps: lastSet?.reps ?? 0,
        weight: lastSet?.weight ?? 0,
        rpe: null,
        rest_time_sec: null,
        completed: false,
        prev_reps: null,
        prev_weight: null,
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
    set(state => ({
      activeSets: state.activeSets.filter((_, i) => i !== index),
    }));
  },

  completeSet: (index) => {
    set((state) => {
      const target = state.activeSets[index];
      // Block completing empty sets — saveWorkout filters reps<=0 out, so allowing
      // a ✓ tap on an empty row would silently drop it on save.
      if (!target || target.reps <= 0)
        return state;
      const activeSets = [...state.activeSets];
      activeSets[index] = { ...target, completed: true };
      return { activeSets };
    });
  },

  saveWorkout: async () => {
    const state = get();
    if (!state.startTime)
      return 0;

    // Save every set with valid reps. The "completed" flag is no longer
    // surfaced in the UI — typing reps/weight is the implicit done signal.
    const completedSets = state.activeSets.filter(s => s.reps > 0);

    const sessionId = await workoutRepo.saveWorkout(
      expoDb,
      today(),
      completedSets.map(s => ({
        exercise_id: s.exercise_id,
        set_number: s.set_number,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
        rest_time_sec: s.rest_time_sec,
      })),
    );

    set({ isActive: false, startTime: null, activeSets: [], restEndsAt: null });
    return sessionId;
  },

  cancelWorkout: () => {
    set({ isActive: false, startTime: null, activeSets: [], restEndsAt: null });
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
