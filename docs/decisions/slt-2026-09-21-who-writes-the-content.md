# SLT — Who writes the marketing content

**Date:** 2026-09-21 · **Trigger:** the founder asked what the "standing decision" I kept citing actually was.

**Tier: FREE (marketing surface)**, with one exception: three of the eight planned guides are a
**coaching surface** and carry a review obligation. See Hutchinson below.

---

## ⚠️ The provenance is the item

I twice declined to write marketing copy, citing *"a standing decision, same as the comparison
pages: founder-written, ~1/week, do not bulk-draft."*

**There was no such decision.** No `docs/decisions/` entry, no SLT sitting, no founder quote, and
nothing in `brand.md`. It existed in three places, all written by me:

- a memory note dated 2026-09-10 asserting *"Decided 2026-09-10"* with **no author named**
- `roadmap.md`: *"🔄 Pages 3–8 (**founder, 1/week**)"*
- two `feature-registry.md` rows

This is the failure mode already recorded as `feedback_written_assumptions_are_the_dangerous_ones`:
**a blocker I wrote into a doc gets believed.** I then cited it as authority for not working.

⚠️ **The premise was also already stale.** The note says the founder writes the pages. What actually
happened on page 2 (`/coopah-vs-runna`) is that he handed over a **finished, externally produced
deliverable** with verified sources and a build prompt. Even the single data point did not support it.

---

## Ruling

**Claude drafts. The founder edits, supplies anything in the first person, and reads every word
before it ships.**

| | Comparison articles | Guides |
|---|---|---|
| Draft | **Claude** | **Claude** |
| First-person content | **Founder only, NEVER generated** | Same |
| Coaching claims | n/a | **Only what an existing principle asserts, named inline. Anything new goes to the Coaching Board FIRST** |
| Competitor facts | **`COMPETITOR_FACTS` only** | n/a |
| Publish condition | **Founder has read it end to end** | Same |
| Signature | Keep | ⚠️ **Only if it carries genuine first-person content** |

**Cadence: write ONE guide and stop.** Not eight. That article decides whether the model works.

**`GUIDES_MIN_TO_PUBLISH = 3` survives**, but on Wood's restated reasoning (a hub with one card
teaches a visitor the section is abandoned), **not** on the cadence assumption it was originally
granted under, which was fictional.

**And yes, I should have been drafting these for the last eleven days.**

---

## The seats

**🧠 Sutherland — the signature is the asset, and it partitions the work.** The articles close with
*"Written by Russ Shear, who built Zonna after running 100km in July 2026 and walking the last 40 of
it."* That is a **costly signal**, and it works because a named human stands behind an embarrassing
admission. But the founder did not write page 2 either, he commissioned and verified it, and nobody
calls that fraud. **So the line was never human-versus-machine: it is whether the named person
supplies the judgement, or merely the signature.** Hence: **reported content** (prices, platforms,
tables) is draftable; **testimonial content** (first person, experience) is his alone and cannot be
generated. *"An unsigned guide is more honest than a borrowed one."*

**📦 Fried — why eight?** Because the competitor has eight. That is competitor-chasing dressed as
strategy, against a funded team who will out-publish us at volume regardless. *"Write one. Publish
it. Do not write the second until the first has existed for a fortnight."* On authorship:
draft-and-edit is how every content operation works; the founder's scarce resource is judgement, not
typing, and having him produce 1,300 words a week by hand while P0 ops items sit open is a trade
nobody would defend if it were written down, **which it never was**. And *"thin is a property of the
finished page, not of who produced the first draft. You can read it."*

**🏃 Hutchinson — the most consequential intervention, and it changes the model.** Three of the eight
titles are **coaching questions answered under a Zonna byline on the open web, to people with no
plan in front of them**: *should my easy runs feel this slow* (§12), *am I overtraining or just
tired* (§2/§3), *what pace should my long run be* (§52). **That is a coaching surface and it does not
become a marketing surface because it lives at `/guides`.** If the article and the engine disagree we
have published a position we do not implement, which is this repo's documented prose-drifts-from-rule
class. **Ruling: the coaching CLAIMS route to the Coaching Board, whoever writes the prose.** Made
cheap in practice: **a guide may only assert what an existing principle already asserts, and it names
the section.** A claim no principle covers is a board item before it is a writing task. Comparison
articles are genuinely different: prices and platforms are not coaching.

**🔬 Wood — the bottleneck was standing in for a process.** Her 10pm framing is unchanged and is the
strongest argument for doing this at all: someone searching *"should my easy runs feel this slow"* is
**at the exact moment of doubt the product exists to resolve. Context, not motivation.** And:
*"'who writes it' is a resourcing question wearing a quality question's clothes. The quality
mechanism for published content is REVIEW, not authorship."* A founder-written article nobody
reviewed is not safer than a drafted one he read carefully. **The bottleneck produced zero guides.**

**💰 Traynor — the cost of the imaginary rule has already been paid.** Out-published for eleven days,
two comparisons against eight guides. Standing objection restated: **no revenue, no redeemed codes,
no marketing analytics** — so **installing the measurement is now more urgent than the seventh
guide**, or this conversation repeats in November with the same absence of evidence. What he wants
protected is not who types it: **nothing publishes the founder has not read end to end. Not approved
in principle. Read.**

---

## Conflicts, recorded

**1. Sutherland versus Fried on volume — genuine, unresolved by the board.** Sutherland builds the
asset class out; Fried says eight is a borrowed number. **Tiebreak is Traynor's:** with no analytics,
Fried's position is the cheaper way to be wrong. **One guide.**

**2. Hutchinson versus the framing.** Everyone else treated this as resourcing; he identified a
coaching surface. Accepted, and it is the binding constraint.

**3. Wood versus the original instinct.** Quality protected by a bottleneck rather than a process.
No dissent.

---

## MUST / NEVER

- No em dashes; new surfaces join `noEmDash.test.ts`. Already covered for guides via the shared catalogue.
- `BRAND.name` interpolated; competitor prices only from `COMPETITOR_FACTS`. Already enforced.
- ⚠️ **NEW AND UNGUARDED:** a guide must not assert a coaching claim no principle covers.
  **Mitigation shipped with this ruling:** a guide entry carries `principleRefs`, and a test fails if
  a guide ships without at least one.
- ⚠️ **NEVER generate first-person founder experience.** No test can catch this. It is a rule for me.
