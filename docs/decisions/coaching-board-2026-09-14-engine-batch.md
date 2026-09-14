# Coaching Board — engine batch (DELOAD-POS2-01 · SC-10 · QUALITY-ONSET-ORDER-01)

> ## 🛑 ITEM 2 (SC-10) IS WITHDRAWN — the premise I brought to this board was FALSE.
>
> **Discovered while starting the build, hours after the ruling.**
>
> I reported *"VO2MAX_MAIN_SET_MAX_MINS (20) is exceeded by 91.9% of VO2max
> interval sessions"*. The 20-minute **main-set** ceiling does not govern those
> sessions. `INV-PLAN-VO2MAX-MAIN-SET-CAP` **branches**: where work minutes are
> derivable it checks the ratified **12–18 minute WORK band**, and the 20-minute
> main-set figure is only the fallback for **legacy v1 rows**.
>
> **Measured: 3,996 of 3,996 VO2max interval sessions (100%) carry a `derived_set`
> and a `pace_target`** — every one of them is work-band governed, and the
> property sweep is clean, so every one is INSIDE 12–18. There is no breach.
>
> **The ordering comparison was also the wrong quantity.** A main set is
> work **plus recoveries**. VO2max runs ~1:1 work:recovery; threshold runs short
> jogs. So 15 min of VO2max work is a ~30 min main set while 22 min of threshold
> work is a ~26 min main set — **a longer VO2max main set is the CORRECT
> consequence of a shorter VO2max work dose.** My measured 25.5 vs 23.7 is that,
> not an inversion.
>
> **SC-10's original defect appears to have been fixed by SC-08/CD-14's work
> bands.** My measurement resurrected a dead finding by comparing main-set
> minutes where the constitution governs work minutes.
>
> **Willy's binding condition is what exposed it** — "prove work minutes do not
> fall below the floor" sent me to the work reader, and the work reader showed the
> cap I was measuring against was not the operative rule. A condition attached to
> a ruling caught the ruling's own premise.
>
> The ruling below is void. Items 1 and 3 are unaffected — neither depends on it.


**Date:** 2026-09-14 · **Batch sitting, explicitly requested.**
**Round:** `coaching-review/2026-09-14/`
**Trigger:** `deloadCadence.ts`, `ruleEngine.ts` — soft, all qualify (each changes what the engine prescribes).

All three arrived with measurements from the widened 7,452-plan grid (GRID-COVERAGE-01). None has shipped.

---

## 🔍 Conflict scan

| § | Bears on |
|---|---|
| **§1** | Item 1's blocker. **Its denominator INCLUDES deload weeks** — it excludes only foundation weeks (`w.n >= 1`, CB-FOUNDATION-DENOM-01). This is what breaks the submitted mechanism; see the ruling. |
| **§3 / §87 / §95** | Item 1. §87 forbids a deload opening a phase and implements it by walking and **re-anchoring**, not by shifting. §95 named position 2 "the same defect one week over". |
| **§5** | Items 2 and 3. `VO2MAX_ONSET_MIN_ADAPTATION_WEEKS = 5` drives `vo2MustOpenBuild`. **Expressed in WEEKS, not in session size** — which settles the Item 2 / Item 3 interaction. |
| **§8 / §53** | Item 2's ratified dose bands, and Item 1's second breach. |
| **§79** | Item 3, already ruled on earlier today. |
| **CD-16 / CD-19** | Seiler's "moving VO2max earlier must not become MORE VO2max"; §1 counts **sessions**, plan-wide. |

---

# ITEM 1 — DELOAD-POS2-01

## ⚖️ Ruling — INSUFFICIENT EVIDENCE

**The placement fix itself is sound and the board would take it.** It satisfies all three of §87's own constraints on 7,452 plans — position-2 deloads **37.0% → 0.0%**, deload count *rose* on 1,944 and **fell on none** (Willy), worst loading run **lengthened on none** (Sims) — and it does it with §87's own mechanism rather than the ±1 shift §87 already measured as unimplementable.

**What blocks it is that the submitted mechanism for the §1 breach does not survive the conflict scan.**

The brief proposed: *more recovery → fewer loading weeks → fewer running sessions → quality share rises.* **§1's denominator includes deload weeks.** Converting a loading week into a deload removes a quality session *and* leaves the easy runs counted, so the share should **fall**, not rise. The submitted story predicts the opposite sign of the observed effect.

So the 22 × §1 and 10 × §53 breaches are real and measured, and **nobody yet knows what causes them.** They may not be a recovery-versus-distribution trade-off at all — they may be an artifact of the re-anchored cadence shifting phase boundaries, which would make the "is an extra deload worth a §1 breach?" framing the wrong question entirely.

**Hutchinson (chair).** I will not rule a trade-off between Willy's recovery rule and Seiler's distribution rule when the evidence that they are even in tension is a mechanism that fails arithmetic. Ruling here would ratify a story, and this board's whole purpose is to stop that. **The author flagged the mechanism as unisolated rather than presenting it as fact, which is why this is INSUFFICIENT EVIDENCE and not a rejection.**

**Seiler.** My §1 is a session-count rule, plan-wide. If the share genuinely rises when recovery rises, something is removing *easy* sessions, not quality ones — and that is a different defect wearing this one's clothes. Do not tune my ceiling to accommodate it until you know which.

**Willy.** The position-2 defect is real and worth fixing: one week of a new stimulus followed by recovery from it is the §87 pattern one week over, and it lands on 37% of plans. I want this shipped. I do not want it shipped with 22 error-severity breaches attached.

