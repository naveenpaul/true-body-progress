# TODOS

## Embedded Food Database
**What:** Create a local SQLite table with ~500 common foods and their macros (calories, protein, carbs, fats per 100g). Populate from public nutrition data (USDA FoodData Central or similar).
**Why:** Users need to search "chicken breast" and get approximate macros without an API call. Without this, nutrition logging is manual-entry-only and adoption drops.
**Pros:** Offline, fast, no API cost, works on first launch.
**Cons:** Limited to ~500 foods, needs curation effort, data may not cover regional foods.
**Context:** Decided during design review (2026-04-05) that local DB + manual override is the nutrition entry approach. This food DB is a prerequisite for the nutrition feature.
**Depends on:** SQLite schema finalized, Nutrition table created.
