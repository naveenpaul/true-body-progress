import type { ReferenceFood } from './meal-estimator';
import { normalizeItemKey, parseEstimate, pickCandidates, resolveItems } from './meal-estimator';

const per100 = (calories: number, protein = 0, carbs = 0, fats = 0, fiber = 0) => ({ calories, protein, carbs, fats, fiber });

const FOODS: ReferenceFood[] = [
  { id: 'in-roti-wheat', name: 'Roti / Chapati (Whole Wheat)', per100g: per100(275, 8.75, 55, 3.75, 7.5), servingGrams: 40 },
  { id: 'in-chai-milk', name: 'Masala Chai (with milk & sugar)', per100g: per100(45, 1.5, 6, 1.5), servingGrams: 200 },
  { id: 'in-lobia', name: 'Lobia (Black-eyed Peas)', per100g: per100(122, 6.7, 17, 2.8, 4.4), servingGrams: 180 },
  { id: 'in-chicken-pieces', name: 'Chicken Pieces (curry/biryani, cooked)', per100g: per100(200, 25, 1, 11), servingGrams: 100 },
  { id: 'in-biryani-rice', name: 'Biryani / Tahari Rice (no meat)', per100g: per100(175, 3.3, 28, 5.3, 0.8), servingGrams: 150 },
  { id: 'in-cooking-oil', name: 'Cooking Oil', per100g: per100(884, 0, 0, 100), servingGrams: 14 },
  { id: 'in-sabzi-home', name: 'Vegetable Sabzi (home, dry)', per100g: per100(80, 2, 8, 4.5, 2.5), servingGrams: 100 },
  { id: 'us-steak', name: 'Sirloin Steak (grilled)', per100g: per100(210, 28, 0, 10), servingGrams: 100 },
];

describe('pickCandidates', () => {
  it('matches diary words, plurals and aliases to food names', () => {
    const ids = pickCandidates(['2 chapathis, 1 cup tea, 100gms cowpeas cooked home'], FOODS).map(f => f.id);
    expect(ids).toEqual(expect.arrayContaining(['in-roti-wheat', 'in-chai-milk', 'in-lobia']));
    expect(ids).not.toContain('us-steak');
  });

  it('always offers the components used to split dishes', () => {
    const ids = pickCandidates(['1 banana'], FOODS).map(f => f.id);
    expect(ids).toEqual(expect.arrayContaining(['in-chicken-pieces', 'in-biryani-rice', 'in-cooking-oil', 'in-sabzi-home']));
  });
});

describe('resolveItems', () => {
  it('values matched items from the food database, ignoring the model numbers', () => {
    const result = resolveItems([
      { item: 'chicken', grams: 50, food_id: 'in-chicken-pieces', per100g: per100(999) },
      { item: 'biryani rice', grams: 250, food_id: 'in-biryani-rice' },
      { item: 'oil', grams: 24, food_id: 'in-cooking-oil' },
    ], FOODS)!;
    expect(Math.round(result.total.calories)).toBe(100 + 438 + 212);
    expect(Math.round(result.total.protein)).toBe(13 + 8);
    expect(result.learned).toEqual([]);
  });

  it('falls back to an exact name match and the default serving size', () => {
    const result = resolveItems([{ item: 'Masala Chai (with milk & sugar)', grams: Number.NaN, food_id: null }], FOODS)!;
    expect(result.total.calories).toBe(90);
  });

  it('uses and returns model values for unknown foods', () => {
    const result = resolveItems([{ item: 'Mysuru Pak', grams: 60, food_id: null, per100g: per100(520, 6, 50, 33) }], FOODS)!;
    expect(result.total.calories).toBe(312);
    expect(result.learned).toEqual([{ key: 'mysuru pak', name: 'Mysuru Pak', per100g: per100(520, 6, 50, 33) }]);
  });

  it('pins everyday diary items to one food whatever the model picked', () => {
    const result = resolveItems([{ item: 'Tea', grams: 150, food_id: 'in-cutting-chai' }], FOODS)!;
    expect(result.total.calories).toBe(67.5);
  });

  it('refuses to guess when an item has no match and no values', () => {
    expect(resolveItems([{ item: 'mystery', grams: 100, food_id: 'nope' }], FOODS)).toBeNull();
  });
});

describe('parseEstimate', () => {
  it('returns meals that fully resolved and skips the rest', () => {
    const content = JSON.stringify({
      meals: {
        BF: [{ item: 'chapathi', grams: 80, food_id: 'in-roti-wheat', per100g: null }],
        Lunch: [{ item: 'mystery', grams: 100, food_id: null, per100g: null }],
      },
    });
    const result = parseEstimate(content, ['BF', 'Lunch', 'Dinner'], FOODS);
    expect(Object.keys(result.macros)).toEqual(['BF']);
    expect(result.macros.BF.calories).toBe(220);
    expect(result.macros.BF.fiber).toBe(6);
  });

  it('throws on non-JSON', () => {
    expect(() => parseEstimate('not json', ['BF'], FOODS)).toThrow();
  });
});

describe('normalizeItemKey', () => {
  it('ignores case, plurals and filler words', () => {
    expect(normalizeItemKey('Home made Beef Taharis')).toBe(normalizeItemKey('beef tahari'));
  });
});
