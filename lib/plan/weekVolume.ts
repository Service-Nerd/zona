// "How much did this week TRAIN?" — the single owner (D1, MKT-PLAN-SHAPE-01,
// 2026-09-21; RESOLVED at the source by §121, 2026-09-22).
//
// ⚠️ READ THIS BEFORE CHANGING ANYTHING HERE. The header below used to say, in
// as many words: *"THE FIX IS A SECOND QUESTION, NOT A CHANGED ANSWER.
// `weekly_km` keeps its meaning exactly... Redefining it to exclude the race
// would silently move a number that ~40 call sites depend on, to fix a rendering
// problem."* That was the right call on 2026-09-21, when the evidence was one
// published page rendering "36 km" on a race week.
//
// **The Coaching Board then measured the population and ruled the other way.**
// 8,510 plans: the taper phase peak exceeded the peak phase peak in 15.3% of
// plans, 50% at MARATHON, and excluding the race NO taper anywhere exceeds its
// peak phase — so the race was the entire cause, not a page's rendering choice.
// §121 ("the race is the test, not the training") takes it out of `sumWeeklyKm`,
// which is the statute this module deliberately declined to touch.
//
// ⚠️ SO `trainingKm` IS NOW AN IDENTITY, AND IT IS KEPT ON PURPOSE. Once
// `weekly_km` excludes the race, `weekly_km - raceKm` would subtract it TWICE on
// race week — an off-by-a-marathon on exactly the screens this module exists to
// protect. Deleting the function instead would scatter `w.weekly_km` back across
// the callers and lose the one place where "training volume" is defined. It
// stays as the named accessor, and the value it returns is unchanged for every
// caller: before, `weekly_km` included the race and this subtracted it; now the
// subtraction happens upstream. Zero delta for `planShapeInvariants`, `PlanArc`
// and the plan pages.
//
// `raceKm` is still live — §121 Amendment 1 requires race week to show what the
// runner TRAINS and what they RACE separately, which needs both numbers.

import type { Plan, Session } from '@/types/plan'
import type { Day } from './days'
import { sessionKmSelfPaced } from './sessionDistance'
import { formatDistance, type DistanceUnits } from '@/lib/format'

type WeekLike = Plan['weeks'][number]

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function sessionsOf(w: WeekLike): Session[] {
  return DAYS
    .map(d => (w.sessions as Partial<Record<Day, Session>>)[d])
    .filter((s): s is Session => s != null)
}

/** The race distance placed on this week, or 0. */
export function raceKm(w: WeekLike): number {
  return sessionsOf(w)
    .filter(s => s.type === 'race')
    .reduce((a, s) => a + (sessionKmSelfPaced(s) ?? 0), 0)
}

/**
 * What the runner TRAINS that week.
 *
 * ⚠️ NO SUBTRACTION. `weekly_km` already excludes the race (§121) — see the
 * header. Subtracting `raceKm` here as well would remove a marathon twice.
 */
export function trainingKm(w: WeekLike): number {
  return w.weekly_km
}

/**
 * The series `PlanArc` draws: one training-volume figure and one raw phase
 * key per week, in plan order.
 *
 * ⚠️ IT IS HERE BECAUSE TWO CALLERS ASK THE SAME QUESTION. `PlanScreen` and
 * the marketing device still both render the arc, and the moment each wrote
 * its own `weeks.map(trainingKm)` they could drift — the shape on the
 * homepage would stop being the shape in the app, which is the whole thing
 * the DESIGN-V3 fidelity work exists to prevent.
 *
 * ⚠️ `trainingKm`, NOT `weekly_km`. On race week `weekly_km` includes the
 * race, so a height-encoded bar would draw race week as the BIGGEST week of
 * the taper — the exact rendering defect this module was written for.
 *
 * Phases come back as RAW keys. Turning `maintenance_restoration` into
 * "Restoration" is a display decision and belongs to `phaseDisplayLabel`,
 * which lives next to `PHASE_LABELS`; `lib/plan` does not import
 * `lib/coaching`.
 */
export function planArcSeries(weeks: WeekLike[]): { km: number[]; phase: (string | null)[] } {
  return {
    // A walk-run start week is time on feet with no distance (§116 floor note): the arc draws its minimum stub, never a
    // NaN bar and never a figure we do not have. The week is still there, so the current-week marker stays aligned.
    km: weeks.map(w => ((w as unknown as { phase?: string }).phase === 'walk_run_start' ? 0 : trainingKm(w))),
    phase: weeks.map(w => (w as unknown as { phase?: string }).phase ?? null),
  }
}

