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

## 2b. Phase 0 results (2026-11-20)

- **0.1 Objection triage** (`coaching-2026-11-20-objection-triage.md`). The 2,878 findings break down as:
  - FIX: 1,714
  - ACCEPT the plan, FIX the note: 299
  - REDEFINE the auditor: 865
- **0.2 Root cause** (`coaching-2026-11-20-phase0-root-cause.md`): **partly**. The curve vs placed-volume divergence (52% of cohortGrid weeks) explains:
  - all four delivered-volume warnings
  - BINGE-WEEK
  - FLAT-CURVE
  - BASEBUILD-DURATION's gate

  It does **not** explain NEVER-BUILDS, WEEK1-LEAP or LONG-RUN-SHORT, which make up 77% of the objections.
- **0.3 Collisions** (`coaching-2026-11-20-phase0-collisions-numbering.md`):
  - STAGED-RAMP's hold is latent through the engine but turns 1 in 13 producer plans' ratio errors into CURVE-CLIMBS errors. A ratio-held rule is measured, and it clears 100% of the affected weeks.
  - NO-LONG-RUN + DURATION together: 7 of DURATION's 10 refused plans now climb, but there are +116 weekday sessions over the cap (the long run lands on a weekday for weekend-blocked runners).
  - Risks 4 and 9: no interaction.
- **0.4 Numbering:** one table, in the collisions note. §47's is Am. 4, not 5. It also found four existing numbering defects in CoachingPrinciples.
- **0.5 Design:** PLAN-NOTE-MULTIWEEK ruled. Mockups M1–M8 are owed before W5.

### New build items from Phase 0

| Id | Source | What | Wave |
|---|---|---|---|
| `AUDIT-REDEFINE-2026-11-20` | 0.1 rows 1, 6, 9, 11 | The auditor scores only real failures (865 findings move to watched, each with its reason) | **W0** |
| `DOCTRINE-NUMBERING-2026-11-20` | 0.4 | Fix §118's duplicate Am. 4, re-home §40b Am. 4 and §44 Am. 2/3, number §3's unnumbered amendment | **W0** |
| `DELIVERED-VOLUME-OWNER-01` | 0.2 | Capacity first, ramp within capacity, one reconciliation after the post-passes, §52's share reads the delivered week. **Prototype + Coaching Board before W1.** Also the lever for 0.1 row 4 | **W1 lead** |
| `STAGED-RATIO-HELD-01` | 0.3 | §116 Am. 15, the ratio-held exemption, plus `reaches_door` for held ramps. **Coaching Board before W1** | W1 |
| `NOTE-NAMES-BINDING-CONSTRAINT-01` | 0.1 rows 2, 5 | The false "already where this distance wants it" sentence (235 plans) is replaced by a note naming the actual constraint; §106's shortfall note is no longer suppressed | W1 |
| `DECLARED-LEVEL-PEAK-FLOOR-01` | 0.1 row 3 | An upward level declaration never peaks below the assessed-level twin (219) | W1 |
| `PLACEMENT-BELOW-CURRENT-01` | 0.1 row 4 | Placement never delivers below current volume when no runner constraint binds (277; 32 need `/zona-debug` first) | W1, via the owner |
| `RUNWALK-INTERVAL-BELOW-BAR-01` | 0.1 row 8 | Below the 55% bar, every session carries the §117 interval (429) | W3 |
| `RUNWALK-17KM-BOUND-01` | 0.1 row 7 | §117 Am. 2's 17 km bound covers every `run_walk_prescribed` plan (508) | W4 |
| `LOPSIDED-ALWAYS-DECLARED-01` | 0.1 row 10 | The lopsided-week fact is always written; it is dropped today by the note fallback (281) | W5 |

Note copy for these items is written by the assistant, on the founder's standing delegation.

## 3. The build waves (redrawn after Phase 0)

**Before W1 (Phase 0b):**
- Prototype and rule `DELIVERED-VOLUME-OWNER-01`.
- Rule `STAGED-RATIO-HELD-01`.
- Produce mockups M1–M8 for the founder.

| Wave | Items (in order) | Why this order |
|---|---|---|
| **W0 hygiene and the measure** | AUDIT-REDEFINE · DOCTRINE-NUMBERING · TEST-CLOCK-CONSTRUCTED-DATE · GETRUNNING-S111 · HR-SAVE-UNEDITED-CONFIRMS · DOUBLE-STRIDES · WALKRUN-DELOAD-CLAIM · INJURY-HIP-INERT | The auditor must measure the right thing before anything is built against it |
| **W1 volume** | DELIVERED-VOLUME-OWNER (capacity function used by both generators) → PLACEMENT-BELOW-CURRENT → DECLARED-LEVEL-PEAK-FLOOR → NOTE-NAMES-BINDING-CONSTRAINT → base-build ramp gate → BASEBUILD-NO-LONG-RUN (§116 Am. 13) → BASEBUILD-DURATION (Am. 14; fix the +116 weekday overruns from the combination) → STAGED-RAMP + STAGED-RATIO-HELD (Am. 15) → GETRUNNING-WALKRUN-LRHALF | The owner changes most plans, so everything after it is measured on it |
| **W2 quality sizing** | S9-QUALITY-FLOOR-REACH → WEEKDAY-OVERRUN-BOUND | Shown independent of W1's root cause |
| **W3 peak and goal pace** | STEPBACK (§47 **Am. 4**) → GOALPACE + §44 gap + LR-FINISH → BEGINNER-TAPER → WIZARD engine half → COACH-READ claim 5 → RUNWALK-INTERVAL-BELOW-BAR | |
| **W4 load shape and injury** | COACH-READ 1 → 7 → 6 → 4a → 3 · ACHILLES (its "0 new bounceback" condition is measured after the W1 owner) · LONG-RUN-CAP → INJURY-RECENCY · RUNWALK-17KM-BOUND | |
| **W5 what the runner is told** | LOPSIDED-ALWAYS-DECLARED · PLAN-NOTE-HEAVIER + CP-90 → MULTIWEEK → TUNE-UP | These read what W1–W4 settle |
| **W6 inputs** | BENCHMARK-DATE · PROFILE-BIRTH-YEAR · ANCHOR-BAND notice · ADR012 · API-WEEKLY-KM | They move real runners onto a settled engine |
| **W7 strength (parallel)** | PAIR-STRIDE → CARRY → RELEASE | Separate engine |
| **W8 live-plan retro-fix** | Regenerate the plans of runners with no logged run (founder 2026-11-20) | After W1–W6 |

**End state:**
- `audit:plans` has **0 findings in every FIX class**, and every REDEFINE/ACCEPT class is watched with its written reason.
- `review:coaching` is green.
- No error-severity violations.
- Every ruling's conditions are met.

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
