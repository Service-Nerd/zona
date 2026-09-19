/**
 * PLAN QUALITY — the single owner of "would a coach object to this plan?".
 *
 * ⚠️ EXTRACTED FROM `scripts/audit-plan-quality.ts`, NOT COPIED (2026-09-19).
 * These predicates were private to that script. `USE-CASE-ENVELOPE-01` needed
 * the same definition of "good" to answer "are 90-95% of use cases fit for
 * purpose", and writing a second set of criteria would have meant two answers
 * to one question drifting apart -- the failure class this repo has already
 * paid for in the deload cadence (five copies), the tier ladder (three) and
 * the session-distance expression (twenty). The audit script now imports this.
 *
 * ⚠️ MOST PREDICATES ARE DISTANCE-AGNOSTIC AND ONE IS NOT. `LONG-RUN-SHORT`
 * only fires at >= 42 km, because the bar it applies (55% of race distance) is
 * a marathon bar: a 5K plan's long run is routinely 200-300% of race distance
 * and the same rule would be nonsense. When the 90-95% target was extended to
 * every distance, that asymmetry became visible -- a short-race plan cannot
 * fail the long-run check at all, so its fit-for-purpose rate is measured
 * against one fewer criterion than the marathon's. Stated, not hidden.
 */

import { sessionKmSelfPaced } from './sessionDistance'
import { effectiveStartKm } from './startVolume'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput, Plan, Week, Session } from '@/types/plan'

// ── The predicates. Each one is "a coach would object to this". ─────────────
export interface Finding { code: string; detail: string }

const isTrainingWeek = (w: Week) =>
  w.n > 0 && w.type !== 'race' && w.phase !== 'foundation'
const runsIn = (w: Week) =>
  Object.values(w.sessions ?? {}).filter(
    (s): s is Session => !!s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train')
const kmsIn = (w: Week) => runsIn(w).map(s => sessionKmSelfPaced(s) ?? 0)

export function auditPlanQuality(plan: Plan, input: GeneratorInput): Finding[] {
  const f: Finding[] = []
  const weeks = plan.weeks.filter(isTrainingWeek)
  if (!weeks.length) return [{ code: 'NO-WEEKS', detail: 'plan has no training weeks' }]
  const loading = weeks.filter(w => w.type !== 'deload' && (w.phase === 'build' || w.phase === 'peak'))

  // P2 — the runner asked for N days. Did any loading week deliver fewer?
  const declared = input.days_available ?? 0
  const shortWeeks = loading.filter(w => runsIn(w).length < declared)
  if (shortWeeks.length) {
    const worst = Math.min(...shortWeeks.map(w => runsIn(w).length))
    f.push({ code: 'DAYS-SHORT', detail: `${shortWeeks.length} loading week(s) under ${declared} days, fewest ${worst}` })
  }

  // P3 — a loading week with <=2 runs is not a week a coach would write.
  const degenerate = loading.filter(w => runsIn(w).length <= 2)
  if (degenerate.length) f.push({ code: 'DEGENERATE-WEEK', detail: `${degenerate.length} loading week(s) with <=2 runs` })

  // P4 — a single session carrying most of the week (§52's own 60% cap).
  let worstShare = 0
  for (const w of weeks) {
    if (w.type === 'deload') continue   // §52's invariant exempts these; match it
    const k = kmsIn(w); if (!k.length || !w.weekly_km) continue
    worstShare = Math.max(worstShare, Math.max(...k) / w.weekly_km)
  }
  const shPct = Math.round(worstShare * 100)
  if (worstShare > G.LONG_RUN_MAX_PCT_OF_WEEKLY / 100 + 0.005)
    f.push({ code: shPct >= 75 ? 'BINGE-SEVERE-75' : 'BINGE-WEEK', detail: `worst single session is ${shPct}% of its week` })

  // P5 — does the plan BUILD? peak loading week vs week 1.
  const w1 = weeks.find(w => w.n === 1)?.weekly_km ?? 0
  const peak = Math.max(...weeks.filter(w => w.type !== 'deload').map(w => w.weekly_km ?? 0))
  if (w1 > 0 && peak / w1 < 1.10) f.push({ code: 'NEVER-BUILDS', detail: `peak ${Math.round(peak)} vs week 1 ${Math.round(w1)} (${((peak / w1 - 1) * 100).toFixed(0)}%)` })

  // P7 — week 1 must not be a leap from what the runner actually does.
  const start = effectiveStartKm(input)
  if (start > 0 && w1 / start > 1.30)
    f.push({ code: 'WEEK1-LEAP', detail: `week 1 is ${Math.round(w1)}km against a ${start}km base (+${((w1 / start - 1) * 100).toFixed(0)}%)` })

  // P6 — a marathon plan whose longest run never approaches the race.
  if (input.race_distance_km >= 42) {
    const peakLR = Math.max(0, ...weeks.filter(w => w.type !== 'deload').flatMap(kmsIn))
    if (peakLR < input.race_distance_km * 0.55)
      f.push({ code: 'LONG-RUN-SHORT', detail: `peak long run ${peakLR.toFixed(1)}km = ${(peakLR / input.race_distance_km * 100).toFixed(0)}% of race` })
  }

  // P8 — a plan whose volume never moves is not a plan, whatever it is called.
  const vols = weeks.filter(w => w.type !== 'deload').map(w => w.weekly_km ?? 0)
  if (vols.length > 4 && Math.max(...vols) - Math.min(...vols) < 2)
    f.push({ code: 'FLAT-CURVE', detail: `volume never moves (${Math.min(...vols)}-${Math.max(...vols)}km)` })

  return f
}
