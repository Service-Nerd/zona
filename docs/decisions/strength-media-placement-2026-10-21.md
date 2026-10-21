# Design Board — where exercise demo media sits (STRENGTH-MEDIA-01, 2026-10-21)

**Asked:** founder, after seeing two placements on a mock (`A` a still on every row, animation one tap deep; `B` the
row unchanged, animation only when the row is opened): *"take B to the design board"*.
**Order note:** the item's tags put the supplier decision (founder) and price (SLT) first. This sitting rules on
placement only and is **conditional**: nothing is built until a supplier is chosen.

## Settled ground
- `STRENGTH-APP-01` (2026-10-16): session screen in SessionScreen anatomy, **cues one tap deep**, **no media
  placeholder until Phase 3**. B keeps the first and does not contradict the second: it adds no placeholder.
- `ui-patterns.md` § strength session: the exercise row's type is frozen (name, dose, support line).
- Motion: every motion token collapses under `prefers-reduced-motion` (register, standing).
- `CLAUDE.md` design system: all colour from tokens; ember orange `#D4501A` banned; no red in the training UI.

## Evidence (mock at 375px, RepDB free web preview, measured in the browser)
- Four of our 99 exercises are in the free preview; the paid set covers ~60% (supplier note, 2026-10-18).
- Open row in B: **374px** tall with the animation at 280 × 260 and two cues, **before** the lift-log panel a main lift
  also opens. A 667px phone shows little else.
- Weight per open: looping animations **696 KB–1.67 MB** each (web preview, 512px); stills **42–58 KB** (1024px,
  83% transparent). Paid full-resolution files will be larger.
- The muscle highlight is a saturated orange, sampled **≈ #EE5500–#FF6600**: not a token, and in the ember-orange
  family the design system bans.
- Not measured: the paid files, their formats (a video loop may be far lighter than animated WebP), a device.

## Seats
- **Zhuo (chair).** B is a decision, not a preference: it keeps the closed list exactly as it is, so a session reads
  the same whether 60% or 100% of its exercises have media. A makes coverage visible on every screen. Success
  condition: a covered exercise shows how to do it in one tap, and the closed rows are identical with or without
  media.
- **Silvanto.** Agrees with B: the list is today's job, the demo is depth. **Vetoes the orange highlight as supplied**,
  naming the rule: `CLAUDE.md` § Design System, all colour from tokens, ember orange banned, no red in training UI.
  An image is not exempt because it is a raster. Recolour it to `--s-strength` (the supplier note says the FAQ allows
  colour adjustment; the licence must say so) or use a version without the highlight.
- **Wroblewski.** 374px is too much for a row that also opens the log panel. Cap the media so a main lift's log panel
  is still on screen with the row open at 375 × 667. Load only when opened, never prefetch a session's media; on a gym's
  mobile signal 1.2 MB a tap is the cost of the feature. Ask the supplier for a video loop format before buying.
- **Sierra.** The demo makes the runner capable: they learn the movement, not the app. Once learnt it gets out of the
  way, which B does by default. No opinion on size beyond Wroblewski's.
- **Collins.** Prefers B, and says why: thumbnails on every row are what every fitness app looks like. The animation is
  the one moment worth having; give it the full row width. Loses on height to Wroblewski (recorded).

## Recorded disagreement
Collins: full width, uncapped. Wroblewski: capped so the log panel stays reachable. The chair takes Wroblewski's cap
at full width; Collins lost on height.

## Veto check
**Silvanto: VETO sustained** on the supplied orange highlight (rule named above). Not a veto of B.

## Ruling: SHIP WITH AMENDMENT (conditional on the supplier)
1. **B.** Media appears only inside an opened exercise row, above the cues; the closed row is unchanged.
2. **No placeholder.** An exercise with no media opens exactly as today: cues only.
3. **Size.** Full content width, height capped so a main lift's log panel stays on screen when its row is open at
   375 × 667; a named constant, not a literal. On the `--bg-soft` inset at the card radius.
4. **Motion.** Loops while open; under `prefers-reduced-motion` the still pose instead. Alt text: *"{exercise}
   demonstration"*.
5. **Load.** Fetched when a row is opened, never prefetched.
6. **Colour.** The highlight is recoloured to `--s-strength` or removed. A supplier whose licence forbids recolouring
   does not meet this ruling.

## Artifacts (with the build)
1. Pattern: `ui-patterns.md` § strength session, media in the opened row.
2. Constant: the media height cap.
3. Check: `strengthScreens.markup.test.ts`: a closed row renders the same with and without media; an exercise without
   media renders no media element; the media element sits after the support line and before the cues.

## Does not settle
The supplier, the spend, the format, how the ~40 uncovered exercises are filled, and how it feels on a phone.
