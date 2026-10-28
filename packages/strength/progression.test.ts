import { describe, it, expect } from 'vitest'
import { suggestLoad, isLoadedLift, isNoStepSession, loadsInjury, type LiftLog, type LiftFeel } from './progression'
import { progressionViolations } from './validate'
import { STRENGTH_CONFIG as C } from './config'
import { CATALOGUE } from './catalogue'

/**
 * 🔴 STRENGTH-PROGRESSION-01 (S14, Coaching Board 2026-10-18) — load progresses from the runner's log, and never jumps.
 * The cases pin each clause of the rule; the sweep replays thousands of random histories and asserts
 * S-PROGRESSION-BOUNDED on every suggestion.
 */
const LOWER = 'goblet_squat', UPPER = 'dumbbell_bench_press', CALF = 'weighted_single_leg_heel_raise', BW = 'glute_bridge'
const day = (n: number) => new Date(Date.UTC(2026, 10, 2 + n)).toISOString().slice(0, 10)
const log = (n: number, load: number | null, feel: LiftFeel, ex = LOWER, counts = true): LiftLog => ({ date: day(n), exercise_id: ex, load_kg: load, feel, counts })
const go = (h: LiftLog[], ex = LOWER, opts: { noStep?: boolean; injuries?: never[] | string[] } = {}) =>
  suggestLoad(h, { exerciseId: ex, today: day(60), noStep: !!opts.noStep, injuries: (opts.injuries ?? []) as never })

describe('S14 — the rule, clause by clause', () => {
  it('no log: start light; bodyweight lifts get no load at all', () => {
    expect(go([]).kind).toBe('start')
    expect(go([log(0, null, 'easy', BW)], BW).kind).toBe('bodyweight')
    expect(isLoadedLift(LOWER)).toBe(true)
    expect(isLoadedLift(BW)).toBe(false)
  })
  it('easy steps up 2.5 kg on a lower lift; right once holds; right twice steps', () => {
    expect(go([log(0, 40, 'easy')])).toMatchObject({ kind: 'step', load_kg: 42.5 })
    expect(go([log(0, 40, 'right')])).toMatchObject({ kind: 'hold', load_kg: 40 })
    expect(go([log(0, 40, 'right'), log(7, 40, 'right')])).toMatchObject({ kind: 'step', load_kg: 42.5 })
    // Under 25 kg a 2.5 kg step is over a tenth, so reps come first (the 10% cap applies to lower lifts too).
    expect(go([log(0, 20, 'easy')])).toMatchObject({ kind: 'reps', load_kg: 20, extra_reps: 1 })
  })
  it('hard holds; hard twice at one load comes down a tenth', () => {
    expect(go([log(0, 30, 'hard')])).toMatchObject({ kind: 'hold', load_kg: 30 })
    expect(go([log(0, 30, 'hard'), log(7, 30, 'hard')])).toMatchObject({ kind: 'reduce', load_kg: 27 })
  })
  it('🔴 a step over a tenth of the load adds reps first (up to two), then the load (Sims)', () => {
    // upper step 1 kg on 8 kg is 12.5%
    expect(go([log(0, 8, 'easy', UPPER)], UPPER)).toMatchObject({ kind: 'reps', load_kg: 8, extra_reps: 1 })
    expect(go([log(0, 8, 'easy', UPPER), log(7, 8, 'easy', UPPER)], UPPER)).toMatchObject({ kind: 'reps', extra_reps: 2 })
    expect(go([log(0, 8, 'easy', UPPER), log(7, 8, 'easy', UPPER), log(14, 8, 'easy', UPPER)], UPPER)).toMatchObject({ kind: 'step', load_kg: 9, extra_reps: 0 })
  })
  it('🔴 at most one rise a week, including a rise the runner made themselves (Willy)', () => {
    // The rise to 42.5 counts from its first log (day 3): no second rise until a log a week after that.
    expect(go([log(0, 40, 'easy'), log(3, 42.5, 'easy')])).toMatchObject({ kind: 'hold', load_kg: 42.5 })
    expect(go([log(0, 40, 'easy'), log(3, 42.5, 'easy'), log(6, 42.5, 'easy')])).toMatchObject({ kind: 'hold', load_kg: 42.5 })
    expect(go([log(0, 40, 'easy'), log(3, 42.5, 'easy'), log(10, 42.5, 'easy')])).toMatchObject({ kind: 'step', load_kg: 45 })
  })
  it('🔴 an injury the lift loads makes easy count as right: two good sessions before a step', () => {
    expect(loadsInjury(CALF, ['achilles'])).toBe(true)
    expect(go([log(0, 40, 'easy', CALF)], CALF, { injuries: ['achilles'] }).kind).toBe('hold')
    expect(go([log(0, 40, 'easy', CALF), log(7, 40, 'easy', CALF)], CALF, { injuries: ['achilles'] }).kind).toBe('step')
    expect(go([log(0, 40, 'easy', CALF)], CALF).kind).toBe('step')                            // control: no injury, one easy steps
    expect(go([log(0, 40, 'easy')], LOWER, { injuries: ['achilles'] }).kind).toBe('step')   // a squat does not load the Achilles
  })
  it('🔴 a no-step session holds the load, and a log from one does not count (Hutchinson)', () => {
    expect(go([log(0, 20, 'easy')], LOWER, { noStep: true })).toMatchObject({ kind: 'hold_week', load_kg: 20, extra_reps: 0 })
    expect(go([log(0, 20, 'easy', LOWER, false)]).kind).toBe('start')
    expect(isNoStepSession('deload', false) && isNoStepSession('taper', false) && isNoStepSession('race_week', false) && isNoStepSession('build', true)).toBe(true)
    expect(isNoStepSession('build', false)).toBe(false)
  })
  it('only earlier days count: today\'s own log never moves today', () => {
    expect(suggestLoad([log(60, 20, 'easy')], { exerciseId: LOWER, today: day(60), noStep: false, injuries: [] }).kind).toBe('start')
  })
})

