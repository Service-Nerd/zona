import { describe, it, expect, afterEach } from 'vitest'
import { getInternalBaseUrl } from './autoAnalyse'

// STRAVA-WEBHOOK-ANALYSE-01 — getInternalBaseUrl is the server→server base for
// the Strava-webhook and HealthKit-ingest calls to /api/analyse-run. GTM-SITE-01
// removed NEXT_PUBLIC_APP_URL and made `https://www.zonna.run` the committed
// default everywhere; this helper was missed and fell back to the per-deployment
// VERCEL_URL / localhost, silently degrading no-app run-analysis. These pin the
// committed default so it cannot regress again.

const KEYS = ['NEXT_PUBLIC_APP_URL', 'VERCEL', 'VERCEL_URL'] as const
const saved: Record<string, string | undefined> = {}
for (const k of KEYS) saved[k] = process.env[k]

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

function clear() { for (const k of KEYS) delete process.env[k] }

describe('getInternalBaseUrl', () => {
  it('prefers an explicit NEXT_PUBLIC_APP_URL when set', () => {
    clear()
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.example.com'
    expect(getInternalBaseUrl()).toBe('https://staging.example.com')
  })

  it('defaults to the committed www canonical on Vercel, NOT the per-deployment URL', () => {
    // The regression: before the fix this returned `https://${VERCEL_URL}` — the
    // deployment-protected per-deployment host — which broke the internal
    // analyse-run call after NEXT_PUBLIC_APP_URL was removed.
    clear()
    process.env.VERCEL = '1'
    process.env.VERCEL_URL = 'zona-abc123.vercel.app'
    expect(getInternalBaseUrl()).toBe('https://www.zonna.run')
  })

  it('falls back to localhost only in local dev (no Vercel env)', () => {
    clear()
    expect(getInternalBaseUrl()).toBe('http://localhost:3000')
  })
})
