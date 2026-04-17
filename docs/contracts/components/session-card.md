# Contract — SessionCard Component

**Authority**: This document defines the prop interface and rendering contract for the session card component (collapsed and expanded states). Any change to props or card hierarchy must update this document in the same commit.

---

## Prop Interface

```typescript
interface SessionCardProps {
  session: SessionEntry          // canonical session shape — see docs/canonical/plan-schema.md
  preferredUnits: 'km' | 'mi'
  preferredMetric: 'distance' | 'duration'   // global default from Me screen
  zone2Ceiling: number           // Karvonen-derived; from user_settings or plan meta
  restingHR: number              // from user_settings
  maxHR: number                  // from user_settings
  aerobicPace: string | null     // Strava-derived; null if no qualifying runs
}
```

---

## Card Hierarchy

### Collapsed State

```
[dot] [Run Type Label]    [Zone]    [HR target]
[Distance or Duration]    (toggle: dist/duration from Me screen preference)
```

### Expanded State

```
TOP ──────────────────────────────────────────
  Run Type · Zone · HR target · Pace bracket
  Distance + Duration (with per-session toggle)

MIDDLE ────────────────────────────────────────
  Session description (coaching copy)

BOTTOM ────────────────────────────────────────
  Why / coach notes
```

---

## Display Rules

| Field | Source | Fallback |
|---|---|---|
| HR target | `session.hr_target` → Karvonen → `plan.meta.zone2_ceiling` | Show nothing |
| Pace bracket | `aerobicPace` (Strava-derived) | Show nothing |
| Duration | `session.duration` → `fmtDurationMins(session.duration_mins)` | Show nothing |
| Distance | `session.distance_km` (or converted to mi) | Show nothing |
| Zone | `session.zone` | Derived from session type |

---

## Duration Formatting Rule

Duration > 60 minutes must display as `Xh` or `XhYY` — never as raw minutes.

```
45 → "45min"
60 → "1h"
90 → "1h30"
120 → "2h"
```

---

## Toggle Behaviour

- **Global toggle** (Me screen): sets `preferredMetric` in `user_settings`. All collapsed cards respect this.
- **Per-session toggle** (expanded card only): overrides the global for that session. Persists in localStorage keyed by session identifier. Updates the collapsed card for that session only.

---

## Invariants

- Session colour dot resolves via `session-types.ts` only — no inline colour logic in the component.
- No popup or modal — expanded state is inline within the card (slide/toggle).
- Strength and rest sessions show no HR target, no zone, no pace bracket.
- Never show estimated or formula-derived pace — only Strava-derived values.
