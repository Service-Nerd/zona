import { NextRequest, NextResponse } from 'next/server'
import { isMissingColumn } from '@/lib/supabase/missingColumn'
import { SESSION_OVERRIDE_COLUMNS } from '@/lib/plan/effectiveSessions'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { readPlanJson } from '@/lib/planRead'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { planToRunContext, runContextSig } from '@/lib/strength-bridge/runContext'
import { regenerateStored, storedPlanReach } from '@/lib/strength-bridge/planReach'
import { strengthGate, readSmallJson, strengthServiceClient } from '@/lib/strength-bridge/routeGate'
import { applyRecoveryEases, parseRecoveryEases, type RecoveryEases } from '@/lib/strength-bridge/recoveryEases'
import { generateStrengthPlan, parseStrengthProfile, validateStrengthPlan, type RunContext, type StrengthPlan, type StrengthProfile } from '@/packages/strength'

// /api/strength/plan — STRENGTH-ENGINE-01 (ADR-024). Contract: docs/contracts/api/strength-plan.md.
//
//   GET  → the runner's strength plan + completions. If the run week has moved under
//          it, it is re-placed SILENTLY first (Design Board STRENGTH-APP-01 H).
//   POST → { profile } → generate, validate, save, return.
//
// 🔒 SECURITY, in order: verified JWT (401) · server-side release gate (404) · body
// cap (413) · strict profile parser (422) · the run plan comes from the runner's OWN
// stored plan, never the request · writes use the service role scoped to the verified
// user id, and the tables carry own-row RLS · error bodies never echo database detail.

type Supabase = ReturnType<typeof strengthServiceClient>

