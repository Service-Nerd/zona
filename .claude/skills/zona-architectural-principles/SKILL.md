---
name: zona-architectural-principles
description: "Zona architecture decisions, MUST/NEVER rules, doctrine, invariants, canonical contracts, UI testing with agent-browser, documentation governance. Triggers: architecture, doctrine, invariants, contracts, design, is this allowed, should I, does this violate, refactor, release, feature flag, free/paid, colour token, theme, Supabase, plan schema, session card, coaching, route, component, API, Strava, auth."
---

# Zona Architectural Principles

The single consolidated reference for all architectural principles, doctrine, invariants, and design rules governing the Zona app.

**Authority**: This skill synthesizes rules from `CLAUDE.md`, `docs/contracts/`, `docs/canonical/`, and system-specific documents. When in doubt, trace to the canonical source listed in each section.

**Stack**: Next.js 14 · Supabase (Postgres + Auth) · Vercel · GitHub Gist (plan JSON) · Strava OAuth · TypeScript strict

---

## Immediate Operating Rules

Use this skill as a fast-injection operating contract, not just a rule catalog.

1. **Canon first**: Check `docs/contracts/` and `docs/canonical/` before writing code. If the contract doesn't exist, write it first.
2. **Code truth second**: Trace every dependency to its owning file, migration, or schema. Never guess from filenames.
3. **Decide the gap type explicitly**:
   - Canon clear, code wrong → fix code.
   - Canon missing/ambiguous → write the contract first, then implement.
   - Supabase schema and TypeScript types disagree → fix the migration and regenerate types.
4. **Fix at the owning boundary**: Correct the component, service, schema, or route that actually owns the defect.
5. **No drift-preserving patches**: Do not add local adapters, compatibility branches, or TODOs just to keep a narrow patch.
6. **Verify across live surfaces**: Supabase schema, API route, component, UI state, and browser-visible output.
7. **Free/paid tagged before build**: Every feature must be tagged `[FREE]` or `[PAID]` before implementation begins. Untagged features are build blockers.
8. **Design tokens from globals.css only**: No hardcoded hex values, font names, or spacing in components. Ever.
9. **One release at a time**: Complete and ship the current release before starting the next. No parallel release work.
10. **Upload live files**: Always work from the actual current file. Never assume file state from memory.

---

## Canon vs Code Decision Gate

| Situation | Correct Action |
|---|---|
| Contract is explicit, implementation disagrees | Fix implementation |
| Contract is missing or ambiguous | Write contract first, then implement |
| Supabase schema and TypeScript types disagree | Fix migration, regenerate types |
| Two components handle the same data differently | Unify under one owner |
| Hardcoded colour/font found in a component | Replace with CSS custom property from globals.css |
| Hardcoded coaching numeric / threshold / ratio in `lib/plan/*` or `lib/coaching/*` | Promote to `GENERATION_CONFIG` (or sibling config); add corresponding principle in `CoachingPrinciples.md`. INV-CFG-001 / INV-CFG-003. |
| Feature exists without free/paid tag | Tag it before touching it |
| Fix requires weakening a contract to make buggy code look valid | The code is wrong |
| UI interaction has no corresponding API/Supabase path | Flag as architecture gap |

---

## Root-Boundary Workflow

When remediating defects or evaluating design changes:

1. Retrieve the contract for the surface in question (`docs/contracts/`).
2. Trace the live owner in code, schema, and route.
3. Identify where semantics diverge: schema, API, component, UI, or types.
4. Name the owning boundary explicitly.
5. Decide: implementation drift or doctrinal gap?
6. Apply the smallest complete fix at the owner boundary.
7. Remove unjustified fallbacks or duplicate ownership exposed by the touched path.
8. Verify through the real surface (browser + Supabase dashboard + Vercel logs).

---

## Boundary Triage Cheatsheet

| Symptom | Likely Owner Boundary |
|---|---|
| UI shows empty, Supabase has data | API route projection or component prop contract |
| Session colour wrong | Design token in globals.css or session-type map |
| Theme regression (dark mode reappearing) | ADR-008: dark mode is removed. `applyTheme()` is a no-op. Strip any `data-theme` toggling. |
| Plan data stale | Gist fetch caching — ensure `cache: 'no-store'` |
| Strava OAuth fails | Token exchange — check Hoppscotch flow, codes expire in ~5 min |
| TypeScript build error on Set spread | Use `Array.from(set)` not `[...set]` |
| Flash of wrong colour on load | Global overrides fetch not lifted to DashboardClient level |
| Feature visible on free tier | Free/paid gate missing in component or API route |
| Two components show different data for same session | Shared state not lifted; prop or context ownership gap |
| Supabase migration fails | Check RLS policies and column defaults before pushing |
| Magic number in `lib/plan/*` or `lib/coaching/*` | Belongs in `GENERATION_CONFIG` (or sibling config); add principle in `CoachingPrinciples.md`. Exempt: algorithm formulas (Daniels VDOT, Tanaka MaxHR) + structural constants (7 days/week). |

---

## Verification Ladder

Do not stop at one layer if the defect crosses boundaries.

1. **Schema proof**: Supabase table structure matches migration intent.
2. **Type proof**: TypeScript interfaces match Supabase schema.
3. **API proof**: Route returns correct shape for the contract.
4. **Component proof**: Component renders correct output for the API response.
5. **Browser proof**: Real user-visible state is correct.
6. **Journey proof**: Full flow (e.g. login → dashboard → session expand → override save) works end to end.
7. **Doc alignment proof**: Contract doc updated if behavior changed.

