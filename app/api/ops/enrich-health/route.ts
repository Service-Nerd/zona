import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { judgeEnrichHealth, enrichmentStateOf, type EnrichStateRow } from '@/lib/ops/enrichHealth'

// GET /api/ops/enrich-health — OPS-ENRICH-HEALTH-01.
//
// `plan_enrich_failed` had ONE WRITER AND ZERO READERS: no route, no digest, no
// alert. So enrichment could degrade indefinitely and the only way to notice was
// to query by hand — which is how it was noticed on 2026-10-02, and only because
// the founder said live users had arrived. ADR-006's silence TO THE RUNNER is
// correct and unchanged; the silence to US never was.
//
// 🔴 IT READS THE PLANS TABLE, NOT ops_events, AND THAT IS THE POINT. My first
// measurement derived a rate from events as `failed / (failed + server_saved)` and
// reported 67%. `plan_enrich_server_saved` fires only when the server's backstop
// had to write, so it is a SUBSET of successes, not a success counter — the
// denominator was "failures plus some successes" and the figure was meaningless.
// `plan_json.meta.enrichment` self-describes, which is why ENRICH-SAVE-01 put it
// there. True reading: 18 eligible, 16 with voice, 2 without — 11%.
//
// A failure EVENT is a thing that happened. `meta.enrichment` is the thing the
// runner HAS, and only the second can be remediated or alerted on honestly.
//
// ⚠️ A READER, NOT A PROBE — the same line `OPS-SUBS-ALERT-01` took: the state
// already exists, so a second automation would only re-read it and spend budget.
// This route writes NOTHING and is not scheduled; the digest calls it.
//
// Auth: CRON_SECRET via `Authorization: Bearer` or `x-cron-secret`, like every
// other ops route — an endpoint naming runners is not public.

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

  const { data, error } = await supabase
    .from('plans')
    .select('user_id, created_at, plan_json')

  if (error) {
    // Refuse rather than report health we could not observe. A probe that answers
    // "clean" because its query failed is the failure it exists to prevent —
    // `subscription-health` and `strava-webhook-health` take the same line.
    return NextResponse.json(
      { error: `Could not read plans: ${error.message}` },
      { status: 500 },
    )
  }

  const rows: EnrichStateRow[] = (data ?? []).map(r => ({
    user_id: String(r.user_id),
    created_at: String(r.created_at),
    enrichment: enrichmentStateOf(r.plan_json as never),
  }))

  const verdict = judgeEnrichHealth(rows)

  console.log(
    `[ops/enrich-health] alert=${verdict.alert} without_voice=${verdict.withoutVoice}`
    + `/${verdict.eligible} (${verdict.withoutVoicePct}%)`,
  )

  return NextResponse.json({
    healthy: !verdict.alert,
    // Stated so a reader cannot repeat my mistake: this is plan STATE, not an
    // event rate, and `plans` is the denominator.
    denominator: 'plans.plan_json.meta.enrichment (NOT ops_events)',
    verdict,
  })
}
