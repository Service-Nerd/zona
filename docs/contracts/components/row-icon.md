# Contract — RowIcon / Glyph

**Component:** `components/shared/RowIcon.tsx` (STRENGTH-ENTRY-01, 2026-10-17). The one icon family.

## Prop Interface

```typescript
type GlyphName = 'dumbbell' | 'plus' | 'history' | 'adjust' | 'settings' | 'link' | 'question' | 'mail'
  | 'calendar' | 'blocked' | 'route' | 'clock' | 'care' | 'bolt' | 'terrain' | 'star' | 'flag'
// Both `Glyph` (bare, GLYPH_PX 16, currentColor, aria-hidden) and `RowIcon` (the Glyph in a
// ROW_ICON_BOX_PX 32 box, --bg-soft ground, --ink-2 glyph) take the same one prop.
interface RowIconProps {
  name: GlyphName
}
```

## Rules (ICON-RULE-01, Silvanto binding)

- **`RowIcon` = LOCATION**, only on lists of 8+ rows: Me and the modify sheet. `Glyph` = MEANING (the dumbbell on a
  strength `SessionCard` and on Today's rest-card strength line).
- One family (line, stroke 1.2, round caps, the nav's), one size, one container. **The container is never semantic**:
  no session or phase hue, no `--moss`.
- Add a glyph in `GLYPHS`, never inline in a screen.
- Decorative: `aria-hidden`. The row's label is its name.

Check: `lib/marketing/iconRule.test.ts`.
