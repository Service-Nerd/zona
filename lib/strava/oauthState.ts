import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Strava OAuth `state` — signed, time-bound, single-use-nonce token (Finding 7).
 *
 * The state was previously the plaintext userId, which — combined with an
 * unauthenticated `connect` route — let an attacker mint an authorize URL or
 * callback binding Strava tokens to any userId (account-linking CSRF).
 *
 * The state is now minted ONLY by an authenticated `connect` request (userId
 * derived from the session) and HMAC-signed, so the callback can trust the
 * userId it carries without a session of its own — this keeps the native
 * SFSafariViewController flow (which has no app session cookie) working.
 *
 * Format: `base64url(payload).base64url(hmac_sha256(payload))`
 * where payload = `userId|platform|timestampMs|nonce`.
 */

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes — an OAuth round-trip is seconds

/** HMAC key. Prefers a dedicated secret; falls back to the always-present
 *  service-role key so the flow works without extra env configuration. */
function signingKey(): string {
  const key = process.env.STRAVA_OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('No signing key available for Strava OAuth state')
  return key
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url')
}

export function signStravaState(userId: string, platform: 'ios' | null): string {
  const nonce = randomBytes(16).toString('base64url')
  const payload = [userId, platform ?? 'web', Date.now().toString(), nonce].join('|')
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

/** Returns the verified { userId, platform } or null if the state is missing,
 *  malformed, tampered (bad signature), or older than the TTL. */
export function verifyStravaState(
  state: string | null | undefined,
): { userId: string; platform: 'ios' | null } | null {
  if (!state) return null
  const dot = state.indexOf('.')
  if (dot < 1) return null
  const b64 = state.slice(0, dot)
  const providedSig = state.slice(dot + 1)

  let payload: string
  try {
    payload = Buffer.from(b64, 'base64url').toString('utf8')
  } catch {
    return null
  }

  // Constant-time signature comparison.
  const expected = Buffer.from(sign(payload))
  const provided = Buffer.from(providedSig)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null
  }

  const [userId, platformTag, tsStr] = payload.split('|')
  if (!userId || !tsStr) return null
  const ts = Number(tsStr)
  if (!Number.isFinite(ts) || Date.now() - ts > STATE_TTL_MS || ts > Date.now() + 60_000) {
    return null
  }

  return { userId, platform: platformTag === 'ios' ? 'ios' : null }
}
