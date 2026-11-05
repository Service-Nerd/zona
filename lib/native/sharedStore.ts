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
  // HK-NATIVE-BG-INGEST-01 — Keychain-backed, for the native ingest credential.
  // Same shape, different store: UserDefaults is a plist, a token is not.
  setSecure(opts:    { key: string; value: string }): Promise<{ ok: true }>
  getSecure(opts:    { key: string }):                Promise<{ value: string | null }>
  removeSecure(opts: { key: string }):                Promise<{ ok: true }>
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

// ─── HK-NATIVE-BG-INGEST-01 — Keychain passthrough ─────────────────────────
// Thin on purpose: `lib/health/nativeCredential.ts` owns WHAT goes in and
// when. These three own only WHERE.

export async function writeSecure(key: string, value: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    await native.setSecure({ key, value })
    return true
  } catch (err: any) {
    console.warn('[SharedStore] writeSecure failed:', err?.message ?? err)
    return false
  }
}

export async function removeSecure(key: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await native.removeSecure({ key })
  } catch { /* silent */ }
}

/**
 * Clear EVERY piece of native state that belongs to the signed-in account.
 *
 * 🔴 WHY THIS EXISTS RATHER THAN TWO CALLS AT EACH SITE. There are two
 * legitimate paths that end an account on this device — `lib/auth/signOut.ts`
 * and the Me screen's account DELETION (a declared exemption in
 * `signOutOwner.test.ts`) — and the widget-state clear had to be added to both
 * by hand. Adding a second thing to clear doubles the chance one site is
 * missed, and this repo's name for that is "the remedy applied to one twin".
 * One function, so the next thing that needs clearing is added in one place.
 *
 * Guarded by `signOutOwner.test.ts`: any file that calls `auth.signOut()` must
 * call this first.
 */
export async function clearNativeState(): Promise<void> {
  await clearWidgetState()
  await removeSecure(NATIVE_CREDENTIAL_KEY)
  // 🔴 THE WATERMARK TOO, AND LEAVING IT OUT WAS A REAL BUG. It is the end
  // date of the newest run the NATIVE path posted, held in the App Group. It
  // is not personal data, but it survives sign-out — so a second account on
  // the same phone would have every run older than the previous account's
  // last run silently skipped by the native path. A function whose comment
  // says "EVERY piece of native state" has to mean it.
  await removeAppGroup(NATIVE_WATERMARK_KEY)
}

/** Keychain account name. Must match `HealthObserverPlugin.credentialKey`. */
export const NATIVE_CREDENTIAL_KEY = 'zonna_native_credential'
/** App-Group key. Must match `HealthObserverPlugin.watermarkKey`. */
export const NATIVE_WATERMARK_KEY  = 'zonna_native_last_ingest_at'

async function removeAppGroup(key: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await native.remove({ key })
  } catch { /* silent */ }
}
