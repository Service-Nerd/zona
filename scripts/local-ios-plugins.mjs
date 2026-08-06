// Single source of truth for CUSTOM (local) Capacitor plugin class names that
// must be present in ios/App/App/capacitor.config.json → packageClassList.
//
// Why this file exists: Capacitor 8 only auto-discovers plugins that ship as
// npm packages. It instantiates each name in `packageClassList` via
// NSClassFromString. Local Swift plugins (ours) are NOT npm packages, so
// `npx cap sync ios` regenerates that list from installed packages and DROPS
// every local plugin each time it runs. A missing entry = the plugin silently
// never loads (every JS call rejects) — e.g. the widget stays empty, or
// background HealthKit delivery dies and run-analysis pushes only fire on
// manual app-open.
//
// Add EVERY local plugin here. `fix-cap-config.mjs` re-adds them after a sync;
// `verify-cap-config.mjs` fails loudly if any is missing (wire into the build).
export const LOCAL_IOS_PLUGINS = [
  'SharedStorePlugin',    // App-Group bridge for the home-screen widget
  'HealthObserverPlugin', // HKObserverQuery background delivery — drives background run-analysis push (HR-SYNC-03)
]