---

## 1. Project Doctrine (Non-Negotiable)

| # | Principle | Zona Meaning |
|---|---|---|
| D-01 | Ambiguity is the enemy | Every behaviour — session types, zone calculation, free/paid gates, theme toggling — must be explicitly stated. Implicit = broken. |
| D-02 | No assumptions | Never assume a Supabase table, column, RLS policy, or API route exists. Trace to the migration or surface it as a gap. |
| D-03 | Versioned behaviour only | Plan JSON schema changes require explicit version handling. Never silently reinterpret old Gist shapes. |
| D-04 | Failure is data | Errors from Supabase, Strava, or plan fetch must surface as structured UI state, not console-only. |
| D-05 | SLC over MVP | Every feature ships complete: validation, error states, loading states, type safety, and mobile layout. No stubs. |
| D-06 | Minimal sufficient change | Smallest fix that removes the defect at the correct boundary. Not smallest local patch. |
| D-07 | Fix truth at the owning boundary | Don't patch around drift. Fix the component, schema, or contract that actually owns it. |
| D-08 | No duplicate ownership | One concern, one owner. `DashboardClient` owns global overrides fetch. `globals.css` owns all design tokens. `session-types.ts` owns session colour/label map. |
| D-09 | No accidental legacy retention | Old palette values (Ember orange `#D4501A`, warm beige `#f5f2ee`, DM Mono, DM Sans) must not survive in any live surface. |
| D-10 | Architecture may change | Don't preserve current structure just because it exists. Prefer structures that reduce drift and clarify ownership. |
| D-11 | Drift is a defect | Divergence between design tokens, component styles, Supabase schema, TypeScript types, and API contracts must be fixed — not deferred. |
| D-12 | No invented adjacent features | Build only what the current release justifies. Missing prerequisites become backlog items, not silent scope expansions. |
| D-13 | Truth system | `docs/contracts/` owns API and component contracts. `docs/canonical/` owns session types, zone rules, plan schema, and coaching rules. `docs/architecture/` owns system design decisions (ADRs). |
| D-14 | UI trust-state visibility | Training status, Strava sync state, plan confidence, and error states must be readable on-screen without log inspection. |
| D-15 | E2E verification is journey-based | agent-browser smoke tests cover full user journeys (login → dashboard → session expand → complete), not isolated route hits. |
| D-16 | No parallel semantics | Session colour, label, and zone logic must have one owner (`session-types.ts`). Components consume it; they do not reimplement it. |
| D-17 | Separate display from logic | UI display labels and coaching copy are display concerns. Zone calculation, HR targets, and pace brackets are logic concerns. They must not bleed into each other. |
| D-18 | Hard cut means full removal | When retiring a field, palette value, or component, remove it from schema, types, components, globals.css, and docs in the same release. |
| D-19 | Do not align doctrine downward | If code and contract disagree, fix the code. Contracts must not be weakened to normalise buggy implementation. |
| D-20 | Free/paid is a first-class concern | Every feature has a free/paid tag in `docs/canonical/feature-registry.md` before implementation. Gates are enforced in both API routes and components. |
| D-21 | A principle that cannot be satisfied is a defect in the principle | If honouring a written rule *necessarily* produces a bad outcome, the rule is wrong — not the code that honoured it. Fixing it is an engineering call, escalated only if the coaching intent itself is in question. Added 2026-08-06 after the plan-generator incident, where the 10% rule applied to a post-deload bounceback made progressive overload arithmetically impossible in every plan containing a recovery week, and §64 demanded a `type: 'rest'` session the engine had never emitted. Both sat unfixed because the canon is treated as constitutional and no route existed to say "the constitution is wrong here". **Test:** can any valid input satisfy this rule AND produce a plan you would give a runner? If no — the rule is the defect. Record the amendment and its reasoning in `CoachingPrinciples.md`; do not silently diverge from it in code. |
| D-22 | Changing canon routes through the board; honouring it does not | D-21 makes fixing a broken principle an *engineering* call. This is its companion: **amending the canon itself — changing what a `CoachingPrinciples.md` rule *says*, its severity, or the coaching behaviour it prescribes — routes through `/slt-review` before merge.** The line is intent: a change that makes the code honour an existing principle is engineering; a change that alters the principle is a board call. Added 2026-08-06 after GEN-FIX-09 rewrote §64 (rest as implicit; the six-day cap) directly in code with no sign-off — the second canon change in one wave to ship without the board, caught only in post-merge review (GEN-FIX-11/12). A change shipped without the gate is not ratified by having passed review after the fact; surface it and get the sign-off (as GEN-FIX-12 did). **Test:** does this change what a principle *means*, or only make the engine obey what it already meant? If the former — board first. |

---

## 2. Engineering Quality Principles

Every solution must be: **Maintainable, Reliable, Accurate, Sensible, Testable, Auditable, Consistent**.

| Principle | Zona Meaning |
|---|---|
| Maintainable | Components have clear ownership. Tokens live in one place. New developers can follow the design system without archaeology. |
| Reliable | Supabase errors, failed Gist fetches, and Strava OAuth failures degrade gracefully with visible UI state. |
| Accurate | Zone calculations, HR targets, and pace brackets produce correct results. No floating-point drift in training metrics. |
| Sensible | Proportionate to a solo developer. No over-engineering. Each screen does one job. |
| Testable | Critical paths (zone calculation, session type resolution, plan JSON parsing) have unit tests. Journeys have agent-browser smoke tests. |
| Auditable | Plan JSON source (Gist commit), Supabase row timestamps, and override history are traceable. |
| Consistent | Same session type → same colour, label, zone, and HR target everywhere in the app, always. |

