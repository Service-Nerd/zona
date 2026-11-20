# Coaching Board — `WEEK1-DELIVERED-CEILING-01` · 2026-11-20 · re-sitting · ⛔ INCORRECT (veto)

**Input:** founder instruction, 2026-11-20 (*"run all the board sittings… Do analysis before you take each item to the
board"*). The board's own 2026-11-12 condition, INSUFFICIENT EVIDENCE: *"`measure:fitness` with and without a
declared-week bound."* The evidence filed 2026-11-13 (`npm run board:week1-bound`) records that the question *"has changed
shape"*: no longer *what does bounding cost*, but **which lever can bound a week whose easy runs are already on §52's
floor.**

**Trigger:** soft (qualifies). The proposal changes what the engine prescribes at week 1 for healthy runners at every
distance. **Proposed change, one sentence:** extend ADR-022's delivered-ceiling levers (*"easy runs trim while the §52
long run never does"*) to healthy runners, bounding week 1 at §2 Am. 3's ceiling `max(base × 1.30, base + 2)`.

---

## Analysis (before any seat spoke)

### 1. The filed evidence re-runs, and it holds

`npm run board:week1-bound`, 2026-11-20:

| distance | n | over ceiling | over: med w1 | over: med ceiling | med gap | easy-trim reach / partial / **CANNOT** |
|---|---|---|---|---|---|---|
| 5K | 737 | 36 (4.9%) | 13.0 | 7.0 | 6.0 | 0 / 0 / **36** |
| 10K | 753 | 37 (4.9%) | 5.0 | 2.0 | 3.0 | 0 / 0 / **37** |
| HM | 574 | 38 (6.6%) | 14.0 | 13.0 | 1.0 | 0 / 0 / **38** |
| marathon | 479 | 18 (3.8%) | 18.0 | 13.0 | 5.0 | 6 / 2 / **10** |

**Item vs today:** plans **2,539 → 2,543** (10K 749 → 753); over-ceiling **129 → 129**; CANNOT **111 → 111**. Unchanged.

⚠️ **One correction to the filed table.** It printed *median w1 17–25* and *median ceiling 26–45.5* beside the
over-ceiling gap. Those two medians are taken over **all** plans. The **over-ceiling** plans have week 1 of
**13 / 5 / 14 / 18** against ceilings of **7 / 2 / 13 / 13**. The finding is the same; the filed sentence *"at a median week 1
of 17–22 km… the easy runs are already at it"* described the wrong population.

### 2. The ceiling the evidence used is not the leap the engine's owner defines

`week1Leap` (`lib/plan/planQuality.ts`) is the single owner of *"is week 1 a step or a leap?"*. Its ratio arm also needs
`week1PerRunStep > WEEK1_PER_RUN_STEP_MAX_KM` (1.5). It has an absolute arm and Willy's per-session arm. It never fires at
a base of 0. Measured with the owner, same 2,543 plans
(`npx tsx scripts/board-evidence-week1-delivered-ceiling-01.ts`):

| | count |
|---|---|
| over the bare weekly ceiling | 129 |
| …of which the **owner** calls a leap | **52** (all at cw > 0) |
| …declared **0 km/week** (base 0, ceiling = 2 km by the `+2` arm; the owner never fires) | **37**, all carrying run-walk |
| …cw > 0, per-run step ≤ 1.5 km (the owner says *step*, not leap) | **40** |

**The 52 owner-defined leaps by cell:** 5K cw5 lr5 **18** · 10K cw5 lr5 **18** · marathon cw10 lr5 **4** · marathon cw10
lr8 **6** · marathon cw15 lr8 **6**. **All 52 come from the constructed low-base grid. None comes from `cohortGrid`,
`targetedGrid` or the charity personas.**

### 3. What week 1 is made of

**128 of 129** over-ceiling week 1s are **entirely duration-anchored.** The typical week is `40 + 32 + 32` minutes at
cw 5 / lr 5, and `44 + 32 + 32` at cw 10. **32 minutes is the 4 km easy floor** (`MIN_SESSION_DISTANCE_KM.easy`) at the
runner's self-paced easy pace.

**Per-session exposure against the runner's own declared longest run** (cw > 0, n = 92):
- **66 of 92**: no week-1 session longer than the declared longest run;
- **26 of 92**: one long run of **5.3–5.5 km against a declared 5 km**, at HM / marathon cw 10 lr 5. That is at most
  +0.5 km, far inside `LONG_RUN_PROGRESSION_CAP_ABS_KM` (5).
- **Willy's per-session arm of `week1Leap` fires on 0.** That matches the inert finding recorded in the owner's own
  header (*"worst case +0.5 km"*).

So the leap is **a count of floor-sized sessions, not a session that is too big.** Three runs at the shortest length §9
calls a session, against a declared weekly figure that, at cw 5 / lr 5, implies roughly **one** run a week.

### 4. Reachability in production (read-only)

The same script reads stored plans. **36 of 43** carry `generator_input`. **5 of 36 carry WEEK1-LEAP by the owner**:
marathon cw10 lr6 · HM cw5 lr5 · HM cw5 lr6 · marathon cw10 lr20 · marathon cw15 lr13. Generated 2026-10-02 to
10-27, all phase `base`. **Every session in every one of the 5 is at or under the runner's declared longest run.** These
plans are frozen by the live-plan policy ("new plans only"). Whatever is ruled here reaches none of them.

### 5. Settled-ground scan (`coaching-rulings.md`, `CoachingPrinciples.md`, amendments read, not headings)

- **§2 Am. 3** (2026-11-07): names the ceiling's two numbers; ratifies **no** bound; *"extending ADR-022's
  delivered-ceiling levers to healthy runners at week 1 … gets its own sitting"*. This is that sitting.
- **The CURVE bound**: built, measured and reverted at the same sitting (refusals 782 → 664, WEEK1-LEAP 70 → 94).
  **Ruled out.**
- **ADR-022 / §90**: levers scoped to injury runners; *"healthy divergence stays §52's."*
- **§94** (delivered ramp, every runner): the check binds only above `current_weekly_km`, and it *"deliberately does
  NOT change the producer"*. Its precedent: the 2026-09-06 healthy bounceback cap was built, measured (+50 pp constrained,
  zero safety benefit) and **rejected**.
