# ADR-021 — Experience-gated quality onset: phase distribution becomes runner-aware

**Status**: SHIPPED (2026-09-06). Coaching Board CORRECT WITH AMENDMENT + SLT FREE (both this session). §89.
**Date**: 2026-09-06
**Supersedes**: nothing. **Amends**: ADR-009 (config-driven generation — phase distribution was a flat global), CoachingPrinciples §79 (intensity now governs *timing*), §5 (a demonstrated base earns a shorter one), the §79 progressive-re-entry block.
**Related**: ADR-017 (Coaching Board authority), §87/CB-DELOAD-01 (deload placement — the prerequisite that made onset movable), ADR-020 (plan construction boundary).

---

## Context

`computePhases(totalWeeks, distanceKm)` took **no runner attributes**. `PHASE_DISTRIBUTION.base_pct = 35` applied to everyone, and `base = 0 quality` is an unconditional hardcode (`ruleEngine.ts`). So the first quality session was structurally impossible before build, and build began at the same fraction of the plan for a couch-to-5K beginner and a five-year runner mid-block alike.

**The concrete failure.** A runner doing 30 km/week with a 10 km long run who has been running intervals and hills for two months *outside* the plan got a beginner's on-ramp: first quality at week 5 of a 12-week plan, the first third indistinguishable from a novice's. The engine could not tell "beginner building a base" from "experienced runner with a base they are actively using." Both got the full four-week easy base. The experienced runner ignores the plan and self-coaches beside it, or grinds out four bored weeks and detrains — the exact churn a coaching product cannot afford among its most credible users.

**Why not just shorten base globally?** Tried and reverted (CB-PHASE-01, base 35→30, commit `8e6620e`) — it shortens base for *beginners* too, whose tissue genuinely needs the on-ramp, and it collided with §2196's returning-runner re-entry. A global lever cannot serve one cohort without harming another.

## Decision

**Phase distribution is personalized per runner, gated on demonstrated readiness.** `computePhases` gains an `earlyOnset` flag; a demonstrably-ready runner gets `EARLY_ONSET_BASE_PCT` (15 vs 35), so build and quality start ~2 weeks sooner. The freed weeks flow to build/peak. The base never drops below `MIN_BASE_WEEKS_FLOOR` (2). Everyone else is untouched.

**The gate — `earlyQualityOnset` — is a pure predicate over inputs**, computed once beside the existing returning/fresh-return derivation:

- experienced *intensity* (declared or assessed), and
- structural fitness ≥ intermediate (a real volume base), and
- deep training age (`2-5yr`/`5yr+`), and
- **not** returning and **not** fresh-from-layoff (a *current* base, not a memory), and
- `recent_quality_training = 'regular'` — a **new FREE wizard input**: demonstrated recent structured hard training, and
- **no injury history** — an absolute veto.

**The signal is the architectural crux.** Willy's §2196 re-entry exists because *cardiovascular readiness returns weeks ahead of musculoskeletal readiness* — a runner feels ready before the tissue is. The only honest thing that falsifies that premise for a specific runner is evidence they have **already loaded the tissue** with the stimulus, recently and regularly. So the input is a *demonstrated-practice* question ("have you been doing intervals/hills/tempo most weeks"), not a self-image one ("are you experienced"). Self-image already exists (`user_declared_level`, `hard_session_relationship`) and is insufficient — it cannot speak to tissue.

**Lever A — the same signal relaxes re-entry, intensity-only.** A runner who *is* returning (low current volume) but reports `'regular'` has the §2196 VO2max/hill withholding shortened `RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS`→`REENTRY_WEEKS_TISSUE_READY` (4→1, not zero). The **volume** ramp caution is untouched — tissue-stimulus readiness and chronic-volume readiness are different axes, and the signal speaks only to the first.

### The tonnage guarantee, stated precisely

§79 forbids agency from raising tonnage. The structural peak target (`peakKm`, set by structural fitness) is **unchanged**, and the ramp cap (§2) is unchanged — this moves *timing*, not the ceiling. A shorter base does leave more build/peak weeks, so the delivered curve reaches that same ceiling slightly more fully (measured **+~4%** peak on the example, never above target) via a **more gradual** ramp, with the volume peak landing **later** than the intensity onset. A gentler ramp to an unchanged ceiling is not injury-relevant tonnage; it is the runner completing the progression their structure already permits (Sims's "don't pull volume forward" condition is met).

### Why it can be FREE (SLT)

Plan *structure* — when quality starts — is the plan itself, not a richness layer. Gating it would abandon free experienced runners to a plan built wrong for them ("Free Users Are Never Abandoned — gate richness, never access"). The paid line (AI coaching voice, dynamic reshape) is untouched. The wizard copy is *recognition, not reward* ("you've got a base; we won't make you re-prove it"), factual and past-tense, so it cannot be gamed into an "unlock harder training" incentive — and the consequence of over-claiming is bounded anyway (one session slightly early, no injury-relevant tonnage, easy-day discipline intact, injury veto absolute).

## The safety model (the founding requirement: do not create injuries for the less experienced)

Three layers, so a gate bypass cannot silently harm:

1. **The predicate** excludes beginners, returners, fresh-returns, and the injured.
2. **`INV-PLAN-EARLY-ONSET-GATED`** (error) recomputes the safety-critical necessary conditions from input+meta — injury veto, `'regular'` signal, deep training age, non-beginner — and asserts the 2-week base floor for every plan. A forged `early_quality_onset` on an injured runner is a hard violation (tested).
3. **The property sweep** varies `recent_quality_training` across the grid (16k plans, 0 violations), so the gate is exercised against every input combination including the injury vetoes.

## Consequences

- **`computePhases` is now runner-aware** — the first per-runner phase-length decision. The seam is a single boolean; the readiness derivation stays in one place beside returning/fresh-return.
- **A new personalization axis exists**: intensity governs *timing*. Future timing decisions (e.g. VO2max onset for the conditioned runner) have a natural home on the same predicate.
- **The prerequisite was §87/CB-DELOAD-01** (deload placement made phase-aware) — without single-owner, phase-aware deloads, moving the base boundary would have re-broken the "deload opens a phase" class.
- **Not addressed**: the delivered-vs-curve divergence (DELOAD-INVERSION-01) is orthogonal and still open; it does not affect onset.

## Verification

511 unit tests (8 new persona/gate/forgery tests), property sweep 16,035 plans / 0 violations (coverage now includes `recent_quality_training`), archetype matrix 17/17, and a persona harness confirming: the example runner gets quality at W3 (was W5); beginners, `occasional`-signal, injured+signal, and returners+signal are all unchanged in base length; returners+signal get re-entry 4→1.
