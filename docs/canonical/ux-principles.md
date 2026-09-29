# UX Principles — Zonna

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

Zonna uses a Hybrid Reverse Trial model (see `docs/canonical/monetisation-strategy.md`). The UX rules for this model:

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

## Screen Design Principles — THE RESTRAINT RULES

> ⚖️ **This section is the SINGLE OWNER of the restraint rules.** Transferred from
> `brand.md` § Visual Principles to the Design Board on **2026-09-22** by founder ruling
> (ownership-map.md; ADR-023). `brand.md`, `CLAUDE.md` and `ui-patterns.md` reference
> this table and must not restate it. Guarded by
> `lib/marketing/restraintRulesOwnership.test.ts`.
>
> **Why the transfer.** These rules were written in **four** places and had already
> drifted: `CLAUDE.md` had lost the destructive-confirmation exception, so read alone it
> banned modals outright. They were de facto design doctrine — duplicated into two design
> documents and enforced by design tests — while nominally owned by brand. Ambiguous
> ownership is what produced the drift.
>
> **They are now amendable by Design Board ruling**, which means the three artifacts and
> a row in `design-rulings.md`. Amendable is not the same as weak: changing one is a
> visible, recorded act, which is more than `brand.md` ever required.

The job of each screen is defined in `docs/canonical/screen-architecture.md`. That document is the canonical reference for what belongs on which screen and the validation test to apply before adding any feature. Read it before building any new screen or moving content between screens.

| Principle | What it means | ⚠️ The clause that gets lost |
|-----------|---------------|---|
| **One job per screen** | Each screen has exactly one primary purpose. **No dashboards. No noise.** | "No multi-purpose dashboards" is the same rule, not a weaker one |
| **Calm guidance, not alerts** | Information is presented; **the user decides when to act.** Inform, do not alarm | Both halves. "Inform, do not alarm" alone loses who holds the timing |
| **Restraint = progress** | Whitespace, brevity and silence are features. **Empty means calm, not broken** | 🔴 The empty-state clause was dropped in two of the four copies |
| **No popups** | All interactions navigate to a full screen. **Modal overlays only for destructive confirmations (delete, disconnect). Never for information.** ⚠️ **A modal presented and owned by the OPERATING SYSTEM is outside this rule** (CHARITY-CODE-CONTROL-01, 2026-09-28) ⚠️ **AND A SLIDE-UP SHEET THE RUNNER ACTS IN IS A THIRD CATEGORY, PERMITTED** (ZONES-HR-SHEET-01, 2026-09-29) — see the clause below | 🔴 **`CLAUDE.md` omitted the exception entirely**, so modals read as banned outright. This is the divergence that justified the transfer. ⚠️ **And the OS clause is an AMENDMENT BY RULING, not an exception someone approved once** |
| **Back arrow top-left** | Navigation is always predictable and reversible | — |
| **Slide-up sheets** | Mirrored nav bar at **bottom**, not top. Never a top-right Cancel | Consistent with mobile convention, and deliberately unlike the competitor's sheet (P-02) |
| **No red in the training UI** | Red implies danger or failure. Amber for warnings, coral for high-intensity. `--danger` (`#B84545`) for form validation and error states **only** | 🔴 Existed in `brand.md` alone; absent from the other three copies |

> ⚠️ **THE OS-SHEET CLAUSE, AND WHY IT IS NARROW.** Apple's subscription-code redemption sheet (`presentCodeRedemptionSheet()`) is a modal, is not a destructive confirmation, and therefore hit this rule head on. The Design Board amended the rule **by name** rather than approving one exception, on a single ground: **we control neither its content nor its dismissal**, so the rule cannot bind it. A sheet we build is still bound. If the next OS sheet arrives with an argument that sounds like this one, check that we genuinely do not own it — `components/shared/Sheet.tsx` remains the only route for a secondary surface that is ours.
>
> ⚠️ **THE INPUT-SHEET CLAUSE, AND THE COUNT THAT FORCED IT** (ZONES-HR-SHEET-01, 2026-09-29).
> This rule names **two** categories. The product has **three**, and the gap was measured
> across all nine shipped sheets: **zero** are destructive confirmations (the only kind the
> rule permits), **five** are information (`ZoneInfoSheet`, *"Your training load balance"*,
> *"What this number means"*, *"Hitting the prescribed zone"*, *"Foundation Block"*), and
> **four** are inputs (*"Log a run"*, *"How did it go?"*, *"Adjust your plan"*, *"Missed
> session"*). **So the rule permitted a category the product never uses and described none
> of what it ships.**
>
> **A slide-up sheet the runner ACTS IN — one containing an input and its save — is
> permitted.** It is disclosure, not density: the surface is summoned by a tap and dismissed,
> which is the opposite of a resident panel. `Sheet` is the only primitive for it (R-5 still
> governs the shape: a sheet you act in keeps the bottom bar).
>
> 🔴 **What did NOT change: the information clause.** Five sheets currently sit against it.
> They are recorded, not blessed — this clause deliberately does not retro-permit them, and
> whether an explainer should be a sheet at all is its own question for this board.
>
> ⚠️ **And the reconciliation nobody had made:** `S1 § 6i` already established that *"the
> no-popups rule governs whether a sheet EXISTS, not where its bottom edge lands"*, which
> settles that a sheet is not automatically banned — but it never said which sheets may
> exist. This clause is that half.

> 🔴 **It is not a licence for a popup with a system-looking wrapper.** The measured precedent for that failure is the paper-grain overlay, which died because its only argument was that a competitor had one.

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
