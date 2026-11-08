import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { validateMaintenanceBlock, validatePlan } from './invariants'
import { validateSavedPlan } from './validateStoredPlan'
import { generateMaintenanceBlock } from './maintenance'
import type { GeneratorInput, Plan, RaceResult, Week } from '@/types/plan'

/**
 * INV-MAINT-NO-PLACEHOLDER-COPY — MAINT-ENRICH-VALIDATE-01, 2026-11-08.
 *
 * 🔴 THE MAINTENANCE CONSTITUTION HAD NO COPY RULE, AND THE COVERAGE LOOKED COMPLETE.
 * `INV-PLAN-NO-PLACEHOLDER-COPY`'s `expected` string reads *"only session.coach_notes may
 * carry a token"* — a claim about every user-facing field in the product. It lives in
 * `validatePlan`, and a maintenance plan never runs `validatePlan`: `validateStoredPlan` and
 * `validateSavedPlan` dispatch to `validateMaintenanceBlock` instead (AUDIT-MAINTENANCE-KIND-01,
 * and correctly — the race long tail does not describe a block with no start line).
 * **Dispatching away from the race constitution dispatched away from its copy check too, and
 * nothing replaced it.**
 *
 * The first arm below is the one that matters: it proves the HOLE, by running the real
 * dispatcher over a real generated maintenance block.
 */

const BASE_RACE_WEEK: Week = {
  n: 12, date: '2026-07-07', label: 'Race week', theme: 'Race day.',
  type: 'race', phase: 'taper', weekly_km: 30, long_run_hrs: null, sessions: {},
} as Week

const RESULT: RaceResult = {
  finish_time: '3:45:00', distance_km: 42.2, date: '2026-07-12', rpe: 7, outcome: 'on_target',
} as RaceResult

/** A REAL maintenance block, not a hand-built fixture: the stamps are what the dispatch reads. */
function maintenancePlan(): Plan {
  const weeks = generateMaintenanceBlock({
    raceResult: RESULT, lastRaceWeek: BASE_RACE_WEEK, baseWeeklyKm: 40,
    raceDistanceKm: 42.2, daysAvailable: 4,
  })
  return {
    meta: {
      plan_kind: 'maintenance',
      race_name: 'After Test Marathon', race_date: '',
      source_base_weekly_km: 40, source_run_days_per_week: 4, source_injured: false,
      source_race_distance_km: 42.2,
    } as never,
    weeks,
  } as unknown as Plan
}

const placeholderCodes = (v: { code: string }[]) =>
  v.map(x => x.code).filter(c => c.includes('NO-PLACEHOLDER-COPY'))

