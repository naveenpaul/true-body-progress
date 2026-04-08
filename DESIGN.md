# Design System — Gym

> A personal fitness instrument. Numbers are the hero. Chrome disappears. One bold accent earned by decisive moments.

## Aesthetic thesis

**Quiet instrument.** This is not a social fitness app. Layouts are mostly monochrome and editorial. Cards are used sparingly — when they appear, they mean something. Accent green is reserved for verbs (CTAs, "on track" verdicts, completed sets, positive deltas) and never used as decoration. The dashboard reads like a cockpit, not a feed.

## Stack (actual, verified)

- **Expo SDK 54**, React Native 0.81.5
- **NativeWind / Uniwind / Tailwind v4** for styling (theme defined in `src/global.css` via `@theme`)
- **Inter** typeface (`@expo-google-fonts/inter`), tabular numerals via `fontVariant`
- **react-native-safe-area-context** for screen padding (never `pt-14`)
- **react-native-gifted-charts** for charts (wrapped in `SimpleChart`)
- Dark theme only (MVP)

## Color tokens

Defined in `src/global.css` under `@theme`. New "ink" tokens are the source of truth; legacy `charcoal-*` and `success-*` remain for screens not yet migrated.

| Token | Hex | Role |
|---|---|---|
| `ink-base` | `#0B0B0C` | Page background |
| `ink-card` | `#15161A` | Default card |
| `ink-elevated` | `#1C1D22` | Hero card (Coach, only) |
| `ink-hairline` | `#26272D` | Dividers, card borders, inactive chip borders |
| `ink-text` | `#F4F4F5` | Primary text, numbers |
| `ink-muted` | `#A1A1AA` | Secondary text |
| `ink-faint` | `#71717A` | Tertiary, captions, section labels |
| `ink-accent` | `#22C55E` | Reserved accent (also `success-500`) |
| `ink-danger` | `#F87171` | Negative deltas, errors, destructive |
| `ink-warning` | `#FBBF24` | Caution, approaching limits |

**Accent budget.** Accent appears on: filled primary buttons, completed set checkmarks, "on track" verdict, positive deltas, active tab, FAB, "+ Add set" affordances. Accent does NOT appear on: card borders, dividers, section headers, chart axis labels, decorative anything.

## Typography

Single family: **Inter** (already loaded). Numbers use `style={{ fontVariant: ['tabular-nums'] }}` so columns of stats align row-to-row. A future upgrade path is Geist Sans + Geist Mono if `@expo-google-fonts/geist` is added.

| Role | Tailwind | Notes |
|---|---|---|
| Display (stat numbers) | `text-4xl font-bold` + tabular-nums | 36px. Body weight, calorie targets. |
| H1 (screen title) | `text-3xl font-bold` | 30px. "Workouts", "Body", greeting line. |
| H2 (card title) | `text-lg font-semibold` | 18px. "Today's read", "Log today". |
| Body | `text-base` | 16px. Coach paragraphs, list rows. |
| Body small | `text-sm` | 14px. Secondary content. |
| Section label | `text-xs font-bold uppercase` + `letterSpacing: 0.8` | 12px. Above sections, all-caps. |
| Caption | `text-xs` | 12px. Timestamps, "+N more sets". |

**Tabular numerals are mandatory** for any rendered number. Use the shared constant:

```ts
const NUM_STYLE = { fontVariant: ['tabular-nums'] as const };
```

## Spacing rhythm

4pt scale, used as Tailwind classes:

| Token | Class | Use |
|---|---|---|
| 1 (4) | `p-1`, `gap-1` | Tight icon offsets |
| 2 (8) | `p-2`, `gap-2` | Inline groups |
| 3 (12) | `p-3`, `gap-3` | Form field gaps |
| 4 (16) | `p-4`, `gap-4` | Inside small cards |
| 5 (20) | `p-5`, `gap-5` | Inside hero/elevated cards, screen horizontal padding |
| 8 (32) | `mb-8` | Section separation between header and content |
| 10 (40) | `mb-10` | Section separation between major sections |

**Vertical rhythm rules:**
- Screen horizontal padding: `px-5` (20px). Never `p-4`.
- Sections separated by `mb-10` (40px) or hairline `border-t border-ink-hairline pt-5`.
- Inside cards: `p-5` for elevated, `p-4` for standard.
- Form field gap: `mb-3`.

## Layout

- **Safe-area insets always.** Top padding via `useSafeAreaInsets()` + `paddingTop: insets.top + 16`. Never `pt-14`.
- **Screens are flat.** Sections are separated by hairline top borders or vertical space, not by wrapping each section in a card.
- **Cards are reserved** for: forms (Log today, Add meal), the Coach hero card, and modal sheets. A list of items is a list, not a grid of cards.
- **Hero card pattern** (Coach only): `rounded-2xl border border-ink-hairline bg-ink-elevated p-5`. Nothing else uses `bg-ink-elevated`.
- **Standard card pattern**: `rounded-2xl border border-ink-hairline bg-ink-card p-5`.
- **Section headers** sit above sections as small uppercase labels (`SectionLabel` helper in dashboard).

## Border radius

