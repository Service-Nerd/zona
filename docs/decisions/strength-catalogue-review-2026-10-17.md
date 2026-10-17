# Strength catalogue review — Coaching Board, strength seat leading (2026-10-17)

**Founder:** *"The 99 exercises: get our strength coach to review."* **Trigger:** `packages/strength/catalogue.ts` (hard,
strength doctrine). **Proposed change:** move `CATALOGUE_REVIEW_STATUS` from `draft` to `reviewed`, with whatever
corrections the review finds. **Population:** 99 entries, counted from the file (83 training, 10 warm-up, 6 mobility).

## Method
Every entry read against S1–S12, then **the catalogue measured as the engine USES it**: 10 real run plans × the full
profile grid, 210,996 main-lift prescriptions. A desk read finds what an entry says; the measurement finds what it does.

## 🔍 Conflict scan
S6 (main lifts are where load lives) and S9 (kinder siblings; kit) are the sections in play. **No contradiction with
the run constitution.** S9's "loaded spinal flexion" exclusion is set on **zero** entries, correctly: the catalogue holds
no loaded flexion movement, so under the bone flag only the impact half of S9 acts. Recorded, not a defect.

## 💪 Blagrove (lead)
- **The main hinge slot was not a hinge.** The Nordic curl, a supramaximal eccentric, was **25% of all main hinges**,
  the heavy main lift for most bodyweight-only runners, prescribed as sets of 5. The hamstring curl (isolation) and the
  kettlebell swing (ballistic) took another 4%. *"That's an accessory, not a main lift."* All three become `not_main`.
- **Names must match kit.** Bodyweight-only runners were given *"Ramp set: light goblet squat"* (11,724 times) and
  *"Banded side steps"* (14,664). Both now need their kit.
- **Inverted row on a pull-up bar** is untrue: a doorframe bar is too high to row from. Barbell and rack only.
- **"Kneeling rollout" with no kit** is untrue: a rollout needs a wheel. Replaced by a bodyweight **kneeling walkout**
  (same pattern, same tags). No stored plan references the old id (migrations unapplied).
- **A cue never states an effort number.** *"Stop two reps short of a grind"* would contradict a session prescribing
  RIR 3. The dose line owns effort. *"Same as bodyweight, just heavier"* referred to an exercise the runner may never
  have seen. Both rewritten.
- 🔴 **The first jump is the hardest one** (outside the catalogue, in selection): measured, a `some`/`regular`
  runner's first plyometric is **bounding or a drop jump**, and pogo hops, low skips, squat and box jumps are **never**
  prescribed. Plyo level climbs from the LIFTING level, so it starts high. **Direction, not built here:** jumps start at
  level 1 when the plyo gate opens and climb from there, whatever the lifting level. Folded into
  `STRENGTH-PLYO-BUDGET-01`, which now blocks release.

## 🩹 Willy (tags)
- A kinder sibling keeps a joint tag OFF and the harder one carries it: the **incline push-up** (the regression) avoided
  the shoulder while the push-up and feet-elevated push-up did not. Now the incline is open and **feet-elevated avoids**.
- **Plank shoulder tap** loads one shoulder, like the side plank that already avoids it: tagged.
- Heel raises carry **no Achilles tag, correctly**: tendon loading is first-line for Achilles (JOSPT 2024). Kept.

## ⚕️ Sims (bone, impact)
No objection. Every plyometric is high impact and leaves under the bone flag; heavy work stays (LIFTMOR, BJSM 2022).

## 🏃 Hutchinson (chair)
*"This is the soleus, the one running loads most"* is a description of running mechanics, not an outcome claim.
Kept. No cue claims injury prevention or speed. **Ruling: CORRECT WITH AMENDMENT** — the 13 corrections below; status
moves to `reviewed`. The catalogue is reviewed; the **selection** defect above is not, and still blocks release.

## 📦 Artifacts
1. **Principle:** S9 Amendment 1 (main-slot eligibility; kinder-sibling tag direction; names match kit).
2. **Numeric:** none, deliberately: the decision is a property of each exercise (`not_main` on the catalogue entry), not
   a tunable number.
3. **Invariant:** `S-MAIN-ELIGIBLE` in `validateStrengthPlan` (falsified in `validate.test.ts`); `catalogue.test.ts`
   gains three arms (a main-eligible kit-free entry per main pattern; names match kit; no effort number in a cue), each
   made to fail.

## The 13 corrections
`band_walk_warmup` bands only · `goblet_squat_ramp` load only · `box_squat_bw` cue names a chair · `kettlebell_swing`,
`nordic_hamstring_assisted`, `hamstring_curl_machine` not main · `bulgarian_split_squat_loaded` and
`reverse_lunge_loaded` cues · `incline_push_up` shoulder tag off · `feet_elevated_push_up` and `plank_shoulder_tap`
shoulder tag on · `inverted_row` no pull-up bar · `ab_rollout_knees` → `kneeling_walkout`.

**After:** main hinges are bridges, RDLs and deadlifts only; full sweep 266,688 strength plans around 925 run plans,
0 violations. **Not reviewed by this sitting:** the animations (placeholders until Phase 3 licenses them).
