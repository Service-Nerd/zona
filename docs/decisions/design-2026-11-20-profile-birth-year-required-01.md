# Design Board — 2026-11-20. `PROFILE-BIRTH-YEAR-REQUIRED-01`

**Trigger:** soft, qualifying — the wizard's `birth-year` step changes what a runner must do. Filed 🧭 DESIGN BOARD then
👤 FOUNDER. One sitting; the founder's half is a hand-off.
**Change:** the birth-year step stops accepting a blank by omission, keeps an honest exit, and loses a false subtitle.
**Tier:** FREE.
Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins. Ruled for consistency with `BENCHMARK-DATE-REQUIRED-01`
(`design-2026-11-20-benchmark-date-required-01.md`).

---

## 📐 Analysis — every stated figure re-derived

Evidence: `scripts/board-evidence-design-sittings-2026-11-20.ts` (read-only) plus two throwaway read-only queries
(deleted after use; output quoted), 2026-11-20.

| Item says | Today |
|---|---|
| *"16 of 56 live runners have no age"* | **16 of 56 `user_settings` rows** have no `birth_year` (and 0 have a `date_of_birth`). ✅ the count holds — 🔴 **the population does not.** **13 of the 16 have `has_onboarded = false` and no plan**: the wizard never asked them. **Every runner with a birth year has a plan (0 exceptions).** The wizard's blank is **3 of 43 plan-holders**, one of them internal (`df2cc6e6`), so **2 external runners**, both generated 2026-09-23 |
| *"6 of 6 ageless runners with a stored max would get a different effective max depending on their age"* | **6 ageless rows carry a stored max (all `observed`); 2 of them are plan-holders.** The "different effective max" half is §50 arithmetic and was **not re-run** here |
| subtitle *"Only to estimate your max heart rate, if you haven't set one"* is false | **Confirmed false against the Coaching Board's 2026-11-17 ruling:** the age also (a) is what §50 checks a SET max against and (b) decides §3's recovery-week cadence (absent → the cautious masters cadence). `GeneratePlanScreen.tsx:283` |
| `optional: true`, `canProceed` returns `true` (`:282`, `:976`) | **Confirmed** (`:283`, `:977`) |

**What the analysis found that the item does not say:**

1. 🔴 **An untouched wheel is a silent skip that looks like an answer.** Since 2026-11-17 the wheel *rests* on
   `currentYear − WIZARD_BIRTH_YEAR_WHEEL_ANCHOR_AGE` (= 1991) while `birthYear` stays `null` until the wheel moves
   (`:2214–2222`). So `Continue` on an untouched wheel posts **no age** while the screen showed **1991** — and a runner
   actually born in 1991 cannot record it without scrolling away and back. Live: **0 of 40** recorded birth years are
   1991 (all 40 predate the change, so this neither confirms nor rules out the defect — not measured).
2. ⚠️ **"Require" collides with a recorded compliance reading.** The code (`:670`, `:972`) and
   `docs/investigations/wizard-redesign-frontend-design-2026-08-30.md:125` record *"App Store 5.1.1: never required"*.
   That is a legal reading this board does not own; an explicit decline option preserves it.

**What the evidence cannot show:** why the 13 never onboarded (not this item); whether the 2 external skippers would
have answered a better-worded step. No device.

---

## 🔍 Settled-ground scan

