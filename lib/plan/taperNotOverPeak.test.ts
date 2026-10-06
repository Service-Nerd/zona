import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { sessionKmSelfPaced } from './sessionDistance'
import type { Plan, Week } from '@/types/plan'

// TAPER-OVER-PEAK-01 — the taper must not become the plan's biggest block.
//
// The item traced a case at 25% severity (peak 12 km, taper 15 km). Measured on
// the full 39,632-plan grid on 2026-10-06 that case no longer reproduces: the
// rate is 0.77% (304 plans) at a MEAN severity of 3.5% and a WORST of 5.8%, and
// every one of the 304 carries an adjacent peak warning.
//
// So this is a RATCHET, not a fix. The item's remedy was never built because the
// defect it describes shrank to a margin; this gate exists so it cannot grow back
// unnoticed, which is the failure mode a closed item has no other defence against.
//
// ⚠️ STRIDED, NOT SLICED. A prefix of cohortGrid() is ordered and samples one
// corner of it. A coprime stride spreads the sample across every band, which is
// the correction the invariant-liveness harness had to make three times.
const STRIDE = 37
const RATE_CEILING_PCT = 2.0      // measured 0.77% full-grid; headroom for sampling
const SEVERITY_CEILING_PCT = 12.0 // measured worst 5.8%

const delivered = (w: Week) =>
  Object.values(w.sessions ?? {}).reduce((a, s) => a + (sessionKmSelfPaced(s) ?? 0), 0)

function measure() {
  const grid = cohortGrid()
  let considered = 0, over = 0, worstGap = 0
  const examples: string[] = []
  for (let i = 0; i < grid.length; i += STRIDE) {
    const input = grid[i]
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    const main = plan.weeks.filter(w => w.n >= 1)
    const peak = main.filter(w => w.phase === 'peak')
    const taper = main.filter(w => w.phase === 'taper' && w.type !== 'race')
    if (!peak.length || !taper.length) continue
    considered++
    const maxPeak = Math.max(...peak.map(delivered))
    const maxTaper = Math.max(...taper.map(delivered))
    if (maxTaper <= maxPeak) continue
    over++
    const gap = maxPeak > 0 ? ((maxTaper - maxPeak) / maxPeak) * 100 : 0
    if (gap > worstGap) worstGap = gap
    if (examples.length < 5) {
      examples.push(`${input.race_distance_km}km ${input.fitness_level} ${input.current_weekly_km}km/wk: peak ${maxPeak.toFixed(1)} taper ${maxTaper.toFixed(1)} (+${gap.toFixed(1)}%)`)
    }
  }
  return { considered, over, worstGap, examples }
}

describe('TAPER-OVER-PEAK-01 — the taper stays below the peak', () => {
  const m = measure()

  it('measures a real population', () => {
    // Without this the two ratchets below pass on an empty set.
    expect(m.considered).toBeGreaterThan(200)
  })

  it('the taper-over-peak RATE does not regress', () => {
    const pct = (100 * m.over) / m.considered
    expect(pct, `taper-over-peak ${m.over}/${m.considered} = ${pct.toFixed(2)}%\n${m.examples.join('\n')}`)
      .toBeLessThanOrEqual(RATE_CEILING_PCT)
  })

  it('and no plan taper exceeds its peak by a margin a runner would read as a bigger week', () => {
    expect(m.worstGap, `worst taper-over-peak margin ${m.worstGap.toFixed(1)}%\n${m.examples.join('\n')}`)
      .toBeLessThanOrEqual(SEVERITY_CEILING_PCT)
  })
})
