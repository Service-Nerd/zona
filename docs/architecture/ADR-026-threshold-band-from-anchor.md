# ADR-026 — Threshold is prescribed from its own pace anchor (ACCEPTED WITH CONDITIONS, not built)

**Status:** PROPOSED 2026-11-16. **Coaching Board: CORRECT WITH AMENDMENT (three conditions).** SLT: BUILD, FREE.
**Design Board: SHIP WITH AMENDMENT.** **Founder approved the direction 2026-11-16** ("one derived band, not five").
**Not built.** Condition 1 (the threshold/interval overlap) and the beginner exclusion are unresolved, and R1 below is
sequenced first.
**Item:** `THRESHOLD-BAND-ANCHOR-01`. **Report:** the 2026-11-16 intensity-model analysis.

## 1. The finding that shapes everything

The engine derives **pace** from Daniels fractions of VO2max and **heart rate** from Karvonen fractions of HR reserve,
and **never converts between the two scales**. For threshold work the two answers do not describe the same effort.

Measured from the code and from production (read-only, `wkppmpsvqkaxbekdgzdm`):

- 🔴 **`computeZones` can express exactly FOUR HR bands** — `easyHR`, `shakeoutHR`, `qualityHR`, `intervalsHR`
  (`lib/plan/zones.ts`). `hrBandFor` can return four values. **The entire threshold and tempo complex — nine
  catalogue rows — maps to one of them**, `qualityHR` = Z3 low–Z3 top = 70–80% HRR.
- 📐 **169 threshold-category sessions across 23 live plans; 164 carry `Zone 3`.**
- 📐 **Across 28 plans / 231 quality sessions the product shows a mean of 5.36 session names, 2.36 distinct paces
  and 1.18 distinct HR bands** (maximum 2, on every plan). The names and paces differentiate; the heart rate does not.
- 🔑 **The threshold floor IS the easy ceiling, by construction and on every persona.** `qualityHR` is
  `z3Low–z3Top` and `easyHR` is `< z2Top`; `z2Top` and `z3Low` are the same number. **A hard session's prescription
  begins exactly where easy running ends.**
- ⚠️ **A second, independent reach failure:** the catalogue already declares `tempo_over_under` and `cv_intervals`
  as `['Z3','Z4']`. All 19 live sessions carry `Zone 3`, because no band spans Z3–Z4 and `qualityZone` is the
  literal string `'Zone 3'`. **The catalogue's own Z4 declaration is unreachable for those rows.**

### The evidence

29 real runs (8 runners) whose average pace falls inside the prescribed threshold band. Of the **26** where the
Z3/Z4–5 split genuinely occurred:

| | |
|---|---|
| Time in **Zone 4–5** | **51%** |
| Time in Zone 3 | 26% |
| Runs spending > 1/3 above the ceiling | **19 of 26** |
| Mean peak HR above the prescribed ceiling | **13 bpm** |

The instrument is the engine's own: `bucketHRHistogram` buckets `pctZ4_5` as `hr > z3Boundary`, and `z3Boundary`
is the top of Z3 — **the very ceiling the session prescribes**.

⚠️ **The first measurement said the opposite.** Whole-activity average HR for those runs was 159 bpm / 75% HRR,
*inside* the band. It is diluted by warm-up, cool-down and recoveries. **Time-in-zone is the instrument; an average
over a session with a warm-up is not a measurement of the work.**

## 2. This was already ruled, and the ruling named what was missing

`CoachingPrinciples.md §84 Amendment 1` (Coaching Board, 2026-09-04) identified this and declined to act:

> *Hutchinson and Seiler both hold that neither current number is right for the work: `qualityHR`'s floor equals the
> Zone 2 ceiling … a 27-beat span is "a weather forecast, not a target" (Seiler). Narrowing that band is a real
> prescription change and **needs observed HR data for this cohort, which Zonna does not hold.** Its own ruling, not
> this one.*

**Both objections are now confirmed by measurement** (the floor equals the ceiling on all three personas; the live
band is 13–14 bpm wide), and the named settling artefact partially exists: **437 activities with HR, 373 with a full
bpm histogram, 24 users, 2026-04-24 → 2026-11-15.** This ADR discharges that ruling. It does not claim a controlled
measurement — see §6.

## 3. Options

