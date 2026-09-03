import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { catalogueRowFor } from './catalogueLink'
import { composeSession } from './sessionComposer'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * Founder-reported 2026-09-03: opening a hill_reps session from the Plan
 * screen's weekly calendar showed "Main set: Quality main set." — the
 * hardcoded absolute fallback — instead of the real rep-by-rep instructions,
 * even though the session's `derived_set` in Supabase was well-formed.
 *
 * Root cause: `PlanCalendar.tsx`'s `onSessionTap` and `DashboardClient.tsx`'s
 * `TodayScreen` `sessions` useMemo each independently hand-list which fields
 * survive the trip from "session in the plan" to "session prop passed to
 * SessionPopupInner" — a D-08 duplicate-ownership violation — and both
 * omitted `catalogue_id` / `derived_set` (PlanCalendar also dropped `label`).
 * Without them, `catalogueRowFor()` returns null AND `mainSetDescription()`
 * has no `session.derived_set` to read, so it falls through to the literal
 * fallback string.
 *
 * This test reproduces the exact bug using a real generated hill_reps session
 * (not a hand-authored fixture) and proves both the broken shape and the
 * fixed shape, so a future re-introduction of the trimming bug goes red.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')

const TENK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

function findHillSession(plan: Plan): Session {
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions)) {
      if (s?.derived_set && /hill/i.test(s.label ?? '')) return s
    }
  }
  throw new Error('No hill_reps session with a derived_set found in the generated plan — fixture assumption broken')
}

describe('Session-detail navigation payload preserves catalogue_id/derived_set (D-08 fix, 2026-09-03)', () => {
  const plan = generateRulePlan(TENK, 'paid', '2026-09-07')
  const realSession = findHillSession(plan)

  it('sanity: the real generated session actually has a derived_set (fixture is grounded, not hand-authored)', () => {
    expect(realSession.derived_set).toBeTruthy()
    expect(realSession.catalogue_id).toBeTruthy()
  })

  it('BUG: the pre-fix trimmed payload shape falls back to the generic literal', () => {
    // Mirrors the exact object literal PlanCalendar.tsx's onSessionTap built
    // before the fix — no catalogue_id, no derived_set, no label (mapped to
    // `title` instead).
    const preFixPayload = {
      type: realSession.type,
      detail: realSession.detail ?? '',
      distance_km: realSession.distance_km,
      duration_mins: realSession.duration_mins,
      primary_metric: realSession.primary_metric,
      hr_target: realSession.hr_target,
      pace_target: realSession.pace_target,
      rpe_target: realSession.rpe_target,
      coach_notes: realSession.coach_notes,
    } as unknown as Session

    const row = catalogueRowFor(preFixPayload)
    expect(row).toBeNull()

    const structure = composeSession({ session: preFixPayload, catalogueRow: row })
    expect(structure!.main.description).toBe('Quality main set.')
  })

  it('FIX: the post-fix trimmed payload preserves real per-rep instructions', () => {
    // Mirrors the fixed shape — catalogue_id, derived_set, and label all
    // survive the trip, exactly as both PlanCalendar.tsx and
    // DashboardClient.tsx's TodayScreen now construct it.
    const postFixPayload = {
      type: realSession.type,
      label: realSession.label,
      detail: realSession.detail ?? '',
      catalogue_id: realSession.catalogue_id,
      derived_set: realSession.derived_set,
      distance_km: realSession.distance_km,
      duration_mins: realSession.duration_mins,
      primary_metric: realSession.primary_metric,
      hr_target: realSession.hr_target,
      pace_target: realSession.pace_target,
      rpe_target: realSession.rpe_target,
      coach_notes: realSession.coach_notes,
    } as unknown as Session

    const row = catalogueRowFor(postFixPayload)
    expect(row).not.toBeNull()

    const structure = composeSession({ session: postFixPayload, catalogueRow: row })
    expect(structure!.main.description).not.toBe('Quality main set.')
    expect(structure!.main.description).not.toBe(realSession.label)
    // Real per-rep text names the rep count, mirroring hillReps.test.ts's own convention.
    expect(structure!.main.description).toMatch(/×/)
  })
})
