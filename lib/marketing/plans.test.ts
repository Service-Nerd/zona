import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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
      const gen = generateRulePlan(plan.input(raceDate), 'free', planStart)
      const weeks = gen.weeks.filter(w => w.n >= 1)

      expect(plan.weeks % 2, `${plan.slug}: weeks (${plan.weeks}) must be even`).toBe(0)
      expect(weeks.length, `${plan.slug}: advertised ${plan.weeks} weeks vs generated ${weeks.length}`).toBe(plan.weeks)

      const last = weeks[weeks.length - 1]
      const raceDay = Object.entries(last.sessions).find(([, s]) => (s as Session | undefined)?.type === 'race')?.[0]
      expect(raceDay, `${plan.slug}: race day should be Sunday`).toBe('sun')
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
