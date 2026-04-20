# Plan Schema — Canonical Reference

**Authority**: This document defines the canonical JSON shape for Zona training plans (GitHub Gist format) and the TypeScript interfaces. Any field addition requires an update here first, then the TypeScript interfaces in `types/plan.ts`, then downstream consumers.

---

## TypeScript Interfaces (`types/plan.ts`)

### SessionType

```typescript
export type SessionType = 'run' | 'easy' | 'quality' | 'strength' | 'rest' | 'race'
```

> **Note**: The UI and PlanCalendar handle additional types (`long`, `tempo`, `intervals`, `hard`, `recovery`, `cross-train`) via colour/label maps, but these are not in the TypeScript union. This is a known drift. `types/plan.ts` should be extended to match `docs/canonical/session-types.md`.

### Session

```typescript
export interface Session {
  type: SessionType
  label: string
  /** Legacy free-text display field. Kept for backward compat with hand-authored gists.
   *  Generator writes structured fields below instead. App prefers structured when present. */
  detail: string | null

  // Structured fields — generator-populated, optional for legacy gists
  distance_km?: number                     // e.g. 8.5
  duration_mins?: number                   // e.g. 45
  primary_metric?: 'distance' | 'duration' // session-level override of plan default
  zone?: string                            // e.g. "Zone 2" | "Zone 3–4"
  hr_target?: string                       // e.g. "< 145 bpm" | "155–165 bpm"
  pace_target?: string                     // e.g. "6:30–7:00 /km"
  rpe_target?: number                      // 1–10
  coach_notes?: [string, string?, string?] // max 3 bullet points — plain coaching language
}
```

### Week

```typescript
export type WeekType = 'completed' | 'deload_done' | 'current' | 'normal' | 'deload' | 'race_event' | 'race'

export interface Week {
  n: number                    // 1-indexed
  date: string                 // ISO date string — Monday of that week, e.g. "2026-04-06"
  label: string
  theme: string
  type: WeekType
  phase?: 'base' | 'build' | 'peak' | 'taper'
  badge?: 'deload' | 'holiday' | 'race'
  sessions: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', Session>>
  long_run_hrs: number | null
  weekly_km: number
  weekly_duration_mins?: number   // for time-based plans, alongside weekly_km
  race_notes?: string
}
```

### PlanMeta

```typescript
export interface PlanMeta {
  // Core identity
  athlete: string
  handle: string
  race_name: string
  race_date: string
  race_distance_km: number
  charity: string
  plan_start: string
  quit_date: string

  // HR profile
  resting_hr: number
  max_hr: number
  zone2_ceiling: number

  // Plan metadata
  version: string
  last_updated: string
  notes: string
  primary_metric?: 'distance' | 'duration'  // 'distance' assumed if absent (legacy compat)

  // Athlete profile — stored for R20 reshaper
  fitness_level?: 'beginner' | 'intermediate' | 'experienced'
  goal?: 'finish' | 'time_target'
  target_time?: string
  days_available?: number
  training_style?: 'predictable' | 'variety' | 'minimalist' | 'structured'
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  motivation_type?: 'identity' | 'achievement' | 'health' | 'social'
  injury_history?: string[]
  terrain?: 'road' | 'trail' | 'mixed'

  // Generator metadata
  generated_at?: string        // ISO timestamp of generation
  generator_version?: string   // e.g. "1.0"

  // R18 — confidence score produced at generation time
  confidence_score?: number    // 1–10
  confidence_risks?: string[]  // e.g. ["low base volume", "tight timeline"]
}

export interface Plan {
  meta: PlanMeta
  weeks: Week[]
}
```

---

## Two-Tier Session Data Model

Zona supports two session data formats. Structured is preferred; legacy is fallback only.

### Structured Fields (generator output — R23 onwards)

The R23 generator always writes structured fields. `detail` is always `null`.

### Legacy Field (hand-authored gists only)

```
detail: "10km" | "3h15" | "45 min" — free-text, hand-authored only
```

Hand-authored gists use only `type`, `label`, `detail`. The app prefers structured fields and falls back to `parseSessionDetail()` for legacy.

---

## Full Plan JSON Shape (Gist format)

```json
{
  "meta": {
    "athlete": "Russ",
    "race_name": "Race to the Stones",
    "race_date": "2026-07-11",
    "race_distance_km": 100,
    "zone2_ceiling": 145,
    "primary_metric": "duration",
    "resting_hr": 48,
    "max_hr": 182,
    "version": "1.0",
    "last_updated": "2026-04-15",
    "notes": "100K plan — time-on-feet focus",
    "plan_start": "2026-01-05",
    "handle": "",
    "charity": "",
    "quit_date": ""
  },
  "weeks": [
    {
      "n": 1,
      "date": "2026-01-05",
      "label": "Base — easy start",
      "theme": "HR discipline from day one.",
      "type": "normal",
      "phase": "base",
      "long_run_hrs": 1.5,
      "weekly_km": 35,
      "sessions": {
        "mon": { "type": "strength", "label": "Strength session", "detail": null, "duration_mins": 45 },
        "tue": { "type": "easy", "label": "Easy run — Zone 2", "detail": null, "distance_km": 8, "duration_mins": 55, "zone": "Zone 2", "hr_target": "< 145 bpm", "rpe_target": 4 },
        "thu": { "type": "easy", "label": "Easy run — Zone 2", "detail": null, "duration_mins": 60, "zone": "Zone 2", "hr_target": "< 145 bpm" },
        "sun": { "type": "easy", "label": "Long run — Zone 2", "detail": null, "duration_mins": 90, "zone": "Zone 2", "hr_target": "< 145 bpm", "coach_notes": ["Eat before. Bring water.", "If you finish wanting more, you got the effort right."] }
      }
    }
  ]
}
```

---

## Invariants

| ID | Rule |
|---|---|
| INV-PLAN-001 | Plan JSON is the single source of truth for session definitions. Supabase stores overrides and completions only. |
| INV-PLAN-002 | Plan JSON always fetched from GitHub Gist with `cache: 'no-store'`. |
| INV-PLAN-003 | `Session` interface in `types/plan.ts` is the TypeScript authority. Field additions require interface update first. |
| INV-PLAN-004 | Plan output = JSON first, never direct-to-DB. Generator (R23) and reshaper (R20) share this schema. |
| INV-PLAN-005 | `primary_metric` determines default display (distance or duration). Both fields may coexist in a session. |
| INV-PLAN-006 | Strength session stubs carry no HR target and no zone until R21. |
| INV-PLAN-007 | `hr_target` is always a formatted string (e.g. `"< 145 bpm"`), never a raw number. |
| INV-PLAN-008 | `coach_notes` is a tuple of max 3 strings. Never more. |

---

## Supabase Tables (overlay data — not session definitions)

### `session_completions`
Tracks which sessions the user has marked complete.

```
user_id, week_n, session_day, status ('complete' | 'skipped'), strava_activity_name, strava_activity_km
```

### `session_overrides`
Per-session user overrides (session moves/swaps).

```
user_id, week_n, original_day, new_day, updated_at
```

Both fetched once at `DashboardClient` level and passed as props to all child screens.
