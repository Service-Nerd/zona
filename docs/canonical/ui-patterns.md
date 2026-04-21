# UI Patterns — Zona Visual Language

**Reference aesthetic**: Runna · Planzy  
**Authority**: This document defines layout patterns, component anatomy, spacing, and typography rules for all Zona screens. Read before building any new screen or component.

---

## Core Aesthetic

Dark-first, athletic, calm. No decoration for decoration's sake. Every element earns its place.

- **Dark mode is primary** — light mode is a polished variant, not the design target
- **Bold metrics, quiet context** — large numbers, small muted labels underneath
- **Type accent, not flood** — session colours appear as left borders, dots, or small chips; never as full card backgrounds
- **Density with breathing room** — tight within a card, clear gaps between cards, generous padding inside
- **No chrome** — no box shadows stacked on box shadows, no gradients on gradients, no decorative dividers

---

## Typography Scale

All type uses CSS custom properties. Never hardcode sizes.

| Role | Font | Weight | Size | Usage |
|---|---|---|---|---|
| Screen title | Space Grotesk | 700 | 1.5rem | Page headings |
| Section header | Space Grotesk | 600 | 1rem | Week labels, group headers |
| Metric value | Inter | 700 | 1.75–2.5rem | Key numbers (distance, pace, HR) |
| Metric label | Inter | 400 | 0.75rem | Caption below metric value |
| Card primary | Inter | 600 | 0.9375rem | Session name, main label |
| Card secondary | Inter | 400 | 0.8125rem | Zone, type, supporting detail |
| Body / description | Inter | 400 | 0.875rem | Session description, coach note |
| Muted / hint | Inter | 400 | 0.75rem | `var(--color-muted)` — timestamps, metadata |

### Metric Pair Pattern (Runna-style)

Use consistently wherever a stat is displayed:

```
42.3          ← Inter 700, 2rem, --color-text
km this week  ← Inter 400, 0.75rem, --color-muted
```

Never put label above value. Value always dominates.

---

## Spacing Rhythm

```
--space-xs:  4px   — icon gaps, inline tight
--space-sm:  8px   — within a component (label + value)
--space-md:  12px  — between elements inside a card
--space-lg:  16px  — card padding (inner)
--space-xl:  24px  — between cards in a list
--space-2xl: 32px  — between sections
--space-3xl: 48px  — screen-level breathing (top of content)
```

Card inner padding: `16px` horizontal, `14px` vertical.  
List gap between session cards: `12px`.  
Section gap (e.g. week → week): `28–32px`.

---

## Component Patterns

### 1. Session Card (Collapsed)

Runna-style: left accent + content block + right metadata.

```
┌─────────────────────────────────────────────┐
│ ▌  Easy Run              Zone 2  · 10km     │
│    60 min  ·  conversational pace           │
└─────────────────────────────────────────────┘
```

- **Left accent**: 3px solid vertical bar, `var(--color-session-{type})`, full card height, `border-radius: 2px`
- **Title row**: session name (card primary weight) + session type chip (right-aligned, small pill)
- **Detail row**: duration · distance or pace bracket — muted weight
- **No icons** unless they carry unique meaning
- **Tap target**: full card width, min-height `64px`
- Border: `1px solid var(--color-border)`, radius `10px`
- Background: `var(--color-card)`

### 2. Session Card (Expanded)

Same card, grown in place — no navigation. Reveals three zones:

```
┌─────────────────────────────────────────────┐
│ ▌  Easy Run              Zone 2  · 10km     │
│    60 min  ·  conversational pace           │
│ ─────────────────────────────────────────── │
│  Keep it easy. Nose breathing the whole     │
│  way. If you can't talk, slow down.         │
│ ─────────────────────────────────────────── │
│  Why: Base aerobic load. Your aerobic       │
│  engine is the thing that gets you to       │
│  Stone 100. Protect it.                     │
└─────────────────────────────────────────────┘
```

Zone order:
1. **Header** — same as collapsed (type + metrics)
2. **Description** — what to do, how it should feel
3. **Coach note** — why this session exists in the plan

Dividers between zones: `1px solid var(--color-border)`, no margin collapse.

### 3. Week Strip (Planzy-style)

Horizontal day selector. Compact. Always visible above session list.

```
  Mo  Tu  We  Th  Fr  Sa  Su
  ●   ○   ─   ●   ○   ○   ─
```

- Day label: 3-letter abbreviation, `0.6875rem`, muted
- Indicator dot:
  - `●` filled teal — today
  - `●` filled muted — has session, not today
  - `○` outlined — has session, future
  - `─` dash — rest/empty
  - `✓` checkmark (teal) — completed
- Active day: teal dot + day label in `var(--color-teal)`, not bold
- Scroll horizontally if multi-week view needed
- Min tap target per day: `40px` wide

### 4. Stat Row

3–4 metric pairs in a horizontal row. Used in weekly summary, plan overview.

