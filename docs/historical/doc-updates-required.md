# ZONA — Doc Updates Required

**Status:** v2 updated 2026-04-23
**Context:** `brand-product-alignment.md` v2 was agreed on 2026-04-23. This file lists every existing doc that needs to be updated, in execution order.

---

## Priority 1 — Brand constants (do this first)

### `lib/brand.ts`
- **Add** `BRAND.appStoreSubtitle: 'Training plans that stop you overtraining.'`
- **Add** `BRAND.signinSub: 'Access your training plan.'` (currently hardcoded in login)
- **Retain existing:**
  - `BRAND.name: 'Zona'`
  - `BRAND.tagline: "Slow down. You've got a day job."`
  - `BRAND.brandStatement: "Slow down. You're not Kipchoge."`
  - `BRAND.signupSub` (no change)
  - All `BRAND.push.*`
  - `PRICING.annual.savingLabel`
- **Retire**: `BRAND.og.navy`, `BRAND.og.teal`, `BRAND.og.offWhite` — these reference the old System B palette. Once the new Warm Slate palette is in globals.css, update or remove these OG colour references.

### Fix hardcoded references to BRAND constants
- `app/auth/login/page.tsx` line 73 → use `BRAND.name` not hardcoded "Zona"
- `app/auth/login/page.tsx` line 224 → use `BRAND.brandStatement` not hardcoded "Slow down. You're not Kipchoge."
- `app/auth/login/page.tsx` sign-in sub → use `BRAND.signinSub` not hardcoded "Access your training plan."
- `app/dashboard/DashboardClient.tsx` line 603 → use `BRAND.name`
- `app/dashboard/DashboardClient.tsx` line 871 → use `BRAND.name`
- `app/privacy/page.tsx` line 262 → use `BRAND.brandStatement`
- `app/layout.tsx` `<title>` → rebuild using `${BRAND.name} — ${BRAND.tagline}` instead of hardcoded string

---

## Priority 2 — Architecture & system docs

