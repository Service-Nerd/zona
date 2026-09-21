# Homepage — three open decisions

**SLT, 2026-09-21 (evening).** Sutherland · Fried · Hutchinson · Wood · Traynor.
Convened at the founder's instruction: *"if you need any decisions, take them to the SLT, get them answered, build it."*
**Tier: FREE** throughout — public marketing surface, no gate logic touched.

> ⚠️ **I briefed the board wrong on one item and caught it before they ruled.** I said the hero
> was single-column with the evidence card below. It was already a two-column grid whose right
> column held the **phone**. Direction 2a does not add a column; it asks which object belongs in
> the one that exists. That turned "restructure the hero" into "swap two things", which is the
> only reason it was cheap enough to ship.

---

## Item 1 — the fact row's message → **SHIPPED**

Was: `5 zones · Mostly easy running · £7.99/month · One daily nudge`
Now: `Mostly easy running · Every session zoned · Nine plans, free to read · One daily nudge`

All three commercial seats voted to remove the price **for different reasons**, and the difference
decides what happens next:

| Seat | Reading | What it tells you |
|---|---|---|
| **Sutherland** | **Timing.** The reader has just looked at the trace and thought *that's me*. That is the most valuable half-second on the page and we followed it with an invoice. Recognition and transaction are different mental modes. | *Where* a price may sit |
| Fried | **Repetition.** Three price mentions on one page reads as a company unsure of its price. | Only *how often* |
| Traynor | **Dilution.** A strong commercial fact weakened by being said casually in a list. | Only *how* |

> 🔴 **SUTHERLAND'S READING GOVERNS, because it is the only one that generalises: NEVER PUT A
> PRICE ADJACENT TO A PROOF MOMENT.** The other two would let someone re-add a price here as long
> as they removed one elsewhere.

The price still appears twice — hero paragraph, paid line. **"Nine plans, free to read" delivers
W-05 rather than undermining it**: that ruling was about the free tier being in small print, not
about the price. It is deliberately precise — free *generation* is 5K/10K/HM per `FREE_FEATURES`,
while all nine published plan pages are readable with no signup.

Wood, on the last item: keep it and resist making it sound bigger. **It is the only fact on the
row describing a constraint the product places on itself.**

---

## Item 2 — the design's proof band → 🔴 **DEAD, not deferred**

Three white cards with 56px numerals, dropped at build time as "new claims needing a founder
decision". Measured properly, **all three are false**:

| Card | Claim | Measured |
|---|---|---|
| 80% | "of your week belongs in Zone 2. **Most runners manage half that.**" | Our easy share across the nine published plans is **85.6% of running sessions**. §1 is per-distance — quality capped at 25/25/20/18/17/15 — so **there is no single number to print**. 🔴 And "most runners manage half that" is **a statistic about a population we have never observed**: three users, no study, no cohort. 40% exists because it is half of an invented 80%. |
| 1 | "sentence from Kit after each run" | `post_run_reframe` is **PAID** — free users get none — and it is an observation plus an instruction, not one sentence. |
| 4 | "sessions a week, reshaped whenever the week falls apart" | Measured **3 to 5**, set by the runner's `days_available`. `dynamic_reshape_r20` is **PAID**, and ADR-012 says structural reshapes surface a confirmation rather than auto-applying. |

Hutchinson: the fabricated statistic is the one thing he would veto rather than merely decline,
and printing it in 56px under a masthead that says *credibility over cleverness* makes it worse.

Fried: **"if a section's content has to be invented after the design is drawn, the section was a
shape, not an idea."**

Sutherland, on why the design still wanted it: a proof beat after the hero is a sound instinct,
but **we already have the best proof object on the page** — a real trace, a real ceiling, a coach
naming a specific run. *"Numbers are persuasive when they're the only evidence available. When you
have a photograph, don't also draw a diagram."*

> 🔴 **It cannot return as "we just need better numbers."** There are no numbers that make three
> large numerals beside a real measurement into anything but competition with it. The handoff's
> separate pricing band is dead too — `/pricing` owns that.

---

## Item 3 — `DESIGN-V3-FIDELITY` → **2 shipped, 1 dead, item CLOSED**

| # | Ruling | Why |
|---|---|---|
| **3.1 Hero swap** | **SHIPPED** | The evidence card is the one asset a competitor cannot copy, and it was below the fold. The phone follows immediately. |
| **3.3 CTA hover** | **SHIPPED** | Not a fidelity nicety — a **missing affordance**. On desktop a button with no hover reads as not-a-button. `--moss-deep` (#465D46, 7.21:1, *stronger* than the base: a hover must never be the weaker contrast). ⚠️ `:focus-visible` shipped with it: hover alone hands the affordance to pointer users and withholds it from keyboard users. |
| **3.2 Phone geometry** | 🔴 **DEAD — do not re-propose** | Resizing to 390×844 means re-measuring every screen inside a frame that now holds the real `PlanCalendar`, and **no reader can perceive the difference**. Fried's test, which is the same test that passed 3.1: does this FIX something, or merely COMPLY? |

---

## Not the SLT's to decide

- **The unreproduced "things aligned to the right" on mobile.** Nobody in the room can rule on a
  rendering nobody else has seen. **Founder's** — needs a screenshot or a section name.
- **Coaching Board: nothing.** Hutchinson confirmed on the record that no engine prescription
  changes here, so it was not routed down out of caution.

---

## Three defects introduced while building this, all caught by measuring

1. **The 3-second loop silently broke the cross-fade.** Fades were tuned against a 7s loop
   (0.65s/0.5s = 9.3%/7.1%). The loop changed; nothing else did; they became **21.7% and 16.7%** —
   a fifth of the card's life as a double exposure. ⚠️ **First dismissed as a screenshot
   artefact.** Now gated: a fade must be ≤12% of `LOOP_SECONDS` and ≥0.15s.
2. **The longer copy ate the page gutter at 320px** — 5px against a 16px floor. ⚠️ **It did not
   overflow the document**, so `scrollWidth === innerWidth` stayed true and it would have shipped
   unseen.
3. **And the fix did nothing**, because the two facts were bare **text nodes**: flexbox merges
   loose text into one anonymous item once the dot between them is hidden, so `flex-direction:
   column` had nothing to lay out. The media query was matching all along.
