# What is Me for — Design Board, 2026-09-28

Collins' section-count question, deferred three times, finally taken. Plus the sitting
that prompted it.

---

## ZONES-INPUTS-01 — the question the founder asked

> *"This is still under me profile, should it be? Is it logical there?"*

**Ruled: the form stays on Me, the numbers go to the zones screen.** The HR card is a
set-once input, `screen-architecture.md` lists it under Me, and it carries the Apple
Health prefill — a **connection** action that belongs where `Connections` lives. Moving it
would relocate taps rather than reduce them, and put a once-ever form on a weekly-read
screen: density, not disclosure.

What was missing was a **provenance line**. The screen claimed *"personalised from your HR
data"* and never showed the data. It now reads `From 51 resting · 185 max`, with a chevron
to the HR card.

### 🔴 The brief that convened it was wrong

I argued the HR inputs were *"the same shape"* as the runner's name — `PROFILE-IDENTITY-01`,
*"a value shown in one place and changed in another."* **They are not.** The name is **one
object**, displayed and edited. HR is an **input deriving a different output**: the zones
screen shows five bands, not `51` and `185`.

The chair corrected it before any seat spoke. **Uncorrected, that analogy would have
produced a unanimous wrong answer** — five seats agreeing on a false premise. It is the
strongest argument yet for the evidence step preceding the board.

---

## ME-PURPOSE-01 — what Me is for

### The measurement

| | |
|---|---|
| MeScreen | **780 lines** |
| Top-level blocks | **8** |
| `onClick` handlers | **11** |
| Raw `<button>` | **6** |
| 🔴 `<ActionRow>` usages | **ZERO** |

⚠️ **`ACTION-ROW-01` was created BECAUSE of Me** — *"we have them under Me profile so we
should have a standard pattern for these"* — **and Me does not use it.** Its only call site
in the codebase is elsewhere. A pattern extracted from a screen that the screen never
adopts is what a drawer looks like from the inside.

⚠️ **This board's charter records the Coach screen's failure as "seven blocks, no
subject". Me has eight.** Undiagnosed because Me is *supposed* to be a list of things.

### The ruling

**Me is the INDEX.** Job: *"Find the thing you want to change, and go there."* **Nothing
lives on Me.** Every row is a **door**, not a room.

Collins: Me accumulated because it is the only screen with no refusal — *"configuration"*
refuses nothing. The rule gives it one: **any control that is not a row does not belong.**

**Sequencing (Sierra, taken over Collins' preference to move everything at once):** the
rule binds **now** so nothing new is added inline; the moves are staged. `meIsAnIndex.test.ts`
holds the current inline surface as a declared, non-growing baseline.

⚠️ **No seat disagreed on the diagnosis, which is itself uncomfortable:** five converged
instantly on a question deferred three times, which suggests the deferrals were about
appetite rather than doubt.

### 🔴 My sitting evidence contained a wrong number

I told the board **5 toggles**. The gate's own measure says **2** — my figure was a *line*
count with a wider regex that caught `Switch` inside unrelated identifiers. The ruling does
not rest on it, but the number reached a board.

It was caught by the stale-baseline arm **on that file's first run** — the arm written to
stop the register rotting upward, catching the register being wrong on the way in.

---

## Open

| | |
|---|---|
| Which blocks become doors, and in what order | roadmap order → **SLT** |
| Is `What Kit knows about you` a door, or the one thing that lives on an index? | next sitting |
| The HR form's own door | not a relocation into the zones screen — `ZONES-INPUTS-01` stands |
| Seen on a device | **never** |
