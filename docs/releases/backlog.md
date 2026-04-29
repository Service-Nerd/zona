# Backlog — Zona

**Job:** What's left to ship. Single source of truth for "what should I work on?"
**Pair:** When an item ships, the `/ship` skill moves it to `docs/canonical/feature-registry.md` "Shipped Features" table. An item lives in exactly one of the two.

Status: 🔲 not started · 🔄 in progress · ❓ needs verification

---

## NOW — Critical path to App Store submission

Everything in this section blocks v1 launch. Group A (legal/policy) and Group D (external setup) can run in parallel with Groups B (engineering) and C (env config). Group E (QA) must follow.

### A. Legal & Apple compliance

- 🔲 **Terms of Service** — write, host at public URL, link pre-login alongside privacy policy
- 🔲 **Privacy policy hosted** — page is built (`/privacy`); needs to be live at `zona.app/privacy` before submission
- 🔲 **Subscription terms disclosure UI** — show price, billing frequency, 14-day trial length, auto-renewal terms before user subscribes (Apple requirement)
- 🔲 **App Store Connect setup** — active developer account, app record, subscription product (ID + pricing tiers + trial config), screenshots for all required device sizes, App Store description and keywords

### B. Engineering blockers

- 🔲 **Sign in with Apple** — Apple §5.1.1d, mandatory because Google OAuth is present
- 🔲 **StoreKit 2 integration** — implement purchase + receipt validation. Alternative: apply for External Purchase Entitlement (slow, not guaranteed)
- ✅ **Migration `orientation_seen`** — column exists in `user_settings`, read on load + written on completion. Done.

### C. Vercel env config

