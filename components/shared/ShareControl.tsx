'use client'

import IconButton from '@/components/ui/IconButton'
import { useEffect, useState } from 'react'

// SHARE-ICON-01 — THE SINGLE OWNER of every share control (Design Board 2026-10-31,
// mockups approved by the founder the same day).
//
// Share was a full-width moss primary on Coach and a soft pill on three run surfaces,
// so the loudest control on Coach said "post this" instead of "do this". The ruling:
// the iOS share glyph in an `IconButton shape="circle"`, right-aligned under the thing
// it shares, never inside it (SAVE-IMG-01 keeps the card screenshot-clean).
//
// ⚠️ An icon has no label, and the label used to carry the STATUS. The words move to a
// 12px `--mute` line beside the icon, in an always-mounted `aria-live` region (a live
// region inserted at the same moment as its text is not reliably announced). Busy is
// the icon disabled, which `.icon-btn:disabled` dims to `--mute`: no spinner, no "Preparing…".
//
// Callers own WHAT is shared (and any analytics); this owns how it looks and reports.

export type ShareStatus =
  | { kind: 'fetching' } | { kind: 'sharing' } | { kind: 'downloaded' }
  | { kind: 'success' }  | { kind: 'cancelled' } | { kind: 'error'; message: string }

export const SHARE_STATUS_MS = 2200

/** The words beside the icon, or null for none. `cancelled` is not a failure. */
export function shareStatusText(s: ShareStatus): string | null {
  if (s.kind === 'downloaded') return 'Saved'
  if (s.kind === 'error')      return s.message || "Couldn't share. Try again."
  return null
}

export function ShareGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5H16" />
    </svg>
  )
}

export default function ShareControl({ ariaLabel, share }: {
  /** What it shares, in the runner's words: "Share this week", "Share this run". */
  ariaLabel: string
  /** Runs the share and reports progress through `onStatus`. */
  share: (onStatus: (s: ShareStatus) => void) => Promise<void>
}) {
  const [busy, setBusy]     = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), SHARE_STATUS_MS)
    return () => clearTimeout(t)
  }, [status])

  async function onShare() {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      await share(s => setStatus(shareStatusText(s)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-share-control style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
      <span aria-live="polite" style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--mute)' }}>
        {status ?? ''}
      </span>
      <IconButton shape="circle" ariaLabel={ariaLabel} icon={<ShareGlyph />}
        onClick={onShare} disabled={busy} aria-busy={busy} />
    </div>
  )
}
