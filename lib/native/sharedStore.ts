// WIDGET-01 — TS binding for the custom SharedStore Capacitor plugin
// (ios/App/App/SharedStorePlugin.swift).
//
// Lets the JS app write key/value strings into the App Group's
// UserDefaults so the ZonnaWidgetExtension can read them. All calls are
// no-ops on non-native platforms (web simply returns null on get,
// resolves silently on set/remove) — keeps call sites platform-agnostic.

import { registerPlugin, Capacitor } from '@capacitor/core'

interface SharedStorePlugin {
  set(opts:    { key: string; value: string }): Promise<{ ok: true }>
  get(opts:    { key: string }):                Promise<{ value: string | null }>
  remove(opts: { key: string }):                Promise<{ ok: true }>
}

const native = registerPlugin<SharedStorePlugin>('SharedStore')

const KEY = 'zonna_widget_state'

/**
 * Write a serialised payload to the App Group container under the
 * canonical widget-state key. No-op on web.
 *
 * Errors are caught + logged — a failed write doesn't bubble up to the
 * UI; worst case the widget shows stale data until the next successful
 * write. The plugin itself rejects only when the App Group is
 * mis-configured in Xcode (caught by `npx cap sync ios` + Xcode build).
 */
export async function writeWidgetState(payload: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await native.set({ key: KEY, value: payload })
  } catch (err: any) {
    console.warn('[SharedStore] writeWidgetState failed:', err?.message ?? err)
  }
}

/**
 * Read the current widget-state JSON string from the App Group, or null
 * on web / first run. Mostly for debugging — the widget extension reads
 * directly from UserDefaults in Swift.
 */
export async function readWidgetState(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { value } = await native.get({ key: KEY })
    return value
  } catch {
    return null
  }
}

/**
 * Clear the widget state. Used on sign-out so the widget doesn't keep
 * showing the previous user's race countdown.
 */
export async function clearWidgetState(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await native.remove({ key: KEY })
  } catch { /* silent */ }
}
