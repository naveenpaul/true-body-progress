import { calculateWeeklyChange } from './calculation-service';

describe('calculateWeeklyChange', () => {
  it('compares against roughly one week ago instead of the oldest entry', () => {
    const weights = [
      { date: '2026-04-01', weight: 100 },
      { date: '2026-04-02', weight: 99.5 },
      { date: '2026-04-03', weight: 99.1 },
      { date: '2026-04-04', weight: 98.9 },
      { date: '2026-04-05', weight: 98.7 },
      { date: '2026-04-06', weight: 98.4 },
      { date: '2026-04-07', weight: 98.1 },
      { date: '2026-04-08', weight: 97.8 },
      { date: '2026-04-09', weight: 97.5 },
      { date: '2026-04-10', weight: 97.2 },
    ];

    expect(calculateWeeklyChange(weights)).toBe(-1.9);
  });

  it('falls back to oldest available entry when less than a week is recorded', () => {
    const weights = [
      { date: '2026-04-07', weight: 100 },
      { date: '2026-04-09', weight: 99.4 },
      { date: '2026-04-10', weight: 99.1 },
    ];

    expect(calculateWeeklyChange(weights)).toBe(-0.9);
  });
});
