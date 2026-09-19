import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { FUELLING_PRACTICE_NOTE, ULTRA_FUELLING_PREFIX } from './fuellingNotes'
import { GENERATION_CONFIG } from './generationConfig'
import { PLAN_PERSONAS, charityInput, CHARITY_PLAN_START } from './charityCohort'
import type { GeneratorInput, Session } from '@/types/plan'

// §24e Amendment (Coaching Board 2026-09-19, LONG-SESSION-FUEL-01).
//
// The cue existed and was gated on the race being a 50K/100K. The hazard Sims
// named is a DURATION hazard: the never-run beginner MARATHONER was prescribed
// seven sessions over two hours, up to 3h28, with no mention of fuelling
// anywhere in the plan.

const THRESHOLD = GENERATION_CONFIG.FUELLING_PRACTICE_MIN_SESSION_MINS
const isFuelNote = (n: string) => n === FUELLING_PRACTICE_NOTE || n.startsWith(ULTRA_FUELLING_PREFIX)

const peakLongRuns = (plan: { weeks: { phase?: string; sessions: Record<string, Session | undefined> }[] }) => {
  const out: Session[] = []
  for (const w of plan.weeks) {
    if (w.phase !== 'peak') continue
    for (const s of Object.values(w.sessions ?? {})) if (s?.role === 'long_run') out.push(s)
  }
  return out
}
const fuelled = (s: Session) => (s.coach_notes ?? []).filter(Boolean).some(n => isFuelNote(n as string))

describe('§24e Am. — a long run long enough to need fuel says so', () => {
  it('1. THE FLAGSHIP CASE: the never-run beginner marathoner is told', () => {
    const p = PLAN_PERSONAS.find(x => x.id.startsWith('E1'))!
    const plan = generateRulePlan(charityInput(p), 'paid', CHARITY_PLAN_START)
    const longest = peakLongRuns(plan).sort((a, b) => (b.duration_mins ?? 0) - (a.duration_mins ?? 0))[0]
    expect(longest, 'E1 must have a peak long run at all').toBeTruthy()
    expect(longest.duration_mins ?? 0).toBeGreaterThanOrEqual(THRESHOLD)
    expect(fuelled(longest)).toBe(true)
  })

  it('2. the gate is DURATION, not the race — a marathon qualifies, and an ultra still uses its cadence', () => {
    for (const id of ['E1', 'E6']) {
      const p = PLAN_PERSONAS.find(x => x.id.startsWith(id))!
      const plan = generateRulePlan(charityInput(p), 'paid', CHARITY_PLAN_START)
      const longest = peakLongRuns(plan).sort((a, b) => (b.duration_mins ?? 0) - (a.duration_mins ?? 0))[0]
      if ((longest?.duration_mins ?? 0) < THRESHOLD) continue
      expect(fuelled(longest), `${id} peak long run carries no fuelling cue`).toBe(true)
    }
    // the ultra keeps its catalogue cadence rather than the generic practice note
    const ultra = PLAN_PERSONAS.find(x => x.id.startsWith('E6'))!
    const plan = generateRulePlan(charityInput(ultra), 'paid', CHARITY_PLAN_START)
    const notes = peakLongRuns(plan).flatMap(s => (s.coach_notes ?? []).filter(Boolean) as string[])
    expect(notes.some(n => n.startsWith(ULTRA_FUELLING_PREFIX))).toBe(true)
  })

  it('3. a SHORT long run is NOT told — the cue is not wallpaper', () => {
    // A 10K plan whose peak long run sits under the threshold.
    const short = {
      athlete_name: 'A', age: 32, race_name: 'T', primary_metric: 'distance',
      race_distance_km: 10, race_date: '2027-03-07', plan_start: '2026-11-02',
      goal: 'finish', fitness_level: 'intermediate', training_age: '2-5yr',
      resting_hr: 52, max_hr: 188, current_weekly_km: 25, longest_recent_run_km: 8,
      days_available: 4, injury_history: [], hard_session_relationship: 'neutral',
      recent_quality_training: 'occasional',
    } as unknown as GeneratorInput
    const plan = generateRulePlan(short, 'paid')
    for (const s of peakLongRuns(plan)) {
      if ((s.duration_mins ?? 0) < THRESHOLD) {
        expect(fuelled(s), 'a sub-threshold long run must NOT carry the cue').toBe(false)
      }
    }
  })

  it('4. the invariant FIRES when the cue is stripped', () => {
    const p = PLAN_PERSONAS.find(x => x.id.startsWith('E1'))!
    const input = charityInput(p)
    const plan = generateRulePlan(input, 'paid', CHARITY_PLAN_START)
    for (const s of peakLongRuns(plan)) {
      if (s.coach_notes) {
        s.coach_notes = (s.coach_notes as string[])
          .filter(n => !isFuelNote(n)) as Session['coach_notes']
      }
    }
    const v = validatePlan(plan, input).filter(x => x.severity === 'error')
    expect(v.map(x => x.code)).toContain('INV-PLAN-LONG-SESSION-FUELLING-NOTE')
  })

  it('5. it is PRACTICE guidance, never a nutrition prescription (ADR-011)', () => {
    // Zonna holds no dietary data. No grams, no calories, no schedule.
    expect(FUELLING_PRACTICE_NOTE).not.toMatch(/\b\d+\s*(g|grams?|kcal|calories?)\b/i)
    expect(FUELLING_PRACTICE_NOTE).toMatch(/practise/i)
  })
})
