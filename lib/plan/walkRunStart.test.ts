// NO-RUNNER-TURNED-AWAY-01 Phase D — the walk-run start (§116 floor note amended; Coaching Board 2026-10-25, L1–L5).
import { describe, it, expect, afterEach } from 'vitest'
import { walkRunLadder, walkRunSchedule, walkRunDays, walkRunStartWeeks } from './walkRunStart'
import { generateStagedRacePlan, stagedRaceOf } from './stagedRacePlan'
import { validateStagedRace, validateWalkRunStart, validateBaseBuildBlock } from './baseBuildValidate'
import { validateStoredPlan } from './validateStoredPlan'
import { runEngine } from './engine'
import { composeSession } from './sessionComposer'
import { runWalkSet } from './runWalkPlan'
import type { GeneratorInput, Plan, Session, Week } from '@/types/plan'

const START = '2026-10-26'
const raceIn = (weeks: number) => new Date(Date.parse(`${START}T00:00:00Z`) + weeks * 7 * 864e5).toISOString().slice(0, 10)
const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.2, race_date: raceIn(26), race_name: 'London Marathon', days_available: 4, goal: 'finish',
  current_weekly_km: 0, longest_recent_run_km: 0, age: 30, injuries: [], fitness_level: 'beginner',
  training_age: '<6mo', user_declared_level: 'beginner', recent_quality_training: 'none', ...over,
} as unknown as GeneratorInput)
const runs = (w: Week) => Object.values(w.sessions ?? {}).filter(s => s && s.type !== 'rest') as Session[]
const codes = (p: Plan) => validateStagedRace(p).filter(v => v.code === 'INV-PLAN-WALKRUN-START-PROGRESSION')

describe('L1 — the ladder and its schedule', () => {
  it('1/2, 2/2 … 5/2, then §117\'s 6/1: the walk shortens once, last', () => {
    expect(walkRunLadder().map(l => `${l.run_mins}/${l.walk_mins}`)).toEqual(['1/2', '2/2', '3/2', '4/2', '5/2', '6/1'])
  })
  it('one level a week, week 4 a deload holding week 3\'s level, ending on 6/1', () => {
    expect(walkRunSchedule()).toEqual([
      { level: 0, deload: false }, { level: 1, deload: false }, { level: 2, deload: false }, { level: 2, deload: true },
      { level: 3, deload: false }, { level: 4, deload: false }, { level: 5, deload: false },
    ])
    expect(walkRunStartWeeks()).toBe(7)
  })
})

describe('L3 — three days, never two in a row where the days allow', () => {
  it('defaults to Tue, Thu, Sat; Sun when that is the long-run day', () => {
    expect(walkRunDays({})).toEqual(['tue', 'thu', 'sat'])
    expect(walkRunDays({ preferred_long_run_day: 'sun' })).toEqual(['tue', 'thu', 'sun'])
  })
  it('around blocked days, still no two in a row', () => {
    const d = walkRunDays({ days_cannot_train: ['tue', 'thu'] } as never)
    expect(d).toHaveLength(3)
    const idx = d.map(x => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(x))
    for (let i = 0; i < idx.length; i++) for (let j = i + 1; j < idx.length; j++) expect([1, 6]).not.toContain(Math.abs(idx[i] - idx[j]))
  })
  it('a 30-minute session is a 5-minute walk and 25 minutes of repeats, no cool-down', () => {
    const p = generateStagedRacePlan(input(), START, 12)!
    const s = runs(p.weeks[0])[0]
    const c = composeSession({ session: s })!
    expect([c.warmup.duration_mins, c.main.duration_mins, c.cooldown.duration_mins]).toEqual([5, 25, 0])
  })
  it('the steps never run longer than the level: 5/2 over 25 min is 3 rounds, then run 4 (not 7)', () => {
    const set = runWalkSet(25, null, { run_mins: 5, walk_mins: 2 })!
    expect(set.blocks[0].repeat).toBe(3)
    expect(set.blocks[1].steps.map(st => st.length)).toEqual(['4 min'])
    const one = runWalkSet(25, null, { run_mins: 1, walk_mins: 2 })!
    expect(one.blocks[1].steps.map(st => `${st.modality} ${st.length}`)).toEqual(['run 1 min'])
  })
  it('§117\'s own 6/1 drawing is unchanged by the remainder rule', () => {
    const set = runWalkSet(40, null)!
    expect(set.blocks[0].repeat).toBe(5)
    expect(set.blocks[1].steps).toHaveLength(1)
    expect(set.blocks[1].steps[0].length).toBe('5 min')
  })
})

