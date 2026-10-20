import { ESTIMATOR_VERSION } from '@/lib/ai/meal-estimator';
import { planSync } from './notion-meal-sync';

function existing(id: number, ref: string, text: string, date = '2026-10-19', version: number | null = ESTIMATOR_VERSION) {
  return { id, source_ref: ref, source_text: text, date, estimate_version: version };
}

describe('planSync', () => {
  it('estimates only new or edited cells, grouped by day', () => {
    const plan = planSync(
      [{ pageId: 'p1', date: '2026-10-19', meals: { 'Pre-BF': '1 cup tea', 'BF': '2 idlis', 'Dinner': 'biryani' } }],
      [existing(1, 'p1:Pre-BF', '1 cup tea'), existing(2, 'p1:BF', '1 idli')],
    );
    expect(plan.estimate).toEqual([{ pageId: 'p1', date: '2026-10-19', meals: { BF: '2 idlis', Dinner: 'biryani' } }]);
    expect(plan.remove).toEqual([]);
    expect(plan.moveDate).toEqual([]);
  });

  it('removes cleared cells and deleted rows', () => {
    const plan = planSync(
      [{ pageId: 'p1', date: '2026-10-19', meals: { BF: '2 idlis' } }],
      [existing(1, 'p1:BF', '2 idlis'), existing(2, 'p1:Lunch', 'rice'), existing(3, 'p2:BF', 'eggs')],
    );
    expect(plan.estimate).toEqual([]);
    expect(plan.remove.sort()).toEqual([2, 3]);
  });

  it('moves unchanged meals when the row date changes, without re-estimating', () => {
    const plan = planSync(
      [{ pageId: 'p1', date: '2026-10-18', meals: { BF: '2 idlis' } }],
      [existing(1, 'p1:BF', '2 idlis', '2026-10-19')],
    );
    expect(plan.estimate).toEqual([]);
    expect(plan.moveDate).toEqual([{ id: 1, date: '2026-10-18' }]);
  });

  it('re-estimates meals from an older estimator version', () => {
    const plan = planSync(
      [{ pageId: 'p1', date: '2026-10-19', meals: { BF: '2 idlis', Lunch: 'rice' } }],
      [existing(1, 'p1:BF', '2 idlis', '2026-10-19', null), existing(2, 'p1:Lunch', 'rice')],
    );
    expect(plan.estimate).toEqual([{ pageId: 'p1', date: '2026-10-19', meals: { BF: '2 idlis' } }]);
  });
});