describe('S-PROGRESSION-BOUNDED over generated histories', () => {
  // Deterministic PRNG so a failure reproduces.
  let seed = 12345
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]
  const loaded = CATALOGUE.filter(e => isLoadedLift(e.id)).map(e => e.id)
  it('every suggestion, for 4,000 random histories across every loaded lift, stays bounded', () => {
    expect(loaded.length).toBeGreaterThan(15)
    const bad: unknown[] = []
    for (let n = 0; n < 4000; n++) {
      const ex = pick(loaded)
      const withReps = rnd() < 0.5
      const h: LiftLog[] = []
      let d = 0, load = pick([4, 6, 8, 10, 12, 16, 20, 24, 30, 40, 60])
      for (let k = Math.floor(rnd() * 8); k > 0; k--) {
        d += pick([2, 3, 4, 7, 7, 10])
        if (rnd() < 0.3) load = Math.max(2, load + pick([-2.5, -1, 1, 2, 2.5, 5]))
        // S14 Am.1 — half the histories carry the plan's reps (the general cycle's targets, or none, as before it).
        h.push({ date: day(d), exercise_id: ex, load_kg: load, feel: pick(['easy', 'right', 'hard'] as const), counts: rnd() > 0.15, ...(withReps ? { reps: pick(C.MAIN_REP_CYCLE_GENERAL) } : {}) })
      }
      const noStep = rnd() < 0.2
      const injuries = rnd() < 0.3 ? [pick(['achilles', 'knee', 'hip', 'shoulder', 'hamstring'] as const)] : []
      const reps = withReps ? pick(C.MAIN_REP_CYCLE_GENERAL) : undefined
      const s = suggestLoad(h, { exerciseId: ex, today: day(d + 3), noStep, injuries, reps, rir: 2 })
      const v = progressionViolations(h, ex, day(d + 3), noStep, s, reps)
      if (v.length) bad.push({ ex, h, noStep, s, v })
    }
    expect(bad.slice(0, 3)).toEqual([])
  })
})

describe('the invariant can fail', () => {
  const h = [log(0, 40, 'right')]
  it('two steps at once', () => expect(progressionViolations(h, LOWER, day(60), false, { kind: 'step', load_kg: 45.5, extra_reps: 0 }).length).toBeGreaterThan(0))
  it('up after hard', () => expect(progressionViolations([log(0, 40, 'hard')], LOWER, day(60), false, { kind: 'step', load_kg: 42.5, extra_reps: 0 }).some(v => v.detail === 'up after hard')).toBe(true))
  it('up in a no-step week', () => expect(progressionViolations(h, LOWER, day(60), true, { kind: 'step', load_kg: 42.5, extra_reps: 0 }).some(v => v.detail === 'up in a no-step session')).toBe(true))
  it('too many extra reps', () => expect(progressionViolations(h, LOWER, day(60), false, { kind: 'reps', load_kg: 40, extra_reps: C.REP_PROGRESSION_MAX + 1 }).some(v => v.detail.startsWith('extra reps'))).toBe(true))
  it('extra reps in a no-step week', () => expect(progressionViolations(h, LOWER, day(60), true, { kind: 'reps', load_kg: 40, extra_reps: 1 }).some(v => v.detail === 'extra reps in a no-step session')).toBe(true))
  it('two rises inside a week', () => expect(progressionViolations([log(0, 40, 'easy'), log(3, 42.5, 'easy')], LOWER, day(5), false, { kind: 'step', load_kg: 45, extra_reps: 0 }).some(v => v.detail.startsWith('two rises'))).toBe(true))
})

