import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  // With implicit flow the token is in the URL hash (#access_token=...)
  // The browser handles this — just redirect to dashboard and let the
  // Supabase client pick up the session from the URL fragment
  return NextResponse.redirect(`${origin}/dashboard`)
}
