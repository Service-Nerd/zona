// PlanArc — the plan's shape, one bar per week.
// See docs/canonical/ui-patterns.md § PlanArc.
//
// ⚠️ IT WAS CALLED AN ARC AND IT DREW A STRAIGHT LINE (PLAN-ARC-V2,
// 2026-09-21). Every bar rendered at `height: '100%'`: week 1, peak week and
// the deload were identical rectangles, and the only difference between
// states was colour and opacity. The strip set `align-items: 'flex-end'` —
// a property that can only have an effect if something is SHORTER than full
// height, so it had never had one. `ui-patterns.md` §12 documented both
// halves without noticing they contradict. The shape was intended and never
// wired: the same declared-but-inert class as `--s-long`, D9's `flexShrink`
// and the decorative-config family.
//
// What the founder saw was "a bit flat", and it was flat in the literal
// sense. Sixteen identical blocks is a picture of sixteen identical weeks of
// effort — the grey middle, which is the thing this product exists to break.
//
// ⚠️ THE DOWN-WEEKS ARE THE MESSAGE, not the rising envelope (SLT
// 2026-09-21, Sutherland). Nobody reads a sawtooth as a trend line; they read
// the teeth. Deload notches and the taper are the app visibly making the
// runner do less, on a schedule they did not choose. Any future change that
// smooths, averages or de-emphasises the dips is working against the reason
// this component exists.
//
// ⚠️ SHAPE, NEVER COMPLETION (SLT 2026-09-21, Wood — binding). No cumulative
// total, no "N% through your plan", no emphasis on the peak week. The moment
// a number aggregates this becomes a progress bar, and a progress bar is
// illusion-of-progress. Guarded by `planArc.test.ts`.

type Props = {
  totalWeeks: number
  /** 1-indexed current week */
  currentWeek: number
  /** How many weeks behind currentWeek are done */
  doneWeeks: number
  /**
   * Training kilometres per week, in plan order, from
   * `lib/plan/weekVolume.ts → planArcSeries()`. REQUIRED: with two callers an
   * optional prop is a dead branch, and a silent flat fallback is how the
   * component came to lie about its own name in the first place.
   *
   * The bars map over THIS array, not over `totalWeeks`, so a length
   * mismatch is visible rather than padded away with a `?? 0` — which would
   * assert "this week covered no ground", the documented wrong answer.
   */
  weekKm: number[]
  /** 1-indexed race week number */
  raceWeek?: number
  /** Phase label string — e.g. "base → build → peak → taper" */
  phaseLabel?: string
}

/** Plot height. Tall enough that a deload at ~60% of peak reads as a notch
 *  (22px against 36px), short enough not to dominate a dense screen. */
const PLOT = 36

/** The shortest a bar may draw. ABSOLUTE, not a percentage of the peak: at a
 *  2px top radius a bar needs roughly this much height to read as a bar
 *  rather than a dash, and the strip doubles as a week counter — a bar that
 *  vanishes breaks the reader's ability to count along to "where am I". */
const MIN_BAR = 6

export default function PlanArc({
  totalWeeks,
  currentWeek,
  doneWeeks,
  weekKm,
  raceWeek,
  phaseLabel,
}: Props) {
  const peak = Math.max(...weekKm, 1)

  return (
    <div>
      {/* Label row. The left label can be long (a foundation or maintenance
          phase chain), so it truncates with an ellipsis and the "Wk X of Y"
          counter is pinned and never shrinks — the row can't push content off
          the edge. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {totalWeeks} weeks{phaseLabel ? ` · ${phaseLabel}` : ''}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--mute)',
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          Wk {currentWeek} of {totalWeeks}
        </span>
      </div>

      {/* The ridge. `flex-end` finally means something. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${PLOT}px` }}>
        {weekKm.map((km, i) => {
          const weekN = i + 1
          const isRace = weekN === raceWeek
          const isCurrent = weekN === currentWeek
          const isDone = weekN < currentWeek && weekN <= doneWeeks

          // Colour says WHEN, height says HOW MUCH. Deliberately no third
          // encoding: a recovery week is a short bar, which is what a
          // recovery week is, and knocking its opacity down as well would
          // make the notch fainter exactly where it matters most.
          let background: string
          let opacity = 1
          if (isRace) background = 'var(--s-race)'
          else if (isCurrent) background = 'var(--moss)'
          else if (isDone) { background = 'var(--moss)'; opacity = 0.55 }
          else background = 'var(--mute-2)'

          return (
            <div
              key={weekN}
              style={{
                flex: 1,
                height: `${Math.max(MIN_BAR, Math.round((km / peak) * PLOT))}px`,
                // Top corners only. A ridge stands on its axis; rounding the
                // bottom makes the bars float off it.
                borderRadius: '2px 2px 0 0',
                background,
                opacity,
              }}
            />
          )
        })}
      </div>

      {/* The axis. Continuous, so the ridge stands on something. */}
      <div style={{ height: '1px', background: 'var(--line)' }} />

      {/* "You are here", marked on the axis rather than around the bar. The
          old treatment was a 2px outline on the current bar, which was
          invisible at `--moss-mid` (10% alpha) and would now distort a short
          bar into a box. A tick under the axis needs no chrome and does not
          care how tall the week is. */}
      <div style={{ display: 'flex', gap: '2px', height: '2px' }}>
        {weekKm.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '100%',
              borderRadius: '0 0 1px 1px',
              background: i + 1 === currentWeek ? 'var(--moss)' : 'transparent',
            }}
          />
        ))}
      </div>
    </div>
  )
}
