import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { computeLedger } from '@/lib/coaching/disciplineLedger'
import type { Plan } from '@/types/plan'

// GET /api/discipline-ledger
//
// LEDGER-01 — Returns the user's "Weeks within the lines" count + the state
// of the in-flight week + whether the count advanced this week (used by
// DOCTRINE-01's conditional brand-statement surface on SessionCompleteCard).
//
// Lazy compute on Me-screen open — no cron, no cached table. The function
// is pure; the route is just plumbing.
//
// Response:
//   { weeksWithinLines: number,
//     currentWeekStatus: 'on_track' | 'broken' | 'pending',
//     advancedThisWeek: boolean,
//     tier: 'free' | 'trial' | 'paid' }

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const tier = await getUserTier(user.id)

  const [planRes, completionsRes, analysesRes] = await Promise.all([
    service.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle(),
    service.from('session_completions')
      .select('week_n, session_day, status, fatigue_tag')
      .eq('user_id', user.id),
    // Only fetch analyses for paid/trial — free criteria don't read them.
    tier === 'free'
      ? Promise.resolve({ data: [] as any[] })
      : service.from('run_analysis')
          .select('week_n, hr_in_zone_pct')
          .eq('user_id', user.id),
  ])

  const plan = (planRes.data?.plan_json ?? null) as Plan | null

  const outcome = computeLedger({
    plan,
    completions:  completionsRes.data ?? [],
    analyses:     (analysesRes.data ?? []) as any[],
    tier,
    asOfDate:     new Date(),
  })

  return NextResponse.json({ ...outcome, tier })
}
