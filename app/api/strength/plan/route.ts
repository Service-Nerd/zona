import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { readPlanJson } from '@/lib/planRead'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { canUseStrength } from '@/lib/strength-bridge/release'
import { planToRunContext, runContextSig } from '@/lib/strength-bridge/runContext'
import { generateStrengthPlan, parseStrengthProfile, validateStrengthPlan, type RunContext } from '@/packages/strength'

// /api/strength/plan — STRENGTH-ENGINE-01 (ADR-024). Contract: docs/contracts/api-strength-plan.md.
//
//   GET  → the runner's stored strength plan, and whether the run plan has changed under it.
//   POST → { profile } → generate, validate, save, return.
//
// 🔒 SECURITY, in order:
//   1. Auth: a verified JWT, or 401.
//   2. Release gate, SERVER-SIDE: `canUseStrength`. While admin-only, everyone else gets
//      404, so the feature is not advertised by a 403.
//   3. Input: a body cap, then `parseStrengthProfile` (whitelist, unknown keys refused).
//   4. The run plan is read from the runner's OWN stored plan, never from the request,
//      so a crafted plan cannot steer placement.
//   5. Writes use the service role scoped to the verified user id; the table also has
//      own-row RLS. Errors never echo database detail.

const MAX_BODY_BYTES = 4_096

function service() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Gate =
  | { ok: false; res: NextResponse }
  | { ok: true; user: { id: string }; supabase: ReturnType<typeof service> }

async function gate(req: NextRequest): Promise<Gate> {
  const user = await getUserFromRequest(req)
  if (!user) return { ok: false, res: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }
  const supabase = service()
  const [{ data: settings }, tier] = await Promise.all([
    supabase.from('user_settings').select('is_admin').eq('id', user.id).maybeSingle(),
    getUserTier(user.id),
  ])
  if (!canUseStrength({ isAdmin: settings?.is_admin === true, tier })) {
    return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { ok: true, user, supabase }
}

/** Next Monday on or after today, server local date. */
function nextMonday(now: Date): string {
  const d = new Date(now); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function currentRunContext(supabase: ReturnType<typeof service>, userId: string): Promise<{ ctx: RunContext | null; error: string | null }> {
  const [{ plan, error }, { data: overrides, error: oErr }] = await Promise.all([
    readPlanJson(supabase, userId),
    supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', userId).is('superseded_at', null),
  ])
  if (error || oErr) return { ctx: null, error: error ?? oErr!.message }
  return { ctx: plan ? planToRunContext(plan, overrides ?? []) : null, error: null }
}

export async function GET(req: NextRequest) {
  const g = await gate(req)
  if (!g.ok) return g.res
  const { user, supabase } = g
  const { data, error } = await supabase
    .from('strength_plans').select('plan_json, profile_json, run_context_sig, generated_at')
    .eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load the strength plan' }, { status: 500 })
  if (!data) return NextResponse.json({ plan: null })
  const { ctx, error: ctxErr } = await currentRunContext(supabase, user.id)
  // A failed run-plan read is not "the run plan changed": report unknown, never stale.
  const stale = ctxErr ? null : runContextSig(ctx) !== data.run_context_sig
  return NextResponse.json({ plan: data.plan_json, profile: data.profile_json, generated_at: data.generated_at, stale })
}

export async function POST(req: NextRequest) {
  const g = await gate(req)
  if (!g.ok) return g.res
  const { user, supabase } = g

  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = parseStrengthProfile((body as { profile?: unknown } | null)?.profile)
  if (!parsed.ok) return NextResponse.json({ error: 'Invalid profile', field: parsed.field }, { status: 422 })

  const { ctx, error: ctxErr } = await currentRunContext(supabase, user.id)
  // Never fall back to a standalone plan because the run plan could not be READ:
  // that would place strength blind to the runner's hard days.
  if (ctxErr) return NextResponse.json({ error: 'Could not load your run plan' }, { status: 500 })

  const plan = generateStrengthPlan(parsed.profile, ctx, ctx ? {} : { standaloneStart: nextMonday(new Date()) })
  const violations = validateStrengthPlan(plan, ctx)
  if (violations.length) {
    await recordOpsEvent('strength_generate_failed', {
      codes: Array.from(new Set(violations.map(v => v.code))).slice(0, 20), count: violations.length,
    }, user.id)
    return NextResponse.json({ error: 'Could not build a strength plan' }, { status: 500 })
  }

  const { error } = await supabase.from('strength_plans').upsert({
    user_id: user.id,
    plan_json: plan,
    profile_json: parsed.profile,
    run_context_sig: runContextSig(ctx),
    generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) {
    await recordOpsEvent('strength_save_failed', { message: error.message.split('\n')[0].slice(0, 200) }, user.id)
    return NextResponse.json({ error: 'Could not save the strength plan' }, { status: 500 })
  }
  return NextResponse.json({ plan })
}
