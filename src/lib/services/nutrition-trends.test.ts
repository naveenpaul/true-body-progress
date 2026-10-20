import type { DailyNutrition } from '@/lib/db/nutrition-repo';
import { addDays } from '@/lib/dates';
import { buildNutritionTrends, chartSeries, describeTrends } from './nutrition-trends';

const END = '2026-10-20';

function day(offset: number, macros: Partial<DailyNutrition> = {}): DailyNutrition {
  return { date: addDays(END, -offset), meals: 4, calories: 2000, protein: 80, carbs: 250, fats: 70, fiber: 20, ...macros };
}

const metric = (t: ReturnType<typeof buildNutritionTrends>, key: string) => t.metrics.find(m => m.key === key)!;

describe('buildNutritionTrends', () => {
  it('compares this week with last week and colours by goal direction', () => {
    const days = [
      ...[13, 12, 11, 10, 9, 8, 7].map(o => day(o, { protein: 70, fiber: 15, carbs: 300, fats: 80 })),
      ...[6, 5, 4, 3, 2, 1, 0].map(o => day(o, { protein: 100, fiber: 25, carbs: 220, fats: 80.5 })),
    ];
    const t = buildNutritionTrends(days, END, 14);
    expect(metric(t, 'protein')).toMatchObject({ recent: 100, previous: 70, delta: 30, verdict: 'good' });
    expect(metric(t, 'fiber').verdict).toBe('good');
    expect(metric(t, 'carbs')).toMatchObject({ delta: -80, verdict: 'good' });
    expect(metric(t, 'fats').verdict).toBe('flat');
    expect(metric(t, 'calories').verdict).toBeNull();
    expect(t.fullDaysRecent).toBe(7);
  });

  it('flags moving the wrong way', () => {
    const t = buildNutritionTrends([day(8, { fats: 50 }), day(1, { fats: 90 })], END, 14);
    expect(metric(t, 'fats').verdict).toBe('bad');
  });

  it('leaves partly logged days out of averages but keeps them as points', () => {
    const t = buildNutritionTrends([day(1, { protein: 100 }), day(0, { meals: 1, protein: 10 })], END, 14);
    const protein = metric(t, 'protein');
    expect(protein.recent).toBe(100);
    expect(protein.points.at(-1)).toMatchObject({ daily: 10, full: false, rolling: 100 });
    expect(t.fullDaysRecent).toBe(1);
  });

  it('reports carbs and fat as a share of calories', () => {
    const t = buildNutritionTrends([day(1, { calories: 2000, carbs: 250, fats: 60 })], END, 14);
    expect(metric(t, 'carbs').shareRecent).toBe(50);
    expect(metric(t, 'fats').shareRecent).toBe(27);
    expect(metric(t, 'protein').shareRecent).toBeNull();
  });
});

describe('chartSeries', () => {
  it('starts at the first average and carries it across gaps', () => {
    const { line, dots } = chartSeries([
      { date: '2026-10-01', daily: null, full: false, rolling: null },
      { date: '2026-10-02', daily: 90, full: true, rolling: 90 },
      { date: '2026-10-03', daily: 20, full: false, rolling: null },
      { date: '2026-10-04', daily: 110, full: true, rolling: 100 },
    ]);
    expect(line.map(p => p.value)).toEqual([90, 90, 100]);
    expect(line[0].label).toBe('10-02');
    expect(dots).toEqual([
      { index: 0, value: 90, dim: false },
      { index: 1, value: 20, dim: true },
      { index: 2, value: 110, dim: false },
    ]);
  });
});

describe('describeTrends', () => {
  it('summarises macros that have both weeks', () => {
    const t = buildNutritionTrends([day(8, { protein: 70 }), day(1, { protein: 100 })], END, 14);
    const lines = describeTrends(t);
    expect(lines[0]).toBe('Protein: 100 g/day vs 70 g/day (good)');
    expect(lines.find(l => l.startsWith('Carbs'))).toBe('Carbs: 250 g/day vs 250 g/day, 50% of calories vs 50% (flat)');
  });
});
