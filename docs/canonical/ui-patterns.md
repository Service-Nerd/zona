# UI Patterns — Zonna Visual Language

**Reference aesthetic**: Runna · Planzy  
**Authority**: This document defines layout patterns, component anatomy, spacing, and typography rules for all Zonna screens. Read before building any new screen or component.

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
| Wordmark | `--font-ui` | 800 | 14px | ZONNA nav wordmark |

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

The brand's counter-intuitive moment — showing restraint as progress. **Status (ZONE-VIS-02 — May 2026):** the discipline NUMBER moved off Today and now lives on Coach. Today retains the discipline RHETORIC as a single-line moss voice anchor ("Hold the zone.") — see § Voice Anchor Strip below — while the full retrospective metric belongs where retrospection happens. The RestraintCard component itself is not currently rendered; the LedgerCard (LEDGER-01) borrows its visual anatomy, and the share OG card (`app/api/og/weekly-zone-card/route.tsx`) borrows its hierarchy. The component is preserved for those echoes and for any future surface that wants the full card form.

The original "permanent slot on Today / never silently hidden" doctrine is **superseded**. The Coach screen's 2×2 stat grid already includes a Zone Discipline tile (`%` + verdict sub) plus the ZoneRings component (Pattern 22) for the per-zone breakdown — the metric is now MORE visible on Coach than it was on Today, just gated to the right screen for its job.

**Live (paid/trial + ≥1 analysed run):**

```
┌─────────────────────────────────────────────┐
│  ZONE DISCIPLINE            across 3 runs   │
│                                             │
│  84%                                        │
│                                             │
│  of your time was spent in Zone 2.          │
│  Easy was easy. That's the work.            │
└─────────────────────────────────────────────┘
```

**Pending (paid/trial pre-data):**

```
┌─────────────────────────────────────────────┐
│  ZONE DISCIPLINE                            │
│                                             │
│  —%                       (muted)           │
│                                             │
│  Your first score lands after a couple of   │
│  analysed runs. Kit's watching.             │
└─────────────────────────────────────────────┘
```

**Locked (free user):**

```
┌─────────────────────────────────────────────┐
│  ZONE DISCIPLINE             (--bg-soft)    │
│                                             │
│  —%                       (muted, 0.4 op)   │
│                                             │
│  The score that names the medium-hard       │
│  middle. Connect Strava and upgrade to      │
│  start scoring.                             │
│                                             │
│  Unlock score →           (moss text link)  │
└─────────────────────────────────────────────┘
```

**Structure (live + pending):**
- Background: `--card`, border: `1px solid --line`, radius: `var(--radius-lg)`, padding: `20px`
- Eyebrow row: `10px 700 --mute uppercase 0.08em tracking` left, meta `10px 400 --mute-2` right (live only)
- Percent: `44px 800 tabular-nums -1.5px tracking` — `--ink` (live) or `--mute` 0.5 opacity (pending)
- Pct sign: `22px 600` — `--moss` (live) or `--mute` 0.5 opacity (pending)
- Body: `13px 400 --ink-2`, line-height 1.45 — supports `<strong>` for `--ink 600` emphasis

**Structure (locked):**
- Background: `--bg-soft` (signals locked), border + radius + padding as above
- Eyebrow row: same as live (no meta)
- Percent + pct sign: muted `—%` at 0.4 opacity (matches `RestraintCardSkeleton`)
- Body: `13px 400 --mute`, line-height 1.55
- CTA: `12px 600 --moss` text button "Unlock score →" — no background, no border, single tap target

**Data source:**
- Live percent is **HR-derived** from `run_analysis.hr_in_zone_pct` across the week's completed analysed runs — paid feature (requires Strava + run analysis pipeline).
- Pending state is reached when the paid feature is on but the user has no analysed runs yet (early trial, no Strava connected, or zero completions).
- Locked state is reached when the user is on the free tier.

**Props (discriminated union):**
```tsx
// Live (default — state omitted ⇒ live)
{ state?: 'live'; label?: string; percent: number; meta?: string; body: React.ReactNode }
// Pending
{ state: 'pending'; label?: string }
// Locked
{ state: 'locked'; label?: string; onUpgrade?: () => void }
```

`label` defaults to `'Zone discipline'` across all states.

**Tier-divergent rules:** The Today-screen wrapper picks state from `hasPaidAccess` and `zoneDisciplinePercent`:
- `!hasPaidAccess` → `locked`
- `!runAnalysisReady && completedThisWeek.length > 0 && zoneDisciplinePercent === null` → `RestraintCardSkeleton` (existing loading shell)
- `zoneDisciplinePercent === null` → `pending`
- otherwise → `live`

Tier prop travels from `DashboardClient` → `TodayScreen` → the wrapper around `RestraintCard`. RestraintCard itself is data-driven by `state` — no tier logic inside the component.

Reference: `components/shared/RestraintCard.tsx`. Integration: `DashboardClient.tsx` → `TodayScreen` (ZONE-VIS-01 block).

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
- Zonna voice response fades in (`opacity 0→1`, `translateY(6px)→0`, 350ms) after any selection
- CTA shifts ghost → solid `--moss` once response appears
- Skip always available — run is already saved
- Never auto-dismiss

Zonna voice rules:
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

### 17a. TD-CLOSE (the day's close)

When today's session is complete, skipped, or is a rest day, Today renders a small **calm closing read** above the session card. The brand's anti-cheerleading thesis is most visible here: restraint as reward, no confetti, no streak burn, no celebration.

**Three voice lines (locked):**

| State | Eyebrow | Headline | Metric |
|---|---|---|---|
| Done (complete) | `Today's done` | "That's the day. Nothing to prove now." | distance done (km / mi) |
| Rest day | `Rest day` | "Do nothing. It helps." | — |
| Skipped | `Benched` | "Benched. Tomorrow's still the plan." | — |

