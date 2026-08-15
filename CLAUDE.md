# CLAUDE.md — Zonna Project Intelligence

This is the single source of truth for the Zonna codebase.
Read this before touching anything. All design, architecture, and
behavioural rules live here or in /docs.

> **Brand name history:** the product was launched internally as "Zona", renamed to "Vetra" in early 2026, and renamed again to "Zonna" in May 2026. The brand may rename again. Therefore: **never hardcode any brand name in code — always reference `BRAND.name` from `lib/brand.ts`**. In docs and comments, use the current name ("Zonna"). Older docs (ADRs, phase logs, dated audits) may still reference "Zona" or "Vetra"; treat those as the same product.

---

## Brand

### Positioning

> **Zonna is for runners who blur their zones — who go medium-hard on everything, never truly recover, and never truly push.**

Core truth: "You're trying hard. That's the problem."

Zone discipline is the product idea: commit to the zone you're in. Run easy when it's easy. Run hard when it's hard. The problem isn't that users go too fast — it's that they can't tell the difference between sessions because every run ends up in the same grey middle. Zonna removes that ambiguity.

### The three-line tagline system

| Line | Job | `BRAND` constant | Where it appears |
|---|---|---|---|
| **"Training plans that stop you overtraining."** | What the app does. Functional, discovery-facing. | `BRAND.appStoreSubtitle` | App Store subtitle, landing page hero, paid ads |
| **"Slow down. You've got a day job."** | Who the app is for. The demographic hook. | `BRAND.tagline` | Login screen, loading screen, OG image, meta description |
| **"You can't outrun your easy days."** | How the brand sounds. Voice/personality moment. | `BRAND.brandStatement` | Privacy footer, App Store description (not login — tagline owns that space) |

**Rules:**
- Never mix two taglines on the same surface
- Never rephrase them — they are locked strings
- `BRAND.name` is `'Zonna'` (parameterised — may change again). Never hardcode a brand name in any component, comment, or prompt. Interpolate from `BRAND.name`.
- When in doubt: discovery = #1, in-app = #2, voice moment = #3

**In-product voice anchor — `BRAND.voiceAnchor`: "Hold the zone."**
Use across push notifications, coach cards, and session prompts where the message is about zone commitment. This is the phrase that expresses the product's core discipline in the moment. Not for marketing copy. Not for the login screen.

**Secondary brand phrase (social/content only): "Train within the lines."**
For social posts and content marketing. More approachable register than the taglines. Never in the product UI — not parameterised in `lib/brand.ts`. If it appears in a component, remove it.

**All brand strings and pricing are parameterised in `lib/brand.ts`.** Never hardcode taglines, app name, or pricing values in components.

### Voice rules

Honest, slightly sarcastic, self-aware, encouraging without cringe.

| Works | Doesn't work |
|---|---|
| *"Bit keen. Ease it back."* | "You're crushing it!" |
| *"There it is. Don't ruin it."* | "Ready to conquer your run?" |
| *"Do nothing. It helps."* | "Beast mode activated" |
| *"Kept it under control."* | "Based on your data..." |
| *"Happens. Plan's been shifted."* | "Amazing job today!" |
| *"HR went high. Worth checking."* | Emojis in functional copy |

One sentence is better than two. Specific beats abstract. Never motivational.

---

## What Is Zonna?

A running training app for non-elite runners who overtrain.
Each user brings their own plan — race, distance, training phase. All
athlete-specific data (race, HR zones, name) lives in the plan JSON
and user_settings. Nothing is hardcoded to a specific person.

---

## Tech Stack

| Layer        | Tech                          |
|--------------|-------------------------------|
| Frontend     | Next.js (App Router)          |
| Backend      | Supabase                      |
| Deployment   | Vercel                        |
| Native shell | Capacitor (iOS) — see below   |
| Plan data    | GitHub Gist (JSON)            |
| Auth         | Supabase Auth                 |
| Fitness API  | Strava (free tier)            |
| Dev machine  | Mac Mini                      |

- Supabase project ID: `wkppmpsvqkaxbekdgzdm`
- Vercel app: `https://www.zonna.run` (production custom domain on Vercel project `zona`). The legacy `rts-training-hub` Vercel project still exists but no live traffic depends on it.
- Plan JSON: `https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json`
  - Always fetched with `cache: 'no-store'`

### Native shell — Capacitor

The iOS app is a Capacitor wrapper around the Vercel-hosted web app, not a standalone native build.

| Setting | Value |
|---|---|
| Bundle ID | `app.zonna.ios` |
| App name | `Zonna` (sourced from `BRAND.name`) |
| Strategy | `server.url` → loads Next.js from Vercel; native plugins layered on top |
| Config | `capacitor.config.ts` (root) |
| Native project | `ios/` (committed; build artifacts gitignored by `ios/.gitignore`) |

**Why server.url, not static export:** Next.js API routes, SSR, dynamic OG, and Supabase auth callbacks all need a running server. Same JS code ships to web and iOS.

**Common commands:**
- `npx cap sync ios` — copy web assets + plugin updates into the iOS project (run after adding/updating Capacitor plugins)
- `npx cap open ios` — open the Xcode project
- `npx cap run ios` — build and run on simulator (requires Xcode)

**Local dev against a local Next.js server:** temporarily edit `capacitor.config.ts` to set `server.url` to `http://<your-mac-ip>:3000` and `cleartext: true`, then `npm run dev` and `npx cap run ios`. Don't commit the local URL.

