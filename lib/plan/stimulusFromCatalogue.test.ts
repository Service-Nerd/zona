// STIMULUS-FROM-CATALOGUE-01 — the generator stamps a stimulus on every catalogue quality session. Four threshold rows
// ("CV intervals", "Over-unders", "1600m repeats", "Threshold pyramid") had labels the heuristic could not read and
// were stamped with none: 6,213 sessions on 5,664 cohort plans, invisible to §8's ordering and to the VO2max timing
// swap. The label still decides first (CLASSIFY-STIMULUS-01); the category is the fallback only. Parity with the
// stimulus field ignored: 6,102 cases byte-identical, so no prescription moved.
import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { STIMULUS_OF_CATEGORY } from './sessionRole'

const category = new Map(V1_SESSION_CATALOGUE.map(r => [r.id, r.category]))

describe('every generated catalogue quality session carries a stimulus', () => {
  const grid = cohortGrid()
  const missing: Record<string, number> = {}
  const byRow: Record<string, Set<string>> = {}
  for (let i = 0; i < grid.length; i += 37) {
    let plan: any
    try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START) } catch { continue }
    for (const w of plan.weeks) for (const s of Object.values(w.sessions).flat() as any[]) {
      if (!s || s.type !== 'quality' || !s.catalogue_id) continue
      if (!s.stimulus) missing[s.catalogue_id] = (missing[s.catalogue_id] ?? 0) + 1
      ;(byRow[s.catalogue_id] ??= new Set()).add(`${s.stimulus}`)
    }
  }
  it('reaches the four rows that used to be unclassified (an unreached row passes vacuously)', () => {
    for (const id of ['cv_intervals', 'tempo_over_under', 'threshold_mile_repeats', 'threshold_pyramid']) {
      expect(byRow[id], id).toBeDefined()
    }
  })
  it('none is stamped without a stimulus', () => expect(missing).toEqual({}))
  it('the label still decides first: threshold rows at goal pace stay race_pace, not their category', () => {
    // CLASSIFY-STIMULUS-01's reason for not stamping from the category, still holding.
    expect(byRow['tempo_cruise']?.has('race_pace')).toBe(true)
    expect(byRow['tempo_cruise']?.has('tempo')).toBe(true)
  })
  it('every category a quality row can carry has a mapping', () => {
    const quality = new Set(V1_SESSION_CATALOGUE.map(r => r.category).filter(c => c !== 'ultra_specific'))
    for (const c of Array.from(quality)) expect(STIMULUS_OF_CATEGORY[c], c).toBeDefined()
    expect(category.get('cv_intervals')).toBe('threshold')
  })
})
