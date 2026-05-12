# UI Patterns — Vetra Visual Language

**Reference aesthetic**: Runna · Planzy  
**Authority**: This document defines layout patterns, component anatomy, spacing, and typography rules for all Vetra screens. Read before building any new screen or component.

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
| Wordmark | `--font-ui` | 800 | 14px | VETRA nav wordmark |

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
│  COACH          [timestamp optional]        │
│                                             │
│  Keep it easy. Nose breathing the whole     │
│  way. If you can't talk, slow down.         │
└─────────────────────────────────────────────┘
```

**Structure:**
- Background: `--warn-bg`
- Radius: `14px`, padding: `16px 18px` (extra `8px` left padding when `aiGenerated`, to clear the rail)
- Eyebrow row:
  - When `aiGenerated`: a `<CoachByline color="warn" />` (Pattern 16b) — the byline carries authorship
  - Otherwise: `10px 700 --warn uppercase 0.14em tracking` label, optional timestamp suffix (`10px 400 --warn 0.65 opacity`)
- AI-provenance rail: a 3px `--warn` left rail at `left: 8px` when `aiGenerated` (matches the AI-card pattern)
- Body: `14px 400 --coach-ink` (default) or `13px 400 --coach-ink` (why variant)

**Props:**
```tsx
label?: string          // default "COACH" (only used when !aiGenerated)
timestamp?: string      // optional "6:12am"
children: React.ReactNode
variant?: 'default' | 'why'
aiGenerated?: boolean   // shows CoachByline + 3px warn rail when true
onChipClick?: () => void // when aiGenerated, makes the byline tap → Coach
```

**Variant rules:**
- `default` — used for plan-level coaching notes in TodayScreen, slightly larger body
- `why` — used in Session Detail "WHY THIS SESSION" section, slightly smaller body text

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
- Vetra voice response fades in (`opacity 0→1`, `translateY(6px)→0`, 350ms) after any selection
- CTA shifts ghost → solid `--moss` once response appears
- Skip always available — run is already saved
- Never auto-dismiss

Vetra voice rules:
- One sentence only
- Session-type-aware: RPE 8 on easy = flag it; RPE 8 on intervals = endorse it
- Canonical response matrix: `getReflectResponse()` in `DashboardClient.tsx`

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

**Where it lives in the product:** Almost every in-product use of AIMark now sits inside a `<CoachByline>` (Pattern 16b) — anchored to the Kit avatar's bottom-right corner in a small `--card`-coloured circle. Rendering AIMark standalone is reserved for non-byline contexts:
- Generating-state CTAs (`Generate report` button while in flight)
- GeneratingCeremony header during the loading phase
- Inline metric placeholders (skeleton row pulse on the analysis loading state)

For new AI-content cards, prefer `<CoachByline>` over a bare AIMark — the avatar anchors the glyph and reads as authorship rather than decoration.

**When NOT to use (provenance honesty):**
- Rule-engine output (plan structure, session distances, HR zone calcs)
- Hand-authored copy (zone education sheet, brand strings, voice copy)
- DB-resident content (session-catalogue guidance fallback)
- Strava-recorded data (HR, distance, pace, elapsed time)
- The plan-coach note on Today screen (rule-derived from `getPlanCoachNote()`)

The mark is a claim about provenance, not aesthetics. Mark only what came from a model.

Reference: `components/shared/AIMark.tsx`. Single source of truth — never reimplement the glyph.

---

### 16b. CoachByline

The canonical AI-coach authorship signal. A 22px Kit avatar with the AIMark sparkle anchored to its bottom-right, paired with a name + role line. Replaces the older `AICoachChip` pill — the chip read as a category tag, not as authorship. The byline gives provenance a face (same trick Granola, Notion AI, and Superhuman use).

```
[K✦] Kit                 ← 22px avatar (moss/warn gradient) + name 13px 700
     YOUR COACH          ← role line 10px 600 uppercase (default "YOUR COACH")
```

The AIMark sits in a small `--card`-coloured circle anchored to the avatar's bottom-right corner so it's identifiable at a glance, even pulsing during generation.

**Use** on every AI-generated content surface:
- Daily coach note (Today)
- Weekly report (Coach)
- Race readiness, Phase summary (Coach)
- Run feedback LLM card (Session detail)
- Plan adjustment (PendingAdjustmentBanner)
- `CoachNoteBlock` when `aiGenerated={true}` — replaces the eyebrow label
- Any new AI surface

**Colour variants:**

| Prop | Surface | Avatar gradient | Role-line colour |
|---|---|---|---|
| `color="moss"` (default) | `--card`, `--bg-soft` | `--moss` → `#5A7C5A` | `var(--moss)` |
| `color="warn"` | `--warn-bg` | `--warn` → `#9A6F2A` | `var(--warn)` |

