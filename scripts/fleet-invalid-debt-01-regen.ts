/* FLEET-INVALID-DEBT-01 — regenerate legacy-invalid stored plans with the current
 * engine so the daily plan-audit stops flagging them.
 *
 * Scope (deliberately narrow — this is cosmetic cleanup, not a fleet migration):
 *   - ONLY plans with a FUTURE race date (a past race can't be regenerated — the
 *     engine anchors to the race) AND a persisted meta.generator_input.
 *   - SKIP any account with real in-progress data (session_completions / run_analysis)
 *     or is_admin — those are the live-plan / opt-in-refresh case (FLEET-INVALID-DEBT
 *     option b), never a silent rewrite.
 *   - APPLY only a regenerated plan that VALIDATES CLEAN (0 errors) under current rules.
 *
 * Safety: dry-run by default; pass --apply to write. On apply it ARCHIVES the prior
 * plan to plan_archive first (savePlanForUser only archives on a race change, and the
 * race isn't changing here), then upserts. Rule-engine only — no AI enrichment.
 *
 * Run:  NODE_ENV=production npx tsx scripts/fleet-invalid-debt-01-regen.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { validateReshapedPlan } from '../lib/plan/invariants'
import type { Plan, GeneratorInput } from '../types/plan'

const APPLY = process.argv.includes('--apply')
const TODAY = '2026-09-17'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]
  }),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const errCodes = (p: Plan) =>
  Array.from(new Set(validateReshapedPlan(p).filter(v => v.severity === 'error').map(v => v.code))).sort()

async function usersWithData(table: string): Promise<Set<string>> {
  const { data } = await sb.from(table).select('user_id')
  return new Set((data ?? []).map(r => r.user_id as string))
}

async function main() {
  console.log(`FLEET-INVALID-DEBT-01 regen · ${APPLY ? 'APPLY (writing)' : 'DRY-RUN'} · today ${TODAY}\n`)

  const [{ data: rows, error }, completed, analysed, admins] = await Promise.all([
    sb.from('plans').select('user_id, plan_json, created_at, updated_at'),
    usersWithData('session_completions'),
    usersWithData('run_analysis'),
    sb.from('user_settings').select('id, is_admin, email').then(r => r.data ?? []),
  ])
  if (error) { console.error(error.message); process.exit(1) }
  const adminIds = new Set(admins.filter(a => a.is_admin).map(a => a.id as string))
  const emailById = new Map(admins.map(a => [a.id as string, (a.email as string) || '']))

  let regenerated = 0
  const skips: Record<string, number> = {}
  const applied: string[] = []
  const stillInvalidAfter: number[] = []

  for (const row of rows ?? []) {
    const user = row.user_id as string
    const short = user.slice(0, 8)
    const plan = row.plan_json as Plan | null
    if (!plan?.weeks?.length || !plan.meta) { skips.no_plan = (skips.no_plan ?? 0) + 1; continue }

    const before = errCodes(plan)
    if (before.length === 0) continue // already clean — nothing to do

    const meta = plan.meta as unknown as Record<string, unknown>
    const raceDate = (meta.race_date as string) || ''
    const planStart = (meta.plan_start as string) || ''
    const gi = meta.generator_input as GeneratorInput | undefined

    const skip = (reason: string) => {
      skips[reason] = (skips[reason] ?? 0) + 1
      console.log(`SKIP  ${short}  ${planStart || '—'}→${raceDate || '—'}  ${before.length} codes  [${reason}]${emailById.get(user) ? ` <${emailById.get(user)}>` : ''}`)
    }

    if (!raceDate || raceDate < TODAY) { skip('past-race'); continue }
    if (!gi) { skip('no-generator-input'); continue }
    if (completed.has(user)) { skip('has-completions'); continue }
    if (analysed.has(user)) { skip('has-run-analysis'); continue }
    if (adminIds.has(user)) { skip('is-admin'); continue }

    // Regenerate: rule engine + foundation compose, anchored to the ORIGINAL
    // plan_start so main-week identity (week.n / dates) is unchanged. gap 0 →
    // no new foundation prefix; validated clean before it counts.
    let candidate: Plan
    try {
      const input = { ...gi, plan_start: planStart } as GeneratorInput
      const tier = ((meta.tier as string) === 'free' ? 'free' : (meta.tier as string) === 'paid' ? 'paid' : 'trial') as 'free' | 'trial' | 'paid'
      const rule = generateRulePlan(input, tier, planStart, undefined, planStart)
      candidate = composePlanWithFoundation(rule, input, planStart, 'add').plan
    } catch (e) {
      skips.regen_threw = (skips.regen_threw ?? 0) + 1
      console.log(`SKIP  ${short}  [regen-threw] ${(e as Error).message.split('\n')[0]}`)
      continue
    }

    const after = errCodes(candidate)
    if (after.length > 0) {
      skips.regen_still_invalid = (skips.regen_still_invalid ?? 0) + 1
      stillInvalidAfter.push(after.length)
      console.log(`SKIP  ${short}  regen STILL invalid (${after.length}): ${after.join(',')}`)
      continue
    }

    regenerated++
    console.log(`OK    ${short}  ${planStart}→${raceDate}  ${before.length}→0 codes  ${plan.weeks.length}w→${candidate.weeks.length}w`)

    if (APPLY) {
      // 1) archive the prior plan (reversible snapshot)
      const arch = await sb.from('plan_archive').insert({
        user_id: user, plan_json: plan,
        race_name: (meta.race_name as string) ?? '', race_date: raceDate,
      })
      if (arch.error) { console.log(`  ! archive failed ${short}: ${arch.error.message} — NOT overwriting`); continue }
      // 2) overwrite with the regenerated plan
      const up = await sb.from('plans').upsert(
        { user_id: user, plan_json: candidate, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' })
      if (up.error) { console.log(`  ! upsert failed ${short}: ${up.error.message}`); continue }
      // 3) clear stale weekly-note cache keyed by week_n (mirrors savePlanForUser)
      await sb.from('plan_weekly_notes').delete().eq('user_id', user)
      applied.push(short)
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Regenerable & clean: ${regenerated}`)
  console.log(`Skipped: ${JSON.stringify(skips)}`)
  if (APPLY) console.log(`APPLIED (archived + overwritten): ${applied.length} — ${applied.join(', ')}`)
  else console.log(`DRY-RUN — nothing written. Re-run with --apply to write.`)
}
main()
