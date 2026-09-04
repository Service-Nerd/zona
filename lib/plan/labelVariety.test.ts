import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * LABEL-VARIETY-01 — the §22 goal-pace override used to rename every second-half
 * peak quality session to one string ("{dist}-pace intervals"). A peak block
 * that drew a ladder, a continuous tempo and a progressive tempo showed the
 * runner that one name up to eight times (McMillan: monotony), and the identical
 * label tripped §53's label cap.
 *
 * The fix takes the trailing word from the ROW's own structure ("…-pace ladder",
 * "…-pace sustained", "…-pace reps") while keeping "{dist}-pace" as the stable
 * lead every §22/§19 check keys on.
 *
 * AMENDED by LBL-01 (Coaching Board 2026-09-04): the original fix applied the
 * shape word in PEAK only, leaving build pinned to "progression" and taper to
 * "sharpener" — on the reasoning that a cross-phase label merge would surface
 * repetition "§53 counts by label". §53 stopped counting labels 62 minutes
 * later the same morning (CAT-ULTRA-THIN-01). Build now takes the shape word
 * too; taper is left alone on measurement (0% collisions at every distance) and
 * because "sharpener" is a §6 purpose word, not a shape claim.
 *
 * These bugs are silent — a plan generates and looks fine — so the guard is a
 * generated plan asserted against, not a symptom to notice next time.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// A marathon time-target on five days: enough peak quality to have drawn several