describe('INV-MAINT-NO-PLACEHOLDER-COPY — the population, which is the whole finding', () => {
  it('population: the generated block really is dispatched to the MAINTENANCE validator', () => {
    // Non-vacuity for every arm below. If the stamp or the kind ever stops matching, the
    // dispatcher falls through to the race validator and these arms would pass for the wrong
    // reason — which is `validateStoredPlan.ts`'s own documented fall-through.
    const p = maintenancePlan()
    expect(p.weeks.length).toBeGreaterThan(4)
    const viaDispatch = validateSavedPlan(p, {} as GeneratorInput).map(v => v.code)
    expect(viaDispatch.every(c => c.startsWith('INV-MAINT-')), `got: ${Array.from(new Set(viaDispatch)).join(', ')}`).toBe(true)
  })

  it('🔴 a token in coach_debrief is a violation NOW, and the race check still cannot see it', () => {
    const p = maintenancePlan()
    ;(p.weeks[0] as unknown as Record<string, unknown>).coach_debrief = 'Hold under {{zone2_ceiling}} bpm.'

    const viaDispatch = validateSavedPlan(p, {} as GeneratorInput)
    expect(placeholderCodes(viaDispatch)).toEqual(['INV-MAINT-NO-PLACEHOLDER-COPY'])
    expect(viaDispatch.find(v => v.code === 'INV-MAINT-NO-PLACEHOLDER-COPY')!.actual).toBe('{{zone2_ceiling}}')

    // ⚠️ THE OTHER HALF, and the reason this invariant had to exist rather than the race one
    // being widened: `validatePlan` does not scan `coach_debrief` at all, so even reaching
    // for it would not have covered this field.
    expect(placeholderCodes(validatePlan(p, {} as GeneratorInput))).toEqual([])
  })

  it('a clean block produces no placeholder violation — not firing on correct copy', () => {
    // `warn` severity on a surface the daily audit reads. A guard that fires on correct work
    // gets switched off, which this repo has recorded four times.
    const p = maintenancePlan()
    ;(p.weeks[0] as unknown as Record<string, unknown>).coach_debrief = 'The body is still accounting.'
    expect(placeholderCodes(validateSavedPlan(p, {} as GeneratorInput))).toEqual([])
  })

  it('coach_notes is the CARRIER and is exempt, exactly as the race check exempts it', () => {
    const p = maintenancePlan()
    const firstDay = Object.keys(p.weeks[0].sessions ?? {})[0]!
    ;(p.weeks[0].sessions as Record<string, { coach_notes?: string[] }>)[firstDay]!.coach_notes =
      ['Keep it under {{zone2_ceiling}} bpm.']
    expect(placeholderCodes(validateSavedPlan(p, {} as GeneratorInput))).toEqual([])
  })

  it('🔴 session.label is in the population too, and it was not in the first cut', () => {
    // Code review, same day: the `expected` string says "only session.coach_notes may carry
    // a token" while the scan read no session field at all — the exact expected-wider-than-
    // population defect this commit's sibling was written to fix, reproduced within the hour.
    const p = maintenancePlan()
    const firstDay = Object.keys(p.weeks[0].sessions ?? {})[0]!
    ;(p.weeks[0].sessions as Record<string, { label?: string }>)[firstDay]!.label = 'Easy {{session_distance}} km'
    const v = validateSavedPlan(p, {} as GeneratorInput)
    expect(placeholderCodes(v)).toEqual(['INV-MAINT-NO-PLACEHOLDER-COPY'])
    expect(v.find(x => x.code === 'INV-MAINT-NO-PLACEHOLDER-COPY')!.message).toContain(`.${firstDay}.label`)
  })

  it('🔴 the `expected` string names exactly the one field the scan exempts', () => {
    // The arm that makes the claim falsifiable rather than aspirational: every field name the
    // `expected` promises is either scanned or is the named carrier.
    const src = readFileSync(join(process.cwd(), 'lib/plan/invariants.ts'), 'utf8')
    const at = src.indexOf("code: 'INV-MAINT-NO-PLACEHOLDER-COPY'")
    expect(at, 'the violation block really was found').toBeGreaterThan(0)
    const block = src.slice(src.lastIndexOf('const copy:', at), src.indexOf('}', at + 200))
    for (const scanned of ['coach_debrief', '.label', '.theme']) {
      expect(block, `${scanned} must be in the scan`).toContain(scanned)
    }
    expect(block, 'coach_notes is the carrier and must NOT be scanned').not.toMatch(/coach_notes\]/)
  })

  it('engine-authored label and theme are scanned too — free coverage, a producer defect', () => {
    const p = maintenancePlan()
    p.weeks[1].theme = 'Back to {{session_distance}} km.'
    const v = validateMaintenanceBlock(p.weeks, 40, false, 4)
    expect(placeholderCodes(v)).toEqual(['INV-MAINT-NO-PLACEHOLDER-COPY'])
    expect(v.find(x => x.code === 'INV-MAINT-NO-PLACEHOLDER-COPY')!.message).toContain('.theme')
  })

  it('every real maintenance week the generator emits is clean of tokens', () => {
    // The producer side. A rule-engine maintenance block must never need this check.
    expect(placeholderCodes(validateMaintenanceBlock(maintenancePlan().weeks, 40, false, 4))).toEqual([])
  })

  it('🔴 and the ladder was NOT the fix — recorded, because it would have closed the item inert', () => {
    // The item asked for `repairEnrichedCopy` here. `validateMaintenanceBlock` reads no copy
    // field that the maintenance enricher writes, so the ladder returns `clean` for every
    // maintenance plan by construction. This arm is what makes that claim falsifiable: if the
    // maintenance enricher's schema ever widens to a field the constitution reads — `label`,
    // `theme` or a session's structure — the ladder becomes the right answer and this fails.
    const src = readFileSync(join(process.cwd(), 'lib/plan/enrichMaintenance.ts'), 'utf8')
    const schema = src.slice(src.indexOf('MaintEnrichmentSchema'), src.indexOf('// ─── Main export'))
    expect(schema.length, 'the schema really was read').toBeGreaterThan(100)
    for (const field of ['label:', 'theme:', 'distance_km:', 'type:', 'category:']) {
      expect(schema, `the maintenance enricher now writes ${field} — reconsider repairEnrichedCopy here`)
        .not.toContain(field)
    }
    expect(schema).toContain('coach_debrief')
    expect(schema).toContain('coach_notes')
  })
})

