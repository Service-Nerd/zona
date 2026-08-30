// WheelPicker — pure logic (no JSX/React), node-testable (see vitest.config.ts).
// The scroll↔value↔index math the .tsx wheel relies on; the DOM scroll wiring
// stays in the component, but every number that decides the selected value comes
// through here so it can be tested without a browser.

/** Inclusive numeric range [min, max] by step (e.g. minutes 0..59). */
export function buildRange(min: number, max: number, step = 1): number[] {
  const out: number[] = []
  if (step <= 0) return [min]
  for (let v = min; v <= max; v += step) out.push(v)
  return out
}

/** Clamp an index into a list of length `len`. */
export function clampIndex(i: number, len: number): number {
  if (len <= 0) return 0
  return Math.max(0, Math.min(len - 1, i))
}

/** Index of `value` in `values`, or the nearest index if it isn't present. */
export function valueToIndex(values: readonly number[], value: number): number {
  const exact = values.indexOf(value)
  if (exact >= 0) return exact
  let best = 0
  let bestD = Infinity
  values.forEach((v, idx) => {
    const d = Math.abs(v - value)
    if (d < bestD) { bestD = d; best = idx }
  })
  return best
}

/** The row the wheel has settled on for a given scrollTop and row height. */
export function nearestIndexForScroll(scrollTop: number, rowHeight: number, len: number): number {
  if (rowHeight <= 0) return 0
  return clampIndex(Math.round(scrollTop / rowHeight), len)
}

/** scrollTop that centres row `index`. */
export function scrollTopForIndex(index: number, rowHeight: number): number {
  return index * rowHeight
}
