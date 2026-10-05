# Design Board — backlog clearance sitting, 2026-10-05

**Convened by:** founder instruction — *"take everything that we currently got on the backlog that
needs a design board to the design board and get those documented and the backlog updated."*
**Scope:** every open backlog item carrying a 🧭 **DESIGN BOARD** tag. **No building today.**
**Seats:** Zhuo (chair) · Silvanto · Sierra · Wroblewski · Collins
**Authority:** ADR-023. Register: `docs/canonical/design-rulings.md`.

---

## 🔍 Settled-ground scan — run FIRST, and it changed the agenda

**Thirteen items carried the tag. Seven were already ruled or already closed.** The scan is
mandatory and this is what it is for: without it the board would have re-argued more than half the
agenda, which is the exact cost `design-rulings.md` exists to prevent.

| Item | Status going in | Where |
|---|---|---|
| `LEDGER-PLACEMENT-01` | **CLOSED** — both live questions ruled 2026-09-29 | register + SLT note today |
| `SHEET-DAY-QUESTION-01` | **RULED: SHIP, scoped.** Engine half → `DAYS-GATE-CAPACITY-01` | item body |
| `STEPPER-CONTROL-01` | **RULED 2026-09-25**, split; arm (d) INSUFFICIENT EVIDENCE | register |
| `UI-PATTERNS-ENFORCEMENT-01` | **RULED:** *"ship the measurement, not the gates"* | register |
| `UI-PATTERNS-MOMENTS-01` | **INSUFFICIENT EVIDENCE** + recorded Collins/Zhuo split, conditions named | register |
| `DESIGN-PERFORATION-01` | **INSUFFICIENT EVIDENCE**, artefact named | register |
| `SHEET-DATE-INPUT-01` | **DEFERRED** — and measured **CLOSED** today, see below | register |

**Six items needed a ruling. They are below, plus one residual routed here by the SLT this morning.**

---

## 🔴 TWO OF MY OWN PRE-SITTING MEASUREMENTS WERE STALE, AND BOTH MADE THE WORK LOOK BIGGER

Recorded because it is the third occurrence of this class in three days and the second today.

| I carried into the room | The code says |
|---|---|
| *"`SegmentedControl` has `padding: '8px 10px'` and no `minHeight` — 30px, reached from login, Preferences, ModifyPlanSheet, Chip and DashboardClient. Fixing it clears ~7 of 18."* | `SEGMENTED_MIN_HEIGHT_PX = 44`, **set 2026-10-01**, and the control came OFF the register that day. **I was reading the component's own past-tense comment describing the defect as if it were the state.** |
| *"the under-floor register has 18 entries"* | **17.** `app/page.tsx = 43px` came off on 2026-10-02. The `18` and its height multiset are a historical move-proof note inside the file. |
| *"`SHEET-DATE-INPUT-01` — a hand-rolled `<input type="date">` at 13px, the only native control"* | Already migrated to `TextField`, which locks **16px** and full width. The iOS-zoom defect and the disabled-field look are **both gone**. |

⚠️ **A comment that records a fixed defect reads exactly like a comment that reports a live one.**
The repo's own rule — *an item is a snapshot of the code on the day it was written, re-measure
before you pick it up* — applies to **source comments and to my own notes**, not only to backlog
items. Every stale read today ran in the direction of a bigger job.

---

## 📐 The measurements this sitting is built on — derived today, not quoted

**Controls.** Re-ran `docs/component-migration-log.md`'s own standing-count script (the one that
strips comments first, after it was found inflating by 8):

```
hand-rolled <button>: 59      <Button> component: 144      total: 203   on-component: 71%
```

Identical to the 2026-10-02 row: **no regression, and `BUTTON-MIGRATION-02`'s headline "the other
178 controls" is stale by 119.**

**The 44px floor.** `REGISTERED_UNDER_FLOOR` holds **17** entries. Four are preview harnesses
(`onboarding-preview` ×2, `wizard-preview` ×2) and need no ruling. Three are already-ruled display
rows, not controls (`TrainingZonesScreen` 43px; the two 41px settings rows). **Ten runner-facing
controls remain:**

