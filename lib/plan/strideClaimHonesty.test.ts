import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { weekHasNeuromuscular } from './neuromuscular'
import type { Plan, Week } from '@/types/plan'

// STRIDES-2DAY-SILENT-GAP-01 — the note may not claim a session the plan does
// not contain.
//
// §28 offers strides on a MIDWEEK EASY run. A two-day week has no such day that
// is not the long run or the day before it, so `strideCarrierDay` declines and
// the plan carries no strides. `hard_pref_note` asserted "the strides on your
// midweek run keep your legs quick" regardless: measured on 252 genuine 2-day
// plans, 116 carried the claim, 12 with ZERO neuromuscular weeks.
//
// POPULATION NOTE: `cohortGrid()` carries `days_available: 3` and never varies it,
// so the cohort this guard exists for is NOT in it. The genuine 2-day shape is
// built here explicitly (count 2 + exactly five blocked days), which is the same
// construction the backlog item measured on.
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const CLAIM = /strides on your midweek run/i

function twoDayPlans(): { plan: Plan; label: string }[] {
  const seen = new Set<string>()
  const seeds = cohortGrid().filter(g => {
    const k = `${g.race_distance_km}|${g.fitness_level}|${g.current_weekly_km}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  const pairs: string[][] = [
    ['saturday', 'sunday'], ['tuesday', 'sunday'], ['wednesday', 'saturday'], ['monday', 'thursday'],
  ]
  const out: { plan: Plan; label: string }[] = []
  for (const s of seeds.slice(0, 8)) {
    for (const keep of pairs) {
      const blocked = DAYS.filter(d => !keep.includes(d))
      const input = { ...s, days_available: 2, days_cannot_train: blocked }
      try {
        out.push({
          plan: generateRulePlan(input as never, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START),
          label: `${s.race_distance_km}km ${s.fitness_level} ${s.current_weekly_km}km/wk keep=${keep.join('+')}`,
        })
      } catch { /* refusal is a valid outcome and not this guard's subject */ }
    }
  }
  return out
}

const runningWeeks = (p: Plan): Week[] =>
  p.weeks.filter(w => Object.values(w.sessions ?? {}).some(s => s && s.type !== 'rest' && s.type !== 'strength'))

describe('STRIDES-2DAY-SILENT-GAP-01 — the stride claim is honest', () => {
  const plans = twoDayPlans()

  it('builds a population that actually contains the at-risk shape', () => {
    expect(plans.length).toBeGreaterThan(10)
    // the guard is vacuous unless some plan genuinely has no neuromuscular work
    const carrierless = plans.filter(({ plan }) => !runningWeeks(plan).some(w => weekHasNeuromuscular(w)))
    expect(carrierless.length).toBeGreaterThan(0)
  })

  it('never claims midweek strides on a plan that carries none', () => {
    const liars = plans.filter(({ plan }) =>
      CLAIM.test(String(plan.meta.hard_pref_note ?? '')) &&
      !runningWeeks(plan).some(w => weekHasNeuromuscular(w)))
    expect(liars.map(l => l.label)).toEqual([])
  })

  it('tells a stride-less plan what it is missing and why', () => {
    const silent = plans.filter(({ plan }) => {
      const note = String(plan.meta.hard_pref_note ?? '')
      if (!note) return false
      const hasNM = runningWeeks(plan).some(w => weekHasNeuromuscular(w))
      return !hasNM && !/Strides need a midweek easy day/i.test(note)
    })
    expect(silent.map(s => s.label)).toEqual([])
  })
})
