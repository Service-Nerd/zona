# Coaching ruling register — what has been decided, and what may not be re-raised

**Why this file exists.** The founder asked, repeatedly and with cause, why the
board gives different answers to the same question. The answer is not that the
board is inconsistent. It is that **each sitting was convened from the plans
rather than from the prior rulings**, so items the board had already closed came
back as new findings.

Measured on 2026-09-20, across one day of sittings:

| item | ruled | what happened next |
|---|---|---|
| **M3** (knee marathon, "the plan doesn't warn them") | **WITHDRAWN 2026-09-19** — the premise was false, the note says it | **re-presented 2026-09-20 as "the one real finding"** |
| **E5** (3 days + 30-min cap) | **CLOSED 2026-09-19** — CORRECT AS IS, McMillan's dissent recorded | **re-presented 2026-09-20 as "would not hand over"** |
| the 2026-09-20 round's `review.md` | — | **still read "REVIEW PENDING"**: the sitting's ruling was never written back, so the next sitting had nothing to read |

**The third row is the cause of the first two.** `coaching-review-round.ts`
writes a stub and says *"fill this file with the ruling"*. Nobody filled it. A
process whose memory depends on someone remembering to write it down has no
memory.

---



## 2026-10-03 — PLAN-PEAK-BELOW-BASE-01 · CORRECT AS IS, and the alarming number was the design

**Ruling: CORRECT AS IS. No engine change.** A plan's peak long run may fall below the runner's
existing longest run.

**Measured on the item's own case** (10K, 50 km/week, longest recent run 20 km): delivered peak
week **51 km against 50 declared** — `INV-PLAN-PEAK-NOT-BELOW-START` holds and the aerobic base is
**not** detrained. Only the long run falls: **16.0 km / 105 min against an existing 20 km.** The
plan carries `volume_profile: 'maintenance'` and a `volume_constraint_note`.

**So what changes is DISTRIBUTION, not load.** One 20 km Sunday becomes a 16 km Sunday plus more
weekday volume, which for a 10K is better specificity, not a loss (Hutchinson).

**Willy, decisive:** the long run is the week's highest injury-load session and §9's ceiling is
why. Prescribing 20 km to satisfy *"they already do it"* adds tonnage with zero race benefit. The
current behaviour is the protective one.

⚠️ **THE ASYMMETRY THAT MADE THIS WORTH A SITTING, AND ITS ANSWER.** §106 floors weekly volume at
the runner's current and refuses the maintenance excuse in as many words — *"a detraining block is
a worse plan than no plan"* — while nothing floors the long run. **That asymmetry is correct:**
§106 protects the aerobic base, which is race-agnostic; §9 governs time-on-feet **for the race**,
re-affirmed the same morning in `FOUNDATION-LR-S9-01`. Two ceilings, two justifications, not one
remedy applied to one twin.

⚠️ **THE RATE IS NOT A DEFECT RATE, AND QUOTING IT WOULD HAVE BEEN THE ERROR.** Peak long run below
the runner's existing longest: **5K 76.6% · 10K 60.6% · HM 45.8% · marathon 17.5%** of 39,632
plans. A 5K block *should not* prescribe a 28 km long run. The gradient by race distance **is the
design showing through** — the figure only looks like a finding until you ask what it measures.

**Recorded residual, deliberately NOT this board's:** McMillan — *"they will add the extra four
kilometres themselves, and then the plan's week is wrong"*; Sims — for masters and peri-menopausal
runners an un-narrated reduction reads as the app under-rating them and they self-correct upward,
the exact failure the product exists to prevent. The present note explains **volume** and what
visibly moved is their **Sunday**. That is copy, so it is the founder's: filed as
`LR-REDUCTION-NOT-NARRATED-01` (P3).

**Do not re-raise** that a plan peaking below the runner's existing long run is a defect. It is
§9, it is deliberate, and the base is floored separately. `FOUNDATION-LR-VS-PEAK-01` was this
question's first framing and was declined; this is its second and final one.

---

## 2026-10-03 — TAPER-OVER-PEAK-SLOW-01 · a principle stated a measurement as a CAUSE, and its invariant inherited a proxy

**Ruling: CORRECT WITH AMENDMENT.** `INV-PLAN-RACE-NOT-VOLUME` is scoped to the **race week**,
and §121's mechanism is gated directly for every distance.

**What was reported.** The morning ops digest raised §121 as a constitutional violation:
*"Taper week 13 carries 16km against a peak-phase maximum of 13km."* **18 firings in 14,265
sweep plans (0.13%)** — ⚠️ not the 5 first reported, which was `property-validate-plans.ts`'s
`explained.length < 5` display cap read as a population.

**Neither side was wrong.** Reproduced in full: build peaks at 18, the **peak phase delivers 12
and 13**, the taper reads 16, and the race week reads **0** — §121's exclusion is intact. The
taper is not too big; **the peak is under-delivered**, which is §23's `structuralPeakInversion`,
ruled by this board on 2026-09-15 (§6 Am.1 / TAPER-DEPTH-01) and licensed by §23's CD-10 note:
*"the plan's highest week may sit in the base phase … We do not force peak volume above base."*
**Re-measured: 18 of 18 carry `volume_profile: 'maintenance'` and a `volume_constraint_note`.
Zero are silent.** §23 discharges the honesty obligation; §121 was raising an `error` for it.

**The class — the remedy was applied to two twins of three.** `INV-PLAN-PEAK-IN-PEAK-PHASE`
stays `warn` for maintenance *"precisely for this reason"* (§23 CD-10);
`INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK` stays `warn` (NOISE-GATE-01); this one was `error` with no
exemption. Three board-authored invariants guard one inversion.

**The transferable lesson, and it is about how a principle is WRITTEN.** §121 states a population
measurement as a causal fact — *"excluding the race session, no taper anywhere exceeds its peak
phase. **The race is the entire cause**."* That was true on its own 8,510-plan grid. It handed the
invariant a **proxy** ("no taper week exceeds peak") which was exactly equivalent to the real
claim on the day and drifted the moment the population widened. **Enforce the mechanism you own,
not the symptom you measured.** The premise sentence is corrected in place, not deleted
(Hutchinson).

**A second finding, from the falsification.** §121's Config names two mechanisms — the exclusion
in `sumWeeklyKm` and in `planScale`. **`planScale` had a direct test from day one; `sumWeeklyKm`,
which produces every `weekly_km` the runner reads, had none** and was covered only by the
plan-level proxy. Measured: that proxy **cannot detect a re-inclusion on a 5K or 10K plan at
all** (0 of 20,736), because race-week volume is too reduced for +5 km to clear a peak week.
§121's own table reads *5K 0% · 10K 0.3%*, which looks like absence of the defect and is partly
absence of vision. Now gated at the mechanism, all five distances, distance- and
duration-anchored.

**A duplication deliberately NOT removed.** `strength || rest || race` appears three times in
`ruleEngine.ts` and they are **not** copies: they answer "may this be shrunk to the weekday
cap?", "does this count as training volume?" (§121) and "should this carry an estimated-HR
note?". A shared owner would couple three independent decisions. Recorded in place so a later
DRY pass does not create the defect.

**Binding amendments.** 1 · Willy — the rule must stay **wakeable** by `invariant:liveness`, not
baselined. 2 · Sims — the firing cohort is low-volume, few-available-days runners, so the
`volume_constraint_note` is the load-bearing disclosure and nothing may weaken it
(`INV-PLAN-VOLUME-SHORTFALL-DECLARED` still holds). 3 · Hutchinson — the falsified premise is
corrected with today's number beside September's, not replaced.

**Prescription unchanged.** `verify:parity` IDENTICAL on 6,066 cases. ⚠️ **Stated rather than
quoted as proof: this is a validator-only change, so parity CANNOT fail on it** — it would read
IDENTICAL had the validator been broken outright. No live plan was ever mis-prescribed, so there
is **no remediation.**

**Do not re-raise:** that a taper week above the peak phase is a coaching defect. It is §23's,
it is ratified, and it is disclosed. The sweep baseline's own note called it *"a coaching defect,
and for the charity cohort it is live"* — that diagnosis was wrong and is kept in place, in its
own words, with the correction beside it.

---

## 2026-10-03 — FOUNDATION-LR-S9-01 · the conflict dissolved when someone read §9's justification instead of its number

**Sitting 3 of the day. Ruling: CORRECT WITH AMENDMENT — option (c).**

**The question as submitted:** §9's absolute time ceiling says cap the foundation long run;
§81's veto says shrinking a long run is the trade this board refused. Measured: a 10K runner
at 50 km/week with a 20 km longest recent run gets foundation long runs of 123/135/135 min
against a 120-min ceiling, and capping them produced **404 new
`INV-PLAN-LONG-IS-LONGEST` violations** — §81's vetoed trade exactly.

🥇 **IT WAS NOT A CONFLICT. §9 SCOPES ITSELF, IN THE SECTION THAT WAS CITED:** *"capped by an
absolute time ceiling **per race distance** … protects against unrealistic **time-on-feet for
the race**."* §57 excludes foundation weeks from the race-directed arc, and
`effectiveBaseline()` sizes the block from the runner's **own `current_weekly_km`**. Capping it
prescribes **less than the runner already runs** — the detraining failure §106 Am./§2 Am.2
forbids. **Two of three principles point the same way and §9's does not reach.**

⚠️ **RECORDED AGAINST THE CHAIR:** he advised the founder this needed no board because §9 was
ratified doctrine. Wrong — **he read §9's number and not §9's justification**, and the
sentence that settles the whole question was inside the section he cited. Second time in two
sittings that the answer was already in the constitution and nobody had read far enough.

**The ruling.** The foundation long run **carries a duration** (Willy's and Sims's condition —
measurability, not a cap) and is **not** §9-capped. `INV-PLAN-LONG-CAP-MINS` scoped to `n > 0`.
**No new numeric** — second sitting in a row where that is the right answer.

- **Willy, correcting his own earlier quotation:** *"19 km easy, for a runner whose longest
  recent run is 20 km, is not a tissue-tolerance event. It is maintenance."* He is the §81 veto
  author and declined to be cited in support of this cap.
- **McMillan:** *"What a coach does here is nothing."* Refused (a) and (b) both — capping a
  runner below last month's training is the fastest way to lose an experienced runner.
- **Sims:** the runner cannot see the time commitment of their longest session; for the
  caregiving-load cohort §81 was written about, that is the number they most need.
- **Seiler:** no §1 exposure; 135 min of easy running is not a load problem for someone whose
  long run is already 19 km — *"it is their Sunday."*

**`FOUNDATION-LR-VS-PEAK-01` — DECLINED AS FRAMED**, same reason: it would cap this runner
below their own training. ⚠️ **The measurement is real and aimed at the wrong target** — a 10K
plan peaking at 112 min for a runner who already runs 135 is about §106's peak ceiling versus
the existing base. **Re-filed `PLAN-PEAK-BELOW-BASE-01`** rather than closed.

**Artifacts:** §122 Amendment 1 · §9 gains its scoping sentence · `INV-PLAN-LONG-CAP-MINS`
scoped to `n > 0` · `INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION`'s long-run exemption removed.
**No numeric.**

---

## 2026-10-03 — MWM-FLOOR-VALIDATOR-01 · three weekday-cap exemptions, two mirrored — and a bound this board set then vacated the same day

**TWO SITTINGS, and the second corrected the first. Both recorded, because this register
exists precisely because answers changed without anyone being able to see why.**

### Sitting 1 — three items

**(a) The reported defect — NOT A BOARD MATTER. Routed back to build as exempt.**
`INV-PLAN-MAX-WEEKDAY-MINS` fired 19 and 46 times on two live paid marathon plans.
`applyWeekdayMinsCap` has THREE exemptions — long run (§81), structured session (§81), and
**§82 floor protection** — and the validator mirrored only §81's two. Every firing was a
floor-protected easy run at 33–34 min against a 30-min cap, inside §82's ratified *"a few
minutes"*. **The plans were correct; the checker was wrong.** Defect fix restoring documented
intent, shipped `d89dd476`, `verify:parity` IDENTICAL over 6,066 cases.

**(b) ITEM F — DECLINED. The premise was falsified by this register's own contents.**
The submission asked the board to set a tolerance for structured weekday sessions running up
to +97% over a stated ceiling. ⚠️ **§81 Amendment (2026-09-11) had already ruled it**, on
better measurement than the submission brought (`maintenance` 20% → 80%, +60pp, rejected),
settling it as *"the runner is told, and the plan is not relabelled"* — **and the tolerance
already exists as `LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT = 50`.** The real defect is that
`INV-PLAN-STRUCTURED-OVERRUN-DECLARED` tests note PRESENCE, so an unrelated
volume-shortfall note discharges the obligation. **Exempt defect fix, not board work.**
🔴 **This is the second time this week the register answered a question asked fresh.**

**(c) ITEM F′ — CORRECT WITH AMENDMENT.** The exemption stands (no scaling — McMillan,
unanimous, *"don't shrink to fit"*); **placement becomes an obligation.** Measured: the live
plan with `day_budgets wed 60 / thu 90` had **ZERO** structured overruns because placement put
the session on a day with room. Where no weekday can hold it, the plan says so about the
session, not via a shared note.

### 🔴 Sitting 2 — the bound set in sitting 1 is VACATED

Sitting 1 ruled `EASY_RUN_FLOOR_PROTECTION_MAX_OVERRUN_PCT = 50`, aligned to §81's existing
50% rather than inventing a second number. **It was set from precedent, before the measurement
existed.** The measurement, taken immediately after:

| | |
|---|---|
| foundation weekday sessions measured | **2,376** across 276 plans |
| over the runner's stated day budget | **1,132 — 47.6%** |
| plans with at least one | **214 / 276 — 77.5%** |
| **median overrun** | **+39%** |
| worst | **90 min vs a 30-min cap — +201%**, a 9.5 km session |
| **cannot be fixed by capping at ANY bound** | **339 of 1,132** — trimming puts them under §9's 4 km floor, so §82 holds them over |

**A 50% bound would have declared the tail and blessed the median.** The chair records this as
his own error: the board's own protocol says a ruling made without `measure:fitness`-class
numbers is a ruling about how a plan is CLASSIFIED, not whether it works, and sitting 1's bound
was exactly that.

**ITEM E — CORRECT WITH AMENDMENT. The remedy is STRUCTURAL, not a percentage.**

1. Foundation weekday sessions **carry `duration_mins`**, from the same easy pace the main plan
   uses. ⚠️ **A session with no duration is the root cause** — `applyWeekdayMinsCap` and
   `INV-PLAN-MAX-WEEKDAY-MINS` both skip on `!s.duration_mins`, so these sessions are neither
   trimmed nor checked. **20,980 foundation weeks swept clean is the absence of an instrument,
   not evidence** (expressibility, not reachability — distinct from `HARNESS-COMPOSE-GAP-01`).
