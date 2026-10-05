# Coaching Board — backlog clearance sitting, 2026-10-05

**Convened by:** founder instruction — *"I want everything that is waiting on the board decision to
be taken today and get answers back and document."* **No building today.**
**Seats:** Hutchinson (chair) · Seiler · McMillan · Willy · Sims
**Authority:** ADR-017. Register: `docs/canonical/coaching-rulings.md`.
**Agenda:** the eleven open backlog items carrying a 🏃 **COACHING BOARD** tag.

---

## 🔍 Conflict scan — sections AND amendments

Per the skill's own 🔴 warning (a sitting was vacated in 2026-09 for scanning headings only):

| Touched | How |
|---|---|
| **§3 / §87** deload cadence and placement | the four deload items are all §3's delivered residual |
| **§90 / ADR-022** delivered volume ceiling | its `warn` residual **is** `DELOAD-BADGE-TRUTH-01` |
| **§52** long-run protection | named as *already spent* by both 2-day items |
| **§9** long-run time ceiling and long-vs-easy ratio | the mechanism in `WEEK12-LR-CAP-CLIFF-01` |
| **§34** honesty about what the plan cannot do | the ruling instrument for both 2-day items |
| **§1 + CD-21 Amendment 1** | 🔴 **binding on the 2-day items: at two runs a week the ratio is UNDEFINED, not violated.** No ruling below may require §1 compliance from a 2-day plan |
| **§25 Amendment 2** | already settled `MKT-PLAN-SEGMENT-ENGINE-BASIS-01`'s basis |
| **§94 / §100** | explicitly **not** the cause of `DELIVERED-RAMP-REAL-DRIVER-01` — both already falsified in the item |
| **§119** | the producer change `DELOAD-PLAN-OPENING-01` needs |

**No proposal below contradicts a section or an amendment.** `INV-PLAN-DELOAD-IS-A-REDUCTION`'s
promotion to `error` was already blocked on *"a separate future ruling on healthy deload-week
placement"* — this sitting is that ruling.

---

## 📐 EVERY NUMBER RE-DERIVED TODAY. FOUR ITEMS OVERSTATE THEIR OWN DEFECT.

Per the repo's standing rule — *an item is a snapshot of the code on the day it was written;
when it states a number, derive that number again and say both figures.* Measured on `cohortGrid()`,
**41,472 inputs → 39,632 plans → 96,460 deload-badged weeks**.

> ⚠️ **The grid itself has moved.** `CLAUDE.md` says 31,104; it is **41,472** today. The file is the
> source, as that line already warns.

| Item claims | Re-derived today | Gap |
|---|---|---|
| `DELOAD-BADGE-TRUTH-01`: **9.6%** of recovery weeks ≥ the prior week | **5.6%** (5,396 / 96,460) | **~1.7× overstated** |
| same: **18.9%** of plans carry one | **9.8%** (3,892 / 39,632) | **~1.9× overstated** |
| `DELOAD-LR-GROWS-01`: the long run explains **100%** | plan-wide **45.3%**; **50.2% the long run did not grow AT ALL** | the mechanism is **not** unanimous |
| `WEEK12-LR-CAP-CLIFF-01`: *"the 5K plan steps +44% in week 3"* | **0.3%** of 5K plans step ≥+25%. Median step **0.0%**, p90 **+9.1%**, max **+47.8%** | **it is 32 plans of 10,368, not "the 5K plan"** |

⚠️ **The items are not wrong about the mechanism; they are wrong about the size.** Two of the four
quoted a corpus (*"45,776 plans"*) that is not the one any committed harness runs, so the figures
were never comparable in the first place. **Every error ran in the direction of a bigger defect.**

### 🔴 AND THE REAL FINDING IS IN NO ITEM: THE DEFECT IS RACE-DISTANCE-GATED, 13× ACROSS THE RANGE

