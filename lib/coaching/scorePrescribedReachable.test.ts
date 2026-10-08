// INV-SCORE-PRESCRIBED-REACHABLE — §123's mechanical check.
//
// 🔴 THE INVARIANT: **a session executed exactly as its own structure prescribes must be
// able to score 100 on HR discipline.** If it cannot, the engine is marking a runner down
// for doing what it asked.
//
// ⚠️ IT IS NOT A `validatePlan()` INVARIANT, AND THE REASON IS NOT LAZINESS.
// `validatePlan` takes a `Plan` and asks whether the plan is legal. This asks whether the
// SCORER and the CATALOGUE agree, which is a question about two modules and no plan can
// answer it. Declared here rather than shoehorned into `plan-invariants.md`, where it
// would have to read a plan it does not need.
//
// ⚠️ AND IT RUNS ON THE ENGINE'S REAL OUTPUT, NOT A FIXTURE I WROTE. Every session comes
// from `generateRulePlan`, so a catalogue row whose structure changes is covered on the
// way in, and I cannot accidentally assert against a shape the engine never emits — the
// failure mode that made `targetedGrid`'s predecessor useless.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { PINNED_PLAN_START } from '@/lib/plan/__fixtures__/pinnedPlanStart'
import { zoneForSessionType } from './zoneRules'
import { prescribedZonesFor, prescribedZoneFigures, type ZoneKey } from './prescribedZoneFigures'
import type { GeneratorInput, Session } from '@/types/plan'

const input = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-12', race_distance_km: 42.2, goal: 'finish',
  current_weekly_km: 40, longest_recent_run_km: 18, days_available: 5, age: 38,
  resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
  training_age: '2-5yr', user_declared_level: 'intermediate',
  recent_quality_training: 'occasional', ...o,
} as GeneratorInput)

/** Several shapes, so the catalogue is reached broadly rather than at one cell. */
// ⚠️ `goal` is `'finish' | 'time_target'` — my first draft wrote `'time'` and
// `validateInputFields` threw `InputEnumError` immediately. That guard exists because two
// measurement grids in `scripts/` had been passing `'occasionally'` and `'regularly'`,
// neither of which exists, and **every plan generated cleanly**. It did its job here.
// A time goal also needs `target_time`, or `coherentGoal` silently downgrades it to
// `finish` and the cohort is narrower than it reads.
const COHORT: Partial<GeneratorInput>[] = [
  {},
  { race_distance_km: 21.1, goal: 'time_target', target_time: '1:45:00', days_available: 4 },
  // ⚠️ `longest_recent_run_km` MOVES WITH `current_weekly_km`, or the plan is incoherent
  // and `INV-PLAN-WEEK-1-2-LONG-CAP` (§9/§113) throws: a 70 km/week runner whose longest
  // recent run is 18 km is not a runner, and week 2's long run cannot clear 18 × 1.1.
  // "Fixtures must use the PRODUCT's values" — an internally inconsistent cohort is a
  // fixture that tests a runner who does not exist.
  { race_distance_km: 10, goal: 'time_target', target_time: '45:00', current_weekly_km: 55,
    longest_recent_run_km: 22, user_declared_level: 'experienced' },
  { race_distance_km: 5, goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 12,
    user_declared_level: 'beginner' },
  // ⚠️ A marathon TIME goal needs 16 weeks (§44), and `PINNED_PLAN_START` is
  // 2026-09-14, so the default 2026-12-12 race date gives 12 and `enforcePrepTime`
  // throws. The runway is extended rather than acknowledging the warning, because
  // acknowledging it builds at maintenance volume and would quietly narrow the corpus
  // to a shape the quality catalogue barely reaches.
  { race_distance_km: 42.2, goal: 'time_target', target_time: '3:30:00', race_date: '2027-03-07',
    current_weekly_km: 70, longest_recent_run_km: 30, user_declared_level: 'experienced',
    recent_quality_training: 'regular' },
]

function allSessions(): Session[] {
  const out: Session[] = []
  for (const o of COHORT) {
    const plan = generateRulePlan(input(o), 'paid', PINNED_PLAN_START)
    for (const w of plan.weeks) {
      for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
        if (s) out.push(s)
      }
    }
  }
  return out
}

