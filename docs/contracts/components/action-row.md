# `ActionRow` — contract

**Component:** `components/shared/ActionRow.tsx`

The one pattern for *"tap this to go and do something"*. **6 importers.**

⚠️ **Written 2026-11-10 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface ActionRowProps {
  title: ReactNode
  subtitle?: ReactNode
  onClick: () => void
  divider?: boolean
  ariaLabel?: string
  icon?: ReactNode
}
```

Default export.

## Invariants

1. 🔴 **THE CHEVRON IS NOT OPTIONAL AND NOT A PROP.** It is what makes the row legible as a
   control, and `ACTION-ROW-01` exists because it went missing: the founder, on the Plan screen —
   *"that is an action tile. It's not clear you can click on it."* The cause was structural, not
   an oversight: **the chevron was a local `const` inside the Me screen**, so the Plan screen
   could not reach it and re-implemented the row from memory without it.
   ⚠️ **A PATTERN THAT IS A LOCAL VARIABLE CANNOT TRAVEL.** That is the whole finding.
2. ⚠️ **AND IT HAPPENED A SECOND TIME, ONE LEVEL UP.** The remedy moved the chevron into
   `ActionRow.tsx` — as a local `const` inside `ActionRow.tsx`. The founder caught it again, in
   the same words. It now lives in `Chevron.tsx` (`CHEVRON-OWNER-01`), reachable by `ActionRow`
   **and** by `DashboardClient`'s `row()` helper, which is a different legitimate row shape
   (label + value + state dot). **The affordance is what has to be shared, not the row.**
3. 🔴 **THE CONTAINER STAYS WITH THE CALLER, DELIBERATELY.** Me groups several rows inside one
   card with hairline separators; Plan has a single standalone card. What they share is the ROW.
   `divider` is the only concession: set it when stacking rows inside one card.
4. **`subtitle` is the CONSEQUENCE, never a restatement of the title.** `title` is the verb — what
   the runner is about to do.
5. **`icon` only gives a glyph a place; it does not decide whether one belongs.** That is
   `ICON-RULE-01`. The prop exists so no surface draws its own leading icon
   (`STRENGTH-ENTRY-01`).
6. **44px floor via `TAP_TARGET_MIN_PX`** — a row whose content is short must still be reachable
   with a thumb.
7. ⚠️ **`ariaLabel` is optional and matters most when `title` is not a string.** `title` is
   `ReactNode`, so a composed title can leave the button with no readable name.

## Known residue

⚠️ **The file carried an orphaned docblock** — `/** 16px chevron. \`flexShrink: 0\` so a long title
never squashes the affordance. */` sat immediately above `export default function ActionRow`,
left behind when `CHEVRON-OWNER-01` moved the chevron out, so a comment describing a 16px SVG
read as the documentation for `ActionRow`. **Corrected 2026-11-10 while writing this contract.**
`flexShrink: 0` did survive the move and lives in `Chevron.tsx`; the behaviour was never lost,
only the prose went stale — which is the `BACK-HEADER-OWNER-01` class, in a comment.

## Pattern

`ui-patterns.md` § ActionRow (`ACTION-ROW-01`). Chevron: `Chevron.tsx` (`CHEVRON-OWNER-01`).
