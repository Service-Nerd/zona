# Backlog — ZONA

## Status Key
- ✅ Shipped
- 🔄 In Progress
- 🔲 Not Started

---

## Releases Shipped

| Release | Summary                                                         |
|---------|-----------------------------------------------------------------|
| R0–R15b | All complete. R15b = screen guide popups, localStorage, 4 screens |
| R17 | RPE + Fatigue Tags, Progress bar |
| R23 | Plan Generator — API route, multi-step form UI, schema, new user flow |

## Architecture Hygiene (shipped 2026-04-17)

| Finding | Fix |
|---------|-----|
| H-001 | `layout.tsx` — removed all `setProperty()` calls; `data-theme` toggle only |
| H-003 | Created `lib/session-types.ts` as canonical session colour/label resolver; removed duplicate local maps from `DashboardClient` and `PlanCalendar` |
| M-001 | `PlanCalendar.tsx` — all hardcoded hex/rgba/font strings replaced with CSS custom properties |
| M-002 | `PlanCalendar.tsx` — all `any` types replaced with `StravaActivity[]`, `Completion`, `EffectiveSession`, `SessionTapPayload` |
| L-001 | `SessionType` union extended from 6 to 12 types in `types/plan.ts` |
| L-002 | `tailwind.config.ts` — old-palette colours and banned fonts (Bebas Neue, DM Mono, DM Sans) removed |
| Docs | `/docs` restructured into `canonical/`, `contracts/`, `architecture/`, `releases/`. ADRs 001–004 written. API and component contracts written from live code. `CLAUDE.md` updated. |
| Tooling | Pre-commit git hook added — blocks `setProperty()`, hardcoded hex, banned fonts, ember orange/warm beige at commit time |

---

## Active Work

### Session Card Redesign
**Status:** 🔄 In Progress

Required card hierarchy:
1. TOP: Run type · Zone · HR target(s) · Estimated pace bracket · Distance + duration
2. MIDDLE: Session description
3. BOTTOM: Why / coach notes

- Global dist/duration toggle → Me screen
- Per-session toggle → expanded card only; saves per session; updates collapsed card

---

## Ordered Backlog

### R17 — RPE + Fatigue Tags
**Status:** ✅ Shipped | **Tier:** PAID
- Add RPE input post-session
- Add fatigue tags (legs, general, mental)
- Store in `session_completions`

### R18 — Plan Confidence Score
**Status:** 🔲 Not Started | **Tier:** PAID
- Derive confidence score from recent session completion + RPE data
- Display on dashboard

### R19 — Coaching Tips in Supabase
**Status:** 🔲 Not Started | **Tier:** PAID
- Move hardcoded coaching copy into Supabase
- Enables dynamic, user-specific coaching messages

### R20 — Dynamic Plan Reshaping
**Status:** 🔲 Not Started | **Tier:** PAID
- Reshape active plan based on fatigue, missed sessions, race proximity
- Separate flow from plan creation (R23)
- Shares schema and rules with R23

### R21 — Strength Sessions
**Status:** 🔲 Not Started | **Tier:** FREE (stubs) / PAID (dynamic)
- Flesh out strength session stubs currently in plan JSON
- Display in session cards with appropriate UI treatment

### R22 — Blockout Days
**Status:** 🔲 Not Started | **Tier:** PAID
- User marks days unavailable
- Plan reshapes around blockout days

### R23 — Plan Generator
**Status:** ✅ Shipped (R23b wizard UI still to do) | **Tier:** FREE (templates) / PAID (full AI generator)
- FREE: Pre-built templates (5K/10K/HM, 8 & 12 week variants)
- PAID: Full AI generator with user-editable athlete variables
- Output = JSON always; never direct-to-DB
- Creation and reshaping (R20) are separate flows, shared schema
- API route + multi-step form shipped; new users land on Plan screen with Generate CTA

### R23b — Plan Generator Wizard UI
**Status:** 🔲 Not Started | **Tier:** PAID
- Convert the plan generator form into a multi-step wizard interface
- One question / section per screen with progress indicator
- Improve mobile UX for longer forms

