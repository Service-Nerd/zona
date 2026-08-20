import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { catalogueRowFor } from './catalogueLink'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * SC-08a — a session carries the identity of the catalogue row that produced it.
 *
 * The rep structure a runner sees ("4 × 1000 m at 5K pace, 2 min jog") lives on
 * the row. The app used to re-join session to row AT DISPLAY TIME by matching
 * `label` against `name`, in two independently duplicated call sites.
 *
 * That join failed on 31% of quality sessions, and not randomly: §22 renames
 * race-pace sessions for a time goal, so a MARATHON time-goal plan lost 5 of its
 * 9 — the runner saw a distance, a duration and a pace band, and no indication
 * of what to do. The AI enricher rewrites labels too, so an enriched plan could
 * lose structure the rule plan had. D-17: never couple logic to a display string
 * another layer is allowed to change.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'
const HARD = new Set(['quality', 'intervals', 'tempo'])

const MARATHON_TIME: GeneratorInput = {
  race_date: '2027-01-18', race_distance_km: 42.2, goal: 'time_target',
  target_time: '3:45:00', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
}

const qualityOf = (p: Plan) =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter(s => s && HARD.has(s.type)).map(s => s!))

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-08a — the display join', () => {
  it('resolves every quality session in a marathon time-goal plan', () => {
    // The worst case: 5 of 9 failed the name join because §22 renames them.
    const plan = generateRulePlan(MARATHON_TIME, 'paid', PLAN_START)
    const q = qualityOf(plan)
    expect(q.length).toBeGreaterThan(0)

    const unresolved = q.filter(s => !catalogueRowFor(s))
    expect(unresolved.map(s => s.label), 'every quality session must resolve to its row')
      .toEqual([])
  })

  it('survives the rename that broke the old join', () => {
    // Assert the fixture actually CONTAINS a renamed session, or this proves
    // nothing — the same vacuous-fixture trap as the §1 ceiling test.
    const plan = generateRulePlan(MARATHON_TIME, 'paid', PLAN_START)
    const renamed = qualityOf(plan).filter(s =>
      !V1_SESSION_CATALOGUE.some(r => r.name === s.label))
    expect(renamed.length, 'fixture must contain renamed sessions').toBeGreaterThan(0)

    for (const s of renamed) {
      expect(catalogueRowFor(s), `renamed "${s.label}" must still resolve`).toBeTruthy()
    }
  })

  it('survives the ENRICHER rewriting a label', () => {
    // The enricher can only write label + coach_notes (EnrichedWeekSchema), so a
    // stamped id is structurally out of its reach. This is the property that
    // makes the fix durable rather than incidental.
    const plan = generateRulePlan(MARATHON_TIME, 'paid', PLAN_START)
    const s = qualityOf(plan).find(x => x.catalogue_id)!
    const rewritten = { ...s, label: 'Something The Model Made Up' }
    expect(catalogueRowFor(rewritten)?.id).toBe(s.catalogue_id)
  })

  it('still resolves LEGACY unstamped sessions by name', () => {
    // Plans generated before SC-08a carry no stamp. They must keep working.
    expect(catalogueRowFor({ label: 'Classic VO2max' })?.id).toBe('intervals_classic')
    expect(catalogueRowFor({ label: 'No Such Session' })).toBeNull()
    expect(catalogueRowFor(null)).toBeNull()
  })

  it('prefers the stamp over the name when they disagree', () => {
    // Ordering matters: the stamp is authoritative precisely because the label
    // is not trustworthy.
    const row = catalogueRowFor({ catalogue_id: 'intervals_long', label: 'Classic VO2max' })
    expect(row?.id).toBe('intervals_long')
  })
})

describe('SC-08a — INV-PLAN-CATALOGUE-LINK', () => {
  it('a freshly generated plan stamps every row-backed quality session', () => {
    const plan = generateRulePlan(MARATHON_TIME, 'paid', PLAN_START)
    const vs = validatePlan(plan, MARATHON_TIME).filter(v => v.code === 'INV-PLAN-CATALOGUE-LINK')
    expect(vs).toEqual([])
  })

  it('fires when the stamp is dropped but the name still matches', () => {
    // The regression this guards: without the check, the legacy fallback would
    // quietly cover a dropped stamp until someone renamed the session.
    const plan = generateRulePlan(MARATHON_TIME, 'paid', PLAN_START)
    const poisoned: Plan = structuredClone(plan)
    let done = false
    for (const w of poisoned.weeks) {
      for (const [d, s] of Object.entries(w.sessions)) {
        if (done || !s || !HARD.has(s.type) || !s.catalogue_id) continue
        const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)!
        ;(w.sessions as Record<string, typeof s>)[d] = { ...s, catalogue_id: undefined, label: row.name }
        done = true
      }
    }
    expect(done).toBe(true)
    const vs = validatePlan(poisoned, MARATHON_TIME).filter(v => v.code === 'INV-PLAN-CATALOGUE-LINK')
    expect(vs.length).toBeGreaterThan(0)
    expect(vs[0].severity).toBe('error')
  })
})