**Anatomy:**
- `--card` bg, `1px --line`, `--radius-lg`, **3px `--moss` left rail** at `left: 8px` (completion accent, not warn)
- Eyebrow: `10px 700 --moss uppercase, letterSpacing 0.12em`
- Headline: `17px 600 --ink, lineHeight 1.3`
- Metric (done only): `13px 500 --ink-2, tabular-nums` — distance done in the user's preferred units
- Sits above the session card, replacing PreRunBandCard which self-hides when today is done

**Tier:** FREE. The closing read is brand infrastructure — habit-loop reward cue — and can't be paywalled credibly.

**What this does NOT do:**
- No confetti, no streak burn, no celebration (anti-gamification line — Wood)
- No motivation copy ("Great job today!" — forbidden by `CLAUDE.md` voice table)
- No re-showing the prescription post-log — the session card already flips to its done state; this read is the one-line acknowledgement above it

Reference: inline render in `TodayScreen` selectedSession render block.

---

### 17b. TD-READY hero (readiness-led permission)

When recovery signals (RHR / HRV / sleep) fire on a quality / long / intervals / tempo day, the engine writes a `plan_adjustments` row with `trigger_type = 'readiness_signal'`. Instead of the generic `AdjustmentBanner` Confirm/Revert pattern, that row renders as a **TD-READY permission pill** above today's session card. Permission > score. "Ease the session" gives the runner permission to back off; "Run it anyway →" stays equally visible (never a coercive gate).

**Anatomy:**
- `--card` bg, `1px --line`, `--radius-lg`, **3px `--warn` left rail** at `left: 8px` (coaching-caution rail, never red — INV-DS-005)
- Eyebrow `Readiness · easing today` + reason chips: `RHR up · HRV down · Short sleep`
- Permission line: 15px 400 `--ink`, line-height 1.55 — this is the adjustment's `summary`, already in Kit voice from `buildReadinessAdjustment`
- Two buttons: primary `--moss` "Ease the session" (= confirm API), secondary text "Run it anyway →" (= revert API)
- **No AIMark** — rule-derived (CoachingPrinciples §59), not model output (Pattern 16 provenance honesty)

**Stacking against PreRunBandCard (Decision 2026-06-19):**
PreRunBandCard self-hides when a readiness-signal pending adjustment exists. Same hero space, different jobs — readiness wins on a cooked morning because permission > confirmation. PreRunBandCard returns to normal once the user eases or runs anyway.

**Tier:** PAID (the underlying `/api/pre-session-readiness` route is gated; free users never see a pending readiness row).

**Eligibility:** today's session type ∈ `{quality, long, intervals, tempo}`. Easy / recovery / rest never trigger — an easy day doesn't need easing.

Reference: `function TdReadyHero` in `app/dashboard/DashboardClient.tsx`. Engine: `lib/coaching/planAdjustment.ts → buildReadinessAdjustment`. Thresholds: `GENERATION_CONFIG.READINESS`.

---

### 18a. Coach screen composition (CO-ONE)

The Coach screen carries **exactly one Kit voice** — a single authored read at the top, single `CoachByline` + `AIMark`. Everything below is **unvoiced evidence**: rings, stats, trends, ledger.

**The one read — priority assembly (top of Coach):**

| Priority | Signal | Source | Folds in as |
|---|---|---|---|
| 1 | Race window (`daysToRace ∈ [0, 14]`) | `/api/race-readiness` | Leads: "Race in {n} days." + race-readiness content |
| 2 | Phase change (suppressed by race) | `/api/phase-summary` | Leads if no race: "You've crossed into a new phase." + phase content |
| 3 | Zone drift (suppressed by race) | `zoneDriftPattern` | Body sentence: "{count} of your last {total} easy runs crept above Zone 2." |
| 4 | Trend signal | `/api/coaching/trend` with `hrIsTrending` | Body sentence: "Easy is easier than it was — {earlierHr} down to {nowHr} since {earlierMonth}." |
| 5 | Base synthesis | `/api/weekly-report` | Default headline + body + italic cta (action line) |

**Anatomy:**
- `--card` bg, `1px --line`, `--radius-lg`, `3px --moss` left rail at `left: 8px`, padding `18px 20px 18px 22px`
- ONE `<CoachByline color="moss" role="This week" working={isLoading} />` at top
- W{n}/{total} counter right-aligned in eyebrow
- Headline (17px 600), body (13px 400 line-height 1.7), italic action line
- "Generate / Refresh report" button + `ShareWeekButton` attached
- Loading: 3 shimmer lines at 85% / 100% / 70%, `rgba(107,142,107,0.12)`

**Empty state — X-FIRSTRUN state-aware (no analysed runs):**
- Dimmed Kit identity (avatar + name + eyebrow, opacity ~0.45)
- **NO AIMark** — empty-state line is hand-authored, not model output (Pattern 16 provenance honesty)
- The body line + CTA branch on which signal is actually missing — the empty state teaches the ONE next action instead of a generic "log a run":

| State | Detected when | Headline | Body | CTA button |
|---|---|---|---|---|
| **no-source** | no Strava token AND no Apple Health connection | "Nothing to coach from yet." | "Connect Apple Health or Strava so I can see your runs. I keep quiet until I have something honest to say." | "Connect a source →" → Profile |
| **no-runs** | source connected but `runs.length === 0` | "Waiting on your first run." | "Go log a session — even an easy one. Once I see a run with heart rate, I can say something useful." | none (action is real-world) |
| **no-hr** | runs exist but RHR or MaxHR missing | "One more thing." | "Set your resting and max heart rate. Without those, the zone targets are guesses." | "Set heart rate →" → Benchmark |
| **last-week** | weekly report exists for previous week | "Last week's report is below." | "Generate a report to see how this week is tracking." | "Generate report" |

