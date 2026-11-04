import { describe, it, expect } from 'vitest'
import { sessionDisplayLabel } from './catalogueLink'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'

/**
 * SESSION-LABEL-STALE-01 — Duncan's live plan, 2026-11-04.
 *
 * His next run was `catalogue_id: 'threshold_pyramid'` with `label: "Quality"`, and Today's
 * next-run card rendered the stored label. Measured across all 40 live plans: 6 sessions,
 * 1 plan. No current engine path writes that label, so this is a STORED-plan repair at the
 * display boundary, not an engine change.
 */
describe('SESSION-LABEL-STALE-01 — a label that only restates the type yields to the catalogue row', () => {
  const pyramid = V1_SESSION_CATALOGUE.find(r => r.id === 'threshold_pyramid')!

  it('the production case: "Quality" on a stamped quality session becomes the row name', () => {
    expect(pyramid.name).toBe('Pyramid')   // falsifies on a catalogue rename
    expect(sessionDisplayLabel({ catalogue_id: 'threshold_pyramid', label: 'Quality', type: 'quality' }))
      .toBe('Pyramid')
  })

  it('"Quality session" and an empty label go the same way', () => {
    for (const label of ['Quality session', '', '   ']) {
      expect(sessionDisplayLabel({ catalogue_id: 'threshold_pyramid', label, type: 'quality' })).toBe('Pyramid')
    }
  })

  // THE ARM THAT BOUNDS IT. A wider "looks generic" test would silently re-title
  // thousands of correct sessions — a bigger change than the defect.
  it('a REAL label is never replaced, even on a stamped session', () => {
    expect(sessionDisplayLabel({ catalogue_id: 'threshold_pyramid', label: 'Cruise intervals', type: 'quality' }))
      .toBe('Cruise intervals')
    expect(sessionDisplayLabel({ catalogue_id: 'threshold_pyramid', label: 'MARATHON-pace progression', type: 'quality' }))
      .toBe('MARATHON-pace progression')
  })

  it('the engine’s own labels survive untouched', () => {
    // `fallbackLabel` and the §25 long-run label, verbatim from ruleEngine.ts.
    expect(sessionDisplayLabel({ catalogue_id: 'threshold_pyramid', label: 'Tempo run', type: 'quality' })).toBe('Tempo run')
    expect(sessionDisplayLabel({ label: 'Easy run — Zone 2', type: 'easy' })).toBe('Easy run — Zone 2')
    expect(sessionDisplayLabel({ label: 'Long run — Zone 2', type: 'easy' })).toBe('Long run — Zone 2')
  })

  it('with no catalogue row it returns the stored label unchanged — generic beats empty', () => {
    expect(sessionDisplayLabel({ label: 'Quality', type: 'quality' })).toBe('Quality')
    expect(sessionDisplayLabel(null)).toBe('')
  })

  it('an unknown catalogue_id does not erase the label', () => {
    expect(sessionDisplayLabel({ catalogue_id: 'no_such_row', label: 'Quality', type: 'quality' })).toBe('Quality')
  })

  // Population arm: if the catalogue ever names a row after a bare type word, this
  // helper would be a no-op for it and the defect would be unfixable by it.
  it('no catalogue row is itself named after a bare type word', () => {
    const bare = new Set(['quality', 'easy', 'long', 'hard', 'recovery', 'rest'])
    const clash = V1_SESSION_CATALOGUE.filter(r => bare.has(r.name.trim().toLowerCase()))
    expect(clash.map(r => r.id)).toEqual([])
  })
})
