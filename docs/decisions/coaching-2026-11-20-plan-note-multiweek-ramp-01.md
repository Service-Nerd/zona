# Coaching Board — 2026-11-20. `PLAN-NOTE-MULTIWEEK-RAMP-01` — must every warned week be told, or only the largest?

**Trigger:** soft, qualifies. No doctrine file is edited here. The question is what §90 Amendment 3's declaration
covers, which is meaning (this board's), not encoding (Design's, under the seam rule).
**Proposed change, one sentence:** every week that a ramp check warns on is declared to the runner on that week,
not only the week with the largest rise.
**Item:** `docs/releases/backlog.md` § `PLAN-NOTE-MULTIWEEK-RAMP-01`, filed from Willy's recorded remark in
`coaching-2026-11-20-plan-note-heavier-week-placement-01-followup.md`.
Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims, Blagrove.

**Settled ground (not re-ruled):** this morning's Design ruling on the encoding (`design-2026-11-20-plan-note-heavier-week-placement-01.md`,
SHIP WITH AMENDMENT (5)), and this afternoon's coaching follow-up (week-N surfaces discharge §90 Am.3 if the
WeekCard line declares the residual in words; the injury scope names the injury history). §2 Amendment 2 freezes
the warn predicate, so nothing here changes what fires. §32 Am.1 (same day) already treats **every** ramp-flagged
week as a residual week (the tune-up may not sit on any of them).

---

## 📐 Analysis: the item's figures re-derived

Evidence: `scripts/board-evidence-plan-note-multiweek-ramp-01.ts` (read-only).
`NODE_ENV=production npx tsx scripts/board-evidence-plan-note-multiweek-ramp-01.ts 23 [achilles|knee]`
cohortGrid stride 23, tier free, 1,728 plans generated, 76 threw (counted, not dropped). A week is "warned" if
`validatePlan` on the composed plan reports a `RAMP_RESIDUAL_CODES` violation with `ramp` and `week > 0`, the
producer's own filter.

| | item says | **healthy** | `achilles` overlay | `knee` overlay |
|---|---|---|---|---|
| warned plans | — | 322 | 444 | 258 |
| more than one warned week | 29% healthy, 30% Achilles | **94 (29.2%)** | **132 (29.7%)** | 37 (14.3%) |
| warned weeks per warned plan | — | 1: 228 · 2: 84 · 3: 10 | 1: 312 · 2: 103 · 3: 25 · 4+: 4 | 1: 221 · 2: 30 · 3: 7 |
| unnamed warned weeks | — | 104 | 166 | 44 |
| …adjacent to the named week | — | 4 | 20 | 10 |
| plans with a **non-adjacent** unnamed week | — | **91 of 94 (96.8%)** | 128 of 132 | 34 of 37 |
| gap from the named week | — | 1: 4 · 2: 3 · 3: 46 · 4: 22 · 5+: 29 | 1: 20 · 2: 23 · 3: 40 · 4: 31 · 5+: 52 | 1: 10 · 2: 1 · 3: 7 · 4: 15 · 5+: 11 |
| unnamed weeks' phase | — | base 30 · build 53 · peak 21 | base 31 · build 85 · peak 50 | build 39 · peak 5 |
| unnamed rise, p10 / median / p90 | — | 20 / **21** / 27% | 20 / 22 / 32% | 21 / 24 / 33% |
| named rise, median (multi plans) | — | 28% | 33% | 35% |
| unnamed ÷ named, median / p90 | — | **0.86** / 0.98 | 0.81 / **1.07** | 0.71 / 0.91 |
| named week is NOT the largest rise | — | 0 | **23** (the injury arm is preferred) | 0 |
| unnamed weeks on the injury scope (`non_long`) | — | 0 | **44** | 5 |
| by distance, multi / warned | — | 5K 3/46 · 10K 9/59 · **HM 48/107** · M 34/110 | HM 71/157 | HM 23/96 |

**What moved:** nothing. The item's 29% and 30% reproduce exactly on the same sample. The new facts are the
shape: the unnamed weeks are **not** small echoes beside the named one. They sit 3+ weeks away in 9 of 10
cases, every one is above the warn line (≥20%, by construction of §94's cap + tolerance), their median rise is
86% of the named week's, and on the Achilles overlay 23 plans name a week **smaller** than an unnamed one (the
producer prefers the injury arm), with p90 above 1.0.

**Production (read-only):** 43 plans; 1 carries `load_residual_week`. The warned-week count is not stored, so
multi-week reach in production is **not measurable** from stored plans.

**What the evidence cannot show:** whether a runner reads a second mark, or behaves differently in either week
(outcome data does not exist); injury combinations beyond single overlays; foundation-block plans (the grid pins
`plan_start`). Nothing here changes what the engine prescribes, so `measure:fitness` / `cohort:shape` cannot move
and were not run.

---

## 🔍 Conflict scan (sections and amendments)

- **§90 Amendment 3** (the binding): *"When `INV-PLAN-DELIVERED-RAMP` or `INV-PLAN-INJURY-CAP-DELIVERED` warns, the
  plan carries `load_residual_note` and the plan screen shows it."* Its object is the **warning**, and a warning is
  per week (`Violation.week`). The 2026-10-28 sitting satisfied it per plan with one sentence; with a per-week
  surface, a per-plan reading leaves warned weeks undeclared. **Under-met, not contradicted.**
- **Coaching follow-up 2026-11-20 (1)**: the declaration condition (rise above what the plan allows; injury source
  on `non_long`). Extended here from week N to every warned week, per week's own scope. No contradiction.
