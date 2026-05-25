import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient } from '@supabase/supabase-js'

// POST /api/me/today-heartbeat
// Tiny beacon — DashboardClient calls this when the Today screen mounts so
// the daily-push cron (HOOK-01) can suppress the 06:30 push for runners who
// have already opened the app this morning.
//
// Auth-gated. No body. Returns 200 with no payload.
//
// Writes with the service-role client: user_settings has RLS and the native
// app authenticates via Bearer token (no cookies), so a cookie-based client's
// auth.uid() is NULL and the update is silently rejected. user_id is pinned to
// the authenticated user below, so this stays safe.

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
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
