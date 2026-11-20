# Coaching Board — 2026-11-20. `INJURY-HIP-INERT-01` — keep the Hip chip, give it a run effect, or remove it?

**Trigger:** soft, qualifies (it decides whether a wizard input reaches the prescription). No doctrine file is
edited here. Blagrove sits: the strength effect is half the question.
**Proposed question, one sentence:** before the 2026-12-12 removal default, does the Hip chip earn its place?
**Item:** `docs/releases/backlog.md` § `INJURY-HIP-INERT-01`, its 2026-11-20 validity-sweep rewrite, and the ruling
in `coaching-2026-11-14-wave3-wizard-inputs.md` §2 (*"either given a prescription effect or removed"*; default
removal on 12-12 unless `STRENGTH-ENGINE-01` gives hip history a strength effect).
Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims, Blagrove.

---

## 📐 Analysis: the item's figures re-derived

Evidence: `scripts/board-evidence-injury-hip-inert-01.ts` (read-only).
`NODE_ENV=production npx tsx scripts/board-evidence-injury-hip-inert-01.ts 23`. Counterfactual on the whole
cohortGrid at stride 23: each input generated twice, `injury_history: []` and `['Hip']` (the wizard spelling),
composed as the runner receives it. A one-off breakdown of the differing pairs was run from the scratchpad and is
reproduced by the same comparison (prescription = any session's type, distance, duration or `catalogue_id`).

| claim | item / 11-14 | **re-measured today** |
|---|---|---|
| Hip changes the run plan | *"moves no number in any case measured"* (11-14); *"no run-plan effect"* (sweep) | **FALSE.** Weeks differ on **334 of 1,728 pairs (19.3%; 76 inputs threw on at least one side and are excluded)**; prescription differs on **285 (16.5%)**, notes/labels only on 49 |
| …what moves (overlapping) | — | quality onset later 74 · fewer quality sessions 73 · peak weekly km 75 · step-back notes 2→1 on 31; the rest **not attributed** |
| …where | — | concentrated where §89 can fire: `recent_quality_training: 'regular'` strata 104/288 and 105/288 vs 25–35/288 elsewhere; every distance, every level |
| Hip's strength effect | `INJURY_LOADED_MUSCLES.hip` slows `suggestLoad` | **TRUE.** Wizard `Hip` matches strength tag `hip` (`hasInjuryKeyword`, `runContext.ts:66`); slows progression on **47 of 89** non-warm-up lifts (glutes, abductors, adductors, hip flexors). Avoids no lift; not in `PLYO_RESTRICTING_INJURIES` |
| live hip runners | 4 | **4** (of 43 plans; knee 6, plantar 4, achilles 3, shin splints 3, back 1) |
| strength reach | 1 `strength_plans` row, 0 of 4 hip runners | **1 row, 0 of 4**; 4 `strength_lift_logs` rows in total |

**Why the 11-14 table said "nothing":** Hip has no hip-specific run rule (the old `hip_flexor` base rule was dead
and is deleted, `injuryScope.ts` header). What it does carry is every **any-injury** gate, read as
`injury_history.length > 0`: §89's absolute injury veto on early quality onset (`ruleEngine.ts:7308`), §47's
consecutive-peak exception (`:4843`, needs no injury) and §47 Amendment 2's volume step-back scope (`:5115`). A
counterfactual on a runner none of those can reach shows nothing. Today's sibling script
(`board-evidence-injury-recency-01.ts`) uses `recent_quality_training: 'occasional'`, `training_age: '1-2yr'`,
which §89 can never reach; the 11-14 script is not in the tree, so its inputs could not be re-run. The
generalisation *"for anybody"* does not survive the grid.

⚠️ **This also corrects today's validity sweep**, which restated the 11-14 claim as *"Hip changes nothing in the
RUN plan"*.

**What the evidence cannot show:** whether a hip history should carry a hip-specific load rule (no outcome data,
and no measurement here argues for a number); how many of the 4 live hip runners are §89-eligible (not measured);
any strength outcome (0 hip runners have a strength plan).

---

## 🔍 Conflict scan

- **§89** (*"An injury history is an absolute veto"*, Willy/Sims, 2026-09-06): Hip is an injury history. Removing
  the chip would **silently re-admit** hip-history runners to early onset. A removal is therefore a prescription
  change against §89, not a tidy-up.
- **§47 / §47 Amendment 2**: both read any injury. Kept as they are; see "Observed, not filed" on Am. 2's stated
  reason.
- **§12 / §90 Amendment 2**: the volume cap (knee, shin) and the delivered checker cohort. Hip is outside both;
  not widened here (the 11-14 board: *"does not invent caps without evidence"*).
- **`INJURY-RECENCY-01` (2026-11-20)**: its *longer ago* for Back/Plantar is defined as "lift the long-run cap,
  **keep the any-injury gates**", and it was measured by substituting `Back→Hip`. That is, Hip is already the
  engine state "any-injury gates only". Consistent with keeping it; removing it would leave that ruling's
  measurement proxy describing a chip that no longer exists.
- **StrengthPrinciples S14**: `INJURY_LOADED_MUSCLES` is the ruled strength effect (Willy, 2026-10-18). Satisfies the
  11-14 exit condition as written.
- **SLT 2026-10-28** *"if nothing changes, it is not collected"*: something changes, on both engines.
- Zone translation: not engaged.

---

## The board

🏃 **Hutchinson (chair).** *"We ruled on a measurement that answered a narrower question than the one we wrote down.
'Moves no number in any case measured' was true of the cases; 'changes nothing for anybody' was not, and one in six
plans on the grid says so. The removal default rests on the second sentence. It goes."*

🩹 **Willy.** *"I said the honest remedies for a hip history are strength and cadence, not volume. Strength now does
it: slower progression on glute and hip lifts is exactly the right shape, conservative, not avoidance. And on the
run side the chip is doing what §89 asked, keeping an injured runner off early quality. I still would not invent a
volume cap for the hip; nothing measured supports one. Keep it."*

⚕️ **Sims.** *"A 'hip' history in a woman runner is often bone: femoral neck and pelvic stress reactions present as
hip pain. That is the injury you least want re-admitted to early intensity because the chip was tidied away. Keep
it, and keep it out of the volume-cap argument; the onset veto is the protection that matters."*

🎯 **McMillan.** *"I said I'd rather it earned an effect than vanished. It turns out it had one; we didn't look in the
right place. I'd still like a hip-specific effect one day, but not on no evidence."*

📊 **Seiler.** *"The visible run effect is fewer and later quality sessions on about 4% of plans (74 and 73 of 1,728). That is an
intensity-distribution consequence of §89, already ruled. No objection."*

💪 **Blagrove.** *"The strength effect is the right one for this tissue: technique and load before impact, and slow
the glute and hip lifts rather than remove them. Forty-seven of eighty-nine lifts is broad, because glutes are in
every squat, hinge and lunge, but 'easy counts as right' only slows a step; it never withholds the lift. Hip should
not restrict plyometrics on its own, and it doesn't. The honest caveat is reach: it applies to nobody yet, one
strength plan exists. That is a reason to keep the input, not to remove it."*

## ⚡ Recorded disagreements

- **McMillan (a hip-specific run effect is still wanted) vs Willy (none on present evidence).** Not settled; would
  need outcome data or a principle-level case for a specific cap. Not filed.

## ⚖️ Ruling — **CORRECT: KEEP the chip. The 2026-12-12 removal default is vacated. No new run rule.**

The Hip chip stays as collected. Its effects are the any-injury gates on the run plan (§89 onset veto, §47 and §47
Am. 2 scope) and S14's load pacing on the strength plan. The 11-14 ruling's condition (*"a prescription effect or
removed"*) is met on both engines; its premise (*"changes nothing"*) is corrected. The 🧭 Design Board hand-off to
remove the chip is **withdrawn**. What the build must do is stop it going inert silently, which is the failure the
item was really about.

## 📦 Required artifacts (land with the BUILD)

1. **Principle:** a one-paragraph amendment to **§89** recording that every wizard injury chip, **Hip included**, is
   an injury history for the any-injury gates, and that removing a chip is a §89 prescription change for that
   cohort. One sentence in **StrengthPrinciples S14** naming the wizard's `Hip` as reaching the `hip` tag.
2. **Numeric:** none. `STRENGTH_CONFIG.INJURY_LOADED_MUSCLES.hip` and every run constant unchanged.
3. **Mechanical check:** a test (e.g. `lib/plan/injuryChipEffect.test.ts`) iterating the wizard's `INJURIES` list
   (exported from one owner rather than restated) and asserting each chip has a measured effect. For `Hip`:
   (a) a §89-eligible fixture onsets quality early with `[]` and not with `['Hip']`;
   (b) `planToRunContext` yields `injury_tags` containing `'hip'`. Falsified by dropping `'hip'` from
   `INJURY_TAGS` and by making §89's `injuryFree` ignore one chip. Not a `validatePlan` invariant: it is a property
   of input → engine across a counterfactual, which a single plan cannot see.

## ↗️ Hand-offs

None. 🧭 Design Board's removal step is withdrawn (the chip and its copy are unchanged). No SLT question (FREE).

## ⚠️ What this does not prove

- Not that the any-injury gates are the right dose for a hip history in particular; they are §89's ruling,
  applied as written.
- The run-effect mechanisms are attributed for the onset-later 74 only by class; 285 prescription diffs are not
  fully broken down by cause.
- Strength effect reaches 0 runners today (1 strength plan, 0 hip runners in it).
- §89 eligibility of the 4 live hip runners was not measured.

## Observed, not filed

- §47 Amendment 2's injury skip (`ruleEngine.ts:5115`) rests on *"owned by §90's injury reconciliation"*, which runs
  only for knee/shin (`hasVolumeCappedInjury`); for Hip, Achilles, Back and Plantar neither runs. Code-read, not
  measured.
