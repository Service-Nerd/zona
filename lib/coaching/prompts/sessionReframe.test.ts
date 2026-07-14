import { describe, it, expect } from 'vitest'
import { buildSessionReframePrompt, type SessionReframePromptInput } from './sessionReframe'
import type { PaceFadeSummary } from '../paceAnalysis'

const plan = {
  meta: { race_name: 'Ultra 100', race_distance_km: 100, race_date: '2026-07-11' },
  weeks: [{}, {}, {}],
} as any

const paceFade: PaceFadeSummary = {
  firstHalfAvgPaceSecPerKm: 330,
  backHalfAvgPaceSecPerKm:  400,
  paceFadeSecPerKm:         70,
  paceFadePct:              0.21,
  splitsUsed:               20,
  sparse:                   false,
}

const base: SessionReframePromptInput = {
  userNote: 'Gutted. Fell apart in the back third and finished way down on plan.',
  tier: 'A',
  session: { type: 'race', label: '100km race', distance_km: 100 } as any,
  weekN: 20,
  plan,
  rpe: 9,
  fatigueTag: 'Wrecked',
  actualDistKm: 100,
  actualAvgHr: 138,
  hrInZonePct: 40,
  hrAboveCeilingPct: 20,
  hrBelowFloorPct: 5,
  paceFadeSummary: paceFade,
  tempC: 29,
  limiter: null,
}

describe('buildSessionReframePrompt — race override (§71 / RACE-DEBRIEF-02)', () => {
  it('overrides the cause for a race: no pace-fade block, reflects the account, un-gated temp', () => {
    const prompt = buildSessionReframePrompt({
      ...base,
      raceResult: { outcome: 'off_target', what_broke: 'injured at 60k', notes: 'too hot early, backed off' },
    })
    expect(prompt).toMatch(/RACE OVERRIDE/)
    expect(prompt).not.toMatch(/Pace fade across the run/)
    expect(prompt).toMatch(/injured at 60k/)
    expect(prompt).toMatch(/OUTRANKS any device signal/)
    // Un-gated conditions on the race path.
    expect(prompt).toMatch(/29°C/)
    expect(prompt).toMatch(/never tell them to do something they already did/)
  })

  it('control: a non-race reflection keeps the pace-fade block and no race override', () => {
    const prompt = buildSessionReframePrompt({
      ...base,
      session: { type: 'long', label: 'Long run', distance_km: 30 } as any,
    })
    expect(prompt).toMatch(/Pace fade across the run/)
    expect(prompt).not.toMatch(/RACE OVERRIDE/)
  })
})
