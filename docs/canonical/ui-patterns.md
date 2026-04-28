# UI Patterns — Zona Visual Language

**Reference aesthetic**: Runna · Planzy  
**Authority**: This document defines layout patterns, component anatomy, spacing, and typography rules for all Zona screens. Read before building any new screen or component.

**Design system**: Warm Slate (ADR-007). Single light theme. No dark mode (ADR-008). All tokens from `globals.css`.

---

## Core Aesthetic

Warm, grounded, athletic. No decoration for decoration's sake. Every element earns its place.

- **Warm Slate is primary** — `--bg: #F3F0EB` off-white background, `--card: #FFFFFF` card surfaces
- **Bold metrics, quiet context** — large numbers, small muted labels underneath; value always dominates
- **Type accent, not flood** — session colours appear as left borders, dots, or small chips; never as full card backgrounds
- **Density with breathing room** — tight within a card, clear gaps between cards, generous padding inside
- **No chrome** — no box shadows stacked on box shadows, no gradients, no decorative dividers
- **Moss is the primary accent** — `--moss: #6B8E6B` for CTA, active states, completion signals
- **Warn is coaching only** — `--warn: #B8853A` for coach voice blocks and adjustment banners exclusively

---

## Typography Scale

All type uses **Inter** only. `var(--font-ui)` and `var(--font-brand)` both resolve to Inter. Never hardcode font family strings. Space Grotesk is retired (ADR-007).

| Role | Token | Weight | Size | Usage |
|---|---|---|---|---|
| Hero display | `--font-ui` | 800 | 56px | Today screen hero ("10km, slowly.") |
| Screen title | `--font-ui` | 800 | 26px | Page headings ("Your plan", "Today") |
| Section label | `--font-ui` | 700 | 10px uppercase 0.08em | Eyebrows, category labels |
| Card primary | `--font-ui` | 600 | 15px | Session name, main label |
| Card secondary | `--font-ui` | 400 | 12px | Zone, type, supporting detail — `--mute` |
| Body / description | `--font-ui` | 400 | 14px | Session description, coach note |
| Metric large | `--font-ui` | 800 | 44px | RestraintCard percent, big stats |
| Metric medium | `--font-ui` | 700 | 17px | Session card distance |
| Metric small | `--font-ui` | 400 | 11px | Session card duration — `--mute-2` |
| Muted / hint | `--font-ui` | 400 | 12px | `--mute` — timestamps, metadata |
| Wordmark | `--font-ui` | 800 | 14px | ZONA nav wordmark |

### Metric Pair Pattern (Runna-style)

Use consistently wherever a stat is displayed:

```
42.3          ← Inter 800, 44px, tabular-nums, --ink
km this week  ← Inter 400, 13px, --mute
```

Never put label above value. Value always dominates.

---

## Spacing Rhythm

Canonical spacing values. No others.

```
4px   — icon gaps, inline tight
8px   — within a component (label + value pair)
12px  — between elements inside a card; between session cards in a list
14px  — card vertical padding (inner)
16px  — section header margin, coach block padding
20px  — card padding (outer standard)
24px  — between cards in a list (section-level)
28px  — between sections
32px  — major section breaks
40px  — screen-level top breathing
48px  — large screen padding
56px  — hero section spacing
```

Card inner padding: `20px` horizontal, `14–20px` vertical depending on content density.  
List gap between session cards: `12px`.  
Section gap (week → week): `28–32px`.

---

## Design Token Reference

Always use these CSS custom property names. Never hardcode hex values.

| Token | Semantic role |
|---|---|
| `--bg` | Primary background (`#F3F0EB`) |
| `--bg-soft` | Input fields, inset areas |
| `--card` | Card surfaces (`#FFFFFF`) |
| `--ink` | Primary text (`#1A1A1A`) |
| `--ink-2` | Secondary text (`#3D3A36`) |
| `--mute` | Muted / supporting text (`#8A857D`) |
| `--mute-2` | Lighter muted — durations, meta |
| `--moss` | Primary accent — CTA, active, completion (`#6B8E6B`) |
| `--moss-soft` | Moss tint — completion dot background |
| `--moss-mid` | Moss mid — active borders |
| `--warn` | Coaching, warnings — amber (`#B8853A`) |
| `--warn-bg` | Warm amber tint — coach block background |
| `--coach-ink` | Warm dark brown — text on `--warn-bg` only (`#3D2600`) |
| `--danger` | Errors, skipped (`#B84545`) — never in training UI |
| `--line` | Standard border (`rgba(26,26,26,0.08)`) |
| `--line-strong` | Stronger border for current/active states |

