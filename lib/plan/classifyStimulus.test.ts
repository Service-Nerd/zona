import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { classifyStimulus } from './sessionRole'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Session } from '@/types/plan'

/**
 * CLASSIFY-STIMULUS-01 — `classifyStimulus` classified by the display label
 * (the D-17 anti-pattern). The AI enricher rewrites labels, and §22 renames
 * race-pace sessions, so the STIMULUS_RANK axis the progression / VO2max-onset /
 * V5-escalation logic orders on could be silently reclassified — and via
 * post-enrich re-validation, misfire whole plans.
 *
 * Fix: the generator stamps `Session.stimulus` at construction from the trusted
 * label, and `classifyStimulus` reads the stamp first. The label heuristic is
 * the legacy fallback only. These bugs are silent, so the guard asserts the
 * stamp wins over a hostile label rather than trusting the label path.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

function s(partial: Partial<Session>): Session {
  return { type: 'quality', label: '', detail: null, ...partial }
}

describe('classifyStimulus — reads the stamp, not the label', () => {
  it('the stamp wins over a contradicting label (the enricher case)', () => {
    // Stamp says race_pace; label rewritten to something the heuristic would read
    // as easy. Classification must follow the stamp.
    expect(classifyStimulus(s({ stimulus: 'race_pace', label: 'Easy Sunday jog' }))).toBe('race_pace')
    // Stamp says vo2max; label stripped of any keyword.
    expect(classifyStimulus(s({ stimulus: 'vo2max', label: 'Wednesday session' }))).toBe('vo2max')
    // Stamp says tempo; label rewritten to a hill word.
    expect(classifyStimulus(s({ stimulus: 'tempo', label: 'Big hill grind' }))).toBe('tempo')
  })

  it('falls back to the label heuristic only for legacy (unstamped) sessions', () => {
    expect(classifyStimulus(s({ label: 'HM-pace intervals' }))).toBe('race_pace')
    expect(classifyStimulus(s({ label: 'Continuous tempo' }))).toBe('tempo')
    expect(classifyStimulus(s({ label: 'Classic VO2max', zone: 'Zone 4–5' }))).toBe('vo2max')
    expect(classifyStimulus(s({ label: 'Long run — Zone 2' }))).toBeNull()
  })
})

describe('CLASSIFY-STIMULUS-01 — the generator stamps every quality session', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
  afterAll(() => { vi.useRealTimers() })

  const INPUT: GeneratorInput = {
    race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
    days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
    resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  }

  it('every quality session carries a stimulus stamp', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const quality = plan.weeks
      .filter(w => w.type !== 'race')
      .flatMap(w => Object.values(w.sessions))
      .filter((x): x is Session => !!x && x.type === 'quality')

    expect(quality.length).toBeGreaterThan(0)
    for (const q of quality) {
      expect(q.stimulus, `"${q.label}" has no stimulus stamp`).toBeTruthy()
    }
  })

  it('a §22-renamed goal-pace session stamps race_pace, not tempo', () => {
    // The catalogue_id → row.category trap: a threshold row re-prescribed at goal
    // pace ("10K-pace …") must read as race_pace. The stamp is taken from the
    // prescribed label, so it does — verified against the live plan.
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const goalPace = plan.weeks
      .flatMap(w => Object.values(w.sessions))
      .filter((x): x is Session => !!x && x.type === 'quality' && (x.label ?? '').includes('-pace'))
    expect(goalPace.length).toBeGreaterThan(0)
    for (const g of goalPace) expect(classifyStimulus(g)).toBe('race_pace')
  })
})
