# ZONA Screen Inventory
*Date: 2026-04-23 — Read-only audit. No changes proposed.*

---

## 1. Screen List

| Screen Name | File | Route / Trigger | Purpose | Tier |
|---|---|---|---|---|
| Login | app/auth/login/page.tsx | `/auth/login` | Email/password and Google OAuth signin/signup | Public |
| Privacy Policy | app/privacy/page.tsx | `/privacy` | Legal/privacy documentation | Public |
| Loading | app/dashboard/DashboardClient.tsx | Initial page load | Zona wordmark + spinner during settings fetch | Authenticated |
| Welcome | app/dashboard/DashboardClient.tsx | First login after plan creation | Onboarding message for migrated users with existing plans | Authenticated |
| Orientation | app/dashboard/DashboardClient.tsx | After plan generation via `setShowOrientation()` | Post-generation walkthrough: race info, first session, Z2 ceiling | Authenticated |
| Today | app/dashboard/DashboardClient.tsx | `screen='today'` (default) | Current week's sessions, weekly stats, smoke tracker, pending adjustments | Both |
| Plan | app/dashboard/DashboardClient.tsx | `screen='plan'` | Full plan calendar with weekly view, session overrides, completion history | Both |
| Coach (Paid) | app/dashboard/DashboardClient.tsx | `screen='coach'` + `hasPaidAccess` | Weekly zone discipline report, run analysis, pending plan adjustments | Paid/Trial |
| Coach Teaser (Free) | app/dashboard/DashboardClient.tsx | `screen='coach'` + `!hasPaidAccess` | Upsell message prompting upgrade for coaching features | Free |
| Strava | app/dashboard/DashboardClient.tsx | `screen='strava'` | Connected activity feed, aerobic pace, weekly km, HR analysis | Both |
| Me (Profile) | app/dashboard/DashboardClient.tsx | `screen='me'` | User settings, name/email, HR zones, theme, units, push notifications, admin access | Both |
| Calendar | app/dashboard/DashboardClient.tsx | `screen='calendar'` (entry point removed) | Alternative week calendar view — built but not in nav | Both |
| Session Detail | app/dashboard/DashboardClient.tsx | `screen='session'` | Single session view with completion form, RPE, fatigue tags, Strava link | Both |
| Admin | app/dashboard/DashboardClient.tsx | `screen='admin'` (admin users only) | User impersonation and admin queries | Admin |
| Generate Plan (Wizard) | app/dashboard/GeneratePlanScreen.tsx | `screen='generate'` | 3-step (free) or 4-step (paid) plan creation wizard | Both |
| Generating Ceremony | components/GeneratingCeremony.tsx | Transient during plan generation | Animated loading screen with skeleton reveal | Both |
| Plan Preview | app/dashboard/GeneratePlanScreen.tsx | Inside wizard after generation | Preview plan arc, confidence badge (paid), coach intro, use/adjust buttons | Both |
| Upgrade | app/dashboard/UpgradeScreen.tsx | `screen='upgrade'` | Two-variant subscription upsell (gain or loss framing) | Both |
| Benchmark Update | app/dashboard/BenchmarkUpdateScreen.tsx | From Me screen or Coach screen | Zone recalibration form via race result or 30-min TT | Paid/Trial |

---

## 2. Screen Anatomy

---

### Login
`app/auth/login/page.tsx`

- **Layout**: Full screen centered
- **Header**: Zona wordmark + tagline (no nav)
- **Content blocks** (top to bottom):
  1. Zona wordmark ("Zona") + tagline (BRAND.tagline)
  2. Google OAuth button
  3. "or" divider
  4. Sign in / Sign up toggle (two-segment control)
  5. Email input
  6. Password input
  7. Age confirmation checkbox (sign up only)
  8. Submit button
  9. Error message (amber, conditional)
  10. Success message (teal, conditional)
  11. Footer: "Slow down. You're not Kipchoge." + Privacy Policy link
- **Data density**: Light
- **Dynamic copy**: Submit button label, error/success messages, subtitle changes by mode
- **Loading state**: Google button → "Redirecting…"; form inputs disabled
- **Error state**: Amber-background inline message; form re-enabled
- **Empty state**: N/A

---

### Privacy Policy
`app/privacy/page.tsx`

- **Layout**: Full screen scrollable document
- **Header**: Zona wordmark + back link
- **Content blocks**:
  1. Title + "Last updated: April 2026"
  2. Who we are
  3. What we collect (account, training, session, usage data)
  4. Strava
  5. How we use your data
  6. Third parties (Supabase, Anthropic, Strava, Vercel)
  7. Data retention
  8. Your rights (GDPR)
  9. Your rights (CCPA)
  10. Account deletion
  11. Children
  12. Cookies and local storage
  13. Changes to this policy
  14. Contact
