# CLAUDE.md — Zona Project Intelligence

This is the single source of truth for the Zona codebase.
Read this before touching anything. All design, architecture, and
behavioural rules live here or in /docs.

---

## Brand

### Positioning

> **ZONA is for runners who blur their zones — who go medium-hard on everything, never truly recover, and never truly push.**

Core truth: "You're trying hard. That's the problem."

Zone discipline is the product idea: commit to the zone you're in. Run easy when it's easy. Run hard when it's hard. The problem isn't that users go too fast — it's that they can't tell the difference between sessions because every run ends up in the same grey middle. Zona removes that ambiguity.

### The three-line tagline system

| Line | Job | `BRAND` constant | Where it appears |
|---|---|---|---|
| **"Training plans that stop you overtraining."** | What ZONA does. Functional, discovery-facing. | `BRAND.appStoreSubtitle` | App Store subtitle, landing page hero, paid ads |
| **"Slow down. You've got a day job."** | Who ZONA is for. The demographic hook. | `BRAND.tagline` | Login screen, loading screen, OG image, meta description |
| **"You can't outrun your easy days."** | How ZONA sounds. Voice/personality moment. | `BRAND.brandStatement` | Privacy footer, App Store description (not login — tagline owns that space) |

**Rules:**
- Never mix two taglines on the same surface
- Never rephrase them — they are locked strings
- `BRAND.name` is always `'Zona'` — fix any hardcoded instances
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

## What Is Zona?

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
- Vercel app: `https://rts-training-hub.vercel.app` (Vercel project rename to `vetra` is on the backlog)
- Plan JSON: `https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json`
  - Always fetched with `cache: 'no-store'`

### Native shell — Capacitor

The iOS app is a Capacitor wrapper around the Vercel-hosted web app, not a standalone native build.

| Setting | Value |
|---|---|
| Bundle ID | `app.vetra.ios` |
| App name | `Vetra` (sourced from `BRAND.name`) |
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

**Auth on native:** custom URL scheme `app.vetra.ios://auth-callback` is registered in `Info.plist`. Supabase OAuth runs with `skipBrowserRedirect: true`, the URL is opened via `Browser.open()`, and the callback is exchanged for a session in `CapacitorBoot.tsx`'s `appUrlOpen` listener. The same scheme should be reused for Strava OAuth when it's ported off `window.location.href`.

**Push notifications status:**
- *Layers 1 + 2 (engineering)*: done. Client registers via `@capacitor/push-notifications`, backend has `platform` column on `push_subscriptions`, `/api/push/subscribe` accepts both shapes, `/api/push/send-weekly-report` branches by platform. iOS sends route through `lib/apnpush.ts` (uses the `apn` npm package).
- *Layer 3 (Apple-side wiring)*: outstanding, gated on Apple Developer approval. Needs:
  - Push Notifications capability enabled in the Apple Developer portal for `app.vetra.ios`
  - APNs key generated (.p8 file) and downloaded
  - Vercel env vars: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (full .p8 contents), `APNS_TOPIC=app.vetra.ios`, `APNS_PRODUCTION=1` for prod
  - Push Notifications capability added to the Xcode project's App target
  - First test on a real device — simulator doesn't receive APNs

**Native plugins still to add (see backlog):**
- `@capacitor-community/apple-sign-in` — Sign in with Apple, bridged to Supabase Auth (gated on Apple Dev account)
- `@revenuecat/purchases-capacitor` — StoreKit 2 via RevenueCat (gated on Apple Dev + RevenueCat setup)

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

**Before building any screen or component**: read `docs/canonical/ui-patterns.md`. Use the prompt template at the bottom of that file. Trigger the `frontend-design` skill for all UI work.

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

### Global State Pattern
- Overrides and settings fetched once at `DashboardClient` level
- Passed as props to child components
- Avoids duplicate API calls and flash/inconsistency

### sessionStorage Keys (canonical)
- `zona_wizard_draft` — wizard form state persisted by `GeneratePlanScreen`. Written on every field change; restored on mount; cleared on `handleUsePlan` success. Client only.

### Plan Archive
- `plan_archive` Supabase table — previous plan stored before every `savePlanForUser` call. Migration: `20260424_plan_archive.sql`. No restore UI at v1 — data protection only.

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

**Phase 4 — in progress (target: May 10 TestFlight)**
- B-001: wire BenchmarkUpdateScreen into DashboardClient router (Task 4)
- B-002: orientation_seen migration — first-plan-only trigger (Task 5)
- "Careful Now" section label in MeScreen (Task 6)
- Personalisation wins (Task 7)
- Polish pass: dead code, empty states, copy, accessibility (Tasks 9–12)

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

Zona uses a **Hybrid Reverse Trial**: 14 days full access for all new users, then graceful downgrade to free tier. Upgrade prompts are triggered by user behaviour, never by a calendar date.

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

Two docs run the work pipeline. Keep them in sync:

| Doc | Job | When it changes |
|---|---|---|
| `docs/releases/backlog.md` | **What's left to ship.** Now / Next / Later. Single source of truth for "what should I work on?" | Item added when scoped; item removed when shipped (moves to feature-registry) |
| `docs/canonical/feature-registry.md` | **What's been built + tier assignments.** Single source of truth for "does this exist? is it free or paid?" | New entry appended to "Shipped Features" table when a backlog item ships |

**The flow:** backlog.md → ship → feature-registry.md. An item lives in exactly one of the two at any time.

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
- Brand alignment: `docs/alignment/brand-product-alignment.md`
- Phase 4 decisions log: `docs/alignment/phase-4-decisions.md`
- Phase 4 blockers log: `docs/alignment/phase-4-blockers.md`
- Brand copy registry: `docs/canonical/brand-copy-alignment.md`
- Brand & tone of voice: `docs/canonical/brand.md`
- UX principles: `docs/canonical/ux-principles.md`

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

---

## UI Testing

Use agent-browser for all UI smoke tests and journey tests.
agent-browser launches a headless Chromium session and can interact with the running Vercel preview or localhost:3000.
Always run journey tests before marking a release done.
