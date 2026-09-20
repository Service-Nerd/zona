import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { summariseAiSpend, type AiCallRow } from '@/lib/ops/aiSpend'

// GET /api/ops/ai-spend?days=7 — OPS-AI-SPEND-01.
//
// "What did the AI layer cost, and is any of it failing?", answered from data
// rather than from prompt-file sizes.
//
// The figure in the charity brief (~$2.40/runner over seven months) was
// derived by reading prompts and `max_tokens` literals, because not one of the
// fourteen Anthropic call sites read `response.usage`. Since OPS-AI-OWNER-01
// every call goes through `lib/ai/callAnthropic.ts`, which records an
// `ai_call` row with the real token counts and an `ai_call_failed` row when the
// coaching layer degrades.
//
// ⚠️ THE COST IS AN ESTIMATE AND SAYS SO. It multiplies measured tokens by a
// price list copied into `lib/ai/pricing.ts` by hand. The TOKENS are real; the
// DOLLARS are a local multiplication that nothing here can reconcile against
// Anthropic's billing. Calls whose model has no price entry are reported as
// their own line rather than folded in at zero.
//
// Auth: CRON_SECRET via Authorization: Bearer or x-cron-secret.

const MAX_ROWS = 50_000

export async function GET(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const secret = bearer || req.headers.get('x-cron-secret')
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 7), 1), 90)
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase
    .from('ops_events')
    .select('kind, user_id, detail, created_at')
    .in('kind', ['ai_call', 'ai_call_failed'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  if (error) {
    return NextResponse.json({ error: 'query failed', detail: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as AiCallRow[]
  // Refuse to present a total we know is clipped. A truncated sum that LOOKS
  // like a total is the failure this repo keeps recording, so say so instead.
  const truncated = rows.length >= MAX_ROWS

  return NextResponse.json({
    window_days: days,
    truncated,
    ...summariseAiSpend(rows),
  })
}
