// audit-stored-plans.ts — "what does the code IN MY WORKING TREE do to the plans runners
// already have?"
//
//   npm run audit:stored
//
// 🔴 WHY THIS EXISTS. On 2026-11-02 I shipped a new invariant
// (`INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND`, §40b Am.4) verified with `verify:parity`,
// `measure:fitness`, `review:coaching` and the full suite. **Every one of those generates NEW
// plans.** Nothing asked what it does to the 39 STORED ones. It fired on 3 and was the only
// error on 2 — and because `validateReshapedPlan` returns every error in the plan, one error
// anywhere makes `/api/adjust-plan` refuse. **Adjustable plans went 21 → 19 and two runners
// silently lost plan adjustment.** The founder asks for regression testing every time; this is
// the question that was not being asked.
//
// ⚠️ WHY `/api/ops/plan-audit` IS NOT THIS. That route asks the same question daily by cron,
// and it is how this was eventually found — the next morning, from the digest. But it runs the
// **DEPLOYED** invariants against stored plans. Before shipping, the thing you need is the
// **LOCAL** invariants against stored plans, and only a local script can do that. The route
// tells you what you already broke; this tells you what you are about to.
//
// ⚠️ IT IS NOT A RATCHETED GATE, and that is a limit rather than an omission. `cohort:shape`
// and `measure:fitness` can commit a baseline because their population is a fixed grid. This
// population is production: it changes when a runner generates a plan, so a committed baseline
// would go stale on its own and produce false alarms, which this repo records as equivalent to
// having no gate. **It is a one-command answer, and the procedure in `plan-invariants.md` is
// what makes it run.** Read it before and after a change that touches an invariant.
//
// Read-only. Needs `.env.local`:
//   npx tsx --env-file=.env.local scripts/audit-stored-plans.ts
import { createClient } from '@supabase/supabase-js'
import { validateStoredPlan } from '../lib/plan/validateStoredPlan'
import type { Plan } from '../types/plan'

const main = async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (use --env-file=.env.local)')
    process.exit(2)
  }
  const sb = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) { console.error('read failed:', error.message); process.exit(1) }

  const rows = (data ?? []) as { user_id: string; plan_json: Plan }[]
  let considered = 0, adjustable = 0, refused = 0, threw = 0
  const census = new Map<string, number>()
  const plansByCode = new Map<string, Set<string>>()
  const soleCause = new Map<string, number>()

  for (const r of rows) {
    const plan = r.plan_json
    if (!plan?.weeks?.length) continue
    considered++
    let errs
    try {
      // ⚠️ `validateStoredPlan`, because it is what `/api/adjust-plan` actually calls, so it is
      // what decides whether this runner can have their plan adjusted. Asking a different
      // question from the one the product asks is how a check reads green while the runner is
      // stuck.
      //
      // 🔴 IT WAS `validateReshapedPlan` UNTIL 2026-11-03, AND THAT WAS CORRECT UNTIL THE
      // MOMENT IT WASN'T. The comment above was the right instinct pointed at the wrong
      // function: `RESHAPE-VALIDATOR-KIND-01` moved the route onto the kind-dispatching
      // owner, so this line had to move in the same commit or this script would have gone on
      // measuring a question production no longer asks — reporting the 3 base-build plans as
      // refused on 121 phantom errors after the route had stopped refusing them. **A check
      // that names the caller it mirrors must move WITH that caller.**
      errs = validateStoredPlan(plan).filter(v => v.severity === 'error')
    } catch (e) {
      threw++
      console.log(`! ${String(r.user_id).slice(0, 8)}: validation THREW — ${(e as Error).message.slice(0, 80)}`)
      continue
    }
    if (!errs.length) { adjustable++; continue }
    refused++
    const codes = new Set(errs.map(v => v.code))
    for (const c of Array.from(codes)) {
      census.set(c, (census.get(c) ?? 0) + 1)
      if (!plansByCode.has(c)) plansByCode.set(c, new Set())
      plansByCode.get(c)!.add(String(r.user_id).slice(0, 8))
    }
    if (codes.size === 1) {
      const only = Array.from(codes)[0]
      soleCause.set(only, (soleCause.get(only) ?? 0) + 1)
    }
  }

  console.log(`\n══ STORED PLANS, against the code in this working tree ══\n`)
  console.log(`plans considered                    ${considered}`)
  console.log(`CLEAN (0 error-severity violations) ${adjustable}`)
  console.log(`CARRYING error-severity violations  ${refused}${refused ? `   (${Math.round(refused / considered * 100)}% of runners)` : ''}`)
  // 🔴 THIS LINE SAID "REFUSED on every adjustment" AND IT WAS TRUE UNTIL §134 SHIPPED.
  // `/api/adjust-plan` used to refuse on every error anywhere in the plan, so a count of
  // plans-with-errors WAS a count of frozen runners. Since RESHAPE-SCOPE-TO-CHANGE-01 it
  // refuses only on what a reshape INTRODUCED, so these plans carry debt without being
  // frozen — measured on a simulated reorder across all of them, 14 of 15 proceed and 1
  // genuinely introduces a breach. **Keeping the old label would have made this script
  // overstate by an order of magnitude while reading exactly as authoritative as before.**
  if (refused > 0) {
    console.log(`\n    §134: carrying a violation is NOT the same as being refused. An adjustment is`)
    console.log(`    refused only on what the reshape INTRODUCES, so most of these can still be`)
    console.log(`    adjusted. The debt itself is STORED-PLAN-DEBT-REPAIR-01.`)
  }
  if (threw) console.log(`validation threw                    ${threw}   <-- investigate, these are not counted`)

  if (census.size) {
    console.log(`\nplans affected, by code (a plan can appear more than once):`)
    for (const [c, n] of Array.from(census).sort((a, b) => b[1] - a[1])) {
      const sole = soleCause.get(c) ?? 0
      console.log(`  ${String(n).padStart(3)} plan(s)  ${c}${sole ? `   <-- SOLE cause on ${sole}: this code is the whole of their debt` : ''}`)
    }
  }

  console.log(`\n⚠️  WHAT THIS DOES NOT TELL YOU`)
  console.log(`    · Nothing about plans that do not exist yet — that is verify:parity and measure:fitness.`)
  console.log(`    · Nothing about whether a REFUSAL is correct. A plan that genuinely breaches its`)
  console.log(`      rules SHOULD refuse; the question is whether YOUR change caused it.`)
  console.log(`    · It is not a gate. Run it before AND after, and compare the two numbers yourself.`)
  console.log(`    · A SOLE-cause line is the loud case: those plans had zero errors until that code.`)
  // Deliberately exit 0 even with refusals: a non-zero exit would read as "this change is bad",
  // and a pre-existing refusal is not this change's fault. The comparison is the signal.
}
main().catch(e => { console.error(e); process.exit(1) })
