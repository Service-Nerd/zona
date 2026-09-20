# Coaching Board — 2026-09-20 — engine backlog review (9 open items)

**Question:** the founder asked for every open engine item analysed with pros and cons, and a
decision on whether we act. **Hard constraint: 95.9% fit-for-purpose must not be spent.**

**Trigger:** `CoachingPrinciples.md` §9/§24/§80/§111 + `generationConfig.ts` — hard.

**Rulings:** Item 1 **CORRECT WITH AMENDMENT** — the plan is right, the *note* is wrong, and the
fix is board-exempt. Item 2 (P-16) **WITHDRAWN as scoped; re-ruled on a new route.** Items 3–9
confirmed with no action.

---

## Register check — my list was wrong in both directions

**Closed, I had them open:** `S24-FLOOR-REACHABILITY-01` (does not reproduce) · `LR-CONSEC-01`
(superseded by §9's Recorded structural finding) · `S52-LOPSIDED-BOUND-01` (closed, negative
result) · `S111-DENOMINATOR-01` (shipped) · `BRAND-MAINT-LABEL-01` (closed, SLT).
**Open, I had missed it:** `S111-FOUNDATION-CREDIT-01` (**VETOED**).
**The backlog is not the live engine register — `roadmap.md` is.** That is a documentation
defect in its own right and is now filed.

---

## Conflict scan

**Item 1** touches §24 (long-run bar), §111 (base-build ratio), §12/§90 (injury trim), §80
(time-on-feet + Am.1's cause-naming), §40c (name the binding lever), §9 (Recorded structural
finding), §114.

🔴 **The scan found the decisive precedent, and it changes what the board should rule on.**
§9's Recorded structural finding lists **ten instruments built and measured across two attempts,
every one trading one defect for another:**

| instrument | result |
|---|---|
| §114 delivered-week bound at 45% | BINGE-SEVERE eliminated — **LONG-RUN-SHORT 0 → 88.7%** |
| §114 at 60% / 70% | 0 → 44.2% / 39.6%; **M2 and M3 regress 70% → 56–60% of race** |
| §45 absolute arm 50% → 30% | 50 plans better; **M2 net build 68% → 44%** |
| `MIN_KM_PER_TRAINING_DAY` 5 → 4 | DAYS-SHORT −31; **WEEK1-LEAP +135** |
| Week-1 floor yields to §2's ramp | **+884 sweep violations** |
| Injury trim floors at 2 easy runs | **peak week breaches the injury ceiling** |
| …and four §114 formulations, all inert or breaking §3 Am. | |

**The remedy is named and is architectural:** the long run and the week must be sized **together
at construction** (`buildWeekSessions`), not adjusted afterwards, because §45's cap is
multiplicative on the previous week's long run and the trajectory ratchets down.

**Consequence for this sitting: any instrument that lowers or raises a cap is the eleventh
attempt, and the founder has forbidden spending the 95.9% on it.** The board therefore rules on
**admission and honesty**, not on another cap.

**Item 2** touches §57, §111, ADR-020. **Items 3–9** — no conflicts; each is already ruled or blocked.

---

## 🏃 Hutchinson (Chair)

The measurement is new and it is good: **nobody had shown that the injury cap functions as an
admission mechanism.** An 8 km/week knee-history first-timer is admitted where their healthy twin
is refused, because the cap lowers the peak, which lowers §111's ratio. That is §111's
*second* recorded inversion and it is the same property the principle was convened to remove.

But I am going to resist the obvious conclusion. **The plan is not wrong. The plan is what that
runner can safely do.** 17 km for a knee-history runner at 8 km/week over 29 weeks is defensible;
I would not sign off on more. What is wrong is that we **cannot tell the runner why**, and that a
healthy twin is refused for a plan that would have been *more* ambitious.

**Q1a: we hand it over.** The alternative is a refusal, and a refusal for the priority-one cohort
is a dropout with nothing behind it — the 09-19 SLT settled that.
**Q1b: no. §24 does not get a generative arm.** That is the eleventh instrument.

