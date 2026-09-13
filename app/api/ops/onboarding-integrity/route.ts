import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { incompleteOnboardingUserIds, type OnboardingSettingsRow } from '@/lib/ops/onboardingIntegrity'

// GET/POST /api/ops/onboarding-integrity — ONBOARD-OBS-01 daily integrity probe.
//
// Observes the Problem-A broken state directly: a runner who holds a saved plan
// (a `plans` row) but whose `user_settings.has_onboarded` is still false. The
// finalise-failure route (/api/ops/onboarding-event) catches the failure AT the
// site; this catches the STATE wherever the write failed — the same belt-and-
// braces as reshape-integrity, and the check that would have surfaced Problem A
// on day one instead of after weeks.
//
// Auth: CRON_SECRET via Authorization: Bearer or x-cron-secret header.

// Suppress duplicate alerts for the same stuck user within this window so a
// persistently-broken account doesn't spam a row every daily run.
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

  const { data: plans, error: plansErr } = await supabase.from('plans').select('user_id')
  if (plansErr) {
    return NextResponse.json({ error: `plans read failed: ${plansErr.message}` }, { status: 500 })
  }
  const planUserIds = (plans ?? []).map(p => p.user_id as string)

  const { data: settings, error: settingsErr } = await supabase
    .from('user_settings')
    .select('id, has_onboarded')
  if (settingsErr) {
    return NextResponse.json({ error: `user_settings read failed: ${settingsErr.message}` }, { status: 500 })
  }

  const flaggedUsers = incompleteOnboardingUserIds(
    planUserIds,
    (settings ?? []) as OnboardingSettingsRow[],
  )

  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3_600_000).toISOString()
  let mismatches = 0
  const flagged: string[] = []

  for (const userId of flaggedUsers) {
    const { data: recent } = await supabase
      .from('ops_events')
      .select('id')
      .eq('kind', 'onboarding_incomplete')
      .eq('user_id', userId)
      .gte('created_at', dedupCutoff)
      .limit(1)
    if (recent && recent.length > 0) continue

    await recordOpsEvent('onboarding_incomplete', { source: 'onboarding-integrity' }, userId)
    mismatches++
    flagged.push(userId)
  }

  console.log(`[ops/onboarding-integrity] checked=${planUserIds.length}, mismatches=${mismatches}`)
  return NextResponse.json({ checked: planUserIds.length, mismatches, flagged })
}
