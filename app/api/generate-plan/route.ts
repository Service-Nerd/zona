import { NextRequest, NextResponse } from 'next/server'
import type { GeneratorInput } from '@/types/plan'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { generate } from '@/lib/plan/generate'
import { nextMonday, formatDate } from '@/lib/plan/length'
import { PrepTimeError, InputFieldError } from '@/lib/plan/inputs'

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

    try {
      const plan = await generate(input, tier, planStart)
      return NextResponse.json({ plan })
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
      throw err
    }

  } catch (e) {
    console.error('generate-plan error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
