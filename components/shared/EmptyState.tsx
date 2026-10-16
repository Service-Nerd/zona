import type { ReactNode } from 'react'

/**
 * EMPTY-STATE-OWNER-01 (Design Board, 2026-10-16) — ui-patterns.md § 8 Empty State, written
 * ONCE. A heading, a muted line, and an action only when there is one to take.
 *
 * 🔴 WHY ONE OWNER. Two hand-written copies existed and already disagreed on alignment
 * (Me → Plan history centred, the dashboard's plan-load failure left-aligned). The board
 * ruled the documented pattern: centred on both axes, because a single message with one
 * action is a pause, not a page (Silvanto). The action stays full-width for one thumb.
 *
 * `fill` makes it take the whole viewport (a screen-level state); without it, it centres
 * inside whatever space its parent gives it (an empty list).
 */
export function EmptyState({ title, body, action, fill = false }: {
  title: ReactNode
  body?: ReactNode
  /** One action at most (§ 8: "no button unless there's a specific action available"). */
  action?: ReactNode
  fill?: boolean
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', flex: 1, minHeight: fill ? '100dvh' : '200px',
      padding: fill ? '0 var(--space-4)' : undefined, background: fill ? 'var(--bg)' : undefined,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '1rem', fontWeight: 600, color: 'var(--ink)' }}>
          {title}
        </div>
        {body && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.875rem', fontWeight: 400, color: 'var(--mute)', lineHeight: 1.5, marginTop: 'var(--space-2)' }}>
            {body}
          </div>
        )}
        {action && <div style={{ marginTop: 'var(--space-5)' }}>{action}</div>}
      </div>
    </div>
  )
}
