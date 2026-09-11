import { NextRequest, NextResponse } from 'next/server'
import { getStravaToken } from '@/lib/strava'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createUserScopedClient } from '@/lib/supabase/userScopedClient'

export async function POST(request: NextRequest) {
  try {
    // Finding 1: derive the user from the validated bearer token — never trust
    // a userId supplied in the request body. Previously this route was
    // unauthenticated and returned any user's live Strava access token.
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // SEC-08 — user-scoped (JWT) client, not the service role. Queries run as the
    // user, so RLS backstops the .eq(user_id) filters below instead of the filter
    // being the only thing between one runner's data and another's. Every table
    // touched here is covered by a policy: verified against production and
    // enforced on every build by `lib/supabase/rlsCoverage.test.ts`.
    const supabase = createUserScopedClient(request)
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('strava_refresh_token')
      .eq('id', user.id)
      .single()

    if (error || !settings?.strava_refresh_token) {
      return NextResponse.json({ error: 'No Strava connection' }, { status: 404 })
    }

    const { access_token, expires_at } = await getStravaToken(settings.strava_refresh_token)
    return NextResponse.json({ access_token, expires_at })
  } catch (e) {
    console.error('Strava refresh error:', e)
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
  }
}
