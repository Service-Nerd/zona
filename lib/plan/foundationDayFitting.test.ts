import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { generateFoundationBlock } from './foundationBlock'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * CB-1 (Coaching Board, 2026-09-03) — foundation weeks obey §9.
 *
 * The old sizing floored easy runs at a hardcoded 3 km with no relationship to
 * the 35% long-run cap. At low volume they collided: an 8 km week produced 3.0 km
 * easy runs and a 2.8 km "Long easy" — the long run was the SHORTEST run of the
 * week. Measured across 24,219 foundation weeks before the fix: 49,974
 * INV-PLAN-LONG-IS-LONGEST + 36,585 INV-PLAN-MIN-SESSION-SIZE + 13,428
 * INV-PLAN-FOUNDATION-BLOCK. After: zero.
 *
 * Board ruling: "reduce days, never inflate sessions" (McMillan), "consolidate,
 * don't fragment" (Willy). Below FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN a coherent
 * long run is arithmetically impossible, so the week has none.
 */

const PLAN_START = '2026-11-30'
const TODAY = '2026-11-06'

const input = (over: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-04-11', race_distance_km: 10, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 40,
  preferred_long_run_day: 'sun',
  ...over,
} as GeneratorInput)

const block = (over: Partial<GeneratorInput>) =>
  generateFoundationBlock({ input: input(over), planStartDate: PLAN_START, today: TODAY })

const runs = (w: { sessions?: Record<string, Session | undefined> }) =>
  Object.values(w.sessions ?? {}).filter((s): s is Session =>
    !!s && s.type !== 'rest' && s.type !== 'cross-train')

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T09:00:00Z')) })
afterAll(() => { vi.useRealTimers() })

describe('CB-1 — foundation day-fitting', () => {
  it('never places a session below the §9 easy floor', () => {
    const floor = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
    for (const vol of [5, 8, 12, 15, 20, 30, 50]) {
      for (const days of [3, 4, 5, 6]) {
        const { weeks } = block({ current_weekly_km: vol, days_available: days, longest_recent_run_km: Math.min(vol, 10) })
        for (const w of weeks) {
          for (const s of runs(w)) {
            // A single-session week carries the whole (tiny) volume; below the
            // floor there is nothing to split, and §5 owns that case.
            if (runs(w).length === 1) continue
            expect(s.distance_km ?? 0).toBeGreaterThanOrEqual(floor - 0.05)
          }
        }
      }
    }
  })

  it('the long run is the LONGEST run whenever one is placed', () => {
    for (const vol of [8, 15, 20, 30, 50]) {
      for (const lr of [3, 5, 10, 20]) {
        if (lr > vol) continue
        const { weeks } = block({ current_weekly_km: vol, longest_recent_run_km: lr })
        for (const w of weeks) {
          const all = runs(w)
          const long = all.find(isLongRun)
          if (!long) continue
          const longest = Math.max(...all.map(s => s.distance_km ?? 0))
          expect(long.distance_km).toBe(longest)
        }
      }
    }
  })

  it('places NO long run when one cannot satisfy §9 (the honest object)', () => {
    // 8 km over 3 days: the 35% cap and the 1.25 ratio cannot both hold.
    const { weeks } = block({ current_weekly_km: 8, days_available: 3, longest_recent_run_km: 3 })
    for (const w of weeks) {
      expect(runs(w).some(isLongRun)).toBe(false)
      // ...and it must not LABEL one either — that was the lie.
      expect(runs(w).some(s => /long/i.test(s.label ?? ''))).toBe(false)
    }
  })

  it('reduces DAYS rather than shrinking sessions below the floor', () => {
    // 8 km at a 4 km floor supports 2 sessions, not the 4 days offered.
    const { weeks } = block({ current_weekly_km: 8, days_available: 4, longest_recent_run_km: 3 })
    expect(runs(weeks[0]).length).toBeLessThanOrEqual(2)
  })

  it('stamps role on the long run — never classified by label (INV-CLASS-002)', () => {
    const { weeks } = block({ current_weekly_km: 40, days_available: 5, longest_recent_run_km: 15 })
    const long = weeks.flatMap(runs).find(s => (s.distance_km ?? 0) > 0 && s.role === 'long_run')
    expect(long).toBeTruthy()
    expect(long!.role).toBe('long_run')
  })

  it('never rounds a value past its own cap', () => {
    // 5.6 km * 1.10 = 6.16; toFixed(1) gave 6.2 and breached the +10% ceiling.
    for (const vol of [8, 15, 23, 30]) {
      const { weeks } = block({ current_weekly_km: vol, weeks_at_current_volume: 4 } as Partial<GeneratorInput>)
      const ceiling = weeks[0].weekly_km * (1 + GENERATION_CONFIG.FOUNDATION_WEEKLY_INCREASE_PCT / 100)
      for (const w of weeks) expect(w.weekly_km).toBeLessThanOrEqual(ceiling + 0.001)
    }
  })

  it('assembled plans carry zero error violations on foundation weeks', () => {
    for (const vol of [8, 15, 30, 50]) {
      for (const days of [3, 4, 5]) {
        for (const lr of [3, 5, 10, 20]) {
          if (lr > vol) continue
          const inp = input({ current_weekly_km: vol, days_available: days, longest_recent_run_km: lr })
          const main = generateRulePlan(inp, 'trial', PLAN_START)
          const fb = generateFoundationBlock({ input: inp, planStartDate: PLAN_START, today: TODAY })
          const assembled: Plan = { ...main, weeks: [...fb.weeks, ...main.weeks] }
          const errs = validatePlan(assembled, inp)
            .filter(v => v.severity === 'error' && (v.week ?? 1) <= 0)
          expect(errs.map(v => `${v.code} w${v.week}`)).toEqual([])
        }
      }
    }
  })
})
