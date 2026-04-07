# Design System — Gym App

## Platform
- React Native + Expo (managed workflow)
- UI framework: React Native Paper (Material Design 3)
- Chart library: react-native-gifted-charts

## Theme
Dark theme only (MVP). Gym-appropriate, data-forward.

## Colors

| Token | Value | Usage |
|-------|-------|-------|
| surface | #121212 | Primary background |
| surface-alt | #1E1E1E | Cards, elevated surfaces, bottom sheets |
| on-surface | #FFFFFF | Primary text, numbers |
| on-surface-2 | #B3B3B3 | Secondary text, labels, timestamps |
| accent | #00E676 | Electric green. CTAs, positive changes, active states |
| accent-dim | #00E67633 | Accent at 20% opacity. Suggestion banner backgrounds |
| danger | #FF5252 | Negative changes, errors, destructive actions |
| warning | #FFB74D | Caution states, approaching limits |

### Contrast requirements
- All text: minimum 4.5:1 against background (WCAG AA)
- Large text (18px+): minimum 3:1
- Chart labels and axis text: minimum 4.5:1 (override chart lib defaults)

## Typography (Roboto)

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| display | 32px | Bold | Big numbers: body weight, reps, weight lifted |
| title | 20px | Bold | Screen titles, exercise names |
| body | 16px | Regular | Descriptions, suggestions, coaching text |
| label | 14px | Medium | Field labels, tab names, chart labels |
| caption | 12px | Regular | Timestamps, secondary info, set numbers |

## Spacing Scale

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| sm | 8px | Buttons, inputs, chips |
| md | 12px | Cards, sheets |
| lg | 16px | Bottom sheet handle area |

## Touch Targets
- Minimum 48x48dp (Material guideline)
- Workout set inputs: use stepper controls (+/-) not raw text fields
- RPE: horizontal chip selector (1-10), not text input

## Component Patterns

### Stats Row (Dashboard)
- Inline layout, NO card wrapper
- Large display number + small label below
- Change indicator (arrow + accent/danger color)

### Suggestion Banner
- accent-dim background (#00E67633)
- Left icon + body text
- NOT a card. Distinct from other content.

### Set Table (Workout Logger)
- Dense rows, alternating subtle background (surface / surface-alt)
- Columns: Set # | Previous | Weight x Reps | RPE | Checkmark
- "Previous" column shows last session's data for autofill reference
- Stepper controls for weight/reps, chip selector for RPE

### Workout History Card
- surface-alt background
- Exercise name (title weight), sets as subtitle
- Date + duration in caption
- Cards only here because each represents a tappable object

### Bottom Sheet (Exercise Picker)
- surface-alt background
- Drag handle (lg radius)
- Search input at top
- Recent exercises first, then alphabetical with muscle group filters

### Quick Action Buttons
- Outlined style (not filled) with icon
- Accent border color
- "Log Workout", "Log Weight" on dashboard

## Navigation
- Bottom tab bar: 4 tabs (Dashboard, Workouts, Body, Nutrition)
- Analytics merged into Body and Workouts screens
- Settings accessible via gear icon on Dashboard header

## Empty States
Every empty state must include:
1. A warm, human message (not "No data found")
2. A primary action button
3. Context for what will appear once data exists

## Celebrations
- Personal records: brief inline acknowledgment card
- Weight milestones: notification-style banner
- No badges, points, or gamification. Just recognition.

## First Launch
- Progressive disclosure (no onboarding wizard)
- Empty dashboard with single highlighted CTA: "Log your first weigh-in"
- Dashboard fills up organically as user adds data
