import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStravaToken } from '@/lib/strava'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    if (!userId) {
      return NextResponse.json({ error: 'No user ID' }, { status: 400 })
    }

    // Use service role to bypass RLS — safe, server-side only
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('strava_refresh_token')
      .eq('id', userId)
      .single()

    if (error || !settings?.strava_refresh_token) {
      return NextResponse.json({ error: 'No Strava connection' }, { status: 404 })
    }

    const accessToken = await getStravaToken(settings.strava_refresh_token)
    return NextResponse.json({ access_token: accessToken })
  } catch (e) {
    console.error('Strava refresh error:', e)
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 })
  }
}
