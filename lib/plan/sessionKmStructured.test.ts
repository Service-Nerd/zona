// SESSION-KM-STRUCTURED-PACE-01 — a duration-anchored session with a structured main set is sized from its steps, not
// by converting the whole duration at the headline (work) pace. Measured on 5,664 cohort plans: 6,407 such quality
// sessions read a median 41% (max 65%) long, and no other session's distance moves under the fix.
import { describe, it, expect } from 'vitest'
import { sessionKmSelfPaced, weekEasyMinPerKm } from './sessionDistance'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'

// beginner_goal_pace_reps as generated: 34 min, 4 × (2 min at 5:00 /km + 2 min jog at 7:30–9:00 /km).
const REPS = {
  type: 'quality', distance_km: null, duration_mins: 34, pace_target: '4:54–5:06 /km',
  derived_set: { version: 2, blocks: [{ repeat: 4, steps: [
    { role: 'work', modality: 'run', length: '2 min', pace: '5:00 /km', pace_mode: 'target', advance: 'auto' },
    { role: 'recovery', modality: 'jog', length: '2 min', pace: '7:30–9:00 /km', pace_mode: 'ceiling', advance: 'auto' },
  ] }] },
} as any
// tempo_continuous: one work step, no jog, so no easy pace of its own.
const TEMPO = {
  type: 'quality', distance_km: null, duration_mins: 38, pace_target: '6:30–7:30 /km',
  derived_set: { version: 2, blocks: [{ repeat: 1, steps: [
    { role: 'work', modality: 'run', length: '19 min', pace: '6:30–7:30 /km', pace_mode: 'target', advance: 'auto' },
  ] }] },
} as any

describe('sizing from the steps', () => {
  it('reps: work at work pace, jogs and warm-up at the jog pace (was 34 / 5.0 = 6.8 km)', () => {
    // 4 × (2/5.0 + 2/8.25) = 2.570 km in 16 min; 18 min left at 8.25 → 2.182 km.
    expect(sessionKmSelfPaced(REPS)).toBeCloseTo(4.752, 2)
  })
  it('a continuous tempo with no easy pace keeps the old answer; given the week\'s easy pace it is sized', () => {
    expect(sessionKmSelfPaced(TEMPO)).toBeCloseTo(38 / 7, 2)
    // 19 min at 7.0 + 19 min at 8.0
    expect(sessionKmSelfPaced(TEMPO, 8)).toBeCloseTo(19 / 7 + 19 / 8, 2)
  })
  it('a step that is not a size keeps the old answer', () => {
    const hill = { ...REPS, derived_set: { version: 2, blocks: [{ repeat: 6, steps: [{ ...REPS.derived_set.blocks[0].steps[0], length: 'to the top of the hill' }] }] } }
    expect(sessionKmSelfPaced(hill)).toBeCloseTo(34 / 5, 2)
  })
  it('distance-anchored and unstructured sessions are untouched', () => {
    expect(sessionKmSelfPaced({ ...REPS, distance_km: 6 })).toBe(6)
    expect(sessionKmSelfPaced({ type: 'easy', distance_km: null, duration_mins: 40, pace_target: '7:30–8:30 /km' } as any)).toBeCloseTo(5, 2)
  })
  it('weekEasyMinPerKm reads the week\'s easy run, never a structured one', () => {
    expect(weekEasyMinPerKm([REPS, { type: 'easy', pace_target: '7:30–8:30 /km' }])).toBeCloseTo(8, 5)
    expect(weekEasyMinPerKm([REPS])).toBeNull()
  })
})

describe('generated plans — every mispriced session moves, inside its bounds, and nothing else moves', () => {
  const grid = cohortGrid()
  let target = 0, moved = 0, outOfBounds = 0, otherMoved = 0
  for (let i = 0; i < grid.length; i += 41) {
    let plan: any
    try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START) } catch { continue }
    for (const w of plan.weeks) {
      const list = Object.values(w.sessions).flat() as any[]
      const easy = weekEasyMinPerKm(list)
      for (const s of list) {
        if (!s) continue
        const old = s.distance_km ?? (s.pace_target ? sessionKmSelfPaced({ ...s, derived_set: undefined }) : null)
        const now = sessionKmSelfPaced(s, easy)
        const isTarget = s.distance_km == null && s.duration_mins && s.type === 'quality' && s.derived_set
        if (!isTarget) { if (now !== old) otherMoved++; continue }
        target++
        if (now !== old) moved++
        if (easy && now != null && (now < s.duration_mins / easy - 0.05 || now > (old as number) + 0.05)) outOfBounds++
      }
    }
  }
  it('reaches the population (an empty sample passes everything)', () => expect(target).toBeGreaterThan(100))
  it('all of them are re-sized, between easy-pace and headline-pace pricing', () => {
    expect(moved).toBe(target)
    expect(outOfBounds).toBe(0)
  })
  it('no other session moves', () => expect(otherMoved).toBe(0))
})
