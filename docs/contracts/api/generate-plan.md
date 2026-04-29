# Contract — POST /api/generate-plan

**Authority**: This document defines the request/response contract for the plan generator API route. The route lives at `app/api/generate-plan/route.ts`.

**Architecture**: Hybrid generation (ADR-006). Rule engine always runs; AI enricher runs for trial/paid and falls back silently on failure. Free users always receive a plan.

---

## Request

```
POST /api/generate-plan
Content-Type: application/json
Body: GeneratorInput
```

### GeneratorInput (required fields)

```typescript
{
  race_date: string               // ISO date "YYYY-MM-DD"
  race_distance_km: number        // 5K/10K/HM free; Marathon/50K/100K PAID
  goal: 'finish' | 'time_target'
  current_weekly_km: number       // 4-week average
  longest_recent_run_km: number   // within last 6 weeks
  days_available: number          // 2–6
  age: number                     // derived client-side from DOB at generation time; used for Tanaka MaxHR
}
```

### GeneratorInput (optional fields)

```typescript
{
  // Fitness — all derived server-side; supply to override derivation
  fitness_level?: 'beginner' | 'intermediate' | 'experienced'  // derived from data if absent
  resting_hr?: number             // improves Karvonen zone accuracy; falls back to HRmax%
  max_hr?: number                 // derived from age via Tanaka if absent
  training_age?: '<6mo' | '6-18mo' | '2-5yr' | '5yr+'  // R23 rebuild — drives returning-runner allowance
  longest_run_ever_km?: number    // R23 rebuild — informs week-1–2 long-run cap

  // Benchmark — enables VDOT-based pace targets (Jack Daniels model)
  benchmark?: {
    type: 'race' | 'tt_30min'
    distance_km: number           // race distance OR km covered in 30 min
    time: string                  // finish time e.g. "25:30", "1:52:00". "30:00" for TT.
    benchmark_date?: string       // ISO date — used to apply stale-benchmark VDOT discount (>6 mo)
  }

  // Race
  race_name?: string
  target_time?: string            // only if goal = 'time_target'. Derives goal_pace_per_km AND drives peak-phase race-pace specificity.

  // Schedule
  days_cannot_train?: string[]    // full day names e.g. ['monday', 'friday']
  max_weekday_mins?: number
  preferred_long_run_day?: 'sat' | 'sun'  // R23 rebuild — soft constraint; default 'sun'
  treadmill_primarily?: boolean   // R23 rebuild — affects strides and hill-work plausibility

  // Profile (paid/trial only)
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  injury_history?: ('achilles' | 'knee' | 'back' | 'shin_splints' | 'hip_flexor' | 'plantar_fasciitis')[]
  terrain?: 'road' | 'trail' | 'mixed'
  athlete_name?: string

  // Removed in R23 rebuild — `motivation_type`, `training_style`. Server ignores these fields if sent.
}
```

---

## Responses

### 200 — Plan generated

```json
{ "plan": Plan }
```

The plan always contains at minimum rule-engine output. For trial/paid users, AI-enriched labels,
week themes, and session coach notes are included. For paid users only: `confidence_score`,
`confidence_risks`, and `coach_intro` are added. The `meta.tier` field indicates which tier
produced the plan.

**R23 rebuild additions to `meta`:**
- `vdot_discount_applied_pct: number` — total VDOT discount applied (3% default + 5% if benchmark stale > 6 months). Surfaced for transparency.
- `catalogue_session_ids: string[]` — IDs of `session_catalogue` rows referenced by this plan's quality sessions. Useful for recalibration and audit.

### 401 — Unauthenticated

```json
{ "error": "Unauthorized" }
```

### 422 — Guard rail violation

```json
{ "error": "string" }
```

Triggered by:
- Race fewer than 3 weeks away
- Marathon+ race fewer than 8 weeks away
- Half marathon race fewer than 4 weeks away
- Fewer than 2 days available per week
- Marathon distance with current_weekly_km < 20
- HM+ distance with longest_recent_run_km < 5

### 500 — Unexpected error

```json
{ "error": "Unexpected error" }
```

---

## Behaviour

### Tier-based generation

| Tier | Rule engine | AI enricher | Confidence fields | coach_intro |
|------|-------------|-------------|-------------------|-------------|
| free | ✅ always | ✗ | ✗ | ✗ |
| trial | ✅ always | ✅ (fallback) | ✗ | ✗ |
| paid | ✅ always | ✅ (fallback) | ✅ | ✅ |

Tier is determined server-side by `getUserTier(userId)`. The client never sends a tier claim.

### Enricher fallback
If the AI enricher fails (timeout, invalid JSON, schema violation), the rule-engine plan is
returned unchanged. The caller cannot distinguish enriched from unenriched in the 200 response
(by design — ADR-006: enricher failure is silent).

### Plan start
Plan start is always the **next Monday** from the current date, computed using local-time date
arithmetic (avoids UTC midnight drift). This is computed server-side; the client does not send
a plan start date.

### Guard rails
Guard rails are checked **before** generation. Invalid inputs never reach the rule engine.

### Primary metric
Determined by rule engine:
- `beginner` → `duration`
- `race_distance_km >= 50` → `duration`
- otherwise → `distance`

---

## Generation modules

| Module | Responsibility |
|--------|---------------|
| `lib/plan/ruleEngine.ts` | Deterministic plan structure — distances, HR, zones, sessions |
| `lib/plan/enrich.ts` | AI coaching voice — labels, themes, coach notes, confidence |
| `lib/plan/generate.ts` | Orchestrator — calls rule engine then enricher |
| `lib/trial.ts` | Auth boundary — `getUserTier()` |
| `lib/plan/foundationBlock.ts` | Foundation Block generator — pre-plan prep weeks (client-side, not this route) |

---

## Plan schema — foundation weeks

The `Plan.weeks` array may include foundation-phase weeks with `phase: 'foundation'` and `n ≤ 0`. These are **not produced by this route** — they are prepended client-side by `GeneratePlanScreen` based on the gap between today and `meta.plan_start`. When a plan with foundation weeks is saved via `savePlanForUser`, they persist in the DB as part of `plan_json`.

Foundation week invariants: `INV-PLAN-FOUNDATION-BLOCK` (see `docs/canonical/plan-invariants.md`).
