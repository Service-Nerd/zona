// NO-RUNNER-TURNED-AWAY-01 — the staged race plan (§116 Am. 9; Coaching Board 2026-10-24, two sittings).
import { describe, it, expect, afterEach } from 'vitest'
import { checkpointPlacement, stagingApplies, generateStagedRacePlan, stagedRaceOf, observedCheckpointKm } from './stagedRacePlan'
import { validateBaseBuildBlock, validateStagedRace } from './baseBuildValidate'
import { validateStoredPlan } from './validateStoredPlan'
import { generateRulePlan } from './ruleEngine'
import { runEngine } from './engine'
import { BaseVolumeError } from './baseVolume'
import { prepBlockWeeks } from './inputs'
import { GENERATION_CONFIG as C } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'
import type { WeeklyLoad } from '@/lib/coaching/weeklyActualLoad'

const START = '2026-10-26'           // a Monday
const RACE_26 = '2027-04-25'         // 25 whole weeks after START (`weeksBetweenLocal`): the Leicester runner's race

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.2, race_date: RACE_26, race_name: 'London Marathon', days_available: 4,
  goal: 'finish', current_weekly_km: 10, longest_recent_run_km: 6, age: 30, injuries: [],
  training_age: '<6mo', user_declared_level: 'beginner', recent_quality_training: 'none',
  ...over,
} as unknown as GeneratorInput)

const load = (km: number): WeeklyLoad => ({ linkedKm: km, offPlanKm: 0, totalKm: km })

describe('Q1 — where the checkpoint goes', () => {
  it('at the week the ramp reaches the door, the board\'s evidence table (26-week runway)', () => {
    expect(checkpointPlacement(input({ current_weekly_km: 10 }), 12, 26)).toEqual({ rampWeeks: 3, raceWeeks: 23, reachesDoor: true })
    expect(checkpointPlacement(input({ current_weekly_km: 8 }), 12, 26)).toEqual({ rampWeeks: 6, raceWeeks: 20, reachesDoor: true })
    expect(checkpointPlacement(input({ current_weekly_km: 6 }), 12, 26)).toEqual({ rampWeeks: 9, raceWeeks: 17, reachesDoor: true })
  })
  it('keeps §44\'s BLOCK weeks for the race (McMillan), not §116\'s 16-week warn line', () => {
    const block = prepBlockWeeks(input())
    expect(block).toBe(C.PREP_TIME_THRESHOLDS.MARATHON.block)
    // 6 km needs 9 weeks; a 17-week runway leaves 8 < block 10, so the checkpoint moves to runway − block.
    expect(checkpointPlacement(input({ current_weekly_km: 6 }), 12, 17)).toEqual({ rampWeeks: 7, raceWeeks: 10, reachesDoor: false })
  })
  it('no week to stage: null, so §44 refuses that runner on its own grounds', () => {
    expect(checkpointPlacement(input(), 12, prepBlockWeeks(input()))).toBeNull()
  })
  it('below §116\'s running floor it does not stage (the walk-run start is phase D)', () => {
    expect(stagingApplies(input({ current_weekly_km: C.BASE_BUILD_ONRAMP_MIN_START_KM - 1 }), 12, 26)).toBe(false)
    expect(stagingApplies(input({ current_weekly_km: C.BASE_BUILD_ONRAMP_MIN_START_KM }), 12, 26)).toBe(true)
  })
})

describe('the staged plan', () => {
  const plan = generateStagedRacePlan(input(), START, 12)!
  const staged = stagedRaceOf(plan)!
  it('is a base-build plan that remembers its race, and keeps the base-build race fields exactly as before', () => {
    expect(plan.meta.plan_kind).toBe('base_build')
    expect(plan.meta.race_name).toBe('Base building')
    expect(plan.meta.race_date).toBe('')
    expect(staged).toMatchObject({ race_name: 'London Marathon', race_date: RACE_26, race_distance_km: 42.2, door_km: 12, checkpoint_week: 3, race_weeks: 22, reaches_door: true })
  })
  it('holds base building only, ending at its checkpoint, and passes both validators', () => {
    expect(plan.weeks.length).toBe(staged.checkpoint_week)
    expect(plan.weeks.every(w => w.phase === 'base_build')).toBe(true)
    expect(validateStagedRace(plan)).toEqual([])
    expect(validateBaseBuildBlock(plan.weeks, 10)).toEqual([])
    expect(validateStoredPlan(plan).filter(v => v.severity === 'error')).toEqual([])
  })
  it('every placeable start and runway produces a valid staged plan (never ends on a deload, §116 Am. 7)', () => {
    const bad: string[] = []
    for (const km of [6, 7, 8, 9, 10, 11]) for (const weeks of [12, 14, 17, 20, 26, 30]) {
      const race = new Date(Date.parse(`${START}T00:00:00Z`) + weeks * 7 * 864e5).toISOString().slice(0, 10)
      const p = generateStagedRacePlan(input({ current_weekly_km: km, race_date: race }), START, 12)
      if (!p) continue
      const errs = [...validateBaseBuildBlock(p.weeks, km), ...validateStagedRace(p)].filter(v => v.severity === 'error')
      if (errs.length) bad.push(`${km}km/${weeks}wk: ${errs.map(e => e.code).join(',')}`)
    }
    expect(bad).toEqual([])
  })
})

