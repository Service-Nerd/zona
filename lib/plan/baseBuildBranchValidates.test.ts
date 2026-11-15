// §116 Am. 12 / ADR-020 `INV-PLAN-SINGLE-CONSTRUCTION` — `runEngine`'s `base_build` branch
// validates the block it returns. It did not, for the life of the feature
// (`ENGINE-BASEBUILD-UNVALIDATED-01`, Coaching Board 2026-11-15): the STAGED branch ran
// `validateBaseBuildBlock` + `validateStagedRace` and this one ran neither, so the plan kind
// built for people who cannot yet run was the one kind reaching a runner unvalidated.
//
// ⚠️ BEHAVIOURAL, because a source assertion passes on a comment. The generator is mocked to
// return a block carrying a deliberate +100% per-run step; `enforceViolations` throws on
// error severity under NODE_ENV=test, so a wired branch throws and an unwired one returns.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

// ⚠️ The real implementation is exposed BY THE FACTORY, not by a top-level `vi.importActual`.
// `vi.mock` is hoisted above a top-level await, so an `importActual` up there resolves to the
// MOCK — and `mockImplementation(thatMock)` makes the mock call itself, which is how the first
// cut of this file failed with `input` undefined inside `effectiveStartKm`.
vi.mock('./getRunningPlan', async () => {
  const actual = await vi.importActual<typeof import('./getRunningPlan')>('./getRunningPlan')
  return { ...actual, generateGetRunningPlan: vi.fn(actual.generateGetRunningPlan), __real: actual.generateGetRunningPlan }
})

// ⚠️ A STATIC import, not a top-level `await import`: this project's tsconfig target forbids
// top-level await, and `npx tsc --noEmit` is the pre-push gate's first arm.
import * as getRunningMod from './getRunningPlan'
const mod = getRunningMod as typeof getRunningMod & { __real: typeof getRunningMod['generateGetRunningPlan'] }
const { generateGetRunningPlan } = mod
const realGenerate = mod.__real
import { runEngine } from './engine'

const input: GeneratorInput = {
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', current_weekly_km: 10, longest_recent_run_km: 4,
  age: 32, injuries: [], recent_quality_training: 'none', training_age: '<6mo',
  user_declared_level: 'beginner',
} as unknown as GeneratorInput

const PLAN_START = '2026-10-05'

/** A real base-build plan, with one build week's runs doubled so the §45 ratio arm must fire. */
function planWithADoubling(): { plan: Plan; endsAtKm: number; weeks: number } {
  const built = realGenerate(input, PLAN_START, 15)
  const plan = JSON.parse(JSON.stringify(built.plan)) as Plan
  const dl = (w: Week) => w.type === 'deload' || w.badge === 'deload'
  const ramp = plan.weeks.filter(w => w.phase === 'base_build')
  let target = -1
  for (let i = 1; i < ramp.length; i++) if (!dl(ramp[i]) && !dl(ramp[i - 1])) { target = i; break }
  expect(target, 'fixture has no adjacent build weeks').toBeGreaterThan(0)
  const set = (w: Week, km: number) => {
    for (const s of Object.values(w.sessions ?? {}) as any[]) {
      if (!s || s.type === 'rest' || s.type === 'cross-train') continue
      s.distance_km = km; delete s.duration_mins
    }
  }
  set(ramp[target - 1], 6)
  set(ramp[target], 12)          // +100%: Willy's doubling
  return { ...built, plan }
}

describe('runEngine base_build branch — validated, not returned raw', () => {
  beforeEach(() => { vi.mocked(generateGetRunningPlan).mockReset(); vi.mocked(generateGetRunningPlan).mockImplementation(realGenerate) })

  it('the factory exposed the real implementation', () => {
    expect(typeof realGenerate).toBe('function')
  })

  it('a real base build is returned, and is clean', () => {
    const o = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: PLAN_START, today: PLAN_START, acceptBaseBuild: true })
    expect(o.kind).toBe('base_build')
  })

  it('🔴 a block carrying a violation THROWS out of the branch', () => {
    vi.mocked(generateGetRunningPlan).mockReturnValue(planWithADoubling() as never)
    expect(() => runEngine({
      input, tier: 'paid', displayUnits: 'km', planStart: PLAN_START, today: PLAN_START, acceptBaseBuild: true,
    })).toThrow(/ONRAMP-PER-RUN-STEP/)
  })

  it('and the mock is reached, so the case above is not vacuous', () => {
    vi.mocked(generateGetRunningPlan).mockReturnValue(planWithADoubling() as never)
    try { runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: PLAN_START, today: PLAN_START, acceptBaseBuild: true }) } catch { /* expected */ }
    expect(vi.mocked(generateGetRunningPlan)).toHaveBeenCalled()
  })
})