## 📊 Seiler

No objection on distribution. The plan is all easy and correctly so at that volume.

One observation the table makes and nobody has said: **at 12, 15 and 20 km/week the knee runner
and the healthy runner have the same weekly volume and different long runs — 40% against 62%.**
So *weekly volume cannot be what limits the long run* in those rows. Whatever the note says, that
is not the mechanism.

## 🎯 McMillan

I coach this runner. You do not tell them no, and you do not pretend 17 km is 26 km. You tell them
*"this is as far as your knee will let us take the long one, and here is what race day will
therefore feel like."* Which is **almost** what the note says.

**The note blames the wrong thing, and for this cohort that is not a cosmetic error.** A runner
told "your weekly volume is what limits it" will go and add volume — which is precisely what their
knee history says not to do. **We are handing an injury-history runner a note that points at the
lever they must not pull.** That is §80 Amendment 1's defect, on a different axis, and Willy's
words there were *"an injury vector served as advice."*

## 🩹 Willy

**Q1c: 17 km is the correct ceiling and I am not moving it.** Knee history, 8 km/week, never run a
marathon, 29 weeks — the tissue argument is unambiguous and the cap is doing exactly its job.

**So the cap is not doing harm by existing. It is doing harm by being invisible.** Two things
follow and both are mine:

1. **The note must name the injury cap when the injury cap is binding.** §40c requires the binding
   lever to be named. Today the note has **two arms — time cap, or weekly volume — and no injury
   arm**, so for this cohort it falls through to the wrong one. `INV-PLAN-LR-SHORTFALL-CAUSE`
   checks only the time-cap mis-attribution and would not catch this.
2. **And there is no lever to name, which is the honest part.** Unlike volume, the runner cannot
   train their way past their own injury history in 29 weeks. §80 Am.1 already settled how to
   write that case: the cap branch **names no lever, on purpose.** Use the same construction.

I will not support a refusal. Refusing a runner because we protected them is the inversion running
the other way.

## ⚕️ Sims

**Q1d: both, and the energy half is the one nobody models.** A 25 km overshoot on race day for a
first-time, predominantly-female, 20–29 cohort is a bone-stress question *and* a fuelling one —
they will be out there **5h 38** by the plan's own projection, against a longest training run of
**2h 16**. That is two and a half hours of unrehearsed fuelling.

✅ **Credit where it is due: the note already says this.** It gives time on feet, not kilometres —
"2h 16" against "around 5h 38" — and §80's time-on-feet anchor is why. **That is the right unit
for this runner and it was the right call.**

⚠️ **What it does not say is that the fuelling is unrehearsed.** *"Expect the last stretch to be
new territory"* is about distance. **Three and a half hours beyond your longest run is a
different problem from being tired**, and this cohort's failure mode is under-fuelling. §24e's
fuelling machinery exists. **Scope it to this note or the honesty is half-done.**

---

## Recorded disagreements

**None on Item 1.** All five seats: hand the plan over, fix the attribution, do not refuse, do not
build an eleventh instrument. Recorded as unanimous because it is, not to close the discussion.

**Sims vs the note's current scope** is a gap, not a disagreement — nobody argued against her.

---

## ⚖️ Rulings

### Item 1 · `MARA-LR-LOWBASE-01` — **CORRECT WITH AMENDMENT**

**The plan is correct and ships unchanged. The note is wrong and must be fixed.**

**Amendment (the only change authorised):** the long-run shortfall note gains a **third arm** for
when the **injury cap** is the binding constraint, and it **names no lever**, exactly as §80 Am.1's
cap branch does. Plus Sims's addition: where the projected race duration exceeds the peak long run
by more than a threshold, the note says the **fuelling** is unrehearsed, not only the distance.

⚠️ **This is a defect fix restoring documented intent (§40c: name the constraint that is actually
binding). It is therefore BOARD-EXEMPT and needs no further sitting.** It changes **no
prescription**, so it **cannot move the 95.9%** — and that must be proven, not assumed.

