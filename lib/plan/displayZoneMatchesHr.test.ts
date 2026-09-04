import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * §84 Amendment (Coaching Board 2026-09-04) — the zone STRING and the HR TARGET
 * must describe the same band.
 *
 * THE DEFECT, as the founder saw it. One Session Detail card read
 * "Zone 3–4 · threshold / 145–172 bpm" as its headline and, six lines below,
 * "Hold 145–158 bpm for the whole interval". Both components were faithful; the
 * engine's two fields disagreed. `zone: 'Zone 3–4'` sat beside
 * `hr_target: zones.qualityHR`, and qualityHR is `z3Low–z3Top` — Zone 3 ONLY.
 *
 * §84 (shipped the same morning) made the header derive its band from the zone
 * string, having asserted in its own Config paragraph that the engine writes the
 * two "consistently in every makeQualitySession branch (threshold →
 * Zone 3–4/qualityHR; VO2 + hills → Zone 4–5/intervalsHR)". True for the second
 * pair, ASSUMED for the first. Before §84 the header read hr_target and the two
 * surfaces agreed — so the contradiction on screen was hours old, though the data
 * inconsistency long predated it.
 *
 * The fix pairs the zone string with the HR string at construction
 * (`zones.qualityZone`/`intervalsZone`) so they cannot be authored apart. No
 * prescribed heart rate changed — this is a relabel, and the golden snapshots
 * confirm it: 41 lines, all `"Zone 3–4"` → `"Zone 3"`, nothing else.
 */

const PLAN_START = '2026-09-07'
const TENK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
} as GeneratorInput

const codes = (p: Plan, i: GeneratorInput) => validatePlan(p, i).map(v => v.code)
const sessionsOf = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter((s): s is Session => !!s))

describe('§84 — zone string and hr_target describe one band', () => {
  it('a threshold session reads Zone 3, matching its own Zone 3 HR target', () => {
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const threshold = sessionsOf(plan).filter(s => s.hr_target && /^\d+–\d+ bpm$/.test(s.hr_target)
      && s.zone === 'Zone 3')
    expect(threshold.length, 'no Zone 3 session — test reaches nothing').toBeGreaterThan(0)
    // The pairing that was broken: Zone 3 must not sit beside a Zone 3–4 band.
    for (const s of threshold) expect(s.zone).not.toBe('Zone 3–4')
  })

  it('every range-HR session agrees with its zone string', () => {
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    expect(codes(plan, TENK)).not.toContain('INV-PLAN-DISPLAY-ZONE-MATCHES-WORK')
  })

  it('fires when the two are made to disagree — the exact shipped defect', () => {
    // FALSIFICATION. Recreate what the founder photographed.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const broken: Plan = JSON.parse(JSON.stringify(plan))
    const victim = sessionsOf(broken).find(s => s.zone === 'Zone 3' && /^\d+–\d+ bpm$/.test(s.hr_target ?? ''))
    expect(victim, 'no Zone 3 session to break').toBeTruthy()
    victim!.zone = 'Zone 3–4'          // label widens, target does not follow
    const v = validatePlan(broken, TENK).filter(x => x.code === 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK')
    expect(v.length).toBeGreaterThan(0)
    expect(v[0].severity).toBe('error')
  })

  it('VO2max sessions were already consistent and stay so', () => {
    // §84's Config claim was true for this pair. Pinned so a future edit to the
    // zone pairing cannot break the half that worked.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const vo2 = sessionsOf(plan).filter(s => s.zone === 'Zone 4–5' && s.hr_target)
    expect(vo2.length).toBeGreaterThan(0)
    expect(codes(plan, TENK)).not.toContain('INV-PLAN-DISPLAY-ZONE-MATCHES-WORK')
  })

  it('does NOT fire on a ceiling target — a cap is a different claim from a span', () => {
    // Easy runs carry "< 145 bpm" against "Zone 2"; the display renders `hi <= 2`
    // as "< top", so both surfaces agree. The `Zone 2–3` long run with a
    // marathon-pace finish is deliberately OUT of scope (its ceiling describes the
    // aerobic portion, not the faster finish) — 48 sessions, recorded in the
    // backlog rather than swept in under a ruling that did not cover it.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const ceilings = sessionsOf(plan).filter(s => (s.hr_target ?? '').startsWith('<'))
    expect(ceilings.length).toBeGreaterThan(0)
    expect(codes(plan, TENK)).not.toContain('INV-PLAN-DISPLAY-ZONE-MATCHES-WORK')
  })
})
