import { describe, it, expect } from 'vitest'
import { buildStepGroups, parseLength, roleLabelForStep, targetClause } from './sessionSteps'
import type { DerivedSet } from './resolveMainSet'

const fmt = (km: number) => `${Number(km.toFixed(2))} km`

describe('parseLength', () => {
  it('parses durations, distances, and text', () => {
    expect(parseLength('5 min')).toEqual({ kind: 'duration', secs: 300 })
    expect(parseLength('1:30')).toEqual({ kind: 'duration', secs: 90 })
    expect(parseLength('45s')).toEqual({ kind: 'duration', secs: 45 })
    expect(parseLength('400 m')).toEqual({ kind: 'distance', km: 0.4 })
    expect(parseLength('5 km')).toEqual({ kind: 'distance', km: 5 })
    expect(parseLength('until ready')).toEqual({ kind: 'text', text: 'until ready' })
  })
  it('resolves a mirror to the length it mirrors', () => {
    expect(parseLength('same as the 1:30')).toEqual({ kind: 'duration', secs: 90 })
  })
})

describe('targetClause', () => {
  it('marks a ceiling pace with ≤', () => {
    expect(targetClause({ role: 'recovery', modality: 'jog', length: '1:30', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' }))
      .toBe('≤ 5:53–7:02 /km')
  })
  it('uses RPE when effort-governed', () => {
    expect(targetClause({ role: 'work', modality: 'run', length: '1:30', pace: null, rpe: 8, advance: 'auto' })).toBe('RPE 8')
  })
})

describe('buildStepGroups — VO2 rep set, distance toggle', () => {
  const set: DerivedSet = {
    version: 2,
    blocks: [{
      repeat: 6,
      steps: [
        { role: 'work', modality: 'run', length: '3 min', pace: '4:30–4:42 /km', pace_mode: 'target', advance: 'auto' },
        { role: 'recovery', modality: 'jog', length: '2 min', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ],
    }],
  }
  const groups = buildStepGroups(set, { metric: 'distance', formatDist: fmt })

  it('is one repeat block of 6 with two rows', () => {
    expect(groups).toHaveLength(1)
    expect(groups[0].repeat).toBe(6)
    expect(groups[0].repeatLabel).toBe('rounds of')
    expect(groups[0].rows).toHaveLength(2)
  })
  it('leads with an estimated distance and keeps time + pace in the detail', () => {
    const work = groups[0].rows[0]
    expect(work.role).toBe('Hard')
    expect(work.amountIsEstimate).toBe(true)
    expect(work.amount).toMatch(/^~/)          // pace-derived estimate
    expect(work.detail).toBe('3 min · 4:30–4:42 /km')
  })
  it('marks the recovery jog as rest with a pace ceiling', () => {
    const rest = groups[0].rows[1]
    expect(rest.kind).toBe('rest')
    expect(rest.role).toBe('Jog')
    expect(rest.detail).toBe('2 min · ≤ 5:53–7:02 /km')
  })
})

describe('buildStepGroups — hill reps (effort-based, mixed lengths)', () => {
  const set: DerivedSet = {
    version: 2,
    blocks: [
      { repeat: 1, steps: [
        { role: 'transition', modality: 'run', length: 'to the bottom of the hill', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ]},
      { repeat: 8, steps: [
        { role: 'work', modality: 'run', terrain: 'uphill', length: '1:30', pace: null, rpe: 8, advance: 'auto' },
        { role: 'recovery', modality: 'stand', length: 'until ready', pace: null, advance: 'auto' },
        { role: 'recovery', modality: 'jog', terrain: 'downhill', length: 'same as the 1:30', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ]},
    ],
  }
  const groups = buildStepGroups(set, { metric: 'distance', formatDist: fmt })

  it('keeps the lead-in as a one-off "Run to base"', () => {
    expect(groups[0].repeat).toBe(1)
    expect(groups[0].rows[0].role).toBe('Run to base')
  })
  it('labels the repeat block as hill reps', () => {
    expect(groups[1].repeat).toBe(8)
    expect(groups[1].repeatLabel).toBe('hill reps')
  })
  it('keeps the uphill effort-based: time primary, RPE detail (no invented distance)', () => {
    const up = groups[1].rows[0]
    expect(up.role).toBe('Uphill')
    expect(up.amount).toBe('1:30')
    expect(up.amountIsEstimate).toBe(false)
    expect(up.detail).toBe('RPE 8')
  })
  it('renders the stand and the downhill jog legibly', () => {
    expect(groups[1].rows[1].role).toBe('Stand')
    expect(groups[1].rows[1].amount).toBe('until ready')
    expect(groups[1].rows[2].role).toBe('Jog down')       // downhill jog
    expect(groups[1].rows[2].amountIsEstimate).toBe(true) // mirror → 1:30, estimated from pace
    expect(groups[1].rows[2].detail).toBe('1:30 · ≤ 5:53–7:02 /km')
  })
})

describe('buildStepGroups — duration toggle keeps time primary', () => {
  const set: DerivedSet = {
    version: 2,
    blocks: [{ repeat: 4, steps: [
      { role: 'work', modality: 'run', length: '5 min', pace: '4:25–4:35 /km', pace_mode: 'target', advance: 'auto' },
    ]}],
  }
  it('shows the duration as the amount when the toggle is on time', () => {
    const groups = buildStepGroups(set, { metric: 'duration', formatDist: fmt })
    expect(groups[0].rows[0].amount).toBe('5 min')
    expect(groups[0].rows[0].amountIsEstimate).toBe(false)
    expect(groups[0].rows[0].detail).toBe('4:25–4:35 /km')
  })
})