---

## Component Patterns

### 1. SessionCard

Four states: `future` (default), `current`, `done`, `skipped`.

**Visual anatomy:**

```
┌─────────────────────────────────────────────┐
│ ▌  Easy Run                         10.0km  │
│    Zone 2 · ≤145bpm                  60min  │
└─────────────────────────────────────────────┘
```

**Structure:**
- **Left accent**: 3px solid vertical bar, `getSessionColor(type)` from `lib/session-types.ts` — sole owner
- **Name**: 15px 600 `--ink` (future/current), `--mute` (done)
- **Detail**: 12px 400 `--mute`, hidden when skipped
- **Right distance**: 17px 700 tabular-nums `--ink` (future), 14px 600 `--mute` (done)
- **Right duration**: 11px 400 `--mute-2` below distance
- **Tap target**: full card width, min-height `64px`
- **Radius**: `var(--radius-md)`

**State rules:**

| State | Background | Border | Accent | Name colour |
|---|---|---|---|---|
| `future` | `--card` | `1px solid --line` | Full opacity | `--ink` |
| `current` | `--card` | `1px solid --line-strong` | Full opacity | `--ink` |
| `done` | `transparent` | none | 0.3 opacity | `--mute` + moss check circle |
| `skipped` | `transparent` | `1px dashed --line-strong` | 0.2 opacity | `--danger` strikethrough |

Done state: 16px moss check circle (--moss-soft bg, --moss stroke), name in `--mute`, "via Strava · {activityName}" in 11px `--strava` at 0.75 opacity.

Skipped state: "Skipped" label 11px 500 `--danger` right side, name struck through.

Reference: `components/shared/SessionCard.tsx`

---

### 2. Session Card (Expanded / Session Detail)

Full screen. Back arrow top-left. Session opens into a dedicated screen — not an in-place expand.

```
[←]

[Day · Week eyebrow]       ← 10px 600 --mute uppercase
[Session title]            ← 16px 700 --ink
[Type chip right]          ← 10px 700, coloured bg at 15% opacity

┌─────────────────────────────┐
│ ▌  [HR target] · [Zone]    │  ← metric row
│    [Distance] · [Duration]  │
│ ─────────────────────────── │
│  [Session description]      │  ← 14px 400 --ink-2
└─────────────────────────────┘

[RPEScale]                 ← if session complete
[CoachNoteBlock]           ← variant="why", label "WHY THIS SESSION"
```

Zone order (canonical, INV-UI-005):
1. Run type · Zone · HR target · Pace bracket · Distance + duration
2. Session description
3. Why / coach notes

Reference: `DashboardClient.tsx` → `SessionPopupInner`

---

### 3. Week Strip (Planzy-style)

Horizontal day selector. Compact. Always visible above session list.

```
  Mo  Tu  We  Th  Fr  Sa  Su
  ●   ○   ─   ●   ○   ○   ─
```

- Day label: 3-letter abbreviation, `0.6875rem`, `--mute`
- Indicator dot:
  - `●` filled `--moss` — today with session
  - `●` filled `--mute` — has session, not today
  - `○` outlined — has session, future
  - `─` dash — rest/empty
  - `✓` checkmark (`--moss`) — completed
- Active day: moss dot + day label in `--moss`
- Scroll horizontally if multi-week view needed
- Min tap target per day: `44px` wide (iOS HIG)

---

### 4. Stat Row

3–4 metric pairs in a horizontal row. Used in weekly summary, plan overview.

```
┌──────────┬──────────┬──────────┬──────────┐
│  42.3    │  5h 20m  │   84%    │   8/12   │
│  km      │  total   │  zone 2  │  done    │
└──────────┴──────────┴──────────┴──────────┘
```

- Equal-width columns, `flex: 1`
- Value: Inter 700, `1.5rem`, tabular-nums
- Label: Inter 400, `0.75rem`, `--mute`
- Dividers: `1px solid --line` between columns (not around)
- Background: `--card`

---

### 5. Section Header

```
Week 14  ·  Apr 14–20          62km planned
```

- Left: Inter 700, 13px, week number + date range — `--ink`
- Right: planned volume, `--mute` weight
- No background, no box
- Margin above: `32px`, margin below: `8px`

