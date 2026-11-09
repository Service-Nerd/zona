# Design Board — NOTE-SURFACE-INERT-01, 2026-11-09

> 🔴 **THIS SITTING WAS VACATED BY ITS OWN RE-MEASUREMENT, HOURS LATER, AND RE-SAT. Read the
> correction at the end before the sitting.** The ruling below was made on 41 STORED plans; the
> engine produces 4,776 and 3,312 carriers of these notes. Every displacement figure in the
> original sitting is wrong by three orders of magnitude, and the argument the chair overruled
> Silvanto on was a stored-corpus artefact. **Silvanto was right.**

**Ruling: SHIP WITH AMENDMENT (3).** Register row in `design-rulings.md`; pattern in
`ui-patterns.md` §18; check in `planRationale.test.ts`.

## Why the measurement came first

The item is tagged *"⚙️ NO BOARD to measure; 🧭 DESIGN BOARD to place"*, and the measurement
changed what the board was asked.

🔴 **My first measurement said 12 of 16 note keys were inert. It was wrong.** I grepped `app/` and
`components/` and missed that `lib/plan/planRationale.ts` **collects ten of them** into the list the
plan screen renders. The item's original figure of **3** was right. **Two directories checked is not
"nowhere."**

## The numbers the ruling rests on

Production, 41 stored plans, `planRationaleNotes()` called directly.

| | |
|---|---|
| Inert keys | **3 of 16**, 8 plan-instances, 1 note each |
| Rule-1 cause collisions | `returning_runner` + "Coming back" **2 of 3** · `frequency_constraint` + "Maintenance" **1 of 3** · `peak_shortfall` **0** |
| Word counts vs the SLT's post-cut 67 mean / 117 worst | peak 65, 65 · frequency 41, 46, 41 · returning 30, 45, 30 |
| `frequency_constraint` displacement | **3 of 3 carriers have a free slot** |
| `peak_shortfall` displacement | both carriers at **3/3**. Last → shown on **0 of 2**. In the volume family → loses *"Shaped for you"* (6d85424b), *"Coming back"* (e49ea589) |

**Length is not the problem. Cause duplication is**, on 3 of 8 instances.

## The settled ground that decided it

`ui-patterns.md` §18, revised by the SLT on 2026-09-17 after the founder read a real plan on a
device:

1. **One cause, one tile.** Measured then: the Maintenance and Volume tiles appeared together on
   200 plans and **157 (78.5%) blamed the same cause**, 68 prescribing the identical lever.
2. **Consequence, then cause, then the one lever. No thresholds, no ratios.** With Hutchinson's
   clause: *where a gap exists, both figures stay* — a constraint without its cost is a disclaimer.
3. **Length is capped, not just count.**

Result of that cut: **mean 130 → 67 words, worst 254 → 117, 510 of 513 plans carrying exactly one
tile.** Anything added here is added back toward a wall somebody deliberately cut, which is why the
cap was not on the table: **§6ae declined 4 tiles / 240 words on 2026-10-28** for want of
readability evidence, and this sitting supplied none.

## Seat positions, including the losses

**🧭 Zhuo (chair):** the user problem is the product's own promise — a runner whose plan peaks short
of their goal is told nothing about why. Three decisions, not one; refused as a batch.

**✋ Silvanto:** `peak_shortfall` and `frequency_constraint` are plan-level facts, correct horizon.
`returning_runner` is a **weeks 1–3** fact at the top of the plan — the horizon mistake of §6ak.
**Dissented on `Your peak`'s rank**, because one plan loses *"Coming back"*; would move on seeing
that plan on a device. **Declined the veto and named why:** craft, not a documented palette or type
regression. Second time the untested veto has correctly declined itself.

**🎓 Sierra:** *"3 honest runs beat 4 token ones"* is the best sentence in the batch — perceptual
expertise, not engagement. `peak_shortfall` says **"not effort"**, which is the one thing a Type-A
runner needs told. `returning_runner` tells them *15% versus the standard 10%*: **nobody becomes a
better runner knowing that; it makes us look precise.**

**📱 Wroblewski:** no new control, no new input, one more tile in an existing list. Cost is entirely
displacement and it is measured at zero for `frequency_constraint`.

**🎪 Collins — LOST, recorded as lost:** twelve labels competing for three seats, and we want
fifteen. *"The queue is the problem, not its membership."* He would collapse to four — volume, days,
intensity, shape — before adding a thirteenth. **The measurement does not disprove him.** Filed as
its own item; he declined to hold these runners hostage to it.