---

## 3. Core Behavioural Rules

| Rule | Name | When It Applies |
|---|---|---|
| 1 | Question vs Action | When Russ asks a question: answer + options only. Never take action without explicit request. |
| 2 | Minimal Sufficient Changes | Fix at the owning boundary. Don't preserve drift to stay narrow. |
| 3 | SLC over MVP | Every feature ships complete on first merge. Loading states, error states, mobile layout included. |
| 4 | Fix The Root | Don't defer corrections. Extend existing owners. Remove obsolete fallbacks. |
| 5 | Upload live files | Always ask for or confirm the live file before editing. Never work from stale snapshots. |

---

## 4. MUST / NEVER Rules

### MUST

| ID | Rule |
|---|---|
| M-001 | TypeScript strict mode everywhere. No `any`. No implicit returns on async functions. |
| M-002 | All design tokens (colour, font, spacing, radius) live in `globals.css` as CSS custom properties. |
| M-003 | Session type → colour/label/zone mapping lives exclusively in `session-types.ts`. |
| M-004 | Every new feature tagged `[FREE]` or `[PAID]` in `docs/canonical/feature-registry.md` before build begins. |
| M-005 | Supabase fetch uses `cache: 'no-store'` for plan data. |
| M-006 | Single light theme only (ADR-008). `applyTheme()` is a no-op; do not set `data-theme` attribute. No `setProperty()` calls for theme switching. |
| M-007 | Global overrides fetch lives in `DashboardClient`. All child screens receive overrides as props. |
| M-008 | Strava OAuth token exchange via Hoppscotch (POST to `https://www.strava.com/oauth/token`, `application/x-www-form-urlencoded`). Auth codes expire in ~5 min and are single-use. |
| M-009 | All Supabase schema changes via migration files. Never manual edits to production tables. |
| M-010 | agent-browser smoke test written for every new screen before release is closed. |
| M-011 | `docs/contracts/` updated whenever an API route, component prop interface, or Supabase table contract changes. |
| M-012 | Mobile layout verified (375px viewport) before any release is marked done. |
| M-013 | All coaching numerics, business-rule thresholds, and tuning knobs live in named configuration (`lib/plan/generationConfig.ts` for plan generation; `lib/coaching/constants.ts` for coaching scoring; `lib/brand.ts` for pricing; `lib/plan/featureGates.ts` for tier gating). Every value has a corresponding entry in `docs/canonical/CoachingPrinciples.md` (or the relevant canonical doc) explaining the principle behind it. ADR-009 establishes this for plan generation; the rule applies repo-wide. |

### NEVER

| ID | Rule |
|---|---|
| N-001 | Never hardcode hex colours, font names, or spacing values in components. Use CSS custom properties only. |
| N-002 | Never use old palette values: Ember orange `#D4501A`, warm beige `#f5f2ee`, DM Mono, DM Sans. |
| N-003 | Never use red anywhere in the Zona UI. |
| N-004 | Never use popups or modals. All interactions navigate to full screens with back arrow top-left. |
| N-005 | Never build the next release before the current one is shipped and build-checked. |
| N-006 | Never store Strava client secret in code or environment files committed to git. Use Supabase `user_settings`. |
| N-007 | Never use `[...set]` spread on `Set<string>` in TypeScript. Use `Array.from(set)`. |
| N-008 | Never make `setProperty()` calls for theme colour switching. `applyTheme()` owns this via `data-theme` attribute. |
| N-009 | Never implement free-tier features that expose paid-tier data, even partially. |
| N-010 | Never work from a stale file snapshot. Always confirm live file state before editing. |
| N-011 | Never create a second session colour/label/zone resolver. `session-types.ts` is the sole owner. |
| N-012 | Never skip the agent-browser journey test before closing a release. |
| N-013 | Never inline a coaching numeric, threshold, ratio, or tuning constant in `lib/plan/*` or `lib/coaching/*`. Promote to the appropriate config module (`generationConfig.ts`, `constants.ts`, `featureGates.ts`) with a named principle in `CoachingPrinciples.md`. Algorithm-formula constants (Daniels VDOT coefficients, Tanaka MaxHR formula) and structural constants (`7` for days/week, JS array indices) are exempt — they are not coaching choices. When in doubt: if a coach could reasonably want to tune it, it goes in config. |
| N-014 | Never gate a scheduled/cron-driven send (email, push, digest) on **exact-time equality** — `day === 11`, `hour === 6`, `dayOfWeek === 1`. Cron schedules (GitHub Actions, Vercel Cron) are best-effort: a run delayed past or dropped on the single matching tick loses that send **forever**. Use a **lower-bounded, stamp-guarded window**: a `>=` bound + an idempotency stamp that makes catch-up on the next run safe and single (`day >= 11 && day < 14 && !nudge_sent_at`). Disjoint windows for successive sends (nudge vs expiry). This class has recurred twice — daily push (`hour === 6`) and trial email (`day === 11 / === 14`, EMAIL-CRON-01) — hence the rule. Derive window bounds from the single-source constant they belong to (e.g. `TRIAL_DAYS`), never a re-typed literal. |
| N-015 | Never `void` (fire-and-forget) a write to a system-of-record table (`plans`, `session_completions`, `strava_activities`, `subscriptions`, …) without a `.catch` that at least logs — an unhandled rejection is an invisible data-loss. A critical write path additionally needs an **observational backstop**: capture the failure at the site (`recordOpsEvent` on the server), OR a probe that detects the resulting broken STATE by inspecting data (OPS-01's daily integrity probe compares an `auto_applied` adjustment's `created_at` to `plans.updated_at`). The 2026-06-26 reshape incident was invisible for nine days precisely because a silent save failure had neither. Prefer a **timestamp/state relationship** over content deep-equal for integrity probes — enrichment mutates content and would false-positive, training you to ignore the alert. |

