# Coaching Board — 2026-11-20 — `HR-SAVE-UNEDITED-CONFIRMS-01`: does a resting-HR-only save confirm a floored max?

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent.

**Trigger:** soft (§50 Asymmetry's meaning of "confirmed"). The settled half is NOT re-opened: `handleHrSave` stamps
`user_confirmed` on every save **by design** (`c44e0e53`, HR-MAX-01 — the copy and the stamp landed together), and
making it conditional once left a genuine low-max runner no way to confirm.
**Proposed question, one sentence:** when a runner opens the HR sheet and changes only their RESTING HR, while the
max field holds a device-observed value below their age estimate, should that save promote the max to
`user_confirmed`?

---

## 📐 Analysis, before any seat spoke

**The at-risk population, re-measured in production** (`npx tsx scripts/board-evidence-hr-save-unedited-confirms-01.ts`,
SELECT only):

| | 11-08 | 11-12 | **11-20** |
|---|---|---|---|
| `user_settings` rows | 53 | 56 | **56** |
| with a max | 37 | 40 | **40** (observed 26 · user_confirmed 4 · unattributed 10) |
| `observed` | 24 | 26 | **26** |
| **observed AND below Tanaka — the population at risk** | 3 | **7** | **2** |
| unattributed (§50 treats it as a device floor) AND below Tanaka | — | — | **0** |
| observed with **no guardable age** | — | — | **6** |
| `user_confirmed` AND below Tanaka | — | — | **1** |

🔴 **The item's headline — "3 → 7 in four days, growing" — does not hold today: it is 2.** Why it fell is **not
measured**: the 11-12 note does not record its method, and I cannot reproduce 7 from today's rows under any assumed
age for the six ageless runners (at an assumed 30 or 35, two more would qualify → 4; at 40, one → 3). Plausible
causes — device maxes rising past the estimate as harder efforts are recorded, which is what an observed FLOOR does —
are hypotheses, not findings.

⚠️ **The six ageless rows are outside this question by doctrine.** §50's 2026-11-17 amendment (`MAXHR-AGE-ABSENT-01`)
uses a max *exactly as given* when there is no age (`max_unguarded_no_age`), whatever its provenance. A save cannot
make their zones worse, so the at-risk set is **2**.

**The one already-trusted row** is a 43-year-old with max **143** against an estimate of **178** (−35 bpm), last
updated **2026-08-31**, the day HR-MAX-01 shipped. Its shape is the 2026-08-06 founder-incident shape (43, 138); it is
also exactly what a genuine low-max runner looks like. **Which it is cannot be determined from the data**, and that
indistinguishability is the whole question.

**What the runner sees** (`components/dashboard/HRZonesSection.tsx:227–231`): whenever the max is floored, a warn-colour
line under both inputs reads *"{typed} bpm is below the age estimate ({estimate} bpm), usually the highest your device
happened to record, not your true max. Zones use {estimate}. If {typed} really is your max, tap Save to confirm it."*
There is one Save button for both fields.

**Direction of error if a floor is promoted.** Every zone is computed from a max that is too LOW: the easy ceiling
falls (Z2 = 70% HRR), quality HR targets fall. That is an **under-prescription** — a plan easier than intended and
quality sessions whose HR target the runner will exceed — not a load increase.

**Settled-ground scan:** §50 Plausibility (2026-08-06), **§50 Asymmetry** (HR-MAX-01, 2026-08-31 — *"a value the runner
typed carries their confirmation"*; *"re-saving in Profile re-tags it `user_confirmed`"*, i.e. the self-heal path for a
legacy hand-typed value **is** a save), §50 Am. (absent age, 2026-11-17), the 2026-11-12 triage (first half closed).

---

## 🔍 Conflict scan
**§50 Asymmetry** is the only section touched. A rule that a save confirms only when the max field was touched would
**narrow** Asymmetry's *"tap Save"* route and its legacy self-heal path; it would not contradict any other section.
§12 (easy ceiling) is downstream: a low max lowers it, which §12 tolerates (it is a cap, not a floor).

---

### 🏃 Alex Hutchinson (Chair)
*"The population at risk is two people, it was not seven, and nobody can tell me the 7 was right. The one realised
case is genuinely ambiguous. What I do know is that the sheet tells the runner, in the sentence directly above the
button, that the number is probably a floor and what Save will do. A warning that specific is informed consent in the
ordinary sense. I am not willing to build a touched-field mechanism to protect two runners from an outcome that makes
their plan easier."*

### 📊 Stephen Seiler
*"A low max mislabels quality: a threshold session will read as over target when it is not. That is a real cost, but
it is a legibility cost on a handful of sessions, and §78's time trial replaces the estimate anyway. No objection to
leaving it."*

### 🎯 Greg McMillan — dissent
*"A runner fixing their resting HR is not reading about their max. They came to change one number. Calling that a
confirmation is a legal fiction. If we ever touch this sheet again, the max should confirm only when the max is the
thing they acted on — and re-typing the same number has to count, which is why it would be a touched-field flag, not
'edited'. I accept it is not worth building for two people today."*

### 🩹 Rich Willy
*"Load is my lens and this moves load DOWN. A promoted floor gives an easier plan, not a harder one. I would not spend
a build on it; I would want to know if the realised case were a real low-max runner being told she is wrong, which is
the opposite harm."*

### ⚕️ Stacy Sims
*"Note what Tanaka is: a pooled equation. In women, sex-specific estimates (Gulati's, for example) run lower at most
ages, so a woman's 'observed max below Tanaka' is more often genuine than a man's. Making confirmation harder falls
hardest on exactly the runners whose real max sits below the pooled estimate. I support leaving the route as easy as
it is."*

---

### ⚡ Recorded disagreements
**McMillan vs the chair:** whether an incidental save is a confirmation. McMillan: no, and a touched-field flag is the
right shape if the sheet is ever reworked. Chair: the on-screen sentence makes it an informed act. **What would change
the chair's mind:** evidence that runners save the sheet without seeing the line (a Design Board question about the
sheet), or the at-risk population growing materially. **What would change McMillan's:** nothing about the principle;
he accepts the cost argument.

## ⚖️ Ruling — **CORRECT (status quo ratified)**

A save of the HR form while the floor warning is on screen **is a confirmation of the max**, whichever field the
runner edited. The question is closed, not deferred. **Re-open triggers, stated so this is not re-raised from memory:**
(a) the observed-below-estimate population with a guardable age exceeds **5** (measured by
`scripts/board-evidence-hr-save-unedited-confirms-01.ts`) — a threshold for reopening a question, not a coaching
numeric; or (b) the HR sheet is redesigned so the two values save separately, at which point McMillan's touched-field
shape is the default to consider.

### 📦 Required artifacts
1. **Principle** — §50 Asymmetry gains one sentence: *a save of the HR form while the floor note is displayed confirms
   the max, whichever field changed; the sheet must show the floor note whenever the max is floored.*
2. **Numeric** — none.
3. **Check** — not a `validatePlan()` invariant (a UI act, not a plan property). Already held by
   `lib/plan/hrSaveResolution.test.ts` (the unconditional `user_confirmed` stamp). The build should add one arm to the
   HR sheet's existing tests asserting the floor line renders whenever `maxIsFloored`, because the ratified consent
   rests entirely on that line being visible.

### ↗️ Hand-offs
None. (A future sheet redesign that separates the two saves would be 🧭 Design Board, and should read McMillan's
dissent first.)

## ⚠️ What this does not prove
Not that the 2 at-risk runners understood the line; not whether the one sub-estimate confirmed max is genuine; and not
why the 11-12 count was 7 (unreproducible, method unrecorded).
