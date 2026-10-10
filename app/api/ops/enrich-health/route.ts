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

  // WEEK-THEME-TOKEN-ENRICH-01 (2026-10-10) — the BOUNDARY counter, reported
  // beside the state verdict and deliberately NOT inside it.
  //
  // ⚠️ THIS ROUTE'S HEADER WARNS AGAINST READING ops_events, AND THAT WARNING IS
  // ABOUT DENOMINATORS, NOT ABOUT EVENTS. The 67% figure was wrong because an
  // event count was used as a RATE against a denominator that was a subset of
  // successes. This number is never a rate: it is "how many times the model
  // handed back a week label or theme containing a placeholder, and the merge
  // kept engine copy instead". The state the runner HAS is still judged only
  // from `plans`, which is what `denominator` below says.
  //
  // It is here because a new ops kind with no reader is the inert-field class
  // (`run_walk_strategy`: a writer, no reader, and an invariant that could not
  // see a screen). `OPS-SUBS-UNHANDLED-SEEN-01`'s rule applies — counted and
  // reported, never alerting: a rejection is the guard WORKING, so it must not
  // move `healthy`.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const { data: rejectRows, error: rejectErr } = await supabase
    .from('ops_events')
    .select('created_at')
    .eq('kind', 'plan_enrich_week_copy_rejected')
    .gte('created_at', since)
  // A failed count must read as UNKNOWN, never as zero — "no rows" and "did not
  // look" are the pair this repo keeps confusing (`OPS-SUBS-UNHANDLED-SEEN-01`).
  const weekCopyRejected30d: number | null = rejectErr ? null : (rejectRows?.length ?? 0)

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
    // Reported, never alerting, and never a denominator. `null` means the count
    // could not be read, which is not the same as none.
    boundary: {
      weekCopyRejected30d,
      meaning: 'model-authored week label/theme carrying a {{placeholder}}, refused by the merge; engine copy kept',
    },
  })
}