- **§32 Amendment 1** (2026-11-20): already reads every ramp-flagged week as a residual week. Consistent; this
  ruling makes the runner-facing declaration match what the engine already treats as residual.
- **§94** (warn at delivery, every runner) and **§2 Amendment 2** (predicate frozen pending outcome data):
  untouched. What fires is unchanged.
- **§34**: the mis-citation in §90 Am.3 is already a condition of the placement build (`CP-90-AM3-CITATION-01`).
- **Design ruling 2026-11-20, artifact 3**: *"no other week carries it"*. **Directly contradicted** by this ruling.
  That is Design's check to amend; hand-off below.
- Zone translation: not engaged.

---

## The board

🏃 **Hutchinson (chair).** *"This morning we said the declaration is the point and the location is detail. A
warning is a statement about a week. If 29% of warned plans have two or three of them, and the second one is
86% the size of the first and usually a month away, then naming one is not 'naming the largest', it is
declaring one residual and leaving another undeclared. On 23 Achilles plans the undeclared one is the bigger rise.
That is not defensible to a runner who works it out from the calendar."*

📊 **Seiler.** *"No intensity question. One observation for the record: HM is where this lives, 48 of 107 warned
healthy HM plans. That says something about the HM curve, but the predicate is frozen and that is not this
sitting. On the telling: the instruction for each week is the same, keep the easy days easy. Repeating a correct
instruction on the weeks it applies to is not noise."*

🎯 **McMillan.** *"My worry going in was a calendar covered in marks. Measured, it is at most three on a healthy
plan and 1.3 per warned plan on average (426 marks over 322 plans). A runner told in week 4 that week 4 is heavy
and in week 9 that week 9 is heavy will deal with both. A runner told only about week 9 has a week 4 that looks
ordinary and isn't. No cap on the number of marks: any cap reintroduces the omission."*

🩹 **Willy.** *"This is the remark I asked not to be forgotten, and the shape makes it stronger. Tendon responds
to the rate of change in the week you're in, not to the largest week in the plan. Forty-four unnamed Achilles weeks
are on the injury scope, so for those the undeclared week is exactly the one the injury ceiling exists for. Each
week declares its own scope: if that week carries the injury arm, it says the injury history set the ceiling;
otherwise it says the plan's normal growth."*

⚕️ **Sims.** *"Agree. The 'why' travelling with each week matters more than the count. No sex-specific objection."*

💪 **Blagrove.** No objection from this seat. No strength rule is touched.

## ⚡ Recorded disagreements

None on the ruling. Seiler's HM-curve observation is outside the item (§2 Am. 2 frozen) and recorded only.

## ⚖️ Ruling — **CORRECT**

**Every week a `RAMP_RESIDUAL_CODES` check warns on is declared on that week**, with that week's own declaration
(the follow-up's condition: it rises more than the plan otherwise allows; where **that week** carries
`INV-PLAN-INJURY-CAP-DELIVERED`, it names the injury history as the source). No numbers. No cap on the number of
declared weeks. The plan-level tile, while it exists, may keep naming the largest week; if it does, it must not
read as the only one (words 👤 founder's; rank stays Design's, under the no-displacement condition already ruled).

The producer stamps the full set from the checks' own verdict, as `reconcileLoadResidualNote` already does for one
week: `meta.load_residual_weeks: { week, scope }[]` (distinct weeks; `non_long` wins where both codes warn the same
week), with `load_residual_week` kept as the note's named week so nothing reading it breaks.

**Prescription unchanged.** Builds **with** `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01`, not before it (there is no
week-N surface to extend until that ships).

## 📦 Required artifacts (land with the BUILD)

1. **Principle:** §90 Amendment 3, in the same edit the placement build already makes: *"shows it"* reads **on every
   warned week**, each with its own scope's declaration.
2. **Numeric:** none. `MAX_WEEKLY_VOLUME_INCREASE_PCT`, `INJURY_WEEKLY_INCREASE_CAP_PCT` and `RAMP_RESIDUAL_CODES`
   unchanged; the warn predicate is frozen (§2 Am. 2).
3. **Mechanical check:** `lib/plan/loadResidualNote.test.ts`, the arm the placement build re-points: **set equality**
   between the stamped weeks and the distinct warned weeks over generated plans (healthy and an injury overlay),
   and per week `scope === 'non_long'` iff that week carries `INV-PLAN-INJURY-CAP-DELIVERED`. Falsified by
   restoring the single-week stamp (must go red on the 29% multi-week plans) and by stamping the plan's largest
   scope on every week. Not a `validatePlan` invariant: the stamp is derived from `validatePlan`'s own output, so a
   check inside it would read what it wrote; the test is where the 2026-10-28 binding already lives.

## ↗️ Hand-offs

🧭 **Design Board (one sitting, before the build):** amend its artifact 3 from *"no other week carries it"* to
*"exactly the stamped weeks carry it"*, and rule how more than one mark reads on the strip and on Today. 👤 **Founder:**
whether the plan tile's sentence changes to admit other weeks. No SLT question (FREE, unchanged).

## ⚠️ What this does not prove

- Not that a runner reads or acts on a second mark. No outcome data.
- Production multi-week reach is unmeasured (stored plans keep one week; 1 carrier in 43 plans).
- Rates are on cohortGrid stride 23 and two single-injury overlays, not a runner population; foundation-block
  plans and multi-injury histories are not reached.
- The rise figures are the checker's whole-week (or non-long) percentages, not load in any physiological unit.
