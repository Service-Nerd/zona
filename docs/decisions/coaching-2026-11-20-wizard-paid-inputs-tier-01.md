# Coaching Board: is `overdo`'s effect the right dose, now every runner is asked? (2026-11-20, WIZARD-PAID-INPUTS-TIER-01)

**Follow-up sitting.** The SLT ruled this morning that `hard_session_relationship` and `terrain` are FREE, every answer
(`docs/decisions/slt-2026-11-20-wizard-paid-inputs-tier-01.md`), and handed two questions here:

1. For 96.0% of `overdo` plans the whole effect is §96's Zone 2 cue on the long run; the prescription changes on 4.0%
   (§96's veto on §89 early onset). Is that the right dose for the runner who says "rein me in", now that every free
   runner will be asked?
2. The injury × answer interaction is unmeasured (the SLT's sample pins `injury_history: []`).

Both are on existing doctrine (§96, §110 + Am. 1, §35, §24c, §40b Am. 3). No new principle was assumed going in.

**Trigger:** soft. No doctrine file is edited by this sitting; the ruling amends §96's placement wording and §24e's
wording, which lands with the build. Blagrove's seat is silent (no strength question).

---

## 1. Analysis, before any seat spoke

### 1a. Evidence

```
npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01-coaching.ts        # all four parts, ~45s
npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01-coaching.ts --a    # part A only
npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01-coaching.ts --d    # part D only (ultra)
```

The two attribution checks in 1b and 1d (step-back flag; ultra misses by week) were a throwaway scratch script, not
committed; both counts are stated where used.

Read-only: plans generated in memory, tier `free`, no production read, no `validatePlan`. Population: `cohortGrid()`
(the wizard's shape), stride 23 × 2,000 for (A) (the SLT's exact sample), stride 67 × 600 per injury overlay for (B)/(C).
Injury spellings are the wizard's (`GeneratePlanScreen.tsx`). "No answer" deletes the field, as the SLT script did.

### 1b. (A) What `overdo` does, re-derived

| | SLT figure | re-measured |
|---|---|---|
| built of 2,000 | 1,924 | **1,924** |
| prescription changes | 76 (4.0%) | **76 (4.0%)** |
| copy only (the cue) | 1,848 (96.0%) | 1,848 (every plan carries the cue at least once: **1,924 of 1,924**) |

**Direction of the 4.0%:** quality sessions fall in 75 of 76 (−2: 30, −3: 32, −4: 8, −5: 4, −6: 1; one 0), total km
falls in 48 and rises in 26. That is §96's own table: vetoing early onset returns the runner to the standard plan; it
never cuts below it.

**What the cue actually reaches. §96 says "every long run, at every distance and in every phase". It does not.**

| long runs in `overdo` plans | count | share |
|---|---|---|
| all | 25,218 | |
| carry the cue | **17,037** | **67.6%** (1,649 of them already carried it via §24c) |
| deload weeks (base 2,523 · build 2,112) | 4,635 | no cue: inherited from §24c's `!isDeload`, never argued in §96 |
| §47 peak step-back, plain "Long run — Zone 2" | 735 | no cue: §47's rewrite replaces `coach_notes` wholesale (`ruleEngine.ts` ~4950). Checked: **735 of 735** carry `week.peak_stepback`, 0 do not |
| negative-split finish (§24d) | 1,476 | no cue: built by a different branch |
| race-pace segment (§24 / §24b / §25: MP, HM-pace finish, MP + HM finish) | 1,335 | no cue: built by a different branch |

Cues per plan: median 7 (min 7, max 14); median 15.9% of a plan's running sessions. Cue-carrying long runs at the
three-note cap: 765 (4.5%). **Notes displaced by the cue: 0** in prescription-identical plans, and **0** cue-carrying
long runs also prescribe a race-pace segment. (A first cut reported 107 displaced notes; all were slot-by-slot
comparisons inside the 76 plans whose weeks had shifted, and the arm is now restricted to unchanged prescriptions.)

### 1c. (B) Injury × answer

Each answer vs no answer, 575 built per overlay:

| injury | baseline early onset | `overdo`: prescription / copy only / cue reach of long runs | `avoid`: prescription / mean Δ quality sessions | `love`: prescription |
|---|---|---|---|---|
| none | 24 | 4.2% / 95.8% / 67.8% | 44.0% / −0.13 | 13.0% |
| Knee | 0 | **0.0% / 100%** / 67.8% | 39.8% / 0.00 | **0.0%** |
| Shin splints | 0 | 0.0% / 100% / 67.8% | 39.8% / 0.00 | 0.0% |
| Achilles | 0 | 0.0% / 100% / 67.8% | 35.3% / −0.02 | 0.0% |
| Back | 0 | 0.0% / 100% / 67.8% | 41.2% / −0.02 | 0.0% |
| Hip | 0 | 0.0% / 100% / 67.8% | 42.3% / −0.02 | 0.0% |
| Plantar fasciitis | 0 | 0.0% / 100% / 67.8% | 34.3% / −0.02 | 0.0% |

- **`overdo` × any injury is the cue and nothing else**, because §89 already vetoes early onset for any injury history
  (0 of 575 in every overlay), so §96's veto has nothing left to veto.
- **`avoid` keeps its effect under injury** (34–42%): §110 Am. 1's smaller quality session, not fewer sessions (Δ count
  ≈ 0).
- **`love` × any injury moves nothing** (the §35 stretch rung is tissue-gated). Part (C): with no change, the plan says
  nothing for **159 of 575 (27.7%)** under Knee, Achilles or Plantar, every one of them `training_age: '5yr+'`, because
  `hard_pref_note` for `love` fires only below 5yr+. (84 of 575 with no injury, same mechanism.)

### 1d. (D) Ultra

§24e: ultra long runs carry *"no embedded pace segments, no Z2-ceiling cues, no negative-split finishes"*. With `overdo`
the cue lands on **18 of 21** (50K) and **21 of 25** (100K) ultra long runs at 50/70/90 km a week (`ultraFuelNote`'s
runner without `fitness_level`, which the wizard never sends); every ultra long run without it is a deload week (checked
at 70 km/wk: 3 of 3 at 50K, 4 of 4 at 100K). The §24e fuelling cue survives (4 of 4 every case), and no
prescription changes. §24e's text and §96's text contradict; the engine follows §96.

### 1e. Conflict scan (amendments included)

- **§96** (CB-HSR-01): the ruling under review. Its *Deliberately NOT done* list (no quality suppression, no deload
  change, no §2 ramp tightening) and its *"does not cut below baseline"* are the binding precedents.
- **§24c**: source of the cue and of the `!isDeload` condition §96 inherited without stating it.
- **§110 + Am. 1** (CB-HSR-AVOID-01): *"`overdo` is paced, `avoid` is spared"*. Any proposal to give `overdo` a smaller
  or rarer quality session conflicts with it. McMillan's recorded dissent there names the missing data
  (first-quality-session adherence by answer).
- **§35**: the upward ladder; §96 built its downward rung.
- **§79** asymmetry: caution self-report trusted more than ambition self-report.
- **§89 / §91 / §98**: onset gate; injury is an absolute veto, which is why (B) shows 0%.
- **§47 + Am. 3**: the step-back rewrite that strips the cue.
- **§24 / §24b / §24d / §25 / §80**: long runs with a non-Z2 finish or time-on-feet note.
- **§24e**: ultra wording, contradicted (1d).
- **§40c**: a suppressed or unrealised target is stated, never absorbed silently (relevant to `love` × injury).
- **§21 / §90**: injury load caps, which already bind for every injured runner.
- **P-02 veto** (`coaching-rulings.md`, 09-20): no intensity dial; `hard_session_relationship` is the expression.
- Zone translation: the cue is a Zonna Z2 ceiling (easy top). No three-zone label is in play.

### 1f. What the evidence can and cannot show

It shows what the engine prescribes and says for each answer, at both injury and no-injury, and where the cue does and
does not land. It cannot show whether an `overdo` runner holds the zone when the cue appears: adherence by answer is
unmeasured, and production has **one** `overdo` plan (SLT `--live`), so it cannot be measured yet. `measure:fitness` was
not run: nothing ruled here changes a distance, duration, session or week; it changes where an existing note appears.

---

## 2. The board

🏃 **Hutchinson (chair).** The SLT's worry is that 96% is "just a sentence". Read it the other way. For 96% of these
runners the plan they get *is* the standard plan, and §96 said that was the point: the brake declines to accelerate,
it does not punish. The 4% it does change, it changes in the conservative direction, 75 of 76 with fewer quality
sessions. Asking more of this answer would mean cutting work on a self-report whose predictive value for injury is
thin; I wrote that caveat into §96 and nothing since has moved it. What has moved is the text. "Every long run, in every
phase" is false: two in three. Some of the gap is right and some is an accident, and the constitution should say which.

📊 **Seiler.** The frequency is right. One cue a week, on the session where the drift is time-dependent, is 16% of the
running sessions, and the long run is where a recreational runner turns an easy session into a threshold one, because
cardiac drift is a function of time. Putting it on every easy run is how you teach someone to ignore it. Where I differ:
a deload long run is short, so drift has less time to build. I would not spend the cue there. The ultra contradiction is
a wording problem: a Z2 ceiling is the definition of §24e's "Zone 1 to 2", not a pace overlay, so §24e's sentence should
say pace overlays and stop.

🎯 **McMillan.** Stephen, I disagree on the deload. The runner who says "I overdo it" does not overdo the hard week. They
overdo the week that feels easy: the deload, the step-back, the Saturday they feel fresh. That is exactly where the plan
currently goes quiet, and on the step-back it goes quiet because another rule overwrote it, not because anyone decided.
Put it on every long run that is meant to be all easy, and nowhere that asks them to finish at pace, because a cue
saying "back off when HR climbs" on a run whose last 35% is at half-marathon pace is a contradiction they will notice.
I am still not asking for more than a cue. Without adherence data, more dose is guessing.

🩹 **Willy.** The injury half answers itself and I want it written down so nobody re-opens it. An injured runner who
also says "overdo" gets no extra prescription, because §89 has already refused them early onset and §21/§90 already cap
their load. Should the two compound, a tighter cap for the injured overdoer? No. The injury caps are a tissue judgement;
`overdo` describes behaviour on the day. Stacking a second load cut on a self-report has no evidence behind it, and §96
already declined to tighten the ramp per persona. What the injured overdoer needs is the thing that targets the
behaviour, and that is the cue, on the weeks they would ruin. I side with Greg on the deload. On `love` × injury: the
injury correctly switches the stretch rung off, but for 28% of those runners the plan then says nothing at all. §40c
says that is not allowed. The words are not mine.

⚕️ **Sims.** No objection on the dose. The cue reads heart rate and tells the runner to walk, which holds whatever is
driving the climb: heat, sleep, luteal-phase elevation. That is the right instrument for a population we cannot see the
cycle of (ENGINE-03 is still blocked). I would not let anyone read `overdo` as a screen for compulsive training or low
energy availability; we cannot ask that and should not infer it from one tap.

💪 **Blagrove.** No strength question. Silent.

---

## 3. Recorded disagreements

- **Deload-week long runs: Seiler vs McMillan and Willy.** Seiler: drift is time-dependent and a deload long run is
  short, so the cue is low-value there and dilutes it. McMillan and Willy: the overdoer's failure is the easy-feeling
  week, so the cue belongs most where the plan expects the least. **Chair sides with McMillan and Willy**, as the reading
  closer to §96's stated intent ("every phase"). What would settle it: long-run time above the Z2 ceiling on deload vs
  build weeks for `overdo` runners, from the activity log. Not measurable at one live `overdo` plan.
- **Dose itself:** no seat argued for more than the cue and the onset veto. McMillan's §110 dissent (adherence data) is
  re-recorded as the evidence that would re-open it.

---

## 4. Ruling: CORRECT WITH AMENDMENT

1. **The dose is ratified.** §96's two effects (the §89 onset veto, the Z2 cue on the long run) are the whole
   prescription for `overdo`, at every tier, with or without an injury. No quality reduction (§110: paced, not spared),
   no deload change, no ramp or cap tightening, and **no compounding with injury caps**: measured, `overdo` × any injury
   is 0.0% prescription change because §89 already vetoes onset, and the injury caps already bind.
2. **Placement is amended, because §96's text overstates reach (67.6%, not every long run).** The cue goes on **every
   long run whose prescription is wholly Zone 1–2**, which:
   - **adds deload-week long runs** (4,635 of 25,218 sampled); Seiler dissents;
   - **adds §47 step-back long runs** (735). This half is a defect against §96's own text: §47's wholesale `coach_notes`
     rewrite strips it. The build preserves it rather than re-deriving it;
   - **excludes, by name, long runs with a race-pace segment or a negative-split finish** (§24, §24b, §24d, §25: 2,811),
     because a ceiling cue contradicts their prescribed finish. Today's exclusion is an accident of branch order; it
     becomes doctrine.
   Arithmetic on the measured counts: reach 67.6% → **88.9%** (22,407 of 25,218). Not regenerated; the build measures it.
3. **§24e's wording is amended**: its prohibition is on pace overlays (segments, negative splits, pace notes). §96's Z2
   ceiling is Zone 1–2 execution, consistent with §24e's intent, and stays on ultra long runs (18/21, 21/25 measured;
   fuelling cue survives).
