# Coaching Board — `INTENSITY-DECLARATION-FLOOR-01`, 2026-11-20

**Verdict: INCORRECT (veto) — no VDOT floor and no second prompt on an upward intensity declaration. §79's existing
protections already bear the risk the item names; the declaration stands.**

**Trigger:** soft, qualifying — would change which quality rows a declared-up runner can be prescribed (§79).
Records only: nothing built, no doctrine edited.
**Proposed change:** floor a runner's upward-declared INTENSITY level by their VDOT below some point, either as a hard
floor or as a prompt.

## Analysis — every figure re-derived

Evidence: `scripts/board-evidence-intensity-declaration-floor-01.ts` (read-only, production `plans`, service-role).
It reads the level the catalogue gate reads (`fitness_intensity_level ?? fitness_level`) and recomputes what §79 would
have assessed **with no declaration** (`resolveLevels` with `user_declared_level` removed, at the plan's stored VDOT).

| Item's figure | Re-measured 2026-11-20 |
|---|---|
| 9 live plans are structural beginners with a higher intensity level | **9** of 43 live plans (plus **1** structural intermediate at `experienced`, so 10 in all) |
| 8 of them carry the runner's own declaration | **8 of 9** (9 of 10 overall) |
| widest gap: VDOT 16.2 declaring `intermediate`, *"a 7:40 marathon"* | **VDOT 16.2 → `intermediate`** confirmed (`0cd29ac3`); current marathon pace at 16.2 is `11:00 /km` ≈ 7:44, so the item's 7:40 is the same figure rounded |

🔑 **What the item did not separate: in only 3 of the 9 beginners is the declaration the CAUSE.** For six of them §79's
own two-signal assessment already reads `intermediate` intensity (volume or a deep training age) — the declaration
agrees with the engine. The declaration raises intensity above the assessment on **5 plans**: three
beginner→intermediate (`0cd29ac3` VDOT 16.2 · `ed0ebddf` 31.4 · `2128e014` no benchmark) and two
intermediate→experienced (`5b89e444` 34.4 · `1afc17e4` 41.0). ⚠️ **A VDOT floor could reach at most two of the three
beginner cases** — `2128e014` has no benchmark, so a VDOT rule cannot see it.

✅ **What those runners actually receive.** All five have §79 Am. 3's re-entry window active (`intensity_reentry_active`,
4 quality weeks; 2 for the deep-training-age runner), so VO2max and hill work are withheld first. The three
beginner→intermediate plans carry **at most one quality session a week, from week 8 onward** (the script's `maxQ/wk` and `firstQwk` columns;
all ten cited plans peak at one a week), structure stays on the structural band (`INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE`), and
threshold work is priced from the runner's own VDOT, so a VDOT-16.2 threshold session is a threshold session **at a
VDOT-16.2 pace**, not an intermediate's pace.

**What the evidence cannot show:** any outcome — no injury, completion or drop-out data exists for declared-up runners;
n = 5 is description, not evidence. The sex field is absent from all five rows (`sex=—`), so Sims's cohort cannot be
separated.

## 🔍 Conflict scan
**§79** principle (*"volume is where injuries come from, intensity is where progress is lost"*), its 2026-08-31 /
2026-09-02 amendment (upward declaration binds **intensity only**, by design), **Am. 3** (a user-raised NOVICE gets the
re-entry window — the protection this item asks for already exists for exactly this cohort) and **Am. 4** (§79 beats
§5) · **§89 / ADR-021** — the item quotes *"demonstrated tissue-readiness, not self-image"*; 🔴 **that sentence governs
the early-onset GATE (a shorter base), not the intensity level** — ADR-021 line 31 says self-image is *"insufficient"*
for that gate and leaves the declaration's intensity binding untouched · **§110 Am. 2 / §110b** (what a beginner may be
prescribed — rung 4 tempo is granted on a time target) · **§1** (distribution still binds at the elevated level).
A hard floor would **contradict §79's amendment** (the wizard's override is a recommendation the runner may change) and
**duplicate Am. 3** for its own cohort.

## Seats
🩹 **Willy:** *"My concern was tissue, and the tissue axis is already held: tonnage stays on the structural band and the
highest tissue-stress work is withheld for the opening quality weeks. What is left is a threshold run at a pace their
own benchmark sets, once a week from week eight. I can't name the structure that fails from that. I withdraw the
floor; I would like to see the re-entry window's effect measured when there is completion data."*

⚕️ **Sims:** *"A floor answers the wrong half of my point. The risk in a low-fitness runner taking on more intensity is
under-fuelling, and a floor doesn't feed anyone. That is a guidance question on the session, not a classification
question in the engine."* (Not filed — see the return's Observed list.)

🎯 **McMillan:** *"The wizard already shows them our recommendation and lets them change it. That IS the prompt. Asking
twice tells them we didn't mean the first one."*

📊 **Seiler:** *"One quality session a week is inside any distribution I would defend. §1 still binds."*

🏃 **Hutchinson (chair):** *"There is no number. Nobody at this table can cite a VDOT below which a runner may not do a
threshold session at their own threshold pace, and inventing one to make five plans feel safer is the thing §10's
curve sitting warned us about. The item's own source sentence is about a different gate. And the protection the item
wants exists — Amendment 3 was written for this cohort."*

## ⚡ Recorded disagreement
None on the ruling. **Willy's withdrawal is conditional on the evidence state**: re-open if completion or injury data
on declared-up runners shows the Am. 3 window is not enough.

## ⚖️ Ruling — INCORRECT (veto on the proposed floor)
1. **No VDOT floor** on an upward intensity declaration. **No second prompt** — the wizard's recommended-level step is
   the prompt.
2. **The item's premise is corrected:** ADR-021's *"demonstrated, not self-image"* governs §89's onset gate, not §79's
   intensity level; and of the 9 cited plans only 3 are raised by the declaration (5 of 10 across all levels).
3. **Re-open trigger:** outcome data (completion / injury / drop-out) on runners whose declaration raised intensity above
   §79's assessment. Not a date.

## 📦 Required artifacts
None — an INCORRECT ruling ships nothing. The register row is the record.

## ↗️ SLT escalation
None.

## What this does not prove
That declared-up runners do well — there are no outcomes. That a fuelling cue is or is not needed (Sims) — not
measured. The `assessedInt` column recomputes §79 from the stored `generator_input` and stored (discounted) VDOT; a plan
generated before a later engine change could have been assessed differently at the time.
