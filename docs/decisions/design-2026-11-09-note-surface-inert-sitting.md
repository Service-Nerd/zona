# Design Board — NOTE-SURFACE-INERT-01, 2026-11-09

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
