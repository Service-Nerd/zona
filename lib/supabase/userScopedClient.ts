import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

/**
 * Anon Supabase client scoped to the requesting user's JWT (security audit
 * finding 8). Queries run under the user's identity, so RLS policies
 * (auth.uid() = user_id) apply — restoring the defence-in-depth that the
 * service-role client bypasses. A manual `.eq('user_id', user.id)` filter
 * becomes a second layer rather than the only thing standing between users.
 *
 * ONLY use on tables that have the matching RLS policies (verify per table —
 * see docs/security-audit-2026-08.md finding 8 for the audited inventory).
 * Using it against a table with RLS enabled but no policy silently returns
 * empty / rejects writes — this app's dangerous failure class.
 *
 * Works on native: the Bearer token in the Authorization header is what sets
 * auth.uid(), unlike the cookie-based server client whose auth.uid() is NULL
 * without a cookie session.
 *
 * Returns null when no bearer token is present; callers already gate on
 * getUserFromRequest (which requires a valid token), but guard anyway.
 */
export function createUserScopedClient(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  if (!token) return null
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}
