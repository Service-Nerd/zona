import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { hasPaidAccess } from '@/lib/trial'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const userId = searchParams.get('state')

  if (error || !code) {
    return NextResponse.redirect(`${origin}/dashboard?strava=denied`)
  }

  if (!userId) {
    console.error('Strava callback: no user ID in state param')
    return NextResponse.redirect(`${origin}/dashboard?strava=error`)
  }

  if (!await hasPaidAccess(userId)) {
    return NextResponse.redirect(`${origin}/dashboard?strava=upgrade`)
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

    const tokenBody = await tokenRes.json()
    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenBody.message ?? tokenRes.status}`)
    }

    const { access_token, refresh_token, expires_at } = tokenBody

    // Use service role client to bypass RLS — safe, server-side only
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error: upsertError } = await supabase.from('user_settings').upsert({
      id: userId,
      strava_access_token: access_token,
      strava_refresh_token: refresh_token,
      strava_token_expires_at: expires_at,
      updated_at: new Date().toISOString(),
    })

    if (upsertError) throw new Error(`Upsert failed: ${upsertError.message}`)

    return NextResponse.redirect(`${origin}/dashboard?strava=connected`)
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(`${origin}/dashboard?strava=error`)
  }
}