---

## 5. Design System Invariants

| ID | Name | Guarantee |
|---|---|---|
| INV-DS-001 | Token Singularity | Every colour, font, and spacing value has exactly one declaration in `globals.css`. |
| INV-DS-002 | No Old Palette | Ember orange, warm beige, System B (navy/teal/amber), DM Mono, DM Sans, Space Grotesk do not exist anywhere in any live surface. |
| INV-DS-003 | Single Light Theme (ADR-008) | No dark mode. `data-theme` attribute is not set. `applyTheme()` is a no-op. `[data-theme="dark"]` does not exist in `globals.css`. |
| INV-DS-004 | Session Colour Consistency | A session type always resolves to exactly one colour across collapsed card, expanded card, calendar, and plan chart. |
| INV-DS-005 | No Red in Training UI | Red does not appear in training UI — use `--warn` (`#B8853A`) for coaching warnings. `--danger` (`#B84545`) is reserved for errors / destructive actions only. |

---

## 5b. Configuration Singularity Invariants

| ID | Name | Guarantee |
|---|---|---|
| INV-CFG-001 | Coaching Config Singularity | Every coaching numeric (intensity ratios, phase fractions, taper depths, recovery cadences, injury caps, fitness thresholds, distance/time minimums, rounding precision, all percentages governing what the engine prescribes) lives in exactly one named place: `lib/plan/generationConfig.ts → GENERATION_CONFIG`. Sibling files for adjacent concerns: `lib/plan/sessionFormat.ts` (warm-up/main/cool-down structure), `lib/plan/planSignatures.ts` (per-distance shape), `lib/plan/featureGates.ts` (Option A categories), `lib/coaching/constants.ts` (post-session scoring + load thresholds — re-exports from `GENERATION_CONFIG` where overlapping). |
| INV-CFG-002 | Principle Backstop | Every entry in `GENERATION_CONFIG` has a corresponding section in `docs/canonical/CoachingPrinciples.md` explaining the principle behind the value. A numeric without a principle is a defect — either the numeric should be removed, the principle should be added, or both. |
| INV-CFG-003 | No Inline Coaching Numerics | Code in `lib/plan/*` and `lib/coaching/*` reads from config. No coaching numeric appears as a literal in business-logic code paths. **Algorithm-formula constants** (Daniels VDOT coefficients in `buildPaceFromVDOT`, Tanaka MaxHR `208 − 0.7 × age`) and **structural constants** (`7` for days/week, array indices) are exempt — they are not coaching choices, they are mathematical / structural facts. |
| INV-CFG-004 | Tunability Test | When in doubt about whether a numeric is "coaching" or "structural": ask if a coach could reasonably want to tune it. If yes → config. If it's a fact (days/week, π, JS-language constraint) → inline. |
| INV-CFG-005 | Brand & Pricing Singularity | Brand strings (taglines, app name) and pricing values (£, billing frequency, trial length) live in `lib/brand.ts → BRAND` and `lib/brand.ts → PRICING`. Never hardcoded in components, copy, or routes. |

---

## 5c. Display Formatting, Preference & Temporal Invariants

**Authority**: ADR-015 (display formatting & preference singularity), ADR-016 (date-aware plan resolution). Added 2026-08-10 after a daily push read "Easy 79m today" — ambiguous units — for a plan that had not started yet. Three singularity failures in one push: formatting re-implemented 5+ ways, unit/metric preference ignored server-side, and "today's session" derived by weekday from a saturating week index.

| ID | Name | Guarantee |
|---|---|---|
| INV-FMT-001 | Metric Format Singularity | Every user-visible time, distance, and metric string is produced by `lib/format.ts` (`formatDuration`, `formatDistance`, `formatSessionMetric`). No component, route, prompt, or cron re-implements duration/distance formatting inline. Pace (`m:ss/km`) and race-clock (`h:mm:ss`) are separate, single-owner formatters — genuinely different domains (D-17), not duplicated. |
| INV-FMT-002 | Duration Rule Defined Once | The "≥60 min → hours" rule lives only in `formatDuration`: `< 60` → `"45 min"`; whole hour → `"2h"`; otherwise `"1h 18"` (minutes zero-padded, no unit suffix). **Never a bare `m` glyph** (`"78m"`) — that minutes/miles/metres ambiguity is the defect this retired. |
| INV-PREF-001 | Preference Singularity | Unit (`preferred_units`) and metric (`preferred_metric`) preference has one source: `user_settings`. Client lifts it in `DashboardClient` and passes as props (M-007); server paths fetch it via `getUserDisplayPrefs` (`lib/userPrefs.ts`). **No hardcoded `'km'`/`'mi'`** anywhere. No send path formats a distance/duration without the fetched preference. Per-session overrides live in `session_metric_overrides` (DB, cross-device), not localStorage. |
| INV-TIME-001 | Date-Aware Send-Gating | No user-facing session may be derived by day-of-week alone. "Is there a real session on calendar date D?" resolves through `getSessionForDate()` (`lib/plan.ts`), which returns `null` before-start / after-end / gap / empty-day. **No scheduled send (push, email, digest) fires without an active plan AND a real session for the target date.** A `null` result means "do not send / show empty state" — never fall back to `weeks[0]`. Temporal position uses date-window predicates, never `getCurrentWeekIndex()` comparisons (§73). |

