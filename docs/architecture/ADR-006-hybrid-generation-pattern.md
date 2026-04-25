# ADR-006 — Hybrid Plan Generation Pattern

**Status**: Accepted  
**Date**: 2026-04-21  
**Releases**: R23 (plan generator), R20 (reshaper), R24 (multi-race)

---

## Context

Plan generation for Zona must serve two user segments with fundamentally different cost profiles:

- **Free users** need a working plan immediately. An AI call per plan is financially unsustainable at free tier scale, and any AI dependency makes the free path fragile — if Claude is unavailable, free users get nothing.
- **Trial and paid users** expect personalised coaching voice, a confidence score, and session-level reasoning. A generic template is not an acceptable experience at the price point.

Two alternatives were considered and rejected:

1. **Binary split (free = fixed template, paid = full AI generation)**: The free path is structurally inferior and the gap is obvious to users. More importantly, the two code paths diverge over time — the rule engine and the AI prompt drift independently, producing plans that feel like different products.

2. **Full AI with paywall**: Makes the free path a hard wall. Free users who can't afford a subscription get no plan. This violates the brand principle that ZONA protects all runners — not just those who pay.

---

## Decision

All plan generation uses a **hybrid architecture**: a deterministic rule engine produces the full plan structure, and an AI enrichment layer optionally adds coaching voice on top.

```
Inputs (race, fitness, schedule)
         │
         ▼
  Rule Engine (lib/plan/ruleEngine.ts)
  ─────────────────────────────────────
  Produces canonical Plan JSON:
  - All weeks and sessions
  - Accurate numeric targets (HR, distance, duration, pace)
  - Generic labels and descriptions
  - Phase structure
  - Compressed flag if timeline is short
         │
         ├──── tier = 'free' ──────────────► Return rule-engine output
         │
         └──── tier = 'trial' | 'paid' ───► Enricher (lib/plan/enrich.ts)
                                             │
                                             ├── Claude succeeds → return enriched plan
                                             └── Claude fails → return rule-engine output
```

### Rule engine responsibilities

- Deterministic. Same inputs always produce the same structure.
- No AI calls.
- Reads all numeric values from `lib/plan/generationConfig.ts` (`GENERATION_CONFIG`), session structure from `lib/plan/sessionFormat.ts`, distance shape from `lib/plan/planSignatures.ts`, and feature gates from `lib/plan/featureGates.ts`. **No magic numbers inline.** See ADR-009 and ADR-010.
- Selects quality sessions from the `session_catalogue` Supabase table — does not synthesise session strings inline.
- Produces plans that are complete and correct without enrichment.
- Applies coaching rules from `docs/canonical/coaching-rules.md` and principles from `docs/canonical/CoachingPrinciples.md`.

### Enricher responsibilities

- Replaces generic labels with ZONA-voice copy.
- Adds `coach_notes` per session.
- Adds `meta.confidence_score`, `meta.confidence_risks`, and `meta.coach_intro`.
- Adds `week.theme` copy in ZONA voice.
- **Must not change any numeric value** (distance, duration, HR targets, zone strings).
- Validates Claude output with Zod. Any validation failure → silent fallback to rule-engine output.

### Entry point

`lib/plan/generate(input: GeneratorInput, tier: 'free' | 'trial' | 'paid'): Promise<Plan>` is the only entry point for plan generation. It internally calls the rule engine, then conditionally calls the enricher.

The API route (`app/api/generate-plan/route.ts`) is the auth boundary. It determines the tier via `hasPaidAccess()` and passes it to `generate()`. `lib/plan/*` modules do not touch auth or Supabase.

---

## Consequences

### Positive

- **Free path is robust.** No AI dependency. If Claude goes down, free users still get a plan.
- **Cost is predictable.** AI spend is proportional to paid users, not total plan generations.
- **Schema is unified.** Free and paid plans share the same JSON structure. R20 (reshaper) and R24 (multi-race) inherit this architecture without forking.
- **Voice is a replaceable layer.** Coach copy and labels are fields on an existing structure — not the structure itself. They can be updated, regenerated, or personalised without touching the plan logic.
- **Testable.** Rule engine is a pure function. Unit tests require no API keys.

### Constraints

- The enricher must not mutate numeric values. Zod validation enforces this before any enriched plan is accepted.
- All new plan generators (R20, R21, R24) must follow this pattern. New plan-generation code that calls AI without a deterministic fallback is a build blocker.
- `lib/plan/*` modules must remain auth-free. Auth logic belongs in API routes.

---

## Alternatives rejected

| Alternative | Reason rejected |
|---|---|
| Binary split (free=template, paid=AI) | Structurally two products. Drift over time. Free experience is visibly worse. |
| Full AI, gated | Free users locked out entirely. Brand violation ("free users are never abandoned"). |
| Rule engine only (no AI) | Paid users don't get the coaching voice and confidence scoring they pay for. |
| AI only, with generous fallback | Fallback is still just a template — identical to binary split but more complex. |