/**
 * MAINT-ENRICH-VALIDATE-01 — the attribution, found by `/code-review` on the day it shipped.
 *
 * 🔴 TWO DEFECTS, AND I COPIED THE FIRST FROM THE RACE PATH. `maintenance_enrich_copy_rejected`
 * was WRITE-ONLY (a writer and a union member, no reader) — the inert-field class the race
 * twin's own test arm exists to prevent. And both calls passed the runner's uuid inside
 * `detail` instead of `recordOpsEvent`'s third argument, so `ops_events.user_id` was NULL:
 * a per-user query misses the rows, and `DB-USER-PURGE-01`'s argued `ON DELETE SET NULL`
 * cannot anonymise a uuid buried in JSONB. Fixed as a pair.
 */
describe('MAINT-ENRICH-VALIDATE-01 — the rejection is attributed, and reachable', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const read = (...parts: string[]) => strip(readFileSync(join(process.cwd(), ...parts), 'utf8'))

  it('the kind is a UNION MEMBER, not a mention', () => {
    expect(read('lib', 'ops', 'recordOpsEvent.ts'))
      .toMatch(/^\s*\|\s*'maintenance_enrich_copy_rejected'\s*$/m)
  })

  it('🔴 it HAS A READER — an ops kind with none is the inert-field class', () => {
    const route = read('app', 'api', 'ops', 'enrich-health', 'route.ts')
    expect(route, 'the route must QUERY the kind, not merely mention it')
      .toMatch(/\.eq\(\s*'kind'\s*,\s*'maintenance_enrich_copy_rejected'\s*\)/)
    expect(route).toMatch(/\bmaintCopyRejected30d\b/)
    expect(route, 'a rejection is the guard working and must not move `healthy`')
      .toMatch(/healthy: !verdict\.alert/)
    // A failed count reads as UNKNOWN, never zero — "no rows" and "did not look" are the
    // pair this repo keeps confusing.
    expect(route).toMatch(/maintRejectErr \? null :/)
  })

  it('🔴 the uuid goes in the ARGUMENT, so the deletion constraint can reach it', () => {
    // `DB-USER-PURGE-01`: `ops_events.user_id` is an argued SET NULL, not a cascade, so the
    // AI-spend ledger survives a deletion anonymised. A uuid in `detail` is outside it.
    // Both enrichers, because this was a copied mistake.
    for (const f of [['lib', 'plan', 'enrichMaintenance.ts'], ['lib', 'plan', 'enrich.ts']]) {
      const src = read(...f)
      const calls = Array.from(src.matchAll(/recordOpsEvent\(\s*'[a-z_]*enrich[a-z_]*copy_rejected'[\s\S]{0,600}?\n {4}\}, userId\)/g))
      expect(calls.length, `${f.join('/')}: the copy-rejection event must pass userId as the third argument`).toBe(1)
      expect(calls[0]![0], `${f.join('/')}: no uuid inside detail`).not.toMatch(/user_id:/)
    }
  })

  it("the reader's stated MEANING names what the union actually carries", () => {
    // 🔴 It said "week label/theme" while the union had grown to seven fields across three
    // items. A reader's description going stale against the thing it counts mis-attributes
    // which prompt rule broke, which is this number's only use.
    const route = read('app', 'api', 'ops', 'enrich-health', 'route.ts')
    const union = read('lib', 'plan', 'enrich.ts')
    // ⚠️ BOUNDED FROM `boundary: {`, not from the first `meaning:`. The first cut sliced to
    // `indexOf('maintCopyRejected30d')`, which with comments stripped finds the CONST
    // DECLARATION above the object — a negative-length slice, so the arm read an empty string.
    // Caught by its own "really was read" assertion, which is why that assertion is here.
    const boundaryAt = route.indexOf('boundary: {')
    const meaning = route.slice(route.indexOf('meaning:', boundaryAt), route.indexOf('})', boundaryAt))
    expect(meaning.length, 'the meaning string really was read').toBeGreaterThan(50)
    for (const field of ['notes', 'coach_intro', 'confidence_risks', 'label', 'theme']) {
      expect(union, `${field} must be in the rejection union for this arm to mean anything`)
        .toContain(`'${field}'`)
    }
    for (const named of ['coach_intro', 'confidence_risks', 'label', 'theme', 'coach_notes']) {
      expect(meaning, `the meaning must name ${named}`).toContain(named)
    }
  })
})
