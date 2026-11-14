# Coaching Board — 2026-11-14. Two notes that state the wrong thing

Wave 2 of the agreed block. Both items are a plan telling a runner something untrue about their
own plan. Neither is a wording question, which is why neither was exempt.

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims.

---

## 🔍 Conflict scan — and it moved both items

| § | Bearing |
|---|---|
| **§40c** *A suppressed target is stated, never absorbed* (2026-08-20) | Owns the materiality test under review. 🔑 **Its entire evidence table is single-cap shapes, because `day_budgets` did not exist when it was written.** It never decided this question |
| **§114** *The long run fits the week it is in — the "get you round" plan* (2026-09-19, **founder decision**) | Owns the sentence under review. *"Give them a get you round plan"* — his words, resolving a trilemma between §9, §52 and §24/§80 |
| **CB-PLAN-REVIEW-01** (2026-09-19) | **Already ruled this exact sentence false for one cohort** and carved it out — *"two causes wore one sentence, and for the commoner one it was FALSE"*. Measured then: wrong **78.7%** of the times it fired |
| **`FINISH-WORDING-FLOOR-01`** (2026-10-09, withdrawal upheld) | Ruled on the note's **magnitude floor**, not on whether it contradicts a time goal. Different question; not settled ground |
| §23 *Peak overload requirement* | Supplies the "nowhere to ramp to" case CB-PLAN-REVIEW-01 keyed its carve-out on |

---

## 1. `ROUND-NOTE-TIME-GOAL-01` — ⚖️ CORRECT WITH AMENDMENT

**The item:** `meta.volume_constraint_note` tells a runner who asked for 4:00 that the plan is *"built
to get you round, not to chase a time"*. It asked for a measurement first, and nobody had taken one.

📐 **Measured, 2,948 plans:** **944 of 1,396 time-goal plans (67.6% of this grid) carry the
sentence**, and **208 of them are runners on 60 km/week** — by volume: 10km:136 · 20km:184 ·
30km:208 · 45km:208 · 60km:208. ⚠️ **A grid rate, not a production rate:** the grid weights
volumes evenly and real runners do not arrive evenly.

🔴 **THE CAUSE IS A SECOND PRODUCER, AND THE BOARD'S OWN EARLIER FIX REACHED ONLY THE FIRST.**
`CB-PLAN-REVIEW-01` conditioned the sentence inside `peakOverloadResult`: where the runner's volume
is already adequate and only the ramp ratio fails (`atCeiling`), it says *"Your weekly volume is
already where this distance wants it, so this plan sharpens rather than builds."* **`lopsidedNote`
— fourth in the `finalVolumeNote` precedence chain — writes the original sentence unconditionally,
with no goal test and no ceiling test.** Fix the pair, not the instance.

**🏃 Hutchinson (chair):** *"We ruled on this sentence fourteen months of defects ago and wrote the
carve-out into one branch. The board does not get to be surprised that the other branch kept
saying it. What I will not accept is re-opening §114 — the founder decided that, and a lopsided
week genuinely is a get-you-round plan. The question is only whether a runner whose volume is
already adequate is in that case."*

**📊 Seiler:** *"At 60 km a week for a four-hour marathon the volume is not the binding constraint;
the week's COMPOSITION is. Telling them we cannot chase their time is not a conservative error, it
is a wrong diagnosis — and it points them at the one lever that will not help."*

**🎯 McMillan:** *"My position carried at §114 and I stand by it: when the long run cannot fit the
week, say so plainly. But I said that about a runner at 8 km a week. A runner at 60 who has a
lopsided week has a DISTRIBUTION problem, and the honest sentence names that."*

**🩹 Willy:** *"No load objection. Nothing about the prescription changes — this is what we say
about a plan we are building either way."*

**⚕️ Sims:** *"My reason at CB-PLAN-REVIEW-01 was that 'get you round' reads as being quietly
reassigned to a lesser category. That is exactly as true here, and the cohort is larger."*

### ⚖️ Ruling: CORRECT WITH AMENDMENT

`lopsidedNote` takes the same carve-out `CB-PLAN-REVIEW-01` gave its sibling. **Where the runner
asked for a time AND their weekly volume is already adequate for the distance, the lopsided week is
described as a composition problem, not as an inability to chase the time.** §114's sentence is
unchanged everywhere else, including every finish-goal plan and every genuinely under-built runner.

⚠️ **"Adequate" is not a new number.** It reuses the test the engine already has for this —
`atCeiling`'s condition, which is §23's "nowhere to ramp to". A second definition of adequate
volume is how two notes come to disagree, which is this item.

---

