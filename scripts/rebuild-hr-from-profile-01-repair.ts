/* REBUILD-HR-FROM-PROFILE-01 — put back a CONFIRMED max heart rate that a rebuild undid.
 *
 * Finds every plan whose runner confirmed a max HR in Profile (`user_settings.max_hr_source = 'user_confirmed'`)
 * while the plan's own zones use a different max or resting HR. Measured 2026-10-23: two, both reverted by a rebuild
 * from the stored answers (a089b7a7 143 -> 178 on 2026-09-17; 1afc17e4 185 -> 188 on 2026-10-18).
 *
 * The repair is exactly what confirming in Profile does (`DashboardClient` "Save HR"): `applyHrToPlan` re-zones the
 * sessions, and meta is stamped `user_confirmed` / karvonen. It does NOT regenerate: distances, days, labels, week
 * numbers, coach notes and every logged run are untouched (applyHrToPlan's own header).
 *
 * Safety: dry-run by default and lists every candidate; --apply requires --only <plan-id-prefix>, archives the plan to
 * plan_archive first, writes by plan id, then reads it back. It refuses only a repair that ADDS a failing check: a
 * check the plan already fails is not the repair's to fix (both 2026-10-23 candidates carry one).
 *
 * Run:  NODE_ENV=production npx tsx scripts/rebuild-hr-from-profile-01-repair.ts [--apply --only <id>]
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import { applyHrToPlan } from '../lib/plan/zones'
import { validateReshapedPlan } from '../lib/plan/invariants'
import type { Plan } from '../types/plan'

const APPLY = process.argv.includes('--apply')
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]
  }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const errCodes = (p: Plan) =>
  Array.from(new Set(validateReshapedPlan(p).filter(v => v.severity === 'error').map(v => v.code))).sort()

async function main() {
  if (APPLY && !ONLY) throw new Error('--apply needs --only <plan-id-prefix>: this rewrites a runner\'s zones, one plan at a time')
  console.log(`REBUILD-HR-FROM-PROFILE-01 repair · ${APPLY ? 'APPLY (writing)' : 'DRY-RUN'}\n`)

  const [{ data: plans, error }, { data: settings }] = await Promise.all([
    sb.from('plans').select('id, user_id, plan_json'),
    sb.from('user_settings').select('id, email, max_hr, resting_hr, max_hr_source'),
  ])
  if (error) throw new Error(error.message)
  const byId = new Map((settings ?? []).map(s => [s.id as string, s]))

  const candidates = (plans ?? []).filter(r => {
    const s = byId.get(r.user_id as string)
    const m = (r.plan_json as Plan | null)?.meta as unknown as Record<string, unknown> | undefined
    if (!s || !m || s.max_hr_source !== 'user_confirmed' || !s.max_hr || !s.resting_hr) return false
    return m.max_hr !== s.max_hr || m.resting_hr !== s.resting_hr
  }).filter(r => !ONLY || String(r.id).startsWith(ONLY))

  if (!candidates.length) { console.log('No plan disagrees with a confirmed profile heart rate.'); return }

  for (const r of candidates) {
    const s = byId.get(r.user_id as string)!
    const plan = r.plan_json as Plan
    const m = plan.meta as unknown as Record<string, unknown>
    const fixed = applyHrToPlan(plan as never, s.resting_hr as number, s.max_hr as number) as never as Plan
    const fm = fixed.meta as unknown as Record<string, unknown>
    const candidate = { ...fixed, meta: { ...fm, max_hr: s.max_hr, resting_hr: s.resting_hr, hr_derived_max: s.max_hr,
      hr_max_source: 'user_confirmed', hr_zone_method: 'karvonen', hr_assumption_note: undefined } } as unknown as Plan
    const cm = candidate.meta as unknown as Record<string, unknown>
    let sessions = 0
    plan.weeks.forEach((w, i) => Object.keys(w.sessions ?? {}).forEach(d => {
      const a = (w.sessions as Record<string, { hr_target?: string; zone?: string } | undefined>)[d]
      const b = (candidate.weeks[i].sessions as Record<string, { hr_target?: string; zone?: string } | undefined>)[d]
      if (a?.hr_target !== b?.hr_target) sessions++
    }))
    const before = errCodes(plan), after = errCodes(candidate)
    const { data: who } = await sb.auth.admin.getUserById(r.user_id as string)
    console.log(`${String(r.id).slice(0, 8)}  ${who?.user?.email ?? s.email ?? r.user_id}`)
    console.log(`  profile (confirmed)  max ${s.max_hr} · resting ${s.resting_hr}`)
    console.log(`  plan now             max ${m.max_hr} · resting ${m.resting_hr} · Z2 ceiling ${m.zone2_ceiling} (${m.hr_zone_method ?? '—'})`)
    console.log(`  after repair         max ${cm.max_hr} · resting ${cm.resting_hr} · Z2 ceiling ${cm.zone2_ceiling} (karvonen)`)
    console.log(`  sessions with a new HR target: ${sessions} · checks before: ${before.join(', ') || 'clean'} · after: ${after.join(', ') || 'clean'}\n`)

    if (!APPLY) continue
    const added = after.filter(c => !before.includes(c))
    if (added.length) throw new Error(`refused: the repair adds failing checks: ${added.join(', ')}`)
    const arch = await sb.from('plan_archive').insert({
      user_id: r.user_id, plan_json: plan, race_name: (m.race_name as string) ?? '', race_date: (m.race_date as string) ?? '',
    })
    if (arch.error) throw new Error(`archive failed, NOT overwriting: ${arch.error.message}`)
    const up = await sb.from('plans').update({ plan_json: candidate, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (up.error) throw new Error(`write failed (old plan is archived): ${up.error.message}`)
    const { data: back } = await sb.from('plans').select('plan_json').eq('id', r.id).single()
    const bm = (back?.plan_json as Plan).meta as unknown as Record<string, unknown>
    console.log(`APPLIED. Old plan archived. Stored plan now: max ${bm.max_hr} · resting ${bm.resting_hr} · Z2 ${bm.zone2_ceiling}`)
  }
  if (!APPLY) console.log('DRY-RUN — nothing written. Apply one plan with --apply --only <id>.')
}
main().catch(e => { console.error(`\n${(e as Error).message}`); process.exit(1) })
