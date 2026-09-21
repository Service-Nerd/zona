import { describe, it, expect, afterEach, vi } from 'vitest'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan } from '@/lib/plan/invariants'
import type { Week } from '@/types/plan'
import { MARKETING_PLANS, planAnchor, faqsFor } from './plans'
import { phaseNote, hardSessionsIn } from './planNotes'

/**
 * MKT-PLAN-PHASE-NOTE-01 / MKT-PLAN-WEEKS-DRIFT-01 — the published pages are
 * checked against what they actually render, on every date they render on.
 *
 * ⚠️ WHY THE DATE LOOP. `/plans/*` is ISR with `revalidate = 86400` and the
 * plan is generated live from `planAnchor()`, so the page REGENERATES DAILY
 * against a moving anchor. `plans.test.ts` freezes the clock to one Wednesday
 * in September, which is one plan out of the fifty-three the page will
 * actually publish over a year. That single frozen date is how
 * DATE-DST-01 shipped: for eleven weeks of every year every one of these
 * pages rendered ONE WEEK SHORT of the count in its own <title>, and the
 * frozen test was structurally unable to see it. An audit is only ever as
 * wide as its list, so this one walks the year.
 */

afterEach(() => { vi.useRealTimers() })

/** One simulated request date per week for a year: every anchor the page will use. */
function everyPublishedAnchor(): string[] {
  const out: string[] = []
  const d = new Date(Date.UTC(2026, 8, 21))
  for (let i = 0; i < 53; i++) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 7) }
  return out
}

/** The phase grouping `PlanPage` itself does, so the test sees the real blocks. */
function phaseGroups(weeks: Week[]): { key: string; weeks: Week[] }[] {
  const groups: { key: string; weeks: Week[] }[] = []
  for (const w of weeks) {
    const k = w.phase ?? 'base'
    const last = groups[groups.length - 1]
    if (last && last.key === k) last.weeks.push(w)
    else groups.push({ key: k, weeks: [w] })
  }
  return groups
}

describe.each(MARKETING_PLANS.map(p => [p.slug, p] as const))('published plan: %s', (_slug, plan) => {
  it('renders its advertised week count on every date it publishes on', () => {
    const wrong: string[] = []
    for (const today of everyPublishedAnchor()) {
      vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T09:00:00Z`))
      const { planStart, raceDate } = planAnchor(plan.dayOffset)
      const n = generateRulePlan(plan.input(raceDate), 'free', planStart).weeks.filter(w => w.n >= 1).length
      if (n !== plan.weeks) wrong.push(`${today} -> ${n}`)
      vi.useRealTimers()
    }
    expect(wrong, `${plan.slug} advertises ${plan.weeks} weeks; rendered otherwise on: ${wrong.join(', ')}`).toEqual([])
  })

  it('never prints a phase note its own weeks contradict', () => {
    const lies: string[] = []
    for (const today of everyPublishedAnchor()) {
      vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T09:00:00Z`))
      const { planStart, raceDate } = planAnchor(plan.dayOffset)
      const weeks = generateRulePlan(plan.input(raceDate), 'free', planStart).weeks.filter(w => w.n >= 1)
      for (const g of phaseGroups(weeks)) {
        const note = phaseNote(g.key, g.weeks)
        const hard = hardSessionsIn(g.weeks)
        if (/no hard running/.test(note) && hard.length > 0) {
          lies.push(`${today} ${g.key} w${g.weeks[0].n}: "no hard running" over ${hard.map(s => s.label).join(', ')}`)
        }
        if (/plus a time trial/.test(note) && hard.length === 0) {
          lies.push(`${today} ${g.key} w${g.weeks[0].n}: promises a time trial the block does not contain`)
        }
      }
      vi.useRealTimers()
    }
    expect(lies.slice(0, 5), `${plan.slug}: ${lies.length} contradicted phase notes`).toEqual([])
  })

  it('never badges a week "Recovery" that is not a reduction', () => {
    // The badge PlanPage renders. A recovery week carrying more volume than
    // the week before it is `INV-PLAN-DELOAD-IS-A-REDUCTION`'s declared
    // residual: unfixed in the engine (DELOAD-BADGE-TRUTH-01, with the
    // Coaching Board), and not something to publish in the meantime.
    const bad: string[] = []
    for (const today of everyPublishedAnchor()) {
      vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T09:00:00Z`))
      const { planStart, raceDate } = planAnchor(plan.dayOffset)
      const weeks = generateRulePlan(plan.input(raceDate), 'free', planStart).weeks.filter(w => w.n >= 1)
      weeks.forEach((w, i) => {
        const badged = (w as Week & { type?: string; badge?: string }).type === 'deload'
          || (w as Week & { type?: string; badge?: string }).badge === 'deload'
        if (badged && i > 0 && w.weekly_km >= weeks[i - 1].weekly_km) {
          bad.push(`${today} w${w.n}: ${w.weekly_km}km after ${weeks[i - 1].weekly_km}km`)
        }
      })
      vi.useRealTimers()
    }
    expect(bad.slice(0, 5), `${plan.slug}: ${bad.length} lying recovery badges`).toEqual([])
  })

  it('carries no error-severity invariant violation on any publishing date', () => {
    const errs: string[] = []
    for (const today of everyPublishedAnchor()) {
      vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T09:00:00Z`))
      const { planStart, raceDate } = planAnchor(plan.dayOffset)
      const input = plan.input(raceDate)
      const gen = generateRulePlan(input, 'free', planStart)
      for (const v of validatePlan(gen, input)) if (v.severity === 'error') errs.push(`${today} ${v.code}`)
      vi.useRealTimers()
    }
    expect(errs.slice(0, 5), `${plan.slug}: ${errs.length} error-severity violations`).toEqual([])
  })

  it('the FAQ days-a-week claim matches what the plan actually delivers', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-21T09:00:00Z'))
    const { planStart, raceDate } = planAnchor(plan.dayOffset)
    const weeks = generateRulePlan(plan.input(raceDate), 'free', planStart).weeks.filter(w => w.n >= 1)
    // Race week is short by design, so the claim is about the modal week.
    const counts = weeks.map(w => Object.keys(w.sessions).length)
    const mode = Array.from(new Set(counts)).sort((a, b) =>
      counts.filter(x => x === b).length - counts.filter(x => x === a).length)[0]
    expect(mode, `${plan.slug}: FAQ says ${plan.daysPerWeek} days a week`).toBe(plan.daysPerWeek)
    expect(faqsFor(plan).some(f => f.a.startsWith(`${plan.daysPerWeek} days a week.`))).toBe(true)
  })
})
