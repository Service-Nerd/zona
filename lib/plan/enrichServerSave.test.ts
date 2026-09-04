import { describe, it, expect } from 'vitest'
import { shouldServerPersist } from './enrichServerSave'
import type { Plan } from '@/types/plan'

/**
 * ENRICH-SERVER-SAVE-01 — the server persists the enriched plan itself.
 *
 * ENRICH-SAVE-01 rightly removed a 15s blocking wait: the enricher takes 28–35s
 * and the runner must not stare at a spinner. But it left the follow-up write
 * owned by the CLIENT, so the design told the runner "don't wait" and then cost
 * them the paid voice layer when they didn't. Observed on a real trial plan:
 * saved 5s after generation, `meta.enrichment` stuck on 'pending' forever.
 *
 * These tests are about the GUARD, not the write. Getting the guard wrong means
 * overwriting a plan the runner deliberately kept — a far worse failure than the
 * one being fixed — so every way it must decline has its own case.
 */

const plan = (generatedAt: string): Plan =>
  ({ meta: { generated_at: generatedAt, enrichment: 'applied' }, weeks: [] } as unknown as Plan)

const row = (meta: Record<string, unknown> | null) => ({ plan_json: meta === null ? null : { meta } })

const AT = '2026-09-04T13:26:01.169Z'

describe('shouldServerPersist', () => {
  it('writes when the stored row IS the plan just generated and still pending', () => {
    expect(shouldServerPersist(row({ generated_at: AT, enrichment: 'pending' }), plan(AT))).toBe(true)
  })

  it('declines when no row exists — generation alone never creates one', () => {
    // The runner never tapped "Use this plan". Writing here would resurrect a
    // plan they rejected.
    expect(shouldServerPersist(null, plan(AT))).toBe(false)
    expect(shouldServerPersist(undefined, plan(AT))).toBe(false)
  })

  it('declines when the stored plan is a DIFFERENT generation', () => {
    // The case that matters most: the runner generated twice and kept the first,
    // or is mid-way through replacing a plan they have been training on.
    expect(shouldServerPersist(row({ generated_at: '2026-09-03T19:49:01.000Z', enrichment: 'pending' }), plan(AT)))
      .toBe(false)
  })

  it('declines when either timestamp is missing — an unstamped row is a legacy plan', () => {
    // 12 of the 17 stored plans predate the enrichment-status widening and carry
    // no generated_at. Guessing on those is exactly the harm this prevents.
    expect(shouldServerPersist(row({ enrichment: 'pending' }), plan(AT))).toBe(false)
    expect(shouldServerPersist(row({ generated_at: AT }), plan(''))).toBe(false)
    expect(shouldServerPersist(row(null), plan(AT))).toBe(false)
  })

  it('declines a non-string timestamp rather than coercing', () => {
    expect(shouldServerPersist(row({ generated_at: 12345, enrichment: 'pending' }), plan(AT))).toBe(false)
  })

  it('declines when the client already landed its follow-up write', () => {
    // Not harmful — the content is identical — but skipping keeps the two
    // writers from racing, and makes the ops event mean "the backstop was
    // actually needed" rather than "it fired again".
    for (const st of ['applied', 'applied_partial', 'failed_invalid_copy', 'skipped']) {
      expect(shouldServerPersist(row({ generated_at: AT, enrichment: st }), plan(AT)), st).toBe(false)
    }
  })

  it('writes when the row has no enrichment field at all but the generation matches', () => {
    // A row saved by a client old enough not to stamp the status, for THIS
    // generation, is still ours to complete.
    expect(shouldServerPersist(row({ generated_at: AT }), plan(AT))).toBe(true)
  })
})
