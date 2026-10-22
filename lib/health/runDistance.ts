// UNMEASURED-DISTANCE-01 — the ONE owner of "how far was this run", for every consumer that may count a runner-reported
// distance (volume, load, display). Measured wins; a runner-reported value fills only a run the device left at nothing;
// otherwise the distance is unknown, never zero (HK-ZERO-DISTANCE-RUN-01).
//
// ⚠️ Fitness estimates (VDOT, race times, the wizard benchmark) must NOT call this: the Coaching Board ruled a typed
// treadmill distance can be 5–10% out. They read `distance_m` directly. `runDistance.test.ts` holds that line.
export interface RunDistanceRow {
  distance_m?: number | null
  reported_distance_m?: number | null
}

export interface RunDistance {
  km: number
  /** True when the runner typed it; the surface labels it ("you added this"). */
  reported: boolean
}

export function runDistance(row: RunDistanceRow | null | undefined): RunDistance | null {
  if (!row) return null
  const measured = Number(row.distance_m)
  if (Number.isFinite(measured) && measured > 0) return { km: measured / 1000, reported: false }
  const reported = Number(row.reported_distance_m)
  if (Number.isFinite(reported) && reported > 0) return { km: reported / 1000, reported: true }
  return null
}

/** Bounds for a runner-entered distance, in metres. Matches the column CHECK. */
export const REPORTED_DISTANCE_M = { min: 100, max: 200000 } as const