| | Option | Verdict |
|---|---|---|
| A | **A zone per session type**, each with its own %HRR range and pace band (the original brief) | 🔴 **REJECTED on measurement.** Deriving every band from its Daniels fraction maps easy to **55–72% HRR**, crossing the Z2 ceiling and **raising the easy ceiling into the grey zone §1 exists to prevent — a §12 breach**. It also sends intervals to 95–100% HRR (178–185 bpm for a VDOT-41 runner), which is not an achievable average for 1 km reps |
| B | **Threshold at 85–88% HRR** (the brief's figure) | 🔴 **REJECTED.** ~3 points hot. The engine's own T fraction implies **81–87%**; 85–88% is nearer 10K effort |
| C | **Give "tempo" a slower band of its own** | 🔴 **REJECTED.** No support in the catalogue: `tempo_continuous` anchors to `T`, and a Daniels tempo run *is* T-pace. It differs from cruise intervals in structure, not intensity |
| D | **Change the zone table** | 🔴 **REJECTED.** Measured coherent (Karvonen Z3 = 79.3–86.2% of max against the declared 80–87%, mean gap 3.1 bpm), and moving `z3Boundary` would silently invalidate every stored `hr_pct_z*` — including the evidence base above |
| E | **One threshold band, derived from the pace anchor the session already uses** | ✅ **ACCEPTED.** One derivation instead of two, so the two prescriptions cannot disagree |

## 4. The decision

**R1 — One derivation, not two.** A threshold session's HR band is computed **from the pace anchor it already uses**
(`T`, 0.83–0.88 of VO2max) through the %HRR ≈ %VO2R identity, rather than from a zone constant chosen independently.

**R2 — The label follows the band.** The zone string is read off `GENERATION_CONFIG.ZONES` from the resulting band,
naming every zone it overlaps. This extends **§84 Amendment 1's own rule** — *"the zone string is DERIVED from the HR
target, not authored beside it"* — one step further back. It yields `Zone 4` for a trained runner and `Zone 3–4` for
a beginner, which is correct: the same T-pace session is a different fraction of two different runners' reserves, and
**a single hardcoded `'Zone 3'` cannot express that.**

**R3 — Scope is the threshold band only.** Easy, shakeout and interval bands unchanged. CV pace unchanged.

**R4 — A coherence invariant.** `INV-PLAN-HR-MATCHES-PACE`: for any session carrying both a `pace_target` and a range
`hr_target`, the band implied by the pace anchor and the prescribed HR band must overlap by at least a declared
tolerance, or generation fails at `error`. For threshold this is satisfied by construction after R1; **its job is the
next band that drifts.**

### Before and after

| Persona | Threshold pace | Now | Proposed |
|---|---|---|---|
| max 185, rest 48, VDOT 41.0 | 5:07–5:22 /km | Zone 3, 144–158 bpm (14 bpm wide, floor = easy ceiling) | **Zone 4, 160–167 bpm** (7 bpm) |
| max 190, rest 50, VDOT 44.6 | 4:47–5:01 /km | Zone 3, 148–162 bpm (14 bpm, floor = easy ceiling) | **Zone 4, 164–172 bpm** (8 bpm) |
| max 191, rest 60, VDOT 20.2 | 8:53–9:17 /km | Zone 3, 152–165 bpm (13 bpm, floor = easy ceiling) | **Zone 3–4, 164–172 bpm** (8 bpm) |

Computed by calling the real producers (`computeZones`, `buildPaceFromVDOT`, `calcVDOT`), not by hand. **No pace
moves.** Seiler's "27-beat span" objection is discharged (14 → 7 bpm) and Hutchinson's floor objection is discharged
(+12 to +16 bpm clear of the easy ceiling).

## 5. 🔴 The condition that is NOT resolved

**The proposed threshold floor (160 bpm for a VDOT-41 runner) is above the current interval floor (158 bpm)**, because
`intervalsHR` is `z4Low–max` and `z4Low` is the same number as `z3Top`. **Threshold would sit inside intervals.**

Today the two bands are contiguous and tidy — threshold ends at 158, intervals begin at 158 — and that tidiness is the
artefact of both being wrong in the same direction. Fixing threshold exposes that the interval floor is the same number.

📊 **Seiler, blocking:** *"do not ship a threshold band that overlaps the interval band … If the answer is that
threshold is a steady state and an interval band is a ramp — and I think it is — write that down as doctrine. Two
bands of different kinds is a real distinction; two bands that overlap by accident is a bug waiting to be found by a
runner."*

Two options, a coaching judgement and **not decided here**:

1. **Raise the interval floor** toward the CV/I region, keeping a strict ladder.
2. **Ratify steady-state-vs-ramp as doctrine** — threshold is a narrow band where HR plateaus; an interval band is a
   wide one because HR climbs through each rep. The engine currently treats them identically.

## 6. What this does not prove

- 🔴 **CORRECTED 2026-11-16, same day, before any build: my claim that "a completion never joins to its activity"
  was FALSE.** `strava_activity_id` is null on all 161 completions **because HealthKit is the SOR (ADR-011) and the
  join is `apple_health_uuid`** — and **16 of 161 are device-linked, all 16 of which join an activity successfully.**
  I measured the wrong column and filed a defect that does not exist (`COMPLETION-ACTIVITY-JOIN-01`, closed).
- **What is actually true, and it is worse for the evidence.** 80 completions carry an `avg_hr`, but **only 8 are
  device-backed; 72 were typed by hand** on the manual path. Of completed **Zone-3 quality** sessions there are
  **9, of which 5 carry an HR and exactly 1 is device-backed** — and that one is a `progressive_tempo`, which
  declares `['Z2','Z3']` and ramps by design, so **its whole-session average is sub-threshold on purpose and cannot
  test the T band at all.** Direct device-backed evidence for this question is therefore **n = 0 usable.**
- **The 29-run sample is whole activities selected by *average pace*, not confirmed threshold sessions.** It remains
  the best available telemetry and it is indirect.
- ⚠️ **And the direct observations point the other way.** The five completed Zone-3 sessions with any HR average
  **17–33 bpm BELOW** the prescribed ceiling at RPE 4–7. That is not a contradiction — the 29 are runs where the
  runner *did* hit the prescribed pace, the 5 are prescribed sessions where mostly they did not — but it means
  **the observed behaviour is runners undershooting both numbers**, which is a different problem from the one this
  ADR fixes and may matter more.
- **No number here is a measured threshold HR.** 81–87% HRR is the engine's own T fraction converted through the
  %HRR ≈ %VO2R identity (ACSM / Swain & Leutholtz). ⚕️ **Sims:** the chain is male-derived end to end — Daniels'
  VDOT tables and the conversion cohorts — and *"the ADR should say so rather than presenting the conversion as
  neutral arithmetic."* It is a coherent re-expression of the pace prescription, not a physiological measurement of
  these runners.
- 🩹 **Willy's denominator is unmeasured:** *"this change makes the session harder only for the runners who were
  obeying the heart rate."* A pace-follower is already running at the pace and already spending half the session
  above the old ceiling. An HR-follower has been training at 151 mid-band and will be asked for 163. **How many
  follow HR rather than pace is unknown**, and it is unknowable until the completion join lands.
- **Nothing has run on a device.** ✋ Silvanto: `Zone 3–4` is four characters longer than `Zone 3` in a Today eyebrow
  that is tight at 375pt, and nobody has measured it.

## 7. Conditions on shipping (Coaching Board, binding)

1. **Resolve the threshold/interval overlap** (§5 above) — Seiler, blocking.
2. **Beginners excluded** pending a §24b sitting. 🎯 McMillan: **13 of 25 beginner plans carry threshold work, down
   to VDOT 16.2** — a runner whose benchmark is a 7:40 marathon. *"Whatever this board rules for trained runners, I
   want beginners excluded until §24b has looked at whether they should be receiving these rows at all."*
3. 🔴 **`INV-PLAN-PACE-ZONE-COHERENT` amended in the same commit.** It asserts
   `intervalEffort ? 'interval zone (Z4–5)' : 'threshold zone (Z3)'`. **If threshold becomes Zone 4 it starts firing
   on correct plans** and the release goes red.

🔴 **Willy's condition CANNOT BE DISCHARGED BY ENGINEERING, and the sitting that said it could was working from my
false premise.** There is no join to fix. The limit is sample size: **10 quality sessions have ever been completed,
1 device-backed.** No code change creates more of those — only usage does. The condition is re-opened and returned to
the board.

🔑 **Which leaves the coherence argument, and it needs no cohort data at all:**
`z2Top` **IS** `z3Low`, so **the threshold floor is the easy ceiling by construction**; and pace comes from
%VO2max while HR comes from %HRR with **no conversion anywhere in the engine**. Both are provable from the code on
any machine, for every runner, today. **That is the ground this ADR should stand on** — the telemetry is
corroboration, not the case.

## 8. Migration — and ADR-012 does not cover this

**43 live plans, 23 carrying threshold sessions, 164 sessions whose `zone` and `hr_target` would change.**

The tool exists: `applyHrToPlan` is already the single owner of *"this runner's HR changed, bring their plan with
it"*, is pure, writes both strings together, and touches nothing structural — so `week_n`/`day` keys survive and
completions, run links and overrides stay aligned.

🔴 **But ADR-012's magnitude test has no term for intensity.** Its structural triggers are day-of-week moves,
session-type swaps, >15% trims and >15% week-volume changes; anything below them **auto-applies silently**. A band
moving +16 bpm moves no day, swaps no session and changes no volume, so **ADR-012 as written would apply this change
silently** — which is exactly the class of surprise it exists to prevent. Filed as an ADR-012 amendment.

**Migration, per ADR-014's nearer precedent** (a time-trial result rewrites forward paces only when prompted and
confirmed, never silently):

