import { describe, it, expect } from 'vitest'
import { createEnrichSaveCoordinator } from './enrichSaveCoordinator'

/**
 * ENRICH-SAVE-01 — the runner saves in ~10ms; enrichment lands 28–35s later.
 *
 * The old flow blocked "Use this plan" for up to 15s waiting for a 30s job, then
 * saved the bare rule plan when the deadline expired — a silent downgrade for
 * any trial user who tapped promptly. Enrichment is now written afterwards.
 *
 * The failure mode this guards is the mid-save arrival: patching enrichment
 * while a save is still in flight lets the save land second and overwrite it,
 * which would reintroduce the same silent downgrade as a race instead of a
 * timeout.
 */

const RULE = { id: 'rule' }
const ENRICHED = { id: 'enriched' }

describe('createEnrichSaveCoordinator', () => {
  it('ignores enrichment that arrives before the runner saves', () => {
    const c = createEnrichSaveCoordinator<typeof RULE>()
    // Nothing to patch — the plan in hand is already enriched, so the ordinary
    // save persists it. A patch here would be a redundant second write.
    expect(c.enrichmentArrived(ENRICHED)).toBe('ignore')
    expect(c.state).toBe('idle')
  })

  it('patches enrichment that arrives after the save has landed', () => {
    const c = createEnrichSaveCoordinator<typeof RULE>()
    c.beginSave()
    expect(c.saveCompleted()).toBeNull()

    expect(c.enrichmentArrived(ENRICHED)).toBe('patch')
  })

  it('holds enrichment that arrives DURING the save, then releases it', () => {
    const c = createEnrichSaveCoordinator<typeof RULE>()
    c.beginSave()

    // Must not patch yet: the in-flight save would land after and overwrite it.
    expect(c.enrichmentArrived(ENRICHED)).toBe('queue')

    expect(c.saveCompleted()).toBe(ENRICHED)
  })

  it('releases a queued plan exactly once', () => {
    const c = createEnrichSaveCoordinator<typeof RULE>()
    c.beginSave()
    c.enrichmentArrived(ENRICHED)

    expect(c.saveCompleted()).toBe(ENRICHED)
    // A second completion must not re-write the same plan.
    expect(c.saveCompleted()).toBeNull()
  })

  it('keeps the LATEST enrichment when several arrive mid-save', () => {
    const c = createEnrichSaveCoordinator<{ id: string }>()
    c.beginSave()
    c.enrichmentArrived({ id: 'first' })
    c.enrichmentArrived({ id: 'second' })

    expect(c.saveCompleted()).toEqual({ id: 'second' })
  })

  it('returns to idle on a failed save so the runner can retry', () => {
    const c = createEnrichSaveCoordinator<typeof RULE>()
    c.beginSave()
    c.saveFailed()

    expect(c.state).toBe('idle')
    // Nothing is saved, so there is nothing to patch over.
    expect(c.enrichmentArrived(ENRICHED)).toBe('ignore')
  })

  it('drops a mid-save arrival when that save fails', () => {
    const c = createEnrichSaveCoordinator<typeof RULE>()
    c.beginSave()
    c.enrichmentArrived(ENRICHED)
    c.saveFailed()

    // The queued plan belonged to a save that never landed; patching it would
    // write a plan the runner never committed to.
    c.beginSave()
    expect(c.saveCompleted()).toBeNull()
  })

  it('keeps patching on every later arrival once saved', () => {
    const c = createEnrichSaveCoordinator<typeof RULE>()
    c.beginSave()
    c.saveCompleted()

    expect(c.enrichmentArrived(ENRICHED)).toBe('patch')
    expect(c.enrichmentArrived(ENRICHED)).toBe('patch')
  })
})
