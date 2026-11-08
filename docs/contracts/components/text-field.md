# `TextField` — contract

**Component:** `components/shared/TextField.tsx`

The single canonical text / number / email / date input for Zonna. **9 importers** — login,
profile, HR, benchmark, the wizard.

⚠️ **Written 2026-11-08 (`CONTRACT-COVERAGE-03`, highest-reach first).** It was the
second-most-imported uncontracted component in the tree.

## Prop interface

```typescript
interface TextFieldProps {
  id?: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email' | 'password' | 'number' | 'date'
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email'
  unit?: string
  min?: number
  max?: number
  readOnly?: boolean
  required?: boolean
  autoComplete?: string
  ariaLabel?: string
}
```

## Invariants

1. 🔴 **`fontSize` IS LOCKED AT 16px AND NO CALLER MAY OVERRIDE IT.** iOS zooms any focused
   input below 16px, and this app ships `maximum-scale=1`, so the viewport then **traps the
   runner zoomed in with no way out**. There is no `style` or `className` prop, deliberately:
   the lock is only a lock while the type cannot be reached from a call site.
2. **Warm Slate tokens only.** `--bg-soft` at rest, `--bg` when `readOnly`, `--line` border,
   `--ink` / `--mute` text. No legacy System-B aliases, no hardcoded values.
3. ⚠️ **`readOnly` changes three things together** — background `--bg-soft` → `--bg`, text
   `--ink` → `--mute`, cursor `text` → `default`. A read-only field that still looked editable
   is the state this exists to prevent; changing one without the others reintroduces it.
4. **`unit` restructures the DOM, not just the padding.** With a unit the input is wrapped in a
   relatively-positioned div and the suffix is an absolutely-positioned 11px `--mute` span with
   `pointerEvents: 'none'`; right padding goes 14px → 38px to clear it. **Without a unit the
   bare `<input>` is returned with no wrapper**, so a caller styling `> div` gets nothing.
5. 🔴 **The `date` appearance reset is SCOPED to `type === 'date'`** (`DATE-FIELD-IOS-01`), via
   `className="zonna-date-field"`. iOS lays out only that type differently; **an unscoped
   appearance reset would strip controls that need theirs.**
6. ⚠️ **`ariaLabel` is the accessibility escape hatch, not the default route.** `id` exists so a
   caller can pair the field with a real `<label htmlFor>` — which is what a screen reader and a
   tap target both want. Use `ariaLabel` only where no visible label exists.
7. **`min` / `max` are passed to the DOM and are NOT validation.** They constrain the native
   stepper; nothing here rejects an out-of-range typed value. The caller owns validation.

## Consumers

9, by `audit-docs.sh`'s import-form count: the login, profile, HR and benchmark surfaces and the
wizard. ⚠️ **Any new input belongs here rather than inline** — the per-screen inline inputs this
replaced are how the 16px rule drifted in the first place.

## Gates

`lib/contracts/componentContracts.test.ts` (this contract vs the component's props) ·
`.githooks/pre-commit` + `npm run sweep:colours` (no hardcoded colour) ·
`lib/ui/typeScale.test.ts` (the 16px declaration is counted, not free).
