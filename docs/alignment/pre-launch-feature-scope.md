# Pre-Launch Feature Scope

**Status:** Parked 2026-04-23 — resume tomorrow  
**Goal:** Complete before friends/TestFlight handoff

---

## Agreed build list

| # | Release | Feature | Tier |
|---|---------|---------|------|
| 1 | R23b | Plan generator wizard UX — one question per screen, progress indicator | PAID |
| 2 | R18 | Plan confidence score | PAID |
| 3 | R22 | Blockout days | PAID |
| 4 | Adj-A | Plan adjustment Trigger 1: session move + Confirm/Revert | PAID |
| 5 | Adj-B | Triggers 2+3: skip (with reason) + silent miss detection | PAID |
| 6 | Adj-C | Triggers 4+5: fatigue-driven softening + RPE disconnect coaching | PAID |

## Suggested build order

1. **R23b** — wizard UX (self-contained, no dependencies)
2. **R18** — confidence score (RPE/fatigue data already in DB ✅)
3. **R22** — blockout days (plan engine addition)
4. **Adj-A** — session move trigger (proves the pipeline end-to-end)
5. **Adj-B** — skip + miss detection (extends Adj-A)
6. **Adj-C** — fatigue softening + RPE coaching (extends Adj-B)

---

## Context on R23b

R23 (shipped) is a multi-field form — 3 screens for free, 4 for paid. R23b is the UX upgrade to one question per screen with a progress indicator. Backend is unchanged. Russ thought this was already done — it isn't.

---

## Open decisions blocking Adj-A/B/C

Need Russ's answers before build begins:

1. **Skip semantics** — should "skip" have a reason selector (fatigue / life / injury / other) so the plan responds differently? Or is a skip just a skip?
2. **Miss detection** — how long after a session day passes before it's "missed"? Next morning on app open?
3. **Fatigue softening rule** — how many consecutive Heavy/Wrecked tags before the plan softens? What's the action — swap intervals for easy, reduce distance, add a rest day?
4. **RPE disconnect** — high RPE on easy session: coach note only, or plan change? (Parked doc recommendation: coach note only.)
5. **Confirm/Revert vs silent** — which adjustments auto-apply, which need user approval?

---

## Infrastructure already in place

- `plan_adjustments` table in Supabase ✅
- `POST /api/adjust-plan` route ✅
- `PendingAdjustmentBanner` + `AdjustmentBanner` components ✅
- `user_settings.dynamic_adjustments_enabled` toggle ✅
- Two bugs already fixed (week-scoped adjustment count, toggle gate) ✅

**What's missing:** the triggers. Nothing generates adjustments. Pipeline runs, never starts.

---

## Note on R20 in backlog

Backlog R20 is labelled "dynamic plan reshaping" but what shipped is the Strava coaching pipeline (run analysis, EF trends, zone drift, weekly reports). The actual plan-mutation engine is the Adj series above — not started.