2. The block is **sized against stated day budgets at construction** (§52b's day-count lever),
   not trimmed afterwards. A cap applied after sizing is what produces the 339 impossible cases.
3. Where it still does not fit, **§82's floor applies and the plan says so** — same note, same
   voice (Sims: no new copy).
4. 🔴 **`EASY_RUN_FLOOR_PROTECTION_MAX_OVERRUN_PCT` IS NOT CREATED.** Recorded explicitly
   because this board's artifact list normally names a constant: **here the correct answer is
   that no new number is right.**

**Precedent that should have prevented this (`CB-SUBFLOOR-ADMIT-01`, same module).**
`foundationBlock.ts` already carries a measured hole of this exact shape — it read flat config
instead of per-runner floors and handed a runner *"a 5.0 km foundation session (+67%) … it
landed in week −1, BEFORE the 2.9 km week 1. **The first session the runner ever saw was the
unsafe one.**"* Per-runner floors were threaded in. **The time budget was not.** One input
later, same module, same failure.

**Willy — BLOCKING CONDITION (on evidence, not correctness).** Foundation weeks enter the same
load instrumentation as main weeks, and `measure:fitness` runs before/after: if trimming the
block reduces net build for the injury cohort, that must be seen, not assumed. The affected
cohort includes a four-flag runner (knee, hip, back, shin splints) whose weeks −3 to −1 are
**55, 60 and 60 minutes against a stated 30**.

**McMillan's framing, recorded:** the shape is backwards. **60, 60, 60, then 34.** The
foundation block is meant to be the gentlest part of the plan and is currently the heaviest
weekday the runner will ever see.

**Seiler:** no §1 exposure — foundation weeks carry no quality, so none of this touches
distribution. It is a scheduling-honesty question and must not be dressed as a load one.

**Artifacts owed:** §122 *Foundation weeks are weeks* · §82 Amendment 1 (the "few minutes" is
scoped to the magnitude ruled on; the bound is §52b, structural) · no new numeric ·
`INV-PLAN-FOUNDATION-WEEKDAY-HAS-DURATION` + `INV-PLAN-FOUNDATION-WEEKDAY-WITHIN-BUDGET`.

**Not in this sitting:** `TAPER-OVER-PEAK-SLOW-01` (filed P1) — §121 firing 8 times because a
slow runner's taper week carries more volume than the peak phase, 51 km against a 47 km peak.

---

## 2026-09-25 — S90-WITHIN-COHORT-RATE-01 · the noise standard was measured against a denominator that hid it

**Ruling: two questions, two answers.**

**(1) `INV-PLAN-BOUNCEBACK-BOUNDED` at ~56% within knee/shin — CORRECT, the honest
residual.** Willy defended it on mechanism (post-deload bounceback against pre-deload, for
runners whose tissue is why the cap exists, at volumes where the absolute-km floor is a
large share of the week). No seat dissented. The shipped acknowledgement stands.

**(2) "NOISE-GATE-01 should measure per-cohort" — CORRECT WITH AMENDMENT, and the
amendment is substantial.** ⚠️ **The board REFUSED "declare each check's cohort"** —
Hutchinson: a check whose declared scope is wrong reports a confidently wrong rate, and
hand-maintained metadata rots. Axes are **derived** from the input (injured · dist · goal ·
level · days), the gate reports the **maximum** across them, and a 200-plan floor stops a
small cohort producing a meaningless percentage. ⚠️ **It REPORTS; it does not fail the
build** — Seiler's condition: a high in-cohort rate may be a *true description of that
cohort*, and a gate forcing a re-scope on that reading would delete real signal.

🔴 **IT FOUND TWO CHECKS ABOVE WILLY'S OWN 71% EXAMPLE, ON THE FIRST RUN:**

| check | plan-wide | in-cohort |
|---|---|---|
| `INV-PLAN-STRIDES-NO-CARRIER` | 9.0% | **74.2% of 2-day plans** |
| `INV-PLAN-LR-MAX-WEEKLY-PCT` | 5.9% | **72.9% of 2-day plans** |
| `INV-PLAN-DELOAD-IS-A-REDUCTION` | 12.3% | 45.6% of 2-day plans |
| `INV-PLAN-DELIVERED-RAMP` | 27.2% | 42.2% of half-marathons |

Neither of the top two had ever tripped a gate built to enforce exactly that standard.

⚠️ **RECORDED DISAGREEMENT, NOT SETTLED — `INV-PLAN-LARGEST-SESSIONS-SPACED`.** Willy: a
check firing on a large share of a distance while its own message says *"Likely forced by
available days"* reports the runner's calendar, not a defect — his 71% case. Seiler and
McMillan: it is an accurate description of day-job runners, who put their two biggest
sessions on adjacent weekend days, and deleting it loses a true signal. **What would settle
it:** the share of firings where a better arrangement was available given the declared
days. **That measurement does not exist and the board did not take it.**

⚠️ **The submission's own grid did not survive the sweep.** A 925-plan grid predicted
`LARGEST-SESSIONS-SPACED` at 64.5% of marathons as the worst case; on the real 14,230-plan
sweep the flagged set is entirely different and led by a `days=2` cohort the grid did not
contain. **Measure on the sweep, not the cohort grid** — recorded again.

**Artifacts:** §1 Amendment (the standard is measured where a check applies) · no new
numeric (`NOISE_THRESHOLD_PCT` reused, axes derived) · NOISE-GATE-01's in-cohort report —
**not** a `validatePlan()` invariant, because this is a harness check and the board said so.

---

## 2026-09-25 — INJURY-DELIVERED-COVERAGE-01 · the two delivered arms left four injuries covered by neither

**Ruling: CORRECT WITH AMENDMENT (Option C).** §94's `INV-PLAN-DELIVERED-RAMP` now covers
every runner; §90's `INV-PLAN-INJURY-CAP-DELIVERED` widens from knee/shin to the
load-bearing injuries (`DELIVERED_CAP_INJURIES`). Where both apply, both run.
Artifacts: §90 Am. 2 / §94 Am. 2 · `GENERATION_CONFIG.DELIVERED_CAP_INJURIES` · both
invariants re-gated + `plan-invariants.md` rows. **Changes no prescription — not one plan
differs; only which plans are reported.**

🔴 **The conflict scan found an unwritten assumption, not a contradiction.** §94 excluded
*"injury-history runners (already covered, more strictly, by §90)"* and §90 scoped itself
*"5% for knee/shin"*. Both true; the gap was between them. **Declaring an injury removed a
check**: achilles/back/hip/plantar sat at **0.0%** against **34.6%** for the healthy twin
of the same runner.

**Measured on 1,478 plans before ruling, because the brief said the board could not rule
without it.** knee/shin 10.2% → 20.4% · achilles 0.0% → 43.8% · plantar 0.0% → 39.3% ·
hip 0.0% → 34.6% · back 0.0% → 29.4%.

⚠️ **Option A (widen §90 alone) was measured and REJECTED** — it left knee and shin at
10.2% while giving achilles 39.9%, so the cohorts with the strongest tissue argument would
have been the least watched. **Do not re-propose it.**

⚠️ **43.8% is the top of the acceptable band and is written into the principle**, because
§94's own first draft fired at 44.4% and was scoped down. Accepted on composition:
healthy's 34.6% plus ~9pp from a deliberately tighter cap. *Reopens if* the extra ~9pp turn
out to be dominated by long-run-led rises the engine may not trim.

**Sims, recorded rather than summarised:** tendon and fascia stiffness are
oestrogen-sensitive, so the cohort with the strongest case for the tighter achilles/plantar
cap is disproportionately female — and it was the cohort receiving no check at all. The old
scope was a default derived from a male-athlete framing in which "injury" means "knee".

**`back` and `hip` stay OUT of the tight cap** — real, but not primarily volume-rate
injuries (Willy). They are covered by §94's looser arm.

**Architect amendment on the artifact:** `DELIVERED_CAP_INJURIES` is a **separate constant**
from `HILL_RESTRICTING_INJURIES` despite identical members today. Different questions; a
shared constant would make the next change to either silently move the other.

---

## S28-WEEKEND-CARRIER-01 — §28's midweek rule cost a cohort its whole neuromuscular stimulus (2026-09-24)

**Ruled CORRECT WITH AMENDMENT.** §28 Amendment 3. Shipped with all three artifacts.

**The question.** Should §28 place strides on a weekend easy run when no midweek one
exists? Opened by `STRIDES-CHECKER-OWNER-01`, which fixed the CHECKER and deliberately
left this to the board.

🥇 **THE CONFLICT SCAN IS WHAT MADE IT RULEABLE.** §28's body says *"placed midweek
(Wed preferred)"* — but its **WHY justifies only EASY** (*"legs fresh enough to execute
proper form"*) and gives **no mechanism at all for MIDWEEK**. A convention with no stated
mechanism, costing a cohort its entire stimulus, is not load-bearing. ⚠️ A handed-over RCA
had argued the opposite way round — that *midweek* was the preference and *Wed* the rule —
which inverts the text. **Read the WHY, not just the principle sentence.**

🔴 **THE MEASUREMENT COLLAPSED THE OPTIONS TO TWO, AND THAT WAS THE RULING.** Of 17,434
carrier-less weeks: allowing any easy day recovers **10,410 (59.7%)**; allowing any easy
day **except the day after the long run** recovers **0 (0.0%)**. Every eligible weekend
easy run in this cohort *is* the day after the long run, because the other weekend day is
the long run and the day before it is already barred. **There was no middle option** — the
board either accepted post-long-run strides or changed nothing.

⚠️ **WILLY'S BOUND, BINDING: flat 4×20s yes, HILL strides never.** This is the
lowest-frequency, highest-long-run-share cohort (§52 permits 60% of the week in one run),
so the fallback lands on their most fatigued easy day. §28 Am.1's own case for hills is
that they are **eccentric-heavy**, authorised *"dosed like §28's strides"* on a FRESH
midweek day. The alternation collapses to its safe arm, exactly as §28 Am.2 does for
injury history.

🥇 **THE BOUND CLOSED A WIDER, PRE-EXISTING HAZARD THAN THE CASE THAT PROMPTED IT.**
`verify:parity` moved **112 of 5,994 cases, every one `beginner` + `time_target`** — and
**days=3 changed ZERO**, so none of them are the weekend fallback (the parity grid cannot
reach that shape either). They are beginners with a **Monday** carrier and a **Sunday**
long run on ordinary 4- and 5-day plans: `STRIDE_PREFERRED_DAYS` has always included
Monday, so **these runners were already being prescribed eccentric hill strides the day
after their long run** and no rule saw it. The weekend question surfaced a hazard that
existed independently of it.

**Measured after:** `INV-PLAN-STRIDES-NO-CARRIER` **12.8% → 9.0%** (1,824 → 1,286 plans).
The residual is honest — a weekend-ONLY runner whose long run is Sunday has Saturday
barred as the day before it and Sunday is the long run, so no day exists to fall back to.
Recorded (§34), not enforced.

🔻 **Filed, not fixed:** `STRIDE_PREFERRED_DAYS` still lives in `neuromuscular.ts`, not
`GENERATION_CONFIG`, so the coaching guard does not fire on edits to it — the same
file-path bypass as `peakKmByLevel` before §106. `STRIDE-DAYS-CONFIG-01`.

---

## TAPER-RECAL-COLUMN-01 — §68 had never applied to anybody (2026-09-22)

**Ruling: CORRECT WITH AMENDMENT.** Ship the table fix; §68 gains a recorded note that it
never executed, and a mechanical check that it **can fire**.

| | |
|---|---|
| **The defect** | `recalibrate-taper` selected `week_n, actual_load_km` from `strava_activities`. Both live on `run_analysis`. Empty map → *"insufficient actual data (0 < 2 weeks)"* on every call since the feature shipped |
| **Why an amendment, not a defect note** | Hutchinson: *this is not a defect fix restoring documented intent.* §68 has never executed, so every taper rule ratified since was measured against an engine in which it was silent. This introduces behaviour |
| **The near-miss** | 🔴 **§6 Amendment 2 also says "the week the runner ACTUALLY DID"** — and is a **different quantity**: it anchors to what the generated plan *delivers* vs what the curve intended (generation-time), while §68 anchors to what the runner *logged*. They compose; the pre-taper week sits in **peak**, where Am.2 does not reach. **No double cut.** A scan stopping at the section heading would have blocked a correct change |
| **Measured blast radius** | **2** users have any `run_analysis` load rows; **1** has the two weeks §68 requires. Cheap now, expensive later |
| **Binding on build** | `superseded_at is null` is part of the principle: `week_n` is within-plan (PLAN-WEEK-COLLISION-01), so without it the functional peak comes from a **different race**. McMillan, on copy: **the runner is never told the plan changed because they underperformed** |

**Artifacts.** Principle → §68 Amendment 1 · Numeric → the existing `TAPER_RECAL_*`
constants, unchanged and now actually read · Check → `lib/plan/taperRecalLiveness.test.ts`,
**falsified four ways including reinstating the original defect**. ⚠️ The 20 existing
assertions in `taperRecalibration.test.ts` could not have caught this: they hand the
function a map, and the defect was that the route never built one.

## Standing rulings — 2026-09-21

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **W-03 homepage commitments block** | 🔴 **KILLED — CORRECT WITH AMENDMENT, and the amendment removed the item** | A block of promises answering an evidence question is the weakest available instrument. `SameWeekTwice` (W-04) already does the proof job with real plan data and the product's own verdict function; a third telling on one page is surface area. **Wood and Hutchinson reached this independently at the SLT:** *"the person asking is not short of reassurance, they are short of proof."* **Do not re-propose a commitments block.** |
| **§12 Amendment 2 — describe the METHOD, never forecast the RUNNER** | 🟢 **RATIFIED** | The first ruling in the constitution about **assertions rather than prescriptions**. A statement about the PLAN is verifiable by reading the plan; a statement about a person we have never met, with an unstated time horizon, is not something this product can know. ⚠️ **No numeric and NO INVARIANT** — no test can read a sentence and decide whether it forecasts a runner. Declared under §34 rather than discovered later. |
| **The heart-rate progress marker** | 🔴 **REJECTED after being drafted** | *"Same effort at a lower heart rate"* is uncontroversial physiology and a **hazardous instrument**: day-to-day HR at a given pace moves with heat, sleep, caffeine and stress by margins comparable to three weeks of novice adaptation. **Our own 40 s/km within-month easy-pace variability is the evidence** — the same measurement that killed the 5 s/km trend constant. Replaced by McMillan's marker: **does the hard session feel available.** |
| **A ratio on a public marketing page** | 🔴 **FORBIDDEN — inherits the P-02 veto** | At four running days 80/20 versus 90/10 is **0.8 against 0.4 quality sessions and does not quantise.** Seiler: assert the PROBLEM (recreational runners accumulate more moderate work than they intend, well supported) not the REMEDY (thin at 3 to 4 hours a week). |
| **An injury-reduction claim** | 🔴 **FORBIDDEN** | Individual injury prediction is not something this or any product can do. ⚠️ **But Willy's LOAD statement is true and was being missed:** a week with one hard day places less cumulative mechanical load than four moderate-hard runs at the same volume. Arithmetic, not prediction. **Guide only, away from the speed answer** — answering a performance question with injury reads as changing the subject. |
| **Restraint framed as REDUCTION** | 🔴 **FORBIDDEN — Sims, binding on all marketing copy** | *"Most of your week is easy so one day can be genuinely hard"* is redistribution and is safe. *"Do less"* is not, and **the copy drifts from the first to the second easily because the second is shorter.** The populations most susceptible to that reading are already under-fuelling. She also records that this objection lands harder on women in the cohort: **the copy is not competing with the runner's own doubt, it is competing with a person standing next to her.** |

Record: `docs/decisions/slt-2026-09-21-who-writes-the-content.md` (the SLT half) and
§12 Amendment 2 (the coaching half).

---

## Standing rulings — 2026-09-20, Miles teardown batch## Standing rulings — 2026-09-20, Miles teardown batch

Record: `docs/decisions/coaching-board-2026-09-20-miles-teardown-batch.md` ·
`docs/decisions/slt-2026-09-20-miles-teardown-batch.md`

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **A runner-set intensity ratio (80/20 → 90/10)** | 🔴 **VETOED — Coaching Board** | Seiler's arithmetic is dispositive: **§1 counts SESSIONS**, so at 3 days the only ratios are 100/0, 67/33, 33/67 and at 4 days 75/25. **There is no 80/20 to select**, and our cohort is 3–4 days. ⚠️ **Do not re-propose this from the Miles screenshot.** What WOULD be correct is a different feature: *"this feels too easy"* / *"I'm knackered"* as a signal into the **existing reshape machinery**, never a new authority over §1. |
| **Cross-training capture, five chips** | 🔴 **INCORRECT as scoped** | The board wants **two different features from one input** — Willy needs modality + intensity + timing for load; Sims needs volume + frequency for energy availability. One chip serves neither and is the `motivation_type` outcome. Return with **one** feature and a stated engine consumer. |
| **Run-walk modality for the sub-floor marathoner** | 🔴 **NOT SCOPED** | Willy: at 8 km/wk over 4 days the runner is already running 2 km at a time; run-walk is for someone who cannot, which is **below the lower bound anyway**. **Do not build it to match a competitor.** |
| **Base-build on-ramp, as a SHAPE** | 🟢 **CORRECT WITH AMENDMENT — not approved to ship** | Six binding amendments (§2's rate not §57's · per-run step under §2 Am.2 · ≥16 weeks remaining · fuelling note · labelled pre-plan · all easy). **Chair's gate: build behind a flag, `measure:fitness` + property sweep, return.** Filed as **P-16**. |
| **§111 names a remedy §57 makes impossible** | 🟢 **FINDING, CORRECT** | `foundationBlock.ts:357` — every foundation week is `baseline × 1.10`, **flat from week 2 at any length**. §111's Recorded Limitation gains a cross-reference when P-16's artifacts land. **Do not "fix" this by raising `FOUNDATION_MAX_WEEKS`** — vetoed, and the on-ramp is a different shape. |
| **The paid DHTB coach register** | 🔴 **RULED OUT — SLT (Traynor)** | It makes the personal brand a **purchasable component**, a dependency on a person written into the revenue line. `brand.md`: the app must outlive the personal brand. **Recorded so it is not re-proposed as easy revenue.** |
| **Straight / Blunt coach register** | 🔴 **DON'T BUILD — SLT (Wood's kill mandate)** | Changes no context, no friction, no decision. Illusion-of-progress class. ⚠️ **`R19` is therefore NOT unblocked and stays parked** — *"finding a trigger is not the same as the trigger being worth pulling"* (Fried, undefended). |
| **Three "Sims asks" as one pattern** | ⚠️ **SPLIT — the bundling was an analytical error** | Cycle periodisation: contested science *and* missing data → stays blocked. `INPUT-SEX-01`: no formula reads it → **an honest null is not a gap**. **RED-S: not contested, and a real uncovered harm** → filed as **P-17**, a safety item. **Bundling let the real one hide inside the two that are fine.** |

---

## The protocol, from 2026-09-20

1. **Read this register before the sitting.** Not the plans first — the register.
2. **Any finding is checked against it before presentation.** A finding matching
   a CLOSED or WITHDRAWN row is either not raised, or raised *explicitly as a
   re-open with new evidence*, naming what is new.
3. **The sitting's ruling is written back** into the round's `review.md` and
   into this register, in the same session. Enforced by `audit-docs.sh`.
4. **A plan's verdict is mechanical first.** "Proud to hand over" =
   zero error-severity invariant violations **and** zero unreconciled coach
   objections (`planQuality`) **and** every constraint declared. The board rules
   on what that test cannot see, not on re-scoring what it can.

---

## How to re-run the review and compare like with like

```bash
npm run review:coaching        # the whole protocol, in order, one scorecard
```

⚠️ **OWNED BY `docs/canonical/coaching-measurement.md`. Do not restate it here.**

🔴 **This section listed FOUR commands and went stale** the moment `review:cohort`
and `measure:fitness` existed — it named neither, and it was the only written
statement of the protocol. **A protocol written as prose in one document and
executed by hand in a different order each time is a memory test, not a
protocol.** The order now lives in `scripts/review-coaching.ts`, the reasoning in
the doctrine file, and this line points at both.

**What makes it apples-to-apples**, and every one of these is versioned in git:

| held fixed | where |
|---|---|
| the runners | `lib/plan/charityCohort.ts` — 20 personas, + 7 canonical cases |
| the weighted population | `lib/plan/useCaseEnvelope.ts` — bands and weights, each with a written reason |
| what "a coach would object to" | `lib/plan/planQuality.ts` — 7 predicates, one owner |
| what "fit for purpose" means | `lib/plan/envelopeMeasure.ts` — one owner, shared by the script and the gate |
| **last round's numbers** | `lib/plan/__fixtures__/envelopeBaseline.json` |
| what the board already decided | this file |

**Step 2 is the one that was missing until 2026-09-20.** The rates existed only
as FLOORS in test code, which is a **one-sided** gate: a drop failed the build
and **a rise was silent**. So "is this better or worse than last time, and
where?" had to be re-derived by hand every round — the same shape as the defect
that made the board appear to change its mind. `measure:envelope` now prints
the per-distance delta and the test fails on a move **in either direction**.

**Re-baselining is a declared act.** `npm run measure:envelope -- --write`,
and say in the commit which number moved and why. **Never to turn a test
green.**

### What is still NOT comparable between rounds

- **`generated-plans.md` is gitignored** (size), so the plan TEXT of an old
  round cannot be diffed. Plan-level change detection is `verify:parity`
  instead, which hashes 5,940 cases — use that, not the round files.
- **The envelope weights are assumptions.** If they change, every historical
  number becomes incomparable. That is why they are one reviewable object with
  a written reason per band, and why the charity's answer to the volume
  question will force a deliberate re-baseline.

## CLOSED — do not re-raise without new evidence, and say what is new

| ref | ruling | date | the number behind it |
|---|---|---|---|
| **`HM-ANCHOR-VS-GOAL-01`** | **CORRECT WITH AMENDMENT — §120**, but **INSUFFICIENT EVIDENCE on the bound, so NOT SHIPPED** | 09-21 | On a time-target plan `HM` resolves to **GOAL** pace, as `T` has since 2026-09-03 and as the sibling `mp_blocks` row already does. Measured on 1,296 sessions: the same runner's "HM-pace intervals" are **26 s/km too SLOW** for an ambitious goal and **45 s/km too FAST** for a conservative one; with no benchmark, `HM pace` takes **two values (6:00 / 5:20) for every target from 1:25 to 2:20**. ⚠️ **§44's live difficulty note already promises** *"race-pace sessions will bite harder"* while the engine prescribes the opposite. ⚠️ **Willy's bound is adopted but has no number yet, and BOTH obvious gates were rejected:** `goalBeyondMeasuredFitness` tests against INTERVAL pace (a fantasy detector, not a stretch bound), and `difficulty_band` is forbidden by **§44 point 3, Willy's own constraint**. A 15% bound costs 27% of these sessions their row and presses on §22's 50% floor, so it must be **measured, not chosen**. ⚠️ **The header fix ships WITH this or not at all** — the ratio invariant classifies goal-pace work by READING the header, so telling the truth drops 555 plans below §22. **Do not re-propose `difficulty_band` as the gate.** |
| **P-02 intensity as a runner control** | **INCORRECT — VETOED** | 09-20 | 80/20 is a SESSION-COUNT observation (CD-19). At 4 running days, 80/20 vs 90/10 is **0.8 vs 0.4 quality sessions — it does not quantise**, so the control is illusory at the volumes most runners train at and consequential only at the top. Willy: dialling up is the injury vector and self-selects. **Do not re-propose a ratio dial.** `hard_session_relationship` already expresses the preference and is already governed by §110 — expose that instead. |
| **§80 vs §90 priority** | **CORRECT WITH AMENDMENT — §90 WINS** | 09-20 | §80 already yields to `LONG_RUN_CAP_MINUTES` and says so; §90's ceiling joins it. ⚠️ The 09-19 sitting's premises were BOTH false: §9 SIZES and does not cap, and §80 (not §24) is what requires the 26 km — measured 208 min against the 210 min cap |
| **S52 injury-cohort urgency** | **PREMISE WITHDRAWN** | 09-20 | the 11.4% injury × fresh-return cell: **1,224 plans, ZERO firings** on today's engine. All 129 sweep firings have **no injury history**; **116 of 129 sit at 12 km/week**. Residual is low-volume day-fitting |
| **S111 level inversion** | **NOT A DEFECT — §79 working** | 09-20 | door `ceil(peak/4.0)` on a level-scaled peak = 13/17/20. Declaring intermediate declares a bigger plan needing a bigger base. §118 removed the harm: every refused cell now receives a Base Building plan |
| **MASTERS-COMPRESSED-BUILD-01** | **PREMISE WITHDRAWN — sampling artefact** | 09-20 | full cohortGrid **39,632 plans**: masters never-builds **18.1%** vs standard **18.4%**, median build **19.2%** vs **20.0%**. The harness's 17.4%-vs-28.6% came from a **1,400-row (3.4%) sample**. Mechanism real (build-weeks 9 → 8), consequence 0.8pp |
| **M3 honesty** | **WITHDRAWN** — premise false | 09-19 | `long_run_shortfall_note` already says *"take the walk breaks early rather than late"* |
| **E5 and M4** (3 days + weekday cap) | **CORRECT AS IS**, McMillan dissent recorded | 09-19 | 5% of plans exceed a 70% long-run week, worst 74.1%; §114 took >90% to 0.00%; capping is a measured fixed point |
| **§111 cap-instead-of-refuse** | **NEGATIVE RESULT** | 09-19 | 100% of refused cases would peak below the credible floor (median 22.4 km vs 52.8). Door at 13.2 km/wk is arithmetically exact |
| **beginner finish-goal quality** | **CORRECT AS IS**, unanimous | 09-19 | §110 Am. 2. Hutchinson's evidence is explicitly about *time-goal* races |
| **load-aware difficulty band** | **INCORRECT — VETOED** | 09-19 | §44 point 3; Willy authored the constraint |
| **`S53` quality repetition** | **DISSOLVED** | 09-19 | the unit was rows; the coaching unit is the category, median 4.5 exposures |
| **week-1 engine caps** | **SIX built and rejected** | 09-19/20 | four made `BINGE-WEEK` 8–12× worse; two took the marathon out of target. Willy: *"stop proposing caps"* |
| **`WEEK1-LEAP` thresholds** | **FROZEN** | 09-20 | relaxed three times in one day; any further change needs adherence or injury data, not another corpus measurement |
| **P-17 intake messaging (RED-S)** | **INCORRECT — VETOED, unanimous** | 09-20 | §24e Am. already rules *practice, never a nutrition prescription*. **Sims — the seat that RAISED RED-S — killed it:** 20–29 female is also the disordered-eating-risk cohort, and `INPUT-SEX-01` is parked so it cannot be targeted. Her actual ask SHIPPED 09-19: 27/88 → 76/88 |

