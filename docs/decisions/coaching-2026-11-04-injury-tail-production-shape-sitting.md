# Coaching Board — `INJURY-TAIL-PRODUCTION-SHAPE-01`

**Date:** 2026-11-04 · **Chair:** Hutchinson · **Seats:** Seiler, McMillan, Willy, Sims, Blagrove (scoped)
**Trigger:** `docs/canonical/CoachingPrinciples.md` §94 Am.4 — hard
**Outcome:** Am.4's lever-count attribution **VACATED**; the segmented gate **CORRECT**; the onset prototype **INSUFFICIENT EVIDENCE**

---

## The question as filed

> The injured delivered-ramp tail is 42%, not 18%, and ADR-022's lever claim was measured on a forced structural band.

## What the measurement found before any seat spoke

The filing is arithmetically true and **its conclusion is backwards.**

`segmentOf` in `deliveredRampTail.test.ts` calls any injury history `injury`, and `TARGETED_INJURIES` is
`Knee | Shin splints | Achilles`. **ADR-022's three levers and §12's producer cap are scoped to knee/shin by
name** (`hasVolumeCappedInjuryHistory`). Achilles sits in the *checker's* wider cohort
(`DELIVERED_CAP_INJURIES`) by §94 Am.2's own ruling of 2026-09-25, and receives none of the levers.

| cohort | ADR-022 levers | firings / plans | rate |
|---|---|---|---|
| knee | **BIND** | 0 / 202 | **0.0%** |
| shin splints | **BIND** | 0 / 199 | **0.0%** |
| achilles | none | 48 / 199 | **24.1%** |

Full achilles population of `targetedGrid` — 1,536 rows, so the sample is not flattering it — **400 / 1,536 = 26.0%**.

**The injury segment's tail is composed entirely of the cohort the levers do not reach, and the 18% figure of
2026-10-10 was too.** The corpus fix did not expose a lever failure; it revealed that this segment had never
tested the levers at all.

### Driver decomposition — all 400 achilles firings

The governed arm is the **non-long-run** portion, which contains the quality session. ADR-022's ratified lever
order is *"easy runs trim, the §52 long run never does, **and a quality session is never touched**"*.

| driver | n | share | |
|---|---|---|---|
| quality arrived, easy flat or **DOWN** | 176 | **44.0%** | ADR-022 **forbids** trimming this |
| easy rose, quality flat | 96 | 24.0% | the lever set's own target |
| both rose | 128 | 32.0% | partly actionable |

### The worst case, traced

HM · 30 km/week · longest 12 km · age 40 · Achilles · declared experienced · assessed **intermediate/experienced**.
Fires **+42% non-long-run in W6**, the base→build transition.

```
W5 base    total 23.5km  long 11.5  non-long 12.0   (3 x 4.0 easy)
W6 build   total 31.0km  long 14.0  non-long 17.0   <<< FIRES
             quality  CV intervals   9.0km
             easy                    4.0km
             easy                    4.0km
```

**Easy running falls 12.0 → 8.0 km to fund a 9 km CV-interval session.** Nothing ramped; the week re-composed.

---

## The board

**🏃 Hutchinson (chair).** The filing is true and its conclusion is backwards, and that goes on the record before
remedies. You cannot put a claim in question with a population containing no instance of the thing the claim is
about. Am.4 attributed a low injured tail to lever count and the segment it measured was 100% achilles. **The
attribution was wrong at the original sitting, in both directions, and segmentation by cohort — which Sims made
binding — was not fine-grained enough to show it.** What I will not accept is this becoming a threshold
conversation: §2 Am.2 is verbatim and binds — *outcome evidence, not another corpus measurement* — and everything
here is a corpus measurement, including the good parts.

**📊 Seiler.** I asked last time whether p99 ≈ max was a tail or a clamp. This time the number is there: **32
firings at +42% from exactly two distinct input cells**, differing only on `weeks_at_current_volume`, which
cannot touch week 6. One week shape counted thirty-two times; nine distinct values across 400 firings. **That is
not a distribution and nobody should describe it as one.** On the mechanism: the rise is a quality session
arriving and the easy volume going *down* to pay for it. That is the swap I have described in recreational
athletes for twenty years, visible in the engine — and it is `TAPER-OVER-PEAK-01`'s mechanism again, a quality
session sized by a work-minute dose against an easy run sized by the week's target. **Measured as a "delivered
ramp" it is mislabelled.**

**🎯 McMillan.** Then the honest sentence is that this runner's week 6 is their first hard session in six weeks
and we are calling it a volume error. Five easy weeks at 4 km, then 9 km of CV intervals lands — any coach says
*of course*, that is the base-to-build transition. The number that matters is not +42%: it is that the runner is
doing **8 km of easy running in the week they take on their first intervals, down from 12**. **We shrank the easy
running to afford the quality. That is backwards for an achilles.** No objection to the measurement; I object to
the plan.

**🩹 Willy.** Strongest load result this board has had in months, and I want it read correctly. **Where my levers
apply, delivered breaches are zero** — 401 plans, not one firing. That is not "the levers bind", that is the
levers working completely, and it is the best reason yet to want the experiment I filed as
`DELIVERED-TAIL-LEVERS-01`. It is **not** outcome evidence and I am not pretending it is.

