import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { sessionSplit } from './sessionFormat'
import { GENERATION_CONFIG } from './generationConfig'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { isV2Structure, StructureV2Schema } from './sessionStructureV2'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * §8 Amendment (Coaching Board 2026-09-04) — a quality session's distance is
 * priced SEGMENT BY SEGMENT.
 *
 * THE DEFECT. `effectiveDistKm` divided the WHOLE session duration by the WORK
 * pace, so a 15-minute warm-up and a 4.5-minute cool-down were priced at
 * threshold or VO2max pace. A card read 10 km while its own displayed steps
 * summed to 8.4. Measured overstatement: 5K 25.7%, 10K 23.5%, HM 11.4%,
 * MAR 19.1%. `weekly_km` sums these, so the inflation landed specifically on the
 * hard component — the one every ratio is measured against (Willy).
 *
 * TWO THINGS THIS FIX HAD TO GET RIGHT, both found by tests rather than reasoning:
 *
 *   1. DURATION MUST NOT FOLLOW DISTANCE DOWN. Distance and duration were two
 *      views of one number, so segment-pricing the distance dragged the duration
 *      with it — a 4 x 5 min session reading 41 minutes instead of 46, which is
 *      the defect §40b Amendment 2 fixed for hill reps the same day. They are now
 *      derived independently: duration from the structure, distance per segment.
 *
 *   2. FLOOR CHECKS MUST USE THE SAME PRICING. `pacedRepPlan`'s floor loop still
 *      divided by work pace, and `tempo_continuous` had no floor protection at
 *      all — a low-volume 10K taper produced a 4.5 km quality session against a
 *      5 km floor. A floor measured in different units from the thing it guards
 *      is not a floor.
 */

const PLAN_START = '2026-09-07'

const TENK: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  fitness_level: 'experienced', training_age: '2-5yr',
} as GeneratorInput

// The profile that produced the 4.5 km under-floor session: very low volume,
// finish goal, upward declaration. From `userDeclaredLevel.test.ts`.
const LOW_VOLUME: GeneratorInput = {
  race_date: '2026-12-14', race_distance_km: 10, goal: 'finish',
  days_available: 4, age: 40, current_weekly_km: 15, longest_recent_run_km: 6,
  user_declared_level: 'experienced',
} as GeneratorInput

const sessionsOf = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter((s): s is Session => !!s))
const paceMid = (p?: string | null): number | null => {
  if (!p) return null
  // CLAUDE.md: spread on an iterator fails under this tsconfig target — Array.from.
  const m = Array.from(p.matchAll(/(\d+):(\d{2})/g)).map(x => +x[1] + +x[2] / 60)
  return m.length ? m.reduce((a, b) => a + b, 0) / m.length : null
}

