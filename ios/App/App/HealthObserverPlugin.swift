import Foundation
import Capacitor
import HealthKit

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

        observe(workoutType, event: "workoutDataArrived")
        for type in hrTypes {
            observe(type, event: "hrDataArrived")
        }
        for type in recoveryTypes {
            observe(type, event: "recoveryDataArrived")
        }

        call.resolve(["ok": true, "skipped": false])
    }

    // ─── Private ────────────────────────────────────────────────────────────

    private func observe(_ objectType: HKObjectType, event: String) {
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
        }

        healthStore.execute(query)
    }
}