- **Data density**: Heavy (legal text)
- **Dynamic copy**: None
- **Loading / Empty / Error states**: None

---

### Loading
`app/dashboard/DashboardClient.tsx`

- **Layout**: Full screen centered
- **Header**: None
- **Content blocks**:
  1. Animated Zona wordmark (custom Z + O with zone arc + NA)
  2. Tagline
- **Data density**: Light
- **Dynamic copy**: None
- **Loading state**: This is the loading state — infinite animation
- **Error state**: Redirects to login on auth failure

---

### Welcome
`app/dashboard/DashboardClient.tsx`

- **Layout**: Full screen centered
- **Header**: Zona wordmark + tagline
- **Content blocks**:
  1. Headline: "Your plan is ready."
  2. Body: "Zona keeps track of your sessions…"
  3. Inspirational text: "Train with intention. The rest follows."
  4. CTA: "Let's go"
- **Data density**: Light
- **Dynamic copy**: None (static onboarding)
- **All states**: N/A — single state

---

### Orientation
`app/dashboard/DashboardClient.tsx`

- **Layout**: Full screen centered
- **Header**: Zona wordmark + tagline
- **Content blocks**:
  1. Headline: "{firstName}, your plan is set."
  2. Subheading: "{weeks} weeks. One session at a time."
  3. Race card: race name, date, days to race
  4. First session card: session label + date with left accent bar
  5. Zone 2 info box: "Your Zone 2 ceiling is {bpm} bpm…"
  6. CTA: "Start training"
- **Data density**: Medium
- **Dynamic copy**: firstName, race name/date, first session label, zone 2 ceiling bpm
- **Empty state**: Race card or session card omitted if data unavailable
- **Loading / Error states**: N/A

---

### Today
`app/dashboard/DashboardClient.tsx` → `TodayScreen`

- **Layout**: Full screen scrollable + sticky bottom nav
- **Header**: Week label "W{n} · {date range}" + days to race countdown
- **Content blocks** (top to bottom):
  1. Smoke quit tracker (conditional — if enabled)
  2. Pending adjustment notification (conditional — if `pendingAdjustment` exists): session moved/deleted banner with Confirm + Revert CTAs
  3. Weekly stats: km done vs planned, long run hours
  4. Plan progression chart: long run hours per week, colour-coded by phase
  5. Session cards for current week (collapsed, scrollable)
  6. Heavy fatigue warning (conditional: 2+ of last 3 tags are Heavy/Wrecked/Cooked)
  7. Manual log button (elevated if no Strava, secondary otherwise)
  8. Strava nudge (free users, after manual log)
- **Data density**: Medium
- **Dynamic copy**: Week label, session labels, km figures, chart bars, coaching copy
- **Loading state**: Skeleton loaders for session cards while `overridesReady` is false
- **Empty state**: Rest week → rest day message; no sessions → empty state
- **Error state**: Strava token failure banner shown inline

---

### Plan
`app/dashboard/DashboardClient.tsx` → `PlanScreen`

- **Layout**: Full screen scrollable + sticky bottom nav
- **Header**: "Your plan"
- **Content blocks**:
  1. Week cards (expandable), one per week in plan:
     - Week number + date range + weekly km
     - Day-by-day session rows:
       - Day label + date
       - Session type badge (colour)
       - Session detail (distance or duration)
       - Completion status (✓ / skipped / Strava activity name + km)
     - Drag handle on incomplete sessions (move to another day)
  2. "Load {n} past weeks" toggle (collapsed by default)
  3. Strava nudge (if not connected)
- **Data density**: Heavy
- **Dynamic copy**: Session labels, Strava activity names, km done vs planned
- **Loading state**: Skeleton week cards while `overridesReady` is false
- **Error state**: Override save failure → error toast + retry
- **Empty state**: "No plan" (guarded upstream, should not appear)

---

### Coach (Paid)
`app/dashboard/DashboardClient.tsx` → `CoachScreen`

- **Layout**: Full screen scrollable + sticky bottom nav
- **Header**: "Coach"
- **Content blocks**:
  1. Zone discipline score (weekly, 0–100, with letter grade)
  2. Run analysis cards (one per logged session this week):
     - Session day + type badge
     - Verdict (Excellent / Good / Needs focus)
     - Total score + HR in zone %
     - Claude-generated feedback text
  3. Weekly report summary (if available):
     - Week number + summary text
     - Adjustments list (if any)
  4. Pending adjustment notification (if exists)
  5. "Generate weekly report" CTA (if not yet generated)
