import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { validatePlan } from './invariants'
import { isLongRun, isStructuredSession } from './sessionRole'
import { sessionFloorsFor } from './sessionFloors'
import { longRunTimeCapMins } from './longRunTimeCap'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * PRODUCER-CHECKER-AGREEMENT-01 (2026-10-03) — THE CLASS THIS REPO KEEPS PAYING FOR.
 *
 * 🔴 TWICE IN ONE DAY, the engine and the validator disagreed about the same rule:
 *
 *   MWM-FLOOR-VALIDATOR-01  `applyWeekdayMinsCap` had THREE exemptions (long run,
 *                           structured session, §82's floor) and
 *                           INV-PLAN-MAX-WEEKDAY-MINS had TWO. Two live paid marathon
 *                           plans were reported with 19 and 46 error-severity violations
 *                           for doing exactly what the Coaching Board ratified, and the
 *                           daily ops digest escalated it as a runner-impacting defect.
 *                           **The plans were correct. The report was fake.**
 *
 *   FOUNDATION-LR-S9-01     the same pair disagreed about whether §9's race ceiling
 *                           reaches a foundation week. It does not, and the validator
 *                           thought it did.
 *
 * ⚠️ THE REPO'S EXISTING DEFENCE IS A COMMENT. `applyWeekdayMinsCap` carries, in as many
 * words: *"an engine exemption the validator does not share is a plan that fails its own
 * constitution."* It has been there for a month. It did not stop either case, because a
 * rule that holds only while someone reads a comment is not a rule.
 *
 * ── WHAT THIS FILE ASSERTS, AND WHY IT IS NOT A SHARED PREDICATE ─────────────
 * It does NOT re-express either side's rule — that is the `deloadCadence.test.ts` trap: a
 * checker sharing the producer's predicate cannot catch the producer being wrong. It
 * asserts the one property neither side can check about itself:
 *
 *   **Where the ENGINE deliberately leaves a session over a limit, the VALIDATOR must not
 *   flag it — and where the engine respects a limit, the validator must not be silent
 *   about a breach the engine would never have produced.**
 *
 * Both directions, over a real population, behaviourally. If either side gains or loses an
 * exemption and the other does not follow, this fails.
 */

const FROZEN_NOW = new Date('2026-10-03T09:00:00Z')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

const PLAN_START = '2026-12-07'
const TODAY_WITH_RUNWAY = '2026-10-03'
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

const BASE = {
  age: 38, goal: 'finish', max_hr: 190, terrain: 'road', resting_hr: 57,
  training_age: '6-18mo', max_hr_source: 'observed', days_available: 4,
  user_declared_level: 'intermediate', longest_recent_run_km: 12,
  preferred_long_run_day: 'sat', recent_quality_training: 'none',
  hard_session_relationship: 'neutral', days_cannot_train: ['tuesday', 'sunday'],
  race_distance_km: 42.2, race_date: '2027-04-24', current_weekly_km: 25,
  max_weekday_mins: 30,
} as unknown as GeneratorInput

/**
 * A population that REACHES the disagreements. ⚠️ Pace is varied deliberately: §82's floor
 * binds only for runners slower than 7:30/km, and the fast-only grid in
 * `property-validate-plans.ts` is precisely why its baseline of 0 was true of the grid and
 * false of the product for a month.
 */
let refusedCount = 0
function population(): Array<{ label: string; input: GeneratorInput; plan: Plan }> {
  const out: Array<{ label: string; input: GeneratorInput; plan: Plan }> = []
  refusedCount = 0
  const benches = [
    ['fast', { type: 'race', distance_km: 10, time: '0:42:00' }],
    ['slow', { type: 'race', distance_km: 21.1, time: '2:30:00' }],
  ] as const
  const budgets: Array<[string, Record<string, number> | undefined]> = [
    ['flat', undefined],
    ['uneven', { mon: 30, wed: 60, thu: 90 }],
  ]
  for (const [bl, benchmark] of benches)
    for (const [budl, day_budgets] of budgets)
      for (const cap of [30, 60])
        for (const [vol, lrKm] of [[15, 8], [30, 12], [45, 20], [50, 20]] as const)
          for (const dist of [10, 21.1, 42.2]) {
            const input = {
              ...(BASE as any), benchmark, max_weekday_mins: cap, current_weekly_km: vol,
              // ⚠️ `longest_recent_run_km` is varied because §9's foundation case needs a
              // runner whose BASE exceeds their race need (a 10K runner at 50 km/week with a
              // 20 km long run). Holding it at 12 made the §9 arm vacuous — 0 long runs over
              // the ceiling in the whole population.
              longest_recent_run_km: lrKm,
              race_distance_km: dist,
              race_date: dist === 10 ? '2027-02-14' : dist === 21.1 ? '2027-03-14' : '2027-04-24',
              ...(day_budgets ? { day_budgets } : {}),
            } as GeneratorInput
            let plan: Plan
            // 🔴 THIS `catch` IS WHY THE FIRST VERSION OF THIS FILE WAS HOLLOW, and the
            // mechanism is worth stating because it defeats the whole point of the file.
            // `validatePlan` THROWS on error severity under NODE_ENV=test, so breaking the
            // validator made `generateRulePlan` throw — and this catch silently DELETED every
            // affected plan from the population. All three falsification mutations passed
            // against a set that no longer contained the defect they introduced.
            //
            // The plans still have to be skipped (a designed refusal is not a disagreement),
            // so the defence is to COUNT them and pin the count in the vacuity arm below. A
            // mutation that makes generation throw now collapses the population and is caught.
            try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { refusedCount++; continue }
            // Foundation weeks are half the point — the second disagreement lived there.
            let composed: Plan
            try { composed = composePlanWithFoundation(plan, input, TODAY_WITH_RUNWAY, 'add').plan }
            catch { composed = plan }
            out.push({ label: `${dist}km/${bl}/${budl}/cap${cap}/v${vol}`, input, plan: composed })
          }
  return out
}

const POP = population()

/** How many over-cap sessions of each exemption kind the population actually contains. */
function kinds() {
  let floorProtectedOverCap = 0, structuredOverCap = 0, plainOverCap = 0, foundationLrOverS9 = 0, mainLrOverS9 = 0
  for (const { input, plan } of POP) {
    const floor = sessionFloorsFor((input as any).longest_recent_run_km).easy
    const s9 = longRunTimeCapMins(input)
    for (const w of plan.weeks) {
      for (const d of WEEKDAYS) {
        const s = w.sessions[d]
        const cap = (input as any).day_budgets?.[d] ?? (input as any).max_weekday_mins
        if (!s || s.duration_mins == null || cap == null || s.duration_mins <= cap) continue
        if (isLongRun(s) || isStructuredSession(s)) { structuredOverCap++; continue }
        if (s.floor_protected === true && s.distance_km === floor) floorProtectedOverCap++
        else plainOverCap++
      }
      const lr = Object.values(w.sessions).find(x => x && isLongRun(x))
      if (lr?.duration_mins != null && lr.duration_mins > s9) {
        if (w.n <= 0) foundationLrOverS9++; else mainLrOverS9++
      }
    }
  }
  return { floorProtectedOverCap, structuredOverCap, plainOverCap, foundationLrOverS9, mainLrOverS9 }
}

describe('producer and checker agree about the weekday cap (PRODUCER-CHECKER-AGREEMENT-01)', () => {
  // ⚠️ VACUITY FIRST. An empty population passes every arm below, and this repo has shipped
  // that green tick more than once. The counts also prove the grid REACHES both shapes.
  it('has a population that REACHES each exemption kind — pinned, not assumed', () => {
    // 🔴 Pinned counts, because "some session exceeds its cap" was the first version's test
    // and it was satisfied by long runs alone while the arms below needed floor-protected
    // ones. An arm whose population lacks its subject is decorative.
    expect(POP.length).toBeGreaterThanOrEqual(90)
    expect(refusedCount, 'generation started throwing — the population collapsed, which is how this file went hollow').toBeLessThan(20)
    expect(POP.filter(p => p.plan.weeks.some(w => w.n <= 0)).length).toBeGreaterThanOrEqual(50)

    const k = kinds()
    expect(k.floorProtectedOverCap, '§82 floor-protected over cap — arm 1 needs these').toBeGreaterThan(100)
    expect(k.structuredOverCap, '§81 structured over cap').toBeGreaterThan(20)
    expect(k.foundationLrOverS9, 'foundation long run over §9 — the §9 arm needs these').toBeGreaterThan(0)
  })

  /**
   * 🔴 THE ARM THAT WOULD HAVE CAUGHT MWM-FLOOR-VALIDATOR-01 ON THE DAY §82 SHIPPED.
   *
   * The engine leaves a weekday session over cap for exactly three reasons. For each such
   * session, assert the validator agrees — i.e. no MAX-WEEKDAY-MINS / FOUNDATION-WITHIN-BUDGET
   * violation names it. This is the direction that produced a FAKE DIGEST REPORT.
   */
  it('never flags a session the engine deliberately left over its cap', () => {
    const disagreements: string[] = []
    for (const { label, input, plan } of POP) {
      const codes = new Set(['INV-PLAN-MAX-WEEKDAY-MINS', 'INV-PLAN-FOUNDATION-WEEKDAY-WITHIN-BUDGET'])
      const flagged = new Set(
        validatePlan(plan, input)
          .filter(v => codes.has(v.code))
          .map(v => `${v.week}:${v.day}`),
      )
      const floor = sessionFloorsFor((input as any).longest_recent_run_km).easy
      for (const w of plan.weeks) {
        for (const d of WEEKDAYS) {
          const s = w.sessions[d]
          const cap = (input as any).day_budgets?.[d] ?? (input as any).max_weekday_mins
          if (!s || s.duration_mins == null || cap == null || s.duration_mins <= cap) continue
          // The engine's three documented reasons for leaving it over.
          const deliberate =
            isLongRun(s)                                    // §81
            || isStructuredSession(s)                       // §81
            || (s.floor_protected === true && s.distance_km === floor)   // §82
          if (deliberate && flagged.has(`${w.n}:${d}`)) {
            disagreements.push(`${label} w${w.n}:${d} — engine exempted it, validator flagged it`)
          }
        }
      }
    }
    expect(disagreements).toEqual([])
  })

  /**
   * The other direction: a session over cap for NO documented reason must be flagged. This is
   * the arm that catches the validator going quiet — the §122 case, where both sides skipped
   * on `!s.duration_mins` and 20,980 foundation weeks swept clean over a rule that could not
   * fail.
   */
  it('never stays silent about a session over cap with no documented exemption', () => {
    const silent: string[] = []
    for (const { label, input, plan } of POP) {
      const codes = new Set(['INV-PLAN-MAX-WEEKDAY-MINS', 'INV-PLAN-FOUNDATION-WEEKDAY-WITHIN-BUDGET'])
      const flagged = new Set(
        validatePlan(plan, input).filter(v => codes.has(v.code)).map(v => `${v.week}:${v.day}`),
      )
      const floor = sessionFloorsFor((input as any).longest_recent_run_km).easy
      for (const w of plan.weeks) {
        for (const d of WEEKDAYS) {
          const s = w.sessions[d]
          const cap = (input as any).day_budgets?.[d] ?? (input as any).max_weekday_mins
          if (!s || s.duration_mins == null || cap == null || s.duration_mins <= cap) continue
          const deliberate =
            isLongRun(s) || isStructuredSession(s)
            || (s.floor_protected === true && s.distance_km === floor)
          if (!deliberate && !flagged.has(`${w.n}:${d}`)) {
            silent.push(`${label} w${w.n}:${d} — ${s.duration_mins}min vs ${cap}, no exemption, validator silent`)
          }
        }
      }
    }
    expect(silent).toEqual([])
  })
})

describe('producer and checker agree about §9\'s long-run ceiling (FOUNDATION-LR-S9-01)', () => {
  /**
   * The second disagreement of 2026-10-03. §9's ceiling governs the race-directed arc; §57
   * excludes foundation weeks; the foundation block is sized from the runner's own volume.
   * So the engine may legitimately leave a foundation long run over §9 — and the validator
   * must not flag it. On a MAIN-plan week it must.
   */
  it('scopes §9 to main-plan weeks on BOTH sides', () => {
    const problems: string[] = []
    for (const { label, input, plan } of POP) {
      const capMins = longRunTimeCapMins(input)
      const flagged = new Set(
        validatePlan(plan, input)
          .filter(v => v.code === 'INV-PLAN-LONG-CAP-MINS')
          .map(v => String(v.week)),
      )
      for (const w of plan.weeks) {
        const lr = Object.values(w.sessions).find(s => s && isLongRun(s))
        if (!lr?.duration_mins || lr.duration_mins <= capMins) continue
        if (w.n <= 0 && flagged.has(String(w.n))) {
          problems.push(`${label} w${w.n} — foundation long run flagged, §9 does not reach it`)
        }
        if (w.n > 0 && !flagged.has(String(w.n))) {
          problems.push(`${label} w${w.n} — main-plan long run ${lr.duration_mins}min over §9's ${capMins}, not flagged`)
        }
      }
    }
    expect(problems).toEqual([])
  })
})
