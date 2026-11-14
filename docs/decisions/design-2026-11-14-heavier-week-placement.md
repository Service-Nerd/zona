# Design Board — 2026-11-14. `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01`

Filed by §6ak (2026-10-28), which ruled the ramp warning ahead of `Long run` **as an interim** and
left two things open: the warning's move to week N, and — *"when it ships, decide on a measurement"*
— whether the plan-level tile drops behind `Long run` or goes.

Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

---

## 🔍 Settled-ground scan

| Row | Bearing |
|---|---|
| **§6ak** (2026-10-28) | Ruled the interim rank and **filed the placement**. Silvanto's filed reason: *"a week-level fact at the top of the plan is the horizon mistake"* |
| **`NOTE-SURFACE-INERT-01`** (2026-11-09) | 🔴 **The precedent that decides the open question, and the warning about how to measure it.** Its first sitting ran on **41 stored plans** and its declared costs were **wrong by three orders of magnitude**; re-measured on the engine over 39,744 plans. And the claim that a low rank shows a note on 0 plans was a stored-corpus artefact: **on the engine a low rank showed it on 60% of carriers with ZERO displacement**. ✋ **Silvanto was right and it is recorded** |
| **§6ae** (budget 180 / cap 3) | Holds. Nothing here asks to change it |

---

## 📐 Measured on the engine, through the real producer

`cohortGrid()` at stride 23 (coprime, so every prefix is spread), **1,728 plans generated**,
`planRationaleNotes` called for real rather than re-implemented.

| | ahead of `Long run` (today) | **last among the constraints (shipped)** | dead last (rejected) |
|---|---|---|---|
| carry `load_residual_note` | 322 | 322 | 322 |
| **`load_residual_week` set** | **322 — all of them** | 322 | 322 |
| tile shown | 322 (100%) | **176 (55%)** | 136 (42%) |
| displacing something | **182 (56.5%)** | **40 (12.4%)** | 0 |
| of which `Long run` | **24** | **0** | 0 |

**What it displaces at the shipped rank:** `Your peak` 22 · `Your days` 9 · `Coming back` 5 ·
`Shaped for you` 4. **`Long run` is 0, which is §6ak's accepted cost eliminated**, and total
displacement falls 78%.

🔴 **I CLAIMED "ZERO DISPLACEMENT" AND THAT WAS THE DEAD-LAST COLUMN.** I measured dead last, wrote
the ruling on it, and then moved the rank up one band because an existing arm refused dead last —
without re-measuring. **40 is the shipped number.** Second time today I wrote a figure before
running the thing it describes.

**Displaced labels at today's rank:** Coming back 55 · Your level 47 · **Long run 24** · Your peak
22 · Hard sessions 17 · Your days 9 · Recovery week 8 · Shaped for you 4 · Your target 1.

🔑 **The dominant cost is NOT `Long run`.** §6ak accepted a `Long run` loss and that is 24 of 322
here; the real displacement is `Coming back` and `Your level`. **That is the same inversion
`NOTE-SURFACE-INERT-01` found** — the note the trade was justified on was 8 of 1,684 while the real
cost was `Coming back` on 788. Second occurrence of one pattern: **the tile a board accepts losing
is rarely the tile it actually loses.**

---

## 1. The rank does NOT change yet — 🔴 BLOCKED ON THE PLACEMENT, and §6ak said so

**I ruled this SHIP, built it, and an existing arm stopped it. The arm was right and so was §6ak.**

**🧭 Zhuo (chair), on re-reading the deferral:** §6ak's words are *"**when it ships**, decide on a
measurement whether the plan-level tile drops behind `Long run` or goes."* **When the placement
ships.** The rank change was conditional on the week-N surface existing, and I read the sentence as
a request for the measurement now. The measurement was worth taking; acting on it was not.

🔴 **AND A COACHING CONSTRAINT BINDS, WHICH THIS BOARD CANNOT OVERRULE ON PRESENTATION GROUNDS.**
§6ak's own row records it: *"Coaching Board 2026-10-28 binds: a warned plan tells the runner."*
`lib/plan/loadResidualNote.test.ts` encodes it — *"every warned plan carries the note, and the plan
screen shows it"* — and at the lower rank **104 warned plans stop showing it.** A runner whose ramp
the engine flagged would not be told, anywhere, until the week-N surface exists.

**📱 Wroblewski:** *"So the order is fixed: the surface first, the rank second. Doing it the other
way round takes the warning away from a hundred people to tidy a stack."*
**🎪 Collins:** *"I filed for removal and I withdraw that too. Not on the cost — on the sequence."*

**Ruling: NOT YET.** The interim rank stands until the week-N placement ships. **The measurement is
recorded here so the next sitting starts from a number rather than re-deriving one.**

### What the measurement is worth, kept for that sitting

Once week N carries the warning, the plan-level tile can drop to **last among the constraints** —
behind `Long run`, **ahead** of the promoted `Your peak` / `Your days` / `Shaped for you`.

🔴 **Not dead last:** `NOTE-SURFACE-INERT-01` (2026-11-09) admitted those two at a low rank **on
the explicit basis that they displace nothing**, and dead last lets them displace this.
`planRationale.test.ts`'s *"BOTH RANK LOW"* arm refuses it, correctly.


## 2. The week-N placement — 🟡 RULED, NOT BUILT. And the reason is stated

**The home is not re-opened:** §6ak ruled it (the plan calendar row for week N, and Today when that
week is current), and `meta.load_residual_week` is set on **322 of 322 carriers**, so the placement
is reachable on every plan that would use it.

🔴 **But it is TWO NEW VISIBLE SURFACES, and neither exists.** `PlanCalendar` renders **no
week-level prose at all** — no `week.theme`, nothing — and Today does not render these notes
either; `planRationaleNotes` has exactly one render site, on the Plan screen. So this is not a move,
it is authoring two surfaces.

**📱 Wroblewski, blocking a same-day build:** *"Then it needs its own pass and a device. Two of this
board's open items are surfaces that looked right in a browser and were wrong on a phone, and
nothing has run on a device today."*
**🧭 Zhuo (chair):** *"Agreed, and I would rather record this than bolt it on. The rank change is
measured and bounded and ships now. The placement gets the sitting its encoding deserves — what the
row looks like, where in the header it sits, what Today does when the week is current — with this
measurement already in hand so the next sitting starts from a number."*

**Ruling: RULED, NOT BUILT.** The home stands; the encoding is the next sitting's, with a device.
⚠️ **Recorded so it is not read as agreement to drop it:** the item stays open with its measurement
attached, and the plan-level tile at last rank is the interim — a real one this time, since it
displaces nothing.
