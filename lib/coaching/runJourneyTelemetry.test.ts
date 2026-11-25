import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * STEP4-RUNS-NO-COMPLETIONS-01 (2026-11-25) — the run → logged-session journey records BOTH
 * sides, so it has a denominator.
 *
 * 🔴 WHY. The SLT ruled on 2026-11-20 that the journey breaks at step 4 (run → logged session),
 * and the item said why those runs never link "is not measured". It was half-measurable:
 * `noteRunUnmatched` has recorded the four walls since 2026-11-11 and NOTHING recorded a run
 * getting through, so the rate could only be derived from table counts.
 *
 * 📐 Measured read-only against production on the day this shipped, over the 14 days the
 * telemetry covers: 39 DISTINCT runs reached the matcher and were not linked
 * (`below_threshold` 18 · `no_plan` 10 · `outside_plan_weeks` 9 · `tier_gated` 2), against 17
 * completions carrying a run link created in the same window. 27 of 176 live completion rows
 * carry a link at all — 15.3%.
 *
 * ⚠️ WHAT THIS FILE DOES NOT TEST. Whether a push is DELIVERED to a device. `push_attempted`
 * records what the server did; APNs acceptance is not delivery and no server-side check can be.
 *
 * ⚠️ AND IT IS NOT A CHANGE TO THE MATCHER. `MIN_AUTO_LINK_CONFIDENCE` stays 'high' (POST-RUN-01,
 * "a wrong link is worse than a picker tap"). This records what that rule does; moving it is a
 * Coaching Board question and is filed as one.
 */

const S = vi.hoisted(() => ({
  events: [] as { kind: string; detail: Record<string, unknown>; userId: string | null }[],
  subs: [] as Record<string, unknown>[],
  subsError: null as { message: string } | null,
  // 🔴 THE LEVERS ARE RETURN VALUES, NOT THROWS, AND THE FIRST VERSION OF THIS FILE GOT THAT
  // WRONG (code review, 2026-11-25). `sendApnsPush` returns `{ ok, reason }` and catches its own
  // exceptions; `sendWebPush` returns a boolean and catches everything including 410 Gone.
  // Mocking a throw asserted the ONE failure mode neither sender can produce, and was therefore
  // blind to every mode they do — which is how the function under test came to report `sent` for
  // a failed send and still pass five arms.
  // Keyed by device token, so one runner can have a healthy device and a dead one — the state
  // the `partial` outcome exists for.
  apnsByToken: {} as Record<string, { ok: boolean; reason: string | null }>,
  webResult: true,
}))

vi.mock('@/lib/ops/recordOpsEvent', () => ({
  recordOpsEvent: async (kind: string, detail: Record<string, unknown>, userId: string | null) => {
    S.events.push({ kind, detail, userId })
  },
}))
// `lib/webpush.ts` imports its recorder by relative path, so the same module needs both ids
// mocked or the real one runs and writes to production.
vi.mock('../ops/recordOpsEvent', () => ({
  recordOpsEvent: async (kind: string, detail: Record<string, unknown>, userId: string | null) => {
    S.events.push({ kind, detail, userId })
  },
}))
const apns = async (token: string) => S.apnsByToken[token] ?? { ok: true, reason: null }
vi.mock('@/lib/apnpush', () => ({ sendApnsPush: apns }))
vi.mock('../apnpush', () => ({ sendApnsPush: apns }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {}
      Object.assign(q, {
        select: () => q,
        eq: async () => ({ data: S.subsError ? null : S.subs, error: S.subsError }),
      })
      return q
    },
  }),
}))
// `sendWebPush` lives in the module under test and returns false when VAPID is unset, which it
// is here. `webResult` drives it through the env instead, so the boolean path is exercised for
// real rather than stubbed away.
beforeEach(() => {
  S.events = []; S.subs = []; S.subsError = null
  S.apnsByToken = {}; S.webResult = true
  if (S.webResult) {
    process.env.VAPID_PRIVATE_KEY = 'k'
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'p'
  }
})
// ⚠️ `sendWebPush` reaches this through `require('web-push')`, so the methods must sit at the TOP
// LEVEL as well as on `default` — a default-only mock leaves `setVapidDetails` undefined, the
// TypeError is caught by `sendWebPush`'s own try/catch, and it returns `false`. Which looks
// exactly like a failed send and made the partial-failure arm unable to produce a survivor.
const webPushMock = {
  setVapidDetails: () => {},
  sendNotification: async () => { if (!S.webResult) throw new Error('410 Gone') },
}
vi.mock('web-push', () => ({ ...webPushMock, default: webPushMock }))

const notify = async () => {
  const { notifyUser } = await import('@/lib/webpush')
  await notifyUser('u1', { title: 'T', body: 'B', tag: 'run-linked' })
}

