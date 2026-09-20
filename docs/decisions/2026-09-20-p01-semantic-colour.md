# Decision note — P-01: semantic colour pair

**Date:** 2026-09-20 · **Owner:** Russ · **Status:** PROPOSED, awaiting sign-off
**Gate:** §4A — palette. **Blocks:** P-04, P-13, and therefore P-06 and P-11.
**Does not block:** P-03.

---

## What is proposed

Re-point moss and amber at **zone discipline**.

| Token | Means today | Would mean |
|---|---|---|
| `--moss` `#6B8E6B` | done / active / complete | **held the zone** — completion where intensity was correct |
| `--warn` `#B8853A` | warning / coaching | **cooked it** — completion where intensity drifted above target |

No new tokens. No new screens. The values do not change; their **meaning** does.

## Why now — the argument is evidence, not taste

The teardown screenshots settle a question that was previously an opinion.

**Miles's palette is ours.** Their ground is a warm off-white within a shade of `--bg` `#F3F0EB`.
Their accent is a muted green within a shade of `--moss` `#6B8E6B`. Their cards are white with a
soft warm shadow. Their eyebrow labels are small-caps letterspaced grey. Put `IMG_7174` next to our
wizard and the difference is the wordmark.

So: **warm-neutral-plus-single-green is the category default, not our differentiator.** We did not
choose a distinctive palette; we chose the same one as everyone else, slightly earlier.

What *is* structurally unavailable to a beginner-first competitor is a colour that means
**"you ran too hard."** Miles cannot ship it — their whole proposition is encouragement, and their
review carousel sells *"finally stuck with it."* A colour that reproaches the user is incompatible
with that product and entirely compatible with ours. It encodes *"You're trying hard. That's the
problem"* into the design system rather than the copy.

## What it changes

Every completion state in the app changes what it *says*, not how it looks: session cards, the Plan
calendar, `ZoneBar`, `ZoneRings`, the Me state dots, and P-04's new block.

**No engine change.** The signal already exists — `run_analysis.hr_above_ceiling_pct` and
`hr_in_zone_pct` are computed today and already fetched into `runAnalysisMap`
(`DashboardClient.tsx:1195`). This is a render-layer reinterpretation of data we already hold. No
migration, no new field, no change to what is prescribed.

## ⚠️ The collision that makes this a decision rather than a ticket

**Amber is already spoken for, twice.**

1. `--warn` `#B8853A` is the coaching and warning colour across the app — the §80 difficulty note,
   the reframe risk gate's amber rail, the stale-benchmark dot on Me.
2. `--s-race` `#C86A2A` is the race-session accent. **And Miles uses amber for the race week too**
   (`IMG_7181`, the W8 bar) — so this is not a quirk of ours, it is what the colour naturally reads
   as in a training chart.

If amber starts meaning *"you went too hard"*, a race week drawn in amber reads as a reprimand for
racing. Three ways out:

| Option | Trade |
|---|---|
| **A — Scope the meaning to completion states only.** Amber means "cooked it" *only* on a completed session; prescriptive surfaces (race accent, coaching notes) keep today's meaning. | Cheapest and safest. Cost: the pair is contextual, not absolute, so it is slightly weaker as a learned language. **My recommendation.** |
| **B — Move the race accent off amber.** `--s-race` becomes something else; amber is reserved for drift. | Cleanest semantics. Cost: touches the session colour map, which is documented in three places and guarded by `sessionColourReach.test.ts`. |
| **C — A third colour for drift.** Leave moss and amber alone. | No collision. Cost: a fourth accent on a palette whose whole discipline is one accent — and it breaks hard rule 5 unless a token is added, which is itself a §4A gate. |

## Alternatives considered and rejected

- **Do nothing.** Defensible until the screenshots. Now the honest position is that our palette is
  the category's, and we have a differentiator available for the cost of a token comment.
- **Change the palette instead.** Wrong problem. Warm Slate is good and recent (ADR-007); the issue
  is not the hues, it is that they carry no proprietary meaning.
- **Say it in copy instead of colour.** We already do — *"Bit keen. Ease it back."* Copy is read
  once; colour is read at a glance, every time, and survives the runner not reading.

## What it costs to reverse

**Low, and that is the strongest argument for trying it.**

- Reversing is editing token comments and the one predicate that decides which token a completed
  session gets. No data migration, no plan regeneration, nothing persisted encodes the meaning.
- The sunk cost is the **sweep** — once every completion surface reads from one owner, unwinding
  means touching those surfaces again. Estimate: the same M-sized sweep, run backwards.
- The real cost of reversal is **user relearning**, and it is small while the user base is small.
  It rises steeply after ~500 charity runners arrive in October. **If this is going to happen, it is
  cheaper before the cohort than after.**

## If approved, what must ship with it

1. Both meanings resolve from `globals.css`. No component hardcodes either value.
2. **One owner** for "did this session hold the zone" — a single predicate, not a copy per component
   (D-16). This repo has paid for parallel classifiers repeatedly.
3. The race-week collision resolved explicitly by one of A / B / C, written down.
4. Documented in `ui-patterns.md`, so the next component inherits the meaning instead of guessing.

## One consequence to accept knowingly

The amber meaning is only ever **visible** to runners who have run analysis, which is PAID
(`activity_intelligence`). A free runner sees moss-for-done and never sees amber.

That is not a blocker — but it means **the free tier learns the rule and never sees itself scored
against it**, which is the same tension P-04 raises. It is worth deciding both at once.
