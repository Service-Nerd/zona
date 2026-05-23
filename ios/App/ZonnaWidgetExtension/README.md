# WIDGET-01 — Xcode setup

This folder contains the **source files** for the Zonna iOS home-screen widget. The Swift / Info.plist / entitlements are committed, but the **Xcode target itself isn't** — adding an app extension target is a manual step that mutates `App.xcodeproj/project.pbxproj` in ways that are unsafe to script from outside Xcode.

This README walks through what you need to do once, in order, in Xcode and the Apple Developer portal, to make the widget actually appear on a device.

Estimated time end-to-end: **30–45 minutes**, assuming you already have an Apple Developer team selected on the main app.

---

## Pre-flight checklist

Before opening Xcode, confirm:

- [ ] `npx cap sync ios` has been run since this branch was checked out. This copies the JS bundle + Capacitor plugins (including the new `SharedStore` plugin) into the iOS project.
- [ ] You're signed in to your Apple Developer account in Xcode (`Xcode → Settings → Accounts`).
- [ ] The main app builds + runs on the simulator on its own. If it doesn't, fix that first — widget setup will not unblock a broken main app.

---

## Step 1 — Apple Developer portal: App Group identifier

The widget and the main app share data via an **App Group**. Both must declare the same group identifier in their entitlements, and that identifier must exist in the Developer portal.

1. Go to **developer.apple.com → Certificates, Identifiers & Profiles → Identifiers**.
2. Filter by type: **App Groups**.
3. If `group.app.zonna.ios` already exists, skip ahead. Otherwise: **+ → App Groups → Continue**, name it `Zonna App Group`, identifier `group.app.zonna.ios`, register.
4. Back in the **App IDs** tab, open the existing `app.zonna.ios` app identifier, scroll to **Capabilities**, enable **App Groups**, click **Edit** next to it, tick `group.app.zonna.ios`, save.

