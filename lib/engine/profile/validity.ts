// FREE — infrastructure. ADR027-B2-PROFILE. L1's validity bounds: one per numeric fact.
//
// 🔑 THESE ARE DATA-QUALITY BOUNDS, NOT COACHING NUMERICS, which is why they live here and not in
// `GENERATION_CONFIG`. They decide whether a stored value is a MEASUREMENT or junk (a resting HR of
// 0, a run of 0 m, a 6-second "run": data dictionary § 2.4), and turn junk into `null`. They do not
// change what the engine prescribes: in B2a the planner reads none of the facts they touch. If a
// later phase prescribes from an observed fact, the bound it reads becomes a coaching question and
// moves to `GENERATION_CONFIG` with a principle (INV-CFG, Coaching Board).
//
// ⚠️ Physiology reuses §55's ranges (`INPUT_FIELD_RANGES`) rather than holding a second copy: one
// bound per field, and the request validator still owns refusing on them.

import { INPUT_FIELD_RANGES } from '@/lib/plan/inputs'
import type { BenchmarkInput } from '@/types/plan'

export interface Bound { min: number; max: number }

export const VALIDITY = {
  age:            INPUT_FIELD_RANGES.age,
  resting_hr:     INPUT_FIELD_RANGES.resting_hr,
  max_hr:         INPUT_FIELD_RANGES.max_hr,
  /** One logged run. 100 m matches `REPORTED_DISTANCE_M.min`; 200 km covers every ultra. */
  run_km:         { min: 0.1, max: 200 },
  /** One logged run's moving time, seconds: a minute to 48 hours. */
  run_moving_s:   { min: 60, max: 172_800 },
  /** min/km. Faster than 2:30/km is not a human run; slower than 20:00/km is not a run. */
  run_pace_min_per_km: { min: 2.5, max: 20 },
  /** Session-completion RPE scale. */
  rpe:            { min: 1, max: 10 },
} as const satisfies Record<string, Bound>

/** A finite number inside the bound, else null. Absence and junk both become null. */
export function within(v: unknown, b: Bound): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n >= b.min && n <= b.max ? n : null
}

/** A benchmark `vdotFor` can be handed without throwing. `parseBenchmarkTime` calls `.split` on
 *  `time`, so a non-string time crashes it; that one case is treated as absent here and named in
 *  `data_quality`. Everything else (a NaN or non-positive result) stays `vdotFor`'s own decision. */
export function benchmarkUsable(b: BenchmarkInput | undefined | null): b is BenchmarkInput {
  return !!b && typeof b.time === 'string'
}
