# Coaching Board — `STAGED-RAMP-RATIO-16W-01` (2026-11-20)

**Trigger:** backlog item (🏃 COACHING BOARD). **Question:** `INV-PLAN-GET-RUNNING-BUILD-RATIO` fires at 4.17× against
§111's 4.0 on the staged path; `GET_RUNNING_MAX_WEEKS = 15` prevents it on §118's path and the staged path's
`placed.rampWeeks` does not read it. Which side yields — the week count or the ratio?
**Evidence:** `scripts/board-evidence-getrunning-four.ts` sections 3 and `--item3` (READ-ONLY).

## Analysis (written before any seat spoke)

**The item's figures, re-derived.**

| item says | re-measured 2026-11-20 |
|---|---|
| fires **6** times, *"on the staged path, today"* | **0 through the engine.** 276 staged plans on the ruler grid; **2,445** on a wide integer grid (HM, marathon, 50/80/100 km; cw 0–20; lr 0–6; runways 16–80 weeks; ages 35 and 50) — **0 firings, longest staged ramp 13 weeks.** Further probes (ultra 5,936 staged; masters 1,704; runways to 104 weeks 1,428): **0**. Production: 2 staged plans, ramps 7 and 3 weeks, **0**. |
| the mechanism: 16 weeks of 10% under §3 compounds to **4.17×** | **confirmed in the producer.** `generateStagedRacePlan` called directly with doors from 8 to 40 km: **546 of 3,840** fire, ramps up to **21 weeks** and **6.72×**; the first firing is exactly **16 weeks, 4.17×** (HM, `cw 1`, door 25). |
| `placed.rampWeeks` does not read `GET_RUNNING_MAX_WEEKS` | **confirmed** (`stagedRacePlan.ts:82–90`: `rampWeeks = needed ≤ maxRamp ? needed : maxRamp`, `maxRamp = runway − §44 block`, no cap) |

**What moved.** The 6 were found 2026-11-12 on a grid not committed anywhere I can find (the build-log names a
*"3,264-row production-shape grid"*, built partly by calling producers directly). Through `runEngine`, §111's doors
are low enough (door = ⌈race peak ÷ 4⌉) that the ramp from 6 km — or from the runner — reaches them in ≤ 13 weeks. **So
this is a LATENT producer hazard: the producer will build past 4.0 if ever handed a door ≥ ~25 km from a floor start,
and the engine does not hand it one today.** Same shape as `GETRUNNING-WALKRUN-FLOOR-01`'s 2,304, which was a latent
count, not an impact figure.

**Both severities are as stated:** `error`, throws in dev/test, `console.error` only in production, so if it ever
became reachable a runner would receive it.

**What the evidence can and cannot show.** It shows the engine route is clean across every grid I could build and that
the producer is not. It cannot prove no input reaches it (a grid is not a proof), and it cannot show what a future
change to door selection, ramp rate or deload cadence will do — which is the reason the checker was made independent.

**Settled-ground scan.** §118 Am. 2 (Willy, 2026-09-20): *"I will not have two total-build ceilings in one
constitution differing by 0.17 because one of them was measured off a 16-week curve"* — §111's 4.0 reused, the week
count is *"one way to stay inside the ratio"*. `STAGED-DOOR-AT-CAP-01` (the chair declined a buffer). §116 Am. 11
(the door lands the block inside §111's ratio). Nothing settled is re-opened.

## 🔍 Conflict scan

§2 (10% week-on-week), §3 (4:1 deloads), §111 (`MAX_BASE_BUILD_RATIO`), §116 Am. 11, §118 Am. 2, §44 (block weeks).
**Yielding the RATIO would contradict §118 Am. 2 and §111 Am. 3** (the reckless ceiling is a ratio). **Yielding the
WEEK COUNT conflicts with nothing**; it only asks where surplus runway goes, which §118's producer already answers
(*"it builds for the weeks available, at §2's rate, under §3's cadence, and stops"*).

## Seats

**🏃 Hutchinson (chair).** One ceiling. The question was ratified in September and the answer was Willy's; this is the
second producer catching up with it.

**📊 Seiler.** No intensity content.

**🎯 McMillan.** Surplus runway is not a problem to solve with more building. A runner whose ramp stops at 4× and then
holds for a few weeks before the checkpoint arrives fitter, not behind. What I do not want is the checkpoint moved so
early that the race block becomes longer than the race needs; hold the volume, keep the checkpoint where the door is.

**🩹 Willy.** The ratio stands, and I am glad it is latent. Every week legal and the sum not is the exact failure §118
Am. 2 was written for. The staged ramp must read the same bound as §118's: stop the build at the ratio. Weeks past that
hold at the reached volume with §3's deloads continuing; no step up.

**⚕️ Sims.** Concur. The cohort that reaches a long staged ramp is the lowest-base cohort, the one Am. 2 was
ratified on.

**💪 Blagrove.** Silent.

## ⚡ Recorded disagreements

None on the ruling. McMillan's condition (keep the checkpoint where the door is; do not lengthen the race block) is
adopted.

## ⚖️ Ruling — CORRECT WITH AMENDMENT: the week count yields; the ratio does not

1. **No base-build ramp, staged or §118, may build past `MAX_BASE_BUILD_RATIO` from its own start.** The staged
   producer's ramp length is bounded by the same bound §118's producer reads (today expressed as
   `GET_RUNNING_MAX_WEEKS`; the build may derive the bound from the ratio itself rather than duplicate 15).
2. **Runway beyond the bound HOLDS** at the reached volume, §3's cadence continuing, until the checkpoint; the
   checkpoint is not moved earlier and the race block is not lengthened.
3. **The checker stays independent and `error`.** It is not weakened to match the producer.
4. **Latent today:** 0 of every engine-route staged plan measured; the build is a producer fix with no runner-visible
   change expected, to be confirmed by parity on staged plans.

## 📦 Required artifacts (at build)

1. **Principle** — §118 Am. 2 note: the bound applies to every base-build ramp, staged included; surplus weeks hold.
2. **Numeric** — none new (`MAX_BASE_BUILD_RATIO`, `GET_RUNNING_MAX_WEEKS`).
3. **Mechanical check** — existing `INV-PLAN-GET-RUNNING-BUILD-RATIO`; add a producer-direct test (door 25, `cw 1`,
   HM, runway 32 — today 16 weeks, 4.17×) that must come back ≤ 4.0, falsified against today's producer.

## ↗️ Hand-offs

None. SLT escalation: none.

## What this does not prove

- That no real input reaches the producer hazard through the engine — 0 on every grid built, not a proof.
- How the 2026-11-12 grid produced 6 engine-route firings; it was not committed and could not be re-run.
- What "hold" looks like week by week; that is the build's to show, and a hold of more than a few weeks was not seen
  on any grid because none produced a capped ramp through the engine.
