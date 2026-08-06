# Brand Copy Alignment — Zonna

**Authority**: This document is the single reference for every user-visible copy string in Zonna.
It maps canonical values → surfaces → divergences → execution list.

When `lib/brand.ts` and this doc disagree, `lib/brand.ts` is the truth. Fix this doc.
When a component and this doc disagree, the component is wrong. Fix the component.

**Last audited**: 2026-05-23 (values) · 2026-08-06 (registry removed — see §1; §2 surface line-numbers are indicative, not exact — verify against source before editing)

---

## 1. Canonical String Registry — moved to code

**The value registry that used to live here has been removed (2026-08-06).** It duplicated `lib/brand.ts` and had drifted out of sync — the exact thing this doc exists to catch. A doc whose "current value" table disagrees with the code is worse than no table.

**The exact current value of every brand string and price is `lib/brand.ts → BRAND` / `PRICING`.** Read it there. This doc never restates values — it maps *surfaces* (§2), records *divergences from canon* (§3), and holds the pre-ship *voice checklist* (§6).

If a surface below shows a value that disagrees with `lib/brand.ts`, `lib/brand.ts` wins and the surface is the bug.

---

## 2. Surface Map

Every screen/component with user-visible copy, what it currently shows, and its source.

### 2.1 Login screen (`app/auth/login/page.tsx`)

| Surface element | Current value | Source |
|---|---|---|
| Wordmark | `'Zonna'` | **Hardcoded** (should be `BRAND.name`) |
| Under wordmark | `"Slow down. You've got a day job."` | `BRAND.tagline` ✓ |
| Sign-in sub | `BRAND.signinSub` (`'Pick it up where you left off.'`) | ✓ Sourced from `BRAND.signinSub` (DIV-010, 2026-05-23) |
| Sign-up sub | `'14 days, no limits. After that, you decide.'` | `BRAND.signupSub` ✓ |
| Google button | `'Continue with Google'` / `'Redirecting...'` | Hardcoded UI copy — acceptable |
| Submit button | `'Sign in'` / `'Create account'` | Hardcoded UI copy — acceptable |
| Confirm email message | `'Account created — check your email to confirm, or sign in if confirmation is disabled.'` | Hardcoded UI copy — acceptable |
| Footer line | ~~removed~~ | Removed 2026-04-24 — tagline already owns this space. Privacy link remains. |
| Privacy link | `'Privacy Policy'` | Static — acceptable |

### 2.2 Loading / splash screen (`DashboardClient.tsx` ~line 580)

| Surface element | Current value | Source |
|---|---|---|
| Wordmark | `'Zonna'` | **Hardcoded** (should be `BRAND.name`) |
| Tagline | `"Slow down. You've got a day job."` | `BRAND.tagline` ✓ |

### 2.3 Welcome screen — first login (`DashboardClient.tsx` ~line 593)

| Surface element | Current value | Source |
|---|---|---|
| Wordmark | `'Zonna'` | **Hardcoded** |
| Tagline | `"Slow down. You've got a day job."` | `BRAND.tagline` ✓ |
| Headline | `'Your plan is ready.'` | Hardcoded — contextual UI copy, acceptable |
| Body 1 | `'Zonna keeps track of your sessions, adapts when things shift, and keeps you focused on what matters — finishing.'` | Hardcoded — **review: verbose, passive, generic** |
| Body 2 | `'Train with intention. The rest follows.'` | Hardcoded — **review: doesn't sound like Zonna voice** |

### 2.4 Plan-ready screen (`DashboardClient.tsx` ~line 860)

| Surface element | Current value | Source |
|---|---|---|
| Wordmark | `'Zonna'` | **Hardcoded** |
| Tagline | `"Slow down. You've got a day job."` | `BRAND.tagline` ✓ |
| Headline | `'{firstName}, your plan is set.'` / `'Your plan is set.'` | Hardcoded — contextual, acceptable |
| Sub | `'{n} weeks. One session at a time.'` | Hardcoded — acceptable |

### 2.5 Upgrade screen (`app/dashboard/UpgradeScreen.tsx`)

