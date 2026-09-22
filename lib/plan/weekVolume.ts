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
    km: weeks.map(trainingKm),
    phase: weeks.map(w => (w as unknown as { phase?: string }).phase ?? null),
  }
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
