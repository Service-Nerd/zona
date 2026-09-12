// Trend sparkline geometry — the shape between the two numbers.
//
// UX-COACH-01 follow-up. The founder recognised this from a mockup: "there was
// a graph which showed a line. I like that." It was a small moss line on the
// easy-run trend card, with a dot on the latest point.
//
// THE DATA WAS ALREADY THERE. `/api/coaching/trend` returns the full monthly
// bucket series, and the Coach screen read `buckets[0]` and `buckets[last]` and
// dropped everything between them. The card could say "151 → 144" but not
// whether that was a steady drift or a spike and a recovery, which is the only
// interesting question about a trend.
//
// Pure and separately tested because the two honesty decisions here are easy to
// get wrong silently: a missing month must not be drawn as if it were adjacent
// to its neighbours, and two points must not be dressed up as a trend line.

/** The bucket shape `/api/coaching/trend` returns, narrowed to what a line needs. */
export interface SparkBucket {
  /** 'YYYY-MM' — the x axis is derived from this, never from array position. */
  monthKey: string
  shortLabel: string
  avgHr: number | null
}

export interface SparkPoint {
  /** 0–1, left to right, PROPORTIONAL TO ELAPSED TIME. */
  x: number
  /** 0–1, top to bottom. Higher value sits higher, so a falling HR falls. */
  y: number
  value: number
  label: string
}

export interface TrendSparkline {
  points: SparkPoint[]
  /** Last point, for the emphasis dot. */
  last: SparkPoint
  /** Signed change across the plotted series. Negative = fell. */
  delta: number
}

/**
 * Minimum plotted points before a line earns its place.
 *
 * Two points are a straight segment between numbers the card already shows in
 * 44pt type. Drawing it adds no information and implies a continuity the data
 * has not demonstrated — the exact overclaim §44.1 is about.
 */
export const SPARKLINE_MIN_POINTS = 3

function monthIndex(monthKey: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey)
  if (!m) return null
  const year = Number(m[1])
  const mon = Number(m[2])
  if (mon < 1 || mon > 12) return null
  return year * 12 + (mon - 1)
}

/**
 * Normalise a bucket series into 0–1 space. Returns `null` when there is not
 * enough to draw honestly.
 *
 * TWO RULES, both about not implying more than the data says:
 *
 * 1. **x is elapsed time, not array position.** A runner who logged in April
 *    and then not again until August must see that gap as a long flat stretch,
 *    not as one step identical to April→May. Buckets are already sparse by
 *    construction: `buildHrTrendSeries` drops any month below
 *    MIN_RUNS_PER_BUCKET, so missing months are normal, not exceptional.
 *
 * 2. **Buckets with no usable value are dropped, not interpolated.** Since the
 *    HR plausibility gate landed, `avgHr` is null whenever a month held nothing
 *    a human produced while running. Joining across that gap is fine — rule 1
 *    makes the span visibly wider — but inventing a midpoint is not.
 */
export function buildTrendSparkline(buckets: SparkBucket[] | null | undefined): TrendSparkline | null {
  if (!buckets?.length) return null

  const usable = buckets
    .map(b => ({ b, idx: monthIndex(b.monthKey) }))
    .filter((e): e is { b: SparkBucket; idx: number } =>
      e.idx !== null && typeof e.b.avgHr === 'number' && Number.isFinite(e.b.avgHr))
    .sort((a, z) => a.idx - z.idx)

  if (usable.length < SPARKLINE_MIN_POINTS) return null

  const firstIdx = usable[0].idx
  const lastIdx  = usable[usable.length - 1].idx
  const months   = lastIdx - firstIdx
  // Every plotted point in the same month would stack them all at x=0.
  if (months <= 0) return null

  const values = usable.map(e => e.b.avgHr as number)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min

  const points: SparkPoint[] = usable.map(({ b, idx }) => ({
    x: (idx - firstIdx) / months,
    // A genuinely flat series sits on the centre line rather than dividing by
    // zero or pinning to an edge, which would read as a dramatic high or low.
    y: span === 0 ? 0.5 : 1 - ((b.avgHr as number) - min) / span,
    value: b.avgHr as number,
    label: b.shortLabel,
  }))

  return {
    points,
    last: points[points.length - 1],
    delta: values[values.length - 1] - values[0],
  }
}

/** SVG path `d` for the series, scaled into a `width` × `height` box. */
export function sparklinePath(spark: TrendSparkline, width: number, height: number): string {
  return spark.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * width).toFixed(2)} ${(p.y * height).toFixed(2)}`)
    .join(' ')
}
