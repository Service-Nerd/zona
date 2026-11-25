import { createClient } from '@supabase/supabase-js'

// Shared Web Push delivery helper.
// Requires VAPID_PRIVATE_KEY + NEXT_PUBLIC_VAPID_PUBLIC_KEY env vars.
// Uses the 'web-push' npm package for VAPID signing.

export interface PushPayload {
  title: string
  body:  string
  tag?:  string
  data?: Record<string, unknown>
}

/**
 * Sends a Web Push notification to a single subscription endpoint.
 * Returns true on success, false on any failure.
 * Automatically removes expired subscriptions (410 Gone).
 */
export async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<boolean> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    console.warn('[webpush] VAPID keys not configured — skipping push delivery')
    return false
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const webpush = require('web-push') as any
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_SUBJECT ?? 'push@zonna.run'}`,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    )

    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
    return true
  } catch (err: any) {
    if (err.statusCode === 410) {
      // Subscription expired — clean up silently
      const serviceSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )
      void serviceSupabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
    return false
  }
}

/**
 * Looks up ALL of a user's push subscriptions (web + iOS) and dispatches
 * each to the right transport. No-ops silently if the user has none.
 *
 * Previously this was web-only and never selected the platform column —
 * iOS rows have null p256dh/auth, so sendWebPush threw and the post-run
 * push silently never reached iOS users. Mirrors the platform-aware
 * branching already done in send-daily / send-weekly-report routes.
 */
export async function notifyUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  const serviceSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // 🔴 STEP4-RUNS-NO-COMPLETIONS-01 (2026-11-25) — WHETHER A PUSH WAS EVEN ATTEMPTED WAS NOT
  // OBSERVABLE. The run-analysis push is the mechanism that brings a runner back to log their
  // run — the step `STEP4` is about — and "did it go out?" had no answer anywhere.
  //
  // 🔴 AND THE FIRST CUT OF THIS INSTRUMENTATION WAS INERT, WHICH IS WHY THE MECHANISM IS SPELT
  // OUT. It wrapped the sends in a `try/catch` and reported anything that did not throw as
  // `sent`. **NEITHER SENDER THROWS**: `sendApnsPush` returns `ApnsResult` (`{ ok, reason }`) and
  // catches its own exceptions — `apns_not_configured`, `no_topic`, `BadDeviceToken`,
  // `Unregistered`, `threw: …` all come back as a VALUE — and `sendWebPush` returns a boolean,
  // `false` for missing VAPID keys and for every caught error including 410 Gone. Both return
  // values were discarded, so the telemetry built to answer "did the push leave the server?"
  // answered **yes, unconditionally**. Caught by code review; proved with a probe that recorded
  // `{"outcome":"sent","sent":1}` for a web send that had failed.
  //
  // ⚠️ SO THE OUTCOME IS READ FROM THE RETURN VALUE, never from control flow — the same rule
  // `send-daily:314`, `send-weekly-report:103` and `send-trial-insight:174` already follow.
  // The `try/catch` stays as belt-and-braces (a future sender could throw, and every caller
  // invokes this as `void notifyUser(...)`, so a rejection here would vanish), but it is NOT
  // the detection mechanism and must never be mistaken for it again.
  //
  // ⚠️ THIS IS NOT THE ONLY SENDING PATH, AND THE FIRST VERSION OF THIS COMMENT CLAIMED IT WAS.
  // `notifyUser` has exactly TWO callers (`autoAnalyse.ts:325` — the run-link push — and
  // `adjust-plan/route.ts:540`). `send-daily`, `send-weekly-report` and `send-trial-insight`
  // import `sendApnsPush` / `sendWebPush` directly and bypass this function entirely, so
  // `push_attempted` covers two surfaces of five. `PUSH-SEND-OWNER-01` tracks that gap. Reading
  // these rows as "every push" would under-count three surfaces without any sign of it.
  //
  // ⚠️ 'sent' MEANS ACCEPTED BY APNs / THE WEB PUSH SERVICE, NEVER DELIVERED TO A DEVICE.
  // Delivery cannot be observed from the server at all and needs a TestFlight build.
  const { recordOpsEvent } = await import('./ops/recordOpsEvent')

  const { data: subs, error: subsError } = await serviceSupabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, platform')
    .eq('user_id', userId)

  // ⚠️ ABSENCE MUST NOT BE WRITTEN AS A VALUE (`BOOT-STALL-HIDDEN-ABSENT-01`). This read's error
  // used to be discarded, so a failed query yielded `subs === null` and was recorded as
  // `no_subscription` — "this runner has no devices" standing in for "we could not find out".
  if (subsError) {
    await recordOpsEvent('push_attempted', {
      tag: payload.tag ?? null, outcome: 'lookup_failed', message: subsError.message,
    }, userId)
    return
  }

  if (!subs?.length) {
    await recordOpsEvent('push_attempted', { tag: payload.tag ?? null, outcome: 'no_subscription' }, userId)
    return
  }

  // sendApnsPush is dynamically imported to keep the iOS-only `apn` npm
  // package off the call path for web subscribers.
  const { sendApnsPush } = await import('./apnpush')

  // Each send is settled on its own, so one dead endpoint cannot take a runner's other devices
  // with it.
  const results = await Promise.all(subs.map(async sub => {
    const platform = sub.platform === 'ios' ? 'ios' : 'web'
    try {
      if (sub.platform === 'ios') {
        const res = await sendApnsPush(sub.endpoint, payload)
        return { ok: res.ok, platform, message: res.reason }
      }
      if (sub.p256dh && sub.auth) {
        const ok = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload)
        // `sendWebPush` returns a bare boolean, so there is no reason to carry. Its own log line
        // holds the cause; what matters here is that a `false` is not counted as a send.
        return { ok, platform, message: ok ? null : 'sendWebPush returned false' }
      }
      // A web row missing its keys cannot be sent to. Counted as a failure with a reason rather
      // than skipped, because skipping is how it stayed invisible.
      return { ok: false, platform, message: 'web subscription has no p256dh/auth' }
    } catch (err) {
      return { ok: false, platform, message: err instanceof Error ? err.message : String(err) }
    }
  }))

  const failed = results.filter(r => !r.ok)
  await recordOpsEvent('push_attempted', {
    tag: payload.tag ?? null,
    // ⚠️ THREE OUTCOMES, NOT TWO. The first cut collapsed a partial failure into `sent`, so a
    // runner whose iOS token had died and whose web push landed looked completely healthy —
    // which is exactly the state worth seeing.
    outcome:   failed.length === 0 ? 'sent' : failed.length === results.length ? 'failed' : 'partial',
    sent:      results.length - failed.length,
    attempted: results.length,
    platforms: results.map(r => r.platform),
    // Only the first message: enough to name the fault without turning a ledger row into a log.
    ...(failed.length ? { message: failed[0].message } : {}),
  }, userId)
}