What I will not let pass: **achilles gets the tighter check and none of the help.** I agreed that asymmetry on
2026-09-25 and would again — §12's cap is for tissues whose binding constraint is acute weekly load, and tendon
is a rate-of-change problem. So widening §12 to achilles is still the wrong instrument. But 2026-09-25 also
recorded what would reopen it: *rises the engine may not trim*. **44% of achilles firings are a quality session
arriving while easy volume falls, and ADR-022 forbids trimming a quality session**; a further 32% are mixed. **In
up to three quarters of cases the governed arm reports a load change my lever set is not permitted to touch.** A
check that reports a problem nobody may act on is what I called noise, and noise gets suppressed.

The real finding is **§89, not §94**. A 9 km CV-interval session is the worst load event you can hand a
previously-injured achilles, and we place it in the week we cut their easy running. Tendon wants volume held and
intensity introduced gradually; we did the opposite. **Binding condition: do not trim the quality session to fix
this. Removing the stimulus is not load management, it is withholding training.**

**⚕️ Sims.** Segmentation was binding at my insistence and it was still too coarse — I take that. The cohort this
lands on is the one I named on 2026-09-25: tendon and fascia stiffness are oestrogen-sensitive, peri- and
post-menopausal runners show altered tendon mechanical properties and slower load adaptation, so **the achilles
cohort is disproportionately the women using this app.** On 2026-09-25 they had no check. They now have a check
and no mechanism — an improvement in bookkeeping, not in training.

The easy-volume raid is the specific harm: for a runner with slower tendon adaptation, cutting 4 km of easy
running to fund intervals removes the low-stress loading that builds tolerance and adds the high-stress loading
that tests it, in the same week. **And the worst cell is `age=40`, below `MASTERS_AGE_THRESHOLD` of 45** — a
tendon case invisible to the masters segment. The segmentation splits age and injury and never crosses them, so
**post-menopausal × achilles is in neither grid.**

**💪 Blagrove (scoped, adjacent).** If the engine may not remove the interval session loading the tendon, the S&C
answer is not to remove it: **tendon tolerance is built by loading**, and heavy slow resistance for calf/achilles
is the best-evidenced intervention named in this room. `STRENGTH-ENGINE-01` exists. **My standing limit repeats:
my own 2024 meta-analysis found unsupervised runner programmes did not reduce injury, and no surface may claim
they do.** Tolerating a prescribed session is a different claim from preventing injury; only the first is
supportable.

---

## Recorded disagreements

**Willy vs the filing, on what is wrong.** The item says ADR-022's lever claim is in question; Willy says the
levers are demonstrably complete on their own cohort and the finding belongs to §89's quality onset. *What would
change his mind:* a single knee or shin firing. There are none in 401 plans.

**Willy vs Sims, on the instrument.** Willy wants the governed arm decomposed so it stops reporting untrimmable
load. Sims wants it left whole and the *prescription* changed — an unactionable warning is still a true statement
about the runner's week, and hiding it serves the engine rather than the runner. *Settled by:* the artifact
reports **both** drivers and suppresses neither, so both seats accepted it.

---

## Ruling

1. **§94 Am.4's lever-count attribution — INCORRECT, VACATED.** Chair's veto, no seat dissenting. The magnitude
   baseline, the segmentation and the refusal to set a threshold all stand.
2. **Segment by lever scope and by driver — CORRECT.** Changes no prescription; changes what the gate can see.
3. **Ramp the quality ONSET for tendon histories, easy volume held — INSUFFICIENT EVIDENCE.** *What would settle
   it:* `measure:fitness` on the achilles cohort before and after a prototype holding easy volume across
   base→build and introducing the first quality session at a reduced dose, with Willy's binding condition and
   §1 CD-19 re-checked. Filed `ACHILLES-QUALITY-ONSET-01` 🏃.
4. **Refused outright:** any threshold on the magnitude (§2 Am.2, §94 Am.3).

## Artifacts

| | |
|---|---|
| **Principle** | §94 Amendment 5 |
| **Numeric** | **None, and that is the ruling.** The no-constant gate widened to the two names a future achilles tolerance would take |
| **Mechanical check** | No new invariant — `INV-PLAN-DELIVERED-RAMP` unchanged (`warn`, §34). `deliveredRampTail.test.ts` 6 → 13 arms |

⚠️ **One of the six new arms was hollow and a mutation caught it.** Forcing every driver to `'easy'` — claiming
every rise is one ADR-022 may trim — left **all twelve arms green**, because a one-sided ratchet reads 0% as a
triumph. The vacuity floor exists because of that. Six mutations run, five red first time.

⚠️ **The unactionable-share baseline was first set at 76% (the full-population figure) against an arm that
measures the 1,800-input sample at 70.9%** — 5pp of slack nobody decided to grant. Tightened to 71. §94 Am.3's
*"any non-zero tolerance is an invented number"* applies to a baseline exactly as to a threshold.

## Filed

- `ACHILLES-QUALITY-ONSET-01` 🏃 — the prototype above, blocked on `measure:fitness`
- `GRID-NO-MENOPAUSAL-TENDON-01` ⚕️ — post-menopausal × achilles is in neither grid

## What this sitting does not establish

No prescription moved; `verify:parity` is identical by construction. Nothing here is outcome data, so
`DELIVERED-TAIL-LEVERS-01` and `ACHILLES-QUALITY-ONSET-01` both remain blocked exactly as §2 Am.2 requires. The
0-of-401 result is engine evidence that the lever set drives breaches to zero on its own cohort — **not evidence
that doing so reduces injuries.**
