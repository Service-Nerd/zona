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
  age: number                     // used for Tanaka max HR (208 − 0.7 × age)
}
```

### GeneratorInput (optional fields)

```typescript
{
  // Fitness — all derived server-side; supply to override derivation
  fitness_level?: 'beginner' | 'intermediate' | 'experienced'  // derived from data if absent
  resting_hr?: number             // improves Karvonen zone accuracy; falls back to HRmax%
  max_hr?: number                 // derived from age via Tanaka if absent

  // Benchmark — enables VDOT-based pace targets (Jack Daniels model)
  benchmark?: {
    type: 'race' | 'tt_30min'
    distance_km: number           // race distance OR km covered in 30 min
    time: string                  // finish time e.g. "25:30", "1:52:00". "30:00" for TT.
  }

  // Race
  race_name?: string
  target_time?: string            // only if goal = 'time_target'. Derives goal_pace_per_km.

  // Schedule
  days_cannot_train?: string[]    // full day names e.g. ['monday', 'friday']
  max_weekday_mins?: number

  // Profile (Step 4 — paid/trial only)
  training_style?: 'predictable' | 'variety' | 'minimalist' | 'structured'
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  motivation_type?: 'identity' | 'achievement' | 'health' | 'social'
  injury_history?: string[]       // e.g. ['achilles', 'knee']
  terrain?: 'road' | 'trail' | 'mixed'
  athlete_name?: string
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
