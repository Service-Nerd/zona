import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

// GET/POST /api/ops/reshape-integrity — OPS-01 daily integrity probe.
//
// Detects the 2026-06-26 incident class (an auto-applied reshape that never
// landed in plan_json, invisible for nine days) by OBSERVING the broken state,
// independent of where the write failed.
//
// The signal is a timestamp relationship, deliberately NOT a content diff:
// savePlanForUser bumps plans.updated_at on every successful write, and the
// route inserts the plan_adjustments row BEFORE saving the plan. So for a
// healthy auto-apply, plans.updated_at >= adjustment.created_at. If an
// auto_applied adjustment's created_at is NEWER than plans.updated_at, the
// follow-up save never happened → mismatch. A content deep-equal was rejected:
// AI enrichment mutates sessions after apply, which would false-positive
// constantly and train us to ignore the alert.
//
// pending adjustments are excluded by construction (they legitimately leave the
// plan unchanged until confirmed). Only status='auto_applied' is checked.
//
// Auth: CRON_SECRET via Authorization: Bearer or x-cron-secret header.

// An adjustment younger than this is still plausibly mid-apply (insert →
// save is a few ms, but be generous against cron/clock skew) — don't flag it.
const RECONCILE_GRACE_MIN = 5
// Suppress duplicate alerts for the same stuck user within this window so a
// persistently-broken plan doesn't spam a row every daily run.
const DEDUP_WINDOW_HOURS = 20

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const secret = bearer || req.headers.get('x-cron-secret')
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = Date.now()
  const graceCutoff = new Date(now - RECONCILE_GRACE_MIN * 60_000).toISOString()
  const dedupCutoff = new Date(now - DEDUP_WINDOW_HOURS * 3_600_000).toISOString()

  // plans.updated_at per user (the last time a plan write landed).
  const { data: plans, error: plansErr } = await supabase
    .from('plans')
    .select('user_id, updated_at')
  if (plansErr) {
    return NextResponse.json({ error: `plans read failed: ${plansErr.message}` }, { status: 500 })
  }
  const planUpdatedAt = new Map<string, string>()
  for (const p of plans ?? []) planUpdatedAt.set(p.user_id as string, p.updated_at as string)

  // Auto-applied adjustments settled past the grace window, newest first.
  const { data: adjustments, error: adjErr } = await supabase
    .from('plan_adjustments')
    .select('id, user_id, week_n, created_at')
    .eq('status', 'auto_applied')
    .lt('created_at', graceCutoff)
    .order('created_at', { ascending: false })
  if (adjErr) {
    return NextResponse.json({ error: `plan_adjustments read failed: ${adjErr.message}` }, { status: 500 })
  }

  // Latest auto_applied adjustment per user (first seen wins — list is desc).
  const latestByUser = new Map<string, { id: string; week_n: number; created_at: string }>()
  for (const a of adjustments ?? []) {
    const uid = a.user_id as string
    if (!latestByUser.has(uid)) {
      latestByUser.set(uid, { id: a.id as string, week_n: a.week_n as number, created_at: a.created_at as string })
    }
  }

  let checked = 0
  let mismatches = 0
  const flagged: string[] = []

  for (const [userId, adj] of Array.from(latestByUser)) {
    checked++
    const updatedAt = planUpdatedAt.get(userId)
    // No plan row at all, or the plan was last saved BEFORE this auto-apply →
    // the write that should have followed the adjustment never landed.
    const saveLanded = updatedAt != null && updatedAt >= adj.created_at
    if (saveLanded) continue

    // Dedup: skip if we already flagged this user recently.
    const { data: recent } = await supabase
      .from('ops_events')
      .select('id')
      .eq('kind', 'plan_integrity_mismatch')
      .eq('user_id', userId)
      .gte('created_at', dedupCutoff)
      .limit(1)
    if (recent && recent.length > 0) continue

    await recordOpsEvent(
      'plan_integrity_mismatch',
      {
        adjustment_id:   adj.id,
        week_n:          adj.week_n,
        adjustment_at:   adj.created_at,
        plan_updated_at: updatedAt ?? null,
      },
      userId,
    )
    mismatches++
    flagged.push(userId)
  }

  console.log(`[ops/reshape-integrity] checked=${checked}, mismatches=${mismatches}`)
  return NextResponse.json({ checked, mismatches, flagged })
}
