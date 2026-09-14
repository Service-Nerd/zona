// STRAVA-WEBHOOK-OBS-01 — the probe's two decisions, tested pure.
//
// The failure this guards is the one nothing in the repo can see: a Strava push
// subscription whose callback_url lives at Strava's end. A fully-killed app
// cannot background-ingest from HealthKit, so that webhook is the ONLY
// device-independent auto-link for the common case — run ends, phone pocketed,
// app killed. When it dies, runs silently stop linking until the runner opens
// the app, which is precisely the symptom that took a debugging session to
// attribute because nothing was watching.
import { describe, it, expect } from 'vitest'
import {
  judgeSubscriptions,
  judgeApiFailure,
  isSilenceSuspicious,
  STRAVA_CALLBACK_URL,
  WEBHOOK_SILENCE_HOURS,
} from './stravaWebhookHealth'

const NOW = new Date('2026-09-14T08:00:00Z')
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString()

describe('judgeSubscriptions — the check that does not depend on anyone running', () => {
  it('healthy when a subscription points at the canonical callback', () => {
    const v = judgeSubscriptions([{ id: 1, callback_url: STRAVA_CALLBACK_URL }])
    expect(v.ok).toBe(true)
  })

  it('BROKEN when there is no subscription at all', () => {
    const v = judgeSubscriptions([])
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('missing')
  })

  it('BROKEN on the apex host — it exists and never delivers', () => {
    // The trap this encodes: zonna.run 307-redirects to www, and Strava does not
    // follow redirects. A subscription on the apex looks present in the Strava
    // dashboard and delivers nothing, which is indistinguishable from a dead
    // one for the runner. Treating it as a warning would be wrong.
    const v = judgeSubscriptions([{ id: 2, callback_url: 'https://zonna.run/api/webhooks/strava' }])
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.reason).toBe('wrong_callback')
      expect(v.detail).toContain('does not follow redirects')
    }
  })

  it('finds the canonical one among several', () => {
    const v = judgeSubscriptions([
      { id: 1, callback_url: 'https://old.example/hook' },
      { id: 2, callback_url: STRAVA_CALLBACK_URL },
    ])
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.id).toBe(2)
  })
})

describe('judgeApiFailure — the state found live, which the first version discarded', () => {
  it('403 Application/Inactive is recorded as app_inactive, not swallowed', () => {
    // The real response, 2026-09-13, running the check for the first time with
    // production credentials. The Strava APPLICATION is inactive — no push
    // subscription can exist or deliver at all, which is exactly the founder's
    // "runs only link when I open the app". The first version of the probe
    // returned 502 here and recorded nothing about why.
    const v = judgeApiFailure(403, {
      message: 'Forbidden',
      errors: [{ resource: 'Application', field: 'Status', code: 'Inactive' }],
    })
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.reason).toBe('app_inactive')
      expect(v.detail).toContain('Inactive')
      expect(v.detail, 'must say where the fix lives').toContain('developer settings')
    }
  })

  it('a plain 401 is a credentials problem, and says so', () => {
    const v = judgeApiFailure(401, { message: 'Authorization Error' })
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.reason).toBe('app_inactive')
      expect(v.detail).toContain('STRAVA_CLIENT_ID')
    }
  })

  it('any other failure is treated as BROKEN, never as healthy', () => {
    // "Unknown" must never resolve to ok. A probe that reports health it could
    // not observe is the failure it exists to prevent.
    for (const status of [500, 502, 429]) {
      const v = judgeApiFailure(status, null)
      expect(v.ok, `${status} must not read as healthy`).toBe(false)
    }
  })
})

describe('isSilenceSuspicious — silence is only evidence when someone could have spoken', () => {
  it('says nothing when no athlete is connected', () => {
    // The important negative. Zero webhooks with zero connected athletes is the
    // CORRECT state; reporting it would train the team to ignore this probe,
    // and the unconditional subscription check above already covers the
    // dangerous case.
    const r = isSilenceSuspicious({ connectedAthletes: 0, lastDeliveryIso: null, now: NOW })
    expect(r.suspicious).toBe(false)
    expect(r.reason).toContain('silence is correct')
  })

  it('flags a connected athlete with no delivery ever recorded', () => {
    const r = isSilenceSuspicious({ connectedAthletes: 1, lastDeliveryIso: null, now: NOW })
    expect(r.suspicious).toBe(true)
    expect(r.reason).toContain('NO webhook has ever been recorded')
  })

  it('tolerates a normal training gap', () => {
    // A single runner training four times a week legitimately produces ~48h
    // gaps. A threshold under that would fire most weeks.
    const r = isSilenceSuspicious({ connectedAthletes: 1, lastDeliveryIso: hoursAgo(48), now: NOW })
    expect(r.suspicious).toBe(false)
  })

  it('flags silence past the threshold', () => {
    const r = isSilenceSuspicious({
      connectedAthletes: 2,
      lastDeliveryIso: hoursAgo(WEBHOOK_SILENCE_HOURS + 5),
      now: NOW,
    })
    expect(r.suspicious).toBe(true)
    expect(r.hoursSince).toBeGreaterThan(WEBHOOK_SILENCE_HOURS)
  })

  it('does not fire exactly at the boundary', () => {
    const r = isSilenceSuspicious({
      connectedAthletes: 1,
      lastDeliveryIso: hoursAgo(WEBHOOK_SILENCE_HOURS),
      now: NOW,
    })
    expect(r.suspicious).toBe(false)
  })

  it('a garbage timestamp reports nothing rather than inventing an alert', () => {
    const r = isSilenceSuspicious({ connectedAthletes: 1, lastDeliveryIso: 'not-a-date', now: NOW })
    expect(r.suspicious).toBe(false)
    expect(r.reason).toContain('unparseable')
  })

  it('the window is overridable so the threshold itself is testable', () => {
    const r = isSilenceSuspicious({
      connectedAthletes: 1, lastDeliveryIso: hoursAgo(3), now: NOW, windowHours: 2,
    })
    expect(r.suspicious).toBe(true)
  })
})
