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

**Amendment 2 (2026-10-18, PINNED-DAYS-01, founder + both boards).** The runner may **choose the days** (1–
`MAX_CHOSEN_DAYS`, 4). Chosen days ARE the sessions: the count is the frequency and every other day is unavailable,
so the engine decides only what goes on each day (heavy legs where S2 allows, else upper body + core, S3), **never
which day**. A chosen day is left empty only for safety: race day and the day before (S5), the taper's fewer sessions
and race week's one mobility session (S5), and a day the runner made a two-run day (S3 Am.1). Lifting on a day with one
run is allowed (S4's after-run gap). Without chosen days the engine picks, as before. Measured on the founder's plan:
three allowed days for two sessions moved them between Mon/Wed and Mon/Tue; the fix is the question, not the
placement. **Check:** `S-PINNED-DAYS` (no session off a chosen day; every chosen day filled in an ordinary week).

**Amendment 3 (2026-10-28, STRENGTH-AB-SESSIONS-01, Coaching Board).** Two sessions of the same kind in one week are
an **A and a B**: each slot takes a different exercise in the B (the next one in the same rotation), so each lift
appears once a week and both are still held for `BLOCK_WEEKS`, which is what lets S14 progress them. The A is the
session the engine built before this amendment, unchanged. A B never trades load away (S6): its main lift is loaded
whenever the runner owns load, and never drops more than one level below the A. Two fallbacks, in order, until the
session both differs and fits the clock (S10): a small pool (bodyweight, injuries, the technique block) can rotate a
third session back to its A, so it counts among sessions of the same shape, then tries the next rotations; and a full
swap can stack per-side lifts past a 30-minute clock, so the B then varies its main lifts only, then the rest only
(the ruling's "or a different accessory"). **Why.** The same session twice in a week is one stimulus given twice: the founder's own weeks 3 and 4 held two
identical upper sessions, and measured on the sweep sample **10,178 of 14,870 weeks** with two or more training
sessions held a repeat. Variety across the week at matched volume costs nothing in strength (S1's evidence) and gives
each region a second movement **[C]**. Measured after: **0** repeated weeks; A sessions **32,810 of 32,810**
unchanged; a main lift kept to the next week inside a block **96.8%** (97.5% before); distinct main lifts per week
**83.8%** of main slots (57.3% before). **Check:** `S-AB-DISTINCT`.

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

**Amendment 2 (2026-10-19, STRENGTH-CHOSEN-NO-LEGS-01, both boards).** For running focus, a session converted here
(a leg session S2 had no legal day for) is upper body + core + **light leg work**: `LIGHT_LOWER_PATTERNS` (calf, hip
abduction) at RIR at least `LIGHT_LOWER_RIR` (3), never jumps, squat, hinge or single-leg. It is not a heavy-leg
session (S2) and may sit beside a long run. Its first light item is the last accessory the clock drops. **Widened 2026-10-19
(STRENGTH-GENERAL-LEGS-01, both boards) to General focus**, which the setup promises "the same leg work, with more upper
body": measured, 255 of 448 General chosen-day plans held a week with no leg work (worst 14 weeks), Running 0 after the
first ruling. The founder's own plan (Mon/Wed around a Tuesday quality run) had five such weeks. **And the plan names the
day** (STRENGTH-LEGS-DAY-01): `legs_day_suggestion`, the unchosen day whose swap would let heavy legs in most often,
counted with S2's own predicate; never acted on by the engine (S1 Am.2). **Why.**
Measured: 29 of 448 chosen-day plans (6.5%, every one a weekend pick beside a Sunday long run) held no leg work at all;
S2 bans heavy legs there, not leg work, and S13 already treats calf and soleus as the low-cost lower work (Blagrove,
Willy). No evidence either way on calf work the day before a long run **[I]**; small muscle mass, low risk; claim
nothing (Hutchinson). **Check:** `S-LIGHT-LOWER-ONLY` (a light item is a light pattern at the light RIR on a non-heavy
session), `S-LEGS-EVERY-WEEK` (an ordinary week with sessions has leg work, either focus since STRENGTH-GENERAL-LEGS-01).

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

**Defect fix (2026-10-18, PINNED-DAYS-01, restores this section's intent).** The last week before the race is
mobility only by DATE, whatever the run week calls it. A taper week ending inside that window was safe only because
placement took the earliest days; chosen days (or a long unavailable list) reached the window and placed strength
there. Placement now excludes the window outside race week.

## S6. Dose

**Principle.** Technique first: for `NOVICE_BLOCK_WEEKS` (new 4, some 2, regular 0) main lifts are
`NOVICE_REPS` (10) at `NOVICE_RIR` (3), one set under `MAIN_SETS`. After it, running-focused lower-body main lifts go
heavy at `HEAVY_REPS_RUNNING_LOWER` (5); general mains follow `MAIN_REP_CYCLE_GENERAL` (Amendment 2); running upper at `MAIN_REPS_UPPER` (8);
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

**Amendment 2 (2026-10-28, STRENGTH-REP-BLOCKS-01, Coaching Board).** General focus cycles its main lifts' reps by
block: `MAIN_REP_CYCLE_GENERAL` (**10 → 8 → 6**, then round again), one target per block of `BLOCK_WEEKS`, counted
from the runner's strength start on the same boundary as the exercise rotation (S9), so a new lift and a new target
arrive together. The technique block is unchanged (`NOVICE_REPS` at `NOVICE_RIR`). Running focus keeps
`HEAVY_REPS_RUNNING_LOWER` (5) on its lower mains and `MAIN_REPS_UPPER` (8) upper. The target is shown as the session's
number, never a range. **No "toning" goal and no toning claim on any surface** (an outcome claim, Blagrove).
**Why.** For a runner who lifts for general strength, varying the rep target across blocks at a kept RIR trains across
the strength-hypertrophy range without making any one block a circuit **[C]**; heavy 5s stay where running economy is
the aim (S6's evidence). Measured over the sweep sample: every running session byte-identical (25,507 of 25,507);
general sessions in an 8-rep block unchanged, the 10- and 6-rep blocks changed (13,913 of 27,823); session clocks inside
their budget in every block (29.4–29.5, 43.5–43.7, 56.0–57.3 min). A lift held across a block whose reps rise is handled
by S14 Am.1. **Check:** `S-REP-BLOCK` (a general main at its block's reps; a running lower main at 5);
`lib/marketing/noToningClaim.test.ts` (no toning copy in `app/`, `components/`, `lib/`, `packages/`).

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

**Defect fix (2026-10-18, PINNED-DAYS-01, restores the board's "first jump is the easiest" direction).** Jump level
climbed from the week the gate OPENED, so a runner whose days held no leg day for weeks met a level-2 jump first. It
now climbs from the first jump actually placed. **Check:** `S-PLYO-START-LEVEL`.

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
cooldown, until `FILL_TARGET` (0.95; 0.8 until Amendment 4) of the budget. A training session uses at least `MIN_BUDGET_USE` (0.5) of it,
except in taper and deload weeks, which are short on purpose.

**Why.** Rest is part of the dose for heavy work **[C]**; supersets roughly halve session time (Iversen 2021)
**[L]**; "30 minutes must be a real session" (McMillan). **Check:** `S-WARMUP`, `S-TIME-OVER`, `S-TIME-UNDER`.

**Amendment 1 (2026-10-16, Design Board STRENGTH-APP-01).** A warm-up item that is a training exercise in lighter
form (`same_as`) is left out when that exercise is in the session: a session never says the same thing twice. An
*Upper body* session carries no hip work; hip abductors stay in every full-body and lower session. **Check:**
`S-WARMUP-REPEAT`.

**Amendment 3 (2026-10-19, STRENGTH-FULLBODY-NO-UPPER-01, re-sat the same day).** A full-body session holds at least
`FULL_BODY_MIN_UPPER_ITEMS` (1) upper movement, pull first, supersetted with core so it rides in rest already spent.
Over budget it trims to 2 sets after the main lifts do, and it is the last accessory dropped, **before the jumps**. The
check applies from `FULL_BODY_UPPER_MIN_MINUTES` (45) up; at 30 minutes the session is named by what it holds.
**Why.** Measured: running-focus full body held no upper work in 92% of 30-min and 59% of 45-min sessions, because
the clock dropped the upper items first; S1 asks twice a week per region. Keeping it at 30 min cost the jumps in 326
of 376 sessions and ran 277 over the clock (rest is never shortened), so the board re-sat: jumps beat an upper
accessory at 30 min for running economy **[M]** (Blagrove, McMillan, Hutchinson). **Dissent, Sims:** half of 30-min
sessions still have no upper work; whole-body loading matters for bone in peri- and post-menopausal women, so 45
minutes is where it fits and the app should not call a legs session full body. **Check:** `S-FULLBODY-UPPER`.
Sitting: `docs/decisions/strength-upper-and-light-legs-2026-10-19.md`.

**Amendment 2 (2026-10-17, defect restoring intent: STRENGTH-START-WEEK-01, STRENGTH-PLYO-BUDGET-01).** Three
readings this constitution always meant and the engine did not do. **(a) Strength weeks count from when strength
started** (`start_date`), never the run plan's week 1: S6's technique block and S8's gate belong to the lifter. Set up
in week 8, a `new` lifter got heavy 5s and open jumps in their first session. **(b) Jumps are not an accessory**, so
under S10 they are dropped only after accessories and main-set trims, and come back first, at no less than
`PLYO_CONTACTS_START`, when the session has room: measured, jumps reached one week in sixteen (a deload). **(c) The
first jump is level 1** and climbs one rung per two blocks from the gate, never from the lifting level (board
direction, catalogue review): a `some` lifter's first jump was bounding or a drop jump. No numeric moved. **Check:**
`S-BEFORE-START`, `S-PLYO-MISSING`, `S-PLYO-START-LEVEL`; the validator counts from `start_date` too.

**Amendment 4 (2026-10-26, STRENGTH-FILL-01, Coaching Board).** The clock the runner chose is the clock they get. `FILL_TARGET` rises from 0.8 to **0.95**, and the fill step adds sets in `FILL_ORDER` (**accessory, core, then main**): a 4th main set comes only once accessory and core work is at its caps. Caps, rest and the short weeks (deload, taper, race week, the technique block, an accepted recovery ease) are unchanged. **Why.** The founder chose 60 minutes and got 48–56 (measured, all foci and levels); at 0.95 a 60-minute session runs 57–59. Spent main-first, the extra time went into a 4th set of every main lift, where strength has plateaued near 2–3 sets (S6) and a 4th heavy leg set adds to the §7 stress (S2); calf, hip and pulling work is where a runner is usually short (Blagrove, Willy). McMillan: an hour that delivers 51 minutes reads as the app ignoring you. **Check:** `S-TIME-FILL`, a training-week session under `FILL_FLOOR` (0.9) of its clock while an accessory or core set is still under its cap; and the fill-order arm in `validate.test.ts`.

**Amendment 5 (2026-10-28, STRENGTH-SUPERSET-MAINS-01, Coaching Board).** A session holding both a lower and an upper
main lift does them **back to back as a pair**: the i-th lower main with the i-th upper main, the same sets, and the
pair rests the **longer** of the two rests the lifts carry alone (heavy running legs `REST_S`.heavy, otherwise
`REST_S`.main). Never two lower lifts in a pair, and jumps keep their own block, so never a heavy lift with a
plyometric. A pair trims and fills as one: a superset runs as many rounds as its longer half. The time saved goes to
Amendment 4's fill order (accessory, core, then main). The **warm-up is `WARMUP_ROUNDS` rounds of
`WARMUP_ITEMS_PER_ROUND`** (2 of 4 at 45 minutes, 2 of 5 at 60, one round of 4 at 30), plus the single ramp set before
heavy legs, inside the `WARMUP_MINUTES` the clock already reserves. **Why.** The upper lift is done while the legs
recover, which is what the rest was for, so no rest is lost to either lift; non-competing pairs are already how
accessory and core work is run. The warm-up's content was 3.1, 3.7 and 4.2 minutes against 6, 8 and 10 reserved
(measured, all foci): two rounds of a shorter list repeat the movements that matter instead of listing more of them
once **[C]**. Measured: today only general-focus full-body sessions hold an upper main lift beside a lower one (2,372
of 6,606 at 30 minutes, 1,433 of 6,973 at 60); running-focus sessions have no upper main, so none pair, and every
pairable lift rests 90 s, so the longer-rest rule has nothing to choose between until a heavy lower lift is paired.
A paired session saves 7.4, 7.1 and 8.1 minutes on average at 30, 45 and 60 minutes (3 to 12). General 45-minute sessions keep their whole template where the clock used to drop the accessories: mains average 7.1
sets against 7.5, accessory and core 12.5 against 10.7. Warm-up content now 3.1 / 6.0 / 7.1 minutes. **Check:**
`S-MAIN-PAIR-REST` (a pair is one lower and one upper main, same sets and rest, at least each lift's own rest; a lower
and an upper main left unpaired) and `S-WARMUP-ROUNDS` (rounds and items per round, at most one ramp set, content
inside the reserved minutes; an accepted recovery ease keeps its ramp set, and leaves no half of a pair behind).

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

## S14. Load progresses from what the runner logs

**Principle.** On a loaded main lift the runner may log the weight and one of three feels against the session's RIR
target (*easy*: two or more reps to spare beyond it; *right*; *hard*: at or near failure, or form went). The next
session of that lift **suggests** a load; it never requires one, and no log means no change. The rule, over the
runner's logs for one lift: *easy* steps up; *right* twice at the same weight steps up; *hard* holds; *hard* twice at
one weight comes down `LOAD_REDUCE_PCT` (0.1). A step is `LOAD_STEP_KG_LOWER` (2.5 kg) on a lower-body lift and
`LOAD_STEP_KG_UPPER` (1 kg) on an upper one, rounded to `LOAD_ROUND_KG` (0.5); when that is more than
`LOAD_STEP_MAX_PCT` (0.1) of the load, a rep is added instead, up to `REP_PROGRESSION_MAX` (2), then the load. At most
one rise per lift in `LOAD_STEP_MIN_DAYS` (7), counting a rise the runner made themselves. If the runner's injury tags
load the lift's muscles (`INJURY_LOADED_MUSCLES`), *easy* counts as *right*. Nothing rises in a deload, taper, race
week or recovery-eased session, and logs from those sessions do not count. Reps, sets, RIR and the variant cadence stay
the engine's (S6, S7); bodyweight lifts log the feel only.

**Why.** No 1RM, so autoregulation from reps in reserve is the only honest way to set load, and it performs at least
as well as fixed percentages **[M]**. It may hold or come down; it never jumps (Hutchinson). One rise a week keeps
tissue ahead of load (Willy). Adding reps before a large relative jump protects lighter lifters, more often women
(Sims). Optional because the plan must never wait on a form (McMillan). Sitting:
`docs/decisions/strength-progression-coaching-2026-10-18.md`. **Check:** `S-PROGRESSION-BOUNDED`
(`progressionViolations`, swept over generated histories).

**Amendment 1 (2026-10-28, STRENGTH-REP-BLOCKS-01, Coaching Board).** When today's prescribed reps are **above** the
reps the plan prescribed on the date of the last counting log (S6 Am.2's cycle going round, 6 → 10), the suggested
load is the lower of that log's load and S14's own answer × `(1 + (last reps + RIR)/30) / (1 + (today's reps + RIR)/30)`, Epley's ratio at reps-to-failure,
rounded **down** to `LOAD_ROUND_KG` and never below it, with no extra reps carried; it applies in a no-step week too.
Equal or falling reps: S14 unchanged. The ratio is never applied upward. Logs store load and feel, so the reps come from
the plan at the log's date; a log the plan has no reps for reads as S14 always read it (⚠️ a rebuild can move a log's date into another block: `STRENGTH-LOG-REPS-01` stamps the reps on the log). The screen says the reps with the weight ("Try 54 kg for 10."). **Why.** Ten reps at a six-rep
weight is a failed set, not a harder one (Blagrove); 6 to 10 at RIR 2 is about a tenth lighter. Rounding down puts any
error on the light side; an estimated rise is the one error that injures (Willy, Hutchinson). Measured before the fix:
904 carries with the reps rising in 429 of 819 sampled general plans. Blagrove's dissent (convert upward too on a fall)
is recorded in the sitting: `docs/decisions/coaching-2026-10-28-rep-rise-load-sitting.md`. **Check:**
`S-PROGRESSION-BOUNDED` ("not lighter when the reps rose").

## Honesty notes the plan carries

`bodyweight_ceiling` (no load kit: builds the habit and some strength; load is what moves economy) ·
`split_is_inference` · `legs_limited_by_run_week` · `fewer_sessions_than_asked` · `pattern_unavailable`. The app
phrases them; the engine only states them.
