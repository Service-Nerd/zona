# Coaching Board — the 31 open items, analysed and triaged · 2026-11-12

**Input:** founder instruction, 2026-11-12 — *"I want analysis ran for the 31 to the coaching board
and sit the board. I want a plan to fix and prioritisation on them off the back of it."*

**Population:** the 31 open items `open_item_boards` tags 🏃 COACHING BOARD. Derived from the gate,
not from a list — the board tag is mandatory on every open item and `backlog:verify` fails without
one, so this population is complete by construction.

---

## 🔴 The finding that governs the whole sitting

**Six of the thirty-one are blocked on evidence that does not exist, and the quantity of that
evidence is not a coaching problem.** Measured against production, 2026-11-12, non-admin
non-internal:

| | |
|---|---|
| Runs in the activity log | **377** |
| `run_analysis` rows (a read) | **27** |
| Users who have ever completed a session | **5** |
| Live session completions | **21** (18 superseded) |
| …carrying a linked activity | **4** — and **0 from Strava** |
| Users with ≥1 HR-bearing analysis | **2** |
| Users with ≥3 HR-bearing analyses | **1** |

🏃 **Hutchinson, chairing:** *"We are asked to rule on tendon adaptation, pattern detection and
long-run ceilings for a population of five people, four linked runs and twenty-seven reads. On most
of these the honest ruling is not CORRECT or INCORRECT, it is **that we are not the blocker.** I
will not let this board manufacture confidence out of a corpus when the thing it describes has
barely happened to anyone."*

⚠️ **This is not an argument for doing nothing.** Fifteen of the 31 are answerable from the
generation corpus, which is 41,472 inputs and does not need a single user. The split below is
exactly that: what the engine can be asked, versus what only runners can answer.

---

## 📐 Gates re-measured before any seat spoke

An item is a snapshot of the day it was written. Three carried a gate that could be checked now,
and **two of the three had moved**.

### `EMAIL-WAVE-4-PATTERN-01` — still blocked, and the gap is wider than "nearly there"

Gate: **≥3 real users with ≥3 HR-bearing *analyses* each.**
Measured: **1 user** clears it. Only **2 users have a single HR-bearing analysis at all**; the best
has 10.

⚠️ **The item's own history is why this was re-measured rather than read:** its 2026-10-06
"unblock" counted HR-bearing **runs** in `strava_activities` and reported 14. Measured on
`run_analysis` — where every pattern signal actually lives — it was 1. **The same mistake is
available today**, and the answer is still 1.

### `LOG-OFFPLAN-03` — the blocker is confirmed, and worse than filed

The item says the blocker changed shape from user count to **link rate**. Measured: of **21 live
completions, 4 carry a linked activity** — and **none of them from Strava**, consistent with the
Strava application still being Inactive. 377 runs exist in the log against 21 completions.

🎯 **McMillan:** *"Off-plan logging is a feature for people whose runs are already landing in the
plan. Four of them are. This is not a coaching question yet."*

### `GRID-NO-MENOPAUSAL-TENDON-01` — premise verified structurally, unchanged

`cohortGrid` sets `injury_history: []` on its cartesian; `targetedGridCore` hardcodes `age: 40`;
`MASTERS_AGE_THRESHOLD` is **45**. **The post-menopausal × tendon cell is unreachable by both
grids, by construction** — confirmed in the source, not inferred.

⚕️ **Sims:** *"The cell I said I care most about still cannot be reached by either instrument. That
is not a finding about runners, it is a finding about our measurement, and it is cheap to fix — it
is an axis in a grid."*

---

## ⚖️ The triage, and why a 31-item sitting would be malpractice

🧭 The board rules on **coaching correctness**. Of the 31, **thirteen are not that question**, and
ruling on them would be this body deciding things it does not own.

| Class | n | What it actually is |
|---|---|---|
| **A — Ruleable now** | 4 | measured premise, clear question, the board owns it |
| **B — Needs a corpus measurement first** | 11 | the board has said so itself on most of them |
| **C — Blocked on production evidence** | 6 | not ours; re-check on a date, do not sit |
| **D — Defect against documented intent** | 3 | **exempt from this board** — restore and ship |
| **E — Mis-routed or answers itself** | 5 | re-route or close |
| **F — Large side project** | 1 | `STRENGTH-ENGINE-01`, its own programme |
| **G — Declared residual** 🔻 | 1 | accepted, visible, not scheduled |

---

## 🅐 Ruleable now — 4

### `GETRUNNING-WALKRUN-FLOOR-01` → **not ours. Exempt: defect against documented intent.**

§116's floor note already reads: *"Below `BASE_BUILD_ONRAMP_MIN_START_KM`, including 0, the runner
starts with a WALK-RUN start."* The producer has no walk-run path, so a runner below the floor gets
continuous running **against the principle's own text**. 🏃 Hutchinson: *"There is nothing to rule.
The doctrine is written, the engine disagrees with it, and a board sitting to re-affirm what §116
already says is theatre. Build it, and the invariant comes with it."*