// distinct threshold rows, which is where the eight-identical monotony lived.
const INPUT: GeneratorInput = {
  race_date: '2026-12-28', race_distance_km: 42.2, goal: 'time_target', target_time: '3:30:00',
  days_available: 5, age: 40, current_weekly_km: 55, longest_recent_run_km: 28,
  resting_hr: 50, max_hr: 188, preferred_long_run_day: 'sun',
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

// The goal-pace override labels — the ones this fix diversifies. They all carry
// the "-pace " goal-pace signal (§22) and the race distance.
const isGoalPaceLabel = (label: string) => label.includes('-pace ')

function peakQuality(plan: ReturnType<typeof generateRulePlan>): Session[] {
  return plan.weeks
    .filter(w => w.phase === 'peak' && w.type !== 'race')
    .flatMap(w => Object.values(w.sessions))
    .filter((s): s is Session => !!s && s.type === 'quality')
}

describe('LABEL-VARIETY-01 — peak goal-pace labels are distinguished by row shape', () => {
  it('the plan generates and validates (no §53/§19/§22 error)', () => {
    // generateRulePlan runs validatePlan under NODE_ENV=test and throws on any
    // error-severity violation, so a clean return IS the assertion.
    expect(() => generateRulePlan(INPUT, 'paid', PLAN_START)).not.toThrow()
  })

  it('a peak block does not collapse every goal-pace session to one name', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const overrideLabels = peakQuality(plan)
      .map(s => s.label ?? '')
      .filter(isGoalPaceLabel)

    // The regression: eight identical "MARATHON-pace intervals". Guard that the
    // peak override labels are not all the same string once there are several.
    expect(overrideLabels.length).toBeGreaterThanOrEqual(3)
    const distinct = new Set(overrideLabels)
    expect(distinct.size).toBeGreaterThan(1)
  })

  it('the shape word comes from the row — a ladder reads as a ladder', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const labels = peakQuality(plan).map(s => s.label ?? '')
    // threshold_ladder is peak-eligible for the marathon and is the v2 row whose
    // block label ("ladder") the override now surfaces.
    expect(labels.some(l => l.endsWith('-pace ladder'))).toBe(true)
    // And a shape word must never be one §19 reads as a threshold claim — that
    // demands T-pace and would fail on a goal-pace session.
    for (const l of labels.filter(isGoalPaceLabel)) {
      expect(l.toLowerCase()).not.toContain('tempo')
      expect(l.toLowerCase()).not.toContain('cruise')
    }
  })

  // ── LBL-01, Coaching Board 2026-09-04 ─────────────────────────────────────
  //
  // This block REPLACES an assertion that pinned the opposite behaviour:
  // "build and taper keep a single phase word — no cross-phase label merge",
  // which required every build override to read "…-pace progression".
  //
  // That test was correct for LABEL-VARIETY-01 as written and encoded a premise
  // that expired 62 minutes after it was committed: the carve-out existed
  // because "§53 counts by label", and CAT-ULTRA-THIN-01 changed §53 to count
  // the ROW the same morning (`a4db6aa` 08:17 → `1021013` 09:19, 2026-08-21).
  // The cost was label honesty — `tempo_cruise_short` (4 × 5 min cruise
  // intervals) shipped as "…-pace progression", which nothing about it is.
  //
  // Recorded here rather than silently deleted: a test removed with no note is
  // indistinguishable from a test someone dropped because it was in the way.
  const wordsIn = (plan: Plan, phase: string) =>
    new Set(plan.weeks
      .filter(w => w.phase === phase && w.type !== 'race')
      .flatMap(w => Object.values(w.sessions))
      .filter((s): s is Session => !!s && s.type === 'quality')
      .map(s => s.label ?? '')
      .filter(l => isGoalPaceLabel(l) && !l.startsWith('Goal-pace'))
      .map(l => l.replace(/^.*-pace /, '')))

  it('build takes the row shape word too — a progression label means a progression', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const buildSessions = plan.weeks
      .filter(w => w.phase === 'build' && w.type !== 'race')
      .flatMap(w => Object.values(w.sessions))
      .filter((s): s is Session => !!s && s.type === 'quality')
      .filter(s => isGoalPaceLabel(s.label ?? '') && !!s.catalogue_id)
    expect(buildSessions.length, 'no goal-paced build sessions — test reaches nothing').toBeGreaterThan(0)

    for (const s of buildSessions) {
      const word = (s.label ?? '').replace(/^.*-pace /, '')
      if (word !== 'progression') continue
      // The only row that may claim "progression" is one whose structure IS one.
      const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)!
      const ms = row.main_set_structure as { version?: number; blocks?: { label?: string }[] }
      expect(ms.blocks?.[0]?.label, `${row.id} claims "progression"`).toBe('progression')
    }
  })

  it('taper is deliberately UNCHANGED — "sharpener" is a purpose word, not a shape claim', () => {
    // Against the ruling's "every phase" wording, and on purpose: taper measured
    // 0% label collisions at every distance, and §6's "sharpener" makes no claim
    // about the session's shape, so there is nothing for it to be wrong about.
    // The defect was a SHAPE word attached to the wrong shape.
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    for (const w of Array.from(wordsIn(plan, 'taper'))) expect(w).toBe('sharpener')
  })

  it('two structurally different build rows no longer share one label', () => {
    // The defect, stated as the property it violated. Marathon build draws
    // several distinct threshold rows; before LBL-01 they all read
    // "MARATHON-pace progression".
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const byLabel = new Map<string, Set<string>>()
    for (const w of plan.weeks.filter(w => w.phase === 'build')) {
      for (const s of Object.values(w.sessions)) {
        if (!s || s.type !== 'quality' || !s.catalogue_id) continue
        if (!isGoalPaceLabel(s.label ?? '')) continue
        const set = byLabel.get(s.label!) ?? new Set<string>()
        set.add(s.catalogue_id)
        byLabel.set(s.label!, set)
      }
    }
    expect(byLabel.size, 'no goal-paced build labels — test reaches nothing').toBeGreaterThan(0)
    for (const [label, rows] of Array.from(byLabel)) {
      // `tempo_cruise` and `tempo_cruise_short` legitimately share "reps" — they
      // ARE the same shape, differing only in rep length, and §53 still tells
      // them apart because it counts the row. Every OTHER shared label is the
      // dishonest kind this fix removes.
      const cruisePair = Array.from(rows).every(r => r === 'tempo_cruise' || r === 'tempo_cruise_short')
      if (rows.size > 1 && !cruisePair) {
        throw new Error(`"${label}" is shared by structurally different rows: ${Array.from(rows).join(', ')}`)
      }
    }
  })

  it('INV-PLAN-LABEL-MATCHES-STRUCTURE catches a shape word that lies', () => {
    // FALSIFICATION — recreate the shipped defect and prove the invariant fires.
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    expect(validatePlan(plan, INPUT).map(v => v.code)).not.toContain('INV-PLAN-LABEL-MATCHES-STRUCTURE')

    const broken: Plan = JSON.parse(JSON.stringify(plan))
    const victim = broken.weeks
      .filter(w => w.phase === 'build')
      .flatMap(w => Object.values(w.sessions))
      .find((s): s is Session => !!s && s.type === 'quality'
        && isGoalPaceLabel(s.label ?? '') && !!s.catalogue_id
        && s.catalogue_id !== 'progressive_tempo')
    expect(victim, 'no non-progression goal-paced build session to break').toBeTruthy()
    victim!.label = victim!.label!.replace(/-pace .*$/, '-pace progression')
    expect(validatePlan(broken, INPUT).map(v => v.code)).toContain('INV-PLAN-LABEL-MATCHES-STRUCTURE')
  })

  it('does NOT fire on an enricher-rewritten label — that mistake cost users their AI voice once', () => {
    // §22's old `label.includes('pace')` check tripped on enriched labels and
    // discarded whole plans (post_enrich_invalid). An unrecognised trailing word
    // must be skipped, never flagged.
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const enriched: Plan = JSON.parse(JSON.stringify(plan))
    for (const w of enriched.weeks) {
      for (const s of Object.values(w.sessions)) {
        if (s && s.type === 'quality' && isGoalPaceLabel(s.label ?? '')) s.label = 'Race-pace effort'
      }
    }
    expect(validatePlan(enriched, INPUT).map(v => v.code)).not.toContain('INV-PLAN-LABEL-MATCHES-STRUCTURE')
  })
})
