# SLT — the three frozen artifact items, re-opened on data (2026-10-05)

`LEDGER-PLACEMENT-01` · `OPS-ARTIFACT-PLACEMENT-01` · `LEDGER-RESET-01`

All three were frozen together on 2026-10-02 with one condition:
**"Re-opening needs DATA, not an argument."** This sitting exists only because that condition
was tested. It arrived for one artifact and is **unsatisfiable** for the other.

## ⚠️ The seat that is not at this table

**Traynor's commercial seat is stood down.** The 2026-10-02 note flagged it on these exact items:
`LEDGER-RESET-01` is a retention / commitment-device question, precisely his lens, and Fried is
nearest but kills surface area rather than pricing it. Stated up front so the strongest available
answer is not silence.

---

## Settled-ground scan — half the agenda was not this board's

Three of the six items whose heading names the SLT are **not** SLT questions, and taking them to a
sitting would have re-litigated settled ground:

| item | why not |
|---|---|
| `FOUNDATION-DECIDE-LATER-01` | **Already ruled** — *"SLT chose 'delete the button', so it is now minutes, not a build."* A decided item awaiting a build |
| `FIRSTRUN-MOMENTS-01` | Owns the moment and already has four shipped sub-items. Build work |
| `DELOAD-PLAN-OPENING-01` | 🏃 Coaching Board rules FIRST on correctness; it has not. Not ready for the SLT |

---

## The measurement, which is the whole sitting

| | at freeze (2026-09-28) | now (2026-10-05) |
|---|---|---|
| `ledger_view` | 2 users | **164 events · 10 of 41 accounts · one full week (09-28 → 10-05)** |
| `share_week_pressed` | 0 | **0 — and the eligible population is 2 of 41** |

🔴 **THE SHARE CARD'S FREEZE CONDITION CANNOT BE SATISFIED.** `ShareWeekButton`
(`DashboardClient.tsx:5358`) renders only on `reportIsCurrent && weeklyReport?.zone_discipline_score
!= null`. Measured: **18 weekly reports across 3 users, 13 carrying a score across 2 users**, and
the newest scored report is **2026-09-23 — twelve days old**, so the button has not been renderable
recently at all. **Zero presses is 0 of 2.** Waiting for "the reach events to accumulate" from a
denominator of two is waiting forever.

🔴 **A FINDING I REPORTED TO THIS BOARD AND THEN HAD TO WITHDRAW — RECORDED BECAUSE THE ERROR IS THE
LESSON.** I told the sitting that `LEDGER-01` is tagged **FREE** while *"its only render site is
behind a paid gate"*, and built ruling 1 on it. **That was false.** There are **two** render sites:

| site | gate |
|---|---|
| `DashboardClient.tsx:5631` — `<LedgerCard surface="coach" />` | inside `screen === 'coach' && (hasPaidAccess ? … : <upgrade>)` |
| **`components/dashboard/MeScreen.tsx:1167` — `<LedgerCard surface="me" />`** | **UNGATED** |

**The tier defect was already fixed** (`LEDGER-REACH-01`) **and is held by a test**:
`components/shared/ledgerReach.test.ts` asserts the Me render site is reachable by a free user, and
its own comment records that the first version of that test was **hollow** — wrapping the site in
`{hasPaidAccess && …}`, the exact original defect, left it green. `MeScreen.tsx:1160` states the fix
and that *"THE COACH CARD STAYS"*, because removing it would reverse a reasoned placement decision
under cover of a defect fix.

⚠️ **WHY I GOT IT WRONG, AND IT IS A RULE I ALREADY HAD WRITTEN DOWN.** I grepped
`app/dashboard/MeScreen.tsx`. **That file does not exist** — `MeScreen` lives in
`components/dashboard/`. An empty result from a wrong path read as proof of absence. *A negative grep
is not proof of absence; confirm the path before concluding something is missing* — recorded twice in
this repo before today.

### What the surface split actually says — the evidence the item asked for

`ledger_view` carries a `surface` prop, which is precisely what `OPS-ARTIFACT-PLACEMENT-01` was
parked on:

