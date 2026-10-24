# Design Board — SHEET-ORIGIN-01, S1 Amendment 1 (2026-10-24)

**Trigger:** `components/shared/Sheet.tsx` (shared component), the nav pill, `app/globals.css`: hard.
**Change:** a sheet comes out of the nav pill and retracts into it; while it is open the pill stays visible above the
scrim as the sheet's foot and visibly stops being tabs.
**Tier:** n-a (presentation, every tier).

## Settled-ground scan

| Row | Effect |
|---|---|
| **S1 § 6i** (2026-09-22): the sheet covers the nav, because a dimmed visible nav was *"visible, dimmed, and lying"* | **Amended, not reversed.** The principle survives: no nav that offers four destinations and delivers one. The implementation changes: the panel's bottom edge stops being the viewport's |
| **SHEET-PRESENT-01**: *"come up from the nav bar but not overlay it"* (reversed by S1) | Not reinstated. The pill is not a nav while a sheet is open, so nothing is "overlaid" or "lying" |
| **SHEET-ORIGIN-01** rounds 1–6 and the revert (`aa0dbb9d`) | Carried forward as constraints: origin is the **pill** (the founder's words in every message); **slide, not scaleY** (round 4: a scale collapses to a line); the curve must **travel**, `cubic-bezier(0.65, 0, 0.35, 1.55)`; motion is **imperative** only; the preview imports the **real** `Sheet` |
| **Founder decision 2026-10-02**: option (b), the pill visibly stops being tabs | Implemented |
| `maxHeightVh` 88, Silvanto binding | Kept |
| NAV-FADE-01 / `.nav-bar--receded` (scroll fade, CSS-owned look) | The pattern reused: the foot's look lives in `globals.css` as a modifier, one place, so reduced motion and contrast are handled once |
| SHEET-CLOSE-OWNER-01 (Sheet owns the close) | Unchanged |
| Wroblewski in S1: a live, un-scrimmed nav contradicts `role="dialog"` + `aria-modal` | Answered: the foot is `inert` and `aria-hidden`, so the dialog stays modal |

## Evidence (375 × 812, `/sheet-preview`, the real `Sheet`, browser DOM)

Pill 343 × 62 at x 16, top **738**, z 3000. Open sheet today: full width, bottom **812**, z 4000, scrim over the pill.
Website: `Sheet` is imported only by app surfaces (dashboard, training); no marketing page renders it.
**Not measured:** how it feels in the hand. Nothing has run on a device.

## The board

**🧭 Zhuo (chair).** This is a preference with a decision behind it, which is the right order: the founder asked six
times and decided the one structural question himself. The success condition is stated before the build: the panel
is hidden behind the pill when closed, rests with its foot behind the pill when open, the pill shows no live tabs and
cannot be tapped, and the founder, looking at it, says it comes out of the pill.

**✋ Silvanto.** The material question is the seam. Two borders meeting would draw a line through what is meant to be
one object, so the panel's foot is squared, unbordered and tucked behind the pill, and the pill keeps its own edge.
The tabs fade to nothing, not to grey: grey is the "switched off" object the revert screenshot showed. No palette or
type change. No veto.

**🎓 Sierra.** It does not make the runner better and it does not need to. My condition from round 1 stands: the
wobble must not become the app's personality. One overshoot, settled within the duration.

**📱 Wroblewski.** Three conditions. It must not delay input: the panel is interactive from the first frame. The pill
must be inert, not merely faded, or a thumb on "Plan" does something invisible. And the sheets with a text field
(heart rate, add distance, manual run) must still clear the keyboard: on device the keyboard covers the bottom of the
screen either way, so resting 74pt higher costs nothing there, but it is unverified on a device.

**🎪 Collins.** The founder has been right about this for a month and the board kept giving him the more defensible
animation instead of the one he asked for. This is the version that reads as one object. Ship it to the preview and
let him judge it, not us.

## Ruling

**SHIP WITH AMENDMENT, behind a presentation switch.** The pill-origin presentation is built into the real `Sheet`
but **off in the app** (`SHEET_FROM_PILL = false`) and on in `/sheet-preview`, so the founder sees the real component
before any runner does. When he approves, the default flips in one line. Fallback: with no measured nav (onboarding,
first frame) the sheet keeps S1's full-width bottom presentation.

## Found building it

The ruling first specified lifting the nav above the scrim. Built and measured in the browser, it painted **under**
the scrim anyway: the preview's (and very possibly the app's) nav sits inside a `position: fixed` ancestor, which
creates a stacking context, so the nav's z-index only competed inside it. The result was the reverted build's dimmed
grey pill. The amendment holds; the mechanism changed: the `Sheet` draws an empty pill in its own layer at the real
nav's measured box, and the real nav stays at its layer, `inert` and hidden underneath. React 18.3 also drops the
`inert` prop, so it is set on the element. Neither was knowable from the ruling; both were found by measuring.

## Artifacts

1. **Pattern** — `ui-patterns.md` § Slide-up Sheet: S1 Amendment 1, the pill as the sheet's foot.
2. **Token / constant** — `.nav-bar--sheet-foot` in `globals.css`; `PILL_OVERLAP_PX`, `SHEET_FROM_PILL`,
   `SHEET_PILL_CURVE`, `SHEET_PILL_MS` named in the component.
3. **Check** — a test that the foot modifier makes the tabs invisible and the nav inert and aria-hidden while a sheet
   is open, that the open panel's geometry derives from the pill, and that the app default is off until approved.
   The motion itself is not mechanically checkable in `node`; it is verified by DOM geometry in the browser.
4. **Register row** — `design-rulings.md`.

## Routing

None. No coaching claim, no tier change.

## What this ruling does not settle

How it feels on a phone, and whether the founder approves it. The app keeps S1 until he does.
