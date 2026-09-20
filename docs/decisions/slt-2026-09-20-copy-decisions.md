# SLT — 2026-09-20 — four copy decisions, three of them live in production

**Convened because** the founder asked the SLT to answer the §4A copy questions before he signs.
He named three; **I brought four**, because the fourth was also live and unapproved and would
otherwise have passed by omission.

**Outcomes:** String 1 **CUT THE WORDS, KEEP THE COLOUR** · String 2 **KEEP, one edit** ·
String 3 **CUT THE SENTENCE, KEEP THE LINK** · String 4 **shape given, two coaching questions
routed down**.

⚠️ **Three of these were live code, not proposals.** Two were wrong. Both are now fixed.

---

## String 1 · the completion pill — **CUT THE WORDS**

The pill briefly read **"Held the zone"** (moss) / **"Drifted above"** (amber) / **"Done"** (mute).
It now reads **"Done"** in all three states, with the colour carrying the meaning.

**Sutherland.** *"You've built a language and then written a subtitle explaining it. A glossary
entry is what you write when you don't trust the thing you made."* The colour either teaches
itself in three sessions or it does not, and the word removes the one thing that makes a learned
code feel like insider knowledge. **He also noted the submission answered itself** — *"I am not
confident in it"* was the finding.

**Fried.** Three states, one of which is the majority and says "Done" anyway. **Most runners see
no change and a minority see jargon.** That is surface area. If nobody learns the colour, you will
know, and you can add a word then.

**Wood — and this is the important one, because she has used the kill mandate twice this week and
did not use it here.** An after-the-fact verdict changes no context and adds no friction, so it
will not stop the next run being too hard. **But it is not the illusion-of-progress class**,
because it does not pretend to be an intervention: it is feedback on an action already taken, and
feedback is how a learned code becomes automatic. The intervention is the **ceiling** (P-03,
shown *before* the run). This is what teaches the ceiling to mean something.
*"The colour is the code. The word is instruction, and instruction is the thing you stop needing."*

⚠️ **Traynor dissented and lost on mechanism, not taste.** He argued the word makes the paid tier
legible — a free runner sees "Done" forever, a paid runner sees a verdict. **It fails on its own
terms: the verdict word only ever renders for someone who already HAS run analysis, so it sells
nothing to the runner who does not.** Recorded because it is the strongest case for the other side.
**That argument belongs to P-04's free-tier state, which is still open.**

## String 2 · the reflection saved-state — **KEEP, one edit**

> ~~Your note is kept. No coach response this time.~~
> **Your note is kept. The coach didn't answer.**

**Sutherland: this is the best thing on the list and it was buried in an error state.** *"'Your
note is kept' is a sentence almost no software says, because almost no software keeps anything it
didn't have to. The failure is a better advert than the success."* When the coach replies we are a
coaching app doing its job; when the coach cannot reply and the words are still there, we are a
company that decided that mattered when nobody would have known. **So it leads the sentence.**

**Fried:** *"this time"* implies a pattern where there is one event. Cut.

**On Q2a — the copy does not apologise, and that is deliberate.** Three ways the AI fails and only
two are outages; the third is our own quality filter rejecting a cheerleading answer we were
billed for. The runner cannot tell them apart and should not have to. *"The coach didn't answer"*
is true of all three without pretending to know which.

## String 3 · the Health-connect disclosure — **CUT THE SENTENCE**

> ~~Your health data stays on our servers and shapes the coaching you get. We never send your name to the AI.~~ **What we share →**

Only the link remains. **Four seats, three independent reasons, nobody defended it.**

**Sutherland.** *"You are standing at a door marked Health data and volunteering 'by the way, we
never send your name to the AI.' Nobody asked. You have introduced two concepts — an AI, and
things being sent to it — at the exact moment someone is deciding whether to hand you their heart
rate. That is not reassurance. It's a man saying 'I've never been to prison' during a job
interview."*

**Fried.** The policy is one tap away and says all of it properly. **A line at the decision point
should describe the decision, not pre-empt the FAQ.**

**Traynor.** *"I cannot cost it, and that is itself the argument."* No code redeemed, no analytics
event on that screen, `GTM-CHARITY-06` says the funnel cannot be counted. **Given that, the
cheaper mistake is the shorter screen.**

⚠️ **Q3b explicitly rejected.** Do **not** swap it for a line naming injury history. Same
conversation, more alarming words, and the policy already does it properly.

## String 4 · the zero case — **SHAPE ONLY, and two questions go down**

P-04 is not built. The SLT gives the shape; the founder writes the words.

**1. A threshold, below which the block says nothing. — Hutchinson, and it outranks the copy.**
One week of all-drifted runs is **not reliably a coaching signal.** On three runs it is n=3 with
no control for terrain, heat, illness or a badly-seated strap. We hold `hr_above_ceiling_pct` and
nothing else, so we cannot distinguish *"ran too hard"* from *"ran up a hill in August."*
⚠️ **The precedent is our own:** `ZONE_DRIFT_ABOVE_CEILING_PCT` was derived from **n = 42** and its
principle says *"thin, re-measure once the cohort grows"*; `RUBRIC-GAPS-01` froze `WEEK1-LEAP` on
the same reasoning. 🔻 **The number is a Coaching Board decision, not an SLT one.**

**2. `unknown` runs leave the denominator.** *"None of 4 held the zone"* when two had no HR is
**a false statement**, and it is the one a free-tier runner would see most. 🔻 **Also routed down.**

**3. The zero case points at the next easy run, not at the week. — Wood.** The failure mode of
*"none held the zone this week"* is not that it is harsh; it is that it is **global**, and reads
as a verdict on the runner rather than on four runs. **No cause** (we do not have one — hard rule
8). **No action** (the plan does not change for one week's drift; inventing one manufactures
work). **Narrow the window.**

⚠️ **Wood's structural note, which outranks the wording:** *"if this block only ever appears when
there's something to say, it becomes a thing people dread opening."*

---

## Conflicts

- **Traynor vs the room on String 1.** Resolved above: the upgrade-legibility argument fails
  because the word is invisible to the runner it would have to persuade. **Recorded, not
  synthesised away** — it is the best case for the other side.
- **Sutherland vs Fried on String 2** — amplify versus shorten. Not a real conflict: one edit
  satisfies both.
- **Nobody defended String 3.**

## Routed down to the Coaching Board (ADR-017)

**Before P-04 is built:** (a) the minimum analysed-run count below which the compliance block
renders nothing, and (b) whether `unknown` runs leave the denominator. Both are coaching
decisions about what we can honestly claim from the data we hold. **The SLT did not set them.**

## MUST/NEVER

Clean, and **two of the three rulings REMOVE risk**: cutting String 3 takes an unasked-for claim
off a decision point; cutting String 1's words removes jargon. No gamification, no modal, no
hardcoded colour — the P-01 tokens are untouched and `zoneVerdictColour` is unchanged.

## Risks to existing features

`zoneVerdictLabel`'s contract changed, so its test was **amended to assert the new contract rather
than deleted** — the obvious instinct is to put a word back, and that test is where it gets
caught. `ExternalLink` stays on the privacy link, which is what `externalLink.test.ts` protects.
