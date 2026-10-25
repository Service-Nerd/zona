// BOOT-HANG-01 (2026-10-25) — the single owner of "the loading screen has been up too long".
//
// Found on the founder's phone: the app sometimes sat on the wordmark + "Hold the zone." screen until it was
// force-closed. That screen holds until `DashboardClient`'s one-shot boot (`fetchSettings`) finishes, and the boot
// had three dead ends with no timeout, no retry and no record: no user returned (it just `return`ed), an uncaught
// throw, and a request that never resolves. A fresh start re-runs it, which is why force-closing "fixed" it.
//
// Pure, so the gate order is tested without rendering the dashboard (`vitest` runs `environment: 'node'`).

/** How long the loading screen may hold before it becomes a "Try again" screen. The native splash already
 *  auto-hides at 10s (`capacitor.config.ts`), so 12s is past every legitimate cold start this app has measured
 *  and short of the point a runner reaches for the app switcher. */
export const BOOT_STALL_MS = 12_000

/** Which part of the boot was still outstanding. `error` = the boot threw. Recorded, never shown. */
export type BootStallGate = 'auth' | 'settings' | 'run_analysis' | 'strava' | 'error'
export const BOOT_STALL_GATES: readonly BootStallGate[] = ['auth', 'settings', 'run_analysis', 'strava', 'error']

/** The first gate still holding, in the order the boot passes them. `null` = nothing holding (booted). */
export function stalledGate(s: {
  authResolved: boolean
  appReady: boolean
  runAnalysisReady: boolean
  stravaGateOpen: boolean
}): BootStallGate | null {
  if (!s.authResolved) return 'auth'
  if (!s.appReady) return 'settings'
  if (!s.runAnalysisReady) return 'run_analysis'
  if (!s.stravaGateOpen) return 'strava'
  return null
}

/** Founder-approved 2026-10-25. */
export const BOOT_STALLED_TITLE = 'Taking longer than usual.'
export const BOOT_STALLED_ACTION = 'Try again'

/** `/api/ops/boot-report`'s per-IP limit. Here, not in the route: a Next.js route file may export only handlers
 *  and route config, and exporting these from it failed the production build on 2026-10-25. */
export const BOOT_REPORT_LIMIT = 10
export const BOOT_REPORT_WINDOW_SECONDS = 3600
