# Feature Registry — Zona

**Authority**: Every feature must be tagged FREE or PAID here before implementation begins. Untagged features are build blockers. See `docs/canonical/` for domain rules and `docs/releases/backlog.md` for status and ordering.

---

## Shipped Features

| Feature | Tier | Release | Notes |
|---|---|---|---|
| Core app shell (3 screens, nav) | FREE | R0–R15b | Today, Plan, Me screens. Coach tab built but disabled for v1 launch — admin-only until post-launch. |
| Screen guide popups | FREE | R15b | First-load onboarding |
| Progress bar | PAID | R17 | Session completion % |
| RPE input post-session | PAID | R17 + reflect UX | Stored in `session_completions`. Post-log reflect view (2026-04-19): dedicated step after Strava log or manual log — replaces instant-dismiss toast. Zona voice responds to RPE, session-type-aware. |
| Fatigue tags | PAID | R17 | Canonical vocabulary: `Fresh / Fine / Heavy / Wrecked`. Shown in reflect view and on collapsed card badge. Skip reason also stored in `fatigue_tag`. |
| Session Card Redesign | PAID | 2026-04-20 | New card hierarchy; compact metric strip; zone chip; per-session toggle (expanded only). |
| Coaching Signal | PAID | 2026-04-20 | `coaching_flag` per session (`ok`/`watch`/`flag`); `avg_hr` from Strava; execution summary in expanded card; flag badge on collapsed card. DB migration deployed. R18-ready. |
| Plan Generator (API route + form) | FREE (templates) / PAID (AI) | R23 | FREE = pre-built templates; PAID = AI generator with athlete variables |
| Profile screen | FREE | R15b | First name, last name, email on `user_settings` |
| Smoke tracker | FREE | R15b | Days since quit, displayed on dashboard |
| Theme toggle (light/dark) | FREE | R0 | `data-theme` on `<html>` only |
| Dist/duration toggle (global) | FREE | Session Card Redesign | Lives in Me screen |
| Dist/duration toggle (per-session) | PAID | Session Card Redesign | Expanded card only; saves per session |
| Strava integration | PAID | — | OAuth, run sync, aerobic pace derivation |

---

---

## Ordered Backlog

| Feature | Tier | Release | Notes |
|---|---|---|---|
| Plan Confidence Score | PAID | R18 | Derived from completion + RPE data |
| Coaching Tips in Supabase | PAID | R19 | Move hardcoded copy to DB; dynamic per user |
| Dynamic Plan Reshaping | PAID | R20 | Separate from creation; shared schema with R23 |
| Strength Sessions | FREE (stubs) / PAID (dynamic) | R21 | Generator stubs exist; cards render with no content. **Admin-only for v1 launch** — filtered from public plan view until R21 ships full content. |
| Blockout Days | PAID | R22 | User marks unavailable days; plan reshapes |
| Plan Generator Wizard UI | PAID | R23b | Multi-step wizard; replaces current form |
| Multi-Race Support | PAID | R24 | A/B race hierarchy |

---

## Scoped But Unscheduled

| Feature | Tier | Notes |
|---|---|---|
| Estimated race times | PAID | 5K/10K/HM/Marathon — data-driven |
| Zone method selector | PAID | User chooses HR zone calculation method; stored in Supabase |

---

## Parking Lot (Deprioritised)

| Feature | Tier | Notes |
|---|---|---|
| Session swap | PAID | Manual session reordering |
| AM/PM scheduling | PAID | Time-of-day session placement |

---

## Tier Definitions

| Tier | Includes |
|---|---|
| FREE | Generic pre-built plan templates (5K/10K/HM, 8 & 12-week variants), core session display, theme, basic profile. No AI, no Strava, no dynamic coaching. |
| PAID | Dynamic plan generation, Strava integration, AI coaching, plan reshaping, confidence scoring, all personalised or intelligent features. |

**Rule**: FREE tier must not expose paid-tier data or imply its existence without an explicit product decision.
