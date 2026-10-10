// BASEBUILD-ZONE-CEILING-01 — Coaching Board, 2026-10-10, CORRECT WITH AMENDMENT.
//
// 🔴 THE DEFECT, MEASURED ON BOTH LIVE BASE-BUILD PLANS. Every session carried
// `zone: "Zone 2"` and **ZERO carried an `hr_target`** — 51/51 and 30/30 — against
// ~86% on race plans (57/66, 69/75, 62/74, 51/51). §84 Am.1 says `hr_target` IS the
// prescription and `session.zone` is a label ABOUT it, so the label stood alone.
// `generateBaseBuildPlan` built its meta from scratch and never computed zones.
//
// ⚠️ THE MECHANISM ALREADY EXISTED. `generateFoundationBlock` sets `hr_target` from
// `easyTargets`; `foundationCompose` passes it via `easyTargetsFromPlan(plan)`, which
// reads a GENERATED plan — and a base build has none at that point. That chicken-and-egg
// is why it was never threaded. The fix derives from the INPUT instead.
import { describe, it, expect } from 'vitest'
import { generateGetRunningPlan } from './getRunningPlan'
import { validatePlan } from './invariants'
import type { GeneratorInput, Session } from '@/types/plan'

const PINNED = '2026-10-12'
const RUNWAY = 29

const input = (over: Record<string, unknown> = {}): GeneratorInput => ({
  race_distance_km: 42.2, race_date: '2027-04-24', current_weekly_km: 10,
  longest_recent_run_km: 8, days_available: 4, training_age: '6-18mo',
  goal: 'finish', user_declared_level: 'beginner', ...over,
} as unknown as GeneratorInput)

const sessionsOf = (p: { weeks: Array<{ sessions?: Record<string, Session | null> }> }): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions ?? {})).filter((s): s is Session => !!s)

const meta = (p: unknown) => (p as { meta: Record<string, unknown> }).meta

describe('BASEBUILD-ZONE-CEILING-01', () => {
  it('1. 🔴 every session that shows a zone now carries an hr_target', () => {
    const { plan } = generateGetRunningPlan(input({ age: 40, max_hr: 195, max_hr_source: 'user_confirmed', resting_hr: 50 }), PINNED, RUNWAY)
    const s = sessionsOf(plan)
    expect(s.length).toBeGreaterThan(20)
    const labelled = s.filter(x => x.zone)
    expect(labelled.length, 'the population must not be empty').toBe(s.length)
    expect(labelled.filter(x => !x.hr_target), 'a zone label with nothing behind it').toEqual([])
  })

  it('2. 🔴 AMENDMENT 1 — the max is derived through §50, NEVER the raw input', () => {
    // The LIVE paid runner: age 25, observed max 182, Tanaka 191. §50 rejects a
    // recorded max below the age estimate as a device FLOOR. Deriving raw would give
    // a Z2 ceiling ~6 bpm low for fifteen weeks — the 2026-08-06 incident.
    const { plan } = generateGetRunningPlan(
      input({ age: 25, max_hr: 182, max_hr_source: 'observed', resting_hr: 56 }), PINNED, RUNWAY)
    expect(meta(plan).hr_zone_method).toBe('age_estimate_max_floor')
    expect(meta(plan).hr_derived_max, 'zones must be built on the ESTIMATE, not the floor').toBe(191)
    expect(meta(plan).zone2_ceiling).toBe(151)
    // ...and the number the runner sees follows the derived max, not the supplied one.
    expect(sessionsOf(plan)[0].hr_target).toBe('< 151 bpm')
  })

  it('3. 🔴 AMENDMENT 3 (Sims) — the provenance note is MANDATORY with the number', () => {
    const floored = generateGetRunningPlan(
      input({ age: 25, max_hr: 182, max_hr_source: 'observed', resting_hr: 56 }), PINNED, RUNWAY).plan
    expect(String(meta(floored).hr_assumption_note)).toContain('182')
    expect(String(meta(floored).hr_assumption_note)).toContain('191')

    // No HR data at all → still a ceiling (Tanaka), still a note saying it is estimated.
    const estimated = generateGetRunningPlan(input({ age: 26 }), PINNED, RUNWAY).plan
    expect(meta(estimated).hr_zone_method).toBe('percent_of_estimated_max')
    expect(String(meta(estimated).hr_assumption_note)).toMatch(/estimated from age alone/)
    expect(sessionsOf(estimated)[0].hr_target).toBeTruthy()
  })

  it('4. ⚠️ AMENDMENT 4 (McMillan) — a CEILING, and the talk test stays FIRST', () => {
    const { plan } = generateGetRunningPlan(input({ age: 40, resting_hr: 50 }), PINNED, RUNWAY)
    const easy = sessionsOf(plan).filter(s => s.type === 'easy')
    expect(easy.length).toBeGreaterThan(0)
    // "< NNN bpm" — a ceiling, never a band or a target.
    for (const s of easy) expect(String(s.hr_target)).toMatch(/^< \d+ bpm$/)
    // The effort cue is unchanged and still leads.
    const talk = easy.find(s => (s.coach_notes ?? []).some(n => /hold a conversation/.test(String(n))))
    expect(talk, 'the talk-test note must survive').toBeTruthy()
    expect(String(talk!.coach_notes?.[0]), 'and must stay FIRST — the number is the backstop').toMatch(/Zone 2 only/)
  })

  it('5. INV-PLAN-HR-ASSUMPTIONS-SURFACED no longer fires — it did on both live plans', () => {
    const { plan } = generateGetRunningPlan(input({ age: 25, max_hr: 182, max_hr_source: 'observed', resting_hr: 56 }), PINNED, RUNWAY)
    const codes = validatePlan(plan, input({ age: 25 }) as never).map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-HR-ASSUMPTIONS-SURFACED')
    expect(codes).not.toContain('INV-PLAN-ZONE-LABEL-HAS-PRESCRIPTION')
  })

  it('6. 🔴 the new invariant CAN fire — a zone with no target on a derivable plan', () => {
    // Non-vacuity. Strip the targets the way the pre-fix producer left them.
    const { plan } = generateGetRunningPlan(input({ age: 40, resting_hr: 50 }), PINNED, RUNWAY)
    for (const w of plan.weeks)
      for (const s of Object.values(w.sessions ?? {})) if (s) delete (s as { hr_target?: string }).hr_target
    const v = validatePlan(plan, input({ age: 40 }) as never)
      .filter(x => x.code === 'INV-PLAN-ZONE-LABEL-HAS-PRESCRIPTION')
    expect(v.length, 'the rule must be wakeable').toBeGreaterThan(0)
    expect(v[0].severity).toBe('error')
  })

  it('7. ⚠️ and it does NOT fire when nothing could be derived', () => {
    // The escape hatch is DERIVABILITY, not absence of supplied data: no age and no
    // max means no Tanaka, so there is no number to give and no breach to report.
    const { plan } = generateGetRunningPlan(input(), PINNED, RUNWAY)
    if (meta(plan).hr_derived_max != null) return // age defaulted somewhere; nothing to assert
    for (const w of plan.weeks)
      for (const s of Object.values(w.sessions ?? {})) if (s) delete (s as { hr_target?: string }).hr_target
    const v = validatePlan(plan, input() as never)
      .filter(x => x.code === 'INV-PLAN-ZONE-LABEL-HAS-PRESCRIPTION')
    expect(v).toEqual([])
  })
})
