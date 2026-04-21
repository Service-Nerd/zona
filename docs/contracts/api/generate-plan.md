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
  race_distance_km: number
  goal: 'finish' | 'time_target'
  fitness_level: 'beginner' | 'intermediate' | 'experienced'
  current_weekly_km: number
  longest_recent_run_km: number
  days_available: number          // 2–6
  resting_hr: number
  max_hr: number
}
```

### GeneratorInput (optional fields)

```typescript
{
  race_name?: string
  target_time?: string            // only if goal = 'time_target'
  zone2_ceiling?: number          // computed via Karvonen if absent
  days_cannot_train?: string[]    // full day names e.g. ['monday', 'friday']
  max_weekday_mins?: number
  max_weekend_mins?: number
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
- Marathon+ race fewer than 6 weeks away
- Fewer than 2 days available per week

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
