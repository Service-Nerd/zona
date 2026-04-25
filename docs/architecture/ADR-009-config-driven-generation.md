# ADR-009 — Config-Driven Plan Generation

**Status**: Accepted
**Date**: 2026-04-25
**Releases**: R23 (rebuild)

---

## Context

R23 shipped a hybrid generator (rule engine + AI enricher, ADR-006). A coaching audit on the rule engine found four structural problems that no amount of tuning would fix:

1. **Magic numbers everywhere.** Phase boundaries, taper depth, recovery cadence, long-run fractions, and quality-session frequency are written inline as numeric literals in `lib/plan/ruleEngine.ts`. There is no single place to read or change them. A coaching change requires a code search across the file.
2. **Coaching principles are implicit.** The rationale behind each numeric ("polarised training", "10% rule", "specificity in peak") lives in `docs/canonical/coaching-rules.md`, but the rules and the code drift. There is no machine-readable link between principle and parameter.
3. **HR zones are computed in one branchy function with no name for each zone.** `qualityHR` covers what most coaches call Z3–Z4; `intervalsHR` covers Z4–Z5. Two consumers (`lib/coaching/aerobicPace.ts`, `lib/coaching/coachingFlag.ts`) hold their own copies of the boundary percentages.
4. **No room to add a paid "zone method selector".** Today's calculator branches on RHR-presence. A future feature that lets a paid user pick Karvonen / %MaxHR / Daniels / Coggan / Friel would have to refactor the calculator anyway.

We need every numeric to live in one configuration file, every coaching principle to point at the constant it controls, and every zone consumer to read from the same source.

---

## Decision

Introduce a single configuration module — `lib/plan/generationConfig.ts` — exporting `GENERATION_CONFIG` as the canonical source for every coaching numeric used by the plan generator and its downstream consumers.

```
lib/plan/
  generationConfig.ts   ← all coaching numerics (THIS ADR)
  sessionFormat.ts      ← universal warm-up/main/cool-down structure
  planSignatures.ts     ← per-distance plan shape
  featureGates.ts       ← Option A trial → free downgrade categories
  ruleEngine.ts         ← reads from the four files above; emits Plan JSON
  enrich.ts             ← reads ruleEngine output; layers ZONA voice
  generate.ts           ← entry point (tier-aware)
```

### What lives in `GENERATION_CONFIG`

| Category | Examples |
|---|---|
| Intensity distribution | `INTENSITY_DISTRIBUTION` keyed by race distance |
| Volume progression | `MAX_WEEKLY_VOLUME_INCREASE_PCT`, `RETURNING_RUNNER_ALLOWANCE_PCT`, `RECOVERY_WEEK_VOLUME_PCT` |
| Recovery cadence | `RECOVERY_WEEK_FREQUENCY_STANDARD/MASTERS`, `MASTERS_AGE_THRESHOLD` |
| Phase structure | `PHASE_DISTRIBUTION`, `SPECIFICITY_BY_PHASE`, `TAPER_BY_DISTANCE`, `TAPER_QUALITY_PER_WEEK` |
| Session spacing | `MIN_HOURS_BETWEEN_QUALITY`, `MIN_HOURS_BETWEEN_QUALITY_AND_LONG`, `QUALITY_SESSIONS_PER_WEEK_MAX` |
| Long-run rules | `LONG_RUN_PCT_OF_WEEKLY_VOLUME` (per phase), `LONG_RUN_CAP_MINUTES` (per distance), `WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` |
| VDOT conservatism | `VDOT_CONSERVATIVE_DISCOUNT_PCT`, `VDOT_STALE_BENCHMARK_*` |
| Fitness classification | `FITNESS_THRESHOLDS` (vdot beginner/intermediate cutoffs) |
| HR zones | `ZONES.Z1…Z5` with both Karvonen % HRR and % MaxHR ranges |

### What does not live in `GENERATION_CONFIG`

- **Voice copy.** Coach notes, week themes, brand strings live in their existing homes (`lib/brand.ts`, ZONA voice in the catalogue table, AI enricher).
- **User input shape.** `GeneratorInput` stays in `types/plan.ts`.
- **Plan output schema.** `Plan`, `Week`, `Session` interfaces stay in `types/plan.ts`; Zod schemas stay in `lib/plan/schema.ts` (INV-PLAN-007 unchanged — `zone` and `hr_target` remain string-typed).

### Authoring rules

- Every value in the config has a corresponding principle in `docs/canonical/CoachingPrinciples.md` with rationale.
- Every consumer of any value must read from `GENERATION_CONFIG`, not hold its own copy. `lib/coaching/aerobicPace.ts` and `lib/coaching/coachingFlag.ts` are migrated in Phase 2.
- Adding a new coaching numeric is a two-step change: (a) add to `GENERATION_CONFIG` with a JSDoc explaining intent and the principle it implements, and (b) reference it from `CoachingPrinciples.md`.

### Forward compatibility

`GENERATION_CONFIG.ZONES` provides the single hook point for a future paid "zone method selector" feature. The current implementation auto-picks Karvonen-when-RHR-present-else-%MaxHR. The paid feature is a one-field addition (`user_settings.zone_method`) plus a single lookup in `computeZones`. Catalogue, plan generation, coaching signal, aerobic-pace filter — none of them change. They all consume zone strings.

---

## Consequences

### Positive

- One file to read or edit when a coaching rule changes.
- Coaching audits become diff-able against the previous config snapshot.
- Generator code becomes shorter, easier to test, and free of inline magic numbers.
- Removes hidden coupling between `ruleEngine.ts` and `lib/coaching/*` zone consumers.
- Unblocks the paid zone-method selector without further refactor.

### Constraints

- A new coaching rule cannot be added by editing `ruleEngine.ts` alone. It must touch `GENERATION_CONFIG` and `CoachingPrinciples.md` in the same change.
- Existing saved plans (`plans` and `plan_archive` rows) keep their frozen `hr_target` strings. No backfill. New plans and `applyRecalibration` use the new values forward-only.
- The audit baseline (current behaviour) is captured before the rebuild lands, so future regressions are measurable.

---

## Alternatives rejected

| Alternative | Reason rejected |
|---|---|
| Keep numerics inline, add comments | Drift continues. Coaching audits remain manual. |
| Move numerics to a shared `constants.ts` per concern | Replaces one drift surface with several (`lib/coaching/constants.ts` already exists; this ADR consolidates). |
| Move numerics into the plan JSON itself | Plans become non-comparable across users; defeats the purpose of a shared coaching framework. |
| Database-backed config (`coaching_config` table) | Premature for a single-tenant generator. Revisit if multi-coach personalisation becomes a feature. |