| Race | Deload weeks ≥ prior week |
|---|---|
| **5 km** | **3,132 / 20,448 = 15.3%** |
| 10 km | 1,432 / 20,448 = **7.0%** |
| Half marathon | 472 / 25,900 = **1.8%** |
| Marathon | 360 / 29,664 = **1.2%** |

**A 5K plan is thirteen times more likely to badge a non-reducing recovery week than a marathon
plan.** And `WEEK12-LR-CAP-CLIFF-01` is filed *specifically about the 5K plan and the
`longest_recent_run_km` cap*. **They are the same defect**: on a short-race plan the long run sits
close to the easy runs, the 4 km floor plus the §52-protected long run already exceed 70% of the
prior week, and the deload target is **unreachable by construction**.

Splitting at-or-above into its two halves, which no item does:
**strictly bigger 3,604 (3.7%) · exactly equal 1,792 (1.9%).** Overshoot median **0.5 km**, max
**4.27 km**.

### ⚠️ THE 2-DAY POPULATION IS NOT REACHABLE FROM THE GRID, AND THAT LIMITS TWO RULINGS

**`cohortGrid()` has no days field at all** — it never varies days available. My first run reported
*"2-day plans: 0 deload transitions"*, which is impossible and was my bug, caught because zero is
not a rate. Constructing the cohort explicitly (1,200 inputs forced to `['tue','sat']`) gives
**38.0% of transitions inverted, 100% long-run-explained — but overshoot median 0.0, max 0.0 km**:
every one is **exactly equal**, a *flat* week badged recovery, never a bigger one.

🔴 **That does NOT falsify `DELOAD-LR-GROWS-01` and must not be reported as if it did.** My
construction forces two days onto inputs built for more, and the resulting plans **throw
`INV-PLAN-QUALITY-EXPECTED` and `INV-PLAN-QUALITY-NOT-ZERO`** — zero quality sessions. So they are
not the item's *"144 genuine 2-day plans"*; **I could not reach the item's population.** Same class
as `measure:fitness` having to build injury × masters by hand because neither grid contains the cell.

---

## 🏃 Alex Hutchinson (Chair)

*"Four items, one defect, and the thing that decides it is a number none of them printed. A 5K plan
at 15.3% and a marathon plan at 1.2% is not a diffuse residual — it is a floor arithmetic problem
that only bites when the long run is close to the easy runs. `WEEK12-LR-CAP-CLIFF-01` found the
same wall from the other side and filed it as a separate item.*

*And I want the overstatement on the record, because it is the more useful lesson. Each item was
measured honestly on the day it was written, against a corpus we no longer run. **An item that
quotes a corpus nobody runs is unfalsifiable** — it reads as rigour and cannot be checked. The
figures were roughly double, and doubling always in the direction of urgency is how a backlog
acquires a fake P1."*

## 📊 Stephen Seiler

*"My concern is narrower than the room expects. The distribution is not what is broken here — a
deload week that holds flat rather than dropping changes the week's VOLUME, not its intensity
distribution, and §1 counts sessions plan-wide. **A flat deload cannot move §1.** So I have no
objection on my own lens.*

*But I will hold the line on the 2-day items, and the amendment is mine and Sims'. **At two runs a
week the ratio is undefined, not violated** — CD-21 Amendment 1. Nothing in `LR-2DAY-LOPSIDED-01`
may be fixed by adding a third session the runner has not got, and nothing in
`STRIDES-2DAY-SILENT-GAP-01` may be fixed by putting strides on a day that does not exist. Both
items say the remedies are spent. **They are right, and 'spent' is an answer, not a failure.**"*

## 🎯 Greg McMillan

*"Here is what it feels like on a Tuesday. The app says **recovery week**, and the week is the same
size as the one that just half-killed you. That is worse than a plan with no deload at all, because
now the plan is telling you something you can disprove by looking at it. **A label the runner can
falsify costs more credibility than a missing label.***

