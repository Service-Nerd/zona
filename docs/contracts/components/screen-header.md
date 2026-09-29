# `ScreenHeader` — contract

**Component:** `components/ui/ScreenHeader.tsx`

SCREEN-HEADER-01 (Design Board, 2026-09-26)

The **tab-root** header: title, optional subtitle, **no back arrow**.

⚠️ **This is not the pushed-screen header.** That is a back arrow + title in a row and is a
different family — conflating the two is a **retracted finding** (`design-rulings.md:858`), and
`BackButton.tsx` carries the same warning. It has no owner yet: `BACK-HEADER-OWNER-01`.

## Prop Interface

```typescript
interface ScreenHeaderProps {
  /** The screen's name. `26px / 800 / var(--font-ui) / var(--ink)`. */
  title: string
  /** Secondary line. Omitted entirely when absent — no empty element. */
  sub?: string
  /** Pins the header while the screen scrolls. Default `false`. */
  sticky?: boolean
}
```

## Props

| Prop | Type | Required | Meaning |
|---|---|---|---|
| `title` | `string` | ✅ | The screen's name. Rendered at `26px / 800 / var(--font-ui) / var(--ink)` |
| `sub` | `string` | — | Secondary line. Omitted entirely when absent — no empty element |
| `sticky` | `boolean` | — | **Default `true`** (BACK-ARROW-TITLE-COLLIDE-01, 2026-09-29). Pins the header while the screen scrolls. **Opting out is by name, with a reason** — `screenHeaderPinned.test.ts` holds the register, and the only current opt-out is the marketing phone mockups |

There is deliberately **no `style` prop and no `className`.** Every pixel belongs to
`.screen-header` in `globals.css`; the component's only inline style is `zIndex` from
`Z_LAYERS.screenHeader`, the same split the nav uses. An inline style beats a class, and a rule
that is overridden is decoration (`NAV-PILL-FLUSH-01`).

## When `sticky` is true

> **A header persists when the content below it keeps referring to something the header names.**

| Screen | Pinned | Why |
|---|---|---|
| Coach | ✅ | The sub names the **week** every card below reports on |
| Plan | ✅ | The title names what the week cards below belong to |
| Me · Notifications · Strava | ❌ | Labels. Nothing below cites them |

`screenHeader.markup.test.ts` asserts this **set**, not a count — a count passes if someone
unpins Plan and pins Notifications.

## Behaviour

- **Opaque** (`--bg`). No fill separates from both grounds on this palette; see `NAV-EDGE-01`.
- The **edge** (`--chrome-edge`) appears at `scrollTop > 0` and is absent at the top of the page.
  The border is always present and starts `transparent`, so the height never jumps.
- Keyed to **scrolled**, not *scrolling*: a motion-keyed header goes bare at a scroll-stop mid-page.
- The scroll container is **found by walking up** for the first `overflow-y: auto | scroll`,
  falling back to the window. ⚠️ The screens differ: `MeScreen` scrolls itself, `PlanScreen`
  scrolls the document, and an `IntersectionObserver` would silently observe nothing if its `root`
  guessed wrong.

## Consumers — app AND website

| Surface | Call sites |
|---|---|
| App (`DashboardClient`) | Plan · Coach ×2 · Zones · Notifications · Strava — **all pinned** |
| App (`MeScreen`) | Plan adjustments · Connections · Preferences · Your profile — **all pinned** |
| Website (`TabbedPhone`) | Plan · Coach stills — **`sticky={false}`, declared.** A header pinned inside a fake phone pins to the PAGE, not the mockup, and slides out of the device frame |

🔴 **WHY THE DEFAULT FLIPPED.** It was `false`, and the prop was passed on exactly **two**
surfaces — `Your plan` and `Your coach` — **both tab roots, which have no back arrow and so
cannot collide with one.** Every screen that *could* collide had never pinned. Measured: the
floating arrow is a 44px opaque disc at **x 16–60** and `.screen-header`'s padding puts the
**26px/800** title's text box at **x 16**, so *"Your zones"* rendered as *"ur zones"* on a
device. **A default that only the safe callers override is not a default, it is an accident.**

🔴 **The website used to hand-copy this.** Its comment said *"Same sizes, same tokens"* and was
already false — the app pinned `var(--font-ui)`, the copy pinned neither. `realComponents.test.ts`
exists for that class and could not fire, because its remedy is *"import the real component"* and
the component was private. **Do not re-copy it.**
