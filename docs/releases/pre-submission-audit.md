# Pre-Submission Audit — Zonna v1

**Date:** 2026-05-21
**Auditor:** Claude (Opus 4.7)
**Scope:** Apple §3.1.2(a) subscription disclosure, §5.1.1 privacy/data, Info.plist usage strings, cleanup-before-Release-build review, Data Privacy questionnaire prep.

---

## TL;DR

**One genuine submission blocker, two low-risk gaps, two pieces of debt safe to defer.**

- 🔴 **BLOCKER**: `ITSAppUsesNonExemptEncryption` is not declared in `Info.plist`. Without it, every submission triggers an export-compliance manual review (~24h delay) and Apple will email you to add it. Add `<false/>` (we use only standard HTTPS via WKWebView + Capacitor + Anthropic SSL).
- 🟡 **LOW**: `UIRequiredDeviceCapabilities` contains `armv7` (32-bit). Should be `arm64`. Not a rejection vector but flagged in some validators.
- 🟡 **LOW**: AdminScreen + impersonation lives in the Release binary, gated only by `user_settings.is_admin`. Functional; worth confirming no demo/test account ships with the flag set.
- 🟢 **DEFERRED**: `vetra-*` CSS keyframes and `vetra_healthkit_last_sync_ts` storage key — documented as BRAND-06 / BRAND-07. Internal-only, not visible to Apple.
- 🟢 **DEFERRED**: 30+ files with `console.log` calls. Apple does not reject for log output; cleanup is post-launch hygiene.

Everything else (HealthKit usage strings, subscription disclosure UI, entitlements split, push environment) audits cleanly.

---

## 1. Apple Data Privacy questionnaire — ready-to-paste answers

App Store Connect → App Privacy → Data Types Collected. Apple presents each category; toggle "Yes" or "No"; for each Yes, declare purposes, whether linked to user, and whether used for tracking. Answers below have all been audited against the codebase.

### Data the app DOES collect

| Apple category | What | Source | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|---|
| **Contact Info → Name** | First + last name | Google/Apple OAuth metadata | ✅ Yes | ❌ No | App Functionality |
| **Contact Info → Email Address** | Sign-in email | Supabase Auth | ✅ Yes | ❌ No | App Functionality |
| **Health & Fitness** | Workouts, route summaries, RHR, HRV, sleep | Apple HealthKit (read-only) | ✅ Yes | ❌ No | App Functionality (training analysis & coaching) |
| **Identifiers → User ID** | Supabase UUID | Created on signup | ✅ Yes | ❌ No | App Functionality |
| **Identifiers → Device ID** | APNs token (iOS push) | Capacitor PushNotifications plugin | ✅ Yes | ❌ No | App Functionality (push delivery only) |
| **User Content → Other** | Training plan JSON, session completion notes, RPE values, recent-tweak adjustments | User input + server-side generation | ✅ Yes | ❌ No | App Functionality |
| **Usage Data → Product Interaction** | Trial start timestamp, last adjustment check timestamp, dismissal timestamps (zone-drift, benchmark-recal) | App writes to `user_settings` | ✅ Yes | ❌ No | App Functionality (gating logic only) |

**Tracking = "No" on every row.** Apple defines tracking as linking data with third-party data for advertising. Zonna does neither — no IDFA collection, no ad SDKs, no third-party data sharing.

### Data the app does NOT collect (declare "No")

