import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const integrity = await db.getFirstAsync<{ integrity_check: string }>(
    'PRAGMA integrity_check',
  );
  if (integrity?.integrity_check !== 'ok') {
    console.error('Database integrity check failed:', integrity);
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      height_cm REAL NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
      goal_type TEXT NOT NULL CHECK (goal_type IN ('fat_loss', 'muscle_gain', 'recomposition')),
      target_weight REAL NOT NULL,
      preferred_units TEXT NOT NULL DEFAULT 'metric' CHECK (preferred_units IN ('metric', 'imperial')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exercise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      primary_muscle_group TEXT NOT NULL,
      secondary_muscle_group TEXT,
      equipment_type TEXT NOT NULL CHECK (equipment_type IN ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight')),
      is_custom INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workout_session (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workout_set (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      reps INTEGER NOT NULL,
      weight REAL NOT NULL,
      rpe REAL,
      rest_time_sec INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (session_id) REFERENCES workout_session(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercise(id)
    );

    CREATE TABLE IF NOT EXISTS body_metric (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight REAL,
      waist REAL,
      body_fat REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS nutrition_entry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_name TEXT NOT NULL,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fats REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_workout_set_exercise_date
      ON workout_set(exercise_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_workout_set_session
      ON workout_set(session_id);
    CREATE INDEX IF NOT EXISTS idx_body_metric_date
      ON body_metric(date);
    CREATE INDEX IF NOT EXISTS idx_workout_session_date
      ON workout_session(date);
    CREATE INDEX IF NOT EXISTS idx_nutrition_entry_date
      ON nutrition_entry(date);
  `);

  // Migration: make body_metric weight/waist nullable
  const colInfo = await db.getAllAsync<{ notnull: number; name: string }>(
    `PRAGMA table_info(body_metric)`,
  );
  const weightCol = colInfo.find(c => c.name === 'weight');
  if (weightCol && weightCol.notnull === 1) {
    await db.execAsync(`
      CREATE TABLE body_metric_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        weight REAL,
        waist REAL,
        body_fat REAL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO body_metric_new SELECT * FROM body_metric;
      DROP TABLE body_metric;
      ALTER TABLE body_metric_new RENAME TO body_metric;
      CREATE INDEX IF NOT EXISTS idx_body_metric_date ON body_metric(date);
    `);
  }
}
