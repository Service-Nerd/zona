// COACH-EFFORT-PICTURE-01 — every run, by where its time went (Coaching Board §132, Design Board ideas sitting
// 2026-10-31, founder picked option A: date order).
//
// One column per run, oldest left, this week right, each filled bottom to top with its time in Zones 1, 2, 3 and 4–5
// (the rings' colours). A run that spent most of its time in Zone 3 carries a dot underneath and is the count in the
// headline. A split (interval-shaped) run and a run that completed a planned hard session never do (§132): the engine
// prescribes Zone 3 for tempo. The picture names no pattern and claims no intent for an unlinked run; that is Kit's job.
//
// A record, like the load bars: no line, no target, no colour verdict on the count. Below `COACH_EFFORT_MIN_RUNS` runs
// with a split the card is not drawn (empty means calm).

import { MICRO_LABELS } from '@/components/shared/microLabels'
import { formatDate } from '@/lib/format'
import { COACH_EFFORT_MIN_RUNS } from '@/lib/coaching/constants'
import type { EffortRun } from '@/lib/coaching/runEffort'

const COLUMN_HEIGHT_PX = 96
// Bottom to top, the rings' zone colours (ZoneRings `ZONE_COLORS`).
const LAYERS: { key: 'z1' | 'z2' | 'z3' | 'z45'; fill: string; label: string }[] = [
  { key: 'z1', fill: 'var(--s-recov)', label: 'Z1' },
  { key: 'z2', fill: 'var(--s-easy)', label: 'Z2 easy' },
  { key: 'z3', fill: 'var(--s-quality)', label: 'Z3' },
  { key: 'z45', fill: 'var(--s-inter)', label: 'Z4–5' },
]

export function effortHeadline(grey: number, total: number): string {
  if (grey === 0) return `None of your ${total} runs spent most of their time in Zone 3.`
  return grey === 1
    ? `1 of your ${total} runs spent most of its time in Zone 3.`
    : `${grey} of your ${total} runs spent most of their time in Zone 3.`
}

export default function EffortRecord({ runs, weeks }: { runs: EffortRun[]; weeks: number }) {
  if (runs.length < COACH_EFFORT_MIN_RUNS) return null
  const grey = runs.filter(r => r.kind === 'grey').length
  const last = runs[runs.length - 1]
  const caption = { fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--mute)' } as const
  return (
    <div data-effort-record className="card-data" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)' }}>Every run, by zone</span>
        <span style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)' }}>{runs.length} runs · {weeks} weeks</span>
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.2px', lineHeight: 1.25, marginTop: 'var(--space-2)' }}>
        {effortHeadline(grey, runs.length)}
      </div>
      <div
        role="img"
        aria-label={`${runs.length} runs since ${formatDate(runs[0].date)}: ${grey} mostly in Zone 3, ${runs.filter(r => r.kind === 'easy').length} mostly easy, ${runs.length - grey - runs.filter(r => r.kind === 'easy').length} harder or planned`}
        style={{ display: 'flex', gap: '3px', marginTop: 'var(--space-4)' }}
      >
        {runs.map((r, i) => (
          <div key={i} data-run={r.kind} data-this-week={r.thisWeek || undefined} style={{ flex: '1 1 0', minWidth: '3px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '100%', height: `${COLUMN_HEIGHT_PX}px`, borderRadius: '3px', overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse',
              background: 'var(--bg-soft)', boxShadow: r.thisWeek ? '0 0 0 2px var(--ink)' : undefined,
            }}>
              {LAYERS.map(l => r[l.key] > 0 && <div key={l.key} style={{ height: `${r[l.key]}%`, background: l.fill }} />)}
            </div>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: r.kind === 'grey' ? 'var(--s-quality)' : 'transparent' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-1)', ...caption }}>
        <span>{formatDate(runs[0].date)}</span>
        <span>{last.thisWeek ? 'This week' : formatDate(last.date)}</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginTop: 'var(--space-3)', ...caption }}>
        {LAYERS.map(l => (
          <span key={l.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '2px', background: l.fill }} />{l.label}
          </span>
        ))}
      </div>
      <div aria-hidden="true" style={{ height: '1px', background: 'var(--line)', margin: 'var(--space-4) 0 var(--space-3)' }} />
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.45 }}>
        Zone 3 is the grey zone on easy days. A tempo belongs there; an easy run doesn&apos;t.
      </div>
    </div>
  )
}
