# Coaching Board: a "repeats" session with one rep (2026-10-28, S9-ONE-REP-01)

**Trigger:** soft trigger that qualifies. The fix changes which session a slow runner is prescribed, and the build will
touch `sessionCatalogueData.ts` and `generationConfig.ts` (hard). **Founder:** "2 do this" (take S9-ONE-REP-01 to the board).

**Proposed change:** a rep-scaled session must repeat. Where its sizing yields one rep, the slot is filled differently.

## Evidence (measured 2026-10-28, engine at `ae697a28`)

Scripts: `scripts/.tmp/onerep2.ts` (population), `scripts/.tmp/onerep-proto.ts` (two prototypes, every plan hashed
against the unchanged engine and re-validated), `scripts/.tmp/onerep-look.ts` (sessions read, full validator code delta).
The prototypes were env-gated edits to `ruleEngine.ts`, restored from a saved copy afterwards (`git diff` empty).

**Why it happens.** `pacedRepPlan` sets the minimum reps at `ceil(THRESHOLD_WORK_MIN_MINS / one rep's work)`. A 1600 m
rep takes 15 minutes or more once threshold (or goal) pace is slower than about 9:22 /km, so the minimum is one rep, and
`round(target / one rep)` is also one (peak target 22, rep 16.7). Before S9-QUALITY-MINUTES-01 the 5 km floor grew it to
two; since then, one rep plus warm-up and cool-down passes the 35-minute floor and growth stops. The dose band always
allowed one rep; the floor change made it reachable.

**Population, by row** (every rep-scaled session; a "one rep" session = a work-plus-recovery block repeated once):

| | Slow-goal grid (960 cases, 880 served) | Cohort grid sample (3,000, stride 7919) |
|---|---|---|
| `threshold_mile_repeats` one rep | **18** of 90 | **0** of 881 (2 reps 675, 3 reps 206) |
| `mp_blocks` one block | 40 of 40 | **170 of 170** |
| `threshold_pyramid`, `threshold_ladder` | one pass, 460 | one pass, 1,935 |
| every other rep row | 0 | 0 |

Pyramid and ladder are fixed shapes run once by design (`scaling: 'fixed'`); they are not this defect. **`mp_blocks` is
one 4 km block for every runner measured**, pre-existing, and a separate question (below).

**Live:** a91d8fde (Tasha), week 13 Wednesday: "1600m repeats", 1 x 1600 m at 10:45–11:12 /km, 90 s jog after it, 38
minutes, step note "Rep three should look like rep one." Held from the 27 Oct dry-run apply.

**Prototype C1: take the row out of the pool when it would give one rep.** Slow grid: one-rep sessions 18 → 0, **64
plans and 156 sessions change**, because the rotation shifts every later pick; the 18 go to `cv_intervals`, a faster
stimulus. Cohort: 0 changed. 0 new error plans.

**Prototype C2: deliver the declared same-stimulus sibling, `tempo_cruise`, in that slot.** Slow grid: **18 plans, 18
sessions change, all `threshold_mile_repeats` → `tempo_cruise`**; every other session byte-identical. Cohort: 0
changed, 0 refusal changes. Validator: **no code moves in either direction** (errors and warnings, all 880 plans). The
session read: 1 x 1600 m (16.7 min at T), 37 min, 3 km → **2 x 10 min at T / 2 min jog, 20 min of threshold, 43 min,
4 km**. The work sits inside the 15–30 band, near the peak target of 22.

**`measure:fitness`:** its cohort and targeted populations are unchanged by both prototypes (0 cohort plans changed),
so its numbers cannot move. It is re-run at build.

## Conflict scan

- **§19 Amendment (CD-1-MILE-CRUISE-01, 2026-10-22):** cruise and 1600m repeats are one stimulus, separated by the
  anchor (the split). Its measurement, "a mile at T runs 7.6–9.8 min, median 8.8", was the cohort grid only; it never
  saw a 17-minute mile. With one rep there is no split to compare, so the row's stated reason to exist is absent. C2
  uses exactly the equivalence that amendment ratified. **No conflict; it supplies the case the amendment's population
  did not hold.**
- **§9 Amendment (S9-QUALITY-MINUTES-01):** the 35-minute floor stays. C2 makes the session longer (37 → 43), never
  below the floor. No conflict.
- **§85 / `THRESHOLD_WORK_*`:** the dose band governs threshold minutes. Option A (minimum two 1600 m reps) prescribes
  33–35 minutes of threshold against a 30 maximum: **contradicts §85**.
