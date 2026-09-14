# Coaching Board — MARATHON-MAINT-LABEL-01, re-opened

**2026-09-13 (second sitting).** Item 2 of the batch sitting was re-opened by the
build, because the build measured its stated mechanism and the mechanism was not
there. Chair: Hutchinson. Evidence:
`docs/investigations/marathon-maint-label-01-measurement-2026-09-13.md`;
detector `scripts/measure-marathon-maint-label.ts`.

**Trigger:** `CoachingPrinciples.md` §24, `ruleEngine.ts` classifier — hard.

---

## 🔍 Conflict scan

**§45 already legislates the case the amendment wanted to change.** Its own text:

> *"When the §24 floor (peak long-run race ratio) cannot be reached without
> violating this cap, this principle wins and the plan downgrades to
> `maintenance`."*

**§24 already anticipates the cap winning:** *"The absolute `LONG_RUN_CAP_MINUTES`
ceiling still wins — the engine never prescribes a long run that exceeds the time
cap, even if doing so would satisfy this floor."*

Touches §23, §46, §52, §106. No zone-model translation involved.

---

## The board

**🏃 Hutchinson (Chair).** The amendment cannot be rescued by substituting §45,
because §45 already says this in its own words. Re-filing it as a §45 question
asks the board to overturn a ratified principle, not clarify one. The measurement
also removes the motivation: 108 of 162 marathon plans below the floor are short
by **more than 6 km**, and for them "maintenance" is an accurate description, not
a mislabel. My batch-sitting reasoning inferred a mechanism from an arithmetic
sketch and never checked which constraint actually binds. That is on this chair,
and it is the second premise in one sitting to fail that way (item 7's "the
cadence already exists" was the first).

**📊 Seiler.** No objection from this seat. §1 counts sessions, not volume; a
`volume_profile` label moves no distribution.

**🎯 McMillan.** The two ends of this are not the same case and must not get the
same answer. Six kilometres short of a 31.7 km long run is a real gap and the
runner deserves to be told. **150 metres short is not a coaching fact, it is an
arithmetic artefact** — and today the runner reads the identical sentence for
both. That is the only part of this worth fixing.

**🩹 Willy.** §45 does not move. It is the spike-then-recover principle and the
audience it protects is precisely this one. On the rounding point: 0.5 km on a
31.65 km long run carries no tissue implication whatsoever. Comparison bug, not a
load change. Fix it there and nowhere else.

**⚕️ Sims.** No sex-linked objection. Worth noting the `volume_profile` label is
the one place a runner is told their plan is not building; being wrong about that
by 150 metres is worth fixing for that reason, not a physiological one.

---

## ⚡ Recorded disagreements

None on the ruling. Hutchinson and McMillan differ in emphasis on whether the flat
100% marathon rate is a problem at all — Hutchinson holds the label is simply
correct for that population, McMillan that a label which never varies stops being
read. Both agree it is a **utility** question and therefore not this board's to
settle as a correctness matter.

---

## ⚖️ Ruling

| Q | Ruling |
|---|---|
| 1 — does the amendment stand with §45 substituted? | **INCORRECT.** It contradicts §45's ratified text. Delivery path **closed**. |
| 2 — correctness or utility? | **Utility.** The label is correct and undiscriminating. A better label is a separate item; a looser trigger is not the answer. |
| 3 — rounding tolerance on §24's floor | **CORRECT.** → §24 Amendment 1. |
| 4 — HM | Cap-exclusion **moot** (the cap never binds at either distance). The rounding fix is distance-agnostic and covers HM. `HM-MAINT-LABEL-01` closed by this ruling. |

**Evidence for Q3:** short by ≤ one rounding step — marathon **9 plans (5.6%** of
those below the floor), HM **6 (7.7%)**. Short by >6 km: 108 (66.7%).

---

## 📦 Artifacts

1. **Principle** — §24 **Amendment 1**: the floor comparison allows one
   `DISTANCE_ROUNDING_PRECISION_KM` step, at *every* site that compares against it.
2. **Numeric** — **no new constant.** Reuses
   `GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM` (0.5); the tolerance *is* the
   rounding that caused the artefact. Absence stated so it is not read as an
   oversight.
3. **Invariant** — `INV-PLAN-LR-FLOOR-NOT-ROUNDING` + `plan-invariants.md` row, plus
   the same tolerance applied to the existing `INV-PLAN-PEAK-LR-RACE-RATIO`.

**Two sites, and the reason is not symmetry.** The classifier's tolerance flips
near-miss plans `maintenance → build`, and `INV-PLAN-PEAK-LR-RACE-RATIO` is exempt
while a plan is maintenance. Amending only the classifier therefore un-exempts
exactly the plans it just forgave and errors on them — measured as **3 hard
failures** in the cohort grid before the invariant was brought into line.

**Declared cohort move** (`cohort:shape` re-baselined): maintenance **51.0% →
50.6%** overall; **HM 40.7% → 38.9% (−1.8pp)**; **marathon 71.1% → unchanged**,
because two-thirds of marathon plans below the floor are short by more than 6 km
and are correctly labelled. 5K and 10K untouched.

---

## ↗️ SLT escalation

**One, on Q2.** The marathon `volume_profile` label is correct but carries no
information at 100%. Whether to invest in a more discriminating label — or a
second dimension alongside it — is a product question about what the runner is
told, not a correctness question. Hutchinson carries it. Not urgent: no runner is
currently told anything false.

---

## Standing note for the next sitting

Two of seven rulings in the 2026-09-13 batch stated a mechanism that measurement
did not support (item 2 here; item 7's fuelling cadence, where `fuel_every_mins`
existed but on rows that never reach the session the cue attaches to). Both
verdicts were defensible; both stated causes were wrong. **A ruling's verdict is
this board's authority; its stated mechanism is a hypothesis, and the build should
re-derive it from the code before implementing.** Recorded so the pattern is
noticed rather than repeated.
