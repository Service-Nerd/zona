# Catalogue additions — proposal for the board (CAT-DEPTH-01 follow-on)

**Status:** proposal. Nothing here is built. Requires a Coaching Board sitting
(hard trigger: `session-catalogue.md`, `generationConfig.ts`).
**Date:** 2026-09-04
**Origin:** CAT-DEPTH-01 — the wizard's upward answers have no inventory behind
them. The board ruled the gap is catalogue *content*, not selection logic.

---

## 1. What the catalogue actually contains today

Fourteen hard rows. Measured, not assumed:

| category | rows | difficulty tiers |
|---|---|---|
| threshold | 5 | **3, 3, 3, 3, 3 — no spread** |
| vo2max | 4 | 3, 4, 4, 4 |
| race_specific | 5 | 3, 4, 4, 4, 4 |

Every threshold row is **T-pace with easy recovery**, differing only in rep
shape: one continuous, N×10 min, N×5 min, thirds, and a ladder. They are
honestly all tier 3 because they are one session written five ways.

**Consequence, measured.** Declaring `user_declared_level: 'experienced'` raises
the dose bands ~20% (`THRESHOLD_WORK_TARGET_MINS` 18/22 → 22/26,
`VO2MAX_WORK_TARGET_MINS` 12/15 → 15/18). But rep lengths are so coarse — 10 min,
5 min, 1 km, 1200 m — that a 20% increase almost never crosses an integer rep
boundary. On a 12-week 10K plan it changes **one session out of six**
(Classic VO2max, 5×3 min → 6×3 min). Everything else is byte-identical.

The dose responds. The catalogue's granularity swallows it. Same quantisation
that closed EG-01.

---

## 2. What the research says is missing

Sources: Runna's own session taxonomy, The Running Channel, TrainerRoad and
INSCYD on over-unders, and Daniels-derived threshold progressions.

Named session families Zonna has **no row for**:

| family | what it is | why it matters here |
|---|---|---|
| **Over-unders** | alternating just above and just below LT — e.g. 3 min over / 3 min under, repeated | the only way to make a threshold session harder without making it longer. Trains lactate shuttling and clearance rather than more time in the same state |
| **Pyramids** | rep length steps up then down — 1-2-3-4-3-2-1 min, recovery ≈ half the rep | fine-grained by construction, so dose changes express continuously. Directly fixes the quantisation problem |
| **Mile / long-threshold repeats** | 4–5 × 1600 m @ T, 90 s jog (clearance focus) or 5–6 × 1600 m @ 10K pace, 3 min (repeatability) | the standard "am I actually fit" session for a 10K runner. Zonna's nearest row is 1 km at I-pace — shorter and faster, a different stimulus |
| **Long run with a goal-pace segment, below HM** | last third at goal effort | Zonna has this for HM and marathon only. 5K/10K/50K/100K runners never get one |

Published threshold session-time guidance across all sources converges on
**18–30 min** per session, which is where `THRESHOLD_WORK_TARGET_MINS` already
sits. No numeric change needed for the dose — only for the new rows' own bands.

---

## 3. Two blocking findings

### 3.1 There is no pace anchor between T and I

`PACE_ANCHORS` declares eight: `E, T, I, R, M, goal, race_5K, race_3K`.
`resolveAnchorPace()` resolves **four** — `E`, `T`, `I`, `goal` — and returns
`null` for `M`, `R`, `race_5K`, `race_3K`.

An over-under's "over" segment is run at roughly 10K pace, which sits between T
and I. **There is no anchor for it, and four of the declared eight are dead.**
This is §17's reachability failure class (declared, never exercised) sitting in
the pace layer rather than the plan-shape layer.

Either resolve an existing anchor or add one. Not a free choice — it changes
`PaceGuide`, which is board territory.

### 3.2 §19 constrains how an over-under may be labelled

`INV-PLAN-LABEL-MATCHES-PACE` checks the **midpoint** of `pace_target` against
T-pace within ±3% for any threshold-labelled session. An over-under's raw range
spans over-pace to T, so its midpoint sits above T — capping the "over" at
roughly 6% faster than T before the check fires. 10K pace is typically 4–6%
faster than T. It lands on the boundary.

Two resolutions, board picks:

- **(a)** author the displayed target as the **time-weighted mean** (2 min at T
  to 1 min over ⇒ mean close to T) rather than the raw range. No principle
  change. Requires the step targets and the displayed band to differ — which
  ADR-019's `derived_set` can carry and a single `pace_target` string cannot.
- **(b)** amend §19 to permit a bounded excursion inside a threshold-labelled
  session.

(a) is cleaner and does not touch the constitution.

---

## 4. Proposed rows

Structures in ADR-019 v2 form. Tiers assume the board accepts that "harder" for
threshold means density and excursion, not more minutes.

| id | category | tier | phases | distances | structure |
|---|---|---|---|---|---|
| `tempo_over_under` | threshold | **4** | build, peak | 5K, 10K, HM, MARATHON | `Nx[w:180s@<over> w:180s@T]` |
| `threshold_pyramid` | threshold | **4** | build, peak | 10K, HM, MARATHON, 50K, 100K | `1x[w:60s@T r:30s@E w:120s@T r:60s@E w:180s@T r:90s@E w:240s@T r:120s@E w:180s@T r:90s@E w:120s@T r:60s@E w:60s@T]` |
| `threshold_mile_repeats` | threshold | **4** | build, peak | 10K, HM, MARATHON | `Nx[w:1600m@T r:90s@E]` |
| `long_run_goal_segment` | race_specific | 3 | peak | 5K, 10K, 50K, 100K | v2 equivalent of the existing `long_run_with_segment` |

**Why tier 4 for all three new threshold rows.** They are the tier-4/5 threshold
inventory CAT-DEPTH-01 found missing. Once they exist, an experienced
declaration has somewhere to land that an intermediate declaration does not —
which is the entire point. Without them, no selection lever can work, which is
what four measured attempts already demonstrated.

**Deliberately not proposed:** fartlek (unstructured — Zonna prescribes, §40b
governs effort sessions already), strides (already an appendix under §28), and
anything needing GPS, cadence or power (ADR-011).

---

## 5. What this unblocks

1. **CAT-DEPTH-01** — the declaration gets an inventory to select from.
2. **CAT-ULTRA-THIN-01** — eligible pool per pick widens from 3–5.
3. **§53 variety** — more rows, less repetition across a plan.
4. **EG-01's quantisation** — a pyramid's 60 s components express a 20% dose
   change continuously where 1 km reps cannot.
5. **The founder's long-run observation** — a 10K plan gains a goal-pace long run.

---

## 6. Open questions for the board

1. Is an over-under a **threshold** session, given part of it is above T?
   (Physiologically yes; §19 makes it a labelling question — see 3.2.)
2. Which pace anchor resolves the "over" — revive `race_5K`, or add a 10K/CV
   anchor? What does a runner with no benchmark get, since VDOT may be absent?
3. Do the new rows share `THRESHOLD_WORK_TARGET_MINS`, or does an over-under
   need its own band? **Sims's standing amendment: 22 min of over-unders is not
   22 min of steady T.**
4. Mile repeats at 1600 m in a metric-first product — 1600 m, or 1 km × more
   reps? (ADR-015 owns the display; the row owns the distance.)
5. Willy's standing condition: gated on demonstrated readiness, not the dropdown
   alone (§79). What evidence qualifies a runner for tier 4?

---

## 7. Investigated and NOT a defect — do not re-raise

With no benchmark, a 10K plan prescribes "Classic VO2max" at **4:30-5:00 /km**
against a 10K goal pace of **4:30 /km**. That looks like a mislabel and is not.

The engine does not believe the runner can run 45:00; it prescribes from its own
fitness assessment and **annotates the gap honestly** — measured:

    goal 0:45:00 -> "Demanding - the pace you're targeting is quicker than your
                     benchmark currently supports"
    goal 0:58:00 -> ok

A VO2max band slower than goal pace is the correct expression of "your goal is
ahead of your current fitness", not a §19 violation. The §19 numeric arm being
gated on `plan.meta.vdot` is therefore not hiding anything here.

Filed as investigated-and-closed so the next reader does not spend the same hour.
Provisionally logged as VO2MAX-NOVDOT-01 and **withdrawn**.

---

# OUTCOME — shipped 2026-09-04 (CB-CAT-01)

