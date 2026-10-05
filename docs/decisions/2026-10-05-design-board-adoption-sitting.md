# Design Board — the adoption sitting, 2026-10-05 (second sitting of the day)

**Convened by:** founder instruction to build the seven actionable design items. **Three of the
seven are not builds — they are decisions**, and two of them are the same decision asked twice.
**Seats:** Zhuo (chair) · Silvanto · Sierra · Wroblewski · Collins
**Items:** `SESSIONPOPUP-PRIMITIVE-ADOPT-01` (3 arms) · `MKT-KITBYLINE-COPY-01`
**Record:** `design-rulings.md`. Both items were filed **today**, by the gates built today.

---

## 🔍 Settled-ground scan

| Row | Bearing |
|---|---|
| **44px minimum tap target** 🟢 STANDING | Already satisfied on all four controls — this sitting is **not** about the floor |
| **The 36 selected-state toggles must NOT be swept into `Button`** | Binding. The moss active fill is the only selected affordance there is |
| **`.btn--inline-target` is for a small VISUAL carrying a 44px HIT AREA** | Ruled not applicable to a control that fills its row |
| **`DANGER-TEXT-CONTRAST-01`** — two controls excluded by name *"because both carry a semantic colour a conversion would delete"* | **Direct precedent for arm (a)**, and it cuts against conversion |
| **Pattern 16 / AIMark provenance** | Bears on `MKT-KITBYLINE-COPY-01`: a marketing still is not model output |
| **`COACHBYLINE-EMPTY-VARIANT-01`** (shipped this morning) | Established that a missing state causes a hand-roll. The question here is the inverse |

**Nothing is being re-proposed.** Both items are new.

---

## Item 1 — `SESSIONPOPUP-PRIMITIVE-ADOPT-01`

**The question, asked three ways: what is a primitive allowed to cost the surface that adopts it?**

### 📐 Measured today, not asserted
All four `SessionPopupInner` controls were below the 44px floor and **all four now clear it**, each
with its reason for not converting written at the call site. Every `<Button>` in that file measures
**exactly 44**; every hand-rolled `<button>` measured under. That is the ownership effect, and it is
also why conversion looked obvious.

### 🎪 Collins
*"I filed the taxonomy objection and I will answer it against myself. Three controls, three
different primitives, and the honest reading is that only ONE of them is actually the same job as
its primitive. The metric toggle IS a segmented control — two mutually exclusive modes in a
contained track, and `SegmentedControl`'s own doc names 'distance/duration' as its use case. That
is not a near-duplicate, that is the thing. The other two are chips the way a hammer is a mallet."*

### ✋ Silvanto
*"Arm (a) is the one I will not have. Four tags, four colours, and the colours ARE the content:
Fresh, Fine, Heavy, Wrecked is a scale, and a scale rendered in one colour is a list. `Chip` is
moss-only by design — it is a SELECTION chip, and selection is binary. Giving it a colour axis to
serve one screen makes the canonical chip carry a meaning it does not have everywhere else, and
the wizard and the benchmark screen inherit the risk for nothing.*

*⛔ **I am not exercising the veto** — nobody has proposed a palette regression, and I want that on
the record so the next reader does not think adoption was blocked by one. It is blocked because it
would be wrong."*

### 🎓 Sierra
*"Arm (b) is the one where I would ask what the runner gets. Skip reasons at 12px on `--bg` in a
two-column grid, against `Chip` at 14px on `--card`: the runner gets a bigger, whiter control for
choosing why they missed a run. **That is the product drawing more attention to the moment someone
failed**, which is the opposite of what this screen is for. Leave it quiet."*

### 📱 Wroblewski
*"Arm (c), and I will take the full-width band. The metric toggle is 18px today — it was the
smallest control in the product — and the reason it is small is that it was built to be
unobtrusive. On a phone, one-handed, an unobtrusive control is a control you miss. `SegmentedControl`
fills its row and the visual becomes the hit area, which is exactly the argument the board already
accepted for not using `.btn--inline-target` here.*

*⚠️ One condition: the toggle has a THIRD behaviour — tapping the active segment when the value is
custom resets to global. `SegmentedControl` fires `onChange` on the active segment, so it is
preservable, but it must be preserved. There is already a 'Reset to global' control below it, so if
the tap-to-reset is dropped the runner loses nothing — **but that is a decision, not an accident.**"*

### 🧭 Zhuo (chair)
*"Then the ruling splits and it should. One adoption, two refusals, and the refusals are better
reasoned than the adoption.*

*What I want recorded is why this item existed at all: a ruling said 'convert the control and the
height is correct for free', the build measured it, and **the measurement disagreed on three of
four.** The build floored them anyway and filed this. **That is the process working** — the
alternative was a build that quietly did the wrong thing because a board had said so."*