| Token | Class | Use |
|---|---|---|
| sm | `rounded-lg` (8) | Pills, set-row inputs |
| md | `rounded-xl` (12) | TextInputs, small chips |
| lg | `rounded-2xl` (16) | Cards, hero card, FAB-adjacent surfaces |
| xl | `rounded-3xl` (24) | Bottom sheets |
| full | `rounded-full` | Verdict pill, segmented chips, FAB |

## Buttons

Real hierarchy. Defined in `src/components/ui/button.tsx`:

| Variant | Use | Visual |
|---|---|---|
| `primary` | THE action of the screen | `bg-success-500` filled, black label, bold |
| `tonal` | Secondary action paired with primary | `bg-charcoal-850` filled, white label |
| `outline` | Tertiary, status-bearing (Cancel) | Hairline border, colored label |
| `ghost` | Modal close, dismiss | Transparent, muted label |
| `destructive` | Delete, irreversible | `bg-red-600`, white label |

**Rule of one primary.** Each screen has at most one filled primary button visible at a time. If two actions are equally important, pair `primary` + `tonal`. Never two `primary`s side by side.

## Component patterns

### Stat row (Dashboard)
Flat row, no card. Big mono numbers (`text-4xl font-bold` + tabular-nums) with small captions below. Delta deltas inline in caption with semantic color.

### Coach hero card
Only thing using `bg-ink-elevated`. Has section label "COACH" above it. Sections inside ("What you've been doing", "How it's going", "What to do next") are uppercase mini-labels in `text-ink-faint` with body in `text-ink-text`. Verdict pill in top-right.

### Verdict pill
`rounded-full` with bordered fill at 15% opacity. Color matches verdict semantic (success/danger/neutral).

### Set table (Workout logger)
Dense flat rows. Columns: Set # | Previous | Weight input | Reps input. Inputs are `rounded-lg border border-ink-hairline bg-ink-card` with tabular-nums. "Fill from set 1" is a hairline-bordered pill.

### Rest timer floating bar
`absolute inset-x-5` with `bottom: insets.bottom + 12`. Two states: idle (hairline border, neutral) and running (filled accent green, big tabular-nums countdown). Skip is a plain pressable on the right.

### Exercise picker bottom sheet
`rounded-t-3xl border-t border-ink-hairline bg-ink-card`. Top has a centered `h-1 w-10 rounded-full bg-ink-hairline` drag handle. Filter chips use bordered-vs-filled pattern (active = filled accent, inactive = `border-ink-hairline`). Result list uses `ItemSeparatorComponent` hairlines, no per-item cards.

### Macro bar (Nutrition)
Section label above, `current / target unit` to the right with mono current. Track `h-1.5 bg-ink-hairline rounded-full`, fill colored per macro.

### History list
Flat list with `border-t border-ink-hairline` on each row except the first. Date on left in `text-ink-faint`, primary value on right in `text-ink-text` + tabular-nums.

## Motion (roadmap)

The current refresh ships with zero added motion to keep the diff safe. Next pass:
- Screen mount: 200ms ease-out fade-in via `Animated`
- Set checkmark: spring scale via Reanimated
- Rest timer: SVG ring countdown
- PR celebration: scale + fade 400ms
- Easing tokens: enter (ease-out), exit (ease-in), move (ease-in-out)

## Empty states

Every empty state must include:
1. A warm, human one-liner ("No workouts yet.")
2. A clarifying second line about what will appear ("Start your first session — your history will live here.")
3. If applicable, a primary CTA

Use `bg-ink-card` with `border-ink-hairline` wrapper, centered text.

## Anti-patterns (don't)

- **Don't** wrap every section in `rounded-xl bg-charcoal-900 p-4`. The card is the exception, not the default.
- **Don't** use accent green on borders, dividers, section labels, or decorative elements. Accent is for verbs.
- **Don't** use `pt-14` or hardcoded top padding. Use safe-area insets.
- **Don't** render numbers without `NUM_STYLE` (tabular-nums). Stats jitter without it.
- **Don't** use two filled primary buttons next to each other. Pair `primary` + `tonal`.
- **Don't** introduce new font sizes outside the type scale.
- **Don't** introduce new color tokens; extend `@theme` in `global.css` and document here.
- **Don't** dynamically build Tailwind classes (`bg-${variant}-500`). NativeWind extracts statically — use full literal class strings.

## Migration status (2026-04-08)

Refactored to the new system:
- `src/features/dashboard/dashboard-screen.tsx` — full rewrite, canonical example
- `src/features/workouts/workouts-screen.tsx` — targeted refactor (logger, history, modal, FAB)
- `src/features/body/body-screen.tsx` — targeted refactor
- `src/features/nutrition/nutrition-screen.tsx` — targeted refactor
- `src/components/ui/button.tsx` — added `primary` and `tonal` variants
- `src/global.css` — added `ink-*` tokens

Not yet migrated (still on legacy `charcoal-*` / pre-system patterns):
- `src/features/profile/profile-setup-screen.tsx`
- `src/features/settings/*`
- `src/components/ui/*` (form inputs, list, etc.)
- `src/app/_layout.tsx` ErrorBoundary

## Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-04-08 | Adopted "Quiet instrument" thesis, ink palette, accent budget, hero card pattern, real button hierarchy, safe-area insets, tabular-nums everywhere | Audit found existing DESIGN.md was fictional (claimed RN Paper / Roboto / `#00E676` — actual app is NativeWind / Inter / `#22C55E`). Refresh aligns docs with reality and modernizes the system. |