🔴 **Explicitly NOT authorised:** any change to the injury cap, §24's bar, §111's ratio, or the
long-run sizing. **Ten instruments have been measured; an eleventh is forbidden without new
adherence or injury data** (`RUBRIC-GAPS-01`(d) already froze `WEEK1-LEAP` on the same reasoning).

⚠️ **The admission inconsistency is REAL and stays open, unresolved.** A healthy 8 km/week runner
is refused while their knee-history twin is admitted. The board cannot fix it without touching
§111, which is `S111-SUBFLOOR-VOLUME-01`, which the SLT has parked behind *"ask the charity what
their runners actually run."* **Recorded as a §111 limitation, second inversion.**

### Item 2 · P-16 — **THIS MORNING'S RULING IS WITHDRAWN AS SCOPED, AND RE-RULED**

A pre-plan block cannot rescue a §111-refused runner: the refusal throws at `route.ts:136`,
composition happens at `route.ts:230`. **The shape was ruled on an incomplete submission.**

**Q2b is a genuinely different route and the board takes it.** *"Refuse the race plan now, generate
the ramp, re-gate at the end of it"* is **not** `S111-FOUNDATION-CREDIT-01`. Credit means §111
divides by a volume the runner has not run. This means §111 is **not asked yet** — the runner
actually does the block, reports real volume, and is gated on **observed** data. Willy's objection
to self-report does not attach: this is the same self-report we already accept at the wizard, taken
later, after eleven weeks of evidence.

**Ruled: CORRECT WITH AMENDMENT as a two-stage shape**, carrying this morning's six amendments plus:
7. **§111 is evaluated at the END of the ramp, on re-declared volume — never credited in advance.**
8. **The ramp is a plan the runner can follow standalone.** If they never return, it must still be
   a good eleven weeks.

⚠️ **Chair's gate stands and is unchanged: build behind a flag, `measure:fitness` + property sweep,
return.** ⚠️ **And the SLT has already ruled "not for October".** Nothing here reopens that.

### Items 3–9 — **CONFIRMED, no action**

| Item | Ruling |
|---|---|
| `ULTRA-LR-ADEQUACY-01` | **INSUFFICIENT EVIDENCE, correctly.** Inventing a bar would be decorative; the right unit is a back-to-back pair (§24e). ⚠️ **Hutchinson's note: 50K/100K at 100% fit-for-purpose is evidence the MEASUREMENT cannot see this, not that the gap is closed.** Record it in `RUBRIC-GAPS-01`. |
| `LOPSIDED-ORDER-01` | **Exempt** — ordering defect restoring documented intent. Confirmed. No sitting needed. |
| `S112-HAZARD-01` | Parked. Re-open on cohort volume. |
| `INPUT-SEX-01` | **An honest null.** No action. |
| `ZONE-BAND-01` | Blocked on data; numeric trigger stands. |
| `COHERENCE-SELECT-01` | **Stop attempting.** Five builds, the last two diagnoses disproved. No sixth without a new diagnosis. |
| `LR-DELOAD-RESUME-01` | Record-only. Do not retry. |

---

## 📦 Required artifacts — Item 1 only

1. **Principle** — **§80 Amendment 2**: the shortfall note's cause has a third arm (injury cap),
   which names no lever; and where projected race duration exceeds the peak long run materially,
   the note names the **fuelling** as unrehearsed.
2. **Numeric** — the fuelling-gap threshold, in `GENERATION_CONFIG`. ⚠️ **Not in `ruleEngine.ts`.**
3. **Invariant** — extend `INV-PLAN-LR-SHORTFALL-CAUSE` with an injury arm: a note that blames
   weekly volume while the injury cap is binding is an error. **Mechanically checkable** — both
   quantities are on the plan.

## ↗️ SLT escalation

**None.** Item 1's amendment is a defect fix. Item 2 is already with the SLT and already ruled
"not for October". Items 3–9 need nothing.
