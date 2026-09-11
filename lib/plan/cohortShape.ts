// COHORT-SHAPE-01 — what a change does to the SHAPE of a population of plans.
//
// THE GAP THIS CLOSES. The engine already has two regression harnesses and
// neither can see the failure that matters most:
//
//   `npm run verify`      proves plans are VALID    (0 invariant violations)
//   `npm run verify:parity` proves plans are UNCHANGED (byte-identical hashes)
//
// A plan can be perfectly valid, and a change can be a legitimate intended
// change (so parity is expected to differ), while silently reclassifying a
// whole cohort. That happened on 2026-09-11: extending §81's obligation to
// structured sessions took `volume_profile: 'maintenance'` from 20% to 80% of
// plans at a 30-minute weekday cap — a +60pp swing, the same magnitude the
// Coaching Board REJECTED on 2026-09-06 — and the suite stayed green through
// all of it. 16,038 plans, zero violations, nothing to see.
//
// So this measures the third question: **did the population change shape?**
// Rates and distributions, not validity and not identity. A move in any of them
// is not automatically wrong — it is automatically something that must be
// DECLARED, with a number, before it ships.

import type { Plan, GeneratorInput, Week } from '@/types/plan'
import { isLongRun } from './sessionRole'

export interface CohortShape {
  /** Inputs attempted, and how they resolved. A drop in `generated` is itself a
   *  finding — a grid that stops generating reports perfect rates for nothing. */
  attempted: number
  generated: number
  refused: number
  failed: number

  /** Classification rates, as a percentage of GENERATED plans. These are the
   *  numbers the Coaching Board weighs when it accepts or rejects a change. */
  maintenancePct: number
  constrainedByInputsPct: number
  volumeConstrainedPct: number
  timeCompressedPct: number
  /** A plan carrying any runner-facing constraint note. */
  constraintNotePct: number

  /** Prescription shape. */
  meanQualityPerBuildWeek: number
  plansWithNoQualityPct: number
  meanDeliveredPeakKm: number
  meanPlanWeeks: number
  earlyQualityOnsetPct: number

  /** Per-distance maintenance rate — an aggregate can hold steady while one
   *  distance swings hard, which is how a marathon-only regression hides. */
  maintenanceByDistance: Record<string, number>
}

const pct = (n: number, d: number) => d > 0 ? +(n / d * 100).toFixed(1) : 0
const mean = (a: number[]) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0

const deliveredKm = (w: Week) =>
  Object.values(w.sessions).reduce((a: number, s) => a + (s?.distance_km ?? 0), 0)

export interface CohortCase { input: GeneratorInput; plan: Plan | null; refused: boolean }

/** Reduce a set of generated plans to a comparable shape. Pure. */
export function summariseCohort(cases: CohortCase[]): CohortShape {
  const plans = cases.filter(c => c.plan).map(c => ({ plan: c.plan!, input: c.input }))
  const g = plans.length

  let maint = 0, constrained = 0, volConstrained = 0, timeCompressed = 0, note = 0
  let noQuality = 0, earlyOnset = 0
  const qualityPerWeek: number[] = []
  const peaks: number[] = []
  const weeks: number[] = []
  const byDistTotal: Record<string, number> = {}
  const byDistMaint: Record<string, number> = {}

  for (const { plan, input } of plans) {
    const meta = plan.meta as unknown as Record<string, unknown>
    const isMaint = meta.volume_profile === 'maintenance'
    if (isMaint) maint++
    if (meta.compression_classification === 'constrained_by_inputs') constrained++
    if (meta.volume_constrained) volConstrained++
    if (meta.time_compressed) timeCompressed++
    if (meta.volume_constraint_note) note++
    if (meta.early_quality_onset) earlyOnset++

    const key = String(input.race_distance_km)
    byDistTotal[key] = (byDistTotal[key] ?? 0) + 1
    if (isMaint) byDistMaint[key] = (byDistMaint[key] ?? 0) + 1

    const real = plan.weeks.filter(w => w.n >= 1)
    weeks.push(real.length)

    const buildWeeks = real.filter(w => w.phase === 'build')
    const qCount = buildWeeks.map(w =>
      Object.values(w.sessions).filter(s => s?.type === 'quality').length)
    if (qCount.length) qualityPerWeek.push(mean(qCount))

    if (real.every(w => Object.values(w.sessions).every(s => s?.type !== 'quality'))) noQuality++

    const nonTaper = real.filter(w => w.phase !== 'taper')
    if (nonTaper.length) peaks.push(Math.max(...nonTaper.map(deliveredKm)))
  }

  const maintenanceByDistance: Record<string, number> = {}
  for (const k of Object.keys(byDistTotal).sort()) {
    maintenanceByDistance[k] = pct(byDistMaint[k] ?? 0, byDistTotal[k])
  }

  return {
    attempted: cases.length,
    generated: g,
    refused: cases.filter(c => c.refused).length,
    failed: cases.filter(c => !c.plan && !c.refused).length,
    maintenancePct: pct(maint, g),
    constrainedByInputsPct: pct(constrained, g),
    volumeConstrainedPct: pct(volConstrained, g),
    timeCompressedPct: pct(timeCompressed, g),
    constraintNotePct: pct(note, g),
    meanQualityPerBuildWeek: mean(qualityPerWeek),
    plansWithNoQualityPct: pct(noQuality, g),
    meanDeliveredPeakKm: mean(peaks),
    meanPlanWeeks: mean(weeks),
    earlyQualityOnsetPct: pct(earlyOnset, g),
    maintenanceByDistance,
  }
}

/** Long-run share of the peak week — kept out of the summary deliberately: it is
 *  derived from `isLongRun`, and a change to THAT classifier would move the
 *  metric without the engine changing. Exported for ad-hoc use only. */
export function longRunShareOfPeak(plan: Plan): number {
  const real = plan.weeks.filter(w => w.n >= 1 && w.phase !== 'taper')
  if (!real.length) return 0
  const peak = real.reduce((a, b) => deliveredKm(a) > deliveredKm(b) ? a : b)
  const total = deliveredKm(peak)
  const lr = Object.values(peak.sessions).find(s => s && isLongRun(s))?.distance_km ?? 0
  return total > 0 ? +(lr / total * 100).toFixed(1) : 0
}
