# Competitor analysis: Runked (2026-10-30)

**Asked by:** the founder, after finding the app and sending its *"train hard. rest smart."* fitness and fatigue screen:
*"I like things like this and we need more (where it adds value)."* Written as marketing director. **This is analysis, not
a build list.** Every opportunity is filed in `backlog.md` behind the gate in
`docs/plans/COMPETITOR-RUNKED-01.md`: nothing is built until our own surfaces and Runked's are compared and the right
board has ruled.

## What Runked is (sources below; checked 2026-10-30)

- iPhone-only running app (iOS 17+), one developer (Oktay Kurt), v1.0.0 on 16 April, v1.2.2 on 22 October.
  **3.9 stars from 7 ratings**, no independent reviews found. Early, well made, no proven audience.
- A game over a training app: every run earns trophies toward a rank, Bronze to Olympian, scored *"on effort relative to
  your own fitness"*. Leagues, streaks, XP, reward chests at 7/30/60/100/365 days, gems, a store, leaderboards, a mascot.
- Under it: 5K to marathon plans, race predictions, "Runner DNA" (Endurance, Threshold, Pacing, Speed, Climbing,
  Consistency), fitness and fatigue trends with Training Balance and Load Ratio, Garmin and Apple Health sync, GPS.
- **No free tier.** $59.99/year (7-day trial) or **$11.99/week**. A second $39.99 yearly product exists unexplained.
- Content: **66 guides and 11 comparison pages**, honest in tone (a "where it falls short" line for every app, itself
  included).

## The screen the founder liked

Fitness (≈ six-week weighted load) and Fatigue (≈ one-week) on one chart, a named band (*"58 · Solid"*), and a coloured
scale from Starting to Exceptional. Their guide gives windows, not a formula, names no per-run stress score, and cites
Gabbett 2016's *"danger zone"* above an acute:chronic ratio of 1.5, a contested figure. It does not claim to predict
injury.

## What they do well

1. **One readable picture of an abstract idea**: a runner reads the screen in two seconds.
2. **Effort over pace**: a beginner's hard week can out-score a fast runner's easy one. Inclusive, and near our ground.
3. **Content volume** on our subject: zone 2, 80/20, overtraining, recovery-run pace.
4. **Honest comparison tone**, which is ours too, at eleven times our volume.
5. **Breadth**: 11 languages, Garmin sync, an Apple Watch workout, race predictions.

## What they do badly, and our opening

| Theirs | Ours |
|---|---|
| The game rewards **more** running: streaks, chests, leagues, leaderboards | We are the app that tells you to slow down. **A product built on streaks cannot say "rest"**: costly signalling, our strongest contrast |
| A borrowed fitness/fatigue model, explained loosely, leaning on a disputed ratio | We already compute an acute:chronic ratio and show it as a shape (`LoadShape`); an honest version is on-brand |
| No free tier; the trial is the only way in | Our 5K, 10K and half plans are free in full, for good |
| $11.99 a week (~$620 a year) | No trap plan |
| Mascot, gems, chests | Our day-job runner is the person this design turns away |

## Opportunities (each filed; none built yet)

1. A readable load picture, done our way → `RUNKED-LOAD-VIEW-01`
2. A comparison page answering the gamified apps → `RUNKED-COMPARE-PAGE-01`
3. An easy-running guide series on the searches they own → `RUNKED-GUIDES-01`
4. "Effort, not pace" in our own voice → `RUNKED-EFFORT-MESSAGE-01`
5. Garmin, which they advertise → `RUNKED-GARMIN-01` (Garmin runs already reach us through Apple Health)

**Not to copy:** ranks, streaks, chests, leaderboards. They contradict the positioning and reward the behaviour we exist
to correct. Take the readable picture, not the game.

## What this does not establish

Runked's downloads, revenue or retention (no public data beyond 7 ratings; Similarweb estimates not pulled). Nothing here
has been seen inside their app: the analysis is the founder's one screenshot, their site, guides and App Store listing.

## Sources

- https://runked.com/ · https://runked.com/pricing · https://runked.com/guides
- https://runked.com/guides/training-load-fitness-fatigue · https://runked.com/compare/best-running-apps-2026/
- https://apps.apple.com/us/app/runked-ranked-run-training/id6754697782