describe('INV-PLAN-STAGED-NO-RACE-BLOCK — each arm fires on its own', () => {
  const fresh = () => JSON.parse(JSON.stringify(generateStagedRacePlan(input(), START, 12)!)) as Plan
  const codes = (p: Plan) => validateStagedRace(p).map(v => v.actual)
  it('a race-block week inside the staged plan', () => {
    const p = fresh(); (p.weeks[p.weeks.length - 1] as unknown as { phase: string }).phase = 'build'
    expect(codes(p)).toEqual(['build'])
  })
  it('the plan runs past its checkpoint', () => {
    const p = fresh(); p.weeks.push(JSON.parse(JSON.stringify(p.weeks[p.weeks.length - 1])))
    expect(codes(p)).toEqual(['4 weeks'])
  })
  it('too few weeks left for the race block', () => {
    const p = fresh(); ((p.meta as unknown as Record<string, unknown>).staged_race as { race_weeks: number }).race_weeks = 3
    expect(codes(p)).toEqual(['3'])
  })
})

describe('Q2 — what the runner actually ran', () => {
  const plan = generateStagedRacePlan(input({ current_weekly_km: 6 }), START, 12)!   // 9 weeks, deloads at 4 and 8
  const cp = stagedRaceOf(plan)!.checkpoint_week
  it('averages the final two NON-deload weeks', () => {
    const deloads = plan.weeks.filter(w => w.type === 'deload').map(w => w.n)
    expect(deloads.length).toBeGreaterThan(0)
    const loads = new Map(plan.weeks.map(w => [w.n, load(deloads.includes(w.n) ? 0 : w.n)]))
    // weeks 9 and 7 (8 is a deload): (9 + 7) / 2
    expect(observedCheckpointKm(plan, loads, cp)).toBe(8)
  })
  it('no runs recorded is null, never a pass and never zero', () => {
    expect(observedCheckpointKm(plan, new Map(), cp)).toBeNull()
  })
  it('floors to one decimal: 11.95 is not rounded up to the door', () => {
    const loads = new Map(plan.weeks.map(w => [w.n, load(11.95)]))
    expect(observedCheckpointKm(plan, loads, cp)).toBe(11.9)
  })
})

describe('the checkpoint gates on what was RUN, through §111 itself', () => {
  // The defect the second sitting ruled: the handover regenerated the race plan from the PLANNED end volume.
  // Tom planned 21 km over two weeks and recorded 3.1; fed his PLANNED figure the engine would build his marathon.
  it('planned volume would pass; observed volume does not', () => {
    const plannedEnd = 12.1, observed = 1.5
    expect(() => generateRulePlan(input({ current_weekly_km: plannedEnd }), 'paid', START)).not.toThrow()
    expect(() => generateRulePlan(input({ current_weekly_km: observed }), 'paid', START)).toThrow(BaseVolumeError)
  })
})

describe('the engine — behind §116\'s flag', () => {
  afterEach(() => { delete process.env.ENABLE_BASE_BUILD_ONRAMP })
  const run = (over: Partial<GeneratorInput> = {}) => runEngine({ input: input(over), tier: 'paid', displayUnits: 'km', planStart: START, today: '2026-10-25' })
  it('flag OFF: a 10 km/week marathoner is refused exactly as before, and the dead on-ramp offer is gone', () => {
    const out = run()
    expect(out.kind).toBe('refusal')
    if (out.kind !== 'refusal') return
    expect(out.body.reason).toBe('base_volume')
    expect('onramp' in out.body).toBe(false)
    expect(out.body.get_running).toBeTruthy()
  })
  it('flag ON: the same runner gets a staged plan for their race, and is countable', () => {
    process.env.ENABLE_BASE_BUILD_ONRAMP = '1'
    const out = run()
    expect(out.kind).toBe('base_build')
    if (out.kind !== 'base_build') return
    expect(stagedRaceOf(out.plan)?.race_name).toBe('London Marathon')
    expect(out.telemetry?.event).toBe('plan_staged_for_race')
  })
  it('flag ON, below the running floor: still refused with the base-building offer (phase D is not built)', () => {
    process.env.ENABLE_BASE_BUILD_ONRAMP = '1'
    const out = run({ current_weekly_km: 5 })
    expect(out.kind).toBe('refusal')
    if (out.kind === 'refusal') expect(out.body.get_running).toBeTruthy()
  })
})

// Typed so a test file edit cannot silently widen what a staged plan is.
export type _Plan = Plan
