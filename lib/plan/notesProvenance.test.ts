import { describe, it, expect } from 'vitest'
import { sessionNotesAreAiAuthored } from './notesProvenance'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import type { Plan, Session } from '@/types/plan'

// AI-PROVENANCE-01 — Kit must never be credited for copy a model did not write.
//
// FOUNDER-CAUGHT, 2026-09-17, on the 5K time trial: the card showed
// "Kit · YOUR COACH" over hand-authored rule-engine copy that `applyEnrichment`
// is explicitly told to skip. The card decided provenance with
// `coach_notes.length > 0`, which answers "are there notes", not "did a model
// write them" — and the rule engine writes notes too.
//
// The error is not symmetric. Crediting a model for human copy is a false claim;
// withholding credit is modesty. Every unknown must therefore resolve to false.

const meta = (enrichment?: string) => ({ enrichment } as unknown as Plan['meta'])
const sess = (over: Partial<Session> = {}) =>
  ({ type: 'easy', coach_notes: ['Keep it easy.'], ...over }) as unknown as Session

describe('AI-PROVENANCE-01 — sessionNotesAreAiAuthored', () => {
  it('is FALSE on a free plan, which is never enriched by design', () => {
    expect(sessionNotesAreAiAuthored(sess(), meta('skipped'))).toBe(false)
  })

  it('is FALSE for every enrichment state that is not a landed enrichment', () => {
    for (const st of ['skipped', 'pending', 'failed', 'failed_parse', 'failed_api', 'failed_validation', undefined, '']) {
      expect(sessionNotesAreAiAuthored(sess(), meta(st)), `state ${st}`).toBe(false)
    }
  })

  it('is FALSE on a legacy plan with no enrichment field at all', () => {
    expect(sessionNotesAreAiAuthored(sess(), {} as Plan['meta'])).toBe(false)
    expect(sessionNotesAreAiAuthored(sess(), null)).toBe(false)
  })

  it('is TRUE only when the enricher actually landed', () => {
    expect(sessionNotesAreAiAuthored(sess(), meta('applied'))).toBe(true)
    expect(sessionNotesAreAiAuthored(sess(), meta('applied_partial'))).toBe(true)
  })

  it('is FALSE with no notes to attribute', () => {
    // `coach_notes` is a tuple type, so an empty list is only reachable at runtime
    // (legacy plans, a stripped field) — cast rather than pretend the type allows it.
    expect(sessionNotesAreAiAuthored(sess({ coach_notes: [] as unknown as Session['coach_notes'] }), meta('applied'))).toBe(false)
    expect(sessionNotesAreAiAuthored(sess({ coach_notes: undefined }), meta('applied'))).toBe(false)
  })

  it('is FALSE on a week ENRICH-PARTIAL-01 reverted to rule copy', () => {
    // 'applied_partial' is a plan-wide state; the reverted week carries the
    // engine's words and must not claim Kit.
    expect(sessionNotesAreAiAuthored(sess(), meta('applied_partial'), { enrichment_reverted: true })).toBe(false)
    expect(sessionNotesAreAiAuthored(sess(), meta('applied_partial'), { enrichment_reverted: undefined })).toBe(true)
  })

  it('is FALSE for the §78 time trial even on a fully enriched plan', () => {
    // applyEnrichment skips it deliberately (its copy is instruction, not voice),
    // so its notes are the engine's on every plan that exists.
    expect(sessionNotesAreAiAuthored(sess({ type: 'hard' }), meta('applied'))).toBe(false)
  })

  it('credits nobody across a whole FREE plan — the 41.2% the founder saw', () => {
    const grid = cohortGrid()
    let checked = 0, credited = 0
    for (let i = 0; i < grid.length; i += 401) {
      let plan: Plan
      try { plan = generateRulePlan(grid[i], 'free', COHORT_PLAN_START) } catch { continue }
      // A rule plan has not been through the route, so stamp what the route
      // stamps for the free tier.
      const m = { ...plan.meta, enrichment: 'skipped' } as Plan['meta']
      for (const wk of plan.weeks) {
        for (const s of Object.values(wk.sessions ?? {})) {
          if (!s || typeof s !== 'object') continue
          const notes = (s.coach_notes ?? []).filter(Boolean)
          if (!notes.length) continue
          checked++
          if (sessionNotesAreAiAuthored(s, m, wk)) credited++
        }
      }
    }
    expect(checked, 'no free-plan coach notes in the sample — this asserts nothing').toBeGreaterThan(100)
    expect(credited, `${credited} of ${checked} free-plan notes credited to a model that never ran`).toBe(0)
  })
})