- **§9 / §52** session floors; **Willy's standing condition**: the long run is never trimmed.
- **§117 Am. 5**: *"readiness to RUN is answered by the longest run, not by weekly volume."* **§117 Am. 7 / Am. 8**: the
  run-walk start keys on the longest run; a declared zero is served with run-walk. That covers the 37 cw-0 rows.
- **D-21**: a principle that cannot be satisfied is a defect in the principle. **CD-22**: binding where reachable,
  recorded where not.

**Conflict scan result:** the proposal as filed **contradicts §9/§52's floors** for 111 of 129 plans: there is no easy
headroom, so a bound could only be met by cutting a session below the floor. It **contradicts Willy's long-run
condition** for the rest. It **reverses ADR-022's scoping** and **§94's no-producer-change stance** without the measured
benefit §94's precedent demands.

---

## The sitting

### 🏃 Alex Hutchinson (chair)
The question we left on 12 November was *what does the bound cost*. The answer came back as *nothing can pay for it*.
111 of 129 weeks have no easy kilometre above the floor, 0 of 111 at the three shorter distances. Measured with the
engine's own owner, the population is 52, not 129. 37 of the 129 are declared non-runners who are already on run-walk,
for whom a "1.30×" ratio has no denominator. **What is left is a week of three runs at the minimum length a session is
allowed to have, none longer than what the runner says they have already run.** I cannot defend to an experienced coach a
rule that shortens a 32-minute easy run because of an accounting ratio.

### 📊 Stephen Seiler
I said in November that the step ratios are arithmetic, not evidence, and the re-measurement confirms it from a third
direction. The same 13 km week reads 2.60× or 1.30× depending on what the runner typed. There is no intensity question
here at all: every session is easy, so nothing in §1 moves. **No objection to declining. I would object to bounding.**

### 🎯 Greg McMillan
My position from the first sitting stands: fix the week one, don't take the race away. Look at what the week one IS.
Three half-hour easy runs, the shortest of them as long as the runner's longest run. That is the week I would write for
this person on a Tuesday. A coach does not hand a first-race runner two 20-minute jogs to make a spreadsheet ratio come
out. **The lever does not exist, and the week does not need one.**

