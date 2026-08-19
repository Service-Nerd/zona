import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the rate-limit backend so these tests exercise the guard's own logic
// (size cap, JSON parsing, and the allow/deny branch) without a DB.
const checkAiRateLimit = vi.fn()
vi.mock('./rateLimit', () => ({ checkAiRateLimit: (...a: any[]) => checkAiRateLimit(...a) }))

import { guardAiRequest } from './guardAiRequest'

function reqWith(bodyText: string): Request {
  return { text: async () => bodyText } as unknown as Request
}

describe('guardAiRequest (findings 4 + 5)', () => {
  beforeEach(() => {
    checkAiRateLimit.mockReset()
    checkAiRateLimit.mockResolvedValue(true)
  })

  it('parses a valid JSON body when within limits', async () => {
    const res = await guardAiRequest(reqWith('{"a":1}'), 'u1', 'daily-coach-note')
    expect(res).toEqual({ ok: true, body: { a: 1 } })
  })

  it('treats an empty body as {}', async () => {
    const res = await guardAiRequest(reqWith(''), 'u1', 'daily-coach-note')
    expect(res).toEqual({ ok: true, body: {} })
  })

  it('rejects an oversized body with 413 before rate-limiting', async () => {
    const big = JSON.stringify({ blob: 'x'.repeat(70_000) })
    const res = await guardAiRequest(reqWith(big), 'u1', 'daily-coach-note')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(413)
    expect(checkAiRateLimit).not.toHaveBeenCalled() // short-circuits before the limiter
  })

  it('respects a per-route maxBytes override', async () => {
    const res = await guardAiRequest(reqWith('{"a":1234567890}'), 'u1', 'x', { maxBytes: 4 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(413)
  })

  it('rejects invalid JSON with 400', async () => {
    const res = await guardAiRequest(reqWith('{not json'), 'u1', 'daily-coach-note')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(400)
  })

  it('rejects with 429 when the rate limiter denies', async () => {
    checkAiRateLimit.mockResolvedValue(false)
    const res = await guardAiRequest(reqWith('{"a":1}'), 'u1', 'post-race-reshape')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(429)
  })

  it('applies the heavy per-route limit for expensive routes', async () => {
    await guardAiRequest(reqWith('{"a":1}'), 'u1', 'post-race-reshape')
    expect(checkAiRateLimit).toHaveBeenCalledWith('u1', 'post-race-reshape', 10, 3600)
  })

  it('applies the default limit for unlisted routes', async () => {
    await guardAiRequest(reqWith('{"a":1}'), 'u1', 'daily-coach-note')
    expect(checkAiRateLimit).toHaveBeenCalledWith('u1', 'daily-coach-note', 30, 3600)
  })
})
