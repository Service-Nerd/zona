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

// ── BOOT-STALL-DIAGNOSE-01 (2026-11-04) ─────────────────────────────────────────────────────────────────
// 125 production stalls arrived under BOOT-HANG-01 and none of them could say WHY, because the report
// carried `BOOT_STALL_MS` in the field named `elapsed_ms`, had no idea whether the webview had been
// suspended, and recorded `gate: 'error'` with no cause. These add the three missing facts.

/** How long any single boot await may wait before the boot stops waiting on it.
 *
 *  🔴 THIS IS A LEAK GUARD, NOT AN ATTRIBUTION MECHANISM, AND IT TOOK TWO WRONG ANSWERS TO GET HERE.
 *
 *  First cut: `BOOT_STALL_MS - 2_000`, so an attributable `error` row would beat the generic watchdog.
 *  Second cut: `BOOT_STALL_MS`, on the reasoning that the bound could then "only fire on a boot the runner
 *  has already lost". **Both break BOOT-HANG-01's self-heal.** The watchdog shows Try again at 12s but does
 *  NOT abandon the boot — `if (!bootReady)` stops guarding the moment the boot finishes, so a launch that
 *  settles at 16s replaces the stall screen with the dashboard on its own. The watchdog's own comment says
 *  so: *"a boot that completes later still renders."* A bound at or below 12s rejects that boot instead,
 *  `appReady` is never set, and a runner who would have been fine is stranded until they reload by hand.
 *
 *  So the bound sits far beyond any boot a runner would still be waiting for. Its only job is to stop a
 *  genuinely dead promise (a killed iOS fetch that will never settle) holding the boot forever. Attribution
 *  comes from `bootStageRef`, which the watchdog reads at 12s — never from this bound.
 *
 *  ⚠️ Consequence, stated rather than discovered later: `err_kind: 'timeout'` is **not expected in
 *  practice**, because the watchdog always reports first and both reporters latch. The error path's
 *  `err_kind` earns its place on the FAST failures — `denied`, `network` — which throw in seconds and are
 *  what the 16 production `error` rows actually were.
 *
 *  Lower it only from real production `elapsed_ms` data, never from taste. */
export const BOOT_QUERY_TIMEOUT_MS = BOOT_STALL_MS * 5

/** Why the boot threw. An ENUM, deliberately: `/api/ops/boot-report` takes no free text, because auth is
 *  optional there and an anonymous caller must not be able to write arbitrary strings into `ops_events`. */
export type BootErrKind = 'timeout' | 'network' | 'denied' | 'unknown'
export const BOOT_ERR_KINDS: readonly BootErrKind[] = ['timeout', 'network', 'denied', 'unknown']

/** A sane ceiling for a reported elapsed time, so one absurd client value cannot distort an average.
 *  Three hours: past any plausible suspended-webview resume we would still want to see as a number. */
export const BOOT_ELAPSED_MAX_MS = 3 * 60 * 60 * 1000

/** Classify a thrown boot error into `BootErrKind`.
 *
 *  Reads `name` and `message`, which is all a caught `unknown` reliably offers. `denied` covers the
 *  postgrest/RLS shape (`permission denied`, a 401/403), which is the failure MIGRATION-GRANTS-01 warns
 *  returns as an error OBJECT most call sites here never read. */
export function bootErrKind(err: unknown): BootErrKind {
  if (err && typeof err === 'object' && (err as { name?: unknown }).name === 'TimeoutError') return 'timeout'
  const msg = (err instanceof Error ? err.message : typeof err === 'string' ? err : '').toLowerCase()
  if (!msg) return 'unknown'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('did not settle')) return 'timeout'
  if (msg.includes('permission denied') || msg.includes('not authorized') || msg.includes('unauthorized')
    || msg.includes('jwt') || msg.includes('403') || msg.includes('401')) return 'denied'
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request')
    || msg.includes('load failed') || msg.includes('connection')) return 'network'
  return 'unknown'
}

/** WHICH boot await stalled.
 *
 *  🔴 THIS EXISTS BECAUSE `gate` DOES NOT ANSWER IT. `gate` names the STATE still held (`appReady` false),
 *  and `appReady` is set once, at the very end of `fetchSettingsOnce` — so `gate: 'settings'` covers SIX
 *  sequential awaits, only one of which is the settings query it is named after: auth, the settings batch,
 *  the plan load (which for a legacy runner fetches a GitHub Gist), pre-session readiness, the run-analysis
 *  batch, and taper recalibration. 105 of 125 production rows said `settings` and could not distinguish them.
 *
 *  ⚠️ An ENUM for the same reason `BootErrKind` is one: auth is optional on `/api/ops/boot-report`, so a
 *  timeout label must not be free text written by an anonymous caller. */
export type BootStage = 'auth' | 'settings' | 'plan' | 'readiness' | 'analysis' | 'taper'
export const BOOT_STAGES: readonly BootStage[] = ['auth', 'settings', 'plan', 'readiness', 'analysis', 'taper']

/** The gate distribution measured over the first 125 production rows: 105 `settings`, 16 `error`, 4 `auth`,
 *  0 `run_analysis`, 0 `strava`.
 *
 *  🔴 AN EARLIER VERSION OF THIS FILE DECLARED THE TWO ZEROES "STRUCTURALLY UNREACHABLE". THAT WAS WRONG,
 *  and the review that caught it also found the defect behind it: on the `PlanReadError` path the boot sets
 *  `appReady` and returns WITHOUT `setRunAnalysisReady(true)`, so `bootReady` stays false, `<PlanLoadFailed>`
 *  is never reached, and the watchdog reports `run_analysis` at 12s. The gate was reachable all along, by a
 *  bug. **A zero in telemetry is an observation, never a proof of impossibility** — and writing the stronger
 *  claim into the code would have taught the next reader to stop looking. The zeroes are recorded here and
 *  claimed as nothing more. */
export const BOOT_GATE_DISTRIBUTION_2026_11_04 = Object.freeze(
  { settings: 105, error: 16, auth: 4, run_analysis: 0, strava: 0 } as const,
)