---

### 6. Session Type Chip

Small pill label. Used in session detail eyebrow.

```
[ EASY ]  [ LONG ]  [ TEMPO ]
```

- Font: Inter 700, `10px`, uppercase, `letter-spacing: 0.08em`
- Padding: `3px 8px`
- Background: session colour at `15% opacity`
- Text: session colour
- Radius: `4px`
- Never use full solid background

---

### 7. Navigation Bar (Bottom)

Minimal. 4–5 tabs max.

- Background: `--card` with `border-top: 1px solid --line`
- Active icon + label: `--moss`
- Inactive: `--mute`
- Label: `0.6875rem`, always visible (no icon-only nav)
- Height: `60px` + safe area inset

---

### 8. Empty State

```
        ○

   Nothing here yet.
   Your plan sessions will
   appear once loaded.
```

- Centered vertically in available space
- Heading: Inter 600, `1rem`, `--ink`
- Body: Inter 400, `0.875rem`, `--mute`
- No button unless there's a specific action available

---

### 9. CoachNoteBlock

Warm amber block for all coach voice content. Used in TodayScreen and Session Detail.

```
┌─────────────────────────────────────────────┐
│  [Z] COACH          [timestamp optional]    │
│                                             │
│  Keep it easy. Nose breathing the whole     │
│  way. If you can't talk, slow down.         │
└─────────────────────────────────────────────┘
```

**Structure:**
- Background: `--warn-bg`
- Radius: `14px`, padding: `16px 18px`
- Eyebrow row: `10px 700 --warn uppercase 0.14em tracking` left + timestamp right (`11px 400 --warn 0.6 opacity`)
- Avatar circle: `22px`, `--ink` background, `--bg` text, `10px 800` initial letter — **hidden in `variant="why"`**
- Body: `14px 400 --coach-ink` (default) or `13px 400 --coach-ink` (why variant)

**Props:**
```tsx
label?: string          // default "COACH"
timestamp?: string      // optional "6:12am"
initial?: string        // default "Z"
children: React.ReactNode
variant?: 'default' | 'why'
```

**Variant rules:**
- `default` — shows avatar, used for plan-level coaching notes in TodayScreen
- `why` — no avatar, used in Session Detail "WHY THIS SESSION" section, slightly smaller body text

Reference: `components/shared/CoachNoteBlock.tsx`

---

### 10. PendingAdjustmentBanner

Inline banner for plan adjustments awaiting user confirmation. Appears above coach note on TodayScreen.

```
┌─────────────────────────────────────────────┐
│  [!] PLAN ADJUSTED                          │
│                                             │
│  Thursday's long run moved to Saturday.     │
│  Injury week — protecting your build.       │
│                                             │
│  [  Confirm  ]  [Revert]                    │
└─────────────────────────────────────────────┘
```

**Structure:**
- Background: `--warn-bg`
- Radius: `14px`, padding: `14px 16px`
- Eyebrow: `10px 700 --warn uppercase 0.1em tracking`
- Alert circle: `18px`, `--warn` background, `--card` text, "!" `10px 800`
- Body: `13px 400 --coach-ink`, line-height 1.5
- Button row: flex gap 8px, margin-top 14px
  - Confirm: `--warn` background, `--card` text, `100px` radius pill, `36px` height, `12px 600`
  - Revert: transparent bg, `rgba(61,38,0,0.2)` border, `--coach-ink` text

**Props:**
```tsx
title?: string          // default "Plan adjusted"
children: React.ReactNode
onConfirm: () => void
onRevert: () => void
loading?: boolean       // disables buttons during API call
```

Reference: `components/shared/PendingAdjustmentBanner.tsx`  
Integration: `DashboardClient.tsx` → `AdjustmentBanner` wrapper (owns API calls)

---

### 11. RestraintCard

The brand's counter-intuitive moment — showing restraint as progress. Only shown when ≥ 2 sessions completed this week (D-009).

```
┌─────────────────────────────────────────────┐
│  HOW THIS WEEK WENT          3 / 5 sessions │
│                                             │
│  78%                                        │
│                                             │
│  of your runs were Zone 2 sessions.         │
│  That's why you're getting faster.          │
└─────────────────────────────────────────────┘
```