| Surface element | Current value | Source |
|---|---|---|
| Headline (trial not expired) | `"Your trial's done."` | Hardcoded — acceptable |
| Headline (trial expired) | `'Your coaching has paused.'` | Hardcoded — acceptable |
| Sub (trial not expired) | `'Time to make it official.'` | Hardcoded — acceptable |
| Sub (trial expired) | `"14 days done. Here's what stopped."` | Hardcoded — acceptable |
| Feature: weekly coaching | `'Weekly zone coaching'` / `'Your zone discipline score, every week. Honest.'` | Hardcoded — acceptable |
| Feature: Strava | `'Strava analysis'` / `'Your actual paces and HR. Not guesses.'` | Hardcoded — acceptable |
| Feature: AI feedback | `'AI session feedback'` / `'After every run. Knows your plan and your zones.'` | Hardcoded — acceptable |
| Feature: AI plans | `'AI training plans'` / `'Built around your race, not a template.'` | Hardcoded — acceptable |
| Feature: reshaping | `'Dynamic reshaping'` / `'Miss a week. The plan adapts.'` | Hardcoded — acceptable |
| Loss: zone coaching | `'Zone discipline coaching'` / `'Your weekly zone score has paused.'` | Hardcoded — acceptable |
| Loss: reports | `'Weekly coaching reports'` / `'No more weekly reports.'` | Hardcoded — acceptable |
| Loss: session feedback | `'Session feedback'` / `'Post-run analysis has stopped.'` | Hardcoded — acceptable |
| Loss: adjustments | `'Plan adjustments'` / `'Your plan will no longer adapt.'` | Hardcoded — acceptable |
| Legal | `'Auto-renews. Cancel any time. 14-day free trial included on first subscription.'` | Hardcoded — review before App Store submission |
| Primary CTA | `'Start your subscription'` | Hardcoded — acceptable |
| Secondary CTA | `'Continue with free plan →'` | Hardcoded — acceptable |

### 2.6 Generating Ceremony (`components/GeneratingCeremony.tsx`)

Loading copy is intentional brand voice — part of the product experience. Not parameterised in `BRAND`; that's correct (these are product copy, not brand constants).

| Tier | Lines |
|---|---|
| PAID | "Reading your race date. Working backwards from the finish line." → "Calculating your Zone 2 ceiling. Lower than you'd expect." → "Protecting you from yourself. The 10% rule applies, even here." → "Building in the deload weeks. You'll want them." → "Almost done." |
| FREE | "Working out your schedule." → "The 10% rule applies. Even now." → "Building in the deload weeks." → "Almost done." |
| Reveal | `"There it is. Don't ruin it."` |

**Voice check**: All lines pass. Dry, direct, Zonna-correct.

### 2.7 Free Coach screen (locked state) (`DashboardClient.tsx` ~line 3587)

| Surface element | Current value |
|---|---|
| Card headline | `'Your weekly coaching report.'` |
| Card body | `"Connect Strava and run a few sessions. We'll tell you exactly what's working — and what isn't."` |
| Upsell CTA label | `'See your zone discipline score'` |
| Upsell CTA sub | `'Weekly report, session feedback, plan adjustments — all from your Strava data.'` |
| Upsell button | `'Upgrade →'` |

**Voice check**: Card body is wordy and features `"we'll tell you exactly"` — slightly salesy, doesn't sound like Zonna. Flagged for review.

### 2.8 Deload week coaching (`DashboardClient.tsx` ~line 2772)

| Surface element | Current value |
|---|---|
| Label | `'Deload week'` |
| Headline | `'Deload week.'` |
| Body | `"You've been piling on the load. This is the week your body catches up. Don't ruin it with extra miles."` |

**Voice check**: Passes. Blunt and correct.

### 2.9 Push notification fallbacks (`app/api/analyse-run/route.ts` — `verdictPushBody()`)

| Verdict | Body |
|---|---|
| `strong` | `'{Xkm} in. Looked controlled.'` |
| `good` | `'{Xkm} done. Solid work.'` |
| `ok` | `'{Xkm} logged. Review your zones.'` |
| `drifted` | `'{Xkm} — HR went high. Worth checking.'` |
| `hard` | `'{Xkm} — that was a tough one.'` |
| default | `'{Xkm} logged.'` |

**Voice check**: Passes. Short, factual, no cheerleading.

### 2.10 Privacy page footer (`app/privacy/page.tsx` line 262)

| Surface element | Current value | Source |
|---|---|---|
| Footer | `"You can't outrun your easy days."` | `BRAND.brandStatement` ✓ |

### 2.11 OG image (`app/api/og/route.tsx`)

| Surface element | Source |
|---|---|
| Wordmark | `BRAND.name` ✓ |
| Tagline | `BRAND.tagline` ✓ |

### 2.12 Page `<title>` / meta (`app/layout.tsx`)

| Tag | Value | Source |
|---|---|---|
| `<title>` | `'Zonna — Slow down. You've got a day job.'` | `BRAND.name` + `BRAND.tagline` ✓ |
| `<meta description>` | `"You can't outrun your easy days."` | `BRAND.brandStatement` ✓ |
| OG title | same as `<title>` | ✓ |
| OG description | same as `<meta description>` | ✓ |

