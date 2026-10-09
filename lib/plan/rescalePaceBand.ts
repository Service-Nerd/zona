/**
 * Rescale a pace band string by a factor, PRESERVING ITS FORM.
 *
 * ⚠️ WHY SCALING RATHER THAN RECOMPUTING. The first cut of the recalibration
 * re-priced a session by recomputing its header through `qualityHeaderPace`
 * with no rep plan — which is a legitimate branch, and the wrong one here. It
 * produced a header in a DIFFERENT FORM from the one generation wrote (the
 * step's own band instead of the rep plan's ±2% mean, or the category band
 * instead of §85's time-weighted mean), so recalibrating a runner to the
 * benchmark they already had introduced **72 new invariant violations across
 * 36 plans** — `INV-PLAN-DISPLAY-ZONE-MATCHES-WORK` 45 times and
 * `INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD` 18. **A no-op recalibration must be
 * a no-op**, and recomputing cannot guarantee that because the recomputation
 * does not have the inputs the original had.
 *
 * Scaling does, by construction: at `factor === 1` the string is returned
 * unchanged, so an unchanged fitness yields a byte-identical plan. Width,
 * shape and separator all survive, which is what keeps §85's mean near
 * threshold and the displayed zone matching the work.
 *
 * Handles every form the engine emits for a pace: a range (`5:11–5:26 /km`), a
 * ramp (`5:58 → 5:12 /km`) and a point (`4:30 /km`), by rewriting each `mm:ss`
 * token in place and leaving every other character alone.
 */
export function rescalePaceBand(band: string, factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return band
  return band.replace(/(\d+):(\d{2})/g, (_m, mins: string, secs: string) => {
    const scaled = Math.round((Number(mins) * 60 + Number(secs)) * factor)
    const m = Math.floor(scaled / 60)
    return `${m}:${String(scaled - m * 60).padStart(2, '0')}`
  })
}

/** The mean of every `mm:ss` token in a band, in seconds. Null if it has none. */
export function paceBandCentreSecs(band: string | null | undefined): number | null {
  if (!band) return null
  const secs = Array.from(band.matchAll(/(\d+):(\d{2})/g))
    .map(m => Number(m[1]) * 60 + Number(m[2]))
  if (secs.length === 0) return null
  return secs.reduce((a, b) => a + b, 0) / secs.length
}
