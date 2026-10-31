// COACH-KIT-CAUGHT-01 — "What Kit caught": the runner's own receipts, each with its number (`kitReceipts`, §133). One
// card, two homes: free Coach and the Upgrade screen (Design Board 2026-10-31: the same card in both so it is
// recognised). Rule-based, so no AIMark and no byline. P-01's pair on the MARK only (moss held, amber drifted); the
// words stay ink, because a hue is never small text (6t-g). No tap targets: a receipt is read, not explored.

import type { ReactNode } from 'react'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import type { KitReceipt } from '@/lib/coaching/kitReceipts'
import { BRAND } from '@/lib/brand'

export default function KitReceipts({ receipts, title = `What ${BRAND.coachName} caught`, meta, children }: {
  receipts: KitReceipt[]
  title?: string
  /** A quiet right-hand eyebrow, e.g. "last 2 weeks". */
  meta?: string
  /** A footer under a hairline (free Coach: what Pro adds, and the button). */
  children?: ReactNode
}) {
  if (receipts.length === 0) return null
  const eyebrow = { fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)' } as const
  return (
    <div data-kit-receipts className="card-data" style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={eyebrow}>{title}</span>
        {meta && <span style={eyebrow}>{meta}</span>}
      </div>
      <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {receipts.map((r, i) => (
          <li key={i} data-receipt={r.tone} style={{ display: 'flex', gap: 'var(--space-3)', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 1.45, color: 'var(--ink-2)' }}>
            <span aria-hidden="true" style={{ flex: 'none', width: '7px', height: '7px', borderRadius: '50%', marginTop: 'calc(0.725em - 3.5px)', background: r.tone === 'held' ? 'var(--moss)' : 'var(--warn)' }} />
            <span>{r.lead && <b style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.lead}</b>}{r.lead ? ' ' : ''}{r.text}</span>
          </li>
        ))}
      </ul>
      {children && (
        <>
          <div aria-hidden="true" style={{ height: '1px', background: 'var(--line)', margin: 'var(--space-4) 0 var(--space-3)' }} />
          {children}
        </>
      )}
    </div>
  )
}
