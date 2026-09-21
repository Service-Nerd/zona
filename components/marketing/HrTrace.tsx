/**
 * DESIGN-V3 — the post-run heart-rate trace. Shared: the hero uses it large,
 * the "four easy runs" strip uses it mini, and it is the same component.
 *
 * ── THE NUMBER AND THE DRAWING HAVE TO AGREE ──────────────────────────────
 *
 * The card says "14 minutes above your ceiling" and Kit says the same figure
 * in a sentence. The shaded area is the visual claim behind both, so it has
 * to be the same claim.
 *
 * ⚠️ IN THE HANDOFF IT WAS NOT. Measuring the authored path against the
 * ceiling: it sits above y=120 from x=197.4 to x=447.7, which is 250 of the
 * 560 units between the 0 km and 8 km ticks — **44.7% of the run, about 25
 * minutes of a 55-minute 8 km easy run, not 14.** The drawing said one thing
 * and the copy said another, by a factor of nearly two.
 *
 * The copy is the half that is right. 25 minutes above the ceiling on an easy
 * run is not "bit keen", it is a tempo run, and Kit's line would be wrong
 * about the session as well as the number. So the PATH was re-cut to make the
 * breach 25.45% of the run — 14.0 minutes — while keeping the gesture and the
 * depth (it still dives 48 units above the ceiling, so the amber reads).
 *
 * `lib/marketing/hrTraceGeometry.test.ts` re-measures the committed path and
 * fails if it stops matching `BREACH_MINUTES`. The number is authored once, in
 * `heroTraceCopy.ts`, and the test is what keeps the drawing honest about it.
 */

export const TRACE_VIEWBOX = { x0: 20, x1: 580, ceilingY: 120 } as const

/** The keen run: above the ceiling for 14 of its 55 minutes. */
export const KEEN_PATH =
  'M20,200 C55,188 88,168 120,158 C152,148 182,146 214,138 ' +
  'C238,132 254,96 286,78 C310,69 330,70 352,82 ' +
  'C372,93 378,130 408,138 C430,143 452,146 472,148 C505,151 538,154 580,156'

/** The held run: never crosses the ceiling. */
export const HELD_PATH =
  'M20,206 C55,198 85,182 115,174 C150,166 172,172 202,164 ' +
  'C232,156 252,152 277,158 C302,164 322,160 347,163 ' +
  'C372,167 392,161 412,166 C434,170 452,164 472,168 C505,172 538,168 580,172'

/** Where each path ends, for the end dot. */
const KEEN_END = { cx: 580, cy: 156 }
const HELD_END = { cx: 580, cy: 172 }

export function HrTrace({
  phase,
  drawn,
  mini = false,
  ticks = false,
  idSuffix = '',
}: {
  /** 0 = keen (amber breach), 1 = held. Owned by the parent so the verdict
   *  number and Kit's sentence stay in step with the curve. */
  phase: 0 | 1
  /** Drives the stroke draw-in. The parent sets it after mount, or
   *  immediately under reduced motion. */
  drawn: boolean
  /** Thicker strokes and a coarser ceiling dash, so the breach still reads at
   *  ~140px wide. No ceiling label, no ticks. */
  mini?: boolean
  ticks?: boolean
  /** The clip path needs a document-unique id: the hero and the four mini
   *  traces are all on the page at once, and a duplicated id makes every
   *  later instance clip against the first one's rect. */
  idSuffix?: string
}) {
  const clipId = `hr-above-ceiling${idSuffix}`
  const keen = phase === 0
  const strokeW = mini ? 7 : 3
  const dotR = mini ? 9 : 5

  return (
    <div style={{ width: '100%' }}>
      {/* ⚠️ The ceiling label is positioned against THIS box, which holds the
          svg and nothing else. It used to sit in a wrapper that also held the
          ticks row, so its percentage was a fraction of svg-plus-ticks and the
          label landed on the ceiling line at phone widths. */}
      <div style={{ position: 'relative', width: '100%' }}>
      <svg
        // The original viewBox left 30 units of headroom above a curve that
        // peaked at y=60. The re-cut path peaks at y=72, so the same window
        // would leave 42 and the card would read sparse at full width. Shifted
        // down 12 to restore the design's proportion to its own curve.
        viewBox="0 42 600 178"
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId}>
            {/* Everything ABOVE the ceiling. The breach fill is the whole
                closed path; this is what makes only the part that breached
                show, rather than shading the entire area under the curve. */}
            <rect x="0" y="0" width="600" height={TRACE_VIEWBOX.ceilingY} />
          </clipPath>
        </defs>

        {/* Amber breach */}
        <g style={{ opacity: keen ? 1 : 0, transition: `opacity var(--motion-crossfade)` }}>
          <path
            d={`${KEEN_PATH} L580,220 L20,220 Z`}
            fill="var(--warn)"
            fillOpacity={0.22}
            clipPath={`url(#${clipId})`}
          />
        </g>

        {/* The ceiling itself */}
        <line
          x1="16" y1={TRACE_VIEWBOX.ceilingY} x2="584" y2={TRACE_VIEWBOX.ceilingY}
          stroke={mini ? 'var(--mute)' : 'var(--mute-2)'}
          strokeWidth={mini ? 5 : 1.5}
          strokeDasharray={mini ? '10 14' : '4 7'}
        />

        {/* Keen */}
        <g style={{ opacity: keen ? 1 : 0, transition: `opacity var(--motion-crossfade)` }}>
          <path
            d={KEEN_PATH} fill="none" stroke="var(--ink-2)" strokeWidth={strokeW}
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1200}
            style={{ strokeDashoffset: drawn ? 0 : 1200, transition: `stroke-dashoffset var(--motion-draw)` }}
          />
          <circle
            cx={KEEN_END.cx} cy={KEEN_END.cy} r={dotR} fill="var(--ink-2)"
            style={{ opacity: drawn ? 1 : 0, transition: 'opacity var(--motion-verdict) 0.7s' }}
          />
        </g>

        {/* Held */}
        <g style={{ opacity: keen ? 0 : 1, transition: `opacity var(--motion-crossfade)` }}>
          <path
            d={HELD_PATH} fill="none" stroke="var(--moss)" strokeWidth={strokeW}
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1200}
            style={{ strokeDashoffset: drawn ? 0 : 1200, transition: `stroke-dashoffset var(--motion-draw)` }}
          />
          <circle
            cx={HELD_END.cx} cy={HELD_END.cy} r={dotR} fill="var(--moss)"
            style={{ opacity: drawn ? 1 : 0, transition: 'opacity var(--motion-verdict) 0.7s' }}
          />
        </g>
      </svg>

      {!mini && (
        <div style={{
          position: 'absolute', left: 0,
          // Anchored to the CEILING, not to a fraction of the box. The line
          // sits at y=120 in a viewBox running 42..220, so it is 43.8% down;
          // the label is lifted clear of it by its own line-height. A fixed
          // 33% put the label on top of the curve as soon as the SVG got
          // short, which is every phone.
          top: `calc(${((TRACE_VIEWBOX.ceilingY - 42) / 178 * 100).toFixed(1)}% - 2.2em)`,
          fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--mute)',
        }}>
          Ceiling 145 bpm
        </div>
      )}
      </div>

      {!mini && ticks && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', marginTop: 10,
          fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--mute)', fontVariantNumeric: 'tabular-nums',
        }}>
          <span>0 km</span><span>4 km</span><span>8 km</span>
        </div>
      )}
    </div>
  )
}
