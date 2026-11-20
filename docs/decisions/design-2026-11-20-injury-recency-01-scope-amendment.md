# Design Board — 2026-11-20 (scope amendment) — `INJURY-RECENCY-01`: Back from the marathon, Plantar from the half

Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

**Trigger:** soft, qualifying. A hand-off from the Coaching Board, not a new design question: it changes which runners
see the follow-up ruled this morning (`design-2026-11-20-injury-recency-01-followup.md`, SHIP WITH AMENDMENT, NOT BUILT).
**Change:** the recency follow-up shows for Back at marathon and ultra only, and for Plantar fasciitis from the half
marathon, because Back's injury cap becomes the HM cap.
**Tier:** FREE (unchanged; SLT 2026-10-28).

**Settled ground read whole and not re-ruled:**
- `design-2026-11-20-injury-recency-01-followup.md`: shape, two answers, `Chip` single-select, optional, absent =
  current, state rules, founder owns the words. **Only its visibility row is touched here.**
- `coaching-2026-11-20-long-run-cap-injury-value-01-prototype.md` (CORRECT WITH AMENDMENT): Back 120 → 135, defined as
  `LONG_RUN_CAP_MINUTES.HM`; Plantar stays 120; recency table unchanged. Its hand-off: *"Back's recency follow-up
  shows at marathon and ultra only; Plantar's still shows from the half."*
- `coaching-2026-11-20-injury-recency-01.md`: `longer_ago` lifts the cap for Back and Plantar; absent = current.

---

## 📐 Analysis, before any seat spoke

### The hand-off, re-derived from the engine (not taken on the Coaching note's word)
`longRunTimeCap` (`lib/plan/longRunTimeCap.ts`) takes an injury ceiling only when it is **strictly lower** than the
distance ceiling (`m < out.mins`). Scratch script, config mutated **in memory only** to the Coaching ruling's value
(`back = LONG_RUN_CAP_MINUTES.HM`), nothing written:
`npx tsx <scratchpad>/scope.ts` (calls `longRunTimeCap` for each chip alone and both together, every distance × goal).

| race (finish / time) | Back today | **Back = HM cap** | Plantar (both) | Both ticked, Back = HM cap |
|---|---|---|---|---|
| 5K | 70 / 90 `distance` | same | same | `distance` |
| 10K | 120 `distance` | same | same | `distance` |
| **HM** | 120 `injury` | **135 `distance`** | 120 `injury` | 120 `injury` (**plantar**) |
| marathon · 50K · 100K | 120 `injury` | **135 `injury`** | 120 `injury` | 120 `injury` (**plantar**) |

**Confirmed:** with Back at 135, Back's cap is equal to the HM ceiling, not lower, so a `longer_ago` answer for Back
moves nothing at the half. It still binds at marathon, 50K and 100K. Plantar binds from the half, unchanged.

### 🔴 The trap the visibility rule must not fall into: two chips ticked
`longRunTimeCap` reports **one** binding injury, the lowest. With both chips ticked at the marathon it reports
`plantar_fasciitis`, so a predicate written as *"is this chip the binding injury on the runner's full input?"* would
**hide Back's follow-up at the marathon** whenever Plantar is also ticked. That is wrong: Back's answer still matters
there (both `longer_ago` → 210; Back current with Plantar `longer_ago` → 135). The predicate has to be evaluated
**per chip, as if that chip were the only one ticked**: *does this chip's own ceiling bind below the distance
ceiling for this race and goal?* At the half with both ticked, that correctly shows Plantar and hides Back.

### Live (production, read-only: `npx tsx scripts/board-evidence-injury-recency-01-followup.ts`, re-run today)
- 43 plans · 36 with `generator_input` · 15 with any chip · tally knee 6 · plantar 4 · hip 4 · achilles 3 · shin 3 ·
  back 1. **Identical to the morning sitting.**
- The five Back/Plantar carriers: three 5K Plantar, one **marathon Plantar**, one **marathon Back** (with knee, hip,
  shin). **0 Back carriers at the half; 0 carry both.**
- **So the amendment changes what 0 of 43 live runners see.** Still 2 of 43 would be asked; both remain shown.
  The amendment is a correctness rule for the population to come, not a live remedy.

