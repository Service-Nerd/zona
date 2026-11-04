# Design Board — `STRENGTH-GUIDED-DEVICE-01`

**Date:** 2026-11-04 · **Chair:** Zhuo · **Seats:** Silvanto, Sierra, Wroblewski, Collins
**Trigger:** the shipped guided-session surface — hard (it reverses a ruling seven days old)
**Outcome:** SHIP WITH AMENDMENT ×3 · INSUFFICIENT EVIDENCE ×1 · one finding routed to the Coaching Board

---

## Why this sitting is different

**It is the first time any of this has run on a phone.** Every previous strength ruling was made on a
`npm run dev` review. Production carries **1 strength plan, 3 completions, 4 lift logs and 0 guided
sessions ever started** — so the founder's two screenshots are the entire device evidence that exists.

## Settled ground

| Row | Bearing |
|---|---|
| `STRENGTH-SESSION-PARTS-01` + `STRENGTH-GUIDED-SESSION-01` (2026-10-28) | *"one part per page"* — kept. **Rest-as-a-page amended** |
| `STRENGTH-SESSION-TOP-01` (2026-10-29) | note at the bottom, above the actions — **preserved**; the sticky bar sits below it |
| `STRENGTH-MEDIA-01` (2026-10-21, not built) | media lives inside an opened row, so a row must be able to open — bears on the contents sheet |
| CLAUDE.md § UI Principles | no popups; a modal only for a destructive confirmation → the contents view is a **sheet** |

## Evidence, read from the owner rather than the screenshot

- **Rest was a step by construction** — `guidedSteps()` emitted `{kind:'rest'}` as a sibling of `{kind:'work'}`.
- **There was no jump.** `GuidedAction` was `next | back | extendRest | skipRest | setWeight | toggleTimer | end`,
  and `back` from the first page **exits**, so reaching part 6 meant five taps through parts 1–5.
- **Nine parts** on the session shown, so the primary action sat below nine cards plus the note.
- **Not measured:** tap counts on a device, thumb reach, what the countdown does when the phone locks.

## The board

**🧭 Zhuo (chair).** Findings 1–3 are defects against intent. **Finding 4 is a reversal and has to be argued
as one** — *"one part per page"* was ruled with a reason seven days ago, and *"I'd expect 4 per screen"* is a
preference until we say what it is for. It is for knowing what is coming so you can take the machine that is free,
and that is finding 3's problem, which 3 solves without 4.

**✋ Silvanto.** The rest screen is the clearest error. **Rest is not a step; it is the state between two steps.**
Giving it a page makes the runner leave the thing they are doing to watch a number and come back. No palette or type
rule is regressed — **no veto**.

**🎓 Sierra.** Finding 3 is not a UI problem. **A gym is a contended-resource environment and we modelled it as a
queue.** A runner who cannot take the bench in our order must either quit the session or lie to it, and that teaches
them the app is wrong about gyms.

**📱 Wroblewski.** Five taps to reach part 6, no way back without losing the page. The rest screen spends a whole
viewport on two controls and 90 seconds of nothing. On the tick: it is a **destructive-adjacent action with no
confirmation, 44px from the back arrow** — and *"Mark complete without starting"* is a sentence, not a button label.

**🎪 Collins.** **Nine parts is the real finding and nobody raised it.** PART 8 · CORE holding one carry and
PART 9 · CORE holding another is a taxonomy the engine does not make, printed as structure. Collapse the parts and
findings 1 and 4 shrink on their own: the button is not buried under nine cards, it is buried under a **bad count**
of them.

## Recorded disagreements

**Collins vs the room, on sequencing.** He wanted the part count fixed first and 4 deferred, arguing a 4-up grid on a
wrongly-split session is decoration over a structural fault. Silvanto wanted 2 and 3 shipped now, as live defects on a
surface in use. **Settled by the chair: both, in that order, as separate items.** Collins' point is recorded as a
finding the founder did not raise, and routed — whether two carries are one part is the **Coaching Board's**.

**Wroblewski vs the founder, on the tick.** The founder asked for a header tick. *What would move Wroblewski:* the
tick marks complete **with an undo**, or it scrolls to the actions rather than performing one. **The sticky bar was
taken instead and the founder approved it at mockup.**

## Ruling

1. **Actions buried — SHIP WITH AMENDMENT.** A sticky action bar, not a header tick. `Mark complete without starting`
   → **`Log it as done`**.
2. **Rest owns a screen — SHIP.** Rest renders within the part's page. An owner change, not CSS.
3. **No way to move or see ahead — SHIP.** A contents sheet with jump-to-part.
4. **2–4 exercises per screen — INSUFFICIENT EVIDENCE.** *What settles it:* the part count first. The parked pairing
   fix takes mean parts **5.99 → 4.93** and removes 8–9 part sessions entirely, so the grid may be solving a problem
   that no longer exists.

## Artifacts

| | |
|---|---|
| **Pattern** | `ui-patterns.md` § Guided strength session — the device rules (three patterns) |
| **Constant** | `STRENGTH_GUIDED_COPY.contentsLabel / contentsHint / contentsClose / contentsAt`; `markWithoutStarting` restated |
| **Check** | `strengthGuided.markup.test.ts` +4 arms, `guidedSession.test.ts` 14 → 19 arms. **7 mutations, all red** |
| **Register** | `design-rulings.md`, same commit |

## Routed out

- **🏃 `STRENGTH-CARRY-PATTERN-01`** — the Coaching Board ruled Collins' merge CORRECT, and it is **filed, not
  built**: there is no `carry` pattern (`suitcase_carry` is `anti_rotation`, `farmer_carry` is `lateral_core`), so the
  merge could only be written as a label match — D-17 / `INV-CLASS`.
- **🏃 `STRENGTH-PAIR-STRIDE-01`** — parked at INSUFFICIENT EVIDENCE after Willy's binding condition fired.

## What this ruling does not settle

Nothing here has been felt in the hand, **including the sticky bar, proposed on a device nobody has tested it on**.
The rest countdown's behaviour when the phone locks or backgrounds is unknown and untested, and it is the single most
likely thing to be wrong in a gym. A 390px markup render is not a thumb.