The CTA button replaces the "Generate report" button when present — no generating from no data. Auto-resolves as data lands (the read re-evaluates on every render against the current user state).

**Evidence below — unvoiced, fixed order:**
1. ZoneRings (Pattern 22) — unchanged
2. Stats 2×2 (Pattern 19) — Zone discipline · Load ratio · Sessions · Weeks left, with info sheets preserved
3. LedgerCard (Pattern 11) — Weeks within the lines, unchanged
4. TrendCards (Pattern 29, `glossless`) — numbers only, AI gloss + byline stripped on Coach

**Dismissal:** v1 has no dismissal surface (one Kit read, repetition is signal). The "Manage what Kit watches" sheet is a Phase 2 backlog item gated on real user mute requests. `zone_drift_dismissed_at` / `benchmark_recal_dismissed_at` columns remain in schema, currently unread.

**Replaces:** Kit identity card + first-open coach intro + standalone weekly report card + Pattern 18 SpecialCoachCard (Race Readiness, Phase Summary) + standalone zone-drift card. All those surfaces' Kit bylines collapsed into the one read.

---

### 18. SpecialCoachCard

> **SUPERSEDED by CO-ONE (2026-06-19).** Phase Summary and Race Readiness content is no longer rendered as standalone cards on Coach. Both fold into the **one consolidated Kit read** at the top of CoachScreen — race-readiness content leads the read when in race window, phase-summary content leads when a phase just changed. The generation flow, idempotent storage, and API routes are unchanged; only the rendering surface is consolidated. The variant table below documents the legacy two-card layout for historical reference.

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

**Keyframes:** `vetra-fade-in` (backdrop) and `vetra-slide-up` (panel) are defined once in `globals.css` — never inline in JSX. (Keyframe names retained from a prior rebrand pending CSS-token rename — backlog BRAND-06.)

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

### 21. ZoneBar

The canonical visual for "which zone is this session in." 5 segments in a row, one filled in zone colour. Highest information-per-pixel of any chart on the session surfaces — at a glance, the user sees both the zone they're in AND its position in the 5-zone arc. Anchors the "Hold the zone" brand promise visually.

```
[─][▓▓▓][─][─][─]        ← Today session card (compact, no labels)
 1   2   3   4   5

[─][▓▓▓][─][─][─]        ← Session Detail prescription card (labelled)
 1   2   3   4   5       ← active label in zone colour, others --mute
```

**Structure:**
- Container: optional outer wrapper styled by caller
- Bar row: `display: flex`, `gap: 3px`
- Segments: `flex: 1` each, `borderRadius: 2px`
- Active segment: filled with zone colour
- Inactive segments: `var(--bg-soft)`
- Optional labels row: `flex: 1` cells, `9px 600`, `0.06em letter-spacing`, centred, active label in zone colour

**Variants:**

| Surface | Height | Labels | Notes |
|---|---|---|---|
| Today session card | `4px` | off | Glance-only — labels would clutter |
| Session Detail prescription | `5px` | on | Prescription is the focal point; labels earn their space |
| Post-plan zone intro | covered by 5-zone list (Pattern 21 not used) | — | Intro uses the full zone-row pattern with HR ranges |

**Zone → colour mapping** (ui-patterns.md § HR Zone → Session Colour Coherence):

| Zone | Token | Session types |
|---|---|---|
| 1 | `--s-recov` | recovery |
| 2 | `--s-easy` | easy, run, long |
| 3 | `--s-quality` | quality, tempo |
| 4 | `--s-race` | race |
| 5 | `--s-inter` | intervals, hard |

**Helpers** (from `components/shared/ZoneBar.tsx`):
- `zoneNumberForType(type): Zone | null` — maps session.type → 1–5. Returns null for rest / strength / cross-train. Distinct from `zoneForSessionType` in `lib/coaching/zoneRules.ts` which returns a `ZoneBand` object grouping 4+5 — the visual bar wants 5 distinct segments.
- `zoneShortName(zone): string` — short label for prescription card ("aerobic", "tempo", "threshold", "VO₂ max").

**Props:**
```tsx
activeZone: 1 | 2 | 3 | 4 | 5
height?: number       // default 4 (Today); 5 on Session Detail
showLabels?: boolean  // default false; true on Session Detail
style?: React.CSSProperties
```

**Rules:**
- Never render when session has no zone (rest / strength / cross-train) — caller checks `zoneNumberForType()` first
- Active label colour MUST match the segment colour — single token per zone
- Don't add a 6th segment, a duration overlay, or any other decoration — the value is in the constraint
- The bar is a *visual aid*, not a measurement. For HR ranges, use the prescription card's HR display line.

Reference: `components/shared/ZoneBar.tsx`. Single source of truth.

---

### 22. WeekStripCard

Compressed weekly summary used on the Plan screen for past weeks (when expanded) and distant-future weeks (≥2 weeks ahead). 7 status dots in a single row replace the full WeekCard's day list. Lets a 16-week plan read as an arc instead of a wall of rows.

```
┌─────────────────────────────────────────────┐
│ W10 · Apr 28 – May 4 · peak begins   52km  │
│  M    T    W    T    F    S    S            │
│  —    ●    ●    ●    —    ●    ●            │
└─────────────────────────────────────────────┘
```

**Structure:**
- Container: `--card` bg, `1px solid --line` border, `var(--radius-lg)` radius, `14px 16px` padding
- Race-week variant: `borderLeft: 3px solid var(--s-race)` (parallels WeekCard race accent)
- Past variant: `opacity: 0.65` (parallels WeekCard past treatment)
- Header row: week label `12px 600 --ink-2` left, total km `14px 700 --ink-2 tabular-nums` right
- Status dots row: `display: flex, justify-between, gap: 4px`. Each day cell flex-1, column layout with `D` initial above + dot
- Day initial: `9px 600 --mute uppercase 0.06em`

