# `SettingsWriteError`

**Component:** `components/shared/SettingsWriteError.tsx`

The sentence a runner sees when a setting **they made** did not reach their account.

🧭 `USER-SETTINGS-TELL-THE-RUNNER-01` — Design Board 2026-11-14, SHIP WITH AMENDMENT.
Sitting: `docs/decisions/design-2026-11-14-four-filed-items.md`.
Pattern: `ui-patterns.md` § *A failed SAVE says so under the control, and keeps the value*.

## Props

```ts
interface SettingsWriteErrorProps {
  /** The sentence to show, or null for nothing at all. */
  message: string | null
}
```

**`null` renders the empty string — no element and no reserved space.** An empty population must
not render, so a row that has not failed is byte-identical to one that never could.

## Contract

- **It owns no words.** `settingsWriteFailureMessage(what)` in `lib/supabase/userSettingsWrite.ts`
  is the single owner of the copy, so the voice is decided once. Pass its output in; a literal in
  this component is a second voice and a gate fails on it.
- ⛔ **`--danger-strong`, never `--danger`.** `DANGER-TEXT-CONTRAST-01` (Design Board 2026-10-02)
  measured the base token at **4.36:1 on `--bg-soft`** — a fail against AA on the one ground it
  sits on — and that ruling's own note names an error message as *"the worst place in the product
  to carry no margin"*. `lib/ui/hueText.ts` maps the pair.
- **12px, `--font-ui`, `role="status"`, `marginTop: var(--space-2)`.**
- **No retry control.** The retry is using the control again (Sierra). A `<button>` here fails a gate.

## Where it is rendered, and the rule for adding another

Beneath the control that failed, with the value left exactly where the runner put it.

| Surface | Control |
|---|---|
| `HRZonesSection` | under **Save HR data** |
| `PreferencesScreen` | under each of the two `SegmentedControl`s (distance units, session display) |

⚠️ **A control that unmounts before the write resolves cannot use this**, and that is the
constraint that caused the item rather than a detail of it: `HrCalibrationSheet` used to call
`close()` synchronously beside `onSave`, so the sheet was gone before the verdict arrived. It
awaits now and holds itself open when the verdict is `false`.

⚠️ **The producer must return its verdict and the whole chain must carry it.** Handlers are typed
`void | Promise<boolean>`; a `=> void` anywhere in the middle compiles and silently erases the
failure — the same class as the signature behind `EFFORT-GOVERNED-HR-DISPLAY-01`.

⚠️ **`=== false` only.** A `void`-returning handler resolves `undefined`. Truthiness would show an
error on a write that **succeeded**, which is louder and more wrong than the silence this closed.

🔻 **Where no control survives, the severity stays `log` and the reason is written at the call
site.** The wizard's birth-year write is fire-and-forget by `SAVE-LATENCY-01`; a `tell_the_runner`
with no `onError` degrades silently to `log`, which is the hazard `userSettingsWrite` documents.

## Check

`components/shared/settingsWriteError.markup.test.ts` — 7 cases, falsified three ways (truthiness
instead of `=== false`; the sheet closing before the verdict; the component writing its own words).
