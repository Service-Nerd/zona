// STRENGTH-ENTRY-01 — what Coach shows about strength (Design Board, Sierra): evidence, not a
// second voice. "N of M this week", and one line of the plan's OWN progression. No streak, no
// badge, and no load chart: nothing logs load yet (Phase 4), and a chart drawn from planned
// numbers would show the plan, not the runner.
//
// ⚠️ The progression is READ FROM THE PLAN'S OUTPUT, never re-derived from config and week
// counts. The engine decides when the technique block ends and when jumps start; reading the
// sessions it actually produced means this line cannot disagree with the session screen.

import { STRENGTH_CONFIG, type StrengthPlan, type StrengthWeek } from '@/packages/strength'

export interface StrengthWeekEvidence {
  done: number
  planned: number
  /** The next step the plan takes after this week, or null when there is none to name. */
  next: { kind: 'heavier' | 'jumps'; week: number } | null
}

const mainReps = (w: StrengthWeek): number[] =>
  w.sessions.flatMap(s => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items.map(i => i.reps)))
    .filter((r): r is number => typeof r === 'number')
const mainRirs = (w: StrengthWeek): number[] =>
  w.sessions.flatMap(s => s.blocks.filter(b => b.role === 'main').flatMap(b => b.items.map(i => i.rir)))
    .filter((r): r is number => typeof r === 'number')

const hasPlyo = (w: StrengthWeek) => w.sessions.some(s => s.blocks.some(b => b.role === 'plyo' && b.items.length > 0))

/** A week is technique-first when every main lift it prescribes is at the technique reps AND the technique effort:
 *  a general 10-rep block (S6 Am.2) has the reps but not the extra rep in reserve, and is not technique. */
const isTechnique = (w: StrengthWeek) => {
  const r = mainReps(w)
  return r.length > 0 && r.every(x => x >= STRENGTH_CONFIG.NOVICE_REPS) && mainRirs(w).every(x => x >= STRENGTH_CONFIG.NOVICE_RIR)
}

export function strengthWeekEvidence(
  plan: StrengthPlan | null,
  completions: Record<string, 'done' | 'skipped'>,
  weekN: number | null,
): StrengthWeekEvidence | null {
  if (!plan || weekN == null) return null
  const i = plan.weeks.findIndex(w => w.n === weekN)
  if (i < 0) return null
  const week = plan.weeks[i]
  // A week with no strength says nothing: "0 of 0" is a number that means nothing.
  if (week.sessions.length === 0) return null
  const done = week.sessions.filter(s => s.date && completions[s.date] === 'done').length

  const later = plan.weeks.slice(i + 1)
  const heavier = isTechnique(week)
    ? later.find(w => mainReps(w).some(r => r < STRENGTH_CONFIG.NOVICE_REPS)) ?? null
    : null
  // Only a FIRST: a deload week with no jumps, after jumps have started, is not news.
  const jumpsStarted = plan.weeks.slice(0, i + 1).some(hasPlyo)
  const jumps = jumpsStarted ? null : later.find(hasPlyo) ?? null
  const next = heavier && (!jumps || heavier.n <= jumps.n) ? { kind: 'heavier' as const, week: heavier.n }
    : jumps ? { kind: 'jumps' as const, week: jumps.n }
    : null

  return { done, planned: week.sessions.length, next }
}
