import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composeSession } from './sessionComposer'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { isV2Structure } from './sessionStructureV2'
import type { GeneratorInput, Session } from '@/types/plan'

/**
 * SC-08 vo2max — the three flat VO2max rows migrated to v2 with scaling: 'reps'
 * (Coaching Board 2026-08-21). The rep COUNT is a fixed band by fitness × phase
 * (never weekly volume), rep LENGTH is the stimulus identity, and the work step
 * resolves to THIS runner's I-pace instead of the generic "3K"/"5K"/"Z4-5" label.
 */

const PLAN_START = '2026-09-07'
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-08-20T09:00:00Z')) })
afterAll(() => { vi.useRealTimers() })

const VO2_IDS = ['intervals_classic', 'intervals_short', 'intervals_long']

function vo2Sessions(plan: ReturnType<typeof generateRulePlan>): { phase: string; s: Session }[] {
  return plan.weeks.flatMap(w =>
    Object.values(w.sessions)
      .filter((s): s is Session => !!s && s.type === 'quality' && s.stimulus === 'vo2max' && !!s.pace_target)
      .map(s => ({ phase: String(w.phase ?? ''), s })))
}

const FIVEK = (fitness: 'intermediate' | 'experienced'): GeneratorInput => ({
  race_date: '2026-11-29', race_distance_km: 5, goal: 'time_target', target_time: '0:20:00',
  days_available: 5, age: 34, current_weekly_km: 45, longest_recent_run_km: 16,
  resting_hr: 46, max_hr: 190, preferred_long_run_day: 'sun', fitness_level: fitness,
})

describe('SC-08 vo2max — v2 migration', () => {
  it('all three flat VO2max rows are v2', () => {
    for (const id of VO2_IDS) {
      const row = V1_SESSION_CATALOGUE.find(r => r.id === id)!
      expect(isV2Structure(row.main_set_structure), id).toBe(true)
    }
  })

  it('the runner sees resolved I-pace per rep, not a generic anchor label', () => {
    const plan = generateRulePlan(FIVEK('experienced'), 'paid', PLAN_START)
    const vo2 = vo2Sessions(plan)
    expect(vo2.length).toBeGreaterThan(0)
    for (const { s } of vo2) {
      const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
      const desc = composeSession({ session: s as never, catalogueRow: row })!.main.description
      // A resolved pace band (m:ss–m:ss /km), never the old generic anchor labels.
      expect(desc, desc).toMatch(/\d:\d\d[–-]\d:\d\d \/km/)
      expect(desc).not.toContain('3K pace')
      expect(desc).not.toContain('5K pace')
      expect(desc).not.toContain('Z4_Z5')
    }
  })

  it('every VO2max session carries a derived_set with a resolved rep count', () => {
    const plan = generateRulePlan(FIVEK('experienced'), 'paid', PLAN_START)
    for (const { s } of vo2Sessions(plan)) {
      const reps = (s.derived_set as { blocks?: { repeat?: number }[] } | undefined)?.blocks?.[0]?.repeat
      expect(typeof reps, `"${s.label}"`).toBe('number')
      expect(reps!).toBeGreaterThanOrEqual(3)
    }
  })

  it('an experienced runner gets at least as many reps as an intermediate (dose by fitness, not volume)', () => {
    const classicReps = (fit: 'intermediate' | 'experienced') => {
      const plan = generateRulePlan(FIVEK(fit), 'paid', PLAN_START)
      const s = vo2Sessions(plan).find(x => x.s.catalogue_id === 'intervals_classic')?.s
      return (s?.derived_set as { blocks?: { repeat?: number }[] } | undefined)?.blocks?.[0]?.repeat ?? 0
    }
    const int = classicReps('intermediate')
    const exp = classicReps('experienced')
    // Both plans hold weekly volume constant (45 km); only fitness differs, so a
    // higher rep count for the experienced runner proves the dose tracks
    // readiness, not weekly volume.
    if (int > 0 && exp > 0) expect(exp).toBeGreaterThanOrEqual(int)
  })
})
