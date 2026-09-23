import { describe, it, expect } from 'vitest'
import { readPlanStream } from './planStream'
import type { Plan } from '@/types/plan'

/**
 * PLAN-STREAM-OWNER-01 — the modify-plan sheet sat through the whole enrichment
 * before it could use a message the server sent immediately.
 *
 * ⚠️ THE TEST THAT MATTERS IS THE COMPARISON, NOT THE ASSERTION. "readPlanStream
 * yields rule_plan" is true of the broken implementation too — `await res.text()`
 * also ends up holding the first message. What was wrong was WHEN. So the case
 * below runs the OLD expression against the SAME stream and asserts the two
 * disagree about time. A test that only exercised the new code would have passed
 * against the defect.
 */

const RULE  = { meta: { which: 'rule'  }, weeks: [] } as unknown as Plan
const FINAL = { meta: { which: 'final' }, weeks: [] } as unknown as Plan

/** The real shape: rule_plan at once, then `await enrichWork`, then final_plan.
 *  `enrichMs` stands in for the measured 38,924 ms. */
function planResponse(enrichMs: number): Response {
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    async start(c) {
      c.enqueue(enc.encode(JSON.stringify({ type: 'rule_plan', plan: RULE }) + '\n'))
      await new Promise(r => setTimeout(r, enrichMs))
      c.enqueue(enc.encode(JSON.stringify({ type: 'final_plan', plan: FINAL }) + '\n'))
      c.close()
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } })
}

const ENRICH_MS = 250

describe('PLAN-STREAM-OWNER-01', () => {
  it('🔴 the sheet gets rule_plan WITHOUT waiting for enrichment', async () => {
    const t0 = Date.now()
    let got: Plan | null = null
    for await (const msg of readPlanStream(planResponse(ENRICH_MS))) {
      if (msg.type === 'rule_plan') { got = msg.plan; break }
    }
    const elapsed = Date.now() - t0
    expect(got).toEqual(RULE)
    expect(elapsed, `waited ${elapsed}ms for a message sent at once`).toBeLessThan(ENRICH_MS)
  })

  it('🔴 FALSIFICATION — the old `await res.text()` cannot do that', async () => {
    // Byte-for-byte the expression that shipped, against an identical stream.
    const t0 = Date.now()
    const text = await planResponse(ENRICH_MS).text()
    const first = text.split('\n').find(Boolean)
    const elapsed = Date.now() - t0
    // It does reach the right plan — which is why reading the code convinced
    // everyone it was fine — but only after the whole stream closed.
    expect(JSON.parse(first!).plan).toEqual(RULE)
    expect(elapsed, 'res.text() returned before the stream closed — premise broken').toBeGreaterThanOrEqual(ENRICH_MS)
  })

  it('the wizard still gets BOTH messages, in order', async () => {
    const seen: string[] = []
    for await (const msg of readPlanStream(planResponse(20))) seen.push(msg.type)
    expect(seen).toEqual(['rule_plan', 'final_plan'])
  })

  it('breaking early cancels the reader, so the connection is released', async () => {
    let cancelled = false
    const enc = new TextEncoder()
    const stream = new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(JSON.stringify({ type: 'rule_plan', plan: RULE }) + '\n'))
        // deliberately never closed — the server is still enriching
      },
      cancel() { cancelled = true },
    })
    for await (const msg of readPlanStream(new Response(stream))) {
      if (msg.type === 'rule_plan') break
    }
    expect(cancelled, 'early exit left the stream open').toBe(true)
  })

  it('a response with no body yields nothing rather than throwing', async () => {
    const seen: unknown[] = []
    for await (const m of readPlanStream(new Response(null))) seen.push(m)
    expect(seen).toEqual([])
  })

  it('a malformed line throws rather than yielding a silently empty stream', async () => {
    const stream = new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode('{not json\n')); c.close() },
    })
    await expect((async () => {
      for await (const _ of readPlanStream(new Response(stream))) { /* consume */ }
    })()).rejects.toThrow()
  })
})
