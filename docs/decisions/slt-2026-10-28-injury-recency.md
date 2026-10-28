# SLT: should the wizard ask whether an injury is current? (2026-10-28, INJURY-RECENCY-01)

**Escalated by** the Coaching Board, 2026-10-28 (LONG-RUN-BELOW-LONGEST-01, 2nd sitting). **Founder:** "Yes to all".

**One-line brief:** `injury_history` carries no date, so a back or plantar fasciitis history caps every marathon long run
at 120 minutes for good (mean peak long run 15.7 km vs 25.1 km); should the wizard collect recency, and at what tier?
**Tier:** FREE (injury handling is never paid: SLT 2026-09-11, `featureGates.ts`).

## What the board was shown, and what it found first

- **Live population:** 32 stored plans with generator input; 12 carry an injury; **4 carry back or plantar; 2 of those are
  HM or longer.** Small, and every one of them is a real runner.
- **The wizard already asks for recency, in words.** The injuries step reads *"Anything to flag? Old injuries that still
  show up. Skip if you're clean."* (`GeneratePlanScreen.tsx`). A runner following it would not list a healed injury.
  Nothing measures whether they do.
- 🔴 **Found during the review: free runners are never asked about injuries at all.** The step is pushed only
  `if (hasPaidAccess)`, and the value is sent only `hasPaidAccess && injuries.length`. **This SLT ruled on 2026-09-11 that
  injury adaptation is never paid** (Hutchinson: the cohort least able to afford it, most likely free), and removed
  `injury_adaptations_new` from `featureGates.ts`, noting the engine adapts on every plan. **The engine was fixed; the
  input that feeds it was not.** A free runner, or a lapsed trial rebuilding a plan, gets no §12, §90 or §9 Am. 3
  protection, because the engine is never told. `hard_session_relationship` and `terrain` are gated the same way.

## The board

🧠 **Sutherland.** The interesting fact is that the question is already in the wording. "Old injuries that still show up"
is a recency filter that costs the runner nothing, and adding a date picker would turn a safety question into paperwork,
which is how you get people skipping it. If you want recency, put it on the chip they have already tapped, not on a new
screen. And the free-runner gate is the opposite of costly signalling: it says safety is a premium feature.

📦 **Fried.** Four runners. Two at a distance where the cap bites. I would not add a question to a fifteen-step wizard for
two people until the Coaching Board says what the answer would change. The free gate is different: that is not a
feature, it is a promise we already made and did not keep. Fix it, today, and do not call it a build.

🏃 **Hutchinson.** On recency I need the Coaching Board to say first what each answer changes, because "longer ago" for a
plantar fascia is not "longer ago" for a lumbar disc, and Willy has already said they should not share a rule. If the
board cannot name a different prescription per answer, the question is decoration. On the free gate: this is my ruling
from September, not being honoured. It is the most important thing in this review.

🔬 **Wood.** A runner who tells us about an old injury and gets a plan that ignores it learns that the question was for
us, not for them; that is the illusion-of-progress class in a single tap. Recency only helps if it changes the plan.
Kill a recency field that changes nothing. Keep the wording, which shapes the answer at no cost.

🧭 **Zhuo.** Two items, not one. The gate is a defect with a ruling behind it. Recency is a design question (where the
answer lives: a per-chip toggle, not a new step) that the Design Board should rule on only once the Coaching Board has said
what each answer means. I will not let this table design the input.

## Conflicts

Sutherland would put recency on the chip now; Fried and Wood would not build it until it changes a prescription. Settled by
sequencing, not compromise: the Coaching Board defines the meaning first.

## Recommendation

1. **Don't build recency yet.** The Coaching Board first states what each answer (current / within a year / longer ago)
   changes, per injury, with a measurement. If no answer changes a prescription, it is not collected. Then the Design Board
   rules on the input (a per-chip toggle on the existing step, not a new step). Tier when built: **FREE**.
2. **Fix the free-runner gate now (defect, no board, restores this SLT's 2026-09-11 ruling):** show the injuries step to
   every runner and always send `injury_history`. `hard_session_relationship` and `terrain` are gated the same way; measure
   what each changes in the plan, then decide whether they are richness (paid) or safety (free). Filed as
   `WIZARD-INJURY-FREE-01`.

## MUST/NEVER check

"Gate richness, never access" (CLAUDE.md): the current gate violates it. A recency field must not become a paid feature.
No new screen or modal: a per-chip toggle on an existing step.

## Risks to existing features

Opening the injuries step to free runners changes their generated plans (§12 / §90 / §9 Am. 3 now apply): measure with the
cohort harnesses and parity before shipping, and expect `cohort:shape` to move. Existing stored plans are not touched.
