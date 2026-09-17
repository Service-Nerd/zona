# Coaching Board — 2026-09-17 — RAMP-GUARD-FAILS-OPEN-01

**Question:** should `INV-PLAN-DELIVERED-RAMP` (§94, enforcing §2 at delivery) drop its
TRIMABLE arm and report on the whole-week delivered rise alone?

**Trigger:** `CoachingPrinciples.md` §94 · `generationConfig.ts` · `invariants.ts` — **hard**.
§94's own text states the both-breach condition verbatim.

**Filed by:** Hutchinson, 2026-09-16 at the LR-CAP-BLIND-01 sitting — *"a load guard that
goes quiet exactly when things are worst."*

**Ruling:** **CORRECT WITH AMENDMENT.**

---

## The measurement

2,799 generated plans · 14,515 healthy non-deload non-taper week-pairs · cohortGrid +
targetedGrid, coprime-stride sampled.

| | count | share of candidates |
|---|---|---|
| Weeks breaching §2's own claim at delivery (whole-week rise > cap+10% and > 3 km) | **926** | — |
| Reported by the guard | 562 | 60.7% |
| Silenced — below chronic load (legitimate, rebuilding to held load) | 162 | 17.5% |
| Silenced — early return (trimable flat or down) | 22 | 2.4% |
| Silenced — both-must-breach (trimable under cap) | 180 | 19.4% |

⚠️ **Of the 202 silenced by a trimable arm, 202 of 202 had the long run GROW. Zero were
the false-positive class the arm was written to prevent.**

## Conflict scan

- **§94** — directly amended; the both-breach clause is in its principle text.
- **§52** — ⚠️ **the enforcing code misstated it.** The comment justified the arm on the
  long run being *"§52-exempt… not permitted to trim"*. §52 is a 60% **ceiling** and its
  FIRST named lever is *"(a) reduce the long run"*. Below 60% it grants no protection at
  all. Only 25 of 202 (12.4%) were near the ceiling. A protection was invented in a
  comment and then relied upon.
- **§45** — ⚠️ **the root mechanism.** All 202 jumps are legal under §45, and **all 202
  are legal only via its `+5km absolute` allowance** (`+20% OR +5km, whichever is
  greater`). On an 8 km long run that is **+63%**.
- **§2** — no conflict; §94 already gates on exceeding `current_weekly_km`, and §2 frames
  risk as acute-to-chronic.
- **§90 / ADR-022** — no conflict; injury-history runners excluded and covered more strictly.
- **§100** — no conflict; different mechanism.
- **§34** — compatible; stays `warn`, declared and exercised.
- **§1 noise standard** — 5.3% of week-pairs, 23.3% of plans. Precedent: Willy rejected a
  check at 71%; `INV-PLAN-PEAK-NOT-BELOW-START` acknowledged at 29.2%.

## The seats

- **Hutchinson (chair).** The measurement partly corrects the filing. The arm is not badly
  designed — it has simply never once performed its stated function. A plausible mechanism,
  written into a comment, never measured. Report it.
- **Seiler.** §94 was written for a spike created by a *quality* trim handing its deficit
  forward. These 202 are pure aerobic growth in one long easy run — a physiologically
  distinct exposure. §1 is untouched (session counts don't move). No objection, but the
  message must distinguish the two or one code gets read as one thing.
- **McMillan.** The engine has no lever: the long run is race-anchored and §45 permits the
  jump. A warning that reads as "the engine failed" when it did not is how runners learn to
  ignore warnings. Not against reporting — 8 km to 13 km is a jump he'd flag out loud —
  against reporting it *as a violation the engine failed to prevent*.
- **Willy.** This is the session that breaks people. Weekly volume is an abstraction; the
  long run is a single continuous bout where bone and tendon load accumulate, and a 63%
  step in it is the acute-on-chronic pattern seen in clinic — *less* alarming to the runner
  precisely because it is aerobic. 23.3% is acceptable; 71% was not.
- **Sims.** Sharp step up in the longest weight-bearing bout is the classic bone-stress
  setup, and the risk is not evenly distributed — higher in female runners, with low energy
  availability, and peri/post-menopause. The engine **cannot know sex** (`INPUT-SEX-01`,
  parked), so the load signal is the only lever left. Report it.

## Recorded disagreements

1. **McMillan vs Willy/Sims — actionability.** Resolved by amendment, not by vote: the
   message names the long run as the driver, so it reads as coaching. McMillan accepts.
2. **Willy vs the chair — scope.** Willy wants §45's `+5km` absolute allowance revisited on
   a small base. The chair agrees the evidence points there but will not change what the
   engine PRESCRIBES the day before the charity showcase on a measurement taken that
   morning. **Filed as `LR-ABS-CAP-LOWVOL-01`, not folded in.** What would settle it: the
   same measurement with the allowance scaled on a small base, plus a `cohort:shape` diff.

## Artifacts

1. **Principle** — §94 Amendment 1.
2. **Numeric** — `GENERATION_CONFIG.DELIVERED_RAMP_LR_ATTRIBUTION_PCT` (50).
3. **Invariant** — `INV-PLAN-DELIVERED-RAMP` rewritten (both trimable arms removed, driver
   attributed) + `plan-invariants.md` row.

## Verification

Live `validatePlan` over the same 2,799 plans **after** the change: **764 violations across
651 plans (23.3%)** — matching the prediction exactly. 197 attributed long-run-led, 567
trim/other. Property sweep: `INV-PLAN-DELIVERED-RAMP` 6.3% (1,014/15,974), no new errors.
`npm run verify` exit 0.
