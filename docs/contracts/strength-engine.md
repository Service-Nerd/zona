# The strength engine — interface contract

**Package:** `packages/strength` (public surface: `packages/strength/index.ts` only). **Item:** `STRENGTH-ENGINE-01`.
**Architecture:** ADR-024. **Doctrine:** `docs/canonical/StrengthPrinciples.md`. **Numbers:** `STRENGTH_CONFIG`.

## The call

```ts
generateStrengthPlan(profile: StrengthProfile, ctx: RunContext | null, opts?: { standaloneStart?: string; startDate?: string }): StrengthPlan
validateStrengthPlan(plan: StrengthPlan, ctx: RunContext | null): StrengthViolation[]
parseStrengthProfile(input: unknown): { ok: true; profile } | { ok: false; field }
```

- **Pure and deterministic.** No clock, randomness, environment, network, database or model call
  (`boundary.test.ts`). Same inputs, same plan.
- **`ctx = null`** is the standalone path (`standaloneStart` required, an ISO Monday): `STANDALONE_WEEKS` weeks,
  every day a rest day for placement. This is how a second app would call it.
- **Isolation.** The package imports only its own files; `lib/plan` and `types` never import it; app code imports
  the index, never a file inside.

## `RunContext` v1 — built only by `lib/strength-bridge/runContext.ts → planToRunContext(plan, overrides)`

```ts
{ version: 1,
  days: { date: 'YYYY-MM-DD', day: 'mon'…'sun', week_n, role: 'rest'|'easy'|'recovery'|'long'|'quality'|'race'|'cross' }[],
  weeks: { n, phase: 'base'|'build'|'peak'|'taper'|'race_week'|'deload'|'maintenance' }[],
  race_date: string | null, injury_tags: InjuryTag[], masters: boolean }
```

One entry per calendar day, contiguous. Roles come from the run engine's own predicates (`isLongRun`, session
type) after live move/swap overrides (`getSessionForDate`). A week holding the race is `race_week`; a deload badge
is `deload`. Injury tags are whitelisted. `masters` uses `GENERATION_CONFIG.MASTERS_AGE_THRESHOLD`. **No paces,
zones or distances.** `runContextSig(ctx)` hashes it.

## `StrengthPlan` v1

```ts
{ version: 1, standalone, split: 'full_body'|'full_body_plus_upper'|'upper_lower'|'standalone', profile,
  weeks: { n, phase, sessions: {
    date | null, day, week_n, kind: 'full_body'|'lower_core'|'upper_core'|'mobility',
    heavy_legs, after_quality_run, estimated_minutes,
    blocks: { role: 'warmup'|'plyo'|'main'|'accessory'|'core'|'mobility',
              items: { exercise_id, sets, reps?|seconds?|contacts?, rir: number|null, rest_s, per_side, superset? }[] }[]
  }[] }[],
  notes: ('bodyweight_ceiling'|'split_is_inference'|'legs_limited_by_run_week'|'fewer_sessions_than_asked'|'pattern_unavailable')[],
  start_date: string }   // STRENGTH-START-WEEK-01: weeks before it hold no sessions; every count starts here
```

**`startDate` (STRENGTH-START-WEEK-01):** the technique block, the jumps gate and every level climb count strength
weeks from the week containing it, never the run plan's week 1, and no session is placed before it. Defaults to the
calendar's first day, so callers that build at the start of a run plan are unchanged; the route always passes it.

`exercise_id` resolves in `CATALOGUE_BY_ID`. Notes are facts for the app to phrase; the engine writes no copy beyond
catalogue cues (reviewed by the strength seat 2026-10-17). An exercise marked `not_main` never fills a main slot
(`S-MAIN-ELIGIBLE`).

## Guarantees (checked by `validateStrengthPlan`, each falsified in `validate.test.ts`)

The `S-*` codes in `StrengthPrinciples.md` (32 as of 2026-10-17; count from `validate.ts`). Gates: `npm run verify:strength` (in `verify:ci`),
`verify:strength:full` (266,688 plans, 2026-10-16: 0 violations).