**Structure:**
- Background: `--card`, border: `1px solid --line`, radius: `var(--radius-lg)`, padding: `20px`
- Eyebrow row: `10px 700 --mute uppercase 0.08em tracking` left, meta `10px 400 --mute-2` right
- Percent: `44px 800 tabular-nums -1.5px tracking --ink` + `22px 600 --moss "%"`
- Body: `13px 400 --ink-2`, line-height 1.45 — supports `<strong>` for `--ink 600` emphasis

**Props:**
```tsx
label?: string          // default "How this week went"
percent: number         // 0–100
meta?: string           // e.g. "3 / 5 sessions" or "32 / 44km"
body: React.ReactNode   // supports <strong> for emphasis
```

**Gate rule (D-009):** Show only when `completedThisWeek.length >= 2`. Zone 2 percent derived from session types (easy/long/recovery/run), not Strava HR — works for all users.

Reference: `components/shared/RestraintCard.tsx`

---

### 12. PlanArc

Horizontal 32px strip showing plan weeks as bars. Compact plan progression visual.

```
16 weeks · base → build → peak      Wk 8 of 16
[████████░░░░░░░░░░░░░░░░░░░░░░░░]
 done    current future             deload=lighter
```

**Structure:**
- Label row: `10px 700 --mute uppercase 0.08em` left (total + phase label), `10px 700 --mute 0.04em` right ("Wk N of N")
- Bar strip: `32px` height, flex with `2px` gap, bars `align-items: flex-end`
- Each bar: `flex: 1`, `100%` height, `2px` radius

**Bar colour / opacity rules:**

| State | Colour | Opacity |
|---|---|---|
| Done | `--moss` | 0.7 |
| Done + deload | `--moss` | 0.2 |
| Current | `--moss` | 1.0 |
| Current | + `2px --moss-mid outline, 1px offset` | — |
| Race week | `--s-race` | 0.9 |
| Future | `--mute-2` | 0.35 |
| Future + deload | `--mute-2` | 0.15 |

**Props:**
```tsx
totalWeeks: number
currentWeek: number     // 1-indexed
doneWeeks: number       // weeks before currentWeek that are done
deloadWeeks?: number[]  // 1-indexed week numbers
raceWeek?: number       // 1-indexed
phaseLabel?: string     // e.g. "base → build → peak → taper"
```

Reference: `components/shared/PlanArc.tsx`

---

### 13. RPEScale

10-square filling effort selector. Used in post-session logging flow.

```
Effort (RPE)                      4 / 10
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│1 │2 │3 │4 │5 │6 │7 │8 │9 │10│
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
  ████ selected
```

**Structure:**
- Label row: `13px 600 --ink` "Effort (RPE)" + value display flex-between
  - Value set: `18px 800 --ink` number + `13px 500 --mute-2` "/ 10"
  - Value unset: `13px 400 --mute-2` "— / 10"
- Optional hint: `12px 400 --mute`, line-height 1.4, margin-bottom 10px
- Square row: 10 buttons, `flex: 1` each, `aspect-ratio: 1`, `6px` radius, `3px` gap

**Square state rules:**

| State | Background | Text | Border |
|---|---|---|---|
| Default (n > value) | `--bg-soft` | `--mute` | none |
| Filled (n < value) | `--ink` | `--bg` | none |
| Selected (n === value) | `--moss` | `--card` | `2px solid --moss-mid` |

**Props:**
```tsx
value: number | null
onChange: (value: number) => void
hint?: React.ReactNode
```

Reference: `components/shared/RPEScale.tsx`

---

### 14. Post-Log Reflect Sheet

Used after any session is logged or skipped. Highest-emotion moment — treat it as such.

```
┌─────────────────────────────────────────────┐
│ [✓]  Hard session logged.                   │
│      Don't follow it with more effort.      │
│ ─────────────────────────────────────────── │
│  How did that land?                         │
│  Effort and body state. That's all I need.  │
│                                             │
│  [RPEScale]                                 │
│                                             │
│  Body state                                 │
│  [Fresh] [Fine] [Heavy] [Wrecked]           │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ Hard session in the bank. Earn rest. │   │  ← fades in
│  └──────────────────────────────────────┘   │
│                                             │
│  [           DONE           ]               │  ← moss when response shown
└─────────────────────────────────────────────┘
```

Rules:
- Completion confirmation always shown at top
- RPEScale component used for effort input
- Zona voice response fades in (`opacity 0→1`, `translateY(6px)→0`, 350ms) after any selection
- CTA shifts ghost → solid `--moss` once response appears
- Skip always available — run is already saved
- Never auto-dismiss