- ✅ `SUPABASE_SERVICE_ROLE_KEY` — confirmed present
- ✅ `STRAVA_WEBHOOK_VERIFY_TOKEN` — confirmed present
- ✅ `CRON_SECRET` — confirmed present
- ✅ `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — confirmed present
- ✅ `NEXT_PUBLIC_APP_URL` — confirmed present
- 🔲 `STRIPE_SECRET_KEY` — needs Stripe product setup first
- 🔲 `STRIPE_WEBHOOK_SECRET` — needs Stripe webhook endpoint created
- 🔲 `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` — needs Stripe product + price IDs
- 🔲 `REVENUECAT_WEBHOOK_SECRET` — needs RevenueCat app setup first

### D. External setup

- 🔲 **Stripe product + price** — "Zona Premium", £7.99/month + £59.99/year, 14-day trial
- 🔲 **RevenueCat app + entitlement** — link to App Store product ID, set entitlement identifier (e.g. `zona_premium`)
- 🔲 **Apple Small Business Program** — 15% vs 30% cut, enrol before first live transaction
- 🔲 **Custom domain** — point `zona.app/privacy` at live URL

### E. Pre-submission QA

- 🔲 **TestFlight beta** — internal testing on device before public submission
- 🔲 **Full journey test** — agent-browser end-to-end: create account → onboarding → plan on screen → log session → post-log reflect → simulate trial end → attempt paid feature → upgrade prompt
- 🔲 **App Store assets** — screenshots (all required device sizes), preview video (optional), keywords, App Store description copy

---

## NEXT — First wave after App Store ship

Ordered by GTM impact. Each needs FREE/PAID tag confirmed before build.

### GTM commercial

| # | Item | Effort | Tier | Notes |
|---|------|--------|------|-------|
| GTM-08 | **Marketing site** (`app/page.tsx`) — replace dashboard redirect with one-page site: overtraining thesis, ZONA voice, single CTA. Uses `lib/brand.ts` for all copy. Screenshots: session card, reflect view, coach screen | M | FREE | High — must exist before any paid acquisition or press |
| GTM-09 | **Trial expiry email** (day 14) — "Your zone coaching pauses today." Requires email platform (Resend or Supabase Edge + SMTP) | M | PAID | High |
| GTM-10 | **Trial nudge email** (day 11) — "3 days of full access left." Same infra as GTM-09, ships together | S | PAID | Medium |

### R23 engine polish (browser-in-loop work)

After Vercel deploy, verify with agent-browser:

1. ✅ **Phase 5 — Wizard UI updates** — `training_age`, `preferred_long_run_day`, `benchmarkDate` wired; new injuries (Shin splints, Plantar fasciitis, Hip) in list; `motivation_type` + `training_style` removed
2. ✅ **Phase 6.3 — Day-15 transition UI** — shipped 2026-04-29
3. ✅ **Phase 4.2 — Session card integration with `composeSession()`** — wired in DashboardClient; warm-up/main/cool-down rendered with left-accent bars
4. ✅ **Browser-verify B1 + B3 changes** — confirmed working 2026-04-29

### Small UX

- 🔲 **UX-01** — Profile screen email field. Me screen rebuilt (2026-04-29); `ProfileSection` still renders email as editable input but saving email is a no-op (no re-verification flow exists). Decision still needed: make read-only or remove the field entirely.

---

## LATER — Post-launch roadmap

No schedule. Ordered roughly by user value. Each needs FREE/PAID tag in `docs/canonical/feature-registry.md` before build.

| # | Title | Tier | Effort | Notes |
|---|-------|------|--------|-------|
| **R22** | **Blockout days** — user marks days unavailable, plan reshapes around them | PAID | M | Bundle with R20 parked triggers — uses same reshape engine |
| **R18** | **Plan confidence score** — derive from session completion + RPE. R17 coaching flags are the per-session atom this aggregates | PAID | M | Display on dashboard or plan screen |
| **R25** | **Historical run intelligence** — "how does this run compare to your past self?" Similarity matching + trend detection on cohort | PAID | ~15h (2–3 sessions) | 6 design decisions to resolve first (appendix) |
| **R24** | **Multi-race support** (A/B race hierarchy) | PAID | L | Non-breaking additive: `meta.races: Race[]` on top of existing `meta.race_date`/`race_name` |
| **R21** | **Strength sessions** — flesh out stubs (currently admin-only/hidden) | FREE display / PAID dynamic | M | |
| **R19** | **Coaching tips in Supabase** — move hardcoded copy to a table for dynamic, user-specific messages | PAID | S | |

### Scoped but unscheduled


- **Zone method selector** — user picks HR zone calc method, stored in `user_settings` — PAID
- **GTM-11 Pricing review** — annual discount currently 37% vs category norm 44–49%. Monthly parameterised in `lib/brand.ts`; can raise to £9.99/month (50% annual discount) without a search-replace. Revisit after first 100 paid conversions

### Parking lot

- Session swap (PAID)
- AM/PM scheduling (PAID)

### Ops

- **Rename Vercel project** from `zona-service-nerds-projects` → `zona` or `zona-app` when name available. Update `NEXT_PUBLIC_APP_URL`, `CLAUDE.md`, this file, `app/api/checkout/route.ts` fallback

---

## Tech Debt

- 🔲 **Tier-divergent rendering utility** — once a second tier-divergent component lands (after `GeneratingCeremony.tsx`), centralise the `tier` prop pattern into shared context or typed convention. Document in `ui-patterns.md`
- 🔲 **Plan history UI** — data is archived to `plan_archive` table (migration `20260424`); browse + restore UI deferred. Schema has `race_name`, `race_date`, `archived_at` for future list display
- ✅ **R20 reshape API gating** — all API routes use `isFeatureAllowed()` not `hasPaidAccess()` directly. Done.

---

## Appendix — Open questions & reference

### R23 deferred items still open

- **R23-D1** — Tier 2 wizard fields (`treadmill_primarily`, `longest_run_ever_km`) need engine consumer / product decision before the wizard work is worth shipping
- ✅ **R23-D2** — Catalogue lookup for legacy plans: abandoned. Legacy plans expire naturally as users regenerate; no restore path needed.
- **R23-D3** — Surface `compressed` flag in UI. Needs design rationale via `frontend-design` skill before shipping
- ✅ **R23-D5** — ReshapeScreen 403 fixed: MeScreen Reshape button now gates on hasPaidAccess, routes free users to UpgradeScreen. Done 2026-04-29.

### R25 design decisions to resolve before build

1. What defines "similar"? Metric only / metric + session type / metric + observed effort band
2. Minimum cohort size to call a trend — 3? 5?
3. Time window — 12 months default; shrink for dense Strava users?
4. Voice for regression cases — neutral framing only or include possible explanations
5. Per-run comparison vs cohort average
6. Tier sub-gate — all paid or limited free cohort

### Free/paid audit (when usage data is available)

Revisits two resolved-but-watchable decisions if commercial signals warrant:
- **Intensity distribution** — engine produces ~90% easy across distances; spec target was 75–88%. Currently kept by design (restraint as the brand). If users drop off citing under-stimulation, smallest change is +1 quality session in build phase for HM/Marathon intermediate+
- **Free regeneration policy** — currently lenient (free users regen freely; AI enrichment is the paid value). If conversion is low and "fresh start" emerges as a real subscription motivator, gate regen only when active future-dated plan exists
