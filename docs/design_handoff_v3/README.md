# Handoff: Zonna — post-run HR trace hero, tabbed app screens, homepage surface system

## Overview

Three connected pieces of zonna.run, a restraint-based running app whose product opinion is "you are trying too hard on your easy days":

1. **Hero** — an animated post-run heart-rate trace for the marketing homepage. An easy 8 km run against a flat 145 bpm ceiling, with the time above the ceiling shaded amber, and a one-sentence verdict from Kit (the AI coach). It loops between a "went too hard" state and a "held the zone" state.
2. **Tabbed phone** — one iPhone frame with Today / Plan / Coach.
3. **Homepage surface system** — the full marketing page: alternating warm bands, two full-bleed ink bands, a moss wash behind the hero trace only, white cards, large numerals as graphic elements, paper grain.

## About the design files

The files in `design/` are **design references written as HTML**. They are prototypes of the intended look and behaviour, not production code to copy. The task is to **recreate them inside zonna's existing codebase** (Next.js + React upstream) using its established components and tokens. Where this bundle and the real codebase disagree on a token or component, the codebase wins.

They are authored as "Design Components" — each `*.dc.html` is a self-contained page with an HTML template plus a small logic class, rendered by `design/support.js`. Open any of them directly in a browser. Treat the template markup as the structural spec and the logic class as the behavioural spec; do not port `support.js`.

## Fidelity

**High fidelity.** Colours, type, spacing, radii, shadows, motion timings and copy are final and taken from the Zonna design system (Warm Slate). Recreate pixel-accurately with existing components where they exist (`SessionCard`, `BottomNav`, `WeekStrip`, `Wordmark`, `CoachNoteBlock`, `NotificationBell`).

One deliberate deviation from the design system is flagged under **Accessibility** below.

---

## Screens / views

### 1. Hero — "2a", the recommended direction
File: `design/hero-directions.dc.html`, section `#2a` (top of the page). Sections `#1a`, `#1b`, `#1c` below it are rejected alternatives kept for reference — do not build them.

**Purpose:** the homepage above-the-fold. Carries the positioning line and proves the product's claim in one glance.

**Layout (desktop, 1000px design width):**
- Outer block: background `#F3F0EB`, radius 20px, padding 64px 56px.
- CSS grid, two columns `minmax(0,0.85fr) minmax(0,1fr)`, gap 56px, `align-items:center`.
- Left column, flex column, gap 22px:
  - Eyebrow: "Slow down. You've got a day job." — 10px / 700 / uppercase / 0.08em / `#8A857D`
  - H1: "You can't outrun your easy days." — 52px / 800 / line-height 1.04 / -0.025em / `#1A1A1A`
  - Body: "Zonna gives every easy run a heart-rate ceiling, then tells you in one sentence whether you held it." — 16px / 400 / 1.6 / `#3D3A36`, max-width 380px
  - Row, gap 16px: primary CTA "Start 14-day trial →" (fill `#5A7C5A`, white label, 15px/600, radius 999px, padding 15px 26px; hover fill `#4C6B4C`; arrow at 0.75 opacity) and "£7.99 / month · cancel in two taps" — 13px `#8A857D`
- Right column: moss wash `#E7EDE4`, radius 20px, padding 24px, containing the evidence card.

**Evidence card** (white, 1px `rgba(26,26,26,0.06)`, radius 20px, padding 26px, shadow `0 1px 2px rgba(26,26,26,0.04), 0 12px 32px rgba(26,26,26,0.05)`, flex column gap 20px):
1. Header row, space-between, baseline: "Yesterday · 8 km easy" (10px/700/uppercase/0.08em/`#8A857D`) and "Zone 2 · ceiling 145 bpm" (13px `#8A857D`, tabular-nums).
2. Verdict number, baseline row gap 12px: value 72px / 800 / line-height 0.9 / -0.04em / tabular-nums; label "minutes above your ceiling" 15px `#3D3A36`. State A: "14" in `#B8853A`. State B: "0" in `#6B8E6B`.
3. The HR trace (see component below), with distance ticks.
4. 1px divider `rgba(26,26,26,0.08)`.
5. Kit's line: 3px rounded rail + eyebrow "KIT · YOUR COACH" (10px/700/0.14em/uppercase) + sentence (15px/1.55).
   - State A: rail and eyebrow `#B8853A`, sentence `#3D2600` — "Bit keen. 14 minutes above your ceiling. Ease it back Thursday."
   - State B: rail and eyebrow `#6B8E6B`, sentence `#3D3A36` — "Held Zone 2 the whole way. That's the win."

