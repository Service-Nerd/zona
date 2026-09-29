'use client'

// DASHBOARD-SCREEN-EXTRACT-04 — lifted verbatim out of `DashboardClient.tsx`, the last
// of the fourteen. Module-level in the original, so it closed over nothing.
//
// ⚠️ Bodies UNCHANGED. Edit in a separate commit so the move stays a move.

import Button from '@/components/ui/Button'
import SessionCompleteCard from '@/components/shared/SessionCompleteCard'
import { useEffect, useState } from 'react'

// SAVE-IMG-01 — "Share" button rendered BELOW SessionCompleteCard
// (never inside). Keeps the user's iOS screenshot of the card clean.
// Tinted-moss secondary style — the card itself is the moment; the
// button is the accelerator. Same label as ShareWeekButton on Coach.
export default function SaveImageButton({ weekN, sessionDay }: { weekN: number; sessionDay: string }) {
  const [busy, setBusy]     = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 2200)
    return () => clearTimeout(t)
  }, [status])

  async function onSave() {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      const { shareSessionCompleteCard } = await import('@/lib/share/shareSessionCompleteCard')
      await shareSessionCompleteCard({
        weekN,
        sessionDay,
        onStatus: (s) => {
          if (s.kind === 'downloaded')     setStatus('Saved')
          else if (s.kind === 'cancelled') setStatus(null)
          else if (s.kind === 'success')   setStatus(null)
          else if (s.kind === 'error')     setStatus(s.message || 'Save failed')
        },
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="soft"
      onClick={onSave} busy={busy}>
      {status ?? (busy ? 'Preparing…' : 'Share')}
    </Button>
  )
}
