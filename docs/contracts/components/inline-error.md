# `<InlineError>` — contract

**Component:** `components/shared/InlineError.tsx`

The one-line error message under an action, on every surface. Pattern: `ui-patterns.md` § *Inline error*.
Ruling: `design-rulings.md` § INLINE-ERROR-OWNER-01 (2026-10-16).

## Props

```ts
interface InlineErrorProps {
  children: ReactNode
  align?: 'left' | 'center'
  style?: Pick<CSSProperties, 'margin' | 'marginTop' | 'marginBottom' | 'padding'>
}
```

| Prop | Required | |
|---|---|---|
| `children` | **yes** | The message. One sentence that says what to do (*"Try again."*), never a code. |
| `align` | no | `left` (default). `center` only under a full-width, centred action (the wizard save bar). |
| `style` | no | **Spacing only.** The type is typed to margins and padding so a caller cannot restyle the colour or size. |

## Guarantees

- `role="alert"`, so the message is announced when it appears.
- Inter 14px / 400 / line-height 1.5, `--danger-strong`: AA on `--bg`, `--bg-soft`, `--warn-bg` and `--card`
  (5.27–6.38:1). Plain `--danger` fails on two of those four.
- Renders exactly what it is given. A caller that has no error renders nothing (`{error && <InlineError…>}`).

## Callers (2026-10-16)

`PendingAdjustmentBanner`, `TodayScreen` (`TdReadyHero`), `DashboardClient` (Adjust sheet),
`GeneratePlanScreen` (save bar, centred), `RedeemCodeScreen`, `BenchmarkUpdateScreen`.

**Check:** `components/shared/inlineError.markup.test.ts` renders it, and fails if any tracked `.tsx` outside
the named owners writes its own `role="alert"`.