*Which is why I split the ruling. 3,604 weeks are strictly bigger — that is a defect, fix the
arithmetic. 1,792 are exactly equal — and on a 5K plan at 20 km a week, with a 4 km floor and a
protected long run, **a flat week genuinely is the smallest honest week we can build.** Do not
invent a reduction that the floors forbid. **Change the BADGE.** If we cannot cut the volume, do not
call it recovery; say what it is. That is §34, and §34 is the cheapest fix in this entire sitting."*

## 🩹 Rich Willy

*"Load first. The overshoot is median 0.5 km and max 4.27 km. **That is not an injury vector** —
nobody gets a bone stress injury from half a kilometre on a week badged wrong. I am not going to
pretend this is a tissue question to make it sound more important.*

*The one I do care about is the cap cliff: 18 → 19 → **25 km**, a **+31.6%** single-week step, and
that is in the real sample. **It is 0.3% of 5K plans, and a +31.6% week-on-week step is the thing
that actually hurts people** — it is well past anything §2 or §3 would allow if it appeared
anywhere else in the plan. So the rate is tiny and the severity is real, which is the correct reason
to fix it and the wrong reason to call it a P1. Ramp the cap; do not lift it.*

*And look at the sample again: the long run goes 6 → 7 → **7**. **The long run is flat across the
step.** The jump is the easy runs coming off the 4 km floor all at once. The item attributes the
whole thing to the cap lifting; the cap lifting is the TRIGGER, the floors are the MECHANISM."*

## ⚕️ Stacy Sims

*"Two things, and the first is a question nobody has asked about this defect.*

*A week badged recovery that is not a reduction is **a missed recovery week**, and for a
peri-menopausal runner — a real and large part of the day-job demographic — the recovery week is
doing more work than the build week. If the product silently skips it, the people who lose most are
the ones with the least recovery headroom. **That raises the stakes on McMillan's badge fix and
lowers them on the arithmetic**: I would rather the plan tell the truth about a flat week than
shave 0.5 km off it.*

*Second: I am **not** accepting `DELOAD-LR-GROWS-01`'s 100% attribution as a finding. Plan-wide the
long run explains 45.3% and in **50.2% of cases the long run did not grow at all.** Half of this
defect has an unidentified cause, and the item that claims unanimity is scoped to a population the
harness cannot reach. **Half an explanation presented as a complete one is how a lever gets pulled
on the wrong mechanism.**"*

---

## ⚡ Recorded disagreements

**🩹 Willy vs 🎯 McMillan on severity.** Willy: *"median 0.5 km is not an injury vector; this is a
credibility defect, not a load defect."* McMillan: *"and a credibility defect is the one that makes
them stop using the plan, which is the only load that matters then."*
**Both agree on the fix; they disagree on the priority.** *Willy moves if* any overshoot correlates
with injury history. *McMillan moves if* the badge fix ships, because then the runner is no longer
told something false.

**⚕️ Sims vs the filing of `DELOAD-LR-GROWS-01`** — not vs a seat. She declines its 100% attribution
on the plan-wide measurement. *She moves if* the 2-day population is reached by a harness and the
attribution reproduces there.

---

## ⚖️ RULINGS

### 1. `DELOAD-BADGE-TRUTH-01` + `DELOAD-LR-GROWS-01` + `WEEK12-LR-CAP-CLIFF-01` → **CORRECT WITH AMENDMENT. They merge, and the amendment is that there are TWO fixes, not one.**

**They are one defect seen through three populations.** The 5K-vs-marathon split (15.3% vs 1.2%) and
the cap cliff are the same floor arithmetic.

**(a) Where a reduction is POSSIBLE — fix the arithmetic.** The 3,604 strictly-bigger weeks. A week
badged recovery must not exceed the week before it. Willy's constraint: no step above §2's weekly
increase ceiling may be introduced to achieve it.

