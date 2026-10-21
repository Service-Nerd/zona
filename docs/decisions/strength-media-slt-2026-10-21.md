# SLT — buy RepDB for strength demo media? (STRENGTH-MEDIA-01, 2026-10-21)

**Asked:** founder: *"Its an investment so we do need to weigh up return on investment."*
**Tier:** PAID (strength is in the subscription, SLT 2026-10-17). **Inputs:** `strength-media-repdb-2026-10-21.md`
(63 / 18 / 17 of 98), `strength-media-placement-2026-10-21.md` (Design Board, conditional).

## The numbers (production, read-only, 2026-10-21)
- Accounts: **49** (45 excluding obvious test addresses); 29 created in the last 30 days, **1 in the last 7**.
- Subscriptions: **21 rows, all `is_comped`** (Make-A-Wish offer codes). **Paying subscribers: 0. Revenue: £0.**
- In trial now: 6. Strength users: **1** (admin-only, the founder).
- Price: `BRAND.PRICING` (monthly and annual). Break-even on $499 (≈ £385 at ~0.77, rate not checked), after UK VAT
  and Apple's 15%: roughly **70 paid subscriber-months, or ~9 annual subscriptions**. With the female bundle ($598),
  ~85 / ~11. Rough figures: VAT treatment and the exchange rate are assumptions.
- ⚠️ The commercial seat (Traynor) stays stood down: its recall trigger is revenue, a trial-to-paid rate, a redeemed
  funnel or meaningful installs, and none exists. So nobody here can price churn or conversion; this is a judgement,
  not a forecast.

## Seats
- **Sutherland.** Demos are a costly signal: a strength section with real animations says "this is a proper
  programme", and that matters most at the paywall, where strength is part of what is being bought. But a signal
  needs an audience; today it has one viewer. Buy it the week strength goes on sale, not before.
- **Fried.** $499 is the cheap part. The cost is the build: the player, hosting, the recolour step, checking 63
  animations, and deciding what the 17 gaps get. Strength is not released, media is not needed to release it, and no
  runner has asked how to do a lift. Ship strength, then see.
- **Hutchinson.** Correctness first: these are AI-generated figures. A demo with a rounded back on a Romanian
  deadlift is a coaching error with a picture. The strength seat reviews the free preview bundle before any money is
  spent, and every licensed clip before it ships (S-principles: technique before load). That review is free and can
  happen now.
- **Wood.** A demo changes behaviour at one moment: the first time someone faces an unfamiliar lift, it removes the
  guess. That is real. Note what it does not cover: the 17 gaps are mostly the plyometrics (pogo hops, drop jumps,
  bounding), where technique matters most and the injury risk sits. Buying RepDB solves the easy 64%.
- **Zhuo.** State the success condition before buying: the share of strength sessions in which a runner opens an
  exercise row. We do not measure that today. Measure it after release: if nobody opens rows for the cues, nobody
  will open them for an animation either.

## Conflicts
- **Sutherland vs Fried:** buy to strengthen the paywall at launch, or wait for evidence of use. Settled by order:
  release first, then the trigger below, which is soon after launch either way.
- **Wood vs the purchase:** the coverage gap is where demos matter most. Unresolved: commissioning the 17 (Custom,
  from $999) is a separate decision once the 63 have proven their worth.

## Recommendation: NOT YET. Release strength without media; buy on a trigger
1. **Now (free):** download the free preview bundle; the strength seat checks form on its figures. If they fail,
   RepDB is out and nothing was spent.
2. **At release:** record when a runner opens an exercise row (one ops event, no PII), the success measure.
3. **Buy RepDB Standard when both hold:** strength is on sale, and row opens show runners looking for how to do the
   lifts. The female bundle with it: the audience is mixed.
4. **The 17 gaps:** a separate decision after that, priced against Custom.

## MUST/NEVER check
No embedded YouTube, self-hosted (ruled); no gamification; licence allows recolour (Design Board condition met). The
row-open event must carry no personal data. Nothing here touches what the engine prescribes.

## Risks to existing features
None until built. The media player touches `StrengthSessionScreen` and `strengthScreens.markup.test.ts`.
