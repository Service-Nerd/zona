# SLT — 2026-09-20 — commercial & monetisation, all six open items

**Convened because** the founder asked for the commercial category to go to the SLT and for the
answers to come back to him. Reviewed as a batch: four of the six are the same question wearing
different clothes — **is the thing we say about the product true of the product?**

**Standing constraint, all session:** 95.9% fit-for-purpose must not be spent. Nothing ruled here
changes what the engine prescribes.

**Outcomes:** 1 **FIX THE CODE** (shipped) · 2 **FIX BY DELETION** (shipped; words + real fix
escalated) · 3 **DON'T BUILD, closed** · 4 **DEADLOCKED, (c) refused** · 5 **split: model mine,
conclusions his** (shipped) · 6 **unblocked, without the competitor's price**.

---

## A correction to my own submission, before anyone spoke

I told the board Item 1 blocked copy for a paywall that is not built. **That understated it.**
`app/page.tsx:237` reads *"Two weeks, full access"* and `BRAND.signupSub` reads *"14 days, no
limits"*, both live. It was a present false claim, and the board's reading of its priority
changed because of it.

---

## Item 1 · `TIER-TRIAL-CONFIDENCE-01` — **FIX THE CODE**, unanimous

**Fried settled it in one line:** *"`featureGates.ts` already says trial is allowed. The enricher
is the one file that disagrees with the gate layer. You do not convene anyone to make two files
agree."*

**Sutherland:** *"'No limits' is not marketing, it is a promise, and you are breaking it on
precisely the artefact that proves you thought about the person."*

**Traynor on Q1b — the token cost:** *"Sonnet tokens on trial users who never convert is what a
trial IS. You cannot run a reverse trial and then flinch at the cost of the thing being trialled."*

**Hutchinson:** meta fields only, cannot touch a numeric (ENRICH-ATTRIB-01). No prescription
change, no Coaching Board.

**Wood:** neutral. Feedback on a plan, not a change to the context a runner decides in. A promise
question, not a habit one.

⚠️ **Shipped at the root, not the symptom.** `tier !== 'free'` would have been correct today and
would still be a second copy of a rule `featureGates` owns. It now asks `isFeatureAllowed`.

## Item 2 · `TT-PRICING-CLAIM-01` — **FIX BY DELETION**, before the cohort

**Sutherland:** *"You have written a specification you do not meet on 58% of plans. Cut to what is
always true and you have a better line and no exposure. That is not softening to meet the product,
it is deleting a claim, which is the opposite."*

**Traynor on Q2b:** fix it before the cohort, and not for legal reasons. *"A charity is putting its
name next to ours in front of 500 people, and 'we say it comes from your running and on most plans
it doesn't' is the single worst sentence anyone could write about us."*

🔴 **Hutchinson — the ruling that matters, and it is not about the adjective.** *"We render a
projection derived from two wizard answers in the same typeface, with the same confidence, as one
derived from a measured benchmark. An experienced runner who gave us 'about 25k a week' and got
back a finish time to the minute will conclude, correctly, that we made it up. The honest fix is
not in the pricing copy — the projection itself should say which of the two it is."*
**Filed as `TT-PROJECTION-PROVENANCE-01`, P1.**

**Traynor on Q2c — the more valuable half:** *"`pricing.test.ts` proves every paid gate has a row,
and nothing proves any row is true. We found this one by accident. There are others."*
**Filed as `PRICING-ROW-TRUTH-01`.**

## Item 3 · `GTM-FREE-HOOK-01` — **DON'T BUILD. Closed.**

**Fried:** *"The free tier's retention mechanism was never a weekly insight — it is the plan.
Someone with a 16-week plan has a reason to open the app 16 weeks from now. Do not build a second
one."*

**Wood, kill mandate, and not where I expected it:** the insight is **not** the
illusion-of-progress class. **What she killed is the proposed fix.** *"A push notification to a
lapsed free user is, structurally, a motivational prompt aimed at someone whose context has not
changed. It makes the phone buzz. That is the thing this product exists in opposition to, and we
do not get to do it because it is OUR buzz."*