```
┌──────────┬──────────┬──────────┬──────────┐
│  42.3    │  5h 20m  │   84%    │   8/12   │
│  km      │  total   │  zone 2  │  done    │
└──────────┴──────────┴──────────┴──────────┘
```

- Equal-width columns, `flex: 1`
- Value: Inter 700, `1.5rem`
- Label: Inter 400, `0.75rem`, muted
- Dividers: `1px solid var(--color-border)` between columns (not around)
- Background: card colour with slightly reduced opacity or same as card

### 5. Section Header

```
Week 14  ·  Apr 14–20          62km planned
```

- Left: Space Grotesk 600, week number + date range
- Right: planned volume, muted weight
- No background, no box
- Margin above: `--space-2xl`, margin below: `--space-sm`

### 6. Session Type Chip

Small pill label. Right-aligned in session card header.

```
[ EASY ]  [ LONG ]  [ TEMPO ]
```

- Font: Inter 600, `0.625rem`, uppercase, `letter-spacing: 0.08em`
- Padding: `2px 7px`
- Background: `var(--color-session-{type})` at `18% opacity`
- Text: `var(--color-session-{type})`
- Radius: `4px`
- Never use full solid background

### 7. Navigation Bar (Bottom)

Minimal. 4–5 tabs max.

- Background: `var(--color-card)` with `border-top: 1px solid var(--color-border)`
- Active icon + label: `var(--color-teal)`
- Inactive: `var(--color-muted)`
- Label: `0.6875rem`, always visible (no icon-only nav)
- Height: `60px` + safe area inset

### 8. Empty State

```
        ○

   Nothing here yet.
   Your plan sessions will
   appear once loaded.
```

- Centered vertically in available space
- Icon: outline style, `var(--color-muted)`, `32px`
- Heading: Space Grotesk 600, `1rem`
- Body: Inter 400, `0.875rem`, muted
- No button unless there's a specific action available

### 9. Post-Log Reflect Sheet

Used after any session is logged or skipped. This is the emotional peak of the session — treat it as such.

```
┌─────────────────────────────────────────────┐
│ [✓]  Hard session logged.                   │
│      Don't follow it with more effort.      │
│ ────────────────────────────────────────── │
│  How did that land?                         │
│  Effort and body state. That's all I need.  │
│                                             │
│  Effort (RPE)                               │
│  [1][2][3][4][5][6][7][8][9][10]            │
│                                             │
│  Body state                                 │
│  [Fresh] [Fine] [Heavy] [Wrecked]           │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ Hard session in the bank. Earn rest. │   │  ← fades in
│  └──────────────────────────────────────┘   │
│                                             │
│  [           DONE           ]               │  ← teal when response shown
└─────────────────────────────────────────────┘
```

Rules:
- Completion confirmation (headline + body) always shown at top — acts as transition from the action
- Question and inputs follow a visual divider — creates a "new moment" feel
- Zona voice response fades in (`opacity 0 → 1`, `translateY(6px) → 0`, 350ms) after any selection
- CTA button shifts from ghost (`Skip for now`) to solid teal (`Done`) once a response appears
- Skip path (close without rating) always available — run is already saved, reflect is invited not required
- Never auto-dismiss — the reflect step should feel intentional, not rushed
- For skip-reflect: same structure, replace RPE row with 2×2 reason grid (`Injury / illness / Too tired / Life got busy / Bad weather`)

Zona voice rules:
- One sentence only
- Session-type-aware: RPE 8 on easy = flag it; RPE 8 on intervals = endorse it
- Canonical response matrix lives in `getZonaReflectResponse()` — `DashboardClient.tsx`
- Tone: honest, dry, not cringe — matches CLAUDE.md voice guidelines

### 10. Loading State

Skeleton shimmer only. No spinners. No progress percentages. No rotating circles.

- Match the exact shape of the content it replaces
- Shimmer: CSS animation from `var(--border-col)` → slightly lighter (use `var(--teal)` as the highlight sweep colour) → back
- Session card skeleton: same height as collapsed card, left accent bar included
- Never show partial data while loading — skeleton or nothing

**The Generating Ceremony (canonical example — `GeneratingCeremony.tsx`)**

The plan generation screen is the highest-emotion loading moment in the app. It is not a loading state. It is a signature ZONA moment. Shipped in R23.

Architecture:
- `hasPaidAccess: boolean` — controls copy set and minimum duration
- `plan: Plan | null` — null while generating, Plan when API responds
- `onRevealComplete: () => void` — parent transitions to full preview after reveal

Phases:
1. **Loading**: skeleton shimmer of 3 phase card placeholders. Copy cycles every 1.8s in `var(--font-brand)`. Minimum duration: 1.8s (free) / 3.6s (paid) — ensures at least one copy line is seen even when the rule engine responds instantly.
2. **Revealing**: skeleton unmounts, phase cards draw in with `visible` prop + 80ms stagger. Copy transitions to the payoff line: *"There it is. Don't ruin it."* in `var(--teal)`.
3. **Done**: calls `onRevealComplete` after 500ms post-last-card → parent sets `appStep('preview')`.

