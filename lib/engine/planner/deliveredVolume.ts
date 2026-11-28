// FREE — infrastructure. ADR-027 B4c (ADR027-B4C-VOLUME): L3's delivered-volume owner.
//
// The HLD's defining property for the session placer, made literal: *"Session placer sizes and
// places sessions under every rule at once, and is **the single owner of delivered volume**."*
// `sumWeeklyKm` is that owner, and it now lives in L3.
//
// 🔑 A MOVE WITH ZERO CONSUMER CHURN. Unlike the block planner and the week planner, this
// function was EXPORTED and has **39 references across ~20 files** — `invariants.ts`, `planScale`,
// `cohortShape`, `easyDistribution`, `sessionComposer`, the read model's callers and nine suites.
// `ruleEngine.ts` re-exports it, so not one of them changed, which is the ARCH-ENG-001 precedent
// (`TRIGGER_TYPES` moved into L2 and `planAdjustment` kept exporting it). The re-export is
// load-bearing and `deliveredVolume.test.ts` asserts the two names are the same function object.
//
// 🔻 WHAT THIS WAVE IS NOT. The placer proper is `buildWeekSessions` (1,266 lines),
// `applyWeekdayMinsCap` and some fifteen `apply*` post-passes, and none of it has moved. This is
// the METRIC every placement rule reads — ADR-022's delivered ceiling, §82's easy trim, §52's long
// run — which is why it is the first brick rather than the last.
//
// ⚠️ NO DECISIONS. A `Decision` records what L3 SET and which rule bound it (ARCH-ENG-009). This
// function MEASURES; it sets nothing. Emitting one would be decoration, and saying so is cheaper
// than a reader wondering where they went.

// ⚠️ `sessionKmOrZero` is IMPORTED, not copied. The HLD names `sessionKm` as one of the single
// owners that "become L3's metrics owner, used by the planner and the verifier alike", and
// SESSION-KM-01's whole point is that this question has exactly one answer.
import { sessionKmOrZero } from '@/lib/plan/sessionDistance'
import type { Day } from '@/lib/plan/days'
import type { PaceGuide } from '@/lib/plan/paceBands'
import type { Session } from '@/types/plan'

/**
 * §121 — THE RACE IS THE TEST, NOT THE TRAINING.
 *
 * `type === 'race'` is excluded on exactly the ground §77 already uses to keep
 * the race out of `days_cannot_train`, and which this file states in its own
 * words at the §77 site: *"the race is an external fixed event, not a training
 * session."* Nobody followed that sentence through to volume.
 *
 * ⚠️ WHAT IT WAS DOING TO THE SCREEN. Measured on 8,510 plans: the taper phase
 * peak exceeded the peak phase peak in **15.3%** of plans, race week was the
 * plan's biggest week in **16.3%**, and at MARATHON it was **50%**. Worst case,
 * a 12 km/week beginner: peak training week 25 km, race week 59 km. Excluding
 * the race session, no taper anywhere exceeds its peak phase — the race is the
 * entire cause. A beginner opening the plan preview read
 * `Base 25 · Build 38 · Peak 41 · Taper 47` and was taught that the taper is the
 * hardest block, which is the most commonly misunderstood idea in amateur
 * running. **The screen argued for the mistake**, hardest at the beginner and
 * injury-history cohorts (22% and 20%, against 9% experienced).
 *
 * 🔴 **THIS IS AN HONESTY FIX AND MUST NOT BE SOLD AS A SAFETY ONE** (Willy,
 * binding). A 12 km/week runner racing 42.2 km is at 1.7x their largest ever
 * week, and taking the race out of a total does not reduce that by one gram. It
 * makes it VISIBLE. The readiness question is §114's and is filed separately
 * (MARATHON-READINESS-GAP-01).
 *
 * ⚠️ DISPLAY AND TOTALS ONLY. Nothing placed in race week moves, so no session
 * changes and no cohort is reclassified by this. `verify:parity` reports ~16% of
 * plans changed and that is the ruling, not a regression.
 */
