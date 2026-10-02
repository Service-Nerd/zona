// ENRICH-PARSE-RETRY-01 — one retry, and ONLY on a parse failure.
//
// 🔴 WHY A RETRY AT ALL, WITH THE CAUSE STILL UNKNOWN. Two live runners lost their
// AI voice to `parse_error` on 2026-10-02 and FOUR hypotheses are dead: a markdown
// fence (stripped before the parse), token truncation (measured across 22 real
// stored plans — worst case 51% of budget), label classification, and a
// deterministic schema problem. What IS established: both bodies parsed on a later
// attempt with no change to the parser — three successful parses of the same prompt
// shape against two prior failures.
//
// ⚠️ So a retry is correct whether or not the cause is ever found: transient → the
// runner is recovered; deterministic → it fails twice and the diagnostics capture
// it, no worse than today.
//
// 🔴 AND THE SCOPE IS THE SAFETY ARGUMENT. These arms exist mostly to pin what is
// NOT retried. Silently doubling spend on a 429 is how a retry becomes an incident.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_FETCH = globalThis.fetch
// ⚠️ Must satisfy `EnrichedPlanSchema`, not merely parse as JSON. The first cut
// used `{"weeks":[]}` — which PARSED fine and then failed the schema, so arm 1
// read as "the retry did not work" when the retry had worked perfectly and the
// FIXTURE was wrong. `meta` is required.
const GOOD = '{"meta":{"notes":"ok"},"weeks":[]}'
const BAD = '```json\n{ "meta": { "notes": "cut off mid-stri'

/** An Anthropic 200 whose text body is `text`. */
function ok(text: string) {
  return new Response(
    JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

async function run() {
  const { enrich } = await import('./enrich')
  return enrich({ weeks: [], meta: {} } as never, { athlete_name: 'A' } as never, 'paid' as never, null, 'km')
}

describe('ENRICH-PARSE-RETRY-01', () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY ??= 'test-key' })
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; vi.restoreAllMocks() })

  it('1. ✅ an unparseable body then a good one RECOVERS, with exactly TWO calls', () => {
    let calls = 0
    globalThis.fetch = vi.fn(async () => { calls++; return ok(calls === 1 ? BAD : GOOD) }) as never
    return run().then(res => {
      expect(res.outcome.status, 'the retry should have recovered this runner').toBe('applied')
      expect(calls, 'exactly one extra call — never two').toBe(2)
    })
  })

  it('2. two unparseable bodies → parse_error, and the diagnostics survive', () => {
    let calls = 0
    globalThis.fetch = vi.fn(async () => { calls++; return ok(BAD) }) as never
    return run().then(res => {
      expect(res.outcome.status).toBe('failed')
      if (res.outcome.status !== 'failed') throw new Error('unreachable')
      expect(res.outcome.reason).toBe('parse_error')
      const d = JSON.parse(String(res.outcome.detail))
      // The diagnostics added earlier today must not be lost to the retry path.
      expect(d.message, 'the exception must still be recorded').toBeTruthy()
      expect(d.tail, 'the TAIL is where truncation is visible').toContain('cut off mid-stri')
      expect(d.retried, 'the detail must say a retry was attempted').toBe(true)
      expect(calls, 'bounded: exactly two attempts, never three').toBe(2)
    })
  })

  it('3. 🔴 an API ERROR is NOT retried — one call only', () => {
    // A 4xx/5xx is callAnthropic's vocabulary. Retrying it here would double spend
    // on a rate limit and hide the real reason behind a parse narrative.
    let calls = 0
    globalThis.fetch = vi.fn(async () => { calls++; return new Response('nope', { status: 500 }) }) as never
    return run().then(res => {
      expect(res.outcome.status).toBe('failed')
      if (res.outcome.status !== 'failed') throw new Error('unreachable')
      expect(res.outcome.reason, 'the API failure reason must pass straight through').not.toBe('parse_error')
      expect(calls, 'an API error must NOT be retried').toBe(1)
    })
  })

  it('4. 🔴 a TRANSPORT failure is NOT retried — one call only', () => {
    let calls = 0
    globalThis.fetch = vi.fn(async () => { calls++; throw new Error('ECONNRESET') }) as never
    return run().then(res => {
      expect(res.outcome.status).toBe('failed')
      if (res.outcome.status !== 'failed') throw new Error('unreachable')
      expect(res.outcome.reason).toBe('fetch_failed')
      expect(calls, 'a transport error must NOT be retried').toBe(1)
    })
  })

  it('5. a good body first time makes NO extra call', () => {
    // The cost guard: the happy path must be untouched.
    let calls = 0
    globalThis.fetch = vi.fn(async () => { calls++; return ok(GOOD) }) as never
    return run().then(() => expect(calls, 'no retry when nothing failed').toBe(1))
  })

  it('6. a FAILED SECOND ATTEMPT still reports parse_error, not fetch_failed', () => {
    // The first call succeeded, so the honest reason is the parse. Reporting
    // fetch_failed would send the next reader looking at the network.
    //
    // 🔴 THIS ARM WAS HOLLOW AND FALSIFICATION CAUGHT IT. It was written as "a
    // transport failure ON THE RETRY", implying a thrown exception — and mutating
    // the catch that was supposed to handle that left the suite GREEN. The reason:
    // `callAnthropic` NEVER THROWS; it returns `{ ok: false, reason: 'fetch_failed' }`.
    // So the catch was dead code and this arm was passing by a path it did not
    // describe. The branch is gone and the arm now names the real one: the second
    // attempt returns not-ok.
    let calls = 0
    globalThis.fetch = vi.fn(async () => {
      calls++
      if (calls === 1) return ok(BAD)
      throw new Error('ECONNRESET on retry')
    }) as never
    return run().then(res => {
      expect(res.outcome.status).toBe('failed')
      if (res.outcome.status !== 'failed') throw new Error('unreachable')
      expect(res.outcome.reason).toBe('parse_error')
      expect(calls).toBe(2)
    })
  })
})
