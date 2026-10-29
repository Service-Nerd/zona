# Coaching Board: comparison page 7, a first marathon around a full-time job (2026-10-29)

**Trigger:** W-03 precedent: coaching claims on a marketing surface (`/marathon-training-plan-full-time-job`, founder's
final copy 2026-10-29). Page 6 sat the same way (`coaching-2026-10-23-page6-claims.md`).

## Measured before the board spoke (today's engine, the published plan as `/plans/marathon-16-week` builds it)

16 weeks; 5 runs every week; peak **64.5 km** (week 7, 11, 12), longest run **29.5 km**; weeks 1–5 hold no hard session
but the 5K time trial (week 4), with strides in weeks 3 and 5. **Week 1 is 50.0 km with a 14 km long run.** The plan is
generated for `current_weekly_km: 45`, `longest_recent_run_km: 20` (`lib/marketing/plans.ts`). The *"assumes about 30
minutes without stopping"* line exists on `/charity-runners` (FAQ) and is not derived from any plan input.

## Conflict scan

- **§7 (and Am.1, the long run is a hard day for spacing):** 48 h between the harder session and the long run. The
  page's Thursday-hard / Sunday-long holds it; its rule *"keep the two easy runs apart from the long run"* does not say
  §7, and its own Saturday easy run is the day before the long run.
- **S2 (StrengthPrinciples):** heavy legs never the day before a hard run, nor within two days after one, nor on a long-run
  day; preferred stacked on the quality day after the run. **Monday** (after Sunday's long run), **Wednesday** (before
  Thursday's harder run) and **Friday** (two days before the long run) all break S2 for heavy legs.
- **§117 Am.5 / §45 / §2:** readiness is the longest run; load rises gradually. A runner who can run 30 minutes and starts
  a plan whose week 1 is 50 km with a 14 km long run is the jump these sections exist to prevent.
- **§8 / §1:** one harder session in four runs: consistent.

## Seats

🩹 **Willy (binding on load).** The 30-minute line is the one sentence on this page that can hurt someone. Thirty minutes
is roughly 4–5 km. Week 1 of the plan it points at is 50 km with a 14 km long run. A first-timer who reads "you can
start" and does that is the exact acute spike this board spends its time preventing. The truth is the plan's own start
point, stated in numbers.

🏃 **Hutchinson (chair).** The Damsted paragraph is honest: it reports thin evidence as thin and says what that does and
does not license. The novice study is framed as a warning, not a statistic for the event. Keep both. *"Hard running on
a tired week mostly buys you a lost weekend"* is first-person judgement and reads as such. The plan numbers must be
read from the plan, not typed, as page 6's were.

🎯 **McMillan.** The cut order is what I tell working runners: shed the second easy run, soften the hard day, protect but
shorten the long run, never stack a missed one. Four runs is a real marathon week for this population. The day rule
should say the thing that matters: the hard session and the long run are not neighbours.

💪 **Blagrove.** "Off, or strength" on Monday, Wednesday and Friday puts heavy legs where our own S2 forbids them on all
three days. Upper body is fine anywhere; heavy legs go on Thursday after the run.

📊 **Seiler.** No objection: one quality session in four runs is a defensible distribution for this runner.

⚕️ **Sims.** No objection from this seat; the novice study is mixed-sex and framed as a warning.

## Ruling

**CORRECT WITH AMENDMENT** (three changes, words for the founder to approve):

1. **The start point (Willy, binding).** Replace *"A 16-week plan also assumes you can already run about 30 minutes
   without stopping. If you can't, build that first, before week one."* with the plan's own numbers, read from it:
   *"The 16-week plan on this site starts at about 50km in week one, with a 14km long run. It is written for someone
   already running about 45km a week with a 20km long run behind them. If that is not you yet, build up first, before
   week one."*
2. **The spacing rule (§7).** Replace *"keep the two easy runs apart from the long run"* with *"keep the harder session at
   least two days away from the long run"*.
3. **Strength (S2, Blagrove).** Replace *"Monday, Wednesday and Friday are off, or strength work if you do it."* with
   *"Monday, Wednesday and Friday are off. If you lift, do the heavy leg work on Thursday after the harder run."*

Everything else stands. The plan facts (16 weeks, five days, peak, the first five weeks, the start point) are
interpolated from the generated plan, never typed, and a page-7 claims test holds them.

## Artifacts

No new principle, numeric or invariant: the page is held to §7, S2 and §117 Am.5 as written. Check:
`lib/marketing/page7Claims.test.ts` (the numbers come from the plan; the three replaced sentences are gone).

## Also found, filed separately

`/charity-runners` FAQ says *"The plans assume you can already run about 30 minutes without stopping"*: false for the
marathon (45 km / 20 km) and the half (35 km / 14 km) plans it links. Same harm, live today. Filed
`CHARITY-PLAN-PREREQ-01`.

## SLT escalation

None.