The code in this branch already references `group.app.zonna.ios` everywhere — don't rename unless you're prepared to update three files (`SharedStorePlugin.swift`, `ZonnaWidget.swift`, both `.entitlements` files plus the widget's own).

---

## Xcode 16 behaviour you should know about

This setup was completed on Xcode 16, which uses **file-system synchronized groups** for new targets. Important differences from older docs:

- **No "Language" picker.** Widget Extension is Swift-only in modern Xcode — there's no Swift/ObjC choice in the new-target dialog.
- **Synchronized folder = auto-membership.** When you add a Widget Extension target, Xcode creates a `PBXFileSystemSynchronizedRootGroup` pointing at the widget folder. **Every file in that folder is automatically a member of the widget target.** You do NOT need "Add Files to…" for files already in the folder — they're picked up on disk.
- **No Target Membership tickbox per file.** Files inside a synchronized group don't show the usual Target Membership panel. Membership is folder-wide.
- **Target name has "Extension" appended.** Despite naming your target `ZonnaWidgetExtension`, Xcode creates it as `ZonnaWidgetExtensionExtension`. The bundle ID is correct (`app.zonna.ios.ZonnaWidgetExtension`); just the internal target name is double-suffixed. Don't panic.
- **Xcode auto-generates its own entitlements.** When you tick App Groups on the widget target, Xcode creates `ios/App/ZonnaWidgetExtensionExtension.entitlements` (sibling to the `App/` folder) and points the build setting at it. The committed `ZonnaWidgetExtension/ZonnaWidgetExtension.entitlements` becomes unused — both files exist on disk but the build uses the auto-generated one.

---

## Step 2 — Xcode: add the widget extension target

1. Open `ios/App/App.xcworkspace` in Xcode (not `App.xcodeproj` — Capacitor uses the workspace).
2. **File → New → Target…**
3. Pick **Widget Extension** (under iOS → Application Extension).
4. Configure:
   - **Product Name:** `ZonnaWidgetExtension`
   - **Bundle Identifier:** Xcode will suggest `app.zonna.ios.ZonnaWidgetExtension` — accept it.
   - **Team:** your usual team.
   - **Include Configuration Intent:** **uncheck**. We use `StaticConfiguration`, not intents.
5. Finish.

Xcode generates boilerplate Swift files in the widget folder (typically `ZonnaWidgetExtensionBundle.swift` + `ZonnaWidgetExtension.swift`) **and adds them to the synchronized group alongside the committed files.**

6. In the Project Navigator, expand the `ZonnaWidgetExtension` group.
7. **Delete only the auto-generated Swift files** — `ZonnaWidgetExtensionBundle.swift` and `ZonnaWidgetExtension.swift` (whichever Xcode created). Choose **Move to Trash**.
8. **Leave alone:** `ZonnaWidget.swift`, `Info.plist`, `ZonnaWidgetExtension.entitlements`, `Assets.xcassets`, `README.md`. These are committed and should stay.

**If you accidentally delete `ZonnaWidget.swift` or `Info.plist`:** they're tracked. Restore with `git restore ios/App/ZonnaWidgetExtension/ZonnaWidget.swift ios/App/ZonnaWidgetExtension/Info.plist`. The synchronized group will auto-re-include them.

---

## Step 3 — Xcode: enable App Group capability on BOTH targets

This is the most-forgotten step. Both targets need the capability tied to the same group ID.

**Main app:**
1. Select the `App` project in the navigator → select the `App` target.
2. **Signing & Capabilities** tab → **+ Capability** → search "App Groups", add it.
3. Tick `group.app.zonna.ios`.

**Widget:**
1. Same project → select the `ZonnaWidgetExtension` target.
2. **Signing & Capabilities** tab → **+ Capability** → "App Groups".
3. Tick `group.app.zonna.ios`.

If the group doesn't appear in the list, click the refresh icon — Xcode sometimes needs a nudge to fetch new portal-side groups.

---

## Step 4 — Xcode: entitlements paths

Xcode handles this automatically when you add the App Groups capability. After step 3 the build settings should look like:

- `App` target → Build Settings → **Code Signing Entitlements**:
  - Debug: `App/App.entitlements`
  - Release: `App/AppRelease.entitlements`
- `ZonnaWidgetExtensionExtension` target → Build Settings → **Code Signing Entitlements**:
  - Debug + Release: `ZonnaWidgetExtensionExtension.entitlements` (at project root, not inside the widget folder — Xcode 16 puts it there)

All entitlements files contain the same `group.app.zonna.ios` value.

---

## Step 4b — Fix the duplicate Info.plist build error

On the **first build** you'll hit:

> Multiple commands produce '…/ZonnaWidgetExtensionExtension.appex/Info.plist'

Cause: the synchronized folder auto-includes `Info.plist` as a Copy Bundle Resources entry, but the target also uses it via `INFOPLIST_FILE`. Two paths writing the same output.

Fix:
1. Select the `App` project → `ZonnaWidgetExtensionExtension` target → **Build Phases**.
2. Expand **Copy Bundle Resources**.
3. Select `Info.plist`, click **−** to remove it.

Xcode adds a `PBXFileSystemSynchronizedBuildFileExceptionSet` to the pbxproj to remember the exclusion. Build again — error gone.

---

## Step 4c — Match the build numbers

You'll also see a warning:

> The CFBundleVersion of an app extension ('1') must match that of its containing parent app ('N').

Cause: Xcode initialises widget targets at `CURRENT_PROJECT_VERSION = 1` / `MARKETING_VERSION = 1.0`, regardless of what the main app is at.

Fix: update the widget target's build settings (Build Settings tab → search "versioning") so:
- `CURRENT_PROJECT_VERSION` matches the main app
- `MARKETING_VERSION` matches the main app

Re-check on every new TestFlight build — when you bump the main app, **bump the widget too** or this warning returns.

---

## Step 5 — Verify the SharedStore plugin compiles

The new `SharedStorePlugin.swift` + `SharedStorePlugin.m` files are inside `ios/App/App/` — they're part of the main app, not the widget. They should auto-appear in the `App` target after `npx cap sync ios`. If they don't:

1. Right-click the `App` group in the navigator → **Add Files to "App"…**.
2. Add `SharedStorePlugin.swift` and `SharedStorePlugin.m`.
3. Tick the **`App`** target only (not the widget — the widget doesn't use Capacitor).

---

## Step 6 — Build + run on a device or simulator

1. Select the **main `App` scheme** (not the widget scheme) and a device/simulator.
2. **Cmd-B** to build, **Cmd-R** to run.
3. Open the app, sign in, generate or load a plan.
4. Background the app.
5. Long-press the home screen → **+** (top-left on iOS 17+, or top-left after wiggle on older) → search "Zonna" → tap → choose **Small** or **Medium** → **Add Widget**.

If everything is wired correctly:
- **Small widget**: shows the days-to-race countdown + race name, or today's session if no race date.
- **Medium widget**: race countdown on the left, today's session on the right.

If you see "Open the app to set up your widget", the App Group write hasn't happened yet — open the main app once, log in, then long-press the widget and tap **Edit Widget** (or just remove + re-add) to nudge a timeline reload.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Widget shows the placeholder forever | Main app hasn't been opened on the device, OR App Group ID mismatch between targets — verify both targets list `group.app.zonna.ios` in Signing & Capabilities. |
| Xcode signing error "missing entitlements" | App Group is in `.entitlements` but not enabled on the Apple Developer portal App ID. See Step 1. |
| Widget shows stale data | WidgetKit caches timelines aggressively. Force a reload: remove the widget, add it again. Or wait until next local midnight (the timeline naturally re-fires). |
| Build error "No such module 'WidgetKit'" | The `ZonnaWidget.swift` file is in the main app target instead of the widget extension. Re-check the **Target Membership** panel — should be widget-only. |
| Build error referencing `CAPPluginCall` | `SharedStorePlugin.swift` / `.m` need to be in the **main app** target, not the widget extension. The widget doesn't link Capacitor. |

---

## Files in this folder

| File | Purpose |
|---|---|
| `ZonnaWidget.swift` | Widget definition, `TimelineProvider`, `SwiftUI` views for small + medium families. |
| `Info.plist` | Standard WidgetKit extension Info.plist. |
| `ZonnaWidgetExtension.entitlements` | App Group entitlement for the widget process. |
| `README.md` | This file. |

## Files in the main app for this feature

| File | Purpose |
|---|---|
| `ios/App/App/SharedStorePlugin.swift` + `.m` | Custom Capacitor plugin that lets JS write to the App Group's UserDefaults. |
| `ios/App/App/App.entitlements` + `AppRelease.entitlements` | App Group entitlement on the main app process. |

## JS-side files

| File | Purpose |
|---|---|
| `lib/native/sharedStore.ts` | TS binding for the `SharedStore` plugin. |
| `lib/widget/widgetState.ts` | Pure function that builds the JSON payload the widget reads. |
| `lib/widget/useWidgetSync.ts` | React hook called from `DashboardClient` — writes state on plan changes. |
