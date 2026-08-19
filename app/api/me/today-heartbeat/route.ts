import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createUserScopedClient } from '@/lib/supabase/userScopedClient'

// POST /api/me/today-heartbeat
// Tiny beacon — DashboardClient calls this when the Today screen mounts so
// the daily-push cron (HOOK-01) can suppress the 06:30 push for runners who
// have already opened the app this morning.
//
// Auth-gated. No body. Returns 200 with no payload.
//
// Finding 8: writes with the JWT-scoped client. user_settings has an
// auth.uid()=id UPDATE policy, so RLS applies. This also carries the Bearer
// token (unlike the cookie client, whose auth.uid() is NULL on native) — which
// is why the service-role client was used before; the scoped client both fixes
// that and keeps RLS as the backstop. The .eq('id', user.id) filter is retained
// as defence-in-depth.

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createUserScopedClient(req)
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await supabase
    .from('user_settings')
    .update({ last_today_open_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    console.error('[me/today-heartbeat] update failed', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
