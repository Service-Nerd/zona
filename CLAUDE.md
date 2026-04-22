# CLAUDE.md — Zona Project Intelligence

This is the single source of truth for the Zona codebase.
Read this before touching anything. All design, architecture, and
behavioural rules live here or in /docs.

---

## What Is Zona?

A running training app for non-elite runners who overtrain.
Brand positioning: "Slow down. You're not Kipchoge."
Core truth: "You're trying hard. That's the problem."

Each user brings their own plan — race, distance, training phase. All
athlete-specific data (race, HR zones, name) lives in the plan JSON
and user_settings. Nothing is hardcoded to a specific person.

---

## Tech Stack

| Layer       | Tech                          |
|-------------|-------------------------------|
| Frontend    | Next.js (App Router)          |
| Backend     | Supabase                      |
| Deployment  | Vercel                        |
| Plan data   | GitHub Gist (JSON)            |
| Auth        | Supabase Auth                 |
| Fitness API | Strava (free tier)            |
| Dev machine | Mac Mini                      |

- Supabase project ID: `wkppmpsvqkaxbekdgzdm`
- Vercel app: `https://zona-service-nerds-projects.vercel.app`
- Plan JSON: `https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json`
  - Always fetched with `cache: 'no-store'`

---

## Design System — System B (LOCKED. NON-NEGOTIABLE.)

| Token           | Value     | Usage                        |
|-----------------|-----------|------------------------------|
| Navy dark bg    | `#0B132B` | Dark mode background         |
| Off-white bg    | `#F7F9FB` | Light mode background        |
| Cards (light)   | `#ffffff`  |                              |
| Cards (dark)    | `#162040` |                              |
| Teal            | `#5BC0BE` | CTA / active / zones         |
| Amber           | `#F2C14E` | Coaching / warnings          |
| Muted           | `#3A506B` |                              |
| Borders (light) | `#E2E8F0` |                              |
| Borders (dark)  | `#1e2e55`  |                              |

**Fonts:** Inter (metrics/UI) · Space Grotesk (headings/brand)

**Font tokens:** `var(--font-ui)` = Inter · `var(--font-brand)` = Space Grotesk. These are the only two font tokens. `--font-display` is NOT a token — any reference to it is a typo; use `var(--font-brand)`.

**BANNED:**
- `#D4501A` (ember orange)
- `#f5f2ee` (warm beige)
- DM Mono
- DM Sans
- Hardcoded colour values anywhere in components
- Hardcoded font family strings — use `var(--font-ui)` / `var(--font-brand)` only

All colour MUST come from CSS custom properties in `globals.css`.
Nothing hardcoded in component files.

### Session Type Colour Map

| Type         | Colour  | Hex       |
|--------------|---------|-----------|
| easy         | Blue    | `#4A90D9` |
| long         | Purple  | `#7B68EE` |
| quality/tempo| Amber   | `#F2C14E` |
| intervals    | Coral   | `#E05A5A` |
| race         | Orange  | `#E8833A` |
| recovery     | Green   | `#5BAD8C` |
| strength     | Navy    | `#3A506B` |
| cross-train  | Teal    | `#5BC0BE` |
| rest         | —       | No accent |

---

## Tone of Voice

Honest, slightly sarcastic, self-aware, encouraging without cringe.

- Too fast → *"Bit keen. Ease it back."*
- Perfect → *"There it is. Don't ruin it."*
- Rest day → *"Do nothing. It helps."*
- Post-run good → *"Kept it under control."*

---

## UI Principles

- One job per screen
- Calm guidance, not alerts
- Restraint feels like progress
- No dashboards or noise
- No popups — all interactions navigate to full screens
- Back arrow always top-left
- Slide-up sheets: mirrored nav bar at bottom, not top

**Reference aesthetic: Runna + Planzy** — bold metric hierarchy, dark athletic cards, left-accent session type indicators, week-strip navigation, clean session rows. See `docs/canonical/ui-patterns.md` before building any new screen.

**Before building any screen or component**: read `docs/canonical/ui-patterns.md`. Use the prompt template at the bottom of that file. Trigger the `frontend-design` skill for all UI work.

---

## Critical Rules & Known Gotchas

### `applyTheme()` Pattern
- ONLY toggle `data-theme="dark"` on `<html>`
- NEVER use `setProperty()` calls — they override the stylesheet cascade and break theming

### TypeScript
- `[...seen]` spread on `Set<string>` fails
- Use `Array.from(seen)` instead

### sed replacements
- Values containing `#` wrapped in double quotes get corrupted
- e.g. `'#2a2a2a'` becomes `''#2a2a2a''`
- Always verify output after bulk replacements

### Strava OAuth
- Multi-line curl in Mac Terminal consistently fails
- Use Hoppscotch (hoppscotch.io)
- POST to `https://www.strava.com/oauth/token`
- Body as `application/x-www-form-urlencoded`
- Auth code expires in ~5 minutes and is single-use
- Strava client ID: 219980

