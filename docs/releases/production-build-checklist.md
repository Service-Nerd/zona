# Production Build Checklist — Zonna iOS

**Purpose:** the procedural runbook to follow before every TestFlight archive (and especially before final App Store submission). One pass, top to bottom. If anything is wrong, fix before archiving.

**When to use:** before clicking "Archive" in Xcode. Pin this doc.

---

## 0. Pre-flight (one-time, already done — verify still true)

- [ ] `app.zonna.ios` bundle ID matches in:
  - `capacitor.config.ts:21` (`appId: 'app.zonna.ios'`)
  - `lib/native.ts` (`NATIVE_BUNDLE_ID`)
  - Apple Developer portal app record
  - App Store Connect app record
  - RevenueCat iOS app config
- [ ] Apple Dev signing certificates current (not expired)
- [ ] App Store Connect API key exists for upload (if using `xcrun altool`)
- [ ] All three required ASC products in MISSING_METADATA-resolved state:
  - `zonna_premium_monthly` (£7.99)
  - `zonna_premium_annual` (£59.99)
  - both with 14-day free trial configured
- [ ] Apple Small Business Program enrolled (already done 2026-05-15)

---

## 1. Web side (Vercel) — must be deployed first

The Capacitor shell loads `https://www.zonna.run/dashboard`. The TestFlight binary will be paired with whatever's on production at install time, **not** at build time. But it's safest to deploy before archiving so that simultaneous web QA matches what testers see.

- [ ] `git push origin main` has happened — current commit matches what you want testers to see
- [ ] Vercel production deployment green (`vercel ls` or check dashboard)
- [ ] `https://www.zonna.run/` resolves (200)
- [ ] `https://www.zonna.run/dashboard` resolves (200 or redirect to login)
- [ ] `https://www.zonna.run/privacy` resolves (200) — Apple's bot crawls this
- [ ] `https://www.zonna.run/terms` resolves (200)

---

## 2. Vercel environment variables — verify production tier

Critical ones for the iOS-only v1 path. Use `vercel env ls` or the dashboard.

| Variable | Required value | Why |
|---|---|---|
| `APNS_PRODUCTION` | `1` | **Production APNs server rejects sandbox tokens and vice versa.** Must be `1` for any TestFlight build with production aps-environment entitlement. If still `0`, push notifications will silently fail in production. |
| `APNS_KEY_ID` | (your .p8 key ID) | Required for push send |
| `APNS_TEAM_ID` | (your Apple Dev team) | Required for push send |
| `APNS_PRIVATE_KEY` | (the .p8 contents) | Required for push send |
| `APNS_TOPIC` | `app.zonna.ios` | Must match bundle ID |
| `REVENUECAT_WEBHOOK_SECRET` | (RevenueCat dashboard value) | Webhook idempotency |
| `NEXT_PUBLIC_REVENUECAT_API_KEY` | (RevenueCat iOS public key) | Client SDK init |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase service role) | Server-side admin operations |
| `ANTHROPIC_API_KEY` | (production key) | All AI features |
| `CRON_SECRET` | (any strong string) | Vercel cron auth |
| `NEXT_PUBLIC_APP_URL` | `https://www.zonna.run` | Used in OG and email links |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | (web-push keys) | Web push (for marketing-site users post-launch) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | (your value) | Strava webhook verification |
| `MARKETING_SITE_ENABLED` | `false` for soft launch / `true` for public flip | Keep `false` until you want the marketing site at `/` discoverable |

**Stripe env vars (`STRIPE_*`) are deferred to v1.1** — should be absent or unset. If they exist with stale values, no harm (the web upgrade path is intentionally inert at v1).

---

## 3. Capacitor sync

After ANY change to:
- `capacitor.config.ts`
- web-side code that the native shell loads (i.e. any commit)
- installed Capacitor plugins

Run:
```sh
npx cap sync ios
```

This copies the latest `public/` and plugin updates into the iOS project. **Skip and your TestFlight build will run stale code.**

---

## 4. Xcode build settings

Open `ios/App/App.xcworkspace` in Xcode.

- [ ] **Scheme:** App
- [ ] **Configuration:** Release (not Debug)
- [ ] **Build target:** Any iOS Device (arm64), not Simulator
- [ ] **Code signing:** Automatic, team = your team
- [ ] **Bundle identifier:** `app.zonna.ios` (verify under Signing & Capabilities)
- [ ] **Marketing version:** bumped if this is a new TestFlight build with code changes (e.g. `1.0.0` → `1.0.1`)
- [ ] **Build number:** bumped (every upload needs a unique build number even if marketing version unchanged)
- [ ] **Capabilities present:**
  - Push Notifications
  - Sign in with Apple
  - HealthKit
  - Background Modes → Remote Notifications (only if push-on-background is needed; check current config)
  - Associated Domains (only after Universal Links lands — deferred for v1)
