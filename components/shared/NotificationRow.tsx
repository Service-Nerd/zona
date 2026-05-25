'use client'

// NOTIF-01 — one row in the notification inbox. Read-only delivery record.
// Pattern: NotificationRow (ui-patterns.md).
//
// Provenance note: rows carry NO AIMark/CoachByline. A notification is the
// envelope, not the AI content surface — most of the copy is rule/hand-authored
// anyway, and the deep-link target (Coach, Session detail) already carries the
// proper byline. Marking rows would violate provenance honesty (§16) and add
// noise. Two-colour rail: --warn for plan adjustments (design system reserves
// warn for coaching/adjustment surfaces), --moss for everything else (Kit's voice).

export interface NotificationItem {
  id:         string
  type:       string   // NotificationType union, but tolerate unknown future types
  title:      string
  body:       string
  url:        string | null
  read_at:    string | null
  created_at: string
}

// Short, scannable type label shown as the rail-coloured eyebrow.
const EYEBROW: Record<string, string> = {
  daily_training:  "Today's session",
  weekly_report:   'Your week',
  trial_insight:   'Kit noticed',
  run_feedback:    'Run logged',
  plan_adjustment: 'Plan adjusted',
}

export function NotificationRow({ item, relativeTime, onClick }: {
  item:         NotificationItem
  relativeTime: string
  onClick?:     () => void
}) {
  const isAdjustment = item.type === 'plan_adjustment'
  const railColor    = isAdjustment ? 'var(--warn)' : 'var(--moss)'
  const unread       = !item.read_at
  const eyebrow      = EYEBROW[item.type] ?? 'Update'
  const tappable     = !!item.url && !!onClick

  return (
    <button
      onClick={tappable ? onClick : undefined}
      disabled={!tappable}
      style={{
        position: 'relative',
        width: '100%',
        textAlign: 'left',
        display: 'block',
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding: '13px 16px 14px 18px',  // extra left padding clears the rail
        cursor: tappable ? 'pointer' : 'default',
        font: 'inherit',
        minHeight: '64px',
      }}
    >
      {/* Left rail — coaching/voice signal (moss) or plan-change signal (warn) */}
      <span style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: '3px', background: railColor,
        borderTopLeftRadius: 'var(--radius-lg)', borderBottomLeftRadius: 'var(--radius-lg)',
      }} />

      {/* Eyebrow row: type label left, time + unread dot right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: railColor,
        }}>{eyebrow}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute-2)' }}>{relativeTime}</span>
          {unread && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--moss)' }} />}
        </span>
      </div>

      {/* Title — bold line */}
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
        color: unread ? 'var(--ink)' : 'var(--mute)', lineHeight: 1.35, marginBottom: '2px',
      }}>{item.title}</div>

      {/* Body — message preview, clamped to 2 lines */}
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400,
        color: 'var(--mute)', lineHeight: 1.45,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{item.body}</div>
    </button>
  )
}
