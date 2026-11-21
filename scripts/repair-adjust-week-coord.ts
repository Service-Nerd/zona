// ADJUST-WEEK-COORD-01 — repair the one plan the defect damaged (ref 0a446b4ade). Founder instruction
// 2026-11-21: "I want you to do this". Runbook: docs/runbooks/adjust-week-coord-repair.md.
//
//   npx tsx --env-file=.env.local scripts/repair-adjust-week-coord.ts            # dry run, writes nothing
//   npx tsx --env-file=.env.local scripts/repair-adjust-week-coord.ts --apply    # writes
//
// THE SOURCE FOR WEEKS 1–2. Rebuilding this runner's stored `generator_input` (with the profile heart
// rate laid over it, exactly as Modify does) reproduces race weeks 3..20 on every day by type, distance
// and duration. The only differences are AI-enrichment text and the ADR-026 threshold HR band. So the
// rebuilt weeks 1 and 2 are what the engine prescribed for this runner, and the script REFUSES unless
// that reproduction still holds when it runs.
//
// What it does, each step guarded so a re-run or a changed state writes nothing:
//   1. archive the current plan (plan_archive), then replace weeks n=1 and n=2 with the rebuilt ones;
//   2. re-key the four plan_adjustments rows to the week they were about (1 → -3, 2 → -2);
//   3. re-key the two run_analysis rows for runs of 11-09 / 11-11 from n=1 to n=-3;
//   4. supersede (never delete) the two run-less week-1 completions that duplicate week -3's.
// It prints no personal data.

import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { runEngine } from '@/lib/plan/engine'
import { withProfileHr } from '@/lib/plan/rebuildInput'
import { getUserTier } from '@/lib/trial'
import { savePlanForUser } from '@/lib/plan'
import { validateSavedPlan } from '@/lib/plan/validateStoredPlan'
import type { Plan } from '@/types/plan'