### `SHORTDIST-RUNWALK-SCOPE-01` → **CORRECT WITH AMENDMENT**

A 5K/10K runner at `longest_run 0` is prescribed a **16-minute continuous long run**, while the
half and marathon **refuse the same runner**. 🔴 **Type the harder race, get the safer answer — the
third appearance of that inversion in three days.**

🩹 **Willy:** *"A sixteen-minute continuous run is not dangerous in itself, and that is the trap. It
is the wrong PRESCRIPTION for someone whose longest run is zero, and we refuse the identical runner
at 21.1 km. We are not inconsistent about risk, we are inconsistent about which form asked."*
🎯 **McMillan:** *"Short-distance runners are the beginners. This is the cohort, not an edge."*
**Amendment:** §117's run-walk must reach 5K/10K, **not** by extending the refusal — a 5K is the
right first race and refusing it would be worse than the defect.

### `WEEK1-DELIVERED-CEILING-01` → **INSUFFICIENT EVIDENCE**, with the evidence named

Measured (2,520 probes): at a fixed 5 km longest run, week 1 is **13 km at a declared 5, 6, 8 and
10 km/week — identical** — so the §2 step reads 2.60× / 2.17× / 1.63× / 1.30× purely because the
denominator moves.

📊 **Seiler:** *"The delivered week ignoring the declared week is a real finding and the step ratios
are arithmetic, not evidence. What is missing is what BOUNDING week 1 costs."*
⚖️ **Ruling:** the board will not set a ceiling without `measure:fitness` on both sides.
**Condition: run the fitness harness with and without a declared-week bound, at every distance, and
bring `neverBuildsPct` and net build with it.** Precedent is explicit — a sitting approved a change
on classification alone and it sent a low-base beginner 7.3 → 18.5 km in one week.

### `STRENGTH-CARRY-PATTERN-01` → **the board's own ruling is unbuildable as stated**

💪 **Blagrove:** *"We ruled that two carries back to back is one part, a merge not a superset. There
is no `carry` pattern — `suitcase_carry` is `anti_rotation` and `farmer_carry` is `lateral_core`.
The ruling named a thing the data model does not have, which is my error and not the engineer's."*
⚖️ **Ruling: CORRECT WITH AMENDMENT** — the merge keys on a **named exercise set**, not on a
pattern that does not exist. 🔻 Blocked behind `STRENGTH-PAIR-STRIDE-01`, which rewrites the same
walk.

---

## 🅑 Needs a corpus measurement first — 11

**None of these needs a single user.** Each names a number nobody has derived.

| Item | The measurement that unblocks it |
|---|---|
| `ACHILLES-QUALITY-ONSET-01` | `measure:fitness` on tendon histories, onset ramped vs not |
| `GRID-NO-MENOPAUSAL-TENDON-01` | **add the axis** — injury to `cohortGrid`, age to `targetedGrid` |
| `COACH-READ-1027-FOLLOWUPS-01` | seven claims from the 27 Oct read, each on the grids |
| `ROUND-WARNS-UNRULED-01` | the packet exists; weigh 74 firings across 9 codes |
| `WEEKDAY-OVERRUN-BOUND-01` | what a magnitude bound and a share bound COST |
| `SEGMENTED-LR-HR-01` | how many sessions carry an impossible HR cap |
| `S9-QUALITY-FLOOR-REACH-01` | three paths, each re-counted after the 177-plan revert |
| `BEGINNER-TAPER-RACE-ROW-01` | how many beginner tapers reach the sharpener |
| `ROUND-NOTE-TIME-GOAL-01` | how many time-goal plans carry the contradiction |
| `SHORTFALL-PINNED-DAY-BUDGET-01` | 39 of 2,055 measured — re-derive, then rule |
| `DELIVERED-TAIL-LEVERS-01` | injury 18% · healthy masters 79% · healthy standard 105% |

🩹 **Willy on the last one, already on the record:** *"healthy tissue does absorb more than
previously-injured tissue, so a higher ceiling for the healthy is defensible."* ⚖️ The chair notes
**that is a defence of the direction, not of 105%** — the magnitude is unruled.

---

## 🅒 Blocked on production evidence — 6. **Do not sit these.**

`EMAIL-WAVE-4-PATTERN-01` (1 of 3 users) · `LOG-OFFPLAN-03` (4 linked runs) ·
`INJURY-RECENCY-01` (4 of 32 plans carry the histories) · `LONG-RUN-CAP-INJURY-VALUE-01`
(reopens on a prototype + recency) · `RECAL-GOAL-REACH-01` and `RECAL-MIXED-MEAN-01`
(recalibration is rare; **1 read in the entire trial cohort**).

⚖️ **The chair's instruction: each gets a DATE, not a queue position.** Re-measure the gate on
**2026-12-12**. A blocked item re-read monthly is governance; one re-read whenever someone
remembers is a backlog.

