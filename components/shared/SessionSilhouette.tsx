// SESSION-PRERUN-DETAIL-01 — the session silhouette (Design Board 2026-10-21, re-sat 2026-10-22). Width is minutes,
// height is the prescribed zone; the shape comes from `lib/plan/sessionSilhouette.ts`, the one owner.
//
// No labels and no axis: the section cards directly beneath already name the parts (Warm-up, Main set, Cool-down) and
// their minutes, so a label here would be the same word twice (Silvanto). Work steps carry the session colour; warm-up,
// cool-down and recovery the same colour at low opacity. Colour is data, never a fill on a card.

import type { SilhouetteSegment } from '@/lib/plan/sessionSilhouette'

const VIEW_W = 300
/** Tall enough to read four rep heights apart at 375 px; short enough not to grow the screen. */
export const SILHOUETTE_HEIGHT_PX = 40
const GAP = 1.5

export interface SessionSilhouetteProps {
  /** `sessionSilhouette(structure, derivedSet)`: minutes and zone level per segment. */
  segments: SilhouetteSegment[]
  /** `getSessionColor(session)`: a `var(--s-…)` token. */
  colour: string
  height?: number
}

export default function SessionSilhouette({ segments, colour, height = SILHOUETTE_HEIGHT_PX }: SessionSilhouetteProps) {
  const total = segments.reduce((a, s) => a + s.mins, 0)
  if (total <= 0) return null
  let x = 0
  return (
    <svg data-session-silhouette viewBox={`0 0 ${VIEW_W} ${height}`} width="100%" height={height} preserveAspectRatio="none"
      role="img" aria-label="The shape of this session: how long each part is and how hard" style={{ display: 'block' }}>
      {segments.map((s, i) => {
        const w = (s.mins / total) * VIEW_W
        const h = Math.max(3, (Math.min(5.5, s.level) / 5.5) * height)
        const rx = x
        x += w
        return <rect key={i} x={rx + GAP / 2} y={height - h} width={Math.max(1, w - GAP)} height={h} rx={2} fill={colour} fillOpacity={s.work ? 0.9 : 0.32} />
      })}
    </svg>
  )
}
