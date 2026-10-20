import type { TextStyle } from 'react-native';

import type { DailyNutrition } from '@/lib/db/nutrition-repo';
import type { MetricTrend } from '@/lib/services/nutrition-trends';
import { useFocusEffect } from 'expo-router';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { SimpleChart } from '@/features/body/components/simple-chart';
import { addDays, today } from '@/lib/dates';
import { expoDb } from '@/lib/db';
import * as nutritionRepo from '@/lib/db/nutrition-repo';
import { buildNutritionTrends, chartSeries, MIN_MEALS_FOR_FULL_DAY, TREND_METRICS, trendLookbackDays } from '@/lib/services/nutrition-trends';

const NUM_STYLE: TextStyle = { fontVariant: ['tabular-nums'] };

const RANGES = [
  { label: '2W', days: 14 },
  { label: '4W', days: 28 },
  { label: '3M', days: 90 },
] as const;

const VERDICT_CLASS = {
  good: 'text-success-500',
  bad: 'text-danger-400',
  flat: 'text-ink-faint',
} as const;

type Props = {
  // Dashboard: fixed 4 weeks, macros only, smaller charts.
  compact?: boolean;
  // Bump to reload (e.g. after a Notion sync or pull-to-refresh).
  refreshKey?: number;
};

export function NutritionTrendsCard({ compact = false, refreshKey = 0 }: Props) {
  const [rangeDays, setRangeDays] = useState<number>(28);
  const [days, setDays] = useState<DailyNutrition[] | null>(null);
  // Tabs stay mounted, so reload on focus to pick up meals synced elsewhere.
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(useCallback(() => {
    setFocusTick(t => t + 1);
  }, []));
  const endDate = today();
  const lookback = trendLookbackDays(compact ? 28 : rangeDays);

  useEffect(() => {
    let cancelled = false;
    nutritionRepo.getDailyNutrition(expoDb, addDays(endDate, -lookback))
      .then((rows) => {
        if (!cancelled)
          setDays(rows);
      })
      .catch(err => console.error('[nutrition-trends] load failed:', err));
    return () => {
      cancelled = true;
    };
  }, [endDate, lookback, refreshKey, focusTick]);

  if (days == null)
    return null;

  const range = compact ? 28 : rangeDays;
  const trends = buildNutritionTrends(days, endDate, range);
  const shown = compact ? trends.metrics.filter(m => m.key !== 'calories') : trends.metrics;

  return (
    <View>
      <View className="mb-4 flex-row items-baseline justify-between">
        <Text className="text-xs font-bold text-ink-faint uppercase" style={{ letterSpacing: 0.8 }}>Nutrition trends</Text>
        {compact
          ? <Text className="text-xs text-ink-faint">this week vs last</Text>
          : (
              <View className="flex-row gap-1.5">
                {RANGES.map(r => (
                  <Pressable
                    key={r.label}
                    onPress={() => setRangeDays(r.days)}
                    className={`rounded-full border px-2.5 py-0.5 ${rangeDays === r.days ? 'border-success-500 bg-success-500' : 'border-ink-hairline'}`}
                  >
                    <Text className={`text-xs ${rangeDays === r.days ? 'font-semibold text-black' : 'text-ink-muted'}`}>{r.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
      </View>

      {trends.fullDaysRecent === 0 && trends.fullDaysPrevious === 0
        ? (
            <Text className="text-sm text-ink-muted">
              {`Log ${MIN_MEALS_FOR_FULL_DAY}+ meals a day for a few days to see your protein, fiber, carbs and fat trends.`}
            </Text>
          )
        : (
            <>
              {shown.map(m => <MetricRow key={m.key} trend={m} chartHeight={compact ? 56 : 80} />)}
              <Text className="text-[11px] text-ink-faint">
                {`Averages use days with ${MIN_MEALS_FOR_FULL_DAY}+ meals logged: ${trends.fullDaysRecent} of the last 7, ${trends.fullDaysPrevious} of the 7 before. Line = 7-day average, dots = each day (faint = partly logged).`}
              </Text>
            </>
          )}
    </View>
  );
}

function MetricRow({ trend, chartHeight }: { trend: MetricTrend; chartHeight: number }) {
  const meta = TREND_METRICS.find(m => m.key === trend.key)!;
  const fmt = (v: number) => `${Math.round(v)}${meta.unit === 'g' ? ' g' : ` ${meta.unit}`}`;

  const { line, dots } = chartSeries(trend.points);

  const arrow = trend.delta == null ? '' : trend.verdict === 'flat' ? '→' : trend.delta > 0 ? '↑' : '↓';
  const deltaClass = trend.verdict ? VERDICT_CLASS[trend.verdict] : 'text-ink-faint';

  return (
    <View className="mb-5">
      <View className="mb-1 flex-row items-baseline justify-between">
        <Text className="text-sm font-semibold text-ink-text">{meta.label}</Text>
        <Text className="text-xs" style={NUM_STYLE}>
          <Text className="font-semibold text-ink-text">{trend.recent != null ? `${fmt(trend.recent)}/day` : '—'}</Text>
          {trend.delta != null && (
            <Text className={deltaClass}>
              {`  ${arrow} ${trend.delta > 0 ? '+' : '−'}${fmt(Math.abs(trend.delta))}`}
            </Text>
          )}
        </Text>
      </View>
      {trend.shareRecent != null && (
        <Text className="mb-1 text-[11px] text-ink-faint" style={NUM_STYLE}>
          {`${Math.round(trend.shareRecent)}% of calories`}
          {trend.sharePrevious != null ? ` · was ${Math.round(trend.sharePrevious)}%` : ''}
        </Text>
      )}
      {line.length >= 2
        ? <SimpleChart data={line} dots={dots} height={chartHeight} color={meta.color} />
        : <Text className="text-xs text-ink-faint">Not enough fully logged days in this range yet.</Text>}
    </View>
  );
}
