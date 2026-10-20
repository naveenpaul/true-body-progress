import { parseEstimate, sumItems } from './meal-estimator';

describe('sumItems', () => {
  it('scales per-100g values by grams', () => {
    expect(sumItems([
      { item: 'biryani', grams: 300, per100g: { calories: 200, protein: 8, carbs: 25, fats: 8, fiber: 1 } },
      { item: 'sprite', grams: 300, per100g: { calories: 40, protein: 0, carbs: 10, fats: 0, fiber: 0 } },
    ])).toEqual({ calories: 720, protein: 24, carbs: 105, fats: 24, fiber: 3 });
  });

  it('treats missing or junk numbers as 0', () => {
    expect(sumItems([{ item: 'x', grams: Number.NaN, per100g: { calories: 100, protein: 1, carbs: 1, fats: 1, fiber: 1 } }]).calories).toBe(0);
  });
});

describe('parseEstimate', () => {
  it('returns totals for the requested keys and drops ones the model skipped', () => {
    const content = JSON.stringify({
      meals: {
        BF: [{ item: 'idli', grams: 160, per100g: { calories: 100, protein: 4, carbs: 20, fats: 0.5 } }],
        Lunch: [],
      },
    });
    const result = parseEstimate(content, ['BF', 'Lunch', 'Dinner']);
    expect(Object.keys(result)).toEqual(['BF']);
    expect(result.BF.calories).toBe(160);
  });

  it('throws on non-JSON', () => {
    expect(() => parseEstimate('not json', ['BF'])).toThrow();
  });
});
