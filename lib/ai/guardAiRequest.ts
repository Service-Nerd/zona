import { NextResponse } from 'next/server'
import { AI_LIMITS, AI_ROUTE_LIMITS } from './limits'
import { checkAiRateLimit } from './rateLimit'

/**
 * Rate-limit-only guard (security audit finding 4) for AI routes that don't
 * read a request body — they derive everything from the DB by user id. Call
 * AFTER auth + tier gate. Returns a 429 NextResponse to return immediately, or
 * null if the request may proceed.
 */
export async function enforceAiRateLimit(userId: string, route: string): Promise<NextResponse | null> {
  const { limit, windowSeconds } = AI_ROUTE_LIMITS[route] ?? {
    limit: AI_LIMITS.DEFAULT_LIMIT,
    windowSeconds: AI_LIMITS.DEFAULT_WINDOW_SECONDS,
  }
  const allowed = await checkAiRateLimit(userId, route, limit, windowSeconds)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429 },
    )
  }
  return null
}

/**
 * Shared guard for AI routes (security audit findings 4 + 5). Call AFTER the
 * route has authenticated the user (getUserFromRequest) and gated tier.
 *
 * Does two things in one place:
 *   - Finding 5: reads the JSON body with a size cap so user text can't inflate
 *     prompt tokens without bound (rejects with 413).
 *   - Finding 4: per-user, per-route rate limit (rejects with 429).
 *
 * Returns the parsed body on success, or a NextResponse to return immediately.
 * The body read replaces the route's own `await req.json()` — call this once.
 */
export async function guardAiRequest(
  req: Request,
  userId: string,
  route: string,
  opts: { maxBytes?: number } = {},
): Promise<{ ok: true; body: any } | { ok: false; response: NextResponse }> {
  const maxBytes = opts.maxBytes ?? AI_LIMITS.DEFAULT_MAX_BYTES

  // Finding 5: size-capped body read.
  const raw = await req.text()
  if (raw.length > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: 'Request too large' }, { status: 413 }) }
  }
  let body: any = {}
  if (raw.length > 0) {
    try {
      body = JSON.parse(raw)
    } catch {
      return { ok: false, response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    }
  }

  // Finding 4: per-user rate limit.
  const limited = await enforceAiRateLimit(userId, route)
  if (limited) return { ok: false, response: limited }

  return { ok: true, body }
}
