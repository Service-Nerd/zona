# Coaching Board — the B3 raised list (ADR027-B3-REMAINING)

**Sitting:** 2026-11-22, one sitting, batch (founder: *"Run the coaching board sitting"*).
**Trigger:** soft. The port of every old-checker rule into the ADR-027 verifier copied the old checks' gaps, labels and
literals faithfully instead of fixing them, so that agreement with `validatePlan` would mean something. This sitting
rules on each: keep, or fix, and whether the fix changes what a runner is prescribed or only what the checker sees.
**Not re-opened:** `INV-PLAN-LARGEST-SESSIONS-SPACED`'s *value* (the Willy / Seiler–McMillan disagreement recorded in
`coaching-rulings.md` stays unsettled). Item A3 below is a different question: the check compares km with minutes.

---

## 📐 Measurements taken before any seat spoke

Two populations, both read-only. **Production:** all 43 stored plans (39 race, 4 base-build, 0 maintenance), counts only.
**Engine:** the 37-plan golden corpus at its pinned date, the corrected check run beside the old one.

| # | Question | Production | Engine (golden) |
|---|---|---|---|
| M1 | A run on the eve of a **Monday** race (the old check never looks at the previous week) | 0 Monday races live | **4 of 37 plans; all four are the LONG RUN, 63–85 min, the day before the race** |
| M2 | A race-eve run set by **distance only**, which the old check prices at 0 minutes | **1 plan** | 0 |
| M3 | An empty race-week easy run or shakeout (the old check skips race week) | 0 | 0 |
| M4 | Spacing rule ranks sessions by `distance_km ?? duration_mins` (km against minutes) | 6 plans mix the two | 17 weeks change their two largest sessions once minutes are priced; **11 old flags are false, 3 real problems missed** |
| M5 | Early onset for an assessed beginner who declared experienced | 0 | 0 (latent: the producer gates it) |
| M6 | Plan's own intensity level unset, so checks fall back down a chain of the plan's labels | — | 14 of 37 (every beginner plan); 0 disagree with the runner where set |
| M7 | Peak week's stated km differs from its delivered sessions by more than 1 km | — | 6 weeks |
| M8 | Long run read as race-pace by its LABEL alone (no segment stamp) | **0** | — |
| M9 | Step-back week known only by a note string | **1 plan** | — |
| M10 | Race plans on the no-benchmark fallback paces (`PACE_GUIDE`, outside config) | **18 of 39** | — |
| M11 | Base-build zone label with no HR target behind it | 0 | — |
| M12 | Quality sessions with no catalogue stamp | 19 of 216 | — |

---

## 🔍 Conflict scan (amendments included)

- **§39 Amendment 1** — race eve is protected *"expressed as days-before-race … so it generalises to any race weekday"*.
  M1 breaks it in the engine itself; the old check cannot see it. **§77** already names the Monday race as an open
  cross-week case (`PV2-G`).
- **§9** — every placed session carries a distance or a duration; race week is not exempt in the text.
- **§7** — the two largest sessions sit `MIN_HOURS_BETWEEN_LARGEST_SESSIONS` apart; "largest" is load, not a number in
  mixed units.
- **§89 / §91** — the early-onset gate is a readiness veto on the *runner*.
- **§84 Am. 1** and `BASEBUILD-ZONE-CEILING-01` (2026-10-10) — a zone shown on a base-build plan has a target; the check
  written for it sits where no base-build plan is ever validated.
- **§30** — the shakeout is RPE ≤ 3; the 3 lives as a literal in the checker.
- **§57** — `FOUNDATION_WEEKLY_INCREASE_PCT` (10) exists; the checker uses a literal 1.10 beside it.
- **StrengthPrinciples S13 / S14** — an eased session only takes away; a load never jumps. Production never runs either.
- **Configuration Singularity** — the no-benchmark paces (`PACE_GUIDE`) are coaching numbers with no principle section.

---

### 🏃 Alex Hutchinson (Chair)
The cleanest finding in this list is the one nobody filed: **a long run the day before a Monday race**. It is not a
checker gap, it is a plan we hand over, and §39 Am. 1 already forbids it in words. That one is a defect against
documented intent and goes to the founder as an engine defect now, not to B4. On the self-label reads I hold one line:
**a check that reads the plan's own description of itself is circular** — it proves the plan is consistent with its
label, not that it is right for the runner. The verifier must read the runner (the L1 profile, the request) and what the
sessions actually deliver. Construction records are different: a staged plan's door, a maintenance plan's source base
volume, the stored request — those are facts the plan wrote down when it was built, and reading them is fine.

### 📊 Stephen Seiler
M4 is a measurement error, not a coaching question: ranking a 30-minute run above a 10 km run because 30 > 10 is
arithmetic in two units. Price minutes as kilometres at the runner's easy pace, then rank. That removes 11 false flags
and finds 3 real ones, and it does not touch the unsettled question of whether the rule should fire for weekend-only
runners. The literal fractions (0.855, 0.84, 0.975) are Daniels' — facts, exempt as algorithm constants. The **0.97
discount** applied to VDOT in the 5K/10K cap is not a Daniels number; it is a choice and belongs in config.

