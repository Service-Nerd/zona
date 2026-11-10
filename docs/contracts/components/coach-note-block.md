# `CoachNoteBlock` — contract

**Component:** `components/shared/CoachNoteBlock.tsx`

The coach-voice card, in amber-warm. **5 importers.**

⚠️ **Written 2026-11-10 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
type Props = {
  label?: string                      // default 'COACH'
  timestamp?: string
  children: React.ReactNode
  variant?: 'default' | 'why'         // default 'default'
  aiGenerated?: boolean               // default false
  onChipClick?: () => void
}
```

Default export.

## Invariants

1. 🔴 **`aiGenerated` IS PROVENANCE HONESTY, NOT A STYLE SWITCH** (AI-VIS-01). True renders a
   `CoachByline` (avatar + name + role) **and** a 3px `--warn` left-rail. **Rule-engine notes get
   neither.** Setting it on hand-authored or rule-engine copy is a doctrine violation: the glyph
   means a model wrote this. See `ui-patterns.md` § AIMark.
2. ⚠️ **`label` IS SILENTLY IGNORED WHEN `aiGenerated` IS TRUE** — the byline replaces the eyebrow
   entirely. A caller passing both gets the byline and no sign the label was dropped. Pass `label`
   only on rule-engine notes.
3. ⚠️ **`onChipClick` ONLY DOES ANYTHING WHEN `aiGenerated` IS TRUE**, because it makes the
   *byline* tappable and there is no byline otherwise. Pass `() => setScreen('coach')` from the
   parent; it is the route to the Coach tab, not a generic card click.
4. 🔴 **THE LEFT-RAIL INSET IS COUPLED TO `aiGenerated` AND MUST STAY SO.** Left padding becomes
   `horizontalPadding + 8` when the rail is present, so the rail never sits under the text. A
   caller cannot reproduce the rail with its own border without losing that.
5. **`variant: 'why'` is the Session Detail treatment** — 16/14 padding and 13px body against
   18/16 and 14px. The body is *slightly smaller because the label is the visual anchor* there. It
   is not a density knob.
6. **`children` is the coaching copy and the brand voice applies: one sentence.** Specific beats
   abstract, never motivational (`CLAUDE.md` § Voice rules). ⚠️ **An em dash in a sentence the
   runner reads is forbidden** — `noEmDashApp.test.ts` guards both string literals and JSX text
   under `components/`, so copy passed in as JSX is in scope.
7. **Every colour is a token** — `--warn-bg`, `--warn`, `--warn-strong`, `--coach-ink`. 🔴 **No red
   in training UI**: this card is amber by rule, and `--danger` is for form and error states only.
8. **The rail is `aria-hidden`.** It is decoration; the byline carries the meaning.
9. **`timestamp` is a formatted string the caller supplies**, rendered as `· {timestamp}`. It is
   never derived here — `lib/format.ts` owns every time string (ADR-015).

## Pattern

`ui-patterns.md` § CoachNoteBlock · `docs/alignment/phase-2-decisions.md` D-001 · AI provenance:
AI-VIS-01.
