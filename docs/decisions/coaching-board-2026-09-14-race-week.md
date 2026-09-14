# Coaching Board — race-week prescription (§39 Amendment 1, §80 Amendment 1)

**Date:** 2026-09-14
**Trigger:** `lib/plan/ruleEngine.ts` (soft, qualifies), `generationConfig.ts` + `CoachingPrinciples.md` (hard).
**Round:** `coaching-review/2026-09-14/`
**Found by:** reading the generated plans as a coach. **Every case below passed `validatePlan` with 0 errors.**

> The founder's instruction that opened this: a coaching review must not stop at "0 errors" — the plans have to be **fit for purpose and achievable**. Both findings were invisible to validation and obvious on the page.

---

## 🔍 Conflict scan

| § | Relationship |
|---|---|
| **§39** | Titled *"Race-week **MID-WEEK** easy run for HM/marathon"*. The engine placed it from `['sat','fri','wed','mon','tue','thu']`, and for a Sunday race `sat` is race eve. |
| **§77** | Refers to it in its own text as *"the §39 **mid-week** easy"*. **The constitution says mid-week in two places while the engine said Saturday.** |
| **§26** | *"The engine must never schedule a fatigue-adding session in race week."* A 72-minute run the day before a marathon is fatigue-adding on any reading. Independently decisive. |
| **§30** | Caps race-week *shakeouts* at 35 min / RPE ≤ 3 via `enforceCap`. §39's run was built directly and bypassed it; `applyWeekdayMinsCap` misses it too, because Saturday is not a weekday. |
| §18 | Untouched — blocked days still respected. |
| §5 / §25 | Support the §80 amendment: a time-targeted runner has spent the whole plan rehearsing goal pace; opening in Zone 2 discards it. |
| §1 | Untouched — session counts, plan-wide. |

---

## Item 1 — §39's easy run lands on RACE EVE

**Measured, 81-plan Sunday-race grid** (HM+marathon × finish/time_target × 3 levels × 4/5/6 days × 25/40/60 km/wk):

| | |
|---|---|
| Plans with a session on race eve | **81 of 81 — 100.0%** |
| Mean duration | **54 min** |
| HM longest / marathon longest | 56 / **72 min** |
| Worst case | **BEGINNER, finish-goal marathon, 25 km/week: 9 km / 72 min the day before their first marathon** |

The code comment at the site had already named the question and declined it: *"(Whether an easy run the day before a race is good coaching is a separate question — deliberately not relitigated here.)"*

### The board

**Hutchinson (chair).** Two independent grounds and they agree. The constitution calls this the mid-week easy twice, and §26 forbids fatigue-adding sessions in race week outright. This is a defect against documented intent. I ruled rather than exempting because the fix changes what a runner does in the most consequential week of their plan, and because the site comment makes it an open question by our own record rather than a typo.

**Seiler.** No objection. Nothing here moves §1. Worth saying the obvious: the aerobic-preservation rationale §39 rests on is indifferent to *which* day. The only axis that varies is proximity to the race. So earliest, not latest.

**McMillan.** A 72-minute run the day before a first marathon is the kind of thing that ends a race before it starts, and the runner will blame themselves. The people this hits hardest are the ones with the least experience to overrule it — a seasoned runner ignores the card, a first-timer does what the plan says. That asymmetry is the whole argument.

**Willy.** Support, and I want the **ceiling** rather than a prohibition. A short shakeout on race eve is protective, not harmful: it keeps the legs awake and it is 35 minutes at RPE 3. The failure here is an *uncapped* session, not the existence of a session. Cap it at §30's number and reuse that number rather than inventing a second one.

**Sims.** Agreed, and one addition. The 72-minute case is a first-timer on a charity place. For that runner the day before a marathon is also when fuelling and hydration are being loaded — an hour-plus run competes directly with that, and the cost lands on race day as an energy-availability problem, not a fatigue one. Non-blocking, but it is a second mechanism pointing the same way.

### Ruling — CORRECT

