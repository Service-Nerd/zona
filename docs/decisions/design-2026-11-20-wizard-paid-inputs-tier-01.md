# Design Board: one wizard for every tier, and the upsell card goes (2026-11-20, WIZARD-PAID-INPUTS-TIER-01 (b))

**Input:** the SLT ruled today (`docs/decisions/slt-2026-11-20-wizard-paid-inputs-tier-01.md`) that
`hard_session_relationship` and `terrain` are **FREE, both questions, every answer**, and handed point (b) to this board:
the free sequence gains two steps; the `TeaserCard` on `weekday-ceiling` sells "terrain, hard session preferences" and
**may not sell any free input**; step order; and Fried's question whether `terrain` earns a full step (it changes 0% of
sessions and 100% of plan notes). Also in scope: Modify plan's terrain consequence line.

**Trigger:** soft, qualifies. A free runner sees two new steps and loses a card. No new screen or component.
**Tier:** FREE (SLT, ruled). **Words:** the founder delegated today's copy to the assistant; the strings below are proposed
for that delegation and are exact.

This note is the Design Board sitting only. The Coaching Board sitting on what each `hard_session_relationship` answer
prescribes is separate and is not run here.

---

## 1. Analysis, before any seat spoke

### 1a. What the free and paid sequences are today (run, not read)

`getStepSequence` called directly through `tsx` for every tier × goal × strength-offer combination:

| | finish | finish + strength | time target | time target + strength |
|---|---|---|---|---|
| free | 15 | 16 | 16 | 17 |
| paid / trial | 17 | 18 | 18 | 19 |

The difference is exactly `hard-sessions, terrain`, pushed after `weekday-ceiling` (and after `strength` when offered),
before `injuries`. **After the SLT's ruling the two sequences are identical**, so `getStepSequence`'s `hasPaidAccess`
argument stops affecting steps at all.

🔑 **Who actually walks the free sequence is narrower than "free runners".** `DashboardClient` starts `hasPaidAccess` at
`true` and the reverse trial grants every new runner full access, so the **first** wizard, the onboarding one, is already
the 17-step paid sequence for everyone (the SLT note §1c says the same). The free sequence is walked by a runner who
rebuilds after the trial lapses. **So the "two more steps" cost lands on rebuilders, not on onboarding**, and onboarding
does not change at all. How many free rebuilds happen is **not measured**: plans do not stamp the tier they were built at.

### 1b. What the TeaserCard sells, item by item

> *"Unlock more personalisation. Add terrain, hard session preferences, and training style. Your plan adapts to you, not
> a template. Upgrade to personalise →"*

| what it names | true today? | after the SLT ruling |
|---|---|---|
| terrain | the wizard hides it from free; **Modify plan already gives it to free** (SLT §1c) | free, asked of everyone |
| hard session preferences | same | free, asked of everyone |
| training style | **no wizard step asks it at ANY tier.** `training_style` exists in `schema.ts` / `inputs.ts` and is read by `enrich.ts`, but `GeneratePlanScreen.tsx` has no step and no state for it | still asked of no one |

So **all three of its nouns are false after the ruling, and one was already false for every runner who ever saw it.** It is
also drawn on `var(--warn-bg)` / `var(--warn-strong)`, the coaching-and-warnings amber, for a sales message.

### 1c. What the card earns (production, SELECT only)

