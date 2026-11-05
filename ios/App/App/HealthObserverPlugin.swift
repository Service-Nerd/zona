import Foundation
import Capacitor
import HealthKit
import UIKit

// HR-SYNC-03 — HKObserverQuery background delivery plugin.
//
// Registers HKObserverQuery + enableBackgroundDelivery for the sample types
// that drive the coaching pipeline: workouts (runs), heartRate,
// restingHeartRate, heartRateVariabilitySDNN, sleepAnalysis. When HealthKit
// notifies the app (foreground or warm-background), notifyListeners fires the
// JS event, which calls clientSync.syncOnAppOpen() to ingest the run + pending
// HR samples — which is what triggers the server-side run-analysis push.
//
// Observing `workouts` directly (not just heartRate) is essential: an
// iPhone-only runner with no Apple Watch produces a run with NO HR stream, so
// an HR-only observer would never wake for their runs. The workout observer
// fires on the run itself.
//
// Thread safety: HKObserverQuery callbacks run on arbitrary background
// threads. notifyListeners() dispatches to the main thread internally
// (Capacitor 8 guarantee), so no DispatchQueue.main.async wrapper is needed.
//
// Background delivery scope:
//   foreground / warm-bg: callback fires → notifyListeners → JS → syncOnAppOpen ✅
//   fully killed by iOS:  callback fires → notifyListeners is a no-op (no JS
//                         runtime yet) → data picked up on next cold-start open.
//
// ─── HK-NATIVE-BG-INGEST-01 (2026-11-05) — the native ingest path ───────────
//
// 🔴 notifyListeners REACHING JS IS NOT THE SAME AS THE POST COMPLETING, and
// that gap is the whole defect. Measured over 6,090 hidden `observer_*`
// sweeps: the wake fires, JS runs, 1,462 workouts post — and **331 are lost,
// 316 of them to `no-response: Load failed`**, which is WebKit's error when
// iOS suspends a backgrounded WKWebView mid-`fetch`. Median time-to-link was
// **2 h 15 m**, with only 22% of runs linked inside a quarter of an hour.
//
// So on a WORKOUT wake this plugin now also posts the run ITSELF, from native
// code, which iOS does not suspend the same way. Three deliberate limits:
//
//   1. **Shell payload only — no heart rate.** `HK-HR-LOCKED-DROPS-RUN-01`
//      already ratified the principle ("the run is the record, HR is an
//      enrichment, posting without HR is a DEFERRAL to machinery built for
//      it"), and `retryPendingHrRows` + `decideLateArrival` own HR landing
//      later. This also avoids re-implementing the per-workout HR sample cap
//      in Swift, which would be a second producer of a shared numeric.
//   2. **No token refresh.** Supabase ROTATES refresh tokens on use, so a
//      native refresher racing the webview's own would cause random
//      sign-outs — a worse regression than the bug. An expired credential is
//      a silent no-op here; the next app-open still handles the run.
//   3. **Idempotent by the server, not by us.** `/api/health/ingest` upserts
//      on `(user_id, apple_health_uuid)`, so this row and the web path's
//      later full-HR row CONVERGE instead of duplicating. That upsert is the
//      single reason two producers are safe; do not remove it.
//
// ⚠️ The HKObserverQuery completionHandler is still acknowledged immediately
// (see `defer` below) while the POST runs under a UIApplication background
// task. A process death mid-POST therefore loses THAT delivery rather than
// re-triggering it — recoverable, because the watermark only advances on a
// 2xx and the web sweep re-finds anything missed.
//
// Idempotency: register() is a no-op if called more than once per app session.
// The _registered flag prevents duplicate HKObserverQuery registrations, which
// would create spurious background wakeups.
//
// IMPORTANT — Capacitor 8 registration:
// Capacitor 8 does NOT auto-discover local plugins via the CAP_PLUGIN macro.
// Add "HealthObserverPlugin" to `packageClassList` in capacitor.config.json.
// `npx cap sync ios` regenerates that file from npm packages only and WILL
// remove this entry — re-add after every cap sync (same as SharedStorePlugin).

