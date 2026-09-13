// measure-day-budgets.ts — UX-WIZARD-01 before/after signal.
//
// Runs every coach-review case that sets `day_budgets` and reports, per weekday,
// the session duration against THAT day's budget — plus which weekday carries
// the structured/quality session and the plan's peak weekly km. This is the
// number Stage B must move: today the engine acts on max_weekday_mins =
// min(day_budgets), so a session over the tightest day's budget overruns (§81)
// and the roomy day is unused. Run BEFORE and AFTER Stage B and diff.
//
// Run: NODE_ENV=production npx tsx scripts/measure-day-budgets.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { CANONICAL_CASES } from './generate-coaching-review'

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

const cases = CANONICAL_CASES.filter(c => (c.input as any).day_budgets)
if (cases.length === 0) { console.log('No day_budget cases found.'); process.exit(0) }

let worstOverall = 0
for (const c of cases) {
  const input: any = c.input
  const budgets: Record<string, number> = input.day_budgets
  console.log('\n' + '─'.repeat(78))
  console.log(`▶ ${c.id} — ${c.title}`)
  console.log(`  budgets: ${WEEKDAYS.map(d => budgets[d] != null ? `${d} ${budgets[d]}` : null).filter(Boolean).join(' · ')} · engine cap today = ${input.max_weekday_mins}`)

  const plan = generateRulePlan(input, c.tier, input.plan_start)
  let peakKm = 0
  let overCount = 0
  let worst = 0
  const qualityDays = new Set<string>()

  for (const w of plan.weeks) {
    if ((w as any).n < 1) continue
    const wkKm = Object.values(w.sessions).reduce((s: number, sess: any) => s + (sessionKmSelfPaced(sess) ?? 0), 0)
    peakKm = Math.max(peakKm, wkKm)
    for (const d of WEEKDAYS) {
      const sess: any = (w.sessions as any)[d]
      if (!sess || isLongRun(sess)) continue
      if (sess.type === 'quality' || sess.type === 'hard' || sess.type === 'tempo' || sess.type === 'intervals') {
        qualityDays.add(d)
      }
      const budget = budgets[d] ?? input.max_weekday_mins
      const dur = sess.duration_mins
      if (typeof dur === 'number' && budget != null && dur > budget) {
        overCount++
        worst = Math.max(worst, dur - budget)
      }
    }
  }
  worstOverall = Math.max(worstOverall, worst)
  console.log(`  peak weekly = ${Math.round(peakKm)} km`)
  console.log(`  structured/quality weekday(s) = ${qualityDays.size ? Array.from(qualityDays).join(', ') : 'none on a weekday'}`)
  console.log(`  weekday sessions OVER their own day's budget = ${overCount}${worst ? ` (worst +${worst} min)` : ''}`)
}

console.log('\n' + '═'.repeat(78))
console.log(`Worst over-budget across all day-budget cases: +${worstOverall} min`)
console.log('(Stage B target: structured session on the roomy day; 0 sessions over their OWN day budget except §81; peak km up.)')
