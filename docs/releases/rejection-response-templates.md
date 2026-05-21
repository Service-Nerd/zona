# Apple Rejection Response Templates — Zonna v1

**Job:** if Apple rejects the first submission (~50% of first-time submissions get rejected), have ready-to-edit responses for the most likely reasons. Cuts iteration time from days to hours.

**How to use:**
1. Read Apple's rejection message in Resolution Center carefully — note the **Guideline number** and the **specific concern** they cite.
2. Find the matching section below.
3. Investigate the root cause (checklist), apply the fix, then send the response (template).
4. Resubmit. Each round of Apple review is 24–48h.

**Don't:** argue. Apple reviewers are not adversarial but they are not negotiable. Fix what they ask, explain what you did, resubmit.

---

## §3.1.2(a) — Subscription Information / Disclosure

**Likely cited when:** UpgradeScreen disclosure copy is judged insufficient. Apple wants every auto-renewing subscription to disclose all of: title, length, content, price per unit, link to terms, link to privacy, auto-renewal terms, cancellation method.

**What we've shipped** (verify before responding):
- Title: "Start your subscription" CTA
- Length: "per month" / "per year" on each button
- Content: 5-item feature list above prices
- Price per unit: `£7.99 / month` and `£59.99 / year (£5 / month equivalent)`
- Terms link: `/terms` opens in new tab
- Privacy link: `/privacy` opens in new tab
- Auto-renewal: "Subscription auto-renews at the end of each period unless turned off at least 24 hours before renewal"
- Cancellation: "Manage or cancel any time in your Apple ID account settings"
- Apple ID charge: "Payment is charged to your Apple ID at confirmation of purchase"
- Trial conversion: "14 days free — the first payment is charged at the end of the trial unless you cancel"

### Root cause checklist

- [ ] Re-read `UpgradeScreen.tsx:273–310` and confirm every required phrase is present and visible without scrolling/clicking through
- [ ] On TestFlight build, screenshot the upgrade screen on iPhone 6.7" — confirm all disclosure copy is on-screen above the fold
- [ ] If reviewer says "Privacy/Terms links not functional": check the links work both on web (`https://www.zonna.run/terms`) and inside the iOS WebKit container

### Response template

> Hi App Review Team,
>
> Thanks for the detailed review. We have updated the subscription disclosure on the UpgradeScreen to address the concerns raised:
>
> [LIST WHAT YOU CHANGED — e.g. "moved the disclosure text above the CTA buttons so it's visible without scrolling" / "made the Terms and Privacy links larger and underlined for clarity"]
>
> The disclosure now includes per-period pricing (£7.99/month or £59.99/year), the 14-day free trial conversion terms, the auto-renewal schedule, the cancellation method (iOS Settings → [name] → Subscriptions), the Apple ID payment confirmation language, and functional links to both Terms of Service and Privacy Policy at zonna.run/terms and zonna.run/privacy.
>
> Please let us know if there are specific phrasings you would prefer.
>
> Thanks,
> Russ — Zonna

---

## §5.1.1 — Data Use Disclosure / Privacy

**Likely cited when:** privacy policy URL is unreachable, HealthKit usage description is vague, or the App Privacy questionnaire answers don't match the privacy policy / observed data collection.

**What we've shipped** (verify before responding):
- Privacy policy live at `https://www.zonna.run/privacy` (verified 2026-05-21 — 200 OK)
- `NSHealthShareUsageDescription`: *"Zonna reads your runs and recovery signals (resting heart rate, HRV, sleep) to provide coaching feedback. Zonna never writes to Apple Health."*
- `NSHealthUpdateUsageDescription`: *"Zonna does not write to Apple Health. This app only reads activity and recovery data to provide training coaching."*
- App Privacy questionnaire answers documented in `pre-submission-audit.md` § 1

### Root cause checklist

