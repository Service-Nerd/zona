import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import {
  ENTITLEMENT_AT_RISK_KINDS,
  AT_RISK_WINDOW_DAYS,
  judgeEntitlementRisk,
  isPreSignupRedemption,
  remedyFor,
  PRE_SIGNUP_REMEDY,
  type AtRiskRow,
} from '@/lib/ops/subscriptionHealth'
import type { OpsEventKind } from '@/lib/ops/recordOpsEvent'

// GET /api/ops/subscription-health — OPS-SUBS-HEALTH-CONSUMER-01.
//
// ── WHY THIS ROUTE EXISTS AT ALL ─────────────────────────────────────────────
// `lib/ops/subscriptionHealth.ts` had NO consumer. Its only references in the
// repo were two comments in `webhookTrace.ts` and its own test file, while every
// other ops probe — ai-spend, onboarding-integrity, plan-audit, reshape-integrity,
// strava-webhook-health — has a route. The 2026-09-28 handoff recorded it as
// "added to the dashboard". It was not.
//
// That is the `configConsumer.test.ts` class, stated plainly in CLAUDE.md: a value
// can be authored, ratified, documented, enforced by a check and still be inert.
// The module was written precisely because "the name belongs in versioned, tested
// code rather than in a prose prompt nothing can check" — and the thing actually
// deciding whether a paid-but-unentitled runner gets surfaced was the daily
// digest routine's own hand-rolled SQL, outside the repo, where nothing can
// check it and where it had to be edited by hand to match a code change.
//
// ⚠️ THIS IS A READER, NOT A PROBE, AND THAT IS DELIBERATE. `OPS-SUBS-ALERT-01`
// ruled "no probe, no cron": the rows already exist, so a second automation would
// only re-read them and spend budget doing it. This route writes NOTHING and is
// not scheduled. The digest calls it instead of re-deriving the kind list.
//
// Auth: CRON_SECRET via `Authorization: Bearer` or `x-cron-secret` — same shape as
// every other ops route, because an endpoint naming paying customers is not public.

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

  const since = new Date(Date.now() - AT_RISK_WINDOW_DAYS * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('ops_events')
    .select('kind, created_at, user_id, detail')
    .in('kind', ENTITLEMENT_AT_RISK_KINDS as unknown as string[])
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) {
    // Refuse rather than report health we could not observe. A probe that answers
    // "clean" because the query failed is the failure it exists to prevent —
    // `strava-webhook-health` takes the same line for the same reason.
    return NextResponse.json(
      { error: `Could not read ops_events: ${error.message}` },
      { status: 500 },
    )
  }

  const rows = (data ?? []) as AtRiskRow[]
  const verdict = judgeEntitlementRisk(rows)

  // One line per row, with the remedy attached. The remedy comes from the owner
  // rather than this route so the instruction and the detection cannot drift —
  // which is the whole point of the module having a reader.
  const detail = rows.map(r => {
    const preSignup = isPreSignupRedemption(r)
    return {
      at_utc: r.created_at,
      kind: r.kind,
      provider: (r.detail?.provider as string) ?? null,
      event_type: (r.detail?.event_type as string) ?? null,
      // Absent on any row written before 2026-09-30. `null` means "we could not
      // establish which world this was", never "production".
      environment: (r.detail?.environment as string) ?? null,
      missing: (r.detail?.missing as string) ?? null,
      attributable: !!r.user_id,
      pre_signup_redemption: preSignup,
      remedy: preSignup ? PRE_SIGNUP_REMEDY : remedyFor(r.kind as OpsEventKind),
    }
  })

  console.log(
    `[ops/subscription-health] alert=${verdict.alert} at_risk=${verdict.count}`
    + ` pre_signup=${verdict.preSignupRedemptions} window=${AT_RISK_WINDOW_DAYS}d`,
  )

  return NextResponse.json({
    healthy: !verdict.alert,
    window_days: AT_RISK_WINDOW_DAYS,
    verdict,
    rows: detail,
  })
}
