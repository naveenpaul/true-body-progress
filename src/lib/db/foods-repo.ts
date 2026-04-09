import type { SQLiteDatabase } from 'expo-sqlite';

import type { Cuisine, Food, FoodSeed } from '@/lib/types';

// FTS5 virtual table mirrors `food` for typo-tolerant prefix search.
// Created idempotently on app boot from seed.ts before food rows are inserted,
// so seed inserts populate it via the AFTER INSERT trigger automatically.
export async function initFoodsFts(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE VIRTUAL TABLE IF NOT EXISTS food_fts USING fts5(
      id UNINDEXED,
      name,
      tokenize='unicode61 remove_diacritics 2'
    );

    CREATE TRIGGER IF NOT EXISTS food_fts_ai AFTER INSERT ON food BEGIN
      INSERT INTO food_fts(id, name) VALUES (new.id, new.name);
    END;

    CREATE TRIGGER IF NOT EXISTS food_fts_au AFTER UPDATE OF name ON food BEGIN
      DELETE FROM food_fts WHERE id = old.id;
      INSERT INTO food_fts(id, name) VALUES (new.id, new.name);
    END;

    CREATE TRIGGER IF NOT EXISTS food_fts_ad AFTER DELETE ON food BEGIN
      DELETE FROM food_fts WHERE id = old.id;
    END;
  `);
}

// Backfill FTS rows for any food rows that exist without a matching FTS entry.
// Safe to call repeatedly. Used after seeding builtin foods so we don't depend
// on trigger ordering across seed batches.
export async function rebuildFoodsFtsIfEmpty(db: SQLiteDatabase): Promise<void> {
  const ftsCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM food_fts',
  );
  const foodCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM food',
  );
  if ((ftsCount?.count ?? 0) >= (foodCount?.count ?? 0))
    return;
  await db.execAsync('DELETE FROM food_fts');
  await db.runAsync('INSERT INTO food_fts(id, name) SELECT id, name FROM food');
}

export async function seedFoodsFromJson(
  db: SQLiteDatabase,
  rows: FoodSeed[],
): Promise<void> {
  if (rows.length === 0)
    return;
  await db.withTransactionAsync(async () => {
    for (const r of rows) {
      await db.runAsync(
        `INSERT INTO food (
           id, name, name_lower, cuisine, category,
           default_serving_qty, default_serving_unit, default_serving_grams,
           kcal, protein_g, carbs_g, fat_g, fiber_g,
           source, is_favorite
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'builtin-unverified', 0)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           name_lower = excluded.name_lower,
           cuisine = excluded.cuisine,
           category = excluded.category,
           default_serving_qty = excluded.default_serving_qty,
           default_serving_unit = excluded.default_serving_unit,
           default_serving_grams = excluded.default_serving_grams,
           kcal = excluded.kcal,
           protein_g = excluded.protein_g,
           carbs_g = excluded.carbs_g,
           fat_g = excluded.fat_g,
           fiber_g = excluded.fiber_g,
           updated_at = datetime('now')`,
        [
          r.id,
          r.name,
          r.name.toLowerCase(),
          r.cuisine,
          r.category,
          r.default_serving_qty,
          r.default_serving_unit,
          r.default_serving_grams,
          r.kcal,
          r.protein_g,
          r.carbs_g,
          r.fat_g,
          r.fiber_g,
        ],
      );
    }
  });
}

// Escape user input for FTS5 MATCH. We wrap each token in double quotes and
// append * for prefix matching. Strips characters FTS5 treats as operators.
const FTS_STRIP_RE = /[^\p{L}\p{N}\s]/gu;
const FTS_SPLIT_RE = /\s+/;
function buildFtsQuery(query: string): string | null {
  const tokens = query
    .toLowerCase()
    .replace(FTS_STRIP_RE, ' ')
    .split(FTS_SPLIT_RE)
    .filter(Boolean);
  if (tokens.length === 0)
    return null;
  return tokens.map(t => `"${t}"*`).join(' ');
}

export async function searchFoods(
  db: SQLiteDatabase,
  query: string,
  options: { cuisine?: Cuisine | 'all'; limit?: number } = {},
): Promise<Food[]> {
  const { cuisine = 'all', limit = 50 } = options;
  const trimmed = query.trim();

  // Empty query → return favorites + most recent additions, optionally filtered.
  if (!trimmed) {
    const params: (string | number)[] = [];
    let where = '';
    if (cuisine !== 'all') {
      where = 'WHERE cuisine = ?';
      params.push(cuisine);
    }
    params.push(limit);
    return db.getAllAsync<Food>(
      `SELECT * FROM food ${where}
       ORDER BY is_favorite DESC, name COLLATE NOCASE ASC
       LIMIT ?`,
      params,
    );
  }

  const ftsQuery = buildFtsQuery(trimmed);
  if (!ftsQuery)
    return [];

  const params: (string | number)[] = [ftsQuery];
  let cuisineWhere = '';
  if (cuisine !== 'all') {
    cuisineWhere = 'AND f.cuisine = ?';
    params.push(cuisine);
  }
  params.push(limit);

  return db.getAllAsync<Food>(
    `SELECT f.* FROM food f
     JOIN food_fts ON food_fts.id = f.id
     WHERE food_fts MATCH ? ${cuisineWhere}
     ORDER BY f.is_favorite DESC, rank
     LIMIT ?`,
    params,
  );
}

export async function getFoodById(
  db: SQLiteDatabase,
  id: string,
): Promise<Food | null> {
  const row = await db.getFirstAsync<Food>('SELECT * FROM food WHERE id = ?', [id]);
  return row ?? null;
}

// Recently logged foods, deduped, newest first. Pulled from nutrition_entry
// joined back to food. Excludes legacy freeform entries (food_id IS NULL).
export async function getRecentFoods(
  db: SQLiteDatabase,
  options: { days?: number; limit?: number } = {},
): Promise<Food[]> {
  const { days = 30, limit = 20 } = options;
  return db.getAllAsync<Food>(
    `SELECT f.* FROM food f
     JOIN (
       SELECT food_id, MAX(created_at) as last_used
       FROM nutrition_entry
       WHERE food_id IS NOT NULL
         AND date >= date('now', '-' || ? || ' days')
       GROUP BY food_id
     ) recent ON recent.food_id = f.id
     ORDER BY recent.last_used DESC
     LIMIT ?`,
    [days, limit],
  );
}

export async function getFavoriteFoods(
  db: SQLiteDatabase,
  limit = 50,
): Promise<Food[]> {
  return db.getAllAsync<Food>(
    `SELECT * FROM food WHERE is_favorite = 1
     ORDER BY name COLLATE NOCASE ASC LIMIT ?`,
    [limit],
  );
}

export async function toggleFavorite(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE food
     SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END,
         updated_at = datetime('now')
     WHERE id = ?`,
    [id],
  );
}

export type CreateCustomFoodInput = {
  name: string;
  category?: string;
  default_serving_qty: number;
  default_serving_unit: string;
  default_serving_grams?: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number | null;
};

export async function createCustomFood(
  db: SQLiteDatabase,
  input: CreateCustomFoodInput,
): Promise<Food> {
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await db.runAsync(
    `INSERT INTO food (
       id, name, name_lower, cuisine, category,
       default_serving_qty, default_serving_unit, default_serving_grams,
       kcal, protein_g, carbs_g, fat_g, fiber_g,
       source, is_favorite
     ) VALUES (?, ?, ?, 'custom', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'custom', 0)`,
    [
      id,
      input.name,
      input.name.toLowerCase(),
      input.category ?? 'custom',
      input.default_serving_qty,
      input.default_serving_unit,
      input.default_serving_grams ?? null,
      input.kcal,
      input.protein_g,
      input.carbs_g,
      input.fat_g,
      input.fiber_g ?? null,
    ],
  );
  const created = await getFoodById(db, id);
  if (!created)
    throw new Error('Failed to create custom food');
  return created;
}
