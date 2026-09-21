# Contract — Section

**Authority**: This document defines the prop interface and rendering contract for the marketing
page's band primitive. Any change to props must update this document in the same commit.

**Component:** `components/marketing/Section.tsx`

---

## Prop Interface

```typescript
type SectionSurface = 'page' | 'inset' | 'dark'

type Props = {
  surface?: SectionSurface        // default 'page'
  width?: 'page' | 'read' | 'full' // default 'page'
  rhythm?: 'normal' | 'hero' | 'close' | 'none'  // default 'normal'
  hairline?: boolean              // 1px top rule, default false
  id?: string
  style?: CSSProperties           // outer, carries the surface
  innerStyle?: CSSProperties      // inner, carries the measure
  children: ReactNode
}
```

## Rendering contract

- **The background is full-bleed; the content is not.** The outer `<section>` carries the surface
  and spans the viewport; an inner `<div>` carries `max-width` and the 24px gutter. An inset band
  whose colour stops at 1100px reads as a very wide card, which is the opposite of a band.
- `width="full"` opts out of the inner measure for a section that manages its own.
- `rhythm` maps to the W-07 tokens: `normal` → `--sect-y`, `hero` → `--sect-y-hero` (the header sits
  above it), `close` → `--sect-y-close` (the page ends there), `none` → no vertical padding.

## Surface rules — these are constraints, not defaults

| Surface | Token | Rule |
|---|---|---|
| `page` | `--bg` | Every content section. |
| `inset` | `--bg-soft` | ⚠️ **Not a homepage band.** `ui-patterns.md` § Section grounds (W-08): *"The marketing site does not alternate band colours."* `--bg-soft` is an inset area and an input field. |
| `dark` | `--ground` | ⚠️ **Exactly one per page, last.** § Dark Ground / ADR-008: *"A second dark section would make it a dark theme; don't."* |

The v3 design handoff asked for alternating warm bands and two ink bands. Both were declined
(founder, 2026-09-21) and both are enforced by `lib/marketing/sectionSurfaces.test.ts`, which counts
dark grounds on the homepage and fails on any `surface="inset"` there.

## Consumers

`app/page.tsx` — 8 bands. The legal pages use a **different**, file-local `DocSection({title,
children})`; it was renamed from `Section` when this component landed, because four things called
Section with two prop interfaces is the confusion the single-owner doctrine exists to prevent.