- [ ] **Entitlements file (Release):** `AppRelease.entitlements` (NOT `App.entitlements`)
- [ ] **`Info.plist` — ITSAppUsesNonExemptEncryption** = `false` (see pre-submission audit)

---

## 5. Manual smoke check (Simulator, before archiving)

5 minutes in the simulator catches things that crash on first launch:

- [ ] App boots — launch screen → web loading screen → Today screen (no black flash, no jarring transition)
- [ ] OAuth path: tap "Continue with Google" → SFSafariViewController opens → return flow lands on `/dashboard`
- [ ] Apple Sign-in: works inline, no Safari hop
- [ ] Today screen renders a plan (or empty state if no plan yet)
- [ ] Push registration succeeds — check Vercel logs for `/api/push/subscribe` POST shortly after sign-in
- [ ] Upgrade screen renders both pricing options + disclosure copy
- [ ] StoreKit purchase sheet opens when tapping "Start your subscription" *(in sandbox; will fail to charge — expected)*
- [ ] No console crashes or unhandled rejections in the Xcode debug console

---

## 6. Archive + upload

In Xcode:
1. Product → Destination → "Any iOS Device (arm64)"
2. Product → Archive (10–15 min build time)
3. Organizer opens automatically when done
4. Select the new archive → Distribute App → App Store Connect → Upload
5. Wait for "Submission Successful" notification (~5 min)
6. Switch to App Store Connect → TestFlight → wait for build to finish processing (~10–30 min). Processing is silent; you get an email when it's ready or rejected.

---

## 7. Post-upload verification

- [ ] Build appears in App Store Connect under TestFlight → iOS Builds
- [ ] Build state = "Ready to Submit" or "Ready to Test" (not "Missing Compliance" — if it says that, see encryption declaration in pre-submission audit)
- [ ] Build is selected for internal testing group
- [ ] Internal testers (you + the 5–7 from the beta-tester profile) get email invites
- [ ] You install via TestFlight on a real device and run the journey test (see launch-roadmap Full Journey Test section)
- [ ] APNs registration on real device succeeds — confirm by triggering a push (you can manually invoke `/api/push/send-weekly-report` via cron secret if a real one isn't due)

---

## 8. If something fails

| Symptom | Likely cause | Fix |
|---|---|---|
| "Missing Compliance" badge | `ITSAppUsesNonExemptEncryption` absent | Add `<false/>` to Info.plist |
| Push tokens not arriving on real device | Sandbox/prod mismatch on APNs | Confirm `AppRelease.entitlements` selected for Release; confirm `APNS_PRODUCTION=1` in Vercel |
| OAuth redirect dead-ends | `app.zonna.ios://` not in Supabase allowed redirect URLs | Add it in Supabase → Auth → URL Configuration |
| Plan doesn't load on Today | Stale web build — `cap sync` not run | Run `npx cap sync ios` and re-archive |
| HealthKit permission prompt missing | Entitlement absent in Release | Verify `com.apple.developer.healthkit` in `AppRelease.entitlements` |
| StoreKit purchase fails silently | RevenueCat `appUserID` not set, or product IDs mismatch | Verify `Purchases.configure({ appUserID })` runs after Supabase auth; verify `Zonna.storekit` IDs match `zonna_premium_monthly` / `zonna_premium_annual` |

---

## 9. Final submission (after TestFlight smoke passes)

Separate from archive — happens in App Store Connect web UI:

- [ ] App Store description, keywords, screenshots, promotional text all uploaded (see `app-store-copy.md`)
- [ ] Per-subscription Review Information filled in for both monthly + annual SKUs
- [ ] Demo account created (trial-expired, populated plan, **`is_admin = false`**) and credentials added to Review Notes
- [ ] App Privacy questionnaire completed (see `pre-submission-audit.md` § Apple Data Privacy)
- [ ] Privacy Policy URL field: `https://www.zonna.run/privacy`
- [ ] Build selected on the "Build" row of the version
- [ ] Pricing & Availability set (subscription products only — base app is free)
- [ ] Territories: US, UK, Canada, Australia, NZ, plus other non-EU. **Exclude EU territories** until DSA trader info is declared (deferred to v1.1+ per launch scope).
- [ ] Age rating questionnaire completed (likely 4+: no objectionable content, no medical advice claims, no UGC)
- [ ] Release: **Manual release** (recommend — gives a buffer for final live-binary smoke)
- [ ] Click "Submit for Review"

Apple review typically takes 24–48h for a first submission. Plan accordingly.
