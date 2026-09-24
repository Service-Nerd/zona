/**
 * PLAN-STORED-SCHEMA-DRIFT-01 — the two questions the daily audit never asked.
 *
 * Every case here is a REAL production shape from 2026-09-24, because the whole
 * argument for these probes is that three live defects in one week were each
 * found by a person happening to look:
 *
 *   PLAN-RESTING-HR-ZERO-01   `meta.resting_hr = 0`                 10 of 22 plans
 *   PLAN-LEGACY-ZONE-STRING-01 `zone: "Zone 3–4"` over a Z3 target  16 sessions
 *   PLAN-VO2MAX-BAND-01       a VO2max session in the threshold band 2 sessions
 *
 * ⚠️ `validatePlan` — which HAS run over every stored plan daily since
 * 2026-09-03 — could see only the middle one. It never parses `PlanSchema`, and
 * a downgraded VO2max session is internally CONSISTENT ("Zone 3" beside the
 * Zone 3 band), which is all INV-PLAN-DISPLAY-ZONE-MATCHES-WORK asks.
 *
 * 🔴 THE TEST THAT MATTERS MOST IS THE SILENT ONE. PLAN-AUDIT-01 ruled that this
 * probe alerts on TRANSITION because its first run found 15 of 15 plans invalid
 * and "an alert that always fires is an alert nobody reads". A probe that fires
 * on a correct plan would put that back.
 */
import { describe, it, expect } from 'vitest'
import { schemaCodesFor, hrBandCodesFor, storedPlanCodes } from './storedPlanProbes'
import { generateRulePlan } from '../plan/ruleEngine'
import { computeZones } from '../plan/zones'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-04-27'
const INPUT = {
  athlete_name: 'Athlete', age: 41, race_name: 'Test', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 21.1, race_date: '2026-08-01', goal: 'finish',
  resting_hr: 55, max_hr: 187, current_weekly_km: 35, longest_recent_run_km: 14,
  fitness_level: 'intermediate', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: [],
  days_available: 4, days_cannot_train: ['mon', 'fri', 'wed'],
} as unknown as GeneratorInput

/**
 * ⚠️ A SECOND FIXTURE, AND IT IS THE POINT. The HM intermediate plan above
 * contains NO intervals-band session, so the VO2max case below was `0` on its
 * first run — the EXACT fixture blindness that let PLAN-VO2MAX-BAND-01 ship past
 * six unit tests. Found by sweeping `cohortGrid` for an input that produces one
 * rather than by guessing at a plausible-looking runner.
 */
const VO2_INPUT = {
  athlete_name: 'Athlete', age: 52, race_name: 'Test', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 5, race_date: '2026-08-01', goal: 'finish',
  resting_hr: 55, max_hr: 187, current_weekly_km: 20, longest_recent_run_km: 8,
  fitness_level: 'intermediate', recent_quality_training: 'regular',
  hard_session_relationship: 'neutral', injury_history: [],
  days_available: 3, days_cannot_train: ['mon', 'wed', 'fri', 'sun'],
} as unknown as GeneratorInput

const good = () => JSON.parse(JSON.stringify(generateRulePlan(INPUT, 'paid', PLAN_START)))
const withVo2 = () => JSON.parse(JSON.stringify(generateRulePlan(VO2_INPUT, 'paid', PLAN_START)))

describe('schemaCodesFor — PlanSchema over a STORED row', () => {
  it('is SILENT on a plan the engine just produced', () => {
    expect(schemaCodesFor(good())).toEqual([])
  })

  it('REPRODUCES PLAN-RESTING-HR-ZERO-01: the shape 10 live plans held', () => {
    const p = good(); p.meta.resting_hr = 0
    expect(schemaCodesFor(p)).toEqual(['SCHEMA:meta.resting_hr'])
  })

  it('REPRODUCES the two legacy rows found in production', () => {
    // e916f15a (2026-05-28): null where the schema says z.string().
    const nulls = good(); nulls.meta.handle = null; nulls.meta.charity = null
    expect(schemaCodesFor(nulls)).toEqual(['SCHEMA:meta.charity', 'SCHEMA:meta.handle'])

    // 29bf01c9 (2026-04-23): 11 sessions with a `type` outside the current enum,
    // spread across weeks AND days. They must COLLAPSE to ONE code, or every
    // plan looks unique and the transition check never goes quiet. The first cut
    // collapsed only the week index and produced four codes — one per day —
    // which is why day keys are coordinates here too.
    const enums = good()
    let touched = 0
    for (const w of enums.weeks) for (const d of Object.keys(w.sessions ?? {})) {
      if (w.sessions[d] && touched < 11) { w.sessions[d].type = 'steady_state'; touched++ }
    }
    expect(touched).toBeGreaterThan(1)
    expect(touched).toBe(11)
    expect(schemaCodesFor(enums)).toEqual(['SCHEMA:weeks.#.sessions.#.type'])
  })

  it('caps the paths but never hides the count', () => {
    const wrecked = { meta: {}, weeks: [] }
    const codes = schemaCodesFor(wrecked as never)
    expect(codes.length).toBeLessThanOrEqual(7)
    expect(codes.some(c => /\+\d+-more$/.test(c))).toBe(true)
  })

  it('does not throw on junk', () => {
    for (const junk of [null, undefined, {}, { weeks: 'no' }, { meta: null }]) {
      expect(() => schemaCodesFor(junk as never)).not.toThrow()
    }
  })
})

