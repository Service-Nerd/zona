import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { sessionKmSelfPaced } from './sessionDistance'
import { GENERATION_CONFIG } from './generationConfig'
import type { Plan, Week } from '@/types/plan'

// §94 Amendment 3 — FREQUENCY is a named driver when per-session load does not rise.
//
// The board REFUSED to exempt gained-session weeks (§2 Am. 2's freeze; §94 Am. 1
// had already removed an exemption arm from this same check) and granted
// attribution only. So the two things worth asserting are:
//   - a frequency-led rise is NAMED, not reported as "NOT ATTRIBUTED"
//   - a rise where per-session load ALSO rose is NEVER called frequency-led,
//     because that is the compound-progression case §2 exists to catch (65.0% of
//     the gained-session set, measured)
const km = (s: unknown) => sessionKmSelfPaced(s as never) ?? 0
const deliveredKm = (w: Week) => Object.values(w.sessions).reduce((a, s) => a + km(s), 0)
const runCount = (w: Week) =>
  Object.values(w.sessions).filter(s => s && s.type !== 'rest' && s.type !== 'strength').length
const meanPerSession = (w: Week) => { const r = runCount(w); return r > 0 ? deliveredKm(w) / r : 0 }

type Firing = { msg: string; gained: boolean; perSessionRisePct: number }

// A SUBSET of the grid, strided rather than sliced: a prefix of cohortGrid() is
// ordered and would sample one corner of it. Both classes must be present, which
// the population arm below asserts rather than assumes.
function firings(): Firing[] {
  const grid = cohortGrid()
  const out: Firing[] = []
  for (let g = 0; g < grid.length; g += 37) {
    const input = grid[g]
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    for (const v of validatePlan(plan, input)) {
      if (v.code !== 'INV-PLAN-DELIVERED-RAMP') continue
      const i = plan.weeks.findIndex(w => w.n === v.week)
      if (i < 1) continue
      const w = plan.weeks[i], prev = plan.weeks[i - 1]
      const prevMean = meanPerSession(prev), nowMean = meanPerSession(w)
      out.push({
        msg: v.message ?? '',
        gained: runCount(w) > runCount(prev),
        perSessionRisePct: prevMean > 0 ? ((nowMean - prevMean) / prevMean) * 100 : 0,
      })
    }
  }
  return out
}

const TOL = GENERATION_CONFIG.DELIVERED_RAMP_FREQUENCY_PER_SESSION_MAX_RISE_PCT
const CLAIMS_FREQUENCY = /FREQUENCY is driving it/

describe('§94 Am. 3 — frequency attribution on INV-PLAN-DELIVERED-RAMP', () => {
  const all = firings()

  it('the sample contains BOTH classes, so neither arm can pass vacuously', () => {
    expect(all.length).toBeGreaterThan(20)
    const benign = all.filter(f => f.gained && f.perSessionRisePct <= TOL)
    const compound = all.filter(f => f.gained && f.perSessionRisePct > TOL)
    expect(benign.length).toBeGreaterThan(0)
    expect(compound.length).toBeGreaterThan(0)
  })

  it('names FREQUENCY when the week gained a run and per-session load did not rise', () => {
    const unnamed = all.filter(f =>
      f.gained && f.perSessionRisePct <= TOL &&
      !CLAIMS_FREQUENCY.test(f.msg) && !/LONG RUN is driving it|handed its deficit forward/.test(f.msg))
    expect(unnamed.map(f => f.msg.slice(0, 80))).toEqual([])
  })

  it('NEVER claims frequency when per-session load also rose (the compound case)', () => {
    const wrong = all.filter(f => CLAIMS_FREQUENCY.test(f.msg) && f.perSessionRisePct > TOL)
    expect(wrong.map(f => f.msg.slice(0, 80))).toEqual([])
  })

  it('never claims frequency when the run count did not rise', () => {
    const wrong = all.filter(f => CLAIMS_FREQUENCY.test(f.msg) && !f.gained)
    expect(wrong.map(f => f.msg.slice(0, 80))).toEqual([])
  })
})
