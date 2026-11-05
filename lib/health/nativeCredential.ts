/**
 * HK-NATIVE-BG-INGEST-01 — the single owner of the credential the native
 * HealthKit ingest uses.
 *
 * 🔴 THE PROBLEM THIS SOLVES. `HealthObserverPlugin` wakes on a new workout
 * and used to do one thing: `notifyListeners` into JS, which POSTs the run.
 * Measured over 6,090 background wakes: that POST is lost **331 times**, 316 of
 * them to `no-response: Load failed` — iOS suspending the WKWebView mid-`fetch`
 * — and the median run took **2 h 15 m** to appear. Native code is not
 * suspended the same way, so the plugin now posts the run itself. To do that it
 * needs a credential, and it cannot ask the webview for one at 3 a.m.
 *
 * So the web layer PUBLISHES one whenever it has a session, and native READS it.
 *
 * ⚠️ ACCESS TOKEN ONLY. NEVER THE REFRESH TOKEN. Supabase rotates refresh
 * tokens on use, so a native refresher racing supabase-js's own would
 * invalidate the other's token and sign the runner out at random — a worse
 * regression than the bug being fixed. An expired credential is a silent no-op
 * on the native side; the next app-open still ingests the run. Covering the
 * remaining cases needs a scoped device token and is deliberately Phase 2.
 *
 * ⚠️ `base_url` TRAVELS WITH THE TOKEN so native holds no URL logic and has no
 * second opinion about where the server is. It also means local dev against a
 * Mac's LAN IP keeps working with no native change.
 */

import { createClient } from '@/lib/supabase/client'
import { writeSecure, removeSecure, NATIVE_CREDENTIAL_KEY } from '@/lib/native/sharedStore'

/** Exactly the fields `HealthObserverPlugin.NativeCredential` decodes. */
export interface NativeCredential {
  base_url:     string
  access_token: string
  /** Unix SECONDS, straight from the Supabase session — not milliseconds. */
  expires_at:   number
}

/**
 * Pure. Returns null when there is nothing worth publishing, so the caller
 * never has to decide what "empty" means.
 *
 * `expires_at` is optional on a Supabase session; without it native cannot
 * judge freshness, and a credential native would always reject is worse than
 * none (it looks published). Treated as nothing to publish.
 */
export function buildNativeCredential(
  session: { access_token?: string | null; expires_at?: number | null } | null | undefined,
  origin: string,
): NativeCredential | null {
  const token = session?.access_token
  const expiresAt = session?.expires_at
  if (!token || typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null
  if (!origin || !/^https?:\/\//.test(origin)) return null
  return { base_url: origin, access_token: token, expires_at: expiresAt }
}

export type PublishOutcome = 'written' | 'cleared' | 'skipped'

/**
 * Write the current session's credential to the Keychain, or clear it when
 * there is no session. Safe to call repeatedly; no-ops on web.
 *
 * Returns the outcome so the caller can log it. Never throws: this is a
 * best-effort background enabler and must not be able to break boot.
 */
export async function publishNativeCredential(): Promise<PublishOutcome> {
  try {
    if (typeof window === 'undefined') return 'skipped'
    const { data: { session } } = await createClient().auth.getSession()
    const credential = buildNativeCredential(session, window.location.origin)
    if (!credential) {
      await removeSecure(NATIVE_CREDENTIAL_KEY)
      return 'cleared'
    }
    const ok = await writeSecure(NATIVE_CREDENTIAL_KEY, JSON.stringify(credential))
    return ok ? 'written' : 'skipped'
  } catch {
    return 'skipped'
  }
}
