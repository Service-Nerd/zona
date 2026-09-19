# SLT — 2026-09-19 — base-building plan for the sub-12 km/week charity marathoner

**Escalated by:** Coaching Board, same day (`coaching-board-2026-09-19-s111-subfloor.md`).
Hutchinson carried it, wearing the SLT hat.

**Question:** build the base-building plan type before October, ship something cheaper, or
accept that §111 refuses an unknown share of 500 Make-A-Wish runners at the door?

**Tier:** **PAID** — marathon generation is `free_tier_available: false` (`route.ts:114`) and
the charity cohort are comped to paid. The refusal screen stays FREE. ⚠️ A base-building plan
built as a separate object must not become a free back door into marathon generation.

**Ruling: BUILD DIFFERENTLY. Do not build the base-building plan type before October.**

---

## The fact that reframed the question

§111 refuses inside `generateRulePlan` (`finalise()`); `composePlanWithFoundation` runs
**after**, at the API route (ADR-020). **So a foundation block can never rescue a refused
runner — the refusal throws before the block is composed.**

And the arithmetic nobody had: a 3-week block at `FOUNDATION_WEEKLY_INCREASE_PCT` (10%) takes
10 → 11 → 12.1 → **13.3 km/week**. The door is **12**. At `current_weekly_km` 12 the plan is
**20 weeks against a 29-week race**, so the runner has **~9 weeks of pre-plan runway, of
which the engine will use at most 3**.

**The runner is refused for lacking a quantity the engine could hand them in a fortnight,
while sitting on nine weeks of calendar.**

---

## The board

**🧠 Sutherland.** *"We have built an app whose entire thesis is 'do less', and the first
thing it says to the one audience that has never heard that message is 'you are not doing
enough yet, go away and do more.'"* Not a bug in a ratio — the product contradicting itself
at the only moment 500 people are paying attention. **The base-building weeks are not a
consolation prize for the under-prepared; they are the most on-brand product we will ever
ship.** Whoever framed this as "the runner is below the bar" has the telescope the wrong way
round: the bar is where the product starts.

**📦 Fried.** Disagrees with the framing, not the answer. *"That is not a new plan type. That
is an ordering problem."* The mechanism exists, is governed, and simply runs too late. **Do
not ship a 20-week plan type in six weeks for a population nobody can size** — that is how a
roadmap gets eaten.

**🏃 Hutchinson.** The Coaching Board did not deadlock and did not say no; it said the two
mechanisms put to it fail on measurement. On Fried's cheaper route: *"crediting a runner for
a foundation block they have not yet done is not the same as observing that they run 13 km a
week."* Willy's objection to self-report was that it is unverified; **a planned block is not
even claimed**, and this cohort's defining risk is that they drop out. Far smaller question
than a new plan type, and answerable — **but it goes back to the Coaching Board before it
becomes a build.**

**🔬 Wood.** Names what the refusal screen does behaviourally: *"You have handed them a goal,
no structure for reaching it, no context change, and no return trigger. That is a pure
motivation intervention, and motivation is the weakest lever there is."* The predictable
outcome is not that they build to 12 — it is that they close the app and come back in
February, frightened. **Kill mandate used on one thing: do not build a 20-week base-building
plan type as a separate product surface.** A second plan object with its own screens, state
and edge cases, for an unsized population, six weeks before a deadline, is the
illusion-of-progress class at the architecture level.

**💰 Traynor.** Three facts. **(1)** The refusal costs no revenue — these runners are comped.
It costs the *relationship*: the charity's stated pain is that people who take a place do not
run it, and our answer to their least-prepared is a door. **If Jack hears that from a runner
before he hears it from us, the partnership conversation changes shape permanently — that is
the asset at risk and it was on none of the tables.** **(2)** *"The cheapest thing on this
list is not a plan type — it is asking the charity what their runners' weekly mileage looks
like."* They recruited them; they know. An email, not a sprint. **(3)** A new plan type opens
a new schema object in a codebase where `week_n` collided across seven tables this week.

---

## Conflicts

- **Sutherland vs Wood/Fried on ambition.** *Reconcilable, and the resolution matters:*
  Sutherland is right about the **positioning**, Wood and Fried about the **object**. The
  base-building weeks should exist; they should not be a second plan.
- **Fried vs Hutchinson on the cheap fix.** An ordering problem versus a coaching question
  about crediting unperformed training. *Unresolved here by design* — it routes down.

---

## Recommendation, in order

1. **Ask Make-A-Wish what their runners actually run.** Free, founder-owned, folds into the
   `GTM-CHARITY-08` message already going to them. Converts the central unknown into a number
   before anything is committed. **No cost, no risk, should not wait for the others.**
2. **`S111-FOUNDATION-CREDIT-01` → Coaching Board.** May §111 measure against the volume a
   *planned* foundation block would reach? ⚠️ Flagged by both Hutchinson and Willy; not a
   foregone conclusion.
3. **Fix the refusal screen's BEHAVIOUR, not its copy** (Wood). Stands whatever else happens.
4. **§111's sawtooth stays open** behind `S52-LOPSIDED-BOUND-01`, as the Coaching Board
   sequenced it.

## MUST/NEVER

✅ No gamification, no popups, no new surface · ✅ pricing and tier logic untouched ·
⚠️ *"Free Users Are Never Abandoned"* is not violated (a refusal is not a tier gate) **but its
spirit is squarely engaged** · ⚠️ item 2 changes what the engine prescribes — Coaching Board
before build (ADR-017) · 🚨 item 1 is outward-facing and the founder's to send.

## Risks to existing features

`baseVolume.ts` / `INV-PLAN-BASE-BUILD-RATIO` (one owner, must not split) ·
`foundationCompose.ts` (ADR-020 single owner of `plan.weeks` mutation) · `REFUSAL-SCREEN-01` ·
`startVolume.ts` (where `S111-DENOMINATOR-01` is already held) · the §57/§92 uncovered-runway
note. **Item 2 moves §111 across the ADR-020 construction boundary — the highest-risk part,
and the reason it needs a sitting rather than a patch.**
