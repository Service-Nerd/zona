/**
 * FOUNDATION-BUDGET-01 remediation — recompose the foundation block on live plans so
 * weekday sessions respect the budget the runner stated.
 *
 *   npm run remediate:foundation                                  # dry run (default)
 *   npm run remediate:foundation -- --write --i-have-authorisation # writes
 *
 * ── THE PATTERN THIS FOLLOWS, AND WHY ────────────────────────────────────────
 * `OPS-ENRICH-REMEDIATE-01` (2026-10-02) had FOUR defects found only because the founder
 * asked "are you confident to run that?" — a hardcoded tier, a WHITELIST safety check
 * (the population-excludes-the-cases-at-risk flaw, inside the safety check of a script
 * that edits live runner data), the wrong save boundary, and no guard against clobbering
 * a concurrent write. Then the first write was INCOMPLETE and only reading the row back
 * out of Postgres revealed it. Every one of those lessons is wired in below.
 *
 * ── WHAT IT CHANGES, AND WHAT IT MUST NOT ────────────────────────────────────
 * Only foundation weeks (`n <= 0`). The main plan — every week the runner has read and
 * trusted — must come out BYTE-IDENTICAL, and that is asserted per plan, not hoped for.
 * AI enrichment is never re-paid: `composePlanWithFoundation` states in its own header
 * that it must not, and we do not call the enricher at all.
 *
 * ⚠️ READ-ONLY BY DEFAULT and it refuses to write without BOTH flags. A production write
 * is the founder's decision, not this script's.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { easyPaceFromPlan } from '../lib/plan/easyPace'
import { isLongRun } from '../lib/plan/sessionRole'
import type { GeneratorInput, Plan } from '../types/plan'

const WRITE = process.argv.includes('--write')
const AUTHORISED = process.argv.includes('--i-have-authorisation')
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null })()
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

if (WRITE && !AUTHORISED) {
  console.error('✗ --write refused without --i-have-authorisation. A production write is the founder\'s call.')
  process.exit(2)
}

// `.env.local` holds the service-role key (CLAUDE.md: production is queryable from here).
const env = (() => {
  const out: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
})()
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/** Every weekday foundation session over the budget the runner stated for that day. */
function overBudget(plan: Plan, input: GeneratorInput) {
  const pace = easyPaceFromPlan(plan)
  const budgets = (input as unknown as { day_budgets?: Record<string, number> }).day_budgets
  const flat = (input as unknown as { max_weekday_mins?: number }).max_weekday_mins
  const out: Array<{ week: number; day: string; km: number; mins: number; cap: number; floorProtected: boolean }> = []
  if (pace == null) return { pace, out }
  for (const w of plan.weeks) {
    if (w.n > 0) continue
    for (const d of WEEKDAYS) {
      const s = w.sessions[d]
      if (!s || isLongRun(s) || s.distance_km == null) continue
      const cap = budgets?.[d] ?? flat
      if (cap == null) continue
      const mins = s.duration_mins ?? Math.round(s.distance_km * pace)
      if (mins > cap) out.push({ week: w.n, day: d, km: s.distance_km, mins, cap, floorProtected: s.floor_protected === true })
    }
  }
  return { pace, out }
}

/** Main-plan weeks, stringified for an exact comparison. Nothing here may move. */
const mainWeeksFingerprint = (p: Plan) => JSON.stringify(p.weeks.filter(w => w.n > 0))
/**
 * Meta, minus the fields recomposition is EXPECTED to re-derive.
 *
 * ⚠️ The first cut compared ALL of meta and skipped both plans. The two that moved are
 * `uncovered_runway_weeks` / `uncovered_runway_note` — §57/§76's statement of the weeks the
 * plan does not cover, which is a function of TODAY'S DATE and so must change when the block
 * is rebuilt. Allowing them is not loosening the guard: everything else in meta, including
 * every prescription-bearing field and the generator input, still has to match exactly.
 */
const RECOMPOSE_MAY_CHANGE = new Set(['generated_at', 'updated_at', 'uncovered_runway_weeks', 'uncovered_runway_note'])
const metaFingerprint = (p: Plan) => {
  const m = { ...(p.meta as unknown as Record<string, unknown>) }
  for (const k of Array.from(RECOMPOSE_MAY_CHANGE)) delete m[k]
  return JSON.stringify(m)
}

