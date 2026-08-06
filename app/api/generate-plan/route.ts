import { NextRequest, NextResponse } from 'next/server'
import type { GeneratorInput, Plan } from '@/types/plan'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan } from '@/lib/plan/invariants'
import { enrich, type EnrichOutcome } from '@/lib/plan/enrich'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { generateFreeIntro } from '@/lib/plan/freeIntro'
import { nextMonday, formatDate } from '@/lib/plan/length'
import { PrepTimeError, DaysAvailableError, InputFieldError } from '@/lib/plan/inputs'

// ─── Guard rails ──────────────────────────────────────────────────────────────
//
// CoachingPrinciples §44 owns prep-time refusal (block / warn) for race
// distance vs available weeks. The legacy hardcoded rules below were superseded
// by validatePrepTime in 2026-04-28/H-01 and removed. This wrapper now only
// guards inputs the constitution doesn't yet cover.

function validate(input: GeneratorInput): string | null {
  if (input.days_available < 2) return 'At least 2 training days per week are required.'

  // Volume vs distance mismatch — kept until promoted to a CoachingPrinciples
  // section in a future round.
  if (input.race_distance_km >= 42 && input.current_weekly_km < 20) {
    return 'Current weekly volume is very low for a marathon. We need at least 20 km/week to generate a safe plan. Build your base first.'
  }
  if (input.race_distance_km >= 21 && input.longest_recent_run_km < 5) {
    return 'Longest recent run is very short for this distance. Log at least a 5 km run in the last 6 weeks before generating this plan.'
  }

  return null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tier = await getUserTier(user.id)
    const input: GeneratorInput = await req.json()
    const planStart = formatDate(nextMonday())

    const guardError = validate(input)
    if (guardError) {
      return NextResponse.json({ error: guardError }, { status: 422 })
    }

    // Rule engine runs synchronously and may throw validation errors that
    // need a 422 status — must run before opening a stream.
    let rulePlan: Plan
    try {
      rulePlan = generateRulePlan(input, tier, planStart)
    } catch (err) {
      // CoachingPrinciples §55 — critical input validation. Out-of-range
      // physiological values are rejected at the entry point; surface field +
      // range so the client can highlight the offending input.
      if (err instanceof InputFieldError) {
        return NextResponse.json(
          {
            error: err.message,
            field: err.field,
            value: err.value,
            range: err.range,
          },
          { status: 422 },
        )
      }
      // CoachingPrinciples §44 — prep-time refusal surfaces structured data so
      // the client can render the warning + alternatives and re-submit with
      // acknowledged_prep_warning: true.
      if (err instanceof PrepTimeError) {
        return NextResponse.json(
          {
            error: err.message,
            reason: err.reason,
            prep: err.prep,
            requires_acknowledgment: err.reason === 'warn_unacknowledged',
          },
          { status: 422 },
        )
      }
      // CoachingPrinciples §52 (low-day) — days-availability refusal. Same
      // shape as PrepTimeError so the client renders both the same way:
      // either a hard refusal with alternatives, or a warning the runner
      // must acknowledge to proceed (resubmit with acknowledged_days_warning).
      if (err instanceof DaysAvailableError) {
        return NextResponse.json(
          {
            error: err.message,
            reason: err.reason,
            days: err.days,
            requires_acknowledgment: err.reason === 'warn_unacknowledged',
          },
          { status: 422 },
        )
      }
      throw err
    }

    // Free tier: no enrichment. CA-01 — on the user's FIRST plan only, add a
    // single short "why this plan" intro line (the one AI surface a free user
    // gets — the wedge moment). Silent fallback: any failure leaves the rule
    // plan untouched. Subsequent free plans skip the call entirely.
    if (tier === 'free') {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const service = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
        // The `plans` table holds one row per user, written on first save. No
        // row yet ⇒ this is their first plan (it isn't persisted until they tap
        // "Use this plan"). Cheapest reliable first-plan signal.
        const { count } = await service
          .from('plans')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if ((count ?? 0) === 0) {
          const intro = await generateFreeIntro(rulePlan, input)
          if (intro) rulePlan.meta.plan_intro = intro
        }
      } catch (e) {
        console.error('[generate-plan] free intro skipped', e)
      }
      // GEN-FIX-02 — free plans are never enriched by design (ADR-006 tier split).
      // Stamping 'skipped' rather than leaving the field absent means an absent
      // value is unambiguously "generated before this shipped", not "free tier".
      rulePlan.meta.enrichment = 'skipped'
      return NextResponse.json({ plan: rulePlan })
    }

    // Trial/paid: stream NDJSON. Send the rule plan immediately so the
    // ceremony can begin reveal while the enricher is still running. Send
    // the enriched plan when ready (silent fallback to rule plan on failure).
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // GEN-FIX-02 — the rule plan goes out before enrichment has run, so its
        // status is genuinely unknown at this point. Stamping 'pending' gives
        // the client-side save race (N8) a fingerprint: a *saved* plan reading
        // 'pending' means the user tapped through before final_plan landed.
        rulePlan.meta.enrichment = 'pending'
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'rule_plan', plan: rulePlan }) + '\n'))

        let finalPlan: Plan = rulePlan
        let outcome: EnrichOutcome
        try {
          const result = await enrich(rulePlan, input, tier)
          finalPlan = result.plan
          outcome = result.outcome
        } catch (e) {
          // enrich() is written not to throw; this is the backstop.
          console.error('[generate-plan] enrich threw unexpectedly', e)
          outcome = {
            status: 'failed',
            reason: 'fetch_failed',
            detail: e instanceof Error ? e.message : String(e),
          }
        }

        finalPlan.meta.enrichment = outcome.status === 'applied' ? 'applied' : 'failed'

        // PV2-A — re-validate AFTER enrichment. The copy invariants
        // (INV-PLAN-COPY-MATCHES-SESSIONS, -THEME-MATCHES-PRESCRIPTION,
        // -TAPER-COPY-MATCHES-DURATION, -NO-PLACEHOLDER-COPY) run inside
        // generateRulePlan, i.e. BEFORE the AI rewrites labels/themes/notes — so
        // an enricher that promises a session the week doesn't contain sailed
        // through unchecked. The rule plan is already valid; enriched voice is a
        // paid nicety, and a correct plan is not negotiable. If enrichment
        // introduced an error-severity violation, fall back to rule copy.
        if (outcome.status === 'applied') {
          const postEnrichErrors = validatePlan(finalPlan, input).filter(v => v.severity === 'error')
          if (postEnrichErrors.length > 0) {
            console.error('[generate-plan] enrichment introduced invariant violations, reverting to rule copy', postEnrichErrors.map(v => v.code))
            await recordOpsEvent(
              'plan_enrich_failed',
              { reason: 'post_enrich_invalid', codes: postEnrichErrors.map(v => v.code), tier, race_distance_km: input.race_distance_km },
              user.id,
            )
            finalPlan = rulePlan
            finalPlan.meta.enrichment = 'failed'
          }
        }

        // Silent to the user (ADR-006), visible to us. Awaited so the row is
        // durable before the stream closes — recordOpsEvent never throws.
        if (outcome.status === 'failed') {
          await recordOpsEvent(
            'plan_enrich_failed',
            { reason: outcome.reason, detail: outcome.detail, tier, race_distance_km: input.race_distance_km },
            user.id,
          )
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: 'final_plan', plan: finalPlan }) + '\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })

  } catch (e) {
    console.error('generate-plan error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