**Pre-ship checklist (verify ALL before closing any release that touches display, preference, or scheduled sends):**

1. Any new duration/distance/metric string routes through `lib/format.ts` — no inline formatting, no bare `78m`.
2. Any surface that renders distance/duration receives `units`/`metric` (client: prop from `DashboardClient`; server: `getUserDisplayPrefs`). Grep the diff for hardcoded `'km'`/`'mi'`.
3. Any new scheduled send or "today's session" derivation gates on `getSessionForDate(...) !== null` and does not trust `getCurrentWeekIndex()` for before/after-plan reasoning.
4. Toggling units or metric (global or per-session) is verified to propagate to every affected surface — cards, plan, session detail, notifications — via agent-browser (M-010).

**Warm Slate palette (ADR-007):**

| Token | Value | Role |
|---|---|---|
| `--bg` | `#F3F0EB` | Primary background — warm off-white |
| `--bg-soft` | `#EDE9E1` | Input fields, inset areas |
| `--card` | `#FFFFFF` | Card surfaces |
| `--ink` | `#1A1A1A` | Primary text |
| `--ink-2` | `#3D3A36` | Secondary text |
| `--mute` | `#8A857D` | Muted / supporting text |
| `--moss` | `#6B8E6B` | Primary accent — CTA, active, completion |
| `--warn` | `#B8853A` | Coaching warnings only |
| `--danger` | `#B84545` | Errors only — never in training UI |
| `--line` | `rgba(26,26,26,0.08)` | Standard borders |

**Session type colours (Warm Slate values):**

| Session Type | Token | Hex |
|---|---|---|
| Easy | `--s-easy` | `#3D6FB0` |
| Long | `--s-long` | `#5E4FB0` |
| Quality / Tempo | `--s-quality` | `#B8853A` |
| Intervals | `--s-inter` | `#B84545` |
| Race | `--s-race` | `#C86A2A` |
| Recovery | `--s-recov` | `#4E8068` |
| Strength | `--s-strength` | `#5A6578` |
| Cross-train | `--s-cross` | `#3D8A88` |
| Rest | (no accent) | — |

**Fonts:** Inter only. `var(--font-ui)` and `var(--font-brand)` both resolve to Inter. Space Grotesk retired (ADR-007).

---

## 6. Plan Schema Invariants

| ID | Guarantee |
|---|---|
| INV-PLAN-001 | Plan JSON is the single source of truth for session definitions. Supabase stores overrides and completions only. |
| INV-PLAN-002 | Plan JSON fetched from GitHub Gist with `cache: 'no-store'` on every request. |
| INV-PLAN-003 | `SessionEntry` interface is the canonical TypeScript shape for plan sessions. Any Gist field addition requires interface update + migration of downstream consumers. |
| INV-PLAN-004 | Plan output = JSON first, never direct-to-DB. Plan creation (R23) and reshaping (R20) share the same schema and rules. |
| INV-PLAN-005 | `primary_metric` flag determines whether distance or duration is the primary display value for a session. Both fields exist in schema. |
| INV-PLAN-006 | Strength session stubs exist in the plan generator output from R21 onwards. Stub sessions do not carry HR targets or zone assignments. |

---

## 7. Supabase / Data Invariants

| ID | Guarantee |
|---|---|
| INV-DB-001 | All schema changes via migration files. No manual production table edits. |
| INV-DB-002 | `user_settings` is the canonical store for: Strava client secret, zone method, profile fields (first name, last name, email). |
| INV-DB-003 | `session_completions` stores completion events only. Session definitions live in Gist JSON. |
| INV-DB-004 | `session_overrides` stores per-session user overrides. Global overrides are fetched at `DashboardClient` level and passed as props. |
| INV-DB-005 | RLS policies must be verified after every migration before marking migration complete. |
| INV-DB-006 | Strava client secret never stored in env files committed to git. Lives in `user_settings.strava_client_secret`. |

---

## 8. Feature Gate Invariants

| ID | Guarantee |
|---|---|
| INV-GATE-001 | Every feature has a `[FREE]` or `[PAID]` tag in `docs/canonical/feature-registry.md` before implementation. |
| INV-GATE-002 | Free tier: generic plans (5k/10k/HM, 8 and 12-week variants), no Strava, no dynamic coaching. |
| INV-GATE-003 | Paid tier: dynamic plan building, Strava integration, AI coaching, plan reshaping, all intelligent features. |
| INV-GATE-004 | Free/paid gates enforced in both API routes and components. Component-only gates are insufficient. |
| INV-GATE-005 | Free tier UI must not expose the existence of paid-tier data, even in a disabled/locked state, without explicit product decision. |

---

## 9. UI / Screen Invariants

| ID | Guarantee |
|---|---|
| INV-UI-001 | One job per screen. Screens do not multiplex unrelated concerns. |
| INV-UI-002 | No popups or modals. Every interaction navigates to a full screen. Back arrow top-left always. |
| INV-UI-003 | Back navigation is always top-left. No exceptions. |
| INV-UI-004 | Empty, loading, and error states are first-class UI states, not afterthoughts. |
| INV-UI-005 | Session card hierarchy: TOP (run type, zone, HR target, pace bracket, distance + duration) → MIDDLE (session description) → BOTTOM (why / coach notes). |
| INV-UI-006 | Global dist/duration toggle lives in Me screen. Per-session toggle lives in expanded card only and saves per session. |
| INV-UI-007 | Mobile layout (375px) verified before every release closes. |
| INV-UI-008 | Calm guidance, not alerts. Zona tone: honest, slightly sarcastic, encouraging without cringe. Never urgent. Never red. |