---

## 3. Divergences from Canon

These are the gaps between what the code does and what it should do.

| # | File | Line(s) | Issue | Severity |
|---|---|---|---|---|
| DIV-001 | `app/auth/login/page.tsx` | 73 | `'Zonna'` hardcoded — should be `BRAND.name` | Low — functionally identical until name changes |
| DIV-002 | `app/auth/login/page.tsx` | 224 | ~~`"Slow down. You're not Kipchoge."` hardcoded~~ | ✅ Fixed 2026-04-24 — removed from login entirely |
| DIV-003 | `app/dashboard/DashboardClient.tsx` | 603 | `'Zonna'` wordmark hardcoded in Welcome screen | Low |
| DIV-004 | `app/dashboard/DashboardClient.tsx` | 871 | `'Zonna'` wordmark hardcoded in Plan-ready screen | Low |
| DIV-005 | `app/privacy/page.tsx` | 262 | `"You can't outrun your easy days."` via `BRAND.brandStatement` | ✅ Resolved — now uses canonical constant |
| DIV-006 | `app/auth/login/page.tsx` | 98 | `'Access your training plan.'` (sign-in sub) has no `BRAND` field — it's the only hardcoded sub with no canonical home | Low — but needs a field if this copy ever changes |
| DIV-007 | `app/dashboard/DashboardClient.tsx` | 615–619 | Welcome screen body copy doesn't pass Zonna voice check — passive and generic | Copy quality — not a code defect |
| DIV-008 | `app/dashboard/DashboardClient.tsx` | 3598 | Free Coach card body `"we'll tell you exactly"` is slightly salesy | Copy quality — not a code defect |
| DIV-009 | `docs/canonical/brand.md` | 9 | Listed tagline was old brand statement — **fixed in same commit as this doc** | ✅ Fixed |
| DIV-010 | `lib/brand.ts:39` (`signinSub`) | `'Access your training plan.'` is generic portal language — register mismatches the tagline above it. Tracked as part of VOICE-PATCH-01 (review 2026-05-23). | ✅ Fixed 2026-05-23 — now `'Pick it up where you left off.'` |
| DIV-011 | `GeneratePlanScreen.tsx:943` | `'Welcome to Zonna…'` is the most generic SaaS opener available. TODO already flagged in code. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — now `'Start with the finish line.'` / `'Work backwards from there.'` |
| DIV-012 | `lib/brand.ts:80` (`push.runAnalysis`) | `'Run logged.'` is a system label, not a coaching opening — contradicts the comment beside it. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — now `"That's done. Kit's reading."` |
| DIV-013 | `app/dashboard/DashboardClient.tsx:6864` (Strava settings row) | `'Zonna will read your Strava activities to provide coaching insights. No other data is accessed.'` reads as legal boilerplate. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — now `'Kit reads your Strava runs. Nothing else. We're not interested in your followers.'` |
| DIV-014 | `app/dashboard/DashboardClient.tsx:6743` (push settings row) | `'Run notifications. Get notified after each run is analysed.'` — "notifications" + "notified" in one sentence. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — idle state now `"Kit pings you when he's read your run."` |
| DIV-015 | `app/dashboard/DashboardClient.tsx:1968` (skip-injury copy) | `'Smart call. Come back when you're ready.'` — faintly American-coach register. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — now `"Right call. Don't push it."` |
| DIV-016 | `app/dashboard/DashboardClient.tsx:1906` (`getCompletionCopy`, strength) | `'Usually around km 70.'` — funny for an ultra trainee, confusing for a 10K trainee. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — universal `"The legs will thank you when it matters."` used for all race distances |
| DIV-017 | `app/dashboard/UpgradeScreen.tsx` | `'Continue with free plan →'` — flow word "continue" instead of choice word "stay". Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — now `'Stay with the free plan →'` |
| DIV-018 | `app/dashboard/DashboardClient.tsx:8077` (`LockedCoachingPreview`) | `'Your coaching appears here.'` — generic SaaS register. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — now `'Kit reads here. He needs your runs first — Strava or Apple Health.'` |
| DIV-019 | `app/auth/login/page.tsx:168` (signup success) | `'…or sign in if confirmation is disabled.'` — internal engineering escape hatch leaked into user copy. Tracked as part of VOICE-PATCH-01. | ✅ Fixed 2026-05-23 — now `'Account created. Check your email.'` |
| DIV-020 | Tagline repetition | `BRAND.tagline` rendered on splash + login + orientation. Over-use degrades the asset. Tracked as STOP-01 (review 2026-05-23). | ✅ Fixed 2026-05-23 — splash + welcome + orientation now use `BRAND.voiceAnchor`; tagline stays on login only |