- **Data density**: Medium–Heavy
- **Dynamic copy**: Claude-generated feedback, zone discipline score, adjustment summaries
- **Loading state**: Spinner during report generation
- **Empty state**: "No sessions logged yet" / "Connect Strava to get weekly coaching insights based on your actual training data."
- **Error state**: "Coaching unavailable" if API call fails

---

### Coach Teaser (Free)
`app/dashboard/DashboardClient.tsx` → `CoachTeaser`

- **Layout**: Full screen centered
- **Header**: "Coach"
- **Content blocks**:
  1. Feature pitch list (5 items)
  2. Upgrade CTA button
- **Data density**: Light
- **Dynamic copy**: None (static)
- **All states**: Single state

---

### Strava
`app/dashboard/DashboardClient.tsx` → `StravaScreen` → `StravaPanel`

- **Layout**: Full screen scrollable + sticky bottom nav
- **Header**: Connection status indicator
- **Content blocks** (if connected):
  1. 2×2 metrics grid:
     - Pace @ HR 145 (aerobic efficiency)
     - Avg HR last 10 (Zone 2 ✓ or "Above target")
     - This week (km)
     - Longest run (km)
  2. "Recent activities" label
  3. Activity list (last 12): name, date, distance, duration, avg HR, pace
- **Data density**: Medium
- **Loading state**: Spinner + "Connecting to Strava…"
- **Empty state**: "Strava not connected. Go to the Me screen to connect your Strava account."
- **Error state**: Token refresh failure → "Connection failed. Check token."

**Activity detail popup** (on tap):
- Activity name + date
- 3×2 metric grid: Distance, Duration, Avg HR, Pace, Max HR, Elevation
- Coaching notes section (Claude analysis or loading spinner)
- "Got it" close button

---

### Me (Profile)
`app/dashboard/DashboardClient.tsx` → `MeScreen`

- **Layout**: Full screen scrollable + sticky bottom nav
- **Header**: User initials avatar + name
- **Content blocks**:
  1. Profile card: first name, last name, email (editable inline)
  2. Smoke tracker toggle + quit date picker (conditional)
  3. HR zones: resting HR + max HR inputs
  4. Connections section:
     - Strava connection row (connect / disconnect)
     - Push notifications row (Enable button / subscribed indicator) — paid/trial only
  5. Race prep section:
     - Mental toolkit
     - Fueling plan
  6. App settings: theme (Dark / Light / Auto), units (km / mi), primary metric (Distance / Duration)
  7. Dynamic adjustments toggle (paid/trial only)
  8. Generate new plan CTA
  9. Benchmark update CTA
  10. Admin link (admin users only)
  11. Sign out button
  12. Delete account (danger zone, confirmation required)
- **Data density**: Medium
- **Dynamic copy**: Name, email, HR values, quit days count, connection status
- **Loading state**: Settings spinner on initial load
- **Error state**: "Save failed" toast on profile update failure
- **Empty state**: Form fields empty until filled

---

### Calendar
`app/dashboard/DashboardClient.tsx` → `CalendarOverlay`

- **Layout**: Full screen scrollable (entry point removed from nav)
- **Header**: "Calendar" + back arrow
- **Content blocks**:
  1. Month/year selector
  2. 7-column calendar grid
  3. Day cells with session type colour dots
- **Data density**: Medium
- **Dynamic copy**: Session type indicators, date labels
- **Loading state**: Skeleton grid
- **Note**: Screen exists but is not accessible — entry point removed (line 709 comment)

---

### Session Detail
`app/dashboard/DashboardClient.tsx` → `SessionScreen` → `SessionPopupInner`

- **Layout**: Full screen (navigated to via `setScreen('session')`)
- **Header**: Session type badge + date + back arrow
- **Content blocks**:
  1. Session label + type badge + detail text
  2. Targets card (if available): distance/duration, HR target, pace target, RPE target
  3. Coach notes (paid/available): Claude-generated or plan-authored commentary
  4. Run analysis (paid, if Strava linked): verdict, score, EF trend, HR zone %
  5. Completion form (if future or today):
     - "Mark as complete" / status buttons
     - RPE slider (1–10)
     - Fatigue tag buttons (Fresh / Manageable / Heavy / Wrecked / Cooked)
     - Link Strava activity (if connected)
     - Manual log option
  6. Completion summary (if past):
     - ✓ Complete + Strava activity name + km
     - Or "Skipped"
  7. Estimated pace (computed from aerobic pace if available)
  8. Strava nudge (free users, post-completion)
- **Data density**: Medium
- **Loading state**: Skeleton card while coaching analysis loads
- **Empty state**: N/A (always has session data)
- **Error state**: "Completion save failed. Try again."

---

### Admin
`app/dashboard/DashboardClient.tsx` → `AdminScreen`