- [ ] Open `https://www.zonna.run/privacy` from a fresh browser — does it return 200 quickly?
- [ ] Read the Apple Health section of the privacy policy — does it match what the app actually does? (We updated this 2026-05-21 to accurately reflect per-workout HR sample stream storage)
- [ ] In App Store Connect → App Privacy, do the declared data types match the privacy policy?
- [ ] If reviewer cites usage description: re-read Info.plist usage strings; they should name the specific use case, not a generic claim

### Response template

> Hi App Review Team,
>
> Thanks for flagging the privacy concern. Our privacy policy at https://www.zonna.run/privacy explains exactly what data is collected and how it's used. In particular:
>
> - We read HealthKit data read-only — workouts (including per-workout HR sample streams for cardiac drift analysis), resting heart rate, HRV, sleep, and VO₂ max.
> - We never write to HealthKit.
> - We do not use any tracking SDKs, IDFA, or analytics platforms.
> - We do not share user data with third parties for advertising.
>
> [IF THEY CITED A SPECIFIC GAP — e.g. "We have updated the Apple Health section of our privacy policy to clarify..."]
>
> Our App Privacy declarations have been verified against the codebase and the privacy policy. Please let us know if there is a specific data type or use case you'd like clarified further.
>
> Thanks,
> Russ — Zonna

---

## §2.1 — App Completeness / Demo Account Needed

**Likely cited when:** the reviewer cannot easily test the paid tier because:
- No demo account credentials were provided in Review Information
- The demo account's trial hasn't expired so the paid surfaces are indistinguishable from trial
- The demo account doesn't have populated data (plan, completions) so the AI surfaces show empty states

### Root cause checklist

- [ ] Open App Store Connect → App Review Information → Demo Account
- [ ] Confirm credentials are present and current
- [ ] Sign in with those credentials in a TestFlight build and verify:
  - [ ] Trial has expired (`trial_started_at` ≥ 15 days ago)
  - [ ] A plan is generated and visible on Today screen
  - [ ] At least 3 completed sessions with RPE + analysis results
  - [ ] At least one Kit-voice surface populated (daily coach note OR weekly report)
  - [ ] `is_admin = false` (reviewer must not see AdminScreen)

### Setup SQL (run before submitting)

```sql
-- Run as Russ via Supabase SQL Editor.
-- Replace '<demo-user-uuid>' with the demo account's auth.users.id.

UPDATE user_settings
SET
  trial_started_at = NOW() - INTERVAL '20 days',
  is_admin = false,
  has_onboarded = true,
  first_name = 'Reviewer',
  last_name = 'Apple'
WHERE id = '<demo-user-uuid>';

-- Verify state
SELECT
  trial_started_at,
  EXTRACT(DAY FROM NOW() - trial_started_at) AS days_into_trial,
  is_admin,
  has_onboarded,
  plan_json IS NOT NULL AS has_plan,
  first_name
FROM user_settings
WHERE id = '<demo-user-uuid>';
```

### Response template

> Hi App Review Team,
>
> Apologies — please use the following demo account credentials:
>
> **Email:** [demo email]
> **Password:** [demo password]
>
> This account has an active training plan, completed sessions with AI analyses populated, and the trial period has been expired so the post-trial state and Premium paywall are immediately visible on first sign-in.
>
> To exercise the Premium subscription flow without making a purchase, tap any session card or the "Premium" button in the Profile screen.
>
> Thanks,
> Russ — Zonna

---

## §1.4.1 / §1.4.2 — Health/Fitness Claims

**Likely cited when:** language in description, screenshots, or in-app copy implies medical advice, injury treatment, or specific health outcomes ("cure", "treat", "fix", "prevent injury", "guaranteed improvement").

**What we've shipped** (already protective):
- App Store description body avoids medical claims (says "training plans", "coaching", "analysis" — never "treats", "cures", "prevents")
- Brand statement is *"You can't outrun your easy days"* — explicitly anti-claim
- Terms of Service §"Health and safety disclaimer" disclaims medical-device positioning explicitly

### Root cause checklist

