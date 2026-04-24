import { NextRequest, NextResponse } from 'next/server'
import type { GeneratorInput } from '@/types/plan'
import { createClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/trial'
import { generate } from '@/lib/plan/generate'
import { nextMonday, formatDate, weeksBetweenLocal } from '@/lib/plan/length'

// ─── Guard rails ──────────────────────────────────────────────────────────────

function validate(input: GeneratorInput, planStart: string): string | null {
  const weeks = weeksBetweenLocal(planStart, input.race_date)

  // Time-based blocks
  if (weeks < 3) return 'Race is fewer than 3 weeks away. Cannot generate a safe plan.'
  if (input.race_distance_km >= 42 && weeks < 8) return 'Marathon or longer needs at least 8 weeks. There is not enough time to build safely.'
  if (input.race_distance_km >= 21 && input.race_distance_km < 42 && weeks < 4) return 'Half marathon needs at least 4 weeks. Race is too close to generate a safe plan.'
  if (input.days_available < 2) return 'At least 2 training days per week are required.'

  // Volume vs distance mismatch
  if (input.race_distance_km >= 42 && input.current_weekly_km < 20) {
    return 'Current weekly volume is very low for a marathon. We need at least 20 km/week to generate a safe plan. Build your base first.'
  }

  // Longest run vs race distance
  if (input.race_distance_km >= 21 && input.longest_recent_run_km < 5) {
    return 'Longest recent run is very short for this distance. Log at least a 5 km run in the last 6 weeks before generating this plan.'
  }

  return null
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    // Read token from Authorization header — client passes it explicitly
    // because @supabase/ssr cookie sync to the server is unreliable.
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tier = await getUserTier(user.id)
    const input: GeneratorInput = await req.json()
    const planStart = formatDate(nextMonday())

    const guardError = validate(input, planStart)
    if (guardError) {
      return NextResponse.json({ error: guardError }, { status: 422 })
    }

    const plan = await generate(input, tier, planStart)
    return NextResponse.json({ plan })

  } catch (e) {
    console.error('generate-plan error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
