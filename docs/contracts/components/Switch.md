# `<Switch>` — contract

**Component:** `components/ui/Switch.tsx`

Single owner of the boolean on/off control.
Pattern: `ui-patterns.md` § 20a. Ruling: `design-rulings.md` § SWITCH-PRIMITIVE-01.

## Props

```ts
interface SwitchProps {
  checked: boolean
  onChange: () => void
  ariaLabel: string
  disabled?: boolean
  style?: CSSProperties
}
```


| Prop | Type | Required | |
|---|---|---|---|
| `checked` | `boolean` | **yes** | The **effective** on-state, as the caller computes it. Announced via `aria-checked`. |
| `onChange` | `() => void` | **yes** | Fired on tap. Not called while `disabled`. |
| `ariaLabel` | `string` | **yes** | Accessible name. The label the runner reads is the row's, not this. |
| `disabled` | `boolean` | no | The **control's own** blocked state. Not the row's applicability. |
| `style` | `CSSProperties` | no | Layout only. Geometry belongs to `.switch`. |

## The two required props are required on purpose

- **`checked`** — the component announces state. An optional `checked` would let a caller
  render a switch that says nothing, which is what all three call sites did before this
  existed. It immediately caught a live latent bug: `MeScreen.dynamicAdjustmentsEnabled`
  was typed `?: boolean` while the state defaults to `true`, so an `undefined` would have
  announced "off" against a real default of on. That prop is now required too.
- **`ariaLabel`** — `IconButton`'s precedent, same reason.

## What this component must never do

- **Derive `checked`.** `DailyPushToggleRow` passes an effective state that is off whenever
  push itself is off, even if the stored preference is on. A primitive computing
  `checked && !disabled` would look identical and own a product decision it cannot see.
- **Carry a `min-height`.** That is the original defect: `.btn--regular`'s `min-height: 44px`
  beats an inline `height: 26px`, and a 44×26 pill rendered 44×47. The 44px tap target is
  the `::after` overlay's job, never the painted box's.
- **Hold geometry in the component.** Every value is in `.switch` / `.switch--on` /
  `.switch__thumb` in `globals.css`.

## Consumers (3)

`DashboardClient` — `PushNotificationsRow` (APNs permission), `DailyPushToggleRow`
(parent-gated), the auto-adjust row. The count is asserted by
`components/ui/switch.markup.test.ts`; moving it means saying which one and why.
