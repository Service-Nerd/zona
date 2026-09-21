# PLAN-ARC-V2 — the plan progression strip

**SLT, 2026-09-21.** Sutherland · Fried · Hutchinson · Wood · Traynor.
**Ruling: build C** (volume ridge + phase rail), delivered as B then C.
**Tier: FREE.** It is the Plan screen's chrome and the Plan screen is free.

---

## What was brought

The founder: *"the block somewhere where you're at looks a bit dated. It looks a bit flat."*

Half taste, half defect. `PlanArc` rendered every week at `height: '100%'` — week 1, peak week and the deload were identical rectangles — while the strip set `align-items: 'flex-end'`, a property that can only matter if something is shorter than full height. It never had any effect. `ui-patterns.md` §12 documented **both halves** without noticing they contradict.

Four candidates were built over real generated plans at `/plan-arc-preview`:

| | |
|---|---|
| **A** | shipped (flat) |
| **B** | volume ridge — bar height ∝ `trainingKm` |
| **C** | ridge + phase rail |
| **D** | phase track only, no per-week marks |

---

## The question I brought, and the answer

I brought this as the central risk: **"a rising volume ridge is a growth chart"**, aimed at a user whose documented failure mode is doing more.

**Sutherland inverted it, and the board agreed.** Nobody reads a sawtooth as a trend line; they read *the teeth*. What the ridge actually shows is an app that makes you go backwards, on purpose, four times, on a schedule you did not choose — pre-committed, drawn, and not your idea. Meanwhile the thing that shipped, sixteen identical blocks, is **a picture of the grey middle**: sixteen weeks of identical effort, rendered in moss, on the screen of a product that exists to break exactly that.

Wood arrived at the same place independently, from **anticipation**: a deload notch visible three weeks out is an advance commitment device, so taking the easy week costs no willpower on the day. That is context, not motivation, which is her line for habit rather than gamification.

> 🔴 **The growth-chart objection is ANSWERED. Do not reopen it.** The risk was misidentified: it assumed the runner reads the envelope rather than the teeth. What survives of it is Wood's two conditions below, and nothing else.

---

## Binding conditions

**Wood (kill mandate, not used, and the reason it survives is narrow):**
1. **No cumulative total.** No `%` complete. **Shape, never completion.** The moment a number aggregates this becomes a progress bar, which is the illusion-of-progress class in its purest form.
2. **No celebration of the peak.** No emphasis, no marker, no colour change at the tallest bar. The peak is the middle of a process, not a summit; treating it as one is how you get a runner who reads the taper as a let-down.

**Fried:** if the rail ships, the truncated phase chain comes **out** of the label row. Not both. *(The rail was only accepted because the chain measurably fails: it truncated to "16 WEEKS · BASE → BUILD → PEAK → …" in 5 of 5 plans at 320px. The rail is a replacement, not an addition.)*

**Sutherland:** the down-weeks are the message. Any future change that smooths, averages or de-emphasises the dips works against the component's reason to exist.

**Hutchinson:** confirmed **SLT, not Coaching Board.** Display of data already in the plan; no prescription change, no config, no invariant. ADR-015 territory.

All three are gated by `lib/plan/planArc.test.ts`, falsified individually.

---

## Sequencing, and a recorded disagreement

Drawing the true shape makes **§119's defect visible**: 26.3–33.3% of plans carry a one-week loading block and *every one is the plan's opening*. Measured on the nine published plans, `sub-4-hour-marathon-plan` has deloads at w2/w6/w10 — a visible notch in bar two. §119's producer fix is **filed, not taken** (0 of 220 legal deload placements; the fix is a search, not a threshold).

Both Hutchinson and Traynor voted ship now. **They did not agree on why, and the difference decides what happens next.**

- **Hutchinson:** the defect exists whether or not we draw it. Those runners are already training that week; the flat strip protected only our own inattention. The founder found MKT-PLAN-SHAPE-01 by reading published pages because four harnesses are blind to a plan's arc, and this is the cheapest instrument we have been offered for that class.
- **Traynor:** we have roughly three users and no revenue. Exposing a known defect to nobody costs nothing; exposing it in six months to paying users costs something real.

> **Hutchinson's reasoning governs.** "Nobody is looking yet" is a schedule, not a credibility answer, and credibility over cleverness is a positioning commitment. **§119's producer change is therefore newly URGENT, not permanently deferred** — its output is now on the runner's screen.

---

## Killed permanently

**Variant D — phase track only.** Three lozenges that restate the label row and discard the deloads, the taper and the shape. Sutherland: reassurance furniture. Do not re-propose a PlanArc with no per-week marks.

---

## Also decided

- **`deloadWeeks` removed, not restyled.** Height already says "less", which is what a deload is; a second opacity encoding would make the notch fainter exactly where it matters most. `deloadWeekNumbers` in DashboardClient went with the prop rather than sitting unread.
- **Race week is not special-cased.** A full-height finish-post is Wood's prohibited peak-celebration in a different costume.
- **The label row collapsed to one left-aligned line.** With the chain gone, `16 weeks` was facing `Wk 6 of 16` — the same number twice. Only removing the chain made that visible.

---

## What this ruling does not settle

Whether the week-2 notch is **explainable to a runner who asks**. The board's answer is that it is a defect we are choosing to make visible, not one we have an explanation for. If an answer is wanted in the product before it is visible, that reverses the sequencing and §119's producer becomes a blocker.
