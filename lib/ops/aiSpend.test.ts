import { describe, it, expect } from 'vitest'
import { summariseAiSpend, type AiCallRow } from './aiSpend'

const call = (surface: string, detail: Record<string, unknown>, user = 'u1'): AiCallRow => ({
  kind: 'ai_call', user_id: user, created_at: '2026-09-20T10:00:00Z',
  detail: { surface, ...detail },
})
const fail = (surface: string, reason: string, user = 'u1'): AiCallRow => ({
  kind: 'ai_call_failed', user_id: user, created_at: '2026-09-20T10:00:00Z',
  detail: { surface, reason },
})

describe('summariseAiSpend', () => {
  it('totals tokens and cost per surface and overall', () => {
    const s = summariseAiSpend([
      call('enrich-plan', { inputTokens: 100, outputTokens: 50, cost_usd: 0.01 }),
      call('enrich-plan', { inputTokens: 200, outputTokens: 60, cost_usd: 0.02 }),
      call('daily-coach-note', { inputTokens: 10, outputTokens: 5, cost_usd: 0.0001 }),
    ])
    expect(s.totals.calls).toBe(3)
    expect(s.totals.estimatedCostUsd).toBeCloseTo(0.0301, 4)
    const enrich = s.bySurface.find(x => x.surface === 'enrich-plan')!
    expect(enrich.inputTokens).toBe(300)
    expect(enrich.outputTokens).toBe(110)
    expect(enrich.estimatedCostUsd).toBeCloseTo(0.03, 4)
  })

  it('orders surfaces by cost so the expensive one is first', () => {
    const s = summariseAiSpend([
      call('trend', { cost_usd: 0.0001 }),
      call('enrich-plan', { cost_usd: 0.5 }),
      call('analyse-run', { cost_usd: 0.01 }),
    ])
    expect(s.bySurface.map(x => x.surface)).toEqual(['enrich-plan', 'analyse-run', 'trend'])
  })

  it('counts failures separately and never as calls', () => {
    const s = summariseAiSpend([
      call('analyse-run', { cost_usd: 0.01 }),
      fail('analyse-run', 'api_error'),
      fail('trend', 'fetch_failed'),
      fail('trend', 'api_error'),
    ])
    expect(s.totals.calls).toBe(1)
    expect(s.totals.failures).toBe(3)
    expect(s.totals.failureRatePct).toBe(75)
    expect(s.failuresByReason).toEqual({ api_error: 2, fetch_failed: 1 })
  })

  it('reports cost per user across distinct users', () => {
    const s = summariseAiSpend([
      call('enrich-plan', { cost_usd: 0.4 }, 'a'),
      call('enrich-plan', { cost_usd: 0.6 }, 'b'),
    ])
    expect(s.totals.distinctUsers).toBe(2)
    expect(s.totals.estimatedCostPerUserUsd).toBeCloseTo(0.5, 4)
  })

  // The important one. This repo has four measured defects from `?? 0`, and a
  // spend figure that silently drops an unpriced model is exactly that class:
  // the number stays plausible while a whole surface is missing from it.
  it('returns null — not a plausible-looking partial — when any call is unpriced', () => {
    const s = summariseAiSpend([
      call('enrich-plan', { cost_usd: 0.5 }),
      call('trend', { cost_usd: null, model: 'claude-unreleased', inputTokens: 999_999 }),
    ])
    expect(s.totals.estimatedCostUsd).toBeNull()
    expect(s.totals.estimatedCostPerUserUsd).toBeNull()
    expect(s.totals.unpricedCalls).toBe(1)
    const trend = s.bySurface.find(x => x.surface === 'trend')!
    expect(trend.estimatedCostUsd).toBeNull()
    // The PRICED surface keeps its own honest number.
    expect(s.bySurface.find(x => x.surface === 'enrich-plan')!.estimatedCostUsd).toBeCloseTo(0.5, 4)
  })

  it('recomputes cost from tokens for a row written before cost_usd was stamped', () => {
    const s = summariseAiSpend([
      { kind: 'ai_call', user_id: 'u1', created_at: 'x',
        detail: { surface: 'trend', model: 'claude-haiku-4-5-20251001', inputTokens: 1_000_000, outputTokens: 0 } },
    ])
    expect(s.totals.estimatedCostUsd).toBeCloseTo(1, 4)  // $1/Mtok input
  })

  it('handles an empty window without dividing by zero', () => {
    const s = summariseAiSpend([])
    expect(s.totals).toMatchObject({ calls: 0, failures: 0, failureRatePct: 0, distinctUsers: 0 })
    expect(s.bySurface).toEqual([])
  })

  it('buckets a row with no surface rather than dropping it', () => {
    const s = summariseAiSpend([{ kind: 'ai_call', user_id: null, created_at: 'x', detail: null }])
    expect(s.bySurface[0].surface).toBe('unknown')
    expect(s.totals.calls).toBe(1)
  })
})
