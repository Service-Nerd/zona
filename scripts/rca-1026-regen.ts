/* RCA-1026-REGEN — bring live plans onto the engine after the 26 Oct coach-engine RCA fixes
 * (OVERRUN-NOTE-ALL-01, S9-QUALITY-MINUTES-01, GOAL-PACE-REACHABLE-01). Founder-approved 2026-10-27:
 * "dry-run each, applied by you". Generalised from goalpace-5k-01-regen.ts, whose guards it keeps.
 *
 * One named plan per run, never the fleet. The MODE is chosen per plan, not listed by hand:
 *   REBUILD  not started, nothing logged, linked or moved, no AI-written copy: regenerated from the same answers on
 *            the same start date.
 *   PATCH    otherwise: only FUTURE weeks' sessions the engine now prescribes differently are replaced, plus the
 *            engine-authored plan notes and the §120 Am. 2 decision record (with `from_week`, so the runner's past
 *            weeks keep what they were given). Past weeks, logged runs, moved sessions and AI week copy stay.
 *
 * Admin accounts are refused unless --allow-admin (the founder's own plan). Heart rate comes from the PROFILE
 * (REBUILD-HR-FROM-PROFILE-01). Dry-run by default; --apply archives to plan_archive, overwrites by id, reads back.
 *
 * Run:  NODE_ENV=production npx tsx scripts/rca-1026-regen.ts --list
 *       NODE_ENV=production npx tsx scripts/rca-1026-regen.ts --plan <id> [--allow-admin] [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { validateReshapedPlan } from '../lib/plan/invariants'
import { regenRefusalReason } from '../lib/ops/regenEligibility'
import { withProfileHr } from '../lib/plan/rebuildInput'
import type { Plan, GeneratorInput, Session } from '../types/plan'

const APPLY = process.argv.includes('--apply')
const LIST = process.argv.includes('--list')
const ALLOW_ADMIN = process.argv.includes('--allow-admin')
// --allow-calendar-move: a NOT-STARTED rebuild may take the engine's new calendar (founder, 2026-10-27). Never a patch.
const ALLOW_CAL = process.argv.includes('--allow-calendar-move')
// --keep-weeks 6,7: future weeks left exactly as they are (the runner moved sessions there). Recorded on the decision
// so INV-PLAN-GOAL-PACE-REACHABLE treats them as the runner's own, like the weeks before `from_week`.
const KEEP_WEEKS = process.argv.includes('--keep-weeks')
  ? process.argv[process.argv.indexOf('--keep-weeks') + 1].split(',').map(Number).filter(Number.isFinite) : []
const PLAN_ID_PREFIX = process.argv.includes('--plan') ? process.argv[process.argv.indexOf('--plan') + 1] : undefined
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
  const { data: rows, error } = await sb.from('plans').select('id, user_id, plan_json')
  if (error) throw new Error(error.message)
  if (LIST) {
    if (APPLY) throw new Error('--list never writes')
    const live = (rows ?? []).filter(r => {
      const m = (r.plan_json as Plan)?.meta as unknown as Record<string, unknown> | undefined
      return m?.generator_input && String(m.race_date ?? '') >= TODAY
    })
    console.log(`RCA-1026-REGEN --list · DRY-RUN · today ${TODAY} · ${live.length} live plans with stored answers\n`)
    for (const r of live) {
      try { await one(r, true) } catch (e) { console.log(`  ${String(r.id).slice(0, 8)}  ${(e as Error).message}`) }
    }
    return
  }
  if (!PLAN_ID_PREFIX) throw new Error('pass --list, or --plan <id>')
  const hits = (rows ?? []).filter(r => String(r.id).startsWith(PLAN_ID_PREFIX))
  if (hits.length !== 1) throw new Error(`expected exactly 1 plan with id ${PLAN_ID_PREFIX}…, found ${hits.length}`)
  await one(hits[0], false)
}

async function one(row: { id: string; user_id: string; plan_json: unknown }, quiet: boolean) {
  const log = (...a: unknown[]) => { if (!quiet) console.log(...a) }
  const user = row.user_id as string
  const plan = row.plan_json as Plan
  const meta = plan.meta as unknown as Record<string, unknown>
  const planStart = meta.plan_start as string
  const raceDate = meta.race_date as string
  const gi = meta.generator_input as GeneratorInput | undefined
  if (!gi) throw new Error('refused: plan has no stored generator input')

  const { data: auth } = await sb.auth.admin.getUserById(user)
  const { data: settings } = await sb.from('user_settings').select('is_admin, max_hr, resting_hr, max_hr_source').eq('id', user).maybeSingle()
  if (settings?.is_admin && !ALLOW_ADMIN) throw new Error('refused: admin account (pass --allow-admin for the founder\'s own plan)')
  const { data: runs } = await sb.from('strava_activities').select('start_date').eq('user_id', user)
  const runsInBlock = (runs ?? []).filter(r => String(r.start_date).slice(0, 10) >= planStart).length
  const weeksOf = async (table: string, col: string) => {
    // ⚠️ LIVE ROWS ONLY. A superseded row belongs to a plan the runner no longer has (PLAN-REBUILD-SUPERSEDE-01), and
    // counting it refused the founder's own plan over 12 completions from his April plan sharing week numbers 6–7.
    const { data, error: e } = await sb.from(table).select(col).eq('user_id', user).is('superseded_at', null)
    if (e) throw new Error(`${table}: ${e.message}`)
    return (data ?? []).map(r => Number((r as unknown as Record<string, unknown>)[col]))
  }
  const [completionWeeks, analysisWeeks, overrideWeeks] = await Promise.all([
    weeksOf('session_completions', 'week_n'), weeksOf('run_analysis', 'week_n'), weeksOf('session_overrides', 'week_n'),
  ])

  log(`Runner      ${auth?.user?.email ?? user}`)
  log(`Plan        ${row.id}  ${planStart} → ${raceDate}  tier ${meta.tier}  enrichment ${meta.enrichment}`)
  log(`Data        completions ${completionWeeks.length} · analyses ${analysisWeeks.length} · overrides ${overrideWeeks.length} · runs ${runs?.length ?? 0} (${runsInBlock} on/after plan start)`)

  // Heart rate comes from the PROFILE, not the stored answers. A max HR confirmed in
  // Profile after the plan was built updates the plan's meta and user_settings but
  // never meta.generator_input, so regenerating from the stored answers alone would
  // quietly put the runner back on the old max (e49ea589: 203 confirmed vs 198 stored).
  const input = { ...withProfileHr(gi, settings), plan_start: planStart } as GeneratorInput
  const hrMoved = (['max_hr', 'resting_hr', 'max_hr_source'] as const).filter(k => input[k] !== gi[k])
  log(`Heart rate  from profile: max ${input.max_hr} (${input.max_hr_source ?? 'unstated'}), resting ${input.resting_hr}${hrMoved.length ? `  · differs from the stored answers on ${hrMoved.join(', ')}` : ''}`)
  const tier = (meta.tier === 'paid' ? 'paid' : meta.tier === 'free' ? 'free' : 'trial') as 'free' | 'trial' | 'paid'
  // ⚠️ THE FOUNDATION BLOCK IS COMPOSED FROM THE DAY IT STARTS, not from the plan start. `composePlanWithFoundation`
  // sizes the runway from (today -> plan start); passing the plan start as "today" gave a 0-day gap and NO foundation
  // weeks, so every plan with a runway read as "the engine moves the calendar" (2026-10-27: a91d8fde and 3cc7c3a9 were
  // refused for exactly this, and the founder was asked to approve a move that was the script's own artefact). The
  // stored block's first week is the "today" it was built for, so composing from it reproduces the same runway.
  const storedFoundation = plan.weeks.filter(w => w.n <= 0)
  const composeToday = storedFoundation.length ? String(storedFoundation[0].date) : planStart
  const fresh = composePlanWithFoundation(generateRulePlan(input, tier, planStart, undefined, planStart), input, composeToday, 'add').plan
  const notStarted = planStart > TODAY && !completionWeeks.length && !analysisWeeks.length && !overrideWeeks.length
    && runsInBlock === 0 && meta.enrichment !== 'applied'
  const MODE: 'rebuild' | 'patch' = notStarted ? 'rebuild' : 'patch'
  log(`Mode        ${MODE}`)
  const sameCalendar = JSON.stringify(fresh.weeks.map(w => [w.n, w.date])) === JSON.stringify(plan.weeks.map(w => [w.n, w.date]))
  if (!sameCalendar) {
    if (MODE !== 'rebuild' || !ALLOW_CAL) throw new Error('refused: the fixed engine moves the calendar' + (MODE === 'rebuild' ? ' (pass --allow-calendar-move for a not-started plan)' : ''))
    const span = (p: Plan) => { const ws = p.weeks; return `${ws.length} weeks, ${ws[0]?.date} → ${ws[ws.length - 1]?.date}` }
    const fm0 = fresh.meta as unknown as Record<string, unknown>
    if (String(fm0.race_date) !== String(raceDate)) throw new Error('refused: the rebuild changes the race date')
    if (String(fresh.weeks[0]?.date) < TODAY) throw new Error('refused: the rebuilt plan would start in the past')
    log(`Calendar    MOVES (allowed): ${span(plan)}  →  ${span(fresh)}`)
  }
  let candidate: Plan
  if (MODE === 'rebuild') {
    const refusal = regenRefusalReason({
      planStart, raceDate, hasGeneratorInput: true, isAdmin: false,
      hasCompletions: completionWeeks.length > 0, hasRunAnalysis: analysisWeeks.length > 0, hasActivities: runsInBlock > 0,
    }, TODAY)
    if (refusal) throw new Error(`refused: ${refusal}`)
    if (overrideWeeks.length) throw new Error('refused: runner has moved sessions (session_overrides)')
    if (meta.enrichment === 'applied') throw new Error('refused: plan carries AI-written copy a rebuild would drop')
    candidate = fresh
  } else {
    // A week is open to change only if it has not begun.
    const future = new Set(plan.weeks.filter(w => w.date > TODAY && !KEEP_WEEKS.includes(w.n)).map(w => w.n))
    if (KEEP_WEEKS.length) log(`Kept        weeks ${KEEP_WEEKS.join(', ')} left exactly as they are`)
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
    // §120 Am. 2 and the notes that describe it. The decision applies from the first future week; the weeks before it
    // keep what the runner was given (`from_week`, read by INV-PLAN-GOAL-PACE-REACHABLE).
    for (const k of ['goal_pace_withheld', 'hm_goal_anchor_withheld', 'goal_beyond_measured_fitness', 'difficulty_band', 'difficulty_note', 'volume_profile', 'volume_constraint_note'] as const) {
      if (fm[k] === undefined) delete cm[k]; else cm[k] = fm[k]
    }
    const firstFuture = Math.min(...Array.from(future))
    if (fm.goal_pace_reach) cm.goal_pace_reach = { ...(fm.goal_pace_reach as object), ...(Number.isFinite(firstFuture) ? { from_week: firstFuture } : {}), ...(KEEP_WEEKS.length ? { kept_weeks: KEEP_WEEKS } : {}) }
    else delete cm.goal_pace_reach
    const touched = candidate.weeks.filter(w => canon(w.sessions) !== canon(plan.weeks.find(o => o.n === w.n)!.sessions)).map(w => w.n)
    const clash = [...completionWeeks, ...analysisWeeks, ...overrideWeeks].filter(n => touched.includes(n))
    if (clash.length) throw new Error(`refused: logged or moved sessions in a week being changed (weeks ${Array.from(new Set(clash)).join(', ')})`)
    log(`Weeks       open to change: ${Array.from(future).join(', ')} (week starting after today) · logged/moved in weeks ${Array.from(new Set([...completionWeeks, ...analysisWeeks, ...overrideWeeks])).sort().join(', ') || 'none'}`)
  }

  const before = errCodes(plan), after = errCodes(candidate)
  log(`Checks      before: ${before.length ? before.join(', ') : 'clean'}`)
  log(`            after:  ${after.length ? after.join(', ') : 'clean'}`)
  log(`Calendar    ${plan.weeks.length} → ${candidate.weeks.length} weeks, same dates: ${sameCalendar ? 'yes' : 'NO (allowed)'}`)
  if (after.length && process.env.GP_DEBUG) for (const v of validateReshapedPlan(candidate).filter(v => v.severity === "error")) log("   ", v.code, "W" + v.week, String(v.message).slice(0, 400))
  // The only errors allowed through are ones that live ENTIRELY in weeks the founder chose to keep (--keep-weeks): those
  // weeks are left as they were, defects included, by decision. Anything else, or anything plan-wide, still refuses.
  const afterErrs = validateReshapedPlan(candidate).filter(v => v.severity === 'error')
  const outsideKept = afterErrs.filter(v => !KEEP_WEEKS.includes(Number(v.week)))
  if (outsideKept.length) throw new Error('refused: result does not validate clean')
  if (afterErrs.length) log(`Carried     ${afterErrs.length} error(s) in kept weeks only: ${afterErrs.map(v => `${v.code} W${v.week}`).join(', ')}`)

  log(`\nChanged sessions (before → after):`)
  let changed = 0
  for (const w of candidate.weeks) {
    const old = plan.weeks.find(o => o.n === w.n)!
    for (const d of DAYS) {
      const a = daySessions(old, d), b = daySessions(w, d)
      if (canon(a) === canon(b)) continue
      changed++
      log(`  W${w.n} ${d} ${addDays(w.date, DAYS.indexOf(d))}  ${a.map(describe).join(' + ') || '—'}\n                      → ${b.map(describe).join(' + ') || '—'}`)
    }
  }
  const noteOf = (p: Plan) => (p.meta as unknown as Record<string, unknown>).load_residual_note ?? '—'
  if (noteOf(plan) !== noteOf(candidate)) log(`  Load note  ${noteOf(plan)}\n           → ${noteOf(candidate)}`)
  const raceNote = (p: Plan) => p.weeks.find(w => w.race_notes)?.race_notes ?? '—'
  if (raceNote(plan) !== raceNote(candidate)) log(`  Race week  ${raceNote(plan)}\n           → ${raceNote(candidate)}`)
  const diffNote = (p: Plan) => (p.meta as unknown as Record<string, unknown>).difficulty_note ?? '—'
  if (diffNote(plan) !== diffNote(candidate)) log(`  Plan note  ${diffNote(plan)}\n           → ${diffNote(candidate)}`)
  log(`  ${changed} session days changed`)
  if (quiet) {
    console.log(`  ${String(row.id).slice(0, 8)}  ${String(auth?.user?.email ?? '').padEnd(30)} ${MODE.padEnd(7)} ${String(changed).padStart(3)} days changed · before ${before.join(',') || 'clean'} · after clean${(candidate.meta as unknown as Record<string, unknown>).goal_pace_withheld ? ' · goal pace WITHHELD' : ''}`)
    return
  }

  if (!APPLY) { log(`\nDRY-RUN — nothing written. Re-run with --apply to write.`); return }

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
  log(`\nAPPLIED. Old plan archived. Stored plan now: ${errCodes(stored).length ? errCodes(stored).join(', ') : 'clean'}`)
}
main().catch(e => { console.error(`\n${(e as Error).message}`); process.exit(1) })
