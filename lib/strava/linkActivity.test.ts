// STRAVA-SOR-REVIEW-FIX-03 — the client half of a refused Strava link.
// Before: the completion was saved with its Strava id, link-activity answered 409 `discarded_no_healthkit_match`, and
// nothing read it. PostRun showed "Reading the run" over an analysis that could never exist; the auto-heal re-tried on
// every open. Now one owner clears the link on that answer.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { postLinkActivity, LINK_DISCARDED_MODE } from './linkActivity'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

function recorder(first: Response, unlink: () => Response = () => reply(200, { ok: true, cleared: true })) {
  const calls: { url: string; body: unknown }[] = []
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return calls.length === 1 ? first : unlink()
  }
  return { calls, fetcher }
}
const BODY = { strava_activity_id: 5, week_n: 3, session_day: 'tue' }

describe('postLinkActivity', () => {
  it('🔴 a 409 discard clears the completion link through unlink-activity and reports it', async () => {
    const r = recorder(reply(409, { ok: false, mode: LINK_DISCARDED_MODE }))
    expect(await postLinkActivity(r.fetcher, BODY)).toBe('discarded')
    expect(r.calls.map(c => c.url)).toEqual(['/api/strava/link-activity', '/api/strava/unlink-activity'])
    // Conditional on the refused id, so a newer link made meanwhile survives.
    expect(r.calls[1].body).toEqual({ week_n: 3, session_day: 'tue', only_if_strava_activity_id: 5 })
  })
  it('🔴 a refusal the unlink did NOT clear (already merged, re-linked, or the unlink failed) is not reported as discarded', async () => {
    for (const un of [() => reply(200, { ok: true, cleared: false, reason: 'attached' }), () => reply(200, { ok: true, cleared: false }), () => reply(500, { error: 'x' })]) {
      const r = recorder(reply(409, { ok: false, mode: LINK_DISCARDED_MODE }), un)
      expect(await postLinkActivity(r.fetcher, BODY)).toBe('failed')
      expect(r.calls).toHaveLength(2)
    }
  })
  it('any other failure leaves the link alone', async () => {
    for (const res of [reply(409, { mode: 'something_else' }), reply(502, { error: 'x' }), reply(400, { error: 'Strava not connected' })]) {
      const r = recorder(res)
      expect(await postLinkActivity(r.fetcher, BODY)).toBe('failed')
      expect(r.calls).toHaveLength(1)
    }
  })
  it('success is linked, and a thrown fetch is failed, never a throw', async () => {
    expect(await postLinkActivity(recorder(reply(200, { ok: true, mode: 'healthkit' })).fetcher, BODY)).toBe('linked')
    expect(await postLinkActivity(async () => { throw new Error('offline') }, BODY)).toBe('failed')
  })
})

describe('every client call to link-activity goes through the owner', () => {
  it('🔴 no hand-written POST to /api/strava/link-activity in the app', () => {
    const root = join(__dirname, '../..')
    for (const f of ['app/dashboard/DashboardClient.tsx', 'components/dashboard/SessionPopupInner.tsx']) {
      const src = readFileSync(join(root, f), 'utf8')
      expect(src.includes("'/api/strava/link-activity'"), f).toBe(false)
      expect(src.includes('postLinkActivity('), f).toBe(true)
    }
  })
})
