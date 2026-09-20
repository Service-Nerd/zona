# Coaching Board — 2026-09-20 — Miles teardown, three scoping questions (batch)

**Question:** can three items from the Miles competitor teardown be SCOPED — not
approved to build? Q1 a base-build on-ramp (T-04), Q2 cross-training as a load input
(T-07), Q3 a runner-set intensity ratio (T-15).

**Trigger:** Q1 `CoachingPrinciples.md` §57/§111 + `generationConfig.ts` — hard.
Q2 `coaching-rules.md` (load model) — hard. Q3 §1 + `generationConfig.ts` — hard.

**Rulings:** Q1 **CORRECT WITH AMENDMENT as a SHAPE, not approved to ship** (measurement
gate stands). Q2 **INCORRECT as scoped.** Q3 **INCORRECT — veto.**

---

## Register check, before any seat spoke

Three items in the submission were already ruled on, and the submission's own Phase 1/2
had their status wrong until checked:

- `MARATHON-VOLUME-GATE-01` — **SHIPPED 2026-09-18.** The hardcoded route gate is gone,
  replaced by governed §111 `MAX_BASE_BUILD_RATIO = 4.0`.
- `LONGEST-RUN-GATE-01` — **SHIPPED as §113.** `REFUSAL-SCREEN-01` — **SHIPPED.**
- `S111-SUBFLOOR-VOLUME-01` — **INSUFFICIENT EVIDENCE 2026-09-19, §111 unchanged,
  escalated.** Record: `coaching-board-2026-09-19-s111-subfloor.md`.

---

## Conflict scan

**Q1** touches §57, §111, §2, §3, §44, §92, §52. Three findings the submission did not have:

1. **§111's blocking chain does not catch this proposal.** Its Recorded Limitation point 5
   reads *"nothing that **lowers the opening week** can ship until §52's remedy path works
   below ~15 km/week."* This proposal does not lower the opening week — **it raises the
   runner to meet it.** Different operation.