Zona voice rules:
- One sentence only
- Session-type-aware: RPE 8 on easy = flag it; RPE 8 on intervals = endorse it
- Canonical response matrix: `getZonaReflectResponse()` in `DashboardClient.tsx`

---

### 15. Loading State

Skeleton shimmer only. No spinners. No progress percentages.

- Match exact shape of content being replaced
- Shimmer: CSS animation `--bg-soft → slightly lighter → back`
- Session card skeleton: same height as collapsed card, left accent bar included
- Never show partial data — skeleton or nothing

**The Generating Ceremony (canonical — `GeneratingCeremony.tsx`)**

Phases:
1. **Loading**: skeleton shimmer of 3 phase card placeholders. Copy cycles every 1.8s. Min duration: 1.8s (free) / 3.6s (paid).
2. **Revealing**: skeleton unmounts, phase cards draw in with 80ms stagger. Payoff line: *"There it is. Don't ruin it."* in `--moss`.
3. **Done**: calls `onRevealComplete` after 500ms.

No spinner. No percentage. The reveal is the payoff — not the wait.

---

### 16. AIMark

The canonical "this came from AI" glyph. Marks model-generated content; pulses while AI is in flight.

```
✦  THIS WEEK
   ↑
   AIMark — 4-point sparkle + small accent dot, top-right
```

**Visual anatomy:**
- 4-point sparkle (main element) + smaller secondary sparkle top-right
- Default size: `12px` inline; `10px` next to small eyebrow labels; `16px` on its own
- Default colour: `--moss`; pass `--warn` on coach-amber surfaces; pass the verdict colour for run feedback
- Working state: `ai-mark-pulse` keyframe — opacity `0.55 → 1` + scale `0.92 → 1.05`, 1.6s loop. Replaces the spinner pattern banned elsewhere.

**Props:**
```tsx
size?: number       // default 12
color?: string      // default 'var(--moss)'
working?: boolean   // default false — animate when AI is generating
label?: string      // aria-label override
```

**When to use:**
- Run feedback card eyebrow (post-Strava AI feedback text)
- Weekly report card eyebrow (Claude-generated headline/body/CTA)
- "WHY THIS SESSION" eyebrow when content comes from `session.coach_notes` (plan-enricher AI)
- Generating-state CTAs (`Generate report` button while in flight)
- GeneratingCeremony header during the loading phase

**When NOT to use (provenance honesty):**
- Rule-engine output (plan structure, session distances, HR zone calcs)
- Hand-authored copy (zone education sheet, brand strings, voice copy)
- DB-resident content (session-catalogue guidance fallback)
- Strava-recorded data (HR, distance, pace, elapsed time)
- The plan-coach note on Today screen (rule-derived from `getPlanCoachNote()`)

The mark is a claim about provenance, not aesthetics. Mark only what came from a model.

Reference: `components/shared/AIMark.tsx`. Single source of truth — never reimplement the glyph.

---

### 17. SectionLabel

Eyebrow label above a group of related rows. Used to name a category section in list-based screens (MeScreen, settings).

```
CAREFUL NOW                     ← uppercase, muted, 10px, 0.08em tracking
──────────────────────────────  ← optional top divider
[row]
[row]
```

**Rules:**
- Text: `10px 700 --mute uppercase 0.08em tracking`
- Padding: `0 16px`, margin-bottom `8px`
- No border on the label itself — the section content provides its own borders
- Use before groups of destructive or irreversible actions (account deletion, sign-out)
- Use before any grouping where the category isn't obvious from the rows alone

**Anatomy in MeScreen:**
```
[SectionLabel: Careful now]
  Sign out
  Delete account
```

Reference: `components/shared/SectionLabel.tsx` (if extracted) or inline in `DashboardClient.tsx`

---

## Screen Templates

### Today Screen

```
[ZONA wordmark · moss dot]

[Context row: phase · week · Xd out]
[Today, you run]
[56px hero: "10km," ink + "slowly." moss]

[AdjustmentBanner — if pending]
[CoachNoteBlock — plan note]

[DateStrip]

[SessionCard — today, with state]
[→ Log this session — moss CTA]
[→ Log manually — text link]

[RestraintCard — if ≥2 sessions done this week]
[Done this week — SessionCard list]

[Strava nudge text]
```

