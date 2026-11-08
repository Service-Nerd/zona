import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, targetedGridCore, targetedGridExtra, COHORT_PLAN_START, derivedWeekdayCap } from './cohortGrid'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun, isStructuredSession } from './sessionRole'
import { DAY_FULL_NAME } from './days'
import { worstWeekdayOverrun } from './weekdayOverrunNote'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * STRUCTURAL-NOTE-DAY-BUDGET-01 — the PLAN-LEVEL §81 overrun note is measured against,
 * and quotes, the limit of the day the session actually sits on.
 *
 * 🔴 WHAT IT CAUGHT. `weekdayOverrun` read `input.max_weekday_mins` for every weekday, and
 * the wizard derives that field as the MINIMUM across the weekdays the runner runs
 * (`weekPlanToInputs`). A runner who gave Tuesday 90 minutes and the other weekdays 35 had
 * their 54-minute TUESDAY session measured against 35 x 1.5 and was told, in the plan's own
 * voice, that it does not fit the time they have.
 *
 * ⚠️ AND THE FILED ITEM UNDERSTATED IT. It reads as a wording defect. Measured on 2,055
 * plans in production shape: the note fired 810 times and **614 of those (75.8%) had nothing
 * over its own day's budget at all** — a note that should not exist — against 5 that fired
 * legitimately and quoted the wrong number. After: **196 firings, 0 false.** Persona
 * 06-hm-uneven-weekday, the case the item was filed from, now carries no note.
 *
 * ⚠️ MY OWN FIRST "AFTER" MEASUREMENT READ 0 FIRINGS AND WAS HOLLOW: the probe matched
 * `capped weekdays at`, which the fix no longer emits for a per-day runner. The real figure
 * is 196. That is why the arms below parse the sentence the runner reads rather than
 * grepping for a phrase this code could stop using.
 */

const WD = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
type Weekday = typeof WD[number]

/** The three per-day budget shapes: the item's own persona, `targetedGrid`'s axis, and one
 *  very roomy day — the shape where min-vs-own diverges most. */
const SHAPES: ReadonlyArray<Partial<Record<Weekday, number>>> = [
  { mon: 35, tue: 90, wed: 35, thu: 35, fri: 35 },
  { mon: 30, tue: 45, wed: 30, thu: 60, fri: 30 },
  { mon: 30, tue: 30, wed: 30, thu: 30, fri: 120 },
]

/** PRODUCTION SHAPE, not just the budgets: `weekPlanToInputs` sends both fields and derives
 *  the cap as the minimum over running weekdays (GRID-DAY-BUDGET-NO-CAP-01). */
function productionShape(base: GeneratorInput, budgets: Partial<Record<Weekday, number>>): GeneratorInput {
  const rest = new Set((base.days_cannot_train ?? []).map(d => String(d).slice(0, 3).toLowerCase()))
  const eff: Partial<Record<Weekday, number>> = {}
  for (const d of WD) if (!rest.has(d) && budgets[d] != null) eff[d] = budgets[d]
  return {
    ...base,
    day_budgets: Object.keys(eff).length > 0 ? eff : undefined,
    max_weekday_mins: derivedWeekdayCap(eff, base.days_cannot_train ?? []),
  }
}

/** A bounded, strided sample so every prefix of each corpus is spread (the liveness lesson:
 *  a round-robin over corpora only ever consumes their heads). */
function sample(): GeneratorInput[] {
  const base = [...cohortGrid(), ...targetedGridCore(), ...targetedGridExtra()]
  const out: GeneratorInput[] = []
  const STRIDE = 97, N = 180
  for (const s of SHAPES) for (let i = 0; i < N; i++) out.push(productionShape(base[(i * STRIDE) % base.length], s))
  return out
}

const TOLERANCE = 1 + GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT / 100

/** Every weekday session over ITS OWN day, by the kind each of the three notes matches. */
function overruns(plan: Plan, input: GeneratorInput): { kind: 'long' | 'quality' | 'easy'; day: Weekday; mins: number; cap: number }[] {
  const out: { kind: 'long' | 'quality' | 'easy'; day: Weekday; mins: number; cap: number }[] = []
  for (const w of plan.weeks ?? []) {
    if (w.type === 'race') continue
    for (const d of WD) {
      const sn = (w.sessions as Record<string, Session | undefined>)?.[d]
      if (!sn || sn.type === 'rest' || sn.type === 'race' || sn.type === 'strength') continue
      const cap = (input.day_budgets as Record<string, number> | undefined)?.[d] ?? input.max_weekday_mins
      if (cap == null) continue
      const mins = sn.duration_mins ?? 0
      if (mins <= cap * TOLERANCE) continue
      out.push({ kind: isLongRun(sn) ? 'long' : isStructuredSession(sn) ? 'quality' : 'easy', day: d, mins, cap })
    }
  }
  return out
}

/** The sentence the runner reads: "You've capped Tuesdays at 1h 30" / "... weekdays at 35 min".
 *  Parsed, not grepped — the point of the fix is that the DAY NAME in it is now variable. */
const CAPPED = /capped (weekdays|Mondays|Tuesdays|Wednesdays|Thursdays|Fridays) at ([^,]+),/

