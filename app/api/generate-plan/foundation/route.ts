import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { composePlanWithFoundation } from '@/lib/plan/foundationCompose'
import { resizeForDeferredFoundationAdd } from '@/lib/plan/foundationResize'
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
// ADR-020 AMENDMENT (FOUNDATION-CHOICE-RESIZE-01, 2026-09-10): this route may
// re-run the RULE ENGINE — deterministic, no AI — to apply §91's on-ramp credit
// that a DEFERRED decision could not receive at generation (the base was sized
// against `foundation_decision: undefined`, the board-ratified conservative
// default). It still must NEVER re-pay for AI enrichment (28-35s, real cost).
// `resizeForDeferredFoundationAdd` is the single owner of that re-run: it is a
// no-op for every non-early-onset plan (the §91 credit changes nothing there)
// and preserves the runner's enriched copy on every week the re-size left
// structurally unchanged.
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

    const tier = await getUserTier(user.id)
    const today = formatDate(new Date())
    // Apply §91's on-ramp credit the deferred decision missed, then compose the
    // block onto the (possibly re-sized) plan. `resized` === `body.plan` for a
    // non-early-onset plan, so this is free for the common case.
    const resized = resizeForDeferredFoundationAdd(body.plan, body.input, tier, today)
    const { plan: composed, gapClass, violations } =
      composePlanWithFoundation(resized, body.input, today, 'add')
    enforceViolations(violations)
    composed.meta.foundation_gap_class = gapClass

    return NextResponse.json({ plan: composed })
  } catch (e) {
    console.error('generate-plan/foundation error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
