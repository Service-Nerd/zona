import type { ReactNode } from 'react'
import Button from '@/components/ui/Button'

// ZONE-RINGS-HEADING-01 (2026-10-31) — the Coach rings' tap target, owned once so the
// preview harness renders the SAME wrapper the screen does.
//
// 🔴 `.btn` is an inline-flex ROW. Inside it the chromeless rings shrank to their own
// content, so the eyebrow's `space-between` had no room and the founder's phone read
// "THIS WEEK IN ZONESACROSS 1 RUN". The 2+ run branch (headline, rings, bars) sat in the
// same row. `/coach-preview` mounted the rings bare, without this wrapper, which is how
// it survived: the harness tested the halves, never the composition.
export default function RingsTapArea({ onOpen, children }: { onOpen: () => void; children: ReactNode }) {
  return (
    <Button variant="ghost"
      type="button"
      onClick={onOpen}
      aria-label="What counts as in-zone. Opens an explanation."
      style={{ width: '100%', padding: 0, textAlign: 'inherit', background: 'none', font: 'inherit', flexDirection: 'column', alignItems: 'stretch' }}>
      {children}
    </Button>
  )
}
