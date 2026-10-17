# Run and strength glyphs on Plan — Design Board (2026-10-17)

**Founder:** *"I love the icons we've added. Do we want to surface the weight icon on the plan view also? If we have a
weight icon, it maybe a good idea to add a running icon to the run sessions also."*

**Settled ground:** STRENGTH-ENTRY-01 (today: not on Plan rows or other session cards), ICON-RULE-01 (meaning or
location), DESIGN-DAYDOT-CHANNEL-01 (never type by colour alone), UX-PLAN-MOVE-01 (the Plan label already lost width
to a chip and the chip was removed).

**Evidence (source, `PlanCalendar.tsx`, `display.ts`):** a strength-only row shows `STRENGTH_KIND_TITLE` ("Full body",
"Upper body", "Lower body", "Mobility") and a `--s-strength` rail; nothing in text says strength. The run-day mark
already says "Strength". Run rows show `session.label`, which names the run. A glyph costs 16px + an 8px gap.
**Not measured:** a device.

- **Zhuo:** two decisions. (a) has a user problem; (b) is a preference ("we have one, so add the other").
- **Silvanto:** (a) is the cheapest fix to a colour-only encoding, in the family we have. (b) is density: *"mark the
  exception, not the rule. When everything has an icon, nothing does."* No veto.
- **Sierra:** the runner is learning which days are lifting days; a shoe on every run row teaches nothing.
- **Wroblewski:** the width is measured. 24px on a short strength title is free; on every run label it is not.
- **Collins:** argued for both as a two-kind system. **Lost (b), recorded.** Won the glyph on the run-day mark too.

**Ruling:** (a) SHIP WITH AMENDMENT (strength rows and the run-day mark). (b) DON'T SHIP, not permanent.
**Artifacts:** pattern in `ui-patterns.md` § Built — RowIcon and Glyph; no new token (the existing `Glyph`); check
`lib/ui/strengthPlanGlyph.test.ts`, falsified both ways (a run glyph added → red; the strength-row dumbbell removed →
red). The marketing Plan still renders no strength, so the website is unchanged.
