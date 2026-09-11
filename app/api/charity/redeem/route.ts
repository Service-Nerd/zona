// GTM-CHARITY-04 — POST /api/charity/redeem
//
// Exchanges a charity access code for a paid-tier grant. The auth boundary for
// the whole feature (ADR-003): every rule that decides whether a grant is made
// lives here, and nothing in the client is trusted.
//
// WE DO NOT VERIFY CHARITY AFFILIATION, AND NEVER NEED TO. The partner is
// issued a capped batch and decides who gets a code, because they are the only
// party who knows who holds a place with them. Possession of an unclaimed code
// IS the proof. That is why this route asks only "is this code real, unclaimed,
// and from a live batch?".
//
// Failure messages are deliberately specific ("already used" vs "not a code we
// recognise"): this is a gift, and a runner who mistypes a character deserves
// to know which problem they have. The codespace is 30^8 and the route is
// authenticated, so specificity is not a meaningful enumeration risk.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { normaliseCode } from '@/lib/charity/code'
import { initialGrantExpiry } from '@/lib/charity/grantWindow'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { code?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const code = normaliseCode(body.code)
  if (!code) {
    return NextResponse.json({ error: 'Enter your code to continue.' }, { status: 400 })
  }

  // Service role: charity_codes has no public read policy, because an
  // unredeemed code is a secret and a readable table is a harvestable batch.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Already has a grant? Say so plainly rather than burning a second code. The
  // DB enforces one-grant-per-user with a partial unique index; this is the
  // friendly path to the same rule.
  const { data: existing } = await supabase
    .from('charity_codes')
    .select('expires_at')
    .eq('claimed_by', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyRedeemed: true,
      expiresAt: existing.expires_at,
    })
  }

  const { data: row } = await supabase
    .from('charity_codes')
    .select('id, claimed_by, batch_id, charity_batches ( revoked_at )')
    .eq('code', code)
    .maybeSingle()

  if (!row) {
    return NextResponse.json(
      { error: "That is not a code we recognise. Check it and try again." },
      { status: 404 },
    )
  }
  if (row.claimed_by) {
    return NextResponse.json(
      { error: 'That code has already been used.' },
      { status: 409 },
    )
  }
  // Batch revocation stops UNCLAIMED codes being redeemed. It deliberately does
  // not touch grants already made: taking access back from a runner mid-block
  // is the cliff this whole design exists to avoid.
  const batch = row.charity_batches as unknown as { revoked_at: string | null } | null
  if (batch?.revoked_at) {
    return NextResponse.json(
      { error: 'That code is no longer active. Ask your charity for a new one.' },
      { status: 409 },
    )
  }

  const now = new Date()
  const expiresAt = initialGrantExpiry(now)

  // Claim it. The `.is('claimed_by', null)` predicate makes this the atomic
  // step: two runners racing the same code produce one winner, because the
  // second update matches zero rows. Without it, both could read "unclaimed"
  // and both write.
  const { data: claimed, error } = await supabase
    .from('charity_codes')
    .update({
      claimed_by: user.id,
      claimed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .eq('id', row.id)
    .is('claimed_by', null)
    .select('expires_at')
    .maybeSingle()

  if (error) {
    console.error('[charity/redeem] claim failed', error.message)
    return NextResponse.json({ error: 'Could not redeem that code. Try again.' }, { status: 500 })
  }
  if (!claimed) {
    // Lost the race, or the one-grant-per-user index rejected it.
    return NextResponse.json({ error: 'That code has already been used.' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, expiresAt: claimed.expires_at })
}
