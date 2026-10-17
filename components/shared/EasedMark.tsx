// READINESS-SURFACE-01 item 3 — the "Eased for recovery" text mark (ui-patterns § 10e).
// It sits in the 12px metric register beside "Done" and the AM / PM token: a label in --ink-2,
// never a colour, a tile or a count (Design Board, 2026-10-17; Collins lost the amber tile).
import { EASED_FOR_RECOVERY_LABEL } from '@/lib/ui/easedMark'

export default function EasedMark() {
  return (
    <span data-eased="recovery" style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>
      {EASED_FOR_RECOVERY_LABEL}
    </span>
  )
}
