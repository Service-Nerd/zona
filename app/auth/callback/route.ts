import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Diagnostic: log all incoming cookies so we can verify code_verifier is present
  const cookieStore = cookies()
  const allCookies = cookieStore.getAll()
  const cookieNames = allCookies.map(c => c.name).join(', ')
  console.log('[auth/callback] code present:', !!code)
  console.log('[auth/callback] cookies received:', cookieNames)

  if (code) {
    const response = NextResponse.redirect(`${origin}/dashboard`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options as any)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[auth/callback] exchange error:', error?.message ?? 'none')

    if (!error) return response

    // Exchange failed — redirect to login with error visible in URL so we can diagnose
    const reason = encodeURIComponent(error.message)
    return NextResponse.redirect(`${origin}/auth/login?auth_error=${reason}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?auth_error=no_code`)
}
