# ADR-014 — Recalibration application model (the living plan)

**Status:** Accepted (2026-08-06). Implements PV2-H / CD-13 (coaching register 2026-08). Depends on ADR-012 (reshape authority), ADR-013 (plan lifecycle). SLT-signed as part of the coaching register.

---

## Context

The plan schedules a **5K time trial** in each recalibration (deload) week and tells the runner, in its own copy, that *"your paces update for the next block."* Today that is only true if the runner, unprompted, opens Profile → *Update pace targets* and re-enters the time by hand. The week-4/8 time trial's **result is wired to nothing**:

- `applyRecalibration()` (`lib/plan/ruleEngine.ts:2722`) already exists and works — given a benchmark result it recomputes VDOT and **rewrites every forward session's `pace_target` / `hr_target`** from the current week on. It is exposed at `POST /api/recalibrate-zones`, gated on `dynamic_reshape_r20` (paid).
- Its **only caller** is the manual `BenchmarkUpdateScreen`.
- The `fitness_signal` trigger (ENGINE-01) that *could* bridge them is **prompt-only** (`adjustmentType: 'flag_for_review'`, `planAdjustment.ts`) **and** structurally blind to the time trial: `adjust-plan` builds its signal input from `QUALITY_TYPES = {quality, intervals, tempo}` and the time trial is typed **`hard`** (deliberately, so it doesn't count against the beginner quality cap), so it is filtered out.

Result: a plan that contradicts its own copy. CD-13's first half (PV2-D) made the *copy* honest ("log the result and your paces update"). This ADR decides how the plan is made to *actually* update — the living plan that is Zonna's paid differentiator ("Runna assumes you'll follow the plan; Zonna adapts").

## Decision

**Recalibration after a benchmark is prompted and confirmed — never silent — and gated to paid via the existing R20 gate.**

1. **Trigger, not inference.** When a runner completes/logs a **recalibration-week time trial** (a `hard` session in a `meta.recalibration_weeks` week) with a result, the app surfaces a **prompt** to apply it — it does not silently rewrite the plan. A single 5K is a noisy signal (heat, sleep, pacing); §69 / ADR-012 require a structural change to *earn confirmation*, and a forward-pace rewrite is structural by definition. This also matches ENGINE-01 / §65, which designed recalibration as a prompt.

2. **Application is the existing path.** On confirmation, the entered time flows through `applyRecalibration()` → `/api/recalibrate-zones`. No new rewrite engine — the reshape layer already exists and is correct. The result is a plan-wide forward pace/zone rewrite from the current week, saved via `savePlanForUser` (which archives on race-identity change per ADR-013; a recalibration is same-race, so no archive churn).

3. **Free vs paid — gate intelligence, not correctness.** The time trial itself, and the honest copy ("log the result and your paces update"), are **FREE** (shipped in PV2-D) — a free plan must not lie. The **automatic forward rewrite** is **PAID** (`dynamic_reshape_r20`, already the gate on `/api/recalibrate-zones`). A free user who logs a time trial sees the honest upsell, not a broken promise; a paid user gets the living plan.

4. **The `fitness_signal` bridge is fixed at the source.** The time trial must be visible to the recalibration prompt. Two options — the ADR chooses **(b)**:
   - (a) add `'hard'` to `QUALITY_TYPES` in `adjust-plan` — rejected: it would also feed the AEF/zone-drift signals, which must not treat a maximal effort as a normal quality session.
   - (b) a **dedicated recalibration-completion trigger** that watches specifically for a completed `hard` session in a `recalibration_weeks` week and raises the prompt. Isolated, so it can't contaminate the other signals.

## Consequences

- **Blast radius (per ADR-012 cascade):** a forward pace rewrite changes what "in zone" means, so `coaching_flag` on *subsequent* runs is computed against the new zones — correct and intended (same shape as the HR-correction cascade in the 2026-08-06 incident). The reshape is a structural change → it surfaces a confirmation tile (ADR-012 magnitude), not a silent apply.
- **R18 confidence** is unaffected (no plan-shape change; paces only).
- **R24 multi-race:** recalibration applies to the active plan's forward weeks only.
- **What we explicitly do NOT do:** silently rewrite the plan off one time trial (rejected — noise + contradicts ADR-012/§69), or gate the *time trial* or its *copy* behind paid (rejected — that's correctness, not intelligence).

## Implementation (PV2-H)

1. Recalibration-completion trigger (option b) — detect a logged `hard` session in a `recalibration_weeks` week; raise a pending recalibration prompt.
2. Prompt surface — reuse the pending-adjustment tile pattern (no modal) → confirm → `/api/recalibrate-zones` with the entered/measured time.
3. Paid gate reads through `dynamic_reshape_r20` (already in place). Free tier: the honest upsell copy (already shipped, PV2-D).
4. Tests: trigger fires only on recalibration-week `hard` completions; confirmed apply rewrites forward paces; free tier gets the prompt-to-upgrade, not the rewrite.

*Coaching rationale in `CoachingPrinciples.md` §65/§78; magnitude/confirmation in ADR-012.*
