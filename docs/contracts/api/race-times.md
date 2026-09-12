# API Contract — /api/race-times

**Method:** GET
**Auth:** Supabase session required. Returns 401 if unauthenticated.
**Gate:** `race_time_estimates` (PAID_ONLY_ONGOING). Returns 403 for free users.
**Requires:** an active plan. Returns 404 with `{ "error": "No plan found" }` otherwise.

Estimated race times from the best available fitness signal, plus the runner's
**progress arc** for their own race. Consumed by `RaceTimesCard` on three
surfaces: Coach (`variant="status"` — the canonical home), Benchmark entry
(`anchor`), and Benchmark result (`result`).

## Signal states

| `state` | Source | `confidence` | Has `target`? |
|---|---|---|---|
| 1 | Benchmark in plan meta | `high` | Yes, when `race_distance_km > 0` |
| 2 | ≥4 qualifying aerobic runs | `moderate` | Yes, when `race_distance_km > 0` |
| 3 | 1–3 qualifying aerobic runs | `low` | Yes, when `race_distance_km > 0` |
| 4 | Wizard `fitness_level` × `training_age` bracket | `low` | **No** — a bracket guess is not a measurement, so an arc off it would show fabricated progress |
| 5 | No signal | `null` | No |

## Response — 200

```json
{
  "state": 2,
  "confidence": "moderate",
  "label": "From your aerobic runs",
  "source": "strava",
  "vdot": 46.2,
  "discountPct": 0,
  "distances": [
    { "distanceKm": 5, "label": "5K", "timeSeconds": 1422, "formattedTime": "23:42" }
  ],
  "target": {
    "distanceKm": 42.195,
    "raceName": "London Marathon",
    "ultraDistance": false,
    "currentSeconds": 13692,
    "baselineSeconds": 14016,
    "goalSeconds": 13500,
    "deltaSeconds": 324,
    "deltaFormatted": "5m 24s",
    "improved": true
  },
  "recalibrationSuggested": false,
  "upgradeCtaType": "benchmark"
}
```

## `target` — the progress arc

The three points of "where I was, where I am, what I'm aiming at" (UX-COACH-01).

| Field | Meaning | Null when |
|---|---|---|
| `baselineSeconds` | Plan-start estimate, projected from `meta.vdot` at generation | Legacy plan with no `meta.vdot` |
| `currentSeconds` | Measured fitness today, at the runner's race distance | Ultra distance (see below) |
| `goalSeconds` | The runner's OWN `meta.target_time`, in seconds | `meta.goal !== 'time_target'`, or no `target_time` |
| `deltaSeconds` / `deltaFormatted` / `improved` | Baseline → current change, **significance-gated** at `RACE_ARC.SIGNIFICANT_DELTA_SEC` (30s) | No baseline, or the change is inside the floor |

**A goal is a decision the runner made, not a prediction** — which is why §109
permits it. There is deliberately **no** projected race-day finish and no rising
line toward the race date (§44.1, fabricated precision). Enforced mechanically
by `lib/coaching/raceProjectionHonesty.test.ts`, which greps this route's source
for future-dated field names and the copy tree for forward-looking claims.

**Ultra distances** (> 42.195 km) return `ultraDistance: true` with every time
field null. Daniels VDOT does not extrapolate past the marathon, so the card
renders an honest note instead of a wrong number.

## Consumer rules

- The arc's SHAPE is decided by `lib/coaching/raceProgressArc.ts → buildRaceProgressArc()`, not by the consumer. It returns `null` without a `currentSeconds`, drops absent points, and clamps the goal gap at zero. Unit-tested there.
- All clock strings come from `lib/format.ts` (`formatClockTime`, `formatElapsedDelta`) per ADR-015. This route formats `formattedTime` and `deltaFormatted`; a consumer formatting `baselineSeconds` / `currentSeconds` / `goalSeconds` itself **must** use the same owners. Both copies of a local `formatTime` were retired on 2026-09-12.

## Errors

| Status | Body |
|---|---|
| 401 | `{ "error": "Unauthorized" }` |
| 403 | `{ "error": "Subscription required" }` |
| 404 | `{ "error": "No plan found" }` |