describe('hrBandCodesFor — the band no other check can see', () => {
  it('is SILENT on a plan the engine just produced — both fixtures', () => {
    expect(hrBandCodesFor(good())).toEqual([])
    expect(hrBandCodesFor(withVo2())).toEqual([])
  })

  it('REPRODUCES PLAN-VO2MAX-BAND-01: a VO2max session moved to the threshold band', () => {
    // The exact damage done to plan 8a2858ab weeks 5 and 9. It is SELF-CONSISTENT
    // — the zone string correctly describes the (wrong) band — which is why
    // INV-PLAN-DISPLAY-ZONE-MATCHES-WORK passed it and only this probe fails.
    const p = withVo2()
    const z = computeZones(p.meta.max_hr, p.meta.resting_hr)
    let moved = 0
    for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {}) as Record<string, unknown>[]) {
      if (s?.hr_target === z.intervalsHR) { s.zone = z.qualityZone; s.hr_target = z.qualityHR; moved++ }
    }
    expect(moved, 'fixture must contain an intervals-band session').toBeGreaterThan(0)
    expect(hrBandCodesFor(p)).toEqual(['HR-BAND-MISMATCH'])
  })

  it('REPRODUCES PLAN-LEGACY-ZONE-STRING-01: "Zone 3–4" over a Zone-3-only target', () => {
    const p = good()
    const z = computeZones(p.meta.max_hr, p.meta.resting_hr)
    let n = 0
    for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {}) as Record<string, unknown>[]) {
      if (s?.hr_target === z.qualityHR) { s.zone = 'Zone 3–4'; n++ }
    }
    expect(n).toBeGreaterThan(0)
    expect(hrBandCodesFor(p)).toEqual(['HR-ZONE-STRING-MISMATCH'])
  })

  it('stays silent where it cannot tell — no max HR, no row, neither band', () => {
    const noMhr = good(); delete noMhr.meta.max_hr
    expect(hrBandCodesFor(noMhr)).toEqual([])

    // A band matching neither quality nor intervals: not this probe's to judge.
    const odd = good()
    for (const w of odd.weeks) for (const s of Object.values(w.sessions ?? {}) as Record<string, unknown>[]) {
      if (s?.hr_target) s.hr_target = '1–2 bpm'
    }
    expect(hrBandCodesFor(odd)).toEqual([])

    // No catalogue_id and a label the catalogue does not know — the legacy case.
    const legacy = good()
    for (const w of legacy.weeks) for (const s of Object.values(w.sessions ?? {}) as Record<string, unknown>[]) {
      if (s) { delete s.catalogue_id; s.label = 'Something from April' }
    }
    expect(hrBandCodesFor(legacy)).toEqual([])
  })

  it('does not throw on junk', () => {
    for (const junk of [null, undefined, {}, { meta: { max_hr: 0 } }, { meta: { max_hr: 180 }, weeks: null }]) {
      expect(() => hrBandCodesFor(junk as never)).not.toThrow()
    }
  })
})

describe('storedPlanCodes — the merge the route branches on', () => {
  it('a SCHEMA break with no invariant error is NOT clean', () => {
    // 🔴 THE WIRING BUG, PINNED. The route tested `!errors.length`; this plan has
    // zero invariant errors and must still be reported, or the probe is inert.
    const p = good(); p.meta.resting_hr = 0
    expect(storedPlanCodes(p, [])).toEqual(['SCHEMA:meta.resting_hr'])
    expect(storedPlanCodes(p, []).length).toBeGreaterThan(0)
  })

  it('an HR-BAND break with no invariant error is NOT clean', () => {
    const p = withVo2()
    const z = computeZones(p.meta.max_hr, p.meta.resting_hr)
    let moved = 0
    for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {}) as Record<string, unknown>[]) {
      if (s?.hr_target === z.intervalsHR) { s.zone = z.qualityZone; s.hr_target = z.qualityHR; moved++ }
    }
    expect(moved).toBeGreaterThan(0)
    expect(storedPlanCodes(p, [])).toEqual(['HR-BAND-MISMATCH'])
  })

  it('a genuinely clean plan produces an EMPTY set — the route stays quiet', () => {
    expect(storedPlanCodes(good(), [])).toEqual([])
    expect(storedPlanCodes(withVo2(), [])).toEqual([])
  })

  it('merges, de-duplicates and sorts alongside invariant codes', () => {
    const p = good(); p.meta.resting_hr = 0
    expect(storedPlanCodes(p, ['INV-PLAN-Z', 'INV-PLAN-A', 'INV-PLAN-A']))
      .toEqual(['INV-PLAN-A', 'INV-PLAN-Z', 'SCHEMA:meta.resting_hr'])
  })
})
