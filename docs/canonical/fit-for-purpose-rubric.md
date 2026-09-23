# Fit-for-purpose rubric — the complete criteria space

**Why this file exists.** Three board sittings in one day produced three
different answers to "are we serving our runners". The board was consistent;
the submissions were not. Each sitting measured a different population with a
different set of criteria and called the result the same thing. **This file
fixes the criteria space so a sitting is comparable to the one before it.**

## 🔴 THE BAR — a refusal is a FAILURE, not a pass

**`ZERO-REJECTION-01`, 2026-09-20.** The founder's standard, stated repeatedly:

> *"If someone comes to our platform and asks for a run, we can't just say no,
> go away."*

A designed refusal is scored **FAIL**. It is still a correct refusal, it still
must name a next step (§44: *"not yet"*, never *"no"*), and `BaseVolumeError`
refusals do — but naming a next step is not the same as serving the runner, and
this rubric no longer pretends otherwise.

### ⚠️ AMENDED 2026-09-23 — `ZERO-REJECTION-SERVED-01`

**A refusal that hands the runner a validated §118 get-running plan is EXCLUDED
from the fit rate — neither pass nor fail.** It is reported beside it as a
WATCHED quantity (`servedRefusedPct`), the mechanism already ratified for
`DAYS-SHORT-SILENCED`.

**Why the bar moved again, eight hours after the last time.** `ZERO-REJECTION-01`
ruled a refusal a DROPOUT on 2026-09-20 at 16:34. **§118 shipped the same day.**
Since then a refusal *does* lead to a plan: the route catches the throw and
offers one, and `getRunningApplies` is only `effectiveStartKm > 0`. The rule was
right; the world it described changed underneath it.

🔴 **HUTCHINSON, BINDING — THIS IS A CORRECTION, NEVER AN IMPROVEMENT.** *"The
engine did not get better. Nothing about the plans changed. If this board
re-scores and the marathon reads ~91%, not one runner is served differently than
they were yesterday."* `verify:parity` IDENTICAL and `review:cohort` unchanged on
every band are the evidence. **A number that rises because its definition moved
must never be readable as progress**, which is why `fitPctPreCorrection` is a
field and `[was N%]` prints on every run.

🔴 **IT DOES NOT CLEAR THE TARGET.** The marathon lands at **89.8%**, 0.2pp under
90. **This correction does not sign the marathon off.**

⚠️ **AND THE WHOLE PRODUCT IS NOW 96%, ABOVE ITS OWN 90-95% BAND.** The corrected
metric puts the product over its stated target range. **That is a question about
the target**, and it is open.

| | whole | 5K | 10K | HM | marathon | 50K | 100K |
|---|---|---|---|---|---|---|---|
| **fit (corrected)** | **96.0%** | 100% | 100% | 96.2% | **89.8%** | 100% | 100% |
| fit (pre-correction) | 92.5% | 100% | 100% | 96.2% | **78.7%** | 100% | 100% |
| **SERVED** (watched, not scored) | — | 0% | 0% | 0% | **12.4%** | 0% | 0% |
| unserved refusals (still FAIL) | — | 0% | 0% | 0% | **0%** | 0% | 0% |

⚠️ **`door` IS REPORTED PER BAND, NEVER AVERAGED** (amendment 4, McMillan):
**80.3%** at 4 km/week, **99.6%** at 8, **100%** at 15. *"80.3% and 100% are
different promises and a single figure hides the runner who cannot get there."*
`npm run review:cohort` is where they live. `measure:envelope`'s distance-level
`door~ N% agg` is an aggregate and is **not** the promise.

**Measured 2026-09-23 — read from `lib/plan/__fixtures__/envelopeBaseline.json`,
not from this paragraph:**

| | whole | 5K | 10K | HM | marathon | 50K | 100K |
|---|---|---|---|---|---|---|---|
| **fit** | **92.5%** | 100% | 100% | 96.2% | **78.7%** | 100% | 100% |
| refused | — | 0% | 0% | 0% | **12.4%** | 0% | 0% |
| objections | — | — | — | DEGENERATE-WEEK 2.3%, WEEK1-LEAP 1.5% | LONG-RUN-SHORT 6.6%, WEEK1-LEAP 4.4%, BINGE-WEEK 0.7% | — | — |

🔴 **The marathon is the only distance that refuses anyone, and it is the only
distance below target.** One marathoner in eight is told no — and the marathon
is the founder-priority distance and the charity channel.

⚠️ **`WEEK1-LEAP` is FROZEN** (Hutchinson, 2026-09-20) — measured, found benign
and relaxed three times in one day. Any further change needs adherence or
injury data, not another corpus measurement.

### ⚠️ The superseded bar, kept so old rounds stay readable

**Do not score against this.** Until 2026-09-20 this file's first line read
*"a correct refusal counts as fit for purpose"*, and reported:

