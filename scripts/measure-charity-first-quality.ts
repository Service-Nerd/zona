// measure-charity-first-quality.ts — THE SHOWCASE COHORT.
//
// The charity partnership is the first acquisition channel and its runners are
// predominantly BEGINNERS taking on 10K / half / marathon. `CHARITY_PERSONAS`
// (M1-M5, H1-H3, T1-T3) is that cohort, written for exactly this purpose.
//
// A plan can pass every invariant and still be wrong for a first-timer. This
// asks one question of each persona, in plain terms:
//
//     what is the FIRST hard session this runner is ever asked to do?
//
// 'hard' (the §78 recalibration 5K time trial) is EXCLUDED -- it is a benchmark
// on a deload week, not a training stimulus. Counting it produced a false 100%
// figure earlier today.
//
// Run: NODE_ENV=production npx tsx scripts/measure-charity-first-quality.ts

import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { classifyStimulus } from '../lib/plan/sessionRole'
import type { Plan, Session } from '../types/plan'

const QUALITY = new Set(['quality', 'tempo', 'intervals'])
const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const

let reached = 0, refused = 0, z45First = 0, reentryActive = 0

console.log(`${'persona'.padEnd(42)} ${'lvl'.padEnd(7)} ${'re-entry'.padEnd(9)} first hard session`)
console.log('-'.repeat(112))

for (const p of CHARITY_PERSONAS) {
  let plan: Plan
  try { plan = generateRulePlan(charityInput(p, CHARITY_PLAN_START), 'paid', CHARITY_PLAN_START) }
  catch { refused++; console.log(`${p.id.slice(0, 40).padEnd(42)} ${'-'.padEnd(7)} ${'-'.padEnd(9)} ⛔ refused by design`); continue }
  reached++

  let first: { w: number; s: Session } | null = null
  for (const w of plan.weeks) {
    for (const d of DAYS) {
      const s = (w.sessions as Record<string, Session | undefined>)[d]
      if (s && QUALITY.has(s.type) && !first) first = { w: w.n, s }
    }
    if (first) break
  }
  const re = plan.meta.intensity_reentry_active === true
  if (re) reentryActive++
  const lvl = String(plan.meta.fitness_level ?? '?')
  if (!first) {
    console.log(`${p.id.slice(0, 40).padEnd(42)} ${lvl.padEnd(7)} ${(re ? `yes(${plan.meta.intensity_reentry_weeks})` : 'no').padEnd(9)} none — all easy`)
    continue
  }
  const cat = classifyStimulus(first.s) ?? '?'
  const hard = /4|5/.test(first.s.zone ?? '')
  if (hard) z45First++
  console.log(
    `${p.id.slice(0, 40).padEnd(42)} ${lvl.padEnd(7)} ${(re ? `yes(${plan.meta.intensity_reentry_weeks})` : 'no').padEnd(9)}` +
    ` wk${String(first.w).padStart(2)} ${first.s.label} [${first.s.zone}] RPE ${first.s.rpe_target} (${cat})${hard ? '   ← Z4–5 FIRST' : ''}`)
}

console.log(`\npersonas: ${reached} generated, ${refused} refused by design`)
console.log(`§79 intensity re-entry active on: ${reentryActive}`)
console.log(`first hard session is Zone 4–5  : ${z45First} / ${reached}`)
if (reached === 0) { console.error('FAIL: no charity persona generated.'); process.exit(1) }
