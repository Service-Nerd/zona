// FREE — infrastructure. ADR-027 B4d (ADR027-B4D-WEEKDAY-CAP): L3's capacity rule.
//
// §81 / §82's per-day minutes trim: the session-level answer to the question
// `WEEK-VOLUME-CAPACITY-01` asks one layer up. Each weekday is trimmed to its own budget
// (`day_budgets[day]`, else `max_weekday_mins`); the long run and structured sessions are exempt,
// and easy runs are floor-protected.
//
// 🔴 THIS HEADER SAID "the engine's ONLY capacity reader" AND THAT WAS FALSE. Code review found
// `ruleEngine.ts` hand-rolls `day_budgets?.[d] ?? max_weekday_mins` in TWO more places — the
// quality-day selection and the easy-km ceiling — bypassing `weekdayBudgetFor` entirely, plus two
// further direct reads of the cap. ⚠️ **That duplication has already shipped a defect once**
// (`SHORTFALL-PINNED-DAY-BUDGET-01`). This module is the TRIM's owner, not capacity's; filed as
// `WEEKDAY-BUDGET-BYPASSERS-01`. A claim of single ownership is the one thing in a move like this
// that must be counted rather than asserted, and I asserted it.
//
// 🔑 A MOVE, for the reason the sibling modules give: L5 must derive everything itself because a
// checker sharing the producer is blind, but **L3 IS the producer**. `applyWeekdayMinsCap` had 4
// call sites, all inside `ruleEngine.ts`, and no code outside it referenced the name.
//
// 🔴 `verify:parity` CANNOT TEST THIS FUNCTION AT ALL, AND THAT IS NOT A FIGURE OF SPEECH.
// Its grid sets neither `max_weekday_mins` nor `day_budgets` — 📐 0 occurrences of either in
// `scripts/verify-parity.ts` — and the first line here returns early when both are absent. So for
// all 6,210 parity cases this function **does nothing**, and IDENTICAL says precisely that.
// 📐 The gate is an exhaustive equivalence diff against the pre-move function over a grid that
// DOES vary the budgets: see `docs/contracts/engine.md § L3`. **Fourth time in one day that a
// standing harness came back green on a change it could not reach.**
//
// ── WHAT IS IMPORTED, NOT COPIED ────────────────────────────────────────────────────────────
// `weekdayBudgetFor` (the one owner of "what is this day's cap", shared with the overrun note so
// the trim and the note cannot drift), `isLongRun` / `isStructuredSession` (§52 / §81's exemptions),
// `heldEasyMins` + `sessionFloorsFor` (§82's floor), `roundDistance`. Every one is already an
// exported single owner; the HLD names these as the modules that become L3's metrics owners.
//
// ── ⚠️ THE ORDERING IS A KNOWN DEFECT AND THIS MOVE DOES NOT BLESS IT ───────────────────────
// It runs at FOUR points, and `S28-CAP-ORDER-01` records why that matters: §28 places its stride
// note in step 4 of `buildWeekSessions` while this runs in step 5 **and can convert a quality
// session to easy**, so a run that becomes stride-eligible afterwards is never offered strides.
// That is a pre-existing ordering gap at every level, not a beginner problem, and it is why
// `INV-PLAN-BEGINNER-NEUROMUSCULAR` warns on its carrier arm rather than erroring.
// 🔻 **Moving the function changes none of it.** Stated here rather than left for a reader to
// infer that a tidy owner means a settled ordering.

import { weekdayBudgetFor } from '@/lib/plan/weekdayOverrunNote'
import { isLongRun, isStructuredSession } from '@/lib/plan/sessionRole'
import { heldEasyMins, sessionFloorsFor } from '@/lib/plan/sessionFloors'
import { roundDistance } from '@/lib/plan/sessionDistance'
import type { Day } from '@/lib/plan/days'
import type { GeneratorInput, Session } from '@/types/plan'