describe('L4 + L5 — placement and the handover to running', () => {
  const p = generateStagedRacePlan(input(), START, 12)!
  const s = stagedRaceOf(p)!
  it('a 0 km/week marathoner 26 weeks out: seven walk-run weeks, then the ramp, ending at the checkpoint', () => {
    expect(p.weeks.slice(0, 7).every(w => w.phase === 'walk_run_start')).toBe(true)
    expect(p.weeks.slice(7).every(w => w.phase === 'base_build')).toBe(true)
    expect(p.weeks.length).toBe(s.checkpoint_week)
    expect(s.race_weeks + s.checkpoint_week).toBe(26)
    expect(s.race_name).toBe('London Marathon')
  })
  it('the ramp starts at 6 km and every running session keeps the 6/1 pattern (L5)', () => {
    expect((p.meta as unknown as Record<string, unknown>).base_build_start_km).toBe(6)
    for (const w of p.weeks.filter(x => x.phase === 'base_build')) for (const r of runs(w)) expect(r.run_walk_strategy).toMatch(/^Run 6 minutes, walk 1\./)
  })
  it('passes every validator: staged, walk-run, base-build block, stored-plan', () => {
    expect(validateStagedRace(p)).toEqual([])
    expect(validateBaseBuildBlock(p.weeks, 6).filter(v => v.severity === 'error')).toEqual([])
    expect(validateStoredPlan(p).filter(v => v.severity === 'error')).toEqual([])
  })
  it('a short runway keeps the whole walk-run start and cuts the ramp; shorter still, the walk-run start alone', () => {
    const short = generateStagedRacePlan(input({ race_date: raceIn(18) }), START, 12)!
    expect(short.weeks.filter(w => w.phase === 'walk_run_start')).toHaveLength(7)
    expect(stagedRaceOf(short)!.reaches_door).toBe(false)
    const alone = generateStagedRacePlan(input({ race_date: raceIn(14) }), START, 12)!
    expect(alone.weeks.map(w => w.phase)).toEqual(Array(7).fill('walk_run_start'))
    expect(validateStagedRace(alone)).toEqual([])
  })
  it('a race inside the walk-run start is not staged (§44 answers it)', () => {
    expect(generateStagedRacePlan(input({ race_date: raceIn(7) }), START, 12)).toBeNull()
  })
})

describe('the engine — a runner §113 refuses below the running floor is staged, behind the flag', () => {
  afterEach(() => { delete process.env.ENABLE_BASE_BUILD_ONRAMP })
  const run = (over: Partial<GeneratorInput> = {}) => runEngine({ input: input(over), tier: 'paid', displayUnits: 'km', planStart: START, today: '2026-10-25' })
  it('flag OFF: the 0 km/week runner is refused exactly as before', () => {
    expect(run().kind).toBe('refusal')
  })
  it('flag ON: they get the walk-run start with their race on it, and are countable', () => {
    process.env.ENABLE_BASE_BUILD_ONRAMP = '1'
    const out = run()
    expect(out.kind).toBe('base_build')
    if (out.kind !== 'base_build') return
    expect(out.plan.weeks[0].phase).toBe('walk_run_start')
    expect(stagedRaceOf(out.plan)!.race_name).toBe('London Marathon')
    expect(out.telemetry?.event).toBe('plan_staged_for_race')
  })
  it('a runner at or above 6 km/week with a short long run is NOT walk-run staged (§113 stands for them)', () => {
    process.env.ENABLE_BASE_BUILD_ONRAMP = '1'
    const out = run({ current_weekly_km: 10, longest_recent_run_km: 2 })
    expect(out.kind === 'base_build' && out.plan.weeks[0].phase === 'walk_run_start').toBe(false)
  })
})

