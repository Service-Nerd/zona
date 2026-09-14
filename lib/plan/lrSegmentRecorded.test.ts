// §24b — a segmented long run must be prescribable before it is prescribed.
//
// CB/ZONE-BAND-02 sitting, 2026-09-12. `buildFallbackPace` states the intent in
// as many words — "Beginners: null — no pace segments prescribed
// (CoachingPrinciples §24b)" — and returns null for both marathon and HM pace.
// `fiveKTenKPeakLongRunSession` built the session anyway and fell back to the
// literal WORDS, so every beginner on a time-targeted 5K/10K plan read, in their
// final two peak weeks:
//
//   "Middle 20% (≈2.1 km) at marathon pace: marathon pace."
//   "Final 30% (≈3.2 km) at HM pace: HM pace."
//
// A sentence that says the same thing twice and hands the runner no number.
// Measured on the 621-plan cohort: 108 of 108 beginner sessions, 0 of 108
// intermediate/experienced — a perfect split on the one input that decides
// whether the paces exist.
//
// A defect fix restoring documented intent, so ADR-017-exempt from the board.
// Two things are guarded here because two things were wrong:
//   1. the SELECTION — no derivable paces, no segmented session;
//   2. the RECORD — a session carrying §24b's zone stores its segment pace,
//      closing the `if (!s.lr_segment_pace) continue` silent pass in
//      INV-PLAN-5K10K-LR-PACE-CAP.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { zoneStringFromZoneKeys, zonesFromZoneString } from '@/lib/coaching/zoneRules'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const base = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-12', race_distance_km: 5, goal: 'time_target',
  target_time: '0:25:00', current_weekly_km: 20, longest_recent_run_km: 8,
  days_available: 3, age: 35, resting_hr: 55, max_hr: 184,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

const allSessions = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions ?? {}) as (Session | undefined)[])
    .filter(Boolean) as Session[]

const notesOf = (s: Session) => (s.coach_notes ?? []).filter(Boolean).join(' ')

describe('§24b — segmented long runs are only prescribed when they can be paced', () => {
  it('a BEGINNER never receives a placeholder pace', () => {
    const plan = generateRulePlan(base({ fitness_level: 'beginner' } as any), 'paid')
    const bad = allSessions(plan).filter(s =>
      /at marathon pace: marathon pace|at HM pace: HM pace/.test(notesOf(s)))
    expect(bad).toEqual([])
  })

  it('a beginner gets a plain long run instead — not a broken segmented one', () => {
    const plan = generateRulePlan(base({ fitness_level: 'beginner' } as any), 'paid')
    const segmented = allSessions(plan).filter(s => s.zone === 'Zone 2–3')
    expect(segmented).toEqual([])
  })

  it('an INTERMEDIATE runner still gets the session, with real paces recorded', () => {
    const plan = generateRulePlan(base({ fitness_level: 'intermediate' } as any), 'paid')
    const segmented = allSessions(plan).filter(s => s.zone === 'Zone 2–3')
    expect(segmented.length, 'intermediate must still receive §24b').toBeGreaterThan(0)
    for (const s of segmented) {
      expect(s.lr_segment_pace, 'segment pace must be recorded').toBeTruthy()
      expect(notesOf(s)).not.toMatch(/at marathon pace: marathon pace|at HM pace: HM pace/)
      // a real pace band carries digits; the placeholder never did
      expect(String(s.lr_segment_pace)).toMatch(/\d/)
    }
  })

  it('FALSIFICATION — INV-PLAN-LR-SEGMENT-RECORDED goes RED on a segmented session with no recorded pace', () => {
    const input = base({ fitness_level: 'intermediate' } as any)
    const plan = generateRulePlan(input, 'paid')
    const idx = plan.weeks.findIndex(w =>
      Object.values(w.sessions ?? {}).some((s: any) => s && s.zone === 'Zone 2–3'))
    expect(idx, 'fixture must contain a §24b session').toBeGreaterThanOrEqual(0)

    const w = plan.weeks[idx]
    const [day, s] = (Object.entries(w.sessions) as [string, Session][])
      .find(([, x]) => x && x.zone === 'Zone 2–3')!
    const stripped = { ...s }
    delete (stripped as any).lr_segment_pace

    const sabotaged: Plan = {
      ...plan,
      weeks: plan.weeks.map((x, i) => i === idx
        ? { ...x, sessions: { ...x.sessions, [day]: stripped } }
        : x),
    }
    const vs = validatePlan(sabotaged, input).filter(v => v.code === 'INV-PLAN-LR-SEGMENT-RECORDED')
    expect(vs.length).toBeGreaterThan(0)
  })

  it('the generated plan is clean under the new invariant', () => {
    for (const lvl of ['beginner', 'intermediate', 'experienced']) {
      const input = base({ fitness_level: lvl } as any)
      const plan = generateRulePlan(input, 'paid')
      expect(
        validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-LR-SEGMENT-RECORDED'),
        `${lvl} must be clean`,
      ).toEqual([])
    }
  })
})

