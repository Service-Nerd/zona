// Pure, so the server route can validate the field without importing the client sync module.
/**
 * HK-SYNC-TRIGGER-01 (2026-10-25) — WHAT started this sweep. Required, not optional, so every caller has to say.
 * The founder asked why runs stopped linking with the app closed; the answer turned on how often the background
 * (observer) wake actually ingests a run, and no sweep recorded what started it, so that could not be measured.
 */
export type SyncTrigger =
  | 'open'               // CapacitorBoot mount (cold start)
  | 'resume'             // app returned to the foreground
  | 'observer_workout'   // HKObserverQuery wake: a workout landed (the background path)
  | 'observer_hr'        // HKObserverQuery wake: heart rate
  | 'observer_recovery'  // HKObserverQuery wake: RHR / HRV / sleep
  | 'refresh'            // pull-to-refresh on Today
  | 'connect'            // first sync after granting Apple Health
  | 'hr_retry'           // the HR-pending card's retry tap
export const SYNC_TRIGGERS: readonly SyncTrigger[] = ['open', 'resume', 'observer_workout', 'observer_hr', 'observer_recovery', 'refresh', 'connect', 'hr_retry']
