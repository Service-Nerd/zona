import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const recordOpsEvent = vi.fn()
vi.mock('@/lib/ops/recordOpsEvent', () => ({
  recordOpsEvent: (...a: any[]) => recordOpsEvent(...a),
}))

import { callAnthropic } from './callAnthropic'
import { AI_SURFACES, isAiSurface } from './surfaces'
import { AI_ROUTE_LIMITS } from './limits'
import { usageCostUsd, MODEL_PRICING_USD_PER_MTOK } from './pricing'
import { ANTHROPIC_MODEL, ANTHROPIC_MODEL_DEEP } from './models'

const okBody = (text: string, usage: Record<string, number> = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({ content: [{ text }], usage }),
})

beforeEach(() => {
  recordOpsEvent.mockReset()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

describe('callAnthropic — the request it sends', () => {
  it('sends the same URL, headers and body the fourteen call sites used to send by hand', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okBody('hi'))
    vi.stubGlobal('fetch', fetchMock)

    await callAnthropic({
      surface: 'daily-coach-note',
      model: ANTHROPIC_MODEL,
      maxTokens: 80,
      messages: [{ role: 'user', content: 'p' }],
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'x-api-key': 'test-key',
      'anthropic-version': '2023-06-01',
    })
    expect(JSON.parse(init.body)).toEqual({
      model: ANTHROPIC_MODEL,
      max_tokens: 80,
      messages: [{ role: 'user', content: 'p' }],
    })
  })

  it('omits `system` entirely when the caller does not pass one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okBody('hi'))
    vi.stubGlobal('fetch', fetchMock)
    await callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 10, messages: [] })
    expect('system' in JSON.parse(fetchMock.mock.calls[0][1].body)).toBe(false)
  })

  it('sends the beta header and cached system block for the two prompt-caching surfaces', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okBody('hi'))
    vi.stubGlobal('fetch', fetchMock)
    const system = [{ type: 'text', text: 'S', cache_control: { type: 'ephemeral' } }]
    await callAnthropic({
      surface: 'enrich-plan', model: ANTHROPIC_MODEL, maxTokens: 6000, system,
      messages: [{ role: 'user', content: 'm' }], beta: 'prompt-caching-2024-07-31',
    })
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['anthropic-beta']).toBe('prompt-caching-2024-07-31')
    expect(JSON.parse(init.body).system).toEqual(system)
  })

  it('uses an explicitly passed apiKey over the environment (enrichMaintenance does this)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okBody('hi'))
    vi.stubGlobal('fetch', fetchMock)
    await callAnthropic({ surface: 'enrich-maintenance', model: ANTHROPIC_MODEL, maxTokens: 1, messages: [], apiKey: 'other' })
    expect(fetchMock.mock.calls[0][1].headers['x-api-key']).toBe('other')
  })
})

describe('callAnthropic — what it records (OPS-AI-SPEND-01 / OPS-AI-FAILURE-ALERT-01)', () => {
  it('records usage and an estimated cost on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okBody('out', {
      input_tokens: 1000, output_tokens: 200,
      cache_creation_input_tokens: 400, cache_read_input_tokens: 5000,
    })))

    const res = await callAnthropic({
      surface: 'enrich-plan', model: ANTHROPIC_MODEL, maxTokens: 6000,
      messages: [], userId: 'u1',
    })

    expect(res.ok).toBe(true)
    expect(recordOpsEvent).toHaveBeenCalledTimes(1)
    const [kind, detail, userId] = recordOpsEvent.mock.calls[0]
    expect(kind).toBe('ai_call')
    expect(userId).toBe('u1')
    expect(detail).toMatchObject({
      surface: 'enrich-plan',
      inputTokens: 1000, outputTokens: 200,
      cacheCreationTokens: 400, cacheReadTokens: 5000,
    })
    // Haiku: 1000 in @ $1/Mtok + 200 out @ $5 + 400 write @ 1.25 + 5000 read @ 0.1
    expect(detail.cost_usd).toBeCloseTo(0.0010 + 0.0010 + 0.0005 + 0.0005, 6)
  })

  it('records a failure with its status on a non-2xx, and still degrades silently', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 529, text: async () => 'overloaded',
    }))

    const res = await callAnthropic({ surface: 'analyse-run', model: ANTHROPIC_MODEL, maxTokens: 200, messages: [] })

    expect(res).toMatchObject({ ok: false, reason: 'api_error', status: 529 })
    expect(recordOpsEvent).toHaveBeenCalledWith(
      'ai_call_failed',
      expect.objectContaining({ surface: 'analyse-run', reason: 'api_error', status: 529 }),
      null,
    )
  })

  it('records a transport throw as fetch_failed and never rethrows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')))
    const res = await callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 1, messages: [] })
    expect(res).toMatchObject({ ok: false, reason: 'fetch_failed', status: null })
    expect(recordOpsEvent.mock.calls[0][0]).toBe('ai_call_failed')
  })

  it('treats a 2xx whose body is not JSON as a failure rather than an empty answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => { throw new Error('Unexpected token') },
    }))
    const res = await callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 1, messages: [] })
    expect(res.ok).toBe(false)
    expect(recordOpsEvent.mock.calls[0][0]).toBe('ai_call_failed')
  })

  it('never lets a telemetry failure break the call it is monitoring', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okBody('still fine')))
    recordOpsEvent.mockRejectedValueOnce(new Error('supabase down'))
    // recordOpsEvent's own contract is "never throws". Awaiting it unguarded
    // would make that contract load-bearing for every AI call in the product,
    // so callAnthropic enforces it rather than trusting it. Falsified: without
    // the try/catch in `record()` this test fails with "supabase down".
    const res = await callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 1, messages: [] })
    expect(res).toMatchObject({ ok: true, text: 'still fine' })
  })
})