⚠️ **Her structural note outranks the rest:** *"a lapsed free runner has usually not lapsed from
Zonna, they have lapsed from running. A notification cannot fix that and pretending otherwise is
the illusion."*

**Q3c answered explicitly: this is doctrine, not economics.** Cost was never the question.

## Item 4 · `TT-FREE-BENCHMARK-01` — **DEADLOCKED**, and (c) refused

**(c) refused by Hutchinson, wearing the Coaching Board chair.** He will not carry it down: §78
exists because a stale VDOT propagates for a whole plan, and a beginner is the runner most likely
to have one. **Not available as tidying.**

**(a) Fried:** the tile is already honest and already the upgrade moment. One-time grants create a
"once" the user must understand, a state to track, and a category of support email.

**(b) Wood, with the argument nobody had made:** *"a free runner who runs a maximal 5K and watches
nothing happen learns THE APP DOES NOT RESPOND TO ME. That is a learned association, and it is
expensive."*

**Hutchinson on correctness:** (b) is coaching-correct — the same pure function already ruled
correct, applied once, still prompted and confirmed under ADR-014. **So (b) is a tier decision,
not a correctness one.**

🔻 **Deliberately not synthesised.** It unblocks on somebody seeing `RecalibrationTile` on a
device, which nobody has done.

## Item 5 · `FIN-APPLE-COMMISSION-01` — **split, as proposed**

**Traynor: the correction is the assistant's, the conclusions are the founder's.** He named the
three decisions that move rather than shrugging at "does it change anything":

1. **The ~90-day kill threshold** was judged against gross. Break-even moves out ~15%; **the kill
   date should not move with it.**
2. **`GTM-11`'s £7.99-vs-£9.99** compared two gross prices to a gross cost base. Net it is £6.79
   vs £8.49, and the gap that argued for the higher price narrows.
3. **Apple Search Ads.** A 15% haircut on lifetime revenue against an unchanged CAC is the
   difference between viable and not at a given CPI.

🔴 **And a fourth, which I had missed:** *"web purchases do not pay Apple. Nothing in the repo
models the two channels differently, so the blended figure is wrong in both directions."*

## Item 6 · `P-09` — **unblocked, WITHOUT the competitor's price**

**Sutherland:** *"The moment you say 'cheaper than Miles' you have entered their frame and made
price the axis. You are not the cheap one, you are the one that tells people to slow down."*

**Traynor, same verdict, commercial reason:** we cannot maintain a claim about someone else's
pricing, and the first time it goes stale we look careless.

⚠️ Would have been a §4A brand gate. **Refused before reaching it.**

---

## Conflicts

- **Fried vs Wood on Item 3 — same verdict, different reasons, both load-bearing.** Fried's alone
  would permit a gentler in-app hook; Wood's forbids the category. Recorded separately so a future
  proposal must clear both.
- **Hutchinson vs Sutherland on Item 2 — a real disagreement about where the defect is.**
  Sutherland's fix is cheap and correct today; Hutchinson's is the real one. **Sequential, not
  exclusive**, and the second is now its own P1.
- **Fried vs Wood on Item 4 — unresolved and left unresolved.** The one item deliberately not
  synthesised.

## MUST/NEVER

Clean, and **two rulings remove risk rather than adding it**: Item 2 deletes a claim, Item 3
refuses a notification. No modal, no hardcoded colour, no gamification, no competitor framing.

## Risks to existing features

Item 1 changes `enrich()` output for trial users only; the fitness harnesses never call AI, so it
cannot move 95.9% — **proved, not assumed** (`measure:envelope` unchanged). Item 2 touches
`lib/marketing/pricing.ts`, which `pricing.test.ts` reads by `gate` only, so the `detail` edit is
safe; the em-dash guard still covers the surface.

## What none of this proves

**No revenue exists.** No code redeemed, no subscription sold. **No funnel instrumentation on any
of these surfaces** (`GTM-CHARITY-06`) — whatever was decided here, we will not be able to measure
whether it worked. **Nothing has run on a device**, which is the explicit blocker on Item 4.
