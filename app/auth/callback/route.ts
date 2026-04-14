import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  // With implicit flow the token is in the URL hash (#access_token=...)
  // Server-side redirects strip the hash, so we return an HTML page
  // that does a client-side redirect, preserving the hash for Supabase to process
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <script>
      // Preserve hash and redirect to dashboard
      window.location.href = '/dashboard' + window.location.hash
    </script>
  </head>
  <body style="background:#0B132B"></body>
</html>`

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
