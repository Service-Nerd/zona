/**
 * BINGE-BUCKET-CROSS-01 — the quality gate failed the build on an IMPROVEMENT.
 *
 * 🔴 THE INCIDENT, MEASURED. `SWEEP-W1W2-LONG-CAP-01` (3c24021) capped the
 * week-1/2 long run. One beginner marathoner in the cohort grid — 42.2 km,
 * 35 km/week, longest 14 km, 3 days, age 52 — went from a worst single session
 * of **75% of its week to 74%**. `auditPlanQuality` splits that predicate at 75,
 * so the plan left `BINGE-SEVERE-75` (20 -> 19) and entered `BINGE-WEEK`
 * (281 -> 282). The comparator scored each code alone, saw +1, and exited 1.
 *
 * ⚠️ `npm run verify` WAS RED ON MAIN ALL DAY FOR A BETTER PLAN — and while it
 * sat red, a real regression would have looked identical. A gate that cries wolf
 * gets disabled; this one cried wolf about progress.
 *
 * ⚠️ The comparator had NO TEST. It was six lines inside a script, which is
 * exactly where an unexamined rule lives.
 */
import { describe, it, expect } from 'vitest'
import { compareToBaseline, SEVERITY_FAMILIES, type Summary } from './qualityBaselineCompare'

const cohort = (codes: Record<string, number>): Summary => ({ cohortGrid: { generated: 3000, ...codes } })

describe('compareToBaseline — severity buckets of one predicate are a family', () => {
  it('REPRODUCES THE INCIDENT: 75% -> 74% is an improvement, not a regression', () => {
    const base = cohort({ 'BINGE-SEVERE-75': 20, 'BINGE-WEEK': 281 })
    const now = cohort({ 'BINGE-SEVERE-75': 19, 'BINGE-WEEK': 282 })
    expect(compareToBaseline(now, base)).toEqual([])
  })

  it('a case crossing UPWARD still fails — the family cannot launder it', () => {
    const base = cohort({ 'BINGE-SEVERE-75': 19, 'BINGE-WEEK': 282 })
    const now = cohort({ 'BINGE-SEVERE-75': 20, 'BINGE-WEEK': 281 })
    const w = compareToBaseline(now, base)
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('BINGE-SEVERE-75: 19 -> 20')
  })

  it('a NET increase fails even when the severe bucket fell', () => {
    // -1 severe, +2 mild. The prefix sum is what catches it.
    const base = cohort({ 'BINGE-SEVERE-75': 20, 'BINGE-WEEK': 281 })
    const now = cohort({ 'BINGE-SEVERE-75': 19, 'BINGE-WEEK': 283 })
    const w = compareToBaseline(now, base)
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('BINGE-SEVERE-75+BINGE-WEEK: 301 -> 302')
  })

  it('more plans bingeing at all fails, with both buckets rising', () => {
    const base = cohort({ 'BINGE-SEVERE-75': 20, 'BINGE-WEEK': 281 })
    const now = cohort({ 'BINGE-SEVERE-75': 21, 'BINGE-WEEK': 282 })
    expect(compareToBaseline(now, base)).toHaveLength(1)   // one line per family
  })

  it('codes OUTSIDE a family are still compared one by one', () => {
    const base = cohort({ 'NEVER-BUILDS': 4 })
    expect(compareToBaseline(cohort({ 'NEVER-BUILDS': 5 }), base))
      .toEqual(['cohortGrid/NEVER-BUILDS: 4 -> 5 (+1)'])
    expect(compareToBaseline(cohort({ 'NEVER-BUILDS': 3 }), base)).toEqual([])
  })

  it('a code absent from the baseline is a regression from zero', () => {
    expect(compareToBaseline(cohort({ 'FLAT-CURVE': 1 }), cohort({})))
      .toEqual(['cohortGrid/FLAT-CURVE: 0 -> 1 (+1)'])
  })

  it('FEWER plans generated is the bad direction for `generated`', () => {
    const base: Summary = { cohortGrid: { generated: 3000 } }
    expect(compareToBaseline({ cohortGrid: { generated: 2999 } }, base))
      .toEqual(['cohortGrid/generated: 3000 -> 2999 (FEWER plans generated)'])
    expect(compareToBaseline({ cohortGrid: { generated: 3001 } }, base)).toEqual([])
  })

  it('a cohort that never produces the predicate is not scored for it', () => {
    // Both sides absent — the family must not compare 0 against 0 and emit noise,
    // and must not invent a line for a cohort that cannot binge.
    expect(compareToBaseline({ personas: { generated: 12 } }, { personas: { generated: 12 } }))
      .toEqual([])
  })

  it('membership is DECLARED — `DAYS-SHORT*` share a prefix and are not a family', () => {
    // Guessing family membership from name prefixes would absorb a real
    // regression. `DAYS-SHORT-SILENCED` is a `watched` finding, not a milder
    // bucket of `DAYS-SHORT`.
    const flat = SEVERITY_FAMILIES.flat()
    expect(flat).not.toContain('DAYS-SHORT')
    expect(flat).not.toContain('DAYS-SHORT-SILENCED')
    expect(new Set(flat).size).toBe(flat.length)   // no code in two families
  })
})