**Native plugins installed:**
- `@capacitor/splash-screen` — splash hold + manual hide on web mount (CapacitorBoot.tsx)
- `@capacitor/status-bar` — warm-slate background, dark text, webview below status bar
- `@capacitor/browser` — opens OAuth URLs in SFSafariViewController (Google blocks WKWebView with `disallowed_useragent`)
- `@capacitor/app` — listens for deep-link returns (`appUrlOpen` event)
- `@capacitor/push-notifications` — registers for APNs and posts the device token to `/api/push/subscribe` with `platform: 'ios'`
- `@capawesome/capacitor-apple-sign-in` — Sign in with Apple via ASAuthorizationController, returns inline (no browser hop). Bridged to Supabase via `signInWithIdToken({ provider: 'apple', token, nonce })`. Entitlement: `com.apple.developer.applesignin` in `App.entitlements`. **Don't switch to `@capacitor-community/apple-sign-in`** — it's still on Capacitor 7 and conflicts with `@capgo/capacitor-health@8.x` over `capacitor-swift-pm` (the SPM resolver fails: one wants `7.x`, the other wants `8.x`). Capawesome's plugin requires `@capacitor/core >=8` and resolves cleanly.

**Auth on native:** custom URL scheme `app.zonna.ios://auth-callback` is registered in `Info.plist`. Supabase OAuth runs with `skipBrowserRedirect: true`, the URL is opened via `Browser.open()`, and the callback is exchanged for a session in `CapacitorBoot.tsx`'s `appUrlOpen` listener. The same scheme should be reused for Strava OAuth when it's ported off `window.location.href`.