4. **`love` × injury: the prescription is correct** (the stretch rung is tissue-gated), **and the silence is not**:
   §40c requires the plan to say so for the 27.7% of injured `love` runners (all 5yr+) who currently hear nothing. The
   words are the founder's; this board sets only the meaning: the preference is noted, and the injury history, not
   training age, is why the plan does not add more.

### Conditions on the build

- `measure:fitness` and `cohort:shape` are expected unmoved (notes only); the build states both.
- The three-note cap: 765 cue-carrying long runs (4.5%) already sit at three notes. The build measures **notes displaced
  by the cue = 0** on the newly reached deload and step-back long runs, as this sitting did, before shipping.
- No new copy: the cue string is §24c's, unchanged.

---

## 5. Required artifacts (with the build, not here)

| | |
|---|---|
| **Principle** | §96 Amendment 1: placement = every wholly Zone 1–2 long run, including deload and §47 step-back; excludes race-pace-segment and negative-split long runs; injury × `overdo` = cue only, no compounding (with the (B) table). §24e wording: "no pace overlays", naming §96's cue as consistent. §40c note for `love` × injury cites this ruling |
| **Numeric** | none new: `OVERDO_IS_A_BRAKE` stays the switch; the placement is a structural condition, not a tunable |
| **Invariant** | `INV-PLAN-OVERDO-BRAKE` gains a cue arm (today it checks only the onset half, which is why §47's strip went unseen): `overdo` ⇒ every wholly-Z2 long run carries the cue, and no segmented or negative-split long run does. Falsified by restoring §47's wholesale rewrite (must go red on the 735), and woken in the liveness harness by the `overdo` axis `targetedGrid` already carries |

## 6. Hand-offs

- 👤 **Founder:** the words of the `love` × injury note (§40c). No other copy.
- 🧭 / 💼: none. The SLT's tier and the Design Board's step questions are untouched.

## 7. What this does not prove

- Not that the cue changes behaviour. Adherence by answer is unmeasured; one live `overdo` plan.
- Not the 88.9% reach: arithmetic on counts, not a regenerated plan set.
- Not ultra at population scale: six fixed ultra runners, no ultra grid exists.
- Injury overlays are single injuries on `cohortGrid` rows; combinations (e.g. Knee + Achilles) and the `targetedGrid`
  shape were not run.
- `measure:fitness` not run (nothing ruled changes a distance, duration or session).
