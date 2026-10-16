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