### 🎯 Greg McMillan
Every one of these divergences makes the gate stricter. Stricter is right; **surprising** is not. Before the founder
signs off the cut-over, the nightly check (step 3) must report how many live plans the corrected checks would flag. If
the strict verifier refuses a runner the old one passed, we find out from a count, not a complaint. On the labels: the
legacy label fallbacks are dead weight once no stored plan needs them — M8 says none does for the long run, M9 says one
plan still needs the step-back note. Keep the note read while that plan exists; drop the long-run label read.

### 🩹 Rich Willy
Two of these are injury safety. **The early-onset veto (M5) must read the runner's assessed level, not the plan's
label** — it is latent today only because the producer happens to gate it, and a veto that depends on the producer's
correctness is not a veto. And **S13 is never run in production**: an eased session for a runner whose recovery is
suppressed is served without the check that it only takes load away. That is the session where a defect hurts most.
Race eve (M1): a 63–85 minute long run the day before a race is fatigue the runner cannot clear. Fix it in the engine.

### ⚕️ Stacy Sims
M10 is the one I would not let pass quietly: **18 of 39 live plans** run on fallback paces nobody can trace to a
principle. Those runners have no benchmark, which skews toward the newer, often older or returning women this product
says it serves. A pace table they train on for twelve weeks needs provenance like every other coaching number. On the
HR-assumption exemption for an *observed* max: an observed max is an assumption until it is measured, and the plan
should say so — but only if the plan records where its max came from, and it does not yet.

### 💪 Richard Blagrove (strength)
S13 and S14 are the two rules that protect a runner on a bad day and a runner adding load. Both exist, both are
falsified in the old suite, and neither runs in production. Run them in the strength route — S13 on every eased
session before it is served, S14 on every load suggestion. Nothing about the prescription changes; the check does.

---

## ⚡ Recorded disagreements

- **How strict, how soon (McMillan vs Hutchinson).** Hutchinson: the circular self-label reads are wrong and the verifier
  should stop copying them now. McMillan: correct, but switch them on only after step 3 has counted what they would
  flag on live plans. **Settled at the sitting:** McMillan's order. The strict readings are built now, run observe-only
  nightly, and the count goes to the founder with the cut-over request.
- **The observed-max assumption (Sims).** Not ruled: the plan does not record its max HR's source, so the fix needs data
  the plan does not hold. Filed, not settled.

---

## ⚖️ Rulings

### A — the engine prescribes something its own principle forbids
| Item | Ruling |
|---|---|
| **A1. Long run on the eve of a Monday race** (M1: 4 of 37 golden plans; 0 live) | 🔴 **INCORRECT PRESCRIPTION — a defect against §39 Am. 1.** No session within `RACE_EVE_PROTECTED_DAYS` of race day may exceed §30's cap, across a week boundary. Engine fix required. The current engine is frozen except hotfixes (ADR-027): **escalated to the founder** to decide hotfix now or fix in B4. Either way the verifier checks across the week boundary. |

### B — the checker misses what the principle says (fix the verifier; prescription unchanged)
| Item | Ruling |
|---|---|
| B1. Race eve: the previous week's Sunday before a Monday race; a distance-only session priced at 0 min (M2: 1 live) | 🟢 **CORRECT — fix.** Look across the week boundary; price a distance-only session at the runner's easy pace. |
| B2. Empty race-week easy run or shakeout passes (M3: 0, 0) | 🟢 **CORRECT — fix.** §9 has no race-week exemption. Latent. |
| B3. Spacing ranks km against minutes; skips only `type` deloads (M4) | 🟢 **CORRECT — fix.** Rank by kilometre-equivalent at the easy pace; treat a badge-only deload as a deload, like every other deload rule. The rule's VALUE stays unsettled (prior disagreement). |
| B4. Early-onset veto reads the plan's level chain (M5: latent) | 🟢 **CORRECT — fix (Willy, binding).** Read the L1 profile's assessed intensity level. |
| B5. Longest-run-not-in-base reads only the first long run, an unpriceable one as 0 km | 🟢 **CORRECT — fix.** Every long run; an unpriceable one is unverified, never 0. |
| B6. Race-pace long-run build window reports only the first streak | 🟢 **CORRECT — fix.** Report every streak. |
| B7. `NO-INVENTED-AGE` reported once per week | 🟢 **CORRECT — fix.** Once per plan. |
| B8. An empty `prep_time_alternatives` list passes | 🟢 **CORRECT — fix.** An empty list is no alternatives. |
| B9. Time-trial spacing on a session stored under a non-day key | 🟢 **CORRECT — fix.** Unverified, not an arbitrary gap. |
| B10. Quality-variety bound counts race-week pool entries | 🟢 **CORRECT — fix.** The bound uses the same weeks it counts. Latent. |
| B11. `QUALITY-EXPECTED` and the maintenance injury rule match injury and strides in free TEXT | 🟢 **CORRECT — fix.** Use the injury-chip owner (`hasInjuryKeyword`) and the stride signal the foundation rule reads (coach notes), not the label. |
| B12. Maintenance race-specific rule reads a `category` sessions never carry (0 live maintenance plans) | 🟢 **CORRECT — fix.** Read the category of the session's catalogue row. As written it can never fire. |
| B13. Coach-notes intent decided from the label | 🟢 **CORRECT — fix.** Decide VO2 and goal pace structurally (`classifyStimulus`, `workClassFor`), per INV-CLASS. |
| B14. Run-walk "peak" is the largest session of any kind | 🟡 **CORRECT WITH AMENDMENT.** Fix to the long run **if** §117's text means the long run; the builder confirms the reading before changing it. |
| B15. Long-run label fallbacks (`PEAK-LR-ALTERNATION`; held `RACE-SPECIFIC-LONG-RUN`) | 🟢 **CORRECT — drop the label arm** (M8: 0 live plans need it). Port `RACE-SPECIFIC-LONG-RUN` stamp-only. |
| B16. Step-back known by a note string (M9: 1 live plan) | 🟢 **KEEP while any stored plan needs it**; drop when the count is 0. |
| B17. `LABEL-MATCHES-STRUCTURE`'s redundant skip | 🟢 **KEEP.** Harmless, and right if a row ever produces the word. |
| B18. Held label-matching rules (`INJURY-NO-HILLS`, `RACE-WEEK-SHARPENING`) | 🟢 **Port on structural signals** (catalogue category, stimulus), never the label (D-17). |