async function main() {
  const { data: rows, error } = await db
    .from('plans')
    .select('id, user_id, plan_json, updated_at')
  if (error) throw error

  console.log(`\n═══ FOUNDATION-BUDGET-01 remediation — ${WRITE ? '🔴 WRITE' : 'DRY RUN'} ═══\n`)
  let candidates = 0, wrote = 0, skipped = 0

  for (const row of rows ?? []) {
    const plan = row.plan_json as Plan
    const input = (plan.meta as unknown as { generator_input?: GeneratorInput }).generator_input
    if (!input) continue
    if (!plan.weeks?.some(w => w.n <= 0)) continue
    if (ONLY && !row.id.startsWith(ONLY)) continue

    const before = overBudget(plan, input)
    if (!before.out.length) continue
    candidates++

    const { data: u } = await db.auth.admin.getUserById(row.user_id)
    const who = u?.user?.email ?? '(unknown)'
    console.log(`── ${who}  plan ${row.id.slice(0, 8)}`)
    console.log(`   BEFORE: ${before.out.length} weekday session(s) over budget`)
    for (const o of before.out) {
      console.log(`     w${o.week} ${o.day}: ${o.km}km ≈ ${o.mins} min vs ${o.cap} budget (+${Math.round(100*(o.mins-o.cap)/o.cap)}%)`)
    }

    // Recompose: strip the existing foundation weeks, then let the SINGLE OWNER rebuild
    // them with the fixed engine. Not a hand-splice — the same function the route calls.
    const stripped: Plan = { ...plan, weeks: plan.weeks.filter(w => w.n > 0) }
    const res = composePlanWithFoundation(stripped, input, new Date().toISOString().slice(0, 10), 'add')
    const after = overBudget(res.plan, input)

    // ── GUARDS. Every one of these must hold or this plan is skipped. ──────────
    const problems: string[] = []
    if (mainWeeksFingerprint(res.plan) !== mainWeeksFingerprint(plan)) problems.push('MAIN-PLAN WEEKS CHANGED')
    if (metaFingerprint(res.plan) !== metaFingerprint(plan)) problems.push('meta changed beyond timestamps')
    if (!res.plan.weeks.some(w => w.n <= 0)) problems.push('no foundation weeks were rebuilt')
    const stillOver = after.out.filter(o => !o.floorProtected)
    if (stillOver.length) problems.push(`${stillOver.length} session(s) still over budget and NOT floor-protected`)
    const errs = res.violations.filter(v => v.severity === 'error')
    if (errs.length) problems.push(`${errs.length} error-severity violation(s): ${Array.from(new Set(errs.map(e => e.code))).join(', ')}`)

    console.log(`   AFTER:  ${after.out.length} over budget (${after.out.filter(o => o.floorProtected).length} held at §82's floor, declared)`)
    // ⚠️ PRINT THE AFTER DETAIL. The first dry run printed only the count, and I read the
    // unchanged BEFORE numbers as though they had survived — they had not. A diff that does
    // not show both sides invites exactly that misreading.
    for (const w of res.plan.weeks.filter(w => w.n <= 0)) {
      const parts = WEEKDAYS.map(d => {
        const sn = w.sessions[d]
        return sn ? `${d}:${sn.distance_km}km/${sn.duration_mins ?? '—'}min${sn.floor_protected ? '*' : ''}` : null
      }).filter(Boolean)
      console.log(`     w${w.n}: ${parts.join('  ')}`)
    }
    if (problems.length) {
      console.log(`   🔴 SKIPPED — ${problems.join(' · ')}`)
      skipped++
      continue
    }
    console.log(`   ✅ guards pass: main-plan weeks byte-identical, meta unchanged, no error violations`)

    if (!WRITE) { console.log(`   (dry run — nothing written)\n`); continue }

    // Archive first — a direct update bypasses savePlanForUser, which is what normally
    // writes plan_archive. Doing it here keeps the data-protection promise intact.
    const ins = await db.from('plan_archive').insert({
      user_id: row.user_id, plan_json: plan,
      race_name: (plan.meta as unknown as Record<string, string>).race_name ?? null,
      race_date: (plan.meta as unknown as Record<string, string>).race_date ?? null,
      archived_at: new Date().toISOString(),
    })
    if (ins.error) { console.log(`   🔴 archive failed, NOT writing: ${ins.error.message}\n`); skipped++; continue }

    // Compare-and-swap: refuse if the runner regenerated since we read.
    const upd = await db.from('plans')
      .update({ plan_json: res.plan, updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('updated_at', row.updated_at).select('id')
    if (upd.error || !upd.data?.length) {
      console.log(`   🔴 CAS failed — the row changed since we read it. NOT written.\n`); skipped++; continue
    }

    // ⚠️ READ IT BACK. Every guard above ran on an object in memory; the last
    // remediation printed WRITTEN while the database disagreed.
    const check = await db.from('plans').select('plan_json').eq('id', row.id).single()
    const stored = check.data?.plan_json as Plan | undefined
    const verified = stored
      && overBudget(stored, input).out.filter(o => !o.floorProtected).length === 0
      && mainWeeksFingerprint(stored) === mainWeeksFingerprint(plan)
    console.log(verified ? `   ✅ WRITTEN and VERIFIED FROM THE DATABASE\n` : `   🔴 WRITTEN BUT VERIFICATION FAILED — investigate immediately\n`)
    wrote++
  }

  console.log(`\ncandidates ${candidates} · written ${wrote} · skipped ${skipped}`)
  if (!WRITE) console.log(`\nDry run. Re-run with --write --i-have-authorisation to apply.`)
}

main().catch(e => { console.error(e); process.exit(1) })
