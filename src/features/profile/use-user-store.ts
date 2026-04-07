import type { SQLiteDatabase } from 'expo-sqlite';

import type { Gender, GoalType, UnitSystem, User } from '@/lib/types';

import { create } from 'zustand';
import * as userRepo from '@/lib/db/user-repo';
import { createSelectors } from '@/lib/utils';

type UserState = {
  db: SQLiteDatabase | null;
  user: User | null;
  loading: boolean;
  setDb: (db: SQLiteDatabase) => void;
  loadUser: () => Promise<void>;
  createUser: (
    name: string,
    heightCm: number,
    age: number,
    gender: Gender,
    goalType: GoalType,
    targetWeight: number,
    preferredUnits?: UnitSystem,
  ) => Promise<void>;
  updateUnits: (units: UnitSystem) => Promise<void>;
  updateProfile: (updates: {
    name?: string;
    height_cm?: number;
    age?: number;
    gender?: Gender;
    goal_type?: GoalType;
    target_weight?: number;
    preferred_units?: UnitSystem;
  }) => Promise<void>;
};

function requireDb(db: SQLiteDatabase | null): SQLiteDatabase {
  if (!db)
    throw new Error('user store: db not initialized');
  return db;
}

const _useUserStore = create<UserState>((set, get) => ({
  db: null,
  user: null,
  loading: true,

  setDb: (db) => {
    set({ db });
  },

  loadUser: async () => {
    const db = requireDb(get().db);
    set({ loading: true });
    const user = await userRepo.getUser(db);
    set({ user, loading: false });
  },

  createUser: async (name, heightCm, age, gender, goalType, targetWeight, preferredUnits) => {
    const db = requireDb(get().db);
    await userRepo.createUser(db, name, heightCm, age, gender, goalType, targetWeight, preferredUnits);
    const user = await userRepo.getUser(db);
    set({ user });
  },

  updateUnits: async (units) => {
    const db = requireDb(get().db);
    await userRepo.updateUser(db, { preferred_units: units });
    const user = await userRepo.getUser(db);
    set({ user });
  },

  updateProfile: async (updates) => {
    const db = requireDb(get().db);
    await userRepo.updateUser(db, updates);
    const user = await userRepo.getUser(db);
    set({ user });
  },
}));

export const useUserStore = createSelectors(_useUserStore);