### C — the checker trusts the plan's description of itself
| Item | Ruling |
|---|---|
| C1. Self-label reads: level, goal, distance, injuries, `volume_profile`, peak `weekly_km` labels, peak target (M6, M7) | 🟢 **CORRECT WITH AMENDMENT (McMillan's order).** The verifier reads the RUNNER (L1 profile, request) and the DELIVERED sessions, never the plan's label for itself. Construction records (stored request, staged door, source base volume, start km) stay readable. **Built now, run observe-only in step 3, the count reported with the cut-over request.** |
| C2. `ONSET-YIELD-BOUNDED` compares two numbers the planner stamped | 🟢 **KEEP as a consistency check, named as such.** It cannot catch the ladder being wrong; a real check belongs to B4's constraint layer. |

### D — numbers outside config
| Item | Ruling |
|---|---|
| D1. Daniels fractions (0.855, 0.84, 0.975) | 🟢 **KEEP inline** — algorithm constants, exempt. |
| D2. The 0.97 VDOT discount in the 5K/10K long-run cap; the shakeout RPE 3 (§30); the foundation ramp 1.10 (duplicates `FOUNDATION_WEEKLY_INCREASE_PCT`) | 🟢 **CORRECT — name them.** The ramp reads the existing constant; the RPE cap and the discount become named rule parameters. No value changes. |
| D3. Check tolerances (±3%, ±5%, 0–3%, the 10% rounding tolerance) and row lists (fixed-shape, fast-float) | 🟢 **CORRECT — rule data.** Tolerances become the rule's parameters in the catalogue; row lists become a row attribute, not a list in the checker. |
| D4. `PACE_GUIDE`, the no-benchmark paces (M10: **18 of 39 live plans**) | 🟡 **INSUFFICIENT EVIDENCE on the values.** They need a principle section and provenance before B4 adopts them. Values unchanged until then. **Filed for its own sitting (Sims carrying).** |

### E — rules that do not run where they should
| Item | Ruling |
|---|---|
| E1. `ZONE-LABEL-HAS-PRESCRIPTION` can never run (M11: 0 live hits) | 🟢 **CORRECT — make it live where its population is:** the base-build route. Restores `BASEBUILD-ZONE-CEILING-01`'s intent; 0 false positives today. |
| E2. S13 and S14 never run in production | 🟢 **CORRECT (Willy, Blagrove).** The strength route runs S13 on every eased session before serving it and S14 on every load suggestion. Prescription unchanged. |
| E3. `STAGED-DOOR-RATIO` judges the door by building a race block | 🟢 **HELD to B4** — a check that runs the planner is the producer checking itself. |
| E4. The 13 other held rules (planner derivations) | 🟢 **The cut-over gate is the verifier PLUS these 14 old checks**, named in the founder's sign-off, until B4 gives each an independent derivation. An incomplete gate must say it is incomplete. |

---

## 📦 Artifacts

Every CORRECT ruling here restores documented intent or moves a check, so **no new principle, numeric or invariant is
authored at this sitting.** Each fix lands with the checker change and its own falsified test. The exceptions are named:
- **A1** is an engine defect: the founder decides hotfix or B4. The invariant already exists (`INV-PLAN-NO-RACE-EVE-SESSION`); it gains the cross-week arm.
- **D2** adds named parameters (`RACE_WEEK_SHAKEOUT_MAX_RPE`, the 5K/10K VDOT discount) at the next doctrine edit, values unchanged.
- **D4** needs a principle section in its own sitting.

## ↗️ Escalations
- **Founder:** A1, hotfix the frozen engine now or fix in B4. And the cut-over sign-off must name the 14 held rules
  and the step-3 count of what the strict readings flag.
- **SLT:** none.
