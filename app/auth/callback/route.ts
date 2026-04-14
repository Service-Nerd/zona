import { NextResponse } from 'next/server'
import { createBrowserClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/dashboard`)
}
