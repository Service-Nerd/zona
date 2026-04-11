import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // User denied access
  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard?strava=denied`)
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) throw new Error('Token exchange failed')

    const { access_token, refresh_token, expires_at } = await tokenRes.json()

    // Store tokens against the user
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No user session')

    await supabase.from('user_settings').upsert({
      id: user.id,
      strava_access_token: access_token,
      strava_refresh_token: refresh_token,
      strava_token_expires_at: expires_at,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.redirect(`${origin}/dashboard?strava=connected`)
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(`${origin}/dashboard?strava=error`)
  }
}
