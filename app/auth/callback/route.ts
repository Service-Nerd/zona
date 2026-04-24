import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    // PKCE flow — exchange the code for a session (sets auth cookies server-side)
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // Implicit flow — token is in the URL hash which the server can't read.
  // Return an HTML shim that reads the hash client-side and lets Supabase
  // process it, then redirects to dashboard.
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
