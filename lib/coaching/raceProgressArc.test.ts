import { describe, it, expect } from 'vitest'
import { buildRaceProgressArc, RACE_ARC } from './raceProgressArc'

const M = 60

describe('buildRaceProgressArc — the three points', () => {
  it('builds was → now → goal in chronological order', () => {
    const arc = buildRaceProgressArc({
      baselineSeconds: 3 * 3600 + 53 * M,
      currentSeconds:  3 * 3600 + 48 * M,
      goalSeconds:     3 * 3600 + 45 * M,
    })!
    expect(arc.points.map(p => p.key)).toEqual(['was', 'now', 'goal'])
  })

  it('RETURNS NULL without a present — an arc of memories is not progress', () => {
    expect(buildRaceProgressArc({
      baselineSeconds: 1400, currentSeconds: null, goalSeconds: 1200,
    })).toBeNull()
  })

  it('drops the baseline and keeps the rest — week one still sees now and the goal', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: null, currentSeconds: 1500, goalSeconds: 1400 })!
    expect(arc.points.map(p => p.key)).toEqual(['now', 'goal'])
    expect(arc.deltaSeconds).toBeNull()
    expect(arc.direction).toBeNull()
  })

  it('drops the goal — a finish-goal runner still sees where they were and are', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: 1600, currentSeconds: 1500, goalSeconds: null })!
    expect(arc.points.map(p => p.key)).toEqual(['was', 'now'])
    expect(arc.secondsToGoal).toBeNull()
    expect(arc.goalReached).toBeNull()
  })

  it('a lone present is still an arc — one point, no claims', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: null, currentSeconds: 1500, goalSeconds: null })!
    expect(arc.points).toEqual([{ key: 'now', seconds: 1500 }])
  })
})

describe('buildRaceProgressArc — direction is signed, never absolute', () => {
  it('faster when now is below baseline', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: 1500, currentSeconds: 1400, goalSeconds: null })!
    expect(arc.direction).toBe('faster')
    expect(arc.deltaSeconds).toBe(-100)
  })

  it('SLOWER when now is above baseline — going backwards must not read as progress', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: 1400, currentSeconds: 1500, goalSeconds: null })!
    expect(arc.direction).toBe('slower')
    expect(arc.deltaSeconds).toBe(100)
  })

  it('level inside the significance floor, in BOTH directions', () => {
    const under = RACE_ARC.SIGNIFICANT_DELTA_SEC - 1
    expect(buildRaceProgressArc({ baselineSeconds: 1500, currentSeconds: 1500 + under, goalSeconds: null })!.direction).toBe('level')
    expect(buildRaceProgressArc({ baselineSeconds: 1500, currentSeconds: 1500 - under, goalSeconds: null })!.direction).toBe('level')
  })

  it('calls a direction exactly AT the floor', () => {
    const at = RACE_ARC.SIGNIFICANT_DELTA_SEC
    expect(buildRaceProgressArc({ baselineSeconds: 1500, currentSeconds: 1500 - at, goalSeconds: null })!.direction).toBe('faster')
  })
})

describe('buildRaceProgressArc — the goal gap', () => {
  it('reports the seconds still to find', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: null, currentSeconds: 1500, goalSeconds: 1400 })!
    expect(arc.secondsToGoal).toBe(100)
    expect(arc.goalReached).toBe(false)
  })

  it('CLAMPS AT ZERO once the goal is beaten — never "-3m to go"', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: null, currentSeconds: 1300, goalSeconds: 1400 })!
    expect(arc.secondsToGoal).toBe(0)
    expect(arc.goalReached).toBe(true)
  })

  it('treats landing exactly on the goal as reached', () => {
    const arc = buildRaceProgressArc({ baselineSeconds: null, currentSeconds: 1400, goalSeconds: 1400 })!
    expect(arc.goalReached).toBe(true)
  })
})

describe('buildRaceProgressArc — nonsense is absent, never zero', () => {
  // The `distance_km ?? 0` family: an unknown must never render as a real value.
  it.each([0, -1, NaN, Infinity])('ignores a baseline of %p rather than plotting it', (bad) => {
    const arc = buildRaceProgressArc({ baselineSeconds: bad, currentSeconds: 1500, goalSeconds: null })!
    expect(arc.points.map(p => p.key)).toEqual(['now'])
  })

  it.each([0, -1, NaN])('ignores a goal of %p', (bad) => {
    const arc = buildRaceProgressArc({ baselineSeconds: null, currentSeconds: 1500, goalSeconds: bad })!
    expect(arc.points.map(p => p.key)).toEqual(['now'])
  })

  it('a current of 0 yields no arc at all', () => {
    expect(buildRaceProgressArc({ baselineSeconds: 1500, currentSeconds: 0, goalSeconds: 1400 })).toBeNull()
  })
})