1. **Forward-only** for plans generated after the release. No back-fill.
2. **Existing plans: prompted, never silent.** One notice, old and new numbers side by side, with the reason.
3. **No regeneration** — it would move days, sessions and volume for a change that needs to move two strings.

🔬 **Wood:** *"A runner who has been holding 144–158 has built a habit around a number. You are about to change the
cue … an unexplained cue change does not produce a new habit, it produces abandonment of the old one — and in this app
the behaviour being abandoned is looking at the heart-rate target at all."* No streak, no badge, no celebration.

## 9. Artifacts, when it ships

| | |
|---|---|
| **Principle** | `§84 Amendment 2` — the band is derived from the anchor; plus the steady-vs-ramp distinction from §5 |
| **Numeric** | the named conversion constant in `GENERATION_CONFIG` (the T fraction already exists) |
| **Invariant** | **add** `INV-PLAN-HR-MATCHES-PACE`; **amend** `INV-PLAN-DISPLAY-ZONE-MATCHES-WORK` (equals → overlaps) and `INV-PLAN-PACE-ZONE-COHERENT`; rows in `plan-invariants.md` |
| **Pattern** | `ui-patterns.md` — the band-change notice as a `PendingAdjustmentBanner` variant: inset, no new ground, under the session, once |
| **Token** | `ZONE_COPY['Z4']` — a fifth voice, and `zoneCopyByNumber(4)` repointed to it |
| **Check** | `zoneCopyReach.test.ts` — every zone string `computeZones` can emit resolves to education copy that describes that work |