**Dot vocabulary:**

| State | Visual |
|---|---|
| Complete | `8px` filled `--moss` circle |
| Future session | `8px` outlined `--mute-2` circle |
| Skipped | `8px` dashed `--mute` circle, opacity 0.6 |
| Race day | `10px` filled `--s-race` circle (slightly bigger to read as the climax) |
| Rest / empty | `6px × 1.5px` dash `--mute-2`, opacity 0.5 |
| Past + future-not-done | `8px` filled `--mute-2` circle, opacity 0.5 (signals "this slot existed and is now gone") |

**Race-week footer (optional):**
- Renders only when `isRace` is true
- `10px 700 --s-race uppercase 0.08em` — formatted as `weekday, day month` (e.g. "Sun 5 May · Marathon des Sables")
- The actual race date is derived from the last race-typed session in the week (typically Sunday)

**When to use:**
- Past weeks in `Plan` screen's PlanCalendar after the user expands "Load N past weeks"
- "Later" weeks (≥3 weeks ahead) — keeps the current + next week as full WeekCards, compresses the rest
- NOT used for the current or next week — those carry the move/swap interaction and need the full WeekCard

**Later-week tap-to-expand (PLAN-STRIP-EXPAND, shipped 2026-05-30):**
- Later-week strips render a `⌄` chevron in the header when `onTap` is provided and become tappable
- Tapping replaces the strip with a full `WeekCard` (full day rows, move/swap interaction enabled) preceded by a single brand-restraint eyebrow `LATER — STILL FLEXIBLE`
- Single-week expansion at a time — state `expandedLaterWeek: number | null` held in `PlanCalendar`
- Tapping the eyebrow collapses; navigating away resets (state is component-local)
- Past-week strips remain read-only (`onTap` is never passed) — the chevron is the affordance, and read-only past data has no use for it
- Motion: `vetra-fade-in 0.18s ease-out` on the expanded wrapper; no spinner, no height-morph

Reference: `components/training/PlanCalendar.tsx` → `WeekStripCard`.

---

### 23. PlanSectionLabel

Group header between week clusters on the Plan screen (`Past / Now / Next / Later`). Names the user's position in the plan arc explicitly so the calendar reads as a story rather than a flat list.

```
NOW                                    7 weeks    ← right-side count optional
```

**Structure:**
- Wrapper: `display: flex, justify-between, baseline`, `padding: 0 4px`, `margin-top: 18px`
- Label: `11px 700 --mute uppercase 0.12em` (slightly louder than the generic SectionLabel at 10px — these headers carry more weight on the Plan screen)
- Optional right-side count: `10px --mute 0.04em` — shown only on "Later" to signal how many weeks the strip cards cover

**Rules:**
- Only used on the Plan screen — for cross-screen eyebrow / category labels, use Pattern 17 (SectionLabel)
- Always placed *between* week-card groups, never above the first card
- The Past header only renders when past weeks are expanded

Reference: `components/training/PlanCalendar.tsx` → `PlanSectionLabel`.

---

### 24. Plan Voice Card (slim variant of CoachNoteBlock)

Inline this-week coaching surface on the Plan screen. Sibling to `PlanCoachingCard` (Coach screen) — both share the same derivation helpers (`buildWeekVoiceContext`, `getWeekVoiceHeadline`, `getWeekVoiceItems` in `DashboardClient.tsx`) but render differently for their context.

```
┌─────────────────────────────────────────────┐
│ ▌ THIS WEEK                            BUILD │
│   Quality and long run this week. Hard stuff │
│   first, long stuff rested.                 │
│   Run the quality session when fresh — not  │
│   back-to-back with another hard day.       │
│   The long run should be Zone 2 only.       │
└─────────────────────────────────────────────┘
```

**Structure:**
- `--card` bg, `1px solid --line` border, `var(--radius-lg)` radius
- 3px `--moss` left rail (coaching-surface signal) — positioned at `left: 8px`, vertical inset matches padding
- Padding: `14px 16px 14px 19px` (extra left padding to clear the rail)
- Eyebrow row: `10px 700 --mute uppercase 0.08em` "THIS WEEK" left, phase chip `10px 700 --moss uppercase 0.08em` right (e.g. "BUILD")
- Headline: `15px 600 --ink -0.01em` line-height 1.4
- Items: `12px 400 --ink-2` line-height 1.55, gap 6px between items
- Max 2 items on this surface (Coach screen's `PlanCoachingCard` shows 3)

**Provenance rule (critical) — tier-divergent (PLAN-VOICE-AI, shipped 2026-05-20):**

| Tier | Source | Eyebrow |
|---|---|---|
| Free | Rule-engine (`buildWeekVoiceContext` + `getWeekVoiceHeadline` + `getWeekVoiceItems`) | "THIS WEEK" label — no byline (provenance honesty per §16/§16b) |
| Trial / Paid (ready) | AI via `POST /api/plan-weekly-note` (Haiku, cached per `user_id × week_n`) | `<CoachByline color="moss" role="This week" onClick={→ Coach} />` |
| Trial / Paid (loading) | Skeleton placeholder lines matching final shape (no reflow) | `<CoachByline color="moss" role="This week" working onClick={→ Coach} />` — the pulsing sparkle replaces any spinner |
| Trial / Paid (failure) | Silent fallback to rule-engine (ADR-006) | Same as Free row |

The 3px moss left rail is the **canonical AI-card rail** (Pattern 16b) for paid users, and a coaching-surface accent for free users — same colour token either way, single visual rule across tiers. Continuity per AI-DEPTH-04/10: the most recent prior weekly note feeds the prompt with the "reference at most once when this week tracks against it" rule. Cache is invalidated en bloc on any plan save (`lib/plan.ts → savePlanForUser`) so a regenerated plan never narrates sessions that no longer exist; the next Plan-screen view regenerates against the new session shape.

**Rules:**
- Render only when there's a current week in the plan (skip if `getCurrentWeekIndex` doesn't resolve)
- The headline + items come from the *current* week — not next week, not whichever week is in view via the Plan screen's date strip

