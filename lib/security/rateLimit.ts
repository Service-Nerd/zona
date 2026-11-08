import { createClient } from '@supabase/supabase-js'

/**
 * Per-key fixed-window rate limiting, backed by the `ai_rate_limits` table and the
 * `check_rate_limit(p_key, p_limit, p_window_seconds)` RPC
 * (migration `20260819_ai_rate_limits.sql`). Security audit finding 4.
 *
 * 🔑 THIS MODULE IS THE SINGLE OWNER OF THAT RPC, and it lives under `lib/security/`
 * because it is generic infrastructure (`RATELIMIT-MODULE-PATH-01`, 2026-11-08).
 *
 * ⚠️ THE TABLE NAME IS A V1 MISNOMER and is deliberately not renamed — read
 * `ai_rate_limits` as "the rate-limit buckets", the same way `strava_activities` is
 * read as "the run log". Renaming a live table to match a module is an irreversible
 * production DDL bought for tidiness; the key namespace already carries the truth.
 *
 * It used to live at `lib/ai/rateLimit.ts`, which was accurate when the `ai:` prefix
 * was the only namespace and stopped being accurate the moment `charity:redeem:` and
 * `ops:boot:` arrived. The AI wrapper stays in `lib/ai/rateLimit.ts`, because the
 * `ai:` prefix is an AI decision; the limiter is not.
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
    // Supabase types.
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