### Global State Pattern
- Overrides and settings fetched once at `DashboardClient` level
- Passed as props to child components
- Avoids duplicate API calls and flash/inconsistency

### sessionStorage Keys (canonical)
- `zona_wizard_draft` — wizard form state persisted by `GeneratePlanScreen`. Written on every field change; restored on mount; cleared on `handleUsePlan` success. Enables back-navigation resumption and upgrade-mid-wizard flow. Never rely on this in server or API code — client only.

### Plan Archive
- `plan_archive` Supabase table — previous plan stored here before every `savePlanForUser` call. Populated via fire-and-forget `void` insert in `handlePlanSaved` (DashboardClient). Migration: `20260424_plan_archive.sql`. No restore UI at v1 — data protection only. Future plan history screen reads from this table.

### Palette Regression (Most Common Failure)
- System B palette regressions are the #1 recurring issue
- The fix: full `globals.css` rewrite + sed-based replacement of all hardcoded values
- If you see ember orange, warm beige, DM Mono, or DM Sans — stop and fix it

### Hybrid Generation Pattern (R23+)

All plan generators (R23 plan generator, R20 reshaper, R24 multi-race, R21 strength) follow the same shape:

1. **Deterministic rule engine** produces canonical plan JSON — no AI calls, always succeeds.
2. **AI enricher** optionally adds voice, coaching copy, and confidence score on top of that JSON.
3. **Enricher failure is silent** — if Claude times out, returns malformed JSON, or fails validation, the rule-engine output is returned unchanged. The user always gets a plan.

This is the only permitted architecture for plan generation. Binary split (free=template / paid=AI-only) is explicitly rejected. See `docs/architecture/ADR-006-hybrid-generation-pattern.md`.

### Auth at the Route Boundary

`lib/plan/*` modules are pure functions of inputs and a `tier` parameter. They do not import auth helpers, call Supabase, or access `process.env` authentication secrets. The API route is the auth boundary: it calls `hasPaidAccess()`, determines the tier, and passes `tier: 'free' | 'trial' | 'paid'` into `generate(input, tier)`. This keeps plan logic unit-testable and honours ADR-003.

### Free Users Are Never Abandoned

Any feature that locks a free user out of core function — getting a plan, seeing a session, logging a run — is a brand violation. Gate richness (AI labels, coaching voice, confidence score), never gate access (the plan itself, the session card, the log action). ZONA protects runners from themselves; abandonment is not protection.

---

## Workflow Rules

- Generate complete files + a single `cp` + deploy command
- No tailing build output before deploy
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

Use this structure when requesting any screen or component change:

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

Zona uses a **Hybrid Reverse Trial**: 14 days full access for all new users, then graceful downgrade to free tier. Upgrade prompts are triggered by user behaviour (attempting a PAID feature), never by a calendar date.

See `docs/canonical/monetisation-strategy.md` for the full model, pricing targets, and trial infrastructure requirements.

## Feature Tagging

| Tier | Includes |
|------|----------|
| FREE | Generic plans (5K/10K/HM, 8 & 12 week, rule-based engine — no AI calls), session display and tracking, formula-derived pace/HR targets, basic profile |
| PAID | AI plan generation, dynamic plan reshaping, Strava integration, AI coaching, confidence scoring, all personalised or intelligent features |

**All AI calls route through Next.js API routes only — never from the client.**

---

## Session Card Layout (Active Work)

Required hierarchy:
1. **TOP:** Run type · Zone · HR target(s) · Estimated pace bracket · Distance + duration
2. **MIDDLE:** Session description
3. **BOTTOM:** Why / coach notes

Global dist/duration toggle lives in the Me screen.
Per-session toggle in expanded card only — saves per session, updates collapsed card too.

---

## Documentation

### Canonical Truth

| Folder | Authority For |
|---|---|
| `docs/canonical/` | All domain rules — session types, plan schema, zone rules, coaching rules, feature registry, monetisation strategy, brand, UX principles |
| `docs/contracts/` | All API route and component prop contracts |
| `docs/architecture/` | Architectural decision records (ADRs) and architecture overview |
| `docs/releases/` | Release notes and ordered backlog |

**Before building any new feature**: check `docs/canonical/feature-registry.md` — every feature must be tagged FREE or PAID before implementation begins.

**When changing any API route or component prop interface**: update `docs/contracts/` in the same commit.

### References

- Architecture overview: `docs/architecture/architecture.md`
- Backlog: `docs/releases/backlog.md`
- Feature registry (FREE/PAID): `docs/canonical/feature-registry.md`
- ADRs: `docs/architecture/ADR-*.md` (ADR-001 design tokens, ADR-002 JSON-first, ADR-003 free/paid gates, ADR-004 theme system, ADR-005 subscription payments, ADR-006 hybrid generation)
- Monetisation strategy: `docs/canonical/monetisation-strategy.md`
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