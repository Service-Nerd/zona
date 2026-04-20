# UX Principles — Zona

**Authority**: This document defines the UX philosophy, design mandate, and flow principles that govern all screen and feature design. Read before building any new screen. Cross-reference `docs/canonical/ui-patterns.md` for component-level patterns and `docs/canonical/brand.md` for tone and visual rules.

---

## User-First Design Mandate

**UI/UX decisions precede technical decisions.**

This is a gate. Before any implementation begins:

1. Define the user's job on this screen (one sentence)
2. Define what "success" looks like from the user's perspective
3. Define all states: loading, empty, error, data present
4. Only then determine the technical approach

If the technical approach would compromise the UX, the technical approach changes — not the UX.

---

## Reverse Trial UX Principles

Zona uses a Hybrid Reverse Trial model (see `docs/canonical/monetisation-strategy.md`). The UX rules for this model:

### 1. Full experience on first open

New users land in the full product. No gatekeeping, no "sign up to continue", no feature previews locked behind cards. The trial is silent — it's just the product working.

### 2. No paywall friction for 14 days

Nothing tells the user they are on a trial unless they look for it. No countdown timer, no "X days remaining" banner, no amber warning states. The product earns the upgrade silently.

### 3. Upgrade prompts triggered by behaviour

When a user on the free tier (post-trial) attempts a PAID feature, the upgrade prompt appears inline at the point of intent. Examples:
- Trying to connect Strava → upgrade prompt
- Trying to use the AI plan generator → upgrade prompt
- Trying to access the Coach tab → upgrade prompt

**The upgrade prompt must never appear because of a calendar date.** Day 14 passing does not trigger a popup. The next time the user tries to use a PAID feature, they see the gate.

### 4. Graceful downgrade

When the trial ends the user keeps all their data. Their plan is visible. Their session history is intact. Only PAID features become gated. The transition is quiet.

> **TODO (product owner)**: Define whether upgrade prompts navigate to a dedicated upgrade screen or appear as inline sheets. Confirm copy and CTA language before the R0.5 / trial infrastructure build.

---

## Onboarding Principles

### First value in under 3 minutes

The onboarding flow must reach "first value" — a training plan visible on screen — in under 3 minutes from account creation.

**Target flow (R0.5)**:
1. Account created
2. Questionnaire: race, distance, fitness level, days available — 60–90 seconds
3. Template plan selected (free tier) or AI plan generated (trial / paid)
4. Plan on screen

There must be no dead ends. Every question has a sensible default. No required field should block completion.

### Progressive disclosure

Do not ask for everything upfront. Collect core inputs first:
- Required: race date, race distance, fitness level, days available
- Optional later: lifestyle constraints, injury history, psychology inputs, HR data

Advanced inputs surface in plan generation (R23b wizard) or profile settings — not in the initial onboarding flow.

### First session orientation

After generating a plan, new users who land on a rest day or an empty first week need context. Orientation screen (UX-07, shipped) shows what is coming next: week number, first session day, zone explanation.

---

## Screen Design Principles

| Principle | What it means |
|-----------|---------------|
| One job per screen | Each screen has exactly one primary purpose. No multi-purpose dashboards. |
| Calm guidance | Inform. Do not alarm. The user decides when to act. |
| Restraint = progress | Whitespace, brevity, and silence are features. |
| No popups | All interactions navigate. Modals only for destructive confirmations. |
| Back arrow top-left | Navigation is always predictable and reversible. |
| Slide-up sheets | Mirrored nav bar at bottom, not top. Consistent with mobile convention. |

---

## State Coverage Requirement (SLC — Complete)

Every screen must handle all of these before shipping:

| State | Requirement |
|-------|-------------|
| Loading | Skeleton shimmer — match the exact shape of content. No spinners. |
| Empty | Explain the state. Provide a next step if one exists. |
| Error | Quiet inline message. No red alert boxes. |
| Data present | Nominal path — designed first, most tested. |
| Edge cases | Documented and handled before marking a feature complete. |

"Complete" is part of SLC. A screen that does not handle its empty or error state is not shipped.

---

## Upgrade Prompt UX Rules

| Rule | Detail |
|------|--------|
| Triggered by action | Only shown when user attempts a PAID feature |
| Contextual | Explains what the feature does and what the upgrade includes |
| Dismissible | User can dismiss and continue using free features |
| Not repeated immediately | Once dismissed in a session, not shown again for the same feature in that session |
| Honest | States the price and what is included |

---

## Invariants

- User-first evaluation is a build gate, not a suggestion
- Upgrade prompts must be behaviour-triggered, never calendar-triggered
- First value (plan on screen) must be reachable in under 3 minutes from account creation
- All states (loading, empty, error, complete) must be handled before a feature ships
- SLC (Simple, Lovable, Complete) is the only delivery model — see `CLAUDE.md`
