# Plan Adjustments — Parked Feature Notes

**Status:** Parked for post-launch (v1.1 or later)
**Parked on:** 2026-04-23
**Owner:** Russ

---

## Why this is parked

The UI for pending adjustments (`PendingAdjustmentBanner`) was shipped in Phase 2 of the redesign. The backend to *generate* adjustments was never completed. Rather than rush a partial implementation before launch, this feature is parked for a dedicated build post-TestFlight.

The UI component stays in place. It will simply never render under normal use until the backend triggers exist.

---

## What the feature is meant to do

> "The plan adapts to your life."

When a runner's actual behaviour deviates from the plan — moving sessions, skipping, missing, showing fatigue, drifting out of their zones — ZONA should propose plan changes that keep the overall structure working. The user reviews each proposal and either Confirms or Reverts.

This is the core product differentiator vs. Runna, which gives you a plan and leaves it. ZONA should be alive.

---

## The five triggers (design-level)

| # | Trigger | Intent | Status |
|---|---|---|---|
| 1 | User moves a session via drag-to-reorder | Rebalance surrounding sessions to keep hard/easy alternation | Not built |
| 2 | User marks a session as skipped | Decide: make up later this week, push to next week, or absorb the loss. Skip reason matters (meeting vs. fatigue) | Not built |
| 3 | User misses a session silently (day passes, no completion) | Prompt on next app open: what happened? Or auto-mark skipped | Not built |
| 4 | User logs extreme fatigue (Heavy / Wrecked / Cooked) repeatedly | Soften upcoming sessions. Swap intervals for Zone 2. Add rest if trend continues | Not built |
| 5 | User logs RPE inconsistent with session intent (e.g. RPE 9 on easy run) | Coach-only, or adjust? Open question | Not built |

---

## Product decisions still to make

Before building, these need answers:

1. **Session-move rules** — if you move a hard session onto a day that already has a hard session, what should happen? Auto-swap? Warn user? Block?
2. **Skip semantics** — is "skipped" binary, or should users specify a reason so the plan can respond accordingly?
3. **Miss detection** — how long after a session time passes before it's considered missed? End of day? Next morning?
4. **Fatigue response** — how many consecutive "Heavy"+ ratings trigger an adjustment? What's the softening rule — swap intervals for easy, reduce distance, add rest?
5. **RPE disconnect** — does high RPE on an easy session trigger a plan adjustment or just a coach note? (My vote: coach note only. Plan shouldn't change because of one session's effort.)
6. **Confirm/Revert vs silent** — do *all* adjustments require user approval, or are some auto-applied (e.g. "make up Thursday's easy on Friday")?
7. **Rate limiting** — `MAX_ADJUSTMENTS_PER_WEEK = 2` is currently in code. Is 2 the right number? Per week?
8. **Race proximity rules** — should the adjustment engine behave differently 2 weeks from race? Taper weeks? Probably yes.

---

## What's already in place (partial infrastructure)

- `plan_adjustments` table in Supabase (empty, ready to receive rows)
- `POST /api/adjust-plan` route exists — accepts proposals, writes to table
- `PendingAdjustmentBanner` component in UI — reads from table, renders on Today (and should on Plan)
- `AdjustmentBanner` wrapper component — handles Confirm/Revert API calls
- Wrapper logic for storing and revoking adjustments is functional
- `user_settings.dynamic_adjustments_enabled` toggle — user can opt out (after bug fix lands)

**What's missing:** the triggers. Nothing generates adjustments. The pipeline runs, it just never starts.

---

## Bugs fixed in the "park" sweep

| # | Bug | Fix |
|---|---|---|
| 1 | `/api/adjust-plan` guard counted adjustments across all weeks, not current week. Meant `MAX_ADJUSTMENTS_PER_WEEK` became a lifetime cap. | Added `.eq('week_n', weekN)` to the count query. |
| 2 | `user_settings.dynamic_adjustments_enabled` toggle was UI-only. Didn't actually gate generation. | API now reads the toggle and returns early with `skipped: true` if disabled. |

These were shipped on branch `fix/adjustment-guards` and merged on 2026-04-[TODO].

---

## Recommended sequencing when we come back to this

Phased approach, not big-bang:

### v1.1 — Phase Adj-A (after TestFlight launch)
- Wire Trigger 1: session move. Most visible, most natural, single pipeline to prove the system end-to-end.
- Build the product rules for hard-easy alternation
- Basic Confirm/Revert flow
- Validate with real users on TestFlight

### v1.2 — Phase Adj-B (after App Store launch)
- Trigger 2: skip (with reason selector in the reflect sheet)
- Trigger 3: silent miss detection + morning-after prompt

### v1.3 — Phase Adj-C (later)
- Trigger 4: fatigue-driven softening
- Trigger 5: RPE disconnect coaching (likely coach-only, not adjustment-generating)

---

## What to do in the meantime

1. **Don't pretend the feature works.** In App Store copy, describe adaptivity as "coming soon" or phrase it around what *does* work (plan generation, Zone 2 coaching, weekly reports).
2. **Don't show the banner by demo.** If screenshotting for App Store, use a staged dev record to show the banner, but be honest about it being a v1.1 feature.
3. **Remove the marketing promise from the alignment doc's App Store narrative.** Screenshot 3 was going to be "Miss a session? The plan adapts." — replace with something the app actually does today.

See the change log in `brand-product-alignment.md` for the updated screenshot narrative when this parking decision is ratified.

---

## Who decides when this comes off park?

Russ. Based on:
- TestFlight feedback ("do users even miss this feature?")
- Time and energy post-race (July 12+)
- Whether the simpler alternatives (better coach notes, clearer plan display) actually resolve the user's adaptation need

---

## Change log

| Date | Change | By |
|---|---|---|
| 2026-04-23 | Parked. Two bugs fixed. Full product thinking deferred to post-launch. | Russ + Claude |
