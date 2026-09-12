'use client'

// The line between the two numbers (UX-COACH-01 follow-up).
//
// The card already says "151 → 144". This says whether that was a steady drift
// or a spike and a recovery, which is the part a runner actually reads a trend
// for. Geometry — including the two honesty rules, elapsed-time spacing and no
// interpolation across a missing month — belongs to
// `lib/coaching/trendSparkline.ts` and is unit-tested there.

import { sparklinePath, type TrendSparkline as Spark } from '@/lib/coaching/trendSparkline'

// Fixed viewBox, rendered at width:100%. The mockup had this inline beside the
// numbers at ~108px wide; at 375pt that squeezed two 44px metrics and gave six
// months about 20px each. Full width under the pair is the same idea with
// enough resolution to actually show a shape, and the two end dots then line up
// under the two numbers they belong to.
const W = 280
const H = 44
/** Keeps the 3px end dot and the 2px stroke inside the box at both extremes. */
const PAD = 5

export function TrendSparkline({
  spark,
  improving,
  runNoun,
}: {
  spark: Spark
  /** Lower HR at the same pace is fitter, so a FALLING line is the good one. */
  improving: boolean
  /** For the accessible description, e.g. 'easy run'. */
  runNoun: string
}) {
  const innerW = W - PAD * 2
  const innerH = H - PAD * 2
  const d = sparklinePath(spark, innerW, innerH)
  // Moss is earned, not decorative. A rising easy HR is not a failure and never
  // gets --danger (errors only, never training UI) — it goes quiet instead.
  const stroke = improving ? 'var(--moss)' : 'var(--mute)'

  const first = spark.points[0]
  const last = spark.last

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={
        `Average ${runNoun} heart rate across ${spark.points.length} months: ` +
        `${spark.points.map(p => `${p.label} ${p.value}`).join(', ')}.`
      }
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <g transform={`translate(${PAD} ${PAD})`}>
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Where it started: hollow and quiet, so the eye lands on the end. */}
        <circle
          cx={first.x * innerW}
          cy={first.y * innerH}
          r={2.5}
          fill="var(--card)"
          stroke={stroke}
          strokeWidth={1.5}
          opacity={0.55}
        />
        {/* Where it is now. */}
        <circle cx={last.x * innerW} cy={last.y * innerH} r={3} fill={stroke} />
      </g>
    </svg>
  )
}
