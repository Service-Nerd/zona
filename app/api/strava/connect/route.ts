import { NextResponse } from 'next/server'

// Strava OAuth init.
//
// Native variant: clients on iOS pass `?platform=ios`. We encode that into
// Strava's opaque `state` param ("userId|ios"). The callback decodes it and
// redirects to the NATIVE_STRAVA_CALLBACK deep link (see lib/native.ts)
// instead of the in-browser `/dashboard?strava=connected` URL — same pattern
// as Google OAuth.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const userId = searchParams.get('user_id')
  const platform = searchParams.get('platform') // 'ios' | null

  if (!userId) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID!
  const redirectUri = `${origin}/api/strava/callback`

  // State is opaque to Strava. We use a pipe-delimited "userId|platform" form
  // when platform is set; otherwise bare userId for backward compat with the
  // existing web flow. Callback parses both shapes.
  const state = platform === 'ios' ? `${userId}|ios` : userId

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read',
    state,
  })

  return NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`
  )
}