---

## 🅓 Defect against documented intent — exempt from this board — 3

`GETRUNNING-WALKRUN-FLOOR-01` (above) · `ULTRA-VOICE-REPURPOSED-01` (a note describing a session
the runner is not doing) · `PRINCIPLE-REGISTER-CROSSCHECK-01` (three principles an invariant
enforces while the manifest says nothing can — a **records** reconciliation, not a prescription).

**Build them. State the exemption in one line and proceed.**

---

## 🅔 Mis-routed or answers itself — 5

| Item | Where it belongs |
|---|---|
| `HR-SAVE-UNEDITED-CONFIRMS-01` | **Closeable.** The item's own research concludes a save IS a confirmation by design, landed in one commit with the copy that promises it, and making it conditional left a genuine low-max athlete no route to confirm. Nothing to rule. |
| `RUNKED-COMPARE-PAGE-01` | 💼 SLT (build order) → 👤 founder (copy). This board owns only the **claims**, which the existing claims gate already checks. |
| `RUNKED-GUIDES-01` | as above |
| `ENGINE-COPY-SHARPEN-01` | already re-routed 👤 FOUNDER; the tag should follow |
| `DOUBLE-STRIDES-01` | genuinely ours (strides in a double), but it is **one question inside an item carrying a design question too** — split it |

---

## 📋 The plan, in the order it should be done

### Wave 1 — ships without a sitting (defect fixes, documented intent)
1. **`GETRUNNING-WALKRUN-FLOOR-01`** — the engine contradicts §116's own text. Highest value here:
   it is the floor beneath every never-run-before runner.
2. **`ULTRA-VOICE-REPURPOSED-01`** — a note describing a session the runner is not doing.
3. **`PRINCIPLE-REGISTER-CROSSCHECK-01`** — records reconciliation, cheap.
4. **Close `HR-SAVE-UNEDITED-CONFIRMS-01`**, re-tag `ENGINE-COPY-SHARPEN-01`, re-tag the two
   Runked items, split `DOUBLE-STRIDES-01`. **Five items leave the coaching queue without a
   ruling** — 31 → 26.

### Wave 2 — one measurement, unblocking the most
5. **`GRID-NO-MENOPAUSAL-TENDON-01`: add the axes.** Injury to `cohortGrid`, age to
   `targetedGrid`. ⚠️ **This is the highest-leverage item in the 31** — it is a measurement gap,
   not a prescription, and `ACHILLES-QUALITY-ONSET-01`, `LONG-RUN-CAP-INJURY-VALUE-01`,
   `DELIVERED-TAIL-LEVERS-01` and `COACH-READ-1027-FOLLOWUPS-01` all need the cells it would open.
   🔴 **And the cost is real and must be stated before it starts: widening the grid moves every
   baseline that reads it** (`cohort:shape`, `measure:fitness`, the sweep), so the first run is a
   re-baseline with a declared reason, not a green tick.

### Wave 3 — the sitting the board can actually hold
6. **`SHORTDIST-RUNWALK-SCOPE-01`** — ruled above; build §117's reach to 5K/10K.
7. **`WEEK1-DELIVERED-CEILING-01`** — run the fitness harness both ways, then re-sit.
8. **`SEGMENTED-LR-HR-01`** — a session whose HR cap and prescription cannot both be met is a
   contradiction on the runner's screen, not a subtlety.

### Wave 4 — measured, then ruled
9. `ROUND-WARNS-UNRULED-01` · `WEEKDAY-OVERRUN-BOUND-01` · `S9-QUALITY-FLOOR-REACH-01` ·
   `BEGINNER-TAPER-RACE-ROW-01` · `ROUND-NOTE-TIME-GOAL-01` · `SHORTFALL-PINNED-DAY-BUDGET-01`

### Standing
- **`BASEBUILD-DURATION-01`** — diagnosis settled, remedy failed **twice**. 🔴 Do not attempt a
  third build before the board rules on **option 3 from its own sitting**, which was dropped.
- **`STRENGTH-PAIR-STRIDE-01`** → then `STRENGTH-CARRY-PATTERN-01`, which its rewrite touches.
- **`STRENGTH-ENGINE-01`** — its own programme, not a queue item.
- **Six C-items: re-measure the gates 2026-12-12.**

---

## ⚠️ What this sitting does not prove

- **No ruling here was made with `measure:fitness` numbers in front of it**, which is why only one
  item was ruled outright and the rest carry named conditions. The precedent is explicit: a sitting
  that ruled without them approved a change that sent a beginner 7.3 → 18.5 km in a week.
- **The production numbers are 5 users and 27 reads.** Any claim about what runners experience is
  made on that, and the C-class exists because of it.
- **The corpus cannot see what the corpus does not vary**, which is the whole of
  `GRID-NO-MENOPAUSAL-TENDON-01` and the reason it is Wave 2 rather than Wave 4.
