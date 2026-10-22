// CD-1-MILE-CRUISE-01 — board evidence: do `tempo_cruise` (10′ at T / 2′ jog) and `threshold_mile_repeats` (1600 m at T
// / 90 s jog) reach the SAME runner, and how much of their threshold work do they carry?
//
//   npx tsx scripts/board-evidence-cruise-mile.ts [--stride N]
//
// Read only. The session silhouette drew the two identically on the harness plan (SESSION-PRERUN-DETAIL-01); this asks
// whether that is a pair a runner actually meets, before the board rules on whether it is one session or two.
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'

const sa = process.argv.indexOf('--stride')
const STRIDE = sa > -1 ? Number(process.argv[sa + 1]) : 17
const CRUISE = 'tempo_cruise', MILE = 'threshold_mile_repeats'

let plans = 0, withCruise = 0, withMile = 0, both = 0, thresholdSlots = 0, cruiseSlots = 0, mileSlots = 0
const byDist: Record<string, [number, number]> = {}
const repMins: number[] = []
const inputs = cohortGrid()
for (let i = 0; i < inputs.length; i += STRIDE) {
  const input = inputs[i] as any
  let p: any
  try { p = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
  if (!p?.weeks?.length) continue
  plans++
  let c = 0, m = 0
  for (const w of p.weeks) for (const s of Object.values(w.sessions ?? {}) as any[]) {
    if (!s?.catalogue_id) continue
    if (String(s.catalogue_id).startsWith('tempo') || String(s.catalogue_id).startsWith('threshold') || s.catalogue_id === 'cv_intervals') thresholdSlots++
    if (s.catalogue_id === CRUISE) { c++; cruiseSlots++ }
    if (s.catalogue_id === MILE) {
      m++; mileSlots++
      const work = s.derived_set?.blocks?.flatMap((b: any) => b.steps).find((x: any) => x.role === 'work')
      const pace = /(\d+):(\d+)/.exec(String(work?.pace ?? s.pace_target ?? ''))
      if (pace) repMins.push((1.6 * (Number(pace[1]) * 60 + Number(pace[2]))) / 60)
    }
  }
  if (c) withCruise++
  if (m) withMile++
  if (c && m) { both++; const k = String(input.race_distance_km); byDist[k] = byDist[k] ?? [0, 0]; byDist[k][0]++ }
  const k = String(input.race_distance_km); byDist[k] = byDist[k] ?? [0, 0]; byDist[k][1]++
}
if (plans === 0) { console.error('REFUSING TO REPORT: 0 plans'); process.exit(2) }
const pct = (a: number, b: number) => `${(100 * a / b).toFixed(1)}%`
console.log(`plans ${plans} (stride ${STRIDE})`)
console.log(`with Cruise ${withCruise} · with Mile ${withMile} · BOTH ${both} (${pct(both, plans)})`)
console.log(`threshold-family slots ${thresholdSlots} · Cruise ${cruiseSlots} (${pct(cruiseSlots, thresholdSlots)}) · Mile ${mileSlots} (${pct(mileSlots, thresholdSlots)})`)
console.log('both, by race km [both, plans]:', byDist)
if (repMins.length) { repMins.sort((a, b) => a - b); console.log(`mile rep at T, minutes: min ${repMins[0].toFixed(1)} · median ${repMins[Math.floor(repMins.length / 2)].toFixed(1)} · max ${repMins[repMins.length - 1].toFixed(1)}`) }
