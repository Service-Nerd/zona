# Decision note — P-07: coach register (Straight / Blunt)

**Date:** 2026-09-20 · **Owner:** Russ · **Status:** PROPOSED, awaiting sign-off
**Gate:** §4A — tone of voice, **and** it touches the Zonna/DHTB relationship.
**Unblocks:** `R19`.

---

## What is proposed

A setting in MeScreen → "Your training" that changes the **register** of coaching output.

| Register | Character | Tier |
|---|---|---|
| **Straight** *(default)* | Plain, factual, no framing. What the app does today. | FREE |
| **Blunt** | Says the thing. *"You cooked Tuesday. Again."* | FREE |
| **DHTB** | The founder's register, as an opt-in voice | PAID, later, if ever |

Miles ships *"Coach Personality — how Miles talks about your training — Supportive"* (`IMG_7186`).
The brief is right that it is wasted on them: in a beginner app every option is a flavour of nice.
We have a real house voice and a second register that would actually differ.

## What it changes

`user_settings.coach_register`, one picker screen, and **every coaching string gains a second
version**. The surfaces: daily coach note · post-run reframe · weekly report · phase summary · plan
intro · maintenance debrief · session notes · missed-session prompt · race readiness · zone drift ·
pre-session readiness · post-race debrief. **Twelve AI routes.**

**No engine change, and the guarantee is structural rather than a promise.** `EnrichedWeekSchema`
exposes only `label` and `coach_notes`, so the enricher **cannot touch a numeric** (ADR-006,
`ENRICH-ATTRIB-01`). A register riding on top of that inherits the protection.

⚠️ **That is the argument for building it as a register rather than as alternative prompts.**
Swapping whole prompts would put the guarantee back in play; a register parameter inside the
existing prompt builders does not.

## Why this is the interesting one

**It unblocks `R19`, which has been waiting for exactly this.**

`R19` (coaching tips → Supabase) is filed with a hard condition: *"Don't pick up without a product
trigger… No user segmentation exists, so the migration alone doesn't unlock 'dynamic per user' — it
just adds a DB read + fallback path. Worth building only when there's a real driver."*

**A register is that driver.** It is the first genuine second axis on coaching copy — not a user
segment we invented, but a choice the runner makes. Two registers × the existing copy is precisely
the case where two switch statements stop being the right level of abstraction.

## ⚠️ The brand question, which is the whole decision

The brief's framing is careful and worth quoting: it *"lets Zonna borrow DHTB's personality as an
opt-in tone of voice without putting the founder into the product or merging the two brands."*

That is the line `brand.md` and the launch-scope note already draw: **Zonna is the product, DHTB is
the person; the app must outlive the personal brand.** Founder imagery is deliberately excluded from
the launch screen for the same reason.

**The question for you is whether a register is on the safe side of that line or the start of
crossing it.** Two readings, both defensible:

- **Safe.** A tone setting is a product feature. The runner never learns whose voice it is. If DHTB
  ends, the register stays and simply stops being refreshed.
- **Not safe.** A paid DHTB tier makes the personal brand a **purchasable** part of the product,
  which is a dependency by another name. And the founder is the **only possible author** — nobody
  else can write that register, so the copy backlog has a single point of failure.

I lean safe **for Straight/Blunt** and think **DHTB should stay unbuilt** until there is a reason
beyond "we could".

## Alternatives considered and rejected

- **One voice, better.** The current voice is good and the table in CLAUDE.md is tight. But it
  cannot be both *"Bit keen. Ease it back."* and *"You cooked Tuesday. Again."* for the same runner,
  and different people want different amounts of confrontation from a coach.
- **Infer the register from behaviour.** Give repeat over-cookers the blunt version automatically.
  **Rejected:** it is a silent personality change nobody asked for, and Wood's framing applies —
  it would feel like the app taking a view of you.
- **Make Blunt the default.** Tempting for the brand. **Rejected:** the first-run cohort is
  ~500 charity beginners, and blunt-by-default on someone's first missed session is a dropout.

## What it costs to reverse

**The setting: trivial.** A column, a picker, a default. Remove it and everyone is on Straight.

**The copy: not trivial, and this is the real cost.** Once two registers exist:
- Every new coaching string must be written twice, forever, or the second register rots visibly.
- `docs/canonical/reframe-golden-cases.md` (cases A–D) gains a **register axis** — the regression
  suite doubles.
- Reversing means deleting half the copy, which is cheap, but the *habit* of writing twice is what
  you would be buying, and it is paid on every future coaching item.

**Honest summary: the setting is S, the commitment is L.** The question is not whether to build a
picker; it is whether to accept a permanent doubling of the coaching-copy surface.

## If approved, what must ship with it

1. A register change alters **no numeric on any plan** — asserted by a test, not assumed.
2. The golden-case suite passes on **both** registers before either ships.
3. Each of the twelve AI routes either honours the register or is explicitly listed as out of scope.
   A route that silently ignores it is the decorative-config defect in a new costume.
4. `R19` updated in the same commit to record that its trigger has arrived.

## Recommendation

**Approve the concept; do not schedule the build yet.** The value is real and it unblocks `R19`,
but it is a long tail of copy the founder must write, and there are two P1 items (P-03, P-04) that
show the product thesis for a fraction of the effort. **Ship those, then decide whether the voice
is where the next effort goes.**
