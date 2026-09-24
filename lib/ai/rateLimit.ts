import { createClient } from '@supabase/supabase-js'

/**
 * Per-user, per-route rate limiting backed by the ai_rate_limits table +
 * check_rate_limit() RPC (migration 20260819_ai_rate_limits.sql).
 * Security audit finding 4.
 */

let _client: ReturnType<typeof createClient> | undefined
function client() {
  return (_client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ))
}

/**
 * Returns true if the caller is within the limit and the request may proceed.
 *
 * Fail-open: if the limiter's own infrastructure errors (RPC missing, DB
 * unreachable), we allow the request rather than take down paid features. A
 * brief limiter outage has bounded cost exposure; a false denial breaks the
 * product. The error is logged so the outage is visible.
 */
export async function checkAiRateLimit(
  userId: string,
  route: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  return checkRateLimit(`ai:${route}:${userId}`, limit, windowSeconds)
}

/**
 * The same limiter, for routes that are not AI surfaces.
 *
 * ⚠️ THE RPC WAS ALWAYS GENERIC — `check_rate_limit(p_key, p_limit,
 * p_window_seconds)` knows nothing about AI. Only the `ai:` key prefix and the
 * wrapper's name were specific, so a second limiter for a non-AI route would
 * have been a duplicate of infrastructure that already existed: the
 * `DELOAD-OWNER-01` / `TIER-OWNER-01` / `OPS-AI-OWNER-01` class. `checkAiRateLimit`
 * now delegates here and keeps owning the `ai:` prefix.
 *
 * 🔻 The module still lives under `lib/ai/` and is no longer AI-only. Moving it
 * would touch every existing import for no behavioural gain; filed rather than
 * done (`RATELIMIT-MODULE-PATH-01`).
 *
 * Callers pass the WHOLE key, including their own namespace prefix, so two
 * features can never collide on a bare user id.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    // Cast: check_rate_limit is a custom RPC not present in the generated
    // Supabase types (this app had no .rpc() callers before).
    const { data, error } = await (client().rpc as any)('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    })
    if (error) {
      console.error('[rateLimit] check_rate_limit RPC error — failing open', error)
      return true
    }
    return data === true
  } catch (e) {
    console.error('[rateLimit] check_rate_limit threw — failing open', e)
    return true
  }
}