> Measured 2026-09-19. **Whole product: 95.3%** · 5K 100% · 10K 100% ·
> **HM 96.2%** · **marathon 90.1%** · 50K 100% · 100K 100%. *"Every distance is
> at or above the 90% target."*

Same engine, same corpus — **only the accounting differed.** `ZERO-REJECTION-01`
re-scored it: marathon **90.1% → 78.7%**, whole product **95.9% → 92.7%** (now
92.5%). Every other distance was unchanged, because no other distance refuses.

🔴 **THIS FILE TAUGHT THE OLD BAR FOR THREE DAYS AFTER IT WAS OVERTURNED.** It
was written 2026-09-20 at **07:47**; the ruling landed at **16:34** the same
afternoon and this file was never updated. The board sitting of 09-20 read it,
scored refusals as passes, and recorded the marathon at 90.1% — which the
sitting of 09-23 then had to decline to inherit (`RUBRIC-STALE-BAR-01`).

⚠️ **The harm is the stale STANDARD, not the stale number.** This file's own
opening says it exists so *"a sitting is comparable to the one before it"*. A
rubric that silently changes what counts as success is the failure it was
written to prevent, committed by the document itself.

⚠️ **Nothing mechanical watches these figures.** `audit-docs.sh` does not compare
them against `envelopeBaseline.json`, which is why the drift lasted three days
and was found by hand. Until it does, **treat every number in this file as a
claim to re-derive, not a fact** — `npm run measure:envelope` is the answer.

⚠️ **`WEEK1-LEAP` is FROZEN** (Hutchinson, 2026-09-20) — measured, found benign
and relaxed three times in one day. Any further change needs adherence or
injury data, not another corpus measurement.

## 1. What "fit for purpose" is tested against

| layer | what it is | count |
|---|---|---|
| **Constitution** | `validatePlan()` error-severity invariants | 115 codes |
| **Coach objections** | `lib/plan/planQuality.ts` — "would a coach object?" | 7 predicates |
| **Population** | `lib/plan/useCaseEnvelope.ts` — weighted, per distance | **10,752 marathon / 4,608 each other** (33,792 total; sampled at stride 29 → 1,166) |

A plan is fit for purpose when it **generates** (a refusal is a fail —
`ZERO-REJECTION-01`), carries **no error-severity violation** and **no coach
objection**.

⚠️ **The population figure was ALSO stale** — this row read *9,216 marathon*
until 2026-09-23; the grid is **10,752**. Two stale numbers in one file is not
two mistakes, it is one missing mechanism.

⚠️ **Coach objections have never been measured on a composed plan.**
`audit-plan-quality.ts` calls `generateRulePlan` and stops, so `planQuality`'s 7
predicates have never seen a foundation week — while any runner with a runway
over 28 days gets one (`HARNESS-COMPOSE-GAP-01`, 2026-09-23). The error-severity
half is now covered by `scripts/foundation-review-round.ts`; **this half is
not.**

## 2. Findings that are REAL, with measured weight

| finding | product-wide | worst distance |
|---|---|---|
| ~~`DAYS-SHORT` — runner declares N days, plan gives fewer, no note~~ | ~~18.7%~~ **FIXED** (FREQ-SILENCE-01) | now declared |
| zero quality for the entire block | **17.8%** | 5K 33% |
| `WEEK1-LEAP` — week 1 >1.30× real start **AND >2 km absolute** | **9.1%** (was 14.0%; the rest was artefact) | 10K 30% |
| marathon refusals (§111 10.0% + §52 8.4%) | 18.3% *of marathon* | — |
| `LONG-RUN-SHORT` (**marathon band only** since ULTRA-LR-BAR-01) | 2.0% | marathon 6% |
| long run never progresses across the build | 1.7% | 5K 11% |
| quality monotony (≤2 distinct sessions across ≥6) | 0.6% | 100K 11% |
| `DEGENERATE-WEEK` / `BINGE-WEEK` | 0.3% / 0.2% | — |
| ~~100K plans shipping INVALID~~ | ~~0.02%~~ **FIXED** (COPY-STALE-GEN-01) | now 0 of 2,558 |

## 3. Findings CHECKED AND DISMISSED — do not re-raise without new evidence

| claim | why it is not a finding |
|---|---|
| "93.7% of sessions carry no pace/HR/RPE target" | **100% are race-day sessions.** A race has no target; it is the race. My criterion. |
| "LONG-RUN-SHORT fails 91% of 100K plans" | Bar is 55% of race = a **55 km training run** for 100K. §24e prescribes back-to-backs. Criterion defect — **FIXED** at source (`ULTRA-LR-BAR-01`); ultras now have no long-run check, recorded in the negative space. |
| "9.2% of plans never build" | Almost all are **declared maintenance with a note** (§23). An earlier audit reconciled 15,236 of these to zero. |
| "2.1% fall short in silence" | They carry `volume_constraint_note`. My shortfall test omitted that field. |
| "zero-quality blocks are undifferentiated" | **100% beginners, 0% intermediate/experienced, at every distance**, and it scales with volume (marathon: 53% at 8 km/wk → 0% at 70 km/wk). **100% carry a note explaining it.** Seiler's question, closed. |
| "the difficulty band should read training load" | **VETOED** — §44 point 3, Willy's own constraint. Do not re-propose. |
| "the plan does not warn a knee-history marathoner they will walk" | It does: *"take the walk breaks early rather than late."* |

