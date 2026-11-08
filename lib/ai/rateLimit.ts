import { checkRateLimit } from '@/lib/security/rateLimit'

/**
 * The `ai:` namespace of the shared rate limiter.
 *
 * 🔑 THE LIMITER ITSELF LIVES AT `lib/security/rateLimit.ts` — generic infrastructure,
 * single owner of the `check_rate_limit` RPC (`RATELIMIT-MODULE-PATH-01`, 2026-11-08).
 * What is AI-specific is only the key shape, and that is what this file owns.
 *
 * 🔴 THE FAILURE MODE OF THIS EXTRACTION IS SILENT, which is why the key is pinned by a
 * test rather than left to reading. If the `ai:` prefix were dropped or reshaped, every
 * existing AI limit would re-key, every user's window would reset to empty, and nothing
 * would fail — no error, no log, no denied request. `lib/charity/redeemRateLimit.test.ts`
 * asserts the exact string `ai:<route>:<userId>` and was mutation-tested against dropping
 * the prefix.
 */
export async function checkAiRateLimit(
  userId: string,
  route: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  return checkRateLimit(`ai:${route}:${userId}`, limit, windowSeconds)
}
