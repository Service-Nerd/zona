import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const userId = searchParams.get('user_id')

  if (!userId) {
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
    state: userId,
  })

  return NextResponse.redirect(
    `https://www.strava.com/oauth/authorize?${params.toString()}`
  )
}
