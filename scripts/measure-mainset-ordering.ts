// measure-mainset-ordering.ts — ⚠️ THE WRONG INSTRUMENT. Kept as the record of
// an error, not as a check.
//
// This measures MAIN-SET minutes. The constitution governs WORK minutes:
// `INV-PLAN-VO2MAX-MAIN-SET-CAP` checks `VO2MAX_WORK_TARGET_MINS` (12–18)
// wherever work is derivable, and 3,996 of 3,996 VO2max interval sessions carry
// a `derived_set`, so the 20-minute MAIN-SET ceiling governs NONE of them — it
// is the legacy v1 fallback.
//
// A main set is work PLUS recoveries. VO2max runs ~1:1 work:recovery; threshold
// runs short jogs. So 15 min of VO2max work is a ~30 min main set while 22 min
// of threshold work is a ~26 min main set: a LONGER VO2max main set is the
// CORRECT consequence of a SHORTER VO2max work dose. Reading these numbers as an
// "inversion" resurrected a defect that SC-08/CD-14's work bands had fixed.
//
// If SC-10 is ever re-opened, ask the question against WORK minutes.
//
// Original header follows.
// measure-mainset-ordering.ts — SC-10 / CD-14, the NEW measurement the item requires.
//
// SC-10's defect: a flat QUALITY_SESSION_PCT_OF_WEEKLY (18%) sizes every quality
// session off weekly volume, which INVERTS the main-set ordering. On the traced
// 12-week 10K, delivered main sets were vo2max 30 and 32 min -- the LARGEST in
// the plan -- against race pace 22 and 26, "when 25 minutes of threshold is a
// normal session and 25 minutes of VO2max is a race".
//
// Category PERCENTAGES were built, swept and REJECTED (15% -> 187 ordering
// breaches + 220 undersized; 17% broke ordering outright). The recorded
// conclusion is about the PREMISE: share-of-weekly-volume cannot express "VO2max
// is the least sustainable per minute" -- the main set needs ABSOLUTE minutes.
//
// Since then SIZING-REALLOC-01 closed (threshold/race-pace rows size off an
// absolute band) and VO2MAX_MAIN_SET_MAX_MINS (20) caps VO2max. The item says
// "do not re-attempt without new measurement", and the danger it names is
// MASKING: the inversion stopped reproducing on 16 plans without the sizing
// model changing, so a green suite reads as evidence the ordering is governed.
//
// This measures the ordering on 7,452 plans instead of 16.
//
// Run: NODE_ENV=production npx tsx scripts/measure-mainset-ordering.ts

import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { mainSetMinutes } from '../lib/plan/sessionFormat'
import { classifyStimulus } from '../lib/plan/sessionRole'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { Plan, Session } from '../types/plan'

const QUALITY = new Set(['quality', 'tempo', 'intervals'])
type Cat = string

const mins: Record<Cat, number[]> = {}
let plans = 0, refused = 0, sessions = 0
// An INVERSION is a plan whose largest VO2max main set exceeds its largest
// threshold/tempo one -- the ordering SC-10 says is upside down.
let plansWithBoth = 0, inverted = 0
let overCap = 0, vo2Intervals = 0, hillSessions = 0
const overBy: number[] = []
const CAP = GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS

for (const input of cohortGrid()) {
  let plan: Plan
  try { plan = generateRulePlan(input as never, 'paid', COHORT_PLAN_START) } catch { refused++; continue }
  plans++
  let maxVo2 = 0, maxThr = 0
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
      if (!s || !QUALITY.has(s.type)) continue
      const cat = classifyStimulus(s) ?? 'unclassified'
      const m = mainSetMinutes(s.duration_mins ?? 0)
      if (!Number.isFinite(m) || m <= 0) continue
      sessions++
      ;(mins[cat] ??= []).push(m)
      // ⚠️ HILLS ARE A DOCUMENTED EXEMPTION, not a breach. `classifyStimulus`
      // returns 'vo2max' for hill reps, but ruleEngine's own comment records that
      // effort-governed hills are priced at EASY pace and "this leaves them
      // longer — deliberately, they are lower impact (SC-09) and not the work
      // this ceiling exists to bound". Counting them inflates the breach rate.
      const isHills = /hill/i.test(s.label ?? '')
      if (cat === 'vo2max' && !isHills) {
        maxVo2 = Math.max(maxVo2, m)
        vo2Intervals++
        if (m > CAP + 0.5) overCap++          // 0.5 min slack for rounding
        overBy.push(m - CAP)
      }
      if (cat === 'vo2max' && isHills) hillSessions++
      // `classifyStimulus` has NO 'threshold' category — it returns 'tempo' for
      // the threshold family. An earlier version of this line also tested
      // `cat === 'threshold'`, which tsc flagged as a comparison that can never
      // be true: a dead arm that made the check look broader than it was.
      if (cat === 'tempo') maxThr = Math.max(maxThr, m)
    }
  }
  if (maxVo2 > 0 && maxThr > 0) {
    plansWithBoth++
    if (maxVo2 > maxThr) inverted++
  }
}

console.log(`plans: ${plans}  refused: ${refused}  quality sessions: ${sessions}`)
if (sessions === 0) { console.error('FAIL: no quality sessions reached.'); process.exit(1) }

console.log(`\nDELIVERED MAIN SET by stimulus (minutes):`)
console.log(`  ${'category'.padEnd(14)} ${'n'.padStart(6)} ${'mean'.padStart(6)} ${'p50'.padStart(6)} ${'max'.padStart(6)}`)
for (const [c, arr] of Object.entries(mins).sort((a, b) => b[1].length - a[1].length)) {
  const sorted = [...arr].sort((x, y) => x - y)
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  console.log(`  ${c.padEnd(14)} ${String(arr.length).padStart(6)} ${mean.toFixed(1).padStart(6)} ${String(sorted[Math.floor(sorted.length / 2)].toFixed(1)).padStart(6)} ${Math.max(...arr).toFixed(1).padStart(6)}`)
}

const pct = (n: number, d: number) => d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`
console.log(`\nSC-10 ORDERING — plans whose largest VO2max main set EXCEEDS their largest threshold one:`)
console.log(`  ${inverted} / ${plansWithBoth}  (${pct(inverted, plansWithBoth)})`)
console.log(`\nVO2MAX CEILING — excluding hill reps (a documented easy-paced exemption, ${hillSessions} sessions):`)
console.log(`  true VO2max interval sessions   : ${vo2Intervals}`)
console.log(`  above the ${CAP}-min cap            : ${overCap}  (${pct(overCap, vo2Intervals)})`)
if (overBy.length) {
  const over = overBy.filter(v => v > 0.5)
  if (over.length) {
    const mean = over.reduce((a, b) => a + b, 0) / over.length
    console.log(`  mean overshoot when over        : +${mean.toFixed(1)} min  (worst +${Math.max(...over).toFixed(1)})`)
  }
}
if (plansWithBoth === 0) {
  console.error('FAIL: no plan carried BOTH a VO2max and a threshold session — the ordering is untested, not proven.')
  process.exit(1)
}