### R24 — Multi-Race Support
**Status:** 🔲 Not Started | **Tier:** PAID
- Support multiple target races per user
- Plan structure accommodates A/B race hierarchy

---

## Scoped But Not Started

| Feature | Notes |
|---------|-------|
| Estimated race times | 5K/10K/HM/Marathon — data-driven; placeholder first |
| Zone method selector | Stored in Supabase; user chooses HR zone calculation method |
| ~~Profile screen~~ | ✅ Shipped — first name, last name, email on `user_settings`; auto-populated from auth provider on first login |

---

## Parking Lot (Deprioritised)

- Session swap
- AM/PM scheduling

---

---

## UX & Product Backlog — Post-Review (2026-04-18)

Derived from a full-app UX audit. P1 items (race countdown, week narrative, fatigue trend, override labels, HR zone labels) have been shipped. P2 items shipped 2026-04-18. P3 follows.

---

### UI Consistency

| # | Status | Title | Problem it solves | Why it matters | Approach | Impact | Effort |
|---|--------|-------|-------------------|----------------|----------|--------|--------|
| UX-01 | ✅ Shipped | Unify fatigue tag vocabulary | Two sets in use: `Fresh/Normal/Heavy/Cooked` (SessionPopupInner) and `Fresh/Fine/Heavy/Wrecked` (ManualRunModal). Trend dots handle both but the labels differ. | Data inconsistency makes trend comparisons meaningless. | Standardise to `Fresh / Fine / Heavy / Wrecked` in both places. Update any existing DB rows if needed (migration). | Data integrity | S |
| UX-02 | ✅ Shipped | Me screen information architecture | Settings dump — HR zones, Strava, profile, smoke tracker all stacked with no grouping. | Cognitive load on a screen users visit frequently to manage their training config. | Group into sections: **Your Profile** / **Your Training** (HR zones, units, metric) / **Connections** (Strava) / **App Settings** (theme, smoke tracker). | Perception / polish | S |
| UX-03 | ✅ Shipped (superseded) | Post-completion micro-moment | After marking a session complete, user is returned to Today with no acknowledgement. | Completing a session is the core loop. Missing the reward moment is a retention miss. | Originally: 2s in-card flash. **Superseded 2026-04-19 by post-log reflect view** — see UX-03b. | Retention / emotional | S |
| UX-03b | ✅ Shipped 2026-04-19 | Post-log reflect view | RPE and feel data saved but invisible — no feedback loop, no sense data was heard. Users felt emotionally detached from the logging flow. | Completing a session is the emotional peak of training. The app must acknowledge it, ask how it went, and respond. | After any run is logged (Strava or manual): dedicated reflect step before close. RPE 1–10 + feel tags. ZONA voice responds inline (session-type-aware). Done CTA turns teal after response. Skip flow gets "what got in the way?" one-tap reasons. RPE badge appears on collapsed card footer. Manual log form: RPE/feel removed from entry form; collected in reflect step instead. | Retention / emotional attachment | M |

---

### Personalisation

| # | Status | Title | Problem it solves | Why it matters | Approach | Impact | Effort |
|---|--------|-------|-------------------|----------------|----------|--------|--------|
| UX-04 | ✅ Shipped | Plan-based Coach fallback (no Strava) | Coach screen is empty for non-Strava users. "Connect Strava" is a dead end for many. | Coach is the most differentiating screen. It should never be empty for a user with a plan. | Add plan-aware static coaching: "Long run Sunday — keep easy runs easy this week." Derived from current week data. Show when no Strava or no recent activity. No AI call needed. | Retention / perception | M |
| UX-05 | ✅ Shipped | Use collected fatigue to inform session framing | Fatigue tags are logged but never acted on. Heavy × 3 days = no change in how sessions are presented. | The product collects the data. Using it even superficially creates the impression of intelligence. | When last 3 fatigue tags average Heavy/Wrecked, add a contextual note to today's session card: "You've been logging heavy legs. Keep the effort honest today." Derive inline, no AI. | Personalisation / perception | M |
| UX-05b | ✅ Shipped | Fitness-level-calibrated coaching copy | Beginner and experienced runners see identical session copy. | The product knows the user's fitness level from plan generation. Using it costs nothing. | Store `fitness_level` from `plan.meta`. Vary copy in `getRestCopy` and `RestDayCard` based on level. Beginner: reassurance. Experienced: precision. | Personalisation | L |
| UX-06 | ✅ Shipped | First name in session greeting | Name is in the DB. Never used outside the Today subtitle. | Tiny, feels personal. Low effort. | Use `firstName` in `RestDayCard` body copy and Coach screen header when available. | Polish | XS |