Reference: `app/dashboard/DashboardClient.tsx` → `PlanScreen` (inline JSX; not extracted to its own component because it depends on `Plan` + `Week` shapes that other Plan-screen components also derive locally).

---

### 24b. PlanIntroCard — free "why this plan" intro (CA-01)

The free-tier counterpart to the per-week Plan Voice Card (§24). A plan-*level* one-line intro in Kit's voice, generated once on a free user's **first plan** (the "wedge moment" fix — otherwise free users get zero AI voice). Distinct from the paid `coach_intro` (2–3 sentences + confidence); the two never co-exist on a plan.

```
┌─────────────────────────────────────────────┐
│ ▌ [K✦] Kit                                   │  ← 3px moss rail + CoachByline
│        WHY THIS PLAN                         │
│   Twelve weeks to your 10K. The work is in   │
│   holding your easy days easy — that's where │
│   the speed actually comes from.             │
└─────────────────────────────────────────────┘
```

**Structure:** identical shell to §24 — `--card` bg, `1px --line` border, `--radius-lg`, 3px `--moss` left rail at `left: 8px`, padding `14px 16px 14px 19px`. Eyebrow is always `<CoachByline color="moss" role="Why this plan" />` (model output → byline required). Body: `14px 400 --ink-2`, line-height 1.6.

**Provenance:** always genuine model output (`meta.plan_intro`, Haiku). Never render rule-engine or hand-authored copy through this card.

**Where it renders:** the generation preview (`GeneratePlanScreen`) and the top of the saved Plan screen (`DashboardClient → PlanScreen`, above the §24 "This week" card). Single field, two read sites; persists in `meta.plan_intro` across save/reload.

**Source:** the field is set in `app/api/generate-plan/route.ts` (free branch, first-plan only) via `lib/plan/freeIntro.ts` — **not** the enricher. Silent fallback (ADR-006): on any AI failure the field is simply absent and the card doesn't render.

Reference: `components/shared/PlanIntroCard.tsx`

---

### 25. ZoneRings

Brand-mark-as-data-display. The four concentric rings of the Zonna logo each represent one HR zone bucket for the week — Z1 outer through Z4-5 inner — arc-filled to the % time the runner spent in that zone. The moss centre dot is brand-constant; it never reflects data. The logo becomes functional UI on a single screen (Coach), localised on purpose so the brand mark elsewhere (login, OG cards, marketing) stays stable.

**Live (paid/trial + ≥1 analysed run):**

```
┌─────────────────────────────────────────────┐
│  THIS WEEK IN ZONES        across 3 runs    │
│                                             │
│             ╭─── Z1 ───╮                    │
│            ╱ ╭── Z2 ──╮ ╲                   │
│           │ │ ╭─Z3─╮ │ │                    │
│           │ │ │ ● │ │ │   ← --moss centre   │
│            ╲ ╰────╯ ╱                       │
│             ╰──────╯                        │
│                                             │
│   Z1     Z2     Z3     Z4-5                 │
│   8%    62%    22%      8%                  │
└─────────────────────────────────────────────┘
```

**Pending / locked / skeleton:** all three render the same ring geometry with no arc fill — the logo silhouette is preserved at every state. Pending uses `--card` background with the moss dot muted; locked uses `--bg-soft` + an "Unlock view →" moss text link; the skeleton is the loading shell used during the brief window between completion and `run_analysis` row landing.

**Structure:**
- Background: `--card` (live/pending) or `--bg-soft` (locked); border `1px solid --line`; radius `var(--radius-lg)`; padding `20px`
- Eyebrow row: `10px 700 --mute uppercase 0.08em` left, meta `10px 400 --mute` right (live only)
- SVG: 160×160 viewBox, centred. Four rings, stroke width `9`, gap `4` between adjacent rings. Track stroke `--line`. Coloured arc starts at 12 o'clock, grows clockwise, `strokeLinecap: round`
- Centre dot: `r=7`, fill `--moss` (live) or `--mute` 0.4 opacity (pending/locked)
- Numeric strip (live only): 4-up flex, each cell `9px 700 colour uppercase 0.10em` label above `15px 700 --ink tabular-nums` value (small `--mute` "%" trailing)

**Ring → zone → colour mapping** (consistent with Pattern 21 ZoneBar):

| Ring  | Zone  | Colour token |
|-------|-------|--------------|
| Outer | Z1    | `--s-recov`  |
| Next  | Z2    | `--s-easy`   |
| Next  | Z3    | `--s-quality`|
| Inner | Z4-5  | `--s-inter`  |

**Why arc-fill, not stroke-thickness:** thickness-as-percentage distorts the brand mark's silhouette (a low-Z1-time week would have a noticeably "thinner" outer ring). Arc-fill keeps every ring's shape intact and only the *coverage* varies. The mark stays identifiable at any data shape.

**Why Z1 outer, Z4-5 inner:** the majority of a healthy training week should sit in Z1/Z2. Putting easier zones on the outside means the visually-dominant rings reflect the right way to train, and matches the brand mark's natural emphasis on its outer geometry.

