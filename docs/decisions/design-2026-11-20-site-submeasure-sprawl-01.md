# Design Board — `SITE-SUBMEASURE-SPRAWL-01`: should a second, smaller reading measure be a token?

**Date:** 2026-11-20 · **Board:** Design Board
**Trigger:** backlog item; would add a token to `app/globals.css` (hard trigger if built)
**Question as filed:** sub-column widths on the marketing site run 520 / 540 / 560 / 600 / 620 / 640 /
720, hand-typed. Not a defect against any ruling. Should a second, smaller reading measure be a token at all?
**Tier:** n/a (marketing)

## Analysis, before any seat spoke

### The item's list, re-derived from source

`grep` of numeric `maxWidth` in 400–700 on every public marketing surface (`app/page.tsx`, `app/plans`,
`app/privacy|support|terms`, `app/charity-runners`, `components/marketing`; `*-preview` dev pages and
the unreachable `WaitlistForm` excluded):

| value | sites | where |
|---|---|---|
| 520 | 6 | home, /plans, ArticleHub ×3, PlanPage |
| 540 | 1 | home |
| 560 | 1 | ArticleHub |
| 600 | 3 | home, /plans, PlanPage |
| 620 | 14 | home, /plans ×3, ArticleHub ×4, PlanPage ×3, SameWeekTwice ×3 |
| 640 | 6 | /privacy, /support, /terms, ArticlePage ×2, PlanPage |
| 420 | 1 | /charity-runners (not in the item's list) |

**32 sites, 7 values.** The item's **720 is not hand-typed anywhere** today; it appears only as
`var(--measure-read)`. So the item's seven values are six, plus one it missed (420).

### What they do on a rendered page

Production, `https://www.zonna.run`, viewport **1440×900**, in the browser pane. For every element
whose inline `max-width` is 400–700px: its rendered width, its container's content width, whether
the cap is narrower than the container **and** the text is long enough to reach it ("binds"), and
characters per line at the cap and at the container (canvas `measureText` with the element's own
computed font, average character width × width). Pages: `/`, `/plans`, `/plans/10k-12-week`,
`/guides`, `/privacy`.

| | |
|---|---|
| capped elements measured | **46** |
| caps that **bind** | **30** |
| caps that are **inert** (container already that narrow, or text too short) | **16** |
| characters per line at a binding cap | **59–110** |
| characters per line the same element would get at its container | **83–195** |
| the same `620px` cap, by font size | **74** at 18px · **80–91** at 15px · **110** at 12px |
| the `640px` FAQ answers (14px) | **96–99** at the cap, **108–112** at `--measure-read` |

Two things the table shows that the filing did not:

1. **A px cap is font-size-blind.** One value produces a 74-character line at 18px and a 110-character
   line at 12px. The family is not one "smaller measure" typed seven ways; it is seven attempts to
   set a line length with a unit that cannot hold one.
2. **`/privacy`, `/support`, `/terms` use 640 as their PAGE column**, not a sub-column: on `/privacy`
   the capped element's container is **1436px**. That is a third page measure on three pages, the
   shape `SITE-MEASURE-THIRD-01` retired. It is a conformance question against an existing ruling,
   not this one (observed, not filed).

At 375px every cap is inert (the column is narrower than 420), so this is a desktop and tablet
question only.

**Not measured:** 1024px; `/about`, `/pricing`, `/charity-runners`, article pages other than via
`ArticlePage`'s source; any reader comprehension. Production may lag `main`; values in source were
compared and agree for the five pages measured.

### Settled-ground scan

- **6f `SITE-MEASURE-EDGE` — "720px for prose stays"**, *"Do not re-propose collapsing to one
  measure"*. Not touched: this does not move `--measure-read`.
- **6f — `SITE-MEASURE-THIRD-01` RETIRED**: *"It matched no rule and existed because somebody typed
  a number."* Binds the answer's shape: a new token may not be a px number chosen because the
  median of the typed ones is 620.
- **`globals.css` § measures — "TWO measures, not eight."** A third px measure token contradicts the
  comment's own count; a type-coupled line-length is a different kind of value, and this ruling says
  so explicitly rather than by stealth.
- **"One left edge: a narrower measure narrows the box, it does not move it"** — any conversion must
  keep the left edge (these caps are left-aligned inside their column today; preserved).
- `contentMeasure.test.ts` documents that it deliberately does not govern sub-column widths and
  names this item. Pattern layer and token layer read together; no conflict between them.

## The sitting

**🧭 Zhuo (chair).** The filing asked "should there be a second measure token". The measurement
says the question underneath is different: these caps are trying to set a line length, and a pixel
value cannot. Thirty of them do something; sixteen do nothing. What would have to be true for a
token to be right? That one value gives a comparable line at every size it is used at. A px value
fails that test by construction.

**✋ Silvanto.** A measure is a property of the type, not of the box. 74 characters and 110
characters under one name is the 1.02× step problem in a different axis: no reader can see it, the
page just never settles. I would accept one token **if** it is expressed in the type's own unit,
so it follows the font size it sits under. I would not accept a third px measure; that is the 760
again with better manners. Not a veto: nothing is regressed yet.

**🎓 Sierra.** Nothing on the runner side. Silent.

**📱 Wroblewski.** Two notes. Every cap is inert at 375, so nothing here touches a phone, and I
missed desktop before, so I want the build rendered at 1024 and 1440, not reasoned. And the
16 inert caps are not a measure, they are leftovers: delete them, do not convert them, or the
token's consumer count will lie about what it governs.

**🎪 Collins.** This is the taxonomy I keep asking for: seven numbers, one job, and a third of them
do nothing. Collapse it to one and make it mean something. I do not want the build to pick a
number because a book says 66; it picks the one that the binding paragraphs at body size land on
when rendered, and says the before and after.

### ⚡ Recorded disagreement
Collins wanted the value fixed by this sitting; the chair declined to author a number on no render
at the size it will be used (the standard the Coaching Board chair set in `SESSION-ACHIEVABLE-01`: no
*"number because I happen to have one"*).
**The value is the build's measurement**, stated before and after, under the constraint below.

### ⛔ Veto check
None exercised. Silvanto stated the condition under which he would: a third **px** measure token.

## ⚖️ Ruling — SHIP WITH AMENDMENT

1. **Yes, one second measure becomes a token, and it is a line length, not a box width:** expressed
   in `ch` (the type's own unit), so it follows the font size of the element it caps. Name for the
   build to choose; `--measure-copy` is a placeholder, not a ruling. **A px token is refused.**
2. **The 30 binding caps convert to it; the 16 inert caps are deleted, not converted.** Left edges
   unchanged (a narrower measure narrows the box, it does not move it).
3. **The value is set by measurement in the build**, at **1440 and 1024**, and stated as characters
   per line for the binding body-size paragraphs (15–16px) before and after. It must narrow the
   spread the sitting measured (59–110 at the cap); the board does not author the number.
4. **Out of scope and not converted here:** the 640 page column on `/privacy`, `/support`, `/terms`
   (a page measure, governed by the two-measure rule, observed below), and `/charity-runners`' 420
   centred CTA paragraph unless the build's render shows it binding as body copy.

### 📦 Required artifacts (the build carries them)
1. **Pattern** — `ui-patterns.md` (website measures): the second measure is a type-coupled line
   length in `ch`; px sub-column caps are not used.
2. **Token** — one `ch`-valued measure token in `app/globals.css` beside `--measure-page` /
   `--measure-read`, with its measured reason.
3. **Mechanical check** — extend `lib/marketing/contentMeasure.test.ts` (whose header already names
   this item) to fail on a numeric `maxWidth` in the sub-measure range on a marketing surface,
   population derived not listed, **falsified** by re-adding one 620.
4. **Register row** — below.

### ↗️ Routing
None.

### 🚨 MUST/NEVER
Token in `globals.css`, never a literal in a component. No palette or type change.

### ⚠️ What this does not settle
- No value is ruled. Nothing was rendered at 1024, and only five pages at 1440.
- Characters per line here are arithmetic from canvas glyph widths (average width × box width),
  not counted rendered lines; the build's before/after must count real lines.
- Whether the three legal pages' 640 page column is a defect against the two-measure rule is not
  ruled here.
