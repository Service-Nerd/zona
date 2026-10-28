/* GOALPACE-5K-01 — bring the two affected stored plans onto the fixed engine.
 *
 * Founder-approved 2026-10-23. Targets one named plan per run, never the fleet,
 * and each target has its own mode because the two runners are in different states:
 *
 *   c8aef8f9  REBUILD  Not started, free tier, no AI copy. The whole plan is
 *                      regenerated from the same answers on the same start date.
 *                      (Applied 2026-10-23.)
 *   e49ea589  PATCH    Started (week 4 of 9), 7 logged sessions, AI-written copy.
 *                      Only the FUTURE weeks' sessions that the fixed engine
 *                      prescribes differently are replaced, plus the engine's own
 *                      plan notes. Past weeks, logged runs, moved sessions and the
 *                      AI-written week copy are left exactly as they are.
 *
 * Guards for both: block not started (rebuild) or nothing logged/moved in a week
 * being changed (patch), not admin, and the result must validate with 0 errors on
 * the same calendar. A synced run refuses a rebuild only if it falls on or after
 * the plan start, because a run before the plan begins cannot be linked to it
 * (fleet-invalid-debt-01-regen.ts refuses any synced run, which is right for the
 * fleet and wrong for a named plan read by the founder).
 *
 * Safety: dry-run by default; --apply writes. On apply it archives the current
 * plan to plan_archive first, overwrites by plan id, then reads it back.
 *
 * Run:  NODE_ENV=production npx tsx scripts/goalpace-5k-01-regen.ts --plan <id> [--apply]
 */
import { hasAiCopy } from '../lib/plan/enrichmentState'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { validateReshapedPlan } from '../lib/plan/invariants'
import { regenRefusalReason } from '../lib/ops/regenEligibility'
import { withProfileHr } from '../lib/plan/rebuildInput'
import type { Plan, GeneratorInput, Session } from '../types/plan'

const TARGETS: Record<string, 'rebuild' | 'patch'> = { c8aef8f9: 'rebuild', e49ea589: 'patch' }

const APPLY = process.argv.includes('--apply')
const PLAN_ID_PREFIX = process.argv[process.argv.indexOf('--plan') + 1]
const MODE = process.argv.includes('--plan') ? TARGETS[PLAN_ID_PREFIX] : undefined
const TODAY = new Date().toISOString().slice(0, 10)

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]
  }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const errCodes = (p: Plan) =>
  Array.from(new Set(validateReshapedPlan(p).filter(v => v.severity === 'error').map(v => v.code))).sort()

// Postgres stores plan_json as jsonb, which reorders object keys, so a stored session and
// a freshly generated identical one stringify differently. Compare in a canonical key order.
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.keys(x as object).sort().map(k => [k, (x as Record<string, unknown>)[k]]))
    : x)
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
type Week = Plan['weeks'][number]
const describe = (s: Session | undefined) => {
  if (!s) return '—'
  const size = s.distance_km != null ? `${s.distance_km} km` : s.duration_mins != null ? `${s.duration_mins} min` : ''
  return [s.label, size, s.zone].filter(Boolean).join(' · ')
}
const daySessions = (w: Week, d: string) => {
  const v = (w.sessions as Record<string, Session | Session[] | undefined>)[d]
  return (Array.isArray(v) ? v : [v]).filter(Boolean) as Session[]
}
// What the engine prescribes, ignoring copy: a session whose signature is unchanged
// keeps its stored object (and any AI-written words on it) untouched.
const prescription = (w: Week, d: string) => canon(daySessions(w, d).map(s =>
  [s.type, s.catalogue_id ?? '', s.role ?? '', s.duration_mins ?? '', s.distance_km ?? '', s.zone ?? '', s.hr_target ?? '', s.derived_set ?? null]))
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}