---

## 10. agent-browser UI Testing

### Setup

Install the **agent-browser** plugin from the Claude Code marketplace (`/marketplace` in Claude Code, search "agent-browser").

Add to `CLAUDE.md`:

```
## UI Testing
Use agent-browser for all UI smoke tests and journey tests.
agent-browser launches a headless Chromium session and can interact with the running Vercel preview or localhost:3000.
Always run journey tests before marking a release done.
```

### Journey Test Targets (run before every release)

| Journey | Entry | Assertions |
|---|---|---|
| Auth flow | `/login` | User can sign in, lands on dashboard |
| Dashboard load | `/` | Plan weeks render, no console errors, correct colours |
| Session expand | Tap session card | Expanded card shows correct hierarchy (type → zone → HR → description → why) |
| Session complete | Tap complete | Completion saved to Supabase, card state updates |
| Theme toggle | Me screen | `data-theme="dark"` toggled on `<html>`, colours switch correctly |
| Dist/duration toggle | Me screen | Toggle saves to user_settings, session cards update |
| Strava connect | Me screen | OAuth redirect initiates correctly |

### agent-browser Rules

- agent-browser tests run against `localhost:3000` (dev) or the Vercel preview URL.
- Always specify viewport: 375px (mobile) and 1280px (desktop).
- Tests must assert visible UI state, not just route reachability.
- If a journey test fails, the release does not close.

---

## 11. Documentation Governance

### Canonical Truth Folder Structure

```
docs/
├── contracts/                    ← API route contracts, component prop contracts
│   ├── api/
│   │   ├── plan-fetch.md         ← Gist fetch contract
│   │   ├── session-completions.md
│   │   ├── session-overrides.md
│   │   ├── strava-oauth.md
│   │   └── user-settings.md
│   └── components/
│       ├── session-card.md       ← Prop interface, rendering contract
│       ├── plan-calendar.md
│       └── dashboard-client.md
├── canonical/                    ← Single source of truth for domain rules
│   ├── feature-registry.md       ← Every feature with FREE/PAID tag
│   ├── session-types.md          ← Canonical session type list, colours, zones
│   ├── zone-rules.md             ← Zone calculation methods, HR targets
│   ├── plan-schema.md            ← SessionEntry interface, Gist JSON shape
│   ├── coaching-rules.md         ← Plan generation rules, tone of voice
│   └── adaptation-rules.md       ← Dynamic reshaping rules (R20)
├── architecture/                 ← Architectural decision records (ADRs)
│   ├── ADR-001-design-tokens.md
│   ├── ADR-002-plan-json-first.md
│   ├── ADR-003-free-paid-gates.md
│   └── ADR-004-theme-system.md
└── releases/                     ← Release notes and backlog
    ├── backlog.md
    └── ...
```

### Documentation Rules

| ID | Rule |
|---|---|
| GOV-001 | `docs/contracts/` is updated in the same commit as any API route or component prop interface change. |
| GOV-002 | `docs/canonical/feature-registry.md` is updated before any new feature implementation begins. |
| GOV-003 | `docs/canonical/session-types.md` is the reference if `session-types.ts` and any other source disagree. |
| GOV-004 | ADRs are written when a significant architectural decision is made (new pattern, major refactor, system-wide rule). |
| GOV-005 | Release notes in `docs/releases/` record what shipped, what was deferred, and any known drift introduced. |
| GOV-006 | Contracts are written before implementation, not after. "We'll document it later" is a drift defect. |

---

## 12. Quick Decision Framework

Before implementing anything, verify ALL of these:

1. **Is there a contract for this surface?** (`docs/contracts/`) — if not, write it first.
2. **Is every dependency traced?** (Supabase table, API route, component, type)
3. **Is it tagged FREE or PAID?** (`docs/canonical/feature-registry.md`)
4. **Does it use only design tokens from globals.css?** (No hardcoded hex)
5. **Is there one owner for this concern?** (No duplicate resolvers)
6. **Does it fail visibly on error?** (Structured UI error state, not console-only)
7. **Is the mobile layout considered?** (375px viewport)
8. **Does it follow the screen/navigation contract?** (Full screens, back arrow top-left, no popups)
9. **Does it match Zona tone?** (Honest, calm, slightly sarcastic — never urgent, never red)
10. **Is the dark/light theme handled correctly?** (`data-theme` on `<html>` only)
11. **Will there be a journey test for it?** (agent-browser, before release closes)
12. **Is the contract doc updated?** (`docs/contracts/` in same commit)

---

## 13. Authority Chain

```
CLAUDE.md (root doctrine, MUST/NEVER)
├── docs/canonical/feature-registry.md   ← Free/paid tagging authority
├── docs/canonical/session-types.md      ← Session type canonical truth
├── docs/canonical/plan-schema.md        ← SessionEntry interface authority
├── docs/canonical/zone-rules.md         ← Zone calculation authority
├── docs/canonical/coaching-rules.md     ← Plan generation rules authority
├── docs/canonical/adaptation-rules.md   ← Reshaping rules authority
├── docs/contracts/api/                  ← API route contracts
├── docs/contracts/components/           ← Component prop contracts
├── docs/architecture/ADR-*.md           ← Architectural decisions
└── globals.css                          ← Design token authority
```

