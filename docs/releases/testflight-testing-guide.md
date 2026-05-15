# Zonna — TestFlight Testing Guide

**Build:** Internal v1 (TestFlight)
**Date:** May 2026
**Contact:** support@zonna.run

---

## Before You Start

### Install the app
1. Download **TestFlight** from the App Store if you don't have it
2. Accept the TestFlight invitation email
3. Open TestFlight → tap **Install** next to Zonna
4. Open Zonna from your home screen

### Create a test account
- Use **Sign in with Apple** or **Sign in with Google**
- Use a real email you have access to — you'll get push notifications
- Don't use an account you've used before if you want a clean test

---

## What We're Testing

Work through each section below in order. Note anything that looks wrong, breaks, or feels confusing.

---

## 1. Onboarding + Plan Setup

**What to do:**
1. Open the app → sign in
2. Work through the setup wizard — enter your race, target date, fitness level, HR zones
3. Tap **Generate my plan**
4. Confirm a plan appears with weeks and sessions

**What to look for:**
- Does the wizard feel clear? Any step that's confusing or missing explanation?
- Does the plan generate without errors?
- Does the plan match what you entered (right distance, roughly right number of weeks)?

---

## 2. Today Screen

**What to do:**
1. Check the Today screen — you should see today's session
2. Tap the session card to expand it
3. Check the zone info, HR targets, and session description
4. Tap **Back** to collapse

**What to look for:**
- Is today's session visible and readable?
- Does the zone information make sense?
- Is there a daily coaching note below the session? (Paid feature — visible during your 14-day trial)
- Does the amber "Hold the zone" zone bar appear?

---

## 3. Logging a Run

**What to do:**
1. On any session, tap **Mark complete**
2. Rate your effort (RPE slider)
3. Tap **Done**
4. Check that the session shows as completed on the Today screen

**What to look for:**
- Does the completion flow feel smooth?
- Does the session card update to show it's been logged?

---

## 4. Apple Health Connection

**What to do:**
1. Go to **Me** tab (bottom nav)
2. Scroll to **Apple Health** → tap **Connect**
3. Grant permission for all categories when iOS prompts
4. Go for a run with your Apple Watch, then return to the app
5. Check the Today or Coach screen for your run analysis

**What to look for:**
- Does the Health permission prompt appear correctly?
- After a run, does Zonna pick it up automatically?
- Does a coaching note appear after the run is synced?

---

## 5. Plan Screen

**What to do:**
1. Tap the **Plan** tab (bottom nav)
2. Scroll through your weeks
3. Tap a session in a future week

**What to look for:**
- Are all your weeks visible?
- Do the session types look right (easy, long run, intervals etc.)?
- Does tapping a session show the detail correctly?

---

## 6. Coach Screen

**What to do:**
1. Tap the **Coach** tab (bottom nav)
2. Check the weekly report card
3. Check the zone discipline score and load ratio
4. Tap the **ⓘ** next to each stat to read the explanation

**What to look for:**
- Does the weekly report make sense for your week?
- Are the stats (zone discipline, load ratio) visible and readable?
- Do the explanation sheets open when you tap the ⓘ?
- Does the coaching voice feel appropriate — not robotic, not over-excited?

---

## 7. Push Notifications

**What to do:**
1. Go to **Me** tab → scroll to **Notifications**
2. Tap **Enable notifications** → allow when iOS prompts
3. Log a run and wait — you should receive a push notification within a minute

**What to look for:**
- Does the permission prompt appear?
- Do you receive a push after logging a run?
- Does tapping the push notification take you to the right screen in the app?

---

## 8. Profile + Settings

**What to do:**
1. Go to **Me** tab
2. Check your name, HR zones, race details are correct
3. Try changing your display name
4. Check the **HR Zones** section — do your zones look right?

**What to look for:**
- Does your profile data match what you entered in the wizard?
- Can you update your name and save it?
- Are HR zones showing real numbers (not dashes)?

---

## 9. Upgrade Flow *(Internal testers only)*

> This tests the subscription purchase screen. You won't be charged — this uses Apple's sandbox environment.

**Setup (ask Russ to do this for you):**
Russ will temporarily set your account to expired-trial state in the database.

**What to do:**
1. Refresh the app — you should see an amber banner on Today: *"Coaching has paused."*
2. Tap **"Keep it going →"**
3. Check the upgrade screen — both monthly and annual options
4. Tap the annual option — a native Apple payment sheet should appear
5. Confirm using your Apple ID (sandbox — no real charge)
6. Check that the success screen appears
7. Confirm coaching features are accessible again after subscribing

**What to look for:**
- Does the amber banner appear on Today?
- Does the upgrade screen look correct and complete?
- Does the Apple payment sheet appear (native iOS UI)?
- Does the success screen appear after payment?
- Are paid features accessible after subscribing?

---

## Reporting Issues

Please note down:

1. **What you were doing** when the issue happened
2. **What you expected** to see
3. **What actually happened**
4. **A screenshot** if possible (iOS: side button + volume up)
5. **Your device** (iPhone model) and **iOS version** (Settings → General → About)

Send reports to: **support@zonna.run**

---

## Known Limitations in This Build

- **Strava connection** — visible in settings but not the primary data source. Use Apple Health instead.
- **Strength sessions** — appear in some plans but are placeholder stubs for now
- **Web version** — accessible at `zonna.run` but this test is focused on the iOS app
- **Plan regeneration** — works but may take 10–15 seconds for AI-enhanced plans

---

## What We Most Want Feedback On

1. Does the onboarding feel clear — do you know what Zonna is for after the first 2 minutes?
2. Does the zone coaching feel useful or confusing?
3. Does the app feel fast and stable on your device?
4. Is there anything you expected to find that wasn't there?

Thanks for testing. Honest feedback only — we'd rather hear what's broken than what's good.
