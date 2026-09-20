import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { usageCostUsd, ZERO_USAGE, type AiUsage } from './pricing'
import type { AiSurface } from './surfaces'

/**
 * OPS-AI-OWNER-01 — the single owner of every call to Anthropic.
 *
 * SERVER-ONLY (it reaches `recordOpsEvent`, which holds the service-role key).
 *
 * WHY THIS EXISTS. There were FOURTEEN independent copies of this fetch, one
 * per surface, agreeing only by accident: same URL, same api-version header,
 * same `content?.[0]?.text` extraction, same `if (res.ok)` / silent-catch
 * shape, written out by hand every time. That is a D-08 duplicate-ownership
 * violation, and it is also the direct cause of BOTH open ops items:
 *
 *   - `OPS-AI-SPEND-01`  — not one of the fourteen read `response.usage`, so
 *     there was no token accounting anywhere and the cost estimate in the
 *     charity brief was derived from prompt-file sizes and `max_tokens`
 *     literals rather than measured.
 *   - `OPS-AI-FAILURE-ALERT-01` — every site degrades silently by design
 *     (ADR-006: the deterministic engine always succeeds, AI is enrichment),
 *     which is correct BEHAVIOUR and must not change, but nothing recorded
 *     that it was happening. The coaching layer could be degraded for days
 *     with no runner reporting it and no dashboard showing it.
 *
 * Both were filed as "smallest useful version: instrument the two or three
 * highest-traffic routes". With one owner there is no such trade: all fourteen
 * are instrumented at once, and the fifteenth is instrumented on the day it is
 * written. `noRawAnthropicCalls.test.ts` is what keeps that true.
 *
 * ⚠️ IT CHANGES NO BEHAVIOUR. Same URL, same headers, same body, same silent
 * fallback. The failure vocabulary is `enrich.ts`'s existing one
 * (`api_error` / `fetch_failed`) rather than a second set of names.
 */

export type AiFailureReason = 'api_error' | 'fetch_failed'

export type AnthropicResult =
  | { ok: true; text: string; data: any; usage: AiUsage }
  | { ok: false; reason: AiFailureReason; status: number | null; detail: string }

export interface AnthropicCall {
  /** Which surface is calling. Shares one vocabulary with `AI_ROUTE_LIMITS`. */
  surface: AiSurface
  model: string
  maxTokens: number
  messages: Array<{ role: string; content: unknown }>
  /** A plain string, or Anthropic's content-block array (used for cache_control). */
  system?: unknown
  /** e.g. 'prompt-caching-2024-07-31'. Sent as the `anthropic-beta` header. */
  beta?: string
  /** Defaults to `process.env.ANTHROPIC_API_KEY`. */
  apiKey?: string
  /** Recorded on the ops event so spend can be attributed. Never a name. */
  userId?: string | null
}

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * `recordOpsEvent` documents itself as never-throwing, and it is careful. But
 * awaiting it unguarded would make that promise load-bearing for every AI call
 * in the product: one unhandled rejection inside telemetry would take down the
 * coaching surface it exists to watch. A monitor must not be able to break the
 * thing it monitors, so the guarantee is enforced here rather than assumed.
 */
async function record(kind: 'ai_call' | 'ai_call_failed', detail: Record<string, unknown>, userId: string | null) {
  try {
    await recordOpsEvent(kind, detail, userId)
  } catch (e) {
    console.error('[ai] ops telemetry failed', kind, e)
  }
}

/** Anthropic's usage block is snake_case and its cache fields are optional. */
function readUsage(raw: unknown): AiUsage {
  const u = (raw ?? {}) as Record<string, unknown>
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    inputTokens:         n(u.input_tokens),
    outputTokens:        n(u.output_tokens),
    cacheCreationTokens: n(u.cache_creation_input_tokens),
    cacheReadTokens:     n(u.cache_read_input_tokens),
  }
}

export async function callAnthropic(call: AnthropicCall): Promise<AnthropicResult> {
  const { surface, model, maxTokens, messages, system, beta, userId = null } = call
  const apiKey = call.apiKey ?? process.env.ANTHROPIC_API_KEY!

  const headers: Record<string, string> = {
    'Content-Type':      'application/json',
    'x-api-key':         apiKey,
    'anthropic-version': '2023-06-01',
  }
  if (beta) headers['anthropic-beta'] = beta

  const body: Record<string, unknown> = { model, max_tokens: maxTokens, messages }
  if (system !== undefined) body.system = system

  let res: Response
  const startedAt = Date.now()
  try {
    res = await fetch(ANTHROPIC_API_URL, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    console.error(`[ai:${surface}] fetch failed`, detail)
    await record('ai_call_failed', { surface, model, reason: 'fetch_failed', detail: detail.slice(0, 200) }, userId)
    return { ok: false, reason: 'fetch_failed', status: null, detail }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[ai:${surface}] Anthropic error`, res.status, detail)
    await record(
      'ai_call_failed',
      { surface, model, reason: 'api_error', status: res.status, detail: detail.slice(0, 200) },
      userId,
    )
    return { ok: false, reason: 'api_error', status: res.status, detail }
  }

  let data: any
  try {
    data = await res.json()
  } catch (e) {
    // A 2xx whose body is not JSON. Rare, but it used to read as an empty
    // string at every call site and vanish into the silent fallback.
    const detail = e instanceof Error ? e.message : String(e)
    console.error(`[ai:${surface}] response was not JSON`, detail)
    await record('ai_call_failed', { surface, model, reason: 'api_error', status: res.status, detail: detail.slice(0, 200) }, userId)
    return { ok: false, reason: 'api_error', status: res.status, detail }
  }

  const usage = readUsage(data?.usage)
  const costUsd = usageCostUsd(model, usage)
  await record(
    'ai_call',
    {
      surface,
      model,
      ms: Date.now() - startedAt,
      ...usage,
      // `null` when the model has no price entry — never 0. See pricing.ts.
      cost_usd: costUsd === null ? null : Number(costUsd.toFixed(6)),
    },
    userId,
  )

  return { ok: true, text: data?.content?.[0]?.text ?? '', data, usage: usage ?? ZERO_USAGE }
}
