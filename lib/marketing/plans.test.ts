import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateMarketingPlan } from './marketingPlan'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import type { Session } from '@/types/plan'
import { MARKETING_PLANS, planAnchor } from './plans'

/**
 * GTM-SEO-PLANS-01 — the marketing plan catalogue is contract, not decoration.
 * Every published plan must:
 *   1. carry an EVEN week count (founder rule — no odd-week plans);
 *   2. have its advertised `weeks` MATCH what the engine actually generates
 *      (a label that drifts from the plan is a lie on a public page);
 *   3. land race day on a SUNDAY (that is when races are);
 *   4. generate cleanly at all (a §44 refusal throws — which fails this test,
 *      catching an over-ambitious goal/offset before it ships).
 */

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-09T09:00:00Z')) })
afterAll(() => { vi.useRealTimers() })

describe('marketing plans catalogue', () => {
  it.each(MARKETING_PLANS.map(p => [p.slug, p] as const))(
    '%s — even weeks, label matches the engine, races on a Sunday',
    (_slug, plan) => {
      const { planStart, raceDate } = planAnchor(plan.dayOffset)
      const gen = generateMarketingPlan(plan).plan
      const weeks = gen.weeks.filter(w => w.n >= 1)

      expect(plan.weeks % 2, `${plan.slug}: weeks (${plan.weeks}) must be even`).toBe(0)
      expect(weeks.length, `${plan.slug}: advertised ${plan.weeks} weeks vs generated ${weeks.length}`).toBe(plan.weeks)

      // 🔴 A STAGED PAGE HAS NO RACE DAY, BY RULING, NOT BY ACCIDENT. §116
      // Amendment 10: the block may be published, the race it stages may not be
      // claimed. Its last week is a base week ending at a CHECKPOINT, so there
      // is no `type: 'race'` session to find — asserting one here would require
      // the page to publish the very thing the Coaching Board forbade.
      // ⚠️ The arm below keeps the staged page honest in the OTHER direction,
      // which is the one that can actually go wrong: it must contain no race
      // session at all.
      const last = weeks[weeks.length - 1]
      const raceDay = Object.entries(last.sessions).find(([, s]) => (s as Session | undefined)?.type === 'race')?.[0]
      if (plan.staged) {
        const anyRace = weeks.some(w => Object.values(w.sessions)
          .some(s => (s as Session | undefined)?.type === 'race'))
        expect(anyRace, `${plan.slug}: a staged page may not publish a race session (§116 Am.10)`).toBe(false)
      } else {
        expect(raceDay, `${plan.slug}: race day should be Sunday`).toBe('sun')
      }
    },
  )

  it('every related slug resolves to a real plan', () => {
    const slugs = new Set(MARKETING_PLANS.map(p => p.slug))
    for (const p of MARKETING_PLANS) {
      for (const r of p.related) {
        expect(slugs.has(r), `${p.slug}: related slug "${r}" does not exist`).toBe(true)
      }
    }
  })
})

/**
 * IA-CROSSLINK-01 — the distance plans and the goal-time plans are two doors
 * into the same nine pages, and the traffic only went one way.
 *
 * Measured before the fix: all FIVE goal plans linked to their distance
 * plan, and all FOUR distance plans linked to zero goal plans. The free 5K
 * plan is the page a search lands on, and it was a dead end toward the
 * sub-25 page that is the better match for a runner who has a target. This
 * is the strictly more valuable direction and it was the missing one.
 */
describe('plan cross-links', () => {
  const bySlug = new Map(MARKETING_PLANS.map(p => [p.slug, p]))
  const goal = MARKETING_PLANS.filter(p => p.group === 'goal')
  const distance = MARKETING_PLANS.filter(p => p.group !== 'goal')

  it('has both kinds to link between', () => {
    expect(goal.length).toBeGreaterThan(0)
    expect(distance.length).toBeGreaterThan(0)
  })

  it('links every goal plan to at least one distance plan', () => {
    const orphans = goal.filter(p => !p.related.some(r => bySlug.get(r)?.group !== 'goal'))
    expect(orphans.map(p => p.slug)).toEqual([])
  })

  it('links every distance plan to at least one goal plan', () => {
    // ⚠️ A STAGED PAGE IS EXEMPT AND THE REASON IS THE READER, not convenience:
    // the goal pages are "sub-25 5K", "sub-4 marathon". A person who has never
    // run has no goal time, and routing them to one is the opposite of what the
    // page is for. It links to the three distance plans instead, which is a real
    // route onward.
    const orphans = distance.filter(p => !p.staged && !p.related.some(r => bySlug.get(r)?.group === 'goal'))
    expect(
      orphans.map(p => p.slug),
      'a distance plan with no route to a goal plan is a dead end for a runner with a target',
    ).toEqual([])
  })

  it('links reciprocally: if A names B, B names A', () => {
    const oneWay: string[] = []
    for (const p of MARKETING_PLANS) {
      for (const r of p.related) {
        // Only enforced ACROSS the two groups. Within a group the lists are
        // curated for relevance and a short list cannot be symmetric.
        if (bySlug.get(r)?.group === p.group) continue
        if (!bySlug.get(r)?.related.includes(p.slug)) oneWay.push(`${p.slug} -> ${r} (no way back)`)
      }
    }
    expect(oneWay, oneWay.join('\n')).toEqual([])
  })

  it('names only plans that exist', () => {
    const dead = MARKETING_PLANS.flatMap(p => p.related.filter(r => !bySlug.has(r)).map(r => `${p.slug} -> ${r}`))
    expect(dead).toEqual([])
  })
})
