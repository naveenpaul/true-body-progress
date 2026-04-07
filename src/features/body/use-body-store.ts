import type { BodyMetric } from '@/lib/types';

import { create } from 'zustand';
import { expoDb } from '@/lib/db';
import * as bodyMetricsRepo from '@/lib/db/body-metrics-repo';
import { calculateWeeklyChange } from '@/lib/services/calculation-service';
import { createSelectors } from '@/lib/utils';

type BodyState = {
  latest: BodyMetric | null;
  weightTrend: Array<{ date: string; weight: number }>;
  waistTrend: Array<{ date: string; waist: number }>;
  recentMetrics: BodyMetric[];
  weeklyChange: number | null;
  trendDays: number;

  loadData: () => Promise<void>;
  logMetric: (date: string, weight?: number, waist?: number, bodyFat?: number, notes?: string) => Promise<void>;
  setTrendDays: (days: number) => Promise<void>;
};

const _useBodyStore = create<BodyState>((set, get) => ({
  latest: null,
  weightTrend: [],
  waistTrend: [],
  recentMetrics: [],
  weeklyChange: null,
  trendDays: 30,

  loadData: async () => {
    const days = get().trendDays;
    const [latest, weightTrend, waistTrend, recentMetrics] = await Promise.all([
      bodyMetricsRepo.getLatest(expoDb),
      bodyMetricsRepo.getWeightTrend(expoDb, days),
      bodyMetricsRepo.getWaistTrend(expoDb, days),
      bodyMetricsRepo.getRecentMetrics(expoDb, 10),
    ]);

    const weeklyChange = calculateWeeklyChange(weightTrend);
    set({ latest, weightTrend, waistTrend, recentMetrics, weeklyChange });
  },

  logMetric: async (date, weight, waist, bodyFat, notes) => {
    await bodyMetricsRepo.logMetric(expoDb, date, weight, waist, bodyFat, notes);
    await get().loadData();
  },

  setTrendDays: async (days) => {
    set({ trendDays: days });
    await get().loadData();
  },
}));

export const useBodyStore = createSelectors(_useBodyStore);