---

## 14. Common Drift Scenarios

### 14.1 Palette Drift

**Scenario**: A component uses a hardcoded hex value instead of a CSS custom property.
**Why it matters**: System B palette cannot be enforced or updated centrally.
**Trigger rules**: `D-08`, `D-11`, `INV-DS-001`, `N-001`

### 14.2 Old Palette Survival

**Scenario**: Ember orange, warm beige, DM Mono, or DM Sans found anywhere in live surfaces.
**Why it matters**: Old palette is fully retired. Its presence is a defect.
**Trigger rules**: `D-09`, `D-18`, `INV-DS-002`, `N-002`

### 14.3 Session Type Resolver Duplication

**Scenario**: A component resolves session colour or label independently instead of calling `session-types.ts`.
**Why it matters**: Two resolvers drift. Session rendering becomes inconsistent.
**Trigger rules**: `D-08`, `D-16`, `INV-DS-004`, `N-011`

### 14.4 Theme Leakage

**Scenario**: `setProperty()` calls used for theme colour switching, or `data-theme` toggled on a container instead of `<html>`.
**Why it matters**: Breaks cascade. Some surfaces show wrong colours.
**Trigger rules**: `INV-DS-003`, `N-008`

### 14.5 Unlifted Override Fetch

**Scenario**: A child screen fetches `session_overrides` independently instead of receiving them as props from `DashboardClient`.
**Why it matters**: Flash of incorrect state. Inconsistency between screens.
**Trigger rules**: `D-08`, `M-007`

### 14.6 Untagged Feature

**Scenario**: A feature ships without a free/paid tag in `docs/canonical/feature-registry.md`.
**Why it matters**: Gate enforcement is impossible without the tag.
**Trigger rules**: `D-20`, `INV-GATE-001`, `M-004`

### 14.7 Stale File Snapshot

**Scenario**: Claude edits a component based on a cached version rather than the uploaded live file.
**Why it matters**: Real drift between what Claude produces and what is actually in the codebase.
**Trigger rules**: Rule 5 (upload live files), `N-010`

### 14.8 Contract-Free Implementation

**Scenario**: A new API route or component ships without a corresponding contract in `docs/contracts/`.
**Why it matters**: Future developers (and Claude) cannot verify correctness against a specification.
**Trigger rules**: `GOV-001`, `GOV-006`

---

## 15. Reasoning Prompts

Use these before making architectural decisions:

1. What is the single owner of this concern?
2. Is there already another path implementing the same semantic responsibility?
3. Does this component use only CSS custom properties from globals.css?
4. Is this feature tagged FREE or PAID in the feature registry?
5. If this fails, will the failure be visible in the UI without log inspection?
6. Am I working from the live file or a stale snapshot?
7. Is there a contract doc for this surface? If not, should I write it first?
8. Does this navigation follow the full-screen / back-arrow-top-left contract?
9. Does this copy match the Zona tone (calm, honest, slightly sarcastic)?
10. Would a hard cut on this leave the old value alive in any other surface?
11. If I add this feature, does it need a journey test in agent-browser?
12. Does this change require updating `docs/canonical/` or `docs/contracts/`?

---

## 16. Cross-Skill / Cross-Doc References

| Doc | When to Use |
|---|---|
| `docs/canonical/session-types.md` | Session colour, label, zone, HR target resolution |
| `docs/canonical/feature-registry.md` | Free/paid tagging before any build |
| `docs/canonical/plan-schema.md` | SessionEntry interface, Gist JSON structure |
| `docs/canonical/zone-rules.md` | Zone calculation, HR ceiling, pace bracket derivation |
| `docs/canonical/coaching-rules.md` | Plan generation rules, phase structure, progression |
| `docs/canonical/adaptation-rules.md` | Dynamic reshaping rules (R20) |
| `docs/contracts/api/` | API route shape, request/response contracts |
| `docs/contracts/components/` | Component prop interfaces |
| `globals.css` | All design tokens — always the authority |
| `session-types.ts` | Runtime resolver — must match `docs/canonical/session-types.md` |
| `docs/architecture/ADR-011-data-source-doctrine.md` | SOR by data type, source priority, conflict resolution, expected experience by configuration |

---

## 17. Data Source Invariants

**Authority**: ADR-011 (Data Source Doctrine, amended 2026-06-24). Read that ADR before touching any data ingest, HealthKit, Strava, or coaching query code.

**Core position (amended 2026-06-24)**: HealthKit is the System of Record for all run-derived data on iOS. Strava is an optional supplement — only when connected, only as a patch onto an existing HealthKit row. Strava never inserts a primary record. If no matching HK row exists, the Strava activity is discarded.

