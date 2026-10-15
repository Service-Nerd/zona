import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * PLAN-SAVE-SILENT-FAIL-01 (2026-10-15) — a failed plan save is shown to the runner and
 * recorded for us.
 *
 * 🔴 THE DEFECT. `GeneratePlanScreen.handleUsePlan`'s catch was:
 *
 *     } catch {
 *       coordRef.current.saveFailed()
 *       setIsSaving(false)
 *     }
 *
 * The "Saving…" button reset and nothing else happened. A Make-A-Wish runner (S H)
 * built an identical marathon plan twice on 2026-10-08 and saved neither, and whether
 * they never tapped save or tapped it and it failed could not be determined: both left
 * exactly the same nothing.
 *
 * ⚠️ WHAT THIS CAN AND CANNOT REACH. The reporter and the route are run for real. The
 * SCREEN cannot be — `vitest.config.ts` is `environment: 'node'` with no DOM — so its
 * wiring is asserted on bounded, comment-stripped source, and that limit is stated here
 * rather than left to look like a render test.
 */

const posts: Array<{ url: string; body: any }> = []
vi.mock('@/lib/supabase/authedFetch', () => ({
  authedFetch: vi.fn(async (url: string, options: RequestInit = {}) => {
    posts.push({ url, body: options.body ? JSON.parse(String(options.body)) : null })
    return { ok: true } as Response
  }),
}))

const recorded: Array<{ kind: string; detail: any; userId: string | null }> = []
vi.mock('@/lib/ops/recordOpsEvent', () => ({
  recordOpsEvent: vi.fn(async (kind: string, detail: any, userId: string | null) => {
    recorded.push({ kind, detail, userId })
  }),
}))

let currentUser: { id: string } | null = { id: '11111111-2222-4333-8444-555555555555' }
vi.mock('@/lib/supabase/getUserFromRequest', () => ({
  getUserFromRequest: vi.fn(async () => currentUser),
}))

beforeEach(() => { posts.length = 0; recorded.length = 0; currentUser = { id: '11111111-2222-4333-8444-555555555555' } })

describe('PLAN-SAVE-SILENT-FAIL-01 — the client reporter', () => {
  it('posts the failure to the report route', async () => {
    const { reportPlanSaveFailure } = await import('./reportPlanSaveFailure')
    await reportPlanSaveFailure(new TypeError('Failed to fetch'),
      { raceDistanceKm: 42.2, enrichmentPending: true, attempt: 2 })
    expect(posts).toHaveLength(1)
    expect(posts[0].url).toBe('/api/ops/plan-save-report')
    expect(posts[0].body).toMatchObject({
      message: 'Failed to fetch', errorName: 'TypeError',
      raceDistanceKm: 42.2, enrichmentPending: true, attempt: 2,
    })
  })

  it('🔴 NEVER throws, even when reporting itself fails', async () => {
    // It runs inside the save's catch. A reporter that rejected there would replace the
    // runner's real failure with a telemetry one.
    const { authedFetch } = await import('@/lib/supabase/authedFetch')
    vi.mocked(authedFetch).mockRejectedValueOnce(new Error('offline'))
    const { reportPlanSaveFailure } = await import('./reportPlanSaveFailure')
    await expect(reportPlanSaveFailure(new Error('x'))).resolves.toBeUndefined()
  })

  it('reports a non-Error throw without crashing', async () => {
    const { reportPlanSaveFailure } = await import('./reportPlanSaveFailure')
    await reportPlanSaveFailure('a string was thrown')
    expect(posts[0].body.message).toBe('a string was thrown')
  })
})

describe('PLAN-SAVE-SILENT-FAIL-01 — the route records it', () => {
  const call = async (body: unknown) => {
    const { POST } = await import('@/app/api/ops/plan-save-report/route')
    return POST(new Request('http://x/api/ops/plan-save-report', {
      method: 'POST', body: JSON.stringify(body),
    }) as never)
  }

  it('records plan_save_failed_client against the VERIFIED user', async () => {
    const res = await call({ message: 'boom', errorName: 'Error', raceDistanceKm: 42.2, attempt: 1 })
    expect(res.status).toBe(200)
    expect(recorded).toHaveLength(1)
    expect(recorded[0].kind).toBe('plan_save_failed_client')
    expect(recorded[0].userId).toBe('11111111-2222-4333-8444-555555555555')
    expect(recorded[0].detail).toMatchObject({ message: 'boom', race_distance_km: 42.2, attempt: 1 })
  })

  it('refuses an unauthenticated caller and records nothing', async () => {
    currentUser = null
    const res = await call({ message: 'x' })
    expect(res.status).toBe(401)
    expect(recorded).toHaveLength(0)
  })

  it('cannot be told which event kind to write, or whose id to use', async () => {
    // A client that could name its own kind could write anything into the ledger
    // `/api/ops/ai-spend` reads. The body is ignored for both.
    await call({ kind: 'ai_call', userId: 'someone-else', message: 'x' })
    expect(recorded[0].kind).toBe('plan_save_failed_client')
    expect(recorded[0].userId).toBe('11111111-2222-4333-8444-555555555555')
  })

  it('bounds what a client can make it store', async () => {
    await call({ message: 'm'.repeat(5000), raceDistanceKm: 1e9, attempt: -3 })
    expect(recorded[0].detail.message.length).toBe(300)
    expect(recorded[0].detail.race_distance_km).toBe(1000)
    expect(recorded[0].detail.attempt).toBeNull()
  })

  it('still records the failure from an empty body', async () => {
    const { POST } = await import('@/app/api/ops/plan-save-report/route')
    const res = await POST(new Request('http://x', { method: 'POST' }) as never)
    expect(res.status).toBe(200)
    expect(recorded[0].kind).toBe('plan_save_failed_client')
  })
})

describe('PLAN-SAVE-SILENT-FAIL-01 — the screen wiring (bounded source; no DOM in node)', () => {
  const src = readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

  /** The handleUsePlan body, bounded to its own braces rather than a character budget. */
  const handleUsePlan = (() => {
    const at = src.indexOf('async function handleUsePlan(')
    expect(at, 'handleUsePlan moved or was renamed — re-anchor this check').toBeGreaterThan(-1)
    let depth = 0, i = src.indexOf('{', at), start = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') { depth--; if (depth === 0) break }
    }
    return src.slice(start, i + 1)
  })()

  it('🔴 the catch no longer swallows: it shows the runner AND reports', () => {
    const catchAt = handleUsePlan.indexOf('catch')
    expect(catchAt, 'handleUsePlan has no catch').toBeGreaterThan(-1)
    const body = handleUsePlan.slice(catchAt, handleUsePlan.indexOf('finally', catchAt))
    expect(body, 'a bare `catch {` cannot see the error').toMatch(/catch\s*\(\s*\w+\s*\)/)
    expect(body, 'the runner is not told').toMatch(/setSaveError\(\s*["']/)
    expect(body, 'we are not told').toMatch(/reportPlanSaveFailure\(/)
    // Shown BEFORE reported, so telemetry can never delay what the runner sees.
    expect(body.indexOf('setSaveError(')).toBeLessThan(body.indexOf('reportPlanSaveFailure('))
  })

  it('a retry clears the old message', () => {
    expect(handleUsePlan.slice(0, handleUsePlan.indexOf('try'))).toMatch(/setSaveError\(\s*null\s*\)/)
  })

  it('the message renders as an alert in the save bar', () => {
    expect(src).toMatch(/saveError\s*&&\s*!isSaving[\s\S]{0,60}role="alert"/)
  })
})
