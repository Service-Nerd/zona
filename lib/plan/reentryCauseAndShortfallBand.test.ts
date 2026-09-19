import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import type { GeneratorInput } from '@/types/plan'

// Coaching Board 2026-09-19 — two rulings from the plan-review round.
//
//  F1 §79 Amendment 5 (REENTRY-CAUSE-01)  — the re-entry note must name the
//      reason the window actually opened.
//  F2 §44 Amendment  (DIFFICULTY-SHORTFALL-01) — a plan that declares a
//      shortfall may not read 'comfortable'.
//
// ⚠️ WHAT THE BOARD REJECTED IS PINNED HERE TOO. The submitted version of F2
// was "the band should read training load (duration, ramp, age)". That was
// ruled INCORRECT against §44 point 3 — the band is derived only from
// PRE-GENERATION feasibility, and Willy authored that constraint. Case 6 pins
// the rejection: a long session alone must NOT move the band. Without it the
// next person reads the amendment and widens it the way the board refused.

const BASE = {
  athlete_name: 'A', age: 35, race_name: 'T', primary_metric: 'distance',
  race_date: '2027-06-06', plan_start: '2026-11-02', goal: 'finish',
  resting_hr: 50, max_hr: 185, injury_history: [],
  hard_session_relationship: 'neutral',
} as unknown as GeneratorInput

const mk = (o: Record<string, unknown>) => ({ ...BASE, ...o }) as unknown as GeneratorInput

/** Demonstrably-ready (ADR-021 §89): experienced, deep age, regular quality, no injury. */
const READY = mk({
  race_distance_km: 42.2, fitness_level: 'experienced', training_age: '5yr+',
  current_weekly_km: 70, longest_recent_run_km: 30, days_available: 5,
  recent_quality_training: 'regular',
})

describe('F1 — §79 Am. 5: the re-entry note names the real cause', () => {
  it('1. a demonstrably-ready runner is NEVER told they are coming back', () => {
    const m = generateRulePlan(READY, 'paid').meta as unknown as Record<string, string | undefined>
    if (!m.intensity_reentry_omission_note) return   // window did not open: nothing to check
    expect(m.intensity_reentry_cause).toBe('early_onset')
    expect(m.intensity_reentry_omission_note).not.toMatch(/coming back/i)
    expect(m.intensity_reentry_omission_note).toMatch(/starts earlier than standard/i)
  })

  it('2. ACROSS THE COHORT: no non-returning runner sees "coming back"', () => {
    // The measurement that produced the ruling: 120 plans carried the copy and
    // 96 of them were early-onset. Asserted as a property, not a single case.
    let shown = 0, wrong = 0, earlyOnset = 0
    for (const km of [10, 21.1, 42.2, 50]) for (const ta of ['2-5yr', '5yr+'] as const)
    for (const cwk of [40, 55, 70]) for (const rq of ['occasional', 'regular'] as const) {
      const plan = generateRulePlan(mk({
        race_distance_km: km, fitness_level: 'experienced', training_age: ta,
        current_weekly_km: cwk, longest_recent_run_km: Math.round(Math.min(cwk * 0.45, km * 0.75)),
        days_available: 5, recent_quality_training: rq,
      }), 'paid')
      const m = plan.meta as unknown as Record<string, string | undefined>
      if (!m.intensity_reentry_omission_note) continue
      if (m.intensity_reentry_cause === 'early_onset') earlyOnset++
      if (/coming back/i.test(m.intensity_reentry_omission_note)) {
        shown++
        if (m.intensity_reentry_cause !== 'returning') wrong++
      }
    }
    expect(earlyOnset).toBeGreaterThan(0)   // the cohort is reachable at all
    expect(wrong).toBe(0)
    expect(shown).toBeGreaterThan(0)        // and the correct copy still ships to returners
  })

  it('3. a note with no stamped cause is an error-severity violation', () => {
    const plan = generateRulePlan(READY, 'paid')
    const m = plan.meta as unknown as Record<string, unknown>
    if (!m.intensity_reentry_omission_note) return
    delete m.intensity_reentry_cause
    const v = validatePlan(plan, READY).filter(x => x.severity === 'error')
    expect(v.map(x => x.code)).toContain('INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE')
  })

  it('4. the invariant FIRES on the exact defect it was written for', () => {
    const plan = generateRulePlan(READY, 'paid')
    const m = plan.meta as unknown as Record<string, unknown>
    if (!m.intensity_reentry_omission_note) return
    // Put the old copy back on an early-onset plan: this is the live defect.
    m.intensity_reentry_omission_note =
      'No interval or hill sessions this block. You are coming back, so the quality work leads with tempo and threshold.'
    const v = validatePlan(plan, READY).filter(x => x.severity === 'error')
    expect(v.map(x => x.code)).toContain('INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE')
  })
})

