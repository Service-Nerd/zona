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
  try {
    // Cast: check_rate_limit is a custom RPC not present in the generated
    // Supabase types (this app had no .rpc() callers before).
    const { data, error } = await (client().rpc as any)('check_rate_limit', {
      p_key: `ai:${route}:${userId}`,
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
