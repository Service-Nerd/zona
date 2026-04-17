# Contract — POST /api/generate-plan

**Authority**: This document defines the request/response contract for the plan generator API route. The route lives at `app/api/generate-plan/route.ts`.

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
  zone2_ceiling?: number          // defaults to 145 if absent
  days_cannot_train?: string[]    // e.g. ['mon', 'fri']
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

### 200 — Stub plan (no API key configured)

```json
{ "plan": Plan, "stub": true }
```

The stub plan is a 12-week half marathon template exercising the full schema. Used for UI development when `ANTHROPIC_API_KEY` is not set.

### 422 — Guard rail violation

```json
{ "error": "string" }
```

Triggered by:
- Race fewer than 3 weeks away
- Marathon+ race fewer than 6 weeks away
- Fewer than 2 days available per week

### 502 — Anthropic API error

```json
{ "error": "Plan generation failed" }
```

### 500 — Parse or structure error

```json
{ "error": "Generated plan was not valid JSON" }
{ "error": "Generated plan is missing required structure" }
{ "error": "Unexpected error" }
```

---

## Behaviour

- Guard rails are checked **before** the API call. Invalid inputs never reach Anthropic.
- Plan start is always the **next Monday** from the current date.
- Token budget scales with plan length: ≤12 weeks → 12,000 tokens; ≤20 weeks → 18,000; >20 weeks → 24,000.
- The route strips markdown fences from the response before parsing, in case the model wraps JSON in a code block.
- A minimal sanity check runs after parse: `plan.meta` and `plan.weeks` must exist and weeks must be non-empty.
- Model: `claude-sonnet-4-6`

---

## Primary Metric Selection (server-side)

The route determines `primary_metric` before calling the API:
- `beginner` → `duration`
- `race_distance_km >= 50` → `duration`
- otherwise → `distance`

This is passed to the model as a suggestion and applied to `meta.primary_metric`.
