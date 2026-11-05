import Foundation
import Capacitor
import WidgetKit
import Security

// HK-NATIVE-BG-INGEST-01 — Keychain store for the native ingest credential.
//
// WHY THE KEYCHAIN AND NOT THE APP GROUP. `UserDefaults` (including the App
// Group suite below) is a plist on disk; an access token does not belong
// there. The Keychain is encrypted at rest and tied to the device.
//
// ⚠️ `kSecAttrAccessibleAfterFirstUnlock`, NOT `WhenUnlocked`. The entire
// point of this credential is to be readable during a BACKGROUND wake, which
// is very often a locked phone — `WhenUnlocked` would fail in exactly the case
// the feature exists for, and it would fail SILENTLY as a nil read, which
// reads identically to "the user is signed out".
//
// ⚠️ NO KEYCHAIN ACCESS GROUP, deliberately. An access group needs a
// `keychain-access-groups` entitlement on both targets plus a provisioning
// round-trip, and nothing outside the app needs this value — the widget reads
// plan state, never credentials. Keeping it in the app's own keychain means
// this feature changes NO entitlement file.
enum ZonnaKeychain {

    private static let service = "app.zonna.ios.credential"

    static func set(_ value: String, for key: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        // Delete-then-add rather than SecItemUpdate: one code path, and it
        // cannot leave a stale item with the old accessibility class.
        _ = remove(key)
        let attrs: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrService as String:      service,
            kSecAttrAccount as String:      key,
            kSecValueData as String:        data,
            kSecAttrAccessible as String:   kSecAttrAccessibleAfterFirstUnlock,
        ]
        return SecItemAdd(attrs as CFDictionary, nil) == errSecSuccess
    }

    static func get(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String:            kSecClassGenericPassword,
            kSecAttrService as String:      service,
            kSecAttrAccount as String:      key,
            kSecReturnData as String:       true,
            kSecMatchLimit as String:       kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func remove(_ key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String:        kSecClassGenericPassword,
            kSecAttrService as String:  service,
            kSecAttrAccount as String:  key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
}

// WIDGET-01 — Custom Capacitor plugin for App Group UserDefaults.
//
// Lets the JS app write key/value strings to a shared container that the
// ZonnaWidgetExtension can read from. Tiny by design — the widget reads
// a single key (zonna_widget_state) containing a JSON payload built by
// lib/widget/widgetState.ts.
//
// Why custom instead of @capacitor/preferences: that plugin writes to the
// app's private UserDefaults, which the widget extension cannot read. The
// widget needs an App Group container. Adding an `appGroup` param to the
// existing plugin would require a fork; a 30-line custom plugin is the
// honest path.
//
// IMPORTANT — Capacitor 8 plugin registration:
// Capacitor 8 does NOT auto-discover plugins via the `CAP_PLUGIN` macro at
// runtime. It reads `packageClassList` in `ios/App/App/capacitor.config.json`
// and instantiates each class via `NSClassFromString`. `SharedStorePlugin`
// must appear in that list or this plugin is silently absent from the
// bridge (every call rejects, every write is a no-op, widget stays empty).
//
// `npx cap sync ios` regenerates `packageClassList` by scanning installed
// npm packages — it doesn't know about local plugins, so it WILL overwrite
// any manual addition. After every cap sync, re-add "SharedStorePlugin" to
// the list. See ios/App/ZonnaWidgetExtension/README.md → Step 5 for the
// post-sync recovery.

@objc(SharedStorePlugin)
public class SharedStorePlugin: CAPPlugin {

    // Must match the App Group identifier configured in Xcode on BOTH
    // the main app and the widget extension. See ZonnaWidgetExtension/README.md.
    private let appGroupId = "group.app.zonna.ios"

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }
        guard let value = call.getString("value") else {
            call.reject("value required (string only at v1)")
            return
        }
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("App Group \(appGroupId) not available — check entitlements")
            return
        }
        defaults.set(value, forKey: key)
        // Force WidgetKit to rebuild timelines so the new payload is visible
        // on the home screen without waiting for the next scheduled refresh
        // (iOS otherwise caches aggressively, leaving the widget stale).
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve(["ok": true])
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("App Group \(appGroupId) not available — check entitlements")
            return
        }
        let value = defaults.string(forKey: key)
        call.resolve(["value": value as Any])
    }

    @objc func remove(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }
        guard let defaults = UserDefaults(suiteName: appGroupId) else {
            call.reject("App Group \(appGroupId) not available — check entitlements")
            return
        }
        defaults.removeObject(forKey: key)
        call.resolve(["ok": true])
    }

    // ─── HK-NATIVE-BG-INGEST-01 — secure store for the native ingest credential ───
    //
    // Same key/value shape as set/get/remove above, different backing store.
    // The web layer writes the credential blob here on boot and on every auth
    // change (lib/health/nativeCredential.ts); HealthObserverPlugin reads it
    // during a background workout wake.

    @objc func setSecure(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }
        guard let value = call.getString("value") else {
            call.reject("value required")
            return
        }
        guard ZonnaKeychain.set(value, for: key) else {
            call.reject("keychain write failed for \(key)")
            return
        }
        call.resolve(["ok": true])
    }

    @objc func getSecure(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }
        call.resolve(["value": ZonnaKeychain.get(key) as Any])
    }

    @objc func removeSecure(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key required")
            return
        }
        _ = ZonnaKeychain.remove(key)
        call.resolve(["ok": true])
    }
}