### Session Detail Screen

- Full screen, back arrow top-left (44px circle, `--bg-soft` bg)
- Eyebrow: day + week label (`10px 600 --mute uppercase`)
- Title: session name (`16px 700 --ink`)
- Session type chip right-aligned
- Card: `--card` bg, `--line` border, `--radius-lg`, 3px left accent in session colour
- Metric row: HR target, zone, distance, duration
- Description block: `14px 400 --ink-2`
- RPEScale (if complete)
- CoachNoteBlock variant="why" for "WHY THIS SESSION"
- Action pinned to bottom (or within scroll)

### Plan Overview Screen

```
[Your plan — 26px 800 left]    [Race: Xd out — 16px 700 right]

[PlanArc]

[Week summary bar: phase + done/total + km target]

[PlanCalendar — week list with session cards]
```

- PlanArc shows full training arc at a glance
- PlanCalendar owns the drag-reorder + tap-to-open interaction
- No separate progress bar or chart section

---

## HR Zone → Session Colour Coherence

**Design invariant**: zone colours match session type colours. Warm Slate values apply.

| Zone | Name | Token | Matching session type |
|---|---|---|---|
| 1 | Recovery | `--s-recov` | recovery |
| 2 | Aerobic | `--s-easy` | easy, long |
| 3 | Tempo | `--s-quality` | quality, tempo |
| 4 | Threshold | `--s-race` | race |
| 5 | VO₂ Max | `--s-inter` | intervals |

**Rules:**
- Zone colours must always use session type tokens (`--s-easy`, `--s-inter`, etc.) — never semantic tokens
- `--warn` is reserved for coaching warnings only — never for zones
- Never introduce a standalone zone colour that doesn't map to an existing session type token
- Session colour ownership lives exclusively in `lib/session-types.ts`

---

## Tier-Divergent Components

A component that renders differently for FREE vs PAID/TRIAL users must follow these rules:

1. **Single file, conditional render.** Never split into `FooFree.tsx` + `FooPaid.tsx`. One component, one `tier` prop, internal branching.
2. **Free is the baseline, paid is enrichment.** Free variant must be complete and lovable on its own — not a degraded fallback.
3. **Header comment is mandatory:**
   ```tsx
   // TIER-DIVERGENT — FREE: [brief description]
   //                  PAID: [brief description]
   ```
4. **No tier logic in child components.** Tier prop travels from route to top-level screen. Children receive pre-computed data.
5. **Graceful degradation only.** If paid enrichment fails, component falls back to free variant. Never empty state where a standard plan could show.

Canonical examples: `GeneratingCeremony.tsx`, `GeneratePlanScreen.tsx`

---

## What Not to Build

| Avoid | Use instead |
|---|---|
| Full card background in session colour | Left accent border + chip |
| Gradient backgrounds | Flat card with `--card` |
| Multiple box-shadows stacked | None or single `--line` border |
| Hardcoded hex in component files | CSS custom properties only |
| Space Grotesk, DM Mono, DM Sans | `var(--font-ui)` only |
| `#D4501A`, `#f5f2ee`, `#0B132B`, `#5BC0BE` | Warm Slate tokens |
| Icons everywhere | Text labels where space allows |
| Spinner loading states | Skeleton placeholders, or `<AIMark working />` for AI-in-flight |
| AIMark on rule-engine / hand-authored copy | Mark only model-generated content — provenance honesty |
| Alert/modal popups | Navigate to full screen |
| Button tap target < 44px | `width/height: 44px` or `minHeight: 44px` — iOS HIG minimum |
| Centred-only layouts | Left-aligned with consistent margin |
| Dark mode anything | Single light theme (ADR-008) |

---

## Prompt Template for UI Requests

```
Screen: [screen or component name]
Change: [what specifically is changing]
SLC:
  Simple — [one sentence: what this does and nothing else]
  Lovable — [what makes it feel good / which ui-patterns.md pattern applies]
  Complete — [states to handle: loading / empty / error / edge cases]
Trigger frontend-design skill.
```

Example:

```
Screen: RestraintCard in TodayScreen
Change: Show Zone 2 discipline percent derived from session types this week
SLC:
  Simple — single stat card, percent + one-sentence interpretation
  Lovable — large 44px number, moss % sign, Zona voice body copy
  Complete — hidden when <2 sessions completed, 100% edge case handled
Trigger frontend-design skill.
```
