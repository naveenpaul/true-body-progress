import type { SQLiteDatabase } from 'expo-sqlite';

import type { Exercise, WorkoutSession, WorkoutSetWithExercise } from '@/lib/types';

import { create } from 'zustand';
import { today } from '@/lib/dates';
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
  completed: boolean;
  prev_reps: number | null;
  prev_weight: number | null;
};

type WorkoutState = {
  db: SQLiteDatabase | null;
  isActive: boolean;
  startTime: number | null;
  activeSets: ActiveSet[];
  recentSessions: WorkoutSession[];
  exercises: Exercise[];

  sessionsLimit: number;

  setDb: (db: SQLiteDatabase) => void;
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
};

function requireDb(db: SQLiteDatabase | null): SQLiteDatabase {
  if (!db)
    throw new Error('workout store: db not initialized');
  return db;
}

const _useWorkoutStore = create<WorkoutState>((set, get) => ({
  db: null,
  isActive: false,
  startTime: null,
  activeSets: [],
  recentSessions: [],
  exercises: [],
  sessionsLimit: 20,

  setDb: (db) => {
    set({ db });
  },

  loadExercises: async () => {
    const db = requireDb(get().db);
    const exercises = await exerciseRepo.getAllExercises(db);
    set({ exercises });
  },

  loadRecentSessions: async () => {
    const db = requireDb(get().db);
    const limit = get().sessionsLimit;
    const recentSessions = await workoutRepo.getRecentSessions(db, limit);
    set({ recentSessions });
  },

  loadMoreSessions: async () => {
    const db = requireDb(get().db);
    const nextLimit = get().sessionsLimit + 20;
    const recentSessions = await workoutRepo.getRecentSessions(db, nextLimit);
    set({ sessionsLimit: nextLimit, recentSessions });
  },

  startWorkout: () => {
    set({ isActive: true, startTime: Date.now(), activeSets: [] });
  },

  addExercise: async (exerciseId: number) => {
    const db = requireDb(get().db);
    const exercise = await exerciseRepo.getExerciseById(db, exerciseId);
    if (!exercise)
      return;

    const prevSets = await workoutRepo.getLastSetsForExercise(db, exerciseId);
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
    const db = requireDb(get().db);
    const state = get();
    if (!state.startTime)
      return 0;

    const durationSec = Math.floor((Date.now() - state.startTime) / 1000);
    const completedSets = state.activeSets.filter(s => s.completed && s.reps > 0);

    const sessionId = await workoutRepo.saveWorkout(
      db,
      today(),
      durationSec,
      completedSets.map(s => ({
        exercise_id: s.exercise_id,
        set_number: s.set_number,
        reps: s.reps,
        weight: s.weight,
        rpe: s.rpe,
      })),
    );

    set({ isActive: false, startTime: null, activeSets: [] });
    return sessionId;
  },

  cancelWorkout: () => {
    set({ isActive: false, startTime: null, activeSets: [] });
  },

  getSessionSets: async (sessionId) => {
    const db = requireDb(get().db);
    return workoutRepo.getSessionSets(db, sessionId);
  },
}));

export const useWorkoutStore = createSelectors(_useWorkoutStore);
