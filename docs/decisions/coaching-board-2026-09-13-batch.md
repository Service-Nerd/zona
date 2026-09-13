# Coaching Board — batch sitting, 2026-09-13

Seven backlog items that needed a board ruling, taken together at the founder's
request ("take them and get the answers we need"). Each was given the full
treatment (trigger, conflict scan, five seats, ruling). Evidence for the
measurement-dependent items was gathered first; the numbers are cited inline.

Chair: Hutchinson. Zone-model translation rule applied throughout (Zonna Z2 =
easy, Z3 = grey; Seiler's "Zone 2" = Zonna Z3).

---

## 1. CHARITY-CAP-ABSFLOOR-01 — absolute-km floor under the delivered caps → **SHIPPED**

**Trigger:** `generationConfig.ts`, `CoachingPrinciples.md §90/§94`, `invariants.ts` — hard.
**Proposed change:** the §90/§94 delivered-volume warns fire only when the week-on-week rise clears an absolute-km floor as well as the percentage.

**Conflict scan:** touches §90, §94; references §12 (injury cap), §2 (ramp), §52 (long-run exempt, unchanged), §34 (honest residual). No conflict — it narrows what the *checker* reports; the engine still trims to §12.

**Board.** *Willy (lead):* a percentage on a low base magnifies a clinically trivial rise; a non-long-run floor separates a tissue-meaningful step from arithmetic noise. *Hutchinson:* checker-sharpening, not a prescription loosening — the producer is untouched; defensible. *Seiler:* no §1 impact (session-count, not volume) — no objection. *McMillan:* a 2–3 km wobble in a real week is noise; flagging it trains the team to ignore the warn — sharpening is correct. *Sims:* approve **at 3 km**, object to 5 km — a 5 km floor would mask the genuine 4–7 km steps that appear on low bases.

**Measurement (2,790-plan injury/low-volume grid):** flagged non-long-run rises span **1–7 km (median 4)**. A 3 km floor silences the ≤3 km noise (**49%** of flags) and keeps **every rise ≥3 km**. Post-ship sweep: `INV-PLAN-INJURY-CAP-DELIVERED` 23.8% → **15.2%**, both invariants still wakeable.

**Ruling: CORRECT WITH AMENDMENT** — floor = 3 km (Sims' condition binding), applied to §90 and §94, gates the warn not the producer.
**Artifacts (commit `6b47211`):** §90/§94 amendments · `DELIVERED_ABSOLUTE_FLOOR_KM = 3` · both delivered invariants gated + `plan-invariants.md` rows.

---

## 2. §23/§46 marathon-maintenance recalibration (deferred by the chair at §106) → **CORRECT-in-principle; the lever is NOT §23/§46; its own build**

**Trigger:** `generationConfig.ts` / `CoachingPrinciples.md` — hard, but see ruling.
**Question:** now §106 is live, is the ~100% "maintenance" rate on time-target marathon plans coaching-correct, and should §23's ratio or §46's floor be recalibrated?

**Measurement (re-run 2026-09-13, §106 live):** time-target marathon = **54/54 = 100% maintenance** (cohort), **99.8%** (1,150/1,152 expanded), spread **0–0.7pp** — carries no information (Willy's noise bar is ~29pp exceeded). Finish-goal marathon, by contrast, is **51.9%** and varies 32.5%→95.8% with volume — information-bearing. §106 changed nothing here: the time-target subset was already saturated. **Why it is pinned:** three stacked gates — §46 floor (low vol), §23 ratio (mid vol), and at high vol **§24's peak-LR specificity floor (31.7 km = 0.75 × race) is structurally unreachable under `LONG_RUN_CAP_MINUTES.MARATHON = 210`** (210 min ≈ 30.5 km at a 4:15 easy pace). So a runner peaking at 80 km/wk with a 30.5 km long run — plainly **building** — is labelled maintenance by §24.

**Conflict scan:** §23, §46, §24, §45, §52, §106. The finding touches §24's interaction with `LONG_RUN_CAP_MINUTES`, which the chair's original deferral (scoped to §23/§46) did not name.

**Board.** *Hutchinson:* the label is wrong, not the plan — the §106 pattern exactly ("every honesty layer working on a plan that should never have been maintenance"). A time-capped long run at its safe ceiling is §52/§45's owned trade, not a failure to overload. *Willy:* the 210-min cap is correct and must not move — a longer marathon long run is the classic injury vector. *Seiler/McMillan:* recalibrating §23/§46 alone moves only the low/mid-volume cases; the high-volume tail stays maintenance on §24. *Sims:* no sex-linked objection.

**Ruling: CORRECT WITH AMENDMENT — but not shippable in this batch.** A time-target marathon must not be classified `maintenance` **solely** because the §24 peak-LR specificity floor is unreachable under `LONG_RUN_CAP_MINUTES` (the long run at its time-safe ceiling is §52/§45's trade, not a maintenance signal). **This relabels ~100% of time-target marathons (maintenance → build)** — a cohort:shape move of the exact magnitude that gate exists to force a DECLARATION of. It therefore gets its own focused build: the §24-vs-cap exclusion, a fresh `cohort:shape` baseline, and a before/after coach review. Filed as **MARATHON-MAINT-LABEL-01**. The deferred recalibration of §23/§46 is subsumed by it — those two are not the lever.

---

## 3. SESSION-KM-02 — the two remaining prescription sites → **CORRECT WITH AMENDMENT; its own build**

**Trigger:** `ruleEngine.ts` (soft) — the `?? 0` swap is a proven no-op (parity byte-identical); the real question is prescription.
**The board's three questions (from the measurement brief):** (1) minutes or km for a duration-anchored peak long-run step-back? (2) is a beginner's missing step-back a harm worth prescribing for? (3) leave §52's inert floor or fix the producer?

**Board.** *McMillan/Hutchinson:* **minutes** — a beginner's plan speaks in minutes (§80 duration-anchoring); a single "14 km" week in a "90-minute" plan breaks the runner's model. *Willy:* the peak long-run step-back is real pre-taper recovery value; denying it to beginners **purely because they are duration-anchored** is the SESSION-KM silent-pass class, not a coaching choice — worth fixing, small harm but real. *Seiler:* no §1 impact. *Sims:* no objection.

**Ruling:** (1) **minutes** — apply `PEAK_LR_STEPBACK_MAX_PCT` to duration for duration-anchored plans. (2) **yes, worth fixing**, expressed in minutes. (3) **leave §52's floor inert** (0 measured breaches) but sighted via `sessionKmForCheck`; do not add a producer change for a zero-breach case. **Not shipped inline:** it is prescription-changing (beginners gain a step-back week), needs a working detector first, and the two further gates (`ruleEngine.ts:3740`, `:3767`) that also block must be handled together. Filed as **PEAK-LR-STEPBACK-MINUTES-01**, its own build + `cohort:shape`.

---

## 4. ZONE-BAND-02 §25 remainder → **NO NEW SITTING NEEDED — defect-close build**

§107 already ruled (2026-09-12, CORRECT WITH AMENDMENT) and its own scope note names §25's two producers (`hm_pace_long_run` 108, `mp_long_run` 72) as **"the remainder of the board's ruling ... open work, not a silent gap."** §107 adds no numeric and §25's segment fractions already exist and are already read. Recording `lr_segment_pace` on these sessions **records what the engine already prescribes** → defect-closing, restoring documented intent, **ADR-017 board-exempt** (same class as the §24b half that already shipped).

**Ruling: EXEMPT — buildable now, no board.** Build (one commit): (a) `raceSpecificLongRunSession()` writes `lr_segment_pace` (at goal pace — MP/HM — so **no** §24b HM cap applies; `INV-PLAN-5K10K-LR-PACE-CAP` stays 5K/10K-only), (b) derive `session.zone` from the segments (§84 Amendment 1 step 2), (c) broaden `INV-PLAN-LR-SEGMENT-RECORDED` to HM/marathon **in the same commit** or it ships with the 180-session baseline §107 warned about. Filed as **LR-SEGMENT-RECORDED-§25**.

---

## 5. TREND-COHORT-PACE-BAND-01 → **INSUFFICIENT EVIDENCE / declined as specced; keep the disclaimer**

**Question:** band the HR-trend cohort on pace (not just distance) so "at the same pace" is true by construction and the confound disclaimer becomes unnecessary.

**Measurement:** within-±15%-distance easy-pace SD ≈ **40 s/km** (production, thin: 3 users/19 runs). To make the comparison true by construction the pace band must be ~±20 s/km (< the 20 s/km confound floor), which retains only **~38%** of the cohort — the card goes **dark for ~60%** of current qualifiers (most sit near the `MIN_TOTAL_RUNS = 6` floor), with a second failure mode through the per-bucket minimum. The precise drop-out **cannot be measured from the repo** — it needs the per-user in-band run-count and pace-SD distribution from Supabase.

**Board.** *Hutchinson:* a disclaimed comparison is more informative than no card; silencing the majority to delete a disclaimer is a bad trade. *McMillan:* the disclaimer is honest and the runner still sees both numbers. *Seiler:* the confound test (TREND-PACE-CLAIM-01) already withholds the *conclusion* correctly.

**Ruling: INSUFFICIENT EVIDENCE (declined as specced).** Keep the shipped disclaimer; do **not** narrow the cohort. Revisit only with the cohort-scale re-measure of `TREND_PACE_CONFOUND_SEC_PER_KM` once ≥50 users provide the distribution (the config comment already asks for this). No code. Data-gated.

---

## 6. CAT-VO2-TIERA — the three blocked shapes → **DECLINED; concept ruling stands, delivery not worth the doctrine cost**

**Question:** amend §8 (mixed-session VO2 dose model) to deliver A1 descending pyramid + A6 10K cutdown, and §53 (rotation coverage) to deliver A4 broken ladder.

**Board.** *Seiler/Hutchinson:* A1/A6 spend only **2–6 min at Z4–5**, below §8's 12–18 min dose band — **§8 rejects them correctly**; a session mostly below vVO2max is not a VO2 dose, and weakening the band to admit them would mislabel the stimulus. They are real *mixed/threshold* sessions, mis-categorised as VO2 — a home for them is a **new mixed category**, a separate catalogue project, not a §8 weakening. *McMillan:* the shipped VO2 pool is already 6 deep (classic/short/long/30-30/rolling + cv/hills) — this is variety, not a gap. *Willy:* A4 is a redundant 7th I-anchored variant that §53's least-used rotation surfaces in **0/216 plans**; a round-robin change to force it reshapes every plan's session draw across all distances — wide blast radius for dead weight.

**Ruling: INCORRECT to amend §8 or §53 for these shapes.** §8's dose band stays bounded; §53's rotation stays least-used. The 2026-09-06 *concept* ruling (the shapes are coaching-valid) is **not reversed** — but delivering them costs a doctrine change the board will not make on this evidence. A1/A6 could return only inside a future "mixed-session" category (SLT value call, not a correctness block); A4 and B0 stay shelved. Delivery path **closed**. No code.

---

## 7. CAT-ULTRA-FUELLING-01 → **CORRECT (concept already ruled); spec'd, small build queued**

Concept ruled CORRECT 2026-09-10 (Sims: under-fuelling on 4–6 h efforts is the RED-S / low-energy-availability vector, worse for the women + masters this serves). The mis-shaped `fuelling_practice_from_week: 8` was struck. `fuel_every_mins` already lives in the catalogue on `ultra_race_sim` (25) and `time_on_feet` (30).

**Ruling: CORRECT — re-spec as a phase-anchored coach note.** A fuelling cue on the ultra long run during the **peak/specific phase** for 50K/100K (a `coach_notes` line, not a scheduled session), mirroring the `fuel_every_mins` model. Trigger: `distKey ∈ {50K, 100K}` ∧ peak phase ∧ long-run session. Copy in Zonna voice (dry, practical). Small build; no numeric change (the cadence already exists). Filed as **ULTRA-FUEL-NOTE-01**.

---

## Summary

| # | Item | Ruling | Outcome |
|---|---|---|---|
| 1 | CHARITY-CAP-ABSFLOOR-01 | CORRECT W/ AMENDMENT | **Shipped `6b47211`** |
| 2 | §23/§46 marathon maintenance | CORRECT W/ AMENDMENT | Lever is §24/210-min, not §23/§46 → **MARATHON-MAINT-LABEL-01** (own build) |
| 3 | SESSION-KM-02 | CORRECT W/ AMENDMENT | Minutes; §52 inert → **PEAK-LR-STEPBACK-MINUTES-01** (own build) |
| 4 | ZONE-BAND-02 §25 | EXEMPT (defect-close) | Buildable now, no sitting → **LR-SEGMENT-RECORDED-§25** |
| 5 | TREND-COHORT-PACE-BAND-01 | INSUFFICIENT EVIDENCE | Keep disclaimer; data-gated. **Done.** |
| 6 | CAT-VO2-TIERA | INCORRECT (to amend §8/§53) | Delivery closed; concept stands. **Done.** |
| 7 | CAT-ULTRA-FUELLING-01 | CORRECT | Spec'd → **ULTRA-FUEL-NOTE-01** (small build) |
