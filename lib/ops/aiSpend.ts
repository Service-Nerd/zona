import { usageCostUsd } from '@/lib/ai/pricing'

/**
 * OPS-AI-SPEND-01 — turn `ai_call` / `ai_call_failed` rows into an answer.
 *
 * Pure. The route does the query and the auth; this does the arithmetic, so
 * the arithmetic is testable without a database.
 */

export interface AiCallRow {
  kind: 'ai_call' | 'ai_call_failed'
  user_id: string | null
  created_at: string
  detail: Record<string, unknown> | null
}

export interface SurfaceSpend {
  surface: string
  calls: number
  failures: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  /** null when ANY call on this surface used a model with no price entry. */
  estimatedCostUsd: number | null
  unpricedCalls: number
}

export interface AiSpendSummary {
  totals: {
    calls: number
    failures: number
    failureRatePct: number
    estimatedCostUsd: number | null
    unpricedCalls: number
    distinctUsers: number
    /** Estimated cost per user over the window. null when the cost is. */
    estimatedCostPerUserUsd: number | null
  }
  bySurface: SurfaceSpend[]
  failuresByReason: Record<string, number>
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v ? v : fallback)

export function summariseAiSpend(rows: AiCallRow[]): AiSpendSummary {
  const bySurface = new Map<string, SurfaceSpend>()
  const failuresByReason: Record<string, number> = {}
  const users = new Set<string>()

  const surfaceOf = (s: string): SurfaceSpend => {
    let e = bySurface.get(s)
    if (!e) {
      e = {
        surface: s, calls: 0, failures: 0,
        inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0,
        estimatedCostUsd: 0, unpricedCalls: 0,
      }
      bySurface.set(s, e)
    }
    return e
  }

  for (const row of rows) {
    const d = row.detail ?? {}
    const e = surfaceOf(str(d.surface, 'unknown'))
    if (row.user_id) users.add(row.user_id)

    if (row.kind === 'ai_call_failed') {
      e.failures++
      const reason = str(d.reason, 'unknown')
      failuresByReason[reason] = (failuresByReason[reason] ?? 0) + 1
      continue
    }

    e.calls++
    const usage = {
      inputTokens: num(d.inputTokens),
      outputTokens: num(d.outputTokens),
      cacheCreationTokens: num(d.cacheCreationTokens),
      cacheReadTokens: num(d.cacheReadTokens),
    }
    e.inputTokens += usage.inputTokens
    e.outputTokens += usage.outputTokens
    e.cacheCreationTokens += usage.cacheCreationTokens
    e.cacheReadTokens += usage.cacheReadTokens

    // Prefer the cost stamped at call time (it used the price list as it stood
    // then); recompute only when the row predates that field.
    const stamped = d.cost_usd
    const cost = stamped === null
      ? null
      : typeof stamped === 'number'
        ? stamped
        : usageCostUsd(str(d.model, ''), usage)

    if (cost === null) {
      e.unpricedCalls++
      // ⚠️ null, never 0. One unpriced call poisons the surface's total on
      // purpose: a number that silently omits a whole model is worse than no
      // number, and this repo has four measured defects from `?? 0`.
      e.estimatedCostUsd = null
    } else if (e.estimatedCostUsd !== null) {
      e.estimatedCostUsd += cost
    }
  }

  const surfaces = Array.from(bySurface.values()).sort(
    (a, b) => (b.estimatedCostUsd ?? Infinity) - (a.estimatedCostUsd ?? Infinity),
  )

  const calls = surfaces.reduce((n, s) => n + s.calls, 0)
  const failures = surfaces.reduce((n, s) => n + s.failures, 0)
  const unpricedCalls = surfaces.reduce((n, s) => n + s.unpricedCalls, 0)
  const total = surfaces.some(s => s.estimatedCostUsd === null)
    ? null
    : surfaces.reduce((n, s) => n + (s.estimatedCostUsd ?? 0), 0)

  const attempted = calls + failures
  const round = (n: number, dp: number) => Number(n.toFixed(dp))

  return {
    totals: {
      calls,
      failures,
      failureRatePct: attempted === 0 ? 0 : round((failures / attempted) * 100, 1),
      estimatedCostUsd: total === null ? null : round(total, 4),
      unpricedCalls,
      distinctUsers: users.size,
      estimatedCostPerUserUsd: total === null || users.size === 0 ? null : round(total / users.size, 4),
    },
    bySurface: surfaces.map(s => ({
      ...s,
      estimatedCostUsd: s.estimatedCostUsd === null ? null : round(s.estimatedCostUsd, 4),
    })),
    failuresByReason,
  }
}
