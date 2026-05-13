import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { NATIVE_STRAVA_CALLBACK } from '@/lib/native'

// NATIVE_STRAVA_CALLBACK is the same scheme registered in iOS Info.plist for
// the Google OAuth flow. The Capacitor app catches anything at this URL via
// `appUrlOpen` and routes it (see components/CapacitorBoot.tsx).

/**
 * Build the success/failure redirect URL based on origin platform.
 * Web flows land back at /dashboard?strava=…; native flows land at the
 * custom URL scheme, which iOS forwards into the app.
 */
function buildRedirect(origin: string, platform: 'ios' | null, status: string): string {
  return platform === 'ios'
    ? `${NATIVE_STRAVA_CALLBACK}?strava=${status}`
    : `${origin}/dashboard?strava=${status}`
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const rawState = searchParams.get('state') ?? ''

  // State is "userId" (web, legacy) or "userId|ios" (native). Parse both.
  const [userId, platformTag] = rawState.includes('|')
    ? rawState.split('|')
    : [rawState, null]
  const platform: 'ios' | null = platformTag === 'ios' ? 'ios' : null

  if (error || !code) {
    return NextResponse.redirect(buildRedirect(origin, platform, 'denied'))
  }

  if (!userId) {
    console.error('Strava callback: no user ID in state param')
    return NextResponse.redirect(buildRedirect(origin, platform, 'error'))
  }

  const tier = await getUserTier(userId)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.redirect(buildRedirect(origin, platform, 'upgrade'))
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

    const { access_token, refresh_token, expires_at, athlete } = tokenBody

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
      strava_athlete_id: athlete?.id ?? null,
      updated_at: new Date().toISOString(),
    })

    if (upsertError) throw new Error(`Upsert failed: ${upsertError.message}`)

    return NextResponse.redirect(buildRedirect(origin, platform, 'connected'))
  } catch (e) {
    console.error('Strava callback error:', e)
    return NextResponse.redirect(buildRedirect(origin, platform, 'error'))
  }
}
