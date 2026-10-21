// SAVE-PATTERN-01 (Design Board 2026-10-18) — lives in lib/ui, not lib/plan: it reads both plans, and the run
// engine never imports strength (`packages/strength/boundary.test.ts`).
//
// The one line a runner reads on Plan after a plan change saves.
//
// A save that ends in silence is a defect: the runner did something consequential and the product said nothing. The
// line names the change in the runner's terms, from the same data the consent screen diffed, and never says only
// "Saved" (Sierra: that is the app talking about itself). No claim about what the change does for their training.
// No em dash: `noEmDashApp` does not scan lib/, so `planChangeReadback.test.ts` asserts it.

import { computeSessionDiff, labelSession, DIFF_DAY_ORDER, type SessionLike } from '@/lib/coaching/diff/sessionDiff'
import { DAY_FULL_NAME, DAY_ORDER, type Day } from '@/lib/plan/days'
import type { DistanceUnits } from '@/lib/format'
import type { Plan } from '@/types/plan'
import type { StrengthPlan } from '@/packages/strength'
import { STRENGTH_SETUP } from '@/lib/strength-bridge/display'

const ORDINARY = new Set(['base', 'build', 'peak', 'deload'])
const list = (days: Day[]) => {
  const n = days.map(d => DAY_FULL_NAME[d])
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}
const weekSessions = (p: Plan, i: number) => {
  const w = p.weeks[i] ?? p.weeks[0]
  const byDay = (w?.sessions ?? {}) as Record<string, SessionLike | null>
  return DIFF_DAY_ORDER.map(d => byDay[d] ?? null)
}

/** The run plan: this week's move, else this week's changed days, else where the change starts, else the length. */
export function runPlanReadback(before: Plan, after: Plan, weekIndex: number, units: DistanceUnits): string {
  const diff = computeSessionDiff(weekSessions(before, weekIndex), weekSessions(after, weekIndex)).filter(e => e.kind !== 'unchanged')
  const removed = diff.filter(e => e.kind === 'removed')
  const added = diff.filter(e => e.kind === 'added')
  if (diff.length === 2 && removed.length === 1 && added.length === 1
    && labelSession(removed[0].before!, units) === labelSession(added[0].after!, units)) {
    return `Plan updated. ${DAY_FULL_NAME[removed[0].day as Day]}'s ${labelSession(removed[0].before!, units)} is now on ${DAY_FULL_NAME[added[0].day as Day]}.`
  }
  if (diff.length > 0) return `Plan updated. This week changes on ${list(diff.map(e => e.day as Day))}.`
  if (before.weeks.length !== after.weeks.length) return `Plan updated. It is now ${after.weeks.length} weeks.`
  const firstMoved = after.weeks.findIndex((w, i) => JSON.stringify(w.sessions ?? {}) !== JSON.stringify(before.weeks[i]?.sessions ?? {}))
  if (firstMoved > weekIndex) return `Plan updated. The changes start in week ${after.weeks[firstMoved].n ?? firstMoved + 1}.`
  return 'Plan updated. No session moved.'
}

/** The days an ordinary week of this strength plan lifts on, in week order. */
function liftDays(p: StrengthPlan): Day[] {
  if (p.profile.available_days?.length) return DAY_ORDER.filter(d => p.profile.available_days!.includes(d))
  const w = p.weeks.find(x => ORDINARY.has(x.phase) && x.sessions.length > 0)
  return DAY_ORDER.filter(d => (w?.sessions ?? []).some(s => s.day === d))
}

/** The strength plan: built for the first time, moved to new days, or kept on the same ones. */
export function strengthPlanReadback(before: StrengthPlan | null, after: StrengthPlan): string {
  const now = liftDays(after)
  if (!before) {
    const built = now.length ? `Strength plan built. You lift on ${list(now)}.` : 'Strength plan built.'
    // STRENGTH-LEGS-DAY-FIRST-BUILD-01 (Design Board 2026-10-21): a first build skips *Here is what changes*, so this is
    // the only place the runner choosing days for the first time hears the day that would give legs a proper session.
    // An update never carries it: the consent screen already said it.
    return after.legs_day_suggestion ? `${built} ${STRENGTH_SETUP.legsDayLine(after.legs_day_suggestion)}` : built
  }
  const was = liftDays(before)
  if (now.join() !== was.join() && now.length) return `Strength plan updated. You now lift on ${list(now)}.`
  return 'Strength plan updated. Same days as before.'
}
