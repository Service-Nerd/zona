// GTM-08 — Waitlist signup endpoint for the marketing one-pager.
// Public (no auth). Validates the email, inserts via the service-role client
// (RLS on `waitlist` is locked — only this key can write). Duplicate emails
// are treated as success so the visitor never sees an error for re-submitting.

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Minimal, permissive email shape check — the real validation is the DB unique
// index + the fact that a typo'd address simply never gets the launch email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let email: unknown
  try {
    ({ email } = await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 })
  }

  const clean = email.trim().toLowerCase()

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await admin.from('waitlist').insert({ email: clean })

  // 23505 = unique violation (already on the list). That's a success, not an error.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