---

### UX Flow

| # | Status | Title | Problem it solves | Why it matters | Approach | Impact | Effort |
|---|--------|-------|-------------------|----------------|----------|--------|--------|
| UX-07 | ✅ Shipped | Post-wizard orientation screen | After generating a plan and landing on Today, new users have no context — may land on a rest day with no guidance. | First-session experience sets retention. Confusion = churn. | After `handlePlanSaved`, show a single-screen orientation: "You're in Week 1 of {N}. Your first session is {day}. Here's what Zone 2 means." Dismiss-once, not re-shown. | Onboarding / retention | M |
| UX-08 | ✅ Shipped | Strava reconnect flow | If the stored Strava token is invalid, the app fails silently. Coach shows loading, then nothing. | Users who connected Strava expect it to work. Silent failure damages trust. | On token refresh failure (`/api/strava/refresh` non-200), surface a prompt in the Coach screen: "Strava connection expired — reconnect in Profile." Link to Me screen. | Reliability / perception | M |
| UX-09 | ✅ Shipped | Past session "not logged" state in Calendar | Past sessions with no completion data show at 35% opacity — no CTA, no explanation. | Leaves the user wondering whether to backfill or ignore. | Added "log" label below the dot for past unlogged sessions in CalendarOverlay — signals tapability. Tapping opens SessionPopupInner which already presents log/skip options. | Completeness | M |

---

### Polish

| # | Status | Title | Problem it solves | Why it matters | Approach | Impact | Effort |
|---|--------|-------|-------------------|----------------|----------|--------|--------|
| UX-10 | ✅ Shipped | Weekly session count on Plan screen header | Plan screen has race countdown (now shipped) but no session count for the current week. | Context coherence — Plan and Today should tell the same story. | Below the race date line on Plan screen, add "Week {N}: {done}/{total} sessions" — mirrors Today screen narrative pattern. Derive from `allCompletions[weekNum]`. | Consistency | XS |
| UX-11 | ✅ Shipped | Audit `session-types.ts` hex values | `lib/session-types.ts` uses hardcoded hex values for `SESSION_COLORS`. Pre-commit hook would catch these if they were in components, but the lib is currently exempted. | Palette regressions. Once these values drift from `globals.css`, colours break in dark mode or on theme changes. | All hex values in `SESSION_COLORS` and `getSessionColor` fallback replaced with `var(--session-*)` CSS vars. All vars already existed in `globals.css`. | Palette integrity | M |
| UX-12 | ✅ Shipped | Tech debt audit — `PlanChart.tsx`, `StravaPanel.tsx` | Both files are flagged in tech debt as unaudited for hardcoded hex/font strings. | Any hardcoded value will trigger the pre-commit hook on the next commit touching those files. | All hardcoded hex and rgba values replaced with CSS vars. Added `--strava-soft`, `--teal-20`, `--teal-30` to `globals.css`. StravaPanel inline `var(--x, #fallback)` patterns cleaned to `var(--x)`. | Technical | S |

---

## Tech Debt

| Item | Detail |
|------|--------|
| Strava token refresh | Cache and refresh Strava OAuth token — currently single-use |
| `PlanChart.tsx` hardcoded values | ✅ Audited and fixed — all hex/rgba replaced with CSS vars |
| `StravaPanel.tsx` hardcoded values | ✅ Audited and fixed — all hex/rgba replaced with CSS vars |
| `login/page.tsx` hardcoded values | Not yet audited |
| `PlanCalendar` `any` props (partial) | `stravaRuns` prop is accepted but unused in WeekCard — remove or wire up |
