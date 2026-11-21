// STRAVA-SOR-REVIEW-FIX-01 — the client half of a refused Strava link.
// Before: the completion was saved with its Strava id, link-activity answered 409 `discarded_no_healthkit_match`, and
// nothing read it. PostRun showed "Reading the run" over an analysis that could never exist; the auto-heal re-tried on
// every open. Now one owner clears the link on that answer, and the picker stops offering runs the server refuses.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { postLinkActivity, stravaRunIsLinkable, LINK_DISCARDED_MODE } from './linkActivity'

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

function recorder(first: Response) {
  const calls: { url: string; body: unknown }[] = []
  const fetcher = async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return calls.length === 1 ? first : reply(200, { ok: true })
  }
  return { calls, fetcher }
}
const BODY = { strava_activity_id: 5, week_n: 3, session_day: 'tue' }

describe('postLinkActivity', () => {
  it('🔴 a 409 discard clears the completion link through unlink-activity and reports it', async () => {
    const r = recorder(reply(409, { ok: false, mode: LINK_DISCARDED_MODE }))
    expect(await postLinkActivity(r.fetcher, BODY)).toBe('discarded')
    expect(r.calls.map(c => c.url)).toEqual(['/api/strava/link-activity', '/api/strava/unlink-activity'])
    expect(r.calls[1].body).toEqual({ week_n: 3, session_day: 'tue' })
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

describe('stravaRunIsLinkable (the picker asks the server\'s question)', () => {
  const hk = (start: string, km: number, sid: number | null = null) => ({ start_date: start, distance_m: km * 1000, strava_activity_id: sid })
  const run = { start_date: '2026-11-20T07:05:00Z', distance: 10_200 }
  it('🔴 offers a Strava run only when an unattached Apple Health run would take it', () => {
    expect(stravaRunIsLinkable(run, [hk('2026-11-20T07:00:00Z', 10)], 100)).toBe(true)
    expect(stravaRunIsLinkable(run, [hk('2026-11-20T07:00:00Z', 10, 77)], 100)).toBe(false) // attached to another
    expect(stravaRunIsLinkable(run, [hk('2026-11-20T09:00:00Z', 10)], 100)).toBe(false)     // outside ±15 min
    expect(stravaRunIsLinkable(run, [hk('2026-11-20T07:00:00Z', 5)], 100)).toBe(false)      // outside ±15%
    expect(stravaRunIsLinkable(run, [], 100)).toBe(false)
  })
  it('when the Apple Health read was truncated, a run older than it cannot be judged and is offered', () => {
    const rows = [hk('2026-11-21T07:00:00Z', 8), hk('2026-11-21T08:00:00Z', 8)]
    expect(stravaRunIsLinkable(run, rows, 2)).toBe(true)
    expect(stravaRunIsLinkable(run, rows, 3)).toBe(false)
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
