import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { composePlanWithFoundation } from '@/lib/plan/foundationCompose'
import { enforceViolations } from '@/lib/plan/invariants'
import { formatDate } from '@/lib/plan/length'
import type { GeneratorInput, Plan } from '@/types/plan'

// POST /api/generate-plan/foundation
//
// ADR-020 Option A — completes the deferred "Add Foundation Block" decision.
// Only reachable when the initial /api/generate-plan response carried
// meta.foundation_gap_class === 'choice' (>28-day gap): the server declined
// to add a block without asking, and the client showed the modal.
//
// Deliberately NOT a re-call to /api/generate-plan: this must not re-run
// generateRulePlan or re-pay for AI enrichment (28-35s, real cost) just to
// prepend a few easy weeks onto an already-good plan the runner may have
// already seen or saved. Auth only, no tier gate — foundation block is FREE
// infrastructure (ADR-020 §SLT-1), and this route calls no AI, so it uses the
// plain auth pattern (mirrors app/api/revert-adjustment/route.ts), not
// guardAiRequest's AI-cost rate limiting.
//
// The server re-derives gapClass itself from plan.meta.plan_start + its own
// clock — only `decision` is client-supplied, per ADR-020's own framing
// ("the client supplies the decision... the server owns construction").

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as { input?: GeneratorInput; plan?: Plan }
    if (!body.input || !body.plan) {
      return NextResponse.json({ error: 'input and plan are required' }, { status: 422 })
    }

    const today = formatDate(new Date())
    const { plan: composed, gapClass, violations } =
      composePlanWithFoundation(body.plan, body.input, today, 'add')
    enforceViolations(violations)
    composed.meta.foundation_gap_class = gapClass

    return NextResponse.json({ plan: composed })
  } catch (e) {
    console.error('generate-plan/foundation error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
