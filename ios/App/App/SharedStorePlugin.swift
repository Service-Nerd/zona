import Foundation
import Capacitor
import WidgetKit

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
}
