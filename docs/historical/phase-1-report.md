# Phase 1 Completion Report

**Branch**: `redesign/phase-1-tokens`  
**Pushed**: 2026-04-23  
**Build status**: TypeScript compiles clean. Pre-existing env failure at `/api/delete-account` and `/api/webhooks/revenuecat` data collection (supabaseKey not set in local env) — identical to baseline, not a regression.

---

## What shipped

| Hash | Commit |
|---|---|
| `16d0b27` | redesign: add appStoreSubtitle and signinSub to BRAND constants |
| `4576cfb` | redesign: replace hardcoded brand strings with BRAND constants |
| `4ff7e66` | redesign: add ADR-007 warm slate palette |
| `c051fe9` | redesign: add ADR-008 single theme only |
| `179fa1e` | redesign: mark ADR-001 and ADR-004 as superseded |
| `3eb0b59` | redesign: rewrite globals.css with warm slate palette + legacy aliases |
| `18b05ef` | redesign: remove dark mode per ADR-008 |
| `787c9c7` | redesign: retire calendar screen |
| `b593eab` | redesign: retire welcome screen |
| `e2a9f29` | redesign: remove smoke tracker UI |
| `1e54e77` | redesign: remove strava screen nav entry (admin-only via URL) |
| `aaa24cc` | redesign: update CLAUDE.md to match brand-product-alignment v2 |

---

## Detailed change log

### `lib/brand.ts`
- Added `BRAND.appStoreSubtitle: 'Training plans that stop you overtraining.'`
- Added `BRAND.signinSub: 'Access your training plan.'`
- Added `// DEPRECATED` comments on `BRAND.og.*` values (System B palette, kept to avoid breaking OG route before Phase 2 redesign)

### `app/auth/login/page.tsx`
- Wordmark `'Zona'` → `{BRAND.name}`
- Sign-in sub `'Access your training plan.'` → `{BRAND.signinSub}`
- Footer `'Slow down. You're not Kipchoge.'` → `{BRAND.brandStatement}`
- `data-theme="dark"` attribute removed (no-op post ADR-008)

### `app/dashboard/DashboardClient.tsx`
- Welcome screen wordmark `'Zona'` × 2 → `{BRAND.name}`
- `rts_theme` localStorage reads commented out and annotated `DEPRECATED`
- `saveTheme()` commented out (one-release rollback window)
- `applyTheme()` body replaced with no-op comment
- Theme toggle UI in Me screen commented out
- `onThemeChange={saveTheme}` → no-op inline
- Welcome screen trigger (`setShowWelcome(true)`) commented out
- Smoke tracker stats row (Today screen) commented out
- Smoke tracker toggle + quit date picker + Quit tracker nav (Me screen) commented out
- Strava nav entry in overflow menu commented out
- CalendarOverlay import removed; `screen === 'calendar'` branch removed

### `app/privacy/page.tsx`
- Added `import { BRAND } from '@/lib/brand'`
- Footer `'Slow down. You're not Kipchoge.'` → `{BRAND.brandStatement}`
- `data-theme="dark"` attribute removed

### `app/layout.tsx`
- Theme init script removed (replaced with comment)
- Google Fonts link: Space Grotesk removed, Inter extended to weights 300–900
- `theme-color` meta: `#0B132B` → `#F3F0EB` (warm bg)

### `app/globals.css`
- Full rewrite: Warm Slate palette (ADR-007)
- `[data-theme="dark"]` block deleted entirely
- Legacy aliases added for all System B token names — component code unchanged
- Space Grotesk removed from Google Fonts import
- `--font-brand` now resolves to Inter

### `app/dashboard/CalendarOverlay.tsx`
- Renamed to `CalendarOverlay.old.tsx`

### `docs/architecture/ADR-007-warm-slate-palette.md`
- New ADR documenting the Warm Slate token set, rationale, and migration path

### `docs/architecture/ADR-008-single-theme-only.md`
- New ADR documenting dark mode removal, rationale, implementation, and rollback path

### `docs/architecture/ADR-001-design-tokens.md`
- Status updated: "Superseded for colour values by ADR-007; principle retained"

### `docs/architecture/ADR-004-theme-system.md`
- Status updated: "Superseded by ADR-008 — Single light theme only (2026-04-23)"

### `docs/canonical/brand.md`
- Tagline section corrected: "Slow down. You've got a day job." is the primary tagline; "Slow down. You're not Kipchoge." correctly placed as brand statement

