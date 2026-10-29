// GTM-SEO-COMPARE-01 page 7 + CHARITY-PLAN-PREREQ-01 (Coaching Board 2026-10-29). What a published plan asks of the
// runner, and what it delivers, READ FROM THE PLAN, so a marketing sentence about a plan cannot drift from the plan.
//
// The board's finding that made this a module: `/charity-runners` told first-timers every plan "assumes about 30
// minutes without stopping" while the marathon plan is generated for 45 km a week and a 20 km long run and opens at
// 50 km. A number typed into copy is a claim nobody re-checks; this is the check.

import { getPlan, planAnchor } from './plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isLongRun } from '@/lib/plan/sessionRole'
import { sessionKmSelfPaced } from '@/lib/plan/sessionDistance'
import type { Session } from '@/types/plan'

export { planStartPoint } from './plans'

export interface PlanShape { weeks: number; runsPerWeek: number; peakKm: number; week1Km: number; week1LongKm: number }

const shapes = new Map<string, PlanShape>()

/** What the plan page actually shows, from the same generation (`PlanPage`): km rounded to whole kilometres. */
export function planShape(slug: string): PlanShape {
  const hit = shapes.get(slug)
  if (hit) return hit
  const mp = getPlan(slug)
  if (!mp) throw new Error(`no published plan ${slug}`)
  const { planStart, raceDate } = planAnchor(mp.dayOffset)
  const plan = generateRulePlan(mp.input(raceDate), 'free', planStart)
  const runs = (w: (typeof plan.weeks)[number]): Session[] => (Object.values(w.sessions).flat() as Array<Session | null | undefined>)
    .filter((s): s is Session => !!s && !['rest', 'strength', 'cross-train'].includes(s.type))
  const km = (w: (typeof plan.weeks)[number]) => runs(w).reduce((a, s) => a + (sessionKmSelfPaced(s) ?? 0), 0)
  const first = plan.weeks[0]
  const shape: PlanShape = {
    weeks: plan.weeks.length,
    runsPerWeek: mp.daysPerWeek,
    peakKm: Math.round(Math.max(...plan.weeks.map(km))),
    week1Km: Math.round(km(first)),
    week1LongKm: Math.round(Math.max(0, ...runs(first).filter(s => isLongRun(s)).map(s => s.distance_km ?? 0))),
  }
  shapes.set(slug, shape)
  return shape
}
