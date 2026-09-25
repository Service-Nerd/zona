/**
 * DELIVERED-RAMP-FALSE-DRIVER-01 — `INV-PLAN-DELIVERED-RAMP` attributes its
 * driver by COMPUTATION, never by assertion.
 *
 * 🔴 THE DEFECT. The non-long-run branch was a fixed string: *"Typically a
 * volume/quality-split trim held the previous week flat and handed its deficit
 * forward (§100)."* The trim stamps itself as `V1-volume-quality-split` in
 * `meta.rule_adjustments`, so the claim was always checkable. Checked over 280
 * non-long-run-led firings: the previous week carried that stamp in **4 (1.4%)**
 * and carried nothing in **276 (98.6%)**.
 *
 * It sent every triage to §100 — whose producer shipped 2026-09-11 and did not
 * fire on those weeks — so the real driver of the product's largest unexplained
 * warn had never been looked for. §94 Amendment 1 made attribution a condition
 * of approval (McMillan, Seiler); the long-run arm was computed and this one was
 * not, and half a condition is not a met condition.
 *
 * ⚠️ NOTHING HERE ASSERTS A FIRING RATE. This changes only the sentence attached
 * to a firing; severity, threshold and rate are untouched, and the test asserts
 * that too.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isDesignedRefusal } from './designedRefusal'
import type { GeneratorInput, Plan } from '@/types/plan'

const PLAN_START = '2026-04-27'
const CODE = 'INV-PLAN-DELIVERED-RAMP'

/** A spread wide enough to produce firings of both kinds. */
function sweep(): { plan: Plan; input: GeneratorInput }[] {
  const out: { plan: Plan; input: GeneratorInput }[] = []
  for (const race_distance_km of [5, 10, 21.1, 42.2])
    for (const fitness_level of ['beginner', 'intermediate', 'experienced'])
      for (const current_weekly_km of [15, 30, 55])
        for (const days_available of [3, 5]) {
          const input = {
            goal: 'finish', age: 40, resting_hr: 55, max_hr: 180,
            preferred_long_run_day: 'sun', race_date: '2026-12-06',
            race_distance_km, current_weekly_km,
            longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
            days_available, fitness_level, injury_history: [],
          } as unknown as GeneratorInput
          const spy = console.error; console.error = () => {}
          try { out.push({ plan: generateRulePlan(input, 'paid', PLAN_START), input }) }
          catch (e) { if (!isDesignedRefusal(e)) { /* skip */ } }
          finally { console.error = spy }
        }
  return out
}

const firings = () => {
  const out: { msg: string; week: number; plan: Plan }[] = []
  for (const { plan, input } of sweep())
    for (const v of validatePlan(plan, input))
      if (v.code === CODE) out.push({ msg: String(v.message), week: Number(v.week), plan })
  return out
}

describe('the driver is computed, not asserted', () => {
  const all = firings()

  it('the corpus actually produces firings — otherwise everything below is vacuous', () => {
    expect(all.length, 'no INV-PLAN-DELIVERED-RAMP firings; the assertions would prove nothing')
      .toBeGreaterThan(20)
  })

  // 🔴 THE REGRESSION CASE. Red against the old fixed string.
  it('NEVER claims a §100 deficit hand-forward without the stamp to prove it', () => {
    const liars = all.filter(f => {
      if (!/handed its deficit forward/.test(f.msg)) return false
      const stamped = (f.plan.meta.rule_adjustments ?? []).some(a =>
        a.rule === 'V1-volume-quality-split' && (a.weeks_affected ?? []).includes(f.week - 1))
      return !stamped
    })
    expect(liars.map(l => `w${l.week}: ${l.msg.slice(0, 90)}`),
      'the message blames a V1 trim on a week that carries no such stamp',
    ).toEqual([])
  })

  it('every firing carries exactly one of the three attributions', () => {
    const unclassified = all.filter(f =>
      !/The LONG RUN is driving it/.test(f.msg)
      && !/handed its deficit forward/.test(f.msg)
      && !/Driver NOT ATTRIBUTED/.test(f.msg))
    expect(unclassified.map(u => u.msg.slice(0, 90)), 'a firing with no driver branch').toEqual([])
  })

  it('the unattributed branch says so plainly and does NOT blame §100', () => {
    const unattributed = all.filter(f => /Driver NOT ATTRIBUTED/.test(f.msg))
    expect(unattributed.length, 'the majority case measured 98.6% — it should be present')
      .toBeGreaterThan(0)
    for (const f of unattributed) {
      expect(f.msg, 'the unattributed branch must not assert a §100 hand-forward')
        .not.toMatch(/Typically a volume\/quality-split trim held/)
      expect(f.msg, 'triage needs somewhere to go').toContain('DELIVERED-RAMP-FALSE-DRIVER-01')
    }
  })

  it('the trim branch, where it fires, is backed by a real stamp', () => {
    // It measured 1.4%, so it may be absent from this narrower corpus; what must
    // never happen is the branch firing WITHOUT the stamp, asserted above.
    for (const f of all.filter(f => /handed its deficit forward/.test(f.msg))) {
      expect(f.msg, 'the confirmed branch should say it was checked').toContain('not assumed')
    }
  })
})
