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

## Tech Debt

| Item | Detail |
|------|--------|
| Strava token refresh | Cache and refresh Strava OAuth token — currently single-use |
| `PlanChart.tsx` hardcoded values | Likely still has hardcoded hex/font strings — not yet audited |
| `StravaPanel.tsx` hardcoded values | Likely still has hardcoded hex/font strings — not yet audited |
| `login/page.tsx` hardcoded values | Not yet audited |
| `PlanCalendar` `any` props (partial) | `stravaRuns` prop is accepted but unused in WeekCard — remove or wire up |
