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
[left accent] [EASY]           [Today / Mon · 20 Apr]
              [Session Title]
              [Zone 2 · <145 bpm · 6:30/km · 12km]
              [Strava activity name — if linked]
──────────────────────────────────────────────────────
[View details / Log this session]  [● RPE 5]  [badge]
```

**Metric strip**: compact inline row — Zone · HR · Pace · Distance or Duration (preferred metric, no toggle).
**Toggle**: expanded card only. Collapsed card reads saved preference from localStorage.
**Badge states** (right of footer):
- `coaching_flag === null` → `✓ Done` (teal pill)
- `coaching_flag === 'ok'` → `✓ On target` (teal pill)
- `coaching_flag === 'watch'` or `'flag'` → `— Check this` (amber pill)
- RPE dot + number appears separately to the left of the badge when `completion.rpe != null`
- Skipped cards show skip reason text next to the `Skipped` pill

### Expanded State

```
TOP ──────────────────────────────────────────
  [Zone 2]                      ← zone chip
  [Distance/Duration grid] [HR grid] [Pace grid]
  (per-session toggle in Distance/Duration card)

EXECUTION SUMMARY (when complete + has actuals)
  Planned          │  Actual        [On target / Check this]
  12km             │  13.2km
  Zone 2 · <145bpm │  152 bpm avg ↑
  RPE 4            │  RPE 6

MIDDLE ────────────────────────────────────────
  Session description (coaching copy)
  Week focus (if set)

BOTTOM ────────────────────────────────────────
  Coach notes / guidance
  [Action buttons — sticky]
  How did it feel? (RPE + feel tags — editing only, shown when already complete/skipped)
```

**Execution summary** renders when `isComplete && (strava_activity_km || avg_hr || rpe != null)`.
- Planned column: distance/duration, zone + hr_target, rpe_target (omitted if null)
- Actual column: strava_activity_km, avg_hr (amber + ↑ if Zone 2 breach), RPE (coloured via rpeColour)
- Flag badge: `On target` (teal) or `Check this` (amber) — only shown when coaching_flag is set
- Only shows data that exists — partial data is fine

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

[Zona voice response — fades in after selection]

[Skip for now / Done CTA]
```

Skip-reflect variant (after skipping):
```
Skipped.
What got in the way?

[Injury / illness] [Too tired]
[Life got busy]    [Bad weather]

[Zona voice response — fades in after selection]

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
| avg_hr | `completion.avg_hr` — set at Strava link time | Omit from execution summary |
| coaching_flag | `completion.coaching_flag` — computed by `getCoachingFlag()` at RPE save | Badge not shown |

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

## Coaching Flag Logic — `getCoachingFlag()`

Pure function. Location: `lib/coaching/coachingFlag.ts`. Imported by `DashboardClient.tsx`. Inputs: `sessionType`, `rpe`, `avgHr`, `zone2Ceiling`.

| Session type | Condition | Flag |
|---|---|---|
| easy / run / long / recovery | `avgHr > zone2Ceiling` | `flag` |
| easy / run / long / recovery | `rpe >= 7` | `flag` |
| easy / run / long / recovery | `rpe >= 5` | `watch` |
| easy / run / long / recovery | `rpe < 5`, HR in zone | `ok` |
| quality / intervals / tempo / hard | `rpe <= 3` | `watch` |
| quality / intervals / tempo / hard | `rpe > 3` | `ok` |
| race | `rpe <= 4` | `watch` |
| race | `rpe > 4` | `ok` |
| strength / cross / rest | any | `null` (not applicable) |

Returns `null` when: session type has no effort target, or both `rpe` and `avgHr` are null.

`coaching_flag` is R18-ready: R18 (confidence score) reads per-session flags from `session_completions` to derive weekly and aggregate signals.

---

## Supabase Schema — session_completions additions

```sql
ALTER TABLE session_completions
  ADD COLUMN IF NOT EXISTS avg_hr        INTEGER,           -- from Strava average_heartrate at link time
  ADD COLUMN IF NOT EXISTS coaching_flag TEXT               -- 'ok' | 'watch' | 'flag'
    CHECK (coaching_flag IN ('ok', 'watch', 'flag'));
```

Migration: `supabase/migrations/20260420_coaching_signal.sql`

---

## Invariants

- Session colour dot resolves via `session-types.ts` only — no inline colour logic in the component.
- No popup or modal — expanded state is inline within the card (slide/toggle).
- Strength and rest sessions show no HR target, no zone, no pace bracket, no coaching flag.
- Never show estimated or formula-derived pace — only Strava-derived values.
- RPE badge on collapsed card only appears when `completion.rpe != null`.
- Reflect view is shown after logging; "How did it feel?" section in expanded is for editing existing logs only.
- Zona voice response in reflect view is session-type-aware — see `getZonaReflectResponse()` in `DashboardClient.tsx`.
- Fatigue vocabulary is canonical: `Fresh / Fine / Heavy / Wrecked`. No other tags.
- Skip reason vocabulary: `Injury / illness / Too tired / Life got busy / Bad weather`. Saves to `fatigue_tag` column.
- `coaching_flag` is never persisted as a display string — always the raw enum value. Display strings are derived at render time.
- `avg_hr` is captured only at Strava activity link time (`saveCompletion`). Manual logs have `avg_hr = null`.
- Collapsed card badge uses text + colour — never colour alone (cross-train teal collision risk).