### Added 2026-09-20 — **P-17 RED-S: the conflict scan found the answer, and found me out**

**VETOED, unanimously, on four independent grounds.** Do not re-propose intake
messaging on a plan. **More data does not unblock it** — a body-mass trend would
enable a *detector*, and a detector telling a young woman her weight is falling
is a larger version of the same harm.

🔴 **The submission's central claim was FALSE and the scan caught it.** I wrote
that the cohort Sims named "gets nothing". **§24e Amendment, five days earlier,
was ruled on that exact cohort with her reasoning recorded verbatim** — the
never-run beginner marathoner with seven 2h+ sessions and no fuelling mention
anywhere, measured **27 of 88 → 76 of 88**. Her ask was already delivered.

⚠️ **I convened this sitting from the plans and the code, not from the register.**
That is the standing failure, and it recurred inside five days. **Read this file
first.**

**Sims, recorded, because it is the whole ruling:** *"I raised RED-S. I am now
going to argue against the thing built from it."* First-time, predominantly
female, 20–29 is not only the RED-S cohort, it is the disordered-eating cohort,
and they overlap heavily. *"I would not put that sentence in front of ten
thousand young women to reach the fraction who are genuinely under-fuelling."*

**Hutchinson:** the mechanism is real, the *intervention* has no evidence behind
it. Nobody has shown a sentence in a running app changes what anyone eats.
**McMillan:** in person it is a conversation; on a plan it is a leaflet, and it
competes with the §24e cue that actually names an action on a specific day.
**Willy:** the honest lever for a runner under-fuelling a ramp is **the ramp**,
not a note — and that has not come to him.

**↗️ Escalated to the SLT, and it is not a coaching question:** signposting. When
a runner is in difficulty the correct move is to point at a professional, not to
advise. Sits beside `LEGAL-COUNSEL-01`.

### Added 2026-09-20 — **M4 was never a refusal**

