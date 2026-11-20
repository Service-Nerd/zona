# Coaching engine build plan, 2026-11-20

**Founder instruction:** take every coaching item, analyse it with everything else in mind, measure upstream and
downstream, run the coaching review before and after, fix every defect found before finishing, and end with no
outstanding coach-engine issues and plans we are happy with. If issues keep coming, change the approach.

**Inputs:**
- Inventory of 37 items: `docs/decisions/coaching-build-inventory-2026-11-20.md` (summarised below).
- Baseline `npm run review:coaching` on `main` @ `1423b4a9`.
- `npm run audit:plans` breakdown, run 2026-11-20.

---

## 1. Where we start (measured today on `main`)

`review:coaching` passes all 7 steps:
- 0 error violations.
- Envelope 94.6%.
- Fitness ok.

**But "a coach would object" logs 2,878 findings, and most of them are NOT what the 29 ruled items fix:**

| Class | Where | Count | Share of generated |
|---|---|---|---|
| NEVER-BUILDS (peak ≈ week 1) | cohortGrid | 1,009 | 35.0% |
| LONG-RUN-SHORT (peak long run too short for the race) | beginner marathon | 839 | 27.6% |
| BINGE-WEEK (one session > 60% of the week) | cohortGrid / targetedGrid | 292 / 238 | 10.1% / 15.7% |
| WEEK1-LEAP (week 1 far above the stated base) | beginner marathon | 284 | 9.4% |
| LONG-RUN-SHORT | cohortGrid / targetedGrid | 56 / 106 | 1.9% / 7.0% |
| BINGE-SEVERE-75, FLAT-CURVE | cohortGrid | 11 / 3 | 0.4% / 0.1% |

The auditor reports "no regression against the committed baseline". That means these findings are **accepted debt**,
not fixed. Some may be correct by design: a 5K plan at 20 km/week arguably should not grow, and a 3-day marathon week
is long-run-heavy by construction. Nobody has ruled which ones are real.

**This is the first thing the plan must settle. Building 29 items and leaving 2,878 objections would not meet the
founder's "happy with the plans we generate".**

---

## 2. Phase 0: before any engine code (measure and decide)

| # | Step | Why | Output |
|---|---|---|---|
| 0.1 | **Objection triage sitting** (Coaching Board). For each auditor class, sample its plans and rule it: real defect, auditor definition wrong, or correct by design | 2,878 findings with no ruling on any of them | For each class: FIX (named into a wave), REDEFINE (the auditor changes), or ACCEPT (with the reason written) |
| 0.2 | **Root-cause pass across the items.** Test one hypothesis: many items are the same defect, the plan's volume **curve** diverging from the **placed** sessions. Candidates: ADR-022 delivered ramp, base-build placed volume, S9's inert budget, weekday overrun, BINGE-WEEK, WEEK1-LEAP | If true, one owner of delivered volume would replace several patches. That is the "different approach" | A measured yes or no. If yes, Phase 1 is re-planned around it **before** building |
| 0.3 | **Run interaction risk 2.** STAGED-RAMP's ratio-held weeks against `INV-PLAN-ONRAMP-CURVE-CLIMBS` (read from code, not run) | It would surface as an error mid-build | Measured; folded into W1's spec |
| 0.4 | **Doctrine numbering.** Resolve the collisions: §116 Am. 13/14, §9 Am. 3 shared, §89's two amendments, §90 Am. 3 shared, §118 Am. 2, §47 Am. 4 missing from CoachingPrinciples, §3 Am. 1/2 | Two builds writing the same section is a merge defect | One numbering table in this file |
| 0.5 | **Design sitting for PLAN-NOTE-MULTIWEEK** (how several marks read), plus mockups for the heavier-week placement | The readers wave cannot start without it | Ruling plus mockups to the founder |

**Exit from Phase 0:** every objection class has a disposition, the root-cause question is answered, and the wave
list below is confirmed or re-drawn.

---

## 3. The build waves (as drawn now; re-drawn if 0.1 or 0.2 changes them)

**Order principle:**
- Producers first, the warnings they move next, and the readers of those warnings last.
- Each wave lands, is measured, and is pushed before the next wave starts.