**Data source:**
- Live percentages from `run_analysis.hr_pct_z1` / `z2` / `z3` / `z4_5` — load-km weighted across the week's completed analysed runs (same weighting as Pattern 11's discipline score, so the two never disagree about which session weighed what).
- Columns added in migration `20260527_run_analysis_zone_histogram.sql` (mirrors the histogram from `strava_activities` with a backfill from historical rows).
- Coach screen is paid-gated at the screen level — only live/pending/skeleton states render on Coach; no locked state needed there.

**Props (discriminated union):**
```tsx
// Live (default — state omitted ⇒ live)
{ state?: 'live'; label?: string; pctByZone: { z1: number; z2: number; z3: number; z45: number }; meta?: string }
// Pending
{ state: 'pending'; label?: string }
// Locked
{ state: 'locked'; label?: string; onUpgrade?: () => void }
```

`label` defaults to `'This week in zones'` across all states.

**Tradeoff explicitly accepted:** turning the brand mark into a data display means the logo shape-shifts user-to-user on the Coach screen. The mark elsewhere stays static. Two presences for one mark — a brand-consistency cost that's localised to one screen on purpose.

Reference: `components/shared/ZoneRings.tsx`. Integration: `app/dashboard/DashboardClient.tsx` → `CoachScreen` (below the Stats 2×2 grid, Pattern 19).

---

### 29. TrendCard

Multi-month aerobic trend card. Shows how avg HR on same-effort long runs has changed over a window (default 6 months). The metric pair is formula-derived; the gloss sentence is model-written (CoachByline + 3px moss left rail). Two-metric variant of Pattern 11 (RestraintCard).

**Four states:**

```
LIVE:
┌─────────────────────────────────────────────┐
│  AEROBIC TREND     across 14 long runs · 6w  │  ← eyebrow
│                                              │
│  166          →         149                  │  ← 44px 800 tabular-nums
│  Feb avg                now                  │  ← 13px 400 --mute
│                                              │
│ ▌ [K✦] Kit                                   │  ← 3px moss rail + CoachByline
│ ▌      AEROBIC TREND                         │
│ ▌                                            │
│ ▌ Long run at 5:40/km. Easy is easier        │  ← 13px 400 --ink-2 AI gloss
│ ▌ than it was.                               │
└─────────────────────────────────────────────┘

PENDING (< MIN_BUCKETS data):
  muted —/— metrics, hand-authored pending copy, tap to open explanation sheet.

LOCKED (free tier):
  --bg-soft, muted —/—, "The receipt for your easy days.", moss CTA "Unlock trend →"

SKELETON:
  shimmer placeholders matching live shape, <CoachByline working /> pulsing.
```

**Behavioural design:**
- Count-up animation (ease-out cubic, 600ms) on both HR values at first mount — makes the data feel earned, not loaded
- Gloss fades in (200ms) after count-up completes
- Tap anywhere → slide-up explanation sheet (Pattern 19 keyframes)
- No chart — two numbers, one sentence. The brand constraint is the feature.

**Provenance (critical):**
- Numbers → formula-derived → **no AIMark** on the metric pair
- Gloss sentence → model-written → `<CoachByline color="moss" role="Aerobic trend" />` + 3px moss left rail on the AI section only
- Rail starts at the border dividing the metric pair from the AI section — not over the numbers

**Placement on Coach (CO-ONE):** numbers-only via `glossless` prop. The gloss + CoachByline are stripped so Coach carries exactly one Kit voice (the consolidated read at the top). Trend interpretation folds into that read as a templated sentence ("Easy is easier than it was — 166 down to 149 since Feb.") when the trend engine returns a live gloss. Off-Coach (any future surface), the gloss path remains available — `glossless` is opt-in.

**Tier-divergent header:**
```tsx
// TIER-DIVERGENT — FREE:  locked state, upgrade CTA, hand-authored body
//                  PAID:  live/pending/skeleton states, AI gloss for live
//                  CO-ONE: pass `glossless` on Coach to suppress the AI section
```

**Props (discriminated union):**
```tsx
{ state: 'live';     earlierMonth, earlierHr, nowHr, cohortSize, windowMonths, gloss?, glossless? }
{ state: 'pending'  }
{ state: 'locked';   onUpgrade? }
{ state: 'skeleton' }
```

**Empty-state rule:** pending renders the card body (educates the user); locked renders the locked shell. Neither hides the card entirely — the slot has value even before the signal arrives. The live card silently suppresses when `hrIsTrending === false` (pending instead of live) so noisy non-trends never surface.

Reference: `components/shared/TrendCard.tsx`. Route: `GET /api/coaching/trend?include_gloss=true`. Prompt: `lib/coaching/prompts/aerobicTrend.ts`.

### 26. Voice Anchor Strip

Single-line moss anchor — no card chrome, no border, no eyebrow. Used on the Today screen in place of the (now retired) Today RestraintCard slot. Earns presence through typography weight and the moss colour, not surface chrome.

```
   Hold the zone.
```

**Source:** `BRAND.voiceAnchor` (`lib/brand.ts` → `"Hold the zone."`). Never hardcoded.

**Structure:**
- Padding `18px 16px 0` (sits between the wordmark row and the session card; aligns to the same 16px horizontal gutter)
- Typography: `13px 600 --moss`, letter-spacing `-0.005em`, line-height `1.3`
- No background, no border, no card

**Why no card:** Today is about *today*; the brand line is anchor, not metric. Wrapping it in card chrome would imply a measurement. The unboxed moss line reads as voice — Kit speaking, not Kit measuring.

**Rules:**
- Single screen only (Today). On Coach the metric does the same job through Pattern 25 ZoneRings; doubling the voice line would be noise.
- Never combine with other copy on the same row — the line has to breathe.
- Always uses `BRAND.voiceAnchor`. Don't rephrase. If the anchor string changes, every surface picks up the new value at once.

