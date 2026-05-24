// SAVE-IMG-01 — client-side helper that fetches the session-complete-card
// PNG and routes it to the right share mechanism per platform.
//
// Sibling of shareWeeklyZoneCard.ts — identical plumbing, different
// target route. Both Capacitor deps (@capacitor/share + filesystem)
// are already installed from SHARE-01.

import { authedFetch } from '@/lib/supabase/authedFetch'
import { BRAND } from '@/lib/brand'

export type ShareStatus =
  | { kind: 'fetching' }
  | { kind: 'sharing' }
  | { kind: 'downloaded' }
  | { kind: 'success' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string }

export interface ShareSessionCardOptions {
  weekN: number
  sessionDay: string
  onStatus?: (s: ShareStatus) => void
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, Array.from(sub))
  }
  return btoa(binary)
}

export async function shareSessionCompleteCard(opts: ShareSessionCardOptions): Promise<void> {
  const { weekN, sessionDay, onStatus } = opts
  const url = `/api/og/session-complete-card?week_n=${weekN}&session_day=${encodeURIComponent(sessionDay)}`

  onStatus?.({ kind: 'fetching' })

  let pngBlob: Blob
  try {
    const res = await authedFetch(url)
    if (!res.ok) throw new Error(`Card unavailable (${res.status})`)
    pngBlob = await res.blob()
  } catch (err: any) {
    onStatus?.({ kind: 'error', message: err?.message ?? 'Could not load card' })
    return
  }

  onStatus?.({ kind: 'sharing' })

  // iOS Capacitor — write base64 to Filesystem.Cache, share file URI.
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')

      const filename = `zonna-session-w${weekN}-${sessionDay}-${Date.now()}.png`
      const base64   = await blobToBase64(pngBlob)
      const written  = await Filesystem.writeFile({
        path:      filename,
        data:      base64,
        directory: Directory.Cache,
      })

      try {
        await Share.share({
          title:       `${BRAND.name} — session card`,
          text:        BRAND.voiceAnchor,
          files:       [written.uri],
          dialogTitle: 'Share session',
        })
        onStatus?.({ kind: 'success' })
      } catch (err: any) {
        const msg = String(err?.message ?? err ?? '')
        if (/cancel/i.test(msg)) onStatus?.({ kind: 'cancelled' })
        else onStatus?.({ kind: 'error', message: msg || 'Share failed' })
      }
      return
    }
  } catch {
    // Capacitor unavailable on web — fall through.
  }

  // Web — Web Share Level 2 if available, else download fallback.
  try {
    const file = new File([pngBlob], `zonna-session-w${weekN}-${sessionDay}.png`, { type: 'image/png' })
    const navAny = navigator as any
    if (typeof navAny.canShare === 'function' && navAny.canShare({ files: [file] }) && typeof navAny.share === 'function') {
      try {
        await navAny.share({
          title: `${BRAND.name} — session card`,
          text:  BRAND.voiceAnchor,
          files: [file],
        })
        onStatus?.({ kind: 'success' })
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') { onStatus?.({ kind: 'cancelled' }); return }
      }
    }
  } catch {
    // Fall through to download.
  }

  try {
    const objectUrl = URL.createObjectURL(pngBlob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `zonna-session-w${weekN}-${sessionDay}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
    onStatus?.({ kind: 'downloaded' })
  } catch (err: any) {
    onStatus?.({ kind: 'error', message: err?.message ?? 'Download failed' })
  }
}
