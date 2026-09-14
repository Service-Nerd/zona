// §24e / CAT-ULTRA-FUELLING-01 — the peak-phase fuelling cue on the ultra long run.
//
// Coaching Board batch sitting 2026-09-13, item 7: CORRECT, re-spec'd as a
// phase-anchored coach note. The concept was ruled 2026-09-10 with Sims leading —
// under-fuelling a 4–6 h effort is the RED-S / low-energy-availability vector,
// and it lands hardest on the women and masters runners this distance serves.
//
// The struck `fuelling_practice_from_week: 8` was wrong twice over: the wrong
// SHAPE (an absolute week index means different things in a 16- vs 22-week plan)
// and the wrong OBJECT (fuelling is not a scheduled session).
//
// What the board could not have known, measured here first: `fuel_every_mins`
// lives on `ultra_race_sim` (25) and `time_on_feet` (30), but **100% of 50K/100K
// peak long runs carry no catalogue row at all** — those rows only ever land in
// the quality slot. So the cadence is drawn as a RANGE across every ultra row
// that declares one. Picking 25 or 30 would have been a new coaching numeric,
// which is precisely what the ruling excluded.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE, ultraFuellingCadenceMins } from './sessionCatalogueData'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const PLAN_START = '2026-09-14'
const FUEL = /Fuel every/

const base = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-06-12', goal: 'finish',
  age: 40, resting_hr: 55, max_hr: 180, days_available: 5,
  fitness_level: 'intermediate', current_weekly_km: 70, longest_recent_run_km: 28,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

const entries = (p: Plan): { s: Session; phase?: string; type?: string }[] =>
  p.weeks.flatMap(w => (Object.values(w.sessions ?? {}) as (Session | undefined)[])
    .filter((s): s is Session => !!s)
    .map(s => ({ s, phase: w.phase, type: w.type })))

const hasCue = (s: Session) => (s.coach_notes ?? []).some(n => !!n && FUEL.test(n))
const isPeak = (e: { phase?: string; type?: string }) => e.phase === 'peak' && e.type !== 'deload'