**(b) Where a reduction is IMPOSSIBLE — fix the BADGE, not the volume (§34).** The 1,792
exactly-equal weeks. On a short-race plan at low volume, the 4 km floor plus the §52-protected long
run already exceed 70% of the prior week: **the target is unreachable by construction and inventing
a reduction would breach a floor.** ⛔ **Do not shrink the long run to fit** — that is §81's veto,
already cast, and it traded 1,615 violations for 979 the last time it was tried. Say what the week
actually is.

**(c) The cap cliff — RAMP, do not lift.** `WEEK_1_2_LONG_RUN_CAP_MULTIPLIER` releases in one step;
it ramps. ⚠️ **And the item's mechanism is corrected on the record: the long run is FLAT across the
step (6 → 7 → 7). The cap lifting is the trigger; the easy-run floors are the mechanism.**

⛔ **`DELOAD-LR-GROWS-01`'s 100% attribution is NOT ratified.** Plan-wide the long run explains
**45.3%**, and **50.2% of cases the long run did not grow at all.** Sims' objection stands:
**half this defect has an unidentified cause.** The item is re-scoped to *measure the other half*
before any lever is pulled on it.

**📦 Artifacts** (on build, one commit): §3 amendment — *a deload week is a reduction where the
floors permit one, and is honestly labelled where they do not* · the ramp as a named constant in
`GENERATION_CONFIG` · `INV-PLAN-DELOAD-IS-A-REDUCTION` **promoted to `error` for (a)'s population
only**, with (b)'s population carrying a distinct code. **Promotion is the thing this item was
blocked on and it is now unblocked for the strictly-bigger half only.**

### 2. `DELOAD-PLAN-OPENING-01` → **CORRECT, and it is a PREREQUISITE of ruling 1, not a sibling**

A week-2 deload is a visible notch in the second bar of the runner's own plan. **Hutchinson's 2026-09-21
reasoning governs and is re-affirmed: *"nobody is looking yet" is a schedule, not a credibility
answer.*** §119's producer needs a **search** over placements, not the greedy choice. ⚠️ **Sequencing
amendment: this lands BEFORE ruling 1(a)**, because moving where deloads fall changes which
transitions invert, and fixing the arithmetic first would be measured against a placement that is
about to change.

### 3. `LR-2DAY-LOPSIDED-01` → **CORRECT AS IS. The product is behaving correctly and must SAY so (§34).**

77% of the week in one run, `INV-PLAN-LR-MAX-WEEKLY-PCT` at 72.9% of 2-day plans, **all of them
maintenance plans — §52's remedy already applied and spent.**
📊 Seiler + ⚕️ Sims, binding via **CD-21 Amendment 1**: at two runs a week the distribution is
**undefined, not violated**, and no remedy may assume a third session. 🎯 McMillan: *"two runs a
week and one of them is the long run — that is what two runs a week IS. We are not going to
apologise for arithmetic."*
**Ruling: no prescription change. A §34 honesty statement.** The invariant stays `warn` for
maintenance and that is correct, not debt.

### 4. `STRIDES-2DAY-SILENT-GAP-01` → **CORRECT AS IS. §34 honesty gap, structurally unsatisfiable.**

74.2% of 2-day plans have no eligible strides carrier; `sat+sun` fires on **27 of 27**. The item's
own analysis — *"there is no third case"* — is accepted.
🩹 Willy: *"strides are the cheapest neuromuscular stimulus there is and losing them is a real cost,
but the cost of putting them on a day the runner has not got is a session they skip. **Tell them
what they are missing and why**, and tell them it is two days a week doing it, not us."*
**Ruling: no prescription change. One honest sentence.** ⛔ **Do not satisfy the invariant by
relaxing carrier eligibility** — that would put strides on a long run or a rest day.

### 5. `MATCH-LIST-WINDOW-01` → 🔴 **NOT THIS BOARD'S. IT IS A DEFECT FIX RESTORING DOCUMENTED INTENT, AND THE OWNER ALREADY EXISTS.**

