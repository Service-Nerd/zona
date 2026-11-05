// Minimal stand-ins for the two modules the macOS SDK cannot provide, so the
// REAL plugin sources can be typechecked locally. Signatures only — any
// mismatch with the real Capacitor/UIKit API is NOT caught here.
import Foundation

open class CAPPluginCall: NSObject {
    public func getString(_ key: String) -> String? { nil }
    public func resolve(_ data: [String: Any]) {}
    public func reject(_ message: String) {}
}
open class CAPPlugin: NSObject {
    public override init() { super.init() }
    public func notifyListeners(_ eventName: String, data: [String: Any]) {}
}

public struct UIBackgroundTaskIdentifier: Equatable {
    public static let invalid = UIBackgroundTaskIdentifier()
}
public final class UIApplication {
    public static let shared = UIApplication()
    public func beginBackgroundTask(withName: String, expirationHandler: (() -> Void)? = nil) -> UIBackgroundTaskIdentifier { .invalid }
    public func endBackgroundTask(_ id: UIBackgroundTaskIdentifier) {}
}