- **Layout**: Full screen scrollable
- **Header**: "Admin" + back arrow
- **Content blocks**:
  1. User email / ID search input
  2. "Impersonate user" CTA
  3. Impersonation banner (if active): "Viewing as {name}"
- **Data density**: Light
- **Loading state**: Spinner during user lookup
- **Empty state**: Empty search field
- **Error state**: "User not found"

---

### Generate Plan (Wizard)
`app/dashboard/GeneratePlanScreen.tsx`

- **Layout**: Full screen scrollable + sticky CTA at bottom
- **Header**: Step indicator ("Step {n} / {total}") + progress bar + step title + step subtitle

**Step 1 — Race**
- Content: Race name input, race date picker, distance chip selector, goal chip selector, target time input (conditional)
- Required: date, distance, goal
- Free restriction: Marathon+ distances locked

**Step 2 — Fitness**
- Content: Age input, avg weekly km, longest run, optional benchmark (race result or 30-min TT)

**Step 3 — Schedule**
- Content: Days per week selector (2–6), days off selector (day circles), max weekday session length
- Free upsell card at bottom

**Step 4 — Profile (paid/trial only)**
- Content: Resting HR, terrain preference, hard sessions preference, training style, injury history

- **Data density**: Medium (form-heavy)
- **Loading state**: N/A in form — Generating Ceremony handles it
- **Empty state**: Form fields empty
- **Error state**: Validation message on disabled CTA; "Something went wrong building the plan." screen with retry

---

### Generating Ceremony
`components/GeneratingCeremony.tsx`

- **Layout**: Full screen centered
- **Header**: None (copy is the headline)
- **Content blocks**:
  1. Rotating copy line (1 of 5 paid / 1 of 4 free), cycles every 1.8s
  2. 3 skeleton week cards (shimmer animation)
  3. Reveal phase: "There it is. Don't ruin it." headline + cards animate in
- **Data density**: Light
- **Dynamic copy**: See copy samples section
- **Loading state**: This is the loading state
- **Error / Empty states**: N/A

---

### Plan Preview
`app/dashboard/GeneratePlanScreen.tsx`

- **Layout**: Full screen scrollable
- **Header**: "Adjust inputs" back button
- **Content blocks**:
  1. Plan summary: race name, week count, start date, distance
  2. Confidence badge (paid): circular score + label + description + risk callouts
  3. Coach intro (paid): left teal accent bar + Claude-generated commentary
  4. Phase arc: representative week per phase (base, build, peak, taper)
     - Week cards showing phase label, session type dots, weekly km, long run hours, deload badge
  5. "+ {n} more weeks in your plan" footer
- **CTA sticky bottom**: "Use this plan" / "Saving…" (loading) + replacing-plan disclaimer
- **Data density**: Medium
- **Dynamic copy**: Race name, week count, confidence score, coach intro text, phase labels
- **Loading state**: N/A (preview shown after successful generation)
- **Error state**: N/A at this stage

---

### Upgrade
`app/dashboard/UpgradeScreen.tsx`

- **Layout**: Full screen + sticky CTA at bottom
- **Header**: Headline + subheading (two variants — see copy samples)
- **Content blocks**:
  1. Features / losses list (5 items, left teal accent bar)
  2. Pricing pair: monthly card + annual card (highlighted with saving badge)
  3. Legal copy
  4. Error message (amber, conditional)
- **CTA sticky bottom**: Primary "Start your subscription" + Secondary "Continue with free plan →"
- **Data density**: Medium
- **Dynamic copy**: Gain/loss framing based on `trialExpired`; pricing from BRAND constants
- **Loading state**: Button → "Loading…", disabled
- **Error state**: Amber inline error message; retry available
- **Empty state**: N/A

---

### Benchmark Update
`app/dashboard/BenchmarkUpdateScreen.tsx`

- **Layout**: Full screen scrollable
- **Header**: "Update your zones." + subheading + back button
- **Content blocks**:
  1. Current zones summary card: VDOT, Zone 2 ceiling, Max HR, Resting HR
  2. Benchmark form (if no result yet):
     - Type toggle: "Recent race result" / "30-min time trial"
     - Race: distance picker + finish time input
     - TT: distance covered input + help text
  3. Updated zones result card (if result received): new VDOT, ceiling, max HR, weeks updated count
  4. Error message (conditional)
- **CTA sticky bottom**: "Recalibrate zones" / "Back to plan"
- **Data density**: Medium
- **Loading state**: "Recalibrating…", button disabled
- **Error state**: Amber inline error message
- **Empty state**: Form fields empty

---

## 3. Interactions

