// measure-first-quality.ts — what is a runner's FIRST quality session?
//
// Found by eyeballing the 2026-09-14 review round. Case 01 is a BEGINNER,
// finish-goal 5K, returning from a 6-month layoff. Her first quality session
// ever, in week 5, is "Short VO2max" -- Zone 4-5, HR 164-190, RPE 7. The Z3
// work (cruise intervals, progressive tempo) arrives in weeks 6 and 7, AFTER it.
//
// So the hardest stimulus comes first and the ordering runs backwards. This
// counts how often that happens, and to whom.
//
// Run: NODE_ENV=production npx tsx scripts/measure-first-quality.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import type { Plan, Session } from '../types/plan'

// ⚠️ 'hard' is DELIBERATELY EXCLUDED. It is the §78 recalibration 5K time trial,
// which sits on a base/build DELOAD week, is Zone 4–5 by nature (a maximal
// CONTINUOUS effort, not reps — CLAUDE.md's session-colour table says so), and is
// a BENCHMARK rather than a training stimulus. Including it produced a false
// finding: "100% of beginners meet Zone 4–5 first" was counting their time trial.
const QUALITY = new Set(['quality', 'tempo', 'intervals'])
const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const

/** Rough stimulus rank from the session's own prescribed zone. */
function zoneRank(s: Session): number {
  const z = s.zone ?? ''
  if (/4|5/.test(z)) return 3          // VO2max / intervals
  if (/3/.test(z))   return 2          // threshold / tempo
  return 1                              // aerobic
}

let plans = 0, refused = 0
let withQuality = 0, firstIsZ45 = 0
const byLevel: Record<string, { n: number; z45: number }> = {}
const examples: string[] = []

for (const input of cohortGrid()) {
  let plan: Plan
  try { plan = generateRulePlan(input as never, 'paid', COHORT_PLAN_START) } catch { refused++; continue }
  plans++
  const level = (plan.meta.fitness_level as string) ?? 'unknown'
  byLevel[level] ??= { n: 0, z45: 0 }

  let first: { week: number; s: Session } | null = null
  for (const w of plan.weeks) {
    for (const d of DAYS) {
      const s = (w.sessions as Record<string, Session | undefined>)[d]
      if (!s || !QUALITY.has(s.type)) continue
      if (!first) first = { week: w.n, s }
    }
    if (first) break
  }
  if (!first) continue
  withQuality++
  byLevel[level].n++
  if (zoneRank(first.s) === 3) {
    firstIsZ45++
    byLevel[level].z45++
    if (examples.length < 6) {
      examples.push(`${level} ${plan.meta.race_distance_km}km ${plan.meta.goal ?? ''} — week ${first.week}: "${first.s.label}" ${first.s.zone} RPE ${first.s.rpe_target}`)
    }
  }
}

const pct = (n: number, d: number) => d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`
console.log(`plans: ${plans}  refused: ${refused}  with any quality: ${withQuality}`)
if (withQuality === 0) { console.error('FAIL: no quality session reached — measuring nothing.'); process.exit(1) }
console.log(`\nFIRST quality session is Zone 4–5 (the HARDEST stimulus, before any Z3 work):`)
console.log(`  overall: ${firstIsZ45} / ${withQuality}  (${pct(firstIsZ45, withQuality)})`)
for (const [k, v] of Object.entries(byLevel).sort()) {
  console.log(`  ${k.padEnd(14)}: ${v.z45} / ${v.n}  (${pct(v.z45, v.n)})`)
}
console.log(`\nexamples:`)
for (const e of examples) console.log('  ' + e)