describe('§8 — a quality session states the distance it actually covers', () => {
  it('prices warm-up and cool-down at EASY pace, not work pace', () => {
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const easy = paceMid(sessionsOf(plan).find(s => s.type === 'easy')?.pace_target)!
    const structured = sessionsOf(plan).filter(s => s.derived_set && s.pace_target && s.distance_km && s.duration_mins)
    expect(structured.length, 'no structured session — test reaches nothing').toBeGreaterThan(0)

    for (const s of structured) {
      const work = paceMid(s.pace_target)!
      const sp = sessionSplit(s.duration_mins!)
      const expected = (sp.warmup + sp.cooldown) / easy + sp.main / work
      // The old formula was total / work — always LARGER, since easy is slower.
      const oldWay = s.duration_mins! / work
      expect(s.distance_km!, `${s.label} is still priced at work pace throughout`)
        .toBeLessThan(oldWay - 0.4)
      expect(Math.abs(s.distance_km! - expected), `${s.label} does not match segment pricing`)
        .toBeLessThanOrEqual(0.6)   // rounding to DISTANCE_ROUNDING_PRECISION_KM
    }
  })

  it('duration is driven by structure and did NOT follow distance down', () => {
    // Regression on the bug this fix introduced and then corrected. A 4 x 5 min
    // session with 90s jogs is 26 min of main set, which needs ~46 min total —
    // it must not read 41 because its distance shrank.
    // Re-anchored 2026-09-04 (CB-CAT-01). This pinned `tempo_cruise_short` by id,
    // and the three new threshold rows widened the 10K eligible pool from 3-5 to
    // 8 — so the plan stopped containing that specific row and the test asserted
    // nothing while still passing its first expectation. Anchor on the PROPERTY
    // the regression is about (a reps-scaled session's duration follows its own
    // structure) rather than on one row that happened to demonstrate it.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const repsSessions = sessionsOf(plan).filter(s => {
      const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
      if (!row || !isV2Structure(row.main_set_structure)) return false
      const parsed = StructureV2Schema.safeParse(row.main_set_structure)
      return parsed.success && parsed.data.sizing.scaling === 'reps' && row.category === 'threshold'
    })
    expect(repsSessions.length, 'no reps-scaled threshold session to check').toBeGreaterThan(0)
    let checked = 0
    for (const s of repsSessions) {
      const blocks = s.derived_set?.blocks ?? []
      const work = paceMid(s.pace_target)
      if (work == null) continue
      // Distance reps ("1600 m") are CONVERTED at the session's own work pace,
      // not skipped. A first pass skipped them and emptied the test — every
      // reps-scaled threshold session in this fixture is distance-based since
      // the pool widened, so the guard below reported "asserts nothing", which
      // is the outcome this file exists to prevent. A second pass parsed them
      // loosely and read "1600 m" as 1600 MINUTES, demanding a 4805-minute
      // session. Both are the same mistake: treating a display string as data.
      const mainMins = blocks.reduce((total, b) => total + b.repeat * b.steps.reduce((sum, step) => {
        const len = step.length ?? ''
        const dist = /^(\d+)\s*m$/.exec(len)
        if (dist) return sum + (+dist[1] / 1000) * work
        const dur = /^(\d+)(?::(\d{2}))?\s*(min|s)\b/.exec(len)
        if (!dur) return sum
        if (dur[3] === 's') return sum + +dur[1] / 60
        return sum + +dur[1] + (dur[2] ? +dur[2] / 60 : 0)
      }, 0), 0)
      if (mainMins <= 0) continue
      checked++
      // Duration must cover the main set — the bug was a session reading 41 min
      // for a 26 min main set because its DISTANCE shrank under segment pricing
      // and the duration followed it down.
      expect(s.duration_mins!, `${s.label} duration is below its own main set`)
        .toBeGreaterThanOrEqual(Math.round(mainMins))
    }
    // A suite that checks nothing and reports green is the exact failure this
    // file's own history is about — assert the loop above actually ran.
    expect(checked, 'every candidate session was skipped — test asserts nothing').toBeGreaterThan(0)
  })

  it('no quality session falls under the distance floor — including continuous shapes', () => {
    // `tempo_continuous` had NO floor protection; segment pricing exposed it.
    for (const input of [TENK, LOW_VOLUME]) {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      const quality = sessionsOf(plan).filter(s => s.type === 'quality' && s.distance_km != null)
      expect(quality.length).toBeGreaterThan(0)
      for (const s of quality) {
        expect(s.distance_km!, `${s.label} under the quality floor`)
          .toBeGreaterThanOrEqual(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.quality)
      }
      expect(validatePlan(plan, input).filter(v => v.severity === 'error')).toEqual([])
    }
  })

  it('freed distance goes to EASY, not back into quality — weekly volume holds', () => {
    // The board's amendment, unanimous across McMillan/Willy/Sims. §9's
    // re-derivation sums ACTUAL placed distances, so a smaller quality session
    // enlarges the easy runs rather than shrinking the week.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    for (const w of plan.weeks.filter(w => w.n > 0 && w.type !== 'race')) {
      const placed = Object.values(w.sessions)
        .filter((s): s is Session => !!s && s.type !== 'strength' && s.type !== 'rest')
        .reduce((a, s) => a + (s.distance_km ?? 0), 0)
      if (placed === 0) continue
      // Within rounding of the week's own stated volume — no silent leakage.
      expect(Math.abs(placed - w.weekly_km), `W${w.n} sessions do not sum to weekly_km`)
        .toBeLessThanOrEqual(1.5)
    }
  })
})
