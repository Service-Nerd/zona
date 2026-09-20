# Fit-for-purpose rubric — the complete criteria space

**Why this file exists.** Three board sittings in one day produced three
different answers to "are we serving our runners". The board was consistent;
the submissions were not. Each sitting measured a different population with a
different set of criteria and called the result the same thing. **This file
fixes the criteria space so a sitting is comparable to the one before it.**

Measured 2026-09-19. **Whole product: 87.0%**, up from **66.7%** at the start of the 2026-09-19
build, against a 90–95% target. Per distance: **5K 100%** · 10K 78.3% ·
HM 85.4% · **marathon 90.1%** · 50K 100% · 100K 100%.

**A CORRECT REFUSAL COUNTS AS FIT FOR PURPOSE** (founder, 2026-09-20).
Refusing an 8 km/week runner a marathon is the right outcome, not a failure:
measured, for 100% of §111-refused cases a capped peak would land below the
credible floor (median 22.4 km against 52.8), so the only alternative is a
degenerate plan. ⚠️ **A refusal only counts when it earns it** — §44's standard
is *"not yet"*, never *"no"*, so it must name what to do next. Measured and
**gated**: 100% of `BaseVolumeError` refusals do ("get to about 11 km a week
first… come back"). A refusal with no route back is a dropout and still counts
against us.

⚠️ **`DaysAvailableError` was never a refusal at all.** It carries two reasons,
and `warn_unacknowledged` is a *confirmation prompt* the runner ticks before
generation proceeds. The envelope was not acknowledging, so **2,304
confirmation prompts were being counted as refusals** — modelling a runner who
never clicks "yes, I understand", which is modelling nobody. Genuine `block`
refusals are unaffected.

**The marathon is now in target at 90.1%. The short distances are the whole
remaining gap** — 10K 78.3%, HM 85.4% — and their dominant objection is
`WEEK1-LEAP` at 11.4% product-wide, which is the single open engine item
`WEEK1-FLOOR-SHORT-DIST-01`.

## 1. What "fit for purpose" is tested against

| layer | what it is | count |
|---|---|---|
| **Constitution** | `validatePlan()` error-severity invariants | 115 codes |
| **Coach objections** | `lib/plan/planQuality.ts` — "would a coach object?" | 7 predicates |
| **Population** | `lib/plan/useCaseEnvelope.ts` — weighted, per distance | 9,216 marathon / 4,608 each other |

A plan is fit for purpose when it generates, carries **no error-severity
violation** and **no coach objection**.

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
- **`WEEK1-FLOOR-SHORT-DIST-01` is open.** The week-1 floor is 35% of the
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