describe('§24e — ultra peak long runs carry the fuelling cue', () => {
  for (const km of [50, 100]) {
    it(`${km}K: every peak long run carries it, and nothing else does`, () => {
      const plan = generateRulePlan(base({ race_distance_km: km } as Partial<GeneratorInput>), 'paid', PLAN_START)
      const all = entries(plan)
      const peakLRs = all.filter(e => isPeak(e) && isLongRun(e.s))
      expect(peakLRs.length, 'fixture must contain ultra peak long runs').toBeGreaterThan(0)
      for (const e of peakLRs) expect(hasCue(e.s), 'peak long run must carry the cue').toBe(true)

      // Containment. Peak ONLY and long-run ONLY — a cue on every long run is
      // wallpaper (§24c/§96's own reasoning), and a cue on an easy run is noise.
      const leaked = all.filter(e => hasCue(e.s) && !(isPeak(e) && isLongRun(e.s)))
      expect(leaked.map(e => e.s.label), 'the cue must not leak').toEqual([])
    })
  }

  it('non-ultra distances never receive it', () => {
    for (const km of [5, 10, 21.1, 42.2]) {
      const plan = generateRulePlan(base({
        race_distance_km: km,
        current_weekly_km: 45, longest_recent_run_km: 18,
      } as Partial<GeneratorInput>), 'paid', PLAN_START)
      expect(entries(plan).filter(e => hasCue(e.s)), `${km}K must not fuel-cue`).toEqual([])
    }
  })

  it('survives the cohorts that stack other long-run notes', () => {
    // `appendCoachNote` silently returns when a session already holds 3 notes,
    // so reach is not enough on the default runner. `overdo` adds §96's Z2
    // ceiling cue to EVERY long run; these are the plans most likely to be full.
    for (const hsr of ['overdo', 'love', 'neutral', 'avoid'] as const) {
      for (const goal of ['finish', 'time_target'] as const) {
        const plan = generateRulePlan(base({
          race_distance_km: 100, goal, hard_session_relationship: hsr,
          ...(goal === 'time_target' ? { target_time: '14:00:00' } : {}),
        } as Partial<GeneratorInput>), 'paid', PLAN_START)
        const peakLRs = entries(plan).filter(e => isPeak(e) && isLongRun(e.s))
        expect(peakLRs.length, `${hsr}/${goal} must generate`).toBeGreaterThan(0)
        for (const e of peakLRs) {
          expect(hasCue(e.s), `${hsr}/${goal} must still carry the cue`).toBe(true)
          expect((e.s.coach_notes ?? []).filter(Boolean).length).toBeLessThanOrEqual(3)
        }
      }
    }
  })

  it('§24e still holds — the cue adds no pace overlay', () => {
    for (const km of [50, 100]) {
      const input = base({ race_distance_km: km } as Partial<GeneratorInput>)
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      expect(
        validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-ULTRA-NO-PACE-SEGMENTS'),
        'a fuelling note is not a pace segment',
      ).toEqual([])
      // and no coach note names a zone, which would contradict §84's derived label
      for (const e of entries(plan).filter(x => hasCue(x.s))) {
        const cue = (e.s.coach_notes ?? []).find(n => !!n && FUEL.test(n))!
        expect(cue).not.toMatch(/Zone \d/)
      }
    }
  })

  it('the cadence is READ from the catalogue, not written into the copy', () => {
    // Same discipline as LR-SEGMENT-RECORDED-§25: the declared value happens to
    // match what a hardcode would say, so only mutating the source proves the
    // read is live. Without this, `fuel_every_mins` stays decorative config.
    expect(ultraFuellingCadenceMins()).toEqual({ min: 25, max: 30 })

    const row = V1_SESSION_CATALOGUE.find(r => r.id === 'time_on_feet')!
    const original = row.main_set_structure
    try {
      row.main_set_structure = { ...original, fuel_every_mins: 45 }
      expect(ultraFuellingCadenceMins()).toEqual({ min: 25, max: 45 })
      const plan = generateRulePlan(base({ race_distance_km: 100 } as Partial<GeneratorInput>), 'paid', PLAN_START)
      const cues = entries(plan).filter(e => hasCue(e.s))
        .map(e => (e.s.coach_notes ?? []).find(n => !!n && FUEL.test(n))!)
      expect(cues.length).toBeGreaterThan(0)
      for (const c of cues) expect(c).toContain('every 25–45 minutes')
    } finally {
      row.main_set_structure = original
    }
    expect(ultraFuellingCadenceMins()).toEqual({ min: 25, max: 30 })
  })

  it('says nothing rather than inventing an interval when no row declares one', () => {
    expect(ultraFuellingCadenceMins([])).toBeNull()
    const noFuel = V1_SESSION_CATALOGUE.map(r => ({
      ...r,
      main_set_structure: Object.fromEntries(
        Object.entries(r.main_set_structure).filter(([k]) => k !== 'fuel_every_mins')),
    }))
    expect(ultraFuellingCadenceMins(noFuel)).toBeNull()
  })

  it('the copy is in voice — no em dash, an en dash in the range', () => {
    const plan = generateRulePlan(base({ race_distance_km: 50 } as Partial<GeneratorInput>), 'paid', PLAN_START)
    const cue = entries(plan).filter(e => hasCue(e.s))
      .map(e => (e.s.coach_notes ?? []).find(n => !!n && FUEL.test(n))!)[0]
    expect(cue).toBeTruthy()
    expect(cue, 'em dashes are out of the brand (founder call 2026-09-11)').not.toContain('—')
    expect(cue, 'a range takes an en dash').toContain('–')
    expect(cue, 'never motivational').not.toMatch(/!|you've got this|crush/i)
  })
})
