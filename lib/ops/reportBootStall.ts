import { Capacitor } from '@capacitor/core'
import type { BootStallGate, BootErrKind, BootStage } from '@/lib/ui/bootWatchdog'

export interface BootStallReport {
  gate: BootStallGate
  /** REAL measured milliseconds from boot start to this report. BOOT-STALL-DIAGNOSE-01: this used to be
   *  handed the constant `BOOT_STALL_MS`, so 109 of 125 production rows read exactly 12000 and the field
   *  could not distinguish a 12.1-second boot from a webview suspended for four hours. */
  elapsedMs: number
  /** True if the document was hidden at ANY point between boot start and this report.
   *
   *  ⚠️ THIS IS THE DISCRIMINATOR THE FIRST VERSION LACKED. On iOS the WKWebView is suspended when the app
   *  is backgrounded: the in-flight boot fetch is killed or stalled, the watchdog's timer fires on resume,
   *  and it reports a "stall" that the runner may never have experienced as one. Without this flag a
   *  backgrounded launch and a genuine hang are the same row, and 105 rows could not be split. Hidden-at-
   *  any-point, not hidden-now, because a launch backgrounded and then resumed is visible when it fires. */
  hidden: boolean
  /** Only for `gate: 'error'` — why the boot threw. An enum; see BOOT_ERR_KINDS for why not a message. */
  errKind?: BootErrKind
  /** WHICH await stalled, when the cause was a timeout. `gate` cannot say: it names the state still held,
   *  and `appReady` is set once at the end of a boot with six sequential awaits in it. */
  stage?: BootStage | null
  accessToken?: string | null
}

/**
 * BOOT-HANG-01 — tell us the loading screen stalled, and where.
 * BOOT-STALL-DIAGNOSE-01 — and for how long, whether the app was backgrounded, and why it threw.
 *
 * ⚠️ PLAIN `fetch`, NOT `authedFetch`. `authedFetch` asks the Supabase client for the session, and a stalled auth is
 * one of the things being reported: the report would wait on the failure it describes. The caller passes the access
 * token it already holds (from `onAuthStateChange`), or nothing, and the route accepts both.
 */
export async function reportBootStall(r: BootStallReport): Promise<void> {
  try {
    await fetch('/api/ops/boot-report', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(r.accessToken ? { Authorization: `Bearer ${r.accessToken}` } : {}),
      },
      body: JSON.stringify({
        gate: r.gate,
        elapsed_ms: Math.round(r.elapsedMs),
        native: Capacitor.isNativePlatform(),
        hidden: r.hidden,
        ...(r.errKind ? { err_kind: r.errKind } : {}),
        ...(r.stage ? { stage: r.stage } : {}),
      }),
    })
  } catch {
    // Best-effort. The runner already has the Try again screen.
  }
}