export function applyWeekdayMinsCap(
  sessions: Partial<Record<Day, Session>>,
  input: GeneratorInput,
  isRaceWeek = false,
): void {
  // UX-WIZARD-01 Stage B — the cap is now PER-DAY. Each weekday is trimmed to
  // its OWN budget (`day_budgets[day]`), falling back to the single
  // `max_weekday_mins` where a day has no explicit budget. When `day_budgets` is
  // absent every day resolves to `max_weekday_mins`, i.e. exactly the old
  // single-cap behaviour — byte-identical (verify:parity). Placement (below, at
  // the quality-day selection) puts the un-trimmable structured session on the
  // day whose budget can hold it, so this per-day trim mostly touches easy runs.
  if (input.max_weekday_mins == null && input.day_budgets == null) return
  const weekdays: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri']
  for (const day of weekdays) {
    // OVERRUN-NOTE-ALL-01 — the day's limit through the one producer-side owner, so the cap trimmed here and the cap
    // the note quotes cannot drift (the checker derives its own, deliberately).
    const cap = weekdayBudgetFor(input, day)?.cap
    if (cap == null) continue
    const s = sessions[day]
    if (!s || !s.duration_mins || s.duration_mins <= cap) continue
    if (s.type === 'strength' || s.type === 'rest' || s.type === 'race') continue
    // MWM-02 (Coaching Board, 2026-09-03) — THE LONG RUN IS EXEMPT.
    //
    // Squeezing it to the weekday cap does not honour §18, it deforms the week:
    // a long run cut to 30 minutes alongside two 30-minute easy runs is not a
    // long run, and the label then lies to the runner. Measured: capping it
    // traded 1,615 §18 breaches for 979 §9 breaches (+511 LONG-IS-LONGEST,
    // +468 MIN-SESSION-SIZE). The board VETOED that trade — "don't shrink to
    // fit" (Hutchinson, McMillan, Willy, independently).
    //
    // The remedy is honesty, not deformation: where the long run cannot fit the
    // runner's stated availability the plan SAYS SO and classifies maintenance
    // (§52's third remedy, §40c's "a suppressed target is stated, never absorbed
    // silently"). See CoachingPrinciples §81.
    // §81 — the long run AND any structured session are exempt. For the long
    // run, capping stops it being the longest run of the week. For a structured
    // session the failure is worse: the cap scales distance/duration but NOT
    // `derived_set`, so the work is unchanged and only the stated duration
    // moves. See isStructuredSession for the measured case.
    if (isLongRun(s) || isStructuredSession(s)) {
      /**
       * 🔴 §81's SECOND HALF, BUILT AT LAST (SESSION-ACHIEVABLE-01, Coaching
       * Board 2026-10-06). The section's own title is *"Structured sessions are
       * exempt from the weekday cap — AND the plan says when they don't fit"*,
       * and this `continue` is the exemption. **The declaration belongs exactly
       * here, because this is the line that grants it.**
       *
       * The 2026-10-03 sitting named the defect in as many words — *"the plan
       * says so about the SESSION, not via a shared note"* — ruled it an exempt
       * defect fix, and it was not done. Measured three days later: **675
       * structured weekday sessions past the ratified 50% tolerance, EVERY ONE
       * belonging to a runner who stated a 30-minute cap**, worst 86 min against
       * that 30 (+187%); and `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` fired **zero**
       * times because it tested `volume_constraint_note`'s PRESENCE — a sentence
       * about volume discharging an obligation about a session.
       *
       * ⚠️ STAMPED ON ANY OVERRUN, not only past the tolerance. The tolerance is
       * where the INVARIANT bites; §81's obligation is simply "when they don't
       * fit", and a session 7 minutes over does not fit either. This is not
       * wallpaper: it is per-SESSION, so it appears only on the sessions that
       * actually overrun, never as a banner across the plan.
       *
       * ⚠️ §40c: name the constraint AND the lever, never only the loss. The
       * levers are real and both belong to the runner — move the session to a day
       * with room (which is also what §81's placement obligation does
       * automatically), or raise the weekday budget.
       */
      // OVERRUN-NOTE-ALL-01 — this branch used to write the overrun note. It is written once, from the FINAL minutes,
      // by `reconcileWeekdayOverrunNotes` at the tail of generation, because later passes resize sessions after this one.
      continue
    }
    const originalDurationMins = s.duration_mins
    const ratio = cap / originalDurationMins
    const cappedDistance = s.distance_km != null ? roundDistance(s.distance_km * ratio) : undefined

    // §82 (Coaching Board, 2026-09-03) — EASY RUNS ARE FLOOR-PROTECTED.
    //
    // §81 draws the line: an easy run's prescription IS its distance and
    // duration, so (unlike the long run or a structured session) the cap
    // applies to it "normally" — scaled. But the ratio can scale it below
    // MIN_SESSION_DISTANCE_KM.easy, §9's own floor for "too short to be
    // coaching-meaningful" (measured: at max_weekday_mins=30 this lands at
    // 3.5km against a 4km floor, ~5% of the widened sweep). Where the ratio
    // would cross the floor, hold the session at the floor instead and let
    // its duration follow at the runner's own easy pace — the stated weekday
    // cap is exceeded by a few minutes, not honoured by a session that trains
    // nothing. §52b's day-count remedy already ran before this session was
    // placed, so this is the fallback once the day count is already minimal
    // for the runner's volume, not a substitute for it.
    //
    // Race week is exempt from floor protection, mirroring
    // INV-PLAN-MIN-SESSION-SIZE's own `isRaceWeek && type === 'easy'`
    // exemption (§30) — a shakeout or race-week easy run is DELIBERATELY
    // short (taper intent), never "too short to be coaching-meaningful".
    // Without this, the shakeout cap (RACE_WEEK_SHAKEOUT_MAX_MINS, 35) got
    // overridden by the floor and a 30-minute-capped runner got a 56-minute
    // "shortened" shakeout — the opposite of §30's intent.
    const floorKm = sessionFloorsFor(input.longest_recent_run_km).easy
    if (!isRaceWeek && s.type === 'easy' && cappedDistance != null && cappedDistance < floorKm && s.distance_km) {
      const paceMinPerKm = originalDurationMins / s.distance_km
      // §82 Amendment 2 (S9-EASY-MINUTES-01) — held at the runner's limit, or 30 minutes if the limit is shorter,
      // never past the km floor. Where the km floor is no longer than that, nothing changes from §82 as ruled.
      const floorKmMins = Math.round(floorKm * paceMinPerKm)
      const held = heldEasyMins(cap, floorKmMins)
      if (held >= floorKmMins) {
        s.distance_km = floorKm
        s.duration_mins = floorKmMins
        s.floor_protected = true
      } else {
        // Below the km floor the minutes are the prescription; the distance follows at the session's own pace, rounded
        // DOWN to 0.1 km as the foundation block rounds (FOUND-ROUND-01): off the 0.5 km grid on purpose, because the
        // grid would put a 30-minute run at 2.5 km = 33 min for a 13:05/km runner, over the limit it exists to honour.
        s.duration_mins = held
        s.distance_km = Math.floor((held / paceMinPerKm) * 10 + 1e-9) / 10
        // Over the day only when the limit is under 30 minutes: that is the one licensed overrun left.
        if (held > cap) s.floor_protected = true
      }
      // OVERRUN-NOTE-ALL-01 — its note is written by `reconcileWeekdayOverrunNotes` at the tail of generation.
    } else {
      s.duration_mins = cap
      if (cappedDistance != null) s.distance_km = cappedDistance
    }
  }
}