const REF = '0a446b4ade'
const APPLY = process.argv.includes('--apply')
const ADJ_REKEY: Record<string, number> = { '07c97c2bd6': -3, '292bf192bc': -3, '4a76a6251a': -2, '7072a48192': -2 }
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const ref = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 10)
const sig = (d: any) => (d ? `${d.type}|${d.distance_km ?? ''}|${d.duration_mins ?? ''}` : '-')
function refuse(msg: string): never { console.error(`REFUSED: ${msg}`); process.exit(2) }
function check(label: string, res: { error?: { message?: string } | null }) { if (res.error) refuse(`${label}: ${res.error.message}`) }

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const plansRes = await db.from('plans').select('user_id, plan_json'); check('plans', plansRes)
  const row = (plansRes.data ?? []).find(p => ref(p.user_id) === REF) ?? refuse('plan not found')
  const uid: string = row.user_id
  const live = row.plan_json as Plan
  const week = (p: Plan, n: number) => p.weeks.find(w => w.n === n)

  // ── Rebuild, exactly as Modify does, and prove it reproduces the untouched weeks ──
  const settingsRes = await db.from('user_settings').select('resting_hr, max_hr, max_hr_source').eq('id', uid).maybeSingle()
  check('user_settings', settingsRes)
  const gi = (live.meta as any).generator_input ?? refuse('no generator_input')
  const out: any = runEngine({ input: withProfileHr(gi, settingsRes.data as any), tier: await getUserTier(uid), acceptBaseBuild: false, displayUnits: 'km' })
  if (out.kind !== 'plan') refuse(`rebuild did not produce a plan (${out.kind})`)
  const rebuilt = out.plan as Plan
  const later = live.weeks.filter(w => w.n >= 3)
  const reproduced = later.filter(w => DAYS.every(d => sig((w.sessions as any)?.[d]) === sig((week(rebuilt, w.n)?.sessions as any)?.[d]))).length
  console.log(`source check: rebuilt reproduces ${reproduced} of ${later.length} race weeks n>=3 by type|km|mins`)
  if (reproduced !== later.length) refuse('the rebuild no longer reproduces the untouched weeks, so it is not a faithful source')

  // ── Step 1: weeks 1 and 2 ──
  const adjRes = await db.from('plan_adjustments').select('id, week_n, sessions_after, created_at').eq('user_id', uid).is('superseded_at', null)
  check('plan_adjustments', adjRes)
  const adjs = (adjRes.data ?? []).filter(a => ref(a.id) in ADJ_REKEY)
  if (adjs.length !== 4) refuse(`expected 4 adjustment rows, found ${adjs.length}`)
  const damaged = (n: number) => {
    const w = week(live, n)!
    const latest = adjs.filter(a => a.week_n === n).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    if (!latest) return false
    return DAYS.every((d, i) => JSON.stringify((w.sessions as any)?.[d] ?? null) === JSON.stringify((latest.sessions_after as any)?.[i] ?? null))
  }
  const toFix = [1, 2].filter(damaged)
  console.log(`step 1: weeks still holding the misplaced write: ${toFix.length ? toFix.map(n => `n=${n}`).join(', ') : 'none (already restored)'}`)
  let next: Plan | null = null
  if (toFix.length) {
    next = { ...live, weeks: live.weeks.map(w => {
      if (!toFix.includes(w.n)) return w
      const r = week(rebuilt, w.n)!
      if (r.date !== w.date) refuse(`rebuilt week n=${w.n} starts ${r.date}, live ${w.date}`)
      return r
    }) }
    const before = validateSavedPlan(live, gi).filter(v => v.severity === 'error').length
    const after = validateSavedPlan(next, gi).filter(v => v.severity === 'error').length
    console.log(`        validation errors: before ${before}, after ${after}`)
    if (after > before) refuse('the repaired plan validates worse than the damaged one')
    for (const n of toFix) {
      const w = week(next, n)!
      console.log(`        n=${n} becomes: ${DAYS.map(d => (w.sessions as any)?.[d] ? `${d} ${(w.sessions as any)[d].type} ${(w.sessions as any)[d].distance_km ?? ''}`.trim() : null).filter(Boolean).join(' · ')}`)
    }
  }

  // ── Steps 2–4: the mis-keyed rows ──
  const adjToMove = adjs.filter(a => a.week_n !== ADJ_REKEY[ref(a.id)])
  console.log(`step 2: adjustment rows to re-key: ${adjToMove.length} of 4`)
  const anRes = await db.from('run_analysis').select('id, week_n, session_day, created_at').eq('user_id', uid).is('superseded_at', null).eq('week_n', 1).in('session_day', ['mon', 'wed']).lt('created_at', '2026-11-16')
  check('run_analysis', anRes)
  const anClash = await db.from('run_analysis').select('id').eq('user_id', uid).is('superseded_at', null).eq('week_n', -3).in('session_day', ['mon', 'wed'])
  check('run_analysis clash', anClash)
  // Only a collision when there is something to move: after step 3 the moved rows ARE the week -3 ones.
  if ((anRes.data ?? []).length && (anClash.data ?? []).length) refuse('a week -3 analysis already exists for mon/wed; re-keying would collide')
  console.log(`step 3: analyses to re-key 1 → -3: ${(anRes.data ?? []).length}`)
  const compRes = await db.from('session_completions').select('id, session_day, apple_health_uuid, created_at').eq('user_id', uid).is('superseded_at', null).eq('week_n', 1).in('session_day', ['mon', 'wed']).lt('created_at', '2026-11-16')
  check('session_completions', compRes)
  const twins = await db.from('session_completions').select('session_day').eq('user_id', uid).is('superseded_at', null).eq('week_n', -3).in('session_day', ['mon', 'wed'])
  check('session_completions twins', twins)
  const comps = (compRes.data ?? []).filter(c => !c.apple_health_uuid && (twins.data ?? []).some(t => t.session_day === c.session_day))
  if (comps.length !== (compRes.data ?? []).length) refuse('a week-1 completion has a run attached or no week -3 twin; decide it by hand')
  console.log(`step 4: run-less duplicate completions to supersede: ${comps.length}`)

  // ── Step 5: a SECOND runner (ref c572d7a479). A "Life got busy" skip written 2026-11-21 13:20 UTC,
  // 21 minutes before the fix was pushed, while they were in n=-3 (Mon 11-16). The missed-session prompt
  // stored it at n=1 (Mon 12-07). No row at (-3, mon), no adjustment followed it: re-key only.
  const other = (plansRes.data ?? []).find(p => ref(p.user_id) === 'c572d7a479')
  const skipRes = other
    ? await db.from('session_completions').select('id').eq('user_id', other.user_id).is('superseded_at', null)
        .eq('week_n', 1).eq('session_day', 'mon').eq('status', 'skipped').lt('created_at', '2026-11-22')
    : { data: [], error: null }
  check('second runner skip', skipRes as any)
  const skipClash = other
    ? await db.from('session_completions').select('id').eq('user_id', other.user_id).is('superseded_at', null).eq('week_n', -3).eq('session_day', 'mon')
    : { data: [], error: null }
  check('second runner clash', skipClash as any)
  const skips = skipRes.data ?? []
  if (skips.length && (skipClash.data ?? []).length) refuse('second runner already has a (-3, mon) completion; decide by hand')
  console.log(`step 5: second runner's misplaced skip to re-key 1 → -3: ${skips.length}`)

  if (!APPLY) { console.log('\nDRY RUN — nothing written. Re-run with --apply.'); return }

  if (next) {
    const fresh = await db.from('plans').select('plan_json').eq('user_id', uid).single(); check('plans re-read', fresh)
    if (JSON.stringify(fresh.data!.plan_json) !== JSON.stringify(live)) refuse('the plan changed while this ran')
    const arch = await db.from('plan_archive').insert({ user_id: uid, plan_json: live, race_name: (live.meta as any).race_name ?? null, race_date: (live.meta as any).race_date ?? null })
    check('plan_archive', arch)
    await savePlanForUser(uid, next, db as any)
    const saved = await db.from('plans').select('plan_json').eq('user_id', uid).single(); check('plans verify', saved)
    const ok = toFix.every(n => DAYS.every(d => sig((week(saved.data!.plan_json, n)?.sessions as any)?.[d]) === sig((week(next!, n)?.sessions as any)?.[d])))
    if (!ok) refuse('plan save did not land as written')
    console.log('wrote step 1 (prior plan archived)')
  }
  for (const a of adjToMove) {
    const r = await db.from('plan_adjustments').update({ week_n: ADJ_REKEY[ref(a.id)] }).eq('id', a.id).eq('week_n', a.week_n)
    check(`plan_adjustments ${ref(a.id)}`, r)
  }
  if (adjToMove.length) console.log(`wrote step 2 (${adjToMove.length})`)
  for (const a of anRes.data ?? []) check('run_analysis update', await db.from('run_analysis').update({ week_n: -3 }).eq('id', a.id).eq('week_n', 1))
  if ((anRes.data ?? []).length) console.log(`wrote step 3 (${(anRes.data ?? []).length})`)
  const now = new Date().toISOString()
  for (const c of comps) check('session_completions supersede', await db.from('session_completions').update({ superseded_at: now }).eq('id', c.id).is('superseded_at', null))
  if (comps.length) console.log(`wrote step 4 (${comps.length})`)
  for (const s of skips) check('second runner re-key', await db.from('session_completions').update({ week_n: -3 }).eq('id', s.id).eq('week_n', 1))
  if (skips.length) console.log(`wrote step 5 (${skips.length})`)
  console.log('\nDone. Verify: npx tsx --env-file=.env.local scripts/measure-adjust-week-coord.ts')
}
main().catch(e => { console.error(e?.message ?? e); process.exit(1) })
