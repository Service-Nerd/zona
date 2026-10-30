// RUNKED-LOAD-VIEW-01 — the load tile's record of the runner's own weeks (Design Board 2026-10-30, ui-patterns § the
// history row; SLT condition measured and met the same day: 5 of 6 Coach openers with 3+ weeks of runs see a verdict).
//
// A RECORD, not a forecast (UX-PROGRESS-01's kill is on a forward curve): one bar per 7-day window of TOTAL distance,
// the same windows the verdict reads (`computeLoadPicture`). The runner's normal is a band behind the bars, drawn from
// the same `LOAD_RATIO` edges as the track above. Only this week takes the verdict colour; past weeks are neutral and
// never emphasised (PlanArc's rule). A planned lighter week is marked, so a dip reads as on purpose. No line, no
// smoothing, no number per bar, no score. The founder chose bars over a line on 2026-10-30 for the same reason.

import { LOAD_RATIO } from '@/lib/coaching/constants'
import { LOAD_HISTORY_WEEKS } from '@/lib/coaching/loadPicture'
import { formatDistance } from '@/lib/format'

const BAR_HEIGHT_PX = 64
/** Headroom so the tallest bar and the top of the band never touch the edge. Display, not coaching. */
const HEADROOM = 1.1

export default function LoadHistory({ history, normalKm, thisWeekColor, units = 'km' }: {
  history: { km: number; plannedEasy: boolean }[]
  /** The ratio's denominator. The caller renders this only when there is a verdict. */
  normalKm: number
  /** The verdict's marker colour, from `loadRatioContext`, so bar and track agree. */
  thisWeekColor: string
  units?: 'km' | 'mi'
}) {
  const shown = history.slice(-LOAD_HISTORY_WEEKS)
  if (shown.length < 2) return null
  const top = Math.max(...shown.map(w => w.km), normalKm * LOAD_RATIO.watch) * HEADROOM
  const y = (km: number) => (km / top) * BAR_HEIGHT_PX
  const pad = LOAD_HISTORY_WEEKS - shown.length
  const anyPlanned = shown.some(w => w.plannedEasy)
  const label = `Total distance, last ${shown.length} weeks: ${shown
    .map((w, i) => `${formatDistance(w.km, units)}${w.plannedEasy ? ' (planned easy)' : ''}${i === shown.length - 1 ? ' this week' : ''}`)
    .join(', ')}`

  return (
    <div data-load-history style={{ marginTop: 'var(--space-5)' }}>
      <div role="img" aria-label={label} style={{ position: 'relative', height: `${BAR_HEIGHT_PX}px` }}>
        <div aria-hidden="true" data-normal-band style={{
          position: 'absolute', left: 0, right: 0, borderRadius: '2px', background: 'var(--bg-soft)',
          bottom: `${y(normalKm * LOAD_RATIO.under)}px`, height: `${y(normalKm * (LOAD_RATIO.watch - LOAD_RATIO.under))}px`,
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 'var(--space-1)', height: '100%' }}>
          {Array.from({ length: pad }, (_, i) => <div key={`pad${i}`} style={{ flex: 1 }} />)}
          {shown.map((w, i) => {
            const now = i === shown.length - 1
            return (
              <div key={i} data-bar={now ? 'now' : 'past'} style={{
                flex: 1, height: `${y(w.km)}px`, borderRadius: '3px',
                background: now ? thisWeekColor : 'var(--ink-2)', opacity: now ? 1 : 0.25,
              }} />
            )
          })}
        </div>
      </div>
      {anyPlanned && (
        <div aria-hidden="true" style={{ display: 'flex', gap: 'var(--space-1)', marginTop: 'var(--space-1)' }}>
          {Array.from({ length: pad }, (_, i) => <div key={`pad${i}`} style={{ flex: 1 }} />)}
          {shown.map((w, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.2 }}>
              {w.plannedEasy ? '▲' : ''}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>
        <span>{shown.length - 1} {shown.length - 1 === 1 ? 'week' : 'weeks'} ago{anyPlanned ? ' · ▲ planned easy week' : ''}</span>
        <span>This week</span>
      </div>
    </div>
  )
}