Reference: `app/dashboard/DashboardClient.tsx` → `TodayScreen` (ZONE-VIS-02 block, replacing the prior RestraintCard wrapper).

---

### 27. NotificationBell

The bell affordance for the notification inbox (NOTIF-01). Lives top-right on the Today screen's wordmark row — home is where users land, and the most frequent push (daily training) already deep-links to Today. A bell icon is justified under "no icons unless they carry unique meaning": it's the universally-understood notifications affordance with no compact text equivalent.

```
ZONNA ●                         🔔 ●     ← moss unread dot, top-right of glyph
```

**Structure:**
- 44×44 tap target (iOS HIG); 22px stroke-bell glyph, `--ink-2` stroke.
- Unread indicator: `8px --moss` dot, `1.5px solid --bg` ring so it reads cleanly over the glyph. **No number badge** — calm over count ("calm guidance, not alerts").
- On the wordmark row, wrap in a `margin: -11px -10px -11px 0` box so the 44px target doesn't balloon the row height.

**Rules:**
- **Paid/trial only.** Free users can't have notifications — render nothing (`hasPaidAccess && onOpenNotifications`).
- Unread count is owned by `DashboardClient` (fetched at load, refreshed on app-resume via `visibilitychange`); opening the inbox optimistically zeroes it.

Reference: `components/shared/NotificationBell.tsx`.

---

### 28. NotificationRow

One row in the notification inbox. Read-only delivery record — the *envelope*, not the AI content surface.

```
┌─────────────────────────────────────────────┐
│ ▌ PLAN ADJUSTED                     2h ago ● │  ← rail-coloured eyebrow · time · unread dot
│   Plan's been shifted.                      │  ← title (bold)
│   Thursday's long run moved to Saturday.    │  ← body (muted, 2-line clamp)
└─────────────────────────────────────────────┘
```