### `CLAUDE.md`
- **Add Brand section at top** with the three-tagline system (table from alignment doc §2)
- **Add positioning sentence** from alignment doc §3
- **Update brand voice section** to mirror §8 of alignment doc (copy patterns that work / don't work). `CLAUDE.md` and alignment doc must say the same thing.
- **Remove any reference to dark mode as user-facing option**
- **Remove any reference to smoke tracker**
- **Update active next items list** to reflect new redesign phases (R16.1 through R16.4 per alignment doc §9) superseding prior R17 / session card redesign items
- **Update Scope Cleanup notes:** Calendar deleted; Welcome retired; Smoke tracker cut; Strava admin-only via URL

### New ADR: `ADR-005-warm-slate-palette.md`
- Document the Warm Slate token set
- Values table (bg, ink, mute, line, card, moss, warn, session colours)
- Reason: single light theme, premium feel, brand alignment with alignment doc §11
- Supersedes ADR-001 for colour values; ADR-001 remains valid for "tokens are the single source" principle
- Add status block: "Accepted. Supersedes ADR-001 (colour values only)."

### New ADR: `ADR-006-single-theme-only.md`
- Dark mode removed
- Rationale: simplicity, brand consistency, faster to ship, fewer CSS paths to maintain
- Implementation: all `[data-theme="dark"]` selectors deleted from globals.css, `applyTheme()` function removed, theme toggle removed from Me screen, `rts_theme` localStorage key deprecated
- Supersedes ADR-004

### `ADR-001-design-tokens.md`
- **Mark as "Superseded for colour values by ADR-005; principle retained"**
- Keep the rest of the ADR — the central principle (one token source) still applies

### `ADR-004-theme-system.md`
- **Mark as "Superseded by ADR-006 — Single light theme only"**

---

## Priority 3 — UI patterns & components

### `ui-patterns.md`
- **Core Aesthetic section**: replace "Dark-first, athletic, calm" with "Light-first, warm, calm. Single theme, no dark mode. Restraint throughout."
- **Typography Scale table**: update to Inter-only, with weight 800 for display moments, 500–600 for body. Remove Space Grotesk references.
- **Remove any reference** to dark mode, `data-theme`, `applyTheme()`
- **Remove** reference fonts Space Grotesk, DM Sans, DM Mono
- **Update spacing/radius tokens** once finalised in new globals.css
- **Replace Session Card specs** to match redesigned component
- **Update Week Strip spec** to reflect new dot/indicator language
- **Decide Post-Log Reflect Sheet:** either remove (Session Detail handles logging inline) or update
- **Add new section**: "Pending Adjustment Pattern" — now a hero feature, document visual rules
- **Add new section**: "Restraint Card Pattern" — recurring brand moment, document its design
- **Add new section**: "Coach Note Pattern" — amber card with initial avatar, document visual rules, sizing, placement
- **Add new section**: "Plan Arc Pattern" — the weekly progression strip, document rules
- **Add new section**: "RPE Scale Pattern" — the filling-bar interaction, document states

### `screen-inventory.md`
- **Remove**: Calendar screen (deleted), Welcome screen (retired), Smoke tracker (cut)
- **Update Strava entry**: admin-only via URL, nav entry removed
- **Update Session Detail entry**: confirm full-screen pattern
- **Update nav model**: 4 tabs (Today · Plan · Coach · Me)
- **Resolve open questions** (from §6 of inventory):
  - Calendar screen → Deleted
  - Session Detail → Full-screen, final pattern
  - Orientation trigger → Only on first-ever plan generation
  - Smoke tracker → Cut entirely
  - Welcome screen → Retired
  - Strava token failure → Add one-tap Reconnect CTA (new backlog item)
  - Plan archive → Compliance only, no UI restore for v1
  - Longest run "Since Jan 2026" → Bugfix, make dynamic
  - Dynamic adjustments toggle → Retain; add inline "pause" option in pending adjustment banner (new backlog item)
- **Update copy samples** for screens whose copy changes during redesign

---

## Priority 4 — Release docs

### Release notes / backlog
- **R16 is the redesign** (four phases per alignment doc §9)
- **Remove smoke tracker from any backlog reference**
- **Add new backlog items:**
  - Strava one-tap reconnect CTA
  - Inline "pause auto-adjustments" option in pending adjustment banner
  - Longest run metric dynamic (bugfix)
  - Marketing & launch assets (landing page, App Store screenshots, @zonarun Instagram)

---

## Priority 5 — New marketing docs (post-Phase 1)

### New doc: `/docs/marketing/app-store-listing.md`
- Full App Store description per alignment doc §7
- Keywords research
- Category (Health & Fitness primary)
- Age rating
- Screenshot narrative (5 images per §7)
- Preview video script (optional for v1)

### New doc: `/docs/marketing/landing-page.md`
- Hero headline: `BRAND.appStoreSubtitle`
- 3 "proof" sections matching design implications
- Founder story (short)
- Pricing section
- FAQ
- Email capture → TestFlight invite flow

### New doc: `/docs/marketing/content-calendar-launch.md`
- Pre-launch content (3–5 IG Reels leading to May 10)
- TestFlight launch post
- App Store launch post
- Week-of-race launch tie-in content
- Post-race content arc

---

## Priority 6 — Retire and archive

- Any doc referring to the Ember palette (`#D4501A`) → retire permanently
- Any doc referring to DM Sans / DM Mono → retire permanently
- Any Welcome screen specs → archive
- Any Smoke tracker specs → archive (retain code in repo history, don't delete entirely until v2)

---

## Execution order

Do these in order. Don't skip ahead.

1. ✅ **Lock alignment doc** (done)
2. **Update `lib/brand.ts`** — add new constants
3. **Write ADR-005 and ADR-006** — new ADRs draft
4. **Update `CLAUDE.md`** — brand section, positioning, voice, scope
5. **Phase 1 of redesign build** — globals.css rewrite + scope cleanup + hardcoded BRAND fixes
6. **Update `ui-patterns.md`** — during or after Phase 2 build
7. **Update `screen-inventory.md`** — during Phase 3 build as screens land
8. **Marketing docs** — parallel work during Phase 3 onwards

---

## Change log

| Date | Change | By |
|---|---|---|
| 2026-04-23 | Created. Reflects decisions from alignment session. | Russ + Claude |
| 2026-04-23 | v2: added Priority 1 (brand constants) section for new `BRAND.appStoreSubtitle` and `BRAND.signinSub`, plus hardcoded reference fixes per tagline audit. Adjusted execution order to do constants before docs. | Russ + Claude |

---
