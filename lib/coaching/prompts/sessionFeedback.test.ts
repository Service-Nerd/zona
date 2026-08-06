import { describe, it, expect, vi, afterEach } from 'vitest'
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
      actualDistKm: 30,
      verdict: 'off_target' as any,
    })
    expect(prompt).toMatch(/Verdict: off_target/)
    expect(prompt).toMatch(/Pace fade across the run/)
    expect(prompt).not.toMatch(/RACE EFFORT/)
  })

  // §72 — an ultra-distance NON-race effort keeps its training read but drops the
  // fade-as-fault citation, framing the run as time-on-feet.
  it('ultra-distance long run: keeps the verdict, drops the pace-fade citation, frames as time-on-feet', () => {
    const prompt = buildSessionFeedbackPrompt({
      ...base,
      session: { type: 'long', label: 'Ultra long run', distance_km: 55 } as any,
      actualDistKm: 55,
      verdict: 'off_target' as any,
    })
    expect(prompt).toMatch(/ULTRA-DISTANCE EFFORT \(55km\)/)
    expect(prompt).toMatch(/time-on-feet/)
    expect(prompt).not.toMatch(/Pace fade across the run/)
    expect(prompt).not.toMatch(/RACE EFFORT/)     // not a race — no race debrief
    expect(prompt).toMatch(/Verdict: off_target/) // still a scored training session
  })
})

// ADR-013 — post-race maintenance. The bug: three weeks after a 100km, Kit's
// post-run feedback said "two days after your 100km effort". Root cause: the
// prompt was given no real elapsed time since the race, so the model invented
// one. These lock in the real figure (or an explicit "don't invent" when the
// date wasn't carried) and the coherent maintenance-week line.
describe('buildSessionFeedbackPrompt — post-race maintenance (ADR-013)', () => {
  afterEach(() => vi.useRealTimers())

  const maintPlan = {
    meta: {
      plan_kind:               'maintenance',
      race_name:               'After Ultra 100',
      race_date:               '',
      source_race_name:        'Ultra 100',
      source_race_distance_km: 100,
      source_race_date:        '2026-07-11',
    },
    weeks: [{ n: 19 }, { n: 20 }, { n: 21 }, { n: 22 }],
  } as any

  const maintBase: SessionFeedbackPromptInput = {
    ...base,
    session:      { type: 'easy', label: 'Easy run', distance_km: 8 } as any,
    actualDistKm: 8,
    verdict:      'nailed' as any,
    raceResult:   null,
    plan:         maintPlan,
    weekN:        21,
  }

  it('states the real time since the race, forbids a different figure, drops "weeks away"', () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z')) // 21 days = 3 weeks after 2026-07-11
    const prompt = buildSessionFeedbackPrompt(maintBase)
    expect(prompt).toMatch(/POST-RACE MAINTENANCE/)
    expect(prompt).toMatch(/about 3 weeks since the race/)
    expect(prompt).toMatch(/Do not state a different figure/)
    expect(prompt).not.toMatch(/weeks away/)
    // Continuous week n=21 must not render as "Week 21 of 4".
    expect(prompt).toMatch(/Maintenance week: 3 of 4/)
    expect(prompt).not.toMatch(/Week: 21 of 4/)
  })

  it('forbids inventing an elapsed time when source_race_date is missing (pre-fix plans)', () => {
    const { source_race_date, ...metaNoDate } = maintPlan.meta
    const prompt = buildSessionFeedbackPrompt({
      ...maintBase,
      plan: { ...maintPlan, meta: metaNoDate } as any,
    })
    expect(prompt).toMatch(/exact time since the race is not known/i)
    expect(prompt).toMatch(/do NOT state or imply a specific number/)
  })
})

// A past race on a NORMAL (non-maintenance) plan must read "run N weeks ago",
// never "0 weeks away" — the Math.max(0, …) clamp that hid a finished race.
describe('buildSessionFeedbackPrompt — past race on a normal plan', () => {
  afterEach(() => vi.useRealTimers())

  it('reads "run N weeks ago", never "0 weeks away"', () => {
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z')) // race 2026-07-11 = 3 weeks ago
    const prompt = buildSessionFeedbackPrompt({
      ...base,
      session:      { type: 'easy', label: 'Easy', distance_km: 8 } as any,
      actualDistKm: 8,
      verdict:      'nailed' as any,
      raceResult:   null,
      plan:         { meta: { race_name: 'Ultra 100', race_distance_km: 100, race_date: '2026-07-11' }, weeks: [{}, {}, {}] } as any,
    })
    expect(prompt).toMatch(/run 3 weeks ago/)
    expect(prompt).not.toMatch(/0 weeks away/)
  })
})