// STRENGTH-BW-LOG-01 (Design Board 2026-10-28): the founder logged 90 kg on an inverted row, because its kit
// (a barbell in a rack, used as the bar) read as load. A bodyweight lift logs the feel only (S14).
describe('STRENGTH-BW-LOG-01 — a bar that anchors the body is not a load', () => {
  it('the inverted row and its bodyweight family take no weight; a barbell lift still does', () => {
    expect(isLoadedLift('inverted_row')).toBe(false)
    expect(isLoadedLift('table_row')).toBe(false)
    expect(isLoadedLift('pull_up')).toBe(false)
    expect(isLoadedLift('barbell_bench_press')).toBe(true)
    expect(isLoadedLift('back_squat')).toBe(true)
    // An old weighted log on it never turns into a weight suggestion.
    const s = suggestLoad([{ exercise_id: 'inverted_row', date: '2026-10-26', load_kg: 90, feel: 'easy', counts: true } as never],
      { exerciseId: 'inverted_row', today: '2026-11-04', noStep: false, injuries: [] })
    expect(s.kind).toBe('bodyweight')
    expect(s.load_kg).toBeNull()
  })
})

describe('STRENGTH-BW-LOG-01 — one owner for "loaded"', () => {
  it('selection reads the same answer as logging, for every catalogue lift', async () => {
    const { isLoaded } = await import('./select')
    for (const ex of CATALOGUE) if (ex.measure === 'reps') expect(isLoaded(ex), ex.id).toBe(isLoadedLift(ex.id))
  })
  it('no second copy of the load-kit list exists in the engine', () => {
    const { readFileSync, readdirSync } = require('node:fs') as typeof import('node:fs')
    const { join } = require('node:path') as typeof import('node:path')
    const dir = __dirname
    const copies = readdirSync(dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'catalogue.ts')
      .filter(f => /\['dumbbells',\s*'kettlebell',\s*'barbell'/.test(readFileSync(join(dir, f), 'utf8')))
    expect(copies).toEqual([])
  })
})


describe('S14 Am.1 (STRENGTH-REP-BLOCKS-01) — more reps than last time brings the load down', () => {
  const at = (h: LiftLog[], reps: number, noStep = false) =>
    suggestLoad(h, { exerciseId: LOWER, today: day(60), noStep, injuries: [], reps, rir: 2 })
  const six = (n: number, load: number, feel: LiftFeel = 'right'): LiftLog => ({ ...log(n, load, feel), reps: 6 })
  it('6 to 10 reps at RIR 2: Epley at reps-to-failure, about a tenth lighter, rounded down', () => {
    // (1 + 8/30) / (1 + 12/30) = 0.905; 60 × 0.905 = 54.3 → 54
    expect(at([six(0, 60)], 10)).toMatchObject({ kind: 'more_reps', load_kg: 54, extra_reps: 0 })
  })
  it('the cut holds in a no-step week too: a hold there would keep the 6-rep weight', () => {
    expect(at([six(0, 60)], 10, true)).toMatchObject({ load_kg: 54 })
  })
  it('🔴 equal or fewer reps: S14 unchanged, and the formula never raises the load', () => {
    const bare = ({ last: _, ...x }: ReturnType<typeof go>) => x
    expect(bare(at([six(0, 60)], 6))).toEqual(bare(go([log(0, 60, 'right')])))
    expect(bare(at([six(0, 60, 'easy')], 5))).toEqual(bare(go([log(0, 60, 'easy')])))
  })
  it('a log with no known reps (logged before the cycle) is read as S14 always read it', () => {
    expect(at([log(0, 60, 'right')], 10)).toEqual(go([log(0, 60, 'right')]))
  })
  it('🔴 a "hard twice" reduction is kept: the cut starts from the reduced load (code review)', () => {
    // 60 hard, 60 hard → S14 says 54; Epley on 54 → 48.5 (54 × 0.905 = 48.9, rounded down)
    expect(at([six(0, 60, 'hard'), six(7, 60, 'hard')], 10).load_kg).toBe(48.5)
  })
  it('a light lift never rounds to nothing, and the check accepts the floor', () => {
    expect(progressionViolations([{ ...log(0, 0.5, 'right'), reps: 6 }], LOWER, day(60), false, at([{ ...log(0, 0.5, 'right'), reps: 6 }], 10), 10)).toEqual([])
    expect(at([{ ...log(0, 0.5, 'right'), reps: 6 }], 10).load_kg).toBe(C.LOAD_ROUND_KG)
  })
  it('🔴 the check: a carried load when the reps rose is a violation', () => {
    const v = progressionViolations([six(0, 60)], LOWER, day(60), false, { kind: 'hold', load_kg: 60, extra_reps: 0 }, 10)
    expect(v.some(x => x.detail === 'not lighter when the reps rose')).toBe(true)
    expect(progressionViolations([six(0, 60)], LOWER, day(60), false, at([six(0, 60)], 10), 10)).toEqual([])
  })
})
