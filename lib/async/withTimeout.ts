// BOOT-STALL-DIAGNOSE-01 (2026-11-04) — the single owner of "await this, but not forever".
//
// WHY THIS EXISTS AS AN OWNER RATHER THAN A LOCAL HELPER. `GeneratePlanScreen` already had one of these,
// inline, and its own comment diagnosed the class exactly: "on device any of those three awaits could hang
// with no timeout, stranding the user on a grey skeleton forever". That reasoning was never carried across
// to `DashboardClient`'s boot, whose seven-query `Promise.all` had no bound at all — so 105 production
// `boot_stalled { gate: 'settings' }` rows arrived from a path the fix had already been written for.
// Two independent copies of a bound is this repo's definition of a missing owner (D-08).
//
// ⚠️ A TIMEOUT DOES NOT CANCEL THE WORK. A `fetch` that never settles stays pending; what changes is that
// WE stop waiting on it. That is the whole point for a boot gate: the screen must resolve even when the
// request will not. Where the underlying work must genuinely be abandoned, pass an AbortSignal to it as
// well — this module cannot do that for you, and pretending otherwise would be worse than not bounding it.

export class TimeoutError extends Error {
  readonly label: string
  readonly ms: number
  constructor(label: string, ms: number) {
    super(`${label} did not settle within ${ms}ms`)
    this.name = 'TimeoutError'
    this.label = label
    this.ms = ms
  }
}

/**
 * Reject with `TimeoutError` if `p` has not settled within `ms`.
 *
 * For a caller whose failure path is real (a catch that shows an error state, records an event, or retries).
 * `label` names the awaited thing and lands in the message, so a log says WHICH await stalled.
 */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const bound = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
  })
  // `finally` on the race, not on `p`: a pending `p` would never run its own finally, and the timer must be
  // cleared the moment the race settles or a node test process is held open by a handle nobody is waiting on.
  return Promise.race([p, bound]).finally(() => { if (timer !== undefined) clearTimeout(timer) })
}

/**
 * Resolve with `fallback` if `p` has not settled within `ms`.
 *
 * For a caller where the value is a nicety and absence is a legitimate answer — the benchmark estimate's
 * HealthKit read, where a missing snapshot means "ask the runner manually", not "something went wrong".
 */
export function withTimeoutFallback<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const bound = new Promise<T>(resolve => {
    timer = setTimeout(() => resolve(fallback), ms)
  })
  return Promise.race([p, bound]).finally(() => { if (timer !== undefined) clearTimeout(timer) })
}
