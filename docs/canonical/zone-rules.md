# Zone Rules — Canonical Reference

**Authority**: This document defines all HR zone calculation methods, zone-to-session-type mappings, and the aerobic pace derivation logic. No component or utility may implement its own zone calculation.

---

## HR Zone Method — Karvonen Heart Rate Reserve (HRR)

All HR zone targets use the Karvonen formula. No hardcoded zone values anywhere in the codebase.

### Formula

```
zone_bpm = restingHR + (pct / 100) × (maxHR − restingHR)
```

### Zone Mapping

| Session Type | Zone | HRR % Range | Notes |
|---|---|---|---|
| easy / run / long | Zone 2 | 60–70% | Upper bound = Zone 2 ceiling |
| quality / tempo | Threshold | 75–85% | Comfortably hard |
| intervals / hard | VO2max | 85–95% | Short, high-intensity |
| recovery | Zone 1 | <60% | Active recovery only |
| race | Race pace | — | Derived from target time, not HR |

---

## HR Target Fallback Chain

Display only what can be derived. Never guess or show a wrong number.

1. `session.hr_target` — stored at plan creation time (generator writes this)
2. Karvonen from user's stored `resting_hr` / `max_hr` in `user_settings`
3. `plan.meta.zone2_ceiling` — plan-level stored value
4. **Show nothing** — never fall through to a generic default

---

## Aerobic Pace — Strava-Derived Only

Displayed pace comes from the user's actual Strava runs filtered to their personal Zone 2 HR band. No formula-estimated fallback.

### Logic (`computeAerobicPace`)

1. Filter Strava runs where `average_heartrate` falls in the user's 60–70% HRR band
2. Average pace across last 6 qualifying runs
3. Return formatted string (e.g. `6:45/km`) or `null` if insufficient data

**Rule**: If a user has no qualifying Strava runs, show nothing. A formula-estimated pace looks authoritative but is often wrong. Showing nothing is more honest than showing a wrong number.

---

## Zone 2 Ceiling

- Calculated as the upper bound of the Zone 2 range (70% HRR)
- Stored in `plan.meta.zone2_ceiling` at plan creation
- User can override via Me screen
- Default: 145 bpm (used only as a last resort if no HR data exists)

---

## Invariants

- No hardcoded HR zone values anywhere in the codebase
- Zone 2 ceiling for one athlete may be Zone 3 for another — personalisation is non-negotiable
- `computeAerobicPace` must only return values derived from real Strava data
- Pace bracket displayed on session card must come from `computeAerobicPace` or be omitted
