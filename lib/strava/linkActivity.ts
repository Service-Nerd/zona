// STRAVA-SOR-REVIEW-FIX-01 — the single client owner of a call to /api/strava/link-activity.
//
// 🔴 Three call sites (the reflect close, the post-run screen, the orphan auto-heal) each wrote the POST by hand, and
// none knew what a 409 meant. Since STRAVA-WEBHOOK-SOR-01 a Strava activity with no matching Apple Health run is
// refused (`discarded_no_healthkit_match`), but the completion row had ALREADY been saved with its Strava id. So the
// post-run screen waited on an analysis that could never be written, and the auto-heal re-tried the link on every
// open. On that answer this clears the completion's link through the existing unlink route, which is the one owner of
// clearing a link, so the session reads as logged and not linked.
//
// Pure apart from the injected fetcher, so it is tested without a browser.
import { findEnrichMatch, type EnrichCandidate } from '@/lib/coaching/healthkitConsolidate'

export const LINK_DISCARDED_MODE = 'discarded_no_healthkit_match'

export type LinkBody =
  | { strava_activity_id: number; week_n: number; session_day: string }
  | { apple_health_uuid: string; week_n: number; session_day: string }

/** `linked` the route took it · `discarded` no Apple Health run, link cleared · `failed` anything else. */
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
        // STRAVA-SOR-REVIEW-FIX-02 — only while the completion still carries THIS refused id. The runner can re-link the
        // session between the refusal and this call, and an unconditional clear would wipe the newer link.
        body: JSON.stringify({
          week_n: body.week_n, session_day: body.session_day,
          ...('strava_activity_id' in body ? { only_if_strava_activity_id: body.strava_activity_id } : {}),
        }),
      })
      if (!un.ok) console.error(`[${tag}] unlink after discard failed`, un.status)
      return 'discarded'
    }
    console.error(`[${tag}] link-activity failed`, res.status, text)
    return 'failed'
  } catch (e) {
    console.error(`[${tag}] link-activity threw`, e)
    return 'failed'
  }
}

/**
 * Should the picker offer this Strava run? Only when an unattached Apple Health run would take its patch, which is the
 * question the server asks (`findEnrichMatch`). `hkRows` is the newest `limit` Apple Health rows; when it is full, a run
 * older than the oldest of them cannot be judged and is offered (the server answers, and a refusal is handled).
 */
export function stravaRunIsLinkable(
  run: { start_date: string; distance: number },
  hkRows: readonly EnrichCandidate[],
  limit: number,
): boolean {
  if (findEnrichMatch(run, hkRows)) return true
  if (hkRows.length < limit) return false
  const oldest = Math.min(...hkRows.map(r => new Date(r.start_date).getTime()))
  return new Date(run.start_date).getTime() < oldest
}

/**
 * STRAVA-SOR-REVIEW-FIX-02 — the picker's Strava list, filtered by BOTH rules against the current Apple Health rows:
 * drop a run already merged onto an Apple Health row (it is shown once, as that row), and keep only a run some
 * unattached Apple Health run would take (`stravaRunIsLinkable`). Applied to the RAW Strava list at boot and again every
 * time the Apple Health rows refresh, so a run that syncs after boot makes its Strava twin offerable (and a run just
 * merged stops being offered twice). `hkRows: null` = the Apple Health read failed, so the linkable filter is skipped.
 */
export function linkableStravaRuns<R extends { id: number; start_date: string; distance: number }>(
  rawStravaRuns: readonly R[],
  hkRows: readonly EnrichCandidate[] | null,
  limit: number,
): R[] {
  const merged = new Set((hkRows ?? []).map(r => r.strava_activity_id).filter((x): x is number => x != null))
  return rawStravaRuns
    .filter(r => !merged.has(r.id))
    .filter(r => hkRows == null || stravaRunIsLinkable(r, hkRows, limit))
}
