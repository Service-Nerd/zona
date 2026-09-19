# Coaching Board — 2026-09-19 — S111-SUBFLOOR-VOLUME-01

**Question:** what admits a first-time charity marathoner at 8–11 km/week with 29 weeks of
runway, given the founder's standing P0 that this cohort must not be refused?

**Trigger:** `CoachingPrinciples.md` §111 · `generationConfig.ts`
(`MAX_BASE_BUILD_RATIO`, `BUILD_VOL_INIT_FLOOR_VS_PEAK`) — **hard**.

**Ruling:** **INSUFFICIENT EVIDENCE** on admitting the cohort. **CORRECT** on the finding
that §111's threshold is misplaced relative to its own stated hazard. **§111 stands
unchanged.** Escalated to the SLT.

---

## A correction made before the board spoke

The submission claimed the refused runner at 11 km/week faces a +49% opening step against
the admitted runner's +50%. That compared the raw **floor** (16.45 km) for refused runners
against the **delivered** week 1 (18 km) for admitted ones — two different quantities.

Re-measured properly, with `MAX_BASE_BUILD_RATIO` temporarily lifted so the refused cohort's
plans could be inspected:

| `current_weekly_km` | 4 | 6 | **8** | **10** | **11** | **12** | 14 | 16 | 20 |
|---|---|---|---|---|---|---|---|---|---|
| delivered week 1 | 9 | 9 | 9 | 13 | 13 | **18** | 18 | 18 | 24 |
| acute step | +125% | +50% | **+13%** | **+30%** | **+18%** | **+50%** | +29% | +13% | +20% |
| §111 | refuse | refuse | **refuse** | **refuse** | **refuse** | **admit** | admit | admit | admit |

**The conclusion survived and sharpened.** The step is sawtooth, not monotonic. §111 refuses
+13%, +18% and +30% and admits **+50%**, the largest acute jump in the band.

---

## The measurement

London-2027 profile: plan start 2026-10-05, race 2027-04-25 (29 weeks), finish goal,
4 days/week, age 38, `training_age: '<6mo'`, `longest_recent_run_km = 0.4 × cwk`.

1. **The door is exactly 12 km/week.** cwk 4/6/8/10/11 all throw `BaseVolumeError`; every one
   reports `peak_km 47`, `min_base 12`.
2. **The peak is flat at 47 across the whole sub-floor band** — `peakKm = max(levelPeakKm 52,
   startKm)`, so the base does not influence it below 47.
3. **The ceiling is runway-blind.** At cwk 10 with 20 / 29 / 52 weeks the ratio is 4.70 and
   the refusal identical in all three.
4. **The acute step is unguarded and cannot be guarded.** `validatePlan` returns five
   violations on the admitted 12 km/week plan and none is about the +50%: §2 compares week
   *n* to week *n−1* inside the plan, and week 1 has no predecessor. No invariant can close
   it — the step compares a plan to an input outside it.

### Candidates built and measured at the sitting

| Candidate | Result |
|---|---|
| **A** — floor yields to §2's ramp, `min(peak × 35%, startKm × 1.10)` | Opens the door 12 → 8 km/wk; peak scales with the runner (cwk 10 → 35, 16 → 46, 30 → 65), which would also dissolve `S106-FLAT-PEAK-01`'s residual; week-1 steps become 0% / −9% / +17%. **But +884 NEW error violations on the property sweep** — `INV-PLAN-LR-MAX-WEEKLY-PCT` +516, `INV-PLAN-QUALITY-VARIETY-FULL-PLAN` +207, `INV-PLAN-INTENSITY-DISTRIBUTION` +161. **Rejected.** |
| **B** — same, bounded below by `days_available × MIN_KM_PER_TRAINING_DAY` | **Measured no-op.** At 4 days that floor is 20 km, above the 16.45 km init floor, so it dominates and nothing moves. |

⚠️ **A hand-rolled 264-case grid showed ZERO violations for candidate A where the property
sweep showed 884.** The sweep is authoritative. This is the recorded
`measure-on-the-sweep-not-the-cohort-grid` trap and it was caught only because both were run.

---

## The board

