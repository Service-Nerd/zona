// ENRICH-PARSE-DIAG-01 — a `parse_error` must record WHY it failed.
//
// 🔴 THE DEFECT THIS GUARDS. The handler was `catch {` with
// `detail: rawText.slice(0, 200)` — the exception discarded, and the FIRST 200
// characters stored. A parse failure is almost never visible at the start: the head
// of an enrichment payload is always a well-formed `{ "meta": { "notes": "..."`.
//
// ⚠️ MEASURED 2026-10-02: two live runners lost their AI voice to `parse_error`, and
// the stored detail for both began with a markdown fence — which made the fence look
// like the cause. Fences are stripped two lines earlier and the enum comment says so.
// **The symptom was an artefact of the logging window**, and I built a hypothesis on
// it before checking. The cause was, and still is, undiagnosable from what was kept.
//
// So this asserts the detail carries the three things that identify a cause:
// the exception MESSAGE, the LENGTH, and the TAIL.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_FETCH = globalThis.fetch

/** A response whose body parses as an API reply but whose TEXT is not JSON. */
function anthropicReturning(text: string) {
  return vi.fn(async () => new Response(
    JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  ))
}

describe('ENRICH-PARSE-DIAG-01 — parse_error says why', () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY ??= 'test-key' })
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; vi.restoreAllMocks() })

  it('a TRUNCATED body records the exception, the length and the tail — not the head', async () => {
    // The shape of a real truncation: valid opening, cut off mid-string.
    const truncated = '```json\n{\n  "meta": { "notes": "20-week plan to London Marathon 2027, athlete starts at 30'
    globalThis.fetch = anthropicReturning(truncated) as never
    const { enrich } = await import('./enrich')
    const plan = { weeks: [], meta: {} } as never
    // `units` is REQUIRED, not defaulted — the compiler asks each call site.
    const res = await enrich(plan, { athlete_name: 'A' } as never, 'paid' as never, null, 'km')

    // Narrow the union rather than casting: the discriminant is `status`.
    expect(res.outcome.status).toBe('failed')
    if (res.outcome.status !== 'failed') throw new Error('unreachable')
    expect(res.outcome.reason).toBe('parse_error')
    const d = JSON.parse(String(res.outcome.detail))

    // 🔴 The three fields that make it diagnosable. Before this fix, none existed.
    expect(d.message, 'the exception was discarded by a bare `catch {`').toBeTruthy()
    expect(typeof d.length, 'without the length, truncation cannot be distinguished').toBe('number')
    expect(d.length).toBe(truncated.length)
    expect(d.tail, 'the TAIL is where a truncation is visible').toContain('starts at 30')

    // ⚠️ And the head must NOT be the whole story — the thing that misled me.
    expect(String(res.outcome.detail).startsWith('```json'), 'detail must not be a bare head slice').toBe(false)
  })

  it('the fence is NOT the cause — a fenced but VALID body enriches', async () => {
    // Pins the fact I got wrong: stripping happens before the parse, so a fence
    // alone never produces parse_error. If this ever fails, the stripper broke.
    globalThis.fetch = anthropicReturning('```json\n{"weeks":[]}\n```') as never
    const { enrich } = await import('./enrich')
    const res = await enrich({ weeks: [], meta: {} } as never, { athlete_name: 'A' } as never, 'paid' as never, null, 'km')
    const reason = res.outcome.status === 'failed' ? res.outcome.reason : null
    expect(reason, 'a fenced but valid body must not be a parse_error').not.toBe('parse_error')
  })
})