| Screen | Primary Action | Secondary Actions | Navigation Exits |
|---|---|---|---|
| Login | Sign in / Sign up (email) | Google OAuth; toggle mode | Success → /dashboard |
| Privacy | None (read-only) | External links | Back → /auth/login |
| Loading | None | None | Auto → Dashboard or /auth/login |
| Welcome | "Let's go" | None | → Today |
| Orientation | "Start training" | None | → Today |
| Today | Tap session → Session Detail | Week chart navigation; confirm/revert adjustment; smoke tracker update | Nav → Plan / Coach / Strava / Me |
| Plan | Tap session → Session Detail | Drag session to reorder; "Load past weeks" | Nav → Today / Coach / Strava / Me |
| Coach (Paid) | Tap run analysis to expand | Generate weekly report; review adjustments | Nav → Today / Plan / Strava / Me |
| Coach Teaser | "Upgrade" CTA | None | Nav → Today / Plan / Me |
| Strava | Tap activity → detail popup | View metrics grid | Popup close; Nav → Today / Plan / Coach / Me |
| Me | Update profile fields | Toggle smoke tracker; change theme/units; benchmark update; generate plan; sign out; delete account | → Generate wizard; Nav → Today / Plan |
| Calendar | Tap day → Session Detail | Month navigation | Back → Today |
| Session Detail | Mark complete + save | Adjust RPE/fatigue; link Strava; view coach notes; manual log | Back → Today (or Plan) |
| Admin | Impersonate user | Search by email/ID | Back → Me |
| Generate (Wizard) | Continue / Generate my plan | Go back; upgrade (free); adjust inputs (preview) | Back → Me or Today; Preview → use plan |
| Generating Ceremony | None (automated) | None | Auto → Plan Preview |
| Plan Preview | "Use this plan" | "Adjust inputs" (back) | → Today (after save) |
| Upgrade | "Start your subscription" | Choose annual/monthly | "Continue with free plan →" → previous screen |
| Benchmark Update | "Recalibrate zones" | Toggle benchmark type | Back → Me |

---

## 4. Session Card Variants

Session cards appear in **Today**, **Plan**, and **Calendar** views. All resolve colour, label, and zone from `lib/session-types.ts`.

### By Session Type

| Type | Token | Collapsed | Expanded additions | Type-specific behaviour |
|---|---|---|---|---|
| **easy** | `--session-easy` | Label + distance or duration | HR target (Z2), pace bracket, RPE target, coach notes | Most common; Z2 only; fatigue warning if heavy trend |
| **long** | `--session-long` | Label + distance or duration | HR target, pace bracket, fueling notes | Highest weekly volume; shown on plan chart as long run hrs |
| **quality / tempo** | `--session-quality` | Label + distance | Pace target, HR target (Z3-4), RPE target | Hard session; post-run EF trend analysis |
| **intervals** | `--session-intervals` | Label + distance | Work/rest structure, pace, HR | High intensity; short reps; coach notes on form |
| **race** | `--session-race` | Label + race distance | Goal time, race notes | One per plan; countdown in Today header |
| **recovery** | `--session-recovery` | Label + distance | Short, easy, walk/jog allowed note | Below Z2; no HR ceiling enforcement |
| **strength** | `--session-strength` | Label | Duration, exercises (if authored) | Non-running; no HR target; admin-authored for v1 |
| **cross-train** | `--session-crosstrain` | Label | Activity type, duration | Bike/swim/other; load management alternative |
| **rest** | (none) | "Rest day" | None | No interaction on card; greyed; no drag handle |

### Completion States (overlay on any type)

| State | Visual |
|---|---|
| Complete | Teal ✓ badge |
| Complete + Strava | Strava colour dot + activity name + km |
| Skipped | "skipped" muted text |
| Incomplete (today or past) | Drag handle (move icon) |
| Incomplete (future) | Default — no overlay |

### Chart Representation (plan arc)

Week bars in Today and Plan screens are coloured by week status:

| Status | Colour |
|---|---|
| Done | Muted / greyed |
| Current | Teal + glow |
| Deload | Teal at 20% opacity |
| Upcoming | Border only |
| Race week | Strava orange |

---

## 5. Copy Samples

### Login

| Element | String |
|---|---|
| Wordmark | "Zona" |
| Tagline | `{BRAND.tagline}` → "Slow down. You've got a day job." |
| Sign in title | "Sign in" |
| Sign in subtitle | "Access your training plan." |
| Sign up title | "Create account" |
| Sign up subtitle | `{BRAND.signupSub}` → "14 days, no limits. After that, you decide." |
| Google button | "Continue with Google" |
| Google loading | "Redirecting..." |
| Divider | "or" |
| Email placeholder | "Email" |
| Password placeholder | "Password" |
| Age checkbox | "I confirm I am 13 years of age or older." |
| Submit (signin loading) | "Signing in…" |
| Submit (signup loading) | "Creating account…" |
| Submit (signin idle) | "Sign in" |
| Submit (signup idle) | "Create account" |
| Success message | "Account created — check your email to confirm, or sign in if confirmation is disabled." |
| Footer | "Slow down. You're not Kipchoge." |
| Privacy link | "Privacy Policy" |