| File | Heights |
|---|---|
| **`SessionPopupInner.tsx`** | **18 · 30 · 37 · 38** |
| `SupportScreen.tsx` | 24 |
| `DashboardClient.tsx` | 30 |
| `ModifyPlanSheet.tsx` | 30 |
| `PendingAdjustmentBanner.tsx` | 36 |
| `Chip.tsx` | 37 |
| `app/charity-runners/page.tsx` | 39 |

**🔴 The two open items converge on ONE file.** `SessionPopupInner.tsx` is simultaneously the
**#1 hand-rolled file** (7 controls, more than twice the next) and **4 of the 10 runner-facing
under-floor entries, including the worst in the product at 18px**. Nothing in the agenda said so;
it fell out of measuring both populations in the same pass.

---

## 🧭 RULING 1 — `TAP-TARGET-DECISIONS-01` + `BUTTON-MIGRATION-02`: **SHIP, MERGED, ONE FILE FIRST**

### 📱 Wroblewski
*"Eighteen pixels. On a phone, outdoors, one-handed. The floor is 44 because a fingertip is about
that, and this is less than half. And it is not a marginal control — the session popup is where the
runner goes to say what they actually did. I have counted the ten and they are not ten jobs: four
of them are one file."*

### ✋ Silvanto
*"I am not exercising the veto; there is no palette or type regression here. But I will say the
thing the register keeps nearly saying: the heights are not the decision. `app/page.tsx` was 43
because it hand-rolled seven properties `.btn` already owns, and the moment it used the class it
became 47. **The floor is a symptom of ownership.** Convert the control and the height is correct
for free."*

### 🧭 Zhuo (chair)
*"That is the ruling, then. These were filed as two items because they were found by two different
checks, and they are one job: `SessionPopupInner` is 7 of 59 hand-rolled controls and 4 of 10
under-floor ones. **Do not batch by height and do not batch by variant. Batch by FILE**, worst
first, and the two registers move together. I want the success condition stated now, before any
code: `SessionPopupInner` leaves `REGISTERED_UNDER_FLOOR` entirely, and the hand-rolled count
drops from 59 by exactly 7, with `geometry moved: 0` on every other call site."*

### 🎓 Sierra
*"No objection. A tap target the runner misses is the app making them feel clumsy at the exact
moment they are reporting an honest effort. That is the opposite of what we are for."*

### 🎪 Collins
*"Also no objection, and I will not pretend this is interesting. It is hygiene. **But 71% on a
shared component is the number I care about** — the day that hits 100 for everything that belongs
in `Button`, a visual change is one edit instead of fifty-nine. Keep the 36 selected-state toggles
and the 15 icon-only controls OUT, as already ruled; sweeping them in would destroy the only
selected affordance we have."*

### ⚖️ Ruling — **SHIP, with amendment**
**The two items MERGE and are re-scoped to batch by file, not by height or variant.**
- **Batch 8a = `SessionPopupInner.tsx` alone.** Acceptance: 4 register entries removed, hand-rolled
  59 → 52, `geometry moved: 0` elsewhere, `buttonOwnership` and `buttonGeometry` both green.
- Then by descending under-floor count. `charity-runners` (39px) is already on `btn` classes, so
  inspect before converting — it may be a compact-variant question, not a conversion.
- **Unchanged and re-affirmed:** the 36 selected-state toggles and 15 icon-only controls are a
  different primitive and are not in scope. `TrainingZonesScreen` 43px and the two 41px rows are
  display rows; the floor does not reach them. *"The floor is really 40"* stays **rejected on
  measurement** — nothing in the population sits at 40.
- **`BUTTON-MIGRATION-02`'s stated numbers are void.** Re-measure from
  `docs/component-migration-log.md` before each batch, as that document already instructs.

---

## 🧭 RULING 2 — `COACHBYLINE-EMPTY-VARIANT-01`: **SHIP**

**Measured:** `CoachByline` has **18 call sites** across app and marketing. `DashboardClient`
`:5259–5275` hand-rolls the 22px avatar, the name and the eyebrow — **17 lines reproducing the
component's own internals** — because the component always renders `<AIMark />` and the empty line
is hand-authored, so it must not claim provenance (Pattern 16).

### ✋ Silvanto
*"The reason for the hand-roll is **correct** and must survive the fix. An empty state that carries
the AI glyph is the product claiming a model wrote a line no model wrote. That is not a style
preference, it is honesty."*