**Structure:**
- Standalone card: `--card`, `1px solid --line`, `var(--radius-lg)`, padding `13px 16px 14px 18px` (extra left clears the rail), min-height 64px. 8px gap between rows; grouped under SectionLabels (`Today` / `Earlier`).
- **3px left rail — two-colour system:** `--warn` for `plan_adjustment` (design system reserves warn for coaching/adjustment surfaces), `--moss` for every other type (Kit's voice).
- Eyebrow: short type label, `10px 700 uppercase 0.08em`, in the rail colour. Map: `daily_training`→"Today's session", `weekly_report`→"Your week", `trial_insight`→"Kit noticed", `run_feedback`→"Run logged", `plan_adjustment`→"Plan adjusted".
- Title: `13px 600` — `--ink` unread, `--mute` read. Body: `12px 400 --mute`, 2-line clamp. Time: `11px --mute-2`. Unread dot: `8px --moss`.

**Provenance rule (deliberate):** rows carry **NO AIMark / CoachByline**. Most copy is rule/hand-authored, and the deep-link target (Coach, Session detail) already carries the proper byline (§16/§16b). Marking rows would violate provenance honesty and add noise.

**NotificationsScreen** (inline in `DashboardClient`): back arrow top-left → Today; `ScreenHeader title="Notifications"`; Today/Earlier `SectionLabel` groups; static skeleton rows while loading (no spinner, matches existing skeletons); Pattern 8 empty state ("Nothing from Kit yet."). Opening marks all rows read (clears the bell); loaded rows keep their unread styling for the current view.

Reference: `components/shared/NotificationRow.tsx`; `DashboardClient.tsx` → `NotificationsScreen`.

---

## Form Fields & Pickers

The canonical user-input controls. **Never build a one-off input, toggle, chip, or time entry inline** — reach for one of these. Before this section existed, the same quantities (a time, a heart rate, an effort) were collected 2–3 different ways across screens; these primitives end that drift. Each lives in `components/shared/` and uses Warm Slate tokens only.

**Match the control to the nature of the quantity** — this is the rule that decides which one to use:

| Quantity | Nature | Control |
|---|---|---|
| Free text, email, password, name, a precise number (HR, distance) | Objective, typed | **TextField** |
| A time — finish time, target time, duration | Objective, precise, ranged | **DurationPicker** (stepper) |
| Effort / RPE | Subjective, low-precision | **RPEScale** (Pattern 13) |
| One of 2–4 mutually-exclusive modes (km/mi, sign-in/up, distance/duration) | Toggle | **SegmentedControl** |
| One (or several) of a larger set — race distances, injuries, training-age bands | Select | **Chip** |

### TextField (`components/shared/TextField.tsx`)

The single text/number/email/password/date input. Two rules are enforced inside it so they can never regress:
1. **`fontSize` is locked at 16px.** iOS zooms any focused input below 16px and the `maximum-scale=1` viewport then traps the user zoomed in. This is not negotiable per-field — the primitive owns it.
2. **Warm Slate tokens only** — `--bg-soft` fill, `--line` border, `--ink` text, `--radius-md` radius. No legacy System-B aliases.

- Optional `unit` prop renders a right-aligned suffix *inside* the field (e.g. "bpm") — use this instead of an absolutely-positioned span. Unit is a suffix, never a placeholder.
- `readOnly` switches to `--bg`/`--mute` and a default cursor (e.g. the Profile email).
- Wrap with a `labelStyle` eyebrow above; the field carries no label itself.

```tsx
<TextField type="number" inputMode="numeric" unit="bpm" placeholder="188" value={mhr} onChange={setMhr} />
```

There is no separate "NumberStepper" — a numeric value is a `TextField type="number"` with a `unit`. The only +/− stepper is DurationPicker (time).

### DurationPicker (`components/shared/DurationPicker.tsx`)

The canonical time entry — hour/minute steppers, no keyboard, no format-guessing, no zoom. `showSeconds` adds a third column (default off): use it for **race finish times**, where a short race is minutes:seconds and the seconds decide a PB. Target/benchmark times stay HH:MM.

- Anchor it: pre-fill from a known value (e.g. the plan's goal time) so most users *nudge* rather than enter from zero — the power of defaults applied to the highest-emotion input.

```tsx
<DurationPicker hours={h} mins={m} secs={s} onHoursChange={setH} onMinsChange={setM} onSecsChange={setS} showSeconds />
```

### SegmentedControl (`components/shared/SegmentedControl.tsx`)

Contained-track toggle for 2–4 mutually-exclusive options. One idiom for login mode, km/mi, and distance/duration (previously two divergent toggle styles). Full-width by default; wrap in a fixed-width box for compact right-aligned settings rows.

```tsx
<SegmentedControl value={units} onChange={setUnits} options={[{value:'km',label:'KM'},{value:'mi',label:'MI'}]} />
```

### Chip (`components/shared/Chip.tsx`)

Stateless select-chip for choosing from a set. Single-select (caller tracks one active value) or multi-select (caller tracks a Set). `--moss` border + `--moss-soft` fill when active. Used for race distances, injuries, benchmark type, training-age bands.

### RPEScale (`components/shared/RPEScale.tsx`)

See Pattern 13. The **only** effort control — the post-race sheet and the post-run reflect sheet both use it. Never reimplement a 1–10 grid inline.

### Legacy token migration

The form-control migration (2026-05-30) moved Login, Benchmark, and the Me-screen controls off System-B aliases (`--accent`, `--border-col`, `--input-bg`, `--text-*`, `--card-bg`, `--teal`) onto Warm Slate. `DashboardClient`'s non-control surfaces still carry bridged aliases by design (CLAUDE.md) — migrate them opportunistically when touched, never in a blind sweep of that file.

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
[ZONNA wordmark · moss dot]

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

### 30. PostRaceReshapeCard + RaceResultSheet

**AI-DEPTH-08 — post-race reshape flow.**

Two components, one flow: (1) log the race result, (2) accept or reject the proposed plan reshape.

#### RaceResultSheet (`components/training/RaceResultSheet.tsx`)

Slide-up sheet pattern (Pattern 19 keyframes). Fields: outcome picker (pb / on_target / off_target / dnf), finish time (DurationPicker with `showSeconds`, pre-filled from `plan.meta.target_time`), RPE (shared RPEScale, Pattern 13), notes textarea, optional advanced section (what worked / broke / fueling / strategy). All inputs use the § Form Fields & Pickers primitives. No close button at top — drag indicator only. Mirrored nav footer at bottom.

**Two CTAs:**
- Primary: "Log result" (moss, full-width) → POST `/api/post-race-reshape` → emits `onReshapeReady` with the proposal
- Secondary: text link "Log result only, keep my plan →" → emits `onLogOnly` (logs result, no reshape)

**Rules:**
- Outcome is required before the primary CTA activates
- Submitting state: "Checking plan…" with disabled CTA
- Error shown inline above the footer (no toast)
- Advanced section collapses by default — show/hide toggle with `⌄`/`⌃`

#### PostRaceReshapeCard (`components/training/PostRaceReshapeCard.tsx`)

TIER-DIVERGENT card. Shows the proposed reshape after `RaceResultSheet` resolves:

```
TIER-DIVERGENT — FREE:  locked state — hand-authored copy, upgrade CTA, muted left-rail
                  PAID:  live state — AI summary (Sonnet), CoachByline (moss), 3px left-rail
```

**States (discriminated union):**
- `skeleton` — shimmer placeholders while the reshape API is in flight
- `live` — AI summary + stat chips (N weeks, M sessions) + Accept + Dismiss
- `locked` — non-paid users, upgrade CTA + dismiss
- *(no 'error' state — on API failure the route falls back to rule-engine voice)*

**Live state anatomy:**
```
[3px moss rail]
[CoachByline: "POST-RACE RESHAPE"]
[AI summary — 2-3 sentences, Sonnet voice]
[Stat chips: "N weeks updated · M sessions changed"]
[Accept — update my plan]      ← full-width moss, 46px
[Keep my plan as-is →]         ← text link, muted
```

**Motion:** `vetra-fade-in` on card mount.

**On Accept:** calls POST `/api/post-race-reshape/confirm` with `reshape_id`. Route returns `reshaped_plan_json`. Card calls `onAccepted(reshapedPlan)` so parent can update plan state without re-fetching.

**On Dismiss (both states):** calls `onDismiss()`. Parent sets `reshapeDismissedAt` (session-scoped — prompt doesn't reappear until next app boot).

**Provenance:**
- CoachByline on the AI summary — Sonnet output, provenance honesty required
- No CoachByline on the locked state (hand-authored copy)
- Stats row: formula-derived (weeks_affected.length, sessions_modified from rule engine) — no AIMark

**Where it renders:** TodayScreen, above the PendingAdjustmentBanner, inside the content padding area. Triggered when `currentWeekIndex > raceWeekIndex && !raceWeek.result_embedded && !reshapeDismissedAt`.

Reference: `components/training/PostRaceReshapeCard.tsx`, `components/training/RaceResultSheet.tsx`. Routes: `POST /api/post-race-reshape`, `POST /api/post-race-reshape/confirm`, `POST /api/post-race-reshape/revert`. Prompt: `lib/coaching/prompts/postRaceReshape.ts`. Engine: `lib/coaching/postRaceReshape.ts`.

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
  Lovable — large 44px number, moss % sign, Zonna voice body copy
  Complete — hidden when <2 sessions completed, 100% edge case handled
Trigger frontend-design skill.
```
