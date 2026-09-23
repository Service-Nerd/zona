# Coaching Board — sitting 2, 2026-09-23

**Two questions. Neither ships anything from this sitting.**

1. **`S117-LEVEL-GATE-01`** — should §117's eligibility read the volume-derived
   structural level rather than a supplied `fitness_level`?
2. **`ZERO-REJECTION-SERVED-01`** — should a refusal that hands the runner a §118
   plan be scored as a FAILURE of the marathon?

**Trigger:** soft. No doctrine file is being edited.

---

## 🔍 Conflict scan — amendments, not headings

### Question 2 — and the scan found the answer is already half-written

| § / ruling | reading | verdict |
|---|---|---|
| **§118, chair's closing note** | *"**NO HARNESS WATCHES THIS PLAN KIND.** `measure:fitness` and `measure:envelope` are both shaped around a race. Inventing a way to score a raceless plan would be the decorative-check failure, so it is **filed as a known gap, not papered over**."* | 🔴 **THE BOARD ALREADY RULED THAT §118 MUST NOT BE SCORED BY A RACE-SHAPED HARNESS.** What was never drawn is the consequence: `measure:envelope` does not merely fail to score it, it scores it **FAIL**. |
| **`ZERO-REJECTION-01`** | *"a refusal must lead to a PLAN, not to advice, however well the advice is worded. Under that bar a refusal is a DROPOUT."* | ⚠️ **The premise no longer holds.** It was ruled **2026-09-20 at 16:34**; §118 shipped the same day. Since then a refusal **does** lead to a plan — a real, validated one. The rule is right; the world it described has changed under it. |
| **§44 / §44 Am.** | refusal is *"not yet"*, never *"no"*; the ordinal band carries the honesty | ✅ No conflict. |
| **RUBRIC-GAPS-01(a)** | **WATCHED** quantities — *"exempted rules, counted and reported but never scored. Scoring them would re-impose a rule the board deliberately relaxed; hiding them would make the relaxation invisible."* | ✅ **The machinery already exists and is ratified.** `DAYS-SHORT-SILENCED` is precisely this shape. |

**Scan result: no contradiction. One ruling whose factual premise has been
superseded, and an existing ratified mechanism that fits the gap.**

### Question 1 — unchanged from this morning's filing

`§111 Am.3` (the door is downstream of the peak — no conflict), `§111 RECORDED
LIMITATION` (INSUFFICIENT EVIDENCE on the sub-12 km cohort — **adjacent, and it
binds**), `§117 Am.2` (the adequacy bound is the safety net, and it already
caught 11 of 45 in testing), `§79` (two axes, two inputs — **the crux**).
Full detail: `board-question-s117-level-gate.md`.

---

## The measurement

| marathon, km/wk | refused by the engine | **SERVED** | **reaches the race door** |
|---|---|---|---|
| 4 | 100% | **100%** | **80.3%** |
| 8 | 85.8% | **100%** | **99.6%** |
| 15 | 35.4% | **100%** | **100%** |
| 25+ | 0% | **100%** | — |

**522 of 522 refused marathoners are offered a get-running plan.** 89.7% validate
clean under `validateBaseBuildBlock`; the 10.3% that did not were
`ONRAMP-STEP-UNITS-01`, fixed today, now 0.

⚠️ **The door figures are WEIGHTED — share of runners.** An earlier submission to
the founder gave **46%** at 4 km/week. That was the share of **grid cells** and it
was wrong to present beside weighted figures. Corrected here.

---

## 🏃 Alex Hutchinson (Chair)

Question 2 first, because it is the one that changes what this board said this
morning.

I declined to call the marathon fit for purpose at 78.7%, and I was reading a
number that counts a runner who receives a real plan as a dropout. **That is not
a measurement of coaching; it is a measurement of which code path threw.**

⚠️ **And I want to be exact about what does NOT follow.** The engine did not get
better. Nothing about the plans changed. **If this board re-scores and the
marathon reads ~91%, not one runner is served differently than they were
yesterday.** The number would move because the definition moved, and this board
has already been burned once today by a rubric that quietly changed what counted
as success. **A re-score is a correction, never an improvement, and the register
must say so in those words.**

I will not accept "score it as a pass". §118 is not a marathon plan and pretending
otherwise re-imports the exact dishonesty `ZERO-REJECTION-01` removed. **The third
option is the right one and it already exists.**

## 📊 Stephen Seiler

No objection from this seat on distribution — a get-running plan is easy running
and moves no ratio.

On the metric: I would only note that `WATCHED` is a category this board created
so a relaxation stays **visible**, and the rubric's own warning applies — *a rate
that climbs means the exemption is carrying more than it was measured carrying.*
If `SERVED` is watched, **someone has to look at it.** A watched quantity nobody
reads is a scored quantity that has been hidden.

## 🎯 Greg McMillan

The thing I care about is what the runner is told, and that is already handled —
`reaches_race_door` exists so the copy can say *"this gets you to the start line"*
or not, per runner. That is the right granularity and I am not reopening it.

