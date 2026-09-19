# Coaching Board — Phase 2 plan review (fit for use / fit for purpose)

*2026-09-19. Founder's instruction: every plan in the test sample goes to this
board to determine fit for use and fit for purpose — not "does it pass the
invariants", which it does, but "are we proud to hand this over". Run alongside
a regression pass looking for gaps and holes.*

---

## The engine's compliance state

`npm run verify` exit 0 · 2,389 tests / 267 files · 122 invariants · property
sweep 14,486 plans, 0 hard failures, no new violations · archetype matrix 65/0 ·
`invariant:liveness` 119/122 · `audit:plans` no regression.

### ⚠️ `audit:plans` reports 7,569 findings and most are NOT defects

Reconciled against doctrine **before** the board sat, because otherwise the
board rules on noise:

| audit category | raw | genuinely in breach | why |
|---|---|---|---|
| NEVER-BUILDS (peak/week1 < 1.10) | 15,236 | **0** | all 15,236 are classified `maintenance` **with** a `volume_constraint_note`, which is precisely the remedy §23 prescribes for "nowhere to ramp to" |
| LONG-RUN-SHORT vs §24's bar | 20,128 | **0** | 13,284 are FINISH goals (§24 does not govern them; §80 sizes those on race *duration*), 5,216 are maintenance (§24 relaxes), and `INV-PLAN-PEAK-LR-RACE-RATIO` reports zero across the sweep — it reads peak-phase weeks only and stands down when §9's 210-minute cap makes the distance unreachable |

**The harness measures against a bar the constitution does not hold plans to.**
That is worth knowing before anyone quotes 7,569 as a defect count.

---

## The sample, and the ruling on each

> ⚠️ **The first submission overstated every build figure** by taking the peak
> from a curve that still contained the RACE WEEK — the `S106-RACE-PEAK-01`
> error this repo has already recorded once. Corrected before the board ruled.

| | plan | training peak | ruling |
|---|---|---|---|
| **P1** | never-run beginner, marathon, 29wk (charity flagship) | 18 → 47 (+161%), LR 26.0 km (62%), no quality, shortfall note fires | ✅ hand over |
| **P2** | low-base beginner, marathon, TIME goal 4:30 | 33 → 52 (+58%), LR 25.2 km (60%), 3 quality rows | ✅ hand over |
| **P3** | masters 58, marathon, finish | 26 → 52 (+100%), LR 26.0 km (62%), no quality | ✅ hand over — **Willy's reservation recorded** |
| **P4** | knee history, HM, finish | 20 → 31 (+55%), LR 15.5 km (73%), no quality, **no note** | ⚠️ hand over, **the silence is a defect** |
| **P5** | experienced, 10K, TIME goal 45:00, 55 km/wk | 53 → 56 (+6%), **13 distinct quality rows in 14 weeks**, told "built to get you round" | ❌ **would not hand over** |
| **P6** | 3 days + 30-min weekday cap, marathon finish | 22 → 43 (+95%), LR 29.5 km (70%), 8 quality rows, two honest notes | ✅ hand over |

**Willy on P3, recorded:** a 58-year-old beginner doubling weekly volume
(26 → 52) is within §2's ramp and §3's masters cadence and is therefore
compliant, "but it is the top of what I would accept, and the masters beginner
is the cell I would look at first if injury reports ever arrive."

---

## Findings and what happened to them

### Finding 1 — one sentence, two causes, false for the commoner one → **FIXED**

*"This plan is built to get you round, not to chase a time"* is §114's
finish-goal language. True when the engine cannot build the runner far enough.
**False when the only failing check is the ramp ratio** — §23's "nowhere to ramp
to", where the runner's volume is already adequate and the block sharpens.

Measured: **wrong on 78.7% of the time-goal maintenance plans it fired on.**

Fixed by splitting on cause. `"get you round"` **55.4% → 26.9%** of time-goal
plans; **5,432** moved to *"your weekly volume is already where this distance
wants it, so this plan sharpens rather than builds."* The classification does
not change — §23 licenses maintenance either way.

**Sims:** to a runner who entered a time goal, "get you round" reads as being
quietly reassigned to a lesser category.

### Finding 2 — "plans never repeat a quality session" → **DISSOLVED ON MEASUREMENT**

I brought this as a defect: 8,860 plans (24.7%) where every quality session is a
different catalogue row, and §53 caps repetition with no floor under it. The
board ruled it a real gap and asked for distinct-rows-per-phase against pool
size before setting a number.

**The measurement dissolved it, and the error was my unit.**

- In **8,860 of 8,860** cases the pool was *smaller* than the session count, so
  all-distinct comes from the pool **changing between phases**, not from a rich
  pool being sampled lazily.
- **0% of plans have every CATEGORY distinct.** Median exposures per category:
  **4.5×**.

So the stimulus repeats four or five times in every plan; only its flavour
varies, which is §53 working as designed and what McMillan asked for. Seiler's
objection — *you cannot progress a stimulus you never repeat* — is about the
stimulus, and the stimulus does repeat. **I counted rows; the coaching unit is
the category.** No floor is needed and none is added.

### Finding 3 (Q4) — a plan with no hard sessions said nothing → **FIXED**

§40c requires a suppressed target to be stated, never absorbed. The all-easy
explanation was gated on `hard_session_relationship === 'avoid'`, so only the
runner who asked for it got one: **1,752 plans (17.5% of the 9,984 with zero
quality) shipped with no note at all.** Now **0**. The prescription is unchanged
— the board ruled all-easy CORRECT AS IS for this cohort the same day — only the
silence is fixed.

---

## Regression pass — gaps found

Six `lib/plan` modules had **zero direct test coverage** with production callers.
Two carried real risk and are now covered, and writing the tests found a live
defect:

- **`EFFSESS-COLLISION-01`** — `resolveEffectiveSessions` overwrote the occupant
  of a target day, so **a two-session week silently became a one-session week**.
  Reachable: `PlanCalendar` routes to Swap only when the target is swappable, so
  moving onto a day whose session is **already completed or skipped** took the
  one-sided Move path. The runner's completed session vanished and its
  completion row became unreachable. Fixed at the single owner (six callers, two
  server-side).
- **`startVolume`** — feeds §111's refusal gate; 9 assertions added.

Still uncovered, lower risk, recorded: `schema`, `freeIntro`, `renderGuidance`,
`raceLabel`.

---

## What this review does NOT prove

- Six plans is a sample, not the corpus. The corpus evidence is the harnesses,
  and they measure compliance and build, not whether a runner enjoys the plan.
- Nothing here has run on a device.
- P3's masters-beginner load is compliant and **unvalidated by outcome data** —
  Willy's reservation stands as a reservation, not a finding.
- The engine has **no adherence or dropout data at all** (one analytics event
  exists), so every "would you hand it over" answer is a coaching judgement and
  not an empirical one.