describe('push_attempted — the send side of the journey', () => {
  it('🔴 a runner with NO subscription records no_subscription, not silence', async () => {
    // This was a bare `return`. The commonest reason a runner never comes back to log a run is
    // that nothing reached them, and it looked identical to a healthy send.
    await notify()
    const ev = S.events.find(e => e.kind === 'push_attempted')
    expect(ev, 'notifyUser returned without recording anything').toBeTruthy()
    expect(ev!.detail).toMatchObject({ outcome: 'no_subscription', tag: 'run-linked' })
    expect(ev!.userId).toBe('u1')
  })

  it('a successful iOS send records sent, with its platform', async () => {
    S.subs = [{ endpoint: 'tok', platform: 'ios', p256dh: null, auth: null }]
    await notify()
    expect(S.events.find(e => e.kind === 'push_attempted')!.detail)
      .toMatchObject({ outcome: 'sent', sent: 1, platforms: ['ios'] })
  })

  it('🔴 an APNs FAILURE RETURN is recorded as failed, carrying its reason', async () => {
    // The real failure mode: `sendApnsPush` catches everything and comes back as a VALUE.
    // The first cut discarded that value and reported this as `sent` — verified by probe.
    S.subs = [{ endpoint: 'tok', platform: 'ios', p256dh: null, auth: null }]
    S.apnsByToken = { tok: { ok: false, reason: 'BadDeviceToken' } }
    await notify()
    const ev = S.events.find(e => e.kind === 'push_attempted')!
    expect(ev.detail, 'a failed APNs send was counted as sent').toMatchObject({ outcome: 'failed', sent: 0, attempted: 1 })
    expect(ev.detail.message).toBe('BadDeviceToken')
  })

  it('🔴 a web send returning FALSE is recorded as failed, not sent', async () => {
    // `sendWebPush` returns false for a 410 Gone and for missing VAPID keys. Same class.
    S.subs = [{ endpoint: 'https://web', platform: 'web', p256dh: 'k', auth: 'a' }]
    S.webResult = false
    await notify()
    expect(S.events.find(e => e.kind === 'push_attempted')!.detail)
      .toMatchObject({ outcome: 'failed', sent: 0, attempted: 1 })
  })

  it('🔴 a PARTIAL failure is its own outcome, never collapsed into sent', async () => {
    // A runner whose one device has died and whose other lands is not healthy, and the first cut
    // reported `sent` for exactly that.
    //
    // ⚠️ BOTH DEVICES ARE iOS DELIBERATELY. A real SUCCESSFUL web send is not reachable in this
    // environment: `sendWebPush` reaches the library through `require('web-push')`, which bypasses
    // the ESM mock, and the real library rejects the fake VAPID key — so every web send here
    // fails and could not play the survivor. The web path is covered on its FAILURE side by the
    // arm above, and that asymmetry is a declared limit of this file, not an oversight.
    S.subs = [
      { endpoint: 'dead', platform: 'ios', p256dh: null, auth: null },
      { endpoint: 'live', platform: 'ios', p256dh: null, auth: null },
    ]
    S.apnsByToken = { dead: { ok: false, reason: 'Unregistered' } }
    await notify()
    expect(S.events.find(e => e.kind === 'push_attempted')!.detail)
      .toMatchObject({ outcome: 'partial', sent: 1, attempted: 2, message: 'Unregistered' })
  })

  it('one dead device does not cancel the other — the surviving send still goes', async () => {
    S.subs = [
      { endpoint: 'dead', platform: 'ios', p256dh: null, auth: null },
      { endpoint: 'live', platform: 'ios', p256dh: null, auth: null },
    ]
    S.apnsByToken = { dead: { ok: false, reason: 'BadDeviceToken' } }
    await notify()
    expect(S.events.find(e => e.kind === 'push_attempted')!.detail).toMatchObject({ sent: 1 })
  })

  it('🔴 a FAILED subscription read is lookup_failed, never no_subscription', async () => {
    // Absence written as a value: the read's error was discarded, so "we could not find out"
    // was recorded as "this runner has no devices" (BOOT-STALL-HIDDEN-ABSENT-01).
    S.subsError = { message: 'connection reset' }
    await notify()
    const ev = S.events.find(e => e.kind === 'push_attempted')!
    expect(ev.detail).toMatchObject({ outcome: 'lookup_failed', message: 'connection reset' })
  })

  it('a web row with no keys is counted as a failure, never skipped in silence', async () => {
    S.subs = [{ endpoint: 'https://web', platform: 'web', p256dh: null, auth: null }]
    await notify()
    const ev = S.events.find(e => e.kind === 'push_attempted')!
    expect(ev.detail).toMatchObject({ outcome: 'failed', sent: 0 })
    expect(ev.detail.message).toContain('p256dh')
  })
})