async function main() {
  if (!MODE) throw new Error(`pass --plan with one of: ${Object.keys(TARGETS).join(', ')}`)
  console.log(`GOALPACE-5K-01 ${MODE} · ${APPLY ? 'APPLY (writing)' : 'DRY-RUN'} · today ${TODAY}\n`)

  const { data: rows, error } = await sb.from('plans').select('id, user_id, plan_json')
  if (error) throw new Error(error.message)
  const hits = (rows ?? []).filter(r => String(r.id).startsWith(PLAN_ID_PREFIX))
  if (hits.length !== 1) throw new Error(`expected exactly 1 plan with id ${PLAN_ID_PREFIX}…, found ${hits.length}`)
  const row = hits[0]
  const user = row.user_id as string
  const plan = row.plan_json as Plan
  const meta = plan.meta as unknown as Record<string, unknown>
  const planStart = meta.plan_start as string
  const raceDate = meta.race_date as string
  const gi = meta.generator_input as GeneratorInput | undefined
  if (!gi) throw new Error('refused: plan has no stored generator input')

  const { data: auth } = await sb.auth.admin.getUserById(user)
  const { data: settings } = await sb.from('user_settings').select('is_admin, max_hr, resting_hr, max_hr_source').eq('id', user).maybeSingle()
  if (settings?.is_admin) throw new Error('refused: admin account')
  const { data: runs } = await sb.from('strava_activities').select('start_date').eq('user_id', user)
  const runsInBlock = (runs ?? []).filter(r => String(r.start_date).slice(0, 10) >= planStart).length
  const weeksOf = async (table: string, col: string) => {
    const { data, error: e } = await sb.from(table).select(col).eq('user_id', user)
    if (e) throw new Error(`${table}: ${e.message}`)
    return (data ?? []).map(r => Number((r as unknown as Record<string, unknown>)[col]))
  }
  const [completionWeeks, analysisWeeks, overrideWeeks] = await Promise.all([
    weeksOf('session_completions', 'week_n'), weeksOf('run_analysis', 'week_n'), weeksOf('session_overrides', 'week_n'),
  ])

  console.log(`Runner      ${auth?.user?.email ?? user}`)
  console.log(`Plan        ${row.id}  ${planStart} → ${raceDate}  tier ${meta.tier}  enrichment ${meta.enrichment}`)
  console.log(`Data        completions ${completionWeeks.length} · analyses ${analysisWeeks.length} · overrides ${overrideWeeks.length} · runs ${runs?.length ?? 0} (${runsInBlock} on/after plan start)`)

  // Heart rate comes from the PROFILE, not the stored answers. A max HR confirmed in
  // Profile after the plan was built updates the plan's meta and user_settings but
  // never meta.generator_input, so regenerating from the stored answers alone would
  // quietly put the runner back on the old max (e49ea589: 203 confirmed vs 198 stored).
  const input = { ...withProfileHr(gi, settings), plan_start: planStart } as GeneratorInput
  const hrMoved = (['max_hr', 'resting_hr', 'max_hr_source'] as const).filter(k => input[k] !== gi[k])
  console.log(`Heart rate  from profile: max ${input.max_hr} (${input.max_hr_source ?? 'unstated'}), resting ${input.resting_hr}${hrMoved.length ? `  · differs from the stored answers on ${hrMoved.join(', ')}` : ''}`)
  const tier = (meta.tier === 'paid' ? 'paid' : meta.tier === 'free' ? 'free' : 'trial') as 'free' | 'trial' | 'paid'
  const fresh = composePlanWithFoundation(generateRulePlan(input, tier, planStart, undefined, planStart), input, planStart, 'add').plan
  const sameCalendar = JSON.stringify(fresh.weeks.map(w => [w.n, w.date])) === JSON.stringify(plan.weeks.map(w => [w.n, w.date]))
  if (!sameCalendar) throw new Error('refused: the fixed engine moves the calendar')

  let candidate: Plan
  if (MODE === 'rebuild') {
    const refusal = regenRefusalReason({
      planStart, raceDate, hasGeneratorInput: true, isAdmin: false,
      hasCompletions: completionWeeks.length > 0, hasRunAnalysis: analysisWeeks.length > 0, hasActivities: runsInBlock > 0,
      hasAiCopy: hasAiCopy(meta),
    }, TODAY)
    if (refusal) throw new Error(`refused: ${refusal}`)
    if (overrideWeeks.length) throw new Error('refused: runner has moved sessions (session_overrides)')
    candidate = fresh
  } else {
    // A week is open to change only if it has not begun.
    const future = new Set(plan.weeks.filter(w => w.date > TODAY).map(w => w.n))
    candidate = JSON.parse(JSON.stringify(plan)) as Plan
    for (const w of candidate.weeks) {
      if (!future.has(w.n)) continue
      const f = fresh.weeks.find(x => x.n === w.n)!
      for (const d of DAYS) {
        if (prescription(w, d) === prescription(f, d)) continue
        ;(w.sessions as Record<string, unknown>)[d] = JSON.parse(JSON.stringify((f.sessions as Record<string, unknown>)[d] ?? null)) ?? undefined
      }
      // Engine-authored week fields only; label and theme are AI-written and stay.
      w.race_notes = f.race_notes
      w.peak_stepback = f.peak_stepback
      if (w.race_notes === undefined) delete w.race_notes
      if (w.peak_stepback === undefined) delete w.peak_stepback
    }
    const cm = candidate.meta as unknown as Record<string, unknown>
    const fm = fresh.meta as unknown as Record<string, unknown>
    cm.load_residual_note = fm.load_residual_note
    cm.rule_adjustments = fm.rule_adjustments
    // The selector's record of how many rows each quality pick could choose from; the
    // variety check reads it, and the future picks are now the fresh engine's.
    cm.quality_pool_sizes = fm.quality_pool_sizes
    const touched = candidate.weeks.filter(w => canon(w.sessions) !== canon(plan.weeks.find(o => o.n === w.n)!.sessions)).map(w => w.n)
    const clash = [...completionWeeks, ...analysisWeeks, ...overrideWeeks].filter(n => touched.includes(n))
    if (clash.length) throw new Error(`refused: logged or moved sessions in a week being changed (weeks ${Array.from(new Set(clash)).join(', ')})`)
    console.log(`Weeks       open to change: ${Array.from(future).join(', ')} (week starting after today) · logged/moved in weeks ${Array.from(new Set([...completionWeeks, ...analysisWeeks, ...overrideWeeks])).sort().join(', ') || 'none'}`)
  }

  const before = errCodes(plan), after = errCodes(candidate)
  console.log(`Checks      before: ${before.length ? before.join(', ') : 'clean'}`)
  console.log(`            after:  ${after.length ? after.join(', ') : 'clean'}`)
  console.log(`Calendar    ${plan.weeks.length} → ${candidate.weeks.length} weeks, same dates: yes`)
  if (after.length && process.env.GP_DEBUG) for (const v of validateReshapedPlan(candidate).filter(v => v.severity === "error")) console.log("   ", v.code, "W" + v.week, String(v.message).slice(0, 400))
  if (after.length) throw new Error('refused: result does not validate clean')

  console.log(`\nChanged sessions (before → after):`)
  let changed = 0
  for (const w of candidate.weeks) {
    const old = plan.weeks.find(o => o.n === w.n)!
    for (const d of DAYS) {
      const a = daySessions(old, d), b = daySessions(w, d)
      if (canon(a) === canon(b)) continue
      changed++
      console.log(`  W${w.n} ${d} ${addDays(w.date, DAYS.indexOf(d))}  ${a.map(describe).join(' + ') || '—'}\n                      → ${b.map(describe).join(' + ') || '—'}`)
    }
  }
  const noteOf = (p: Plan) => (p.meta as unknown as Record<string, unknown>).load_residual_note ?? '—'
  if (noteOf(plan) !== noteOf(candidate)) console.log(`  Load note  ${noteOf(plan)}\n           → ${noteOf(candidate)}`)
  const raceNote = (p: Plan) => p.weeks.find(w => w.race_notes)?.race_notes ?? '—'
  if (raceNote(plan) !== raceNote(candidate)) console.log(`  Race week  ${raceNote(plan)}\n           → ${raceNote(candidate)}`)
  console.log(`  ${changed} session days changed`)

  if (!APPLY) { console.log(`\nDRY-RUN — nothing written. Re-run with --apply to write.`); return }

  const arch = await sb.from('plan_archive').insert({
    user_id: user, plan_json: plan, race_name: (meta.race_name as string) ?? '', race_date: raceDate,
  })
  if (arch.error) throw new Error(`archive failed, NOT overwriting: ${arch.error.message}`)
  const up = await sb.from('plans').update({ plan_json: candidate, updated_at: new Date().toISOString() }).eq('id', row.id)
  if (up.error) throw new Error(`write failed (old plan is archived): ${up.error.message}`)
  // Cached weekly notes describe the sessions they were written about: clear them only
  // for weeks whose sessions changed (a rebuild changes every week's provenance).
  const stale = MODE === 'rebuild'
    ? null
    : candidate.weeks.filter(w => canon(w.sessions) !== canon(plan.weeks.find(o => o.n === w.n)!.sessions)).map(w => w.n)
  const del = sb.from('plan_weekly_notes').delete().eq('user_id', user)
  await (stale ? del.in('week_n', stale) : del)

  const { data: check } = await sb.from('plans').select('plan_json').eq('id', row.id).single()
  const stored = check?.plan_json as Plan
  console.log(`\nAPPLIED. Old plan archived. Stored plan now: ${errCodes(stored).length ? errCodes(stored).join(', ') : 'clean'}`)
}
main().catch(e => { console.error(`\n${(e as Error).message}`); process.exit(1) })