## 3b. Build of 2026-09-19 — what was fixed, and what dissolved

| item | outcome |
|---|---|
| 1. 100K plans shipping invalid | **FIXED** — `COPY-STALE-GEN-01`. 96 → 0. The repair existed and had one caller. |
| 2. `DAYS-SHORT` silence | **FIXED** — `FREQ-SILENCE-01`. 5K 50.6% → 91.8%. |
| 3. `WEEK1-LEAP` | **HALF-FIXED** — `WEEK1-LEAP-ABS-01` removed the ≤2 km artefact (17% of flags). The engine half **dissolved**: four caps were built and every one made `BINGE-WEEK` 8–12× worse, because a smaller week 1 with a correctly-sized long run is arithmetically lopsided. Residual filed as `WEEK1-FLOOR-SHORT-DIST-01`. |
| 4. §111 cap-instead-of-refuse | **DISSOLVED ON MEASUREMENT.** For **100%** of §111-refused marathon cases the capped peak lands below the credible floor — median **22.4 km against 52.8 km**. Capping would hand every one of them a degenerate plan. **§111's door at ~12 km/week is arithmetically exactly right: 52.8 ÷ 4 = 13.2.** The board's earlier CORRECT-WITH-AMENDMENT ruling was made on a premise this measurement falsifies. |
| 5. Ultra long-run bar | **FIXED** — `ULTRA-LR-BAR-01`, scoped at source. |
| 6. High-volume beginner zero quality | **DISSOLVED TWICE.** The conflict scan found §110 Am. 2 ruled it *"CORRECT AS IS, unanimously"* this morning, with Hutchinson's evidence explicitly about **time-goal** races. And the cell Seiler worried about was **13.6% envelope incoherence** (`ENVELOPE-COHERENCE-01`), now 1.1%. Measured anyway: opening the slot takes zero-quality 16.4% → 4.2% with no error violations, at a cost of +0.57 warns/plan on the injury cohort — all of them §7's already-accepted "lumpy week on limited days" class. **Recorded so the option is not re-derived; not shipped, because the board ruled it today.** |

## 4. NOT MEASURED — the honest negative space

- **`daysShortSilent` was declared as a metric and never implemented.** It
  reported 0% because nothing called it. The underlying gap is real and was
  confirmed by hand on one 5K case; the *rate* is unmeasured.
- **Note honesty in general.** Specific notes are checked; there is no
  systematic test that every constraint a plan imposes is explained.
- **Session-level copy quality** beyond the glyph and em-dash guards.
- **Adherence and dropout — no data exists at all.** One analytics event in
  the product, no charity code ever redeemed. Every judgement here is a
  coaching opinion with a number attached, never an outcome.
- **Ultras have NO long-run adequacy check at all** since `ULTRA-LR-BAR-01`.
  The 55%-of-race bar demanded a 55 km training run for a 100K; §24e replaces
  the single longest run with back-to-backs, so the right unit is different and
  picking a number without a board ruling would be an invented one. **Honest
  gap, filed, not papered over.**
- ~~**Why 10K was the worst distance**~~ — **RESOLVED** by the §2 Amendment
  (`WEEK1-FLOOR-SHORT-DIST-01`): the whole gap was `WEEK1-LEAP` measuring
  against §29's scaled-down start. **78.3% → 99.4%.**
- **`WEEK1-LEAP` arm 3 (session load) fires on nothing today** — worst excess
  +0.5 km against a 5 km margin. Kept because it is the only arm describing
  tissue load rather than an accounting ratio; liveness by mutation. The week-1 floor is 35% of the
  *curve* peak, which is level-derived — so a runner at 7 km/week effective
  gets an 18 km week 1 (2.6×). §111 refuses that tail at the marathon and its
  own closing line says *"short distances (5K/10K/HM) are outside §111
  entirely"*. That is exactly where the leaps concentrate: **30% at 10K, 19% at
  HM, 5% at marathon.** Every cap tested traded it for a lopsided week.
- **Nothing has run on a device.**

## 5. The envelope weights are assumptions

Stated in `useCaseEnvelope.ts`'s header and repeated here because it governs
every number above. When Make-A-Wish answers the volume question
(`docs/runbooks/charity-volume-question.md`, drafted, unsent), the weights
change and so does the baseline — deliberately.