// ─── §25 — LR-SEGMENT-RECORDED-§25 (Coaching Board 2026-09-13, EXEMPT) ─────────
//
// §107 shipped deliberately narrow and said so: "§25's two producers are NOT yet
// covered — the HM (`hm_pace_long_run`, 108 sessions) and marathon
// (`mp_long_run`, 72) race-specific long runs still record no segment, and
// `session.zone` is still authored beside `hr_target` rather than derived from
// the segments. That is the remainder of the board's ruling."
//
// Measured before this change on a 30-session HM/MARATHON grid: 0% recorded
// `lr_segment_pace`, while 100% already carried the zone the catalogue row
// declares. So step 1 closes a real gap and step 2 converts a coincidence into a
// guarantee — which is only worth doing if the derivation is LIVE. The mutation
// case below is what proves that; without it this would be another
// declared-and-read-by-nothing field (§93's class).

const PLAN_START = '2026-09-14'

const raceBase = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-04-11', goal: 'time_target',
  age: 35, resting_hr: 55, max_hr: 184, days_available: 5,
  fitness_level: 'intermediate', current_weekly_km: 40, longest_recent_run_km: 14,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

const HM  = raceBase({ race_distance_km: 21.1, target_time: '1:45:00' } as Partial<GeneratorInput>)
const MAR = raceBase({ race_distance_km: 42.2, target_time: '3:45:00' } as Partial<GeneratorInput>)

const segmentedOf = (p: Plan): Session[] =>
  allSessions(p).filter(s => s.zone === 'Zone 2–3')