**Password reset (AUTH-RESET-01) — one-time Supabase setup (don't skip):** the forgot-password flow ("Forgot password?" on the login screen → `resetPasswordForEmail` → `app/auth/reset/page.tsx`) relies on the recovery email linking with a **`token_hash`**, not the default PKCE `?code=`. PKCE's `code_verifier` is browser-local, so a `?code=` link opened on a different device or in Safari (the iOS-native case — the email never opens in the Capacitor webview) can't be exchanged and reset silently fails. **Fix is dashboard-only:** set the *Reset Password* email template link to `{{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery` and add `/auth/reset` to Auth → URL Configuration → Redirect URLs. The reset page falls back to `?code=` auto-exchange for same-device web, so web works without this — but native/cross-device needs it.

**Sign in with Apple — name handoff (don't break this):** Apple returns the user's `givenName` + `familyName` *only* on the very first authorization — privacy design — and never again on subsequent sign-ins. The login handler in `app/auth/login/page.tsx` (`signInWithApple`) captures these from the plugin response and persists them via `supabase.auth.updateUser({ data: { full_name } })` immediately after `signInWithIdToken` succeeds. The existing pre-fill in `DashboardClient.tsx:495–505` then reads `user.user_metadata.full_name` and writes first/last to `user_settings` automatically — same path Google uses. If you change the login flow, keep this `updateUser` call: skipping it leaves Profile blank forever with no way to recover the name from Apple.

**Push notifications:** fully wired end-to-end on iOS native (2026-05-09). Client registers via `@capacitor/push-notifications`, backend has `platform` column on `push_subscriptions`, `/api/push/subscribe` accepts both web (VAPID) and iOS (APNs token) shapes, iOS sends route through `lib/apnpush.ts` (uses the `apn` npm package). Apple Dev portal capability + APNs .p8 key + Xcode target capability + Vercel env vars (`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC=app.zonna.ios`, `APNS_PRODUCTION`) all in place. Simulator-validated registration; TestFlight build will exercise the production APNs server (set `APNS_PRODUCTION=1` in Vercel before that build — sandbox tokens are rejected by the production server and vice versa).

**Local Capacitor plugins — `SharedStorePlugin` + `HealthObserverPlugin`:** custom Swift plugins in `ios/App/App/*.{swift,m}`. `SharedStorePlugin` bridges App-Group `UserDefaults(suiteName: "group.app.zonna.ios")` to JS so the home-screen widget can read state (race countdown, today's session). `HealthObserverPlugin` (HR-SYNC-03) registers `HKObserverQuery` + `enableBackgroundDelivery` for workouts/HR/recovery so a finished run wakes the ingest pipeline in the background — **this is what makes the run-analysis push arrive with the app closed.** Capacitor 8 does NOT auto-discover local plugins via the `CAP_PLUGIN` macro — it reads `ios/App/App/capacitor.config.json → packageClassList` and instantiates each named class via `NSClassFromString`. **Any local plugin missing from that list is silently absent** (empty widget; dead background push — pushes then only fire on manual app-open).

`npx cap sync ios` regenerates `packageClassList` by scanning installed npm packages only, so it WIPES every local plugin each run. **Never run raw `npx cap sync ios` — always `npm run sync:ios`**, which runs the sync, then `scripts/fix-cap-config.mjs` (re-adds the local plugins), then `scripts/verify-cap-config.mjs` (fails loudly if any is missing). The canonical plugin list lives in `scripts/local-ios-plugins.mjs` — add every new local plugin there. `npm run verify:ios-plugins` is the standalone check; wire it as an Xcode "Run Script" build phase before Compile Sources so a broken config can't ship. See `ios/App/ZonnaWidgetExtension/README.md` Step 5b.

> **Regression history (2026-08):** `HealthObserverPlugin` was never added to `fix-cap-config.mjs`'s re-add list (it only knew `SharedStorePlugin`), so every sync silently dropped it → background run-analysis push died → pushes only fired on app-open. Fixed by the single-source `local-ios-plugins.mjs` + verify gate above.

**Native plugins still to add (see backlog):**
- `@revenuecat/purchases-capacitor` — StoreKit 2 via RevenueCat (gated on RevenueCat setup)

---

## Design System — Warm Slate (ADR-007)

Single light theme. No dark mode (ADR-008).

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#F3F0EB` | Primary background — warm off-white |
| `--bg-soft` | `#EDE9E1` | Input fields, inset areas |
| `--card` | `#FFFFFF` | Card surfaces |
| `--ink` | `#1A1A1A` | Primary text |
| `--ink-2` | `#3D3A36` | Secondary text |
| `--mute` | `#8A857D` | Muted / supporting text |
| `--moss` | `#6B8E6B` | Primary accent — CTA, active states |
| `--warn` | `#B8853A` | Coaching, warnings |
| `--danger` | `#B84545` | Errors only — never in training UI |
| `--line` | `rgba(26,26,26,0.08)` | Standard borders |

**Font:** Inter only — `var(--font-ui)` and `var(--font-brand)` both resolve to Inter. Space Grotesk retired (ADR-007).

**Font tokens:** `var(--font-ui)` and `var(--font-brand)` are the only two font tokens. `--font-display` is NOT a token.

**Legacy aliases:** All System B token names (`--accent`, `--teal`, `--amber`, `--text-primary`, `--card-bg`, `--border-col`, `--session-easy`, etc.) alias to Warm Slate tokens in `globals.css`. Components using old names continue to work — four files reverted to legacy aliases by linter post-Phase 3 merge; aliases intentionally retained until those files are updated.

**BANNED:**
- `#D4501A` (ember orange)
- `#f5f2ee` (warm beige)
- `#0B132B` (navy) — retired with System B
- `#5BC0BE` (teal) — replaced by `--moss`
- DM Mono, DM Sans, Space Grotesk
- Hardcoded colour values anywhere in components
- Hardcoded font family strings — use `var(--font-ui)` / `var(--font-brand)` only

All colour MUST come from CSS custom properties in `globals.css`. Nothing hardcoded in component files.

### Session Type Colour Map (Warm Slate values)

| Type | Token | Hex |
|---|---|---|
| easy | `--s-easy` | `#3D6FB0` |
| long | `--s-long` | `#5E4FB0` |
| quality/tempo | `--s-quality` | `#B8853A` |
| intervals | `--s-inter` | `#B84545` |
| race | `--s-race` | `#C86A2A` |
| recovery | `--s-recov` | `#4E8068` |
| strength | `--s-strength` | `#5A6578` |
| cross-train | `--s-cross` | `#3D8A88` |
| rest | — | No accent |

---

## UI Principles

- One job per screen
- Calm guidance, not alerts
- Restraint feels like progress
- No dashboards or noise
- No popups — all interactions navigate to full screens
- Back arrow always top-left
- Slide-up sheets: mirrored nav bar at bottom, not top
- Single light theme — no dark mode, no theme toggle
- **AI provenance is visible** — model-generated content carries the `<AIMark />` glyph (sparkle + accent dot). Working state pulses while AI is in flight; replaces spinners. Apply only to actual model output; never to rule-engine, hand-authored copy, or Strava data. See `ui-patterns.md` § AIMark.

**Reference aesthetic: Runna + Planzy** — bold metric hierarchy, warm athletic cards, left-accent session type indicators, week-strip navigation, clean session rows. See `docs/canonical/ui-patterns.md` before building any new screen.

**Before building any screen or component**: read `docs/canonical/screen-architecture.md` first — it defines the single job of each screen and what belongs where. Then read `docs/canonical/ui-patterns.md`. Use the prompt template at the bottom of that file. Trigger the `frontend-design` skill for all UI work.

### Active scope (Phases 1–3 shipped)

| Screen | Status |
|---|---|
| Today | Active |
| Session Detail | Active |
| Plan | Active |
| Coach | Active (paid/trial only) |
| Me / Profile | Active |
| Generate Plan wizard | Active |
| Upgrade | Active |
| Login | Active |
| Strava | **Admin-only via URL** — nav entry removed |
| Calendar | **Retired** — `CalendarOverlay.old.tsx` |
| Welcome screen | **Retired** — trigger commented out |
| Smoke tracker | **Removed** from all UI surfaces |

---

## Critical Rules & Known Gotchas

### Theme system (ADR-008)
- **Single light theme. Dark mode removed.**
- No `data-theme` attribute setting anywhere
- `applyTheme()` is a no-op — call sites preserved, body retired
- `rts_theme` localStorage key deprecated and ignored
- `[data-theme="dark"]` no longer exists in globals.css

### TypeScript
- `[...seen]` spread on `Set<string>` fails
- Use `Array.from(seen)` instead

### sed replacements
- Values containing `#` wrapped in double quotes get corrupted
- Always verify output after bulk replacements

### Data Sources — System of Record (ADR-011, amended 2026-06-24)

- **HealthKit is the SOR for all run-derived data on iOS.** Strava is an optional supplement, only when connected, and only as a patch onto an existing HealthKit row via `tryEnrichHealthKitRow`. If no matching HK row exists, the Strava activity is **discarded** — never stored. **Never insert a Strava-canonical row into `strava_activities`.**
- **`strava_activities` is the source-agnostic activity log** (table name is a v1 misnomer — read it as "the run log"). The `source` column (`'apple_health' | 'strava' | 'manual'`) is provenance, not authority. Never filter queries by source without explicit justification.
- **No paid feature requires Strava.** Strava API approval is pending; the product must function fully without it.
- **iOS onboarding CTAs**: HealthKit only on day one. Strava CTA appears as a secondary supplement option *only* after API approval lands and only after HK is connected.
- **SOR by data type**: run sessions → activity log (HK primary); recovery (RHR/HRV/sleep) → `health_daily_samples` (HealthKit only); RPE/fatigue → `session_completions` (user input, never overridden by device data). Full table in ADR-011 §3.
- **HealthKit permissions**: every requested permission must have an active query. (DS-01 removed the unqueried `distance` permission + DS-02 added `calories`, both 2026-05-30 — the earlier defect/gap is resolved.)
- **`@capgo/capacitor-health` does NOT support**: GPS routes, cadence, stride, power, VO2max, **menstrual / cycle / reproductive-health data** (its `HealthDataType` union has no such type — verified v8.4.8, 2026-06-22; this is why ENGINE-03a/CA-05 are blocked). Don't promise features that need these without a custom Swift bridge / plugin fork.
- **The hard consequence (be honest about it)**: iPhone-only runners (no Apple Watch, no chest strap that writes to HealthKit) get no HR-based coaching, even with Strava connected — because Strava's Apple Health write does not include the HR stream. Apple controls what Strava writes. The product trade is paid for by these users in HR-less plans. See ADR-011 §5.
- **Single ingestion gateway**: writes to `strava_activities` are only allowed via `/api/health/ingest` (insert) or `lib/coaching/healthkitConsolidate.ts` (patch). Any new code that calls `.insert(...)` or `.upsert(...)` on `strava_activities` outside these paths is a doctrine violation (INV-DATA-008).

### Strava OAuth
- Multi-line curl in Mac Terminal consistently fails
- Use Hoppscotch (hoppscotch.io)
- POST to `https://www.strava.com/oauth/token`
- Body as `application/x-www-form-urlencoded`
- Auth code expires in ~5 minutes and is single-use
- Strava client ID: 219980

### Pre-commit Hook
- Blocks hardcoded hex values in `app/` and `components/` files
- `globals.css` is excluded at file selection stage (fixed 2026-04-23)
- Blocks `setProperty()` calls in `app/` and `components/`
- Blocks DM Mono, DM Sans, Bebas Neue font references
- Blocks ember orange and warm beige values

### Claude Code Hooks (`.claude/settings.json`, committed)
Hooks are versioned in `.claude/settings.json` (project behaviour, git-tracked) — **not** `settings.local.json` (machine-local permission grants, gitignored). Scripts live in `.claude/hooks/`.
- **PreToolUse coaching guard** (`coaching-guard.py`): fires on `Edit|Write|MultiEdit` against any **coaching-doctrine file** (`CoachingPrinciples.md`, `session-catalogue.md`, `zone-rules.md`, `coaching-rules.md`, `generationConfig.ts`, `planSignatures.ts`, `sessionFormat.ts`) and requires a `/coaching-board` review or a stated exemption before the edit proceeds (ADR-017, INV-COACH-001). Advisory by default; flip `HARD_BLOCK = True` in the script to deny outright. Deliberately does **not** match `ruleEngine.ts` / `lib/coaching/*` — those carry ordinary bug fixes, and a hook that fires on every one of them gets disabled, which is the same as having no hook. Tests: `python3 .claude/hooks/coaching-guard.test.py`.
- **PreToolUse safety guard** (`guard-bash.py`): blocks unrecoverable Bash before it runs — `git reset --hard`, `git clean -f`, force-push (allows `--force-with-lease`), `git stash drop/clear`, and `rm -rf` against root/home/repo-root/bare-wildcard. Everyday `rm -rf node_modules|.next|/tmp/*` passes. Edit the `RULES` list to tune.
- **SessionStart context** (`session-start.sh`): injects date + recent commits + uncommitted count, and flags Supabase migration files not recorded in `.claude/state/applied-migrations.txt`. **After applying a new migration, append its basename to that ledger** or every session will warn. This exists to catch the silent-unapplied-migration outage class (avg_temp_c, calories_kcal). Also flags **uncommitted coaching-doctrine changes** — the same failure class as an unapplied migration: live but never reviewed.
- **PostToolUse backlog-touch** (`backlog-touch.py`): on every `git commit`, greps the commit's **changed file paths** against file references in `backlog.md` and flags open entries that name them. Exists because the `/ship` check only catches items you *set out* to close — PUSH-UNITS-01 was fixed incidentally by the ADR-015 Phase-2 sweep and then sat open for weeks. A touched file is a prompt to check, **not** proof the item shipped. Parses all **three** item formats (status bullets, LATER table rows, unscheduled bullets) — a bullet-only grep misses ~40% of open items, which is how CA-08 once looked like it had dropped out. Tests: `python3 .claude/hooks/backlog-touch.test.py`.
- **PostToolUse** (`git commit`): two checks — the `/ship` backlog check, and a **coaching-doctrine backstop** verifying that a doctrine commit carries all three artifacts (principle §, `GENERATION_CONFIG` constant, `validatePlan()` invariant + `plan-invariants.md` row). Moved here from `settings.local.json`.

### Global State Pattern
- Overrides and settings fetched once at `DashboardClient` level
- Passed as props to child components
- Avoids duplicate API calls and flash/inconsistency

### sessionStorage Keys (canonical)
- `zona_wizard_draft` — wizard form state persisted by `GeneratePlanScreen`. Written on every field change; restored on mount; cleared on `handleUsePlan` success. Client only.

### Plan Archive
- `plan_archive` Supabase table — previous plan stored before every `savePlanForUser` call. Migration: `20260424_plan_archive.sql`. No restore UI at v1 — data protection only.

### Post-run Reframe (POST-RUN-REFRAME-01)
- `session_reflections` Supabase table — composite key `(user_id, week_n, session_day)`. Migration: `20260522_session_reflections.sql`.
- PAID via `post_run_reframe` gate. Uses Sonnet (`ANTHROPIC_MODEL_DEEP`) — first always-on Sonnet surface for paid users; first cost-bearing AI per-reflection.
- Wired into BOTH `SessionScreen` reflect view (manual completion) AND `PostRunScreen` (Strava-linked) — `ReflectionInput` is shared. If you change one path, check the other.
- **Risk gate silences the reframe** when overload signals fire (`coaching_flag='flag'`, 2+ flags in last 5, 3+ consecutive Heavy/Wrecked, or HR drift ≥15 bpm/≥10%). The UI renders an amber-rail warning instead of a reframe card — **no AIMark** on the warning (rule-engine output, not model). Logic: `lib/coaching/reframeRiskGate.ts`. Tested in `reframeRiskGate.test.ts`.
- Voice spec is locked in `docs/canonical/brand.md` § Reframe Voice. Regression suite: `docs/canonical/reframe-golden-cases.md` (cases A/B/C/D). If you change the prompt builder (`lib/coaching/prompts/sessionReframe.ts`), run the golden suite first.

### Palette Regression
- Warm Slate is the current system (ADR-007)
- Legacy aliases bridge old System B token names to new values
- If you see `#0B132B`, `#5BC0BE`, `#F2C14E`, `#7B68EE` hardcoded in a component — fix it
- OG image (`app/api/og/route.tsx`) uses `BRAND.og.*` hex values — this is intentional (CSS vars can't work in `next/og`). Those values are marked `DEPRECATED` and will be updated with the Phase 2 OG image redesign.

### Hybrid Generation Pattern (R23+)

All plan generators follow the same shape:

1. **Deterministic rule engine** produces canonical plan JSON — no AI calls, always succeeds.
2. **AI enricher** optionally adds voice, coaching copy, and confidence score.
3. **Enricher failure is silent** — rule-engine output is returned unchanged if AI fails.

See `docs/architecture/ADR-006-hybrid-generation-pattern.md`.

### Configuration Singularity — No Hardcoded Coaching Numerics

**Doctrine:** Every coaching numeric, business-rule threshold, and tuning knob lives in named configuration. No magic numbers in `lib/plan/*` or `lib/coaching/*`.

| What | Where |
|---|---|
| Plan generation numerics (intensity ratios, phase fractions, taper depths, recovery cadences, injury caps, distance/time minimums, rounding precision, all percentages governing what the engine prescribes) | `lib/plan/generationConfig.ts → GENERATION_CONFIG` |
| Universal warm-up/main/cool-down structure | `lib/plan/sessionFormat.ts → SESSION_FORMAT` |
| Per-distance plan shape | `lib/plan/planSignatures.ts → PLAN_SIGNATURES` |
| Option A trial categories | `lib/plan/featureGates.ts → FEATURE_GATES` |
| Coaching scoring + load thresholds | `lib/coaching/constants.ts` (re-exports from `GENERATION_CONFIG` where overlapping) |
| Brand strings + pricing | `lib/brand.ts → BRAND`, `BRAND.PRICING` |

**Authority:** Architectural-principles skill (`INV-CFG-001…005`, `M-013`, `N-013`). ADR-009 establishes the pattern for plan generation; INV-CFG elevates it repo-wide.

**Backstop:** Every entry in `GENERATION_CONFIG` has a corresponding section in `docs/canonical/CoachingPrinciples.md` explaining the principle behind the value. A numeric without a principle is a defect.

**Exempt:** Algorithm-formula constants (Daniels VDOT coefficients in `buildPaceFromVDOT`, Tanaka MaxHR `208 − 0.7 × age`) and structural constants (`7` for days/week, JS array indices) stay inline — they are not coaching choices.

**Tunability test (when in doubt):** if a coach could reasonably want to tune it → config. If it's a fact → inline.

### Plan Invariants — Constitutional Layer

Every generated plan is mechanically validated against `CoachingPrinciples.md` via `lib/plan/invariants.ts → validatePlan()`. `generateRulePlan()` runs the validator on its output: throws on `error`-severity violations in `NODE_ENV=development` / `test`; logs to `console.error` in production (no user-facing failure).

This closes the gap between "principle written" and "engine respects it". Three layers, one source of truth:

1. **Principle** — `CoachingPrinciples.md`
2. **Numeric** — `GENERATION_CONFIG`
3. **Mechanical check** — `validatePlan()`

When all three agree, the engine is provably honouring its constitution.

**Tooling:**
- `scripts/r23-phase7-validation.ts` — archetype matrix; runs under `NODE_ENV=test` so violations break the suite.
- `scripts/property-validate-plans.ts` — property sweep across a wide input grid (race × fitness × days × volume × injuries × ...). Catches edge cases the archetype matrix misses. Exit 1 on any violation.

**When changing engine behaviour or adding a coaching principle:** add the invariant to `validatePlan()` in the same commit. See `docs/canonical/plan-invariants.md` for the full registry and the procedure.

### The Coaching Board — the layer above (ADR-017)

The three layers above guarantee the engine **honours what was decided**. None of them can tell you whether the decision was **right** — `validatePlan()` will enforce a bad principle with perfect fidelity. At 80 principles, spotting that a new one contradicts an existing one is also past what any reviewer holds in working memory.

The **Coaching Board** (`/coaching-board`) is the fourth layer. If `validatePlan()` is the judiciary and `GENERATION_CONFIG` is the statute book, the board is the legislature — it authors and amends the constitution.

| | Coaching Board | SLT (`/slt-review`) |
|---|---|---|
| Rules on | Is it coaching-**correct**? | Should we **build** it, for whom, at what tier? |
| Seats | Hutchinson (chair), Seiler, McMillan, Willy, Sims | Sutherland, Fried, Hutchinson, Wood, Traynor |
| Output | Principle § + config constant + `validatePlan()` invariant | Tier tag + build/don't-build |

- **The board's INCORRECT ruling is a veto.** The SLT cannot overrule it commercially (INV-COACH-003). Hutchinson holds both seats and carries escalations up.
- **Convening is automatic** — `.claude/hooks/coaching-guard.py` fires on any edit to a doctrine file. Do not rely on remembering.
- **Doctrine files**: `CoachingPrinciples.md`, `session-catalogue.md`, `zone-rules.md`, `coaching-rules.md`, `generationConfig.ts`, `planSignatures.ts`, `sessionFormat.ts`.
- **Exempt** (state it in one line and proceed): defect fixes restoring documented intent, formatting, no-behaviour-delta refactors.
- **Zone-label trap**: Zonna's five-zone model is canonical — **Z2 is easy, Z3 is the grey zone**. Seiler's three-zone model calls the *moderate* band "Zone 2". Translate external reasoning on the way in (INV-COACH-004).

### Auth at the Route Boundary

`lib/plan/*` modules are pure functions of inputs and a `tier` parameter. The API route is the auth boundary. See ADR-003.

### Free Users Are Never Abandoned

Gate richness (AI labels, coaching voice), never gate access (the plan itself, the session card, the log action).

---

## Redesign Progress

**Phase 1 — shipped (branch: redesign/phase-1-tokens)**
- Warm Slate palette live in `globals.css` (ADR-007)
- Dark mode removed (ADR-008)
- Calendar screen retired
- Welcome screen retired
- Smoke tracker removed from all UI
- Strava screen nav entry removed (admin URL still works)
- All hardcoded `BRAND` string references fixed
- `BRAND.appStoreSubtitle` and `BRAND.signinSub` added to `lib/brand.ts`
- ADR-007 and ADR-008 written
- ADR-001 and ADR-004 marked superseded

**Phase 2 — shipped**
- Full visual redesign: Today, Session Detail, Plan screens
- New components: Restraint card, Plan arc, RPE filling-bar, Coach note block, Pending adjustment card

**Phase 3 — shipped**
- Remaining screens: Me, Coach, Wizard, Upgrade, Benchmark redesigned
- Session type colours consistent across all surfaces
- Note: four files (BenchmarkUpdateScreen, GeneratingCeremony, GeneratePlanScreen, UpgradeScreen) reverted to legacy aliases post-merge; aliases bridged in globals.css

**Phase 4 — major items shipped (was: target May 10 TestFlight)**
- B-001: BenchmarkUpdateScreen wired into DashboardClient router
- B-002: `orientation_seen` migration + first-plan-only trigger
- "Careful Now" section label in MeScreen (SectionLabel — ui-patterns.md §17)
- Personalisation wins (PROFILE-ADJ-02 — recent tweaks log on MeScreen)
- AI coaching depth pass (AI-DEPTH-01 + AI-DEPTH-02a + AI-DEPTH-04 + AI-DEPTH-07 + AI-DEPTH-10) — see feature-registry
- Native plumbing (Strava OAuth on native, iOS push notifications via APNs, Subscription disclosure)
- Remaining Phase 4 polish tasks (dead code, empty states, accessibility) folded into ongoing maintenance

**Post-Phase-4 wave — shipped 2026-05-14**
- POST-RUN-02: post-run journey resolves at the read (auto-match CTA + analysis state + Done → SessionScreen)
- PLAN-REDESIGN-01: Plan screen redesign (voice card + Warm Slate token migration + Now/Next/Later sections + WeekStripCard)
- HOLD-THE-ZONE-01: brand visibility across the app (ZoneBar primitive + Hold-the-zone eyebrow + post-plan zone intro + Session Detail prescription card + MeScreen zone promotion)
- Bug fixes: swap/move override resolution (`lib/plan/effectiveSessions.ts` shared between daily-coach-note and missed-session prompt), APNs `aps-environment` entitlement

---

## Workflow Rules

- Build-check locally before pushing
- One release at a time, shipped properly before starting the next
- All new features tagged FREE or PAID before building begins

## Development Approach — SLC (Non-Negotiable)

All development uses the **Simple, Lovable, Complete** model. No exceptions.

| Principle | Meaning |
|---|---|
| **Simple** | One job per change. Tight scope. Nothing beyond what was asked. |
| **Lovable** | Actually good quality. Matches the Runna/Planzy bar. References `ui-patterns.md`. Not half-baked. |
| **Complete** | Fully done. All states handled (loading, empty, error, edge cases). Nothing left hanging. |

SLC beats MVP. MVP ships minimal-but-unlovable. SLC ships smaller-but-actually-good.

### Prompt template for UI changes

```
Screen: [screen or component name]
Change: [what specifically is changing]
SLC:
  Simple — [one sentence: what this does and nothing else]
  Lovable — [what makes it feel good / which ui-patterns.md pattern applies]
  Complete — [states to handle: loading / empty / error / edge cases]
Trigger frontend-design skill.
```

---

## Monetisation Model

Zonna uses a **Hybrid Reverse Trial**: 14 days full access for all new users, then graceful downgrade to free tier. Upgrade prompts are triggered by user behaviour, never by a calendar date.

See `docs/canonical/monetisation-strategy.md` for the full model.

## Feature Tagging

| Tier | Includes |
|------|----------|
| FREE | Generic plans (5K/10K/HM, 8 & 12 week, rule-based engine — no AI calls), session display and tracking, formula-derived pace/HR targets, basic profile |
| PAID | AI plan generation, dynamic plan reshaping, Strava integration, AI coaching, confidence scoring, all personalised or intelligent features |

**All AI calls route through Next.js API routes only — never from the client.**

---

## Session Card Layout

Required hierarchy:
1. **TOP:** Run type · Zone · HR target(s) · Estimated pace bracket · Distance + duration
2. **MIDDLE:** Session description
3. **BOTTOM:** Why / coach notes

Global dist/duration toggle lives in the Me screen.
Per-session toggle in expanded card only — saves per session, updates collapsed card too.

---

## Documentation

### Doc System — Where Things Live

Three docs run the work pipeline. Keep them in sync:

| Doc | Job | When it changes |
|---|---|---|
| `docs/releases/roadmap.md` | **The unified plan.** Now / Next / Later × workstream (🏃 Product · 📣 GTM & Marketing · 🔁 Growth & Retention · ⚖️ Legal & Ops). One-liners + status + links. Start here for "what are we doing, in what order, across product *and* market?" | Horizon/status updated as items move; new workstream items added here + detailed in backlog |
| `docs/releases/backlog.md` | **What's left to ship — the detail bench.** Full specs, scope notes, SLC framing behind each roadmap item. | Item added when scoped; item removed when shipped (moves to feature-registry) |
| `docs/canonical/feature-registry.md` | **What's been built + tier assignments.** Single source of truth for "does this exist? is it free or paid?" | New entry appended to "Shipped Features" table when a backlog item ships |

**The flow:** roadmap.md (plan) → backlog.md (spec) → ship → feature-registry.md (built). An open item lives in roadmap (as a line) + backlog (as detail); once shipped it lives only in feature-registry.

> `docs/releases/launch-roadmap.md` is **superseded** (2026-06-03) — retained as the v1 App-Store-submission record only. Don't add forward work there.

**Mechanism:** the `/ship` skill performs the move atomically. After every `git commit`, the assistant checks whether anything shipped and invokes `/ship` if so. Hook in `.claude/settings.local.json` enforces the check.

### Other Canonical Truth

| Folder | Authority For |
|---|---|
| `docs/canonical/` | All domain rules — session types, plan schema, zone rules, coaching rules, **CoachingPrinciples (the constitution)**, **session catalogue**, feature registry, monetisation strategy, brand, UX principles |
| `docs/contracts/` | All API route and component prop contracts |
| `docs/architecture/` | Architectural decision records (ADRs) and architecture overview |
| `docs/releases/` | Backlog (what's left). Shipped record lives in `feature-registry.md`. |
| `docs/alignment/` | Brand-product alignment, redesign phase tracking |

**Before building any new feature**: check `docs/canonical/feature-registry.md` — every feature must be tagged FREE or PAID before implementation begins.

**When changing any API route or component prop interface**: update `docs/contracts/` in the same commit.

### References

- Architecture overview: `docs/architecture/architecture.md`
- Backlog: `docs/releases/backlog.md`
- Feature registry (FREE/PAID): `docs/canonical/feature-registry.md`
- Coaching constitution: `docs/canonical/CoachingPrinciples.md`
- Session catalogue: `docs/canonical/session-catalogue.md`
- ADRs: `docs/architecture/ADR-*.md`
  - ADR-001: design tokens (superseded for colours by ADR-007; principle retained)
  - ADR-002: JSON-first plan
  - ADR-003: free/paid gates
  - ADR-004: theme system (superseded by ADR-008)
  - ADR-005: subscription payments
  - ADR-006: hybrid generation pattern
  - ADR-007: Warm Slate palette
  - ADR-008: single light theme only
  - ADR-009: config-driven plan generation *(R23 rebuild)*
  - ADR-010: session catalogue *(R23 rebuild)*
  - ADR-011: data source doctrine — SOR by data type, source priority, no single external data dependency for paid value *(2026-05-30)*
  - ADR-012: reshape authority model — magnitude-calibrated confirmation; sub-threshold engine changes auto-apply silently, structural changes (day-of-week moves, session-type swaps, >15% trims, >15% week-volume changes) surface confirmation tiles *(2026-06-26, post-incident)*
  - ADR-013: plan lifecycle — post-race maintenance is its own plan object; race plan ends → archived as completed, maintenance becomes sole active plan; `week_n` keyed by `week.n` (not array position) *(2026-08-02)*
  - ADR-014: recalibration application model — a time-trial result rewrites forward paces only when **prompted + confirmed** (never silent, §69/ADR-012), via the existing `applyRecalibration` → `/api/recalibrate-zones` path, gated PAID (`dynamic_reshape_r20`); the time trial + honest copy stay FREE. Unblocks PV2-H / CD-13 wiring *(2026-08-06)*
  - ADR-015: display formatting & preference singularity — `lib/format.ts` is the sole owner of every time/distance/metric string; `formatDuration` locks the ≥60→hours rule (`45 min` / `1h 18`, never a bare `78m`); global + per-session unit/metric preference propagates everywhere incl. notifications (server reads `getUserDisplayPrefs`; per-session override moves localStorage → `session_metric_overrides` table). INV-FMT-001/002, INV-PREF-001 *(2026-08-10)*
  - ADR-017: coaching board authority model — a five-seat domain board (Hutchinson chairing, with Seiler, McMillan, Willy, Sims) rules on coaching **correctness** as the layer above principle/config/invariant; INCORRECT is a **veto** the SLT cannot overrule commercially; convening is hook-enforced, not remembered; every CORRECT ruling lands three artifacts in one commit; five-zone model pinned as canonical against Seiler's three-zone labels. INV-COACH-001…004 *(2026-08-15)*
  - ADR-016: date-aware plan resolution & send-gating — `getSessionForDate()` is the canonical "real session on calendar date D?" resolver (returns `null` before-start / after-end / gap / empty day); `isDateBeforePlan()` is the missing before-start guard. No scheduled send may fire without an active plan AND a real session for the target date (never fall back to `weeks[0]`). INV-TIME-001 *(2026-08-10)*
- **Brand authority (positioning, audience, competitors, voice, visual)**: `docs/canonical/brand.md` — the single prose source of truth
- Brand alignment (v1 launch record — superseded as authority by `brand.md`): `docs/alignment/brand-product-alignment.md`
- Phase 4 decisions log: `docs/alignment/phase-4-decisions.md`
- Phase 4 blockers log: `docs/alignment/phase-4-blockers.md`
- Brand copy registry (surface map + divergences; exact values live in `lib/brand.ts`): `docs/canonical/brand-copy-alignment.md`
- UX principles: `docs/canonical/ux-principles.md`
- Screen architecture (one job per screen, what belongs where): `docs/canonical/screen-architecture.md`

---

## Available Skills

### `zona-architectural-principles`
Load when:
- making architectural decisions
- refactoring core systems
- defining data contracts or APIs
- reviewing for correctness or long-term maintainability
- any question of "is this allowed", "should I", "does this violate"

Do NOT load for:
- simple feature builds
- UI tweaks
- early prototyping

### `frontend-design`
Trigger with `/frontend-design` for ALL UI work — screens, components, layouts.
This skill biases output toward high-quality, non-generic design.
Use the prompt template in `docs/canonical/ui-patterns.md` alongside it.

### `coaching-board`
**Fires automatically** via `.claude/hooks/coaching-guard.py` on any edit to a coaching-doctrine file — you should not need to remember it. Can also be invoked directly with `/coaching-board [change]`.

Five domain seats rule on whether a coaching change is **correct** (not whether to build it — that's the SLT):
- **Alex Hutchinson** (chair) — performance science. Is it defensible to an experienced runner?
- **Stephen Seiler** — intensity distribution. Is the distribution real, and does it hold for a four-hour-a-week runner rather than an elite?
- **Greg McMillan** — practical coaching. Does it survive contact with a real amateur's week?
- **Rich Willy** — injury and load. What's the injury vector? Does tissue tolerance keep up with fitness?
- **Stacy Sims** — female physiology. Does it hold for the women using it, or was it derived from male subjects?

Output is not prose — every CORRECT ruling produces three artifacts in one commit: principle §, config constant, `validatePlan()` invariant. Includes a mandatory conflict scan naming which of the 80 existing principles a change touches or contradicts. Full authority model: ADR-017.

Do NOT load for: display/formatting changes (ADR-015), coaching *copy* and voice (that's brand), or defect fixes restoring documented intent.

### `slt-review`
Trigger with `/slt-review [item]` when deciding what to build next — specifically when pulling an item from the backlog into active development.

Five board members review the item from distinct lenses:
- **Rory Sutherland** — behavioural economics. Will the feature solve the real problem or just the rational one?
- **Jason Fried** — sustainable growth. Does this earn its place in the paid proposition without manipulation?
- **Alex Hutchinson** — performance science. Is the coaching correct and defensible to experienced runners?
- **Wendy Wood** — habit science. Does this actually change behaviour or just create the feeling of it?
- **Des Traynor** — commercial strategy. Does this make the business work?

The review gate: **before a backlog item moves to active build.** Not a post-build review.

Every review outputs: tier tag (FREE/PAID), board responses, conflicts between members, a recommendation, and a MUST/NEVER compliance check.

Do NOT load for:
- Simple bug fixes or technical tasks
- UI work (use `frontend-design` instead)
- Architectural decisions (use `zona-architectural-principles` instead)

---

## UI Testing

Use agent-browser for all UI smoke tests and journey tests.
agent-browser launches a headless Chromium session and can interact with the running Vercel preview or localhost:3000.
Always run journey tests before marking a release done.
