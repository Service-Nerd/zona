# Contract — Button

**Authority**: This document defines the prop interface and rendering contract for the app's one
button. Any change to props must update this document in the same commit.

**Component:** `components/ui/Button.tsx` · **Styling:** `app/globals.css` § `.btn`
**Pattern:** `ui-patterns.md` § 38 · **Gate:** `components/ui/buttonOwnership.test.ts`

---

## Prop Interface

```typescript
type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'soft' | 'destructive'
type ButtonSize    = 'regular' | 'compact'

type ButtonProps = {
  variant?: ButtonVariant      // default 'primary'. ONE primary per screen
  size?: ButtonSize            // default 'regular' (48px). 'compact' is 44px, the floor
  fullWidth?: boolean          // stretch to container — the stacked-CTA case
  busy?: boolean               // in flight: disables AND sets aria-busy
  busyLabel?: React.ReactNode  // optional verb swap while busy ("Starting")
  disabled?: boolean           // `busy` implies this; both resolve to the same flat state
  className?: string           // merged after the .btn classes, never replacing them
  children?: React.ReactNode
}
```

It also `extends React.ButtonHTMLAttributes<HTMLButtonElement>`, so `onClick`, `type`, `aria-*` and
`style` pass through untouched. **`style` is LAYOUT ONLY** — `margin`, `flex`, `alignSelf`,
`position`. Every visual property (`background`, `color`, `border`, `borderRadius`, `font*`,
`letterSpacing`, `textTransform`, `padding`, `cursor`, `boxShadow`) is owned by `.btn`, and passing
one back is the defect this component exists to end.

---

## Behaviour

| | |
|---|---|
| `busy` | Sets `disabled` **and** `aria-busy`. A busy button must not fire twice; a screen reader is told what the dimmed label tells everyone else |
| `disabled` | Flat, never lifted. An elevated control that does nothing is a lie about affordance |
| `:active` | `translateY(1px)`, riding `--motion-ui`, so it collapses under `prefers-reduced-motion` |
| `:focus-visible` | Always shipped with `:hover`. Hover alone hands the affordance to pointer users and withholds it from keyboard users |

---

## Why this exists

🔴 **There was no Button component.** 66 `<button>` elements carried `var(--moss)`, 27 of them the
primary-CTA shape, each a nine-line inline style object written out again. `--shadow-lifted` had
**zero** consumers while `--shadow-card` had 19: the product elevated its cards and gave its buttons
nothing, so a moss button sat visually behind the card it was on.

🔴 **And 42 text-carrying moss controls failed WCAG AA** — white on `--moss` is 3.68:1, `--moss` as a
label is 3.24:1 on `--bg`. `A11Y-CONTRAST-01` had already measured that and shipped `--moss-strong`
/ `--moss-deep`, then fixed only the marketing button: 28 uses on the site, **0** in `app/dashboard`,
**0** in `lib/email`.

⚠️ **Do not convert selected-state moss.** 15 of the 66 use the moss fill as the **selected**
affordance. That is graphics at 3:1, not text at 4.5:1, and `ui-patterns.md` makes it the only
selected affordance. `buttonOwnership.test.ts` keys on fill-**plus**-label for exactly this reason
and is falsified against a selected-state button.

⚠️ **Email does not import this component** — it is an HTML string builder. `ctaButton()` in
`lib/email/trialEmailTemplates.ts` mirrors the contract with a 1px `--moss-deep` border in place of
elevation, because Outlook drops `box-shadow`. The gate asserts the email fill separately.