describe('INV-PLAN-WALKRUN-START-PROGRESSION — each arm fires on its own', () => {
  const base = generateStagedRacePlan(input(), START, 12)!
  const mut = (f: (p: Plan) => void) => { const p = JSON.parse(JSON.stringify(base)) as Plan; f(p); return codes(p) }
  const setLevel = (w: Week, run: number, walk: number) => { for (const s of runs(w)) s.walk_run_level = { run_mins: run, walk_mins: walk } }
  it('clean on the generated plan', () => expect(codes(base)).toEqual([]))
  it('starts above 1/2', () => expect(mut(p => setLevel(p.weeks[0], 2, 2))).not.toEqual([]))
  it('skips a level', () => expect(mut(p => setLevel(p.weeks[1], 3, 2))).not.toEqual([]))
  it('steps down', () => expect(mut(p => setLevel(p.weeks[2], 1, 2))).not.toEqual([]))
  it('a deload that does not hold', () => expect(mut(p => setLevel(p.weeks[3], 4, 2))).not.toEqual([]))
  it('drops the walk early', () => expect(mut(p => setLevel(p.weeks[4], 4, 1))).not.toEqual([]))
  it('ends below 6/1', () => expect(mut(p => { p.weeks.splice(6, p.weeks.length) })).not.toEqual([]))
  it('a session short of thirty minutes', () => expect(mut(p => { runs(p.weeks[0])[0].duration_mins = 20 })).not.toEqual([]))
  it('a missing session', () => expect(mut(p => { delete (p.weeks[0].sessions as Record<string, unknown>)[Object.keys(p.weeks[0].sessions)[0]] })).not.toEqual([]))
  it('a ramp week without the run-walk pattern (L5)', () => expect(mut(p => { for (const r of runs(p.weeks[8])) delete r.run_walk_strategy })).not.toEqual([]))
  it('a running week before the walk-run start ends', () => expect(mut(p => { p.weeks[2].phase = 'base_build' })).not.toEqual([]))
  it('reads the plan, not the schedule: a plan with no walk-run weeks is not its business', () => {
    expect(validateWalkRunStart({ ...base, weeks: base.weeks.filter(w => w.phase === 'base_build') })).toEqual([])
  })
})

import { evaluateCheckpoint } from './engine'
import { planArcSeries } from './weekVolume'
import { phaseDisplayLabel } from '@/lib/coaching/weekVoice'
import { readFileSync } from 'node:fs'
import type { WeeklyLoad } from '@/lib/coaching/weeklyActualLoad'

describe('the checkpoint on a walk-run plan', () => {
  const p = generateStagedRacePlan(input(), START, 12)!
  const s = stagedRaceOf(p)!
  const cp = new Date(Date.parse(`${START}T00:00:00Z`) + s.checkpoint_week * 7 * 864e5).toISOString().slice(0, 10)
  const ran = (km: number): Map<number, WeeklyLoad> => new Map(p.weeks.map(w => [w.n, { linkedKm: km, offPlanKm: 0, totalKm: km, longestKm: km / 3 }]))
  it('is asked like any staged plan: at the target it passes', () => {
    expect(evaluateCheckpoint(input(), p, ran(s.door_km), 'km', cp).ok).toBe(s.target_found)
  })
  it('🔴 below the running floor, "more base building" is withheld, never a restart at 1/2', () => {
    // 46 weeks out: without the guard this offered "17 more weeks of base building", a second walk-run start (measured).
    const far = input({ race_date: raceIn(46) })
    const fp = generateStagedRacePlan(far, START, 12)!
    const fcp = new Date(Date.parse(`${START}T00:00:00Z`) + stagedRaceOf(fp)!.checkpoint_week * 7 * 864e5).toISOString().slice(0, 10)
    const r = evaluateCheckpoint(far, fp, new Map(fp.weeks.map(w => [w.n, { linkedKm: 4, offPlanKm: 0, totalKm: 4, longestKm: 1.5 }])), 'km', fcp)
    expect(r.ok).toBe(false)
    if (!r.ok) expect((r.body.options as { kind: string }[]).map(o => o.kind)).not.toContain('extend')
  })
})

describe('on screen', () => {
  const p = generateStagedRacePlan(input(), START, 12)!
  it('the phase reads "Walk-run start"', () => expect(phaseDisplayLabel('walk_run_start')).toBe('Walk-run start'))
  it('the arc draws a stub for each walk-run week, never NaN, and real volume after', () => {
    const { km } = planArcSeries(p.weeks as never)
    expect(km.slice(0, 7)).toEqual(Array(7).fill(0))
    expect(km.every(k => Number.isFinite(k))).toBe(true)
    expect(km[7]).toBeGreaterThan(0)
  })
  it('the preview card never says "peak 0 km", and is titled from the copy owner', () => {
    const src = readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8')
    expect(src).toContain("{weekRange}{peakKm > 0 ? ` · peak ${formatDistance(peakKm, units)}` : ''}")
    expect(src).toContain("phase === 'walk_run_start' ? WALK_RUN_START_TITLE")
    expect(src).toMatch(/const PHASES = \['walk_run_start', 'base_build'/)
  })
})
