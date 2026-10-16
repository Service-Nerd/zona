// ─── VDOT model (Jack Daniels) ────────────────────────────────────────────────
//
// BENCHMARK-IMPOSSIBLE-01 (2026-10-16) — moved verbatim out of `ruleEngine.ts`, which
// re-exports both. A pure module with no imports, so the benchmark plausibility check
// (`benchmarkCheck.ts`) can run in the browser as well as at the route, from ONE formula.

// Parse "H:MM:SS", "MM:SS", or "H:MM" → total minutes
export function parseBenchmarkTime(time: string): number {
  const parts = time.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60
  if (parts.length === 2) return parts[0] + parts[1] / 60
  return NaN
}

// Jack Daniels VDOT formula: VDOT from any race result
export function calcVDOT(distanceKm: number, timeMinutes: number): number {
  if (!Number.isFinite(timeMinutes) || timeMinutes <= 0) return NaN
  const v = (distanceKm * 1000) / timeMinutes  // metres per minute
  const utilization = 0.8
    + 0.1894393 * Math.exp(-0.012778 * timeMinutes)
    + 0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
  return vo2 / utilization
}
