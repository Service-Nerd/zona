// STRAVA-WEBHOOK-OBS-01 — the pure decisions behind the Strava webhook probe.
//
// WHY THIS EXISTS. HealthKit is the system of record, but a FULLY-KILLED app
// cannot background-ingest: the `HKObserverQuery` callback fires and there is no
// JS runtime to receive it (`HealthObserverPlugin.swift:24`). So for the common
// case — run ends, phone pocketed, app killed — the **only** device-independent
// auto-link is the Strava webhook. That webhook depends on a push subscription
// whose `callback_url` lives at STRAVA, not in this repo: nothing here can fail,
// no deploy can break it, and no test can see it. A NEW silent-failure class,
// added to the zona-debug catalogue as "Untooled external subscription".
//
// The founder's symptom was "runs only link when I open the app". That is what a
// dead subscription looks like from the outside, and it took a debugging session
// to attribute because nothing was watching.
//
// TWO independent checks, because they fail differently:
//   1. The subscription does not exist, or points at a stale/redirecting URL.
//      Observed DIRECTLY against Strava's API — true regardless of whether
//      anyone has run recently, which is what makes it trustworthy.
//   2. The subscription exists at Strava but stops DELIVERING. Only visible as
//      silence, so it needs a heartbeat to be silent against.
//
// Kept pure so both are unit-tested rather than proven by a live cron.

/** The canonical callback. `www` is the only host that serves 200 — the apex
 *  307-redirects, and Strava does not follow redirects, so an apex callback is
 *  a subscription that exists and never delivers. */
export const STRAVA_CALLBACK_URL = 'https://www.zonna.run/api/webhooks/strava'

/** How long silence is allowed before it is reported, given connected athletes.
 *  Generous on purpose: a single connected runner training four times a week can
 *  legitimately produce ~48h gaps, and a probe that cries wolf gets muted. This
 *  is an ops threshold, not a coaching numeric, so it does not belong in
 *  GENERATION_CONFIG. */
export const WEBHOOK_SILENCE_HOURS = 72

export interface StravaSubscription {
  id?: number
  callback_url?: string
  created_at?: string
}

export type SubscriptionVerdict =
  | { ok: true; id?: number }
  | { ok: false; reason: 'missing'; detail: string }
  | { ok: false; reason: 'wrong_callback'; detail: string; actual: string }
  | { ok: false; reason: 'app_inactive'; detail: string; status: number }

/**
 * Strava answered, but not with a subscription list.
 *
 * ⚠️ FOUND LIVE 2026-09-13, running the check for the first time with production
 * credentials: Strava returned **403 { resource: 'Application', field: 'Status',
 * code: 'Inactive' }**. The APPLICATION itself is inactive — not "no
 * subscription", but a state in which no subscription can exist or deliver at
 * all. That is the founder's exact symptom ("runs only link when I open the
 * app"), and no amount of repo tooling could have surfaced it.
 *
 * The first version of this probe returned 502 on any non-OK response, which
 * would have failed the cron loudly but recorded NOTHING about why. An
 * authorization failure is the single most important thing to write down here,
 * because it is the one state a deploy can neither cause nor fix.
 */
export function judgeApiFailure(status: number, body: unknown): SubscriptionVerdict {
  const text = JSON.stringify(body ?? {})
  if (status === 401 || status === 403) {
    const inactive = /Inactive/i.test(text)
    return {
      ok: false,
      reason: 'app_inactive',
      status,
      detail: inactive
        ? 'Strava reports the APPLICATION as Inactive. No push subscription can exist or deliver, so no run auto-links without opening the app. This is fixed in the Strava developer settings, not in this repo.'
        : `Strava refused the credentials (${status}). Check STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET.`,
    }
  }
  return {
    ok: false,
    reason: 'missing',
    detail: `Strava API returned ${status} — subscription state unknown, treated as broken rather than assumed healthy.`,
  }
}

/**
 * Is there a live subscription pointing at the callback that actually serves?
 *
 * A wrong callback is treated as BROKEN rather than a warning: Strava does not
 * follow redirects, so a subscription on the apex host is indistinguishable
 * from no subscription at all from the runner's point of view.
 */
export function judgeSubscriptions(subs: readonly StravaSubscription[]): SubscriptionVerdict {
  if (!subs || subs.length === 0) {
    return {
      ok: false,
      reason: 'missing',
      detail: 'No active Strava push subscription — no run can auto-link without opening the app.',
    }
  }
  const match = subs.find(s => s.callback_url === STRAVA_CALLBACK_URL)
  if (match) return { ok: true, id: match.id }
  const actual = subs[0]?.callback_url ?? '(none)'
  return {
    ok: false,
    reason: 'wrong_callback',
    detail: `Strava subscription points at ${actual}, not ${STRAVA_CALLBACK_URL}. Strava does not follow redirects, so this subscription exists and never delivers.`,
    actual,
  }
}

/**
 * Should prolonged silence be reported?
 *
 * Silence is only evidence when someone could have produced a delivery. With no
 * connected athletes, zero webhooks is the CORRECT state — reporting it would
 * train the team to ignore this probe, which is the failure mode that matters
 * more than a missed alert here (the subscription check above is unconditional
 * and catches the dangerous case anyway).
 */
export function isSilenceSuspicious(args: {
  connectedAthletes: number
  lastDeliveryIso: string | null
  now: Date
  windowHours?: number
}): { suspicious: boolean; hoursSince: number | null; reason: string } {
  const { connectedAthletes, lastDeliveryIso, now } = args
  const windowHours = args.windowHours ?? WEBHOOK_SILENCE_HOURS

  if (connectedAthletes === 0) {
    return { suspicious: false, hoursSince: null, reason: 'no connected athletes — silence is correct' }
  }
  if (!lastDeliveryIso) {
    return {
      suspicious: true,
      hoursSince: null,
      reason: `${connectedAthletes} athlete(s) connected and NO webhook has ever been recorded`,
    }
  }
  const then = new Date(lastDeliveryIso).getTime()
  if (!Number.isFinite(then)) {
    return { suspicious: false, hoursSince: null, reason: 'unparseable last-delivery timestamp' }
  }
  const hoursSince = (now.getTime() - then) / 3_600_000
  if (hoursSince > windowHours) {
    return {
      suspicious: true,
      hoursSince,
      reason: `${connectedAthletes} athlete(s) connected and no webhook delivery in ${hoursSince.toFixed(1)}h (threshold ${windowHours}h)`,
    }
  }
  return { suspicious: false, hoursSince, reason: 'delivering' }
}
