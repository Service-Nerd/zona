# Journey Test — Zonna v1 funnel

**Job:** Verify the end-to-end happy path before every TestFlight upload and before App Store submission.
**Runtime:** ~10 minutes per pass.
**Target:** the running Vercel preview URL or `https://www.zonna.run` (production). Native iOS adds a parallel TestFlight smoke (see `production-build-checklist.md` § 7).

**Pass criterion:** every assertion below resolves true. **Fail criterion:** any single assertion fails → file in `backlog.md` and re-run before submit.

This script is execution-ready for `agent-browser` (or any Chromium-driving agent), and step-by-step manual users can also follow it.

---

## Setup (do once per test pass)

### A. Test account

Reuse the **screenshot seed account** (see `app-store-copy.md` § Screenshots), or create a fresh one. The same account is fine for repeated test passes.

For the trial-end leg you need to manipulate `trial_started_at` via Supabase. Either:
- **Easy:** keep two test accounts — one fresh (steps 1–7), one with `trial_started_at` set to >14 days ago (steps 8–10).
- **Faster:** one account, override the column between passes.

### B. Auth strategy

Sign in via Google OAuth (the dominant production path on web). Apple Sign in via SFSafariViewController is iOS-native-only and out of scope for this browser-only script — that gets exercised by the parallel TestFlight smoke.

### C. Browser settings

- Clear all `zonna.run` cookies + localStorage before starting.
- No browser extensions that could block OAuth redirects (uBlock, privacy extensions).

---

## The 10 steps

### Step 1 — Boot landing page

**Action:** Navigate to `https://www.zonna.run/`. (If `MARKETING_SITE_ENABLED=false`, expect a redirect to `/dashboard`; if `true`, the marketing page renders.)

**Assertions:**
- Page returns HTTP 200.
- If marketing on: hero contains text `"Plans that stop overtraining."` (the `BRAND.appStoreSubtitle` value).
- If marketing off: URL ends `/dashboard` and the login screen renders.

---

### Step 2 — Sign in via Google

**Action:** Click "Start your plan" (marketing site) or "Continue with Google" (login screen). Complete the Google OAuth flow.

**Assertions:**
- Redirect lands at `/dashboard`.
- Loading screen appears briefly with `"Slow down. You've got a day job."` tagline.
- Resolves to either the wizard (fresh account) or the Today screen (returning account with a plan).

---

### Step 3 — Wizard

**Action:** (Fresh account only.) Run the generation wizard with these inputs:
- Race: **Half Marathon**
- Race date: **8 weeks from today**
- Training age: **structured**
- Current weekly km: **30**
- Days/week: **4**
- Long run day: **Sunday**
- Injuries: **none**
- Age: **38**

**Assertions:**
- All wizard steps render without console errors.
- Submit returns to a `"Generating your plan…"` ceremony view.
- Resolves to Today screen within ~30 seconds.
- Today screen has a session card (not empty state).

---

### Step 4 — Today screen renders

**Action:** Inspect the Today screen.

**Assertions:**
- A session card is present for today (or rest-day card if today is rest).
- The card shows: session type label, zone, HR target, pace bracket OR distance/duration.
- Header shows `"Today"` or the date.
- Bottom navigation has 4 tabs visible (Today, Plan, Coach, Me).

---

### Step 5 — Session Detail

**Action:** Tap today's session card.

**Assertions:**
- URL or screen state changes to session detail.
- Detail view shows: session description, prescription block (zone + HR + pace target), and either a "Why this session" coach-note block or a Kit-voice paragraph.
- Back arrow ← top-left returns to Today.

---

### Step 6 — Log a session manually