### 🩹 Rich Willy
The tissue question is per session and per exposure, not per weekly total. Per session, the evidence is clean: 0 of 92
sessions exceed the declared longest run by more than half a kilometre, and my own arm in `week1Leap` fires on nothing.
So I do not support a delivered bound. Trimming the easy runs below the floor buys nothing for tissue, and I will not
have the long run touched.
**But I am recording a dissent on the framing.** A runner declaring 5 km/week with a 5 km longest run is running about
**once** a week, and week 1 asks for three. **Frequency is a real load vector for bone in a novice, and none of our
inputs measures it.** We have no "runs per week now", and inferring one from two declared numbers is the move this board
refused in November (*"the engine composes week one from a single session and infers a week from it"*). I do not ask
for a rule. I ask that the record says the residual is **frequency**, not volume, so nobody re-files this as a volume
problem.

### ⚕️ Stacy Sims
Same cohort I named before: first race, 4–8 km/week, thirties and forties. Willy's frequency point is the one I care
about. Low energy availability shows up as bone stress, and bone responds to loading cycles, not kilometres. But the
evidence does not show a problem we can act on with the data we hold. **I agree with the ruling and associate myself with
Willy's dissent.** If an input for current run frequency is ever proposed, this cohort is the reason.

### 💪 Richard Blagrove
No strength question. Silent.

---

## ⚡ Recorded disagreement

Willy and Sims accept the ruling and dissent on the *residual*. The hazard they name is **run frequency**: about 1 → 3
exposures in week 1 for the cw 5 / lr 5 cell. Neither the weekly-km ratio nor any lever in ADR-022 measures it. **What
would settle it:** a declared current-run-frequency input. Zonna does not collect one, so this is a **blocking data
dependency** (ADR-017 constraint: the board does not prescribe on data it does not collect). Hutchinson, McMillan and
Seiler hold that three floor-length easy runs, each within the declared longest run, need no further prescription.

## ⚖️ Ruling: ⛔ INCORRECT (veto, ADR-017)

**Extending ADR-022's delivered-ceiling levers to healthy runners to bound week 1 at §2 Am. 3's ceiling does not ship.**

1. **No admissible lever exists.** 111 of 129 over-ceiling weeks have zero easy headroom above §9/§52's floor (0 of 111
   at 5K/10K/HM). The long run is protected by Willy's standing condition. The curve bound is already measured and
   reverted.
2. **The hazard the bound would guard is absent per session.** 0 of 92 cw > 0 week-1 sessions exceed the declared longest
   run by more than 0.5 km.
3. **The population is smaller than filed.** The owner's WEEK1-LEAP fires on 52 of 2,543, all from a constructed low-base
   grid, none from a standard corpus. 37 of the 129 are declared-zero runners already on §117's run-walk, for whom the
   ratio is undefined.
4. **§94's precedent governs.** A producer change for healthy runners needs a measured benefit. There is none to measure.

**What would make it correct:** evidence that a floor-composed week 1 injures, or a per-session hazard that the floors
permit. Neither exists.

**The item closes with no prescription change.** §2 Am. 3's ceiling stays an audit definition (`week1Leap`), as ratified.

### 📦 Required artifacts
None. An INCORRECT ruling ships nothing. No principle, numeric or invariant changes.

### ↗️ SLT escalation
None. Willy and Sims's frequency dissent names a data dependency, not a commercial question. It is recorded here and is
not filed.

---

## What this does not prove

- **It does not measure frequency load.** The dissent is real and untestable on the inputs Zonna holds.
- **Reach is modelled, not run.** The CANNOT column models easy km above the floor; `trimWeekEasyToTarget` was not run.
  As the 13 November filing said: a reach of zero cannot become non-zero by running the real trim.
- **The grid is constructed.** Low-base cells at wizard-ruler volumes 0–25, longest run 0/2/5/8, age 38, `max_weekday_mins`
  60, no blocked days, no injury. The injury cohort is out of scope by ruling (ADR-022 already covers it).
- **Production is 36 stamped plans.** The 5 live leaps show reachability. They are not a rate.

**Commands:** `npm run board:week1-bound`; `npx tsx scripts/board-evidence-week1-delivered-ceiling-01.ts` (read-only:
generates plans in memory, one SELECT on `plans`).
