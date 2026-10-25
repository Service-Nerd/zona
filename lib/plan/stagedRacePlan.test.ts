// NO-RUNNER-TURNED-AWAY-01 — the staged race plan (§116 Am. 9; Coaching Board 2026-10-24, two sittings).
import { describe, it, expect, afterEach } from 'vitest'
import { checkpointPlacement, stagingApplies, generateStagedRacePlan, stagedRaceOf, observedCheckpointKm, observedLongestRunKm, checkpointRaceInput, declaredVolumeEdit, longestSessionKm } from './stagedRacePlan'
import { isFreshReturn } from './startVolume'
import { week1Leap } from './planQuality'
import { evaluateCheckpoint } from './engine'
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

const load = (km: number, longestKm = km / 2): WeeklyLoad => ({ linkedKm: km, offPlanKm: 0, totalKm: km, longestKm })

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
  it('below §116\'s running floor it stages through the walk-run start, whenever that ends before the race (Phase D)', () => {
    expect(stagingApplies(input({ current_weekly_km: C.BASE_BUILD_ONRAMP_MIN_START_KM - 1 }), 12, 26)).toBe(true)
    expect(stagingApplies(input({ current_weekly_km: 0 }), 12, 7)).toBe(false)
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
    expect(staged).toMatchObject({ race_name: 'London Marathon', race_date: RACE_26, race_distance_km: 42.2, min_base_km: 12, target_found: true, reaches_door: true })
    expect(staged.door_km).toBeGreaterThanOrEqual(staged.min_base_km)
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

// ── the third sitting: the checkpoint asks with what the runner RAN (C1–C3) ──────────────────────────────────────────
describe('C4 — no clean target: the checkpoint offers a choice, never a block we know is not clean', () => {
  // A real envelope case: finish goal, 8 km/week, 6 days, 20 weeks. No target leaves a clean race block.
  const NOFIT = input({ race_date: '2027-03-22', goal: 'finish', days_available: 6, current_weekly_km: 8,
    longest_recent_run_km: 4, training_age: '6-18mo', age: 28, recent_quality_training: 'occasional' })
  it('is still staged, at §111\'s door, and says no target was found', () => {
    const s = stagedRaceOf(generateStagedRacePlan(NOFIT, '2026-11-02', 9)!)!
    expect(s).toMatchObject({ door_km: 9, min_base_km: 9, target_found: false })
  })
  it('a staged plan whose target was not found answers checkpoint_choose even at the door', () => {
    const plan = generateStagedRacePlan(NOFIT, '2026-11-02', 9)!
    const at = new Map(plan.weeks.map(w => [w.n, load(stagedRaceOf(plan)!.door_km + 2, 6)]))
    const out = evaluateCheckpoint(NOFIT, plan, at, 'km')
    expect(out.ok).toBe(false)
    // Never "more base building": the target does not exist to build toward (C4).
    if (!out.ok) {
      expect(out.body.reason).toBe('checkpoint_choose')
      const kinds = (out.body.options as { kind: string }[]).map(o => o.kind)
      expect(kinds).not.toContain('extend')
      expect(kinds[kinds.length - 1]).toBe('later_race')
      // "Two ways" only where two are on offer; otherwise the observed figure, plainly.
      expect(out.body.error).toEqual(kinds.length === 2 ? 'Two ways to get to the start line from here.' : expect.stringMatching(/^You ran .+ a week\.$/))
    }
  })
})

// ⚠️ C4's "Two ways" heading has NO reachable case on the measured grid (2026-10-25): at each no-fit runner's real
// checkpoint §117 built a run-walk plan for 0 of 231, so they are offered a later race alone. Filed for the Phase E
// board round as NO-RUNNER-CHECKPOINT-NOFIT-01; the branch is kept because the board ruled it, not because it fires.

describe('C1 — §29 does not discount OBSERVED volume', () => {
  const returner = input({ current_weekly_km: 12, longest_recent_run_km: 6, training_age: '2-5yr' })
  it('the heuristic fires on the declaration and not on the measurement', () => {
    expect(isFreshReturn(returner)).toBe(true)
    expect(isFreshReturn({ ...returner, volume_observed: true })).toBe(false)
  })
  it('composed: a returner who RAN the door gets the race block; the same figure DECLARED is refused', () => {
    expect(() => generateRulePlan(returner, 'paid', START)).toThrow(BaseVolumeError)
    expect(() => generateRulePlan(checkpointRaceInput(returner, 12, 6), 'paid', START)).not.toThrow()
  })
  it('an edit to either volume field is a declaration again, so the flag goes', () => {
    const stored = checkpointRaceInput(returner, 12, 6)
    expect(declaredVolumeEdit(stored, { ...stored }).volume_observed).toBe(true)
    expect(declaredVolumeEdit(stored, { ...stored, current_weekly_km: 20 }).volume_observed).toBeUndefined()
    expect(declaredVolumeEdit(stored, { ...stored, longest_recent_run_km: 9 }).volume_observed).toBeUndefined()
  })
})

describe('C2 — the checkpoint long run is the one they recorded', () => {
  const plan = generateStagedRacePlan(input({ current_weekly_km: 6 }), START, 12)!
  const cp = stagedRaceOf(plan)!.checkpoint_week
  it('the longest single run across the base-build weeks, deloads included', () => {
    const loads = new Map(plan.weeks.map(w => [w.n, load(8, w.n === 4 ? 7.25 : 3)]))
    expect(observedLongestRunKm(plan, loads, cp)).toBe(7.2)
  })
  it('nothing recorded is null', () => {
    expect(observedLongestRunKm(plan, new Map(), cp)).toBeNull()
  })
})

describe('C3 — the checkpoint target: the race block begins as a step, never a leap', () => {
  // A real envelope case (2026-10-25): §111's door is 10 km, and the lowest target from which the race block is clean
  // is 19. From 10 it is not a clean start.
  // ⚠️ The envelope's input VERBATIM: a hand-copied subset of its fields staged differently (no target found), because
  // `fitness_level`, the heart rates and the acknowledgement flags all reach generation.
  const LEAP = { athlete_name: 'Envelope', age: 48, race_name: 'Target race', primary_metric: 'distance',
    race_distance_km: 42.2, race_date: '2027-05-31', plan_start: '2026-11-02', goal: 'time_target',
    fitness_level: 'beginner', training_age: '6-18mo', resting_hr: 55, max_hr: 185, current_weekly_km: 8,
    longest_recent_run_km: 4, days_available: 3, injury_history: [], hard_session_relationship: 'neutral',
    recent_quality_training: 'occasional', acknowledged_days_warning: true, acknowledged_prep_warning: true,
    target_time: '4:15:00' } as unknown as GeneratorInput
  const START_LEAP = '2026-11-02'
  const plan = generateStagedRacePlan(LEAP, START_LEAP, 10)!
  const s = stagedRaceOf(plan)!
  const raceFrom = (km: number) => {
    const cp = new Date(Date.parse(`${START_LEAP}T00:00:00Z`) + s.checkpoint_week * 7 * 864e5).toISOString().slice(0, 10)
    const ri = checkpointRaceInput(LEAP, km, longestSessionKm(plan.weeks))
    let race
    // ⚠️ §111's door at the CHECKPOINT can differ from the one named at signup (the race block is shorter by then),
    // so from the signup door the race block may be refused outright. Either way it is not a clean start.
    try { race = generateRulePlan(ri, 'paid', cp) } catch (e) { return `refused: ${(e as Error).name}` }
    return week1Leap(race.weeks.filter(w => w.n >= 1), ri, race.weeks.find(w => w.n === 1)?.weekly_km ?? 0)
  }
  it('the target sits above §111\'s door and is fixed on the plan from day one', () => {
    expect(s).toMatchObject({ min_base_km: 10, door_km: 19, target_found: true })
  })
  it('from the target the first race week is a step; from §111\'s signup door it was not a clean start', () => {
    expect(raceFrom(s.door_km)).toBeNull()
    expect(raceFrom(s.min_base_km)).not.toBeNull()
  })
  it('the checkpoint refuses below the target, and builds at it with the observed input', () => {
    const below = new Map(plan.weeks.map(w => [w.n, load(s.door_km - 1)]))
    const at = new Map(plan.weeks.map(w => [w.n, load(s.door_km, 5)]))
    const no = evaluateCheckpoint(LEAP, plan, below, 'km')
    expect(no.ok).toBe(false)
    if (!no.ok) expect(no.body.reason).toBe('checkpoint_not_reached')
    const yes = evaluateCheckpoint(LEAP, plan, at, 'km')
    expect(yes.ok).toBe(true)
    if (yes.ok && 'input' in yes) expect(yes.input).toMatchObject({ current_weekly_km: s.door_km, longest_recent_run_km: 5, volume_observed: true })
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
  it('flag ON, below the running floor: a staged plan that starts with the walk-run start (Phase D)', () => {
    process.env.ENABLE_BASE_BUILD_ONRAMP = '1'
    const out = run({ current_weekly_km: 5 })
    expect(out.kind).toBe('base_build')
    if (out.kind === 'base_build') expect(out.plan.weeks[0].phase).toBe('walk_run_start')
  })
})

// Typed so a test file edit cannot silently widen what a staged plan is.
export type _Plan = Plan

describe('C4 + Design Board amendment 7 — the checkpoint offers only what will build', () => {
  const BEG = input({ fitness_level: 'beginner' } as Partial<GeneratorInput>)
  const plan = generateStagedRacePlan(BEG, START, 12)!
  const s = stagedRaceOf(plan)!
  const cpStart = new Date(Date.parse(`${START}T00:00:00Z`) + s.checkpoint_week * 7 * 864e5).toISOString().slice(0, 10)
  const ran = (km: number) => new Map(plan.weeks.map(w => [w.n, load(km, km / 3)]))
  const kinds = (r: ReturnType<typeof evaluateCheckpoint>) => r.ok ? 'PASS' : ((r.body.options as { kind: string }[]) ?? []).map(o => o.kind)

  it('no runs: Apple Health first, then a later race; never a typed number, and not "Log a run" (dated today)', () => {
    expect(kinds(evaluateCheckpoint(BEG, plan, new Map(), 'km', cpStart))).toEqual(['connect_health', 'later_race'])
  })
  it('short of the target: more base building first, then the same-day half, a later race last, at most three (E1)', () => {
    const r = evaluateCheckpoint(BEG, plan, ran(s.door_km * 0.95), 'km', cpStart)
    expect(kinds(r)).toEqual(['extend', 'half', 'later_race'])
    if (!r.ok) expect((r.body.options as { weeks?: number }[])[0].weeks).toBeGreaterThan(0)
  })
  it('🔴 run-walk is offered only where §117 actually builds a run-walk plan (not to an intermediate runner)', () => {
    const INT = input({ fitness_level: 'intermediate', user_declared_level: 'intermediate' } as Partial<GeneratorInput>)
    const p = generateStagedRacePlan(INT, START, 12)!
    const st = stagedRaceOf(p)!
    const r = evaluateCheckpoint(INT, p, new Map(p.weeks.map(w => [w.n, load(st.door_km * 0.95, 4)])), 'km', cpStart)
    expect(kinds(r)).not.toContain('run_walk')
  })
  it('🔴 a clean race block that is NOT run-walk never earns the "Run-walk" label (measured no-fit case, 2026-10-25)', () => {
    const NF = input({ race_date: '2027-01-25', days_available: 4, current_weekly_km: 6, longest_recent_run_km: 4,
      fitness_level: 'beginner' } as Partial<GeneratorInput>)
    const p = generateStagedRacePlan(NF, '2026-11-02', 12)!
    const st = stagedRaceOf(p)!
    expect(st.target_found).toBe(false)
    const at = new Date(Date.parse('2026-11-02T00:00:00Z') + st.checkpoint_week * 7 * 864e5).toISOString().slice(0, 10)
    // The race block from what they ran IS clean here; it is simply not a run-walk plan (§117 does not apply).
    const raceIn = { ...checkpointRaceInput(NF, st.door_km, 6), goal: 'finish' } as GeneratorInput
    const dayBefore = new Date(Date.parse(`${at}T00:00:00Z`) - 864e5).toISOString().slice(0, 10)
    const race = generateRulePlan(raceIn, 'paid', at, undefined, dayBefore)
    expect((race.meta as unknown as Record<string, unknown>).finish_goal_run_walk).not.toBe(true)
    const r = evaluateCheckpoint(NF, p, new Map(p.weeks.map(w => [w.n, load(st.door_km, 6)])), 'km', at)
    expect(kinds(r)).not.toContain('run_walk')
  })
  it('🔴 "N more weeks" is offered only where that ramp still reaches the target before §44\'s block', () => {
    const SHORT = input({ fitness_level: 'beginner', race_date: '2027-02-21' } as Partial<GeneratorInput>)
    const p = generateStagedRacePlan(SHORT, START, 12)!
    const st = stagedRaceOf(p)!
    const at = new Date(Date.parse(`${START}T00:00:00Z`) + st.checkpoint_week * 7 * 864e5).toISOString().slice(0, 10)
    const r = evaluateCheckpoint(SHORT, p, new Map(p.weeks.map(w => [w.n, load(st.door_km * 0.95, 4)])), 'km', at)
    expect(kinds(r)).not.toContain('extend')
  })
  it('the extend choice returns more base building from what they RAN, toward the same target', () => {
    const r = evaluateCheckpoint(BEG, plan, ran(s.door_km * 0.95), 'km', cpStart, 'extend')
    expect(r.ok && 'plan' in r).toBe(true)
    if (r.ok && 'plan' in r) {
      const next = stagedRaceOf(r.plan)!
      expect(next.door_km).toBeGreaterThanOrEqual(s.door_km)
      expect(next.race_date).toBe(s.race_date)
      expect(Number((r.plan.meta as unknown as Record<string, unknown>).base_build_start_km)).toBeCloseTo(s.door_km * 0.95, 0)
      expect(validateStagedRace(r.plan)).toEqual([])
    }
  })
  it('the run-walk choice skips the target and asks the race block for a finish goal at what they ran', () => {
    const r = evaluateCheckpoint(BEG, plan, ran(s.door_km * 0.95), 'km', cpStart, 'run_walk')
    expect(r.ok && 'input' in r).toBe(true)
    if (r.ok && 'input' in r) expect(r.input).toMatchObject({ goal: 'finish', volume_observed: true })
  })
  it('a choice that is not on offer gives the screen again, never a plan', () => {
    const INT = input({ fitness_level: 'intermediate', user_declared_level: 'intermediate' } as Partial<GeneratorInput>)
    const p = generateStagedRacePlan(INT, START, 12)!
    const st = stagedRaceOf(p)!
    const r = evaluateCheckpoint(INT, p, new Map(p.weeks.map(w => [w.n, load(st.door_km * 0.95, 4)])), 'km', cpStart, 'run_walk')
    expect(r.ok).toBe(false)
  })
  it('the words are the approved ones, from the copy owner', () => {
    const r = evaluateCheckpoint(BEG, plan, ran(s.door_km * 0.95), 'km', cpStart)
    if (!r.ok) expect(r.body.error).toMatch(/^You ran .+ a week\. Marathon training needs about .+ to start safely\.$/)
  })
})
