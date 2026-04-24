import { NextResponse } from 'next/server'

// PKCE flow: the code_verifier is stored in localStorage by the browser
// Supabase client (createBrowserClient). The server cannot read localStorage,
// so server-side exchangeCodeForSession will always fail with
// "PKCE code verifier not found in storage".
//
// Solution: pass ?code= to the dashboard and let the browser client
// complete the exchange via detectSessionInUrl / onAuthStateChange.
// The dashboard cleans up the URL once the exchange completes.

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    return NextResponse.redirect(`${origin}/dashboard?code=${code}`)
  }

  return NextResponse.redirect(`${origin}/auth/login`)
}