/**
 * What the plan ASKED the runner to COVER — summed from the SESSIONS, race included.
 *
 * 🔴 THE BASIS FOR A PLANNED-VS-ACTUAL COMPARISON, AND IT IS DELIBERATELY NOT DERIVED
 * FROM `weekly_km` (`RACE-WEEK-ZERO-KM-01`, 2026-11-09). Three separate defects made
 * that impossible, and all three were measured on production:
 *
 *   1. **§121 is only true of engine output.** A legacy stored plan can have a
 *      race-INCLUSIVE `weekly_km`: `e916f15a` week 25 reads **105** for 2 + 3 + a
 *      100 km race. The first cut of this function was `trainingKm + raceKm` and
 *      returned **205** there — the mirror of the double-subtraction this module's
 *      header warns about, found by code review, 1 of 38 stored race weeks.
 *   2. **`weekly_km` is ROUNDED and a session sum is not.** |weekly_km − sessionSum|
 *      across 632 stored weeks: median **0.39**, p90 **1.05**, **max 37.00**. The
 *      route's to-date figure sums sessions, so the two planned numbers in one
 *      sentence sat on different bases on most weeks, not only race week.
 *   3. **A missing `weekly_km` would yield NaN**, which renders as "vs — planned".
 *      0 of 632 today; the unvalidated legacy/gist path is the producer that could.
 *
 * Summing the sessions removes the dependence on `weekly_km` entirely, and it is the
 * same thing the ACTUAL measures, which is what makes the comparison honest.
 *
 * ⚠️ `sessionKmSelfPaced`, NEVER `distance_km ?? 0`. **A session is anchored EITHER by
 * distance OR by duration, and beginners get duration-anchored plans** (`SESSION-KM-01/02`):
 * `?? 0` asserts the session covered no ground. Measured: **229 of 632 stored weeks hold
 * a null-distance session (705 sessions)**, and on `f3ae3cba` weeks 1–3 the naive sum is
 * **0.0 km against a real 13.1** — the same zero defect as race week, on 36% of weeks.
 *
 * ⚠️ IT IS NOT A RE-DEFINITION OF §121. `trainingKm` is still what the runner TRAINS and
 * `weekly_km` is untouched; this is a different question with a different answer, named
 * once so a caller cannot write it out by hand — which is how the first version shipped
 * with a test that restated the route's expression and could not see the route change
 * underneath it (`TIER-OWNER-01`'s shape).
 *
 * ⚠️ DISPLAY STILL OBEYS §121 Amendment 1 (Sims, binding): a SURFACE never folds training
 * and race into one number — see `weekVolumeLabel`. This is an arithmetic basis for a
 * comparison, and the surface that uses it names the race alongside it.
 */
function countable(s: Session): boolean {
  // The route's own predicate, moved here so the full-week and to-date figures cannot
  // disagree about what counts. Strength carries no running distance by design.
  return s.type !== 'rest' && s.type !== 'strength'
}

export function plannedCoveredKm(w: WeekLike): number {
  return sessionsOf(w).filter(countable)
    .reduce((a, s) => a + (sessionKmSelfPaced(s) ?? 0), 0)
}

/**
 * The same basis, restricted to named days — the to-date half of the comparison.
 *
 * ⚠️ ONE OWNER FOR BOTH HALVES IS THE WHOLE POINT. The route summed `distance_km ?? 0`
 * here while reading `weekly_km` for the full week, which is how it printed
 * *"42.2km due by end of yesterday (0.0km full-week target)"* — a full-week target
 * below its own to-date figure.
 */
export function plannedCoveredKmOnDays(w: WeekLike, days: readonly Day[]): number {
  const ss = w.sessions as Partial<Record<Day, Session>>
  return days
    .map(d => ss[d])
    .filter((s): s is Session => s != null && countable(s))
    .reduce((a, s) => a + (sessionKmSelfPaced(s) ?? 0), 0)
}

/**
 * §121 Amendment 1 — race week shows what the runner TRAINS and what they RACE,
 * **separately, never one folded number** (Sims, binding).
 *
 * `"15 km"` on an ordinary week; `"15 km + 21.1 km race"` on race week.
 *
 * ⚠️ IT IS A SUBTRACTION, NOT A RE-LABEL. Taking the race out of `weekly_km`
 * without naming it somewhere would under-report the week, which is the opposite
 * error and the one that makes a 12 km/week beginner's marathon look smaller
 * than it is. §121 is an HONESTY fix, not a safety one: a runner racing 42.2 km
 * off a 25 km peak is at 1.7x their largest ever week, and this does not reduce
 * that by one gram — it makes it visible.
 *
 * ⚠️ ONE OWNER BECAUSE THE APP AND THE WEBSITE BOTH RENDER IT. The wizard
 * preview, the plan screen and the published plan pages all answer this
 * question, and the moment each formats its own string they drift — which is the
 * MKT-PLAN-SHAPE-01 failure one module up. Distances go through
 * `lib/format.ts`'s `formatDistance` (ADR-015's sole owner), and the race keeps
 * its iconic decimals via `exact` (42.2 km, 21.1 km).
 */
export function weekVolumeLabel(w: WeekLike, units: DistanceUnits = 'km'): string | null {
  const training = formatDistance(trainingKm(w), units)
  if (training == null) return null
  const race = raceKm(w)
  if (race <= 0) return training
  const raceStr = formatDistance(race, units, { exact: true })
  return raceStr == null ? training : `${training} + ${raceStr} race`
}