**Chair's overrule of Silvanto on rank:** Wood already ranks *"Shaped for you"* LAST **because
constraints beat a brag**, so displacing it is that ruling applying, not a new trade. The *"Coming
back"* loss on one plan is named and accepted, the same way §6ak named `Long run` lost on 469 of 844.

## The refusal's cost, stated

🔻 **`9feb0406` shows ZERO notes with three free slots**, carrying *"Fresh-from-layoff start: week 1
begins at 70% of your stated current weekly volume (12 km vs 15 km stated)"*. That runner is told
nothing. **That is the strongest argument for the rewrite, not against the refusal** — the copy is
the problem, not the fact.

## Falsification

Five mutations, each firing a named arm: un-gate `Your days` → rule 1 red · its own slot for
`Your peak` → rule 1 red · un-wire `Your peak` → three arms red · ship the refused note → two red.

⚠️ **One limit, stated in the test rather than discovered later:** the rank IS the `else if` chain's
position, so a *"ranked last, rule 1 intact"* mutation cannot be written without moving the whole
volume family. That arm catches **absence from the top three**, not every possible mis-rank.

⚠️ **Not seen on a device**, and no plan screen has been looked at with three tiles since the
2026-09-17 cut. `PLAN-NOTE-PLACEMENT-01` remains open: Wood argues the rationale does not belong at
the top of the plan at all.


---

# 🔴 THE CORRECTION — re-sat the same day, on the engine

`/code-review` re-measured on **39,744 plans generated from `cohortGrid()`** rather than the 41
stored ones. Everything below was wrong in the sitting above.

| | declared to the board | measured on the engine |
|---|---|---|
| `Your peak` displacement | *"loses Shaped for you / Coming back"* | **324 plans** — Coming back **308**, Your level 8, Shaped for you **8** |
| `Your days` displacement | *"displaces nothing"* | **1,216 plans** — Coming back 480, Your level 424, **Long run 152**, Hard sessions 112, Recovery week 48 |
| rule 1 | not considered | **760 plans showed BOTH new tiles** |
| *"ranked last it shows on 0 of 2"* | the argument the rank turned on | **a low rank shows it on 2,876 of 4,776 (60%) with ZERO displacement** |

## What that does to the ruling

**The chair's overrule of Silvanto is withdrawn.** It rested on *"Wood already ranks `Shaped for
you` last because constraints beat a brag, so displacing it is that ruling applying"* — and
`Shaped for you` is **8 of 1,684 displacements**. The real cost was `Coming back` on **788** plans,
which is the note about returning from a layoff, and **`Long run` on 152**, a shortfall note whose
loss §6ak accepted ONCE with a number and which this board never saw.

**Silvanto's dissent was about exactly that loss. He was told it was one plan. It was 788.**

**And rule 1 was broken by my own commit**: I gated `Your days` on the two OLDER volume notes and
not on `peak_shortfall_note`, which I shipped in the same change. 760 plans read "your volume is
low" under two labels — the defect rule 1 exists for, 157 of 200 plans in 2026-09-17.

## Re-sat

Both notes rank **above `Shaped for you` only**; `Your days` is additionally gated on
`peak_shortfall_note`.

| | |
|---|---|
| rule-1 breaks | **760 → 0** |
| plans losing a note | **1,684 → 8**, and the only loss is the brag line |
| `Your peak` coverage | **2,468 of 4,776 carriers (51.7%)** |
| `Your days` coverage | **600 of 3,312 (18.1%)** — rule 1 giving the slot to the larger statement, as §18 requires |

🔑 **The trade is 1:1 and that is not a coincidence: a plan only ever sees a promoted note by
pushing another out.** A new note does not outrank a constraint this board has already ranked.

🎪 **Collins is strengthened, not disproved.** The queue is demonstrably zero-sum: **1,684
displacements across 4.2% of plans was the price of two more claimants** for three seats.

## Three hollow fixtures in one item, all found by mutation

1. The rank arm used a fixture key **`level_fit`, which exists nowhere in the repo**, silenced by
   `as never`. Only three notes were produced, the cap never bound, and ranking `Your peak` last
   stayed green — **so the limit I had confidently written into that test was itself false.**
2. Its replacement's brag arm compared **two** notes against a cap of **three**. An order
   assertion over a list shorter than the cap asserts nothing about order.
3. Both now assert the cap **BINDS** before asserting anything else.

## The lesson, stated plainly

**A design ruling about displacement needs the population the engine produces, not the plans that
happen to be stored.** 41 rows told me `Your days` was free. It displaces a note on 1,216 plans.
The stored corpus is a sample of who has signed up, not of what the product does.
