// POST /api/post-race-reshape
// Auth-gated (paid/trial via dynamic_reshape_r20).
//
// Step 1: run deterministic rule engine → structural reshaped plan
// Step 2: run Sonnet enricher → per-session coach notes + summary (silent fallback)
// Step 3: save to post_race_reshapes with status: pending
// Step 4: return preview (user must confirm before plan is updated)
//
// Body: { race_result: RaceResult, race_week_n: number }
// Returns: { reshape_id, summary, weeks_affected, sessions_modified, preview_weeks }

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { fetchPlanForUser, savePlanForUser } from '@/lib/plan'
import { computePostRaceReshape } from '@/lib/coaching/postRaceReshape'
import {
  buildPostRaceReshapePrompt,
  type PostRaceReshapeAIOutput,
} from '@/lib/coaching/prompts/postRaceReshape'
import { ANTHROPIC_MODEL_DEEP } from '@/lib/ai/models'
import type { Plan, RaceResult, Session, Week } from '@/types/plan'

const AI_PROMPT_VERSION = '1.0'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export async function POST(req: NextRequest) {
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('dynamic_reshape_r20', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const raceResult: RaceResult = body?.race_result ?? {}
  const raceWeekN: number      = Number(body?.race_week_n)

  if (!raceWeekN || isNaN(raceWeekN)) {
    return NextResponse.json({ error: 'race_week_n required' }, { status: 400 })
  }

  // ── 1. Fetch plan ────────────────────────────────────────────────────────────
  // Read/write the plan via the SERVICE client, not the cookie client: this route
  // authenticates off the Bearer token (getUserFromRequest), but the cookie
  // session doesn't sync to the server on native, so a cookie-bound read hits RLS
  // with no session and returns nothing → false "No plan found". Pass the same
  // gist/legacy fallback the client uses so a missing/un-migrated `plans` row
  // self-heals here instead of 404ing.
  const { data: settings } = await serviceClient
    .from('user_settings')
    .select('gist_url, plan_json')
    .eq('id', user.id)
    .single()

  const plan = await fetchPlanForUser(user.id, serviceClient, {
    gistUrl:        settings?.gist_url,
    legacyPlanJson: settings?.plan_json as Plan | null,
  })
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  // ── 2. Run rule engine ───────────────────────────────────────────────────────
  const reshapeOutput = computePostRaceReshape(plan, raceResult, raceWeekN)

  if (!reshapeOutput) {
    // No weeks remaining or all protected by future taper — no reshape available.
    // Still embed the race result on the race week and save.
    const planWithResult = embedRaceResult(plan, raceResult, raceWeekN)
    await savePlanForUser(user.id, planWithResult, serviceClient)
    return NextResponse.json({ reshape_available: false, reason: 'no_remaining_weeks' })
  }

  const {
    reshapedPlan,
    weeksAffected,
    sessionsModified,
    distanceBucket,
    peakWeeklyKm,
    recoveryWindowWeeks,
  } = reshapeOutput

  // ── 3. AI enrichment (silent fallback on failure) ────────────────────────────
  let summaryText: string | null  = null
  let aiModel: string | null      = null
  let enrichedPlan: Plan          = reshapedPlan
  let aiEnrichedAt: string | null = null

  try {
    const prompt = buildPostRaceReshapePrompt({
      plan,
      result: raceResult,
      raceWeekN,
      weeksAffected,
      distanceBucket,
      peakWeeklyKm,
      reshapedWeeks: reshapedPlan.weeks,
    })

    const aiRes = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL_DEEP,
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    const aiData = await aiRes.json()
    const raw = (aiData.content?.[0]?.text ?? '').trim()
    const aiOutput: PostRaceReshapeAIOutput = JSON.parse(raw)

    if (typeof aiOutput?.summary === 'string') {
      summaryText  = aiOutput.summary
      aiModel      = ANTHROPIC_MODEL_DEEP
      aiEnrichedAt = new Date().toISOString()
      enrichedPlan = injectAIEnrichment(reshapedPlan, aiOutput, weeksAffected)
    }
  } catch {
    // Silent fallback — rule-engine shape is sufficient
  }

  // Embed the race result on the race week
  const finalReshapedPlan = embedRaceResult(enrichedPlan, raceResult, raceWeekN)

  // ── 4. Save to post_race_reshapes (pending — user must confirm) ──────────────
  const { data: reshapeRow, error: insertError } = await serviceClient
    .from('post_race_reshapes')
    .insert({
      user_id:             user.id,
      race_week_n:         raceWeekN,
      race_distance_km:    raceResult.distance_km ?? plan.meta.race_distance_km,
      race_result:         raceResult,
      original_plan_json:  plan,
      reshaped_plan_json:  finalReshapedPlan,
      summary_text:        summaryText,
      ai_model:            aiModel,
      ai_prompt_version:   summaryText ? AI_PROMPT_VERSION : null,
      ai_enriched_at:      aiEnrichedAt,
      weeks_affected:      weeksAffected,
      sessions_modified:   sessionsModified,
      recovery_config_key: distanceBucket,
      status:              'pending',
    })
    .select('id')
    .single()

  if (insertError || !reshapeRow) {
    console.error('[post-race-reshape] insert error', insertError)
    return NextResponse.json({ error: 'Failed to save reshape proposal' }, { status: 500 })
  }

  return NextResponse.json({
    reshape_id:             reshapeRow.id,
    reshape_available:      true,
    summary:                summaryText,
    weeks_affected:         weeksAffected,
    sessions_modified:      sessionsModified,
    recovery_window_weeks:  recoveryWindowWeeks,
    distance_bucket:        distanceBucket,
    // Return only the affected weeks so the client can preview changes
    preview_weeks: finalReshapedPlan.weeks
      .map((w, i) => ({ ...w, _week_n: i + 1 }))
      .filter(w => weeksAffected.includes(w._week_n)),
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Embed the race result into the race week's result_embedded field. */
function embedRaceResult(plan: Plan, result: RaceResult, raceWeekN: number): Plan {
  const weeks = plan.weeks.map((w, i) => {
    if (i + 1 !== raceWeekN) return w
    return { ...w, result_embedded: result }
  })
  return { ...plan, weeks }
}

/** Inject AI-generated coach notes and theme overrides into reshaped plan weeks. */
function injectAIEnrichment(
  plan: Plan,
  aiOutput: PostRaceReshapeAIOutput,
  weeksAffected: number[],
): Plan {
  const weeks = plan.weeks.map((week, i) => {
    const weekN      = i + 1
    if (!weeksAffected.includes(weekN)) return week

    const enrichment = aiOutput.week_enrichments?.find(e => e.week_n === weekN)
    if (!enrichment) return week

    const newSessions = { ...week.sessions }

    for (const note of enrichment.session_notes ?? []) {
      const day     = note.day as keyof Week['sessions']
      const existing = newSessions[day]
      if (!existing) continue

      const rawNotes = note.coach_notes?.slice(0, 3) ?? []
      newSessions[day] = {
        ...existing,
        coach_notes: rawNotes.length > 0
          ? (rawNotes as [string, string?, string?])
          : undefined,
      }
    }

    return {
      ...week,
      theme:    enrichment.theme ?? week.theme,
      sessions: newSessions,
    }
  })

  return { ...plan, weeks }
}