👥 **Sierra, and the chair agreed:** the education copy ships **with** the band, not after it. `ZONE_COPY` is keyed
`Z1 / Z2 / Z3 / Z4-5 / Z5` and `zoneCopyByNumber(4)` returns the **`Z4-5`** entry, so a runner on a 20-minute tempo
labelled `Zone 4` taps it and reads *"Hard. Genuinely hard. Intervals, hill reps, fast finishes. You can't talk."*
**That is not their session, and now they have learned something false about their own training.**

## 10. Docs that are stale and become true again

| Where | Says | Status |
|---|---|---|
| `zone-rules.md:77` | the engine writes `"Zone 3–4"` for threshold | **Stale since §84 Am. 1**, which changed it to `'Zone 3'` (41 golden-snapshot lines). No live plan carries it. **This ADR makes it true again** |
| `zone-rules.md:27, :72` | Z3 is *"Threshold — comfortably hard, sustainable ~30–60 min"* / *"the sustained threshold band"* | Needs amending to name the band threshold actually uses |
| `ruleEngine.ts:1702`, `renderGuidance.ts:25` | comments citing `Zone 3–4` | Same staleness, in code comments |

⚠️ **Not a conflict, checked before filing:** §1 calls Z3 *"the grey zone"* while `zone-rules.md` calls it the
threshold band. §84 Am. 1 already reconciles this — *"§1 governs easy runs drifting into Z3, not threshold work
deliberately prescribed there."* Further, since **CD-19 §1 counts SESSIONS, not minutes**, moving a band moves no §1
number at all.
