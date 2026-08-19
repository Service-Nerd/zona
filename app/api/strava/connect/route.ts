import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { signStravaState } from '@/lib/strava/oauthState'

// Strava OAuth init.
//
// Finding 7: the initiating user is now derived from the validated bearer token
// (not a query `user_id`), and the Strava `state` is an HMAC-signed, time-bound
// token minted here (see lib/strava/oauthState.ts). The callback verifies the
// signature and trusts only the userId it carries — closing the account-linking
// CSRF that a plaintext, unauthenticated `user_id` allowed.
//
// Returns the authorize URL as JSON rather than redirecting, so both web and
// native clients can authenticate the request (bearer token via authedFetch).
// Native opens the URL in SFSafariViewController; web navigates to it.
export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams, origin } = new URL(request.url)
  const platform = searchParams.get('platform') === 'ios' ? 'ios' : null

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID!
  const redirectUri = `${origin}/api/strava/callback`
  const state = signStravaState(user.id, platform)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read',
    state,
  })

  return NextResponse.json({
    url: `https://www.strava.com/oauth/authorize?${params.toString()}`,
  })
}
