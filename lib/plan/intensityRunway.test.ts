import { describe, it, expect } from 'vitest'
import { distanceEnvelope, DISTANCE_BANDS, ENVELOPE_PLAN_START } from './useCaseEnvelope'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'

/**
 * 🔴 INTENSITY-RUNWAY-01 (2026-10-19) — §1's plan-wide quality ceiling holds at EVERY runway length.
 *
 * With every date pinned and only the runway varied, delivered plans breached §1 at exactly 16 and 21 weeks (100 km),
 * 8–11 weeks (HM) and 11 weeks (marathon), and at no neighbouring length: the phase split gives one more peak week at
 * those lengths. The property sweep covered one or two runways per distance and none of the failing ones; the use-case
 * envelope found it only because the wall clock walked it onto 21 weeks (ENVELOPE-CLOCK-01). So the runway is the
 * axis here, 8–26 weeks for every distance, over the envelope's own runner profiles (strided, every ability level).
 */
const TODAY = '2026-10-26'
const raceIn = (weeks: number) => new Date(Date.parse(ENVELOPE_PLAN_START + 'T00:00:00Z') + weeks * 7 * 864e5).toISOString().slice(0, 10)
const STRIDE = 401

describe('§1 holds at every runway length (INTENSITY-RUNWAY-01)', () => {
  it('🔴 no build-profile plan over its distance ceiling, 8–26 weeks out, any distance', () => {
    const breaches: string[] = [], yieldedErrors: string[] = []
    let plans = 0, yielded = 0
    for (const band of DISTANCE_BANDS) {
      const profiles = distanceEnvelope(band.value).filter((_, i) => i % STRIDE === 0)
      for (let weeks = 8; weeks <= 26; weeks++) for (const c of profiles) {
        const input = { ...c.input, race_date: raceIn(weeks) }
        let plan
        try { plan = generateRulePlan(input, 'paid', ENVELOPE_PLAN_START, undefined, TODAY) } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
        plans++
        const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
        if (errors.some(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')) breaches.push(`${c.label} @${weeks}wk`)
        // The yield must not trade §1 for another rule. The first cut did (§53 variety on 3 plans, §27 overload copy on
        // 1), because it counted quality its own way; on the check's count neither is reachable, so the guards built for
        // them were removed rather than kept as defences nothing can wake. A plan the yield touched carries no error.
        if ((plan.meta.rule_adjustments ?? []).some(r => r.rule.startsWith('§1 Amendment 3'))) {
          yielded++
          for (const v of errors) yieldedErrors.push(`${c.label} @${weeks}wk ${v.code}`)
        }
      }
    }
    expect(plans).toBeGreaterThan(1200)
    expect(breaches.slice(0, 5)).toEqual([])
    expect(yielded, 'the sample must reach plans the yield actually changes').toBeGreaterThanOrEqual(5)
    expect(yieldedErrors.slice(0, 5)).toEqual([])
  }, 300_000)
})
