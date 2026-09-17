// PLAN-FITNESS-01 — does this plan actually BUILD the runner, and far enough?
//
// THE FOURTH QUESTION. The engine answers three already:
//   `npm run verify`        — are plans VALID?          (0 invariant violations)
//   `npm run verify:parity` — are plans UNCHANGED?      (byte-identical hashes)
//   `npm run cohort:shape`  — did the POPULATION shift? (classification rates)
//
// None of them can see a plan that is valid, unchanged, correctly classified —
// and useless. On 2026-09-17 an injury-history runner was measured getting
// EIGHTEEN WEEKS THAT ENDED ON THE WEEKLY VOLUME THEY STARTED: net build +6%
// against +91% for an identical healthy twin, 28.9% of injury plans never
// exceeding week 1 at all, and a knee-history runner reaching a marathon start
// line having never run beyond 14 km. Every check above was green throughout.
//
// ⚠️ THIS FILE EXISTS BECAUSE THE HARNESS WAS NOT GATED FOR THE FIRST FEW HOURS
// OF ITS LIFE. It ran when someone typed it. This repo's own history — the
// liveness debt, the decorative config, the eslint rule that was installed and
// never configured — says a check that depends on remembering is a check that
// does not run.
//
// WHEN THIS GOES RED:
//   1. Read which cohort moved. The message names it and both numbers.
//   2. `neverBuildsPct` rising above zero is NEVER acceptable without a ruling —
//      it means some runner gets a plan that does not train them.
//   3. If the move is intended, `npm run measure:fitness -- --write` and say in
//      the commit WHICH number moved and WHY.
// Never re-baseline to turn it green.

import { describe, it, expect } from 'vitest'
import baseline from './__fixtures__/planFitnessBaseline.json'
import { measure } from '../../scripts/measure-plan-fitness'

type Bucket = { n: number; medianBuildPct: number; neverBuildsPct: number; medianMarathonLrPctOfRace: number | null }
const base = baseline as unknown as {
  buckets: Record<string, Bucket>
  personas: Array<{ id: string; peakLr: number; pctOfRace: number; netBuildPct: number; refused: boolean }>
}
const actual = measure() as unknown as typeof base

describe('plan fitness — a plan must actually build the runner', () => {
  it('the harness still measures the same cohorts', () => {
    // Guards the guard. If a cohort silently disappears from the grid the
    // assertions below pass on nothing — the failure mode the liveness corpus
    // shipped twice before anyone noticed.
    expect(Object.keys(actual.buckets).sort()).toEqual(Object.keys(base.buckets).sort())
    for (const [k, b] of Object.entries(base.buckets)) {
      expect(actual.buckets[k]!.n, `${k}: cohort size changed`).toBe(b.n)
    }
  })

  it('NO cohort gets a plan that never builds them', () => {
    // The headline property, and the one that cost a whole afternoon to win.
    // A rise here means some runner finishes their block no fitter than they
    // started. There is no tolerance on this.
    const regressed = Object.entries(actual.buckets)
      .filter(([k, b]) => b.neverBuildsPct > (base.buckets[k]?.neverBuildsPct ?? 0) + 0.01)
      .map(([k, b]) => `${k}: ${b.neverBuildsPct}% never build (was ${base.buckets[k]!.neverBuildsPct}%)`)
    expect(regressed, 'a plan that does not train the runner is not a plan').toEqual([])
  })

  it('no cohort loses more than 5 points of volume build', () => {
    // Tolerance, not zero: engine work legitimately moves these. 5pp is wide
    // enough that rounding and session-placement noise do not fire it, and tight
    // enough to catch a cohort quietly losing a third of its progression — which
    // is exactly what the injury cohorts had done.
    const regressed = Object.entries(actual.buckets)
      .filter(([k, b]) => b.medianBuildPct < (base.buckets[k]?.medianBuildPct ?? 0) - 5)
      .map(([k, b]) => `${k}: build ${b.medianBuildPct}% (was ${base.buckets[k]!.medianBuildPct}%)`)
    expect(regressed).toEqual([])
  })

  it('no cohort loses marathon long-run specificity', () => {
    // Peak long run as a share of race distance. A drop here is a runner
    // arriving less prepared for the distance they are actually running.
    const regressed = Object.entries(actual.buckets)
      .filter(([k, b]) => {
        const was = base.buckets[k]?.medianMarathonLrPctOfRace
        return was != null && b.medianMarathonLrPctOfRace != null && b.medianMarathonLrPctOfRace < was - 3
      })
      .map(([k, b]) => `${k}: peak long run ${b.medianMarathonLrPctOfRace}% of race (was ${base.buckets[k]!.medianMarathonLrPctOfRace}%)`)
    expect(regressed).toEqual([])
  })

  it('the marathon review personas do not regress', () => {
    // The 11 charity personas are the cohort this product exists for and the
    // ones the Coaching Board reads. Named individually so a failure says WHO.
    const byId = new Map(base.personas.map(p => [p.id, p]))
    const regressed: string[] = []
    for (const p of actual.personas) {
      const was = byId.get(p.id)
      if (!was) continue
      if (was.refused !== p.refused) { regressed.push(`${p.id}: refusal flipped`); continue }
      if (p.refused) continue
      if (p.peakLr < was.peakLr - 0.6) regressed.push(`${p.id}: peak long run ${p.peakLr}km (was ${was.peakLr}km)`)
      if (p.netBuildPct < was.netBuildPct - 5) regressed.push(`${p.id}: build ${p.netBuildPct}% (was ${was.netBuildPct}%)`)
    }
    expect(regressed).toEqual([])
  })
})
