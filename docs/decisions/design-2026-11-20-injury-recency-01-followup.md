# Design Board — 2026-11-20 (follow-up) — `INJURY-RECENCY-01`: the recency control on the injuries step

Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

**Trigger:** soft, qualifying. A runner would see a new question on an existing wizard step
(`app/dashboard/GeneratePlanScreen.tsx`, `case 'injuries'`). Not a new step and not a new shared
component (SLT 2026-10-28 pre-approved the shape: *a per-chip toggle on the existing step, not a new step*).
**Change:** when a runner ticks a chip whose recency answer changes their plan, ask when it last flared up,
on that step, under the chips.
**Tier:** FREE (SLT 2026-10-28; injury handling is never paid, SLT 2026-09-11).

**Settled ground for this sitting, read whole and not re-ruled:**
`docs/decisions/coaching-2026-11-20-injury-recency-01.md` (CORRECT WITH AMENDMENT). Bucket = **last flare-up**;
**absent or skipped = current** (Willy, binding since 2026-11-14); **within a year = current**; **longer ago lifts the
long-run time cap only, for Back and Plantar fasciitis**; Knee, Shin and Achilles do not vary and are not collected.
Its hand-off: the control, on Back and Plantar only, three buckets or two is this board's call; Sims's 2026-11-14 copy
condition binds; 👤 founder for the words.

---

## 📐 Analysis, before any seat spoke

### The real control today (read from code)
- `INJURIES = ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis']` (`GeneratePlanScreen.tsx:162`),
  rendered as a wrapping row of multi-select `Chip`s (`:2356–2371`).
- Step title *"Anything to flag?"*, subtitle *"Old injuries that still show up. Skip if you're clean."* (`:290`,
  `optional: true`). Field note under the chips: *"Select any that are still an issue. We'll avoid aggravating them in
  the plan structure."* (`:2369`).
- Asked of **every tier** now (`getStepSequence`, `:307–311`, `WIZARD-INJURY-FREE-01`); always the last step.
- Sent as `injury_history: injuries.map(toLowerCase)` (`:1160`). Persisted in `zona_wizard_draft` (`:799`, `:817`).
- Step validity: `case 'injuries': return true` (`:994`), nothing gates it.
- ⚠️ **Precedent for a client-side engine read already exists on this screen:** the weekday step calls
  `raceDistanceKey` and `GENERATION_CONFIG.DAYS_AVAILABILITY_THRESHOLDS` through `dayCountVerdict` (`:985–989`).
  The wizard asking an engine-owned predicate is not a new pattern.

### 🔴 Re-derived: the answer changes nothing at 5K or 10K
`lib/plan/longRunTimeCap.ts` takes the injury ceiling only when it is **lower** than the distance ceiling
(`m < out.mins`). Config: `LONG_RUN_CAP_MINUTES` 5K 90 · 10K 120 · HM 135 · marathon 210 · 50K 300 · 100K 420;
`LONG_RUN_CAP_MINUTES_5K_FINISH` 70; `LONG_RUN_CAP_MINUTES_BY_INJURY` back 120 · plantar 120.

Run (`longRunTimeCap` for each distance × goal, scratch script, output below):

| race | goal | none | Back | Plantar |
|---|---|---|---|---|
| 5K | finish / time | 70 / 90 `distance` | same | same |
| 10K | finish / time | 120 `distance` | **120 `distance`** (equal, not lower) | same |
| HM | both | 135 | **120 `injury`** | **120 `injury`** |
| marathon · 50K · 100K | both | 210 · 300 · 420 | **120 `injury`** | **120 `injury`** |

So the only cap a `longer_ago` answer lifts **never binds below the half marathon**. At 5K and 10K all three buckets
are engine-identical for both chips. That is the same test the 11-16 sitting used to refuse the control (*"a control
whose three outputs are indistinguishable to the engine is a field"*), applied one axis further: **per chip AND per
distance**. The morning note's own HM figures show the cap does not bind for every HM runner either (intermediate
20 km/wk unchanged; beginner LR 14.5 → 15.5; intermediate 40 km/wk 16.5 → 17.5). The share of HM+ runners for whom it
binds is **not measured**.

### Live (production, read-only: `npx tsx scripts/board-evidence-injury-recency-01-followup.ts`)
- 43 plans · 36 with `generator_input` · **15 with any chip, 15 users** — chip tally knee 6 · plantar 4 · hip 4 ·
  achilles 3 · shin 3 · back 1, **identical to the morning note and to 2026-11-14**.
- Chips per injured plan: one chip 11 · two chips 3 · four chips 1.
- **5 plans (5 users) carry Back or Plantar; 0 carry both.** By distance: **three 5K, two marathon.**
- 🔑 **So 2 of 43 live plans are runners for whom a recency answer would change anything.** The other three would be
  asked a question with no consequence.

### What the evidence can and cannot show
Can: exactly when the answer moves the engine, and how many live runners that is. Cannot: whether runners notice a
conditional follow-up, how they read "last flared up", or whether a runner with a decade-old back answers honestly.
**Nothing here has been rendered or felt on a device.**

---

