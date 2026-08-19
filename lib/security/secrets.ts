import { timingSafeEqual } from 'crypto'

/**
 * Constant-time secret comparison (security audit finding 12). Use for every
 * shared-secret check on cron/webhook/internal routes (CRON_SECRET, webhook
 * verify tokens, the x-service-key internal bypass) instead of `===`/`!==`,
 * which short-circuits on the first differing byte and leaks length/prefix
 * timing.
 *
 * Fails closed: returns false if either side is missing (so an unconfigured
 * secret rejects all callers rather than matching an empty header) or if the
 * lengths differ.
 */
export function secretMatches(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
