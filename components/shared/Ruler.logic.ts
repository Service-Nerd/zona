// Ruler — pure logic (no JSX/React), node-testable (see vitest.config.ts scope).
// The .tsx presentation layer imports from here; Ruler.test.ts tests it directly.
//
// The Ruler collects a bounded, stepped numeric (weekly volume, longest run).
// Board ruling 2026-08-30 (CORRECT WITH AMENDMENT): the value is stepped, not
// per-unit — a self-reported estimate, not false precision. These helpers own
// the clamp + snap that guarantee every committed value is a valid step in range.

export interface RulerTick { h: 1 | 2 | 3 }

/** Clamp v into [min, max]. */
export function clampToRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/**
 * Snap v to the nearest step measured from min, then clamp to [min, max].
 * Every value the Ruler commits passes through here — the amendment's
 * "stepped, not per-unit" guarantee lives in this one function.
 */
export function snapToStep(v: number, min: number, max: number, step: number): number {
  if (step <= 0) return clampToRange(v, min, max)
  const snapped = min + Math.round((v - min) / step) * step
  // Guard float drift (e.g. 0.1 + 0.2) so a "5-step" value is exactly on-grid.
  const rounded = Math.round(snapped * 1e6) / 1e6
  return clampToRange(rounded, min, max)
}

/** Thumb position as 0–100% of the track for value v across [min, max]. */
export function thumbPercent(v: number, min: number, max: number): number {
  if (max <= min) return 0
  return clampToRange(((v - min) / (max - min)) * 100, 0, 100)
}

/**
 * Map a 0–1 track fraction (from a pointer's x within the track) to a snapped,
 * in-range value. `frac` is clamped, so a drag past either end pins to min/max.
 * This is the touch/mouse drag path — a native range input's thumb is unreliable
 * on iOS (zero-size thumb, no tap-to-jump), so the Ruler drives the value itself.
 */
export function valueFromFraction(frac: number, min: number, max: number, step: number): number {
  const f = clampToRange(frac, 0, 1)
  return snapToStep(min + f * (max - min), min, max, step)
}

/**
 * Decorative tick heights across the track. `count` evenly-spaced ticks; every
 * `majorEvery`-th is tall (h3), the mid-point between majors is medium (h2),
 * the rest short (h1) — the mockup's h3,h1,h2,h1 rhythm. Purely visual: the
 * real control is the range input, so ticks need not map 1:1 to steps.
 */
export function makeTicks(count: number, majorEvery: number): RulerTick[] {
  const mid = Math.floor(majorEvery / 2)
  return Array.from({ length: Math.max(0, count) }, (_, i): RulerTick => {
    if (majorEvery > 0 && i % majorEvery === 0) return { h: 3 }
    if (majorEvery > 0 && i % majorEvery === mid) return { h: 2 }
    return { h: 1 }
  })
}

/** `count` axis labels evenly spaced from min to max inclusive, integer-rounded. */
export function scaleLabels(min: number, max: number, count: number): number[] {
  if (count <= 1) return [min]
  return Array.from({ length: count }, (_, i) =>
    Math.round(min + ((max - min) * i) / (count - 1)),
  )
}