- [ ] Re-read App Store description (`app-store-copy.md`) — any phrase that sounds like a health promise? Edit out.
- [ ] Re-read screenshot captions — same check. Captions are particularly risky because they're punchy.
- [ ] Check the wizard copy — any "this will fix your..." language?
- [ ] If reviewer cites HealthKit: confirm the usage strings explicitly name "training coaching", not "health monitoring" or "wellness"

### Response template

> Hi App Review Team,
>
> Thank you for the feedback. Zonna is a running training app — we provide algorithmic training plan generation and coaching feedback, but we do not offer medical advice, injury treatment, or specific health outcomes. We have:
>
> - [LIST WHAT YOU CHANGED — e.g. "Updated the App Store description to remove the phrase..." / "Edited the wizard copy to clarify..."]
> - Strengthened our health-safety disclaimer in the Terms of Service at zonna.run/terms — Section "Health and safety disclaimer"
>
> Our HealthKit usage is read-only and used purely for coaching feedback (zone training, fatigue detection). We make no medical claims.
>
> Please let us know if any specific language remains a concern.
>
> Thanks,
> Russ — Zonna

---

## Guideline 5.1.1(v) — Account Deletion

**Likely cited when:** the app does not offer an in-app account deletion path. (We do — verify before responding.)

**What we've shipped:**
- `app/api/delete-account/route.ts` deletes the user's row from `user_settings`, `session_completions`, `subscriptions`, then calls `supabase.auth.admin.deleteUser(uid)`
- MeScreen has a "Delete account" button (verify location before responding)
- Privacy Policy § "Account deletion" states: *"You can delete your account at any time from the Profile screen."*

### Root cause checklist

- [ ] On a TestFlight build, sign in as a test account
- [ ] Open MeScreen (Profile tab)
- [ ] Locate the "Delete account" button — is it findable? (If not visible without scrolling, that's a discoverability issue Apple may still call out)
- [ ] Tap it — does it actually delete the account? (Confirm with a Supabase SELECT)

### Response template

> Hi App Review Team,
>
> Zonna offers in-app account deletion. To delete an account:
>
> 1. Sign in to the app.
> 2. Open the Profile tab (bottom right of the bottom navigation).
> 3. Scroll to the bottom of the Profile screen.
> 4. Tap "Delete account."
> 5. Confirm.
>
> Deletion is immediate and irreversible — the user's account, training plan, session history, Strava connection, and HealthKit-derived data are all permanently removed. Confirmation flow includes a clear warning.
>
> Our Privacy Policy at zonna.run/privacy describes this under the "Account deletion" section.
>
> If the button is not visible in the build you reviewed, please let us know — we can provide a screen recording of the flow.
>
> Thanks,
> Russ — Zonna

---

## Guideline 2.3 — Accurate Metadata

**Likely cited when:** screenshots or App Store description show features or data that don't match the actual build, OR text claims something that isn't true ("AI-powered" when there's no AI, "personalised" when there's no personalisation, etc.).

**Likely Zonna-specific traps:**
- Screenshot captions might say "Kit reads every run" — verify Kit's AI analysis is actually live and visible in a default screenshot state
- Description says "Apple Health integration" — confirm HealthKit prompt actually appears on first launch (verify in TestFlight smoke)
- Description mentions "weekly zone score" — confirm a test account with run history shows it on the Coach screen

### Root cause checklist

- [ ] For each screenshot: open the matching screen in the live TestFlight build. Does the screen match the screenshot 1:1? (Apple cares about this.)
- [ ] For each description claim: can the reviewer actually see this feature within 60 seconds of sign-in?
- [ ] Promotional text mentions specific features — same check.

### Response template

> Hi App Review Team,
>
> Thanks for flagging the accuracy concern. We have updated [SPECIFIC ASSET — screenshot/description text/promotional text]:
>
> [LIST CHANGES — e.g. "Removed the 'weekly zone score' screenshot caption since this feature appears only after the user has logged at least 3 sessions, which a fresh reviewer account would not see immediately."]
>
> The metadata now matches the build behaviour exactly. The demo account credentials in Review Information provide a populated state where all advertised features are immediately visible.
>
> Thanks,
> Russ — Zonna
