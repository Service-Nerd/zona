import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStravaToken } from '@/lib/strava'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'

export async function POST(request: NextRequest) {
  try {
    // Finding 1: derive the user from the validated bearer token — never trust
    // a userId supplied in the request body. Previously this route was
    // unauthenticated and returned any user's live Strava access token.
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to bypass RLS — safe, server-side only
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

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
