# Strength Principles — the strength engine's constitution (v1, 2026-10-16)

**Owner:** the Coaching Board, strength seat (ADR-017, ADR-024). **Item:** `STRENGTH-ENGINE-01`.
**Numbers:** `packages/strength/config.ts → STRENGTH_CONFIG`. **Checks:** `packages/strength/validate.ts →
validateStrengthPlan()`. **Ruled:** Phase 0 sitting, `docs/decisions/strength-engine-boards-2026-10-16.md`
(CORRECT WITH AMENDMENT). **Evidence:** `docs/investigations/strength-conditioning-research-2026-10-16.md`,
`strength-split-research-2026-10-16.md`.

⚖️ **Every number here is an evidence-graded default, not a finding.** ACSM 2026 calls minimal-dose and
concurrent-training evidence insufficient. Grades: **M** moderate (systematic review), **L** low (few or small
studies), **C** convention (practitioner consensus), **I** inference (no direct study).

⚠️ **No outcome claim.** Nothing here may be quoted to a runner as preventing injury or helping them finish (the
2024 runner meta-analysis found unsupervised programmes did not reduce injury). Designed for, never promised.

Every `STRENGTH_CONFIG` key is named in a section below; `strengthConfigSync.test.ts` fails the build otherwise.

## S1. Frequency and the split

**Principle.** The runner picks 1–4 sessions a week (`SESSIONS_PER_WEEK_RANGE`); the engine recommends
`RECOMMENDED_SESSIONS_PER_WEEK` (2). The split follows the day count: 1 → full body; 2 → full body × 2;
3 → full body × 2 + one upper and core day; 4 → upper/lower × 2. **Never more than
`MAX_HEAVY_LEG_SESSIONS_PER_WEEK` (2) heavy-leg sessions a week**, whatever the day count (Blagrove amendment).

**Why.** With weekly volume matched, full body and split routines give the same strength and size (Schoenfeld
2019, Ralston 2018; Ramos-Campo 2024 secondary) **[M]**. ACSM 2026 asks that each major muscle group be trained
≥2×/week **[M]**. So the split is chosen for fit: twice a week per region, inside the session length, with legs
where §7 allows. A third heavy-leg day buys a runner nothing and costs a §7 slot **[C]**.
⚠️ **No study aligns a strength split with a run week [I].** **Check:** `S-LEGS-MAX`, `S-TOO-MANY`.

## S2. Heavy legs are a §7 stressor

**Principle.** Heavy lower-body and plyometric work goes, in order of preference: **(a)** stacked on a quality-run
day, after the run (the next day is already easy under §7); **(b)** an easy or rest day with no hard run the day
before and none in the next `HEAVY_LEGS_CLEAR_DAYS_AFTER` (2) days; **(c)** otherwise the session becomes upper
body and core (S3). Never on a long-run or race day. Two heavy-leg sessions are at least
`MIN_DAYS_BETWEEN_HEAVY_LEGS` (2) days apart, across week boundaries too.

**Why.** Lower-body lifting raises the cost of running for 24–48 h (Doma, small samples) **[L]**; interference is a
lower-body problem (Huiberts 2023, 59 studies) **[M]**. §7's 48 h between stressors already governs the run week.
**Check:** `S-LEGS-ON-LONG`, `S-LEGS-BEFORE-HARD`, `S-LEGS-AFTER-HARD`, `S-LEGS-48H`, `S-LEGS-SPACING`, `S-HEAVY-FLAG`.

## S3. Never skip, convert

**Principle.** When the run week has fewer legal heavy-leg days than the split wants, the extra session becomes
upper body and core rather than being dropped or breaking S2. Upper-body days prefer a non-hard day, spaced from
other strength days. One strength session per day.

**Why.** Interference is lower-body specific, so upper work can go almost anywhere **[M]**; the habit matters more
than the split **[C]**. **Check:** `S-ONE-PER-DAY`, `S-UNAVAILABLE-DAY`.

**Amendment 1 (2026-10-17, SESSION-SLOTS-01, Blagrove).** A day that holds **two runs** (a double the runner made,
§126) takes **no** strength session: three sessions in one day is not what S4's stacking was written for. The run
context marks such a day (`RunDay.runs`), placement skips it, and the strength plan re-places when it appears.
**Check:** `S-NO-STRENGTH-ON-DOUBLE`.