| ID | Invariant |
|---|---|
| INV-DATA-001 | No paid feature may require a specific external data provider. Features degrade gracefully when data is absent; degradation is source-neutral. |
| INV-DATA-002 | The `strava_activities` table is the source-agnostic activity log (v1 misnomer — treat as "the run log"). All coaching queries read from it without source filtering unless source-specific behaviour is explicitly justified and documented. A query that adds `WHERE source = 'strava'` without explicit justification is a defect. |
| INV-DATA-003 | Every HealthKit permission requested in `requestHealthKitAuth()` (`lib/health/clientSync.ts`) must have a corresponding active query. Unused permissions are wasted consent friction and must be removed. (Historical: DS-01 removed the unqueried `distance` permission and DS-02 added `calories`, both shipped 2026-05-30 — the invariant now holds.) |
| INV-DATA-004 | iOS onboarding and empty states must offer HealthKit as the primary data source CTA. Strava is offered as a secondary supplement option only, never the default. Copy must never say "connect Strava" as the only or first option on iOS. |
| INV-DATA-005 | When a coaching metric is absent (null), the UI must render a one-line explanation of why — not a blank, muted placeholder, or silent omission. Example: zone discipline null → "No HR data yet — sync a run to unlock." |
| INV-DATA-006 | Conflict resolution when the same run arrives from multiple sources follows ADR-011 §4. `lib/coaching/healthkitConsolidate.ts` is the single owner of dedup, merge, and discard logic. No caller implements its own conflict resolution. |
| INV-DATA-007 | The SOR for each data type is the table in ADR-011 §3. No code may treat a different source as authoritative without updating that table and ADR-011. |
| INV-DATA-008 | **HealthKit is the SOR for all run-derived data on iOS.** Strava data may only enter the system as a supplement that patches an existing HealthKit row via `lib/coaching/healthkitConsolidate.ts → tryEnrichHealthKitRow`. If no matching HealthKit row exists, the Strava activity is **discarded** — never stored as a primary record. Direct writes to `strava_activities` outside of three sanctioned paths are doctrine violations: `/api/health/ingest` (insert), `lib/coaching/healthkitConsolidate.ts` (Strava→HK patch), and `/api/recalibrate-hr` (HR-zone re-bucket — a patch-only `.update()` on existing rows that never inserts). New ingest paths must extend these helpers, not bypass them. *(recalibrate-hr registered 2026-08-06, GEN-FIX-11 — it always patched existing rows; the doctrine list just hadn't named it.)* |

### Data Source Quick Reference (SOR Summary, amended 2026-06-24)

| Data Type | System of Record | Primary Source | Strava Role |
|---|---|---|---|
| Run sessions (distance, pace, duration) | Activity log (`strava_activities`) | HealthKit | Supplement only (patches existing HK row; never inserts) |
| HR stream / HR-in-zone % | Activity log → `run_analysis` | HealthKit HR samples | None — Strava does not push HR into HealthKit |
| Average HR per run | Activity log | HealthKit avg of samples | None |
| Aerobic efficiency (EF) | `run_analysis` (computed) | Pace + HR from HK | Degrades to 75 neutral when HR absent |
| Splits per km | Activity log | Absent (HK doesn't expose) | Supplement (`splits_metric` patched on existing HK row only) |
| Temperature | Activity log | Absent (HK doesn't expose) | Supplement (`avg_temp_c` patched on existing HK row only) |
| Elevation gain | Activity log | HealthKit metadata | Supplement (patched on existing HK row only) |
| Resting HR baseline | `health_daily_samples` | HealthKit only | None |
| HRV baseline | `health_daily_samples` | HealthKit only | None |
| Sleep duration / stages | `health_daily_samples` | HealthKit only | None |
| Active energy per run | Activity log | HealthKit `totalEnergyBurned` | None |
| RPE | `session_completions` | User input only — never overridden by device data | None |
| Fatigue tag | `session_completions` | User input only — never overridden by device data | None |
| Plan session definitions | GitHub Gist JSON | Single source, `cache: 'no-store'` | None |
| HR zones | `user_settings` (computed) | User input → Karvonen → %MaxHR → Tanaka estimate | None |

### HealthKit Plugin Capability Boundaries

The `@capgo/capacitor-health` plugin (v8.4.8) **does not support**: GPS routes, running cadence, stride length, ground contact time, running power, VO2max, menstrual/cycle/reproductive-health data. These require a custom Swift bridge or plugin fork. Do not promise or build features that depend on these without first verifying the bridge exists.

### Expected Experience by Configuration (amended 2026-06-24)

Under HK-SOR, the deciding question is **"does HealthKit have HR samples for the run window?"** — not "is Strava connected?".

| User Setup | Run Analysis | Zone Discipline | Recovery Signal | Adjustment Triggers |
|---|---|---|---|---|
| iOS + Apple Watch (worn during run) | ✅ Full | ✅ Full | ✅ Full | ✅ All |
| iOS + Apple Watch + Strava | ✅ Full + splits + temp | ✅ Full | ✅ Full | ✅ All |
| iOS + HR chest strap (writes to HK) | ✅ Full | ✅ Full | ⚠️ What the device writes | ✅ All |
| iOS + no HR device (Strava-on-phone only) | ⚠️ Workout shell only — **no HR** | ❌ Absent | ⚠️ Passive HR if any | ⚠️ Load + fatigue |
| iOS + no HR device + Strava | ⚠️ Shell + splits + temp — **still no HR** | ❌ Absent | ⚠️ Passive HR if any | ⚠️ Load + fatigue |
| iOS + no HealthKit connection | ⚠️ Manual only | ❌ Absent | ❌ Absent | ⚠️ Fatigue only |
| Web/Android | **Out of scope for v1** | — | — | — |

**Hard consequence**: iPhone-only runners (no Apple Watch, no chest strap) get no HR-based coaching even with Strava connected. Strava's Apple Health write does not include the HR stream. Apple controls what Strava writes; we don't reach back to Strava's API to compensate. This is a doctrine-driven trade.

Every ⚠️ or ❌ cell must have a corresponding UI state with a one-line explanation and a specific action the user can take. Never a generic "connect Strava" prompt — connecting Strava does not solve the no-HR case.