---

## 4. Execution List

Changes required to close every divergence. Ordered: code correctness first, copy quality second.

### 4.1 Code fixes — single-source-of-truth (DIV-001 to DIV-006)

These are mechanical substitutions. No design decisions needed.

| # | File | Change |
|---|---|---|
| E-001 | `app/auth/login/page.tsx:73` | Replace `'Zonna'` wordmark literal with `{BRAND.name}` |
| E-002 | `app/auth/login/page.tsx:224` | ✅ Done — removed from login entirely (2026-04-24) |
| E-003 | `app/dashboard/DashboardClient.tsx:603` | Replace `'Zonna'` with `{BRAND.name}` |
| E-004 | `app/dashboard/DashboardClient.tsx:871` | Replace `'Zonna'` with `{BRAND.name}` |
| E-005 | `app/privacy/page.tsx:262` | ✅ Done — using `{BRAND.brandStatement}` (2026-04-24) |
| E-006 | `lib/brand.ts` | Add `signinSub: 'Access your training plan.'` to `BRAND` object, then wire `app/auth/login/page.tsx:98` to use it |

### 4.2 Copy quality fixes (DIV-007, DIV-008)

These require copy decisions, not just code changes. Treat as product work.

| # | Location | Current | Issue | Suggested alternative |
|---|---|---|---|---|
| E-007 | Welcome screen body 1 | `'Zonna keeps track of your sessions, adapts when things shift, and keeps you focused on what matters — finishing.'` | Two clauses, passive, generic — could be any fitness app | `'Your plan does the thinking. You do the running.'` |
| E-007 | Welcome screen body 2 | `'Train with intention. The rest follows.'` | Sounds like a yoga studio, not Zonna | `'Don't overthink it. Just do today's session.'` |
| E-008 | Free Coach card body | `"Connect Strava and run a few sessions. We'll tell you exactly what's working — and what isn't."` | `"we'll tell you exactly"` is salesy; `"We'll"` is implicit AI promise | `"Run a few sessions. We'll tell you whether you're doing the easy ones too hard."` (or drop the card body entirely — the upsell CTA carries the message) |

### 4.3 Pre-App Store copy review

These items are acceptable now but need a pass before App Store submission.

| # | Item | Note |
|---|---|---|
| E-009 | UpgradeScreen legal copy | `'Auto-renews. Cancel any time. 14-day free trial included on first subscription.'` — Apple requires specific subscription terms disclosure. Exact wording needs legal/compliance review. |
| E-010 | `BRAND.signupSub` | `'14 days, no limits. After that, you decide.'` — `"no limits"` must be accurate for the free tier. Confirm the free tier is genuinely uncapped during the trial (it is — trial users get full paid access). |
| E-011 | App Store description | Will need a version of `BRAND.brandStatement` + feature bullets. Not written yet. Write against Zonna voice when App Store Connect setup begins. |

---

## 5. What Not to Parameterise

Not every string belongs in `lib/brand.ts`. Inline UI copy that is contextual, functional, and unlikely to change globally should stay in the component. Parameterise only copy that:

- Appears on multiple surfaces (tagline, wordmark, brand statement)
- Has brand/tone weight (push notification titles)
- Is pricing-related (always parameterised to avoid search-replace errors)

**Do not move into `BRAND`:**
- Button labels (`'Sign in'`, `'Start your subscription'`)
- Error messages (`'Could not reach the server. Try again.'`)
- Generating Ceremony lines (product voice, not brand constants)
- Screen-specific coaching copy (deload week body, reflect responses)
- Empty state copy
- `"Train within the lines."` — social/content phrase only, intentionally not in `BRAND`. If it appears in a component, remove it.

---

## 6. Voice Invariants

Quick checklist before shipping any new copy string.

- [ ] One sentence or fewer (for coaching responses and notifications)
- [ ] No exclamation marks
- [ ] No `"Amazing!"`, `"Great job!"`, `"You crushed it!"`
- [ ] No passive-aggressive guilt (`"You haven't logged in 3 days"`)
- [ ] No false urgency (`"You need to run today!"`)
- [ ] No fitness-influencer language (`"smash"`, `"beast mode"`, `"gains"`)
- [ ] No AI-hedging (`"It seems like..."`, `"Based on your data..."`)
- [ ] Honest if something went wrong — not euphemistic
- [ ] Would this sound right coming from a slightly sarcastic friend who is also a running coach? ✓