- **§53 / §36 rotation:** C1 moves 156 sessions through the rotation; C2 moves none but the one slot. C2 records the
  selected row in `rowUsage`, not the delivered one; the variety invariants do not move (measured). Named, not hidden.
- **The row's own 5K exclusion:** "a 1600 m rep is most of a 5K runner's race". The same reasoning, by time, covers a
  runner whose one rep is 17 minutes.
- **§22 / §120 Am.2:** goal substitution unchanged; the sibling is priced through the same `useGoalPace` path.
- **§1:** session counts unchanged. No effect.

## The seats

🏃 **Hutchinson (chair).** The 22 Oct ruling was right for the runners it measured and silent on the ones it did not.
A 1600 m rep for a runner at 10:45 a kilometre is a 17-minute tempo with a jog tacked on the end, and calling it
"repeats" with a note about rep three is the label disagreeing with the prescription, which is the exact class the 26 Oct
report was about. The sibling exists, the board already said it is the same adaptation, and it changes 18 sessions.

📊 **Seiler.** No distribution effect: one quality session in, one out. Threshold minutes go 16.7 → 20, inside the
band. Prefer C2 to C1: C1 hands these runners CV work they were not otherwise getting, which is a stimulus change made
to fix a naming problem.

🎯 **McMillan.** The point of mile repeats is the split, rep against rep. One rep has no split. For this runner I would
write 2 x 10 minutes at threshold, which is what C2 produces. Shortening the rep (option B) keeps the name and loses the
mile: then it is cruise intervals with a worse name. Reject B.

🩹 **Willy.** Option A is 35 minutes of threshold for the slowest runners in the product, over the band: reject. C2 adds
3 minutes of threshold and 6 minutes on feet, inside the band, on a week already built around it. No tissue concern.

⚕️ **Sims.** The slow grid is where most older and female runners in this product sit. Giving them a session that tells
them to compare rep three with rep one when there is no rep three reads as the app not having noticed them. C2 fixes it
for 18 sessions and nobody else's plan moves. Support.

💪 **Blagrove.** No objection from this seat.

## Recorded disagreements

None on the ruling. **Seiler and McMillan differ on `mp_blocks`:** McMillan holds that one 4 km block at marathon pace
is a legitimate session and the problem is the name "blocks"; Seiler holds that marathon-pace work away from the long
run should repeat to be worth the slot. Neither is ruled today: it is pre-existing, universal (170 of 170), and outside
the 26 Oct regression. Filed as `MP-BLOCKS-ONE-BLOCK-01`.

## Ruling

**Option A (minimum two reps): INCORRECT** (breaches §85's band). **Option B (shorter rep): INCORRECT** (removes the
anchor that §19 Am. names as the row's reason to exist). **Option C1 (drop from pool): not chosen** (moves 156 sessions
and changes stimulus to fix a name). **Option C2: CORRECT WITH AMENDMENT.**

> **§19 Amendment 2.** A rep-scaled threshold row whose sizing gives fewer than `REP_ROW_MIN_REPS` (2) reps is not
> delivered as that row. Where the row declares a same-stimulus sibling, the sibling is delivered in that slot, sized by
> its own structure. Today the only such row is `threshold_mile_repeats` → `tempo_cruise` (§19 Am.).

**Amendments (binding on the build):**
1. **One owner.** The decision lives in one function that both quality slots call; the sibling is a field on the
   catalogue row, not an id in the engine.
2. **The measured blast radius is the acceptance test:** 18 slow-grid sessions change, all to `tempo_cruise`; 0 cohort
   plans change; 0 validator codes move. Any other change is a finding, not a tolerance.
3. **The invariant applies to every rep-scaled row, with `mp_blocks` registered as named debt** (`MP-BLOCKS-ONE-BLOCK-01`),
   so a new row that can reach one rep fails the build.
4. **Tasha's plan (a91d8fde)** is re-run as a dry run on the built engine and shown before it is applied.

## Required artifacts

1. **Principle:** §19 Amendment 2, above.
2. **Numeric:** `GENERATION_CONFIG.REP_ROW_MIN_REPS = 2`; catalogue field `one_rep_sibling` on `threshold_mile_repeats`.
3. **Invariant:** `INV-PLAN-REPEATS-REPEAT`: a session from a rep-scaled row carries at least `REP_ROW_MIN_REPS` reps
   in its derived set; `mp_blocks` exempt by name as registered debt. Row in `plan-invariants.md`.

## SLT escalation

None.