### `CLAUDE.md`
- Brand section added at top: three-line tagline system table, positioning sentence, voice rules table
- Design system section rewritten for Warm Slate (removed System B)
- Active scope table added (shows retired/removed screens)
- Critical rules section updated: `applyTheme()` no-op, dark mode removed, pre-commit hook note
- Redesign progress section added: Phase 1 shipped, Phase 2–4 next
- ADR list updated to include ADR-007 and ADR-008
- References to smoke tracker, dark mode as user-facing features removed

### `.git/hooks/pre-commit`
- Bug fix: `globals.css` now excluded at file-selection stage (previously only excluded at results-grep stage, which failed when globals.css was the only staged file)

---

## What was skipped

Nothing. No tasks were blocked. See `phase-1-blockers.md` — blockers file contains only notes, no actual blockers.

---

## Decisions made autonomously

14 decisions logged. See `phase-1-decisions.md`.

Most significant:

| # | Decision |
|---|---|
| D-002 | ADR numbering: ADR-005/006 already taken. New ADRs assigned ADR-007 and ADR-008. |
| D-003 | Inter-only typography: `--font-brand` now resolves to Inter. Space Grotesk retired. |
| D-011 | Pre-commit hook bug fix: `globals.css` excluded at file-selection stage. |
| D-013 | `theme-color` meta updated to warm bg (`#F3F0EB`). |

---

## Build status

| Check | Result |
|---|---|
| TypeScript (`npx tsc --noEmit`) | ✓ Clean |
| Next.js compile | ✓ `Compiled successfully` |
| Linting + type validity | ✓ Pass |
| Data collection | ✗ Pre-existing env failure (supabaseKey missing locally) — not a regression |

The data collection failure is caused by API routes calling `createClient()` at module evaluation time, which requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to be set in the build environment. Vercel has these. Local builds without `.env.local` always fail at this step — identical to baseline before Phase 1 began.

---

## Visual sanity check

Not run — `npm run dev` requires Supabase env vars to not crash on boot. Recommend spinning up with a `.env.local` present and checking:
1. Login page — warm bg, Inter font, no dark styling
2. Dashboard — warm bg, moss accent instead of teal
3. Me screen — no theme toggle, no smoke tracker
4. Overflow "More" menu — Coach + Profile only (no Strava)

---

## What's next — Phase 2 handoff

**Branch to create**: `redesign/phase-2-today-session-plan`  
**Target**: May 3, 2026

### Ready to build
- `globals.css` is live with Warm Slate tokens + full legacy alias bridge
- All System B component code continues to work — aliases handle it
- Clean TypeScript, no dead references

### Phase 2 scope
1. **Today screen** — full visual redesign. Hero metric, pending adjustment card (elevated), restraint card.
2. **Session Detail screen** — redesigned session card hierarchy, new coach note block pattern.
3. **Plan screen** — plan arc (weekly progression strip), updated session row language.

### New components to introduce in Phase 2
- `RestraintCard` — shows zone discipline stat ("78% in Zone 2")
- `PendingAdjustmentBanner` — hero feature, not utility
- `CoachNoteBlock` — amber card with initial avatar
- `PlanArc` — weekly progression strip
- `RPEScale` — filling-bar interaction

### Start with
Read `docs/alignment/brand-product-alignment.md` §11 (design implications) and `docs/canonical/ui-patterns.md` before touching any screen. Trigger `frontend-design` skill for all visual work. The four design implications to keep front of mind:

1. Home screen must deliver "slow down" in under 3 seconds
2. Pending adjustment card is a hero feature — treat it accordingly
3. Restraint stat ("78% in Zone 2") is the most distinctive moment in the weekly summary
4. Data density should **decrease**, not increase — Runna is denser, Zona wins by showing less

---

## How to review

```bash
git fetch origin
git checkout redesign/phase-1-tokens
npm run dev   # requires .env.local with Supabase keys
```

Open `localhost:3000`:
- Login page: warm background, Inter font only, no dark theme
- Dashboard: accent colour is now moss green (not teal), background is warm off-white
- Me screen: theme toggle gone, smoke tracker gone, Strava not in overflow menu
- Coach tab: locked state for free users still present

To review docs only (no local run needed):
- `docs/alignment/brand-product-alignment.md` — the brief
- `docs/architecture/ADR-007-warm-slate-palette.md` — palette decision
- `docs/architecture/ADR-008-single-theme-only.md` — dark mode removal decision
- `CLAUDE.md` — updated project intelligence
- `docs/alignment/phase-1-decisions.md` — all autonomous decisions with reasoning