**Action:** From session detail, tap "Log session" (or equivalent CTA). Complete the log form:
- RPE: **4**
- Felt: **"felt good"** (if there's a text field)
- Distance: prefilled or 8 km
- Duration: prefilled or 50 min

**Assertions:**
- Form submits without error.
- Returns to a reflect-view OR to Today with the session marked completed.
- Today screen now shows the session card in a completed state (filled accent bar, RPE visible, or completion check).

---

### Step 7 — Reflect / post-run analysis

**Action:** Open the just-logged session's post-run analysis view. (May be auto-routed after Step 6; otherwise tap the completed session card.)

**Assertions:**
- Reflect view renders either:
  - The AI analysis text from Kit (if trial-active + analysis already completed), OR
  - A "Kit is reading your run…" pending state (acceptable — analysis is async)
- No 500 error in browser console.
- A "Done" button is present and returns to Today / Session.

---

### Step 8 — Trial-end simulation

**Action:** (Switch to the trial-expired account OR override `trial_started_at`.)

In Supabase SQL Editor, run:
```sql
UPDATE user_settings
SET trial_started_at = NOW() - INTERVAL '15 days'
WHERE id = '<test-user-uuid>';
```

Refresh the dashboard.

**Assertions:**
- Today screen shows the **trial-expired banner** (warn accent, copy: *"Kit's gone quiet."* + *"Plan still runs. Coaching needs a sub."*).
- The plan is still rendering (sessions visible, free tier is never abandoned).
- Pre-existing analyses remain visible (don't disappear when trial ends).

---

### Step 9 — Upgrade screen (trial-expired variant)

**Action:** Tap the trial-expired banner.

**Assertions:**
- UpgradeScreen renders with the **LOSSES variant** (`trialExpired={true}`):
  - Headline: `"Kit's gone quiet."`
  - Sub: `"14 days done. Here's what stopped."`
  - 4 loss items including `"Kit's gone quiet"`, `"Zone score paused"`, `"Sundays got quieter"`, `"The plan stops moving"`.
- Both pricing buttons render: `£7.99` (monthly) + `£59.99` (annual).
- Annual button has the `"Save 37% / year"` chip.
- Disclosure paragraph contains all of: `"per month"`, `"per year"`, `"14 days free"`, `"Apple ID"` (note: this string is correct for native; harmless on web), `"auto-renews"`, `"24 hours before renewal"`, `"Apple ID account settings"`.
- Both `Terms of Service` and `Privacy Policy` links are clickable, have `target="_blank"`, and open valid pages.

---

### Step 10 — Subscribe (web — should currently no-op)

**Action:** Tap either pricing button.

**Assertions (web, v1):**
- Web path posts to `/api/checkout`. **At v1 with Stripe deferred, this should either:**
  - Return an error response visible to the user as `"Purchase failed. Try again."` (acceptable — Stripe is deferred), OR
  - Return `{ url: null }` and surface the same error.
- The screen does not crash. The user is not navigated away.
- "Continue with free plan →" button works and returns to dashboard.

**Note:** the production Stripe path will work in v1.1. For v1, this step's job is to confirm the screen doesn't crash when the inert path is exercised. The same flow on iOS will hit the StoreKit sheet instead — verified separately in the TestFlight smoke.

---

## Cleanup (after each pass)

Reset the test account so the next pass starts clean:

```sql
-- Restore trial state to active
UPDATE user_settings
SET trial_started_at = NOW()
WHERE id = '<test-user-uuid>';

-- Optionally clear plan + completions to redo step 3
DELETE FROM session_completions WHERE user_id = '<test-user-uuid>';
UPDATE user_settings SET plan_json = NULL, has_onboarded = false WHERE id = '<test-user-uuid>';
```

---

## Failure modes — likely root causes

| Symptom | Likely cause |
|---|---|
| OAuth redirect loops | Supabase redirect URL not whitelisted for current preview deployment |
| Wizard hangs at "Generating…" | Anthropic API down or `ANTHROPIC_API_KEY` env unset in this Vercel deployment |
| Session card missing on Today | `plan_json` write failed or `currentWeekIndex` computation off |
| Reflect view stuck on pending | `/api/analyse-run` 500 — check Vercel logs for the user_id |
| Trial-expired banner doesn't appear after override | Server-side `trial_started_at` cache (none expected) OR clock skew between Supabase and Vercel — refresh again |
| Disclosure text missing required Apple phrase | `UpgradeScreen.tsx` was edited without keeping the §3.1.2(a) language — re-audit |

---

## Don't run this for

- **Real purchases.** This script's web-path Step 10 is intentionally a no-op for v1. iOS purchases are tested via TestFlight sandbox, not via this script.
- **HealthKit data flow.** That requires a real device with workout history — covered separately in the TestFlight real-device smoke.
- **Native deep links (`app.zonna.ios://`).** Custom URL scheme handling is iOS-only.

---

## Open: convert to executable agent-browser script when needed

This markdown plan is the source of truth. If the journey-test cadence increases (every PR, every preview deploy), it's worth porting to an actual Playwright/agent-browser TS file under `scripts/`. For v1 launch prep, manual execution is fine — the test runs ~once per TestFlight cycle.
