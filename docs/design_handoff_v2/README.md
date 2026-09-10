# Handoff: Zonna v2 — modernisation pass

## Overview

Four changes to make the Zonna marketing site and iOS app read more current and more premium, without redesigning anything. Colour palette, type family, voice and all page copy are unchanged. Three of the four are token-level, so they land across every surface at once.

The brief was explicitly *not* an overhaul: Zonna has no live users yet, so this is the cheap moment to modernise, but the restraint-led brand (warm slate, one accent, no icons, no hype) is deliberate and stays intact.

Reference points the user supplied and liked: [runna.com](https://www.runna.com) (near-black `#161616` ground, phone screenshots in hero), [planzy.ai](https://www.planzy.ai) (tiny uppercase eyebrow → large statement → generous air), [preview.moorhub.co.uk](https://preview.moorhub.co.uk) (Material Symbols iconography, stat band, eyebrow/title/supporting-line rhythm). What was deliberately **not** taken: Runna's cheerleading and review-wall density, Planzy's smiling-runner photo grids, any carousel, any gradient. Those fight Zonna's brand rather than modernising it.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, **not production code to copy**. The task is to recreate these changes in the real codebase (`Service-Nerd/zona`, Next.js 14 + Tailwind + Capacitor) using its established patterns.

Most of this handoff is CSS custom properties, which map almost one-to-one onto the real codebase. See "Where each change lands" below.

## Fidelity

**High-fidelity.** Exact hex values, type specs, spacing and measurements are given below and should be matched precisely. Where a value is unchanged from the current product it is marked "unchanged" — do not touch it.

Two caveats on the prototypes themselves:

1. The app prototype (`ui_kits/app/index-v2.html`) fakes the shadow with a CSS selector matching serialised inline styles (`#phone div[style*="background: var(--card)"]`). That is a **preview device so the shadow could be judged without forking six screen files** — it is not the implementation. See Change 4.
2. The section-spacing change (28px → 36px) is documented but **not built** in the prototypes, for the same reason: the screens set gaps inline. See "Recommended, not built".

---

## Change 1 — One dark band (site only)

**What.** The marketing site is warm off-white end to end, which reads honest but flat. Introduce exactly **one** near-black section per page, carrying the brand statement. It replaces the light closing section that currently holds "You can't outrun your easy days."

**Why one.** A second dark section makes it a dark theme, which Zonna is not (ADR-008: single light theme, no dark mode). The band is a punctuation mark, not a theme.

**New tokens**

```css
--ground:          #1A1A1A;                    /* warm near-black; must sit beside #F3F0EB */
--ground-soft:     #242220;
--ground-line:     rgba(243,240,235,0.14);
--on-ground:       #F3F0EB;
--on-ground-2:     rgba(243,240,235,0.72);
--on-ground-mute:  rgba(243,240,235,0.50);
--moss-on-ground:  #8FB08F;                    /* moss lifted for dark grounds */
```

**Why `--moss-on-ground` exists.** The brand moss `#6B8E6B` goes muddy below about 20% background luminance. `#8FB08F` is the same hue lifted to hold its identity and clear 3:1 against `#1A1A1A`. Use it for *any* moss on a dark ground; never `#6B8E6B`.

**Section layout** — text only, centred. No device frame, no image: the statement is the moment and anything beside it competes.

| Element | Spec |
|---|---|
| Section | `background: var(--ground)`, `color: var(--on-ground)`, padding `112px 24px` |
| Inner | `max-width: 760px`, `margin: 0 auto`, `text-align: center` |
| Eyebrow | "The receipt" — 12px / 700 / uppercase / `0.08em` / `var(--moss-on-ground)`, 12px bottom margin |
| Statement | "You can't outrun your easy days." — italic 500, `clamp(32px, 5vw, 48px)`, line-height 1.15, `-0.015em`, `var(--on-ground)`, 28px bottom margin |
| Body | 17px / 400 / 1.6, `var(--on-ground-2)`, `max-width: 520px`, centred, 36px bottom margin |
| CTA | 15px / 600, `color: var(--ground)`, `background: var(--on-ground)`, padding `13px 22px`, `border-radius: var(--radius-md)`, trailing `→` at 0.55 opacity |
| Sign-off | 48px top margin, column, 10px gap, centred: `Wordmark size="sm" variant="light"` then tagline 13px / 400 / `var(--on-ground-2)` |

Body copy (new, in brand voice — one sentence per idea, no hype):

> Every week, Kit tells you one true thing about how you actually ran — then shows the numbers behind it. Same effort, lower heart rate. That is the whole game.

**Wordmark on dark.** Use the existing `light` variant (white base, `rgba(255,255,255,0.55)` on the "nn"). Size `sm` (20px), not `xs` — at 14px with a half-opacity tagline it read as an afterthought against that much dark space. This was corrected after user feedback.

---

## Change 2 — Real app screens in a device frame (site only)

**What.** The current hero shows three hand-built CSS approximations of the session card. Replace with the **actual Today screen** rendered inside a device shell, directly below the hero copy.

**Why.** All three reference sites lead with phone screenshots. The CSS mocks are on-palette but obviously not the product, and they drift as the app changes. Rendering the real screen means the marketing shot can never disagree with the app.

**Frame spec**

| Property | Value |
|---|---|
| Frame outer | 340 × 764 (`320 + 20` padding each axis), `background: var(--ground)`, `border-radius: 46px`, padding 10px |
| Frame shadow | `0 1px 2px rgba(26,26,26,.06), 0 24px 60px -20px rgba(26,26,26,.28)` |
| Screen | 320 × **744**, `border-radius: 36px`, `overflow: hidden`, `background: #F3F0EB`, `color: #1A1A1A`, column flex |
| Screen composition | **30px status bar + 654px content + 60px nav** |
| Notch | 86 × 22, `border-radius: 12px`, `var(--ground)`, `top: 20px`, centred on the frame |
| Content scale | 420px-wide source at **0.762** (`320 / 420`), `transform-origin: top left` |
| Bottom fade | 32px, `linear-gradient(to bottom, rgba(243,240,235,0) 0%, #F3F0EB 100%)`, pinned to the content area's bottom |
| Nav | The product's real `BottomNav`, 60px, pinned — **must match `components/chrome/BottomNav.jsx`'s declared height exactly** |
| Status bar | 30px, `0 20px` padding, time "6:12" left at 11px/600 tabular; signal bars (4 × 3px wide at 4/6/8/10px tall, `#1A1A1A` at 0.75) + 16×9 battery outline right |

**The crop must be measured, not chosen.** This is the important implementation detail. A hand-picked frame height puts the fade ramp across whatever element the arbitrary crop lands on — during this work it successively bisected the CTA, hid the session card, and then washed the CTA out to look disabled. Three rounds of tweaking the number failed.

The working approach: name the last element the shot must show (Today's "Log this session" button), measure its bottom edge, and set the content height to `that bottom + 32px gap`. The fade then occupies exactly that empty gap and can never overlay content. Frame height is derived, not authored. Re-measure once the webfont loads, since Inter changes content height.

In the prototype this is a `useLayoutEffect` + `getBoundingClientRect` in `PhoneFrame.jsx`. In a server-rendered Next.js page you will not want a runtime measurement — instead compute the value once, hard-code `654px`, and **add a test or comment pinning it to the CTA's position** so it cannot silently drift when Today's content changes.

**Known unsolved issue.** A frame placed inside a dark-ground section renders its screen ground dark instead of `#F3F0EB`, despite explicit literal backgrounds, an explicit `color`, and locally re-declared palette custom properties (all three attempted, none worked, cause not found). The dark band is therefore text-only. **Keep device frames on light sections until this is diagnosed.**

---

## Change 3 — Radii up one step (site + app)

**What.** 12px on a card reads 2019; 16px is where premium products sit now. Pure token change, no markup.

| Token | Now | Proposed |
|---|---|---|
| `--radius-sm` | 8px | **10px** |
| `--radius-md` | 12px | **14px** |
| `--radius-lg` | 16px | **18px** |
| `--radius-xl` | 20px | **22px** |
| `--radius-pill` | 100px | unchanged |
| `--card-primary-radius` | 12px | **16px** |
| `--card-contextual-radius` | 10px | **14px** |
| `--card-data-radius` | 10px | **12px** |

Least noticeable on the marketing site, most noticeable in the app, where nearly every surface is a card.

---

## Change 4 — Two-layer card shadow (site + app)

**What.** The current card shadow is a single `0 1px 2px` at 4% — effectively invisible, so cards sit flat on the warm ground and the app reads as a document rather than an interface. Keep that 1px contact shadow to seat the card, and add a wide, heavily-offset soft layer to do the lifting.

```css
--shadow-card:   0 1px 2px rgba(26,26,26,.04), 0 10px 28px -10px rgba(26,26,26,.10);
--shadow-lifted: 0 1px 2px rgba(26,26,26,.05), 0 18px 42px -14px rgba(26,26,26,.16);
--card-primary-shadow: var(--shadow-card);   /* was 0 1px 2px rgba(26,26,26,0.04) */
```

Both layers sit well below the threshold where a shadow reads as decoration. The intent is that you feel it and don't see it. This is the largest perceived-quality change of the four.

**This one needs component edits, not just the token.** The components set `background: var(--card)` inline with no `box-shadow` property, so changing the token alone does nothing. Add `box-shadow: var(--shadow-card)` to each component where it already sets `background: var(--card)`.

**Apply to primary cards only.** Verified correct scope in the prototype:

- **Yes** — white `var(--card)` surfaces: `SessionCard`, `RestraintCard`, `StatCell`, `StatRow`, `ZoneRings`, `TrendCard`, `ActionListCard`, `NotificationRow`, `PlanIntroCard`.
- **No** — contextual surfaces on `--warn-bg` (`CoachNoteBlock`, `PendingAdjustmentBanner`) and data surfaces on `--bg-soft` (`PreRunBandCard`). The card-treatment spec gives these `box-shadow: none`; that stays.
- **No** — `BottomNav`. It is chrome with a top hairline, not a floating card.
- **Never nest.** A shadowed card inside a shadowed card doubles the effect and looks cheap.

---

## Recommended, not built

Ordered by value per unit of work. None of these are in the prototypes.

1. **More air** — section gaps 28px → 36px. Premium reads as space more than anything else, and this is the cheapest remaining lever. In the overlay as `--section-gap: 36px`, but not previewable via token because the screens set gaps inline.
2. **FAQ accordion** on the marketing site. All three reference sites have one, Zonna has none. Suits a dry voice and is free SEO.
3. **A facts band** under the hero — "16 weeks · 5 zones · £7.99 · 1 notification a day". Borrows MoorHub's stat-strip structure without vanity metrics, which the brand would not tolerate.
4. **Hero type up** to ~68px at tighter tracking (currently `clamp(36px, 6vw, 56px)`).
5. **Today's hero line** 44px → 52px. It is the app's signature moment and currently smaller than the marketing headline.
6. **Bottom nav icons.** The design system's `BottomNav` renders placeholder dots. The real app defines `IconToday`, `IconPlan`, `IconCoach`, `IconStrava` (each taking an `active` boolean, hand-rolled inline SVG — there is no icon library in `package.json`). Those four should replace the dots. **Open question for the product owner: is the fourth tab "Me" or "Strava"?** The icon names suggest Strava; the design system currently assumes Me.

---

## Interactions & behaviour

No new interactions. Everything in the prototypes uses existing behaviour:

- **Motion is unchanged** — 0.15s ease on interactive state changes, 0.2s on colour fills, 0.28s slide-up for sheets. No new animation, no scroll-triggered reveals, no hover effects on the dark band.
- **Dark band** is entirely static. The CTA is a plain link.
- **Device frame** is non-interactive on the marketing page (handlers passed as no-ops). It is a still, not a live demo.
- **Focus** stays `2px solid var(--moss)` at 2px offset. On the dark band use `var(--moss-on-ground)` so focus rings stay visible.

## State management

None added. The prototype's frame measurement (`useLayoutEffect` + one `useState`) exists only because the prototype measures at runtime; the production implementation should hard-code the computed height instead.

## Design tokens — complete diff

Everything in `tokens/v2-modern.css`. Seven new tokens, eleven changed values, nothing removed.

```css
/* NEW — dark ground */
--ground: #1A1A1A;
--ground-soft: #242220;
--ground-line: rgba(243,240,235,0.14);
--on-ground: #F3F0EB;
--on-ground-2: rgba(243,240,235,0.72);
--on-ground-mute: rgba(243,240,235,0.5);
--moss-on-ground: #8FB08F;

/* CHANGED — radii */
--radius-sm: 10px;              /* was 8px  */
--radius-md: 14px;              /* was 12px */
--radius-lg: 18px;              /* was 16px */
--radius-xl: 22px;              /* was 20px */
--card-primary-radius: 16px;    /* was 12px */
--card-contextual-radius: 14px; /* was 10px */
--card-data-radius: 12px;       /* was 10px */

/* NEW + CHANGED — shadow */
--shadow-card: 0 1px 2px rgba(26,26,26,.04), 0 10px 28px -10px rgba(26,26,26,.10);
--shadow-lifted: 0 1px 2px rgba(26,26,26,.05), 0 18px 42px -14px rgba(26,26,26,.16);
--card-primary-shadow: var(--shadow-card);  /* was 0 1px 2px rgba(26,26,26,0.04) */

/* CHANGED — documented, not built */
--section-gap: 36px;            /* was 28px */
```

Unchanged and not to be touched: every colour in `tokens/colors.css` and `tokens/sessions.css`, the whole type scale, the spacing ladder, all motion values, `--radius-pill`.

## Where each change lands in the codebase

Repo: `Service-Nerd/zona`, branch `main`.

| Change | Files |
|---|---|
| 1 — dark ground tokens | `app/globals.css` (`:root`) |
| 1 — the band itself | `app/page.tsx` (replaces the closing statement section) |
| 2 — device frame | `app/page.tsx` + a new `components/marketing/PhoneFrame.tsx`; renders the real Today screen |
| 3 — radii | `app/styles/polish-tokens.css` (card treatments), `app/globals.css` (`--radius-*`) |
| 4 — shadow token | `app/styles/polish-tokens.css` |
| 4 — shadow application | `components/shared/*.tsx` — add `box-shadow` where each sets `background: var(--card)`; also the primary cards inside `app/dashboard/DashboardClient.tsx` |

**Note on `DashboardClient.tsx`:** it is 685 KB and could not be read while preparing this. The four app screens in the prototype are assembled from `docs/canonical/ui-patterns.md` § Screen Templates, `screen-architecture.md` and `docs/screen-inventory.md`, so their layout order is faithful but in-screen paddings are pattern defaults rather than copies of the real screens. Treat the real file as the source of truth where they differ; the token changes apply regardless.

## Assets

No new assets. Everything uses existing brand assets in `assets/icons/` and the Inter webfont already loaded from Google Fonts. The Apple mark on the App Store badge stays inline SVG with `currentColor`. No new icons, no images added.

## Files in this bundle

| Path | What it is |
|---|---|
| `README.md` | This document. Self-sufficient — the four changes can be implemented from it alone |
| `tokens/v2-modern.css` | **The whole token diff.** The primary artefact — start here |
| `styles.css`, `tokens/*` | The current token set, so every "was" value can be checked in context |
| `v2-proposal.html` | Before/after summary of all four changes, with side-by-side values. Open in a browser |

**The interactive prototypes are not in this bundle.** They are `.jsx` and would need the compiled component library plus the whole design system to render, so they ship with the design system project rather than here. Ask the designer for the project export if you want to click through them; the files are:

- `ui_kits/marketing/index-v2.html` + `HomePageV2.jsx` + `PhoneFrame.jsx` — v2 homepage, changes 1 and 2 commented inline
- `ui_kits/marketing/index.html` + `HomePage.jsx` — current homepage, to diff against
- `ui_kits/app/index-v2.html` and `index.html` — v2 and current app
- `ui_kits/app/*.jsx` — the four app screens plus Session Detail, Notifications and fake data

Everything those prototypes demonstrate is specified numerically above, so they are a convenience rather than a dependency.
