// STRAVA-SOR-REVIEW-FIX-03 — the single client owner of a call to /api/strava/link-activity.
//
// 🔴 Three call sites (the reflect close, the post-run screen, the orphan auto-heal) each wrote the POST by hand, and
// none knew what a 409 meant. Since STRAVA-WEBHOOK-SOR-01 a Strava activity with no matching Apple Health run is
// refused (`discarded_no_healthkit_match`), but the completion row had ALREADY been saved with its Strava id. So the
// post-run screen waited on an analysis that could never be written, and the auto-heal re-tried the link on every
// open. On that answer this clears the completion's link through the existing unlink route, which is the one owner of
// clearing a link, so the session reads as logged and not linked.
//
// Pure apart from the injected fetcher, so it is tested without a browser. Not here, deliberately: filtering the
// picker to linkable Strava runs (trimmed with STRAVA-SOR-REVIEW-FIX-03; a refused pick is now handled, not prevented).
export const LINK_DISCARDED_MODE = 'discarded_no_healthkit_match'

export type LinkBody =
  | { strava_activity_id: number; week_n: number; session_day: string }
  | { apple_health_uuid: string; week_n: number; session_day: string }

/** `linked` the route took it · `discarded` no Apple Health run, and the link was cleared · `failed` anything else. */
export type LinkOutcome = 'linked' | 'discarded' | 'failed'

type Fetcher = (url: string, init: RequestInit) => Promise<Response>

export async function postLinkActivity(fetcher: Fetcher, body: LinkBody, tag = 'link'): Promise<LinkOutcome> {
  try {
    const res = await fetcher('/api/strava/link-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return 'linked'
    const text = await res.text().catch(() => '')
    let mode: unknown = null
    try { mode = JSON.parse(text)?.mode } catch { /* not JSON */ }
    if (res.status === 409 && mode === LINK_DISCARDED_MODE) {
      const un = await fetcher('/api/strava/unlink-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only while the completion still carries THIS refused id. The runner can re-link the
        // session between the refusal and this call, and an unconditional clear would wipe the newer link.
        body: JSON.stringify({
          week_n: body.week_n, session_day: body.session_day,
          ...('strava_activity_id' in body ? { only_if_strava_activity_id: body.strava_activity_id } : {}),
        }),
      })
      // `discarded` only when the link really was cleared. Not cleared (the run is already merged onto an Apple Health
      // row, or the runner re-linked meanwhile) or a failed unlink leaves the link as it is, so the screen must not say
      // the run was not linked.
      const unBody = un.ok ? await un.json().catch(() => null) : null
      if (unBody?.cleared === true) return 'discarded'
      if (!un.ok) console.error(`[${tag}] unlink after discard failed`, un.status)
      else console.warn(`[${tag}] link refused but kept`, unBody?.reason ?? 'not cleared')
      return 'failed'
    }
    console.error(`[${tag}] link-activity failed`, res.status, text)
    return 'failed'
  } catch (e) {
    console.error(`[${tag}] link-activity threw`, e)
    return 'failed'
  }
}
