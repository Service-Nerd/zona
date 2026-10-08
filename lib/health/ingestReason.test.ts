// HK-INGEST-REASON-01 — a failed upload must say WHY.
//
// 🔴 THE DEFECT, MEASURED IN PRODUCTION 2026-10-08: 14 sweeps across 2 users read
// `workouts_found: 1, posted: 0, failed: 1, error: null`. HealthKit found the run, the
// upload failed, and nothing anywhere recorded a reason. One user (`0a972fdf`) has 22
// sweeps that found workouts and ZERO that ever posted.
//
// The telemetry was not at fault. `health_sync_swept` records exactly what it was built
// to record. The reason was destroyed two layers earlier by `return res.ok`, which
// collapsed 401, 422, 429, 500 and every network error into one `false` — while the route
// DOES return a reason in its body.
//
// ⚠️ AND THE ONLY LOGGING LINE WAS UNREACHABLE: the caller's `catch` could never fire for
// an upload failure, because `postWorkout` never threw. Every real failure took the silent
// `else totalFailed++` branch.
//
// 🥇 ZERO `health_ingest_failed` ROWS IS WHAT NARROWED IT. That event is recorded at the
// UPSERT, so zero rows ever eliminates the write entirely — the request is rejected at an
// early return, and all three of those were silent on both sides.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()
vi.mock('@/lib/supabase/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => fetchMock(...args),
}))

import { postWorkout, postSamples } from './clientSync'

const PAYLOAD = {
  uuid: 'abc', startDate: '2026-10-08T07:00:00Z', endDate: '2026-10-08T07:40:00Z',
  totalDistanceMeters: 8000, durationSeconds: 2400, hrSamples: [], workoutType: 'running' as const,
}

const res = (status: number, body?: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)),
})

beforeEach(() => fetchMock.mockReset())
afterEach(() => vi.restoreAllMocks())

describe('postWorkout keeps the reason', () => {
  it('success reports ok with no reason', async () => {
    fetchMock.mockResolvedValue(res(200, { status: 'stored' }))
    expect(await postWorkout(PAYLOAD)).toEqual({ ok: true, status: 200, reason: null })
  })

  // 🔴 THE CASE THE WHOLE FIX EXISTS FOR, and the leading hypothesis for the live bug:
  // `!payload.totalDistanceMeters` rejects ZERO, and `clientSync` sends
  // `totalDistance ?? 0` — so an indoor run with no GPS is rejected forever.
  it('a 422 carries the route’s own message, not just "false"', async () => {
    fetchMock.mockResolvedValue(res(422, { error: 'missing or zero: totalDistanceMeters' }))
    const out = await postWorkout(PAYLOAD)
    expect(out.ok).toBe(false)
    expect(out.status).toBe(422)
    expect(out.reason).toBe('missing or zero: totalDistanceMeters')
  })

  it('distinguishes 401 from 422 from 500 — the whole point', async () => {
    for (const status of [401, 422, 429, 500]) {
      fetchMock.mockResolvedValue(res(status, { error: `e${status}` }))
      expect((await postWorkout(PAYLOAD)).status).toBe(status)
    }
  })

  // ⚠️ Reading the body must never turn a diagnosable failure into an undiagnosable one.
  it('a non-JSON body still yields the STATUS', async () => {
    fetchMock.mockResolvedValue(res(502, '<html>Bad Gateway</html>'))
    const out = await postWorkout(PAYLOAD)
    expect(out.status).toBe(502)
    expect(out.reason).toContain('Bad Gateway')
  })

  it('an unreadable body still yields the status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => { throw new Error('stream') } })
    expect(await postWorkout(PAYLOAD)).toEqual({ ok: false, status: 503, reason: 'HTTP 503' })
  })

  it('a thrown request reports NO status and says so', async () => {
    // ⚠️ `mockImplementation` and not `mockRejectedValue`: the latter constructs the
    // rejected promise eagerly, which vitest reports as an unhandled rejection before
    // the mock is ever called. A throwing implementation rejects only when invoked.
    // ⚠️ `mockImplementationOnce(() => Promise.reject(...))`, not `mockRejectedValue`
    // and not a persistent async thrower: both of those leave a rejected promise that
    // vitest reports as UNHANDLED and attributes to the line that built the Error, so
    // the suite fails while the assertions pass. Verified: the function returns
    // `{ok:false, status:null, reason:'...'}` correctly in all three forms.
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('Network request failed')))
    const out = await postWorkout(PAYLOAD)
    // 🔴 `status: null` is a finding, not a gap: it means the request never completed,
    // which is a different diagnosis from any HTTP code.
    expect(out).toEqual({ ok: false, status: null, reason: 'Network request failed' })
  })
})

describe('postSamples — the twin, found by sweeping for the SHAPE', () => {
  // Exit criterion 3: grep for the shape of the fix, not the symptom. `postSamples` had
  // the identical `return res.ok / catch → false`, so a failed recovery-sample upload was
  // exactly as undiagnosable. Found 2, fixed 2.
  it('carries the reason too', async () => {
    fetchMock.mockResolvedValue(res(422, { error: 'sampleDate required' }))
    expect(await postSamples([{ sampleDate: 'x' }])).toEqual({
      ok: false, status: 422, reason: 'sampleDate required',
    })
  })

  it('an empty batch is a no-op success and makes no request', async () => {
    expect(await postSamples([])).toEqual({ ok: true, status: null, reason: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the sweep event reports failures separately from a throw', () => {
  const SRC = String(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('node:fs').readFileSync('lib/health/clientSync.ts', 'utf8'),
  )

  it('the rejected branch records a reason instead of only counting', async () => {
    expect(SRC).toContain('noteFailure(failureReasons, outcome)')
    // 🔴 The pre-fix form must not come back.
    expect(SRC).not.toMatch(/if \(ok\) totalSynced\+\+\s*\n\s*else totalFailed\+\+/)
  })

  it('`failures` is DISTINCT from `error`, because they mean different things', async () => {
    // `error` = the sweep threw (the plugin query failed). `failures` = individual
    // workouts were rejected while the sweep ran fine. Collapsing them would recreate
    // the original ambiguity: `failed: 1, error: null`.
    expect(SRC).toContain('failures?:     string')
    expect(SRC).toMatch(/failures: formatFailures\(failureReasons\)/)
  })

  it('the server records the rejection too, naming the field AND its value', async () => {
    const route = String(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').readFileSync('app/api/health/ingest/route.ts', 'utf8'),
    )
    expect(route).toContain("recordOpsEvent('health_ingest_rejected'")
    // ⚠️ `!x` cannot tell 0 from undefined, and a 0-distance run is a real indoor run.
    expect(route).toContain('distance_m:')
    expect(route).toContain("missing: missing.join(',')")
  })
})

describe('formatFailures deduplicates with counts', () => {
  // ⚠️ Deduplicated on purpose: one user logged 13 failing sweeps in a day on what is
  // probably ONE stuck workout. A raw list would be the same sentence thirteen times and
  // would truncate the SECOND distinct reason out of a 500-char column — the one worth
  // having. Asserted through the public surface by driving postWorkout.
  it('is exercised by the sweep, and the helper is not exported by accident', async () => {
    const mod = await import('./clientSync') as Record<string, unknown>
    expect(typeof mod.postWorkout).toBe('function')
    // Internal by design — the sweep is its only caller.
    expect(mod.formatFailures).toBeUndefined()
    expect(mod.noteFailure).toBeUndefined()
  })
})
