import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    // PKCE flow — redirect to dashboard with ?code= intact.
    // createBrowserClient has detectSessionInUrl=true and flowType="pkce",
    // so it will call exchangeCodeForSession(code) client-side using the
    // code verifier already stored in cookies by signInWithOAuth.
    // Server-side exchange fails because the async cookie write races the
    // OAuth redirect; client-side is reliable because it reads document.cookie.
    return NextResponse.redirect(`${origin}/dashboard?code=${code}`)
  }

  // Implicit flow fallback — token is in URL hash, server can't read it.
  // Shim redirects client-side, Supabase browser client processes the hash.
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <script>
      window.location.href = '/dashboard' + window.location.hash
    </script>
  </head>
  <body></body>
</html>`

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } })
}