**Layout (390px):** same order, single column. H1 32px, body 14px, card padding 18px and radius 16px inside a 12px moss-wash frame, verdict number 52px with the label wrapped over two lines, sentence 14px, CTA full width.

**State swap technique:** both states are rendered in the same CSS grid cell (`grid-area:1/1`) and cross-faded with `opacity` over 0.5s ease. This keeps the box sized to the taller of the two and avoids layout shift. Reproduce that, don't swap text nodes.

### 2. HR trace component
File: `design/HrTrace.dc.html`. Used seven times across the bundle — build it once.

- SVG, `viewBox="0 30 600 190"`, `width:100%; height:auto`, `overflow:visible`.
- **Ceiling line:** horizontal at `y=120`, x 16→584. Full size: `stroke #B5B0A7`, width 1.5, dash `4 7`. Mini: `stroke #8A857D`, width 5, dash `10 14`.
- **Keen path** (state A), `stroke #3D3A36`, width 3 (mini 7), round caps/joins:
  `M20,200 C55,186 85,150 115,138 C150,124 172,132 202,118 C232,104 252,86 277,76 C302,66 322,60 347,64 C372,68 392,84 412,98 C434,113 452,124 472,130 C505,140 538,148 580,156`
  It crosses above the ceiling from roughly x=200 to x=412.
- **Amber breach fill:** the same path closed with `L580,220 L20,220 Z`, filled `#B8853A` at `fill-opacity 0.22`, clipped by `<rect x=0 y=0 width=600 height=120>` so only the portion above the ceiling shows.
- **Held path** (state B), `stroke #6B8E6B`, same widths:
  `M20,206 C55,198 85,182 115,174 C150,166 172,172 202,164 C232,156 252,152 277,158 C302,164 322,160 347,163 C372,167 392,161 412,166 C434,170 452,164 472,168 C505,172 538,168 580,172`
- End dot: circle at the path's last point, r 5 (mini 9), same colour as its stroke, fades in with a 0.7s delay.
- **Draw-in:** `stroke-dasharray:1200`, `stroke-dashoffset` animates 1200 → 0 over 1.6s `cubic-bezier(0.33,0,0.2,1)`, triggered ~120ms after mount.
- **State cross-fade:** each state is a `<g>` whose opacity transitions over 0.65s ease.
- **Ceiling label** (full size only): HTML, absolutely positioned at `top:33%; left:0` — "CEILING 145 BPM", 10px/700/0.08em/uppercase/`#8A857D`.
- **Distance ticks** (opt-in via `ticks`): HTML row under the SVG, space-between, 10px/700/uppercase/0.08em/`#8A857D`, tabular-nums — "0 KM", "4 KM", "8 KM".
- **Mini variant** (`mini`): no ceiling label, no ticks, thicker strokes and ceiling dash so the breach still reads at ~140px wide.

Props: `phase` (0 = keen, 1 = held), `drawn` (bool, drives the draw-in), `mini` (bool), `ticks` (bool).

**The loop lives in the parent, not the trace** — the hero owns `phase` so the verdict number and Kit's sentence stay in sync with the curve.

### 3. Mini traces
File: `design/hero-directions.dc.html`, "Four easy runs, same ceiling". Four-column grid, gap 20px. Two keen traces on `#F3F0EB` tiles labelled "Mon · run on feel" / "Wed · run on feel"; two held traces on `#E7EDE4` tiles labelled "Sat · run to the ceiling" / "Sun · run to the ceiling" (12px, `#8A857D` and `#3D3A36` respectively). Tiles: radius 12px, padding 14px.

### 4. Phone — Today / Plan / Coach
File: `design/phone-tabs.dc.html`. Frame 390×844, radius 52px, 1px `rgba(26,26,26,0.12)`, shadow `0 1px 2px rgba(26,26,26,0.04), 0 24px 60px rgba(26,26,26,0.10)`. Status bar 54px with a 104×30 dynamic island. App chrome: `Wordmark size="sm"` + `NotificationBell count={1}`. Screen gutter 16px. `BottomNav` (Today / Plan / Coach / Me) pinned at the bottom, 60px + safe-area inset.

The three-up segmented row above the content is a **prototype affordance for reviewing all three screens in one frame** — in the real app, tab switching is the bottom nav. Don't ship the segmented row.