### What the evidence can and cannot show
Can: exactly where each chip's answer moves the engine under the Coaching ruling, and that live exposure is unchanged.
Cannot: anything rendered or felt; the share of marathon Back runners whose long run actually reaches 135 min
(**not measured**); 50K/100K plan shapes (the Coaching note's own gap). The 135 value is **not built**; until it is,
an engine-owned predicate correctly still shows Back at the half.

---

## 🔍 Settled-ground scan (`design-rulings.md`, pattern and token layer)

| Row | Relation |
|---|---|
| **2026-11-20 `INJURY-RECENCY-01` (follow-up)** · SHIP WITH AMENDMENT | **Amended, visibility row only.** "HM and longer today" becomes per chip; everything else stands |
| **SLT 2026-10-28** — *"if nothing changes, it is not collected"* | The governing test; applied to Back at the half |
| **2026-11-16 `RACE-NOTES-INERT-01`** + the 11-16 inert-field test | Applied one axis further again (per chip **and** per distance) |
| **2026-11-16 `INJURY-RECENCY-01` · CANNOT RULE YET** | Already discharged this morning |
| `ui-patterns.md` § Wizard step inventory, `injuries` row | The morning's artifact 1 stands; its rule *"the predicate is the engine's"* is what makes this amendment cost no component code |
| Token layer | Untouched |

---

### 🧭 Julie Zhuo (Chair)
*"This is the morning's success condition doing its job. We said the follow-up appears only where the answer changes
the plan, and the Coaching Board just moved where that is for Back. If we had written 'HM and longer' into the
component, this sitting would be a code change. We wrote 'the engine's predicate', so it is a test change. What I want
nailed down is the definition, because the analysis found the one place a reasonable builder would get it wrong."*

### ✋ Silvanto
*"Nothing visual moves. One consequence worth naming: a half-marathoner with both chips now sees one follow-up, not
two, and the row it sees must be named by its chip, which the morning ruling already requires. No veto."*

### 🎓 Kathy Sierra
*"A half-marathoner with an old back gets the 135-minute long run whatever they answer, so asking them would be us
pretending a question matters. Agreed. My dissent from this morning on optional stands, and the population it
applies to just got smaller."*

### 📱 Luke Wroblewski
*"Per chip, evaluated alone. The alternative, hiding Back because Plantar is the lower ceiling, would also make a
follow-up appear and disappear as another chip is ticked, which moves rows under the thumb. Per-chip-alone does not
depend on any other chip or answer, so the follow-ups only ever change with that chip or the race on step one, which
the morning's state rules already cover."*

### 🎪 Brian Collins
*"The taxonomy just got cleaner: two chips, two different scopes, both derived. Nothing to add."*

---

### ⚡ Recorded disagreements
None new. Sierra's optional/required dissent from the morning sitting stands unchanged and is not reopened.

### ⛔ Veto check
Silvanto: **none.** No palette or type change.

## ⚖️ Ruling — **SHIP WITH AMENDMENT** · NOT BUILT

| Decision | Status | Why |
|---|---|---|
| **Back's follow-up shows at marathon, 50K and 100K only; Plantar's from the half marathon** (under the Coaching ruling's Back = HM cap) | 🟢 **SHIP (amendment)** | Re-derived: at HM Back's cap equals the distance cap, so its answer is engine-identical; SLT's *"if nothing changes, it is not collected"* |
| **The predicate is per chip, evaluated as if that chip alone were ticked:** shown ⇔ that chip's injury ceiling is strictly below the race's distance ceiling (`longRunTimeCap` with `[chip]`, `source === 'injury'`) | 🟢 **SHIP (amendment)** | Reading the binding injury off the full input hides Back at the marathon whenever Plantar is ticked, where Back's answer still moves the cap (210 vs 135). Per-chip-alone also never moves a row in response to another chip |
| **No distance or chip literal anywhere; the scope above is a derived consequence, not a list** | 🟢 **SHIP** (restates the morning row) | Until the 135 value is built, the same predicate correctly still shows Back at the half; no coordination between the two builds is needed |
| Everything else in the morning ruling | ⚪ **unchanged** | Shape, two answers, optional, absent = current, state rules, 👤 words |

### 📦 Required artifacts (with the build, one commit; amends the morning's list)
1. **Pattern** — the morning's `ui-patterns.md` `injuries` row, plus one clause: *"evaluated per chip, as if it were
   the only chip ticked."*
2. **Constant** — the morning's single `lib/plan/` predicate, signature taking **one** chip key plus race and goal.
   It reads `GENERATION_CONFIG.LONG_RUN_CAP_MINUTES_BY_INJURY` and `longRunTimeCap`; no new value.
3. **Mechanical check** — the morning's chip × distance × goal test, with expectations **derived from
   `longRunTimeCap`**, plus two named arms: (a) **both chips ticked at the marathon shows both follow-ups**; (b) the
   predicate agrees with config at the half (Back shown ⇔ `back < LONG_RUN_CAP_MINUTES.HM`, so once the Coaching build
   lands, Back is hidden at HM and Plantar shown). **Falsify** (in addition to the morning's three): implement the
   predicate on the full input (arm (a) goes red); hardcode "HM and longer" for Back (arm (b) goes red once back = 135).
4. **Register row** — below; amends the morning row by reference rather than rewriting it.

### ↗️ Routing
None. No Coaching sitting (the scope is a read of the Coaching Board's own ruling and the existing `longRunTimeCap`).
No SLT. 👤 founder words unchanged.

### 🚨 MUST/NEVER check
No modal, no new step, no colour, no hardcoded values, no new control, FREE. No new sentence is introduced by this
amendment.

## ⚠️ What this ruling does not settle
- Nothing rendered or seen on a device.
- Live exposure is **unchanged** (2 of 43; 0 Back at the half; 0 with both chips): this is a rule for future runners.
- The share of marathon/ultra Back runners whose long run actually reaches 135 min: **not measured**; for some, the
  answer will still change nothing.
- 50K / 100K plans and the maintenance / foundation paths: **not measured** here (the Coaching note's own gaps).
- The Coaching Board's `measure:fitness` conditions on both builds are not discharged by this sitting.
