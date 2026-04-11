import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)

  // Get user ID to pass as state — so callback can identify user without session
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login`)
  }

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID!
  const redirectUri = `${origin}/api/strava/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read',
    state: user.id, // pass user ID through OAuth flow
  })

  return NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`
  )
}