/** The histogram a PERFECT execution produces: every sample inside a prescribed band. */
function perfectHistogram(zones: Set<ZoneKey>) {
  const keys = Array.from(zones)
  const share = Math.round((100 / keys.length) * 100) / 100
  const hist = { z1: 0, z2: 0, z3: 0, z4_5: 0 } as Record<ZoneKey, number>
  keys.forEach(k => { hist[k] = share })
  return hist
}

const NO_LEGACY = { hrInZonePct: null, hrAboveCeilingPct: null, hrBelowFloorPct: null }

describe('INV-SCORE-PRESCRIBED-REACHABLE', () => {
  it('the corpus actually reaches multi-band quality sessions, or this check proves nothing', () => {
    const sessions = allSessions()
    expect(sessions.length).toBeGreaterThan(200)
    const multiBand = sessions.filter(s => {
      const z = prescribedZonesFor(s)
      return z && z.size > 1
    })
    // 🔴 The arm that stops this passing vacuously. If the corpus holds no multi-band
    // session, every assertion below is about single-band sessions that were never broken.
    expect(multiBand.length, 'no multi-band session in the corpus — this check is blind').toBeGreaterThan(0)
    expect(multiBand.some(s => s.type === 'quality')).toBe(true)
  })

  it('🔴 EVERY session scores 100 when run exactly as its structure prescribes', () => {
    const failures: string[] = []
    for (const s of allSessions()) {
      const zones = prescribedZonesFor(s)
      if (!zones) continue   // rest / strength / cross — scored on other axes
      const f = prescribedZoneFigures(perfectHistogram(zones), s, NO_LEGACY)
      // `computeHRScore` is `round(min(100, hrInZonePct))`, so in-zone IS the score.
      if ((f.hrInZonePct ?? 0) < 99.9) {
        failures.push(`${s.type}/${(s as { catalogue_id?: string }).catalogue_id ?? '?'}: in=${f.hrInZonePct} above=${f.hrAboveCeilingPct} below=${f.hrBelowFloorPct}`)
      }
    }
    expect(Array.from(new Set(failures))).toEqual([])
  })

  // ⚠️ THE FALSIFICATION, BUILT IN RATHER THAN RUN BY HAND, because this is the arm that
  // would have caught §123's defect and it must be shown to fire.
  it('and it GOES RED under the pre-§123 rule, on the session that was wrong', () => {
    const progressive = allSessions().find(s =>
      (s as { catalogue_id?: string }).catalogue_id === 'progressive_tempo')
    expect(progressive, 'progressive_tempo not in the corpus').toBeDefined()

    const zones = prescribedZonesFor(progressive!)!
    const hist = perfectHistogram(zones)

    // The OLD rule: the single zone the TYPE names, ignoring the structure.
    const typeOnly = new Set<ZoneKey>()
    const label = zoneForSessionType(progressive!.type)!.zone
    typeOnly.add(label === 'Z2' ? 'z2' : label === 'Z3' ? 'z3' : label === 'Z4-5' ? 'z4_5' : 'z1')

    const oldFigures = prescribedZoneFigures(hist, { type: progressive!.type }, NO_LEGACY)
    // 🔴 A PERFECT EXECUTION, scored the old way, fails.
    expect(oldFigures.hrInZonePct).toBeLessThan(99.9)
    // And the new way passes on the identical input.
    expect(prescribedZoneFigures(hist, progressive!, NO_LEGACY).hrInZonePct).toBeCloseTo(100, 1)
  })

  it('an easy run is untouched — one band, and still 100 when held', () => {
    const easy = allSessions().find(s => s.type === 'easy')!
    const zones = prescribedZonesFor(easy)!
    expect(Array.from(zones)).toEqual(['z2'])
    expect(prescribedZoneFigures({ z1: 0, z2: 100, z3: 0, z4_5: 0 }, easy, NO_LEGACY).hrInZonePct)
      .toBeCloseTo(100, 1)
  })

  it('and a genuinely undisciplined easy run still fails, so this is not a free pass', () => {
    const easy = allSessions().find(s => s.type === 'easy')!
    const hot = prescribedZoneFigures({ z1: 0, z2: 24, z3: 60, z4_5: 16 }, easy, NO_LEGACY)
    expect(hot.hrInZonePct).toBeCloseTo(24, 1)
    expect(hot.hrAboveCeilingPct).toBeCloseTo(76, 1)
  })
})