/** Today, server local date (ISO). */
function todayIso(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * STRENGTH-START-WEEK-01 — when this runner's strength started: the stored plan's own date,
 * kept across every rebuild (a new profile, a moved run week, a new race plan), so the technique
 * block is served once, from the day they began. A runner with no plan yet starts today.
 * A legacy row from before the field existed falls back to the day it was generated.
 */
function startDateFor(existing: { plan_json?: { start_date?: string } | null; generated_at?: string | null } | null, now: Date): string {
  return existing?.plan_json?.start_date ?? (existing?.generated_at ? String(existing.generated_at).slice(0, 10) : todayIso(now))
}

/** Next Monday on or after today, server local date. */
function nextMonday(now: Date): string {
  const d = new Date(now); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function currentRunContext(supabase: Supabase, userId: string): Promise<{ ctx: RunContext | null; error: string | null }> {
  const [{ plan, error }, { data: overrides, error: oErr }] = await Promise.all([
    readPlanJson(supabase, userId),
    supabase.from('session_overrides').select(SESSION_OVERRIDE_COLUMNS).eq('user_id', userId).is('superseded_at', null),
  ])
  if (error || oErr) return { ctx: null, error: error ?? oErr!.message }
  return { ctx: plan ? planToRunContext(plan, overrides ?? []) : null, error: null }
}

/**
 * STRENGTH-RECOVERY-01 — the runner's recovery answers. Read on their own, and a failed read is
 * "no answers", so the plan still loads before `20261018_strength_recovery_eases.sql` is applied.
 */
async function recoveryEasesFor(supabase: Supabase, userId: string): Promise<RecoveryEases> {
  const { data, error } = await supabase.from('strength_plans').select('recovery_eases').eq('user_id', userId).maybeSingle()
  return error ? {} : parseRecoveryEases(data?.recovery_eases)
}

/**
 * STRENGTH-PROGRESSION-01 — the runner's lift logs for the last LIFT_LOG_DAYS, oldest first. A failed read is
 * "no logs" (suggestions then say "start light"), so the plan still loads before the table exists.
 */
const LIFT_LOG_DAYS = 120
async function liftLogsFor(supabase: Supabase, userId: string): Promise<unknown[]> {
  const since = new Date(Date.now() - LIFT_LOG_DAYS * 86_400_000).toISOString().slice(0, 10)
  const read = (cols: string) => supabase.from('strength_lift_logs')
    .select(cols).eq('user_id', userId).gte('session_date', since).order('session_date', { ascending: true })
  let { data, error } = await read('session_date, exercise_id, load_kg, feel, counts, reps')
  // STRENGTH-LOG-REPS-01 — before its migration is applied, `reps` does not exist: read the old columns rather than
  // lose every log (the view then takes the reps from the plan, as it did).
  if (error && isMissingColumn(error)) ({ data, error } = await read('session_date, exercise_id, load_kg, feel, counts'))
  type Row = { session_date: string; exercise_id: string; load_kg: number | string | null; feel: string; counts: boolean; reps?: number | null }
  return error ? [] : ((data ?? []) as unknown as Row[]).map(r => ({
    date: r.session_date, exercise_id: r.exercise_id, load_kg: r.load_kg == null ? null : Number(r.load_kg), feel: r.feel, counts: r.counts,
    ...(r.reps != null ? { reps: r.reps } : {}),
  }))
}

/** Generate, validate and save. Returns the plan, or a response to send. */
async function buildAndSave(supabase: Supabase, userId: string, profile: StrengthProfile, ctx: RunContext | null, startDate: string, preview = false, standaloneStart?: string): Promise<{ ok: true; plan: StrengthPlan } | { ok: false; res: NextResponse }> {
  // A standalone plan rebuilt for an engine change keeps its own start (`regenerateStored`); a new one starts next Monday.
  const plan = standaloneStart ? regenerateStored(profile, ctx, standaloneStart) : generateStrengthPlan(profile, ctx, ctx ? { startDate } : { standaloneStart: nextMonday(new Date()) })
  const violations = validateStrengthPlan(plan, ctx)
  if (violations.length) {
    await recordOpsEvent('strength_generate_failed', {
      codes: Array.from(new Set(violations.map(v => v.code))).slice(0, 20), count: violations.length,
    }, userId)
    return { ok: false, res: NextResponse.json({ error: 'Could not build a strength plan' }, { status: 500 }) }
  }
  // SAVE-PATTERN-01 — a preview is built and validated exactly as a save is, and written nowhere, so the runner can
  // see what changes before accepting. Generation is deterministic, so the accepted save builds the same plan.
  if (preview) return { ok: true, plan }
  const { error } = await supabase.from('strength_plans').upsert({
    user_id: userId, plan_json: plan, profile_json: profile,
    run_context_sig: runContextSig(ctx), generated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) {
    await recordOpsEvent('strength_save_failed', { message: error.message.split('\n')[0].slice(0, 200) }, userId)
    return { ok: false, res: NextResponse.json({ error: 'Could not save the strength plan' }, { status: 500 }) }
  }
  return { ok: true, plan }
}

async function completionsFor(supabase: Supabase, userId: string): Promise<Record<string, 'done' | 'skipped'> | null> {
  const { data, error } = await supabase.from('strength_completions').select('session_date, status').eq('user_id', userId)
  if (error) return null
  return Object.fromEntries((data ?? []).map(r => [String(r.session_date).slice(0, 10), r.status as 'done' | 'skipped']))
}

export async function GET(req: NextRequest) {
  const g = await strengthGate(await getUserFromRequest(req))
  if (!g.ok) return g.res
  const { user, supabase } = g
  const { data, error } = await supabase
    .from('strength_plans').select('plan_json, profile_json, run_context_sig, generated_at')
    .eq('user_id', user.id).maybeSingle()
  if (error) return NextResponse.json({ error: 'Could not load the strength plan' }, { status: 500 })
  if (!data) return NextResponse.json({ plan: null })

  let plan = data.plan_json as StrengthPlan
  let replaced = false
  const { ctx, error: ctxErr } = await currentRunContext(supabase, user.id)
  // A failed run-plan read is not "the run plan changed": keep the stored plan, never re-place blind.
  // STRENGTH-ENGINE-REACH-01: rebuild when the run week changed OR the engine now builds something else from the same
  // inputs; before, an engine fix never reached a stored plan.
  if (!ctxErr) {
    const parsed = parseStrengthProfile(data.profile_json)
    const startDate = startDateFor(data, new Date())
    const reach = parsed.ok ? storedPlanReach({ plan, sig: data.run_context_sig }, parsed.profile, ctx, startDate) : null
    if (parsed.ok && reach) {
      const built = await buildAndSave(supabase, user.id, parsed.profile, ctx, startDate, false, reach === 'engine_changed' ? startDate : undefined)
      if (built.ok) {
        plan = built.plan; replaced = true
        if (reach === 'engine_changed') await recordOpsEvent('strength_plan_engine_rebuilt', {}, user.id)
      }
    }
  }
  const [completions, recoveryEases, liftLogs] = await Promise.all([completionsFor(supabase, user.id), recoveryEasesFor(supabase, user.id), liftLogsFor(supabase, user.id)])
  // The stored plan stays as generated; an accepted recovery ease is applied on the way out (S13).
  return NextResponse.json({ plan: applyRecoveryEases(plan, recoveryEases), recovery_eases: recoveryEases, lift_logs: liftLogs, profile: data.profile_json, completions: completions ?? {}, completions_ok: completions != null, replaced, stale: ctxErr ? null : false })
}

export async function POST(req: NextRequest) {
  const g = await strengthGate(await getUserFromRequest(req))
  if (!g.ok) return g.res
  const { user, supabase } = g
  const r = await readSmallJson(req)
  if (!r.ok) return r.res
  const body = r.body as { profile?: unknown; preview?: unknown } | null
  const preview = body?.preview === true
  const parsed = parseStrengthProfile(body?.profile)
  if (!parsed.ok) return NextResponse.json({ error: 'Invalid profile', field: parsed.field }, { status: 422 })

  const { ctx, error: ctxErr } = await currentRunContext(supabase, user.id)
  // Never fall back to a standalone plan because the run plan could not be READ:
  // that would place strength blind to the runner's hard days.
  if (ctxErr) return NextResponse.json({ error: 'Could not load your run plan' }, { status: 500 })
  // A failed read of the EXISTING row must not reset the start date: that would hand a
  // runner eight weeks in a fresh technique block.
  const { data: existing, error: exErr } = await supabase
    .from('strength_plans').select('plan_json, generated_at').eq('user_id', user.id).maybeSingle()
  if (exErr) return NextResponse.json({ error: 'Could not load the strength plan' }, { status: 500 })
  const built = await buildAndSave(supabase, user.id, parsed.profile, ctx, startDateFor(existing, new Date()), preview)
  if (!built.ok) return built.res
  const recoveryEases = await recoveryEasesFor(supabase, user.id)
  return NextResponse.json({ plan: applyRecoveryEases(built.plan, recoveryEases), recovery_eases: recoveryEases })
}
