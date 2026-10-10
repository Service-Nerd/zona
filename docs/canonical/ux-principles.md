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

### 🔴 THE ALREADY-DONE STATE IS A SIXTH STATE, AND IT IS THE ONE THAT GETS MISSED

**A surface that offers an action the runner has ALREADY TAKEN must state the existing
state first, in the past tense, before offering to change it.**

*(Design Board, `LINK-PICKER-ALREADY-LINKED-01`, 2026-10-08. Register row in
`design-rulings.md`.)*

⚠️ **It is not covered by the five states above, which is why it survived.** The table
asks for Loading / Empty / Error / Data / Edge. *Already-done* renders through the **Data
present** branch with a **full** list and a valid selection, so every box above is ticked
and the screen is still wrong. **The defect is not a missing state; it is the right state
wearing the empty state's words.**

| | |
|---|---|
| 🔴 **The instance** | A linked, completed session reached via *“Update log”* rendered **“Link an activity”** over **“Optional, select from recent runs”** — a first-time instruction above a list whose selection had already been made and was already visible. Founder: *“seems i can still manually link it to the same run its linked against.”* |
| ✋ **Why it matters at the craft level** | Silvanto: *“a sentence written for an empty state, rendered over a full one. The runner reads 'optional' and has to work out whether the selection they can see is a choice they already made or a suggestion we are offering. **That is the sorting we are supposed to do for them.**”* |
| 🎓 **Why it matters at the product level** | Sierra: a surface that keeps offering to redo a done thing teaches the runner that **our record of their training is provisional**, which makes them responsible for checking it every time. That is load spent on our interface instead of on their running, and it undercuts the one claim the encouragement apps cannot make. |

**The test, and it is one question:** *would this sentence be correct if the runner had
never done this before?* If yes, and they have, **it is the wrong sentence.**

⚠️ **This rule governs the SENTENCE, not the control.** Whether the control should be
present at all on a done surface is a separate ruling each time: on
`LINK-PICKER-ALREADY-LINKED-01` the board **split** on it (Collins: remove the list behind
an existing *“Wrong one?”*; Wroblewski and Silvanto: keep it and bring **remove** onto the
surface) and recorded the split **unresolved**, needing the founder on a device.
**Do not cite this rule as authority for deleting a control.**

⚠️ **And it does not license deleting the selected affordance.** The same item flagged the
picker for *keeping* the already-linked run in its list; that is **compliance** with
`BUTTON-COMPONENT-01` (*the moss active fill is the only selected affordance*), because the
run must stay in the list to carry it. **The state must be SAID, not removed.**

> 🔴 **AND THAT WAS TRUE OF THE RULE AND FALSE OF THE CODE UNTIL 2026-10-08.** The founder:
> *“It doesn't do what you think it does now.”* `setSelectedActivity` had exactly one caller —
> a user's tap — so **the already-linked run was never selected and never carried the fill**,
> and three other consumers read as “never logged” with it (the AIMark hint, the CTA label,
> and the offer of manual entry). The filter was doing its half of a two-part feature whose
> other half was never wired, while its comment asserted the half that did not happen.
> Fixed as `LINK-PICKER-SELECTION-UNWIRED-01`; `design-rulings.md` carries the amendment,
> **including that a seat's non-veto had rested on the false premise.**
> **A defaulted or uninitialised value is how a missing consumer looks like a finished one.**

**Where the copy lives:** an owner module under `lib/ui/`, never a literal in the component
— `linkPickerCopy.ts` beside `matchEmptyCopy` and `connectionStaleCopy`. A ternary in JSX
cannot be called, so which branch renders cannot be proven.

### 🔴 AN AFFORDANCE IS WITHHELD WHEN THE ACTION CANNOT SUCCEED, NOT WHEN THE DATA IS MISSING

**Before a control is offered, the question is not "do we hold what the action needs?" but
"would the action succeed?" Those are different questions and the first one is the easy one,
which is why it gets asked instead.**

*(Design Board, `BASEBUILD-ADJUST-DOOR-01`, 2026-10-10. Register row in `design-rulings.md`.)*

⚠️ **IT IS THE INVERSE OF THE ALREADY-DONE STATE ABOVE.** There, every state was handled and
the SENTENCE was wrong. Here the sentence is fine and the **ACTION** is impossible, so no
state in the table above is violated: the control renders, the sheet opens, the fields hold
real values, and the error path even produces a designed message. **Nothing is missing. It
simply cannot work.**

| | |
|---|---|
| 🔴 **The instance** | `canModifyPlan` returned `!!plan.meta.generator_input` — *do we hold the input?* The row it gates asks *can this plan be modified?* The Adjust sheet POSTs the overlaid input to `/api/generate-plan`, **the race generator**, and a base-build runner is on that plan **because the race generator refused them** (§111's base-volume door). Measured by walking all 8 editable keys through the real engine on both live plans: **Sheena 0 of 27 offered edits produce a plan; Tom 2 of 27, and both of those are perverse** — a *tighter* weekday cap and an injury he does not have, because §111 refuses on peak ÷ current volume, so anything that shrinks the plan clears the gate |
| 🧭 **The standard** | Zhuo: *"a control with a measured 0% success rate is not a capability, it is an affordance."* |
| 📱 **Why it is worse than silence** | Wroblewski: the 422 is surfaced, so moving a long run to Saturday returns *"5 km a week is too low to build safely to a marathon yet."* **The app argues with a runner who asked about her calendar.** It also breaches P-02's own standing rule against *"implying the runner has failed to do something"* |
| ✋ **Why it is a category error, not a bug** | Silvanto: a race-plan affordance on a plan whose `race_date` is deliberately `''` so that no countdown can claim a start line. The construction already decided this plan does not speak about a race, and then the sheet's last group is titled *"The race"* |

**The test, and it is one question:** *if the runner takes this action with the most ordinary
value available, does anything happen?* **Measure it against the real producer** — do not
reason about it. A control whose only outcome is a refusal is not offered.

⚠️ **WITHHOLDING IS AN INTERIM AND MUST BE RECORDED AS ONE.** Sierra's dissent is on the
record and was not resolved: a runner on a **15-week** plan who cannot move a long run off a
day she cannot run has lost a real capability, and *"empty means calm, not broken"* covers a
blank space, not *"you may change nothing for fifteen weeks."* **The fix is to point the
action at the right producer** (`BASEBUILD-ADJUST-REBUILD-01` — the sheet rebuilds the base
build), not to hide the row forever. A withheld affordance with no filed destination becomes
a decision nobody made.

⚠️ **Nothing replaces the row.** An inapplicable affordance is not an empty state, and a
placeholder would be chrome — the empty-state illustration kill (2026-09-22) governs.

⚠️ **AND THE PREDICATE IS NOT RE-WRITTEN AT THE CONTROL.** `isBaseBuildPlan`
(`validateStoredPlan.ts`) is the single owner of the kind test, so the validator and the
affordance cannot disagree about what a base-build plan is.

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