describe('§25 — race-specific long runs record the segment they prescribe', () => {
  for (const [name, input] of [['HM', HM], ['MARATHON', MAR]] as const) {
    it(`${name}: every §25 long run stores lr_segment_pace, and it IS goal pace`, () => {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      const segmented = segmentedOf(plan)
      expect(segmented.length, `${name} must produce §25 sessions`).toBeGreaterThan(0)
      const goalPace = plan.meta.goal_pace_per_km
      expect(goalPace, 'a time-target plan carries a goal pace').toBeTruthy()
      for (const s of segmented) {
        expect(s.lr_segment_pace, 'segment pace must be recorded').toBeTruthy()
        // The board scoped the pace explicitly: the final portion runs at MP
        // (marathon) or HM pace, which is what goalPace holds. Asserting
        // equality is what keeps INV-PLAN-5K10K-LR-PACE-CAP correctly 5K/10K-only.
        expect(s.lr_segment_pace).toBe(goalPace)
      }
    })

    it(`${name}: clean under the broadened INV-PLAN-LR-SEGMENT-RECORDED`, () => {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      expect(
        validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-LR-SEGMENT-RECORDED'),
      ).toEqual([])
    })

    it(`${name}: FALSIFICATION — the broadened invariant goes RED when the pace is stripped`, () => {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      const idx = plan.weeks.findIndex(w =>
        Object.values(w.sessions ?? {}).some((s: any) => s && s.zone === 'Zone 2–3'))
      expect(idx, 'fixture must contain a §25 session').toBeGreaterThanOrEqual(0)
      const w = plan.weeks[idx]
      const [day, s] = (Object.entries(w.sessions) as [string, Session][])
        .find(([, x]) => x && x.zone === 'Zone 2–3')!
      const stripped = { ...s }
      delete (stripped as any).lr_segment_pace
      const sabotaged: Plan = {
        ...plan,
        weeks: plan.weeks.map((x, i) => i === idx
          ? { ...x, sessions: { ...x.sessions, [day]: stripped } }
          : x),
      }
      const vs = validatePlan(sabotaged, input)
        .filter(v => v.code === 'INV-PLAN-LR-SEGMENT-RECORDED')
      expect(vs.length, 'broadening is worthless if it cannot fire on this distance').toBeGreaterThan(0)
    })
  }

  it('the zone is DERIVED from the catalogue row, not authored beside it', () => {
    // Without this the derivation is unfalsifiable: the row happens to declare
    // exactly what the producer used to hardcode, so equality alone proves
    // nothing. Mutating the row and watching session.zone follow is the only
    // evidence that `intensity_zones` stopped being decorative.
    const row = V1_SESSION_CATALOGUE.find(r => r.id === 'mp_long_run')!
    const original = row.intensity_zones
    try {
      row.intensity_zones = ['Z2', 'Z4']
      const plan = generateRulePlan(MAR, 'paid', PLAN_START)
      const zones = new Set(allSessions(plan)
        .filter(s => s.catalogue_id === 'mp_long_run')
        .map(s => s.zone))
      expect(zones.size, 'fixture must contain mp_long_run sessions').toBeGreaterThan(0)
      expect(Array.from(zones)).toEqual(['Zone 2–4'])
    } finally {
      row.intensity_zones = original
    }
    // and the restore worked — a leaked mutation would poison every later test
    expect(row.intensity_zones).toEqual(original)
  })

  it('§47 — a step-back long run drops the race-pace ROW, not just its label', () => {
    // Found while broadening the invariant. §47 promises to "drop race-pace
    // catalogue specificity" and rewrote the label, zone, notes and segment
    // pace — but left `catalogue_id` on `mp_long_run`, so a plain Zone 2
    // step-back week still joined (ADR-018) to the marathon-pace row.
    //
    // Latent today only because `composeSession` derives its MP sub-shape from
    // the LABEL. This asserts the join, not the rendering, so the guarantee
    // survives the day someone re-keys that heuristic onto `catalogue_id`.
    const plan = generateRulePlan(MAR, 'paid', PLAN_START)
    const stepBacks = allSessions(plan).filter(s =>
      s.label === 'Long run — Zone 2' && s.zone === 'Zone 2')
    expect(stepBacks.length, 'fixture must contain a §47 step-back').toBeGreaterThan(0)
    for (const s of stepBacks) {
      expect(s.catalogue_id, `"${s.label}" must not claim a race-pace row`).toBeUndefined()
      expect(s.lr_segment_pace, 'and must not claim a segment either').toBeUndefined()
    }
    // the race-pace weeks are untouched — this strips the step-backs, not §25
    const kept = allSessions(plan).filter(s => s.catalogue_id === 'mp_long_run')
    expect(kept.length, '§25 sessions keep their row').toBeGreaterThan(0)
    for (const s of kept) expect(s.zone).toBe('Zone 2–3')
  })

  it('zoneStringFromZoneKeys round-trips with zonesFromZoneString', () => {
    for (const keys of [['Z2'], ['Z2', 'Z3'], ['Z3', 'Z4'], ['Z4', 'Z5'], ['Z1', 'Z5']]) {
      const str = zoneStringFromZoneKeys(keys)!
      expect(str, `${keys} must render`).toBeTruthy()
      const back = zonesFromZoneString(str)
      const nums = keys.map(k => Number(k.slice(1)))
      expect(back[0]).toBe(Math.min(...nums))
      expect(back[back.length - 1]).toBe(Math.max(...nums))
    }
    expect(zoneStringFromZoneKeys([])).toBeNull()
    expect(zoneStringFromZoneKeys(undefined)).toBeNull()
    // the engine writes an en-dash; a hyphen here would silently break every
    // `s.zone === 'Zone 2\u20133'` comparison in the invariants
    expect(zoneStringFromZoneKeys(['Z2', 'Z3'])).toBe('Zone 2–3')
  })
})