- **Today:** eyebrow "TUESDAY 22 SEPTEMBER", title "Today" (26/800). Primary card with 3px `#3D6FB0` left bar: session chip "EASY" (`rgba(61,111,176,0.15)` fill, `#3D6FB0` label), "8 km, easy" at 34/800, "Zone 2 · under 145 bpm · 6:30–7:30 /km" at 14px `#3D3A36`, divider, stat pair 55 min / 145 bpm ceiling. Amber coach block: "Bit keen on Sunday. Hold the ceiling today." Full-width CTA "Start run".
- **Plan:** eyebrow "WEEK 6 OF 16 · BASE", title "This week", `WeekStrip` (Mon done, Tue today, Thu session, Sat/Sun future), then four `SessionCard`s 12px apart — Easy 8 km (current, 55 min), Threshold 3 × 8 min (quality, 50 min), Easy 6 km (40 min), Long 18 km (2 h 05). Data card `#EDE9E1` footer: 4 sessions / 38 km / 3 rest days.
- **Coach:** eyebrow "15–21 SEPTEMBER", title "This week in zones". Primary card: "71%" at 56/800 with "in Zone 2" beside it, "Target is 80%. Last week: 62%." at 13px `#8A857D`, divider, then four zone bars (8px tall, radius 4, track `#EDE9E1`): Z1 9% `#4E8068`, Z2 71% `#3D6FB0`, Z3 14% `#B8853A`, Z4 6% `#C86A2A`, each with a right-aligned tabular percentage. Amber coach block: "Closer. The easy days are still creeping up at the end."

### 5. Homepage surface system
File: `design/homepage-surfaces.dc.html`. Content column max-width 1080px, gutter 24px.

Band order, top to bottom:
1. **Header** — `#F3F0EB`, 1px bottom hairline. Wordmark, three text links, pill CTA.
2. **Hero** — `#F3F0EB`, padding 88px/80px. H1 56/800/-0.02em, sub 17px, pill CTA + pricing line. Below it the moss wash `#E7EDE4` (radius 20, padding 36) holding the evidence card from 2a.
3. **Proof** — `#EDE9E1`, 1px top hairline, padding 72px. Three white cards, auto-fit `minmax(240px,1fr)`, gap 20: "80%", "1", "4", each 56/800 with a 14px sentence under it.
4. **"What's not in the app"** — full-bleed `#1A1A1A`, padding 96px. Two columns `0.9fr / 1fr`, gap 56. Left: eyebrow "RESTRAINT" `#8A857D`, H2 40/800 `#F3F0EB`, 15px `#B5B0A7` paragraph. Right: five rows, 17px `#F3F0EB`, em-dash bullet `#8A857D`, 16px vertical padding, hairline `rgba(243,240,235,0.12)` between — Streaks / Leaderboards / Readiness scores and vitals / Charts you have to interpret / Fire emojis. Ever.
5. **How it works** — `#F3F0EB`, padding 88px. H2 36/800, then three columns whose graphic element is "01" / "02" / "03" at 88px / 800 / line-height 0.8 in `#EDE9E1` — the inset colour used as ink on the page colour.
6. **Pricing** — `#EDE9E1`, 1px top hairline. Centred white card, max-width 420px, padding 40px: "£7.99" at 64/800 with "/ month", supporting line, full-width CTA.
7. **Final CTA** — full-bleed `#1A1A1A`, padding 104px, centred. H2 48/800 `#F3F0EB` "You can't outrun your easy days.", 16px `#B5B0A7` sub, pill CTA.
8. **Footer** — `#F3F0EB`, hairline top, wordmark + "zonna.run · Privacy · Terms".

**Paper grain:** a fixed full-viewport overlay at `opacity: 0.03`, `pointer-events:none`, painted with an inline SVG `feTurbulence` (`type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"`, 220×220 tile). It sits above the bands and below nothing else. Exact declaration is in the `<style>` block at the top of the file.

No gradients anywhere except the 22px Kit avatar (135°, `#6B8E6B` → `#5A7C5A`), which is the design system's single sanctioned exception.

---

## Interactions & behaviour

- **Hero loop:** `phase` toggles 0 → 1 → 0 on a 7-second interval (tweakable 3–12s). On mount, wait ~120–150ms, then set `drawn` to trigger the stroke draw-in. Clear the timer and interval on unmount.
- **Reduced motion:** if `prefers-reduced-motion: reduce` matches, set `drawn` immediately, never start the interval, and leave the hero in state A (the amber breach). No draw-in, no cross-fade, no loop.
- **CTA hover:** background `#5A7C5A` → `#4C6B4C`. No scale, no shadow change.
- **Links:** `#5A7C5A`, hover `#3D3A36`.
- **Tabs (prototype only):** active tab gets `rgba(107,142,107,0.1)` fill, `#6B8E6B` border, `#3D3A36` ink at 700; inactive is transparent with a `rgba(26,26,26,0.08)` border and `#8A857D` ink at 500. Transition `background 0.2s ease, border-color 0.15s ease`.
- **Responsive:** the hero's two-column grid collapses to one column below roughly 860px; the 390px composition in the bundle is the target mobile layout. Everything else uses `auto-fit minmax()` grids and reflows on its own.
- No scroll-triggered reveals, no spinners, no celebration animation.