---

### Generating Ceremony

| Phase | Paid copy | Free copy |
|---|---|---|
| Line 1 | "Reading your race date. Working backwards from the finish line." | "Working out your schedule." |
| Line 2 | "Calculating your Zone 2 ceiling. Lower than you'd expect." | "The 10% rule applies. Even now." |
| Line 3 | "Protecting you from yourself. The 10% rule applies, even here." | "Building in the deload weeks." |
| Line 4 | "Building in the deload weeks. You'll want them." | "Almost done." |
| Line 5 | "Almost done." | — |
| Reveal headline | "There it is. Don't ruin it." | "There it is. Don't ruin it." |

---

### Generate Plan Wizard

| Step | Title | Subtitle |
|---|---|---|
| 1 | "Your race." | "Start with the finish line. Work backwards from there." |
| 2 | "Be honest." | "The plan only works if these numbers are real. Flattering yourself here just means a harder race." |
| 3 | "Your schedule." | "Training has to fit your life. Not the other way around." |
| 4 | "A bit more detail." | "Terrain, injury history, training preferences. Skip what doesn't apply." |
| 1 (onboarding) | "Welcome to Zona." | "Let's build your plan. Start with the finish line." |

**Step 1 — Race**

| Element | String |
|---|---|
| Race name label | "Race name" |
| Race name placeholder | "(optional)" |
| Race date label | "Race date" |
| Distance label | "Distance" |
| Distance chips | "5K", "10K", "Half", "Marathon", "50K", "100K" |
| Marathon+ lock hint | "Marathon and longer require a paid plan. [Start free trial →]" |
| Goal label | "Goal" |
| Goal chips | "Just finish", "Target time" |
| Target time label | "Target time" |
| Target time placeholder | "e.g. 4:30:00" |
| Disabled CTA hint | "Date, distance, and goal are required" |

**Step 2 — Fitness**

| Element | String |
|---|---|
| Age label | "Age" |
| Age help | "Used to calculate your max heart rate and training zones." |
| Weekly km label | "Avg weekly km — last 4 weeks" |
| Longest run label | "Longest run — last 6 weeks (km)" |
| Benchmark label | "Recent benchmark" |
| Benchmark help | "A recent race time or time trial gives us precise pace targets for every session. Without one we use population estimates — still works, less personal." |
| Benchmark chips | "Recent race result", "30-min time trial" |
| Race distance label | "Race distance" |
| Finish time label | "Finish time" |
| Finish time placeholder | "e.g. 25:30 or 1:52:00" |
| TT distance label | "Distance covered in 30 minutes (km)" |
| TT distance placeholder | "e.g. 5.2" |
| TT help | "Run as far as you can in exactly 30 minutes on a flat surface. Record the distance." |

**Step 3 — Schedule**

| Element | String |
|---|---|
| Days per week label | "How many days can you run each week?" |
| Days per week chips | "2 days", "3 days", "4 days", "5 days", "6 days" |
| Days off label | "Days you can never train" |
| Days off chips | "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun" |
| Max session label | "Max weekday session length (mins)" |
| Max session placeholder | "90" |
| Max session help | "Leave blank for no limit. Applies Monday–Friday only." |
| Free upsell title | "Want a more personal plan?" |
| Free upsell detail | "Terrain, injury history, training style. Your plan adapts around what matters to you." |
| Free upsell CTA | "Upgrade to personalise →" |

**Step 4 — Profile (paid/trial)**

| Element | String |
|---|---|
| Resting HR label | "Resting heart rate" |
| Resting HR help | "Refines your Zone 2 ceiling via the Karvonen formula. Check your wearable's overnight average, or measure first thing in the morning before getting up. Skip if you don't know it." |
| Resting HR pre-filled note | "Pre-filled from your profile" |
| Terrain label | "Terrain preference" |
| Terrain chips | "Road", "Trail", "Mixed" |
| Hard sessions label | "Hard sessions" |
| Hard sessions chips | "Avoid them", "Fine either way", "Bring it on", "I overdo it" |
| Style label | "Training style" |
| Style chips | "Predictable", "Variety", "Minimalist", "Structured" |
| Injuries label | "Injury history" |
| Injuries chips | "Achilles", "Knee", "Back", "Hip", "Shin splints", "Plantar fasciitis" |

**Error screen**

