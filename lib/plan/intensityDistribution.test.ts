import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * SC-03 / CD-19 — the declared intensity distribution.
 *
 * The table sat in config for four months declaring "75% easy / 25% quality,
 * measured in MINUTES" for 10K, while the traced plan delivered 9.6% by
 * minutes. That was read as a fifteen-point under-delivery. It was not.
 *
 * The 80/20 finding is a SESSION-COUNT observation. By time the ratio is far
 * more skewed — typically 90/10 or beyond — because easy sessions are long and
 * hard ones are short. Applying a session-count ratio to a time denominator
 * inflates the target by roughly a factor of two. On the correct basis the same
 * plan delivers exactly 25% in every phase that prescribes quality. **The
 * engine was right and the config was wrong.**
 *
 * It survived because of §34, not coaching judgement: the table was read by an
 * offline script and by no engine code, with no invariant referencing it.
 * Nothing computed the number, so nobody could see which quantity it was.
 *
 * The board ruled: sessions, plan-wide, and a CEILING rather than a target — a
 * target invites the engine to close a gap it can only close in base phase,
 * which §4/§5 make all-easy on purpose, and pushes a drift-prone population
 * further into Z3.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')

const TENK: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
}

function share(plan: Plan): { pct: number, quality: number, running: number } {
  const HARD = new Set(['quality', 'intervals', 'tempo'])
  let running = 0, quality = 0
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions)) {
      if (!s || s.type === 'rest' || s.type === 'strength' || s.type === 'cross-train') continue
      running++
      if (HARD.has(s.type)) quality++
    }
  }
  return { pct: (quality / running) * 100, quality, running }
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-03 — intensity distribution is a session-share ceiling', () => {
  it('the config is expressed in a self-describing unit', () => {
    // The whole defect was a unit ambiguity at the call site. The field name
    // must carry the unit so it cannot be misread again.
    for (const v of Object.values(GENERATION_CONFIG.INTENSITY_DISTRIBUTION)) {
      expect(v).toHaveProperty('max_quality_session_pct')
      expect(typeof v.max_quality_session_pct).toBe('number')
    }
  })

  it('a real 10K plan sits under its ceiling', () => {
    const plan = generateRulePlan(TENK, 'paid', '2026-09-07')
    const { pct } = share(plan)
    expect(pct).toBeLessThanOrEqual(GENERATION_CONFIG.INTENSITY_DISTRIBUTION['10K'].max_quality_session_pct)
    expect(validatePlan(plan, TENK).filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')).toHaveLength(0)
  })

  it('the time trial and the race are NOT counted as quality', () => {
    // Grounded in existing doctrine, not chosen to make the numbers work: §78
    // types the recalibration time trial `hard` PRECISELY so it does not count
    // against QUALITY_SESSIONS_PER_WEEK_MAX, and the race is the goal rather
    // than training. Counting either contradicts the rule that gave it its type.
    //
    // This is not academic — it is what the CD-19 verification pass caught. A
    // 3-day HM plan measured 24.4% against a 20% ceiling with them included.
    const plan = generateRulePlan(TENK, 'paid', '2026-09-07')
    const types = plan.weeks.flatMap(w => Object.values(w.sessions).map(s => s?.type))
    expect(types).toContain('hard')       // the plan really does contain a time trial
    expect(types).toContain('race')

    const { quality } = share(plan)
    const naive = types.filter(t => t === 'quality' || t === 'hard' || t === 'race').length
    expect(naive).toBeGreaterThan(quality) // the exclusions actually bite
  })

  it('the ceiling is enforced, not merely declared (§34)', () => {
    // The failure this closes: the table was declared for four months and
    // checked by nothing. Poison a plan past its ceiling and assert rejection.
    const plan = generateRulePlan(TENK, 'paid', '2026-09-07')
    const over = structuredClone(plan)
    // CD-21 (2026-08-20): TENK generates as `maintenance`, and maintenance
    // plans are now exempt from this ceiling — a distribution ratio presupposes
    // enough sessions to distribute. This test is about the ceiling BITING, so
    // it asserts against a build profile. The exemption itself is covered in
    // intensityDistributionCd21.test.ts.
    over.meta = { ...over.meta, volume_profile: 'build' }
    for (const w of over.weeks) {
      for (const [day, s] of Object.entries(w.sessions)) {
        if (s && s.type === 'easy') {
          (over.weeks.find(x => x.n === w.n)!.sessions as Record<string, { type: string }>)[day].type = 'quality'
          break
        }
      }
    }
    const found = validatePlan(over, TENK).filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].message).toContain('above the 10K ceiling')
  })
})