On question 1 I remain where I was in the §111 limitation: **I would admit this
runner.** But I want to say plainly that question 1 matters much less than it did
this morning. If every refused runner already leaves with a plan and four in five
reach the door, then §117's level gate is deciding **which plan they get**, not
**whether they get one**. That is a smaller question, and it should be sized as one.

## 🩹 Rich Willy

I own both rules in the conflict this sitting inherits, so let me close it.

**On question 2: no objection.** Nothing in the scoring change touches load. The
plans are unchanged. I would object immediately if anyone proposed relaxing a
bound so the number moved; nobody has.

**On question 1: still INSUFFICIENT EVIDENCE, and my reason has not changed.** The
§111 limitation records that I will not admit this cohort through a mechanism that
scales the peak off self-reported volume. §117's peak is fixed at 34, so the
mechanism is acceptable — **what I have no evidence on is whether a runner who
declares intermediate at 15 km/week is structurally different from one who
declares beginner.** `beginner_max_weekly_km = 20` is an argument that they are
not. It is not data.

⚠️ **And on `ONRAMP-STEP-UNITS-01`'s filed remainder:** above `weekly > runs × 15`
§2 and §116 Am.2 cannot both hold. **Do not resolve that by raising my per-run
cap.** The cap is the bound I priced. If anything yields it is the volume target,
and §118 not having one is the reason the conflict exists at all. **Filed to me,
and I am not ruling on it from a table — I want the plans.**

## ⚕️ Stacy Sims

On question 2, one thing for the record.

This morning I said the superseded rubric *"made the product look kindest to the
people it was turning away."* I want to be even-handed now the error runs the
other way: **the current metric makes the product look crueller than it is to the
same people** — low-base, low-volume runners, who skew female in the charity
cohort. Both errors landed on the same population. **That is the part worth
noticing: it is not that we got the sign wrong twice, it is that this cohort is
the one our instruments keep mismeasuring**, because they are the cohort that
sits at the edge of every rule.

No objection to the change. My condition is Seiler's: `SERVED` and `door` are
reported at every sitting, not computed once and forgotten.

---

## ⚡ Recorded disagreements

**None between seats.** McMillan and Willy differ on question 1 exactly as they
did in the §111 limitation — four seats would admit, Willy wants evidence — and
that disagreement is **unchanged and already on the record**. It is not re-argued
here.

---

## ⚖️ Rulings

### Question 2 — **CORRECT WITH AMENDMENT**

A refusal that hands the runner a validated §118 plan is **not a dropout** and
must not be scored as one. It is **also not a marathon plan** and must not be
scored as a pass.

**It becomes a WATCHED quantity** — `SERVED`, counted and reported beside the fit
rate, never folded into it — using the mechanism `RUBRIC-GAPS-01(a)` already
ratified for `DAYS-SHORT-SILENCED`.

**Four binding amendments:**

| # | Amendment | Seat |
|---|---|---|
| 1 | The re-score is recorded as a **CORRECTION, not an improvement**, in those words, and the pre-correction figure is retained beside it | Hutchinson |
| 2 | `SERVED` and `door` are **reported at every sitting**. A watched quantity nobody reads is a hidden one | Seiler, Sims |
| 3 | A refusal that is **NOT** §118-served stays a scored **FAIL**. The exemption is for runners who receive a plan, never for the refusal type | Hutchinson |
| 4 | **`door` is reported per band, never as a single product figure.** 80.3% and 100% are different promises and averaging them hides the runner who cannot get there | McMillan |

🔴 **NOT APPROVED TO SHIP FROM THIS SITTING.** `envelopeMeasure` is the single
owner of what "fit for purpose" means and changing it re-bases every historical
round. **Chair's gate: implement, re-run `measure:envelope` and `review:cohort`,
and bring the before/after to the board before the baseline is written.**

### Question 1 — **INSUFFICIENT EVIDENCE** (Willy; four seats would admit)

Unchanged from the §111 limitation. **What would settle it:** refused marathoners
under 20 km/week arriving with `fitness_level` above `beginner` at a rate
materially above zero, from `plan_refused_by_design` — which has **never fired**.
The decision rule stands as filed this morning.

⚠️ **McMillan's re-sizing is accepted by the chair:** with §118 live, this gate
decides **which plan**, not **whether a plan**. It is no longer on the critical
path to a sign-off.

---

## 📦 Artifacts

**None ship from this sitting.** Recorded explicitly rather than left as an
absence. Two register rows; two items filed with their gates.

## ↗️ SLT escalation

**None.** Both questions are correctness.

---

## What this sitting does NOT prove

- **The engine did not change.** If the marathon reads ~91% after amendment 1, that
  is arithmetic on a corrected definition. **No runner is served differently.**
- **`door` is measured on generated plans, not on runners who took the offer.**
  Nobody has accepted a §118 plan in production yet — 2 marathon plans exist in
  total, and `plan_refused_by_design` has never fired.
- **§118 still has no fitness harness.** The chair's known gap stands: nothing
  measures whether a get-running plan builds the runner well, only that it
  validates.
- **Nothing ran on a device.**