| Element | String |
|---|---|
| Title | "Something went wrong building the plan." |
| CTA | "Try again" |

**CTA labels**

| Condition | String |
|---|---|
| Steps 1–3 | "Continue" |
| Step 4 | "Generate my plan" |
| Generating | "Generating…" |
| Preview back | "Adjust inputs" |
| Preview use | "Use this plan" |
| Preview saving | "Saving…" |
| Replace plan disclaimer | "This replaces your current plan." |

**Confidence badge (paid preview)**

| Score | Label | Description |
|---|---|---|
| 7+ | "Good fit" | "Your fitness and timeline line up. This plan will stretch you without breaking you." |
| 5–6 | "Possible" | "Achievable, but there's some stretch here. Stick to the easy days and it's yours." |
| <5 | "Challenging" | "This is a big ask given your current base. You can do it — the plan will reflect that." |

---

### Upgrade Screen

**Gain framing (trial fresh)**

| Element | String |
|---|---|
| Headline | "Your trial's done." |
| Subheading | "Time to make it official." |
| Feature 1 | "Weekly zone coaching" · "Your zone discipline score, every week. Honest." |
| Feature 2 | "Strava analysis" · "Your actual paces and HR. Not guesses." |
| Feature 3 | "AI session feedback" · "After every run. Knows your plan and your zones." |
| Feature 4 | "AI training plans" · "Built around your race, not a template." |
| Feature 5 | "Dynamic reshaping" · "Miss a week. The plan adapts." |

**Loss framing (trial expired)**

| Element | String |
|---|---|
| Headline | "Your coaching has paused." |
| Subheading | "14 days done. Here's what stopped." |
| Loss 1 | "Zone discipline coaching" · "Your weekly zone score has paused." |
| Loss 2 | "Weekly coaching reports" · "No more weekly reports." |
| Loss 3 | "Session feedback" · "Post-run analysis has stopped." |
| Loss 4 | "Plan adjustments" · "Your plan will no longer adapt." |

**Shared**

| Element | String |
|---|---|
| Monthly label | `{PRICING.monthly.display}` per month |
| Annual badge | `{PRICING.annual.savingLabel}` |
| Annual label | `{PRICING.annual.display}` per year · `{PRICING.annual.perMonthDisplay}` |
| Legal | "Auto-renews. Cancel any time. 14-day free trial included on first subscription." |
| Primary CTA | "Start your subscription" |
| Secondary CTA | "Continue with free plan →" |
| Loading CTA | "Loading…" |

---

### Benchmark Update Screen

| Element | String |
|---|---|
| Headline | "Update your zones." |
| Subheading | "You've done the work. Let's make sure your targets reflect it." |
| Current zones label | "Current zones" |
| Zone 2 ceiling label | "Zone 2 ceiling" (value: "< 145 bpm") |
| Max HR label | "Max HR" (value: "174 bpm") |
| Resting HR label | "Resting HR" |
| VDOT label | "VDOT" |
| No VDOT note | "Zones are based on age estimates. A benchmark test will make them personal." |
| Benchmark section label | "New benchmark" |
| Toggle 1 | "Recent race result" |
| Toggle 2 | "30-min time trial" |
| Race distance label | "Race distance" |
| Finish time label | "Finish time" |
| Finish time placeholder | "e.g. 24:15 or 1:49:30" |
| TT distance label | "Distance covered in 30 minutes (km)" |
| TT distance placeholder | "e.g. 5.4" |
| TT help | "Run flat, no stops, 30 minutes. Record distance covered." |
| Result label | "Zones updated" |
| Weeks updated | "{n} remaining weeks updated." |
| CTA (form) | "Recalibrate zones" |
| CTA (result) | "Back to plan" |
| CTA (loading) | "Recalibrating…" |

---

### Strava Panel

| Element | String |
|---|---|
| Connected status | "Strava connected · auto-syncing" |
| Not connected title | "Strava not connected" |
| Not connected hint | "Go to the Me screen to connect your Strava account." |
| Loading | "Connecting to Strava..." |
| Pace metric label | "Pace @ HR 145" |
| Pace metric sub | "Aerobic efficiency" |
| Avg HR label | "Avg HR (last 10)" |
| Avg HR sub (on target) | "Zone 2 ✓" |
| Avg HR sub (over) | "Above target" |
| This week label | "This week" |
| This week sub | "Running km" |
| Longest run label | "Longest run" |
| Longest run sub | "Since Jan 2026" |
| Activities label | "Recent activities" |
| Popup close | "Got it" |
| Coaching loading | "Analysing activity..." |
| Coaching error | "Analysis unavailable — check your connection." |

---

### Push Notifications Row (Me screen)

