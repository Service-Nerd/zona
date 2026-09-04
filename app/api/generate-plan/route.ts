import { NextRequest, NextResponse } from 'next/server'
import type { GeneratorInput, Plan } from '@/types/plan'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { guardAiRequest } from '@/lib/ai/guardAiRequest'
import { getUserTier } from '@/lib/trial'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan, enforceViolations } from '@/lib/plan/invariants'
import { composePlanWithFoundation } from '@/lib/plan/foundationCompose'
import { enrich, type EnrichOutcome } from '@/lib/plan/enrich'
import { errorBaseline, violationsIntroducedBy, statusForReason } from '@/lib/plan/enrichAttribution'
import { attributableWeeks, revertWeeksToRuleCopy } from '@/lib/plan/enrichPartialRevert'
import { shouldServerPersist } from '@/lib/plan/enrichServerSave'
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
    const guard = await guardAiRequest(req, user.id, 'generate-plan')
    if (!guard.ok) return guard.response
    const input: GeneratorInput = guard.body
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

    // ADR-020 Option A — server owns foundation-block construction.
    // composePlanWithFoundation is the single owner of plan.weeks mutation
    // post-generation; it re-validates unfiltered, so both tiers' checks below
    // now see foundation weeks for the first time in the live path.
    const today = formatDate(new Date())
    const { plan: composedRule, gapClass, violations: composeViolations } =
      composePlanWithFoundation(rulePlan, input, today, input.foundation_decision)
    enforceViolations(composeViolations)
    composedRule.meta.foundation_gap_class = gapClass

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
      // composedRule.meta IS rulePlan.meta (composePlanWithFoundation spreads
      // the plan, not its meta object) so this stamp lands on both either way.
      rulePlan.meta.enrichment = 'skipped'
      return NextResponse.json({ plan: composedRule })
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
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'rule_plan', plan: composedRule }) + '\n'))

        // ENRICH-ATTRIB-01 (2026-09-03) — baseline the rule plan's OWN violations
        // BEFORE enrichment runs. generateRulePlan validates itself, but in
        // production it only console.errors and returns the plan (ruleEngine.ts
        // — never break the user). So the rule plan reaching this point may
        // already carry error-severity violations, and the post-enrich check
        // below must not attribute them to the AI. See the incident note there.
        //
        // ADR-020 Option A — baselined on composedRule (with foundation weeks),
        // not the foundation-free rulePlan, and reuses composeViolations rather
        // than calling validatePlan a second time on the same plan. The
        // post-enrich comparison below re-attaches foundation weeks onto
        // finalPlan before diffing, so both sides of the diff are apples-to-apples.
        const baseline = errorBaseline(composeViolations)

        // A rule plan that violates its own constitution is a separate, more
        // serious defect than a failed enrichment, and it had no durable signal
        // at all — console.error on a Vercel function is not a record. Recorded
        // here rather than in the engine because lib/plan/* must stay free of
        // the service-role client (it is imported by DashboardClient).
        if (baseline.size > 0) {
          await recordOpsEvent(
            'plan_rule_invalid',
            { codes: Array.from(baseline), tier, race_distance_km: input.race_distance_km },
            user.id,
          )
        }

        let finalPlan: Plan = composedRule
        let outcome: EnrichOutcome
        try {
          // enrich() takes the foundation-free rulePlan, never composedRule —
          // the AI must never see or touch foundation-week copy (§57;
          // ADR-020's own blast-radius table confirms this is correct by
          // design, not an oversight).
          const result = await enrich(rulePlan, input, tier)
          // Re-attach foundation weeks the enricher never saw. Mirrors,
          // almost verbatim, what GeneratePlanScreen used to do client-side
          // at the final_plan merge point — now server-side, ahead of the
          // post-enrich validatePlan check below so it sees the full plan.
          const foundationWeeks = composedRule.weeks.filter(w => w.n <= 0)
          finalPlan = foundationWeeks.length
            ? { ...result.plan, weeks: [...foundationWeeks, ...result.plan.weeks] }
            : result.plan
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

        finalPlan.meta.enrichment =
          outcome.status === 'applied' ? 'applied' : statusForReason(outcome.reason)

        // PV2-A — re-validate AFTER enrichment. The copy invariants
        // (INV-PLAN-COPY-MATCHES-SESSIONS, -THEME-MATCHES-PRESCRIPTION,
        // -TAPER-COPY-MATCHES-DURATION, -NO-PLACEHOLDER-COPY) run inside
        // generateRulePlan, i.e. BEFORE the AI rewrites labels/themes/notes — so
        // an enricher that promises a session the week doesn't contain sailed
        // through unchecked. The rule plan is already valid; enriched voice is a
        // paid nicety, and a correct plan is not negotiable. If enrichment
        // introduced an error-severity violation, fall back to rule copy.
        //
        // ENRICH-ATTRIB-01: "introduced" means NEW relative to `baseline`. The
        // original code compared against zero, so one pre-existing engine
        // violation discarded every enriched plan — and the enricher cannot
        // produce most violation classes at all (EnrichedWeekSchema exposes only
        // label, theme and coach_notes; it cannot touch a single numeric).
        if (outcome.status === 'applied') {
          const introduced = violationsIntroducedBy(baseline, validatePlan(finalPlan, input))
          if (introduced.length > 0) {
            // ENRICH-PARTIAL-01 (2026-09-04) — revert the OFFENDING WEEKS, not
            // the whole plan.
            //
            // The old behaviour discarded every week's copy for one bad word on
            // one week. Observed on a real trial plan: two §27 violations, on two
            // of the five weeks that carry no intensity, cost the runner enriched
            // copy across all fourteen. Base phase is all-easy BY DESIGN (§4/§5),
            // so the runners with the most exposure are beginners and finish-goal
            // plans — the ones least likely to know the app should sound
            // different, and most likely to be on trial.
            //
            // A partial revert leaves the plan correct everywhere and enriched
            // almost everywhere, which strictly dominates correct-everywhere and
            // enriched-nowhere. The full revert remains the fallback for anything
            // that cannot be attributed to a week (plan-level and meta checks),
            // and for the case where reverting the named weeks does not actually
            // clear the violations — re-validated rather than assumed.
            const { weeks: badWeeks, allAttributable } =
              attributableWeeks(introduced, finalPlan)
            let repaired: Plan | null = null
            if (allAttributable && badWeeks.size > 0) {
              // ADR-020 Option A — composedRule, not rulePlan: the latter has no
              // foundation weeks, so rule copy for a foundation week is only
              // found on the composed plan.
              const candidate = revertWeeksToRuleCopy(finalPlan, composedRule, badWeeks)
              const remaining = violationsIntroducedBy(baseline, validatePlan(candidate, input))
              if (remaining.length === 0) repaired = candidate
            }

            if (repaired) {
              finalPlan = repaired
              finalPlan.meta.enrichment = 'applied_partial'
            } else {
              // ADR-020 Option A — composedRule, not rulePlan: the latter has no
              // foundation weeks. A revert here used to silently drop a runner's
              // foundation block every time enrichment introduced a violation —
              // found by validation before it could ship, not observed in prod.
              finalPlan = composedRule
              finalPlan.meta.enrichment = 'failed_invalid_copy'
            }

            // Recorded AFTER the decision so the event says what actually
            // happened. Reporting it before meant every partial repair still
            // logged as a flat failure, which is how a fixed problem keeps
            // looking broken in the data.
            console.error(
              `[generate-plan] enrichment introduced invariant violations (${repaired ? 'reverted ' + badWeeks.size + ' week(s)' : 'full revert'})`,
              introduced.map(v => `${v.code}@W${v.week}`))
            await recordOpsEvent(
              'plan_enrich_failed',
              {
                reason: 'post_enrich_invalid',
                outcome: repaired ? 'partial_revert' : 'full_revert',
                reverted_weeks: repaired ? Array.from(badWeeks) : 'all',
                codes: introduced.map(v => v.code),
                // ENRICH-PARTIAL-01 — `weeks` and `messages` added 2026-09-04.
                // The event recorded codes and nothing else, so diagnosing the
                // real failure meant reconstructing by hand which weeks could
                // even trip §27. One field would have made it a two-minute job.
                weeks: introduced.map(v => v.week),
                messages: introduced.slice(0, 3).map(v => v.message),
                pre_existing: Array.from(baseline),
                tier,
                race_distance_km: input.race_distance_km,
              },
              user.id,
            )
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

        // Belt-and-braces: composedRule.meta already carries this (shared meta
        // reference with rulePlan, stamped before enrich() ran), but finalPlan
        // may be a fresh object from enrich()'s own meta-spread — stamp
        // explicitly rather than depend on that being complete.
        finalPlan.meta.foundation_gap_class = gapClass

        // ENRICH-SERVER-SAVE-01 (2026-09-04) — persist the enriched plan
        // SERVER-SIDE before the stream closes.
        //
        // ENRICH-SAVE-01 made the runner save immediately and receive the
        // enriched copy "as a follow-up". That follow-up was owned entirely by
        // the client, so the design told the runner not to wait and then
        // silently cost them the voice layer when they didn't: tap "Use this
        // plan", lock the phone, and `meta.enrichment` stays 'pending' forever.
        // Observed on a real trial plan — saved 5s after generation, never
        // written again.
        //
        // `shouldServerPersist` keeps this narrow: the row must already exist
        // (generation alone never creates one) and its `meta.generated_at` must
        // match THIS generation, so it can only ever overwrite the plan it just
        // produced — never one the runner deliberately kept. The client's own
        // follow-up write stays as the fast path; this is the backstop.
        //
        // Failure here must never break generation (ADR-006): the runner already
        // has a complete plan, and the enriched copy is a nicety. Recorded, not
        // thrown.
        try {
          // Own client: the one above is scoped to the free-tier intro branch,
          // which this path never enters.
          const { createClient } = await import('@supabase/supabase-js')
          const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
          )
          const { data: storedRow } = await svc
            .from('plans')
            .select('plan_json')
            .eq('user_id', user.id)
            .maybeSingle()

          if (shouldServerPersist(storedRow, finalPlan)) {
            const { error: writeErr } = await svc
              .from('plans')
              .update({ plan_json: finalPlan, updated_at: new Date().toISOString() })
              .eq('user_id', user.id)
            if (writeErr) {
              await recordOpsEvent('plan_enrich_server_save_failed',
                { detail: writeErr.message, tier, race_distance_km: input.race_distance_km }, user.id)
            } else {
              await recordOpsEvent('plan_enrich_server_saved',
                { enrichment: finalPlan.meta.enrichment, tier, race_distance_km: input.race_distance_km }, user.id)
            }
          }
        } catch (e) {
          // Never let the backstop break the thing it is backing up.
          await recordOpsEvent('plan_enrich_server_save_failed',
            { detail: e instanceof Error ? e.message : String(e), tier, race_distance_km: input.race_distance_km },
            user.id)
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
