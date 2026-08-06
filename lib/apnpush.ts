import apn from 'apn'
import { createClient } from '@supabase/supabase-js'
import type { PushPayload } from './webpush'

// Apple Push Notification service (APNs) delivery helper. Used for native
// iOS app subscriptions stored with platform='ios' in push_subscriptions
// (see migration 20260430_push_platform.sql).
//
// Required env vars (set in Vercel once Apple Developer is approved):
//   APNS_KEY_ID       — 10-char key ID from Apple Developer portal
//   APNS_TEAM_ID      — 10-char team ID from Apple Developer membership page
//   APNS_PRIVATE_KEY  — full .p8 file contents (multi-line string)
//   APNS_TOPIC        — the iOS bundle ID (must equal NATIVE_BUNDLE_ID in lib/native.ts)
//   APNS_PRODUCTION   — '1' once shipping; missing/empty uses sandbox
//
// Without these the helper logs a warning and returns false — keeps the
// cron sender working for web subscribers.

let cachedProvider: apn.Provider | null = null

function getProvider(): apn.Provider | null {
  if (cachedProvider) return cachedProvider

  const keyId    = process.env.APNS_KEY_ID
  const teamId   = process.env.APNS_TEAM_ID
  const keyText  = process.env.APNS_PRIVATE_KEY
  if (!keyId || !teamId || !keyText) {
    console.warn('[apnpush] APNs env vars not configured — skipping iOS delivery')
    return null
  }

  cachedProvider = new apn.Provider({
    token: {
      key:    keyText,
      keyId,
      teamId,
    },
    production: process.env.APNS_PRODUCTION === '1',
  })
  return cachedProvider
}

// Delivery result. `reason` is null on success and a short diagnostic string
// on failure (the APNs reason, or a local cause) so callers can surface *why*
// a send failed instead of only that it did — D-04, failure is data.
export type ApnsResult = { ok: boolean; reason: string | null }

export async function sendApnsPush(
  deviceToken: string,
  payload: PushPayload,
): Promise<ApnsResult> {
  const provider = getProvider()
  const topic    = process.env.APNS_TOPIC
  if (!provider) return { ok: false, reason: 'apns_not_configured' }
  if (!topic)    return { ok: false, reason: 'no_topic' }

  const note = new apn.Notification()
  note.topic    = topic
  note.alert    = { title: payload.title, body: payload.body }
  note.sound    = 'default'
  if (payload.tag) {
    note.threadId   = payload.tag  // groups related notifications in Notification Center
    // apns-collapse-id: iOS REPLACES an on-screen notification that shares this
    // id instead of stacking a new banner. Belt-and-braces against duplicate
    // sends of the same event (e.g. concurrent ingests of one run) — max 64 bytes.
    note.collapseId = payload.tag
  }
  if (payload.data) note.payload  = payload.data

  try {
    const result = await provider.send(note, deviceToken)
    if (result.failed.length) {
      const failure = result.failed[0]
      const reason  = failure.response?.reason ?? failure.error?.message ?? 'unknown'
      // BadDeviceToken / Unregistered → token no longer valid, clean up
      if (reason === 'BadDeviceToken' || reason === 'Unregistered') {
        const serviceSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
        void serviceSupabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', deviceToken)
          .eq('platform', 'ios')
      }
      console.warn(`[apnpush] failed: ${reason}`)
      return { ok: false, reason }
    }
    return { ok: true, reason: null }
  } catch (err: any) {
    console.error('[apnpush] send threw', err.message)
    return { ok: false, reason: `threw: ${err.message}` }
  }
}