| Wave | Items (in order) | Why this order |
|---|---|---|
| **W0 hygiene** | TEST-CLOCK-CONSTRUCTED-DATE · GETRUNNING-S111-DENOMINATOR · HR-SAVE-UNEDITED-CONFIRMS · DOUBLE-STRIDES · WALKRUN-DELOAD-CLAIM · INJURY-HIP-INERT | Small and independent; makes the suite stable before the large waves |
| **W1 base-build ramp** | a committed ramp measurement gate (the existing harnesses cannot see a ramp) → BASEBUILD-NO-LONG-RUN (§116 Am. 13) → BASEBUILD-DURATION (Am. 14) → STAGED-RAMP-RATIO-16W → GETRUNNING-WALKRUN-LRHALF | Same function. DURATION must re-measure its 8 refused runners after NO-LONG-RUN |
| **W2 quality sizing** | S9-QUALITY-FLOOR-REACH (§40b Am. 5) → WEEKDAY-OVERRUN-BOUND (§81 Am. 3; its 124 ratchet re-measured after S9) | Both size through `makeQualitySession` |
| **W3 peak and goal pace** | STEPBACK-SPECIFICITY (§47 Am. 5) → GOALPACE-UNBENCHMARKED + §44 gap arm + LR-FINISH-WITHHELD in one commit → BEGINNER-TAPER (population re-derived after §120 Am. 4) → WIZARD-PAID-INPUTS engine half (§96 Am. 1 cue survives STEPBACK's +494) → COACH-READ claim 5 | Each one's population is moved by the one before |
| **W4 load shape and injury** | COACH-READ claims 1 → 7 → 6 → 4a → 3 · ACHILLES-QUALITY-ONSET (0 new bounceback is binding) · LONG-RUN-CAP-INJURY-VALUE → INJURY-RECENCY | The deload checker and placement change before ACHILLES is held to them |
| **W5 warning readers** | PLAN-NOTE-HEAVIER-WEEK + CP-90 → PLAN-NOTE-MULTIWEEK → TUNE-UP-CALLOUT (device check) | They read the ramp verdict that W1–W4 move, so they are built once it stops moving |
| **W6 inputs and migration** | BENCHMARK-DATE-REQUIRED · PROFILE-BIRTH-YEAR-REQUIRED · ANCHOR-BAND-MIGRATION-NOTICE · ADR012-INTENSITY-TERM · API-WEEKLY-KM-UNBOUNDED | These move real runners into existing rules. Built last, so they land on a settled engine |
| **W7 strength (parallel)** | STRENGTH-PAIR-STRIDE (fixes the live clock double-charge) → STRENGTH-CARRY-PATTERN → STRENGTH-RELEASE (founder phone check) | Separate engine; no shared code with W1–W6 |
| **W8 live-plan retro-fix** | After W1–W6 have landed and their gate is green: regenerate the stored plan of every live runner who has **not logged a run**, through the single owner (`regenerateFromStored`), from the runner's own stored inputs. Measure the population first: no `session_completions` row and no linked activity. Then validate every regenerated plan, and diff it against the stored one before writing. Each write is a production write, so it is handed over as exact SQL or run by the founder | Founder decision 2026-11-20. Runners who have logged runs keep their plan (the 08-20 policy still applies to them) |

Phase 0.1 will add **FIX items** for the objection classes. They slot into W1 (ramp/volume), W2 or W4 by mechanism.

---

## 4. The gate after every wave

1. `tsc` 0 and the **full** suite green (the pre-push hook enforces both).
2. `npm run review:coaching`, all 7 steps. The `audit:plans` class counts may not rise, and each class must reach its
   Phase 0 target by the end.
3. `verify:parity` against the wave's start, with the changed-plan count **declared** and explained.
4. `cohort:shape`, `measure:fitness` and `invariant:liveness` re-baselined **only with a written reason**.
5. Every ruling's own conditions (ratchets, "0 new X") checked and stated in the commit.
6. The records: registry row, build log, backlog item closed. Then push.

**Defect rule:** a defect found during a wave is RCA'd (`/zona-debug`) and fixed **in that wave**. It is not filed for
later. A wave is not done while one is open.

**Stop rule:** if a wave's gate fails twice on new error classes, or the objection classes do not fall after W1–W4,
stop. Return to 0.2 and change the approach rather than add more patches.

---

## 5. What cannot be closed by this build

- **Live stored plans of runners who HAVE logged runs:** they keep their plan under the 2026-08-20 policy. W8 covers
  everyone who has not.
- **Waiting on data, kept by the founder:** EMAIL-WAVE-4-PATTERN · LOG-OFFPLAN-03 · ADJUST-TRIGGER-REACH-02.
- **Dissents that reopen only on outcome data:** McMillan, Willy, Seiler, Sims (listed in the inventory §5).
- **Nothing here is seen on a device**, except the W5 and W7 checks named above.

---

## 6. Founder decisions (taken 2026-11-20)

1. ✅ **Targets: every FIX class reaches 0; REDEFINE and ACCEPT classes are written down with their reason.**
2. ✅ **Live plans: add W8. Retro-fix the plans of runners who have not logged runs.** Runners with logged runs keep
   theirs.