/**
 * The DELIVERED weekly volume of a set of placed sessions.
 *
 * §121 — "the race is the test, not the training": a race session contributes
 * NOTHING here, beside `strength` and `rest`. That exclusion is one of the two
 * mechanisms §121's Config line names, and `planScale` is the other.
 *
 * ⚠️ EXPORTED FOR ITS GATE, not for new callers (TAPER-OVER-PEAK-SLOW-01,
 * 2026-10-03). `planScale`'s half of §121 has had a direct test since the ruling;
 * this half was covered only by `INV-PLAN-RACE-NOT-VOLUME`, a PLAN-LEVEL proxy
 * that cannot see a re-inclusion on a 5K or 10K plan at all — measured, 0 of
 * 20,736 such plans would be caught. `raceNotVolume.test.ts` now asserts the
 * exclusion here, directly, for every distance. New volume callers belong on
 * `sessionKm`/`sessionKmOrZero` (SESSION-KM-01), not on this.
 *
 * ⚠️ DO NOT "DRY" THIS PREDICATE WITH ITS LOOK-ALIKES. The expression
 * `strength || rest || race` is NOT one rule written several times — each site is a
 * different question that happens to list the same types: `applyWeekdayMinsCap` asks
 * "may this be shrunk to the weekday cap?" (a race is a fixed external event), this
 * asks "does this count as training volume?" (§121), and the HR-note pass asks
 * "should this carry an estimated-HR note?". A shared owner would COUPLE independent
 * decisions, so a later change to what §121 counts would silently move the weekday cap
 * and a coach note with it. Duplication is correct here; the single owner would be the
 * defect. Found 2026-10-03 while falsifying this gate, as a mutation that refused to apply.
 *
 * 🔴 AND THERE ARE TWELVE, NOT THREE — "appears three times" was wrong by nine, and my own first
 * correction said EIGHT, which was wrong by four because it counted one spelling.
 * 📐 Counted 2026-11-28 (B4c), both spellings: `type === 'strength'` appears 8 times across this
 * module and `ruleEngine.ts`, and `type !== 'strength'` 4 more. Grouped by the question each asks:
 *
 *   VOLUME — "does this count as training?"
 *   1. HERE (§121). **Excludes the race**, and it is the only site asking this that says so in its
 *      own predicate.
 *   2. `placedKm`, the easy fill — "how much of this week's target is already placed?"
 *   3. `exactWeekKm`, in `applyTaperDeliveredDepth` — "what is the week's UNROUNDED km?"
 *   4. `lopsidedWeek` — "which is this week's longest run?"
 *   5. `applyTaperLongRunCap` — §9's floor: "the longest OTHER run in this week".
 *   6. `reclampPeakStepBacks` — §9's floor again, for a stepped-back peak week.
 *
 *   NOT VOLUME — the same type list, a different question.
 *   7. `applyWeekdayMinsCap` — "may this be shrunk to the weekday cap?" Excludes the race as a
 *      fixed external event. (Documented.)
 *   8. the HR-note pass — "should this carry an estimated-HR note?" Excludes the race. (Documented.)
 *   9. `easyOverrun` — "did this easy run overrun its day's budget?" Excludes the race.
 *  10. `firstActiveSession` — "what is the first thing the runner sees?" A race IS something they
 *      see, so including it is correct.
 *  11. the recalibration pace rewrite — "should this session's pace targets be rewritten?"
 *  12. the session-count spread — counts SESSIONS, not km.
 *
 * 🔴 FIVE OF THESE SUM OR COMPARE KM AND NEVER MENTION THE RACE (2–6), AND NOT ONE IS SAFE BECAUSE
 * ITS PREDICATE IS RIGHT. Each is safe because a RACE WEEK is excluded one level up, by a guard
 * written elsewhere and connected to none of them. Every one verified, 2026-11-28:
 *   · `placedKm` — `buildWeekSessions` has `if (isRaceWeek) { … return sessions }` **897 lines
 *     earlier**, and that return is the SOLE protection. ⚠️ An earlier draft of this paragraph
 *     claimed the easy fill was also behind `!isRaceWeek`; code review measured that FALSE — the
 *     only `!isRaceWeek` nearby guards §9's redistribution, 548 lines away. **Remove the early
 *     return and race week gets no easy runs at all.**
 *   · `exactWeekKm` — its pass filters `w.type !== 'race'` before the loop.
 *   · `lopsidedWeek` — skips `w.type === 'race'` as its first line.
 *   · `applyTaperLongRunCap` — `if (w.n <= 0 || w.phase !== 'taper' || w.type === 'race') continue`.
 *   · `reclampPeakStepBacks` — reaches only weeks in `steppedBack`, a set built from peak weeks
 *     filtered `w.type !== 'race'`.
 * ⚠️ AND THE DIVERGENCE IS THE RULING, NOT DEBT. §121 is explicitly "DISPLAY AND TOTALS ONLY …
 * nothing placed in race week moves", so routing any of 2–6 through this owner would change
 * PLACEMENT and breach the ruling's own scope. `placedKm` carried the comment "Mirror sumWeeklyKm",
 * false in exactly the way that invites that breach; it is corrected there.
 * **`deliveredVolume.test.ts` pins the count at twelve, BOTH spellings, and the guards whose absence
 * is silent**, because a thirteenth written in the negated form is how this undercount happened twice.
 */
export function sumWeeklyKm(sessions: Partial<Record<Day, Session>>, pace: PaceGuide): number {
  let total = 0
  for (const s of Object.values(sessions)) {
    if (!s || s.type === 'strength' || s.type === 'rest' || s.type === 'race') continue
    total += sessionKmOrZero(s, pace.minPerKmEasy)
  }
  return Math.round(total)
}