## 🔍 Settled-ground scan (`design-rulings.md`, pattern and token layer)

| Row | Relation |
|---|---|
| **2026-11-16 `INJURY-RECENCY-01` · CANNOT RULE YET** | **Discharged.** The bucket semantics now exist (Coaching 2026-11-20). Its "four may be five" is answered: Achilles does not vary and is not collected |
| **SLT 2026-10-28** (decision note) | Binds: per-chip, on the existing step, **not a new step**, FREE, *"if nothing changes, it is not collected"* |
| **`WIZARD-WEEKDAY-CONFIRM-01 (a)`** — no prompt, modal or step, PERMANENT | Respected: inline on the step |
| **2026-11-16 `RACE-NOTES-INERT-01`** + the 11-16 ruling's *"inert field"* test | Applied, one axis further (per distance) |
| **2026-11-20 `BENCHMARK-DATE-REQUIRED-01`** — answered or declared; **recency buckets DECLINED** *"same refusal as injury recency 2026-11-14… returns with bucket semantics"* | Touched. Injury recency now HAS semantics, so this board may rule it; the benchmark refusal is **not** reopened by this |
| **2026-11-20 `PROFILE-BIRTH-YEAR-REQUIRED-01`** — a control records nothing it was not moved to | Binds: no pre-selected bucket; untouched is stored as absent, never as an answer |
| **S4** — an optional step's primary may never be the skip | Untouched: the step stays optional; no new exit |
| `ui-patterns.md` § Input controls — **Chip** for an ordinal set with self-evident labels (training age, weekday ceiling); "Never build a one-off input" | Binds: reuse `Chip`, single-select |
| `ui-patterns.md` § Wizard step inventory, `injuries` row = *Chip (multi)* | **Amended by this ruling** (artifact 1) |
| `MICRO_LABELS` closed at three (`WIZARD-WEEKDAY-CONFIRM-01 (b)`) | Binds: the follow-up label uses `FieldLabel`, no fourth role |
| Token layer | No token touched. No colour on the follow-up (no `--warn`; injury is not a warning) |

---

### 🧭 Julie Zhuo (Chair)
*"On the 16th I refused this because I could not state a success condition. I can now, and the analysis just made it
narrower than the hand-off: **a runner who ticks Back or Plantar for a race where the long-run cap binds, and whose
last flare-up was over a year ago, can say so on this step and gets the uncapped long run; nobody else is asked
anything.** Observable from the stored input. Three of the five live runners who ticked these chips are 5K runners;
asking them would be the inert-field mistake with a nicer label, so we do not."*

### ✋ Miklu Silvanto
*"It is subordinate to the chip that summoned it, so it sits directly under the chip group, at the weight of a field
label and a chip row, in ink. No amber: an old injury is not a warning, and amber here would tell a runner with a
quiet back that something is wrong. One follow-up per qualifying chip, named by the chip, so a runner with both sees
two short rows, never one ambiguous one. The existing note keeps its place below."*

### 🎓 Kathy Sierra
*"The runner the item exists for is the one with a ten-year-old back who has been capped at two hours for good. If
the follow-up is optional and they miss it, they are exactly where they started, and we will call the feature
shipped. Today we ruled twice that a field which matters is answered or declared. I would require it here too.*
*And the subtitle has to change: 'old injuries that still show up' tells someone with an old, quiet back not to tick
it at all, and 'select any that are still an issue' makes 'over a year ago' a contradiction. That is Sims's
condition read the other way: do not make them re-litigate, and do not make them lie to answer."*

### 📱 Luke Wroblewski
*"Four things.* **Count:** one extra tap, for a runner who has already ticked one of two chips at HM or longer, which
is two of forty-three live plans. **Placement:** below the chip row, never between chips: the row wraps, and a block
opening mid-row moves the chip under the thumb. **State:** untick the chip, the answer goes with it; change the
distance back on step one, a follow-up that is no longer shown must not post its answer; the draft restore drops an
answer whose chip is not ticked. **Required:** no. The step is optional, the default is the safe one by Willy's
ruling, and a grey Continue on the last step of the wizard because of a sub-question is the stuck moment that costs
us the plan. Store absent as absent, and if the absent rate is high, that is the evidence to gate it."*

### 🎪 Brian Collins
*"Two buckets. 'Current' and 'within a year' do the same thing in the engine. A distinction the product shows and the
engine does not make is decoration with a label on it, and an experienced runner will spot that we asked a question
we ignored half of. McMillan's 'kitchen' line was an argument against a date picker, and two plain answers pass it
just as well. If the Coaching Board ever splits them, the control grows a chip; that is cheap. And say it to them
plainly: an old back does not cap you forever. That is a sentence only we would write."*

---

### ⚡ Recorded disagreements
**Sierra vs Wroblewski: required or optional.** Sierra: optional means the target runner can miss it and nothing
changes; today's two rulings made fields that matter answered-or-declared. Wroblewski: those rulings fixed absences
that were **unsafe or fabricated** (a dateless benchmark silently priced; an invented age); here absence is the
declared safe default (Willy), and gating the last step on a sub-question risks the plan. **Chair rules optional,
with absence stored distinctly.** What moves it: **an observed absent rate** on new Back/Plantar HM+ plans; Sierra's
position returns with that number. **Sierra lost, recorded.**

