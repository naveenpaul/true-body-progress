import type { Gender, GoalType, UnitSystem, User } from '@/lib/types';

import { create } from 'zustand';
import { expoDb } from '@/lib/db';
import * as userRepo from '@/lib/db/user-repo';
import { createSelectors } from '@/lib/utils';

type UserState = {
  user: User | null;
  loading: boolean;
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

const _useUserStore = create<UserState>(set => ({
  user: null,
  loading: true,

  loadUser: async () => {
    set({ loading: true });
    const user = await userRepo.getUser(expoDb);
    set({ user, loading: false });
  },

  createUser: async (name, heightCm, age, gender, goalType, targetWeight, preferredUnits) => {
    await userRepo.createUser(expoDb, name, heightCm, age, gender, goalType, targetWeight, preferredUnits);
    const user = await userRepo.getUser(expoDb);
    set({ user });
  },

  updateUnits: async (units) => {
    await userRepo.updateUser(expoDb, { preferred_units: units });
    const user = await userRepo.getUser(expoDb);
    set({ user });
  },

  updateProfile: async (updates) => {
    await userRepo.updateUser(expoDb, updates);
    const user = await userRepo.getUser(expoDb);
    set({ user });
  },
}));

export const useUserStore = createSelectors(_useUserStore);
