import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStravaToken } from '@/lib/strava'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    // Get the user's refresh token from user_settings
    const { data: settings } = await supabase
      .from('user_settings')
      .select('strava_refresh_token')
      .eq('id', user.id)
      .single()

    if (!settings?.strava_refresh_token) {
      return NextResponse.json({ error: 'No Strava connection' }, { status: 404 })
    }

    // Exchange refresh token for access token (server-side, secret stays safe)
    const accessToken = await getStravaToken(settings.strava_refresh_token)

    return NextResponse.json({ access_token: accessToken })
  } catch (e) {
    console.error('Strava refresh error:', e)
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
  }
}
