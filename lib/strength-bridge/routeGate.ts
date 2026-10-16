// STRENGTH-ENGINE-01 — the one gate every strength route uses (auth + release).
// 🔒 Server-only. A route that hand-rolls its own check is how one door gets left open.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { canUseStrength } from './release'

export function strengthServiceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export type StrengthGate =
  | { ok: false; res: NextResponse }
  | { ok: true; user: { id: string }; supabase: ReturnType<typeof strengthServiceClient> }

/**
 * 401 without a user; 404 (not 403, so the feature is not advertised) without release access.
 * 🔒 The ROUTE calls `getUserFromRequest` and hands the user here, so the auth boundary is
 * visible in every route file (the pre-commit hook checks for it, security audit findings 1/11).
 */
export async function strengthGate(user: { id: string } | null): Promise<StrengthGate> {
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  const supabase = strengthServiceClient()
  const [{ data: settings }, tier] = await Promise.all([
    supabase.from('user_settings').select('is_admin').eq('id', user.id).maybeSingle(),
    getUserTier(user.id),
  ])
  if (!canUseStrength({ isAdmin: settings?.is_admin === true, tier })) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { ok: true, user, supabase }
}

/** Reads a small JSON body, refusing anything over `max` bytes before parsing it. */
export async function readSmallJson(req: NextRequest, max = 4_096): Promise<{ ok: true; body: unknown } | { ok: false; res: NextResponse }> {
  const raw = await req.text()
  if (raw.length > max) return { ok: false, res: NextResponse.json({ error: 'Request too large' }, { status: 413 }) }
  try { return { ok: true, body: JSON.parse(raw) } } catch { return { ok: false, res: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) } }
}
