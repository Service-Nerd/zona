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
- 🔲 **Migration `20260428_orientation_seen.sql`** — `ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS orientation_seen BOOLEAN DEFAULT FALSE`

### C. Vercel env config

- ❓ `ANTHROPIC_API_KEY` — required for paid/trial AI features; free tier works without (rule engine has no AI dependency)
- 🔲 `STRIPE_SECRET_KEY` — Stripe dashboard → Developers → API keys
- 🔲 `STRIPE_WEBHOOK_SECRET` — Stripe → Webhooks → add endpoint `https://zona.vercel.app/api/webhooks/stripe`, copy signing secret
- 🔲 `STRIPE_PRICE_MONTHLY` + `STRIPE_PRICE_ANNUAL` — price IDs from Stripe dashboard after creating product
- 🔲 `REVENUECAT_WEBHOOK_SECRET` — RevenueCat dashboard → Integrations → Webhooks
- 🔲 `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API → service_role (keep secret)
- 🔲 `STRAVA_WEBHOOK_VERIFY_TOKEN` — any secret string for webhook subscription challenge
- 🔲 `CRON_SECRET` — protects `/api/push/send-weekly-report` cron endpoint
- 🔲 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — generate via `npx web-push generate-vapid-keys`. Subject e.g. `mailto:push@zona.app`
- 🔲 `NEXT_PUBLIC_APP_URL` — `https://zona.vercel.app`, used by cron to call internal API routes

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

1. 🔲 **Phase 5 — Wizard UI updates** — see `docs/alignment/phase-5-wizard-followup.md`
2. 🔲 **Phase 6.3 — Day-15 transition UI** — needs `frontend-design` skill. See `docs/alignment/phase-6-gates-followup.md`
3. 🔲 **Phase 4.2 — Session card integration with `composeSession()`** — see `docs/alignment/phase-4-ui-followup.md`
4. 🔲 **Browser-verify B1 + B3 changes**

### Small UX

- 🔲 **UX-01** — Profile screen name/email field review. Name actively used (greeting/initials/header); email is a no-op (can't change without re-verification flow). Decision: read-only or remove

---

## LATER — Post-launch roadmap

No schedule. Ordered roughly by user value. Each needs FREE/PAID tag in `docs/canonical/feature-registry.md` before build.

| # | Title | Tier | Effort | Notes |
|---|-------|------|--------|-------|
| **R22** | **Blockout days** — user marks days unavailable, plan reshapes around them | PAID | M | Bundle with R20 parked triggers — uses same reshape engine |
| **R20-parked** | **Five plan-adaptation triggers** — infra exists, nothing generates them yet (`docs/alignment/plan-adjustments-parked.md`) | PAID | per-trigger | Breakdown below |
| **R18** | **Plan confidence score** — derive from session completion + RPE. R17 coaching flags are the per-session atom this aggregates | PAID | M | Display on dashboard or plan screen |
| **R25** | **Historical run intelligence** — "how does this run compare to your past self?" Similarity matching + trend detection on cohort | PAID | ~15h (2–3 sessions) | 6 design decisions to resolve first (appendix) |
| **R24** | **Multi-race support** (A/B race hierarchy) | PAID | L | Non-breaking additive: `meta.races: Race[]` on top of existing `meta.race_date`/`race_name` |
| **R21** | **Strength sessions** — flesh out stubs (currently admin-only/hidden) | FREE display / PAID dynamic | M | |
| **R19** | **Coaching tips in Supabase** — move hardcoded copy to a table for dynamic, user-specific messages | PAID | S | |

### R20 parked triggers — phasing

| Trigger | Description | Target |
|---|---|---|
| Session move → rebalance | User drags session to new day; hard/easy alternation preserved | v1.1 |
| Skip with reason | User marks skipped + reason; plan responds (make up / push / absorb) | v1.2 |
| Silent miss detection | Day passes with no log; morning-after prompt | v1.2 |
| Fatigue-driven softening | 3+ consecutive Heavy/Wrecked logs → soften upcoming sessions | v1.3 |
| RPE disconnect | RPE 8+ on easy run → coach note only (no plan change) | v1.3 |

### Scoped but unscheduled

- **Estimated race times** (5K/10K/HM/Marathon, data-driven) — PAID
- **Zone method selector** — user picks HR zone calc method, stored in `user_settings` — PAID
- **GTM-11 Pricing review** — annual discount currently 37% vs category norm 44–49%. Monthly parameterised in `lib/brand.ts`; can raise to £9.99/month (50% annual discount) without a search-replace. Revisit after first 100 paid conversions

### Parking lot

- Session swap (PAID)
- AM/PM scheduling (PAID)

### Ops

- **Rename Vercel project** from `zona-service-nerds-projects` → `zona` or `zona-app` when name available. Update `NEXT_PUBLIC_APP_URL`, `CLAUDE.md`, this file, `app/api/checkout/route.ts` fallback

---

## Tech Debt

- 🔲 `PlanCalendar` `stravaRuns` prop — accepted but unused in WeekCard. Remove or wire up
- 🔲 **Tier-divergent rendering utility** — once a second tier-divergent component lands (after `GeneratingCeremony.tsx`), centralise the `tier` prop pattern into shared context or typed convention. Document in `ui-patterns.md`
- 🔲 **API contract docs** — missing `docs/contracts/api/` entries for 10 routes: `analyse-run`, `adjust-plan`, `confirm-adjustment`, `checkout`, `recalibrate-zones`, `revert-adjustment`, `delete-account`, `weekly-report`, `push/subscribe`, `push/send-weekly-report`. Write after UX rework — shapes may change
- 🔲 **Plan history UI** — data is archived to `plan_archive` table (migration `20260424`); browse + restore UI deferred. Schema has `race_name`, `race_date`, `archived_at` for future list display
- 🔲 **R20 reshape API gating** — still calls `hasPaidAccess()` directly; could migrate to `isFeatureAllowed('dynamic_reshape_r20')` for clarity

---

## Appendix — Open questions & reference

### R23 deferred items still open

- **R23-D1** — Tier 2 wizard fields (`treadmill_primarily`, `longest_run_ever_km`) need engine consumer / product decision before the wizard work is worth shipping
- **R23-D2** — Catalogue lookup for legacy plans. Recommendation: abandon (legacy plans expire as users regenerate). Confirm decision
- **R23-D3** — Surface `compressed` flag in UI. Needs design rationale via `frontend-design` skill before shipping
- **R23-D5** — ReshapeScreen 403 missing upgrade CTA. Defense-in-depth only — no production user can hit this via supported flows. Two-line fix when picked up

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
