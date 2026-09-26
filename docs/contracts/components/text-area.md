# Contract — TextArea

**Authority**: defines the prop interface and rendering contract for the app's one multi-line
field. Any change to props must update this document in the same commit.

**Component:** `components/shared/TextArea.tsx`

---

## Prop Interface

```typescript
interface TextAreaProps {
  value: string
  onChange: (v: string) => void
  /** REQUIRED. A field nobody can name is "edit text, blank" to VoiceOver. */
  ariaLabel: string
  placeholder?: string
  rows?: number       // default 3
  maxLength?: number
  id?: string
}
```

There is deliberately **no `style` and no `className`.** Every pixel belongs to the component, and
the divergence this file exists to end came from call sites styling their own.

## Why it exists

🔴 **It was hand-rolled four times across three files and the four disagreed on 9 of 13 styled
properties** — two grounds, three radii, four paddings, two border weights, two `resize` values,
`--text-primary` on half.

🔴 **One disagreement was a live iOS defect.** `TextField.tsx` opens with *"fontSize is locked at
16px — iOS zooms any focused input below 16px and the `maximum-scale=1` viewport then traps the
user zoomed in."* **The manual run log's Notes field was 13px**, on the one screen that is the
entire logging path for a runner with no Strava.

⚠️ **And it survived a ruling aimed at it.** `STEPPER-CONTROL-01 (c)` moved the Average HR field
**eleven lines above it** onto `TextField` for precisely this reason.

## It mirrors `TextField`, deliberately

| | value |
|---|---|
| ground | `--bg-soft` |
| edge | `1px solid var(--line)` |
| radius | `var(--radius-md)` |
| font | `var(--font-ui)` **16px — non-negotiable** |
| padding | `13px 14px` |
| resize | `vertical` |

`formPrimitives.test.ts` asserts both halves carry the same ground, edge and radius, **and that
neither drops below 16px**. A single-line and a multi-line field that look different is the defect.

## Consumers

| Surface | Sites |
|---|---|
| App | manual run log (Notes) · `ReflectionInput` · `RaceResultSheet` ×2 |
| Website | none |

📐 **Normalising moved all four boxes** — heights `+15 / +2 / +6 / +8 px`, radii to 14px. The +15 is
the font fix and is the point; the rest is one padding replacing four. **Reported, not claimed as
zero.**
