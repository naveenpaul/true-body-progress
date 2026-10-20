import type { DailyNutrition } from '@/lib/db/nutrition-repo';
import { addDays } from '@/lib/dates';

// Daily intake is noisy (one biryani dinner is a spike), so trends use a
// 7-day rolling average and compare this week with last week. Days with only
// a meal or two logged would drag averages down, so they're shown but left
// out of the averages.

export const MIN_MEALS_FOR_FULL_DAY = 3;
const WINDOW = 7;
// Changes under 3% of last week's value count as flat.
const FLAT_THRESHOLD = 0.03;

export type MetricKey = 'protein' | 'fiber' | 'carbs' | 'fats' | 'calories';

export const TREND_METRICS: Array<{
  key: MetricKey;
  label: string;
  unit: string;
  want: 'up' | 'down' | null; // goal direction; null = neutral
  color: string;
  kcalPerGram?: number; // set for macros shown as a share of calories
}> = [
  { key: 'protein', label: 'Protein', unit: 'g', want: 'up', color: '#F87171' },
  { key: 'fiber', label: 'Fiber', unit: 'g', want: 'up', color: '#34D399' },
  { key: 'carbs', label: 'Carbs', unit: 'g', want: 'down', color: '#60A5FA', kcalPerGram: 4 },
  { key: 'fats', label: 'Fat', unit: 'g', want: 'down', color: '#FBBF24', kcalPerGram: 9 },
  { key: 'calories', label: 'Calories', unit: 'kcal', want: null, color: '#A1A1AA' },
];

export type TrendPoint = {
  date: string;
  daily: number | null; // that day's total; null = nothing logged
  full: boolean; // counted in averages
  rolling: number | null; // 7-day average of full days ending here
};

export type MetricTrend = {
  key: MetricKey;
  points: TrendPoint[];
  recent: number | null; // avg over full days in the last 7 days
  previous: number | null; // avg over full days in the 7 before that
  delta: number | null;
  verdict: 'good' | 'bad' | 'flat' | null;
  shareRecent: number | null; // % of calories, carbs/fat only
  sharePrevious: number | null;
};

export type NutritionTrends = {
  metrics: MetricTrend[];
  fullDaysRecent: number;
  fullDaysPrevious: number;
};

function avg(values: number[]): number | null {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// `days` must cover `rangeDays + 13` days back from `endDate` so the first
// point's rolling average and last week's comparison have their history.
export function buildNutritionTrends(days: DailyNutrition[], endDate: string, rangeDays: number): NutritionTrends {
  const byDate = new Map(days.map(d => [d.date, d]));
  const isFull = (d: DailyNutrition | undefined): d is DailyNutrition => d != null && d.meals >= MIN_MEALS_FOR_FULL_DAY;
  const fullDaysBetween = (from: string, to: string) => days.filter(d => d.date >= from && d.date <= to && isFull(d));

  const recentFrom = addDays(endDate, -(WINDOW - 1));
  const previousTo = addDays(recentFrom, -1);
  const previousFrom = addDays(previousTo, -(WINDOW - 1));
  const recentDays = fullDaysBetween(recentFrom, endDate);
  const previousDays = fullDaysBetween(previousFrom, previousTo);

  const dates = Array.from({ length: rangeDays }, (_, i) => addDays(endDate, i - rangeDays + 1));

  const metrics = TREND_METRICS.map(({ key, want, kcalPerGram }): MetricTrend => {
    const points = dates.map((date): TrendPoint => {
      const day = byDate.get(date);
      return {
        date,
        daily: day ? day[key] : null,
        full: isFull(day),
        rolling: avg(fullDaysBetween(addDays(date, -(WINDOW - 1)), date).map(d => d[key])),
      };
    });

    const recent = avg(recentDays.map(d => d[key]));
    const previous = avg(previousDays.map(d => d[key]));
    const delta = recent != null && previous != null ? recent - previous : null;
    let verdict: MetricTrend['verdict'] = null;
    if (delta != null && want != null) {
      if (Math.abs(delta) < Math.abs(previous!) * FLAT_THRESHOLD)
        verdict = 'flat';
      else
        verdict = (delta > 0) === (want === 'up') ? 'good' : 'bad';
    }

    // Share of calories from the window totals, so a light day doesn't skew it.
    const share = (ds: DailyNutrition[]) => {
      const kcal = ds.reduce((a, d) => a + d.calories, 0);
      return kcalPerGram && kcal > 0 ? (ds.reduce((a, d) => a + d[key], 0) * kcalPerGram * 100) / kcal : null;
    };

    return {
      key,
      points,
      recent,
      previous,
      delta,
      verdict,
      shareRecent: share(recentDays),
      sharePrevious: share(previousDays),
    };
  });

  return { metrics, fullDaysRecent: recentDays.length, fullDaysPrevious: previousDays.length };
}

// Chart data: the rolling-average line starts at the first day that has one,
// and stretches with no fully logged day keep the last average. Dots are the
// raw daily totals at the same positions.
export function chartSeries(points: TrendPoint[]): {
  line: Array<{ value: number; label: string }>;
  dots: Array<{ index: number; value: number; dim: boolean }>;
} {
  const start = points.findIndex(p => p.rolling != null);
  if (start === -1)
    return { line: [], dots: [] };
  const visible = points.slice(start);
  const line = visible.reduce<Array<{ value: number; label: string }>>((acc, p) => {
    acc.push({ value: p.rolling ?? acc.at(-1)!.value, label: p.date.slice(5) });
    return acc;
  }, []);
  const dots = visible.flatMap((p, index) => (p.daily != null ? [{ index, value: p.daily, dim: !p.full }] : []));
  return { line, dots };
}

// One line per macro for the coach prompt, e.g.
// "Protein: 86 g/day vs 74 g/day (good)". Skips macros without both weeks.
export function describeTrends(trends: NutritionTrends): string[] {
  return trends.metrics.flatMap((m) => {
    const meta = TREND_METRICS.find(t => t.key === m.key)!;
    if (m.recent == null || m.previous == null)
      return [];
    const share = m.shareRecent != null && m.sharePrevious != null
      ? `, ${Math.round(m.shareRecent)}% of calories vs ${Math.round(m.sharePrevious)}%`
      : '';
    const verdict = m.verdict ? ` (${m.verdict})` : '';
    return [`${meta.label}: ${Math.round(m.recent)} ${meta.unit}/day vs ${Math.round(m.previous)} ${meta.unit}/day${share}${verdict}`];
  });
}

// Days of history buildNutritionTrends needs for a range.
export function trendLookbackDays(rangeDays: number): number {
  return rangeDays + 2 * WINDOW;
}