describe('pricing', () => {
  it('prices both live models', () => {
    expect(MODEL_PRICING_USD_PER_MTOK[ANTHROPIC_MODEL]).toBeDefined()
    expect(MODEL_PRICING_USD_PER_MTOK[ANTHROPIC_MODEL_DEEP]).toBeDefined()
  })

  it('returns null — never 0 — for a model it has no price for', () => {
    expect(usageCostUsd('claude-something-unreleased', {
      inputTokens: 10_000, outputTokens: 10_000, cacheCreationTokens: 0, cacheReadTokens: 0,
    })).toBeNull()
  })
})

describe('the surface vocabulary is single-owned', () => {
  it('every AI_ROUTE_LIMITS key is a declared surface or a non-AI route', () => {
    // `generate-plan` and `maintenance-block` are ROUTES that rate-limit but
    // whose Anthropic call is made from lib/ under a different surface name.
    const routeOnly = new Set(['generate-plan', 'maintenance-block'])
    for (const key of Object.keys(AI_ROUTE_LIMITS)) {
      if (routeOnly.has(key)) continue
      expect(isAiSurface(key), `AI_ROUTE_LIMITS key "${key}" is not in AI_SURFACES`).toBe(true)
    }
  })

  it('every declared surface is actually used by a call site', () => {
    const used = new Set<string>()
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        if (e === 'node_modules' || e === '.next' || e === '.git') continue
        const p = join(dir, e)
        if (statSync(p).isDirectory()) { walk(p); continue }
        if (!/\.tsx?$/.test(e) || /\.test\.tsx?$/.test(e)) continue
        const src = readFileSync(p, 'utf8')
        for (const s of AI_SURFACES) if (new RegExp(`surface:\\s*'${s}'`).test(src)) used.add(s)
      }
    }
    walk(join(process.cwd(), 'app'))
    walk(join(process.cwd(), 'lib'))
    const unused = AI_SURFACES.filter(s => !used.has(s))
    expect(unused, `declared but never called: ${unused.join(', ')}`).toEqual([])
  })
})

/**
 * OPS-FN-DURATION-01 (2026-11-08) — THE CALL HAD NO TIMEOUT, AND THE CONSEQUENCE WAS SILENCE.
 *
 * 🔴 There was no `AbortSignal`, no `AbortController`, nothing: a hung connection ran until the
 * platform killed the function. ⚠️ **And a function the platform kills cannot log its own
 * death** — `ai_call_failed` had **0 rows, ever**, which reads as "nothing has ever failed".
 * That is the `TELEMETRY-BLIND-01` shape landing on the one failure a duration ceiling governs.
 *
 * BEHAVIOURAL, not a source assertion, because a source assertion passes on a comment —
 * `SHEET-RAF-FALLBACK-01` is this repo's recorded precedent for exactly that substitution.
 */
describe('callAnthropic — the timeout (OPS-FN-DURATION-01)', () => {
  it('passes an AbortSignal on every call, sized from the config', () => {
    const fetchMock = vi.fn().mockResolvedValue(okBody('hi'))
    vi.stubGlobal('fetch', fetchMock)
    return callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 10, messages: [] })
      .then(() => {
        const [, init] = fetchMock.mock.calls[0]
        expect(init.signal, 'a fetch with no signal cannot be aborted').toBeInstanceOf(AbortSignal)
        expect(init.signal.aborted, 'and it must not already be aborted').toBe(false)
      })
  })

  it('🔴 a TimeoutError becomes reason `timeout`, not `fetch_failed`', async () => {
    // What `AbortSignal.timeout` actually rejects with: a DOMException named TimeoutError.
    const err = new Error('The operation was aborted due to timeout')
    err.name = 'TimeoutError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err))

    const res = await callAnthropic({ surface: 'enrich-plan', model: ANTHROPIC_MODEL, maxTokens: 6000, messages: [] })
    expect(res.ok).toBe(false)
    expect(res.ok === false && res.reason).toBe('timeout')
    // ⚠️ THE LEDGER IS THE WHOLE POINT. `aiSpend` groups failures BY REASON, so this is what
    // tells you whether to raise the timeout or shrink the prompt.
    expect(recordOpsEvent).toHaveBeenCalledWith(
      'ai_call_failed',
      expect.objectContaining({ surface: 'enrich-plan', reason: 'timeout' }),
      null,
    )
  })

  it('…and it records how long it waited, so the number is tunable from data', () => {
    const err = new Error('aborted')
    err.name = 'TimeoutError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err))
    return callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 10, messages: [] }).then(() => {
      const detail = recordOpsEvent.mock.calls.find(c => c[0] === 'ai_call_failed')![1]
      expect(typeof detail.ms, 'a failure with no duration cannot be compared to a ceiling').toBe('number')
    })
  })

  it('a NON-timeout transport error is still `fetch_failed` — the split is not a rename', async () => {
    // The vacuity arm: without it, "call everything a timeout" passes the arms above.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const res = await callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 10, messages: [] })
    expect(res.ok === false && res.reason).toBe('fetch_failed')
    expect(recordOpsEvent).toHaveBeenCalledWith(
      'ai_call_failed', expect.objectContaining({ reason: 'fetch_failed' }), null,
    )
  })

  it('a 429 is NOT a timeout either — an api_error keeps its status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'slow down' }))
    const res = await callAnthropic({ surface: 'trend', model: ANTHROPIC_MODEL, maxTokens: 10, messages: [] })
    expect(res.ok === false && res.reason).toBe('api_error')
    expect(res.ok === false && res.status).toBe(429)
  })
})
