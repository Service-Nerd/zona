import { describe, it, expect } from 'vitest'
import { generateFoundationBlock } from './foundationBlock'
import { normaliseDays } from './days'
import type { GeneratorInput } from '@/types/plan'

/**
 * FOUNDATION-DAYS-01 — foundation weeks honour `days_cannot_train`.
 *
 * `buildFoundationSessions` built `new Set(blockedDays)` straight from the raw
 * wizard input and filtered SHORT-form day keys ('mon') against FULL day names
 * ('monday'), so nothing ever matched and every foundation week ignored the
 * runner's blocked days. Week 1 onward was correct — the rule engine normalises
 * — so a single plan honoured the constraint from week 1 and broke it in the
 * two weeks before it.
 *
 * Silent by construction: "nothing is blocked" is indistinguishable from "the
 * runner blocked nothing". And the foundation block is generated CLIENT-side and
 * prepended after the plan leaves the server, so `validatePlan()` — and
 * INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS with it — never sees these weeks.
 *
 * Found on a real plan (e876c470, 2026-09-03): the runner blocked Mon/Wed/Thu
 * and got foundation sessions on Monday and Wednesday.
 */

// Replayed from the real plan's meta.generator_input.
const REAL: GeneratorInput = {
  age: 44, goal: 'time_target', max_hr: 185, terrain: 'road',
  race_date: '2026-12-12', resting_hr: 52, target_time: '0:45:00',
  training_age: '2-5yr', days_available: 4,
  max_weekday_mins: 60, race_distance_km: 10, current_weekly_km: 30,
  days_cannot_train: ['monday', 'wednesday', 'thursday'],
  longest_recent_run_km: 10, preferred_long_run_day: 'sun',
  hard_session_relationship: 'love',
} as unknown as GeneratorInput

const daysUsed = (w: { sessions?: Record<string, unknown> }) => Object.keys(w.sessions ?? {})

describe('FOUNDATION-DAYS-01 — blocked days', () => {
  it('places no foundation session on a blocked day (full day names)', () => {
    const { weeks } = generateFoundationBlock({
      input: REAL, planStartDate: '2026-09-21', today: '2026-09-03', forceWeeks: 2,
    })

    expect(weeks.length).toBe(2)
    for (const w of weeks) {
      expect(daysUsed(w)).not.toContain('mon')
      expect(daysUsed(w)).not.toContain('wed')
      expect(daysUsed(w)).not.toContain('thu')
      expect(daysUsed(w).length).toBeGreaterThan(0)  // still a real week
    }
  })

  it('accepts the short form too — both spellings reach the engine', () => {
    const { weeks } = generateFoundationBlock({
      input: { ...REAL, days_cannot_train: ['mon', 'wed', 'thu'] },
      planStartDate: '2026-09-21', today: '2026-09-03', forceWeeks: 2,
    })

    for (const w of weeks) {
      expect(daysUsed(w)).not.toContain('mon')
      expect(daysUsed(w)).not.toContain('wed')
      expect(daysUsed(w)).not.toContain('thu')
    }
  })

  it('still honours the days_available budget', () => {
    const { weeks } = generateFoundationBlock({
      input: REAL, planStartDate: '2026-09-21', today: '2026-09-03', forceWeeks: 2,
    })
    for (const w of weeks) expect(daysUsed(w).length).toBeLessThanOrEqual(4)
  })

  it('keeps the long run on the preferred day when it is not blocked', () => {
    const { weeks } = generateFoundationBlock({
      input: REAL, planStartDate: '2026-09-21', today: '2026-09-03', forceWeeks: 2,
    })
    for (const w of weeks) {
      expect((w.sessions as Record<string, { label?: string }>)?.sun?.label).toBe('Long easy')
    }
  })
})

describe('normaliseDays', () => {
  it('accepts both spellings, any casing, and ignores junk', () => {
    expect(Array.from(normaliseDays(['Monday', 'wed', ' THURSDAY '])).sort())
      .toEqual(['mon', 'thu', 'wed'])
    expect(Array.from(normaliseDays(['notaday']))).toEqual([])
    expect(Array.from(normaliseDays(undefined))).toEqual([])
  })

  it('does not drop valid days because a sibling entry was junk', () => {
    expect(Array.from(normaliseDays(['monday', 'funday']))).toEqual(['mon'])
  })
})