Copy (paid/trial, 5 lines): "Reading your race date." → "Protecting you from yourself." → "Zone 2 ceiling" → "Deload weeks" → "Almost done."
Copy (free, 4 lines): "Working out your schedule." → "10% rule" → "Deload weeks" → "Almost done."

No spinner. No percentage. The reveal is the payoff — not the wait.

Reference `components/GeneratingCeremony.tsx` for implementation.

---

## Screen Templates

### Session List Screen (e.g. Today / This Week)

```
[Screen title]
[Week strip]

[Section header — day label]
[Session card]
[Session card]

[Section header — day label]
[Session card]
...
```

- No sidebar, no split view
- Scroll is vertical only
- Pull-to-refresh gesture on mobile

### Session Detail Screen

- Full screen, back arrow top-left
- Header: session name + type chip
- Metric row (distance · duration · zone · HR target)
- Description block
- Coach note block
- Action (mark complete / adjust) pinned to bottom

### Plan Overview Screen (Planzy-style)

- Week strip at top, sticky on scroll
- Weeks as sections, each with stat row + session list
- Compact collapsed cards by default
- No calendar grid — list is better for this density

---

## HR Zone → Session Colour Coherence

**Design invariant**: HR zone colours match the session type colours for the sessions that target those zones. A user sees the same blue for a Zone 2 easy run on the plan screen AND on the HR zone chart. This is intentional — the visual vocabulary reinforces the physiological relationship.

| Zone | Name | Token | Hex | Matching session type |
|------|------|-------|-----|----------------------|
| 1 | Recovery | `--session-recovery` | `#5BAD8C` | recovery |
| 2 | Aerobic | `--session-easy` | `#4A90D9` | easy, long |
| 3 | Tempo | `--session-quality` | `#F2C14E` | quality, tempo |
| 4 | Threshold | `--session-race` | `#E8833A` | race (race-pace effort = threshold intensity) |
| 5 | VO₂ Max | `--coral` / `--session-intervals` | `#E05A5A` | intervals |

**Rules:**
- Zone colours must always use session type tokens (not semantic tokens like `--accent` or `--amber`).
- `--amber` is reserved for coaching warnings and quality session accents only — it must never be used for Zone 5.
- `--coral` (`#E05A5A`) is the canonical max-effort colour shared by `--session-intervals` and Zone 5.
- Never introduce a standalone zone colour that doesn't map to an existing session type token.

---

## Tier-Divergent Components

A component that renders differently for FREE vs PAID/TRIAL users must follow these rules:

1. **Single file, conditional render.** Never split into `FooFree.tsx` + `FooPaid.tsx`. One component, one `tier` prop, internal branching.
2. **Free is the baseline, paid is enrichment.** The free variant must be a complete, lovable experience on its own — not a degraded fallback. PAID adds voice, confidence scoring, and deeper personalisation on top.
3. **Header comment is mandatory.** Every tier-divergent file must open with:
   ```tsx
   // TIER-DIVERGENT — FREE: [brief description of free variant]
   //                  PAID: [brief description of paid enrichment]
   ```
4. **No tier logic in child components.** The tier prop travels from the route to the top-level screen component. Children receive pre-computed data, not a tier flag they must interpret.
5. **Graceful degradation only.** If the paid enrichment is absent (Claude failed, fields missing), the component falls back to the free variant automatically. Never show an empty state where a standard plan could show.

Canonical examples (R23): `GeneratingCeremony.tsx`, `GeneratePlanScreen.tsx` (Step 4 visibility).

---

## What Not to Do

| Avoid | Use instead |
|---|---|
| Full card background in session colour | Left accent border + chip |
| Gradient backgrounds | Flat card colour |
| Multiple box-shadows stacked | Single subtle shadow or none |
| Icons everywhere | Text labels where space allows |
| Spinner loading states | Skeleton placeholders |
| Alert/modal popups | Navigate to full screen |
| Text on coloured backgrounds | Colour as accent only |
| Centred-only layouts | Left-aligned with consistent margin |

---

## Prompt Template for UI Requests

Use this structure when asking Claude to build a new screen or component:

```
Build: [screen or component name]
Pattern: [session-list / session-detail / plan-overview / stat-row / week-strip]
Data available: [what fields/values will be rendered]
Session types shown: [list] — apply session-type colour map
State variants needed: [loading / empty / complete / today / future]
Mobile-first: yes
Trigger frontend-design skill.
```

Example:

```
Build: Weekly summary stat row
Pattern: stat-row
Data available: total_km, total_duration_mins, zone2_percent, sessions_completed / sessions_total
State variants needed: loading skeleton
Mobile-first: yes
Trigger frontend-design skill.
```