describe('F2 — §44 Am.: a declared shortfall may not read comfortable', () => {
  // A REAL shortfall case, and specifically one classified `optimal` — so it is
  // not already caught by the pre-existing `constrained_by_inputs` arm. Before
  // this amendment it read 'comfortable' while telling the runner the plan does
  // not reach the target. 721 of the 751 affected plans were `optimal` like this.
  const SHORTFALL = mk({
    race_distance_km: 5, fitness_level: 'beginner', training_age: '<6mo',
    current_weekly_km: 20, longest_recent_run_km: 4, days_available: 3,
    goal: 'time_target', target_time: '0:25:00', recent_quality_training: 'occasional',
  })

  it('5. a plan declaring a shortfall reads demanding, and says why', () => {
    const m = generateRulePlan(SHORTFALL, 'paid').meta as unknown as Record<string, string | undefined>
    expect(m.compression_classification).toBe('optimal')   // not the old arm
    const declared = m.long_run_shortfall_note || m.peak_shortfall_note || m.volume_shortfall_note
    expect(declared).toBeTruthy()
    expect(m.difficulty_band).not.toBe('comfortable')
    expect(m.difficulty_note).toBeTruthy()
  })

  it('6. THE BOARD REJECTED load-awareness — a long session alone must NOT move the band', () => {
    // §44 point 3 (Willy): derived only from pre-generation feasibility, never
    // plan-quality signals. A plan with a very long session and no shortfall,
    // no compression and an adequate timeline stays 'comfortable'.
    const plan = generateRulePlan(mk({
      race_distance_km: 42.2, fitness_level: 'experienced', training_age: '5yr+',
      current_weekly_km: 70, longest_recent_run_km: 30, days_available: 5,
      recent_quality_training: 'regular',
    }), 'paid')
    const m = plan.meta as unknown as Record<string, string | undefined>
    const declared = m.long_run_shortfall_note || m.peak_shortfall_note || m.volume_shortfall_note
    let longest = 0
    for (const w of plan.weeks) for (const s of Object.values(w.sessions ?? {})) {
      const mins = (s as { duration_mins?: number } | undefined)?.duration_mins ?? 0
      longest = Math.max(longest, mins)
    }
    expect(longest).toBeGreaterThan(120)          // it IS a long-session plan
    if (!declared && m.compression_classification === 'optimal') {
      expect(m.difficulty_band).toBe('comfortable')
    }
  })

  it('7. ACROSS THE COHORT: comfortable + a shortfall is now zero', () => {
    let comfortable = 0, both = 0, shortfalls = 0
    // ⚠️ The grid MUST vary goal and training_age: peak_shortfall_note was 607
    // of the 751, and it needs a time target to fire. The first cut of this
    // test swept finish-only 2-5yr runners, produced ZERO shortfalls, and
    // asserted `both === 0` against an empty population — a green tick behind
    // nothing, which is this repo's most-recorded failure. Hence `shortfalls > 0`.
    for (const km of [5, 10, 21.1, 42.2]) for (const lvl of ['beginner', 'intermediate', 'experienced'] as const)
    for (const ta of ['<6mo', '2-5yr'] as const)
    for (const cwk of [10, 20, 30, 60]) for (const days of [3, 5])
    for (const goal of ['finish', 'time_target'] as const) {
      // A designed refusal (§111/§44/§52) is a valid outcome in a grid this
      // wide, not a failure. Matched by CLASS via `isDesignedRefusal` — never
      // by its message, which is runner-facing copy that changes for tone.
      let plan
      try {
        plan = generateRulePlan(mk({
          race_distance_km: km, fitness_level: lvl, training_age: ta,
          current_weekly_km: cwk, longest_recent_run_km: Math.round(Math.min(cwk * 0.45, km * 0.75)),
          days_available: days, recent_quality_training: 'occasional', goal,
          ...(goal === 'time_target'
            ? { target_time: km <= 5 ? '0:25:00' : km <= 10 ? '0:50:00' : km <= 21.1 ? '1:55:00' : '4:15:00' }
            : {}),
        }), 'paid')
      } catch (e) {
        if (isDesignedRefusal(e)) continue
        throw e
      }
      const m = plan.meta as unknown as Record<string, string | undefined>
      const declared = !!(m.long_run_shortfall_note || m.peak_shortfall_note || m.volume_shortfall_note)
      if (declared) shortfalls++
      if (m.difficulty_band === 'comfortable') {
        comfortable++
        if (declared) both++
      }
    }
    expect(shortfalls).toBeGreaterThan(0)   // the condition is reachable
    expect(comfortable).toBeGreaterThan(0)  // comfortable still exists
    expect(both).toBe(0)
  })

  it('8. the extended invariant fires on the exact defect', () => {
    const plan = generateRulePlan(SHORTFALL, 'paid')
    ;(plan.meta as unknown as Record<string, unknown>).difficulty_band = 'comfortable'
    const v = validatePlan(plan, SHORTFALL).filter(x => x.severity === 'error')
    expect(v.map(x => x.code)).toContain('INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE')
  })
})
