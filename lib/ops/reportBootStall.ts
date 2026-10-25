import { Capacitor } from '@capacitor/core'
import type { BootStallGate } from '@/lib/ui/bootWatchdog'

/**
 * BOOT-HANG-01 — tell us the loading screen stalled, and where.
 *
 * ⚠️ PLAIN `fetch`, NOT `authedFetch`. `authedFetch` asks the Supabase client for the session, and a stalled auth is
 * one of the things being reported: the report would wait on the failure it describes. The caller passes the access
 * token it already holds (from `onAuthStateChange`), or nothing, and the route accepts both.
 */
export async function reportBootStall(gate: BootStallGate, elapsedMs: number, accessToken?: string | null): Promise<void> {
  try {
    await fetch('/api/ops/boot-report', {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ gate, elapsed_ms: Math.round(elapsedMs), native: Capacitor.isNativePlatform() }),
    })
  } catch {
    // Best-effort. The runner already has the Try again screen.
  }
}
