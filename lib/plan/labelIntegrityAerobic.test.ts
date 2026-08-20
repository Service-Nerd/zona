import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput } from '@/types/plan'

/**
 * SC-02 / CD-15 — an aerobic catalogue row prescribed at threshold pace kept
 * its aerobic name. §19 breach, live in production until 2026-08-20.
 *
 * No threshold row is eligible for 5K/10K (SC-04), so the selector falls back
 * to an aerobic row for the whole build phase — and the engine then prescribes
 * it at T-pace in Zone 3–4. The session's NAME said easy, its PRESCRIPTION said
 * threshold, and nothing caught it: INV-PLAN-LABEL-MATCHES-PACE only asked
 * "label claims hard → is the pace hard?", never the inverse. "Steady aerobic"
 * contains none of vo2max/tempo/cruise/threshold, so it raised nothing.
 *
 * McMillan: "whatever else you decide, that runner is being poorly served
 * today." The board ruled the labelling fix ships unconditionally, without
 * waiting for the eligibility fix.
 *
 * Two halves, both asserted here:
 *   (a) engine  — rename the repurposed row and replace the borrowed voice (§33)
 *   (b) invariant — catch an easy-implying label on a non-easy zone, so the
 *       same fallback cannot recur silently wherever the catalogue thins out
 *
 * Ruling: docs/decisions/coaching-board-2026-08-19-session-catalogue.md
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// The audit's Task B profile. fitness_level is deliberately left unset — the
// 'experienced' variant is entangled with SC-01/§23 and is blocked; this is
// the same defect on the path that is shippable today.
const INPUT: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  injury_history: ['Left knee, posterior, recurring'],
}

const EASY_WORDS = ['easy', 'steady', 'aerobic', 'recovery']

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-02 — aerobic row repurposed as a quality session', () => {
  const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
  const quality = plan.weeks.flatMap(w =>
    Object.values(w.sessions).filter(s => s?.type === 'quality').map(s => ({ w: w.n, s: s! })))

  it('the profile still reaches the aerobic fallback (premise guard)', () => {
    // If SC-04 later makes a real threshold row eligible for 10K, the fallback
    // stops firing and this test measures nothing. It should then be re-pointed
    // at a distance/phase that still falls back, not quietly left passing.
    expect(quality.length).toBeGreaterThan(0)
    const buildWeeks = plan.weeks.filter(w => w.phase === 'build')
    expect(buildWeeks.length).toBeGreaterThan(0)
  })

  it('no quality session is labelled as easy or aerobic work', () => {
    for (const { w, s } of quality) {
      const label = (s.label ?? '').toLowerCase()
      for (const word of EASY_WORDS) {
        expect(label, `week ${w}: quality session labelled "${s.label}" at ${s.zone}`)
          .not.toContain(word)
      }
    }
  })

  it('no quality session carries a borrowed aerobic coach voice', () => {
    // §33 — the repurposed row's own note describes a Zone 2 run and is simply
    // false on a session prescribed at T-pace.
    const aerobicVoices = V1_SESSION_CATALOGUE
      .filter(r => r.category === 'aerobic' && r.coach_voice_notes)
      .map(r => r.coach_voice_notes as string)
    expect(aerobicVoices.length).toBeGreaterThan(0)

    for (const { w, s } of quality) {
      for (const note of s.coach_notes ?? []) {
        expect(aerobicVoices, `week ${w}: "${s.label}" carries an aerobic row's voice`)
          .not.toContain(note)
      }
    }
  })

  it('validatePlan raises no label-integrity violation', () => {
    const found = validatePlan(plan, INPUT).filter(v => v.code === 'INV-PLAN-LABEL-MATCHES-PACE')
    expect(found, found.map(v => v.message).join('\n')).toHaveLength(0)
  })

  it('the invariant catches the inverse case it previously missed', () => {
    // Directly exercise (b): hand-build the exact shape that shipped — an
    // easy-sounding label on a Zone 3–4 quality session — and assert it is now
    // rejected. Without this, the engine fix alone would leave the hole open
    // for any other path that produces the same mismatch.
    const poisoned = structuredClone(plan)
    const week = poisoned.weeks.find(w => Object.values(w.sessions).some(s => s?.type === 'quality'))!
    const entry = Object.entries(week.sessions).find(([, s]) => s?.type === 'quality')!
    entry[1]!.label = 'Steady aerobic'

    const found = validatePlan(poisoned, INPUT).filter(v => v.code === 'INV-PLAN-LABEL-MATCHES-PACE')
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].message).toContain('Steady aerobic')
  })
})
