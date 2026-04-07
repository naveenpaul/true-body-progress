import type { SQLiteDatabase } from 'expo-sqlite';

import type { BodyMetric } from '@/lib/types';

import { create } from 'zustand';
import * as bodyMetricsRepo from '@/lib/db/body-metrics-repo';
import { calculateWeeklyChange } from '@/lib/services/calculation-service';
import { createSelectors } from '@/lib/utils';

type BodyState = {
  db: SQLiteDatabase | null;
  latest: BodyMetric | null;
  weightTrend: Array<{ date: string; weight: number }>;
  waistTrend: Array<{ date: string; waist: number }>;
  recentMetrics: BodyMetric[];
  weeklyChange: number | null;
  trendDays: number;

  setDb: (db: SQLiteDatabase) => void;
  loadData: () => Promise<void>;
  logMetric: (date: string, weight?: number, waist?: number, bodyFat?: number, notes?: string) => Promise<void>;
  setTrendDays: (days: number) => Promise<void>;
};

function requireDb(db: SQLiteDatabase | null): SQLiteDatabase {
  if (!db) throw new Error('body store: db not initialized');
  return db;
}

const _useBodyStore = create<BodyState>((set, get) => ({
  db: null,
  latest: null,
  weightTrend: [],
  waistTrend: [],
  recentMetrics: [],
  weeklyChange: null,
  trendDays: 30,

  setDb: (db) => {
    set({ db });
  },

  loadData: async () => {
    const db = requireDb(get().db);
    const days = get().trendDays;
    const [latest, weightTrend, waistTrend, recentMetrics] = await Promise.all([
      bodyMetricsRepo.getLatest(db),
      bodyMetricsRepo.getWeightTrend(db, days),
      bodyMetricsRepo.getWaistTrend(db, days),
      bodyMetricsRepo.getRecentMetrics(db, 10),
    ]);

    const weeklyChange = calculateWeeklyChange(weightTrend);
    set({ latest, weightTrend, waistTrend, recentMetrics, weeklyChange });
  },

  logMetric: async (date, weight, waist, bodyFat, notes) => {
    const db = requireDb(get().db);
    await bodyMetricsRepo.logMetric(db, date, weight, waist, bodyFat, notes);
    await get().loadData();
  },

  setTrendDays: async (days) => {
    set({ trendDays: days });
    await get().loadData();
  },
}));

export const useBodyStore = createSelectors(_useBodyStore);
