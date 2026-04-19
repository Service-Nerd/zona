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
[left accent] [Run Type Label]    [date]
              [Session Title]
              [distance/duration pill] [HR pill] [pace pill]
              [Strava activity name — if linked]
─────────────────────────────────────────────────────────
[View details / Log this session]    [● RPE] [✓ Done]
```

- RPE badge (coloured dot + number) appears only when `completion.rpe != null`
- Skipped cards show skip reason text (if captured) next to the Skipped pill

### Expanded State

```
TOP ──────────────────────────────────────────
  Run Type · Zone · HR target · Pace bracket
  Distance + Duration (with per-session toggle)

MIDDLE ────────────────────────────────────────
  Session description (coaching copy)
  Week focus (if set)

BOTTOM ────────────────────────────────────────
  Coach notes / guidance
  [Action buttons — sticky]
  How did it feel? (RPE + feel tags — editing only, shown when already complete/skipped)
```

### Post-Log Reflect View

Shown immediately after any session is logged (Strava or non-run completion) or skipped.
Replaces the old instant-dismiss success flash. Not shown when editing an existing log via "Update log."

```
[✓ tick] [Completion headline]
         [Completion body copy]
──────────────────────────────
How did that land?
Effort and body state. That's all I need.

[RPE 1–10 row]
[Body state: Fresh / Fine / Heavy / Wrecked]

[ZONA voice response — fades in after selection]

[Skip for now / Done CTA]
```

Skip-reflect variant (after skipping):
```
Skipped.
What got in the way?

[Injury / illness] [Too tired]
[Life got busy]    [Bad weather]

[ZONA voice response — fades in after selection]

[Close without answering / Close CTA]
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
- RPE badge on collapsed card only appears when `completion.rpe != null`.
- Reflect view is shown after logging; "How did it feel?" section in expanded is for editing existing logs only.
- ZONA voice response in reflect view is session-type-aware — see `getZonaReflectResponse()` in `DashboardClient.tsx`.
- Fatigue vocabulary is canonical: `Fresh / Fine / Heavy / Wrecked`. No other tags.
- Skip reason vocabulary: `Injury / illness / Too tired / Life got busy / Bad weather`. Saves to `fatigue_tag` column.
