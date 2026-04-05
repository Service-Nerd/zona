import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  await supabase.auth.signOut()
  const origin = request.nextUrl.origin
  return NextResponse.redirect(new URL('/auth/login', origin))
}