| Row | Bearing |
|---|---|
| **S4** (an optional step's primary is never the skip; `Not sure, continue`) | Governs **optional** steps. If birth-year stops being optional it leaves S4's population (six → five) — consistent with S4, not a reversal. `appReviewWave1.test.ts` may count six: a build consequence, stated |
| **S3** one CTA vocabulary | Untouched — the exit moves **into the step**, the footer labels do not change |
| **`USER-SETTINGS-TELL-THE-RUNNER-01`** (2026-11-14) | *"Birth year stays `log`, declared"* — the fire-and-forget write. Not reopened |
| **Wizard harness / WheelPicker** | The wheel is the documented control; kept |
| Token layer | Nothing touched |

---

## The board

**🧭 Zhuo (chair).** *"The item's headline number is a count of accounts, not of answers: thirteen of sixteen never saw
the question. So this is not a mass defect — it is two runners and a subtitle that lies to everyone. The subtitle is the
finding. Success condition: no runner reaches a plan with no age unless they said so, and the step never tells them the
age matters less than it does."*

**📱 Wroblewski.** *"A wheel cannot say 'unanswered'. Today it shows a year it is not recording — that is the same lie
the 11-17 fix removed, moved one layer up. Two honest options: what is on screen is what is recorded, or Continue waits
for a touch. The first re-invents a 35-year-old for every lazy thumb, which is exactly the body the Coaching Board just
refused to invent. So: Continue waits for the wheel to move, and the exit is an in-step option, `rather not say` or the
founder's words — a declaration, not a skip."* On the 1991 cohort: *"they scroll one notch and back; I'd rather cost
one cohort a flick than fabricate an age for everyone."*

**🎓 Sierra.** *"The step should tell the runner what the year buys them. A runner who knows the age sets their recovery
rhythm and checks their max will give it; one told 'only if you haven't set a max' and who has a watch will rightly
skip it. The subtitle is training them to under-answer."*

**✋ Silvanto.** *"When they decline, say the cost on the same screen, quietly — no amber, no card. The decline is a
legitimate answer and should look like one."* No veto.

**🎪 Collins.** *"Consistency with the benchmark date, then: the exit lives inside the field on both steps, not in the
footer. One pattern — answered or declared — twice."* Agreed by the room.

## ⚡ Recorded disagreements
- **Sims' outright "require" (Coaching Board, 2026-11-17) is NOT adopted as a no-exit field**, on the recorded 5.1.1
  reading. Recorded as a difference from her ask, not a rejection of it: the declaration is required, the data is not.

## ⛔ Veto check
Silvanto: none.

## ⚖️ Ruling — **SHIP WITH AMENDMENT (4)**

1. **The step is answered or declared.** `optional` comes off `birth-year`; `Continue` is disabled until the wheel has
   been moved; an **in-step decline option** is the only way through without a year. The footer `Not sure, continue`
   leaves this step (it is no longer optional).
2. **The decline states its consequence on the step** (no HR zones without a max; recovery weeks set cautiously; a set
   max used as given). The CLAIM is the Coaching Board's 2026-11-17 ruling; the WORDS are the founder's.
3. **The subtitle is replaced** — it must not say the age is used only for estimating max HR. Words: 👤 founder.
4. **The declaration is recorded** (distinguishable from "never reached the step") so the success condition is
   observable, with the contract updated in the same commit — or the build says it is unmeasurable.

## 📦 Required artifacts (land with the build)

1. **Pattern** — `ui-patterns.md`, the wizard section: *a question the engine prices is answered or declared; a wheel
   records nothing it was not moved to* (shared wording with the benchmark-date pattern).
2. **Constant** — the declined value (named, beside the step meta), never a literal in the component.
3. **Mechanical check** — a wizard arm: an untouched wheel cannot proceed; the decline proceeds and records the
   declaration; the subtitle string no longer contains the *"Only to estimate"* claim. Falsified by restoring
   `optional: true` and by letting an untouched wheel proceed.
4. **Register row** — below.

## ↗️ Routing
👤 **Founder** — subtitle, decline label, consequence line; and the App Store 5.1.1 reading if he wants it re-tested
(`LEGAL-COUNSEL-01` is his). 🏃 Coaching Board — no new question; the claim is its 2026-11-17 ruling.

## ⚠️ What this ruling does not settle
- It fixes no existing plan; the 2 external ageless plans keep their declared-absent treatment.
- It does nothing for the 13 accounts that never onboarded.
- Not seen on a device; the "one notch and back" cost for a 1991 runner is argued, not felt.