`analytics_events`, `event = 'upgrade_view'`, grouped by `props.source` (OPS-FUNNEL-02's vocabulary), read through a
throwaway `tsx` script with the service-role client, deleted after the run:

| source | events | users |
|---|---|---|
| today | 11 | 6 |
| me | 4 | 4 |
| **wizard** | **2** | **1** (both on 2026-10-05, ten minutes apart) |
| coach_teaser | 2 | 2 |

`upgrade_view` rows in all: **19**. ⚠️ **`wizard` cannot tell the TeaserCard from the locked distance tile**: both call
`onUpgrade` → `openUpgrade('wizard')`. So the card's whole recorded contribution is **at most one runner**. No
`purchase_completed` / `subscription_started` rows exist to tie it to a payment.

### 1d. Terrain: what the answer does, and what the screen says it does

- **Engine:** `trail` and `mixed` are both in `GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS` and produce **the same**
  `meta.terrain_effort_note` (`ruleEngine.ts:10239`): *"Off-road, let effort and HR lead: the pace targets are a road
  reference, not a number to chase."* Rendered under the label "Off-road" (`planRationale.ts:206`). `road` produces
  nothing. Sessions change on 0 of 1,924 (SLT §1a).
- **AI:** `lib/coaching/prompts/athleteContext.ts:91` passes `Terrain: trail|mixed` to the coach prompts. So `trail` and
  `mixed` **are** distinguished downstream, in AI copy, though not in the engine. That is why the board does not collapse
  the three options to two.
- **Live answers** (SLT §1d, 36 plans with `generator_input`): road 25 · mixed 9 · trail 0 · absent 2. **9 of 34
  answered (26%) get the note.**
- **The words on the step overclaim, in three places:**
  - wizard card `Road.` — *"Speed-focused."* The engine does nothing for road.
  - wizard card `Mixed.` — *"Adapt pace targets to the surface."* **False:** the targets are not adapted; the note says
    they are a road reference.
  - Modify plan row `Terrain` — *"Changes the sessions the plan picks, not how much you run."* **False:** 0% of sessions.
    `modifyPlan.ts`'s own header says a consequence the engine does not produce *"is a claim"*.
  - and the doctrine row: `ui-patterns.md` § Wizard step inventory says terrain's options each *"change pace targets"*.
    Also false; the build corrects it (doctrine edit, not made here).
- `canProceed()` returns `true` for both `hard-sessions` and `terrain` with nothing selected, so neither step forces an
  answer; a skipped step sends `undefined`, which the engine treats as `neutral` / `road`.

### 1e. Consumers, app and website

- **Website:** `app/page.tsx:1379` already lists "terrain" among the wizard's questions with no tier attached. After the
  ruling that sentence is **true for every runner** for the first time. No marketing change. `/pricing` names neither
  field (and `featureGates.ts` has no gate for either, SLT §5). No other marketing surface names them.
- **App:** `CHARITY-CODE-CONTROL-01`'s redeem link anchors to `isLastStep`, and `injuries` stays last for every tier, so it
  is unaffected. The progress line counts nothing (CI-1), so two more steps show no number. `lib/ui/wizardInjuryFree.test.ts`
  holds the old behaviour in two arms (the "stay paid" arm, and "the free-runner upsell no longer sells injury history",
  which reads the TeaserCard's text).

### 1f. Settled-ground scan (`design-rulings.md`, pattern layer and token layer)

- **§6g S4**, an optional step's primary may never be the skip: not touched; neither step is `optional`.
- **§6g S3**, one CTA vocabulary: not touched.
- **§6g permanent kill, "a settings screen that merchandises"** (SLT, unanimous; Sutherland *"put the answer where the
  question occurs"*): the TeaserCard is not on a settings screen, so the kill does not bind it. **Its reasoning does**: the
  card sits on a question about weekday minutes and sells answers to two other questions.
- **STRENGTH-ENTRY-01 (2026-10-17)**: strength sits after the weekday cap because the cap is the second half of the
  week question. Kept; the new order does not split them.
- **Wizard step inventory** (`ui-patterns.md`): "keep this in sync with `getStepSequence`". The order already listed there
  is the paid order, so the inventory's ORDER is already right for the new single sequence; its terrain "Why" is wrong (1d).
- **Kill: conversational wizard; weight/height capture.** Not touched: no step is added that did not already exist.
- **Token layer:** `--warn-bg` / `--warn-strong` are legal tokens; the TeaserCard is the only place they carry a sales
  message. Removing it removes that use; nothing new is added.

**No settled ground is contradicted or reversed.**

### 1g. What this evidence cannot show

Not the free-rebuild completion rate with 17 steps instead of 15 (unmeasured, and the population is unknown). Not whether
the 26% who get the terrain note read it. Not conversion: 19 upgrade views and no purchase events is no funnel, and the
commercial seat is stood down. **Nobody has walked the free sequence on a device.**

---

## 2. The board

### 🧭 Julie Zhuo (Chair)
Three questions came down from the SLT and they are one decision: **is there one wizard or two?** The tier was the only
reason the sequence forked. With the tier gone, a fork that remains is a preference with no owner. One sequence, the one
every new runner already walks. On order: the order is not new to anyone. It is what 100% of onboarding runners see
today; I will not reorder a flow for everyone to solve a problem that exists only for rebuilders. And the success
condition, stated now: `getStepSequence(false, g, s)` equals `getStepSequence(true, g, s)` for every `g` and `s`.

### ✋ Silvanto
The card is amber. Amber in this system means *the coach is telling you something about your training*. We spent it on a
sales line in the middle of a form, and the line was untrue. Removing it is not a loss of anything that was designed. I
have nothing to veto: nothing here touches the palette or the type scale; a use of `--warn-bg` goes away, none arrives.

### 🎓 Sierra
The terrain note is the most on-brand sentence in the plan: *effort leads, the pace is a road reference.* That is the
whole product's lesson, applied to the one surface where a runner most obviously cannot hit a pace. It does not change a
session and it should not; it changes how the runner reads every session. That earns a step for the quarter of runners
who need it, as long as the step stops promising things the engine does not do. *"Adapt pace targets to the surface"*
tells a runner we did work we did not do; when they notice, they stop trusting the targets we did set.

### 📱 Wroblewski
Counting. The step is three cards and a Continue: one tap to answer, one to go on, and it can be passed with one tap and no
answer. Onboarding already pays it. The only runner who now pays it fresh is a lapsed rebuilder, who has done the wizard
before. Folding terrain onto another screen saves one tap and costs a two-question screen, which is the thing the
inventory exists to stop. Making it `optional` changes nothing: it already proceeds unanswered, and an "optional" label on
"where do you run?" invites a "Not sure" button on a question nobody is unsure about. **Keep the step, required-looking,
passable as it is.** And on the card: on a 375px screen it is the tallest block on the weekday step after the chips. It
sits between the runner and the Continue button on a question about minutes.

### 🎪 Collins
I'll take Fried's side, because somebody should. A whole screen for a choice that changes one sentence is a step the
product shows and the engine barely makes: that is my taxonomy question in miniature. Delete the step, default to road,
and put terrain in Modify plan where it already lives, for the 26% who care. *(The chair: the step is already in the flow
every new runner walks, so deleting it is a change to onboarding with no evidence about onboarding; and the AI reads
trail and mixed separately, so the answer is not one sentence for a paid runner. Collins: "then the screen should say
what it does, not what it wishes it did." Agreed by all; that becomes the copy amendment.)* On the card, no argument: a
card selling three things, none of them for sale, is not timid, it is wrong.

---

## 3. Recorded disagreements

- **Collins (with Fried at the SLT) vs the room on terrain's step.** Collins: delete the step, keep the field in Modify plan.
  Lost, on two grounds: deleting it changes the onboarding flow for every runner, which nobody has measured, and the
  answer is read by the AI as well as the engine. **What would reopen it:** a measured wizard drop-off at the terrain step,
  or the AI prompt ceasing to read terrain. Recorded as a ruling Collins lost.
- **None on the TeaserCard.** Unanimous: delete, no replacement.

## 4. Veto check

Silvanto: **none.** No palette or type regression; one use of `--warn-bg` on a non-warning is removed.

---

## 5. Ruling: **SHIP WITH AMENDMENT**

1. **One wizard for every tier.** The free sequence is the paid sequence: `hard-sessions` and `terrain` follow
   `weekday-ceiling` (and `strength` when offered) and precede `injuries`, exactly as onboarding has them today. **No
   reorder.** Tier appears in the wizard only as the locked distance tiles and their sentence, never as a missing step or
   an inline upsell.
2. **The TeaserCard is deleted, with no replacement.** The SLT forbade it selling a free input; every noun it names is free
   or unasked, nothing paid is left on that step to sell, and its recorded yield is at most one runner (1c). The
   `TeaserCard` component goes with its only call site. *Unlock-type copy may not return to a wizard step that asks no paid
   question.*
3. **Terrain keeps its own step** (Fried's question answered: yes), **with its claims corrected** (amendment, Collins's):
   the step says what the answer does, which is one note about pace off-road, and no option promises a change to targets
   or sessions.
4. **Modify plan's terrain consequence is corrected** to the true blast radius: a note, sessions unchanged.
5. **The "Rein me in" spelling** on the `overdo` card is corrected (a defect, no ruling needed; carried in the same build).

### Exact strings (proposed under the founder's delegation; no em dashes)

| where | now | ships as |
|---|---|---|
| `TeaserCard` (eyebrow, body, link) | *Unlock more personalisation* / *Add terrain, hard session preferences, and training style. Your plan adapts to you, not a template.* / *Upgrade to personalise →* | **deleted, no string** |
| wizard `terrain` subtitle | *Road, trail, or a bit of both. Off-road, we coach by effort, not pace.* | *Road, trail, or a bit of both. Off-road, effort leads and pace is a guide.* |
| wizard `Road.` sub | *Pavement, tracks, flat surfaces. Speed-focused.* | *Pavement, track, mostly flat.* |
| wizard `Trail.` sub | *Off-road, elevation, technical terrain. Effort-focused.* | *Off-road, hills, rough ground. Effort leads, not pace.* |
| wizard `Mixed.` sub | *Both. Adapt pace targets to the surface.* | *Some of each. Off-road, effort leads, not pace.* |
| Modify plan `Terrain` consequence | *Changes the sessions the plan picks, not how much you run.* | *Adds a note on pacing off-road. Your sessions stay the same.* |
| wizard `I overdo it.` sub | *Reign me in. I know I'll push too hard if I can.* | *Rein me in. I know I'll push too hard if I can.* |

The Modify string passes `modifyPlan.test.ts`'s existing pattern arms (length > 20; no benefit word; no em dash).

### What the build carries (not built here)

1. **Pattern** (`ui-patterns.md` § Wizard step inventory, doctrine edit at build): one sentence above the table, *"One
   sequence for every tier: tier shows only as a locked option, never as a missing step or an inline upsell"*; and the
   `terrain` row's Why becomes *"Judgement; trail and mixed add one effort-leads note, sessions unchanged"*.
2. **Constant:** `getStepSequence` loses its tier argument (or ignores it) so the sequence has one owner; the step copy
   stays in `STEP_META`, the Modify line in `MODIFIABLE_ROWS`.
3. **Mechanical check, falsified both ways:** in `lib/ui/wizardInjuryFree.test.ts`, (a) the "stay paid" arm inverts to
   *the sequence is identical at both tiers* for every goal × strength-offer combination; (b) the upsell arm becomes *no
   `TeaserCard` and no "Unlock" copy in `GeneratePlanScreen.tsx`*; (c) the payload lines for both fields do not read
   `hasPaidAccess`. In `modifyPlan.test.ts`, the terrain row's consequence must not claim a session change (assert it
   contains "sessions stay the same"). Falsify by restoring `if (hasPaidAccess)` (a goes red) and restoring the card (b
   goes red).
4. **Register row** in `design-rulings.md` (returned to the orchestrator).

## 6. Routing

- 🏃 **Coaching Board** is next on the item, on what each `hard_session_relationship` answer prescribes. **This board did
  not re-word the `hard-sessions` card subtitles beyond the typo** (*"No intervals unless absolutely necessary"*, *"More
  quality, more structure"*): they describe prescription, so they follow that sitting's ruling, not this one.
- 💼 SLT: nothing back. 👤 Founder: words delegated today; the table above is the proposal.

## 7. MUST/NEVER check

No hardcoded colour or font added (one `--warn-*` use removed). No modal, no new screen, no new component. No em dash in any
proposed string; the en dash in *"Monday–Friday"* is untouched. Free users never abandoned: a lapsed rebuilder keeps both
answers, which is the SLT's point 5. No gamification. Website consistent without change.

## 8. What this ruling does not settle

- Whether two more steps lower completion of a free rebuild: unmeasured, population unknown.
- Whether anything should sell the paid tier inside the wizard at all: this rules only that the weekday step has nothing
  true to sell. A future proposal needs a measured conversion problem (the §6g kill's standard).
- The `hard-sessions` card copy, beyond the typo: the Coaching Board's sitting first.
- `training_style`: an input the schema accepts and the AI reads, asked by no wizard step at any tier. Not this item.
- Nothing here was walked on a device.