**Board:** CORRECT WITH AMENDMENT. Ruling and amendments recorded in
`CoachingPrinciples.md` §85. Three artifacts landed in one commit:
principle §85 · `SESSION_WORK_OVERRIDE_MINS` + the CV band ·
`INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD`.

## What shipped

| | |
|---|---|
| **CV pace anchor** | 0.88–0.92 vVO2max (mid 0.90), discounted VDOT. Ninth anchor, and the first added that is actually *resolved* — `M`, `R`, `race_5K`, `race_3K` remain declared-but-dead. |
| `tempo_over_under` | T4 · N × (3 min CV / 3 min T / 2 min jog) · own dose band · `min_weekly_km: 35` |
| `threshold_mile_repeats` | T4 · N × (1600 m T / 90 s jog) · `min_weekly_km: 40` |
| `threshold_pyramid` | **T3** · two real variants (16 / 23 min) · `min_weekly_km: 30` |

**Eligible pool per quality pick: 3–5 → 7–8.** That is CAT-ULTRA-THIN-01's
thinness closing as a side effect.

## Measured result — better, NOT solved

A 12-week 10K plan, `intermediate` vs `experienced`, everything else equal:

* **before:** 1 session of 6 differed (Classic VO2max, 5×3 → 6×3)
* **after:** 2 of 6 differ (Classic VO2max **and** Long VO2max, 3×1 km → 4×1 km)

**The threshold sessions are still identical between declarations**, for two
reasons that the catalogue work did not touch:

1. **§22 goal-paces most build threshold work on a time-targeted plan**, and goal
   pace is the runner's stated target — identical whatever they declare. Only
   VO2max rows escape the override, which is why only VO2max rows differentiate.
2. **`threshold_mile_repeats` reintroduces the quantisation it was meant to
   dodge.** A 1600 m rep is ~7.2 min at goal pace; targets of 18 and 22 minutes
   both round to 3 reps. Coarse reps swallow a 20% dose change exactly as 1 km
   reps did (EG-01, §85).
3. `threshold_pyramid` is `scaling: 'fixed'` and its variants rotate by week
   number, so it cannot respond to the declaration at all.

**Do not read the pool widening as the differentiation problem being solved.**
The inventory now exists, which was the blocker; converting inventory into
per-runner differentiation is the next piece and needs finer rep granularity or
dose-aware variant selection, not more rows.

## Verification

* `npm run verify` — **956 tests, 115 files, matrix 17/17, sweep 16,141 plans / 0
  violations**, input coverage 22 fields varied.
* **Engine changes proved a no-op.** New engine + pre-CB-CAT-01 catalogue vs
  `HEAD`, 54 plans across 6 distances × 3 day-counts × 3 declarations: the only
  difference anywhere was `meta.generated_at`. All behavioural change comes from
  the rows, none from the sizing edit.
  *(First attempt at this compared two EMPTY files and reported success — a
  suppressed `DaysAvailableError`. Recorded because it is the exact failure
  `feedback-verification-must-reach-the-change` warns about.)*
* **Invariant falsified.** Moving the CV midpoint 0.90 → 0.97 raised **6**
  `INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD` violations; restoring it goes green.

## Four things found while building that the ruling did not anticipate

1. **`pacedRepPlan` read only the FIRST work step.** Fine for every prior row
   (all had one); an over-under would have been sized off half its own rep.
2. **The §19 margin the ruling relied on was not enforced for this row.** §19's
   numeric arm fires on the label; "Over-unders" contains none of the words it
   watches, so the row walks through SC-08's label-evasion hole. The first
   implementation displayed plain T-pace on a session half of whose work is above
   T — caught only because the new invariant existed.
3. **`hasMixedWorkAnchors` first counted `progressive_tempo` as mixed** (its ramp
   is authored `work @ E`), excluding it from §22 and breaking 74 tests. Easy-
   anchored work is a ramp, not a second working pace.
4. **SC-10's symptom pin came right without the defect being fixed** — see below.

## SC-10 / SIZING-REALLOC-01 — now MASKED, still open

`mainSetSizing.test.ts` pinned "VO2max has the longest main set", with a note
saying that if it ever came right, the fix had landed and the test should be
deleted. **It came right. The fix did not land.**

