// HR-SYNC-03 — Objective-C bridge for HealthObserverPlugin.
// Method names MUST match the @objc func declarations in HealthObserverPlugin.swift.

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(HealthObserverPlugin, "HealthObserver",
    CAP_PLUGIN_METHOD(register, CAPPluginReturnPromise);
)