### 🧭 Zhuo
*"Then the component is missing a state, not the call site being clever. Seventeen of eighteen sites
use the component; the eighteenth needs an `empty` variant that suppresses the AIMark and dims.
**A component that does not cover its own empty state will be hand-rolled again** — this is the one
place the repo's own SLC rule applies directly: a component without its empty state is not
complete."*

### 📱 Wroblewski
*"Check the dimming lands on the whole unit and not on the AIMark's absence. `opacity: 0.45` on an
inline-flex is fine; applied per-child it will not be."*

### ⚖️ Ruling — **SHIP**
`CoachByline` gains an **`empty` variant**: no `<AIMark />`, dimmed, same geometry. `DashboardClient`
`:5255–5278` collapses to one `<CoachByline empty … />`. **Artifacts:** pattern note in
`ui-patterns.md` § CoachByline (the empty state is the component's, and why the AIMark must not
render); the variant as the constant; a mechanical check asserting **no call site outside
`CoachByline.tsx` renders an avatar-plus-name-plus-eyebrow triple** — falsify it by re-adding the
hand-roll.

---

## 🧭 RULING 3 — `DESIGN-MILES-TAKEABLES-01`: **CLOSE IT. One arm survives.**

The item's own body already records the damage: **M-1 RETRACTED (already built), two of four
RETRACTED on verification, one SUPERSEDED the next day.**

### 🧭 Zhuo
*"Three of four arms died before this sitting opened. An item that is 75% retracted is not an item,
it is a residue, and leaving it open means every future scan re-reads four dead proposals to find
one live one."*

### 🎪 Collins
*"I will take the loss on the record. The open-lens review produced four and the product had already
done one of them. **That is the cost of reviewing from impressions instead of measurements** — the
same correction I took on the palette. What is left is the icon rule, and it is worth having."*

### ⚖️ Ruling — **DON'T SHIP as filed. CLOSE and re-file the single survivor.**
`DESIGN-MILES-TAKEABLES-01` closes. The surviving icon rule is re-filed on its own merit with a
measured population (*how many surfaces carry an icon beside a label today, and how many do not?*) —
**no number is quoted from the old item**. M-1's retraction stands as the precedent: the product
already did it.

---

## 🧭 RULING 4 — `SITE-SCROLL-DEPTH-01`: **INSUFFICIENT EVIDENCE stands. The condition is unchanged and unmet.**

Ruled INSUFFICIENT EVIDENCE on 2026-09-28 because **there is no site analytics at all** — nobody can
say whether a visitor reaches the `W-02` journey section or `SameWeekTwice`. Re-checked today: the
condition has not been met.

### 🎪 Collins
*"I lost this one and I am still right about the shape of it. We are arguing about whether to show
adaptation to people we cannot prove arrive."*

### 🧭 Zhuo (chair)
*"And the ruling does not move, because the answer is not a design decision — it is instrumentation.
**This item is blocked on something outside this board's gift and should say so**, rather than
sitting on the design agenda looking like a design question. It carries Traynor's standing
objection: what is the traffic?"*

### ⚖️ Ruling — **INSUFFICIENT EVIDENCE, re-affirmed. Re-tagged.**
Board tag changes 🧭 **DESIGN BOARD** → ⚙️ **NO BOARD (blocked on instrumentation)** with a named
unblock: site-side scroll-depth on `/` reaching the `W-02` section and `SameWeekTwice`. **It returns
here the day there is a number and not before.** This is the same class as the SLT's
`OPS-ARTIFACT-PLACEMENT-01` freeze this morning: a decision waiting on a population, not on a view.

---

## 🧭 RULING 5 — `FIRSTRUN-MARATHON-01` (design half): **SHIP the touchpoint, and the headline claim stays corrected**

The item carries its own correction in capitals: *"CORRECTED 2026-09-18, BEFORE BUILDING — I
OVERSTATED THIS AND THE SITTING BELOW IS WRONG IN ITS HEADLINE CLAIM."* The SLT already ruled the
framing; what is left here is what the runner sees at **the first missed session**.

