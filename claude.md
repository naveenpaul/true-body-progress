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
│   ├── workouts/                # Workout logging + store
│   ├── body/                    # Body metrics + charts + store
│   ├── nutrition/               # Nutrition tracking
│   └── profile/                 # Profile setup + user store
│
├── components/ui/               # Shared UI components (from template)
│
├── lib/                          # Core infrastructure
│   ├── db/                      # SQLite database layer
│   │   ├── database.ts         # Schema + initialization
│   │   ├── seed.ts             # 44 default exercises
│   │   ├── user-repo.ts        # User CRUD
│   │   ├── workout-repo.ts     # Workout sessions + sets
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
- **Imports**: Always use `@/` prefix for absolute imports.

## How: Essential Rules

- All fitness data stored in SQLite (not MMKV)
- All measurements stored in metric internally, converted on display
- Zustand stores wrap DB repos for reactive state
- Feature screens go in `src/features/[name]/`, route files in `src/app/`
- Use `type` over `interface` (Obytes convention)
- kebab-case for all file names
