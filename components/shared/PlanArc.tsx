// PlanArc — Zona Phase 2 shared component
// Horizontal 32px progression strip showing plan weeks as bars.
// Done · Current · Future · Deload · Race week variants.
// See docs/canonical/ui-patterns.md § PlanArc.

type Props = {
  totalWeeks: number
  /** 1-indexed current week */
  currentWeek: number
  /** How many weeks behind currentWeek are done */
  doneWeeks: number
  /** 1-indexed week numbers that are deloads */
  deloadWeeks?: number[]
  /** 1-indexed race week number */
  raceWeek?: number
  /** Phase label string — e.g. "base → build → peak → taper" */
  phaseLabel?: string
}

export default function PlanArc({
  totalWeeks,
  currentWeek,
  doneWeeks,
  deloadWeeks = [],
  raceWeek,
  phaseLabel,
}: Props) {
  const deloadSet = new Set(deloadWeeks)

  return (
    <div>
      {/* Label row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          }}
        >
          Wk {currentWeek} of {totalWeeks}
        </span>
      </div>

      {/* Bar strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          height: '32px',
        }}
      >
        {Array.from({ length: totalWeeks }, (_, i) => {
          const weekN = i + 1
          const isDone = weekN < currentWeek && weekN <= doneWeeks
          const isCurrent = weekN === currentWeek
          const isRace = weekN === raceWeek
          const isDeload = deloadSet.has(weekN)
          const isFuture = weekN > currentWeek && !isRace

          // Colour logic
          let bg: string
          let opacity = 1

          if (isRace) {
            bg = 'var(--s-race)'
            opacity = 0.9
          } else if (isCurrent) {
            bg = 'var(--moss)'
            opacity = 1
          } else if (isDone) {
            bg = 'var(--moss)'
            opacity = isDeload ? 0.2 : 0.7
          } else if (isFuture) {
            bg = 'var(--mute-2)'
            opacity = isDeload ? 0.15 : 0.35
          } else {
            // Past but not tracked as done (edge: partial completions)
            bg = 'var(--moss)'
            opacity = 0.4
          }

          return (
            <div
              key={weekN}
              style={{
                flex: 1,
                height: '100%',
                borderRadius: '2px',
                background: bg,
                opacity,
                // Current week: subtle outline ring
                outline: isCurrent ? '2px solid var(--moss-mid)' : 'none',
                outlineOffset: isCurrent ? '1px' : '0',
                position: 'relative',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
