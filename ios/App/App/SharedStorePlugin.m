// WIDGET-01 — Objective-C registration for SharedStorePlugin (Capacitor
// requires this bridge file to expose Swift plugins to the JS layer).
// Method names here MUST match the @objc func declarations in
// SharedStorePlugin.swift.

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(SharedStorePlugin, "SharedStore",
    CAP_PLUGIN_METHOD(set,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(get,    CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(remove, CAPPluginReturnPromise);
)