**McMillan.** No objection to the placement. The runner-visible outcome — finish base, start build, and the first week is actually a build week — is plainly right.

**Sims.** No objection from this seat, with one note: if the eventual fix trims quality to hold the ratio, that changes a second thing, and the trimmed sessions should not land disproportionately on the low-volume plans that already carry the least.

### What evidence would settle it

Per-plan **before/after counts of `hard` and `running`** for the 22 breaching plans, plus their phase boundaries. One table. It will show in a single read whether the denominator moved, the numerator moved, or the phase split moved — and only then is there a trade-off to rule on.

---

# ITEM 2 — SC-10

## ⚖️ Ruling — CORRECT WITH AMENDMENT

**The cap must be spent in the currency it was set in.** `vo2maxCapKm = durationForMainSet(20) / pace.minPerKmInterval` converts minutes→km at I-pace and binds correctly (traced session: 8 km against an 8.2 km ceiling). The session's duration is then computed at ~5.38 min/km while its own `pace_target` reads 4:30–5:00 (midpoint 4.75), so `mainSetMinutes(43) = 23.7` against a declared cap of 20. **A ceiling applied in one unit and spent in another is not a ceiling.** 3,672 of 3,996 sessions exceed it — **91.9%**, mean +4.9 min.

**The declared 20 stands; the delivered 25 is what is wrong.** The board considered the inverse — that 25 is right and 20 is stale — and rejects it: the constitution already ratifies the dose ordering in `VO2MAX_WORK_TARGET_MINS` (12–18 min) against `THRESHOLD_WORK_TARGET_MINS` (18–26), with the reasoning stated inline — *"threshold pace is sustainable far longer per minute than VO2max"*. A 20-minute **main set** is coherent with a 12–18 minute **work** dose plus its recoveries. A 25-minute main set is not.

**This confirms SC-10's original finding rather than replacing it.** Delivered medians are VO2max 25.5 against tempo 23.7 — the hardest session is still the longest, which is the inversion SC-10 described. What has changed is the diagnosis: the answer was never "percentages versus absolute minutes". **The absolute ceiling was correct and was leaking.**

**Seiler.** This is the CD-19 error in a different costume: a quantity defined in one basis and consumed in another. My CD-16 constraint applies directly — moving VO2max around must not become *more* VO2max, and 91.9% of sessions running 5 minutes over their own ceiling is exactly that, arrived at by accident.

**Willy.** Support without reservation. Five extra minutes of VO2max main set, on the plan's hardest session, on 3,996 sessions, is not a rounding error. **Binding condition:** measure the delivered **work** minutes after the fix and prove they do not fall below `VO2MAX_WORK_MIN` — shortening the main set must not quietly convert a VO2max session into an under-dosed one. Fixing a ceiling by breaching a floor is not a fix.

**McMillan.** The runner cannot see any of this, which is why it survived. They see "Short VO2max, 8 km" and run it. No objection.

**Sims.** No objection. A dose reduction on the hardest session is the safe direction of travel for this cohort.

### Required artifacts
1. **Principle** — §85 (or SC-10's home section) amended: *a session is priced at the pace its own cap assumed.*
2. **Numeric** — none new. `VO2MAX_MAIN_SET_MAX_MINS = 20` is confirmed, not changed.
3. **Invariant** — a delivered check: `mainSetMinutes(session.duration_mins) <= VO2MAX_MAIN_SET_MAX_MINS` for `vo2max`-stimulus sessions, **excluding hill reps** (SC-09 — priced at easy pace deliberately, *"not the work this ceiling exists to bound"*). Hills must be excluded explicitly, in code, with that reason: counting them inflated the ordering breach from 19.4% to 86.1% in the first measurement.

### ⚠️ Second leak to check in the build
`const qualKm = Math.max(roundDist(qualKmPrimary), minDist.quality)` can floor the capped distance **back up** past the ceiling. Fixing the pace round-trip without this may leave a residual.

---

# ITEM 3 — QUALITY-ONSET-ORDER-01

## ⚖️ Ruling — the earlier CORRECT stands. Ship AFTER Item 2, and they do not interact.

**They are independent.** §5's adaptation deadline is arithmetic over **weeks** (`totalWeeks − taperWeeks − VO2MAX_ONSET_MIN_ADAPTATION_WEEKS`) and contains no session-size term. Repairing SC-10's ceiling changes how *long* a VO2max session is, not *which week* it lands in, so `vo2MustOpenBuild` is unaffected.

**Order: Item 2 first.** It is a smaller blast radius, it repairs a leak rather than changing a policy, and it makes the VO2max sessions Item 3 moves around the correct size before they are moved. Shipping Item 3 first would relocate mis-sized sessions and confuse the attribution of any cohort move.

**Willy.** One thing to carry into that build: the two changes push the same direction — less VO2max, later. Measure the *combined* effect on total VO2max exposure, not just each in isolation, or the second ruling silently doubles the first.

---

## ↗️ SLT escalation

None. All three are correctness questions.

## 📋 Chair's note on method

Two of the three briefs arrived with a mechanism the author had flagged as **unisolated**, and in Item 1 that flag was load-bearing — the mechanism was wrong, and saying so is what stopped this board ratifying it. The same day produced a measurement that counted a **fitness test as a training session** (inflating a beginner figure to 100%) and another that counted **hill reps as VO2max intervals** (inflating an ordering breach from 19.4% to 86.1%). Both were caught by the author and corrected before ruling.

**The pattern worth keeping: a measurement is a claim, and the denominator is where the claim usually fails.**
