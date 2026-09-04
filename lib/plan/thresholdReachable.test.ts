import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { PLAN_SIGNATURES } from './planSignatures'
import { isV2Structure, StructureV2Schema } from './sessionStructureV2'
import type { GeneratorInput } from '@/types/plan'

/**
 * SC-04 / CD-15 — 5K and 10K runners could not be given a threshold session.
 * There wasn't one.
 *
 * Every threshold row was restricted to HM and longer, so the entire build
 * phase of a 10K plan — the phase whose purpose is threshold development — was
 * filled by an aerobic row. The signature said a 10K is built on "vo2max and
 * threshold"; half of that was unreachable. For a runner with knee/shin/Achilles
 * history the hills row was filtered out too, leaving exactly ONE eligible
 * session for the whole build phase.
 *
 * The board considered this the least discretionary item in the batch, and the
 * conflict scan strengthened it beyond what the audit argued: §24b was written
 * on the explicit premise that 5K/10K runners already receive threshold work.
 * That premise had never been true — so this is closer to correcting a false
 * statement in the constitution than to making a new coaching decision.
 *
 * Ruling: docs/decisions/coaching-board-2026-08-19-session-catalogue.md
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// The audit's Task B profile, injury included — the injured case is the one
// that was reduced to a single eligible session for the whole build phase.
const INPUT: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  injury_history: ['Left knee, posterior, recurring'],
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('SC-04 — threshold work is reachable for short distances', () => {
  it('every declared signature focus is reachable in the catalogue', () => {
    // The general property, asserted for all six distances rather than only the
    // two that were broken. A signature is a promise about the plan's shape; if
    // the catalogue cannot supply it, the promise is decoration.
    for (const [dist, sig] of Object.entries(PLAN_SIGNATURES)) {
      const focuses = (sig as { quality_categories_focus?: readonly string[] }).quality_categories_focus ?? []
      for (const focus of focuses) {
        const reachable = V1_SESSION_CATALOGUE.filter(r =>
          r.category === focus
          && r.distance_eligibility.includes(dist as never)
          && r.phase_eligibility.some(p => p !== 'base'))
        expect(reachable.length, `${dist} declares focus '${focus}' but no eligible session supplies it`)
          .toBeGreaterThan(0)
      }
    }
  })

  it('a 10K build phase gets real threshold work, not a repurposed aerobic row', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const buildQuality = plan.weeks
      .filter(w => w.phase === 'build')
      .flatMap(w => Object.values(w.sessions).filter(s => s?.type === 'quality'))

    expect(buildQuality.length).toBeGreaterThan(0)

    // The guarantee is that build quality is NOT the aerobic fallback. Before
    // SC-04 every build session was `aerobic_steady` prescribed at threshold
    // pace under an easy name (the §19 breach SC-02 closed).
    //
    // ASSERTED STRUCTURALLY, not by catalogue name — amended 2026-08-20 (SC-07).
    // The original assertion matched session labels against threshold row names,
    // which broke the moment SC-07 changed the build rotation: §22 legitimately
    // RENAMES a threshold row to "10K-pace progression" for a time target, so a
    // genuine `progressive_tempo` session stopped matching its own catalogue
    // name. That is D-17 in a test — coupling logic to a display string another
    // layer is allowed to rewrite. The substance held the whole time; only the
    // name-matching failed.
    const aerobicNames = V1_SESSION_CATALOGUE
      .filter(r => r.category === 'aerobic').map(r => r.name)
    const fromAerobicRow = buildQuality.filter(s => aerobicNames.includes(s!.label ?? ''))
    expect(fromAerobicRow, 'build quality must not be the aerobic fallback').toHaveLength(0)

    // ...and it must actually be prescribed above easy.
    const aboveEasy = buildQuality.filter(s => !/zone 2/i.test(s!.zone ?? ''))
    expect(aboveEasy.length).toBeGreaterThan(0)
  })

  it('the injured short-distance runner is no longer down to one session', () => {
    // §21 removes the hills row for this injury history in base/build. Before
    // SC-04 that left a single eligible build session, so the runner received
    // four consecutive identical "quality" sessions — all easy runs.
    const eligibleBuild = V1_SESSION_CATALOGUE.filter(r =>
      r.distance_eligibility.includes('10K')
      && r.phase_eligibility.includes('build')
      && r.fitness_level_min !== 'experienced'
      && !(r.main_set_structure as { terrain?: string }).terrain)
    expect(eligibleBuild.length).toBeGreaterThan(1)
  })

  it('the short-distance threshold rep sits inside McMillan’s 4–12 minute band', () => {
    // Amendment adopted: band the rep rather than fixing it at five, because
    // variety across a block matters more than any single rep length. v1
    // cannot express a band on its own (SC-08), so a v1 row's variety came
    // from OTHER v1 rows at different fixed lengths. `tempo_cruise_short`
    // migrated to v2 (Coaching Board 2026-09-03, generalising SC-08's VO2max
    // work-band pattern to threshold) — its own row now expresses the band
    // directly via engine-scaled rep count, rather than needing a sibling row
    // to supply a second fixed value. Reads BOTH shapes so a row's rep length
    // stays checked regardless of which side of the migration it's on.
    const rows = V1_SESSION_CATALOGUE
      .filter(r => r.category === 'threshold' && r.distance_eligibility.includes('10K'))
    const shortThresholdReps = rows.map(r => {
      if (isV2Structure(r.main_set_structure)) {
        const parsed = StructureV2Schema.safeParse(r.main_set_structure)
        // Only a single-repeated-length shape has ONE "the rep length" to
        // check — threshold_ladder's scaling is 'fixed' (3-5-8-5-3 min, a
        // deliberately varied ladder) and has no single rep length this
        // assertion means anything for; excluded, same as it was pre-migration
        // (a v1-shape read on a v2 row also returned undefined).
        if (!parsed.success || parsed.data.sizing.scaling !== 'reps') return undefined
        // §85 (CB-CAT-01) — SUM the rep's work steps, don't read the first.
        //
        // Every reps-scaled row until over-unders had exactly one work step, so
        // "the first work step" and "the rep" were the same number and the
        // distinction never mattered. An over-under's rep is 3 min at CV then
        // 3 min at T with NO recovery between them: the runner holds work
        // continuously for six minutes. Reading the first step alone reports
        // three and fails this band — measuring a proxy that has stopped
        // coinciding with the thing the principle is about. `pacedRepPlan` was
        // corrected the same way in the same commit; both now measure the rep.
        const work = parsed.data.blocks.flatMap(b => b.steps).filter(s => s.role === 'work')
        if (work.length === 0 || work.some(s => s.length.kind !== 'duration')) return undefined
        return work.reduce((sum, s) => sum + (s.length as { secs: number }).secs, 0) / 60
      }
      return (r.main_set_structure as { work?: { duration_mins?: number } }).work?.duration_mins
    }).filter((d): d is number => typeof d === 'number')

    expect(shortThresholdReps.length).toBeGreaterThan(1)   // variety exists at all
    for (const mins of shortThresholdReps) {
      expect(mins).toBeGreaterThanOrEqual(4)
      expect(mins).toBeLessThanOrEqual(12)
    }
  })

  it('the taper keeps its race-specific session', () => {
    // Regression guard for what widening exposed: a 5K/10K taper has exactly
    // one quality week, and the §36 even/odd alternation gave it to threshold —
    // leaving zero race-specific taper work against §5's ladder. It only looked
    // right before because no threshold row was eligible to win the slot.
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const taperQuality = plan.weeks
      .filter(w => w.phase === 'taper')
      .flatMap(w => Object.values(w.sessions).filter(s => s?.type === 'quality'))

    expect(taperQuality.length).toBeGreaterThan(0)
    const raceSpecificNames = V1_SESSION_CATALOGUE
      .filter(r => r.category === 'race_specific').map(r => r.name)
    expect(taperQuality.some(s => raceSpecificNames.includes(s!.label ?? ''))).toBe(true)
  })

  it('no catalogue row shares a name with another', () => {
    // The §53 variety rule counts LABELS, and the display-time structure join
    // matches on name (SC-08). Two rows sharing a name would silently break
    // both — the trap hit when adding 'Cruise intervals — short' beside the
    // existing 'Cruise intervals'.
    const names = V1_SESSION_CATALOGUE.map(r => r.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('the plan validates', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const errors = validatePlan(plan, INPUT).filter(v => v.severity === 'error')
    expect(errors, errors.map(v => `${v.code}: ${v.message}`).join('\n')).toHaveLength(0)
  })
})