**The item asks the board to pick a window — *"±1 day? ±3? distance-aware?"* — and the window is
already ratified, in code, today.** `lib/coaching/sessionMatch.ts → findMatchCandidates` filters to
**±2 days** (`windowMs = 2 * 24 * 60 * 60 * 1000`) and scores **distance-aware** at a 0.75–1.40
ratio (0.85–1.15 on duration), feeding a high/medium/low confidence with
`MIN_AUTO_LINK_CONFIDENCE = 'high'` for the silent server-side path.

**The founder's own capture fails that owner on BOTH axes:** a 20 Sep run offered for a 25 Sep
session is **5 days** (> 2) and **14 km against 8 km = 1.75** (> 1.40). So the picker is not
applying a looser window — **it is applying no window, because `stravaRuns.slice(0, 20)` never calls
the owner.**

🏃 Hutchinson: *"this is the single-owner class, not a coaching question. The coaching judgement was
made, it is ±2 days and distance-aware, and one call site went round it. **A board asked to rule on
something already ruled will invent a second answer**, and then there are two windows."*

**⚖️ Ruling: EXEMPT from this board** per ADR-017's never-convene list (*defect fixes restoring
documented intent*). **Re-tag ⚙️ NO BOARD.** The picker calls `findMatchCandidates` and renders its
candidates in confidence order. ⚠️ **If a manual pick should be allowed to exceed the auto window,
THAT is a board question** — but it is a different, much narrower one, and it is not what the item
asks.

### 6. `DELIVERED-RAMP-REAL-DRIVER-01` → **INSUFFICIENT EVIDENCE. The board cannot rule, and the item already knows it.**

`INV-PLAN-DELIVERED-RAMP` at 27.2% plan-wide / 42.2% of half-marathons is the largest unexplained
warn in the product, and **98.6% of its non-long-run-led firings (276 of 280) have no V1 trim on the
preceding week**, so the cause is genuinely open.
**What would settle it, named:** an attribution pass over the 276, classifying each firing by which
session grew, in the same shape as the deload attribution in this sitting — which found that the
obvious mechanism explained **45.3%, not 100%**. ⚠️ **§100 and §94 Am. 2 are both already falsified
in the item; do not re-derive either.** 🏃 Hutchinson: *"the old message asserted §100 and that is
precisely why nobody looked. **A warn that names its own cause stops anyone checking the cause.**"*

### 7. `MKT-PLAN-SEGMENT-ENGINE-BASIS-01` → **ALREADY RULED (§25 Amendment 2). No new sitting.**

The basis is settled: `race_pace_pct` is a share of the long run's **duration**.
`sessionComposer.ts` was already correct; `ruleEngine.ts:4949`'s `applyRacePaceSegmentDuration`
still reads it as a fraction of **distance**. **That is a defect fix restoring documented intent —
⚙️ NO BOARD** — but it **changes prescription**, so it carries the full regression obligation:
`verify:parity`, `cohort:shape` and `measure:fitness` captured before and diffed, with any move
declared as a number. ⚠️ **It stays deliberately unbundled from the display fix** (SLC), as the
board already decided.

### 8. `LOG-OFFPLAN-03` → **CORRECT, RE-AFFIRMED, AND STILL BLOCKED. Blocked on EVIDENCE, not on a judgement.**

Already ruled CORRECT 2026-09-27. 🩹 Willy, re-stated: *"a runner with a knee history whose real week
is 27% above prescription is getting a 5% cap applied to a number that is not their load. The cap is
not conservative; it is **decorative**."*
**The blocker is unchanged:** n=21, **12 of them the founder**, HR on 15 — and the two
worst-discipline off-plan runs are not his, so the small non-founder sample leans the other way.
🏃 Hutchinson: *"a threshold set on twenty-one runs twelve of which are one person is not a
threshold, it is a preference with a decimal point."*
**Unblock, named:** re-run the split in `lib/coaching/weeklyActualLoad.ts`'s header per cohort once
non-founder runners with linked plans accrue.
⚠️ **A DECLARED REASON IS NOT A SCHEDULED FIX.** This has been blocked **8 days** and nothing in
the repo schedules its re-measurement. Subscribers today: **zero**, so the sample cannot grow yet.