§39's run takes the **earliest** available non-shakeout day, and **no session within `RACE_EVE_PROTECTED_DAYS` (1) of the race may exceed §30's 35-minute cap.**

> ⚠️ **A ceiling, not a prohibition — and the suite proved why.** The first draft forbade *every* session on race eve. The golden plans failed immediately: CD-7 deliberately places a 30-minute §30 shakeout there when the `[5,3]` offsets fall outside race week, and that is *good* coaching. The first formulation would have deleted a good session along with the bad one.

---

## Item 2 — the race-day note tells a 5K runner to run the whole race in Zone 2

`raceSession()` hardcoded *"Start slower than feels right. First 5 km at Zone 2."* for every distance.

| Race | "first 5 km" is | Verdict |
|---|---|---|
| Marathon | 12% | Correct — **and this is where the number came from** |
| HM | 24% | Defensible |
| 10K | **50%** | Gives away half the race |
| 5K | **100%** | Instructs the runner not to race at all |

### Ruling — CORRECT WITH AMENDMENT

The opening is a **fraction of race distance**: `RACE_OPENING_FRACTION = 0.12`. **5 km is 11.85% of a marathon**, so this is not a new number — it is the existing one, derived back to the quantity it was always expressing. The marathon is unchanged (5 → 5.1 km); every other distance becomes correct.

**Amendment: the effort follows the GOAL.** Zone 2 for a finish-goal runner. **Goal pace** for a time-targeted one — a runner chasing sub-50 for 10K who opens in Zone 2 has lost the race in the first kilometre and cannot get it back. Same coaching idea (*do not bank time you have not earned*), expressed against the target the runner actually has.

---

## ⚡ Recorded disagreements

None. Willy's ceiling-not-prohibition point was adopted into the ruling rather than dissented.

---

## 📦 Artifacts

1. **Principle** — §39 Amendment 1, §80 Amendment 1.
2. **Numeric** — `RACE_EVE_PROTECTED_DAYS = 1`, `RACE_OPENING_FRACTION = 0.12`. The race-eve ceiling **reuses** `RACE_WEEK_SHAKEOUT_MAX_MINS` rather than declaring a second cap.
3. **Invariants** — `INV-PLAN-NO-RACE-EVE-SESSION`, `INV-PLAN-RACE-NOTE-SCALES`, both with `plan-invariants.md` rows and both proven wakeable.

## ↗️ SLT escalation

None.

---

## Verification, and two things it caught

- `npm run verify` — exit 0, **1789 tests / 198 files**, sweep 0 hard failures / 0 violations.
- `npm run cohort:shape` — **unchanged**. No plan was reclassified.
- **Declared parity move: 4,320 of 5,832 cases changed.** Expected and scoped: **5K 972/972 and 10K 972/972** (the note was most wrong there), HM 810/972 and marathon 702/972 (rounding plus §39's day move). Golden snapshots confirm the per-plan delta is the note text and the §39 day.
- Race-eve exposure: **100% → 0%**, re-measured on the same 81-plan grid.

> **The suite caught two of my own errors, and both are worth recording.** (1) The first invariant forbade every race-eve session and would have deleted §30's legitimate shakeout — the golden plans failed on it immediately. (2) My day filter read `> PROTECTED_DAYS - 1`, which is a no-op on top of the existing `beforeRace` check, so `sat` stayed reachable whenever every earlier day was blocked or used. **The measurement grid showed 0/81 and looked clean; the property sweep found it.** A reorder that hides a bug is not a fix.

## A harness finding, separately filed

`COHORT_PLAN_START` is a Monday and every grid derives race dates as `planStart + N weeks`, so **the cohort grid, the liveness corpus and (until today) all 17 coaching-review cases generate MONDAY races** — where race week has no day before the race at all. That is why this defect survived: no harness in the repo could build the shape in which it appears. The review cases are fixed (Sunday, plus an explicit `07-hm-monday-race` so PV2-G stays visible); the cohort grid is **not** changed here, because re-baselining parity and cohort-shape is its own declared move.
