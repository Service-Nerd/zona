# Coaching Board — `WALKRUN-DELOAD-CLAIM-01` (2026-11-20)

**Trigger:** backlog item (🏃 COACHING BOARD), routed by the Design Board's `WALKRUN-WEEK-LEGIBILITY-01` (seam rule:
design owns the encoding, coaching owns the meaning). **Question:** the walk-run start's deload repeats the previous
level, so its sessions are identical to the week before. Is it a deload, and what may its sentence claim?
**Evidence:** `scripts/board-evidence-getrunning-four.ts` section 4 (READ-ONLY), plus code reads named below.

## Analysis (written before any seat spoke)

**The item's claims, re-derived.**

| item says | re-measured 2026-11-20 |
|---|---|
| the deload sits at the same level as the week before (w3 and w4 both L2) | **confirmed:** schedule `w1 L0 · w2 L1 · w3 L2 · w4 L2 (deload) · w5 L3 · w6 L4 · w7 L5`; one deload in the 7 weeks |
| the sessions are identical | **216 of 216** grid plans with a walk-run start: the deload week's sessions are **byte-identical** to the week before |
| the theme says *"An easier week, on purpose."* and has no reachable render | **confirmed** (`walkRunStart.ts:167`; no app surface reads `week.theme` for these weeks — its one reader is the maintenance card) |

**What the item does not say: the claim the runner CAN see is not the theme.** Two runner-facing surfaces key on
`week.type === 'deload'`, which the walk-run deload sets:
- Plan screen week card: **`Run 3, walk 2 · deload`** (`PlanCalendar.tsx:722`, shipped 2026-11-16);
- Today's rest-day copy (`TodayScreen.tsx:586`): *"Deload week. You've been piling on the load. This is the week your
  body catches up. Don't ruin it with extra miles."*

Today's week eyebrow keys on `badge`, which the walk-run week does not set, so it reads the phase, not "Deload".

**What was ruled, and why.** The walk-run-start sitting (2026-10-25, L1) ruled *"§3's deload every fourth week holds
the previous level"*, and `INV-PLAN-WALKRUN-START-PROGRESSION` enforces *"a deload holds"* and *"the level steps at most
one a week and never down"*. In this phase the weekly time is fixed (3 × 30 min) and the progression variable is the
run share; a hold removes that week's increment. §3's *"volume drops to 70% of the prior build week"* is written for
running weeks whose volume rises; the running ramp that follows does cut (example: 7.2 → 5.5 km, 76%).

**Two alternatives were checked against the constitution.** (a) *Drop a level on the deload (L1)*: the next week would
then step L1 → L3, two levels, which the progression invariant forbids. (b) *Cut the deload's time to 70% (21 min)*:
legal, but it re-opens L1, which considered and ruled the hold.

**Production:** 0 live plans carry a walk-run start (4 base-build plans, 0 walk-run weeks). No runner has seen either
sentence on this week.

**Settled-ground scan.** L1 (hold), L3 (30 min, three sessions), `PHASE-ON-TODAY-01` (copy) — *"Deload week. Less
running…"* only where true — and `WALKRUN-WEEK-LEGIBILITY-01` (design marked the deload by its label). Nothing settled
is re-opened unless the board chooses (b).

## 🔍 Conflict scan

§3 (recovery weeks), §3 LR-DELOAD amendment, §116 floor note L1–L5, §117 Am. 6 (steps), `PHASE-ON-TODAY-01`'s copy
ruling (a deload sentence claims only what that week does). **The hold does not conflict with §3's intent** (no load
increase after three rising weeks). **The sentence *"An easier week"* conflicts with the prescription**: the week is
not easier than the one before. *"You've been piling on the load"* is true (three rising weeks); *"the week your body
catches up"* is true of a hold.

## Seats

**🏃 Hutchinson (chair).** The hold is a deload by intent and the evidence for anything sharper at 90 minutes a week of
walk-running is thin. The defect is the adjective. "Easier" is a claim about this week against last week, and it is
false.

**📊 Seiler.** All easy. No objection.

**🎯 McMillan.** Repeating a week is how every couch-to-5K programme handles a beginner: you do not take them backwards
and you do not push them on. I would argue for (b) only if we had a runner who struggled; we do not have one.

**🩹 Willy.** At this stage the load event is the continuous bout, and the hold keeps it where it was. Cutting minutes
drops time on feet the tissue was already tolerating and buys nothing I can name. Keep L1. Do not let the sentence
promise less load than the week carries.

**⚕️ Sims.** Concur. Say what it is: the same week again, on purpose, so the body catches up before the next step.
Beginners who read "easier" and find it is not are told the plan is wrong about them.

**💪 Blagrove.** Silent.

## ⚡ Recorded disagreements

None on the ruling. McMillan's (b) is recorded as an option the board would revisit on outcome evidence (a runner who
struggles in weeks 3–4), which Zonna does not have.

## ⚖️ Ruling — CORRECT WITH AMENDMENT

1. **The walk-run hold IS this phase's deload** (L1 stands): a pause in the progression after three rising weeks,
   not a reduction. Marking it `deload` on the Plan card and using the deload rest-day copy is correct in meaning.
2. **No surface may claim it is easier, lighter, shorter or less** than the week before. *"An easier week, on
   purpose."* is withdrawn in meaning.
3. **What it may claim:** that it repeats last week deliberately, with no step up, so the body catches up before the
   next one. The exact words are the founder's (the walk-run copy was founder-approved on 2026-10-25).

## 📦 Required artifacts (at build)

1. **Principle** — a note on the §116 floor note's L1: *"the walk-run deload holds the level; it is a pause in
   progression, not a reduction, and copy says so"*.
2. **Numeric** — none.
3. **Mechanical check** — a copy test on the producer: a `walk_run_start` week with `type: 'deload'` carries no
   reduction claim in `theme` (`easier|lighter|less|shorter`), falsified against today's string. The existing
   progression invariant already enforces the hold.

## ↗️ Hand-offs

- 👤 **FOUNDER** — the replacement sentence for the theme (meaning ruled above). Not a second sitting.
- SLT escalation: none.

## What this does not prove

- Whether a hold or a cut serves real beginners better: no outcome data, and 0 production plans carry the phase.
- Whether the theme will ever render: that is the Design Board's (it is unrendered today).
