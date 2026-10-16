# `<EmptyState>` — contract

**Component:** `components/shared/EmptyState.tsx`

ui-patterns.md § 8 Empty State, written once. Ruling: `design-rulings.md` § EMPTY-STATE-OWNER-01 (2026-10-16).

## Props

```ts
interface EmptyStateProps {
  title: ReactNode
  body?: ReactNode
  action?: ReactNode
  fill?: boolean
}
```

| Prop | Required | |
|---|---|---|
| `title` | **yes** | One short sentence. Inter 600 1rem `--ink`. |
| `body` | no | One line. Inter 400 0.875rem `--mute`. Omitted renders nothing. |
| `action` | no | **At most one**, an existing `Button` (full-width). § 8: no button unless there is a specific action. |
| `fill` | no | Whole-screen state: `100dvh`, `--bg`, the 16px gutter. Without it, it centres in its parent (min 200px). |

**Centred on both axes**, text included (the board's ruling). Callers (2026-10-16): Me → Plan history, `PlanLoadFailed`.

**Check:** `components/shared/emptyState.markup.test.ts`.
