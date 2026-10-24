# Coaching Board — QUALITY-TYPE-NO-OWNER-01 (2026-10-24)

**Trigger:** soft, qualifies. No doctrine file changes yet; the ruling decides which sessions count for which question,
which changes what four live surfaces do (spacing guard, post-race blackout, readiness, the morning push).
**Proposed change.** Replace 42 hand-written session-type sets with three named owners in `sessionRole.ts`, each answering
one question, and map every site to the question it is actually asking.

## Re-measured first (2026-10-24)

| | Filed 2026-10-15 | Measured |
|---|---|---|
| Sites | "nine" | **42** sets naming quality + intervals + tempo (comments stripped). The filed table listed 12 |
| Types that occur | assumed | Engine, 5,664 cohort plans: `quality`, `hard`, `easy` (+ `role: long_run` / `shakeout`), `race`. Stored, 36 production plans: the same plus `strength`, `rest`, legacy `run`. **`intervals`, `tempo` and `long` occur nowhere** |
| The `hard` split | a disagreement | 16 sets include it, 17 exclude it |
| The `long` split | a disagreement | **A dead literal in 5 sets**: no session is ever typed `long`; the long run is `easy` + `role: long_run` |

## Conflict scan

| § | What it says | Bearing |
|---|---|---|
| **§7** | *"A quality session and a long run are both fatiguing. They cannot be back-to-back."* 48 h between any two stressors | The spacing guard `planAdjustment.ts:195` names `long` to catch the long run and has never seen one. **Defect against §7** |
| **§62** | Post-race blackout: *"quality/interval/tempo/long sessions are converted to easy recovery"* | `postRaceReshape.ts:53` names `long`; long runs have never been converted. **Defect against §62** |
| **§59** | Readiness trims the long run (`LONG_RUN_SOFTEN_PCT` 0.85) | `pre-session-readiness:254` `isQualityOrLong` names `long`; the long run never matches. **Defect against §59** |
| **§57** | Foundation weeks: easy only | `invariants.ts:7027` forbids `long` among others. Dead and **harmless**; widening it to the long run would forbid the easy long run foundation weeks are allowed. Not a defect |
| **§78** | The time trial is typed `hard` **so it does not count against §8's ceiling**: *"a benchmark is a measurement, not a training stimulus"* | Grounds the split: excluded from the quality COUNT on purpose, still a maximal EFFORT |
| **§8** | Quality sessions per week, by level and goal | Counts `quality` only |
| ENGINE-01 (`adjustmentEngine.ts:129`) | Fitness signal calibrated on the three-type set | Its answer must not move (recalibration owns the time trial, ADR-014) |

No section is contradicted by the proposal; three are currently contradicted by the code.

## The board

**🏃 Hutchinson (chair).** The item called this a disagreement about `hard` and `long`. Measured, it is three different
questions sharing one word, and one of the two "disagreements" is a type that does not exist. The right output is not
one canonical set; it is three named questions, each answered once.

**📊 Seiler.** Keep the quality COUNT pure. §1 and §8 count training stimuli, and a time trial is a measurement. If it
leaked into `isQualitySession`, a beginner's one benchmark would consume their only quality slot. §78 already says so.

**🎯 McMillan.** From the runner's side: the time trial feels like the hardest session of the block, so anything that
asks "how hard was today?" (RPE checks, fatigue flags, the coach line) must count it. And anything that asks "is
tomorrow safe to be hard?" must count the long run. Those are the three questions, and the runner already lives them.

**🩹 Willy.** The spacing guard is the one I care about. A quality session the day before a long run is the injury
vector §7 exists for, and the guard written to catch it has been blind to the long run since it was written. That is a
defect, and it ships first.

**⚕️ Sims.** The readiness one matters most for the runners I speak for: §59 trims the long run on a bad-recovery day,
and the women and masters runners with the slowest recovery are the ones it was written for. It has never fired on a
long run.

**💪 Blagrove.** `lib/strength-bridge/runContext.ts` places strength around run stress and reads the effort set. It
should read hard DAY, not hard effort: heavy legs before a long run is the §7 case. Recorded for the mapping.

## Recorded disagreements

None material. McMillan would extend `isHardDay` to the race; Hutchinson notes the race is handled by its own week
logic and race week is out of every one of these guards' scope. Left to the mapping, measured per site.

## Ruling

**CORRECT WITH AMENDMENT.** Three owners in `sessionRole.ts`:

| Owner | Question | Counts |
|---|---|---|
| `isQualitySession` | Is this a training stimulus? (§1, §8 counts, ENGINE-01) | `quality` (+ legacy `intervals`, `tempo`) |
| `isHardEffort` | Was this effortful? (RPE, fatigue, coaching flag, copy) | the above + `hard` (the time trial) |
| `isHardDay` | Is this a stressor for spacing, readiness, the post-race blackout, a key session? (§7, §59, §62) | hard effort + the long run **by role** |

**Amendments:** (1) the §57 foundation invariant maps to *hard effort + race*, not hard day, so foundation long runs stay
legal; (2) ENGINE-01 stays on `isQualitySession`, so its calibration does not move; (3) the strength bridge reads
`isHardDay` (Blagrove); (4) **every site whose answer changes is listed with a measured diff before it ships**, and
`verify:parity` must stay identical for the engine's own sites.

## Artifacts

1. **Principle** — §7 Amendment: the three questions, defined once, and which owner answers each.
2. **Numeric** — none; the three sets are named constants in `sessionRole.ts`.
3. **Check** — a gate that no hand-written session-type set remains outside `sessionRole.ts` (comments stripped,
   falsified by re-adding one), plus behavioural tests for the three restored guards (§7 spacing, §62 blackout, §59
   readiness) that fail on today's code.

## SLT escalation

None.

## Built (2026-10-24)

Every site mapped; gate `lib/plan/qualityTypeOwner.test.ts`, falsified (re-adding a set at `weekVoice.ts` turns it red;
dropping the long run from the §7 helper turns the §7 arm red). Measured on production, 36 plans: §7 guard 0 of 14
past reorders changed, 2 stored weeks newly visible (`TT-BEFORE-LONG-01`); §62 one reshape ever, dismissed; push 348
future days in 28 plans now name the long run. **Correction to the conflict scan:** the §59 readiness site was not a
defect. `pre-session-readiness` reads a `coachingSessionType` label, which already names the long run `'long'`; it
now reads `isQualityType` with an identical answer. Eight further sites answer a different question (a zone, band or
word per type) and are exempt from the gate by name.

## What this does not settle

Whether the long-run trim on a bad-readiness day (§59) and the long-run conversion in the post-race blackout (§62)
are right; both are ruled doctrine, and this sitting only makes the code do what they say.