| Element | String |
|---|---|
| Row title | "Run notifications" |
| Subtitle (idle) | "Get notified after each run is analysed" |
| Subtitle (subscribed) | "Push notifications on" |
| Subtitle (denied) | "Blocked in device settings" |
| Enable button | "Enable" |
| Loading | "Enabling…" |

---

### Today — Fatigue Warning

| Element | String |
|---|---|
| Warning text | "You've been logging heavy effort. Keep it honest today." |

---

### Today — Strava Nudge (free users, post-completion)

| Element | String |
|---|---|
| Prompt | "Connect Strava to see how your HR compared." |

---

## 6. Open Questions / Rough Edges

1. **Calendar screen entry point removed**
   - `CalendarOverlay` is built, rendered, and wired (`screen='calendar'`) but the nav entry point is commented out (line 709: "CalendarOverlay hidden — entry point removed. Component lives in CalendarOverlay.tsx.")
   - Functionality overlaps with Plan screen's week view
   - **Question**: Intentional deprecation or deferred? Needs a decision before UX rework.

2. **Session Detail — screen vs sheet ambiguity**
   - `SessionScreen` navigates to `screen='session'` (full screen) but `SessionPopupInner` was originally a popup
   - The naming inconsistency (`SessionScreen` → `SessionPopupInner`) suggests a refactor mid-flight
   - **Question**: Is the current full-screen approach the intended final pattern?

3. **Orientation shown on plan replacement**
   - `setShowOrientation(true)` fires in `handlePlanSaved` — this means orientation fires every time a plan is generated, including replacements
   - **Question**: Should orientation only show on first-ever plan generation?

4. **Dynamic adjustments toggle in Me screen**
   - Toggle is buried in settings; no contextual explanation on when adjustments fire
   - Pending adjustment flow is in Today screen, but the toggle to disable it is in Me
   - **Question**: Should there be a "pause auto-adjustments" option inline in the pending adjustment banner?

5. **Smoke tracker**
   - Full implementation visible (toggle, quit date, days count)
   - Minimal presence in Today screen — only shows days count as a stat
   - No clear onboarding or discovery path for this feature
   - **Question**: Is this actively maintained or legacy from a previous version?

6. **Strava token failure state**
   - `stravaTokenFailed` is set but the UI shows a generic banner without a clear reconnect CTA
   - **Question**: Should there be a one-tap "Reconnect Strava" action in the banner?

7. **Admin impersonation — no audit log in UI**
   - Impersonation active state is shown ("Viewing as {name}") but no server-side audit trail visible in UI
   - **Question**: Is this logged in Supabase? Should there be a confirmation step?

8. **Coach intro field (`meta.coach_intro`)**
   - Rendered in Plan Preview if present in `plan.meta`
   - Not always present (depends on AI enrichment success)
   - **Question**: What is the fallback experience when coach_intro is absent?

9. **Confidence badge reference to INV-PLAN-008**
   - Code comment references "INV-PLAN-008" but this invariant does not exist in the architectural principles skill or docs
   - **Question**: Is this a stale reference or a missing invariant that should be documented?

10. **`coach_notes` field — tuple structure unclear**
    - Defined as `string | string[]` in session types
    - Rendered differently depending on whether it's a string or array
    - **Question**: What do multiple array entries represent? (intro / detail / action?)

11. **Free upsell placement in wizard (Step 3)**
    - Upsell card shown at the bottom of Step 3 before the user has seen a plan
    - **Question**: Would conversion be higher if shown on the Plan Preview screen after the user has seen what they'd get?

12. **Longest run metric — "Since Jan 2026" hardcoded**
    - The Strava panel shows "Since Jan 2026" as a sub-label for the longest run metric
    - **Question**: Is this hardcoded or computed from plan start date? Should it be dynamic.

13. **Plan archive — no restore UI**
    - `plan_archive` table is populated on every plan save (fire-and-forget)
    - No UI to browse or restore archived plans
    - **Question**: Is this compliance-only for v1 or is plan history a planned feature?

14. **Dual metric system edge case**
    - Sessions can have both `distance_km` and `duration_mins`
    - `primary_metric` flag determines which is displayed
    - **Question**: What happens if `primary_metric` is missing from an older plan JSON? Is there a safe fallback?

15. **Welcome screen trigger**
    - Welcome screen is shown for "migrated users with existing plans" but trigger condition is unclear from code
    - **Question**: Is this still relevant post-migration or can it be retired?

16. **ErrorBoundary coverage**
    - `ErrorBoundary` component exists but coverage is partial
    - Individual screens may crash without the boundary catching them
    - **Question**: Should ErrorBoundary wrap each screen individually?

---

*End of inventory. 19 screens / states documented. 16 open questions logged.*