**🏃 Hutchinson (chair).** §111's own text records the 18 km week 1 and the 3.6× jump for a
5 km runner, and uses it as the *justification for refusing*. §113 Amendment 1, nine hours
later the same day, vetoed a refusal on the identical structure because *"a rule that
manufactures the hazard it then refuses over is not coaching-correct"*. **Two rulings, one
day, opposite directions, same question — and nobody noticed they were the same question.**
What is genuinely new is the sawtooth and the runway-blindness. A ratio with no time
denominator is not a measure of load.

**📊 Seiler.** The 884 violations are the finding, not a side effect: shrinking the week
raises §1's quality *share* without adding a single quality session, because §1 is a
session-count ratio and easy running left the denominator. Separately — 47 km is not a
marathon build in the elite sense, this is a four-hour-a-week runner, and **a 35 km peak that
is properly polarised beats a 47 km peak that drifts.** I would not defend 47 as a number
worth refusing someone over.

**🎯 McMillan.** No coach turns away someone with a London place and seven months because
they run 10 km a week. But a 10 km week with a 6 km tempo in it is an arithmetic artefact,
not a coached week — that is the honest reason to reject candidate A, and it has nothing to
do with whether the runner is admitted. §111's own text names the remedy and says it is not
built. We are refusing 500 people because `FOUNDATION_MAX_WEEKS` is 3.

**🩹 Willy.** I put this ceiling here and I am not moving off it for signups. But I do not
defend the sawtooth: *"a gate that admits +50% and refuses +18% is not enforcing my concern,
it is enforcing a proxy for my concern that inverts at the boundary."* **I block any form
that scales the PEAK off `current_weekly_km`** — §106 made "never a scaled target" my
condition of approval and it binds in both directions, because self-report is unverified in
both. What I would approve is the opening week bounded against where the runner actually is,
**peak target unchanged**.

**⚕️ Sims.** This cohort is predominantly female, 20–29, first-time. Asking someone running
10 km a week to run 18 next week does not produce injury first — it produces under-fuelling,
because nothing tells them a 60% volume jump needs a matching intake change. **RED-S is this
cohort's failure mode, and it arrives before the bone does.** That makes the opening step
more important than the peak, which is where Willy lands from tissue. Recorded: this is
reasoning from a male-derived default, `INPUT-SEX-01` is parked, and I cannot do better with
the data collected.

---

## Recorded disagreements

- **Seiler vs Willy on the peak.** Seiler: 35 vs 47 is not worth a refusal at this volume.
  Willy: the peak must not be a function of self-report in either direction. *Settled by:*
  `measure:fitness` on the admitted cohort — which cannot be run, because the cohort is
  refused.
- **McMillan vs Willy on sequencing.** Admit now and fix the mechanism after, versus refusing
  to admit through a mechanism just called an inverted proxy. *Not resolvable by this board.*

---

## Why nothing shipped

Candidate A's violations are **§52 failing to apply its own remedies** (*"reduce the long
run, raise weekly volume, or downgrade to maintenance"*) at week sizes the engine has never
had to produce. That is `S52-LOPSIDED-BOUND-01` — P1, failed twice, standing instruction
**do not add a third per-week bound**.

**Blocking chain:** `S52-LOPSIDED-BOUND-01` → `S111-SUBFLOOR-VOLUME-01` →
`S111-DENOMINATOR-01`.

---

## Artifacts

1. **Principle** — §111 gains a *Recorded limitation* section (the table, the runway-blindness,
   both failed candidates, the blocking chain). **No rule change.**
2. **Numeric** — none.
3. **Invariant** — none, and **not mechanically checkable**: the week-1 step compares a plan
   to an input outside it.

## SLT escalation

Four of five seats would admit this runner; Willy will not admit them through this mechanism;
§111 already names the remedy and says it is not built. **The base-building plan
(`REFUSAL-SCREEN-01` part 2 — a ~20-week ramp against `FOUNDATION_MAX_WEEKS = 3`) is what
admits 500 charity runners, and it is currently marked "deliberately not in this queue."**
Build-or-not against an October deadline is Traynor's and Fried's call, not this board's.
