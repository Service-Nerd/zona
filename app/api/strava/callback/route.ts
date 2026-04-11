import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    console.error('Strava callback: no code or error param', { error, code })
    return NextResponse.redirect(`${origin}/dashboard?strava=denied`)
  }

  try {
    console.log('Strava callback: exchanging code for tokens')
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

    const tokenBody = await tokenRes.json()
    console.log('Strava token response status:', tokenRes.status)
    console.log('Strava token response:', JSON.stringify(tokenBody))

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenBody.message ?? tokenRes.status}`)
    }

    const { access_token, refresh_token, expires_at } = tokenBody

    const supabase = createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('Supabase user:', user?.id ?? 'none', 'error:', userError?.message ?? 'none')

    if (!user) throw new Error('No user session')

    const { error: upsertError } = await supabase.from('user_settings').upsert({
      id: user.id,
      strava_access_token: access_token,
      strava_refresh_token: refresh_token,
      strava_token_expires_at: expires_at,
      updated_at: new Date().toISOString(),
    })

    if (upsertError) throw new Error(`Upsert failed: ${upsertError.message}`)

    console.log('Strava callback: success for user', user.id)
    return NextResponse.redirect(`${origin}/dashboard?strava=connected`)
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(`${origin}/dashboard?strava=error`)
  }
}