@objc(HealthObserverPlugin)
public class HealthObserverPlugin: CAPPlugin {

    private let healthStore = HKHealthStore()
    private var _registered  = false

    @objc func register(_ call: CAPPluginCall) {
        guard !_registered else {
            call.resolve(["ok": true, "skipped": true])
            return
        }
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit not available on this device")
            return
        }

        _registered = true

        // heartRate drives the HR-pending resolution pipeline.
        let hrType    = HKObjectType.quantityType(forIdentifier: .heartRate)!

        // Recovery types — background delivery for overnight readiness metrics.
        // Wakes the pipeline as soon as Apple Watch syncs RHR/HRV/sleep, so the
        // readiness signal reflects last night before the user opens the app.
        let rhrType   = HKObjectType.quantityType(forIdentifier: .restingHeartRate)!
        let hrvType   = HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!
        let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!

        // Workouts — a completed run writes to HealthKit when it ends (Apple
        // Watch on end, or the source app on save). Observing the workout type
        // directly is what wakes the app to ingest a new run and fire the
        // server-side run-analysis push — including HR-less iPhone-only runs
        // that the heartRate observer never sees.
        let workoutType = HKObjectType.workoutType()

        let hrTypes:       [HKObjectType] = [hrType]
        let recoveryTypes: [HKObjectType] = [rhrType, hrvType, sleepType]

        // HK-NATIVE-BG-INGEST-01 — only the WORKOUT observer runs the native
        // ingest. HR and recovery wakes create no activity row, so giving them
        // an ingest attempt would be requests with nothing to send.
        observe(workoutType, event: "workoutDataArrived", nativeIngest: true)
        for type in hrTypes {
            observe(type, event: "hrDataArrived")
        }
        for type in recoveryTypes {
            observe(type, event: "recoveryDataArrived")
        }

