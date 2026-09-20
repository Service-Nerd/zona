import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { runWalkApplies, runWalkPeakKm, runWalkStrategy, applyRunWalk, runWalkDistanceApplies } from './runWalkPlan'
import { GENERATION_CONFIG as G } from './generationConfig'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Session } from '@/types/plan'

const mk = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', fitness_level: 'beginner', current_weekly_km: 10,
  longest_recent_run_km: 4, age: 32, injuries: [],
  recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

const ON = () => { process.env.ENABLE_FINISH_GOAL_RUNWALK = '1' }
const OFF = () => { delete process.env.ENABLE_FINISH_GOAL_RUNWALK }
beforeEach(OFF); afterEach(OFF)

describe('§117 — the flag', () => {
  // ⚠️ IT SHIPPED DARK AND STAYS DARK until S117-PEAK-VS-TIME-01 resolves:
  // §117 plans reach 39-44% of projected race duration against §80's 70% bar,
  // because amendment 1 specified a 30-34 km peak AND "3+ hours on feet" and
  // those do not reconcile under §52's 60% cap.
  it('is OFF by default, and off means the door is unmoved', () => {
    expect(runWalkApplies(mk(), 52)).toBe(false)
    expect(() => generateRulePlan(mk({ current_weekly_km: 10 }), 'paid', '2026-10-05')).toThrow()
  })

  it('on, it admits the runner §111 refuses at the standard peak', () => {
    ON()
    expect(runWalkApplies(mk({ current_weekly_km: 10 }), 52)).toBe(true)
    expect(() => generateRulePlan(mk({ current_weekly_km: 10 }), 'paid', '2026-10-05')).not.toThrow()
  })
})

describe('§117 — who it applies to', () => {
  beforeEach(ON)

  it('marathon only — shorter distances refuse nobody and ultras have §24e', () => {
    expect(runWalkDistanceApplies(42.195)).toBe(true)
    for (const d of [5, 10, 21.0975, 50, 100]) expect(runWalkDistanceApplies(d)).toBe(false)
  })

  it('finish goal only — a time goal says finishing is not the point', () => {
    expect(runWalkApplies(mk({ goal: 'time_target' } as never), 52)).toBe(false)
  })

  it('beginner only', () => {
    expect(runWalkApplies(mk({ fitness_level: 'intermediate' }), 65)).toBe(false)
  })

  it('only when the STANDARD peak would refuse them — not as a general downgrade', () => {
    // 30 km/week clears the standard door (52/4 = 13) comfortably.
    expect(runWalkApplies(mk({ current_weekly_km: 30 }), 52)).toBe(false)
  })
})

describe('§117 — amendment 3: PRESCRIBED, not permitted', () => {
  beforeEach(ON)

  it('stamps a named interval on every running session, and none on rest', () => {
    const plan = generateRulePlan(mk({ current_weekly_km: 10 }), 'paid', '2026-10-05')
    expect((plan.meta as any).finish_goal_run_walk).toBe(true)
    // ⚠️ REST DAYS ARE ABSENT FROM `sessions`, not stored as `type: 'rest'`.
    // The first cut of this test asserted a rest session existed and got 0 —
    // the plan simply omits the day. Assert what the shape actually is.
    let stamped = 0, race = 0
    for (const w of plan.weeks) for (const s of Object.values(w.sessions)) {
      if (!s) continue
      expect(s.run_walk_strategy, `${s.type} session carries no interval`).toBeTruthy()
      stamped++
      if (s.type === 'race') race++
    }
    expect(stamped).toBeGreaterThan(20)
    // ⚠️ THE RACE SESSION IS STAMPED TOO, and that is the point rather than an
    // accident: race day is where the walk breaks matter most, and a runner
    // told to run-walk for 29 weeks and handed an unqualified race session
    // would reasonably conclude the plan expects them to run it.
    expect(race).toBe(1)
  })

  it('the interval is a named instruction, not permission', () => {
    const s = runWalkStrategy()
    // McMillan: "'walk if you need to' is a dare. '6 minutes running, 1 minute
    // walking' is a session." The string must carry both numbers.
    expect(s).toContain(String(G.FINISH_GOAL_RUNWALK_RUN_MINS))
    expect(s).toContain(String(G.FINISH_GOAL_RUNWALK_WALK_MINS))
    expect(s).not.toMatch(/if you need to|if necessary|feel free/i)
  })

  it('the invariant catches a plan that only PERMITS walking', () => {
    const plan = generateRulePlan(mk({ current_weekly_km: 10 }), 'paid', '2026-10-05')
    for (const w of plan.weeks) for (const s of Object.values(w.sessions)) {
      if (s) delete (s as { run_walk_strategy?: string }).run_walk_strategy
    }
    expect(validatePlan(plan, mk({ current_weekly_km: 10 })).map(v => v.code))
      .toContain('INV-PLAN-RUNWALK-PRESCRIBED')
  })
})

describe('§117 — it loosens nothing (§111 Amendment 3)', () => {
  beforeEach(ON)

  it('the delivered ratio stays under §111s untouched cap', () => {
    expect(G.MAX_BASE_BUILD_RATIO).toBe(4.0)
    const plan = generateRulePlan(mk({ current_weekly_km: 10 }), 'paid', '2026-10-05')
    const peak = Math.max(...plan.weeks.filter(w => w.n > 0 && w.type !== 'race').map(w => w.weekly_km ?? 0))
    expect(peak / 10).toBeLessThanOrEqual(G.MAX_BASE_BUILD_RATIO)
  })

  it('a runner far below ANY peak is still refused — the door moved, it did not vanish', () => {
    expect(() => generateRulePlan(mk({ current_weekly_km: 2 }), 'paid', '2026-10-05')).toThrow()
  })

  it('applyRunWalk leaves non-running sessions alone', () => {
    const rest = { type: 'rest', label: 'Rest' } as unknown as Session
    expect(applyRunWalk(rest)).toBe(rest)
  })

  it('the peak is the config value, not a literal', () => {
    expect(runWalkPeakKm()).toBe(G.FINISH_GOAL_RUNWALK_PEAK_KM)
  })
})