- Financial Info (Apple handles IAP; we don't see card data)
- Location (no `NSLocationWhenInUseUsageDescription`, no CLLocation calls)
- Sensitive Info (no race/ethnicity/religion/orientation collection)
- Contacts (no Contacts framework access)
- Browsing History (no in-app browser tracking)
- Search History (no search feature)
- Diagnostics (Apple auto-collects crash logs; not us — no Sentry/Crashlytics SDK)
- Audio Data (no microphone access)
- Photos or Videos
- Customer Support (no in-app support form that stores tickets)

### Tracking & ATT

Apple asks: **Does this app use data for tracking purposes?** → **No.**
- No IDFA collected
- No `AppTrackingTransparency` framework linked
- No `NSUserTrackingUsageDescription` in Info.plist (correct — would be required only if you tracked)
- No ad networks integrated
- No analytics SDKs (confirmed: package.json has no Sentry / PostHog / Mixpanel / Amplitude / Firebase / Segment / Datadog)

### Privacy Policy URL field

```
https://www.zonna.run/privacy
```

Verify the URL returns 200 immediately before submitting — Apple's bot crawls it during review.

---

## 2. Info.plist audit

**File:** `ios/App/App/Info.plist`

### What's good ✅

- `CFBundleDisplayName` = `Zonna` (hardcoded, but matches `BRAND.name` — acceptable since Info.plist is not user-facing config)
- `CFBundleIdentifier` = `$(PRODUCT_BUNDLE_IDENTIFIER)` (= `app.zonna.ios` per project settings)
- `CFBundleURLTypes` correctly registers `app.zonna.ios://` for OAuth deep links
- `NSHealthShareUsageDescription`:
  > *"Zonna reads your runs and recovery signals (resting heart rate, HRV, sleep) to provide coaching feedback. Zonna never writes to Apple Health."*

  **This is genuinely strong copy.** Apple §5.1.1 cares about specificity, honesty, and naming the use. This hits all three.
- `NSHealthUpdateUsageDescription`:
  > *"Zonna does not write to Apple Health. This app only reads activity and recovery data to provide training coaching."*

  Apple requires this even when you don't write, because the HealthKit entitlement implies the capability. Wording explicitly disclaims it — perfect.
- `UIViewControllerBasedStatusBarAppearance` = `true` (matches Capacitor status-bar setup)

### What's missing 🔴

- **`ITSAppUsesNonExemptEncryption`** — **BLOCKER for first clean submission.** Apple requires every iOS app to declare whether it uses non-exempt cryptography. WKWebView + standard HTTPS (TLS) is exempt under the "exempt encryption" category (it's standard Internet protocol use, not custom crypto). Declaring `<false/>` skips the export-compliance review step on every submission.

  **Add this to `Info.plist`** before next archive:
  ```xml
  <key>ITSAppUsesNonExemptEncryption</key>
  <false/>
  ```

  Insert anywhere inside the top-level `<dict>`. No other changes needed.

### What's odd but not blocking 🟡

- **`UIRequiredDeviceCapabilities`** lists `armv7`. iOS 11+ dropped 32-bit support; every modern device is `arm64`. This is harmless on the App Store (armv7 just means "must have an ARMv7-or-better chip" which everything does), but some lint tools flag it. **Optional cleanup:** change to `<string>arm64</string>`.

- **`UISupportedInterfaceOrientations` (non-iPad)** includes `LandscapeLeft` + `LandscapeRight`. The app is portrait-only by visual design. Worth setting to portrait-only so users can't accidentally rotate into a broken layout:
  ```xml
  <key>UISupportedInterfaceOrientations</key>
  <array>
      <string>UIInterfaceOrientationPortrait</string>
  </array>
  ```
  Defer if you ever want landscape later; for v1, portrait-lock is the safer call.

### Not needed (and absent — correct) ✅

- No `NSUserTrackingUsageDescription` (correct — we don't track)
- No `NSLocationWhenInUseUsageDescription` (correct — no location)
- No `NSMotionUsageDescription` (correct — no motion sensors used directly; HealthKit handles workout data)
- No `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` (correct — no upload paths in v1)

---

## 3. Entitlements split — audited

Two files exist (good practice; came in via `a9cc943`):

- **`ios/App/App/App.entitlements`** (Debug builds) — `aps-environment: development` ✅
- **`ios/App/App/AppRelease.entitlements`** (Release / TestFlight / App Store builds) — `aps-environment: production` ✅

Both include `com.apple.developer.applesignin` (Sign in with Apple) and `com.apple.developer.healthkit`. This is correct — entitlements only differ on the APNs environment, which is the whole reason to split them.

**Verify in Xcode** that the Release scheme points to `AppRelease.entitlements`. If wrong, push tokens registered in Release will be sandbox tokens that Apple's production APNs server rejects (and vice versa) — silent push failures, no error to investigate.

---

## 4. Pre-Release-build cleanup audit

### Admin surface — gated, but worth a sanity check 🟡

- `app/dashboard/DashboardClient.tsx:42` — `'admin'` is in the `Screen` type
- `app/dashboard/DashboardClient.tsx:602` — admin flag read from `user_settings.is_admin`
- `app/dashboard/DashboardClient.tsx:7935+` — AdminScreen renders only when `screen === 'admin'`
- `app/dashboard/DashboardClient.tsx:1265` — routed only when `isAdmin` is true (gate is at column read + route render)
- AdminScreen includes user impersonation via `onImpersonate`. **Critical that no production user other than you has `is_admin = true`.**

**Action:** before submitting, run this against production Supabase:
```sql
SELECT id, email, first_name, is_admin
FROM user_settings
WHERE is_admin = true;
```
Confirm the list is just you. If a stale dev account is in there, flip it off.

**Also:** the Apple reviewer's account must NOT have `is_admin` set. When you create the demo account for the Review Information field (see `app-store-copy.md`), do not flip the flag.

### Strava admin-only screen — verify

CLAUDE.md notes: *"Strava: Admin-only via URL — nav entry removed"*. Worth confirming the screen actually checks `isAdmin` before rendering, not just relying on nav-entry removal. If a non-admin can navigate to the screen via deep link or stale URL, that's a soft information leak (Strava OAuth state) but not a privacy violation.

**Action:** grep `app/dashboard/DashboardClient.tsx` for where `screen === 'strava'` is routed and confirm the gate.

### Console output — defer

30+ files contain `console.log` / `console.error` / `console.warn`. Apple does not reject for log output. Cleaning these up is a post-launch hygiene task — bundle with the BRAND-* tech-debt items. Leave alone for v1.

### Legacy `Vetra` references — defer

- `app/globals.css` — `--vetra-amber`, `--vetra-red`, `@keyframes vetra-fade-in`, `@keyframes vetra-slide-up`
- `app/dashboard/DashboardClient.tsx` — `vetra-shimmer`
- `lib/health/clientSync.ts:26` — `vetra_healthkit_last_sync_ts` storage key
- `components/shared/ZoneInfoSheet.tsx` — uses vetra CSS vars

All are internal identifiers, not user-facing. Documented as BRAND-06 + BRAND-07 in the backlog. **No action for v1.**

### Test mode / dev-only routes — none found ✅

No `/debug`, `/test`, or `/_internal` routes exist under `app/`. No conditional `process.env.NODE_ENV === 'development'` gates on user-facing rendering. ✅

---

## 5. Action checklist (before next TestFlight archive)

In order of urgency:

- [x] **Add `ITSAppUsesNonExemptEncryption: false` to `Info.plist`** — committed in `6aa16cf` (2026-05-21)
- [ ] **Verify Xcode Release scheme uses `AppRelease.entitlements`** (5 minutes — do at next archive)
- [x] **Run the `is_admin` audit query against production Supabase** — confirmed 2026-05-21: only Russ has `is_admin = true`
- [x] **Verify Strava screen gates on `isAdmin`** — defense-in-depth gate added at render boundary in `6aa16cf` (Admin screen also gated)
- [ ] **Verify `https://www.zonna.run/privacy` returns 200** (1 minute — open browser)
- [x] *(Optional, low-priority)* Change `UIRequiredDeviceCapabilities` to `arm64` — done 2026-05-21
- [x] *(Optional, low-priority)* Lock orientation to portrait-only — done 2026-05-21 (still landscape-permissive on iPad)

**Net remaining:** verify-Release-scheme-uses-AppRelease.entitlements (do during next Xcode archive) + verify-privacy-URL-returns-200 (1-minute browser check).

---

## 6. Mid-priority bug from a prior audit pass (re-flagging)

The `UpgradeScreen.tsx` web-path disclosure paragraph still says *"Payment is charged to your Apple ID"* on the web (Stripe) flow. Apple won't see this — they only review the native flow — but it's incorrect text for any future user who lands on the web upgrade page. **Defer to v1.1** alongside Stripe activation. Not a v1 blocker.
