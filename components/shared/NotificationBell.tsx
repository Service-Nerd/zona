'use client'

// NOTIF-01 — bell affordance on the Today wordmark row. A bell is justified
// under the "no icons unless they carry unique meaning" rule — it's the
// universally-understood notifications affordance with no compact text
// equivalent. Calm over count: a moss dot signals unread, never a number badge.
// Rendered only for paid/trial users (free users can't have notifications).
// Pattern: NotificationBell (ui-patterns.md).

export function NotificationBell({ unreadCount, onClick }: {
  unreadCount: number
  onClick: () => void
}) {
  const hasUnread = unreadCount > 0
  return (
    <button
      onClick={onClick}
      aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      style={{
        position: 'relative',
        width: '44px', height: '44px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
        flexShrink: 0,
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {hasUnread && (
        <span style={{
          position: 'absolute', top: '9px', right: '10px',
          width: '8px', height: '8px', borderRadius: '50%',
          background: 'var(--moss)',
          // ring in the surface colour so the dot reads cleanly over the bell glyph
          border: '1.5px solid var(--bg)',
        }} />
      )}
    </button>
  )
}
