import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildSessionFeedbackPrompt, type SessionFeedbackPromptInput } from './sessionFeedback'
import type { PaceFadeSummary } from '../paceAnalysis'
import { LIMITER } from '../constants'

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

// ── Boundary and formatting coverage added 2026-09-15 by `npm run test:liveness`.
//
// Six mutations to this prompt builder left the whole file green. Every one is a
// user-facing string: this prompt IS what the model is told, so a broken branch
// here is a coaching instruction the runner receives, not an internal detail.
describe('buildSessionFeedbackPrompt — the environmental block\'s two edges', () => {
  const at = (tempC: number | null) =>
    buildSessionFeedbackPrompt({ ...base, session: { type: 'easy', label: 'Easy', distance_km: 10 } as never,
      actualDistKm: 10, raceResult: null, tempC })

  it('fires AT the warm edge and AT the cold edge, not just beyond them', () => {
    // The fixture sat at 29°C — inside the warm band and nowhere near either
    // boundary — so flipping `tempC <= 4` to `< 4` changed nothing observable.
    expect(at(22)).toMatch(/Environmental context/)
    expect(at(4)).toMatch(/Environmental context/)
  })

  it('stays silent in the temperate band between them', () => {
    // Flipping the `||` to `&&` makes the block need to be simultaneously warm
    // AND cold, so it never fires. Without a temperate case AND a firing case in
    // the same file, that is invisible.
    expect(at(15)).not.toMatch(/Environmental context/)
    expect(at(5)).not.toMatch(/Environmental context/)
    expect(at(21)).not.toMatch(/Environmental context/)
    expect(at(null)).not.toMatch(/Environmental context/)
  })

  it('labels each band with the word the coach would use', () => {
    expect(at(30)).toMatch(/\(hot\)/)
    expect(at(24)).toMatch(/\(warm\)/)
    expect(at(-2)).toMatch(/\(freezing\)/)
    expect(at(3)).toMatch(/\(cold\)/)
  })
})

describe('buildSessionFeedbackPrompt — §72\'s ultra threshold, exactly', () => {
  it('reads a run AT the threshold as time-on-feet', () => {
    // `isUltraEffort` uses `>=`; the fixtures were 100 km and ordinary distances,
    // never the boundary. §72 says "at/above", and a 50 km long run is the
    // commonest case there is.
    const atThreshold = buildSessionFeedbackPrompt({
      ...base, session: { type: 'easy', label: 'Long run', distance_km: 50 } as never,
      actualDistKm: LIMITER.SUPPRESS_ULTRA_DISTANCE_KM, raceResult: null,
    })
    expect(atThreshold).toMatch(/ULTRA-DISTANCE EFFORT/)
    const justUnder = buildSessionFeedbackPrompt({
      ...base, session: { type: 'easy', label: 'Long run', distance_km: 49 } as never,
      actualDistKm: LIMITER.SUPPRESS_ULTRA_DISTANCE_KM - 0.1, raceResult: null,
    })
    expect(justUnder).not.toMatch(/ULTRA-DISTANCE EFFORT/)
  })
})

describe('buildSessionFeedbackPrompt — the week line and the zone line', () => {
  it('numbers the FIRST maintenance week as 1, not as a race-plan week', () => {
    // `maintIdx >= 0` — flipping to `> 0` mislabels the first week of a
    // maintenance block, which is the week a runner is most likely to be reading.
    // The existing maintenance case sits at index 2 ("week 3 of 4"), so it never
    // exercised index 0 and the mutation was invisible.
    const maintPlan = {
      meta: { plan_kind: 'maintenance', race_date: '2026-07-11', source_race_date: '2026-07-11' },
      weeks: [{ n: 19 }, { n: 20 }, { n: 21 }, { n: 22 }],
    } as never
    const first = buildSessionFeedbackPrompt({
      ...base,
      session: { type: 'easy', label: 'Easy run', distance_km: 8 } as never,
      actualDistKm: 8, verdict: 'nailed' as never, raceResult: null,
      plan: maintPlan, weekN: 19,
    })
    expect(first).toMatch(/Maintenance week: 1 of 4/)
    expect(first, 'the first maintenance week fell back to the race-plan week line')
      .not.toMatch(/Week: 19 of 4/)
  })

  it('never emits a zone LABEL with no band behind it', () => {
    // `prescribedZoneLabel && zoneTarget` — with `||` a session that has a zone
    // label but NO resolvable HR band renders "Zone 2, null" straight into the
    // prompt, and the model is then told a heart-rate target that does not exist.
    // Reaching it needs a plan with no `zone2_ceiling` AND no prescribed band,
    // which is the HR-less runner (ADR-011 §5: iPhone-only, no watch) — the
    // cohort least able to notice a fabricated number.
    const noHrPlan = { meta: { race_date: '2026-12-06' }, weeks: [{ n: 1 }] } as never
    const p = buildSessionFeedbackPrompt({
      ...base,
      session: { type: 'easy', label: 'Easy', distance_km: 10, zone: 'Zone 2' } as never,
      // `actualAvgHr` MUST be present: the HR line is the only place `zoneStr`
      // is rendered, and with no HR it prints "HR: not recorded" and the zone
      // string never appears. A null here made the assertion vacuous.
      actualDistKm: 10, actualAvgHr: 142, hrInZonePct: null, hrAboveCeilingPct: null,
      // `prescribedZoneLabel` is its own INPUT field, not read off the session —
      // setting `session.zone` did nothing and the assertion was vacuous a second
      // time. This is the combination that actually reaches the branch: a label
      // present, and NO band to put behind it.
      prescribedZoneLabel: 'Zone 2', prescribedHrBand: null,
      raceResult: null, plan: noHrPlan, weekN: 1,
    })
    expect(p, 'a zone label was emitted with a null band').not.toMatch(/Zone 2, (null|undefined)/)
    expect(p).not.toMatch(/undefined/)
  })

  it('counts weeks to race in WEEKS, on the real calendar', () => {
    // `MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000` — perturbing the 7 survived because
    // nothing asserted the race countdown on a normal plan; the only
    // week-arithmetic case was the maintenance block, which uses a different
    // path. This is the line every non-maintenance runner reads.
    vi.setSystemTime(new Date('2026-11-01T12:00:00Z'))   // 5 weeks before 2026-12-06
    const p = buildSessionFeedbackPrompt({
      ...base,
      session: { type: 'easy', label: 'Easy', distance_km: 10 } as never,
      actualDistKm: 10, raceResult: null,
      // `race_name` is REQUIRED for the countdown to render at all — without it
      // `raceContext` falls back to the literal 'target race' and drops the
      // timing entirely. Worth stating: the first fixture omitted it and the
      // assertion failed for a reason that had nothing to do with the arithmetic.
      plan: { meta: { race_date: '2026-12-06', race_name: 'Test Marathon' }, weeks: [{ n: 1 }] } as never,
      weekN: 1,
    })
    expect(p).toMatch(/5 weeks away/)
  })
})
