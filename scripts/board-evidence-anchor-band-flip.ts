// ANCHOR-BAND-FLIP-01 — what the flip does, measured. Read-only.
//
//   npx tsx scripts/board-evidence-anchor-band-flip.ts [stride]
//
// Four questions, because no existing gate answers them: the persona table re-derived from the
// REAL producers; how many sessions take a new zone/HR and which; the interval arm REPORTED
// SEPARATELY (McMillan's binding condition, ADR-026 §5); and which invariants fire.

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START, isDesignedRefusal } from '../lib/plan/cohortGrid'
import { validatePlan } from '../lib/plan/invariants'
import { computeZones } from '../lib/plan/zones'
import { buildPaceFromVDOT } from '../lib/plan/paceBands'
import { bandForAnchors } from '../lib/plan/anchorBand'
import { catalogueRowFor } from '../lib/plan/catalogueLink'
import type { Session } from '@/types/plan'

// ⚠️ AN ODD STRIDE, AND THE DEFAULT IS 1. `cohortGrid` has 41,472 rows = 2^9 x 81, so ANY
// power-of-two stride aliases against its axes: stride 32 returned 1,260 plans of which **0**
// carried a VDOT, and the probe reported "0 of 7,185 sessions changed" about a sample in which
// the band could not be reached at all. Same class as the liveness harness's coprime stride.
const stride = Number(process.argv[2] ?? 1)
if (stride % 2 === 0) { console.error(`REFUSING stride ${stride}: even strides alias against cohortGrid's 2^9 x 81 axes. Use an odd stride.`); process.exit(2) }

// ── 1. the persona table, from the real producers ─────────────────────────────────────
console.log('\n── PERSONAS (re-derived; ADR-026 §4/§5 published these) ──')
for (const [maxHr, restingHr, vdot] of [[185, 48, 41.0], [190, 50, 44.6], [191, 60, 20.2], [190, 65, 16.2]] as const) {
  const z = computeZones(maxHr, restingHr)
  const r = { maxHr, restingHr, vdot }
  const T = bandForAnchors(['T'], r), CV = bandForAnchors(['CV'], r), I = bandForAnchors(['I'], r)
  // ⚠️ TWO ARGUMENTS: the DISCOUNTED anchor and the RAW VDOT (§10). The personas are stated as a
  // single figure in ADR-026 §4, so both are that figure — which is what the ADR's own table assumes.
  const p = buildPaceFromVDOT(vdot, vdot)
  console.log(`max ${maxHr} rest ${restingHr} VDOT ${vdot}`)
  console.log(`   T-pace ${p.qualityPaceStr}  was ${z.qualityZone} ${z.qualityHR}  ->  ${T?.zone} ${T?.hr}`)
  console.log(`   intervals            was ${z.intervalsZone} ${z.intervalsHR}  ->  ${I?.zone} ${I?.hr}`)
  console.log(`   CV ${CV?.lo}–${CV?.hi} · T ceiling ${T?.hi} vs I floor ${I?.lo} · easy ceiling ${z.zone2Ceiling}, T floor ${T?.lo} (clear by ${(T?.lo ?? 0) - (z.zone2Ceiling ?? 0)})`)
}

// ── 2/3/4. the corpus ─────────────────────────────────────────────────────────────────
const grid = cohortGrid().filter((_, i) => i % stride === 0)
let plans = 0, quality = 0, failed = 0, benchPlans = 0
let changed = 0, keptZoneTable = 0
const byRow = new Map<string, number>()
const newZones = new Map<string, number>()
const violations = new Map<string, number>()
// McMillan: the interval arm, separately.
let intervalSessions = 0, intervalChanged = 0
let thresholdSessions = 0, thresholdChanged = 0
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

for (const input of grid) {
  let plan
  try {
    const raw = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
  } catch (e) {
    // ⚠️ COUNTED, NOT SWALLOWED. A probe that drops the rows it cannot build reports a
    // confident 0 about a population it never saw — which is how the first cut of this script
    // reported "0 of 7,185 changed" while the band was working.
    if (!isDesignedRefusal(e)) { failed++; if (failed <= 3) console.error('UNEXPECTED:', (e as Error).message?.split('\n')[0]) }
    continue
  }
  plans++
  if (typeof plan.meta.vdot_training_anchor === 'number') benchPlans++
  for (const v of validatePlan(plan, input)) bump(violations, `${v.severity} ${v.code}`)
  const z = computeZones(plan.meta.max_hr as number, (plan.meta.resting_hr as number) || undefined)
  for (const w of plan.weeks) {
    for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
      if (!sn || sn.type !== 'quality' || typeof sn.hr_target !== 'string') continue
      quality++
      const row = catalogueRowFor(sn)
      const isInterval = row?.category === 'vo2max'
      if (isInterval) intervalSessions++; else thresholdSessions++
      // "unchanged" = it still carries one of the two zone-table pairs.
      const onTable = (sn.zone === z.qualityZone && sn.hr_target === z.qualityHR)
        || (sn.zone === z.intervalsZone && sn.hr_target === z.intervalsHR)
      if (onTable) { keptZoneTable++; continue }
      changed++
      if (isInterval) intervalChanged++; else thresholdChanged++
      bump(byRow, `${row?.id ?? '(no row)'} -> ${sn.zone}`)
      bump(newZones, String(sn.zone))
    }
  }
}

const pct = (n: number, d: number) => d === 0 ? 'n/a' : `${(100 * n / d).toFixed(1)}%`
console.log(`\n── CORPUS (stride ${stride}) ──`)
console.log(`${plans} plans (${benchPlans} with a training-anchor VDOT) · ${quality} quality sessions with an HR band · ${failed} UNEXPECTED generation failures`)
if (benchPlans === 0) { console.error('REFUSING: no plan in this sample carries a VDOT, so the band cannot be reached — the sample is the finding, not the result.'); process.exit(2) }
console.log(`NEW zone/HR: ${changed} (${pct(changed, quality)}) · kept the zone table: ${keptZoneTable} (${pct(keptZoneTable, quality)})`)
console.log(`\n── McMILLAN'S CONDITION: the two arms, SEPARATELY ──`)
console.log(`  interval  (category vo2max): ${intervalChanged} of ${intervalSessions} changed (${pct(intervalChanged, intervalSessions)})`)
console.log(`  threshold (everything else): ${thresholdChanged} of ${thresholdSessions} changed (${pct(thresholdChanged, thresholdSessions)})`)
console.log('\n── new zone strings ──')
for (const [k, n] of Array.from(newZones).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(12)} ×${n}`)
console.log('\n── by row (top 20) ──')
for (const [k, n] of Array.from(byRow).sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${k.padEnd(44)} ×${n}`)
console.log('\n── invariant violations ──')
if (violations.size === 0) console.log('  none')
for (const [k, n] of Array.from(violations).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(56)} ×${n}`)