| surface | views | users |
|---|---|---|
| **`me`** | **123** | **9** |
| `coach` | 33 | 8 |
| (no prop — pre-instrumentation) | 8 | 1 |

**Me carries 79% of views and 9 of the 10 users.** The Coach card is not dead — 8 users, 33 views —
but Me is where the artifact is actually read, by roughly 3.7 views to one.

---

## Rulings

### 1. `LEDGER-PLACEMENT-01` — UNFROZEN on data, and it is **NOT this board's and NOT a tier defect**.

The data condition is met: 164 views, 10 of 41 accounts, one week, with no promotion.

🔴 **BUT BOTH OF THE ITEM'S OWN "LIVE QUESTIONS" WERE ALREADY RULED — on 2026-09-29, by the Design
Board, six days before this sitting.** The item says it left two things open:

| the item's open question | the ruling that answered it |
|---|---|
| the founder's *"something beside Pro"* — next to the identity card | **(d) 🔴 DON'T SHIP the identity-region placement.** *"Beside Pro is not physically available: a 44px number and a 10px badge cannot share a moment"* (Silvanto); *"one is a card, the other a label"* (Wroblewski). **It stays leading `Your training`.** |
| `ME-PURPOSE-01` says *"nothing lives on Me, every row is a door"* and the ledger is a read-only CARD | **(e) `ME-PURPOSE-01` AMENDED, not excepted:** *"Me may carry a read-only card that reports the runner's own state; it may not carry a control that is not a door."* |

**So there is no open SLT question and no open placement question.** The item stayed open because
nobody connected it to a ruling made the same week. **Third time in two days that an item's premise
had already been settled elsewhere.**

**What remains is narrow and is the Design Board's:** given `me` 123 views / 9 users against `coach`
33 / 8, **should the Coach duplicate stay?** `MeScreen.tsx` already argues it should, citing
`353cbbad`'s stated reason. That is a placement question, routed, not ruled here.

### 2. `OPS-ARTIFACT-PLACEMENT-01` — the freeze STANDS for the share card, but the CONDITION is replaced.

*"Until the reach events accumulate"* is unsatisfiable. The replacement condition is
**reachability, not usage**: until a meaningful number of users can SEE the button, press-rate is
evidence of nothing. The constraint is the render gate and the 12-day-old newest scored report, not
demand. **No build decision today.**

### 3. `LEDGER-RESET-01` — stays PARKED.

Both filed positions were withdrawn on measurement in October and nothing in today's data revives
either. Recall trigger unchanged: revenue, a measurable trial-to-paid rate, a redeemed-code funnel,
or meaningful installs — Traynor's own.

---

## Recorded disagreement

**Fried vs the framing of both items.** Both were filed as *placement* questions. Fried: the
ledger's is now a **tier** question and the share card's is a **reachability** question. **Nobody
defended the original framing**, which is itself the finding — two items spent three days frozen
under the wrong question.

**No conflict on the ledger itself**, and that is worth recording: Wood and Sutherland normally land
on opposite sides of anything resembling a counter. Wood explicitly declined her kill mandate here —
*"a counter that reflects what you actually did last week is feedback on the behaviour, not an
illusion of progress"* — and her objection was the inverse of usual: it is invisible at the moment it
would do work.

## MUST/NEVER

Breaks **"gate richness, never access"** as it stands; the fix restores it. No gamification (a
counter that can go down is feedback, not a streak). No modal, no hardcoded colour, no parallel
classifier, no schema change.

## Risks to existing features

`/api/discipline-ledger` has **always served every tier** — that was the original `LEDGER-01`
finding — so making the card reachable adds calls from a population already receiving a value it
could not render. No schema change. ⚠️ Free-user reach is **unmeasured**, not zero, for the reason
above.

## What this does NOT decide

- **Where** the ledger goes. 🧭 Design Board, same day.
- Whether the share card is worth making reachable. That needs the reachability question answered
  first, and it is not a build decision today.
- Anything about the reset rule.
