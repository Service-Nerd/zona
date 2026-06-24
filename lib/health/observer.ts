// HR-SYNC-03 — TypeScript binding for HealthObserverPlugin.
//
// Registers HKObserverQuery for heartRate, restingHeartRate,
// heartRateVariabilitySDNN, and sleepAnalysis via the native Swift plugin.
// When HealthKit delivers a background notification (foreground or warm-bg),
// the event triggers syncOnAppOpen() so the full ingest + retry pipeline runs.
//
// Only runs on iOS native — the Capacitor.isNativePlatform() guard in
// initHealthObserver() is a hard no-op on web/PWA.
//
// Module-level _observerRegistered prevents duplicate listener registration
// across React StrictMode double-mounts. The Swift side has its own guard too.

import { registerPlugin, Capacitor } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'

interface HealthObserverPlugin {
  register(): Promise<{ ok: boolean; skipped: boolean }>
  addListener(
    eventName: 'hrDataArrived' | 'recoveryDataArrived',
    listenerFunc: () => void,
  ): Promise<PluginListenerHandle>
}

const HealthObserver = registerPlugin<HealthObserverPlugin>('HealthObserver')

let _observerRegistered = false

/**
 * Initialises the native HKObserverQuery bridge (HR-SYNC-03, Layer 2).
 *
 * Sets up background delivery for HR + recovery types so iOS can wake the
 * app (or notify it when warm) as soon as Apple Watch syncs new data —
 * without waiting for the user to manually re-open the app.
 *
 * Idempotent — safe to call multiple times; only registers once per session.
 * On failure, resets the guard so a retry is possible on next boot.
 */
export async function initHealthObserver(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  if (_observerRegistered) return
  _observerRegistered = true

  try {
    await HealthObserver.register()

    // Both event types use the same pipeline. syncOnAppOpen includes:
    //   - syncRecentWorkouts     (new runs since last sync)
    //   - syncRecoverySamples    (RHR / HRV / sleep — 14-day window)
    //   - retryPendingHrRows     (HR-null apple_health rows → re-post with fresh HR)
    const { syncOnAppOpen } = await import('@/lib/health/clientSync')

    const onData = () => {
      void (async () => {
        try {
          await syncOnAppOpen()
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[health-observer] sync failed', err instanceof Error ? err.message : err)
        }
      })()
    }

    await HealthObserver.addListener('hrDataArrived', onData)
    await HealthObserver.addListener('recoveryDataArrived', onData)
  } catch (err) {
    // Reset so the next cold start can retry (e.g. HealthKit auth denied,
    // user grants it, then re-opens the app).
    _observerRegistered = false
    // eslint-disable-next-line no-console
    console.warn('[health-observer] init failed', err instanceof Error ? err.message : err)
  }
}