### ⚖️ RULING — **SPLIT. (c) SHIP · (a) DON'T SHIP · (b) DON'T SHIP**

| Arm | Ruling |
|---|---|
| **(c) metric toggle → `SegmentedControl`** | 🟢 **SHIP.** It is the same job as the primitive, named in the primitive's own doc. The full-width band is **accepted, not tolerated** — Wroblewski: an unobtrusive control is one you miss. ⚠️ **Condition: the tap-active-to-reset behaviour is a decision.** Preserve it, or drop it deliberately on the grounds that "Reset to global" already exists — and say which |
| **(a) fatigue tags → `Chip`** | 🔴 **DON'T SHIP, and `Chip` does NOT gain a colour axis.** Fresh / Fine / Heavy / Wrecked is a **scale**, and the colour is the content. Silvanto: *"a scale rendered in one colour is a list."* A colour axis on the canonical chip would make two other screens inherit a meaning they do not have. **The tags stay hand-rolled, floored, with their reason at the call site** |
| **(b) skip reasons → `Chip`** | 🔴 **DON'T SHIP.** Sierra: adoption means a bigger, whiter control for choosing **why you missed a run** — the product drawing attention to the moment someone failed. **Leave it quiet** |

**Artifacts:** (c) is a build. (a) and (b) get **register rows in `design-rulings.md` § 2**, because
a DON'T SHIP that is not in the register is one the next sitting re-proposes.

---

## Item 2 — `MKT-KITBYLINE-COPY-01`

### 📐 Measured
`components/marketing/PhoneFrame.tsx` declares **`KitByline`**, whose own doc comment says *"copy of
CoachByline"*, **and a local `Sparkle`** which is a copy of `AIMark`. **The file does not import
`AIMark` at all**, and `<Sparkle />` has exactly **one** call site — so the second copy exists
solely to serve the first. ⚠️ **`components/marketing/TabbedPhone.tsx` renders the real
`<CoachByline color="moss" role="This week" />`.** Both are reached from `app/page.tsx` and
`/charity-runners`.

### 🎪 Collins
*"Two components, same page, same picture, one tracks the app and one does not. That is not a
decision anyone made, it is a decision nobody made twice."*

### ✋ Silvanto
*"And I will give the argument FOR the copy, because it exists and it is not stupid: a marketing
still is a photograph. You do not want a component edit to change a shipped page's picture without
anyone looking. **But that argument requires the copy to be deliberate and labelled**, and this one
is labelled 'copy of CoachByline', which is a confession, not a design decision."*

### 🧭 Zhuo
*"Decisive for me is `TabbedPhone`. If the pinned-photograph argument were the house position, that
file would be wrong — and nobody thinks it is. **One of the two is already the answer.**"*

### 🎓 Sierra
*"No objection, and one warning: the real component carries the AIMark, and a marketing still that
shows the AI glyph is claiming the app generated that text. It did — Kit writes the weekly line —
so this is fine. **But it means adopting the component makes the still a provenance claim**, and
that claim has to stay true if the surface changes."*

### 📱 Wroblewski
*"Adopt it. And delete `Sparkle` in the same change — leaving a second glyph with no caller is how
the next person reintroduces the copy."*

### ⚖️ RULING — 🟢 **SHIP. `KitByline` and `Sparkle` are deleted; the still uses `<CoachByline>`.**

The pinned-photograph argument is **recorded and rejected on one ground**: `TabbedPhone.tsx`
already renders the real component on the same pages, so the house position is settled in code.
⚠️ **`Sparkle` goes in the same change** — a second glyph with no caller is how the copy returns.
⚠️ **Sierra's warning is the condition:** the still now carries a provenance claim, and it is
currently TRUE. If the marketing surface ever shows text no model wrote, the AIMark must go with it.

---

## ⚡ Recorded disagreements

**None unresolved.** ✋ Silvanto argued the case FOR the marketing copy before rejecting it, and
asked for that on the record so the argument is not re-made as if new. 🎪 Collins answered his own
taxonomy objection **against himself** on two of three arms.

## ⛔ Veto check

**None exercised, and Silvanto asked for that to be explicit:** arm (a) is refused on
**correctness of meaning**, not on a palette regression. *"The next reader should not think
adoption was blocked by a veto. It is blocked because it would be wrong."*

## 🔴 POST-SITTING CORRECTION — THE ACCEPTED COST WAS NOT INCURRED (measured in the browser, same day)

The board accepted a **full-width band** as the price of arm (c), and 📱 Wroblewski argued for it on
the merits. **Rendered and measured on `/copy-preview` at 375px, there is no band.**

