# Plan Schema — Canonical Reference

**Authority**: This document defines the canonical JSON shape for Zonna training plans (GitHub Gist format) and the TypeScript interfaces. Any field addition requires an update here first, then the TypeScript interfaces in `types/plan.ts`, then downstream consumers.

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
  id?: string                              // deterministic: "w{N}-{day}" e.g. "w5-wed" — required on R23+ plans, absent on legacy (INV-PLAN-009)
  type: SessionType
  label: string
  /** Legacy free-text display field. Kept for backward compat with hand-authored gists.
   *  Generator writes structured fields below instead. App prefers structured when present. */
  detail: string | null

  // Structured fields — generator-populated, optional for legacy gists
  distance_km?: number                     // e.g. 8.5
  duration_mins?: number                   // e.g. 45
  primary_metric?: 'distance' | 'duration' // session-level override of plan default
  zone?: string                            // e.g. "Zone 2" | "Zone 3–4" — always a string (INV-PLAN-007)
  hr_target?: string                       // e.g. "< 145 bpm" | "155–165 bpm" — always a string (INV-PLAN-007)
  pace_target?: string                     // e.g. "6:30–7:00 /km"
  rpe_target?: number                      // 1–10
  coach_notes?: [string, string?, string?] // max 3 bullet points — plain coaching language (INV-PLAN-008)
  lr_segment_pace?: string                 // long-run embedded pace segment, e.g. "5:45–6:05 /km" (§24b/§24d)

  // AI-DEPTH-07 (2026-05-12) — schema-only additive fields. Engine does not
  // populate these yet; reserved for AI-DEPTH-08 (post-race reshape) and
  // related depth work. All optional; consumers must tolerate undefined.
  key_session?: boolean                    // pivotal session marker — long runs, race-pace tempos, tune-ups
  run_walk_strategy?: string               // e.g. "9:1 from km 10"
  fueling_protocol?: string                // e.g. "gel every 25 min from km 10"
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
  tune_up_callout?: string        // L-01 — optional mid-build tune-up race suggestion

  // AI-DEPTH-07 — race-day result captured into the plan on the race week.
  // Populated post-event; consumed by AI-DEPTH-08 (post-race reshape).
  result_embedded?: RaceResult | null
}

export interface RaceResult {
  finish_time?: string                                                       // "4:32:17"
  distance_km?: number                                                       // actual distance covered
  date?: string                                                              // ISO
  splits?: Array<{ km: number; pace: string; hr?: number }>                  // per-segment splits
  avg_hr?: number
  max_hr?: number
  hr_drift_pct?: number                                                      // first-half vs second-half drift
  rpe?: number                                                               // 1–10
  outcome?: 'on_target' | 'off_target' | 'dnf' | 'pb'
  notes?: string                                                             // free-form runner reflection
  fueling_outcome?: string                                                   // → AI-DEPTH-08 fueling_protocol updates
  strategy_outcome?: string                                                  // → AI-DEPTH-08 pacing/run-walk updates
  what_worked?: string
  what_broke?: string
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
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  injury_history?: string[]
  terrain?: 'road' | 'trail' | 'mixed'

  // Removed in R23 rebuild — `motivation_type` and `training_style`. Existing
  // saved plans containing these fields remain valid; the fields are ignored.
  // No backfill, no removal from old rows.

  // Generator metadata
  generated_at?: string        // ISO timestamp of generation
  generator_version?: string   // e.g. "1.0"

  // R18 — confidence score produced at generation time
  confidence_score?: number    // 1–10 — PAID plans only (INV-PLAN-008)
  confidence_risks?: string[]  // e.g. ["low base volume", "tight timeline"] — PAID only

  // R23 — hybrid generation fields (added 2026-04-21)
  tier?: 'free' | 'trial' | 'paid'  // tier at which plan was generated
  compressed?: boolean               // true if available weeks < ideal plan length for distance
  coach_intro?: string               // PAID only — enricher-generated intro paragraph in ZONNA voice

  // CoachingPrinciples §78 — weeks carrying a 5K time trial. DERIVED FROM THE
  // PRODUCED PLAN, not from intent: a week appears here only if the benchmark
  // session was actually placed. The session is typed `hard` (Z4-5), so it does
  // not count against QUALITY_SESSIONS_PER_WEEK_MAX and beginners get it too.
  // Enforced by INV-PLAN-RECALIBRATION-HAS-SESSION.
  recalibration_weeks?: number[]

