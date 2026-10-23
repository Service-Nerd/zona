/* GOALPACE-5K-01 — rebuild ONE stored plan (c8aef8f9) with the fixed engine.
 *
 * Founder-approved 2026-10-23. Targets a single plan by id, never the fleet.
 * Same start date, same race, same answers; only the engine is newer.
 *
 * Differs from fleet-invalid-debt-01-regen.ts in ONE guard, deliberately: that
 * script refuses any runner with synced runs. Here a synced run only refuses the
 * rebuild if it falls ON OR AFTER the plan start, because a run before the plan
 * begins cannot be linked to a session of it. Every other guard is kept:
 * no completions, no analyses, no overrides, block not started, not admin, and
 * the rebuilt plan must validate with 0 errors on the same calendar.
 *
 * Safety: dry-run by default; --apply writes. On apply it archives the current
 * plan to plan_archive first, then overwrites. Rule engine only (the plan is
 * free tier, enrichment was skipped, so nothing AI-written is lost).
 *
 * Run:  NODE_ENV=production npx tsx scripts/goalpace-5k-01-regen.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { validateReshapedPlan } from '../lib/plan/invariants'
import { regenRefusalReason } from '../lib/ops/regenEligibility'
import type { Plan, GeneratorInput, Session } from '../types/plan'

const APPLY = process.argv.includes('--apply')
const PLAN_ID_PREFIX = 'c8aef8f9'
const TODAY = new Date().toISOString().slice(0, 10)

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]
  }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const errCodes = (p: Plan) =>
  Array.from(new Set(validateReshapedPlan(p).filter(v => v.severity === 'error').map(v => v.code))).sort()

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const describe = (s: Session | undefined) => {
  if (!s) return '—'
  const size = s.distance_km != null ? `${s.distance_km} km` : s.duration_mins != null ? `${s.duration_mins} min` : ''
  return [s.label, size, s.zone].filter(Boolean).join(' · ')
}
const daySessions = (w: Plan['weeks'][number], d: string) => {
  const v = (w.sessions as Record<string, Session | Session[] | undefined>)[d]
  return (Array.isArray(v) ? v : [v]).filter(Boolean) as Session[]
}

async function count(table: string, userId: string): Promise<number> {
  const { count: c, error } = await sb.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId)
  if (error) throw new Error(`${table}: ${error.message}`)
  return c ?? 0
}

async function main() {
  console.log(`GOALPACE-5K-01 regen · ${APPLY ? 'APPLY (writing)' : 'DRY-RUN'} · today ${TODAY}\n`)

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

  const { data: auth } = await sb.auth.admin.getUserById(user)
  const { data: settings } = await sb.from('user_settings').select('is_admin').eq('id', user).maybeSingle()
  const { data: runs } = await sb.from('strava_activities').select('start_date').eq('user_id', user)
  const runsInBlock = (runs ?? []).filter(r => String(r.start_date).slice(0, 10) >= planStart).length
  const [completions, analyses, overrides] = await Promise.all([
    count('session_completions', user), count('run_analysis', user), count('session_overrides', user),
  ])

  console.log(`Runner      ${auth?.user?.email ?? user}`)
  console.log(`Plan        ${row.id}  ${planStart} → ${raceDate}  tier ${meta.tier}  enrichment ${meta.enrichment}`)
  console.log(`Data        completions ${completions} · analyses ${analyses} · overrides ${overrides} · runs ${runs?.length ?? 0} (${runsInBlock} on/after plan start)`)

  const refusal = regenRefusalReason({
    planStart, raceDate, hasGeneratorInput: !!gi,
    isAdmin: !!settings?.is_admin,
    hasCompletions: completions > 0,
    hasRunAnalysis: analyses > 0,
    hasActivities: runsInBlock > 0,
  }, TODAY)
  if (refusal) throw new Error(`refused: ${refusal}`)
  if (overrides > 0) throw new Error('refused: runner has moved sessions (session_overrides)')
  if (meta.enrichment === 'applied') throw new Error('refused: plan carries AI-written copy a rule rebuild would drop')

  const input = { ...gi, plan_start: planStart } as GeneratorInput
  const tier = (meta.tier === 'paid' ? 'paid' : meta.tier === 'free' ? 'free' : 'trial') as 'free' | 'trial' | 'paid'
  const rule = generateRulePlan(input, tier, planStart, undefined, planStart)
  const candidate = composePlanWithFoundation(rule, input, planStart, 'add').plan

  const before = errCodes(plan), after = errCodes(candidate)
  const sameCalendar = JSON.stringify(candidate.weeks.map(w => [w.n, w.date])) === JSON.stringify(plan.weeks.map(w => [w.n, w.date]))
  console.log(`Checks      before: ${before.length ? before.join(', ') : 'clean'}`)
  console.log(`            after:  ${after.length ? after.join(', ') : 'clean'}`)
  console.log(`Calendar    ${plan.weeks.length} → ${candidate.weeks.length} weeks, same dates: ${sameCalendar ? 'yes' : 'NO'}`)
  if (after.length) throw new Error('refused: rebuilt plan does not validate clean')
  if (!sameCalendar) throw new Error('refused: rebuilt plan moves the calendar')

  console.log(`\nChanged sessions (before → after):`)
  let changed = 0
  for (const w of candidate.weeks) {
    const old = plan.weeks.find(o => o.n === w.n)!
    for (const d of DAYS) {
      const a = daySessions(old, d).map(describe).join(' + ') || '—'
      const b = daySessions(w, d).map(describe).join(' + ') || '—'
      if (a !== b) { changed++; console.log(`  W${w.n} ${d}  ${a}\n           → ${b}`) }
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
  await sb.from('plan_weekly_notes').delete().eq('user_id', user)

  const { data: check } = await sb.from('plans').select('plan_json').eq('id', row.id).single()
  const stored = check?.plan_json as Plan
  console.log(`\nAPPLIED. Old plan archived. Stored plan now: ${errCodes(stored).length ? errCodes(stored).join(', ') : 'clean'}`)
}
main().catch(e => { console.error(`\n${(e as Error).message}`); process.exit(1) })