## S4. Stacked sessions carry the gap

**Principle.** A session on a quality-run day is done after the run, at least `STACK_GAP_HOURS_MIN` (3) hours later
and ideally `STACK_GAP_HOURS_IDEAL` (6). The plan marks it (`after_quality_run`) so the app can say so.

**Why.** Concurrent training does not blunt maximal strength, but explosive gains are blunted within the same
session (Schumann 2022) **[M]**; the ≥3 h / ≥6 h gap is the consistent practical guidance **[C]**.
**Check:** `S-STACK-FLAG`.

## S5. Taper and race week

**Principle.** No heavy legs within `HEAVY_LEGS_CUTOFF_DAYS_BEFORE_RACE` (10) days of the race. In taper weeks the
dose drops to `TAPER_SESSIONS_PER_WEEK` (1), or `TAPER_SESSIONS_PER_WEEK_MASTERS` (2) for masters (the run engine's
`MASTERS_AGE_THRESHOLD`, by value through the bridge). In the final `RACE_WEEK_DAYS` (7), mobility only, one
session of at most `MOBILITY_SESSION_MINUTES`. Nothing on race day or the `NO_STRENGTH_DAYS_BEFORE_RACE` day before.

**Why.** Mirrors §6 ("race week is for shakeouts"). Taper strength handling rests on one n=8 study and practitioner
opinion **[L/C]**; older adults lose strength faster in reduced training (Spiering 2021) **[L]**.
**Check:** `S-TAPER-CUTOFF`, `S-RACE-WEEK`, `S-RACE-EVE`.

## S6. Dose

**Principle.** Technique first: for `NOVICE_BLOCK_WEEKS` (new 4, some 2, regular 0) main lifts are
`NOVICE_REPS` (10) at `NOVICE_RIR` (3), one set under `MAIN_SETS`. After it, running-focused lower-body main lifts go
heavy at `HEAVY_REPS_RUNNING_LOWER` (5); general lower at `MAIN_REPS_GENERAL` (8); upper at `MAIN_REPS_UPPER` (8);
accessories `ACCESSORY_REPS` (10). Sets: `MAIN_SETS` (3), `ACCESSORY_SETS` (2), `CORE_SETS` (2) of `CORE_SECONDS`
(30) holds. Peak cuts `PEAK_MAIN_SET_REDUCTION` (1) main set. Taper drops to `MAINTENANCE_MAIN_SETS` (2) and
`MAINTENANCE_ACCESSORY_SETS` (1). A run deload week cuts sets by `DELOAD_SET_FACTOR` (0.6) (§3). An exercise is kept
for `BLOCK_WEEKS` (4) so load can progress, then the next variant.

**Why.** Heavy (~80% 1RM+, 3–6 reps) work improves running economy; submaximal loads largely do not
(Llanos-Lagos 2024, Blagrove 2018) **[M]**. ≥4 hard sets per region per week is the gain floor (Iversen 2021) **[L]**;
strength plateaus near 2–3 sets per exercise (ACSM 2026) **[M]**; one set at kept intensity maintains (Spiering
2021) **[L]**. **Check:** `S-NOVICE-REPS`, `S-DELOAD-SETS`, `S-NO-MAIN`.

