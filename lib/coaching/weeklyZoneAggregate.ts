// Single owner of "what did this week's heart rate actually look like".
//
// THE DUPLICATION THIS REPLACES. Three load-km-weighted aggregations over the
// same `run_analysis` rows lived in `DashboardClient.tsx`, and two of them were
// the SAME computation in different scopes, held in agreement by a comment:
//
//   ~2254  zoneDisciplinePercent   (Coach)   — "same formula as the TodayScreen
//                                              RestraintCard so the two surfaces
//                                              never disagree about the same week"
//   ~2275  zoneTimePctByZone       (ZoneRings) — "same load-km weighting as
//                                              zoneDisciplinePercent"
//   ~7024  zoneDisciplinePercent   (Today's RestraintCard)
//
// A comment is not a mechanism. This repo has watched the identical shape fail
// four times — the deload cadence in five places, tier resolution in three,
// `distance_km ?? 0` in twenty, and the display zone derived two ways. Each was
// correct until one copy moved.
//
// It matters more than usual here because the redesigned Coach screen leans on
// this number twice at once: Kit's read says "nine per cent of your week sat in
// Zone 3" and the ZoneRings draw that same nine per cent directly beneath it. If
// the sentence and the picture came from two formulas, they could contradict each
// other on the flagship paid screen.
//
// WEIGHTING. Every row is weighted by `actual_load_km`, falling back to 1 when
// absent — a run with no recorded distance still counts, as one kilometre's worth
// of evidence rather than none. That fallback is deliberate and was identical at
// all three sites; it is preserved here rather than "tidied" into a skip.
/**
 * A week's time split across the four zone buckets, as percentages.
 *
 * Defined HERE rather than in `ZoneRings` because it is a data shape, not a
 * component concern — and a `lib/` module importing from `components/` is the
 * wrong dependency direction. `ZoneRings` imports it back.
 */
export type ZoneSlice = { z1: number; z2: number; z3: number; z45: number }

/** One analysed run, reduced to what an aggregate needs. */
export interface WeightedAnalysisRow {
  /** `actual_load_km`, or 1 when the run recorded no distance. */
  weight: number
}

export interface DisciplineRow extends WeightedAnalysisRow {
  /** `hr_in_zone_pct` — % of the run inside its prescribed zone. */
  inZone: number
}

export interface ZoneSplitRow extends WeightedAnalysisRow {
  z1: number
  z2: number
  z3: number
  z45: number
}

/** `actual_load_km` → weight, with the shared fallback in ONE place. */
export function weightOf(actualLoadKm: number | null | undefined): number {
  return actualLoadKm ?? 1
}

/** Load-weighted mean. Returns null for an empty set — never 0, which would
 *  read as "perfectly out of zone" rather than "nothing to say yet". */
function weightedMean(values: number[], weights: number[]): number | null {
  if (values.length === 0) return null
  const totalW = weights.reduce((s, w) => s + w, 0)
  if (totalW <= 0) return null
  return values.reduce((s, v, i) => s + v * weights[i]!, 0) / totalW
}

/**
 * Zone discipline for a week: the load-weighted share of running that stayed
 * inside its prescribed zone.
 *
 * ROUNDED, because every consumer is a display. The un-rounded value has never
 * been used and rounding at the owner stops two surfaces rounding differently.
 */
export function zoneDiscipline(rows: DisciplineRow[]): { pct: number | null; hits: number } {
  const mean = weightedMean(rows.map(r => r.inZone), rows.map(r => r.weight))
  return { pct: mean == null ? null : Math.round(mean), hits: rows.length }
}

/**
 * The same week seen per zone, for the ZoneRings brand mark.
 *
 * NOT rounded: `ZoneRings` owns its own display rounding, and rounding four
 * shares independently here can make them sum to 99 or 101.
 */
export function zoneTimeSplit(rows: ZoneSplitRow[]): { split: ZoneSlice | null; hits: number } {
  if (rows.length === 0) return { split: null, hits: 0 }
  const w = rows.map(r => r.weight)
  const at = (k: keyof ZoneSlice) => weightedMean(rows.map(r => r[k]), w)
  const z1 = at('z1'), z2 = at('z2'), z3 = at('z3'), z45 = at('z45')
  if (z1 == null || z2 == null || z3 == null || z45 == null) return { split: null, hits: rows.length }
  return { split: { z1, z2, z3, z45 }, hits: rows.length }
}