**Rules:**
- Always moss on standard card surfaces — consistent Kit identity regardless of card accent colour
- Warn variant only on `--warn-bg` surfaces to avoid colour clash
- Working state pulses the avatar's sparkle and adds " · thinking" to the role line — replaces the spinner pattern banned by ui-patterns.md
- Use the `role` prop to convey the topic of the surface (e.g. `role="Race readiness"`, `role="Read of your run"`, `role="This week"`). Default is "YOUR COACH"
- Do NOT use on rule-engine output, race projections, hand-authored copy, or Strava data (same rule as AIMark)
- Provide `onClick={() => setScreen('coach')}` on every surface that isn't the Coach screen itself — the byline is the user's tap-target back to Kit's home

**Props:**
```tsx
working?: boolean          // default false — "· thinking" + pulsing sparkle
color?:   'moss' | 'warn'  // default 'moss'
role?:    string           // default 'YOUR COACH' — short topic label, auto-uppercased
onClick?: () => void       // when set, byline becomes a tappable button
title?:   string           // tooltip on hover/long-press
```

**Companion: AI-card left rail.** Cards that contain LLM output should pair the byline with a 3px left rail in the matching accent colour (moss on `--card`, warn on `--warn-bg`). The rail is an absolutely-positioned span at `left: 8px, top: paddingY, bottom: paddingY, width: 3px`. Linear/Arc-style accent — cheapest scalable "this card is coached" signal. Already baked into `CoachNoteBlock` and `PendingAdjustmentBanner`; replicate inline on bespoke AI cards (e.g. the run-feedback split).

Reference: `components/shared/CoachByline.tsx`

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

### 18. SpecialCoachCard

Timed AI coaching moments that appear on the Coach screen in specific windows. Two variants share the same anatomy but carry different visual language to distinguish them from the persistent weekly report card.

**Variants:**

| Variant | Trigger | Surface | Left accent | Eyebrow colour |
|---|---|---|---|---|
| Phase Summary (R28) | First week of a new plan phase | `--bg-soft` | `3px var(--moss)` | `--moss` |
| Race Readiness (R29) | `daysToRace ∈ [0, 14]` | `--card` | `3px var(--s-race)` | `--s-race` |

**Mutual exclusion:** R29 always suppresses R28. Both can never appear simultaneously.

**Anatomy (both variants):**
```
[3px left accent border]
  [<CoachByline role="Phase complete" /> or <CoachByline role="Race readiness" /> · counter right-aligned (days to go on Race Readiness only)]
  ─────────────────────────────────────
  [2–3 sentence AI coaching text · 15px 400 --ink · 1.65 line-height]
```

**Loading state:** Skeleton shimmer — three lines at 85% / 100% / 70% width, background `rgba(accent, 0.12)`. `<CoachByline working />` pulses the avatar's sparkle in the eyebrow row.

**Positioning on Coach screen:** Inserted directly above the weekly report amber card, below the 2×2 stats grid. No vertical gap beyond the parent `gap: 12px`.

**Generation flow:**
1. CoachScreen mounts → `useEffect` fires once
2. If condition is met and no cached content passed from DashboardClient → calls `/api/race-readiness` or `/api/phase-summary`
3. API routes are idempotent (PK on `user_id + race_date` / `user_id + phase_ended + transition_week_n`)
4. Content stored in `race_readiness_notes` / `phase_summaries` tables
5. Subsequent screen opens return cached content instantly (no AI call)

**Gating:** PAID / TRIAL (activity_intelligence gate). Free users: card is not shown and no API call is made (CoachTeaser component shown instead).

**CoachByline on these cards:**
- Both variants use `<CoachByline color="moss" role="…" />` — byline always stays moss on `--card` / `--bg-soft` surfaces (Pattern 16b)
- The *card-level left accent* (not the byline) carries the variant theme: `--moss` for Phase Summary, `--s-race` for Race Readiness
- The byline's `role` prop names the topic (`"Phase complete"` / `"Race readiness"`) — replaces the older eyebrow label

**Rules:**
- Never show both variants simultaneously
- Neither variant shows a "locked" shell for free users — timed moments with no user-accessible retry
- `CoachByline` is always present (provenance honesty — model output)
- No refresh button — the note is generated once per phase transition / race date and cached

---

### 19. Stats 2×2 Grid

Four metric cells in a 2-column grid. Used on the Coach screen for Zone discipline, Load ratio, Sessions, and Weeks left.

```
┌─────────────────┬─────────────────┐
│  ZONE DISC. ⓘ  │  LOAD RATIO ⓘ  │
│  84%            │  1.12x          │
│  Good week      │  Steady build   │
├─────────────────┼─────────────────┤
│  SESSIONS       │  WEEKS LEFT     │
│  3/5            │  8              │
│  On track       │  Build phase    │
└─────────────────┴─────────────────┘
```

**Structure:**
- Grid: `display: grid`, `gridTemplateColumns: '1fr 1fr'`, `gap: 8px`
- Each cell: `--card` background, `1px solid --line` border, `var(--radius-lg)`, `16px` padding
- Eyebrow: `10px 700 --mute uppercase 0.08em tracking`
- Interactive cells (have a drill-down sheet): rendered as `<button>`, eyebrow includes `ⓘ` marker at `11px` in `--moss`
- Static cells: rendered as `<div>`, no `ⓘ` marker
- Value: `28px 800 tabular-nums --ink` — distinct from Pattern 4 (Stat Row 24px) because the 2×2 grid has square cells not horizontal strips
- Sub-label: `11px 500`, colour reflects verdict: `--moss` (good), `--ink-2` (neutral), `--warn` (caution)

