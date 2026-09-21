// "How much did this week TRAIN?" — the single owner (D1, MKT-PLAN-SHAPE-01,
// 2026-09-21).
//
// `week.weekly_km` is the sum of everything placed on the week, and on RACE WEEK
// that includes the race. So the published half-marathon page rendered
//
//     Week 12 · 36 km · RACE WEEK
//
// against a taper that had just come down from 41 → 32 → 26, making race week
// read as the BIGGEST week of the taper. The runner trains 15 km that week and
// races 21.1. Both numbers are true; adding them together is the one thing that
// is not.
//
// ⚠️ THE FIX IS A SECOND QUESTION, NOT A CHANGED ANSWER. `weekly_km` keeps its
// meaning exactly — every invariant, the volume curve, `sumWeeklyKm`, ADR-022's
// delivered ceiling and §3's deload depth all read it and all still mean "the
// distance on this week's calendar". Redefining it to exclude the race would
// silently move a number that ~40 call sites depend on, to fix a rendering
// problem. So this module ANSWERS THE DISPLAY QUESTION SEPARATELY and leaves the
// statute alone.
//
// Both the plan pages and `planShapeInvariants.ts` read it, so the page and the
// checker cannot disagree about what "training volume" means — which is the
// whole reason it is a module and not two expressions.

import type { Plan, Session } from '@/types/plan'
import type { Day } from './days'
import { sessionKmSelfPaced } from './sessionDistance'

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

/** `weekly_km` minus the race — what the runner TRAINS that week. */
export function trainingKm(w: WeekLike): number {
  const r = raceKm(w)
  if (r <= 0) return w.weekly_km
  return Math.round((w.weekly_km - r) * 10) / 10
}
