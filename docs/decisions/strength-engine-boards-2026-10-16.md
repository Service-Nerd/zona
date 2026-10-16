# STRENGTH-ENGINE-01 — Coaching Board + SLT, 2026-10-16

**Input:** founder brief (a separate, PAID strength & conditioning engine; side project; possibly its own app).
**Architecture:** `docs/architecture/ADR-024-strength-engine.md`. **Evidence:** `docs/investigations/strength-conditioning-research-2026-10-16.md`.

## Coaching Board — CORRECT WITH AMENDMENT / INSUFFICIENT EVIDENCE on numbers
Full ruling in `docs/canonical/coaching-rulings.md`. Headline: heavy legs are a §7 stressor (stack after a quality run,
else an easy day 48 h clear, else upper/core, never skip); plyometrics under §21; general = running legs + upper body;
no injury-prevention claim; numbers wait for the ACSM 2026 stand. Guest S&C seat (Blagrove-modelled).

## SLT — BUILD DIFFERENTLY
Wholly PAID. Engine first, no UI, as a side project. Running-focused only in v1. UI when the December cohort is mid-plan,
Design Board first. Licensed animations, no embedded YouTube. Success measure: share of strength-plan starters completing
≥1 session/week over 4 weeks. Unpriced: conversion and churn (commercial seat stood down).

## Founder decisions (2026-10-16)
1. **S&C seat appointed** to the Coaching Board (modelled on Richard Blagrove's published positions; strength only).
2. **30 / 45 / 60-minute** sessions.
3. **v1 is running-focused only.**
4. **Admin-only at first**, via a release switch separate from the tier (admins resolve as `paid`).

## Founder, second round (2026-10-16)
5. ~~Core and upper body in every session~~ **Corrected by the founder:** core in most sessions; the **engine chooses
   the split** (full body vs upper/lower) from strength days per week. Proposed table in ADR-024 §6a, for the strength
   seat to rule at Phase 1.
9. **AI, cost-aware:** deterministic engine; AI as an authoring aid for the catalogue (human-reviewed) and an optional
   Haiku weekly note. ADR-024 §6b.
6. **General ships in v1** (overrides the SLT's "v2").
7. **A deep catalogue** (target 80+), **unilateral emphasis** for running focus.
8. **The goals (corrected by the founder):** injury prevention/resilience **and** achieving the goal without failing
   mid-plan, plus performance. Designed for, not promised: the no-claim ruling stands for copy.

---

## Coaching Board — Phase 0 sitting: the split and the v1 numbers (2026-10-16, second sitting)

**Trigger:** new strength doctrine (`StrengthPrinciples.md` v1, `STRENGTH_CONFIG`) — hard (new constitution).
**Proposed:** ADR-024 §6a split table plus the v1 numbers, now that the ACSM 2026 stand has been read
(`docs/investigations/strength-split-research-2026-10-16.md`).

### 🔍 Conflict scan
- **§7 (hard/easy, 48 h).** Heavy legs are a stressor. *Touches, does not contradict:* placement must keep §7's
  48 h between stressors, so heavy legs may not sit the day before a quality/long/race run, nor alone on the day
  after one. Stacking ON the quality day adds no new hard day and is preferred (first sitting).
- **§21 (injury-aware selection).** `HILL_RESTRICTING_INJURIES` is the impact list. Plyometrics reuse it **by value**;
  the strength package cannot import the run engine, so the bridge carries a parity test. *Consistent.*
- **§1 (intensity distribution).** Counts running sessions only (§1 counting rule). Strength cannot move it. *No conflict.*
- **§3 (recovery weeks).** A run deload week is a strength deload week: sets cut. *Consistent, extends.*
- **§6 (taper) and race week.** "Race week is for shakeouts." Strength mirrors it: no heavy legs inside 10 days,
  mobility only in the final 7. *Consistent.*
- **`MASTERS_AGE_THRESHOLD = 45`.** Reused for "masters" by value through the bridge, not redefined. *Consistent.*
- **FEATURE_GATES lines 1934–1935.** Tier, not correctness: SLT ruled wholly paid. Amended in the same commit, exempt.

### 💪 Blagrove (strength seat)
The table is right because the evidence says structure barely matters once volume is matched, so choose for fit.
Two amendments. **Running-focused never gets more than two heavy-leg sessions a week**, whatever the day count: a
third heavy-leg day buys nothing a runner needs and costs a §7 slot. And **plyometrics come after strength, not
with it**: no plyometrics in the first 4 weeks, none for `new` lifters in their first block, 30 contacts rising to
60. Heavy for running-focused lower body means 4–6 reps at 2 in reserve, after a technique block. Never to failure.

### 🏃 Hutchinson (chair)
The split table is inference: no trial has aligned a strength split to a run week. Fine, if
`StrengthPrinciples.md` says so in as many words. The numbers are reasonable defaults, not findings; ACSM 2026
itself calls minimal-dose and concurrent evidence insufficient. Ship them as tunable config with the evidence grade
beside each.

### 📊 Seiler
No objection. §1 counts running sessions; nothing here can move it.

### 🎯 McMillan
A runner who picks four days has told you something; honour it, but the engine should **recommend** two and say
why. A missed strength session is never made up the next day; the week just moves on. Thirty minutes must be a
real session, so the packer drops accessories before it shortens rest.

### 🩹 Willy
Agree with the two-leg-day cap. The tendon arguments (calf/soleus loading for Achilles history) are the strongest
injury-adjacent case and still not a promise. RIR floor of 1 everywhere, 2 on lower-body heavy work. Bone flag
removes high impact and loaded spinal flexion; it does **not** remove heavy work.

### ⚕️ Sims
Huiberts found no lower-body interference in women, so nothing here is male-derived to women's cost; if anything
women are under-prescribed load by default. Heavy is the destination for everyone, peri/post-menopausal included.
Masters keep two sessions in maintenance (older adults lose strength faster, Spiering). ⚠️ The app holds no sex or
menopause field, so nothing can be targeted; recorded, not blocking.

### ⚡ Recorded disagreements
- **4 days for running-focused.** McMillan: allow it. Blagrove: allow it, but legs stay at two. **Both satisfied by
  the cap**, so recorded as resolved.
- **Hutchinson vs Sims on whether to target menopause at all** if data existed: Hutchinson wants trial data first,
  Sims says the bone evidence (LIFTMOR) suffices. Moot until a field exists.

### ⚖️ Ruling: CORRECT WITH AMENDMENT
The §6a table stands, amended: **heavy-leg sessions ≤ 2 per week always**; **plyometrics gated by weeks of strength
and experience**; **engine recommends 2 sessions**; **RIR floor 1, lower heavy 2**. Numbers ship as `STRENGTH_CONFIG`
with their evidence grade in `StrengthPrinciples.md`.

### 📦 Artifacts
1. Principle — `docs/canonical/StrengthPrinciples.md` v1 (S1–S12)
2. Numeric — `packages/strength/config.ts → STRENGTH_CONFIG`
3. Invariants — `packages/strength/validate.ts → validateStrengthPlan()`, one per principle, each falsified

### ↗️ SLT escalation
None.
