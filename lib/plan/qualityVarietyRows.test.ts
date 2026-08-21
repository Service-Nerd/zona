import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Session } from '@/types/plan'

/**
 * CAT-ULTRA-THIN-01 — §53 quality variety counts catalogue ROWS, not labels
 * (Coaching Board 2026-08-21). The residue the flip exposed was fixed at the
 * engine, not by loosening the cap:
 *   - least-used-first rotation in selectCatalogueSession (exhaust the eligible
 *     pool before repeating a row), and
 *   - threshold_ladder gated into the thin intermediate marathon/ultra pool by
 *     weekly volume rather than an `experienced` label.
 *
 * These are silent-quality bugs (a monotonous plan still generates), so the
 * guard asserts against generated plans.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

function quality(plan: ReturnType<typeof generateRulePlan>): Session[] {
  return plan.weeks
    .filter(w => w.type !== 'race')
    .flatMap(w => Object.values(w.sessions))
    .filter((s): s is Session => !!s && s.type === 'quality')
}

function rowCounts(plan: ReturnType<typeof generateRulePlan>): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of quality(plan)) {
    const id = s.catalogue_id ?? s.label ?? ''
    m.set(id, (m.get(id) ?? 0) + 1)
  }
  return m
}

// The case that carried the entire pre-fix residue: 100k intermediate, whose
// threshold pool was two rows in peak/taper.
const ULTRA: GeneratorInput = {
  race_date: '2027-01-25', race_distance_km: 100, goal: 'time_target', target_time: '12:00:00',
  days_available: 5, age: 44, current_weekly_km: 70, longest_recent_run_km: 40,
  resting_hr: 48, max_hr: 186, preferred_long_run_day: 'sun', fitness_level: 'intermediate',
}

describe('CAT-ULTRA-THIN-01 — §53 counts rows and rotation exhausts the pool', () => {
  it('no catalogue row exceeds the §53 cap on a 100k intermediate plan', () => {
    // Pre-fix this plan carried progressive_tempo six times against a cap of five.
    const plan = generateRulePlan(ULTRA, 'paid', PLAN_START)
    const counts = rowCounts(plan)
    const total = quality(plan).length
    const cap = Math.floor(total / GENERATION_CONFIG.QUALITY_VARIETY_DENOMINATOR)
      + GENERATION_CONFIG.QUALITY_VARIETY_ALLOWANCE
    for (const [id, c] of Array.from(counts)) {
      expect(c, `row "${id}" appears ${c}× (cap ${cap})`).toBeLessThanOrEqual(cap)
    }
  })

  it('the invariant (which now keys on the row) is clean', () => {
    const plan = generateRulePlan(ULTRA, 'paid', PLAN_START)
    const v = validatePlan(plan, ULTRA).filter(x => x.code === 'INV-PLAN-QUALITY-VARIETY-FULL-PLAN')
    expect(v).toEqual([])
  })

  it('rotation does not over-pick one row while an eligible sibling sits unused', () => {
    // With least-used rotation the same-category rows the plan draws on end up
    // within one selection of each other — no row is picked 5× while another is
    // picked once.
    const plan = generateRulePlan(ULTRA, 'paid', PLAN_START)
    const threshold = quality(plan).filter(s => s.stimulus === 'tempo')
    const counts = new Map<string, number>()
    for (const s of threshold) counts.set(s.catalogue_id ?? '', (counts.get(s.catalogue_id ?? '') ?? 0) + 1)
    const used = Array.from(counts.values())
    if (used.length > 1) {
      expect(Math.max(...used) - Math.min(...used)).toBeLessThanOrEqual(2)
    }
  })
})

describe('CAT-ULTRA-THIN-01 — threshold_ladder is volume-gated, not fitness-labelled', () => {
  it('an intermediate marathon runner at real volume reaches the ladder', () => {
    const plan = generateRulePlan(ULTRA, 'paid', PLAN_START)
    const ids = new Set(quality(plan).map(s => s.catalogue_id))
    expect(ids.has('threshold_ladder')).toBe(true)
  })

  it('a low-volume week never carries the ladder (Willy\'s load floor)', () => {
    // Every week that carries the ladder must clear the volume floor.
    const plan = generateRulePlan(ULTRA, 'paid', PLAN_START)
    for (const w of plan.weeks) {
      const hasLadder = Object.values(w.sessions).some(s => s?.catalogue_id === 'threshold_ladder')
      if (hasLadder) {
        expect(w.weekly_km).toBeGreaterThanOrEqual(GENERATION_CONFIG.THRESHOLD_LADDER_MIN_WEEKLY_KM)
      }
    }
  })
})
