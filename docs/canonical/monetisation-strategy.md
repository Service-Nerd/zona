# Monetisation Strategy — Zona

**Authority**: This document defines the monetisation model, tier definitions, and product principles governing how Zona is sold. All feature build decisions must be evaluated against the FREE/PAID split defined here. Cross-reference `docs/canonical/feature-registry.md` for the full feature list and tier assignments.

---

## Model: Hybrid Reverse Trial (Option A)

Zona uses a **Hybrid Reverse Trial** model with **Option A** downgrade semantics.

1. **Day 0 — Full access**: Every new user gets full access to all features (including PAID tier) for 14 days. No paywall, no friction, no credit card required.
2. **Day 14 — Graceful downgrade**: After 14 days the account downgrades to the free tier automatically. The user retains all their data **and the plan they built during the trial**. PAID *ongoing intelligence* features become gated.
3. **Upgrade — behaviour-triggered**: Upgrade prompts appear when the user tries to use a PAID feature, not on a timer and not at midnight on day 14.

### Why this model

- Users need to experience the product's value before they can justify paying for it.
- Asking for payment before delivering value is the most common conversion killer.
- A 14-day window gives the product a chance to earn the upgrade, not demand it.
- Behaviour-triggered prompts respect the user's intent and avoid dark patterns.
- Option A respects the brand position: free users are never abandoned. The plan they generated is theirs to keep.

### Option A — what stays, what gates, what is always free

Three categories, formalised in `lib/plan/featureGates.ts`:

#### Granted at trial, retained in free
Earned during the 14-day trial; remain available after downgrade *for the plan that was generated during the trial*.

- Personalised plan (the one generated during trial)
- VDOT pace zones
- HR Karvonen zones
- AI coach notes that already exist on the existing plan's sessions
- Full session catalogue (the user's existing plan retains its catalogue-sourced sessions)
- Initial injury adaptations applied at plan creation

#### Paid only — ongoing
Required to use the PAID feature again *after* the trial ends.

- Dynamic reshape (R20 — auto and user-initiated)
- AI coach notes on *new* sessions (after a reshape OR on regenerated plans)
- Injury adaptations applied to *new* plans or after a reshape
- Strava intelligence (run analysis, weekly report, plan adjustment triggers)
- Confidence score
- Ultra plan generation (50K, 100K — locked at the wizard distance picker)
- Tailored strength sessions (R21 — when shipped)

**Note on regeneration (R23-D6 resolution, 2026-04-25):** Free users may regenerate
rule-engine plans freely. The plan they get on regen carries no AI enrichment
(no AI labels, no coach intro, no confidence score). The paid value on regen is
the AI layer, not the act of regenerating itself. Revisit during the planned
free/paid audit if commercial signals warrant tightening.

#### Free always
Available regardless of trial status.

- Generic plan templates (5K/10K/HM, fixed shapes)
- Rule-engine plan regeneration (no AI enrichment) — see R23-D6 above
- Manual session completion
- Plan view
- Basic strength sessions (the placeholder stubs)

---

## Pricing Target

| Plan | Price |
|------|-------|
| Free | £0 / month — permanent after trial |
| Paid (annual) | £7–10 / month billed annually |

> **TODO (product owner)**: Confirm exact pricing point and billing frequency. Monthly pricing also TBD. Confirm payment provider (e.g. Stripe, RevenueCat) before trial infrastructure build begins.

---

## Tier Definitions

### FREE (permanent, post-trial)

| Feature | Detail |
|---------|--------|
| Template training plans | 5K / 10K / HM — 8 & 12-week variants. Rule-based engine, no AI calls. |
| Session display and tracking | Core session cards, completion logging, skip flow |
| Formula-derived pace and HR targets | Karvonen formula using stored HR data; no Strava required |
| Basic profile management | First name, email, HR zones in `user_settings` |
| Theme (light / dark) | |
| Manual session log | Log a run without Strava |
| Session history | Past completions always visible |

**Rule-based engine (free tier)**: Free tier plan generation uses a deterministic rule-based engine — no AI calls. Plans are computed from pre-built templates matched to user inputs (race distance, fitness level, days available). The Anthropic API is never called for free tier plan generation.

### PAID (full access during 14-day trial; subscription thereafter)

| Feature | Detail |
|---------|--------|
| AI plan generation | Claude API via Next.js API routes only — never client-side |
| Dynamic plan reshaping (R20) | Adapts to missed sessions, fatigue signals, race proximity |
| Strava integration | OAuth, run sync, aerobic pace derivation |
| AI coaching (Coach tab) | Session-by-session coaching with plan context |
| Plan confidence score (R18) | Derived from RPE and completion data |
| All personalised or intelligent features | Anything requiring user data + AI |

**Note**: under Option A, the *output* of AI plan generation (the plan itself) is retained after the trial. The *ability to generate again* is the paid feature.

---

## Feature Tagging Requirement

**Every new feature must be tagged FREE or PAID in `docs/canonical/feature-registry.md` before implementation begins.**

An untagged feature is a build blocker. See `docs/architecture/ADR-003-free-paid-gates.md` for gating rules. Both API routes and components must enforce gates — component-only gates are insufficient.

---

## Trial Infrastructure Requirements

The following must be built before the trial model goes live (see backlog for scheduling):

| Item | Location | Notes |
|------|----------|-------|
| `trial_started_at` timestamp | `user_settings` table | Set on account creation; never updated |
| `isTrialActive(user)` helper | `lib/trial.ts` (proposed) | Server-side utility; compares `trial_started_at` + 14 days against `now()` |
| PAID feature gate | API routes + components | Both layers required per ADR-003 |
| Upgrade prompt | Component | Triggered by action, not by date |
| Downgrade flow | Server-side | Graceful; user retains all data |

> **TODO (product owner)**: Confirm whether post-trial users see upgrade prompts as inline sheets or navigate to a dedicated upgrade screen. Confirm copy and CTA language before the infrastructure build begins.

---

## Invariants

- Free tier must never expose paid-tier data or imply its existence without an explicit product decision
- Upgrade prompts must be behaviour-triggered (user attempts a PAID feature), never calendar-triggered
- Trial length is 14 days — changes require a product decision and update to this document
- All AI calls (Claude API) route through Next.js API routes only — never from the client directly
- Rule-based plan engine makes zero Anthropic API calls — verified at route level