  // GEN-FIX-02 (2026-08-06) — enrichment provenance. Set in the route, not the
  // enricher. Any `failed_*` means the user holds rule-engine output (silent
  // fallback, ADR-006); the suffix names who must fix it. Absent = generated
  // before this shipped.
  //
  // 'pending' — ENRICH-SAVE-01 (2026-09-03) changed its meaning. It used to mark
  // the N8 save race and was always a defect. The runner now saves DELIBERATELY
  // before enrichment resolves (28–35s; they are not made to wait), so 'pending'
  // is expected for ~30s after saving. It is a defect only if it PERSISTS —
  // then the follow-up write never landed (usually the app was closed), which
  // costs the voice layer, never the plan.
  //
  // Widened 2026-09-03 (ENRICH-ATTRIB-01): the bare 'failed' proved
  // undiagnosable — two trial plans carried it and it could not distinguish an
  // unreachable API from unparseable model output from a plan the route
  // discarded itself. It was the third. Bare 'failed' is retained for historical
  // rows only and is never written by current code.
  enrichment?: 'applied' | 'skipped' | 'pending'
              | 'failed_no_api_key'    // ANTHROPIC_API_KEY absent — deploy config
              | 'failed_api_error'     // non-2xx from Anthropic, or transport threw
              | 'failed_unparseable'   // not JSON, or failed EnrichedPlanSchema
              | 'failed_invalid_copy'  // enrichment introduced NEW violations; reverted
              | 'failed'               // LEGACY (pre-2026-09-03) — never written now

  // §44 — ordinal demand label on every generated plan. FREE. A *pre-generation
  // feasibility* read of the runner's chosen timeline and constraints — NOT a
  // quality judgement on the produced plan (that is the PAID confidence score;
  // SLT boundary 2026-08-18). `difficulty_note` present only for the two
  // demanding tiers. Enforced by INV-PLAN-DIFFICULTY-ANNOTATED and
  // INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE.
  difficulty_band?: 'comfortable' | 'demanding' | 'very_demanding'
  difficulty_note?: string

  // §83 / CD-16 (SC-06, 2026-08-20) — the runner's stated target pace is faster
  // than the interval pace their benchmark supports, so the sessions labelled
  // VO2max are prescribed SLOWER than those labelled race pace. The plan cannot
  // be executed as written by both pace and heart rate. Derived from inputs
  // (target vs benchmark) before any session exists, so it stays on the
  // feasibility side of the §44 boundary above. Enforced by
  // INV-PLAN-INTENSITY-ORDERING, which requires a plan containing the inversion
  // to declare it rather than ship silently.
  goal_beyond_measured_fitness?: boolean
}

> **Doc-drift note (2026-08-20).** `difficulty_band` / `difficulty_note` shipped
> 2026-08-18 and were never added here; `goal_beyond_measured_fitness` is added
> in the same commit that introduces it (M-011). Other `meta` fields set by the
> generator but not yet documented in this interface — `volume_profile`,
> `volume_constraint_note`, `prep_time_status`, `prep_time_warning`,
> `prep_time_alternatives`, `compression_classification`, `vdot`,
> `vdot_training_anchor`, `goal_pace_per_km`, `rule_adjustments` — are a known
> gap in this contract, recorded rather than silently carried. `types/plan.ts`
> is the live shape; this document is behind it.

export interface Phase {
  name: 'base' | 'build' | 'peak' | 'taper'
  start_week: number   // 1-indexed, inclusive
  end_week: number     // 1-indexed, inclusive
}

export interface Plan {
  meta: PlanMeta
  phases?: Phase[]     // optional — present on R23+ plans; absent on legacy gist plans
  weeks: Week[]
}
```

---

## Two-Tier Session Data Model

Zonna supports two session data formats. Structured is preferred; legacy is fallback only.

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
| INV-PLAN-002 | Plan JSON always fetched from Supabase `plans` table (migrated from GitHub Gist in R23 Phase 2). `fetchPlanForUser` in `lib/plan.ts` is the only read path. |
| INV-PLAN-003 | `Session` interface in `types/plan.ts` is the TypeScript authority. Field additions require interface update first. |
| INV-PLAN-004 | Plan output = JSON first, never direct-to-DB. Generator (R23) and reshaper (R20) share this schema. |
| INV-PLAN-005 | `primary_metric` determines default display (distance or duration). Both fields may coexist in a session. |
| INV-PLAN-006 | Strength session stubs carry no HR target and no zone until R21. |
| INV-PLAN-007 | `zone` and `hr_target` are always formatted strings (e.g. `"Zone 2"`, `"< 145 bpm"`). Never numeric or object types. The rule engine computes numeric values internally and formats to strings before output. R23 reaffirms this. |
| INV-PLAN-008 | Free plans (`meta.tier === 'free'`) never carry `confidence_score` or `confidence_risks`. These fields are PAID-only. UI consumers may rely on their absence as a tier signal. `coach_notes` is a tuple of max 3 strings — never more. |
| INV-PLAN-009 | Sessions on R23+ plans carry a deterministic `id` of the form `w{N}-{day}` (e.g. `w5-wed`). This ID is used by R20 (reshaper) for targeted session updates. Legacy plans (pre-R23) have no session IDs — consumers must handle absence gracefully. |
| INV-PLAN-010 | Quality session main-set content originates from the `session_catalogue` Supabase table (R23 rebuild onward). The rule engine selects rows; it does not synthesise session strings inline. See `docs/canonical/session-catalogue.md`. |
| INV-PLAN-011 | Every numeric the generator uses lives in `lib/plan/generationConfig.ts → GENERATION_CONFIG` (or its sibling config modules `sessionFormat.ts`, `planSignatures.ts`, `featureGates.ts`). No magic numbers in `lib/plan/ruleEngine.ts` or any consumer. See `docs/architecture/ADR-009-config-driven-generation.md`. |

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