## 2. `SHORTFALL-PINNED-DAY-BUDGET-01` — ⚖️ CORRECT

**The item:** `volumeShortfallPct` counts a weekday easy run as pinned when
`duration_mins >= max_weekday_mins - 1`, and `max_weekday_mins` is the **minimum** across running
weekdays. So a Tuesday run of 85 minutes against a 90-minute Tuesday budget counts as pinned at 35.

📐 **Measured on the engine, before and after the producer change: 765 plans, 336 → 333 notes.
Three plans, all marathon / 20 km a week / 3 days / finish-goal / roomy-majority budgets.**

🔴 **TWO EARLIER FIGURES FOR THIS WERE WRONG AND BOTH WERE MINE, in the same way twice.** The
filing item said 39 of 2,055 flip with 34 silences. I then measured 1,536 flips and 456 silences —
**by recomputing the pinned share in my own probe**, which is a different quantity: `day_budgets`
also changes the plan the engine BUILDS, so most of those plans no longer had a shortfall to
declare at all. **Only a before/after run of the real producer answers it, and the answer is 3.**
⚠️ **What this does NOT prove:** not that each of the three had no real shortfall — only that **the
CAP was not what shaped it**. A `peakIntent > peakActual` gap from any other cause sits outside
this gate either way, and did before.

🔑 **§40c NEVER DECIDED THIS.** It was added 2026-08-20 and its whole evidence table is single-cap
shapes, because `day_budgets` did not exist. The question is not which reading is faithful to §40c;
it is which reading §40c would have chosen had the input existed.

**🏃 Hutchinson (chair):** *"Then we are legislating, not interpreting, and we should say so. The
principle asks whether a life-first constraint MATERIALLY suppressed the plan. A runner who told us
Tuesday is 90 minutes has not been suppressed on Tuesday."*

**🎯 McMillan:** *"Read it against the runner's own answer. They gave us five numbers; measuring
all five against the smallest one tells them their roomy day is as constrained as their tightest,
which is not what they said and not what they experience."*

**📊 Seiler:** *"And it inflates the count in the direction that makes the plan look more
constrained than it is. A note going silent here is not the suppression of a finding — it is a plan
that was never materially capped being told it was."* ⚠️ **His reasoning stands; the number I gave
him with it did not.** I quoted 456 at the sitting and the measured figure is **3**. A seat's
recorded argument resting on a figure I later disproved is the worst place for one, so it is
corrected rather than left to read as the board's own estimate."*

**🩹 Willy:** *"Watch the other side. §40c exists because a real shortfall used to ship
undeclared, and `volume_shortfall_pct` rides the same gate. I want the measurement that no genuine
shortfall goes quiet."* 📐 **Answered on the engine, not on a probe: 336 → 333. Three plans stop, 0 newly fire.**
⚠️ **What that does NOT prove:** that each of the three had no real shortfall — only that the CAP
was not what shaped it. A `peakIntent > peakActual` gap from any other cause is outside this gate
either way, and was before. 🔴 **My first answer to Willy quoted 456, from my own recomputation.**

**⚕️ Sims:** *"No objection. This is reading the runner's answer as given."*

### ⚖️ Ruling: CORRECT

Pinned is measured against **that day's own budget**, via `weekdayBudgetFor` — the owner
`OVERRUN-NOTE-ALL-01` built and `STRUCTURAL-NOTE-DAY-BUDGET-01` already wired into the sibling
producer. §40c gains an amendment saying so, because the principle is older than the input.

⚠️ **`INV-PLAN-VOLUME-SHORTFALL-DECLARED` shares the producer's predicate**, so both move in one
commit and the checker derives its own copy — as the sibling overrun check deliberately does.

🔑 **AND THE MATERIALITY GATE IS A BARE `0.25` IN `ruleEngine.ts`.** §40c's own test, the number
this ruling turns on, is a literal rather than named configuration — a Configuration Singularity
breach inside the principle it enforces. It becomes
`GENERATION_CONFIG.VOLUME_SHORTFALL_PINNED_SHARE` with its principle beside it.

---

## 📦 Artifacts

| Ruling | Principle | Numeric | Check |
|---|---|---|---|
| 1 | §114 Amendment (the carve-out, by reference to CB-PLAN-REVIEW-01) | none new — reuses `atCeiling` | `lopsidedNote` arms + falsification |
| 2 | §40c Amendment 1 (pinned = that day's budget) | `VOLUME_SHORTFALL_PINNED_SHARE` | the producer and `INV-PLAN-VOLUME-SHORTFALL-DECLARED` move together |

## ⇗ SLT escalation

None. Neither changes tier, cost, or what the engine prescribes — both change what the plan SAYS.