`M4 sub-4:00 marathon, busy 3-day, weekday cap 45` carried
`expectRefusal: true` and a note reading *"by-design refusal (§44
days-minimum)"* **for months**. It is not a refusal. `DaysAvailableError`
carries two reasons and this one is **`warn_unacknowledged`** — a confirmation
prompt. The runner is told *"3 days is under the 4 a time goal needs; expect to
finish rather than hit the time"*, ticks the box, and receives a plan:
**16 weeks, 30 → 44 km, classified maintenance**, with the weekday cap's cost
spelled out (*"peak week reaches 44 km where it would otherwise have gone to
65 km"*).

⚠️ **Every review round reported "⛔ refused by design" and the board reasoned
about a runner we turn away.** Same defect as the use-case envelope had — 2,304
prompts counted as refusals — which I fixed there and **not here**, so it
survived in the corpus the board actually reads.

⚠️ **Correcting it removed the only refusal in the corpus**, so `M6` was added:
a marathon off an 8 km/week base, a genuine §111 **block** that no
acknowledgement clears.

⚠️ **And it revealed a real finding the mislabel had hidden:** M4's plan carries
`BINGE-WEEK` (worst session 69% of its week) — the same 3-days-plus-cap shape
as E5, and covered by E5's ruling above. **Measured product-wide: 3.3% of
runners see a confirmation prompt (8.4% at marathon+), 3.0% are genuinely
blocked.**

## Standing rulings — 2026-09-23

| ruling | status | note |
|---|---|---|
| **`HARNESS-COMPOSE-GAP-01`** | 🔴 **OPEN — the MEASUREMENT was defective, not the engine** | **Four of five harnesses call `generateRulePlan` and stop**; only `property-validate-plans.ts` calls `composePlanWithFoundation`, the function `/api/generate-plan` actually calls (ADR-020). So the board round, `envelopeMeasure`, `audit-plan-quality` and `cohortGrid` **have never seen a foundation week**, while any runner with a runway over 28 days gets one. ⚠️ **Worse than unchecked:** `INV-PLAN-UNCOVERED-RUNWAY-DECLARED` reads a stamp only the composer writes and is **deliberately silent without it**, so it reported CLEAN in every harness that never composed — **a green round was not evidence.** Engine EXONERATED by `scripts/foundation-review-round.ts`: 504 plans, 486 composed, 231 with blocks, **0 violations, 0 §76 breaches**. Hutchinson **narrowed the 09-20 "proud to hand over" verdict rather than withdrawing it**. ⚠️ Half-closed only — `planQuality`'s 7 coach objections still never see a foundation week. |
| **`RUBRIC-STALE-BAR-01`** | ✅ **CLOSED 2026-09-23** — doc corrected to the live bar; superseded bar and numbers RETAINED and marked, so old rounds stay readable. ⚠️ **Still no mechanism**: `audit-docs.sh` does not compare the doc's figures against `envelopeBaseline.json`, so the next drift is equally silent. | `fit-for-purpose-rubric.md` teaches *"a correct refusal counts as fit for purpose"* and quotes **95.3% / marathon 90.1% / every distance ≥90%**. `ZERO-REJECTION-01` (`1bfc664`) overturned that accounting **nine hours later the same day** on the founder's standard — *"we can't just say no, go away."* Doc written 09-20 **07:47**, ruling landed **16:34**, never updated. Live: **92.5%**, marathon **78.7% + 12.4% refused**. ⚠️ **The harm is the stale STANDARD, not the stale number** — the 09-20 sitting scored refusals as passes and recorded the marathon at 90.1%. Sims: *"it made the product look kindest to the people it was turning away."* |
| **The marathon is NOT fit for purpose under the live bar** | 🔴 **OPEN — inherited, not new** | **78.7% fit + 12.4% refused.** One marathoner in eight is told no, and `ZERO-REJECTION-01` is explicit that a refusal is a failure. Not a new finding (`MARA-LR-LOWBASE-01` is filed) but **the board must not inherit 09-20's 90.1%**, which used the superseded accounting. Every other distance is at or above target and the board **is** proud to hand those over. |
| **26 uncovered weeks at a 180-day runway** | ✅ **WITHDRAWN AT THE CONFLICT SCAN — do not re-raise** | Settled by `FOUNDATION-LONG-RUNWAY-01` (2026-09-15): the gap is structural, §57's amendment shows **a longer block is measurably useless**, so the obligation is **HONESTY, NOT COVERAGE**. Brought to this sitting as an open question and closed by the scan before any seat spoke — **the second consecutive sitting the register prevented a re-litigation.** This round supplied the opposite of new evidence: **81 of 81 plans at 180 days carry the note.** |
| **Ops-digest `foundation_week_violations` (1,1,4,8,1)** | ✅ **NOT A DEFECT — resolved before the sitting** | Two are **legacy April plans** (128–129 days before ADR-020). The other three are plans from 09-12 and 09-18 failing invariants added **after** they were generated (`STRIDES-PRESENT` 09-15, `QUALITY-NOT-ZERO` 09-16, `LONG-SESSION-FUELLING-NOTE` 09-19, `TIME-TARGET-QUALITY-FLOOR` 09-19, `RACE-NOT-VOLUME` 09-22, and `DIFFICULTY-NEVER-FRONTS-UNSAFE`, which gained a **second firing site** on 09-19 — the day after the plan it flags). **Verified against git, not the ops table.** Live-plan policy: doctrine fixes are not backfilled. |

## Standing rulings — 2026-09-23, sitting 2

| ruling | status | note |
|---|---|---|
| **`ZERO-REJECTION-SERVED-01`** | ✅ **SHIPPED 2026-09-23** (`e221888`) — chair's gate satisfied: before/after taken to the board, baseline written only after. **Whole product 92.5% → 96.0%; marathon 78.7% → 89.8%; every other distance unchanged.** 🔴 **IT DOES NOT CLEAR THE TARGET — marathon is 0.2pp under 90 and is NOT signed off.** ⚠️ **AND WHOLE PRODUCT IS NOW 96%, ABOVE ITS OWN 90–95% BAND — a question about the TARGET, open.** ⚠️ **The engine did not change**: `verify:parity` IDENTICAL, `review:cohort` unchanged every band. | **A refusal that hands the runner a validated §118 plan is NOT a dropout and must not be scored as one. It is also NOT a marathon plan and must not be scored as a pass.** It becomes a **WATCHED** quantity (`SERVED`), using the mechanism `RUBRIC-GAPS-01(a)` already ratified for `DAYS-SHORT-SILENCED`. 🔴 **THE SCAN FOUND THE ANSWER HALF-WRITTEN**: §118's own chair note says *"NO HARNESS WATCHES THIS PLAN KIND … inventing a way to score a raceless plan would be the decorative-check failure"* — so the board had already ruled §118 must not be scored by a race-shaped harness. **What was never drawn is that `measure:envelope` does not merely fail to score it, it scores it FAIL.** ⚠️ **`ZERO-REJECTION-01`'s premise was superseded nine hours after it was ruled** — it landed 09-20 16:34, §118 shipped the same day, and a refusal has led to a real plan ever since. **Measured: 522 of 522 refused marathoners are SERVED; door 80.3% / 99.6% / 100% at 4 / 8 / 15 km/wk.** **Four binding amendments:** ① recorded as a **CORRECTION, never an improvement**, with the pre-correction figure retained ② `SERVED` and `door` reported **at every sitting** — a watched quantity nobody reads is a hidden one (Seiler, Sims) ③ a refusal that is **NOT** §118-served stays a scored FAIL ④ `door` reported **per band, never averaged** — 80.3% and 100% are different promises (McMillan). **Chair's gate: implement, re-run `measure:envelope` + `review:cohort`, bring the before/after to the board BEFORE the baseline is written.** ⚠️ **Hutchinson, binding:** *"the engine did not get better. If it reads ~91%, not one runner is served differently."* |
| **`S117-LEVEL-GATE-01`** | 🔴 **INSUFFICIENT EVIDENCE** (Willy; four seats would admit) | Should §117 read the **volume-derived** structural level rather than a supplied `fitness_level`? `beginner_max_weekly_km = 20` already calls every runner in the band a beginner. **Willy: the mechanism is acceptable — §117's peak is FIXED at 34, not scaled off self-report, which was his §111 objection — but there is no evidence a runner declaring intermediate at 15 km/wk is structurally different from one declaring beginner.** *"That is an argument. It is not data."* **Settles it:** `plan_refused_by_design` showing such runners at a rate above zero; it has **never fired**. ⚠️ **RE-SIZED by McMillan, chair accepted: with §118 live this gate decides WHICH PLAN, not WHETHER A PLAN. It is no longer on the critical path to a sign-off.** |
| **Sims, recorded** | ⚠️ **Standing observation, not a finding** | The superseded rubric *"made the product look kindest to the people it was turning away"*; the current one **makes it look crueller than it is to the same people**. **Both errors landed on the low-base cohort.** *"It is not that we got the sign wrong twice — it is that this cohort is the one our instruments keep mismeasuring, because they sit at the edge of every rule."* |
| **`ONRAMP-STEP-UNITS-01` remainder** | 🔻 **FILED TO WILLY — not ruled from a table** | Above `weekly > runs × 15`, §2 and §116 Am.2 cannot both hold. ⚠️ **Willy, binding: *"Do not resolve that by raising my per-run cap. The cap is the bound I priced. If anything yields it is the volume target, and §118 not having one is why the conflict exists."*** He wants the plans, not the arithmetic. |

## OPEN — with the measurement, ready for a sitting

| ref | question | the number |
|---|---|---|
| `MARA-LR-SHAPE-SEAM-01` | for a knee-history marathoner at **8-12 km/wk**, what does the STANDARD (non-§117) path actually DELIVER if the adequacy refusal is bypassed? | The gate refuses on a **13 km run-walk projection**; the 2026-09-20 board table recorded that same cell **delivering 17 km on a standard plan**. Two shapes, one gate. If the standard path still delivers 17, a guard built for the run-walk shape is refusing a runner who would have received another — the *checker reads a different source from the producer* class. If it delivers 13, the refusal is simply right and the seam closes. ⚠️ **Not a proposal.** Two mechanisms in this area have been built and reverted (`RACE-ANCHOR-CV-OVERRIDE-01`), and `WEEK1-LEAP` is frozen against corpus-only arguments |
| `ULTRA-LR-ADEQUACY-01` | what is the right long-run bar for 50K/100K? | none exists since `ULTRA-LR-BAR-01`; §24e's back-to-backs make a single longest run the wrong unit |
| `S111-SUBFLOOR-VOLUME-01` | build a base-building plan type? | blocked on the charity's answer; runbook drafted, unsent |
| `RACE-KEY-TWO-OWNERS-01` | collapse two `raceDistanceKey` ladders? | 88 diverging values, currently unreachable (the wizard's six distances all agree) |

## Standing rulings — 2026-09-23, sitting 5 (`LONG-RUN-SHORT` vs the finish-goal runner) — SHIPPED AS A CORRECTION

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **The exemption keys on *IS THE RUNNER RUN-WALKING*, not *WAS THE PEAK REDUCED*** | 🟢 **SHIPPED** | §117 Am.2 states the reason in its own words: **"55% of race distance is the bar for a plan built to RUN the race."** A runner run-walking the race is not running it, and how their PEAK was set is irrelevant to which bar applies. ⚠️ **THIS WAS CORRECT UNTIL §117 Am.4 AND I BROKE IT MYSELF, THE SAME DAY** — `finish_goal_run_walk` used to mean both things; Am.4 split them and left this line on the peak half |
| **The exemption is BOUNDED in `planQuality`, not only by the invariant** | 🟢 **SHIPPED — Willy's condition** | §117 Am.2's finding was *"the exemption was correct; its BOUND was missing — an exemption without a bound is not a relaxation, it is a hole."* `INV-PLAN-RUNWALK-ADEQUATE` guards `finish_goal_run_walk` plans and **cannot see a prescribed-but-not-reduced one**, so the 17 km bound is applied at the objection too. Below 17 km the plan is **SCORED**, run-walk or not |
| **DECLARED A CORRECTION, NEVER AN IMPROVEMENT** | 🟢 **RECORDED** | Marathon **89.1% → 89.5% (+0.4pp)**, product 95.8% → 95.9%. `LONG-RUN-SHORT-RUNWALK` (watched) **0.5% → 0.8%** — the exempted plans moved into the visible column, not out of sight. 🔴 **NO PLAN CHANGED. Not one runner trains differently.** Hutchinson's ZERO-REJECTION-SERVED-01 rule applied in full; `fitPctPreCorrection` carries the old figure. ⚠️ **It does NOT undo Am.4's cost** — the day nets 89.8 → 89.5, with **16.7pp of the low-base injured cohort newly served** |
| **A load-aware or wholesale relaxation of the 55% bar** | 🔴 **NOT PROPOSED AND NOT RULED** | Group 2 — injured runners at 15–20 km/wk who are **NOT** run-walking — keep the scored objection. McMillan: *"the 55% bar applies and the objection is honest. Do not bundle them."* |

⚠️ **FOUR INSTRUMENT FAULTS IN THIS THREAD, ALL CAUGHT BEFORE A SEAT SPOKE:** (1) `max(distance_km)`
read the RACE as the long run (`42.2km/100%` on every row); (2) a `runWalkApplies` probe passed
`standardPeakKm = 0` from an undefined error field and reported the gate FALSE when the engine's own
stamp said true; (3) an effect estimate summed weights that print as 0 and returned **+0.73pp**
against the owner's **+0.4pp**; (4) 🔴 **I told the board the headline would not move, having checked
`cohortGrid` (no injury history) when the rate comes from `useCaseEnvelope` — which is 50% injured.**
**Confidently stated, unverified, and wrong.**

⚠️ **AND THE ENVELOPE GATE HAS A 0.6pp TOLERANCE** (`useCaseEnvelope.test.ts:235`). A 0.4pp move
passes it. **"The suite is green" means the move was small, not that nothing moved** — the script's
own comparison is the check that catches it, and a sub-0.6pp drift could accumulate across commits
unobserved.

## Standing rulings — 2026-09-23, sitting 4 (`MARA-LR-SHAPE-SEAM-01`) — SHIPPED

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **§117's peak reduction may not be given to a §12 volume-capped runner** | 🟢 **SHIPPED — §117 Amendment 4** | The reduction exists to lower §111's door; their door is **already open** because the injury cap lowered their peak for them. **Isolated by sweeping the constant**: delivered peak LR tracks §117's peak monotonically — 34→**13km**, 38→14, 42→15, 46→16, 50→17, 52→**17**, 56→19. At 34 they fall below §117 Am.2's own 17 km bound and are REFUSED; at the standard peak they get **17 km, VALID, 0 errors** — the plan §80 Am.2 ruled correct and which was **offered to nobody**. ⚠️ §117 and all three prior amendments contain **ZERO mentions of injury, knee, shin, §12 or the cap** — an **omission, not a contradiction**. Remedy follows ADR-021's *"NO injury history"* precedent |
| **The PRESCRIPTION is not withdrawn from them** | 🟢 **SHIPPED** | McMillan's Am.3 condition is untouched: `run_walk_prescribed` covers both shapes and `INV-PLAN-RUNWALK-PRESCRIBED` still requires the interval on every session. Verified in the build output: `prescribed=true, stamped=true`. **`finish_goal_run_walk` now means the PEAK was reduced; `run_walk_prescribed` means the SESSIONS carry the interval.** The first implies the second; the second does not imply the first |
| **THE FIT RATE FELL, AND THAT IS THE CORRECT SIGN** | 🟢 **DECLARED, baselined under this ruling** | Marathon **89.8% → 89.1%**, product **96% → 95.8%**. Refusals at 8 km/wk **85.8% → 69.1% (−16.7pp)**; `LONG-RUN-SHORT` **+16.6pp** — **the two match one-for-one**, which is the arithmetic proof that refusals converted into plans and nothing else moved. `neverBuildsPct` unmoved, `cohortShape` 19/19, every other band and the half marathon unchanged. 🔴 **Hutchinson, binding:** *"The rate fell and the product improved. That is the inverse of this morning's re-score — then the number rose and nobody was served differently; now the number falls and sixteen percentage points of a cohort get a plan. **Declare the drop, do not disguise it.**"* ⚠️ **It was predicted before the measurement was taken** |
| **My filed seam premise was WRONG** | ⚠️ **RECORDED** | `MARA-LR-SHAPE-SEAM-01` was filed as *"the refusal is computed on the run-walk projection while the runner would have received the standard shape."* The engine's own stamp says `isRunWalk = true` — they **are** on the run-walk shape. My probe reported `false` because I passed `standardPeakKm = 0` from an undefined error field. **Three instrument faults in this thread**, each caught before a seat spoke |

⚠️ **THE LIVENESS GATE CAUGHT MY OWN CHANGE.** Re-keying `INV-PLAN-RUNWALK-PRESCRIBED` onto the new
flag made it **unwakeable**, and `invariant:liveness` failed in the same commit and said so. The
mutation was fixed rather than the rule baselined — the gate doing exactly what it was built for.

🔻 **WHAT THIS DOES NOT FIX.** The marathon is still **89.1%** against a 90% target. Of the two
remaining scored objections, `WEEK1-LEAP` (4.4pp) is **FROZEN** pending adherence or injury data,
and `LONG-RUN-SHORT` (now larger) covers plans **§80 Am.2 already ruled correct** — so the open
question is whether that objection still describes a failure. **That is a board question, not an
engine one, and re-scoring it would move the number without serving a runner.**

## Standing rulings — 2026-09-23, sitting 3 (`MARA-LR-LOWBASE-01`, re-opened and closed)

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **`MARA-LR-LOWBASE-01` — the filed question was ALREADY ANSWERED** | 🟢 **CLOSED. No change.** | 🔴 **It was ruled on 2026-09-20 as §80 Amendment 2 — *"CORRECT WITH AMENDMENT. The PLAN is right; the NOTE was wrong."*** It sat in `CoachingPrinciples.md` for three days while the OPEN table above still listed it unanswered. ⚠️ **The settled-ground scan is the only reason this sitting did not re-litigate a closed ruling** — the second time in eight days that reading the register first changed the answer (`MARATHON-READINESS-GAP-01` was the first). **Read the register before the plans.** |
| **§117 Amendment 2's bound BECAME BINDING on 2026-09-23** | 🟢 **RECORDED — the amendment working as written** | Am.2 said the 17 km bound *"binds on nothing today and is a **guard against a future peak or runway change, which is exactly when it would otherwise have been discovered by a runner**."* **It binds now, three days later, on the knee/shin-history marathoner at 8-12 km/wk**, and it was found by a harness rather than by a runner. The refusal is §44-compliant and names the number: *"We would only get your longest run to about 13 km before race day, and you need at least 17 km behind you to get round a marathon."* `unserved 0%` — §118 serves them. **Willy: refusal correct, not tradeable.** |
| **The cohort MOVED since the 09-20 ruling, in both directions** | ⚠️ **RECORDED, not ruled** | On the board's own fixture re-run: **healthy 8-12 km/wk went REFUSED → §117 run-walk plan at 19 km (44%)**, and **knee 8-12 km/wk went ADMITTED at 17 km → REFUSED**. 15/20/25/35 reproduce **exactly**. ⚠️ **Willy's observation, recorded:** §117 now rescues the *healthy* low-base runner and refuses the *injured* one — **the runner with less margin is the one who loses the plan.** |
| **A load-aware or corpus-only relaxation of the 17 km bound** | 🔴 **NOT RE-PROPOSABLE from a corpus measurement** | McMillan's 17 km is §9's recorded structural finding and the position the founder took. `WEEK1-LEAP` was frozen on 09-20 for exactly this reason: *"any further change needs adherence or injury data, not another corpus measurement."* The same standard applies here. |

⚠️ **NOTHING SHIPPED FROM THIS SITTING and that is the output.** No principle, numeric or invariant
changed, because the ruling is that current behaviour is correct. The three artifacts are records.

⚠️ **THE MEASUREMENT NEARLY REPORTED THE WRONG THING.** The first instrument took
`max(distance_km)` across every session and reported **`42.2 km (100%)` on every row** — it was
reading the RACE. `auditPlanQuality` already excludes it. **Read the owner's figure; do not
recompute one beside it.**

⚠️ **AND THE FIRST CROSS-FIXTURE COMPARISON WAS INVALID.** A 4-day/18-week fixture gave knee@15
**16.0 km** against the board's 17 km, and reporting that as drift would have been the
`MASTERS-COMPRESSED-BUILD-01` error again — a COMPOSITION difference read as an engine change.
The board's own fixture (3 days, 29-week runway, `<6mo`) was reconstructed before anything was
compared, and on it the ruled cells reproduce exactly.

## Standing rulings — 2026-09-22

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **`HM-ANCHOR-VS-GOAL-01` — §120 + Amendment 1** | 🟢 **SHIPPED** | On a time-target half the `HM` anchor resolves to **GOAL** pace, bounded so it is never faster than the runner's own **CV** pace. ⚠️ **The board REJECTED the constant it had itself named** (`RACE_PACE_ANCHOR_MAX_STRETCH_PCT`, a % of current HM pace): right question, wrong unit, because `INTENSITY_ORDERING_TOLERANCE_PCT` already asks how far past a derived band a goal pace may sit. **Do not re-propose a percentage-of-current-pace bound.** Measured: 60% of goal paces are SLOWER than threshold (§120 makes those easier), 15% land at or past INTERVAL pace — a 52:00 10K runner targeting 1:25 was handed 4 × 2 km at **4:02/km**, 50 s/km faster than their own VO2max pace. |
| **`RACE-WEEK-VOLUME-01` — §121** | 🟢 **SHIPPED** | The race is the test, not the training: excluded from `weekly_km` and from the plan total. Taper phase outweighed peak phase in **15.3% of plans and 50% of marathons**; excluding the race, **no taper anywhere exceeds its peak**. 🔴 **An HONESTY fix, never to be sold as a safety one** (Willy, binding) — a 12 km/week runner racing 42.2 km is at 1.7× their largest ever week and this changes that by nothing. |
| **`TAPER-OVER-PEAK-01`** | 🔴 **RULING VACATED 2026-09-22 at the re-sitting. Re-ruled CORRECT WITH AMENDMENT; NOT BUILT** | 🔴 **Not a taper defect: the PEAK is too small.** At 2 days a week a quality session replaces a third of the week, so peak weeks come out below build weeks and below the taper. **§1 counts SESSIONS**, so 2 days offers only 100/0 or **50/50** against a declared 80/20 ceiling — the arithmetic that **VETOED P-02's intensity row** at 3–4 days, never checked at 2. §90 Amendment 1 already built the yield mechanism and scoped it to injury; **the scope is what is wrong, not the mechanism.** ⚠️ Blocked on measuring the §22 exposure and cohort effect — a measurement, not a filing excuse. | ⚠️ **MEASURED AFTERWARDS, AND BOTH HALVES OF THE SUBMISSION WERE WRONG.** (a) *"At 2 days the only ratios are 100/0 or 50/50"* is the PER-WEEK arithmetic; **§1 counts sessions PLAN-WIDE (CD-19)** and the 2-day mean share is **26.6% against a 25% ceiling — over by 1.6pp**, with **no plan at any day count losing all quality**. (b) The remedy **fails its own acceptance test**: A/B'd on 1,223 plans, taper>peak went **6 → 9**, because removing quality from a taper week lets an easy run take its place and the taper grows. 🔴 **The real mechanism is an ADR-022 divergence, not intensity distribution**: a quality session is sized by a fixed work-minute dose and an easy run by the week's volume target, so at 2 days a swap costs a third of the week and nothing tops it back up — the traced peak week delivers **12 km against a declared peak target of 32**. 🔴 **THE FIRST RULING CONTRADICTED §1 CD-21 AMENDMENT 1, WHICH HAD ALREADY RULED ON THIS EXACT COHORT — and my conflict scan missed it.** CD-21 Am.1 says in terms: *"At two runs a week there is no distribution to describe — **the ratio is not violated, it is undefined**"* (Seiler), and *"**forcing compliance would mean two easy runs and no quality**"* (Sims, for the peri- and post-menopausal cohort). **That is precisely what I proposed.** ⚠️ **Both halves of the submission were also wrong:** *"at 2 days the only ratios are 100/0 or 50/50"* is the PER-WEEK frame while §1 counts PLAN-WIDE (2-day mean **26.6%** against a 25% ceiling, no plan losing all quality), and the remedy A/B's the symptom **6 → 9**. **RE-RULED:** the defect is real and belongs to **ADR-022**, not §1 — a week whose delivered volume falls materially below its own curve target must have the shortfall absorbed by its remaining easy running, the mirror of ADR-022's trim. **Willy's bound is binding:** absorption is capped by §9's long-run share and §45's progression cap; a week that still cannot reach its target runs under, honestly. **INSUFFICIENT EVIDENCE to build:** `waterFillEasyKm` (UX-WIZARD-01 Stage B) already redistributes an easy pool by day ceiling, and whether that pool is computed **before or after quality placement** is unmeasured — a one-line question with a blast radius across every day count.
| **`SESSION-SIZING-ANCHOR-01`** | ✅ **CLOSED — the premise was FALSE** | §120 §6 asserted a "sizing twin of the header defect" and never measured it. **1,320 quality sessions: 0 sized at threshold while running elsewhere.** A structured session prices its distance from its own work pace. **Do not re-file it.** |
| **`RACE-ANCHOR-CV-OVERRIDE-01`** | 🔴 **OPEN — a DEADLOCK, not a leak** | §85 shields `CV` from §22's goal-pace override; §22 requires a second-half build/peak slot to be goal-paced. **A CV row there cannot satisfy both.** 92 of 2,401 sessions, worst case 69 s/km. ⚠️ **The obvious fix was BUILT AND REVERTED the same hour** — it turns §22's own ownership arm red on 100 tests. Same shape as the §111/§57 deadlock. |

## Standing reservations — recorded, not findings

- **Willy on M5** (masters 58, +94% build): compliant, top of his range, first cell he would look at if injury reports arrive. Recorded three times.
- **Sims on M5 and M1**: bone health and low energy availability for peri-menopausal and young female runners on long slow blocks. Recorded three times.
- **Seiler on beginner monotony**: correct distribution, no objection, but the stimulus varies little. Not a defect.

## What no sitting can answer

**There is no adherence or dropout data.** One analytics event exists in the
product; no charity code has ever been redeemed. Every "proud to hand over" is a
coaching judgement with a number attached, never an outcome. **And nothing has
run on a device.**
| **`COACH-BEHIND-DAY-TWO-01` — §65 Amendment 1** | 🟢 **CORRECT WITH AMENDMENT, SHIPPED** | 09-22 | §65's implementation rule was honoured perfectly and **its purpose was not.** `daysDueByEndOfYesterday` is used correctly everywhere; today is never counted. But the Coach verdict then softened at `done / dueRef >= 0.7`, and **that ratio cannot be satisfied below FOUR sessions due** (`dueRef=1,2,3` → NEVER). `dueRef` never exceeds the week's planned sessions, so **for a three-day-a-week runner the softener could never fire — in any week, at any point in any plan. 29.0% of the cohort grid.** They miss one Tuesday and read amber, forever — and that is precisely the population §65 was written for (*"Zonna is for runners who already feel behind"*). **Ruling: a single outstanding session is never a judgement, at any session count.** ⚠️ **The precedent is this constitution's own, twice** — §1 CD-21 Am.1 (*"the ratio is not violated, it is **undefined**"*, Seiler) and `INV-PLAN-LR-MAX-WEEKLY-PCT` binding only above two runs. One outstanding session out of one due is not a ratio, it is an event. ⚠️ **ADDITIVE:** the 0.7 softener is untouched (2 of 7 behind is softened as before) and a three-day runner who does NONE of three still gets a real verdict. `BEHIND_VERDICT_MIN_SESSIONS = 2`; `lib/coaching/behindVerdict.test.ts` is **exhaustive over `dueRef` 1..7 × every `done`, not example-based** — ⚠️ **an example-based test would have passed the whole time** (`dueRef=5, done=4` works beautifully), because a reachability hole is only visible by enumerating the domain. Falsified three ways including setting the bound to **1**, at which the rule is inert. |
| **`RACE-ANCHOR-CV-OVERRIDE-01` — the ruling's safety assumption FAILED measurement** | ⚠️ **RULED, BUILT, REVERTED same day** | 09-22 | The board adopted my argument that excluding a CV row from §22's goal-pace slot is safe because *"§22 already requires that distance to own a `race_specific` row, so the slot is filled rather than emptied"*. **Built and measured on the changed engine, as the board's own procedure requires: `neverBuildsPct` ROSE (healthy masters 18.6% → 18.8%, healthy standard 12.8% → 12.9%) — the one figure `CLAUDE.md` gives NO tolerance — the cohort lost 3 plans to refusal (9,671 → 9,668), and `segmentPricedDistance` found ZERO reps-scaled threshold sessions because the CV rows excluded WERE those sessions.** 🔴 **The guarantee is not a guarantee: §22 requires the distance to OWN the row; it does not follow that the row is ELIGIBLE for this runner, in this phase, at this volume, with this fitness rank and these resolvable anchors. I reasoned from the catalogue's contents to a runner's eligible set, and those are different objects.** Reverted, not re-baselined — three runners losing a plan is worse than 92 sessions carrying a mislabelled header. ⚠️ **TWO mechanisms have now failed at opposite ends**: exempting at override time empties §22's ownership arm (100 tests red), excluding at selection time empties the eligible set. **Do not re-propose either.** The settling artefact, which neither sitting has taken: **for each of the 92 sessions, what else was actually ELIGIBLE in that slot for that runner** — not what the catalogue owns, what the selector would have returned. If the answer is nothing, the deadlock belongs to the catalogue, not to §22 or §85. |

## 2026-09-24 — `/best-running-app-for-beginners` physiology claims · CORRECT WITH AMENDMENT

**Convened by:** the W-03 precedent plus the SLT ruling recorded on `MarketingArticle.principleRefs`
— *"a guide may only assert what an existing principle already asserts, and it names the section. A
claim no principle covers is a Coaching Board item BEFORE it is a writing task."* Its stated reason,
that a coaching claim *"does not become a marketing surface because it lives at /guides"*, **cuts
both ways: it does not stop being one because it lives at a comparison slug.** No doctrine file
changed; the board was routed in analysis, not by a guard.

**Conflict scan.** §12 is a **ceiling, not a band**, so the talk test is a different *instrument* for
the same rule rather than a competing definition. §1 counts **sessions** (CD-19), so "one session a
week to push" is arithmetically consistent at 3–4 runs. §30 and `INV-PLAN-EFFORT-OR-PACE` already
establish effort as an accepted prescription instrument, which is what makes an RPE-style
instruction doctrinally normal rather than a new idea. No conflicts.

**Three claims had no covering principle, and three amendments were required:**

| # | Seat | Claim as submitted | Ruling |
|---|---|---|---|
| 1 | Hutchinson | *"Easy running builds your aerobic base: capillaries, mitochondria"*, set against the hard-running paragraph | Asserts a **differential the evidence does not support** — mitochondrial biogenesis is if anything more responsive to higher intensity. Easy running earns its place because it is **volume you can recover from**. Mechanism kept, implied exclusivity removed |
| 2 | Willy | *"Pick one session a week to actually push"* | The title recruits **beginners** and this instruction reaches them, while the page's own opening sends that reader to Couch to 5K. **Scoped** to the runner past that stage, with an explicit skip for those still building to continuous running |
| 3 | Hutchinson | *"Give it three or four weeks before you decide it isn't working"* | Defensible as **behaviour**, indefensible as an **adaptation curve**. Reworded to read as how long to withhold judgement, and to judge on whether hard days feel hard again rather than on a PB attempt |

**Not blocking, recorded:** Sims noted the page states its diagnosis as complete (*"the honest fix
is running slower"*) while under-fuelling is the other common reason a plateau holds. Out of scope
for this page; do not claim completeness elsewhere. Seiler and McMillan raised no objection —
McMillan asked that the talk-test wording be kept **exactly** as written.

**Artifacts.** No principle authored and no numeric: this ratifies existing §1/§12/§30 language on a
new surface and changes nothing the engine prescribes. **Not mechanically checkable** — no test can
tell whether prose matches the section it names; `principleRefs: ['§1','§12','§30']` records that
somebody had to name one, which is the point at which the question gets asked at all. ⚠️ The gate
that enforces it, `guidesGate.test.ts`, had a **hollow** comparison arm and was repaired in the same
commit.

## 2026-09-24 — EMAIL-WAVE-2, the 🏃 lines in the trial emails · TWO SITTINGS, ONE VACATED

**Trigger:** soft, qualified — the emails assert what a runner's training did, on a surface no
board had seen. Artifacts: **§12 Amendment 2**, `ZONE_HELD_MAX_ABOVE_CEILING_PCT` (10) and
`TRIAL_SUMMARY_MIN_RUNS` (8), `lib/email/verdictLine.test.ts`.

### Sitting 1 — INCORRECT (vacated the same day)

The board ruled `verdictLine`'s `hr_in_zone_pct >= 70` **INCORRECT**: §12 is a ceiling, §12 Am.1
made the drift detector directional, and a band is the wrong instrument. Hutchinson's stated harm:
*"a runner who finally ran genuinely easy gets no verdict line — we stay silent at the exact moment
the product worked."*

### 🔴 The measurement, taken before implementing, which falsified it

| | |
|---|---|
| Runs under 70% in zone with **zero** time above the ceiling — the runner the ruling protects | **0 of 73. The harm did not exist** |
| Runs with `hr_above_ceiling_pct = 0` | **0 of 73** |
| Runs receiving the line today | 71 of 73 |
| `hr_above_ceiling_pct`: min / median / max | **3 / 8 / 33** |

**The literal fix would have taken the sentence from 71 of 73 to none.** And the 27% mislabelling
that produced Am.1 was the R30 detector on a `< 60` band — **the other side of the distribution
from this `>= 70` test.**

### Sitting 2 — CORRECT WITH AMENDMENT, sitting 1 VACATED

**§12 Am.1 governs accusation, not praise.** An accusation needs only the ceiling; a compliment
needs the band AND the ceiling. `verdictLine` keeps `>= 70` and gains `hr_above_ceiling_pct <= 10`.
**68 of 73 keep the line**; the up-to-5 who cleared the band while running hot lose it, which is the
case §12 actually cares about.

Hutchinson, recorded: *"I over-read my own amendment and the data caught it. I asserted a mechanism
and called it a finding, which is the exact thing this seat exists to stop other people doing."*

**Also ruled:** an improvement claim needs **8 analysed runs** (McMillan — *"a three-run trial
cannot support 'when you started'"*), and a missing HR degrades to **silence, never a zero** (Sims,
ADR-011 §5).

⚠️ **Found while building, by rendering rather than by a test:** the day-11 subject was keyed on
`verdictLine()` being non-empty, which is true for *"Close. Plan's doing its job."* — so a runner
**22% above the ceiling** was subjected *"You held the zone on Tuesday."* The subject and the body
disagreed about the same run. `heldTheZone()` is now the single predicate both ask.

---

## LOG-OFFPLAN-01 — off-plan runs enter the load model (2026-09-27)

**Ruling: CORRECT WITH AMENDMENT.** Hutchinson chairing. Routed down by the Design Board,
which was blocked on this before it could rule the shape of an off-plan logging entry point.

**The question.** Does a run the plan did not prescribe enter the load model?

| | |
|---|---|
| Already counted it | §58 cohort matching, the pace trend and the **pre-run HR band** — all read the activity log through `fetchRunHistory` with **no matched filter** |
| Could never count it | `actual_load_km` lives on `run_analysis`, and `/api/analyse-run` **422s without `week_n` + `session_day`** |

🔴 **So off-plan volume was VISIBLE TO FITNESS AND INVISIBLE TO LOAD** — the engine saw
efficiency improving while its load rules stayed flat.

### Ruled

| # | Clause | Built? |
|---|---|---|
| 1 | Off-plan running contributes to actual weekly volume and shadow load — always | 🟢 **SHIPPED** |
| 2 | It never reaches the acute:chronic ratio, which auto-trims below `LOAD_RATIO.flag` | 🟢 **SHIPPED** |
| 3 | For the §2 injury cohort it is included in the cap **and the runner is told** | 🔴 **RULED, NOT BUILT — blocked on sample size** |

🥇 **Clause 2 already existed in code and the sitting found it rather than inventing it.**
`buildShadowLoadAdjustment` copies `sessionsBefore` into `sessionsAfter` unchanged and
reports *"Flagged — no auto-change applied."* The two load triggers already split along the
clause-1/clause-2 line; the build fed them the right two numbers.

### 📐 Measured — and the profile inverted the expected answer

Of runs that happened **while a plan existed**: **21 of 78 (26.9%) off-plan, 173 km of 848
(20.4%)**. Against a same-person on-plan control they are **shorter** (median 7.5 vs 8.0 km)
and **more disciplined** (median 68.8% vs 60.0% in Z2; mean Z4/5 **4.7 vs 7.3**).

- **McMillan sustained** — this is ordinary easy volume, so reacting to it would be
  disproportionate. Clause 2.
- **Seiler's hypothesis WITHDRAWN** — he expected grey-zone drift; off-plan Z3 is **24.1%**
  against on-plan **26.9%**. The drift is in the sessions we prescribe.
- **Willy sustained on structure, softened on urgency** — 20.4% of real distance uncounted
  means §2's 5% injury cap is *"applied to a number that is not their load"*. Still true.
  But it is not a funnel into hidden hard training, so clause 3 states rather than acts.

### ⚠️ The measurement that was wrong first — the durable part of this row

**A raw count said 65% of runs were off-plan. 79% of those PREDATE their user's plan** —
HealthKit history backfill imported on connect. Seven of nine accounts had never linked a
run, and the "control" was **96% one person**. Separately the same physical run is ingested
twice for **63 km, 4.2% of the log**.

🔴 **Filter on `start_date >= plans.created_at` and de-duplicate before summing.** Both are
now inside the owner, with the reason, because the naive figure was off by 2.4×.

⚠️ **THE PREVALENCE FIGURE AND THE SHIPPED BOUNDARY ARE NOT THE SAME TEST, and the
difference is recorded rather than smoothed over.** The 26.9% / 20.4% above counts runs
after the **plan ROW was created** (`start_date >= plans.created_at`). The shipped owner
is stricter: `isInsidePlanWeek` keeps only runs inside an actual **plan WEEK**, so a run
between generating a plan and its first Monday is dropped. **26.9% is therefore an upper
bound on what the engine will count, not a description of it.**

📐 **What the shipped path sees on production today: 3 plan-weeks contain any logged run —
16 km linked, 35 km off-plan — and the change produces ZERO new `shadow_load` flags.**
Not because the rule is inert, but because **15 of 25 live plans have not reached their
first week yet**, so there is almost no overlap with logged history. The correct reading is
*"armed, with nothing yet to act on"*, and it is the third time this item's headline number
moved when the denominator was made honest. **Re-measure once plans have run for a few
weeks; do not quote 26.9% as engine behaviour.**

### 📦 Artifacts

| | |
|---|---|
| **Principle** | §2 Amendment 4 |
| **Numeric** | `DUPLICATE_ACTIVITY` (`lib/coaching/constants.ts`) |
| **Mechanical check** | `offPlanLoad.test.ts` (7) + `weeklyActualLoad.test.ts` (17). ⚠️ **NOT a `validatePlan()` invariant** — a coaching-time rule reading `strava_activities` cannot be reached by a `Plan => Violation[]`, the `static` class, as for §112 |
| **Owner** | `lib/coaching/weeklyActualLoad.ts`, replacing **five** hand-rolled sums |

🔴 **INTRODUCES behaviour; does not restore it** — §68 Am.1's precedent, by name.

### ↗️ Filed, not chased

`RUN-ANALYSIS-ORPHAN-01` (88 of 145 `run_analysis` rows reference an activity id absent
from the log) · `ACTIVITY-DUPLICATE-01` (the ingest-side duplicate) · clause 3's re-measure.

---

## ZONES-BEGINNER-BANDS-01 — 2026-09-28 — **CORRECT WITH AMENDMENT**

**Routed down by the Design Board** (ZONES-SURFACE-01): what does a beginner see where
their marathon and HM pace bands would be?

🔴 **THE PREMISE WAS CONFLATED, AND THAT IS THE FINDING.** §24b is the ONLY section
naming `marathonPaceStr` / `hmPaceStr`, and it governs long-run **segments** on
time-targeted **5K/10K** plans. Its enforcement gates selection on those very fields —
**the band is the switch**. The engine then applies the null to every beginner regardless
of distance, so **a beginner training for a MARATHON has no marathon pace band**,
justified by a 5K/10K long-run rule. No principle governs the band itself.

**Ruled:** four bands, and **silence** where the other two would be. Do not un-null the
fields (Willy: un-nulling starts prescribing §24b segments to beginners — a load change
arriving through a UI ticket). ⚠️ **McMillan dissented and it is preserved**: a projected
race pace may be built, but on its own surface, with its own framing, returning here
first. ⚠️ **Sims' §13 caveat recorded, not resolved.**

**Artifacts:** §24b Amendment · numeric **none, structural** · invariant **not mechanically
checkable in `validatePlan()`** — it is a display rule and the validator sees plans, not
screens.

---

## `MKT-PLAN-SEGMENT-BASIS-01` — 2026-09-30 — is §25's `race_pace_pct` distance or time?

**CORRECT WITH AMENDMENT — the basis is TIME.** §25 Amendment 2.

Amendment 1 settled the *referent* (of the long run, not of the main set) and left the *unit*
as prose. Two readings shipped side by side: `ruleEngine.ts:4949` as a fraction of **distance**,
`sessionComposer.ts:162` as a fraction of **time**. On a 30 km marathon long run (easy 6:00,
MP 5:00, 40%) that is 12 km / 60 min against 13.3 km / 67 min — **a ~10% difference in the dose
of goal-pace running on tired legs**, while the session totals differ by ~1 minute, which is why
nothing visibly broke.

🔴 **THE CONFLICT SCAN FOUND THE THING THAT NEARLY MADE THIS A RE-PROPOSAL.** §16's 2026-09-14
amendment records that *"§16's '20% of session time' against the code's 20% of the MAIN SET was
examined and **deliberately left alone** … Recorded so it is not re-found as a defect."* That
reasoning transfers — but its dispute had **minutes on both sides**. Nothing in the §16/§25
lineage has ever been distance-based; the distance reading was introduced by the segment-duration
fix. So this is a module deviating from a time lineage, **not** a re-litigation of settled ground.

**Ruled on this constitution, not on preference:** §16 (the overridden default) says "of session
**time**" · §9/§24's `LONG_RUN_CAP_MINUTES` bounds the quantity the percentage is taken from ·
**Willy's own guard in Amendment 1 is stated in minutes**. Seiler: a distance fraction makes the
dose vary with the runner's speed for no physiological reason. Sims: minutes are the more
equitable encoding, since a distance fraction hands slower runners *more* time at goal pace for
the same nominal percentage. McMillan: time, and the display defect matters more.

⚠️ **Willy's absolute-ceiling preference is NOT discharged** — carried forward from Amendment 1,
needs a measured distribution of peak-long-run goal-pace minutes to become a proposal.

⚠️ **Seiler recorded that this cannot move §1**: intensity distribution counts **sessions**,
plan-wide (CD-19), and never reads `duration_mins`. Any §1 gate here would be the stale-lens class
his own seat note warns about.

**Split deliberately.** The display defect shipped — `withDistances` priced **every** part at the
session average, so a 67-minute segment at 5:00/km rendered **11.96 km against 13.40 km**, ~11%
out on the peak block's key segment and a live ADR-015 breach. `ruleEngine.ts`'s alignment was
deferred to `MKT-PLAN-SEGMENT-ENGINE-BASIS-01`, gated on parity / cohort:shape / measure:fitness.
Bounded: the time basis is the weighted **harmonic** mean of paces where distance is the
**arithmetic**, so by Cauchy–Schwarz it is never larger and no minutes ceiling can be newly
breached.

**Artifacts:** §25 Amendment 2 · numeric **none — `race_pace_pct` remains the single owner and
`LR_RACE_SEGMENT_PCT_MIN/MAX` are unchanged; stated because inventing a constant to look complete
is the decorative-config class** · invariant **not mechanically checkable in `validatePlan()`** —
the composed structure is display-only (`types/plan.ts` carries `derived_set`, never
`race_pace_segment`), so the stamped `distance_km` never enters a plan and no `Plan => Violation[]`
can reach it. The check is `lib/plan/racePaceSegmentDistance.test.ts` (7), falsified twice: revert
to the uniform rate → 2 red; price the segment but skip the body rebalance → a different 2 red.

**Owner created:** `lib/plan/paceParse.ts` — `parsePaceMidpoint` was private to `invariants.ts`
with **14 call sites**; `sessionComposer.ts` became its second consumer, so it was extracted
**before** the copy existed rather than after, unlike TIER-OWNER-01, DELOAD-OWNER-01,
SESSION-KM-01/02 and OPS-AI-OWNER-01.

---

## ⚖️ CD-1 — the prescription half (Coaching Board, 2026-10-02)

**Routed down by the Design Board the same day.** Question: should the engine prescribe genuinely
different intensities for `Continuous tempo` and `Cruise intervals` (CD-1 options b/c)?

**Ruling: INCORRECT — a veto on (b) and (c).**

🔴 **§19 ANSWERS IT AND CD-1 NEVER CITED IT.** *"If it is named 'Threshold' / 'Tempo' / 'Cruise' the
prescription MUST land in Z3 at T-pace (83–88% vVO2max)."* **The constitution explicitly groups those
three names into one prescription band**, so CD-1's complaint — *"the names change; the effort does
not"* — is describing §19 **working as designed**. Options (b)/(c) would breach it.

🔴 **AND THE 5-INTO-1 PREMISE IS FALSIFIED.** Measured against ADR-019 structured targets: **three
distinct anchors plus a progression** (`T`, `T`, `HM`, `E→Z2-Z3→T`, `goal`), not one pace. §120 made
`HM` and `goal` genuinely different from `T`. 🎪 Collins withdrew his framing on the record.

**The residue was 2-into-1, and those two differ on four axes:**

| | `tempo_continuous` | `tempo_cruise` |
|---|---|---|
| scaling | `fixed`, one sustained block | `reps`, 10′ work / 2′ jog |
| fitness floor | **beginner** | **intermediate** |
| phases | build, peak, **taper** (§36) | **build only** |
| intent | *"builds the ceiling"* | *"rep three is the test, not rep one"* |

🎯 **McMillan — collapsing them re-creates a measured defect.** A **beginner's** marathon build
threshold pool is **2** rows; `Cruise intervals` is intermediate+, so **a beginner never sees both**
and the complaint cannot reach them. `tempo_continuous` was lowered to beginner by
`CB-BEGINNER-CATALOGUE-01` **because** a beginner marathon plan received `progressive_tempo` **ten
times**. Merge the pair and the pool goes **2 → 1** — `CAT-DEPTH-01`'s symptom returning for the
cohort the founder ranks first.

📊 **Seiler** — the recovery is what buys the extra volume; both sit in the same
`THRESHOLD_WORK_TARGET_MINS` 15–30 band, and **neither shape can move §1 because CD-19 counts
sessions**. 🩹 **Willy** and ⚕️ **Sims** — no objection from either seat, said rather than manufactured.

⚡ **No recorded disagreements.** All five seats reached the same answer from different directions,
which is unusual enough here to be worth noting rather than smoothing over.

**Artifacts:** principle → **§19 amendment** · numeric → **none, and that is the ruling** —
`THRESHOLD_WORK_TARGET_MINS` already bounds both, and inventing a constant to look complete is the
decorative-config class · invariant → **none required**; §19 is already enforced by the
label-integrity check and **no new behaviour was authorised, so there is nothing new to check**.
`measure:fitness` deliberately **not run**: nothing here changes what the engine prescribes.

⚠️ **What this does not settle:** whether T-pace should itself differ between continuous and
intervallic delivery. That would amend **§19**, not the catalogue, and nobody has brought evidence
for it.

---

## ⚖️ LEDGER-FATIGUE-HONESTY-01 — the ledger punished the report §112 rewards (2026-10-02)

**Routed down by the SLT the same day.** Question: should an honest `Heavy`/`Wrecked` tag break a
discipline week?

**Ruling: CORRECT WITH AMENDMENT — a high-fatigue tag breaks the week only on a NON-QUALITY day.**

🔴 **THE CONFLICT IS WITH §112, AND ITS TITLE STATES IT:** *"Consecutive self-reported cost
**softens** the long run."* The engine **rewards** the report at `FATIGUE_ACCUMULATION_THRESHOLD`
(**3** consecutive sessions); the ledger **punished** it on the **first**. A runner had to report
fatigue three times to get help and lost the ledger immediately — **the ledger made §112 measurably
harder to reach.** Two mechanisms, opposite incentives, one signal.

📊 **Seiler — one rule was answering two questions.** Being wrecked after a prescribed threshold
session is **the session working**; being wrecked after an easy day is the grey zone, which is the
product's entire thesis. ⚠️ **The residual overlap on easy days is intended.**

🩹 **Willy:** for the no-HR runner the tag is the earliest warning and often the only one —
`limiter.ts` §7 calls it the *"lowest-confidence fallback for manual loggers"*, and HR is present on
**27.3%** of runs. 🎯 **McMillan:** *"a runner who stops logging is worse than one who skips — a skip
I can see; silence I cannot."* ⚕️ **Sims:** attaching a cost to saying *"I was wrecked"* builds the
reporting bias that keeps low energy availability invisible; ADR-011 means we cannot measure it,
**which is a reason to remove the disincentive rather than wait for proof of harm.**

📐 **Measured in production, read-only:** 283 completions, 73 tagged (Fine 43 · Heavy 19 · Fresh 8 ·
Wrecked 3); **15 of 63 (user, week) pairs breakable by a tag alone.** ⚠️ **All 22 Heavy/Wrecked rows
come from ONE user** — a statement about the mechanism, **not** a population rate.

⚠️ **The ledger also hardcoded `'Heavy' || 'Wrecked'` twice** while `FATIGUE_HIGH_TAGS =
['Heavy','Wrecked','Cooked']` has four other consumers, so **`Cooked` was high fatigue to the engine
and invisible to the ledger.** Latent (0 rows) and the duplicate-owner class regardless.

⚡ **No disagreements on the amendment.** McMillan's §112 dissent stands unchanged and un-taken; it
is recorded beside this because the two concerns bracket the same signal from opposite sides.

**Artifacts:** principle → **§112 Amendment 1** · constant → **no new numeric**; reuses
`FATIGUE_HIGH_TAGS`, removing a duplicate rather than adding a value · invariant → **not checkable
in `validatePlan()`**, because the ledger is computed lazily on view and never enters a `Plan` (the
§25 Amendment 2 precedent). `disciplineLedger.test.ts`, **falsified three ways**. `measure:fitness`
not run: no prescription changes.

🔻 **Flagged back to the SLT:** a one-way data change. `weeksWithinLines` has no stored value, so
this retroactively changes every existing user's count, in the direction of more weeks surviving —
under a `LEDGER-RESET-01` decision that board deliberately parked.


---

## Sitting — backlog clearance, 2026-10-05

Record: `docs/decisions/2026-10-05-coaching-board-backlog-clearance.md`.
Convened on founder instruction to take **every open backlog item carrying a 🏃 COACHING BOARD tag**
in one pass. **Eleven items; nine rulings; zero lines of code.**

### 📐 EVERY NUMBER RE-DERIVED. FOUR ITEMS OVERSTATE THEIR OWN DEFECT, ALL IN THE SAME DIRECTION.

Measured on `cohortGrid()` — **41,472 inputs → 39,632 plans → 96,460 deload weeks**. ⚠️ The grid is
**41,472** today where `CLAUDE.md` says 31,104; the file is the source, as that line warns.

| Item claimed | Re-derived | Gap |
|---|---|---|
| `DELOAD-BADGE-TRUTH-01` **9.6%** of recovery weeks ≥ prior | **5.6%** | ~1.7× over |
| same, **18.9%** of plans | **9.8%** | ~1.9× over |
| `DELOAD-LR-GROWS-01` long run explains **100%** | **45.3%**; **50.2% the long run did not grow at all** | not unanimous |
| `WEEK12-LR-CAP-CLIFF-01` *"the 5K plan steps +44%"* | **0.3%** of 5K plans step ≥+25%; median **0.0%** | **32 plans of 10,368** |

**Two of the four quote a 45,776-plan corpus that no committed harness runs**, so the figures were
never comparable. 🏃 Hutchinson: *"an item that quotes a corpus nobody runs is unfalsifiable — it
reads as rigour and cannot be checked, and doubling always in the direction of urgency is how a
backlog acquires a fake P1."*

🔴 **THE REAL FINDING IS IN NO ITEM — THE DEFECT IS RACE-DISTANCE-GATED, 13× ACROSS THE RANGE:**
**5K 15.3% · 10K 7.0% · HM 1.8% · marathon 1.2%.** On a short-race plan the long run sits close to
the easy runs, so the 4 km floor plus the §52-protected long run **already exceed 70% of the prior
week and the deload target is unreachable by construction.** `WEEK12-LR-CAP-CLIFF-01` found the same
wall from the other side and filed it separately. Split: **strictly bigger 3,604 (3.7%) · exactly
equal 1,792 (1.9%)**; overshoot median **0.5 km**, max **4.27 km**.

| Item | Ruling |
|---|---|
| **`DELOAD-BADGE-TRUTH-01` + `DELOAD-LR-GROWS-01` + `WEEK12-LR-CAP-CLIFF-01`** | 🟢 **CORRECT WITH AMENDMENT — they MERGE, and there are TWO fixes, not one.** **(a)** where a reduction is possible (3,604 weeks) fix the arithmetic; **(b)** where the floors forbid one (1,792 weeks) **fix the BADGE, not the volume (§34)** — ⛔ do not shrink the long run to fit, that is §81's standing veto which already traded 1,615 violations for 979; **(c)** the week-1-2 long-run cap **RAMPS**, it does not lift. ⛔ **`DELOAD-LR-GROWS-01`'s 100% attribution is NOT ratified** (Sims): half the defect has an unidentified cause. ⚠️ The cap item's mechanism is **corrected on the record** — the long run is FLAT across the step (6 → 7 → 7); the cap lifting is the trigger, the **easy-run floors** are the mechanism. **This is the "separate future ruling on healthy deload-week placement" that blocked promoting `INV-PLAN-DELOAD-IS-A-REDUCTION` to `error` — now unblocked for (a)'s population only.** |
| **`DELOAD-PLAN-OPENING-01`** | 🟢 **CORRECT — and a PREREQUISITE of the above, not a sibling.** §119's producer needs a **search** over placements, not the greedy choice. ⚠️ **Sequencing amendment: it lands FIRST**, because moving where deloads fall changes which transitions invert. Hutchinson's 2026-09-21 reasoning re-affirmed: *"nobody is looking yet" is a schedule, not a credibility answer.* |
| **`LR-2DAY-LOPSIDED-01`** | 🟢 **CORRECT AS IS — the product is right and must SAY so (§34).** 77% of the week in one run, 72.9% of 2-day plans, **all maintenance — §52's remedy already spent.** Binding via **§1 CD-21 Amendment 1**: at two runs a week the distribution is **undefined, not violated**, and **no remedy may assume a third session**. McMillan: *"two runs a week and one is the long run — that is what two runs a week IS."* No prescription change. |
| **`STRIDES-2DAY-SILENT-GAP-01`** | 🟢 **CORRECT AS IS — §34 honesty gap, structurally unsatisfiable.** 74.2% of 2-day plans have no eligible carrier; `sat+sun` fires **27 of 27**. Willy: *"the cost of putting them on a day the runner has not got is a session they skip."* One honest sentence. ⛔ **Do not satisfy the invariant by relaxing carrier eligibility** — that puts strides on a long run or a rest day. |
| **`MATCH-LIST-WINDOW-01`** | 🔴 **NOT THIS BOARD'S — EXEMPT, defect fix restoring documented intent. RE-TAG ⚙️ NO BOARD.** The item asks the board to pick a window; **the window is already ratified in code**: `sessionMatch.ts → findMatchCandidates` filters **±2 days** and scores **distance-aware** at 0.75–1.40 (0.85–1.15 duration), behind `MIN_AUTO_LINK_CONFIDENCE = 'high'`. **The founder's own capture fails that owner on BOTH axes** — 5 days (>2) and 14/8 = 1.75 (>1.40) — so the picker is not applying a looser window, **it applies NO window, because `stravaRuns.slice(0, 20)` never calls the owner.** Hutchinson: *"a board asked to rule on something already ruled will invent a second answer, and then there are two windows."* |
| **`DELIVERED-RAMP-REAL-DRIVER-01`** | ⚠️ **INSUFFICIENT EVIDENCE — and the item already knows it.** The largest unexplained warn in the product (27.2% plan-wide, 42.2% of HMs); **276 of 280 non-long-run-led firings have no V1 trim** on the preceding week. **What would settle it:** an attribution pass over the 276 in the same shape as this sitting's deload attribution — which found the obvious mechanism explained **45.3%, not 100%**. ⚠️ §100 and §94 Am. 2 are **already falsified in the item; do not re-derive either.** Hutchinson: *"a warn that names its own cause stops anyone checking the cause."* |
| **`MKT-PLAN-SEGMENT-ENGINE-BASIS-01`** | ✅ **ALREADY RULED (§25 Amendment 2) — no new sitting. ⚙️ NO BOARD.** The basis is settled as the long run's **duration**; `ruleEngine.ts:4949` still reads **distance**. A defect fix — **but it changes prescription**, so full regression: `verify:parity` + `cohort:shape` + `measure:fitness` before/after, any move declared as a number. Stays unbundled from the display fix (SLC), as already decided. |
| **`LOG-OFFPLAN-03`** | ⏸️ **CORRECT, RE-AFFIRMED, STILL BLOCKED ON EVIDENCE.** Willy: *"a 5% cap applied to a number that is not their load — the cap is not conservative, it is decorative."* Blocker unchanged: **n=21, 12 of them the founder**, and the two worst-discipline off-plan runs are not his. Hutchinson: *"a threshold set on twenty-one runs twelve of which are one person is not a threshold, it is a preference with a decimal point."* ⚠️ **Blocked 8 days; nothing schedules the re-measurement, and subscribers today are ZERO so the sample cannot grow yet.** |
| **`EMAIL-WAVE-4-PATTERN-01`** | 🔴 **CANNOT SHIP — blocked on POPULATION, and the population is one demo account.** Needs ≥3 analysed runs **with HR**: `zonna.demo@demo.com` has 72/72; **the one real user with 3 analyses has 0 with HR.** Sims: *"ADR-011's hard consequence arriving in the marketing layer — Apple controls what Strava writes."* **The bounded pattern set is NOT authored today**, because authoring it against one account fits the patterns to one person — the same error as `LOG-OFFPLAN-03`'s n=21. The 🧭 Design Board half does not convene either: there is nothing to lay out. |
| **`DELIVERED-RAMP-REAL-DRIVER-01`** | ⚖️ **2026-10-05 — INCORRECT as framed (VETO on the exemption), CORRECT WITH AMENDMENT on attribution → §94 Amendment 3.** Asked to EXEMPT the 18.8% of `INV-PLAN-DELIVERED-RAMP` firings where the week gains a session (*"3 runs to 4 is a structural change, not a volume spike"*). **Refused on two grounds and a measurement:** §2 Am. 2 carries Hutchinson's binding freeze on relaxing this predicate without adherence or injury data, and this was a corpus measurement; §94 Am. 1 had already REMOVED an exemption arm from this same check for falling silent exactly when the long run drove the spike (202 weeks, 202 of 202 with the long run growing); and the premise fails — over 1,988 gained-session firings mean km **per session** ALSO rose in **65.0%**, >10% in **24.5%** (worst +33.3%), held or fell in only **35.0%**. **The exemption would have silenced 1,293 compound-progression weeks to quieten 695 benign ones.** Willy, McMillan and Sims independently reached *attribute, do not exempt*; no seat dissented. **GRANTED:** a fourth attribution branch naming FREQUENCY where run count rose and per-session mean did not rise at all — `DELIVERED_RAMP_FREQUENCY_PER_SESSION_MAX_RISE_PCT` = **0**, zero deliberately, since any tolerance starts eating the compound cases. Same severity, nothing exempted, no prescription change (all six `review:coaching` arms identical, envelope 95.9%). **Q1 WITHDRAWN BY MEASUREMENT:** `DELIVERED_RAMP_LR_ATTRIBUTION_PCT` (50) is not too high — the LR-largest-but-under-threshold set is **8.2% of non-led firings, not the 34% filed**, and 32.3% are already reported long-run-led; the move is unattributed (3,000-plan sample vs full grid) and both figures stand. Artifacts: §94 Am. 3 · the numeric · `rampFrequencyAttribution.test.ts` (falsified both directions) + the pre-existing `deliveredRampDriver` exhaustive-branch gate, which went RED on the way in. Repeatable: `npm run measure:ramp-attribution`. |
| **`DELOAD-PLAN-OPENING-01`** (sitting 2) | ⚖️ **2026-10-05 — INCORRECT (VETO) on a 3-week masters loading block; CORRECT separately that §119 gains §95's masters carve-out under D-21.** Asked whether a masters loading block may run 3 weeks where that is the only way to reach a §119-compliant opening block. **Refused as a RE-AFFIRMATION:** §95 already recorded this cohort's constraint set as unsatisfiable (1,944 of 3,726 masters plans, 52.2%, against 0 of 3,726 standard) and ⚕️ Sims had **named and refused the longer loading block there** — *"masters are the population with the slowest bone and connective recovery, and the alternatives both take real recovery away from exactly them."* A corpus count is not the outcome evidence that reopens it. 🏃 Hutchinson ruled his own §2 Am. 2 freeze **does not reach this** (scoped to §2's ramp predicate, not §87's placement). ⚠️ **I nearly mis-cited the precedent in favour of closing the question: §95's 52.2% and my 52.1% matched to a decimal but are DIFFERENT DENOMINATORS** (masters plans vs HM plans) — §119's defect is masters 28.0% / standard 23.6%, present in both, so the precedent governs the RESIDUAL, not the original defect. **The residual is ONE CELL: masters x HM at 99.1% (5,136/5,184), 82% of the whole residual**; the search's entire gain was the marathon (49.9% → 3.4%). 🎯 McMillan: *"for a masters HM runner it is what the plan ALWAYS does"*, and *"recorded rather than worked around has to mean recorded TO THE RUNNER"* — binding. 🔴 **The item's acceptance criterion is overturned:** *"the warn rate must go to ~0"* is unachievable and now ratified as such; restated as **~0 outside the declared masters set.** Artifacts (§119 Am. 1 + honesty flag + invariant reading it) **do NOT land yet** — they need the search, which cannot ship alone because it breaks three published plans' deload depth. Record: `docs/decisions/2026-10-05-deload-placement-search.md`. |
| **`RACE-ANCHOR-CV-OVERRIDE-01`** (sitting 3) | ⚖️ **2026-10-06 — the settling artefact taken; the deadlock belongs to the CATALOGUE.** `race_specific` rows eligible in BUILD: **exactly one**, `beginner_goal_pace_blocks` (beginner-only, HM/MARATHON only), so **ZERO for an intermediate-or-above runner in build and zero at 5K/10K in build at any fitness.** Neither §22 nor §85 is wrong; there is no row for them to disagree about. §22's own text predicted it — *"it is where the catalogue stopped"* — CD-18 fixed OWNERSHIP and the row it produced is peak/taper. **RULINGS:** widening `beginner_goal_pace_blocks` **INCORRECT (veto)** — a beginner's first exposure is not an experienced runner's dose; a new build-eligible goal-paced row **INSUFFICIENT EVIDENCE**, deferred with its own gate (`measure:fitness` before/after, refusal count, selection MEASURED not inferred); a **FIFTH exemption CORRECT** (CV-anchored row exempt from §22's override AND the per-week check, structural D-17), with `INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` as the **binding condition**. 🟠 **BUILT: `INV-PLAN-HEADER-PACE-MATCHES-WORK` 3,232 → 0, every other invariant byte-identical — then the BINDING CONDITION FAILED** on `earlyQualityOnset.test.ts`'s `HM @ 4 days, time_target` (§89 early-onset) at **40% (2/5) against ≥50%**, error severity. **Void by the board's own words; reverted.** 🥇 **The catalogue row is the exemption's PREREQUISITE, not its alternative** — the §89 cell fails because the plan genuinely has 2 of 5 goal-paced sessions and the catalogue had nothing to give it in build. ⚠️ **Two of my claims were wrong:** the *"164 `hm_pace_intervals`"* was a label-substring attribution artefact (there is no second defect), and *"the ratio was satisfied fraudulently"* is **false at population scale — 0 of 18,960 time-target plans depend on CV being counted.** Record: `docs/decisions/2026-10-06-cv-override-settled.md`. |
| **`RACE-ANCHOR-CV-OVERRIDE-01`** (sitting 4) / **`BUILD-SPECIFICITY-ZERO-01`** | ⚖️ **2026-10-06 — option (a) INCORRECT (VETO); the MEASUREMENT found a larger defect and it is CORRECT.** The deferred gate was discharged with a throwaway prototype row (reverted): **selected 7,644 times, ZERO in BUILD, 7,644 in PEAK**, refusals **1,840 unchanged**, `measure:fitness` masters neverBuilds 18.6% → 18.5% and every other cohort byte-identical. **Inert by construction:** `buildRotationCategories` filters `quality_categories_focus` through `MIDWEEK_QUALITY_LADDER` = `['aerobic','threshold','vo2max']`, so **no build quality slot at any distance ever prefers `race_specific`** (HM/MARATHON focus is reduced to `['threshold']`; 5K/10K never mention it), and the selector's fallback cannot fire because threshold rows are eligible throughout build. 🏃 Hutchinson: *"a change to peak dressed as a fix for build"*; the 0.1pp masters gain is **noise offered as a benefit.** 🔴 **THE REAL FINDING: §5's `SPECIFICITY_BY_PHASE` declares build 30% specific and build delivers 0.0% — 0 of 118,764 quality sessions** (peak 60% declared vs **17.3%**, taper 70% vs **33.8%**). **And `.build.specific_pct` is DECORATIVE CONFIG:** the constant's only consumer is `invariants.ts:2709`, which reads `.peak.specific_pct` alone, and `configConsumer.test.ts` passes it on the NAME while its own header cites this very constant as a prior example of the class. **So "should build carry race-pace work" was answered by ratified doctrine before it was asked — it is a DELIVERY FAILURE, not a new principle.** ⚖️ **INSUFFICIENT EVIDENCE on the MECHANISM only:** gate is `MIDWEEK_QUALITY_LADDER` admitting `race_specific`, costed on `measure:fitness` before/after + refusal count + `cohort:shape` + `parity` + the §89 early-onset cell, with an assertion that it **SUBSTITUTES** a quality session rather than adding one (Sims), and **5K/10K costed separately** because at 5K goal pace is near vVO2max and SC-05 already excludes 5K from §22's ownership arm (Willy). 📊 Seiler: *"a ladder that cannot express a category is not a ladder with a gap, it is a different ladder than the one documented."* Sequencing disagreement recorded (Seiler would move on doctrine alone; McMillan and Willy require numbers), resolved by the chair as **doctrine establishes the obligation, measurement sets the shape.** Artifacts authorised: §5 Amendment + no new numeric + `INV-PLAN-BUILD-SPECIFICITY` at **`warn` first**. Record: `docs/decisions/2026-10-06-build-specificity-finding.md`. |
| **`BUILD-SPECIFICITY-ZERO-01`** (sitting 5) | ⚖️ **2026-10-06 — THE MECHANISM IS INCORRECT (VETO, reverted); the NUMBER is the defect.** The sitting-4 gate was discharged and it changed which lever is correct, then refused that one too. 🔴 **The ladder was the wrong lever and the code says so in words** — `MIDWEEK_QUALITY_LADDER` excludes `race_specific` DELIBERATELY (*"long-run-slot work, not a midweek single-day session"*), and a prototype midweek row was **selected 7,644 times, ZERO in build**. The real lever was `useRaceSpecificLR = phase === 'peak'`; widening it to `peak || build` delivered **build 0.0% → 23.7%** (HM 37.6%, marathon 33.3%, 5K/10K untouched by construction) with **every harness green** (`measure:fitness` byte-identical, refusals 1,840, `cohort:shape` exit 0, `review:coaching` 95.9%, parity 536/5,832). 🔴 **REFUSED ANYWAY, because the harnesses are green for STRUCTURAL reasons:** it adds a median **24.5 km** of race-pace running per plan (45.2% of build weeks, 16.6% of build long-run km) at the most fatigued point of the week's largest session — **§1 counts sessions and the long run stays `easy`; `measure:fitness` counts distance and none changed.** 🎯 McMillan: *"not sharpening — it is racing your training."* 🩹 Willy: *"I ruled on a substitution that lowers intensity; this ADDS intensity to the week's largest tissue exposure."* 🔍 **The scan settles it: BOTH channels are closed by EXPLICIT DESIGN in two different files** — the ladder's exclusion, and **§25 reserving the race-pace long run for PEAK** in its principle and Config on a phase-specific rationale. 🏃 Hutchinson: *"when a declared number has no designed channel, the likeliest error is the number, not the delivery."* **RULED: `.build.specific_pct` is an UNDEFENDED NUMBER, not an unmet obligation** — §5 Amendment rewritten, constant flagged **declarative** at source, and **`INV-PLAN-BUILD-SPECIFICITY` WITHDRAWN** (a check firing on every plan to enforce a doubted value trains people to ignore it; *not mechanically checkable because the value is unsettled*). ⚠️ **Two seats corrected their own prior reasoning from the measurement:** Seiler had treated the ladder's deliberate exclusion as an oversight; Sims's session-count substitution test could not see intensity moving INSIDE a session. 🔻 Future sitting needs a **DOSE** decision. Ultras are the same shape, also 0.0%, untouched. Record: `docs/decisions/2026-10-06-build-specificity-finding.md`. |
| **`BUILD-SPECIFICITY-ZERO-01`** (dose sitting) | ⚖️ **2026-10-06 — CORRECT WITH AMENDMENT: dose 1, the final non-deload build week (§25 Amendment 2). SHIPPED.** 🏃 Hutchinson reframed it away from §5's config entry, as sitting 5 required: *"today a time-targeted marathon plan contains exactly ONE marathon-pace long run in the entire block, in 100% of cases. One is the anomaly here, not the proposal."* 🎯 McMillan: the final build week abuts peak, so one session there gives **two race-pace long runs a fortnight apart** going into sharpening. **Dose 2 and 3 REFUSED by all five seats** — dose 2 puts **56.5%** of plans on **three consecutive** race-pace long runs for **1.4pp** over dose 3; 🩹 Willy's hard limit: *"race pace on tired legs needs a week either side."* Costed: dose 1 → build specificity **0.0% → 5.5%**, median **+6.1 km** (max +12.2), **never 3 consecutive**; dose 2 → 11.4%, +10.8 km; dose 3 → 12.8%, +12.3 km. **Fraction NOT in scope** — §25 Am. 1 already owns it (`race_pace_pct`, HM 35 / MARATHON 40, band 25–40%), and a per-phase fraction would be a second owner for a number that has one. ✅ **Willy's blocking injury condition discharged on a CONSTRUCTED 16-row cell, after my first attempt was vacuous** — `cohortGrid()` has **0 of 8,592** time-target HM/marathon plans with an injury history and I reported *"identical rate"* with one side empty; on the real cell every injury variant gets the **same build dose as its healthy twin** and injury only ever REDUCES it. ✅ **§12's Z2 ceiling STATED for build**, not inherited (second blocking condition). Artifacts: §25 Am. 2 · `RACE_PACE_LR_BUILD_WEEKS: 1` (named, not a literal, by board instruction) · `INV-PLAN-RACE-PACE-LR-BUILD-WINDOW` (`warn`, two arms, falsified by forging a third consecutive week). Regression: verify exit 0 / 4,337 tests · measure:fitness byte-identical · cohort:shape exit 0 · review:coaching 95.9% · parity 536/5,832 declared. 🔻 **UNRULED and the number argues against its own case: the DISTANCE SPLIT** — dose 1 delivers **HM 12.8% but marathon only 5.1%** (longer build phase), so the cohort Hutchinson's argument favours most gets the least. 🔻 §5's 30 stays declarative; no dose reaches it. ⚕️ Sims standing condition: no further increase without a fuelling surface. |
| **`BUILD-SPECIFICITY-ZERO-01`** (distance-split sitting) | ⚖️ **2026-10-06 — NO DISTANCE SPLIT (refused); the WINDOW is corrected instead. SHIPPED.** Convened on the observation that dose 1 delivered **HM 12.8% but marathon 5.1%**. 🥇 **THE SHARE WAS THE WRONG MEASURE AND THE ABSOLUTE COUNT INVERTED THE QUESTION:** race-pace long runs per time-target plan were **HM 3.00 vs marathon 1.55** — the marathon getting HALF, on a LONGER plan (18.0 vs 16.0 wks) with MORE build weeks (4.6 vs 4.1). 🔴 **CAUSE: the final build week IS a deload in 50.7% of marathon plans (1,728 of 3,408) against 0.2% of HM (12 of 5,184)**, so `!isDeload` silently skipped the session for half of all marathon runners. 🏃 **The chair's own hypothesis was refuted:** he had argued marathon needed MORE than HM; it was not receiving what it had already been granted. 🎯 McMillan: *"no coach would accept 'the deload ate it' as the reason."* **RULED: no distance-specific constant.** The window becomes the **LAST NON-DELOAD build week**, walked back from build's end. Marathon **1.55 → 2.06**, HM **unchanged at 3.00**, and 📊 Seiler noted the consecutive-week distribution is **byte-identical** before and after — structurally, since the week before a deload is followed by a deload and cannot chain into peak, so the fix is **free in 🩹 Willy's dimension**. ✅ **§25's peak floor verified NOT breached** — 0 plans with zero peak race-pace long runs, invariant fires 0. Artifacts: §25 Am. 2 corrected in place · **no new numeric** (`RACE_PACE_LR_BUILD_WEEKS` stays 1, now a count of SESSIONS not calendar weeks) · `INV-PLAN-RACE-PACE-LR-BUILD-WINDOW` window arm corrected, never-three arm unchanged per Willy. Regression: verify exit 0 / 4,338 tests · measure:fitness IDENTICAL · cohort:shape exit 0 · review:coaching 95.9%. ⚠️ **`verify:parity` came back exit 0 / IDENTICAL and that is NOT evidence of no change** — this moves 1,728 cohort-grid marathon plans, so parity's pinned-`plan_start` grid simply does not contain the case. 🔻 **Residual HM/marathon gap (3.00 vs 2.06) is peak LENGTH (3.06 vs 2.10 non-deload peak weeks) — §93's question, NOT ruled here.** |
| **`PEAK-LENGTH-SITTING`** / **`VARIETY-ELIGIBILITY-01`** | ⚖️ **2026-10-06 — the PEAK-LENGTH PREMISE IS WITHDRAWN AS MIS-ATTRIBUTED; a LIVE false-positive check was found instead. CORRECT (defect fix), SHIPPED.** ⚠️ **I filed this as §93's question and §93 governs peak CONTENT, not LENGTH.** Peak length belongs to `MAX_TAPER_PHASE_WEEKS` (**HM 3, MARATHON 4**): the marathon's taper is a week longer, which is standard practice, so its shorter peak (2.10 vs 3.06 non-deload weeks) is a **ratified consequence, not a defect**, and §93 is satisfied via the race-pace long run (CB-SPEC-02's canonical vehicle). **Nothing to fix there.** 🥇 **THE REAL ASYMMETRY IS ONE LINE:** peak quality preference is 5K→vo2max, 10K→vo2max then race_specific, **HM→race_specific, MARATHON falls through to threshold** — and the line's own comment names only `hm_pace_intervals`. Total race-specific exposure per time-target plan: **HM 6.00 vs marathon 3.19** on an 18-week plan against 16. 🔴 **AND THE REAL FIND WAS A CHECK LYING 3,456 TIMES, LIVE:** `INV-PLAN-RACE-SPECIFIC-VARIETY`'s alternatives filter checked category, distance, phase and shape and **NO FITNESS GATE**, so every firing (all HM: 1,728 beginner · 864 intermediate · 864 experienced) named a session the runner cannot be prescribed — a beginner told to use `hm_pace_intervals` (`min: intermediate`). **Verbatim the error recorded against `RACE-ANCHOR-CV-OVERRIDE-01`'s reverted attempt, sitting inside a check.** 🎯 McMillan: *"a warning that names an impossible remedy is worse than silence."* **Fixed: 3,456 → 0**, no prescription change. ⚠️ **WAKEABILITY ASSERTED because the fix could have silently killed it** — HM and MARATHON have exactly ONE eligible race-specific peak quality row per band so it cannot fire for them (the firings were false BY CONSTRUCTION); it stays wakeable for 10K intermediate/experienced, proven by forging a single-row repeat. ⚖️ **INSUFFICIENT EVIDENCE on the marathon rotation line, BLOCKED behind this fix:** closing it raises marathon exposure 3.19 → 5.15 and `mp_blocks` 472 → 4,836 but added **3,408** §104 firings, and until the filter was fixed a true variety objection could not be told from a false one. 🏃 Hutchinson: *"you do not extend a rule into a new cohort while its enforcement is lying."* It also needs a dose — four exposures in a 2.1-week peak is McMillan's and Willy's shared objection, and McMillan wants a **second marathon race-specific row** rather than `mp_blocks` repeated. Regression: verify exit 0 / 4,342 tests · review:coaching six arms identical at 95.9% · cohort:shape exit 0 · parity exit 0 (**stated, not quoted as proof — a validator-only change cannot fail parity**). |
| **MARATHON-BEGINNER-FLOOR-01** (§117 Am.5) — a beginner finish-goal marathoner under 25% of race distance on their longest run gets the run-walk PRESCRIPTION, never the peak reduction | **CORRECT 2026-10-06**, 🩹 Willy binding: *no peak may fall, measured per cohort or refused* | **SHIPPED same day, all three artifacts.** Marathon fit-for-purpose **89.5% → 91.8%**, the only distance under the founder's new 90% PER-DISTANCE floor; **peak week moved 0 times across 33,792 cases.** ⚠️ *Moving §117's door was ruled INCORRECT* — the door governs the peak reduction and this cohort's defect is a SHORT long run. The conflict scan found Am.4 had already separated the two, for the mirror cohort, fourteen days earlier. ⚠️ **It surfaced a pre-existing LIVE defect** (`RUNWALK-FOUNDATION-GAP-01`): foundation weeks are prepended after the stamping pass, so 12 of 12 probed old-route cases shipped 3-9 un-intervalled foundation sessions to the charity cohort. ⚠️ **Partial by design** — Am.2's 17 km bound keeps roughly half the cohort scored (15 km/wk LONG-RUN-SHORT 45.6% → 35.3%, not to zero). |
| **`RACE-ANCHOR-CV-OVERRIDE-01`** (5th sitting) | ⚖️ **2026-10-06 — CORRECT, SHIPPED. The fifth exemption plus a §22 amendment, and the blocker was never the exemption.** §85's reasoning extended to a CV-only row: `INV-PLAN-HEADER-PACE-MATCHES-WORK` fired **3,232** times, every one a CV row repainted at goal pace (§19 header-vs-work) — now **0**. 🔴 **WHAT BLOCKED IT FOR FOUR SITTINGS:** §22's ratio demands ≥50% goal-paced non-VO2max quality, and the ratio was only ever satisfied for the affected runners **by §22's own rename** — the defect the exemption removes. ⚠️ **The remedy is ARITHMETIC, not an exemption:** a CV-anchored session leaves the ratio's **DENOMINATOR**, exactly as VO2max already does. Exempting the numerator only produced **143 NEW error-severity violations, every one at 5K** (*"33% (1/3)"*), and the invariant's own comment already explained why 5K — there the ratio was satisfied *because* the rename painted goal pace on everything (*"168 of 168 … at 0% delta"*). 🔴 **A PLAN-LEVEL EXEMPTION WAS BUILT AND REMOVED:** I first exempted any plan carrying `hm_goal_anchor_withheld`, copying the §93 Am.1 pattern ruled hours earlier; with the denominator correct it was **dead** (all 17 affected tests pass without it) and would have switched §22's ratio off for **496 of 5,664 plans**. **I reached for the shape of the last fix instead of reading the numerator and denominator.** ⚠️ **Its falsification was VACUOUS and that is why it survived:** `validatePlan` runs twice on different objects — the internal call sees the BARE plan (ratio 2/5), a post-hoc call the COMPOSED plan (4/5) — so mutate-then-revalidate proves nothing. ⚠️ **Both halves or neither:** override-only left the per-week check at **439** firings, the same fact as the previous attempt's 100 red tests. ✅ Sweep clean on 14,268 plans; fit-for-purpose identical on every distance; parity 196/6,066, **`time_target` only, `finish` 0**. ⚕️ **Sims's condition stands open** — the plan is now honest and still says nothing about why the goal pace never appears (`GOAL-PAST-CV-SILENT-01`). |
| **`DELOAD-PLAN-OPENING-01`** (3rd sitting, artifacts) | ⚖️ **2026-10-06 — SHIPPED as §119 Amendment 1.** The search the board asked for at sitting 2, plus the honesty stamp. `INV-PLAN-MIN-LOADING-BLOCK` **25.8% → 15.8%**, **marathon 50.0% → 3.4%**; both ratified bounds held (count rose 0, fell 0; mean delivered peak 41.54 → 41.53 km). 🔴 **BOTH BLOCKERS DISSOLVED AND THE FIRST WAS A MEASUREMENT ERROR OF MINE:** the `I6`-on-two-published-plans finding was attributed to the search *"by stashing (b)"* with `git stash push` on **already-committed files** — a no-op — so fix (b) never left the tree and the findings were its. With the search alone all nine published plans are clean, and were clean on HEAD. **The same no-op had already cost an hour that day; the second time it produced a false shipping blocker that sat in the backlog.** 🔴 **I also wrote an `I6` floor exemption for those phantom findings, measured it suppressing 292 real ones, and REMOVED it** — a floor is a lower bound, so reaching it explains why a drop stopped, not why it was that large, and it had no mandate. ⚠️ **The §95 test's pinned `[2,6,10]` was itself a §95 BREACH** standing as the proof of §95 compliance (week 2 IS a phase position 2); it asserts the PROPERTY now. ⚠️ **Residual 15.8% is TWO declared infeasible cells with 0 outside them** — masters × HM 735/741 (99.2%) and ADR-021 early-onset `experienced` 159, both a phase shorter than the cadence can accommodate; the second **was not known at sitting 2**. 🎯 McMillan's *"recorded TO THE RUNNER"* → `DELOAD-OPENING-SURFACE-01`, because `planRationaleNotes` caps at 3 notes / 70 words. |
| **`GOAL-PAST-CV-SILENT-01`** | ⚖️ **2026-10-06 — CORRECT WITH AMENDMENT, SHIPPED as §44 Amendment 2. The conflict scan returned a ruling, not a conflict: §44 CD-16 had already decided this class of statement** (*"a target beyond measured fitness is the same class of statement"*) **with its threshold at INTERVAL pace**, while §120 Am. 1 later withheld the race-specific row at **CV**. **Nobody reconciled the two and the gap between them WAS the silence** — so the remedy was moving a threshold, not authoring a rule: no new constant, no new surface. 📊 **Seiler refused the word "correction"** and the chair adopted his framing: CV crosses at 5.4–6.2% of current HM pace against interval's 13.9–14.3%, so this **halves the stretch a stated goal may carry before the band speaks.** A tightening, declared as one. 🔴 **THE ITEM OVERSTATED ITSELF TWICE, BOTH ONE WAY, AND THE SECOND WAS MY REGEX:** of 3,456 withheld plans **864 were already told** and the silent population is **816 (15.7% of HM time-target)**, which corroborates §120 Am. 1's independent *"CV to interval = 15.0%"*; and *"ZERO name the goal pace"* was an artefact — the shipped note says *"quicker than"*, the pattern searched *"faster than"*. **I nearly took that zero to the board as the headline finding.** 🎯 **McMillan binding:** the CV sentence may not be the interval-band copy, which promises race-pace sessions the plan withheld — *"worse than silence"*. ⚕️ **Sims's condition from the 5th sitting is DISCHARGED**, and her reason is why this was the cheapest ruling available: the gap between the plan and the goal the runner is still privately chasing is where low energy availability comes from. 🩹 No injury vector. ⚠️ **Measuring the remedy found `PLAN-NOTE-BUDGET-INERT-01`:** the engine **stamps 3.66 notes per plan and renders 0.95** (three notes on ZERO of 5,664 plans; 10,031 dropped), so a plan-level note could never have reached this runner — using the BAND is why it shipped the same day. ⚠️ `cohortShape` `difficultyComfortablePct` **22.7 → 20.5**, declared. ⚠️ **My falsification failed to go red on 8 of 9 arms** — `generateRulePlan` throws on error severity under test and a bare `catch { continue }` skipped exactly the at-risk plans. |
| **`ANALYSIS-SUPERSEDE-PATTERN-01`** | ⚖️ **2026-10-06 — INSUFFICIENT EVIDENCE on the build, principle RATIFIED as §71 Amendment 1. The filed question was already answered and the premise was wrong; the actionable defect was the COMMENT.** 🔴 *"Is a pattern claim scoped to the plan or the runner?"* is settled by `PLAN-WEEK-COLLISION-01`'s own justification — per-plan readers filter, time-windowed history readers do not. **Third item in two days whose board question dissolved on one read of existing doctrine** (§120 for `HM-PEAK`, §44 CD-16 for `GOAL-PAST-CV`). 🔴 **And supersession is NOT set on plan regeneration** as the item claimed — the owner's contract says race-identity change only. 📊 **Seiler's split, ratified:** a cohort comparison may cross a race boundary for **zone-discipline** fields (the zone was recomputed for whoever the runner was) and **may not** for fitness-denominated ones (`ef_trend_pct`, pace/distance — the denominator changed). 🎯 **McMillan binding:** name the boundary crossed — *"a runner who finishes a half, signs up for a 10K and logs their first run should not be told the app has never seen them run before."* 🩹 **Willy binding:** the discontinuity at every race stays visible, never smoothed. ⚕️ **Sims:** the current behaviour penalises exactly the committed returning athlete, and the multi-season arc is the clinically interesting one for peri/post-menopausal runners. 🔴 **MEASURED DEFECT: `supersede.ts` named four cross-plan readers and TWO DO NOT, with a third mis-classified** — `v_coach_engagement` does; the discipline ledger filters **and is right to** (plan-scoped by design); the reframe cohort (**PAID, always-on**) and the aerobic trend card both filter and should not. A false claim in the justification for a live data-retention decision. ⚠️ **No build ordered:** 148 rows / 76 real / 10 live across **FOUR runners**, and nobody has measured whether ONE has analyses on both sides of a boundary. **Artifact is a SOURCE GATE, not a plan invariant** — these are read paths and `validatePlan` receives a plan: `lib/coaching/analysisSupersedeReaders.test.ts` derives every reader from the tree, 5 arms, 3 go red when the reframe filter is removed. 🥇 **It corrected me on its first run** — two reads I had hand-waved as writes are SELECTs, and tracing them showed adding the filter there would BREAK late-HR refresh. |
| **`SESSION-ACHIEVABLE-01`** | ⚖️ **2026-10-06 — SPLIT. The founder asked whether the sessions we hand people are achievable; the exemption is fine and the obligation beside it was never built.** §81's title carries BOTH clauses (*"exempt from the weekday cap — AND the plan says when they don't fit"*). 🔴 **MEASURED, 499 capped plans: 246 (49.3%) carry a structured weekday session over the stated cap, 182 (36.5%) past the ratified 50% tolerance, 675 sessions — and EVERY ONE belongs to a runner who stated a 30-MINUTE CAP.** Worst **86 min against that 30 (+187%)**, an `HM-pace intervals` for an experienced HM runner on **20 km/week**. 🔴 **`INV-PLAN-STRUCTURED-OVERRUN-DECLARED` FIRED ZERO TIMES** because it tested `volume_constraint_note`'s PRESENCE — the MAINTENANCE note — and all 182 discharged it, 74 on a note explicitly about volume. **`MWM-FLOOR-VALIDATOR-01` (2026-10-03) named this exact defect three days earlier, ruled it exempt, and it was not done.** ⚙️ **(a) The per-session declaration — NOT BOARD WORK, defect fix, BUILT:** stamped at the `continue` that grants the exemption, rendered in its own block. 1,931/1,931 declared; invariant falsified at 182. 🎯 McMillan: *"They do not conclude the session is ambitious; they conclude the app does not listen"* — and *"I said don't shrink to fit, and I did not mean ignore what they told you."* ⚕️ Sims: a 30-minute cap is the runner with caring responsibilities or a shift pattern. 📊 Seiler, recorded: **`CV intervals` is the most affected session (109)** — the single most time-efficient thing in the catalogue for a time-limited runner, *"so an 86-minute version has stopped being what it is for"*. ⚖️ **(b) A MAGNITUDE BOUND — INSUFFICIENT EVIDENCE.** 🏃 Hutchinson refused to set one in the same sitting that criticised a number set from precedent: *"I will not make the mirror-image error of setting a number because I happen to have one."* Evidence that settles it: what a bound COSTS the 675. → `WEEKDAY-OVERRUN-BOUND-01`. 🩹 **(c) WILLY'S NEW GAP:** 86 min at threshold for a runner on 20 km/week is *"approaching half their weekly volume in one session"*, and **no check anywhere looks at a single session as a share of the week** — §2 and §12 are measured weekly and are green. → `SESSION-WEEK-SHARE-01`. 👤 **(d) ROUTED TO THE FOUNDER:** the catalogue note *"same effort as rep three of a cruise set"* forward-references a session the runner may never have run — `brand.md`'s, not the board's. |
| **The DELOAD CLUSTER** — `DELOAD-BADGE-TRUTH-01` + `DELOAD-LR-GROWS-01` + `WEEK12-LR-CAP-CLIFF-01` (4th sitting) | ⚖️ **2026-10-06 — NO CHANGE. §3's 30% IS NOT A DELIVERY TARGET AND THE CONSTITUTION ALREADY SAID SO.** The scan returned a ruling rather than a conflict: **§3 Amendment (LR-DELOAD-CUT-01, 2026-09-17)** — *"§3 says 'volume drops to 70% of the prior build week' — a statement about the WEEK. **Nothing in §3 asks the long run to be cut harder**"* — which bounds the long run by §52's share and §9's cap and was ratified to FIX marathon shortfalls (26.0 → 29.5 km). 📊 **Measured, 13,785 deload weeks:** 82.9% short of a 30% drop, median delivered **17.9%**; of the short weeks **65.6% reachable by trimming easy runs to their floor**, 34.4% floor-bound, and **2 of 11,431 (0.0%) long-run-bound** — so §81's long-run veto was never the binding constraint. 🔴 **AND THE REACHABLE REMEDY IS THE MECHANISM LR-DELOAD-CUT-01 EXISTS TO PREVENT:** trimming easy runs takes the mean long-run share 36.4% → **56.0%** and §52 breaches 3.0% → **28.9%**, which is the amendment's own *"same numerator, smaller denominator… that asymmetry IS the disproportionate cut"*. **So the 82.9% shortfall is the arithmetic consequence of three ratified rules, not a defect.** ⚠️ Earlier the same day (b) *"fix the BADGE"* was shown **unimplementable** — it broke `INV-PLAN-DELOAD-PLACEMENT` (§87), `INV-PLAN-QUALITY-EXPECTED` and `INV-PLAN-STRIDES-PRESENT` — and the §81-style declaration was **built and refused on its own measurement** (66.0% of plans, flat across volume = wallpaper). 🩹 `INV-PLAN-DELOAD-IS-A-REDUCTION` stays **`warn`** and remains the right instrument for the genuine **3.6%** delivering no reduction at all. ✅ **Three items CLOSED, no code.** 🔻 `DELOAD-PLAN-OPENING-01`'s placement search is a SEPARATE real improvement (marathon 50.0% → 3.4%, 0 peaks lost) blocked only on the published-plan `I4`/`I6` findings; **`I4`'s too-shallow arm becoming advisory where the FLOORS are the cause is now justified by LR-DELOAD-CUT-01**, symmetric with its already-advisory too-deep arm. |
| **`MARATHON-PEAK-ROTATION-01`** | ⚖️ **2026-10-06 — CORRECT. SHIPPED as §93 Amendment 1, all three artifacts.** The time-targeted MARATHON's peak quality slot now prefers `race_specific`, as HM's already did. 🔴 **TWO OF THE ITEM'S THREE PREMISES WERE WRONG:** the catalogue is **symmetric** with HM (`mp_long_run`+`mp_blocks` against `hm_pace_long_run`+`hm_pace_intervals`), not short a row; and the fall-through is **documented intent** — a second comment line covers MARATHON/50K/100K with its reason. 🏃 **The unit was also wrong**: a 30 km MP long run is not one unit of the same thing as an 8.5 km sharpener, so the 3.19-vs-5.99 COUNT is not the argument. **The argument is the unreachable midweek slot** — `mp_blocks` was selected **0.14 times per plan**, reachable only via a SECOND peak quality slot that only EXPERIENCED runners get, measuring **0.00/plan for beginner AND intermediate at every volume**. Its own `purpose` field (*"marathon pace away from the long run"*) described the gap. 🎯 **McMILLAN'S BLOCKING CONDITION DISSOLVED RATHER THAN BEING MET** — the 3,408 §104 firings that required a second catalogue row measure **0**, because `VARIETY-ELIGIBILITY-01` (shipped the same morning for a different item) taught the variety invariant to filter alternatives by fitness, and §104 binds only *"while another eligible row exists"*. **No new row; CD-1's taxonomy objection never arises.** 🩹 **Willy withdrew his dose objection on the costing:** *"a substitution, not an addition — and the session that leaves is a THRESHOLD session while the one that arrives is at marathon pace, which is slower"*; quality count **262,988 both sides**, §1 share **11.8% both sides**, injury cohort **identical**. ⚠️ **50K/100K deliberately absent** — nothing measured speaks to them. 🔴 **The new invariant exposed a PRE-EXISTING HM defect:** 576 of 2,865 eligible plans have no race-specific peak quality and **every one is HM** → `HM-PEAK-RACE-SPECIFIC-GAP-01`, held as declared debt. |
| **`DELOAD-BADGE-TRUTH-01`** (third sitting) | ⚖️ **2026-10-06 — THE 2026-10-05 (b) IS VACATED, AND THE REPLACEMENT WAS BUILT, MEASURED AND ALSO REFUSED.** Three findings, each from measurement. 🔴 **(1) "Fix the BADGE" is not implementable:** withdrawing it broke `INV-PLAN-DELOAD-PLACEMENT` (§87 — *placement may SHIFT a deload, never remove one*, 🩹 Willy's own bound), `INV-PLAN-QUALITY-EXPECTED` (§1/§6/§8) and `INV-PLAN-STRIDES-PRESENT` (§28) — one root cause, **a demoted week is structurally still a recovery week**, so every rule keyed on `type !== 'deload'` begins to apply. The ruling did not distinguish `Week['badge']` (display) from `Week['type']` (structure). 🔴 **(2) THE RULING MIS-CITED ITS OWN AUTHORITY:** it hung on §34, which is *"Invariant registry — declared and exercised"* and says nothing about what the runner is told. The precedent is **§81** — *"and the plan says when they don't fit"*. 🔴 **(3) 🩹 WILLY'S "BINDING FLOOR" ALREADY EXISTS:** `INV-PLAN-DELOAD-IS-A-REDUCTION`, ratified **`warn`** by a prior board, reading delivered `weekly_km`, with the session floors named as the cause and the healthy delivered divergence *"deliberately LEFT to §52"*. He ruled it `error` not knowing it was there; a second copy at a second severity is the `DELOAD-OWNER-01` fault, so it was removed rather than written. ⚖️ **RULING: INSUFFICIENT EVIDENCE — the replacement remedy (§81-style declaration) was implemented and then REFUSED ON ITS OWN MEASUREMENT.** The declaration fires on **66.0% of plans (6,699 weeks)** and is **FLAT** — 58.8-71.3% across volume bands, 61.3-73.2% across distances. ⚕️ **Sims's mechanism from this sitting is DISPROVED**: she argued the cohort skews small-volume *"because a 4 km floor is a far larger share of an 18 km week"*, and the rate is **HIGHER at 70 km/wk (71.3%) than at 20 (66.4%)**. 🎯 **A note on two-thirds of plans, evenly, is wallpaper and fails McMillan's own Tuesday test.** **So §3's "70% of the prior build week" is not a small-week near-miss — at a 20% delivered bar it is not what the engine delivers, generally.** ⚠️ And the ruling's **1,792 weeks** cannot be reconciled with **6,699**: different corpora, never comparable. **The next sitting must rule on what §3 should PROMISE, not on a declaration bolted to a figure nobody meets.** Nothing shipped; tree reverted. Record: `docs/decisions/2026-10-05-deload-placement-search.md`. |

### ⚡ Recorded disagreements
**🩹 Willy vs 🎯 McMillan on severity, not on the fix.** Willy: *"median 0.5 km is not an injury
vector; this is a credibility defect, not a load defect."* McMillan: *"and a credibility defect is
the one that makes them stop using the plan."* *Willy moves if* overshoot correlates with injury
history; *McMillan moves if* the badge fix ships.
**⚕️ Sims vs the FILING of `DELOAD-LR-GROWS-01`** (not a seat) — she declines its 100% attribution
on the plan-wide measurement; *she moves if* the 2-day population is reached by a harness and the
attribution reproduces there.

### ⚠️ THE 2-DAY POPULATION WAS NOT REACHED, AND TWO RULINGS REST ON THE ITEMS' OWN NUMBERS
🔴 **`cohortGrid()` has no days field at all.** The first run reported *"2-day plans: 0 deload
transitions"* — impossible, and my bug, caught because **zero is not a rate**. A constructed cohort
(1,200 inputs forced to `['tue','sat']`) gives **38.0% inverted, 100% long-run-explained, but
overshoot median 0.0 and max 0.0** — every one **exactly equal**, a *flat* week, never a bigger one.
⚠️ **That does NOT falsify the item and must not be reported as if it did:** the forced plans throw
`INV-PLAN-QUALITY-EXPECTED` / `INV-PLAN-QUALITY-NOT-ZERO`, so they are not the item's *"144 genuine
2-day plans"* — **I could not reach its population.** Same class as `measure:fitness` having to
build injury × masters by hand because neither grid contains the cell.

### ↗️ SLT escalation
**One, carried by Hutchinson.** `EMAIL-WAVE-4-PATTERN-01` and `LOG-OFFPLAN-03` are both blocked on
*real users existing* — a commercial question, not a correctness one. Both sit behind the same gate:
`OPS-VERCEL-PLAN-01` / `OPS-SUPABASE-PLAN-01` and launch. Traynor's stood-down objection applies
verbatim: **what is the traffic?**

### ⚠️ What this sitting does not settle
**Nine rulings, zero lines of code** — every artifact is an obligation on a future build. **Half of
ruling 1's defect has no identified mechanism** (50.2%) and nothing here says what it is.
`DELIVERED-RAMP-REAL-DRIVER-01` is the largest unexplained warn in the product and **this sitting
did not reduce it by one firing**. The 5K/marathon split was measured on the cohort grid, not the
corpus the items quote, and **neither is the live population, which is 21 plans.** Nothing ran on a
device, and **no plan was read end to end by a human** — every figure is an aggregate.


## STEP-NOTE-SELF-CONTAINED-01 — a step note stands on its own (2026-10-07)

**Trigger:** `sessionCatalogueData.ts` — hard. **Ruling: CORRECT WITH AMENDMENT.**

| | |
|---|---|
| **Was** | *"Threshold now. Same effort as rep three of a cruise set."* |
| **Is** | *"Threshold now. It should feel harder than the same pace would feel fresh."* |

🔴 **The founder read it on his own card:** *"That has no context and does not make sense."*
🎯 **McMillan:** a coach's shorthand that fails the moment the athlete has not done the other
workout — and `progressive_tempo` is eligible from **base** phase, so a runner meets this note
in week 3 having possibly never been prescribed a cruise interval.
🏃 **Hutchinson, which shaped the amendment:** the reference was doing real work — *"rep three"*
means **threshold effort when already fatigued**, nineteen minutes into a progression, which is a
different sensation from threshold off a fresh warm-up. **Strip the reference and you must keep
the calibration, or the card is tidier and the coaching thinner.**

📐 **Measured: 1 of 52 distinct step notes.** Every other note calibrates WITHIN its own session
(*"rep three should look like rep one"*) or against an effort band (*"threshold effort — comfortably
hard"*). The only cross-session reference in the catalogue.

⚠️ **THE DESIGN BOARD ROUTED THIS TO COACHING THE SAME MORNING AND NOBODY FILED IT.** The ruling
existed and the work did not — the same gap that left §81's second half unbuilt for three days
after the board named it. **The gate is the part that does not depend on remembering.**

**Artifacts:** the catalogue note · no new numeric (the `T` anchor already carries the dose) ·
`lib/plan/stepNoteSelfContained.test.ts`, which matches session **nouns** so a within-session
*"rep one"* stays legal, falsified by restoring the old string.

## PROGRESSION-TRANSITION-01 — §8 Amendment: the transition is NAMED, not withheld (2026-10-07)

**Trigger:** `sessionCatalogueData.ts` + `resolveMainSet.ts` — hard. **Ruling: CORRECT WITH AMENDMENT.**

**The founder raised the same row three times** from his own session: *"The middle part is still
saying 9:20... I'd have to run 9:20 and look what my zone 3 is and not go over it. Very confusing."*

| | |
|---|---|
| **Was** | `{ kind: 'zone', zone: 'Z2-Z3' }` → `resolvePace` returns `null` → no pace, so no distance |
| **Is** | A ramp from the **E anchor's fast edge to the T anchor's fast edge**: `7:18 → 6:22 /km`, and the row carries a distance like its siblings |

🔴 **The 2026-09-03 ruling refused a POINT pace on that step and was right to. What nobody checked
is what the refusal RENDERED as** — the runner was told nothing, and the row led with bare minutes
between two rows leading with kilometres. **We decided how to express a target and accidentally
decided to express nothing.**

📐 **Measured before the sitting:** of **941** zone-only work steps, **100.0%** are bracketed on both
sides by a paced work step; every one is a progression's middle third (Progressive tempo 672, 5K 87,
HM 84, Marathon 52, 10K 46). §11 supports it — where a pace exists it is a range, and a ramp is a
range with a direction.

📊 **Seiler, recorded because it reverses the intuition:** the step had no SLOW bound at all, so
*"let it rise"* had nothing to rise from. For a product that exists to keep runners out of the grey
zone, the protective number is the **floor**, and it was the one being withheld.

🩹 **Willy's binding condition:** resolved from the **anchors, never the neighbouring step**. On a
`5K-pace progression` the final third is `4:54–5:06`; ramping to that would roughly double the
session's hard component. **Z3 is threshold and that is where the ramp stops.**

⚠️ **The first implementation was wrong and the ARITHMETIC caught it, not the reasoning.** "Ramp to
where threshold begins" means the T band's SLOW edge, which **coincides with the easy band's fast
edge for a large minority of runners**: **61 of 941 (6.5%) degenerate** (`7:30 → 7:30`) and **7
INVERTED** (`5:45 → 6:10`), instructing a runner to slow down through a step whose note says *"let
it rise."* Both edges are the band's fast end.

🔻 **A ramp that would not rise is withheld, and those 7 are a finding of their own** —
`PROGRESSION-GOAL-INVERTED-01`: a `Marathon-pace progression` on a §22 goal-paced week where an
experienced runner chasing 4:15 has a goal band (`5:56–6:10`) **slower than the fast edge of their
own easy band** (`5:45`). **The session is not a progression for them.** Open for the board.

**Artifacts:** `CoachingPrinciples.md` §8 Amendment · `GENERATION_CONFIG.PROGRESSION_TRANSITION_ANCHORS`
· `INV-PLAN-PROGRESSION-TRANSITION-PACED` + a liveness mutation that wakes it.

⚠️ **`verify:parity` CHANGED on 2,996 of 6,066 — intended, and PROVEN rather than asserted:** a
JSON-path diff over 197 regenerated plans shows the only differing paths are
`derived_set…steps[].pace` and `meta.generated_at`.

⚠️ **The ruling reaches no existing plan on its own.** `derived_set` is stamped at generation;
`backfillLegacyRamp` (`LEGACY-RAMP-BACKFILL-01`) is the read-time half, and without it 13 of 30
stored plans would still show the bare duration.

## PROGRESSION-GOAL-INVERTED-01 — §44 Amendment 3: the mirror (2026-10-07)

**Trigger:** `ruleEngine.ts` — soft, qualifies. **Ruling: INSUFFICIENT EVIDENCE → CORRECT**
once Seiler's condition was measured.

**The filed item said "7 of 941 steps".** That was the *display* symptom. Re-measured before
the sitting: **10 of 359 time-target plans (2.8%), marathon only**, and **115 quality
sessions** — the prescription reaches far wider than the renderer.

| | |
|---|---|
| 📊 **Seiler's condition, discharged** | **62 of 115 sessions labelled `quality` (53.9%) prescribed SLOWER than the runner's own easy ceiling**, vs **0 of 2,574 (0.0%)** on 349 controls. §1 counts SESSIONS: the plan declares a distribution it does not deliver |
| 🎯 **McMillan** | *"You are told to run marathon pace and it feels easier than your easy run."* A 4:15 off 20 km/week is ambitious, not soft — the engine has decided the runner is fast |
| 🩹 **Willy** | No injury vector; the work is easier than prescribed. His condition was on the FIX, not the finding |
| ⚕️ **Sims** | A plan whose hard days are not hard costs the time and fuelling of a quality session for no adaptation |

### 🔴 The obvious fix was built as a probe, measured, and REFUSED

Making §22's goal-pace override yield: **fixes only half** (62 → 33; the rest are
`race_specific` rows, intrinsically goal-anchored) **and breaks §22** —
`INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO` drops to **44%** against a **≥50%** floor. It trades
a §1 delivery defect for a §22 violation.

⚠️ **`measure:fitness` and `cohort:shape` both exited 0 on the probe, and that proved
nothing** — 10 plans of 748 is **1.3%**, below either aggregate's resolution. **The direct
per-session measurement is what refused it.** An aggregate cannot see ten plans.

➡️ **Root cause is §79, not the pace layer:** every one is `experienced` declared at
20–35 km/week. Routed separately.

### ⚠️ What shipped, and what the runner actually gets

The detection, the flag, the sentence and the invariant ship. **The sentence renders on 0 of
10 plans**: `planRationaleNotes` delivers **1.01 of 2.27** stamped honesty notes per plan
(3-tile cap, 70-word budget) and the surviving tile on all ten is `Maintenance`. **So the
runner is still not told**, and the invariant is `warn` rather than `error` so it cannot
assert a delivery the surface will not make. Blocked on `PLAN-NOTE-BUDGET-INERT-01`.

**Artifacts:** §44 Amendment 3 · no new numeric (both operands already owned) ·
`INV-PLAN-GOAL-BELOW-EASY-DECLARED` + liveness mutation ·
`lib/plan/goalBelowEasyDeclared.test.ts`, falsified three ways.
⚠️ `verify:parity` changed 140 of 6,066 — **proven** by a JSON-path diff over 197 regenerated
plans to be the two new meta keys and nothing else.

---

## ANALYSIS-SUPERSEDE-PATTERN-01 — the hold is lifted, and the build is the STAMP not the filter (2026-10-07)

**§71 Amendment 2. Ruling: CORRECT WITH AMENDMENT.** Amendment 1's INSUFFICIENT EVIDENCE,
placed one day earlier, is discharged on a measured number.

### How this sitting started, which is worth recording

The founder asked why Coach never shows him a pattern across runs. **I proposed building
"Coach aggregation". He replied *"I thought we already do that somewhere?"* — and he was
right.** Coach already renders ZoneRings, a zone-drift detector, three TrendCards, LoadShape,
a weekly report, phase summaries and a race-readiness note. **Nothing needed building. The
aggregation is STARVED, not missing.** I should have inventoried before proposing, and that is
the second time in one day I nearly built something that existed.

### The number Amendment 1 asked for

**43 scored runs; 42 hidden by the `superseded_at` filter; 1 visible.** The detector needs four
rows, so it **cannot fire for him at all**. Across all users: 3 with scored runs, 119 runs,
42 hidden (35.3%), **all 42 belonging to one runner**.

🏃 **n=1 was accepted because the effect is DETERMINISTIC, not sampled** — supersession is set
on a race-identity change, so every runner who finishes a block loses their discipline history
by construction. The 42 confirms the rule fires; it does not estimate a rate, and **the chair
records he would reject the same number for a claim about rate.**

### 🔴 The finding that reshaped the build

**Lifting the filter alone would have been perfectly inert.** The detector keeps easy/recovery
runs only (§12: above the ceiling is drift on an easy run, correct on a tempo) and resolved
type by joining `week_n` against the **current plan**. Hidden weeks **15–35**, current plan
**1–12**, **zero overlap** — 42 rows recovered, 42 dropped at the join.

So `run_analysis` **stamps `session_type` at write time** (ADR-018's shape). Raw `session.type`,
not `coachingSessionType()`, so the stamp answers the same question as the fallback it replaces.
An unresolvable type is **EXCLUDED, never assumed easy**.

| Decision | |
|---|---|
| Drift detector crosses the boundary | 🟢 discipline field (`hr_above_ceiling_pct`), Seiler's split |
| It NAMES the boundary | 🟢 🎯 McMillan BINDING — *"…, including your last block."* |
| Reads FORWARD, no backfill | 🟢 🩹 Willy BINDING — filed as `ANALYSIS-TYPE-BACKFILL-01`, opt-in |
| TrendCards cross | 🔴 **NO** — `ef_trend_pct` is fitness-denominated |
| ZoneRings | 🔴 unchanged, weekly, correct as-is |
| A SEPARATE query, not the shared map | 🟢 old plans reuse week numbers; unfiltering the shared map ships `PLAN-WEEK-COLLISION-01` again |
| §108 score composition | 🔴 **UNTOUCHED — my submission misdescribed it as an average and the conflict scan caught it.** HR discipline is already 0.50 by ruling |

**Artifacts:** §71 Amendment 2 · `ZONE_DRIFT_MIN_ROWS` + `ZONE_DRIFT_WINDOW` moved from inline
literals into `lib/coaching/constants.ts` · `lib/coaching/zoneDrift.ts` as the owner ·
`zoneDrift.test.ts` 13 arms **falsified four ways** · `analysisSupersedeReaders.test.ts` now
**enforces Seiler's split mechanically** (an unfiltered read may select discipline fields only),
falsified three ways.

⚠️ **Not checkable by `validatePlan()`** — it governs a read of historical analyses, not a
generated plan. Stated rather than left implicit.

⚠️ **That register had a FALSE NEGATIVE, found during this build:** it tested `/superseded_at/`
against the whole query chain, so the first query to SELECT the column as data read as
*filtered*. It would have certified the exact cross-plan read §71 authorises as its opposite.

---

## `READ-DIRECTION-OVERCLAIM-01` — SPLIT RULING, 2026-10-08. The filed question was a symptom; the scan found a scoring defect

**Convened on:** `sessionScore.ts` / `strava.ts` / `sessionFeedback.ts` — soft trigger, qualifies
(it changes what the runner is told they did, and half the score).

### 1. On the filed question — ⛔ INCORRECT AS SCOPED. Neither candidate fix ships.

The item asked whether to pass `hrBelowFloorPct` to the prompt, or forbid the word “most” below
a majority. **Both would have closed the item and left the defect.** Passing a third figure makes
the sentence more precise about a number measured against the wrong band; a voice rule
suppresses an accurate report of a broken measurement.

🔴 **The model did not overclaim. It was told “32% in zone, 39% above ceiling” and wrote the
only sentence those two numbers support.** It reasoned correctly from a false premise.

### 2. On what the conflict scan found — ✅ CORRECT. `hr_in_zone_pct` means `hr_in_zone_2_pct`.

**Measured mechanically, not inferred:**
- `lib/strava.ts:112` — `const ceiling = zones.zone2Ceiling ?? …`, under its own comment
  *“Z2-anchored counts — legacy fields”*. **Unconditional, for every session type.**
- `lib/coaching/sessionScore.ts:76` — `if (hrInZonePct !== null) return Math.round(Math.min(100,
  hrInZonePct))`. **The HR discipline score IS the Zone-2 percentage.** Verified in production:
  `hr_discipline_score === round(hr_in_zone_pct)` on **100% of rows**.
- `grep 'session.type' lib/coaching/sessionScore.ts` → **empty.** The scorer never branches on type.
- The session’s own `hr_target` is parsed **only in the fallback branch**, so it is ignored
  whenever stream data exists — exactly when the data is best.

🔴 **CONSEQUENCE, FROM CATALOGUE ROW 7’S OWN STRUCTURE** (*“continuous, 3 equal thirds
(E ceiling → Z2-Z3 transition → T target)”*): **two of three thirds are DESIGNED to sit at or
above the Z2 ceiling, so a perfectly executed progressive tempo cannot score above ~33 on half
of §108’s composite.** The founder scored **32** on a split of **29.0% below / 32.3% in /
38.7% above** — almost exactly thirds. **He ran the session as prescribed and the engine graded
it a failure, then narrated that failure back to him.**

⚠️ **And the card asserts it in words:** *“32% in your **prescribed zone**”*. It is not his
prescribed zone. It is Zone 2.

### 🔍 Conflict scan

| § | Interaction |
|---|---|
| **§108** | 🔴 **Direct.** Weights “HR discipline” at **0.50** and justifies it as *“heart rate in **the wrong zone**”* — which presupposes a PRESCRIBED zone. The implementation uses Z2 regardless. §108 governs the WEIGHTS and is silent on the BAND. |
| **§12** | ✅ No conflict, **and this is why it survived**: Z2-anchoring is correct for easy/recovery/long, which is 77 of 77 analysed rows with HR. |
| **§14** | Threshold and VO2max sessions are prescribed in Z3/Z4–5 by definition; a Z2-anchored measure cannot describe them. |
| **§1** | Not weakened — §1 counts sessions, not zone percentages. |

### ⛔ Binding conditions

1. **Willy, close to a veto:** do **NOT** repoint `hr_above_ceiling_pct` or `hr_in_zone_pct`.
   `limiter.ts:203` reads them as a Z2 overload signal (`PACING_HOT_PCT_THRESHOLD`), and
   re-anchoring per session type would make a correctly-executed tempo read as *“ran hot”*.
   **Add a prescription-relative field beside them; do not redefine the existing columns.**
2. **Sims:** the **below-floor** bucket must not score as indiscipline on a session whose own
   structure prescribes a below-band opening third. 29% below is in the founder’s own row.

### ⚡ Recorded disagreement — McMillan vs Seiler, UNRESOLVED

Seiler wants a prescription-relative in-band percentage per session type. McMillan holds a
tempo’s real compliance question is binary — *did you reach the work and hold it* — and that a
percentage-in-band model imported from easy running will mislead on intervals, where recovery
jogs are **supposed** to fall out of band. **Settled by:** the distribution of
`strava_activities.hr_bpm_histogram` across the prescribed band for structured sessions.
**Nobody has looked**, and live data cannot settle it yet — `run_analysis.session_type` is null
on all 77 rows because the stamp only landed 2026-10-07.

⚠️ **No aggregate would ever have surfaced this.** The analysed population is 77 easy-type
rows at a mean 79% in-zone. **The founder found it by running one tempo.**

### 3. ✅ Second routed question — WHICH AXIS OWNS “Short.” — CORRECT AS SHIPPED

`POSTRUN-METRIC-PREF-01` routed it. §66 Am. 1 already governs (*“distance still wins where the
session carried one”*), and **withholding** the verdict where the axes contradict asserts nothing
§66 does not already say. **22% disagreement (2 of 9 both-axes live rows) is too high to pick an
axis silently and too low to justify a new principle.** 📐 Both seats noted the number is the
interesting part: **one in five analysed runs is judged on an axis the runner did not choose.**
Revisit as a principle when the population exceeds nine rows.

### 📦 Artifacts

| | |
|---|---|
| Register row (this) | ✅ **done, including the INCORRECT half** |
| Principle `§109` — *what band a run is scored against* | 🔲 drafted, **NOT committed** — blocked on the founder |
| Numeric — prescription-relative band resolver (`SCORE_WEIGHTS` untouched) | 🔲 blocked on the founder |
| Invariant — *every catalogue row, executed as its own `main_set_structure` prescribes, must be able to reach a passing HR discipline score* | 🔲 **ship this first even if the rest waits** — checkable from the catalogue alone, needs no live data, and **goes RED today on row 7** |

### ↗️ SLT escalation — YES, and the board does not decide it

The remedy changes `total_score` on live rows, and the founder explicitly **kept** the score
(*“i got 83% on my garmin last night … gives a sense im going in the right direction”*). **Score
composition is his and the SLT’s.** This board rules only that the measure is incorrect for
quality sessions. Hutchinson carries it. Related open §108 question already routed here: *what
is the score OF* — **same root, and this ruling is the answer to half of it.**

---

## 🔴 AMENDMENT 1, SAME DAY (2026-10-08) — the mechanism I gave the board was WRONG. The conclusion survives; the cause does not

**Found while building the fix, by tracing the call path I should have traced before the
sitting.** This amendment exists because leaving a false mechanism in this register is
exactly the failure the register was created to stop.

### What I told the board, and what is actually true

| I said | Measured |
|---|---|
| *“`hr_in_zone_pct` is Z2-anchored **unconditionally**”* | ❌ **FALSE for the histogram path.** `derivePrescribedZoneHrFigures` (`analyse-run/route.ts:605`) **already** buckets relative to the prescribed zone: Z3 prescribed → `in = z3`, `above = z4_5`, `below = z1+z2`. |
| *“the founder's run was scored against Zone 2”* | ❌ **FALSE.** His row carries `z1=3.23 z2=25.81 z3=32.26 z4_5=38.71`, and `in=32.26` **is** `z3`, `below=29.04` **is** `z1+z2`. **It was scored against Z3, correctly relative to his prescribed zone.** |
| *“a correct progressive tempo cannot score above ~33”* | ✅ **TRUE, and for a different reason** — see below. |

⚠️ **I measured `bucketHRHistogram` and `computeHRScore` and did not trace WHICH
`hrInZonePct` reaches the scorer.** It is `prescribedHrFigures.hrInZonePct` (`:251`), not
the Z2-anchored column. **“Trace the producer, not the consumers you can imagine”, run
backwards.**

### 🔴 THE REAL DEFECT, AND IT IS NARROWER AND SHARPER

**`zoneForSessionType` returns ONE zone for a session the catalogue prescribes in THREE
bands.** Measured across the 30 live plans, `progressive_tempo`'s own `derived_set` step
targets are literally:

```
ceiling / Z2-Z3 / target        (session.zone says "Zone 3")
```

So on a correctly-executed progressive tempo, scored against Z3 alone:
- the **opening third at the Easy ceiling** lands in Z2 and is counted **BELOW FLOOR**
- the **closing third at Threshold** reaches Z4–5 and is counted **ABOVE CEILING**
- **only the middle third counts as “in zone”**

**The founder: `below 29.04 / in 32.26 / above 38.71`. Almost exactly thirds. The ~33
ceiling on a correct execution is real.** The engine scored the structure it prescribed as
a failure to hold a band it never prescribed.

⚠️ **And it is not one row type.** Every quality row with a `ceiling` step has the same
shape — `threshold_ladder`, `cv_intervals`, `tempo_over_under`, `goal_pace_sharpener`,
`threshold_pyramid` — because a **recovery jog is PRESCRIBED out of the work band**. That is
exactly 🎯 **McMillan's objection, and it is now evidence rather than a worry.**

### ✅ AND THE RECORDED DISAGREEMENT IS RESOLVED BY THE DATA, NOT BY A CASTING VOTE

📊 Seiler wanted a prescription-relative in-band percentage. 🎯 McMillan held a
percentage-in-band model would mislead on intervals because recovery jogs fall out of band
**by design**. **Both are satisfied by scoring against the union of the session's OWN STEP
TARGETS**, weighted by step length: a recovery step declares `ceiling`, so time there is
**in prescription**, not below floor. 📏 **The vocabulary already exists in the data** —
`mp_long_run` declares `session.zone: "Zone 2–3"`, a band RANGE, today.

### 🔻 A SECOND, SEPARATE FINDING: the legacy fallback is doing most of the work

📐 **Only 5 of 77 live analyses (6.5%) carry the per-zone histogram.** The other
**93.5% fall through to the legacy Z2-anchored columns**, which the code's own comment
calls *“correct for easy/long/recovery sessions and **meaningless elsewhere**”*.

⚠️ **So my original claim was true of the POPULATION and false of the founder's ROW** —
the one row I used to argue it. The 93.5% are Z2-anchored; his was not. Both halves of the
fix are needed and they are different: **structure-aware bands** for the histogram path,
and **histogram coverage** for everything else.

### ⚠️ A DUPLICATE PRODUCER, found in the same pass

`derivePrescribedZoneHrFigures` is **private to `analyse-run/route.ts`** and
`app/api/recalibrate-hr/route.ts:35` carries a **re-implementation that says so in its own
comment** (*“Re-implementation of derivePrescribedZoneHrFigures (private in analyse-run)”*).
Two producers of one classification, acknowledged in writing and left in place. **It must
become one owner before the band logic gets more complicated**, or this repo acquires its
sixth recorded parallel classifier.

### ⚖️ Ruling, restated

**The 2026-10-08 ruling STANDS: the measure is incorrect for quality sessions, and the
founder has ruled BUILD.** The binding conditions are unchanged and one is now
*more* relevant, not less:

1. ⛔ **Willy:** do not repoint `hr_above_ceiling_pct` / `hr_in_zone_pct`. ⚠️ The thing to
   change is `derivePrescribedZoneHrFigures`, **not** `bucketHRHistogram` — the limiter
   reads the raw Z2-anchored activity columns and must keep doing so.
2. ⛔ **Sims:** below-floor must not score as indiscipline where the session prescribes a
   below-band opening third. **This is now the precise mechanism of the defect**, not a
   side condition.

⚠️ **What this amendment does NOT change:** the escalation stands. It still moves
`total_score` on live rows and the founder has approved that.

