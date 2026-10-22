import { describe, it, expect } from 'vitest'
import { VO2_CATALOGUE_IDS } from './vo2CatalogueIds'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { getSessionColor } from '@/lib/session-types'
import { isVo2maxSession } from './sessionRole'

/** 🔴 SESSION-INTERVALS-HUE-01 step 2 — the VO2 id list is derived here from the catalogue, never copied. */
describe('VO2 colour reach', () => {
  it('🔴 the VO2 id list is exactly the catalogue rows of category vo2max', () => {
    const derived = V1_SESSION_CATALOGUE.filter(r => r.category === 'vo2max').map(r => r.id).sort()
    expect(derived.length).toBeGreaterThan(0)
    expect(Array.from(VO2_CATALOGUE_IDS).sort()).toEqual(derived)
  })
  it('🔴 a VO2 session typed quality draws in the intervals hue, by catalogue id or (legacy) by label', () => {
    expect(getSessionColor({ type: 'quality', catalogue_id: 'hill_reps', label: 'Hill reps — 45s' })).toBe('var(--session-intervals)')
    expect(getSessionColor({ type: 'quality', label: 'Classic VO2max' })).toBe('var(--session-intervals)')
  })
  it('threshold stays amber, the time trial stays race, a long run stays long', () => {
    expect(getSessionColor({ type: 'quality', catalogue_id: 'tempo_cruise', label: 'Cruise intervals' })).toBe('var(--session-quality)')
    expect(getSessionColor({ type: 'hard', catalogue_id: 'hill_reps', label: '5K time trial' })).toBe('var(--session-race)')
    expect(getSessionColor({ type: 'easy', role: 'long_run' })).toBe('var(--session-long)')
  })
  it('🔴 the colour and the engine classifier agree on every catalogue row', () => {
    for (const r of V1_SESSION_CATALOGUE) {
      const coloured = getSessionColor({ type: 'quality', catalogue_id: r.id, label: r.name }) === 'var(--session-intervals)'
      expect(coloured, r.id).toBe(isVo2maxSession({ catalogue_id: r.id, label: r.name }, V1_SESSION_CATALOGUE))
    }
  })
})
