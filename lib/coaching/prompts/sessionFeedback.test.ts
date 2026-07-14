import { describe, it, expect } from 'vitest'
import { buildSessionFeedbackPrompt, type SessionFeedbackPromptInput } from './sessionFeedback'
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

const base: SessionFeedbackPromptInput = {
  session: { type: 'race', label: '100km race', distance_km: 100 } as any,
  weekN: 20,
  plan,
  verdict: 'off_target' as any,
  actualDistKm: 100,
  actualAvgHr: 138,
  hrInZonePct: 40,
  hrAboveCeilingPct: 20,
  efTrendPct: null,
  rpe: 9,
  fatigueTag: 'Wrecked',
  paceFadeSummary: paceFade,
  tempC: 29,
  limiter: null,
}

describe('buildSessionFeedbackPrompt — race debrief (§71 / RACE-DEBRIEF-02)', () => {
  it('debriefs a race: no verdict, no pace-fade citation, reflects the runner account, un-gated temp', () => {
    const prompt = buildSessionFeedbackPrompt({
      ...base,
      raceResult: { outcome: 'off_target', what_broke: 'injured at 60k', notes: 'too hot early, backed off' },
    })
    expect(prompt).toMatch(/RACE EFFORT/)
    expect(prompt).not.toMatch(/Verdict: off_target/)
    expect(prompt).not.toMatch(/Pace fade across the run/)
    // Runner's own account is surfaced and marked authoritative.
    expect(prompt).toMatch(/injured at 60k/)
    expect(prompt).toMatch(/OUTRANKS any device signal/)
    // Temperature is un-gated on the race path (29°C would show anyway, but the
    // race framing must forbid lecturing conditions).
    expect(prompt).toMatch(/29°C/)
    expect(prompt).toMatch(/not a discipline failure/)
  })

  it('names honest-absence when no temperature was recorded', () => {
    const prompt = buildSessionFeedbackPrompt({ ...base, tempC: null, raceResult: null })
    expect(prompt).toMatch(/temperature wasn't recorded/i)
  })

  it('control: a non-race session still shows the verdict and pace fade', () => {
    const prompt = buildSessionFeedbackPrompt({
      ...base,
      session: { type: 'long', label: 'Long run', distance_km: 30 } as any,
      verdict: 'off_target' as any,
    })
    expect(prompt).toMatch(/Verdict: off_target/)
    expect(prompt).toMatch(/Pace fade across the run/)
    expect(prompt).not.toMatch(/RACE EFFORT/)
  })
})
