# Coaching Board — GTM-SEO-COMPARE-01 page 6 claims (2026-10-23)

**Trigger:** a physiology and product claims review of a live marketing page (`/why-your-easy-runs-arent-easy`,
`lib/marketing/articles.ts` COMPARISON 6), routed here by the filing rule and the W-03 precedent. No doctrine file
changes; the founder asked for the sitting and said to make the hard-session wording true.

**Proposed change.** Confirm each coaching claim on the page against the constitution and amend only what it
contradicts.

## Conflict scan

| Claim on the page | Doctrine | Result |
|---|---|---|
| Zonna uses five zones; Z2 easy, Z3 the grey zone; the three-zone papers' middle band is the grey zone | §14; the board's zone-model rule | **Consistent.** The page does the translation this board requires of itself |
| Talk test first; if it and the watch disagree, trust the talk test | §14 Am.4 ("a ceiling, not a target; the talk test stays FIRST") | **Consistent** |
| Age formulas (220 − age, Tanaka) are estimates with an error that matters | §50; §14 Am.3 (Tanaka is male-derived and widens through the menopause transition) | **Consistent**; Am.3's sex caveat is not on the page (see Sims) |
| HR drifts with duration, heat and dehydration | §61 (heat, drift ≥12 bpm as named limiters) | **Consistent** |
| "Slowing right down… you can end up training easier than you meant to" | §12 Am.1: below the cap breaks no principle | **Consistent as worded**: it describes, it does not call easy a failure |
| Low intensity takes the largest share of well-trained athletes' time; no ratio claimed | §1 (session counts, CD-19) | **Consistent**: no ratio is asserted |
| "A plan has one or two hard sessions a week"; "Most sessions… with one or two hard ones a week" | §8 ceiling 0 / 1 / 2 by level and goal; §110 Am.2 (a finish-goal beginner gets none) | **CONTRADICTS §8 / §110 Am.2** for 9% of plans (measured on 5,664: 79% never exceed one, 11% have weeks with two, 9% have none) |
| "You still need harder work to get faster"; "Keep one run a week properly hard" | §110 Am.2: a beginner on a finish goal **correctly** receives no quality ("for a first marathon the limiter is tissue and time on feet"); §8 Am.1 | **CONTRADICTS §110 Am.2** for a new runner, as general advice with no qualifier |
| Grey zone "not hard enough to build much speed" | — | Simplification; accepted (Seiler, below) |
| "Give it a month… the pull is strongest around week three" | page 3's ruling (Am.3): a month is defensible as how long to withhold judgement, not as an adaptation curve | **Consistent**: framed as behaviour |

## The board

**🏃 Hutchinson (chair).** Most of this page is more careful than the category it is answering, and it says where its
evidence is thin. Two sentences assert things our own engine refuses to do. A page that tells a new runner to make
one run a week hard, while the product withholds hard running from that runner on purpose, has published a position
we do not implement. That is this repo's most recorded failure, and it is on the open web.

**📊 Seiler.** The zone translation is right, and it is rarer than it should be. "Largest share of training time" is
what the data showed and the page stops there, which I want kept. "Not hard enough to build much speed" undersells
threshold work for a trained runner, but the page's subject is the runner who does it every day by accident, and for
that runner the sentence is fair. No change.

**🎯 McMillan.** "Keep one run a week properly hard" is good advice for the runner who has been at it a year and runs
everything medium. It is the wrong first move for someone six weeks in, and this page will reach both. One clause fixes
it. The heart-rate-then-feel advice after an hour is how I coach it too.

**🩹 Willy.** The hard run is the injury vector for a novice, because their aerobic system adapts faster than their
tendons. Our engine knows that, which is why a finish-goal beginner gets strides and hill strides, not intervals. The
page should say the same thing in one line. **Binding from this seat:** the beginner qualifier.

**⚕️ Sims.** The max-HR paragraph is fair. I would add that the formulas were built mostly on men and drift further
for women through the menopause transition (§14 Am.3), but that is a strengthening, not a correction. Recorded, not
required. Heat drift also runs higher in the luteal phase; same status.

**💪 Blagrove.** Not a strength question. No objection from this seat.

## Recorded disagreements

Sims would add the sex caveat to the max-HR paragraph; Hutchinson holds that the paragraph already says "you probably
have not measured" and that a second caveat in one paragraph costs the reader more than it gives. Not settled; not
required for the page to be correct.

## Ruling

**CORRECT WITH AMENDMENT.** Two changes, everything else stands:

1. **The hard-session sentences state the ceiling, not a count every plan has.** No week has more than two; most have
   one; some plans have none. The number comes from `GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX`, so the copy
   cannot drift from §8.
2. **The "harder work" advice carries a beginner qualifier** (Willy, binding): a new runner gets faster from easy
   running alone at first, and Zonna gives a beginner on a finish goal no hard sessions (§110 Am.2). Words are the
   founder's.

## Artifacts

1. **Principle** — none new. The page is brought into line with §8 and §110 Am.2.
2. **Numeric** — none new. The copy interpolates `QUALITY_SESSIONS_PER_WEEK_MAX` (the maximum across levels).
3. **Check** — a marketing test that the page's session ceiling is derived from that config, and fails if the copy
   states a per-week count as a literal.

## SLT escalation

None.
