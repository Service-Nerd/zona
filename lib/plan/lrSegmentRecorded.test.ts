// §24b — a segmented long run must be prescribable before it is prescribed.
//
// CB/ZONE-BAND-02 sitting, 2026-09-12. `buildFallbackPace` states the intent in
// as many words — "Beginners: null — no pace segments prescribed
// (CoachingPrinciples §24b)" — and returns null for both marathon and HM pace.
// `fiveKTenKPeakLongRunSession` built the session anyway and fell back to the
// literal WORDS, so every beginner on a time-targeted 5K/10K plan read, in their
// final two peak weeks:
//
//   "Middle 20% (≈2.1 km) at marathon pace: marathon pace."
//   "Final 30% (≈3.2 km) at HM pace: HM pace."
//
// A sentence that says the same thing twice and hands the runner no number.
// Measured on the 621-plan cohort: 108 of 108 beginner sessions, 0 of 108
// intermediate/experienced — a perfect split on the one input that decides
// whether the paces exist.
//
// A defect fix restoring documented intent, so ADR-017-exempt from the board.
// Two things are guarded here because two things were wrong:
//   1. the SELECTION — no derivable paces, no segmented session;
//   2. the RECORD — a session carrying §24b's zone stores its segment pace,
//      closing the `if (!s.lr_segment_pace) continue` silent pass in
//      INV-PLAN-5K10K-LR-PACE-CAP.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const base = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-12', race_distance_km: 5, goal: 'time_target',
  target_time: '0:25:00', current_weekly_km: 20, longest_recent_run_km: 8,
  days_available: 3, age: 35, resting_hr: 55, max_hr: 184,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

const allSessions = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
    .filter(Boolean) as Session[]

const notesOf = (s: Session) => (s.coach_notes ?? []).filter(Boolean).join(' ')

describe('§24b — segmented long runs are only prescribed when they can be paced', () => {
  it('a BEGINNER never receives a placeholder pace', () => {
    const plan = generateRulePlan(base({ fitness_level: 'beginner' } as any), 'paid')
    const bad = allSessions(plan).filter(s =>
      /at marathon pace: marathon pace|at HM pace: HM pace/.test(notesOf(s)))
    expect(bad).toEqual([])
  })

  it('a beginner gets a plain long run instead — not a broken segmented one', () => {
    const plan = generateRulePlan(base({ fitness_level: 'beginner' } as any), 'paid')
    const segmented = allSessions(plan).filter(s => s.zone === 'Zone 2–3')
    expect(segmented).toEqual([])
  })

  it('an INTERMEDIATE runner still gets the session, with real paces recorded', () => {
    const plan = generateRulePlan(base({ fitness_level: 'intermediate' } as any), 'paid')
    const segmented = allSessions(plan).filter(s => s.zone === 'Zone 2–3')
    expect(segmented.length, 'intermediate must still receive §24b').toBeGreaterThan(0)
    for (const s of segmented) {
      expect(s.lr_segment_pace, 'segment pace must be recorded').toBeTruthy()
      expect(notesOf(s)).not.toMatch(/at marathon pace: marathon pace|at HM pace: HM pace/)
      // a real pace band carries digits; the placeholder never did
      expect(String(s.lr_segment_pace)).toMatch(/\d/)
    }
  })

  it('FALSIFICATION — INV-PLAN-LR-SEGMENT-RECORDED goes RED on a segmented session with no recorded pace', () => {
    const input = base({ fitness_level: 'intermediate' } as any)
    const plan = generateRulePlan(input, 'paid')
    const idx = plan.weeks.findIndex(w =>
      Object.values(w.sessions ?? {}).some((s: any) => s && s.zone === 'Zone 2–3'))
    expect(idx, 'fixture must contain a §24b session').toBeGreaterThanOrEqual(0)

    const w = plan.weeks[idx]
    const [day, s] = (Object.entries(w.sessions) as [string, Session][])
      .find(([, x]) => x && x.zone === 'Zone 2–3')!
    const stripped = { ...s }
    delete (stripped as any).lr_segment_pace

    const sabotaged: Plan = {
      ...plan,
      weeks: plan.weeks.map((x, i) => i === idx
        ? { ...x, sessions: { ...x.sessions, [day]: stripped } }
        : x),
    }
    const vs = validatePlan(sabotaged, input).filter(v => v.code === 'INV-PLAN-LR-SEGMENT-RECORDED')
    expect(vs.length).toBeGreaterThan(0)
  })

  it('the generated plan is clean under the new invariant', () => {
    for (const lvl of ['beginner', 'intermediate', 'experienced']) {
      const input = base({ fitness_level: lvl } as any)
      const plan = generateRulePlan(input, 'paid')
      expect(
        validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-LR-SEGMENT-RECORDED'),
        `${lvl} must be clean`,
      ).toEqual([])
    }
  })
})