## State management

Hero / homepage: `phase: 0 | 1` and `drawn: boolean`, both owned by the page, both passed down to the trace. Phone prototype: `tab: 'today' | 'plan' | 'coach'`. Nothing fetches data; all content is static mock copy.

## Design tokens

All values come from the bound Zonna design system (`design/_ds/tokens/*.css`). Import those rather than re-declaring.

- **Surface:** page `#F3F0EB`, inset `#EDE9E1`, card `#FFFFFF`, moss wash `#E7EDE4` (hero trace only)
- **Ink:** `#1A1A1A` / `#3D3A36` / `#8A857D` / `#B5B0A7`
- **Accent:** moss `#6B8E6B`; CTA fill `#5A7C5A`, CTA hover `#4C6B4C`
- **Coaching:** warn `#B8853A`, warn background `#F5EBD4`, text on amber `#3D2600`
- **Zone / session:** Z1 recovery `#4E8068`, Z2 easy `#3D6FB0`, Z3 quality `#B8853A`, Z4 race `#C86A2A`, Z5 intervals `#B84545`, long `#5E4FB0`
- **Lines:** hairline `rgba(26,26,26,0.08)`, strong `rgba(26,26,26,0.15)`, card border in this design `rgba(26,26,26,0.06)`
- **Type:** Inter only. 56/800 hero · 52/800 hero (2a) · 48/800 · 40/800 · 36/800 · 34/800 · 26/800 screen title · 17/700 · 15/600 card primary · 14/400 1.55 body · 13/400 and 12/400 supporting · 10/700 uppercase 0.08em eyebrow (0.14em for the coach eyebrow). Big numerals 800 weight, `font-variant-numeric: tabular-nums`, letter-spacing -0.03 to -0.04em.
- **Spacing ladder:** 4 · 8 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 56 · 64 · 72 · 88 · 96 · 104
- **Radius:** 8 / 10 / 12 / 14 (coach blocks) / 16 / 20 / 52 (phone frame) / 999 (marketing pills)
- **Shadow:** card `0 1px 2px rgba(26,26,26,0.04)`; the marketing hero card adds a second layer `0 12px 32px rgba(26,26,26,0.05)`; phone frame `0 24px 60px rgba(26,26,26,0.10)`
- **Motion:** 0.15s interactive state, 0.2s colour fills, 0.5s verdict cross-fade, 0.65s trace state cross-fade, 1.6s `cubic-bezier(0.33,0,0.2,1)` draw-in, 7s loop interval

## Accessibility

- **One deliberate deviation from the design system:** the system's CTA is a `#6B8E6B` fill with a white label, which measures **3.68:1** — below WCAG AA for 15–16px text. Every CTA in this bundle uses **`#5A7C5A`** (the moss ramp end already used by the Kit avatar gradient) with white, which measures **4.62:1** and passes AA. Either adopt `#5A7C5A` as the CTA token or raise the CTA label to large-text size; don't silently revert to `#6B8E6B`.
- Tick labels and all supporting text are `#8A857D` or darker on warm backgrounds (4.5:1+). `#B5B0A7` is used only on ink bands, where it measures well above AA.
- Ink bands use `#F3F0EB` text on `#1A1A1A`.
- Focus ring: `2px solid #6B8E6B` at 2px offset, unchanged from the design system.
- Decorative SVG is `aria-hidden`; the trace carries no information that isn't also in the verdict number and Kit's sentence.
- Tap targets 44px minimum; bottom nav 60px plus safe-area inset.

## Assets

None beyond the design system. No photography, no icon library, no emoji. The only inline SVGs are the trace itself, the paper-grain turbulence tile, and the design system's own four hand-authored glyphs (AI sparkle, session checkmark, notification bell, Apple mark). Unicode carries the rest: `→ › ▾ ← ✓ —`.

## Files

```
design/
  hero-directions.dc.html    2a (build this) + 1a/1b/1c rejected alternatives + mini traces
  homepage-surfaces.dc.html  full marketing page
  phone-tabs.dc.html         iPhone frame, Today / Plan / Coach
  HrTrace.dc.html            the shared HR trace component
  support.js                 prototype runtime — do not port
  _ds/                       Zonna design system tokens + component bundle
```

Open any `.dc.html` directly in a browser to see the live behaviour, including the loop and the reduced-motion path.