**Three vs two buckets.** McMillan (Coaching, 11-14 and this morning) argued three; Collins argued two. Not a split
inside this board: Zhuo, Silvanto and Wroblewski agree with Collins. McMillan's argument is recorded as against a
date picker, which two buckets also satisfy.

### ⛔ Veto check
Silvanto: **none.** No palette or type change. His stated condition, not exercised: colour on the follow-up would
regress the documented *"amber for warnings"* rule (`CLAUDE.md` § UI Principles); an old injury is not a warning.

## ⚖️ Ruling — **SHIP WITH AMENDMENT** · NOT BUILT

| Decision | Status | Why |
|---|---|---|
| **A per-chip follow-up on the injuries step, inline, under the chip row** | 🟢 **SHIP** | SLT's pre-approved shape; no step, no modal (`WIZARD-WEEKDAY-CONFIRM-01 (a)`) |
| **Shown only where the answer changes the plan: Back or Plantar, AND a race where that chip's injury cap binds (HM and longer today)** | 🟢 **SHIP (amendment)** | Re-derived: at 5K/10K all buckets are engine-identical; 3 of 5 live carriers are 5K. The visibility rule is **an engine-owned predicate** the wizard calls (the `dayCountVerdict` precedent), reading the Coaching build's lift table and `longRunTimeCap`, **never a chip list or a distance list in the component** |
| **Two answers, not three** | 🟢 **SHIP (amendment)** | Collins: `current` and `within a year` are engine-identical. One answer covers *now or within the last year*, the other *over a year ago*. Grows only if the Coaching Board splits them |
| **Control: `Chip`, single-select, labelled by the chip it belongs to (`FieldLabel`)** | 🟢 **SHIP** | Ordinal, self-evident labels (training-age precedent). No new control, no fourth micro-label role, no colour |
| **Nothing pre-selected; untouched is stored as absent and means current** | 🟢 **SHIP** | `PROFILE-BIRTH-YEAR-REQUIRED-01`; Willy's binding default. Absent is never written as an answer |
| **Optional, no gate on Continue** | 🟡 **SHIP (Sierra dissents)** | Absence is the safe default; revisit on a measured absent rate |
| **State: untick clears the answer; a hidden follow-up never posts; draft restore drops orphans** | 🟢 **SHIP** | Wroblewski |
| **The step's subtitle and field note are rewritten** | 👤 **FOUNDER** | Both say *still an issue / still show up*, which makes *over a year ago* a contradiction and tells the target runner not to tick at all (Sierra, Sims's 11-14 condition, McMillan's *last flare-up* meaning) |

**Words:** 👤 founder — the follow-up label, the two answers, the revised subtitle and field note. Constraints from
the board: asks **when it last flared up**, never whether it is an issue (Sims); states no outcome or safety claim
(a claim about what the answer does to injury risk is 🏃's); no em dash in a sentence.

**Sequence:** the Coaching Board's condition (`measure:fitness` on the back/plantar cohort with the lift applied) is
met before this ships; the engine field, predicate and invariant land in the same build.

### 📦 Required artifacts (with the build, one commit)
1. **Pattern** — `ui-patterns.md` § Wizard step inventory: the `injuries` row becomes *Chip (multi) + a conditional
   single-select Chip follow-up per qualifying chip*, with the rule **"a follow-up appears only where its answer
   changes the plan, and the predicate is the engine's."**
2. **Constant** — the visibility predicate in `lib/plan/` (one owner, reading the Coaching build's lift table and
   `longRunTimeCap`); the two answer values as a named set. No literal chip or distance list in the component.
3. **Mechanical check** — a behavioural test over every `INJURIES` chip × every wizard distance × goal: follow-up
   shown ⇔ the lifted cap is the binding ceiling; the payload carries an answer only for a shown follow-up; untick
   and distance change clear it; an untouched follow-up posts no answer. **Falsify** by adding `Knee` to the shown
   set, by showing it at 10K, and by posting a hidden answer after a distance change.
4. **Register row** — below.

### ↗️ Routing
👤 founder for words. No SLT (tier and shape settled). No Coaching Board sitting: the distance scoping is a read of
the engine's existing `longRunTimeCap`, not new prescription.

### 🚨 MUST/NEVER check
No modal, no new step, no colour, no hardcoded values, no new control, FREE. Em dashes: none permitted in the new
sentences (`noEmDashApp.test.ts` covers both literals and JSX text).

## ⚠️ What this ruling does not settle
- Nothing rendered, mocked or seen on a device; the follow-up's legibility at 320pt with two chips ticked is assumed.
- The share of HM+ Back/Plantar runners whose long run actually reaches the 120-minute cap: **not measured**; for some,
  the answer will still change nothing.
- Maintenance plans: whether the post-race generator applies the same recency to its long-run ceiling is **not
  measured**.
- Whether runners read "last flared up" as intended: unknowable without use. Population is 2 live plans.
- The Coaching Board's safety condition is not discharged by this sitting.
