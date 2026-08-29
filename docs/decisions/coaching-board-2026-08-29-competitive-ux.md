# Coaching Board Ruling — Competitive-UX data & difficulty (CD-21)

**Date:** 2026-08-29
**Convened by:** SLT routing — three items from the Planzy competitive review touch what the engine prescribes or what data it collects.
**Board:** Hutchinson (chair) · Seiler · McMillan · Willy · Sims
**Evidence:** `docs/investigations/competitive-ux-scope-2026-08-29.md` (§ Incoming, CI-3/CI-5/CI-6) + `planzy-wiz-*.png`
**Authority:** ADR-017. Continues the CD numbering (last: CD-20). **The vetoes below are binding — the SLT cannot overrule them commercially.**

**Status:** signed ruling. No artifacts ship yet — these are **gates on future build**, not a change landing today. When/if a cleared item is built, its three artifacts land in that commit.

**Written for:** a coach.

---

## What the board was asked

Three questions surfaced by the Planzy plan-generation wizard:

1. **CI-3** — should we collect **gender, weight, and height** like Planzy does?
2. **CI-5** — should the runner choose between **three difficulty tiers** (Easy / Optimal / Challenging)?
3. **CI-6** — should we **ask** the runner their easy pace, or keep **deriving** it?

## Rulings at a glance

| # | Question | Ruling |
|---|---|---|
| **CD-21a** | Collect weight + height? | **INCORRECT** — no engine use |
| **CD-21b** | Collect gender? | **CORRECT, conditional** — only as an honest foundation for future female-physiology work |
| **CD-21c** | A "Challenging — push harder" difficulty tier? | **INCORRECT — VETO** |
| **CD-21d** | Ask the runner their easy pace? | **INCORRECT to replace derivation**; ask only as a no-benchmark fallback |

---

## CD-21a / CD-21b — collecting gender, weight, height

**Today.** The engine prescribes from age (max HR via Tanaka), a fitness read (VDOT + volume), and heart rate. It never uses body mass, height, or sex.

**Why it was asked.** Planzy collects all three up front; the flow feels thorough.

**Ruling.**
- **Weight + height — do not collect.** A VDOT/HR/volume engine has no defensible use for them — there is no power or GPS data to compute running economy, and the plan carries no calorie or body-mass load model. Asking for them adds wizard friction and, worse, *implies* a personalisation the engine does not perform. "Ask only for what you will act on" (ADR-011, and the restraint the brand is built on).
- **Gender — collect only as an explicit, honestly-framed foundation for future female-physiology work.** The engine cannot act on sex today (max HR is age-only; VDOT is not sex-specific; cycle data is blocked by ADR-011). So collecting it must make **no promise** that it changes the current plan. Sims' position carried: sex is the prerequisite for any future female-specific coaching and is respectful to capture — but as decoration it is dishonest. **Whether to invest in that female-physiology roadmap is a commercial call → escalated to the SLT.** Until that roadmap is committed, gender collection is deferred.

**Conflict scan:** ADR-011 (collect only what you can act on), §50 (max HR = Tanaka, age-only), INV-DATA-001 (no feature requires uncollectable data). No zone-model impact.

## CD-21c — the three-tier plan (Easy / Optimal / Challenging)

**Today.** The engine builds **one** plan from the runner's inputs and classifies it honestly (a real build, or `maintenance` when the inputs can't support overload — §23).

**Why it was asked.** Planzy shows three tiers and lets the runner pick their "commitment level."

**Ruling: INCORRECT — VETO on the "Challenging = push harder" framing.**

A user-selectable "push harder" tier **sells the runner the exact mistake the product exists to correct** ("You're trying hard. That's the problem."). Every seat converged: the honest axis is not easy-vs-hard, it is *what the runner's inputs actually support*. A tier that stays inside the 10% rule (§2), the long-vs-easy ratio (§9) and the load caps is not really "more" — it is the same plan wearing a scarier label; a tier that loosens them is an injury vector (Willy: tissue tolerance doesn't care which tier was tapped) and a grey-zone-drift engine (Seiler: "challenging" usually means more Z3, the precise thing we remove). McMillan: amateurs self-select "challenging," then get hurt or quit — offering it is offering rope.

**Permissible reframe (the SLT may choose to build this — it is not vetoed):** an *honest* choice between plans that differ by the **constraint the runner is in** — e.g. "sustainable" vs "time-crunched / compressed" — every option obeying §2 / §9 / load caps. That is a commitment-and-honesty choice, not a difficulty upsell.

**Conflict scan:** §1 (the thesis), §2 (10% rule), §9 (long-vs-easy), §23 (peak-overload honesty). No zone-model impact.

## CD-21d — ask vs derive easy pace

**Today.** Easy pace is derived from VDOT/benchmark; sessions carry the computed target.

**Ruling: keep deriving.** Runners **systematically run their easy days too fast** — that is the core problem, so asking them to self-report the number anchors them to a likely-wrong pace (Hutchinson, Seiler). An ask is permissible **only** as the no-benchmark fallback, clearly flagged "we'll fine-tune after a few runs." The explainer copy Planzy pairs with it is good and is a brand matter — borrow it.

**Conflict scan:** §14 (five-zone model), VDOT derivation. No zone-label trap.

---

## SLT escalations from this board

1. **Is the female-physiology roadmap committed?** — the single call that resolves CD-21b (gender). Correctness-cleared; the invest/don't-invest decision is commercial.
2. **Build the *reframed* honest plan-choice** (sustainable vs compressed) instead of difficulty tiers? — permitted on correctness; the SLT decides whether it's worth building.

## Required artifacts

None now (nothing ships from a ruling that gates future work). **If** CD-21b (gender, conditional) or the CD-21c reframe is later built, each lands its three artifacts (principle § + config + `validatePlan()` invariant) in that commit. The two **vetoes** (weight/height; harder tier) need no artifact — they are decisions *not* to build.