2. **The §52 objection dissolves structurally.** Candidate A's 884 violations came from
   shrinking **main-plan** weeks. A pre-plan block does not. Verified at four sites in
   `invariants.ts`: §2's ramp skips foundation (`:3393`), week 1 is the first
   non-foundation week (`:2511–2513`), delivered peak excludes foundation (`:2660`), and
   §1's denominator excludes it (CB-FOUNDATION-DENOM-01). **`FOUNDATION_LONG_RUN_MAX_PCT
   = 35` is already tighter than §52's 60% bound**, so a foundation-shaped block cannot
   engage §52 at all. The chain ran only ever through candidate A.

3. 🔴 **§2 was amended TWICE on the morning of this sitting** and the submission did not
   know: `WEEK1-FLOOR-SHORT-DIST-01` and `HM-WEEK1-PERRUN-01`. The week-1 step is now
   measured against **declared current weekly volume**, three arms. **This re-scores the
   proposal in its favour** — a runner at 8 who arrives having actually run 18 reads
   18/18 = 1.00× on arm 1.

**Q2** — no principle governs non-run load. **Nothing to conflict with, which is the finding.**

**Q3** touches §1 (session-count, plan-wide, CD-19), §110, §79. Zone-model translation
check applied: no phantom conflict.

---

## The measurement

Ramp at §2's own rate (`MAX_WEEKLY_VOLUME_INCREASE_PCT = 10`) with §3's deload cadence:

| start | weeks to 12 km/wk | weeks to 18 km/wk |
|---|---|---|
| cwk 8 | 6 | 11 |
| cwk 10 | 2 | 9 |
| cwk 11 | 1 | 7 |

London-2027 (29 weeks), cwk 8 → 18: **11-week ramp, 18 weeks of marathon plan left**
(above §44's warn=16), **§111 ratio 2.61** against 4.0, and the **acute step into week 1
goes +50% → 0%**.

**The structural finding behind it.** §111 names a base-building plan as its remedy;
§57 makes that remedy impossible. `foundationBlock.ts:357`, comment verbatim: *"Hard
ceiling: effective_baseline × 1.10 (applied to every week, not just final)"* — code is
`Math.min(baseline × 1.1^i, baseline × 1.10)`. **From week 2 every foundation week is
baseline × 1.10. The block is flat by construction, at any length.** Two principles in
deadlock; neither sitting saw it because each was convened on its own question.

---

## The board

**🏃 Hutchinson (chair).** The finding stands. But the submission overreaches once:
*"satisfies every condition recorded at that sitting"* — it satisfies every condition **we
wrote down**. Yesterday asked for `measure:fitness` **on the admitted cohort**, and that
still does not exist. A ramp table is arithmetic, not a generated plan.

**📊 Seiler.** My 884 violations were about the week getting small **in the main plan** —
easy running leaving §1's denominator and raising the quality share without adding
quality. A pre-plan block excluded from that denominator does not do it. **I withdraw the
distribution objection for this shape.** Unasked: the block is all easy, and that is
correct. **Do not put a quality session in it to make it feel like training.**

**Q3 — the ratio control is arithmetically meaningless for most of this product, and that
is a ruling, not an opinion.** §1 counts **sessions**. At 3 days the available ratios are
100/0, 67/33, 33/67. **There is no 80/20 to select.** You need 5+ days before the control
has more than one usable position, and the charity cohort is 3–4 days.

**🎯 McMillan.** This is what a coach does: you do not turn away a London place, and you
do not start them on the marathon plan — you spend three months getting them to where it
starts. Two Tuesday tests: **the block must be labelled as pre-plan**, and **what happens
when they miss two weeks of an eleven-week ramp?** The main plan degrades via §2 and the
reshaper; a pre-plan block has no such machinery, and this is the runner most likely to
miss a fortnight. **Lower bound: where the ramp leaves ≥16 weeks** — §44's own warn
threshold, not a new number. Q3: no objection from my seat, because the runner does not
want a ratio. They say *"I'm knackered"*. **Give them that sentence.**

**🩹 Willy. Q1b — yes, this is the form I said I would approve.** Opening week bounded
against where the runner actually is, peak unchanged at 47, nothing scaled off
self-report. Two binding conditions: **(i) ramp governed by §2's rate, not §57's** — same
number, different rule, and this is a progression not a habit block; **(ii) the per-run
step must be governed**, not just the weekly. At 8 km/wk over 4 days that is 2 km a run;
at 18 it is 4.5. **The per-run doubling is the load event.** §2 Amendment 2 from this
morning is literally about this.

**Q1c — volume only.** A runner at 8 km/wk over 4 days is already running 2 km at a time,
and 2 km continuous is not a tissue problem for someone already doing it. Run-walk is for
the runner who cannot run 2 km continuously, which is **below the lower bound anyway**.
**Do not build run-walk to copy a competitor.**

**Q2** — a Tuesday CrossFit session does change Wednesday's run: **fatigue first, tissue
second**, and modality-dependent (plyometrics and heavy lower-body are a tissue event;
yoga and swimming are not). **One chip is not enough information.**

**⚕️ Sims. Q1 is the best thing in the batch for this cohort.** Yesterday I said the
failure mode for a predominantly female, 20–29, first-time cohort is **under-fuelling, not
injury** — the 60% jump arrives before the bone does. **This takes that jump to zero.**

⚠️ **Condition, and it is a condition:** eleven weeks of progressive volume is still an
energy-availability question even at 0% acute step, because total load rises 125% across
the block. It rises slowly enough for intake to track it — **but only if the block says
so. A silent ramp is not a fuelled ramp.** The block carries the fuelling note (§24e's
existing machinery, newly scoped) or I do not support it.

**Q2 — I make the opposite argument to the one expected.** The value is not load damping.
It is that **a runner doing three CrossFit sessions plus four runs has an energy-
availability problem we cannot see.** RED-S is the thing I have been unable to surface
all year. That is a different feature.

---

## Recorded disagreements

- **Willy vs the submission on cadence (Q1).** Submission models 3 deloads in 11 weeks and
  treats the ramp as settled; Willy wants the **per-run** step governed under §2 Am.2.
  *Settled by:* building and measuring, not by argument.
- **Sims vs Willy on what Q2 is for.** Willy: a fatigue/tissue input, modality-dependent,
  one chip insufficient. Sims: the load use is secondary — the real value is **energy
  availability**, which needs volume and frequency, not modality. **Not resolvable here:
  they are proposing two different features from one input.**
- **McMillan's lower bound** (≥16 weeks remaining) drew no dissent but is his number and
  is attributed.

---

## Rulings

### Q1 — CORRECT WITH AMENDMENT, as a SHAPE. **Not approved to ship.**

A base-build on-ramp **is a distinct prescription shape** from the foundation block
(Q1a: distinct — §57 is a flat habit block by construction and by CB-1's ruling; this is
a progression). It needs **its own principle §**. **Do not raise `FOUNDATION_MAX_WEEKS`** —
that was correctly vetoed and this is not that.

**Binding amendments:**
1. Ramp governed by **§2's rate**, scoped as a progression, not §57's habit cap. *(Willy)*
2. **Per-run step governed under §2 Amendment 2** (2026-09-20), not weekly alone. *(Willy)*
3. **Lower bound: the ramp must leave ≥16 weeks** of main plan — §44's ratified warn
   threshold. *(McMillan)*
4. **The block carries the fuelling note**, scoped from §24e. *(Sims)*
5. **Labelled as pre-plan**, and the missed-weeks degradation path specified before build.
   *(McMillan)*
6. **All easy. No quality.** *(Seiler)*

⚠️ **Chair's gate, unchanged from yesterday:** build behind a flag, generate the cohort,
run **`measure:fitness` and the property sweep**, bring the numbers back. The 09-19 record
is the standing reminder that a hand-rolled grid showed 0 violations where the sweep
showed 884.

**Q1c — volume only. Run-walk NOT scoped.**
**Q1e — the blocking chain does NOT apply** (it ran through candidate A).

### Q2 — INCORRECT as scoped. Do not build the capture.

Not because cross-training is irrelevant, but because **the board wants two different
features from one input** and a five-chip toggle serves neither. **One chip captured now
is the `motivation_type` outcome**, and the submission's own Q2d answered itself.

**What would make it correct:** pick one feature, specify what the engine does with the
input, return. **Board's unanimous steer: Sims's energy-availability framing is the more
valuable and the less well served elsewhere.**

### Q3 — INCORRECT. **This is a veto.**

Seiler's arithmetic is dispositive: **at 3–4 days a week there is no 80/20 to select.**
The control presents a continuous-looking choice over a discrete, coarse quantity — a
claim the engine cannot honour.

**Q3a is moot**, but for the record the §79 asymmetry *would* transfer if the control were
meaningful: down freely, never up.

**Q3d — confirmed.** Race date, running days, long-run day, runs per week, blockout days
and weekday caps are **scheduling constraints, not prescription decisions**. **P-02 ships
without the intensity row and loses nothing this board would defend.**

⚠️ **What would make Q3 correct:** McMillan's reframing — *"this feels too easy"* /
*"I'm knackered"* as a signal into the existing reshape machinery, **not** a new authority
over §1. If it returns, it returns as that.

---

## Required artifacts

**Q1** — deferred until the measurement gate clears. When it does:
1. **Principle** — a new § (next free number) carrying: the distinction from §57, the
   ≥16-week bound, §2-not-§57 scoping, per-run governance under §2 Am.2, the fuelling
   obligation, the all-easy rule. **§111's Recorded Limitation gains a cross-reference.**
2. **Numeric** — `BASE_BUILD_ONRAMP_*` in `GENERATION_CONFIG`. ⚠️ **Not in
   `foundationBlock.ts`, not in a route** — §106 and `MARATHON-VOLUME-GATE-01` are both on
   record as the same defect of a table in the wrong file.
3. **Invariant** — per-week and per-run steps are checkable. ⚠️ **The 0% acute step is NOT
   mechanically checkable**, for §111's stated reason: it compares a plan to an input
   outside it.

**Q2** — none. **Q3** — none, and the veto is recorded in `coaching-rulings.md`.

## SLT escalation

**Q1 — yes**, carried same day. Build-or-not against an October deadline.
**Q2 — yes, narrowly:** Sims's RED-S framing needs a product owner. The board asked it be
raised as a **pattern** (third Sims ask to die on missing data). ⚠️ **The SLT split that
pattern and was right to** — see `slt-2026-09-20-miles-teardown-batch.md`.
**Q3 — none.** Vetoed on correctness.