**Interactive cells tap to a slide-up sheet** with:
- Drag indicator: `36×4px` pill, `--line`, `margin: 6px auto 18px`
- Sheet header: eyebrow + 24px/600 title + current value in verdict colour
- Body: 3 paragraphs explaining the metric, `15px 400 --ink-2`, `1.55` line-height
- Sticky footer: full-width close button, `--bg-soft` background, `--ink` text

**Keyframes:** `vetra-fade-in` (backdrop) and `vetra-slide-up` (panel) are defined once in `globals.css` — never inline in JSX.

**Rule:** Only Zone discipline and Load ratio are interactive. Sessions and Weeks left are static — same card style, no button, no ⓘ.

---

### 20. Action List Card

A grouped list of tappable rows inside a single card. Used in MeScreen for plan actions, display prefs, race prep, training intelligence, and the Careful Now section.

```
┌─────────────────────────────────────────┐
│  Row label                          [›] │  ← 13px 500 --ink
│  Supporting detail                      │  ← 12px 400 --mute
├─────────────────────────────────────────┤
│  Row label                          [›] │
│  Supporting detail                      │
└─────────────────────────────────────────┘
```

**Structure:**
- Container: `--card` background, `var(--radius-lg)` radius, `1px solid --line` border, `overflow: hidden`
- Row padding: `14px 16px`
- Row divider: `1px solid --line` — never `0.5px`
- Primary label: `13px 500 --ink`, `var(--font-ui)`
- Supporting detail: `12px 400 --mute`, `var(--font-ui)`
- Chevron: `--mute` colour, `marginLeft: 12px`, right-aligned

**Toggle variant** (for boolean settings like Auto-adjust):
- Row has no chevron — replaced by a `44×26px` pill toggle
- Toggle on: `--moss` background; off: `--line` background
- Thumb: `20×20px` white circle, `3px` inset, transitions with `left 0.2s`

**Segmented selector variant** (for km/mi, distance/duration):
- Small pill buttons, `10px` radius, `5px 12px` padding
- Active: `1px solid --moss`, `--moss-soft` background, `--moss` text
- Inactive: `1px solid --line`, transparent background, `--mute` text

**Warning card variant** (e.g. HR not configured):
- `--warn-bg` background, `1px solid --line` border, `10px` radius
- Dot: `6px` circle, `--warn` fill
- Text: `12px 400 --coach-ink` — warm dark brown on amber, never `--warn` colour on `--warn-bg`

**Rules:**
- Always `var(--card)` not `var(--card-bg)` — banned alias
- Always `1px` borders not `0.5px`
- Always `var(--radius-lg)` not hardcoded `12px`
- Nested toggle or selector buttons may use `10px` radius (pill shape) — distinct from card container

---

## Cross-Screen Consistency Rules

Every screen must honour these invariants before shipping. Check against this list when auditing.

| Signal | Canonical value | Common violation |
|--------|----------------|-----------------|
| ScreenHeader font | `26px 800 --font-ui --ink` | 22px/500 or `--font-brand` |
| Content horizontal padding | `0 16px` | `0 12px` in Me/Strava screens |
| Card border | `1px solid var(--line)` | `0.5px solid var(--border-col)` |
| Card radius | `var(--radius-lg)` | Hardcoded `12px` |
| Card background | `var(--card)` | `var(--card-bg)` |
| Primary text | `var(--ink)` | `var(--text-primary)` |
| Secondary text | `var(--ink-2)` | `var(--text-secondary)` |
| Muted text | `var(--mute)` | `var(--text-muted)` |
| Primary accent | `var(--moss)` | `var(--accent)` or `var(--teal)` |
| Active toggle | `var(--moss)` background | `var(--accent)` |
| Inactive toggle | `var(--line)` background | `var(--border-col)` |
| Session type ownership | `lib/session-types.ts` token | Hardcoded hex or `--session-*` alias |
| AI provenance signal | `<CoachByline>` — moss on card/bg-soft, warn on warn-bg, pair with 3px left rail on AI cards | Bare `AIMark` without byline; old `AICoachChip` pill |
| Eyebrow / section label | `10px 700 --mute uppercase 0.08em` | Varies |
| Coach amber surface text | `var(--coach-ink)` | `var(--warn)` or `var(--amber)` |
| Slide-up sheet keyframes | Defined once in `globals.css` | Inline `<style>` in JSX |

**When you change a shared pattern**, update the relevant entry in this table AND the corresponding Pattern section above in the same commit. Patterns are the reference — not a description of what happens to exist.

---

## Screen Templates

### Today Screen

```
[VETRA wordmark · moss dot]

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
  Lovable — large 44px number, moss % sign, Vetra voice body copy
  Complete — hidden when <2 sessions completed, 100% edge case handled
Trigger frontend-design skill.
```
