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
import { validateBaseBuildBlock, validateStagedRace } from './baseBuildValidate'

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

// 🔴 AND THE WALK-RUN ARM, WHICH THE FIRST CUT OF THIS BRANCH DROPPED (code review, 2026-11-15).
//
// I ran `validateBaseBuildBlock` alone and wrote *"`validateStagedRace` is deliberately NOT run:
// a standalone base build has no race block"*. True, and the conclusion does not follow: since
// `GETRUNNING-WALKRUN-FLOOR-01` that function returns `validateWalkRunStart(plan)` when there is
// no `staged_race`, and **a plan with no `staged_race` is every plan this producer makes** — so
// the walk-run ladder gate wired for THIS producer three days earlier was skipped. Its own header
// says so. Every other caller in the repo pairs the two.
describe('runEngine base_build branch — the walk-run arm is paired, not skipped', () => {
  beforeEach(() => { vi.mocked(generateGetRunningPlan).mockReset(); vi.mocked(generateGetRunningPlan).mockImplementation(realGenerate) })

  /** A below-floor runner gets a walk-run start; break it so `validateWalkRunStart` fires.
   *
   * ⚠️ IT IS THE SESSION DURATION, NOT "the ladder", AND THE FIRST VERSION SAID OTHERWISE.
   * The comment claimed *"invert the ladder"* and the code also rewrote the session LABEL — which
   * code review measured as **inert**: a label-only mutation yields 0 violations, and every
   * violation came from `duration_mins`. The inert line is gone and the name says what fires, so
   * this case cannot be read as pinning the ladder arms when it pins the duration arm. */
  function planWithABrokenWalkRunDuration(): { plan: Plan; endsAtKm: number; weeks: number } {
    const belowFloor = { ...input, current_weekly_km: 2, longest_recent_run_km: 0 } as GeneratorInput
    const built = realGenerate(belowFloor, PLAN_START, 15)
    const plan = JSON.parse(JSON.stringify(built.plan)) as Plan
    const wr = plan.weeks.filter(w => (Object.values(w.sessions ?? {}) as any[])
      .some(s => s && typeof s.label === 'string' && /walk/i.test(s.label)))
    expect(wr.length, 'fixture carries no walk-run weeks, so it cannot pin the arm').toBeGreaterThan(0)
    for (const s of Object.values(wr[0].sessions ?? {}) as any[]) {
      if (s && typeof s.duration_mins === 'number') s.duration_mins = 99
    }
    return { ...built, plan }
  }

  it('a below-floor runner really does get walk-run weeks', () => {
    const belowFloor = { ...input, current_weekly_km: 2, longest_recent_run_km: 0 } as GeneratorInput
    const { plan } = realGenerate(belowFloor, PLAN_START, 15)
    const wr = plan.weeks.filter(w => (Object.values(w.sessions ?? {}) as any[])
      .some(s => s && typeof s.label === 'string' && /walk/i.test(s.label)))
    expect(wr.length).toBeGreaterThan(0)
  })

  it('🔴 the BRANCH throws on it, which only happens if validateStagedRace is paired', () => {
    // ⚠️ BEHAVIOURAL, and the first cut of this case was not: it compared the two validators
    // directly, which asserts nothing about `engine.ts` and stays green if the branch drops the
    // arm again. Driving it through `runEngine` is what makes it a gate on the WIRING.
    vi.mocked(generateGetRunningPlan).mockReturnValue(planWithABrokenWalkRunDuration() as never)
    expect(() => runEngine({
      input, tier: 'paid', displayUnits: 'km', planStart: PLAN_START, today: PLAN_START, acceptBaseBuild: true,
    })).toThrow(/WALKRUN-START-PROGRESSION/)
  })

  // ⚠️ THE VACUOUS HALF OF THIS CASE IS GONE. It also asserted that the block arm does NOT report
  // `INV-PLAN-WALKRUN-START-PROGRESSION` — a code only ever pushed inside `validateWalkRunStart`,
  // so it could not fail and said nothing (code review). What is worth asserting is that the block
  // arm finds NOTHING here, so the throw above can only have come from the arm the first cut dropped.
  it('the block arm alone finds nothing, so the throw above is the paired arm\'s', () => {
    const { plan } = planWithABrokenWalkRunDuration()
    const startKm = Number((plan.meta as never as Record<string, unknown>).base_build_start_km ?? 0)
    expect(validateBaseBuildBlock(plan.weeks, startKm).filter(v => v.severity === 'error')).toEqual([])
    expect(validateStagedRace(plan).filter(v => v.severity === 'error').map(v => v.code))
      .toContain('INV-PLAN-WALKRUN-START-PROGRESSION')
  })
})