Measured across 16 plans (5K/10K/HM/MARATHON × 4–5 days × two declarations) the
inversion now appears in **zero**, where it was previously reliable. But
`QUALITY_SESSION_PCT_OF_WEEKLY` is still a flat 18% with no per-category term —
which *is* the defect. The ordering is emergent from session structures and
remains ungoverned; the new rows simply changed which structure is longest.

Deleting the test on its own invitation would have recorded a fix that never
happened. The pin now guards the **cause** (the flat share) instead of the
symptom, and fails if per-category sizing ever appears — at which point SC-10
should genuinely be re-measured.

**A masked defect is more dangerous than a visible one.** This is the second time
in two days a green result meant "the check stopped reaching the thing", not
"the thing is right".


---

# CB-CAT-02 — Phase 2, same day

Origin: the founder's "do all of these" — implement `rep_length` scaling, do
per-category main-set sizing, and validate a plan. **Two of the three were the
wrong task, and measuring said so before any code was written.**

## What the measurement changed

| task as stated | what measurement found |
|---|---|
| "implement `scaling: 'rep_length'`" | **Blocked by doctrine, not effort.** SC-08 makes rep length the *stimulus identity*; EG-01 rejected re-specifying it. Rep COUNT is the dose. Third time proposed, first time written down (§86). |
| "per-category main-set sizing" | **Already built, swept and rejected** (CD-14): 15% -> 187 ordering breaches + 220 undersized sessions; 17% broke ordering outright. Also: only **11.8%** of quality sessions still use the flat share, and it is two rows, not an architecture. |

I had also filed SC-10 under "SIZING-REALLOC-01" in this morning's backlog entry.
Wrong: SIZING-REALLOC-01 closed 2026-09-03; SC-10/CD-14 is the per-category
sizing question, decided against. Corrected.

## Shipped

1. **Dose-aware variant selection**, opt-in via `parameterisation.select_by`.
   `threshold_pyramid` opts in; everything else keeps rotation (Seiler's
   condition — variants are normally a variety dial, and "always pick the
   biggest" is a load increase wearing the name of selection).
2. **`threshold_ladder` structure-driven sizing.** It stated **61 min** for a
   3-5-8-5-3 ladder whose own structure needs **50**.
3. **`INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT` extended** to the
   fixed-shape sized rows — its documented blind spot was exactly where the
   61-minute ladder lived.

## Reverted in the same sitting — `hm_pace_intervals` v1 -> v2

Correct in principle (`reps: 4` hardcoded for every runner at every fitness) and
unshippable today:

- anchored at `goal` -> threw on every **finish-goal** plan (no goal pace to size
  reps against);
- anchored at `HM`, its v1 pace -> threw for a **structurally-beginner** runner,
  who has no HM pace (§24b) but can draw an `intermediate` row through an upward
  declaration. **71 hard failures in the sweep, all `21.1km/beginner`** — a live
  §79 two-axes boundary the row surfaced;
- failing soft -> **1,439 `INV-PLAN-DERIVED-SET` violations**, because a v2 row
  must stamp a derived set.

The blocker is that row eligibility cannot express *"this row needs a pace this
runner has"*. Filed rather than forced.

## Measured outcome

Sessions differing between `intermediate` and `experienced`, same runner:

| | start of day | after CB-CAT-01 | after CB-CAT-02 |
|---|---|---|---|
| 12-week 10K | 1 of 6 | 2 of 6 | **3 of 6** |
| 14-week HM | — | — | **3 of 7** |

Falsified, not asserted: forcing variant selection back to rotation drops both to
2. Removing the ladder from the sizer returns it to 11.5 km / 61 min.

**Still not differentiating:** `HM-pace reps` gives 2 x 2 km to both levels — 3
reps would be 30.6 min against a 30 min band ceiling. That is EG-01's documented
property (a distance-anchored rep cannot fill a time-anchored band), not a new
defect.

## The invariant extension was silently dead on first write

It parsed step lengths and required a unit suffix (`3 min`, `90s`) — but
`lib/format` also renders `1:30`, with no unit. Every step-set containing a mm:ss
recovery returned null and the session was skipped, so the check reported **green
with the defect deliberately reintroduced**.

Only falsification caught it. Third time in two days that green meant "the check
did not reach the thing".

## Verification

`npm run verify`: **956 tests / 115 files, matrix 17/17, sweep 16,141 plans, 0
violations, 0 hard failures.** Each of the three changes falsification-tested
individually.