describe('STRUCTURAL-NOTE-DAY-BUDGET-01 — the plan note reads the day the session sits on', () => {
  const rows = sample()
  const plans: { input: GeneratorInput; plan: Plan }[] = []
  for (const input of rows) {
    try { plans.push({ input, plan: generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) }) }
    catch { /* a refusal is the engine working (§44/§52/§111/§113) */ }
  }

  it('the population is real: plans generated, and the note actually fires in it', () => {
    expect(plans.length).toBeGreaterThan(400)
    const fired = plans.filter(p => CAPPED.test(String(p.plan.meta?.volume_constraint_note ?? '')))
    // Measured 2026-11-08: 196 firings on the full 2,055-plan run, 71 of 540 in this sample.
    // A FLOOR, because a sample that reaches none of them would pass every arm below by
    // selecting nothing — `CLEAN - 0 files` was the first cut's answer to an empty population
    // once already. Set well under 71 so a lawful engine change does not need this line edited.
    expect(fired.length).toBeGreaterThan(30)
  })

  it('never fires when nothing is over its own day: 614 of 810 firings used to be exactly this', () => {
    const offenders = plans.filter(({ input, plan }) => {
      const note = String(plan.meta?.volume_constraint_note ?? '')
      return CAPPED.test(note) && overruns(plan, input).length === 0
    })
    expect(
      offenders.length,
      `${offenders.length} plans tell the runner a session does not fit the time they have while every `
      + 'weekday session is inside its own day\'s budget. The detector is reading a cap the session was '
      + 'never measured against.',
    ).toBe(0)
  })

  it('the minutes it quotes are the limit of a day that really is overrun', () => {
    const bad: string[] = []
    for (const { input, plan } of plans) {
      const note = String(plan.meta?.volume_constraint_note ?? '')
      const m = CAPPED.exec(note)
      if (!m) continue
      const [, who, capText] = m
      const over = overruns(plan, input)
      if (over.length === 0) continue  // the arm above owns that case
      // The named day must be one whose own budget is overrun, and the quoted minutes must be
      // THAT day's budget — not the minimum across weekdays, which is the whole defect.
      const matching = over.filter(o => who === 'weekdays'
        ? input.day_budgets == null
        : `${DAY_FULL_NAME[o.day]}s` === who)
      if (matching.length === 0) {
        bad.push(`names "${who}" but the overrun days are ${over.map(o => o.day).join('/')} `
          + `(budgets ${JSON.stringify(input.day_budgets)}, min cap ${input.max_weekday_mins})`)
        continue
      }
      // Every candidate day shares one budget value by construction of these shapes; assert the
      // quoted figure is a cap that belongs to a named-and-overrun day.
      const caps = new Set(matching.map(o => o.cap))
      const quoted = Array.from(caps).some(c => capText.includes(String(c))
        || capText.includes(`${Math.floor(c / 60)}h`))
      if (!quoted) bad.push(`quotes "${capText}" where the overrun day's budget is ${Array.from(caps).join('/')}`)
    }
    expect(bad.length, `plan-level notes quoting a limit the overrun was not measured against:\n${bad.slice(0, 5).join('\n')}`).toBe(0)
  })

  it('a single-cap runner is untouched: no day_budgets, the note still says "weekdays"', () => {
    const singleCap = cohortGrid()
      .filter(i => i.max_weekday_mins != null && i.day_budgets == null)
      .filter((_, idx) => idx % 701 === 0)
      .slice(0, 60)
    expect(singleCap.length).toBeGreaterThan(10)
    let fired = 0
    for (const input of singleCap) {
      let plan: Plan
      try { plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      const m = CAPPED.exec(String(plan.meta?.volume_constraint_note ?? ''))
      if (!m) continue
      fired++
      expect(m[1], 'a runner with one weekday cap must still be told "weekdays", not a day name').toBe('weekdays')
    }
    // ⚠️ AND THE COUNT IS ASSERTED, not merely reported. An arm whose only assertion sits
    // inside the loop passes on a sample that never enters it — the allow-by-default shape.
    // Measured: 5 of 40 sampled single-cap plans fire.
    expect(fired, 'no single-cap plan in the sample fired the note, so the wording was never checked').toBeGreaterThan(0)
  })
})

/**
 * The SELECTION, directly — because reverting it inside the engine left every generated-plan
 * arm above GREEN. No corpus happens to hold a plan with two weekday overruns whose
 * largest-minutes and largest-ratio orderings disagree, so the generated-plan gate cannot see
 * this decision at all. ⚠️ WHEN A MUTATION STAYS GREEN, SUSPECT THE CHECK: the answer here was
 * not "unenforceable, declared" but "the decision belongs in a pure function".
 */
describe('worstWeekdayOverrun — worst means worst RELATIVE TO ITS OWN DAY', () => {
  const roomyDayBigger = { n: 4, mins: 95, cap: 90, day: 'thu', perDay: true }   // 1.06x
  const tightDaySmaller = { n: 7, mins: 53, cap: 35, day: 'mon', perDay: true }  // 1.51x

  it('picks the tight day over a longer session on a roomy day', () => {
    // The exact mutation: `mins > worstRatio` instead of `ratio > worstRatio` returns the
    // 95-minute Thursday, and the runner is told about the session that nearly fits.
    expect(worstWeekdayOverrun([roomyDayBigger, tightDaySmaller])).toBe(tightDaySmaller)
    expect(worstWeekdayOverrun([tightDaySmaller, roomyDayBigger])).toBe(tightDaySmaller)
  })

  it('a single shared cap leaves the ordering identical to largest-minutes', () => {
    const a = { n: 1, mins: 40, cap: 30, day: 'mon', perDay: false }
    const b = { n: 2, mins: 58, cap: 30, day: 'wed', perDay: false }
    expect(worstWeekdayOverrun([a, b])).toBe(b)
  })

  it('no candidates, and a zero cap, return null rather than a fabricated worst', () => {
    expect(worstWeekdayOverrun([])).toBeNull()
    // `cap: 0` would make every ratio Infinity and win every comparison — absence written as
    // a value. Guarded, so a day whose budget failed to resolve cannot become "the worst".
    expect(worstWeekdayOverrun([{ n: 1, mins: 40, cap: 0, day: 'mon', perDay: true }])).toBeNull()
  })
})