**Amendment 1 (2026-10-17, STRENGTH-KNEE-DOMINANT-01, Blagrove).** A session with two or more main lower lifts has
one **knee-dominant** (single-leg or squat) and one **hip-dominant** (hinge): never two hinges. Single-leg RDLs are
hinges by movement and live in the hinge pattern; the single-leg slot is knee-dominant only. The hinge slot does
**not** prefer unilateral variants for running focus: the single-leg slot already carries that, and the hinge is where
the heaviest bilateral load lives. Measured before: 13,300 of 46,908 leg sessions (28.4%) were all hinges (the
founder's own plan paired a Kickstand RDL with a Barbell RDL for four weeks). After: 0, with every running leg session
still carrying unilateral work. **Check:** `S-LOWER-BALANCE`; `catalogue.test.ts` (every single-leg entry trains the
quads).

## S7. Effort is reps in reserve

**Principle.** Load is prescribed as reps in reserve, never %1RM (the app has no 1RM). Never to failure: floor
`RIR_FLOOR` (1), lower-body heavy main lifts `RIR_FLOOR_LOWER_HEAVY` (2); main work `RIR_MAIN` (2).

**Why.** No runner-specific RIR trial exists **[I]**; failure training adds fatigue a runner pays for in the next
run **[C]**. **Check:** `S-RIR-FLOOR`.

## S8. Plyometrics after strength, not with it

**Principle.** Running-focused only. None before `PLYO_MIN_WEEKS` (4) weeks of strength, or `PLYO_MIN_WEEKS_NEW`
(8) for `new` lifters. Start at `PLYO_CONTACTS_START` (30) contacts, add `PLYO_CONTACTS_STEP` (10) every
`PLYO_CONTACTS_STEP_EVERY_WEEKS` (2), cap `PLYO_CONTACTS_MAX` (60), in sets of `PLYO_CONTACTS_PER_SET` (10). None in
taper or race week. None for an injury on `PLYO_RESTRICTING_INJURIES` (§21's list, by value; the bridge's parity
test holds them equal) or with the bone flag.

**Why.** Plyometrics improved running economy at the slower speeds recreational runners run **[M]**; the dose is
convention, not research **[C]**. Technique before load, load before impact (Blagrove). **Check:**
`S-PLYO-TOO-SOON`, `S-PLYO-INJURY`, `S-PLYO-TAPER`, `S-PLYO-CONTACTS`.

## S9. Injury, bone and equipment steer the choice

**Principle.** An exercise is never prescribed if it needs kit the runner did not tick, if its `avoid_with` matches
an injury tag (the run plan's plus the profile's), or, under the bone flag, if it is high impact or loaded spinal
flexion. The bone flag does not remove heavy work.

**Why.** Kinder siblings, never rehab. UK consensus (BJSM 2022) supports progressive resistance for bone health
unless vertebral fracture **[M]**. **Check:** `S-EQUIPMENT`, `S-INJURY-AVOID`, `S-BONE`, `S-UNKNOWN-EXERCISE`,
`S-DUPLICATE`.

**Amendment 1 (2026-10-17, catalogue review, Blagrove).** A **main** slot is a compound movement you can load. An
isolation (hamstring curl), a ballistic (kettlebell swing) or a supramaximal eccentric (Nordic curl) never fills
one; each is `not_main` and stays for accessory slots. Measured before the ruling: across 210,996 main-lift
prescriptions, the Nordic curl was **25% of all main hinges** (the heavy main lift for most bodyweight-only runners),
the curl and the swing another 4%. *"That's an accessory, not a main lift."* A kinder sibling (S9) also means the
**easier** variant keeps a joint tag off and the **harder** one carries it: the incline push-up no longer avoids the
shoulder, the feet-elevated push-up does. And a name that promises kit needs that kit. **Check:** `S-MAIN-ELIGIBLE`;
`catalogue.test.ts` (a main-eligible kit-free entry per main pattern; names match kit; no effort number in a cue).

## S10. The session clock

**Principle.** A session fits 30, 45 or 60 minutes. RAMP warm-up first, `WARMUP_MINUTES` (6 / 8 / 10). Time is
counted as sets × (work + rest) plus `TRANSITION_S` (30) per exercise; work is reps × `SECONDS_PER_REP` (3),
contacts × `SECONDS_PER_CONTACT` (1), or the hold; warm-up items `WARMUP_ITEM_SECONDS` (40), mobility
`MOBILITY_ITEM_SECONDS` (45). Rest `REST_S`: heavy 150 s, main 90, accessory 60, core 30, plyometric 60. Accessories
and core pair into supersets across regions (rest counted once per round). Over budget: drop the lowest-priority
accessory first, keep one core item, then trim main sets to 2; **never shorten rest**. Under budget: add sets up to
`MAIN_SETS_MAX` (4, not in the technique block), `ACCESSORY_SETS_MAX` (3), `CORE_SETS_MAX` (3), then a mobility
cooldown, until `FILL_TARGET` (0.8) of the budget. A training session uses at least `MIN_BUDGET_USE` (0.5) of it,
except in taper and deload weeks, which are short on purpose.

**Why.** Rest is part of the dose for heavy work **[C]**; supersets roughly halve session time (Iversen 2021)
**[L]**; "30 minutes must be a real session" (McMillan). **Check:** `S-WARMUP`, `S-TIME-OVER`, `S-TIME-UNDER`.

**Amendment 1 (2026-10-16, Design Board STRENGTH-APP-01).** A warm-up item that is a training exercise in lighter
form (`same_as`) is left out when that exercise is in the session: a session never says the same thing twice. An
*Upper body* session carries no hip work; hip abductors stay in every full-body and lower session. **Check:**
`S-WARMUP-REPEAT`.

**Amendment 2 (2026-10-17, defect restoring intent: STRENGTH-START-WEEK-01, STRENGTH-PLYO-BUDGET-01).** Three
readings this constitution always meant and the engine did not do. **(a) Strength weeks count from when strength
started** (`start_date`), never the run plan's week 1: S6's technique block and S8's gate belong to the lifter. Set up
in week 8, a `new` lifter got heavy 5s and open jumps in their first session. **(b) Jumps are not an accessory**, so
under S10 they are dropped only after accessories and main-set trims, and come back first, at no less than
`PLYO_CONTACTS_START`, when the session has room: measured, jumps reached one week in sixteen (a deload). **(c) The
first jump is level 1** and climbs one rung per two blocks from the gate, never from the lifting level (board
direction, catalogue review): a `some` lifter's first jump was bounding or a drop jump. No numeric moved. **Check:**
`S-BEFORE-START`, `S-PLYO-MISSING`, `S-PLYO-START-LEVEL`; the validator counts from `start_date` too.

## S11. Core in most sessions

**Principle.** A week with two or more training sessions has at least two core exposures. Upper body is placed by
the split (S1), not put in every session (founder, 2026-10-16).

**Why.** No trial compares core frequencies **[I]**; ≥2 exposures/week follows ACSM's twice-weekly minimum by
analogy. **Check:** `S-CORE-DOSE`.

## S12. Standalone

**Principle.** With no run plan the same engine builds `STANDALONE_WEEKS` (8) weeks, the first
`STANDALONE_BASE_WEEKS` (4) as base, every day treated as a rest day for placement. This is the standalone-app path.

**Why.** ADR-024 §1: `RunContext | null`. **Check:** the sweep runs the standalone path for every profile.

## S13. Recovery eases strength, and the runner decides

**Principle.** When the run engine's recovery check (`computeReadiness`, §59: the one owner; strength never computes
its own) says recovery is off, the day's strength session is **proposed** lighter, never changed silently. The runner
decides, as for a run: on a day with a run ease, one answer covers both sessions; on a day without one, the strength
session asks itself. An accepted ease **only subtracts**: the session keeps only exercises it already held, never
more sets or reps on any, and no plyometrics. Heavy legs lose their lower-body lifts except calf and soleus work;
whatever upper and core work it had stays. So full-body becomes upper + core + calf and lower + core becomes
core + calf. Every kept training item takes the day's sets × `RECOVERY_SET_FACTOR` (0.6, the deload factor),
floor 1. Warm-up and mobility are kept as written.

**Why.** Evidence for HRV-guided training supports holding back far better than pushing on **[L]**, so this never
adds load on a good morning (Hutchinson). Lighter, not gone, keeps the habit (Blagrove). Tendon loading drops, never
to zero (Willy). The runner decides because a lone signal is a known false positive (§59 noise-hardening) and a wrong
ease teaches them to ignore it; a woman in her luteal phase can trip it on a normal week (Sims, recorded). Re-sat
2026-10-17: the first ruling said "silently, as the run does", and the run does not. Sitting:
`docs/decisions/strength-recovery-resitting-2026-10-17.md`. **Check:** `S-RECOVERY-SUBTRACT-ONLY`
(`recoveryEaseViolations`, run over every generated session in the sweep).

## Honesty notes the plan carries

`bodyweight_ceiling` (no load kit: builds the habit and some strength; load is what moves economy) ·
`split_is_inference` · `legs_limited_by_run_week` · `fewer_sessions_than_asked` · `pattern_unavailable`. The app
phrases them; the engine only states them.