### 🎓 Sierra
*"This is the only item today that is about the runner getting better rather than the product getting
tidier. The first missed session is where someone decides whether they are *a person whose plan
broke* or *a person who failed*. The product has exactly one sentence to settle that, and the
sentence is already in the brand: **'Happens. Plan's been shifted.'**"*

### ✋ Silvanto
*"Then the moment must be given weight and nothing else on the screen may compete with it. This is
the progressive-disclosure case, not the density case: one line, the shift, and a way back. No
summary of what was lost."*

### 📱 Wroblewski
*"And no decision. Do not ask someone who has just missed a run to choose between four
rescheduling options. Show what the plan did, give one way to disagree with it."*

### 🧭 Zhuo (chair)
*"Ruled. But the headline claim is corrected and stays corrected — **build to the item's correction,
not to its sitting narrative.** Anyone picking this up reads the 🔴 block first."*

### ⚖️ Ruling — **SHIP, scoped to one surface and one sentence**
The missed-session touchpoint renders: the shift that was made, in the brand's existing voice, and a
single way to disagree. **No recap of the missed session. No multi-option chooser.** Any claim about
training consequence is **not this board's** and routes to 🏃 the Coaching Board (the W-03
precedent). Artifacts on build: a pattern row, the copy from `brand.md`'s locked register (not newly
written), and a check that the surface renders **one** action.

---

## 🧭 RULING 6 — the SLT residual: **does the Coach ledger duplicate stay?**

Routed here this morning by the SLT with the measurement attached: **`me` 123 views / 9 users vs
`coach` 33 views / 8 users — a 3.7:1 split.**

### 🧭 Zhuo
*"Same users, near enough: 9 and 8. So this is not two audiences, it is one audience with a clear
preference about where it looks."*

### 🎪 Collins
*"Then it is a taxonomy question and my answer is the one I always give: **two doors to one thing is
not generosity, it is indecision made visible.** Pick the door."*

### 🎓 Sierra
*"The ledger is an execution metric — did you do what you said you would. That is identity, and
identity lives on Me. Coach is where the product talks to you; the ledger is where you look at
yourself."*

### ✋ Silvanto
*"No objection, and one note: when it leaves Coach, check what reached it only from there."*

### ⚖️ Ruling — **DON'T SHIP the duplicate. The ledger is Me's.**
The Coach render site is removed; **`me` is the single home**, consistent with
`LEDGER-PLACEMENT-01`'s *"an identity / execution metric, not admin chrome."*
⚠️ **This is a REMOVAL ACROSS A GATE and gets `/build` § 5b in full** — the Coach site is behind
`hasPaidAccess` and the Me site is ungated, so removal changes nothing about reach for free users
**and must not be allowed to**. `ledgerReach.test.ts` already asserts the Me site is reachable by a
free user: that arm is the regression guard and must be falsified again after the removal.

---

## ⚡ Recorded disagreements

**🎪 Collins vs the chair on `SITE-SCROLL-DEPTH-01`** — carried forward unresolved from 2026-09-28,
and the board declined to re-argue it without the measurement. *Collins moves if* scroll depth shows
visitors reaching the section; *Zhuo moves if* the same.

**No new disagreement arose.** Rulings 1, 2, 5 and 6 were unanimous. Ruling 3 is a loss Collins took
on the record. Ruling 4 is a re-affirmation.

## ⛔ Veto check

**None exercised.** ✋ Silvanto declined explicitly on Ruling 1 (a tap-target floor is not a palette
or type regression) and his intervention on Ruling 2 was substantive, not a veto: the AIMark
suppression is a **provenance** requirement from Pattern 16, and it is preserved by the ruling rather
than overridden by it.

## ⚠️ What this sitting does not settle

- **Nothing has run on a device.** The 18px control was measured from computed style, not touched.
- **Six rulings, zero lines of code.** Every acceptance condition above is unverified by
  construction; each one is a claim about what a future build must prove, not a result.
- **`SessionPopupInner` is auth-gated** and `/sheet-preview` does not cover it, so the 4 under-floor
  controls cannot be seen in place today.
- The **surviving icon rule** from Ruling 3 has **no measured population yet** — that is the
  condition of its re-filing, and it is not met in this document.
- Ruling 6 removes a render site; **what reached the ledger only from Coach is named as a §5b ask,
  not answered.**
