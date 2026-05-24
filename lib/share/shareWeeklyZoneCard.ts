// SHARE-01 — client-side helper that fetches the OG card PNG and routes it to
// the right share mechanism per platform:
//
//   iOS (Capacitor native) → write the PNG to Filesystem.Cache, then call
//                            Share.share with the file:// URI. The system
//                            share sheet handles previewing + downstream
//                            apps (Instagram, Messages, etc.).
//
//   Web (browser)          → navigator.share with the PNG as a File if Web
//                            Share Level 2 is available; otherwise trigger
//                            a download via a temporary anchor element. The
//                            download fallback is honest — most browsers
//                            don't yet support file sharing.
//
// All paths handle failure by surfacing a friendly status via the optional
// `onStatus` callback. The caller controls the button's loading state.

import { authedFetch } from '@/lib/supabase/authedFetch'
import { BRAND } from '@/lib/brand'

export type ShareStatus =
  | { kind: 'fetching' }
  | { kind: 'sharing' }
  | { kind: 'downloaded' }   // web fallback path completed
  | { kind: 'success' }
  | { kind: 'cancelled' }    // user dismissed share sheet
  | { kind: 'error'; message: string }

export interface ShareOptions {
  /** Optional explicit week_n; defaults to the most recent generated report. */
  weekN?: number
  onStatus?: (s: ShareStatus) => void
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000  // 32 KB — avoids stack blow-out on apply()
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    // Avoid the spread iterator path — tsc's chosen target doesn't allow it
    // for typed-array views without --downlevelIteration. Array.from compiles
    // to a plain for-loop and matches our es2015 target.
    binary += String.fromCharCode.apply(null, Array.from(sub))
  }
  return btoa(binary)
}

export async function shareWeeklyZoneCard(opts: ShareOptions = {}): Promise<void> {
  const { weekN, onStatus } = opts
  const url = weekN != null
    ? `/api/og/weekly-zone-card?week_n=${weekN}`
    : '/api/og/weekly-zone-card'

  onStatus?.({ kind: 'fetching' })

  let pngBlob: Blob
  try {
    const res = await authedFetch(url)
    if (!res.ok) {
      // 404 means the server-side row exists but zone discipline hasn't been
      // computed yet (needs ≥2 runs with HR data this week). Tell the user
      // that — the previous generic "Card unavailable (404)" left them
      // staring at an opaque failure on a button the UI thought was enabled.
      if (res.status === 404) {
        throw new Error('Need 2+ logged runs with HR data this week.')
      }
      throw new Error(`Couldn’t load the card (${res.status}).`)
    }
    pngBlob = await res.blob()
  } catch (err: any) {
    onStatus?.({ kind: 'error', message: err?.message ?? 'Could not load card' })
    return
  }

  onStatus?.({ kind: 'sharing' })

  // Native iOS via Capacitor — write to Filesystem cache + Share.share with file URI.
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')

      // Unique filename per share — avoids old PNGs leaking into a later share
      // if the user re-taps before the previous file gets cleaned up.
      const filename = `zonna-zone-week-${Date.now()}.png`
      const base64   = await blobToBase64(pngBlob)
      const written  = await Filesystem.writeFile({
        path:      filename,
        data:      base64,
        directory: Directory.Cache,
      })

      try {
        await Share.share({
          title:        `${BRAND.name} — Zone discipline`,
          text:         BRAND.voiceAnchor,
          files:        [written.uri],
          dialogTitle:  'Share week',
        })
        onStatus?.({ kind: 'success' })
      } catch (err: any) {
        // Capacitor surfaces user-cancel as a thrown error on iOS; treat it as
        // a soft outcome rather than a failure so we don't show an error toast.
        const msg = String(err?.message ?? err ?? '')
        if (/cancel/i.test(msg)) onStatus?.({ kind: 'cancelled' })
        else onStatus?.({ kind: 'error', message: msg || 'Share failed' })
      }
      return
    }
  } catch {
    // Capacitor import failed (web build without native shim) — fall through to web path.
  }

  // Web path — try Web Share Level 2 (file sharing), else download.
  try {
    const file = new File([pngBlob], 'zonna-zone-week.png', { type: 'image/png' })
    const navAny = navigator as any
    if (typeof navAny.canShare === 'function' && navAny.canShare({ files: [file] }) && typeof navAny.share === 'function') {
      try {
        await navAny.share({
          title: `${BRAND.name} — Zone discipline`,
          text:  BRAND.voiceAnchor,
          files: [file],
        })
        onStatus?.({ kind: 'success' })
        return
      } catch (err: any) {
        if (err?.name === 'AbortError') { onStatus?.({ kind: 'cancelled' }); return }
        // Fall through to download fallback below.
      }
    }
  } catch {
    // Fall through to download fallback below.
  }

  // Download fallback — works in every browser. The user can then attach the
  // PNG to whatever client they want.
  try {
    const objectUrl = URL.createObjectURL(pngBlob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = 'zonna-zone-week.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
    onStatus?.({ kind: 'downloaded' })
  } catch (err: any) {
    onStatus?.({ kind: 'error', message: err?.message ?? 'Download failed' })
  }
}