        call.resolve(["ok": true, "skipped": false])
    }

    // ─── Private ────────────────────────────────────────────────────────────

    private func observe(_ objectType: HKObjectType, event: String, nativeIngest: Bool = false) {
        guard let sampleType = objectType as? HKSampleType else { return }

        // enableBackgroundDelivery registers with iOS to wake (or resume) this
        // process when new samples of this type land in HealthKit, even when the
        // app is in the background. .immediate = as soon as the Watch syncs.
        healthStore.enableBackgroundDelivery(for: sampleType, frequency: .immediate) { success, error in
            if let error = error {
                print("[HealthObserver] Background delivery setup failed for \(sampleType.identifier): \(error.localizedDescription)")
            }
        }

        let query = HKObserverQuery(sampleType: sampleType, predicate: nil) {
            [weak self] _, completionHandler, error in
            // MUST call completionHandler — HealthKit waits for this to consider
            // the delivery acknowledged. Use defer so it fires even on early exit.
            defer { completionHandler() }
            guard let self = self, error == nil else { return }
            self.notifyListeners(event, data: [:])
            // notifyListeners is a no-op with no JS runtime, and even with one
            // the webview may be suspended mid-POST — which is the measured
            // failure. The native attempt is additive, never a replacement.
            if nativeIngest { self.attemptNativeIngest() }
        }

        healthStore.execute(query)
    }

    // ─── HK-NATIVE-BG-INGEST-01 — native ingest ─────────────────────────────

    /// Keychain key written by `lib/health/nativeCredential.ts`.
    private static let credentialKey = "zonna_native_credential"
    /// App-Group key holding the end date of the newest workout we posted.
    private static let watermarkKey  = "zonna_native_last_ingest_at"
    private static let appGroupId    = "group.app.zonna.ios"
    /// Never look back further than this, so a long-dormant install does not
    /// post a month of history from a background wake.
    private static let maxLookbackSeconds: TimeInterval = 24 * 60 * 60
    /// Bounded so one wake cannot fan out into dozens of requests.
    private static let maxWorkoutsPerWake = 5
    /// Clock-skew margin: treat a credential expiring within this as expired.
    private static let expiryMarginSeconds: TimeInterval = 60

    /// Guards against two wakes ingesting concurrently (HR and workout
    /// observers can fire together).
    private let ingestGate = NSLock()
    private var ingestInFlight = false

    private struct NativeCredential: Decodable {
        let base_url: String
        let access_token: String
        /// Unix seconds, straight from the Supabase session.
        let expires_at: Double
    }

    /// Fire-and-forget. Every exit is silent by design: this is a background
    /// best-effort path and the web sweep remains the backstop.
    private func attemptNativeIngest() {
        ingestGate.lock()
        if ingestInFlight { ingestGate.unlock(); return }
        ingestInFlight = true
        ingestGate.unlock()

        let release = { [weak self] in
            guard let self = self else { return }
            self.ingestGate.lock()
            self.ingestInFlight = false
            self.ingestGate.unlock()
        }

        guard let raw = ZonnaKeychain.get(Self.credentialKey),
              let data = raw.data(using: .utf8),
              let cred = try? JSONDecoder().decode(NativeCredential.self, from: data) else {
            release(); return
        }
        // No refresh, on purpose (see header note 2).
        guard cred.expires_at - Self.expiryMarginSeconds > Date().timeIntervalSince1970 else {
            release(); return
        }
        guard let base = URL(string: cred.base_url),
              let endpoint = URL(string: "/api/health/ingest", relativeTo: base) else {
            release(); return
        }

        // A background task assertion is what buys the time to finish the POST.
        // Without it this path is suspended exactly like the webview it replaces.
        //
        // ⚠️ HELD IN A LOCKED HOLDER, NOT A CAPTURED `var`. The expiration
        // handler and the Task's `defer` both end it, from different threads;
        // a plain captured variable allows a double `endBackgroundTask` (and
        // is an error once this target moves to the Swift 6 language mode).
        let assertion = BackgroundAssertion(name: "zonna.native-ingest")

        Task { [weak self] in
            defer {
                release()
                assertion.end()
            }
            guard let self = self else { return }
            let since = self.ingestWatermark()
            let runs  = (try? await self.recentRunningWorkouts(since: since)) ?? []
            guard !runs.isEmpty else { return }

            // 🔴 OLDEST FIRST, AND THE WATERMARK ONLY EVER REACHES THE LAST
            // CONTIGUOUS SUCCESS. The first cut sorted NEWEST first and broke
            // on failure, which silently stranded runs: newest posts, the
            // older one fails, the watermark lands on the newest end date and
            // the failed run is now BELOW it — never offered again by this
            // path. Same for `maxWorkoutsPerWake` truncation. Ascending plus
            // a contiguous watermark is also exactly what the web sweep does
            // ("post oldest first so partial failures still advance lastSync"),
            // so the two producers agree about partial progress too.
            var confirmedThrough: Date?
            for workout in runs {
                guard let body = Self.shellPayload(for: workout) else { continue }
                guard await Self.post(body, to: endpoint, token: cred.access_token) else { break }
                confirmedThrough = workout.endDate
            }
            if let through = confirmedThrough { self.setIngestWatermark(through) }
        }
    }

    // ─── watermark ──────────────────────────────────────────────────────────

    private func ingestWatermark() -> Date {
        let floorDate = Date().addingTimeInterval(-Self.maxLookbackSeconds)
        guard let defaults = UserDefaults(suiteName: Self.appGroupId) else { return floorDate }
        let stored = defaults.double(forKey: Self.watermarkKey)
        guard stored > 0 else { return floorDate }
        return max(Date(timeIntervalSince1970: stored), floorDate)
    }

    private func setIngestWatermark(_ date: Date) {
        UserDefaults(suiteName: Self.appGroupId)?
            .set(date.timeIntervalSince1970, forKey: Self.watermarkKey)
    }

    // ─── HealthKit read ─────────────────────────────────────────────────────

    /// Running workouts that ENDED after `since`, OLDEST FIRST.
    ///
    /// Ascending is load-bearing, not cosmetic: the caller advances the
    /// watermark through contiguous successes, which is only safe if the runs
    /// arrive in time order.
    ///
    /// `.running` only, matching the web sweep's `workoutType: 'running'` —
    /// two producers must not disagree about what counts as a run.
    private func recentRunningWorkouts(since: Date) async throws -> [HKWorkout] {
        try await withCheckedThrowingContinuation { continuation in
            let isRun = HKQuery.predicateForWorkouts(with: .running)
            let ended = HKQuery.predicateForSamples(withStart: since, end: nil, options: .strictEndDate)
            let query = HKSampleQuery(
                sampleType: HKObjectType.workoutType(),
                predicate: NSCompoundPredicate(andPredicateWithSubpredicates: [isRun, ended]),
                limit: Self.maxWorkoutsPerWake,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: true)]
            ) { _, samples, error in
                if let error = error { continuation.resume(throwing: error); return }
                continuation.resume(returning: (samples as? [HKWorkout]) ?? [])
            }
            healthStore.execute(query)
        }
    }

    // ─── payload ────────────────────────────────────────────────────────────

    /// The SHELL only. Field names and types are the `HealthKitWorkoutPayload`
    /// contract in `lib/health/adapter.ts` — if that interface changes, this
    /// must change with it. `lib/health/nativeIngestContract.test.ts` asserts
    /// the two still agree.
    private static func shellPayload(for workout: HKWorkout) -> Data? {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime]
        let meters = workout.totalDistance?.doubleValue(for: .meter()) ?? 0
        // 🔴 DO NOT GUARD ON DISTANCE. The first cut skipped `meters == 0`
        // "because the server 422s it" — a STALE PREMISE I wrote: that
        // rejection was removed by HK-ZERO-DISTANCE-RUN-01 (2026-10-08) after
        // a real 32-minute Garmin treadmill run was refused on every single
        // sweep, forever. Distance is OPTIONAL on that route and DURATION is
        // required ("a run must be measurable on at least one axis, and time
        // on feet is the one HealthKit always has"). Guarding here would have
        // re-excluded the exact indoor cohort that ruling rescued, on the new
        // fast path only — invisibly, because the web sweep still posts them.
        guard workout.duration > 0 else { return nil }
        let payload: [String: Any] = [
            "uuid":                workout.uuid.uuidString,
            "startDate":           iso.string(from: workout.startDate),
            "endDate":             iso.string(from: workout.endDate),
            "totalDistanceMeters": meters,
            "durationSeconds":     workout.duration,
            "workoutType":         "running",
            "sourceName":          workout.sourceRevision.source.name,
        ]
        return try? JSONSerialization.data(withJSONObject: payload)
    }

    // ─── POST ───────────────────────────────────────────────────────────────

    /// `X-Ingest-Path: native` is read by the route purely so this path is
    /// visible in `ops_events`. Telemetry lives server-side on purpose — a
    /// native ops POST would be a second thing that can fail silently, which
    /// is the defect class this feature exists to fix.
    private static func post(_ body: Data, to url: URL, token: String) async -> Bool {
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.httpBody = body
        req.timeoutInterval = 25
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("native", forHTTPHeaderField: "X-Ingest-Path")
        do {
            let (_, response) = try await URLSession.shared.data(for: req)
            guard let http = response as? HTTPURLResponse else { return false }
            return (200...299).contains(http.statusCode)
        } catch {
            return false
        }
    }
}

/// HK-NATIVE-BG-INGEST-01 — a `UIBackgroundTaskIdentifier` that cannot be
/// ended twice. Both the expiration handler and the completing Task want to
/// end it, from different threads.
private final class BackgroundAssertion {
    private let lock = NSLock()
    private var id: UIBackgroundTaskIdentifier = .invalid

    init(name: String) {
        let started = UIApplication.shared.beginBackgroundTask(withName: name) { [weak self] in
            self?.end()
        }
        lock.lock(); id = started; lock.unlock()
    }

    func end() {
        lock.lock()
        let taken = id
        id = .invalid
        lock.unlock()
        if taken != .invalid { UIApplication.shared.endBackgroundTask(taken) }
    }
}
