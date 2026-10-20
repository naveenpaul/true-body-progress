> Gym - Personal fitness tracking app built on the [Obytes React Native Template](https://github.com/obytes/react-native-template-obytes).

## What: Technology Stack

- **Expo SDK 54** with React Native 0.81.5
- **TypeScript** - Strict type safety
- **Expo Router 6** - File-based routing
- **TailwindCSS** via Uniwind/NativeWind - Utility-first styling
- **Zustand** - Global state management
- **expo-sqlite** - Local SQLite database for all fitness data
- **MMKV** - Encrypted local storage for preferences
- **Jest + React Testing Library** - Unit testing

## What: Project Structure

```
src/
├── app/                          # Expo Router file-based routes
│   ├── _layout.tsx              # Root layout (DB init, providers)
│   └── (app)/                   # Tab navigation
│       ├── index.tsx            # Dashboard
│       ├── workouts.tsx         # Workout logging
│       ├── body.tsx             # Body metrics
│       ├── nutrition.tsx        # Nutrition tracking
│       └── settings.tsx         # Profile setup
│
├── features/                     # Feature modules
│   ├── dashboard/               # Dashboard screen + coaching
│   ├── workouts/                # Workout logging, routines, rest timer + store
│   ├── body/                    # Body metrics + charts + store
│   ├── nutrition/               # Nutrition tracking
│   └── profile/                 # Profile setup + user store
│
├── components/ui/               # Shared UI components (from template)
│
├── lib/                          # Core infrastructure
│   ├── db/                      # SQLite database layer
│   │   ├── database.ts         # Schema + initialization
│   │   ├── seed.ts             # 105 default exercises (incl. cardio + timed)
│   │   ├── user-repo.ts        # User CRUD
│   │   ├── workout-repo.ts     # Workout sessions + sets
│   │   ├── routine-repo.ts     # Saved routines (Push/Pull/Legs) + rotation
│   │   ├── body-metrics-repo.ts # Body measurements
│   │   └── nutrition-repo.ts   # Nutrition entries
│   ├── ai/                      # AI coaching (OpenRouter)
│   │   ├── llm-client.ts       # LLM API client
│   │   └── coach-service.ts    # Rule engine + LLM orchestrator
│   ├── rules/                   # Coaching suggestion rules
│   │   ├── strength-rule.ts    # Progression/deload logic
│   │   ├── fat-loss-rule.ts    # Weight/waist trend analysis
│   │   └── recovery-rule.ts    # Overtraining detection
│   ├── services/               # Business logic
│   │   └── calculation-service.ts # BMR, TDEE, macros
│   ├── types.ts                # All TypeScript types
│   ├── units.ts                # Metric/imperial conversion
│   └── dates.ts                # Date formatting helpers
│
└── global.css                   # Tailwind theme (dark gym theme)
```

## How: Development Workflow

```bash
pnpm start              # Start dev server
pnpm ios                # Run on iOS simulator (requires prebuild)
pnpm android            # Run on Android
pnpm type-check         # TypeScript validation
pnpm lint               # ESLint check
pnpm test               # Run Jest tests
```

## How: Key Patterns

- **Database**: All data in SQLite via `src/lib/db/`. All values stored in metric (kg, cm).
- **State**: Zustand stores in each feature folder. Stores load from DB and provide actions.
- **Styling**: NativeWind/Tailwind classes. Dark theme with green (#22C55E) accent.
- **Routes**: Thin re-export files in `src/app/` pointing to feature screens.
- **Coaching**: Rule engine runs first, optional LLM enhances via OpenRouter API.
- **Exercise tracking types**: `weight_reps`, `bodyweight_reps` (volume = (body weight snapshot + added) × reps), `time` (duration_sec), `cardio` (duration_sec + distance_m). Volume SQL goes through `volumeSql()` in workout-repo.
- **Notion meal sync**: Nutrition screen pulls the "Daily Meals" Notion database (columns Pre-BF/BF/Lunch/Pre Dinner/Dinner, read-only) via `src/lib/notion/`, estimates macros per day (`src/lib/ai/meal-estimator.ts`: Groq only splits text into items + grams and picks a food id from candidates; numbers come from the `food` table, everyday items are pinned via `PINNED_FOODS`, unknown items are cached in `estimated_food`; bump `ESTIMATOR_VERSION` to re-estimate old entries and `FOODS_SEED_VERSION` when seed foods change), and upserts into `nutrition_entry` keyed by `source_ref` = `<page id>:<column>`. Only cells whose text changed are re-estimated. Needs `EXPO_PUBLIC_NOTION_TOKEN` + `EXPO_PUBLIC_NOTION_MEALS_DB` in `.env`.
- **Nutrition trends**: `src/lib/services/nutrition-trends.ts` (pure, tested) builds 7-day rolling averages and this-week-vs-last deltas for protein/fiber (want ↑) and carbs/fat (want ↓, also as % of calories). Days with < 3 meals are plotted but excluded from averages. Rendered by `NutritionTrendsCard` on the Nutrition tab and (compact) on the Dashboard; also fed to the coach prompt.
- **Native modules**: expo-audio / expo-haptics / expo-notifications (rest timer). Adding native modules needs a new dev build.
- **Imports**: Always use `@/` prefix for absolute imports.

## How: Essential Rules

- All fitness data stored in SQLite (not MMKV)
- All measurements stored in metric internally, converted on display
- Zustand stores wrap DB repos for reactive state
- Feature screens go in `src/features/[name]/`, route files in `src/app/`
- Use `type` over `interface` (Obytes convention)
- kebab-case for all file names
