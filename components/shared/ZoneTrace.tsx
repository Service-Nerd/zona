// SESSION-SCREENS-WOW-01 — the Zone Trace (Design Board 2026-10-21: prototype, then build; location amended to
// `SessionCompleteCard`). The runner's own heart rate against the ceiling they were set.
//
// One band, one line, nothing else. Silvanto: "if it grows axes, legends and a key, it becomes a chart, and a chart is
// homework." So: the zone is a filled band in the session colour, the line is the session colour where the runner
// held it, `--zone-drifted` where they went over, `--zone-unknown` under a quality session's floor. A ceiling-only run
// (easy, long, recovery: §12) fills the band to the bottom, because everything under the ceiling is held.
//
// Colour is data here, never a fill on a card (*Type accent, not flood*, the veto sustained on W4). Every colour is a
// token; the OG share route draws the same shape with resolved values because next/og cannot read CSS variables.

import { thinTrace, type TraceBand, type TracePoint } from '@/lib/coaching/zoneTrace'

const VIEW_W = 300
const PAD = 4
/** The line's weight: thick enough to read at thumbnail size in a shared image. */
const LINE_PX = 2.25

export interface ZoneTraceProps {
  /** Smoothed points (`smoothTrace`). Thinned here for drawing. */
  points: TracePoint[]
  band: TraceBand
  ceilingOnly: boolean
  /** `getSessionColor(session)`: a `var(--s-…)` token. */
  colour: string
  height?: number
}

export default function ZoneTrace({ points, band, ceilingOnly, colour, height = 96 }: ZoneTraceProps) {
  const pts = thinTrace(points)
  if (pts.length < 2) return null
  const H = height
  const t0 = pts[0][0]
  const t1 = pts[pts.length - 1][0]
  const values = pts.map(p => p[1])
  const vMin = Math.min(band.lo - 18, ...values)
  const vMax = Math.max(band.hi + 12, ...values)
  const x = (t: number) => PAD + ((t - t0) / Math.max(1, t1 - t0)) * (VIEW_W - 2 * PAD)
  const y = (v: number) => PAD + (1 - (v - vMin) / (vMax - vMin)) * (H - 2 * PAD)
  const floor = ceilingOnly ? vMin : band.lo

  // Split the line into runs of one state, joined, so a colour change has no gap.
  const segs: { state: 'in' | 'over' | 'under'; pts: string }[] = []
  for (const [t, v] of pts) {
    const state = v > band.hi ? 'over' : v < floor ? 'under' : 'in'
    const p = `${x(t).toFixed(1)},${y(v).toFixed(1)}`
    const last = segs[segs.length - 1]
    if (!last || last.state !== state) {
      if (last) last.pts += ` ${p}`
      segs.push({ state, pts: p })
    } else last.pts += ` ${p}`
  }
  const stroke = { in: colour, over: 'var(--zone-drifted)', under: 'var(--zone-unknown)' } as const

  return (
    <svg
      data-zone-trace
      viewBox={`0 0 ${VIEW_W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Your heart rate against your ceiling of ${band.hi} beats per minute`}
      style={{ display: 'block' }}
    >
      <rect x={PAD} y={y(band.hi)} width={VIEW_W - 2 * PAD} height={Math.max(2, y(floor) - y(band.hi))} rx={4} fill={colour} fillOpacity={0.14} />
      <line x1={PAD} x2={VIEW_W - PAD} y1={y(band.hi)} y2={y(band.hi)} stroke={colour} strokeOpacity={0.55} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      {segs.map((s, i) => (
        <polyline key={i} points={s.pts} fill="none" stroke={stroke[s.state]} strokeWidth={LINE_PX}
          strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
