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
  // PROFILE-NAME-WRITE-01 (2026-11-04) — THE NAME BACK-FILL LIVES HERE NOW, NOT IN THE CLIENT.
  //
  // Measured on production: of 46 users whose auth metadata carries a `full_name`, **44 had an empty
  // `user_settings.first_name`**, and only 3 rows of 52 have ever held a name at all (those three look
  // hand-typed in Profile). The back-fill that was supposed to do this ran in `DashboardClient` as
  // `void supabase.from('user_settings').upsert(...)` — a fire-and-forget whose `{ error }` was
  // discarded by the `void`, so it could fail on every load for a year and say nothing. The runner
  // never notices, because the name is also set in React state: the greeting reads "Good evening,
  // Duncan" off metadata while the table it is meant to populate stays null. What breaks is every
  // SERVER-side surface, which can only read the table: daily push, trial emails, coach prompts.
  //
  // ⚠️ It is moved rather than merely awaited. A client-side write can be skipped by an early return
  // above it, and on native the cookie client's `auth.uid()` is NULL so RLS declines it — both silent.
  // Here it is authed, it rides the Bearer token through `createUserScopedClient` (the same reason
  // this route already exists in this shape), and a failure is one `console.error` from being seen.
  //
  // Columns are written only when EMPTY: the runner's own Profile edit always wins, and a blank-out
  // is never re-filled behind them. One statement, so the heartbeat costs no extra round trip.
  const { data: current, error: readErr } = await supabase
    .from('user_settings')
    .select('first_name, last_name, email')
    .eq('id', user.id)
    .maybeSingle()

  const patch: Record<string, string> = { last_today_open_at: new Date().toISOString() }

  // ⚠️ A FAILED READ IS NOT AN EMPTY COLUMN, and conflating them is the very class this
  // change exists to fix. `current` is null both when the runner has no name stored and
  // when the SELECT errored — and on the second reading, back-filling would OVERWRITE a
  // name they typed in Profile with whatever the identity provider holds. The heartbeat
  // itself is unaffected and still runs; only the back-fill stands down.
  const canBackfill = !readErr
  if (readErr) console.error('[me/today-heartbeat] profile read failed, back-fill skipped', readErr.message)

  if (canBackfill && !current?.first_name && !current?.last_name) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const full = String(meta.full_name || meta.name || '').trim()
    if (full) {
      const parts = full.split(/\s+/)
      patch.first_name = parts[0]
      if (parts.length > 1) patch.last_name = parts.slice(1).join(' ')
      patch.updated_at = new Date().toISOString()
    }
  }
  if (canBackfill && !current?.email) {
    const email = String(user.email || (user.user_metadata as Record<string, unknown> | null)?.email || '').trim()
    if (email) { patch.email = email; patch.updated_at = new Date().toISOString() }
  }

  const { error } = await supabase
    .from('user_settings')
    .update(patch)
    .eq('id', user.id)

  if (error) {
    console.error('[me/today-heartbeat] update failed', error.message)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
