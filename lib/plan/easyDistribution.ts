// EASY-DISTRIBUTION-OWNER-01 (2026-10-03) — extracted from `ruleEngine.ts` so the
// FOUNDATION block can use the same water-filling the main plan uses, rather than a
// second implementation of it.
//
// ⚠️ EXTRACTED, NOT REWRITTEN. This repo's most expensive defects are duplicates that
// drifted — the deload cadence in five places, the tier order in three, `sumWeeklyKm`
// written out by hand in six. `FOUNDATION-BUDGET-01` needs per-day easy sizing and the
// engine already had it; a copy would have been the same mistake with a new name.
//
// The move is proven by `verify:parity`: identical over 6,066 cases, and the 572-plan
// control cohort in `partition:foundation` byte-identical.

/**
 * UX-WIZARD-01 Stage B — REDISTRIBUTION. Distribute a fixed easy-volume pool
 * across the week's easy days weighted by each day's ceiling, so roomy days
 * absorb what tight days cannot hold instead of that volume being trimmed away.
 *
 * Water-filling, not proportional: the pool fills the lowest days first, so a
 * tight day sits at its ceiling and the surplus flows to days with room — which
 * is the whole point (Tuesday 30 caps out; Thursday 90 takes the rest). The
 * WEEKLY TOTAL is preserved (§2 curve unchanged); any residual that no day can
 * hold is un-fittable and the week honestly runs under, exactly as today. Each
 * ceiling already folds in §9's long-vs-easy cap, so no easy run can reach the
 * long run. Returns one km per input day, precision-rounded and clamped under
 * its ceiling so rounding can never lift a day over its budget or the §9 cap.
 */
export function waterFillEasyKm(ceils: number[], total: number, floorKm: number, precision: number): number[] {
  const n = ceils.length
  if (n === 0) return []
  // Base everyone at the floor (a placed easy run is never below MIN_SESSION;
  // the §82 floor-protection in applyWeekdayMinsCap owns the sub-budget case).
  const assign = ceils.map(() => floorKm)
  let remaining = total - floorKm * n
  for (let guard = 0; guard < n + 2 && remaining > 1e-6; guard++) {
    const active = assign.map((a, i) => (a < ceils[i] - 1e-9 ? i : -1)).filter(i => i >= 0)
    if (active.length === 0) break
    const share = remaining / active.length
    let moved = 0
    for (const i of active) {
      const add = Math.min(share, ceils[i] - assign[i])
      assign[i] += add
      moved += add
    }
    remaining -= moved
    if (moved <= 1e-9) break
  }
  return assign.map((a, i) => {
    const rounded = Math.round(a / precision) * precision
    const ceilRounded = Math.floor(ceils[i] / precision) * precision
    return Math.max(floorKm, Math.min(rounded, ceilRounded))
  })
}