### 9. `EMAIL-WAVE-4-PATTERN-01` → **CANNOT SHIP. Blocked on POPULATION, and the population is one user.**

The Pattern email needs **≥3 analysed runs with heart-rate data**. Measured: `zonna.demo@demo.com`
has 72 analyses with 72 HR; **the one real user with 3 analyses has 0 with HR.**
⚕️ Sims: *"and that is ADR-011's hard consequence arriving in the marketing layer. An iPhone-only
runner with no watch generates no HR stream, **Apple controls what Strava writes**, and we cannot
email someone a pattern we cannot see. This is not a build gap."*
🎪 **Ruling: the bounded pattern set is NOT authored today.** Authoring a pattern vocabulary against
a single demo account would produce patterns fitted to one person's data — the same error as
`LOG-OFFPLAN-03`'s n=21. **Unblock:** ≥3 real non-demo users with ≥3 HR-bearing analyses each.
➡️ The 🧭 Design Board half does not convene either: there is nothing to lay out.

---

## 📦 Required artifacts

| Ruling | Principle | Numeric | Mechanical check |
|---|---|---|---|
| 1 (a)(b)(c) | §3 amendment + §34 for the (b) population | deload floor-feasibility + the cap **ramp**, both in `GENERATION_CONFIG` | `INV-PLAN-DELOAD-IS-A-REDUCTION` → **`error`** for (a) only; distinct code for (b) |
| 2 | §119 amendment (placement is a **search**) | — (producer change) | placement invariant over the chosen week set |
| 3 | §34 statement | — | the statement's presence, per cohort |
| 4 | §34 statement | — | presence where no carrier exists; ⛔ **not** by relaxing eligibility |
| 5 | **none — exempt** | — | the picker calls `findMatchCandidates`; a check that no call site re-filters runs itself |
| 6 | **none — insufficient** | — | the attribution pass IS the deliverable |
| 7 | §25 Am. 2, already written | already written | parity + cohort + fitness diffs, declared |
| 8, 9 | **none — blocked on evidence** | — | — |

## ↗️ SLT escalation

**One.** `EMAIL-WAVE-4-PATTERN-01` and `LOG-OFFPLAN-03` are both blocked on *real users existing*,
and that is a commercial question, not a correctness one. Hutchinson carries it: **both items sit
behind the same gate, and the gate is `OPS-VERCEL-PLAN-01` / `OPS-SUPABASE-PLAN-01` and launch.**
Traynor's stood-down objection applies verbatim: *what is the traffic?*

## ⚠️ What this sitting does not settle

- **Nine rulings, zero lines of code.** Every artifact above is an obligation on a future build.
- **Half of ruling 1's defect has no identified mechanism** — 50.2% of inverting deload weeks have a
  long run that did not grow, and nothing in this sitting says what did.
- **The 2-day population was not reached.** My constructed cohort produces plans that fail
  `INV-PLAN-QUALITY-*`, so rulings 3 and 4 rest on the items' own measurements, not on mine.
  Reaching it needs a grid that varies days — `cohortGrid()` has no days field.
- **`DELIVERED-RAMP-REAL-DRIVER-01` is the largest unexplained warn in the product and this sitting
  did not reduce it by one firing.**
- The 5K/marathon split was measured on the **cohort grid**, not on the 45,776-plan corpus the items
  quote. The two are not comparable and **neither is the live population**, which is 21 plans.
- Nothing here has run on a device, and **no plan in this sitting was looked at by a human end to
  end** — every figure is an aggregate.