| | |
|---|---|
| Control | **124 × 50px**, inside a **150px** card — not the screen |
| Segments | **57 × 44px** each, clearing the floor exactly |
| Alignment | the same 124px as the *"Distance"* label and the *"11 km"* value above it |
| The card pair | `DISTANCE` and `EST. PACE` are **both 150 × 120px, top 323, bottom 442** — the taller control did **not** unbalance them |

⚠️ **Both the board and the build reasoned from an unmeasured assumption about the CONTAINER.**
`SegmentedControl`'s segments are `flex: 1`, which was read as *"it will fill the screen"*. It fills
its **parent**, and the parent here is a 150px metric card. The refusal note written into the code
this morning — *"this compact `fit-content` pill would become a FULL-WIDTH band on the session
card"* — was **wrong**, and it was wrong in the direction of not doing the right thing.

🥇 **`flex: 1` is a statement about a parent, not about a screen.** The cost was argued, accepted,
and then did not exist — which is the third time today a conclusion survived only until someone
measured it.

**This does not change the ruling.** (c) ships, and it ships cleaner than the board was told.

## ⚠️ What this sitting does not settle

- **Nothing ran on a device.** The full-width band in arm (c) is accepted on reasoning, not seen.
- **Arm (c)'s third behaviour** (tap-active-to-reset) is a condition on the build, not a decision
  this sitting made.
- `Chip` refusing a colour axis **leaves the fatigue tags hand-rolled forever** unless a different
  primitive is proposed. That is accepted, not deferred.

---

# Addendum — `UI-PATTERNS-MOMENTS-01`, the condition is discharged

**The condition (2026-10-02):** 🎪 Collins names **three** moments and **what each should do
differently**. ⚠️ He accepted the deferral and asked it be recorded that **deferring it twice
becomes an answer** — so this is the last sitting at which it can be deferred.

## 📐 The evidence, measured — and it reframes the gap

The item named the three moments already: **the plan arriving · the first run logged · the coach's
verdict.** What nobody had measured is what each does **today**.

| Moment | What gives it weight today | Measured |
|---|---|---|
| **The plan arriving** | **TIME.** The ceremony holds the screen on purpose | `GeneratingCeremony.tsx:225` — `minDelay = hasPaidAccess ? 3600 : 1800` ms, a **deliberate minimum** before the reveal |
| **The first run logged** | **VOICE.** The only surface carrying *both* locked brand lines | `SessionCompleteCard` renders `BRAND.voiceAnchor` **and** `BRAND.brandStatement`, plus a 44px numeral |
| **The coach's verdict** | **PROVENANCE.** Authorship made visible | `CoachNoteBlock` — `CoachByline` + a **3px `--warn` left rail**, `aiGenerated` only |

⚠️ **Size is NOT the differentiator, and that was the obvious wrong answer.** The ordinary
`LedgerCard` also renders at **44px**. A moment is not a big number.

## 🎪 Collins
*"Then I was wrong about the gap and the real one is worse. I said the document had no vocabulary
for weight. It has **three** — time, voice, provenance — and every one of them was invented
privately by whoever built that screen. Nobody chose them, nobody compared them, and nothing stops
the fourth moment inventing a fourth. **That is not an ornament problem, it is a taxonomy problem**,
which is the thing I am actually here for."*

## 🧭 Zhuo (chair)
*"And it now has a number attached, which is what it was missing. `minDelay = 1800/3600` is a
design decision somebody made in a component file — it is the product spending **up to 3.6 seconds
of a runner's time** to make something land, and that is as real a design choice as a type scale.*

*⚠️ What I will not have is this becoming a licence. The ruling is to **NAME WHAT EXISTS**, not to
author a feel. W-11 and the ornament row are standing kills."*

## ✋ Silvanto
*"Supported, narrowly. My seat asks whether a moment carrying weight has been given any, and I have
been asking it with nowhere to point. Three named mechanisms is somewhere to point. **It must say
which moments get NOTHING, too** — restraint is the default and the document should make the
default visible."*

## 🎓 Sierra
*"One condition: this must describe mechanisms, not prescribe feelings. *'The runner should feel
understood'* is unfalsifiable. *'This surface spends 3.6 seconds'* can be argued with."*

## ⚖️ RULING — 🟢 **SHIP, scoped to NAMING WHAT EXISTS**

A short `ui-patterns.md` section: **the three weight mechanisms the product already uses, each with
its measurement and its one call site**, and an explicit statement that **everything else gets
none**. ⛔ **No new moments, no new ornament, no prescribed feelings** — W-11 and the ornament row
stand.

**Artifacts:** the section (pattern) · no token or constant — *the mechanisms already exist and
inventing one would be the ornament this ruling forbids*, which is recorded rather than skipped ·
and the measurement held by `uiPatternsEnforcement.test.ts`'s register, since the new section names
its own evidence.
