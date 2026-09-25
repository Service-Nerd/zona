# UI Patterns — Zonna Visual Language

> ⚖️ **This document is Design Board doctrine (ADR-023).** Editing it is a design
> ruling, not a note-taking exercise, and `.claude/hooks/design-guard.py` fires on
> every edit to it — including through Bash. Convene `/design-board`, or state the
> exemption in one line.
>
> **Read `docs/canonical/design-rulings.md` first.** It records what has already
> been decided and what may not be re-proposed. Two design decisions were
> re-litigated from scratch on 2026-09-21 because the rule and the token lived in
> different files and never met.
>
> Every Design Board SHIP ruling lands three artifacts in one commit: a **pattern**
> here, a **token or named constant**, and a **mechanical check that has been made
> to go red** — plus a row in the ruling register.


**Reference aesthetic**: Runna · Planzy  
**Authority**: This document defines layout patterns, component anatomy, spacing, and typography rules for all Zonna screens. Read before building any new screen or component.

**Design system**: Warm Slate (ADR-007). Single light theme. No dark mode (ADR-008). All tokens from `globals.css`.

---


## The semantic colour pair — moss = held the zone, amber = cooked it (P-01)

**SLT-approved 2026-09-20, resolution A.** Owner: `lib/coaching/zoneVerdict.ts`.

| Verdict | Token | Means |
|---|---|---|
| `held` | `--zone-held` (→ `--moss`) | Completed, and the intensity was right |
| `drifted` | `--zone-drifted` (→ `--warn`) | Completed, but more than the ratified share sat above the Z2 ceiling |
| `unknown` | `--zone-unknown` (→ `--mute`) | We cannot say — **the honest majority case** |

**Why.** Moss meaning "done" and amber meaning "warning" is category-generic — and measured
against a competitor's shipped app, so is the palette they sit in (their ground `#FAF8F5` against
our `#F3F0EB`, their accent `#617C62` against our `#6B8E6B`: the same *strategy*, arrived at
independently). A colour that tells you you went too hard is costly to ship — it loses the
beginner market — and that cost is what makes it credible. It is structurally unavailable to any
app whose proposition is encouragement.

**Rules.**
1. **Resolve every completion colour through `zoneVerdict()`.** Never compute the verdict in a
   component. One predicate (D-16).
2. **Scope is COMPLETION STATES ONLY** (resolution A). `--s-race` and `--warn` keep today's
   meanings. ⚠️ A race week drawn in amber must not read as a reprimand for racing.
3. **`unknown` is never styled as a soft `held`.** No HR, or a free-tier runner without
   `activity_intelligence`, means we say nothing — `zoneVerdictLabel('unknown')` returns `null`
   and the surface falls back to a neutral word.
4. 🔴 **Bind to `ZONE_DRIFT_ABOVE_CEILING_PCT` (20), never `ZONE_DISCIPLINE_BANDS`.** The latter
   is the obvious thing to reach for and is **dead** — its only reader has no call sites.
5. **Compliance COPY is not this pattern.** The sentence ("3 of 4 runs held the zone") belongs to
   P-04 and is pattern-setting under §4A.

⚠️ **The consequence, accepted knowingly:** amber is only ever *visible* to runners with run
analysis, which is PAID. A free runner sees the ceiling (P-03) and never learns whether they held
it. The SLT reads scoring as richness and the ceiling as access; it is flagged for founder
confirmation rather than settled.


## Core Aesthetic

Warm, grounded, athletic. No decoration for decoration's sake. Every element earns its place.

- **Warm Slate is primary** — `--bg: #F3F0EB` off-white background, `--card: #FFFFFF` card surfaces
- **Bold metrics, quiet context** — large numbers, small muted labels underneath; value always dominates
- **Type accent, not flood** — session colours appear as left borders, dots, or small chips; never as full card backgrounds
- **Density with breathing room** — tight within a card, clear gaps between cards, generous padding inside
- **No chrome** — no box shadows **stacked on** box shadows, no gradients, no decorative dividers

> ⚠️ **WHAT "NO CHROME" DOES NOT SAY** *(Design Board 2026-09-25, UI-PATTERNS-REVIEW-01)*.
> It is not a ban on shadow. It forbids **stacking** them. § Card Elevation below
> **mandates** `--shadow-card` on primary cards — *"you feel it, you don't see it"* — and
> `design-rulings.md` carries the standing rule **"Elevation is `--shadow-card` /
> `--shadow-lifted`. Do not design a new elevation system."**
>
> 🔴 **This was being read as "everything must be flat", and that reading blocked work
> for a month.** Measured at the sitting: `--shadow-card` has **20 consumers**;
> **`--shadow-lifted` has ZERO** — a token authored for the raised state that never
> reached a screen. The doctrine had already authorised the tool nobody was using.
>
> Likewise **motion is not banned.** Sheets animate enter and exit, `AIMark` pulses in
> place of the banned spinner, and `globals.css` carries a `prefers-reduced-motion` block.
> The one *"no motion"* is scoped to the **marketing sticky header** (Wood: *a sticky
> header is structural, an animated one is decorative*) and does not generalise.
- **Moss is the primary accent** — `--moss: #6B8E6B` for CTA, active states, completion signals
- **Warn is coaching only** — `--warn: #B8853A` for coach voice blocks and adjustment banners exclusively

---

## Typography Scale

All type uses **Inter** only. `var(--font-ui)` and `var(--font-brand)` both resolve to Inter. Never hardcode font family strings. Space Grotesk is retired (ADR-007).

| Role | Token | Weight | Size | Usage |
|---|---|---|---|---|
| Hero display | `--font-ui` | 800 | 56px | Today screen hero ("10km, slowly.") |
| Screen title | `--font-ui` | 800 | 26px | Page headings ("Your plan", "Today") |
| Section label | `--font-ui` | 700 | 10px uppercase 0.08em | Eyebrows, category labels |
| Card primary | `--font-ui` | 600 | 15px | Session name, main label |
| Card secondary | `--font-ui` | 400 | 12px | Zone, type, supporting detail — `--mute` |
| Body / description | `--font-ui` | 400 | 14px | Session description, coach note |
| Metric large | `--font-ui` | 800 | 44px | RestraintCard percent, big stats |
| Metric medium | `--font-ui` | 700 | 17px | Session card distance |
| Metric small | `--font-ui` | 400 | 11px | Session card duration — `--mute-2` |
| Muted / hint | `--font-ui` | 400 | 12px | `--mute` — timestamps, metadata |
| Wordmark | `--font-ui` | 800 | 14px | ZONNA nav wordmark |

### Metric Pair Pattern (Runna-style)

Use consistently wherever a stat is displayed:

```
42.3          ← Inter 800, 44px, tabular-nums, --ink
km this week  ← Inter 400, 13px, --mute
```

Never put label above value. Value always dominates.

---

## Spacing Rhythm

Canonical spacing values. No others.

```
4px   — icon gaps, inline tight
8px   — within a component (label + value pair)
12px  — between elements inside a card; between session cards in a list
14px  — card vertical padding (inner)
16px  — section header margin, coach block padding
20px  — card padding (outer standard)
24px  — between cards in a list (section-level)
28px  — between sections
32px  — major section breaks
40px  — screen-level top breathing
48px  — large screen padding
56px  — hero section spacing
```

### Marketing section rhythm (W-07, 2026-09-21)

The scale above is written for a 375-wide screen read at arm's length under a thumb, and it tops out at 56px. A marketing section is read at 1280 and needs more air, so the site extends it with **three tokens and no others**:

| Token | Value | Use |
|---|---|---|
| `--sect-y` | `clamp(56px, 6vw, 80px)` | every content section, top and bottom |
| `--sect-y-hero` | `clamp(32px, 4vw, 48px)` | hero only — the header sits above it |
| `--sect-y-close` | `clamp(72px, 9vw, 112px)` | the one dark band, deliberately heavier |
| `--beat-y` | `calc(var(--sect-y) * 0.7)` | **the gap between two beats INSIDE one section** (SITE-BEAT-01) |

**Responsive by construction:** at 375px `--sect-y` resolves to **56px, which IS the canonical value**, so the phone never pays for the desktop's air.

#### The beat — SITE-BEAT-01, 2026-09-22

**A section separated from a section. Nothing separated a beat from a beat, so three of them rendered at exactly 0px.** Found by the founder on a phone, measured live on all three: the trio of product stills under the wizard card, `How it goes` under the trio, and `Honestly` under the refusal grid. `0 · 0 · 0`.

🔴 **Design Board sitting two CREATED this defect, and that is the finding.** It merged four sections into two, correctly. A `<Section>` boundary is what was carrying the space, so deleting the boundary deleted the space, and the merged sections were the only ones affected. **Every other marketing page measured clean.** When you merge two containers, the gap between them was a property of the container, not of the content: re-express it or it is gone.

🔴 **`SITE-WAVE-4`'s scale could not have caught it, and this is its stated negative space.** That sweep measured **448 gaps that existed**. A gap of zero is not a gap, it is an absent decision, and a scale test can only tokenise a value somebody already typed. **A spacing audit finds wrong values; it is blind to missing ones.**

**Derived, never a fourth independent clamp.** `--beat-y` is `--sect-y × 0.7` so a beat is subordinate to a section boundary at every viewport by construction rather than by two clamps happening to agree. 39px at 375, 43px at 1024, 56px at 1440, against a section's 56/61/80 **per side**. A beat spaced like a section would make the merge cosmetic: the reader would still meet two equal announcements, which is the thing sitting two set out to remove.

**Use:** `<Eyebrow beat>` for a beat that opens with an eyebrow, `marginTop: 'var(--beat-y)'` for one that opens with a block. `Eyebrow` applies it as **`paddingTop`, not `marginTop`** — an eyebrow is frequently the first child of its wrapper and a first child's top margin collapses out through a padding-less, border-less parent. It renders identically today, which is exactly why the next wrapper to gain a border would move the gap silently.

Guarded by `lib/marketing/beatRhythm.test.ts`.

**And two measures, not eight:** `--measure-page` (1100px, matching the site frame so the content edge stops moving as you scroll) and `--measure-read` (720px, a reading column of roughly 70 characters at 17px).

### App review wave 1 — Design Board sitting three, 2026-09-22

#### One CTA vocabulary (S3)

**A CTA in a fixed position doing a fixed job does not announce direction.** `Continue` throughout; `Got it` only on a teaching interstitial; no arrows.

Measured on the walked wizard: **four labels for one button** — `Continue`, `Continue →`, `Got it →`, `Skip this →` — arrow on some and not others.

#### Dismiss is never `--moss` (S2)

`--moss` is the **CTA colour**: the action the runner came to take. A control whose label is *Close / Cancel / Dismiss* is painted `--bg-soft` with a `--line` border.

The founder named it: *"I don't think one of our key calls to action should be Close in big green moss."* It shipped as a full-width moss `Close` in `ModifyPlanSheet`. ⛔ **Silvanto did not veto this sitting and stated that a `--moss` dismiss shipping after it would be one.**

#### An optional step's affordance does not lie (S4)

🔴 `skipStep()` was **a one-line alias for `goNext()`** — no branch, no clearing, no record. So on each of the **six** optional steps two buttons called the identical function, and **answering the step then tapping "Skip this →" kept the answer.** The label was false.

**The affordance stays** (Wroblewski's binding amendment: five of the six have no `FieldLabel` to hang *optional* on, so removing it would strand a runner who does not know the step is optional) **and reads `Not sure, continue`.** Never *Skip* — nothing is skipped.

⚠️ **Not an em dash.** `brand.md` § Punctuation bans them in copy **site-wide**; the "app-side exception" CLAUDE.md refers to **does not exist in that section**.

#### The safe area is background, not padding (A4)

`padding: 'Npx 0 calc(Npx + env(safe-area-inset-bottom))'` — **the same N top and bottom**, with the inset added on top as the strip it is.

It shipped as `'6px 0 max(12px, env(safe-area-inset-bottom))'`: **6px above the icons, 34px below** on any iPhone with a home indicator, **asymmetric by 28px**. ⚠️ The founder said *"move the menu down"*; **that is not the fix** — moving the bar pushes it under the home indicator. The content moves down inside a bar that stays put.

Guarded by `lib/marketing/appReviewWave1.test.ts`, all four falsified.

---

#### ONE LEFT EDGE — SITE-MEASURE-EDGE, Design Board 2026-09-22

**A narrower measure narrows the box. It does not move it.** `--measure-read` is nested inside the page frame and left-aligned to it; only the right edge moves.

🔴 **The sentence above was the rule and the page was breaking it.** Found by the founder on desktop: *"those are using the full span of the page, and then everything after that has gone really centralised, it's a bit of a mess."* Measured at 1440px, the content's left edge top to bottom:

```
168 · 168 · 168 · 168 · 168 · 168 · 358 · 358 · 168 · 358 · 338
```

**Three distinct left edges, moving four times**, while the header and the footer both sat at **168**. The cause was one property: `margin: '0 auto'` on a 720px box inside an 1100px frame centres it, pushing every prose band **190px inboard** of everything else.

**The measure was never the defect.** 720px for prose is right; a 1100px line of body text is unreadable. The centring was.

**The one exception, and it is deliberate:** the dark close is centred. W-09 makes it the page's punctuation mark and it goes last, so one break at the end reads as a full stop rather than a fifth wobble mid-page. Result: **3 left edges → 2, edge moves 4 → 1.**

⚠️ **760px is retired** (`SITE-MEASURE-THIRD-01`, filed 2026-09-22 and closed by this ruling). It was a third measure that matched no rule and existed because somebody typed a number.

⚠️ **INVISIBLE AT 375px**, where both measures collapse to the gutter. Two founder device passes missed it and a third, on desktop, did not. **A viewport is part of a design check's scope, not a detail of how it was run.**

**A `width="full"` Section re-wraps its content in the page column.** `full` opts out of the frame so a band can manage its own width (the white spotlight, the proof); anything placed inside it that is not re-wrapped in `--measure-page` renders **full-bleed**. The ProductStill trio did exactly that after sitting two moved it — **24-1412 on a 1440 viewport** against every other band at 168.

⚠️ **It survived a measurement aimed straight at it.** The edge audit collected elements carrying a `max-width`; this grid has none, so the band reported its neighbour's 168. **A measurement that only looks at elements WITH the property cannot find the one MISSING it.**

Guarded by `components/marketing/section.markup.test.ts` and `lib/marketing/sectionSurfaces.test.ts`.

⚠️ **Why this is a rule and not a suggestion.** Before it, the homepage alone carried **eleven different padding pairs** (48/56, 0/56, 72/72, 80/80 ×3, 72/72, 80/80, 112/112, 56/48, 40/0) and **eight different content widths** (1100, 900, 640, 760, 780…), none of 72/80/112 being on the canonical scale at all. Each was reasonable where it was written. Together they meant the left edge of the content moved as you scrolled. **Slickness is mostly alignment.**

---

Card inner padding: `20px` horizontal, `14–20px` vertical depending on content density.  
List gap between session cards: `12px`.  
Section gap (week → week): `28–32px`.

---


### The spacing scale — SITE-WAVE-4, 2026-09-22

**`--space-1…7` = `4 · 8 · 12 · 16 · 24 · 32 · 48`. 4px base. Never hand-type a gap above 5px.**

🟢 **APPLIED TO THE APP 2026-09-23 (`APP-SPACE-01`), a day after the site.** Wave 4 swept the
marketing site; measured the next day, `var(--space-*)` appeared **17 times in
`components/marketing` and ZERO times in `app/dashboard` or `components/shared`** against **578
hand-typed gaps** and **25 distinct values, 13 off-scale above 5px**. The site had **24 / 19** when
it was ruled — **the app was in the state the site was in before the fix**, and Wave 4's own row had
warned that *"a token family nobody applies is the `surface=` failure repeated."* Swept: **295
tokenised with no visual change, 277 shifted, none by more than 4px (260 looser, 17 tighter).**

⚠️ **THE TIE BREAKS UPWARD.** 6px is equidistant from 4 and 8, and the first cut of the sweep
rounded DOWN — tightening the app's commonest off-scale gap, **74 of them**, on the day the
complaint was that things are too close. Whitespace is a documented feature (*"restraint =
progress"*), so a tie resolves in favour of more of it.

⚠️ **BOTTOM CLEARANCE IS NOT A GAP.** Three `paddingBottom` values (120/120/80px) on
`minHeight:100% / overflowY:auto` scroll containers are the room the fixed tab bar needs; snapping
them to 48px would put content **under the nav**. They are declared exclusions in
`lib/appSpacingScale.test.ts`, the mirror of Wave 4 excluding ≤5px as line-box artefacts: one end of
the range is noise, the other is safe area, and **neither is spacing**.

🔴 **AND THE SWEEP COULD NOT HAVE FIXED THE REPORTED CASE.** § 332 already said why: *"a gap of zero
is not a gap, it is an **absent decision**."* The arc-to-tile gap read as 6px because the tile
declared **no top margin at all** — `PlanArc`'s own trailing margin was the only thing there. That
value is now declared (`--space-4`), not swept.

**Found by the founder on a phone:** *"the space between sections or tiles then next text is
inconsistent. e.g. the zone image then the next text is very close."* His exact case measured
**18px** from the stills grid to the next heading, against **50px** for a comparable break in the
same section. Nothing decided which.

**Measured before ruling:** 448 gaps across six pages at 375px, **24 distinct values, 19 of them
real spacing decisions.**

🔴 **Nineteen is the same number `SITE-TYPE-01` found for font sizes.** Type was tokenised into
16 values and **nobody looked at spacing.** Assume any repo with a type problem has a spacing
problem that has not been measured.

| | |
|---|---|
| Swept | **69 occurrences.** 32 already exact, 37 shifted by ≤4px |
| Page height impact | **largest 26px on 11,773 (0.2%)**; two pages unchanged |
| Applies to | `marginTop/Bottom`, `gap`, `rowGap`, `columnGap`, `paddingTop/Bottom` |

⚠️ **GAPS OF 5px AND UNDER ARE EXEMPT, deliberately** *(Wroblewski)*. They are line-box artefacts
between inline elements — typography, not spacing — and **193 of the 448 measured gaps were in
that band.** Tokenising them produces hundreds of meaningless diffs and buries the real ones. The
guard asserts the exempt band has not *shrunk*, so the exemption cannot be quietly swept away.

⚠️ **A value needing more than a 4px shift is not swept — it returns to the board.** One exists
(`56px`) and is listed in the test's `ALLOWED` register with its reason, rather than hidden.

**Guarded by `lib/marketing/spacingScale.test.ts`**, which reads `components/marketing` from disk
rather than from a list, and strips comments before scanning — this rule's own explanation quotes
pixel values, and a naive scan flags the paragraph describing the rule as a breach of it.
## Design Token Reference

Always use these CSS custom property names. Never hardcode hex values.

| Token | Semantic role |
|---|---|
| `--bg` | Primary background (`#F3F0EB`) |
| `--bg-soft` | Input fields, inset areas |
| `--card` | Card surfaces (`#FFFFFF`) |
| `--ink` | Primary text (`#1A1A1A`) |
| `--ink-2` | Secondary text (`#3D3A36`) |
| `--mute` | Muted / supporting text (`#8A857D`) |
| `--mute-2` | Lighter muted — durations, meta |
| `--moss` | Primary accent — CTA, active, completion (`#6B8E6B`) |
| `--moss-soft` | Moss tint — completion dot background |
| `--moss-mid` | Moss mid — active borders |
| `--warn` | Coaching, warnings — amber (`#B8853A`) |
| `--warn-bg` | Warm amber tint — coach block background |
| `--coach-ink` | Warm dark brown — text on `--warn-bg` only (`#3D2600`) |
| `--danger` | Errors, skipped (`#B84545`) — never in training UI |
| `--line` | Standard border (`rgba(26,26,26,0.08)`) |
| `--line-strong` | Stronger border for current/active states, **and for any bordered element sitting on its own fill** — see below |

> **Which line token: does the FILL already separate them?**
>
> `--line` is 8% alpha. On a white card against the warm `--bg`, that is plenty
> — the fill has already done the separating and the border is only a definition
> edge. **When a bordered element has the SAME fill as its parent** (a `--card`
> button on a `--card` surface, or `background: 'none'` over one), the border is
> not decoration: it is the only thing saying a control is there. 8% at 0.5px is
> not enough to say it. Use **`1px solid var(--line-strong)`**.
>
> Reported from a device, 2026-09-11: *"the continue with google has lost its
> outline and blends into background."* It was `--card` on `--card` with an
> 0.5px `--line` hairline. The redeem-code input (`RedeemCodeScreen.tsx`) is
> white-on-white for the same reason and already used `--line-strong`; the rule
> is now written down rather than rediscovered.
>
> Applies to the auth screens' Google button and secondary "Back to sign in"
> button. Cards on `--bg` keep `--line`.

### v2 modernisation tokens (design_handoff_v2, 2026-09-10)

| Token | Semantic role |
|---|---|
| `--radius-sm/md/lg/xl` | Corner radii — **raised one step** to `10 / 14 / 18 / 22`px (was `8/12/16/20`). 12px reads 2019; 14–18 is the current premium default. |
| `--shadow-card` | **Card elevation** — two-layer (`0 1px 2px/.04` contact + `0 10px 28px -10px/.10` lift). See § Card Elevation. |
| `--shadow-lifted` | Heavier variant for a raised/dragged surface. Same two-layer shape, deeper. |
| `--section-gap` | `36px` (was 28) — primary section rhythm. Applied at call sites; screens set gaps inline. |
| `--ground` / `--ground-soft` / `--ground-line` | Warm near-black surface for the ONE marketing dark band. See § Dark Ground. |
| `--on-ground` / `--on-ground-2` / `--on-ground-mute` | Text on `--ground`. |
| `--moss-on-ground` | `#8FB08F` — moss lifted for dark grounds (the brand moss goes muddy below ~20% luminance). Use for **any** moss on `--ground`; never `--moss` there. |

---

## Card Elevation (design_handoff_v2)

Primary white cards carry `box-shadow: var(--shadow-card)` — a 1px contact shadow that seats the card on the warm ground plus a wide, heavily-offset soft layer that lifts it. Both sit below the threshold where a shadow reads as decoration: **you feel it, you don't see it.** Before this, cards were effectively flat and the app read as a document, not an interface.

**Scope — apply to primary `--card` surfaces only:**
- **Yes** — standalone white cards: `SessionCard` (live state only, not the transparent done/skipped state), `PlanIntroCard`, `NotificationRow`, `ZoneRings`, `TrendCard`, and marketing content cards.
- **No** — contextual surfaces on `--warn-bg` (`CoachNoteBlock`, `PendingAdjustmentBanner`) and data surfaces on `--bg-soft` (`PreRunBandCard`, locked/empty states). These stay `box-shadow: none`.
- **No** — chrome (bottom nav): a top hairline, not a floating card.
- **Never nest.** A shadowed card inside a shadowed card doubles the effect and looks cheap — the parent carries the elevation, the children don't.

> Live-app follow-up (device-verified): the inline `StatCell`/`StatRow`/`ActionListCard` primaries inside `DashboardClient.tsx` were left for an on-device pass — they sit inside other containers on the Coach/Me screens where nesting must be checked visually.

## Proof-by-contrast block — `SameWeekTwice` (W-04, 2026-09-21)

Two outcomes of one real prescription, side by side, on a marketing page.

- **The prescription is generated, not transcribed.** `generateRulePlan` at render time, out of a named published plan, with a link to it. The block cannot drift from the plan it cites.
- **The verdict is the product's own function.** `zoneWeekStatement()` writes those sentences inside the app; the page runs it rather than paraphrasing it. Change the product's wording and the page changes with it.
- Outcome dots: `--warn` for drifted, `--moss` for held. This is P-01's semantic pair, and a marketing page is where it has to mean the same thing it means in the app.
- Two columns on `repeat(auto-fit, minmax(min(100%, 280px), 1fr))`; stacks at 375.
- **A labelled illustration line is mandatory** where any value is not measured.

⚠️ **The rule that makes this honest, and it is Hutchinson's:** *"use real generated plans, or do not build it. The outcome half is where you will be tempted to invent numbers."* The prescription and the verdict are real. The executed heart rates are an illustration and the page says so, because with roughly three users there is no honest aggregate to quote.

⚠️ **IT MAKES NO OUTCOME CLAIM, ON PURPOSE.** It does not say the held week produces adaptation or the grey week wastes it. That is physiology, it belongs to W-03, and W-03 is with the Coaching Board. What it shows is that the app can tell the difference — a claim about the product, and demonstrably true. **Do not "strengthen" this block with a result.**

---

## Numbered journey steps — marketing (W-02, 2026-09-21)

A sequence of short steps on a marketing page. Deliberately the PLAINEST block on the page: no cards, no borders, no component stills.

- `<ol>` on `repeat(auto-fit, minmax(min(100%, 240px), 1fr))`, 4-across at 1280 and one column at 375.
- Each step: a **moss two-digit numeral** (`01`, 13px/700, `tabular-nums`, `aria-hidden`) beside an `<h3>` (16px/600) and one sentence (14.5px, `--ink-2`).
- The numeral is decorative — it is `aria-hidden` because an ordered list already announces order to a screen reader, and "01 One session one screen" read aloud twice is noise.

**Why plain, and why this is a rule rather than a preference.** The sections either side of it on the homepage already carry the page's proof: "Three things" pairs each claim with a REAL component (§ ProductStill), and "Personalised, not generic" shows the wizard answers generating a session card. A third showcase block makes the page repetitive and the eye stops reading any of them. ⚠️ **Do not "upgrade" this to cards.** Its restraint is the design, and it is the register the SLT's recorded dissent argued for: *"a site that is a touch too plain is congruent with 'you're trying hard, that's the problem'."*

---


### ⛔ The step numeral must be PERCEIVABLE — reversed 2026-09-22

**`fill="var(--mute)"` (#6D6963, 4.80:1 on `--bg`). Never a ground token.**

🔴 **This reverses a `DESIGN-V3` decision, and the reason it was made is the reason it
was reversed.** The numerals were `fill="var(--bg-soft)"` — **1.07:1** — and the source
comment said so explicitly, adding that they were *drawn as SVG because "axe does not
evaluate SVG as text"*.

**That is not an accessibility decision. It is a decision not to be told about one.** And
it failed on its own terms: the founder, the target reader, could not see the numbers, so
the page paid up to 88px of vertical space four times for marks nobody perceived.

**Sierra's framing decided it: 01/02/03/04 is WAYFINDING.** It tells the reader this is a
sequence, there are four, and where they are in it. Either it is perceivable and does that
job, or it is deleted and the space is reclaimed. **Invisible-but-present is the worst of
both.**

| | |
|---|---|
| Threshold | **3:1** — the AA bar for graphics and large text, not 4.5:1. These are 72px glyphs |
| Chosen | `--mute`, the muted supporting-text token |
| ⚠️ Rejected | `--moss` (3.24:1) technically qualifies but carries the *"held the zone"* semantic (P-01); spending it on furniture dilutes it. `--mute-2` fails at **1.90:1** |
| ⚠️ Never | `--bg`, `--bg-soft`, `--card`, `--line` as a fill. **A ground token can never clear 3:1 on its own ground** |

**It stays SVG.** The glyph is drawn into a 120×70 viewBox and scaled to `--fs-step`, which
is a legitimate presentation choice and always was. What changed is that it is no longer a
way around the checker.

**Guarded by `lib/a11yContrast.test.ts`.** ⚠️ **That file could not previously see this
defect** — every other check in it reads TOKENS pairwise and never looks at where a token
is USED, so a ground token used as a fill passed everything. Same shape as
`--surface-moss-wash`: legal in `globals.css`, forbidden by a rule here, and the two never
met.
## Section grounds — three, and each one means something (W-08, 2026-09-21)

**The marketing site does not alternate band colours.** It has exactly three grounds and each is spent on purpose:

| Ground | Where | Why |
|---|---|---|
| `--bg` | every content section | the page. Cards in `--card` do the structural work on top of it |
| `--card` (white) | **one** section per page | a spotlight, not a rhythm |
| `--ground` (near-black) | **one** section per page, last | the close. See the receipt band below |

**What this replaced:** `--bg` alternating with `--bg-soft`, two warm tones **eight points apart**, propped up by hairline borders top and bottom. At that distance banding reads as a smudge rather than a rhythm, and the hairlines holding it together are the decorative dividers this document bans. `--bg-soft` returns to its documented job: inset areas and input fields.

**Where the white band is spent on the homepage:** *"One week, run two ways"* — the proof section.

> ⚠️ **AMENDED 2026-09-22 (Design Board, SITE-WAVE-1b-iii). This line previously read:**
> *"Probably not for you if…. Anti-qualification is the most distinctive thing on the site
> and the one thing a funded competitor will not copy."*
>
> **That was true of a page whose proof sat at 52%, and sitting two moved the proof to
> 24%. We changed the premise ourselves, two hours earlier.** Sierra's finding decided it:
> the refusal sections are the brand enjoying itself — good writing, zero transfer — while
> the proof is the only section that makes the reader better at running, and the one a
> competitor whose whole proposition is encouragement **structurally cannot print**.
>
> **The arithmetic mattered as much as the argument.** The page has exactly ONE movable
> ground change: W-09 binds the close to last, and this table permits one white spotlight.
> Spent at 63% of a 14.6-screen page it left the first two thirds one uninterrupted ground,
> which is the founder's measured complaint. **First ground change: screen 9.2 → 3.4.**
>
> The refusal keeps its content and its position; it loses the emphasis.
> Guarded by `sectionSurfaces.test.ts`.

⚠️ **A competitor teardown proposed cream/white alternation across every section, and it was rejected.** Alternation makes a ground change mean nothing; two of them mean something. Recorded so the same proposal is not re-imported from the next teardown.

---

## Dark Ground — "The receipt" band (design_handoff_v2)

**Exactly one** near-black section per marketing page. It is a **punctuation mark, not a theme** — ADR-008 (single light theme, no dark mode, no toggle) stands. A second dark section would make it a dark theme; don't.

- Surface `--ground`, text `--on-ground`, padding `112px 24px`, inner `max-width 760`, centred.
- Eyebrow (`--moss-on-ground`) → statement (italic 500, `clamp(32px,5vw,48px)`, `--on-ground`) → body (`--on-ground-2`) → light-on-dark CTA (`color:--ground` on `background:--on-ground`) → **wordmark-only sign-off** (`<Wordmark size="sm" variant="light" />`).
- **Never pair a second locked brand line** (tagline/statement) on this surface — one voice moment only (brand.md; DIV-021).
- **No device frame on `--ground`** — a `PhoneFrame` renders its screen ground dark on a dark section (undiagnosed). Keep frames on light sections.
- Home: `app/page.tsx` closing band. Reference implementation.

## Marketing device frame — `PhoneFrame` (design_handoff_v2)

`components/marketing/PhoneFrame.tsx` — a still (not a live demo) of the Today screen in a phone shell, for the marketing hero. A faithful **static** composition of the real Today anatomy (§1 SessionCard, § Session Card Layout) in Warm Slate tokens — the live screen can't mount on a public page (auth + data + client bundle). Fixed composition: 30px status bar + **700px content** + 60px nav = **790px screen** (810 outer, including the 10px frame padding). *(Corrected 2026-09-11: this doc said 654/744, which had been stale since the content box grew.)*

**The crop is STRUCTURAL, not measured.** The content box is `overflow: hidden`, so a composition that outgrows it is clipped at the fade — which is the "screen scrolls" illusion the fade already implies. This replaced a hand-measured crop that broke silently: the content div is `position: relative` and the nav is `static`, so when cards pushed content ~32px past `CONTENT_H` it painted straight OVER the nav and **the nav disappeared**. A measurement maintained by memory is not a measurement.

**`.phone-fit` is required at every mount site** (`globals.css`). The frame is a fixed 340px wide with `flexShrink: 0`, so on a 375px phone a section with the standard 24px gutter left 327px and the frame forced the whole DOCUMENT to ~388px: every page scrolled sideways and hero headlines clipped mid-word. Below 430px the wrapper takes the post-scale box (292 x 697) and the child scales from its top-left. **Note `transform` alone does not fix this** — it changes painting, not layout, so the first attempt scaled the frame and the page overflowed by exactly as much as before.

Presentational, no hooks — renders inside the server-component page. **Light sections only** (the frame renders its screen ground dark inside a `--ground` section; cause undiagnosed).

## Real app components on marketing pages — `ProductStill` (GTM-SITE-02, 2026-09-11)

**The rule: a marketing page renders the REAL component. It does not draw a picture of one.**

The homepage used to hand-write CSS imitations of app surfaces (`MockSessionCard`, `MockReflectCard`, `MockCoachNoteCard`) beside text cards describing the product. They drifted, exactly as `PhoneFrame`'s wordmark did: the coach mock painted its rail `--moss` while the real `CoachNoteBlock` uses `--warn`, so the site showed a coach note in the colour that does not mean "coach".

**Most shared components mount directly in a server-rendered marketing page.** This was wrongly believed to be impossible, and an entire backlog item sat parked on the belief. Check before assuming: of the 33 files in `components/shared/`, **16 carry no `'use client'` directive at all**, including `SessionCard`, `CoachNoteBlock`, `ZoneRings`, `ZoneBar`, `RestraintCard`, `PlanArc` and `SessionSteps`. A component only needs a wrapper if it is genuinely `'use client'` **and** takes a required function prop. (Count it with `grep -l "^'use client'"`, not `head -1`: three of the client components carry the directive below a comment block, so a first-line check undercounts them.) `SessionCard`'s `onClick` is optional; passing nothing renders the static card.

**`components/marketing/ProductStill.tsx`** is the frame they sit in: an **inset**, not a card. `--bg-soft`, one hairline, **no shadow of its own** — because `SessionCard` and `ZoneRings` bring their own white card and shadow, and wrapping those in another card is card-in-card with two stacked shadows (banned, § What Not to Build). The inset reproduces the ground the surface has in the app. Its caption names **the screen the surface actually lives on**, so check before writing one: `ZoneRings` is on **Coach**, not Today.

**Skip the frame when the section ground is already `--bg-soft`** — that IS the app's ground, and an eyebrow above the component is already the caption. Two labels on one object is a label too many.

**Sample data lives in `lib/marketing/demoSurfaces.ts`, never inline.** Markup is the thing that must not be duplicated; the data is what is left over. Keep it to ONE coherent runner: `PhoneFrame` and the homepage `SessionCard` are presented as the same person's session, so a change to one is a change to both.

**Distance strings come from `lib/format.ts`, including in hand-built stills.** ADR-015 makes it the sole owner. `formatDistance()` emits `8km`, never `8 km`. `PhoneFrame` had drifted to `8 km` in two places and it only became visible when the real card was put beside it.

**Grid gotcha.** A `subgrid` child with no `grid-template-columns` gets an implicit `auto` column that sizes to **max-content**. `SessionCard`'s detail line is `white-space: nowrap`, so the track grew to 321px inside a 272px box and the page scrolled sideways at 320px. Set `gridTemplateColumns: 'minmax(0, 1fr)'` — the grid equivalent of `min-width: 0` on a flex child.

Guarded by `lib/marketing/realComponents.test.ts`: fails if an import goes away, if an import stops being rendered, if a `function Mock*` reappears, or if either file hand-writes a distance `formatDistance()` would not emit.

## Marketing feature row (GTM-SITE-02, 2026-09-11)

A 3px rail, a name, and **one sentence on what it does for the runner**. Used on `/pricing` (both tiers), `/charity-runners` and `/about`.

```
│ Every run read back to you
│ Whether you actually held the zone, what your heart rate did, and
│ the weekly score for how disciplined the week was.
```

- Rail `3px`, `border-radius: 2px`, `align-self: stretch`. **Moss for paid/positive rows, `--line-strong` for neutral ones.**
- Name: 15-16px / 700 / `--ink`. Detail: 14-14.5px / 1.55 / `--ink-2`.
- **The sentence is not optional.** A bare list of feature nouns tells a first-timer nothing, and this audience is often a first-timer. It is the one thing competitor pricing pages do better than most.
- Deliberately NOT a card grid. Four boxed cards in a row was more card soup on pages that already had ~20 rounded rectangles; this is the same visual language as session cards (accent, not flood).

## Section title accent line (GTM-SITE-02, 2026-09-11)

`SectionTitle` takes an optional `accent`, rendering a **second line in `--moss`**.

> Every run ends up in
> **the same grey zone.**

- Borrowed from a competitor that gradients the second half of every headline. **Gradients are banned here** (CLAUDE.md), and the useful part was never the gradient, it was the RHYTHM: a coloured second line tells the eye which half of the sentence carries the argument.
- **Split on the clause that IS the argument**, never an arbitrary midpoint. A single-clause headline gets no accent rather than being forced into two.
- One moss line. Not a gradient, not a third colour.

## Two-column marketing hero (GTM-SITE-02, 2026-09-11)

Copy left, product right, at the site width; collapses to one column below ~420px where copy leads and the device follows.

- `repeat(auto-fit, minmax(min(100%, 420px), 1fr))`. The `min(100%, …)` is load-bearing: without it the column floors at 420px and overflows a phone.
- **Left-aligned**, per "left-aligned content with a consistent horizontal margin, never centred-only layouts". The homepage's previous centring was never a reviewed decision.
- Hero type drops to `clamp(34px, 3.6vw, 52px)`. `design_handoff_v2` raised it to 68px for a FULL-WIDTH hero; in a half-width column that reads cramped rather than confident.
- **Why it exists:** the device shot sat two sections down, so a first-time visitor read a headline, a paragraph, a price and a hardware caveat before seeing evidence the software exists.

## FAQ disclosure (design_handoff_v2)

Native `<details>`/`<summary>` — zero-JS, server-rendered, keyboard-accessible; no new interaction model. Marker reset lives in `globals.css` (`summary::-webkit-details-marker`); the `+` affordance rotates to `×` on open. Dry brand voice, prices from `PRICING`.

---

## Component Patterns

### 1. SessionCard

Four states: `future` (default), `current`, `done`, `skipped`.

**Visual anatomy:**

```
┌─────────────────────────────────────────────┐
│ ▌  Easy Run                         10.0km  │
│    Zone 2 · ≤145bpm                  60min  │
└─────────────────────────────────────────────┘
```

**Structure:**
- **Left accent**: 3px solid vertical bar, `getSessionColor(session)` from `lib/session-types.ts` — sole owner. **Pass the SESSION, not a bare type** (PLAN-LONGRUN-COLOUR-01, 2026-09-12): the engine models a long run as `type: 'easy'`, so a type alone cannot pick the accent and `--s-long` was unreachable for every engine-generated plan. The owner resolves it through `isLongRun`, which reads the stamped `role` — never the display label, which the AI enricher rewrites (D-17). A bare string is still accepted for call sites that genuinely hold only a type; those cannot detect a long run, by construction. This doc named `getSessionColor` the sole owner while `PlanCalendar` indexed `SESSION_COLORS` directly — a documented claim with no mechanism behind it, now true.
- **Name**: 15px 600 `--ink` (future/current), `--mute` (done)
- **Detail**: 12px 400 `--mute`, hidden when skipped
- **Right distance**: 17px 700 tabular-nums `--ink` (future), 14px 600 `--mute` (done)
- **Right duration**: 11px 400 `--mute-2` below distance
- **Tap target**: full card width, min-height `64px`
- **Radius**: `var(--radius-md)`

**State rules:**

| State | Background | Border | Accent | Name colour |
|---|---|---|---|---|
| `future` | `--card` | `1px solid --line` | Full opacity | `--ink` |
| `current` | `--card` | `1px solid --line-strong` | Full opacity | `--ink` |
| `done` | `transparent` | none | 0.3 opacity | `--mute` + moss check circle |
| `skipped` | `transparent` | `1px dashed --line-strong` | 0.2 opacity | `--danger` strikethrough |

Done state: 16px moss check circle (--moss-soft bg, --moss stroke), name in `--mute`, "via Strava · {activityName}" in 11px `--strava` at 0.75 opacity.

Skipped state: "Skipped" label 11px 500 `--danger` right side, name struck through.

Reference: `components/shared/SessionCard.tsx`

---

### 2. Session Card (Expanded / Session Detail)

Full screen. Back arrow top-left. Session opens into a dedicated screen — not an in-place expand.

```
[←]

[Day · Week eyebrow]       ← 10px 600 --mute uppercase
[Session title]            ← 16px 700 --ink
[Type chip right]          ← 10px 700, coloured bg at 15% opacity

┌─────────────────────────────┐
│ ▌  [HR target] · [Zone]    │  ← metric row
│    [Distance] · [Duration]  │
│ ─────────────────────────── │
│  [Session description]      │  ← 14px 400 --ink-2
└─────────────────────────────┘

[RPEScale]                 ← if session complete
[CoachNoteBlock]           ← label "HOW TO RUN IT"  (only when session.run_walk_strategy)
[CoachNoteBlock]           ← variant="why", label "WHY THIS SESSION"
```

Zone order (canonical, INV-UI-005):
1. Run type · Zone · HR target · Pace bracket · Distance + duration
2. Session description
3. **How to run it** — the §117 run-walk interval, when the session carries one
4. Why / coach notes

**"HOW TO RUN IT" — the run-walk prescription (RUNWALK-VISIBLE-01, 2026-09-23).** Renders
`session.run_walk_strategy` through the existing `CoachNoteBlock` (default variant, the `--warn-bg`
contextual surface). **No new pattern and no new component** — which is why this shipped without a
Design Board sitting.

- **Above "WHY THIS SESSION", deliberately.** It is an INSTRUCTION, not a rationale, and the zone
  order above puts the prescription before the why. The block below it makes exactly that argument
  about its own placement.
- **No `<AIMark />`.** `runWalkStrategy()` is rule-engine copy from §117, not model output.
- 🔴 **WHY IT EXISTS: the field was written for three days and rendered NOWHERE.** `applyRunWalk`
  stamped `run_walk_strategy` onto every running session of a finish-goal plan from 2026-09-20;
  **zero files under `app/` or `components/` read it, and `git log -S` found zero commits ever.**
  `INV-PLAN-RUNWALK-PRESCRIBED` was green throughout, because it asserts the stamp is in the plan
  JSON and **cannot see a screen**. §117 Am.3's entire safety argument is that the walk break is
  PRESCRIBED — McMillan: *"'run 40 minutes, walk if you need to' is a **dare**. '6 minutes running,
  1 minute walking, ten times' is a **session**."* **We were shipping the dare.**
- **Gated by `lib/plan/prescribedFieldsRendered.test.ts`**: every engine-written session field must
  have a UI reader, and every RESERVED field must still have NO producer. ⚠️ Comments are stripped
  before scanning, because the first cut of that gate was satisfied by **this block's own comment**.

Reference: `DashboardClient.tsx` → `SessionPopupInner`

---

### 3. Week Strip (Planzy-style)

Horizontal day selector. Compact. Always visible above session list.

```
  Mo  Tu  We  Th  Fr  Sa  Su
  ●   ○   ─   ●   ○   ○   ─
```

- Day label: 3-letter abbreviation, `0.6875rem`, `--mute`
- Indicator dot:
  - `●` filled `--moss` — today with session
  - `●` filled `--mute` — has session, not today
  - `○` outlined — has session, future
  - `─` dash — rest/empty
  - `✓` checkmark (`--moss`) — completed
- Active day: moss dot + day label in `--moss`
- Scroll horizontally if multi-week view needed
- Min tap target per day: `44px` wide (iOS HIG)

---

### 4. Stat Row

3–4 metric pairs in a horizontal row. Used in weekly summary, plan overview.

```
┌──────────┬──────────┬──────────┬──────────┐
│  42.3    │  5h 20m  │   84%    │   8/12   │
│  km      │  total   │  zone 2  │  done    │
└──────────┴──────────┴──────────┴──────────┘
```

- Equal-width columns, `flex: 1`
- Value: Inter 700, `1.5rem`, tabular-nums
- Label: Inter 400, `0.75rem`, `--mute`
- Dividers: `1px solid --line` between columns (not around)
- Background: `--card`

---

### 5. Section Header

```
Week 14  ·  Apr 14–20          62km planned
```

- Left: Inter 700, 13px, week number + date range — `--ink`
- Right: planned volume, `--mute` weight
- No background, no box
- Margin above: `32px`, margin below: `8px`

---

### 6. Session Type Chip

Small pill label. Used in session detail eyebrow.

```
[ EASY ]  [ LONG ]  [ TEMPO ]
```

- Font: Inter 700, `10px`, uppercase, `letter-spacing: 0.08em`
- Padding: `3px 8px`
- Background: session colour at `15% opacity`
- Text: session colour
- Radius: `4px`
- Never use full solid background

---

### 6b. Marketing Site Chrome — `SiteHeader` / `SiteFooter` (GTM-SITE-01, 2026-09-10)

> **Amended 2026-09-11 (GTM-SITE-02) — three nav items, and the header MUST wrap on a phone.**
>
> Nav is now **Plans · Pricing · Comparisons**. The third item was added on the original two-item ruling's own reasoning rather than against it: the menu exists for sections people cannot otherwise find, and there was no pricing page at all, which the SLT called a commercial defect.
>
> **It does not fit a phone on one row, and that is a measured fact, not a worry.** At 375px the row came to 433px (wordmark 60 + Plans 37 + Pricing 47 + Comparisons 90 + the 104px CTA pill, plus gaps), so the whole DOCUMENT was 433 wide and every page scrolled sideways. It was already within a few pixels of overflowing with TWO items.
>
> Below 430px the links therefore wrap to their own row under the wordmark, and that row wraps again so the CTA drops to a third line on a 320px SE. Rules live in `globals.css` (`.site-nav-row`, `.site-nav`). **Nothing is hidden and no hamburger is introduced** — chrome the design system rejects — so every destination stays one tap away at any width.
>
> **The CTA is INSIDE `.site-nav`, not a sibling of it.** Assuming otherwise cost a wrong fix: the group carries four items, so it needs `flex-wrap` too.
>
> **If a fourth nav item is ever proposed, measure first.** `/about` was deliberately put in the footer only for this reason.

> **Amended 2026-09-21 (W-01b) — the fourth item was proposed, measured and TAKEN. Nav is now Plans · Pricing · Comparisons · Guides.**
>
> Measured on the live site at both widths, which is what this rule demanded:
>
> | | header height | overflow |
> |---|---|---|
> | 1280px, 3 items | 64px | none |
> | 1280px, **4 items** | **64px — free** | none |
> | 375px, 3 items | 100px (2 rows) | none |
> | 375px, **4 items** | **141px (3 rows), +41px** | none |
>
> ⚠️ **Shortening "Comparisons" to "Compare" was measured too and saves NOTHING** — still 141px. The row is the cost and there is no clever way around it.
>
> **Taken on this section's own test:** *"the menu exists for sections people cannot otherwise find."* Guides was reachable only from the footer while Comparisons, the same class of section with two articles, sat in the nav. That was an inconsistency rather than a decision, and it surfaced because the founder asked how anyone was supposed to find the guides.
>
> ⚠️ **A FIFTH costs a FOURTH ROW, not a wrap.** Measure again, and treat 375px as the binding width.
>
> **Also added: the two content hubs cross-link.** Each was a dead end — a reader finishing the guides had no route to the comparisons and vice versa, with only the footer joining them.

**Scope: the public marketing site only** (`/`, `/plans`, plan spokes, `/comparisons`, comparison articles, `/support`, `/privacy`, `/terms`). The authenticated app keeps its own chrome (§7 bottom nav); these two never appear inside the app.

**One component each. No page hand-writes site chrome.** Before this there were five hand-written headers and four footers, plus three pages with neither:

| page | wordmark | linked to `/` | width | right side |
|---|---|---|---|---|
| `/` | 20px | **no** | 1100 | Free plans, Comparisons |
| `/plans` | **32px** | yes | 760 | Get the app |
| `/compare` | **32px** | yes | 760 | Get the app |
| plan spokes | **32px** | yes | 760 | Plans, Get the app |
| articles | **32px** | yes | 760 | Get the app |
| support / privacy / terms | 20px | yes | — | "← Back", **no nav, no footer** |

The wordmark changed size as you navigated (20 → 32 → 20), the homepage wordmark was not a link, and the legal pages were dead ends with no route back into the site.

**Header anatomy**
- Wordmark `sm` (**20px**) everywhere. That is the documented header step in `Wordmark.tsx`. One size, no callsite override.
- Always linked to `/`, always left. Nav + CTA always right.
- Nav is exactly **two** items — Plans, Comparisons. It exists because there are two content sections users cannot otherwise find, not because sites have menus.
- Current section marked with `--moss` + weight 700 and `aria-current="page"`. Never a box or pill.
- One button in the chrome: the App Store CTA, a compact `--moss` pill. It is the only colour in the header.
- `position: sticky` + a single hairline `--line` bottom border.

**"Pop" means presence, not decoration.** The header is sticky so it never leaves, carries one point of moss, and marks where you are. **No shadow, no gradient, no motion, no scroll listener, no client JS** — the header is a server component and active state is a prop, not `usePathname`. (SLT review, Wood: *a sticky header is structural, an animated one is decorative*.)

**ONE width everywhere — `SITE_WIDTH`, a constant, not a prop.**

The first version took a `width` prop so the header matched its page's CONTENT width (1100 homepage, 760 elsewhere), on the reasoning that a narrow header over wide content looks wrong. **That reasoning did not survive contact with the actual site.** Walking from `/` to `/plans`, the whole bar snapped narrower — consistent layout with an inconsistent span still reads as broken, and it was the first thing the founder noticed after the rebuild.

The header frame is now constant; the CONTENT column stays whatever each page needs (760 for reading measure on articles, 1100 on the homepage). That is the ordinary site-frame pattern: chrome is site-level, the text column is content-level, and they are allowed to differ. It is a **constant rather than a defaulted prop** specifically so no call site can reintroduce the drift.

**Footer anatomy** *(amended W-10, 2026-09-21 — GROUPED)*
- **Four columns: Train · Read · Company · Get {BRAND.name}**, on `repeat(auto-fit, minmax(min(100%, 150px), 1fr))`, which gives 4 across at 1280 and a 2×2 on a 375 phone. Column headings are the canonical section label (11px, 700, uppercase, **0.08em**, `--mute`).
- **The App Store badge has a home** in the fourth column. It renders nothing until the App Store URL exists, so that column is simply absent pre-approval rather than a gap.
- Copyright sits last, under its own hairline.
- ⚠️ **The link set, the labels and the order are UNCHANGED** — only the arrangement is. Nine links in one undifferentiated 13px row gave the last thing every visitor sees no structure, and "Charity runners" sat between "Comparisons" and "Support" as though a peer of both.
- 🔴 **It is NOT a dark footer, and that is a rule rather than a preference.** See § Dark Ground: exactly one near-black section per page (ADR-008). The competitor this work came from closes on **two** dark bands; we close on one, and the footer's job is to be quiet underneath it. **Weight comes from structure, not darkness.**
- **No brand statement.** The footer is navigation and legal only. Putting `BRAND.brandStatement` in SHARED chrome rendered it on all 8 pages and duplicated it on two of them (the homepage already ends on a designed 48px closing moment; `/privacy` already carries its own quiet 10px line). That is DIV-020's "over-use degrades the asset" at site scale. The voice moment is a deliberate page-level placement, never chrome.
- **One link set, one order, one label per destination**: Home · Plans · Comparisons · Support · Privacy · Terms. The current page stays in the list — omitting the self-link is what made every footer subtly different.
- Copyright line last.

**Never** re-declare a header or footer inside a marketing page. If a page needs something extra (the homepage founder note), it goes in a section **above** `SiteFooter`, not inside a bespoke copy of it.

---

### 7. Navigation Bar (Bottom)

Minimal. 4–5 tabs max.

- Background: `--card` with `border-top: 1px solid --line`
- Active icon + label: `--moss`
- Inactive: `--mute`
- Label: `0.6875rem`, always visible (no icon-only nav)
- Height: `60px` + safe area inset

---

### 8. Empty State

```
        ○

   Nothing here yet.
   Your plan sessions will
   appear once loaded.
```

- Centered vertically in available space
- Heading: Inter 600, `1rem`, `--ink`
- Body: Inter 400, `0.875rem`, `--mute`
- No button unless there's a specific action available

---

### 9. CoachNoteBlock

Warm amber block for all coach voice content. Used in TodayScreen and Session Detail.

```
┌─────────────────────────────────────────────┐
│  COACH          [timestamp optional]        │
│                                             │
│  Keep it easy. Nose breathing the whole     │
│  way. If you can't talk, slow down.         │
└─────────────────────────────────────────────┘
```

**Structure:**
- Background: `--warn-bg`
- Radius: `14px`, padding: `16px 18px` (extra `8px` left padding when `aiGenerated`, to clear the rail)
- Eyebrow row:
  - When `aiGenerated`: a `<CoachByline color="warn" />` (Pattern 16b) — the byline carries authorship
  - Otherwise: `10px 700 --warn uppercase 0.14em tracking` label, optional timestamp suffix (`10px 400 --warn 0.65 opacity`)
- AI-provenance rail: a 3px `--warn` left rail at `left: 8px` when `aiGenerated` (matches the AI-card pattern)
- Body: `14px 400 --coach-ink` (default) or `13px 400 --coach-ink` (why variant)

**Props:**
```tsx
label?: string          // default "COACH" (only used when !aiGenerated)
timestamp?: string      // optional "6:12am"
children: React.ReactNode
variant?: 'default' | 'why'
aiGenerated?: boolean   // shows CoachByline + 3px warn rail when true
onChipClick?: () => void // when aiGenerated, makes the byline tap → Coach
```

**Variant rules:**
- `default` — used for plan-level coaching notes in TodayScreen, slightly larger body
- `why` — used in Session Detail "WHY THIS SESSION" section, slightly smaller body text

Reference: `components/shared/CoachNoteBlock.tsx`

---

### 10. PendingAdjustmentBanner

Inline banner for plan adjustments awaiting user confirmation. Appears above coach note on TodayScreen.

```
┌─────────────────────────────────────────────┐
│  [byline] PLAN ADJUSTED                     │
│                                             │
│  Pulled this week's long run back to        │
│  match where you're actually finishing.     │
│  ─────────────────────────────────────────  │
│  TUE  rest      →  long 24km                │
│  SUN  long 24km →  rest                     │
│                                             │
│  [  Confirm  ]  [Revert]                    │
└─────────────────────────────────────────────┘
```

**Layering doctrine (RESHAPE-FIX-WAVE2A, 2026-06-26):**
- Prose (the **WHY**) is AI-generated and carries the CoachByline + AIMark provenance signal at the top.
- Diff strip (the **WHAT**) is rule-engine output — deterministic per-day before/after — and **never** carries AIMark. Mixing provenance on the same card would teach users to ignore the mark.
- The 2026-06-26 incident root cause was a runner unable to see what Confirm would do — only an AI summary that lied ("the 24km run stays intact" while it moved). The diff strip is the safety net: even if the prose drifts, the user sees the structural truth.

**Structure:**
- Background: `--warn-bg`
- Radius: `14px`, padding: `14px 16px`
- Eyebrow: `CoachByline color="warn"` (replaces the pre-AI-VIS-01 "!" alert circle)
- Body prose: `13px 400 --coach-ink`, line-height 1.55
- Diff strip (new, optional):
  - Separator: `1px solid rgba(61,38,0,0.12)` top border, `12px` padding-top
  - Day label: `10px 600 --coach-ink uppercase 0.04em`, min-width `32px`
  - Before label: `12px 400 --mute`, `line-through` (rgba(61,38,0,0.35) decoration)
  - Arrow: `→` `--mute`
  - After label: `12px 600 --warn`
- Button row: flex gap `8px`, margin-top `14px`
  - Confirm: `--warn` background, `--card` text, `100px` radius pill, `36px` height, `13px 600`
  - Revert: transparent bg, `rgba(61,38,0,0.2)` border, `--coach-ink` text

**Props:**
```tsx
title?: string                                      // default "Plan adjusted"
children: React.ReactNode                           // AI prose (WHY)
onConfirm?: () => void                              // omit for informational adjustments
onRevert: () => void
loading?: boolean
sessionsBefore?: ReadonlyArray<SessionLike | null>  // RESHAPE-FIX-WAVE2A — diff strip
sessionsAfter?:  ReadonlyArray<SessionLike | null>  //   omit to keep prose-only behaviour
```

**Hidden when empty:** `<AdjustmentDiff />` returns `null` when there are no non-unchanged days. Coaching-note-only adjustments (e.g. zone reminders) render prose without the strip — appropriate; there's nothing structural to show.

**AI prompt contract (linked):** the prompt builder in `lib/coaching/prompts/planAdjustment.ts` now feeds the model the explicit diff and forbids enumerating it — the model writes the WHY, never the WHAT. The runtime validator `lib/coaching/diff/validateAiSummary.ts` rejects AI output that contradicts the diff (stability claims about changed sessions, invented moves) and falls back to the rule-engine summary. Two layers of defence against the 2026-06-26 failure mode.

Reference: `components/shared/PendingAdjustmentBanner.tsx`, `components/shared/AdjustmentDiff.tsx`  
Integration: `DashboardClient.tsx` → `AdjustmentBanner` wrapper (owns API calls)  
Diff utility: `lib/coaching/diff/sessionDiff.ts` (pure)  
Summary validator: `lib/coaching/diff/validateAiSummary.ts` (pure)

---

### 10b. Move-confirmation row (PlanCalendar)

Inline row appended to a `WeekCard` after the user taps the move icon on a session and then taps a destination day. Stages the move; the actual `session_overrides` insert + `/api/adjust-plan` call only fire on **Confirm**. **Cancel** aborts with no DB side-effect.

```
┌─────────────────────────────────────────────┐
│  Move Long run from Sun to Thu?             │
│  Easy 8km swaps to Sun.                     │
│                                             │
│  [ Cancel ]  [   Move it   ]                │
└─────────────────────────────────────────────┘
```

**Why this pattern:** the 2026-06-26 reshape incident root cause was a runner who didn't realise the tap-to-move UI had structural consequences. The override + AI summary fell on his taper before he could see what had happened. This row makes the move legible before it writes. Inline (not popup, not modal — per § "No popups" rule in CLAUDE.md).

**Structure:**
- Container: padding `12px 14px 14px`, background `--warn-soft` (with `--moss-soft` fallback), border-top `1px solid --line`
- Body: `12px 400 --ink`, line-height 1.4. Source label + source day + target day are bolded. Swap call-out below in `--ink-2` at `11px`.
- Button row: flex gap `8px`
  - Cancel: `flex: 1`, transparent bg, `1px solid --line`, `--mute` text, `11px 400` uppercase `0.06em`
  - Confirm: `flex: 2`, `--moss` bg, `--card` text, `11px 600` uppercase `0.06em`. Label: "Move it" or "Swap them" depending on `isSwap`

**Voice rule:** copy describes the move in concrete terms — *what* moves, *from* where, *to* where. Never abstract ("apply change"). Never invents structure not in the diff. Aligns with brand voice — *honest, slightly sarcastic, self-aware, encouraging without cringe*.

**Move-icon affordance:** the trigger button on each `DayRow` is a moss-soft pill containing `↕ Move`, not a hamburger. The pre-fix 3-line hamburger at 0.45 opacity read as "more options"; the explicit glyph + label removes the ambiguity that caused the incident.

Reference: `components/training/PlanCalendar.tsx → WeekCard`  
Integration: `PlanScreen` → `PlanCalendar` (owns the `onMove` / `onSwap` callbacks that write `session_overrides`)

**Future:** when RESHAPE-FIX-WAVE2A ships, the `<AdjustmentDiff />` component will replace the prose body above — same Confirm/Cancel mechanism, richer per-day before/after view. The button row stays. See backlog → RESHAPE-FIX-WAVE2A.

---

### 10c. Applied-change audit row (Me screen)

Read-only variant of the adjustment card, in the Me → **Plan adjustments** card under a **"Changed this week"** sub-label. Lists sub-threshold changes the engine auto-applied *without asking* (§69) over the last 14 days — Wood's honest-absorption surface. No Confirm/Reject (it already happened); a single dry **"Got it"** dismiss per row, persisted in `localStorage` (`zonna_dismissed_changes`, keyed by adjustment id — the MAINT-01 dismissable-card precedent, no migration).

```
CHANGED THIS WEEK
Eased Thursday's tempo — your last two ran hot.
  Thu   Tempo 8km  →  Easy 6km
  Got it
```

**Structure:**
- Sub-label: `11px 700 --mute`, uppercase, `0.06em` — mirrors the "Last checked" label in the same card.
- Summary prose: `13px 400 --ink`, line-height 1.45. Factual record line — **no `<AIMark />`** (same provenance stance as the "Plan tweaked" line above it; the deterministic WHAT is the diff below).
- `<AdjustmentDiff />` (Pattern 10a) for the per-day before→after — rule-engine, no AIMark.
- Dismiss: `12px 600 --mute` text button, no chrome.

**Provenance:** never mix the AIMark onto the diff. The whole row reads as a factual audit record, not a coaching moment. **Tier: PAID** (lives in the paid-gated Plan-adjustments section). Empty state: the block is simply absent when there are no undismissed recent changes.

**Pairs with** the NOTIF quietness rule (RESHAPE-FIX-WAVE3-PHASE2): auto-applies no longer push, so this passive surface + the inbox row are how a silent change stays discoverable.

---

### 11. RestraintCard

The brand's counter-intuitive moment — showing restraint as progress. **Status (ZONE-VIS-02 — May 2026):** the discipline NUMBER moved off Today and now lives on Coach. Today retains the discipline RHETORIC as a single-line moss voice anchor ("Hold the zone.") — see § Voice Anchor Strip below — while the full retrospective metric belongs where retrospection happens. The RestraintCard component itself is not currently rendered; the LedgerCard (LEDGER-01) borrows its visual anatomy, and the share OG card (`app/api/og/weekly-zone-card/route.tsx`) borrows its hierarchy. The component is preserved for those echoes and for any future surface that wants the full card form.

The original "permanent slot on Today / never silently hidden" doctrine is **superseded**. The Coach screen's 2×2 stat grid already includes a Zone Discipline tile (`%` + verdict sub) plus the ZoneRings component (Pattern 22) for the per-zone breakdown — the metric is now MORE visible on Coach than it was on Today, just gated to the right screen for its job.

**Live (paid/trial + ≥1 analysed run):**

```
┌─────────────────────────────────────────────┐
│  ZONE DISCIPLINE            across 3 runs   │
│                                             │
│  84%                                        │
│                                             │
│  of your time was spent in Zone 2.          │
│  Easy was easy. That's the work.            │
└─────────────────────────────────────────────┘
```

**Pending (paid/trial pre-data):**

```
┌─────────────────────────────────────────────┐
│  ZONE DISCIPLINE                            │
│                                             │
│  —%                       (muted)           │
│                                             │
│  Your first score lands after a couple of   │
│  analysed runs. Kit's watching.             │
└─────────────────────────────────────────────┘
```

**Locked (free user):**

```
┌─────────────────────────────────────────────┐
│  ZONE DISCIPLINE             (--bg-soft)    │
│                                             │
│  —%                       (muted, 0.4 op)   │
│                                             │
│  The score that names the medium-hard       │
│  middle. Connect Strava and upgrade to      │
│  start scoring.                             │
│                                             │
│  Unlock score →           (moss text link)  │
└─────────────────────────────────────────────┘
```

**Structure (live + pending):**
- Background: `--card`, border: `1px solid --line`, radius: `var(--radius-lg)`, padding: `20px`
- Eyebrow row: `10px 700 --mute uppercase 0.08em tracking` left, meta `10px 400 --mute-2` right (live only)
- Percent: `44px 800 tabular-nums -1.5px tracking` — `--ink` (live) or `--mute` 0.5 opacity (pending)
- Pct sign: `22px 600` — `--moss` (live) or `--mute` 0.5 opacity (pending)
- Body: `13px 400 --ink-2`, line-height 1.45 — supports `<strong>` for `--ink 600` emphasis

**Structure (locked):**
- Background: `--bg-soft` (signals locked), border + radius + padding as above
- Eyebrow row: same as live (no meta)
- Percent + pct sign: muted `—%` at 0.4 opacity (matches `RestraintCardSkeleton`)
- Body: `13px 400 --mute`, line-height 1.55
- CTA: `12px 600 --moss` text button "Unlock score →" — no background, no border, single tap target

**Data source:**
- Live percent is **HR-derived** from `run_analysis.hr_in_zone_pct` across the week's completed analysed runs — paid feature (requires Strava + run analysis pipeline).
- Pending state is reached when the paid feature is on but the user has no analysed runs yet (early trial, no Strava connected, or zero completions).
- Locked state is reached when the user is on the free tier.

**Props (discriminated union):**
```tsx
// Live (default — state omitted ⇒ live)
{ state?: 'live'; label?: string; percent: number; meta?: string; body: React.ReactNode }
// Pending
{ state: 'pending'; label?: string }
// Locked
{ state: 'locked'; label?: string; onUpgrade?: () => void }
```

`label` defaults to `'Zone discipline'` across all states.

**Tier-divergent rules:** The Today-screen wrapper picks state from `hasPaidAccess` and `zoneDisciplinePercent`:
- `!hasPaidAccess` → `locked`
- `!runAnalysisReady && completedThisWeek.length > 0 && zoneDisciplinePercent === null` → `RestraintCardSkeleton` (existing loading shell)
- `zoneDisciplinePercent === null` → `pending`
- otherwise → `live`

Tier prop travels from `DashboardClient` → `TodayScreen` → the wrapper around `RestraintCard`. RestraintCard itself is data-driven by `state` — no tier logic inside the component.

⚠️ **THE COMPONENT IS DELETED (P-10, 2026-09-20). THE PATTERN IS NOT.**
The component file had **zero render sites** — ZONE-VIS-02 superseded its
"permanent slot on Today" doctrine in May 2026 and the Coach 2×2 took over the number, so the file
sat unreachable for months while this section still pointed at it. Deleted rather than revived: a
documented component nobody renders is a pattern reference that silently becomes a lie, and the
cold-start defect it carried (`0 of N sessions complete · 0%`) was a bug in code no runner could
reach.

**The anatomy is still canonical and still in use** — the live / pending / locked triad is reused
by the Coach 2×2 and by `ZoneWeekBlock` (P-04), whose locked state follows this section's locked
copy shape deliberately rather than inventing one.

Reference: the pattern lives here; implementations are `DashboardClient.tsx` → Coach 2×2 stat grid
and `components/shared/ZoneWeekBlock.tsx` (ZONE-VIS-01 block).

---

### 12. PlanArc

The plan's **shape**, one bar per week. Height is the week's training volume; colour is when that week falls; a rail beneath names the phases at the widths they actually occupy.

```
WK 6 OF 16
      ▄▆█▄█▇█▅███▇▆▄▂▁          ← height = trainingKm; notches are deloads
────────────────────────        ← 1px axis
          ▀                     ← 2px moss tick = you are here
▬▬▬▬▬ ▬▬▬▬▬▬ ▬▬▬ ▬▬▬            ← phase rail, flexed by week count
BASE  BUILD  PEAK TAPER
```

> 🔴 **IT USED TO DRAW A STRAIGHT LINE, AND THIS DOC DOCUMENTED THE CONTRADICTION (PLAN-ARC-V2, 2026-09-21).** Every bar rendered at `height: 100%`, so week 1, peak week and the deload were identical rectangles. The strip set `align-items: flex-end` — a property that can only matter if something is SHORTER than full height — and **this section listed both halves**, "bars `align-items: flex-end`" and "each bar: `100%` height", without noticing they cannot both be doing anything. The shape was intended and never wired: the same declared-but-inert class as `--s-long`, D9's `flexShrink` and the decorative-config family. Sixteen identical blocks is a picture of sixteen identical weeks of effort, which is the grey middle drawn in moss.

> 🔴 **THE DOWN-WEEKS ARE THE MESSAGE** (SLT 2026-09-21, Sutherland). Nobody reads a sawtooth as a trend line; they read the teeth. Deload notches and the taper are the app visibly making the runner do less on a schedule they did not choose. **Any change that smooths, averages, or de-emphasises the dips is working against the reason the component exists.**

> 🔴 **SHAPE, NEVER COMPLETION** (SLT 2026-09-21, Wood — binding, and she holds the kill mandate). **No cumulative total. No "N% through your plan". No emphasis on the peak week.** The moment a number aggregates this becomes a progress bar, which is the illusion-of-progress class. It was allowed on the strength of ANTICIPATION — a deload notch visible three weeks out is an advance commitment device, so taking the easy week costs no willpower on the day — and that mechanism dies the moment the object becomes a score. Enforced by `lib/plan/planArc.test.ts`, falsified against a full-height bar, a `reduce`, an `isPeak` branch and a hardcoded hex.

**Structure:**
- Label row: one left-aligned `10px 700 --mute uppercase 0.08em` line, `Wk N of M`. ⚠️ It used to be a two-up row with the phase chain on the left; removing the chain left `16 weeks` facing `Wk 6 of 16`, **the same number twice**, so the row collapsed to one label. Only removing the chain made the duplication visible.
- Ridge: `36px`, flex, `2px` gap, `align-items: flex-end` (which now means something).
- Each bar: `flex: 1`, `height = max(6px, km / peak × 36px)`, radius `2px 2px 0 0` — **top corners only**, because a ridge stands on its axis and rounding the bottom makes the bars float off it.
- Axis: continuous `1px --line`.
- Current-week tick: a `2px` row below the axis, `--moss` under the current week only, transparent elsewhere.
- Phase rail: `3px` bars, radius `2px`, `2px` gap, `6px` above; each segment `flex: <week count>` so it lines up with the ridge. Labels `10px 700 uppercase 0.06em`, `4px` below, ellipsised.

**Why the floor is 6px and ABSOLUTE, not a percentage:** at a 2px radius a bar needs roughly that much height to read as a bar rather than a dash, and the strip doubles as a week counter — a bar that vanishes breaks the reader's ability to count along to "where am I".

**Why race week is not special-cased:** it draws at its true TRAINING height in `--s-race`. A full-height "finish post" is Wood's prohibited peak-celebration in a different costume, and the honest fact is that you barely train that week.

> **Presentation — PlanArc is a full-width component; the SCREEN owns the margin (2026-09-13).** It carries no horizontal padding of its own, so the caller must inset it to the screen's content margin (`padding: '0 16px'` on PlanScreen). Rendered flush it runs edge-to-edge and reads as "the progress runs off the page." Do not render PlanArc without the 16px wrap.

> **Not tappable (2026-09-12, UX-COACH-01).** Race Projections moved to Coach. Do not re-attach a sheet to it.

**Bar colour:**

| State | Colour | Opacity |
|---|---|---|
| Done | `--moss` | 0.55 |
| Current | `--moss` | 1.0 |
| Race week | `--s-race` | 1.0 |
| Future | `--mute-2` | 1.0 |

⚠️ **There is no deload colour, and its absence is the design.** Height already says "less", which is what a deload IS; a second opacity encoding would make the notch fainter exactly where it matters most. `deloadWeeks` was **removed** rather than restyled, and `deloadWeekNumbers` in DashboardClient went with it rather than sitting unread. The explanation lives on the week card in `PlanCalendar`, which already renders the deload theme text. One job per component.

⚠️ **Future bars are `--mute-2` at FULL opacity** (≈2.16:1 on white), up from 0.35 (≈1.3:1). They have to be visible: the shape of what is *coming* is the anticipation mechanism the component was approved on. The information is carried by height and position, not by colour alone, so this is not a 1.4.11 case — but do not dim them further.

**Phase rail colour:**

| Segment | Rail | Label |
|---|---|---|
| Past | `--moss` @ 0.45 | `--mute` |
| Current | `--moss` | `--moss` |
| Future | `--line-strong` | `--mute` |

The rail hides entirely when no week carries a phase — an empty rail with blank labels is worse than no rail.

**Props:**
```tsx
totalWeeks: number
currentWeek: number          // 1-indexed
doneWeeks: number            // weeks before currentWeek that are done
weekKm: number[]             // REQUIRED. lib/plan/weekVolume.ts -> planArcSeries()
weekPhase: (string | null)[] // REQUIRED. display labels, via phaseDisplayLabel()
raceWeek?: number            // 1-indexed
```

⚠️ **`weekKm` is required, and the bars map over IT rather than over `totalWeeks`.** With two callers an optional prop is a dead branch, and a silent flat fallback is how the component came to lie about its own name. Mapping over the array means a length mismatch is visible rather than padded away with `?? 0` — which would assert "this week covered no ground", the documented wrong answer for a duration-anchored session.

⚠️ **`trainingKm`, not `weekly_km`.** `weekly_km` includes the race, so a height-encoded race week would draw as the tallest bar of the taper. `lib/plan/weekVolume.ts` exists for exactly this distinction.

**Known limit:** a one-week phase inside a long plan gives its rail segment ~15px, and the label ellipsises to something like `P…`. It degrades without breaking; measuring text to hide the label instead was judged not worth a client-side measurement loop for a rare case. See the `/plan-arc-preview` fixture.

**Fixture:** `/plan-arc-preview` renders every state — four real generated plans (12/14/16/18 weeks) plus week 1, race week, no phases, ADR-013 maintenance keys, a one-week phase and a flat plan. Production-gated with `notFound()`. It began as the four-candidate comparison the SLT judged; **phase-track-only (no per-week marks) was killed permanently** as reassurance furniture that restates the label row and discards the deloads, the taper and the shape.

Reference: `components/shared/PlanArc.tsx`

---

### 13. RPEScale

10-square filling effort selector. Used in post-session logging flow.

```
Effort (RPE)                      4 / 10
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│1 │2 │3 │4 │5 │6 │7 │8 │9 │10│
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
  ████ selected
```

**Structure:**
- Label row: `13px 600 --ink` "Effort (RPE)" + value display flex-between
  - Value set: `18px 800 --ink` number + `13px 500 --mute-2` "/ 10"
  - Value unset: `13px 400 --mute-2` "— / 10"
- Optional hint: `12px 400 --mute`, line-height 1.4, margin-bottom 10px
- Square row: 10 buttons, `flex: 1` each, `aspect-ratio: 1`, `6px` radius, `3px` gap

**Square state rules:**

| State | Background | Text | Border |
|---|---|---|---|
| Default (n > value) | `--bg-soft` | `--mute` | none |
| Filled (n < value) | `--ink` | `--bg` | none |
| Selected (n === value) | `--moss` | `--card` | `2px solid --moss-mid` |

**Props:**
```tsx
value: number | null
onChange: (value: number) => void
hint?: React.ReactNode
```

Reference: `components/shared/RPEScale.tsx`

---

### 14. Post-Log Reflect Sheet

Used after any session is logged or skipped. Highest-emotion moment — treat it as such.

```
┌─────────────────────────────────────────────┐
│ [✓]  Hard session logged.                   │
│      Don't follow it with more effort.      │
│ ─────────────────────────────────────────── │
│  How did that land?                         │
│  Effort and body state. That's all I need.  │
│                                             │
│  [RPEScale]                                 │
│                                             │
│  Body state                                 │
│  [Fresh] [Fine] [Heavy] [Wrecked]           │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ Hard session in the bank. Earn rest. │   │  ← fades in
│  └──────────────────────────────────────┘   │
│                                             │
│  [           DONE           ]               │  ← moss when response shown
└─────────────────────────────────────────────┘
```

Rules:
- Completion confirmation always shown at top
- RPEScale component used for effort input
- Zonna voice response fades in (`opacity 0→1`, `translateY(6px)→0`, 350ms) after any selection
- CTA shifts ghost → solid `--moss` once response appears
- Skip always available — run is already saved
- Never auto-dismiss

Zonna voice rules:
- One sentence only
- Session-type-aware: RPE 8 on easy = flag it; RPE 8 on intervals = endorse it
- Canonical response matrix: `getReflectResponse()` in `DashboardClient.tsx`

---

### 15. Loading State

Skeleton shimmer only. No spinners. No progress percentages.

- Match exact shape of content being replaced
- Shimmer: CSS animation `--bg-soft → slightly lighter → back`
- Session card skeleton: same height as collapsed card, left accent bar included
- Never show partial data — skeleton or nothing

**The Generating Ceremony (canonical — `GeneratingCeremony.tsx`)**

Phases:
1. **Loading**: skeleton shimmer of 3 phase card placeholders. Copy cycles every 1.8s. Min duration: 1.8s (free) / 3.6s (paid).
2. **Revealing**: skeleton unmounts, phase cards draw in with 80ms stagger. Payoff line: *"There it is. Don't ruin it."* in `--moss`.
3. **Done**: calls `onRevealComplete` after 500ms.

No spinner. No percentage. The reveal is the payoff — not the wait.

---

### 16. AIMark

The canonical "this came from AI" glyph. Marks model-generated content; pulses while AI is in flight.

```
✦  THIS WEEK
   ↑
   AIMark — 4-point sparkle + small accent dot, top-right
```

**Visual anatomy:**
- 4-point sparkle (main element) + smaller secondary sparkle top-right
- Default size: `12px` inline; `10px` next to small eyebrow labels; `16px` on its own
- Default colour: `--moss`; pass `--warn` on coach-amber surfaces; pass the verdict colour for run feedback
- Working state: `ai-mark-pulse` keyframe — opacity `0.55 → 1` + scale `0.92 → 1.05`, 1.6s loop. Replaces the spinner pattern banned elsewhere.

**Props:**
```tsx
size?: number       // default 12
color?: string      // default 'var(--moss)'
working?: boolean   // default false — animate when AI is generating
label?: string      // aria-label override
```

**Where it lives in the product:** Almost every in-product use of AIMark now sits inside a `<CoachByline>` (Pattern 16b) — anchored to the Kit avatar's bottom-right corner in a small `--card`-coloured circle. Rendering AIMark standalone is reserved for non-byline contexts:
- Generating-state CTAs (`Generate report` button while in flight)
- GeneratingCeremony header during the loading phase
- Inline metric placeholders (skeleton row pulse on the analysis loading state)

For new AI-content cards, prefer `<CoachByline>` over a bare AIMark — the avatar anchors the glyph and reads as authorship rather than decoration.

**When NOT to use (provenance honesty):**
- Rule-engine output (plan structure, session distances, HR zone calcs)
- Hand-authored copy (zone education sheet, brand strings, voice copy)
- DB-resident content (session-catalogue guidance fallback)
- Strava-recorded data (HR, distance, pace, elapsed time)
- The plan-coach note on Today screen (rule-derived from `getPlanCoachNote()`)

The mark is a claim about provenance, not aesthetics. Mark only what came from a model.

Reference: `components/shared/AIMark.tsx`. Single source of truth — never reimplement the glyph.

---

### 16b. CoachByline

The canonical AI-coach authorship signal. A 22px Kit avatar with the AIMark sparkle anchored to its bottom-right, paired with a name + role line. Replaces the older `AICoachChip` pill — the chip read as a category tag, not as authorship. The byline gives provenance a face (same trick Granola, Notion AI, and Superhuman use).

```
[K✦] Kit                 ← 22px avatar (moss/warn gradient) + name 13px 700
     YOUR COACH          ← role line 10px 600 uppercase (default "YOUR COACH")
```

The AIMark sits in a small `--card`-coloured circle anchored to the avatar's bottom-right corner so it's identifiable at a glance, even pulsing during generation.

**Use** on every AI-generated content surface:
- Daily coach note (Today)
- Weekly report (Coach)
- Race readiness, Phase summary (Coach)
- Run feedback LLM card (Session detail)
- Plan adjustment (PendingAdjustmentBanner)
- `CoachNoteBlock` when `aiGenerated={true}` — replaces the eyebrow label
- Any new AI surface

**Colour variants:**

| Prop | Surface | Avatar gradient | Role-line colour |
|---|---|---|---|
| `color="moss"` (default) | `--card`, `--bg-soft` | `--moss` → `#5A7C5A` | `var(--moss)` |
| `color="warn"` | `--warn-bg` | `--warn` → `#9A6F2A` | `var(--warn)` |

**Rules:**
- Always moss on standard card surfaces — consistent Kit identity regardless of card accent colour
- Warn variant only on `--warn-bg` surfaces to avoid colour clash
- Working state pulses the avatar's sparkle and adds " · thinking" to the role line — replaces the spinner pattern banned by ui-patterns.md
- Use the `role` prop to convey the topic of the surface (e.g. `role="Race readiness"`, `role="Read of your run"`, `role="This week"`). Default is "YOUR COACH"
- Do NOT use on rule-engine output, race projections, hand-authored copy, or Strava data (same rule as AIMark)
- Provide `onClick={() => setScreen('coach')}` on every surface that isn't the Coach screen itself — the byline is the user's tap-target back to Kit's home

**Props:**
```tsx
working?: boolean          // default false — "· thinking" + pulsing sparkle
color?:   'moss' | 'warn'  // default 'moss'
role?:    string           // default 'YOUR COACH' — short topic label, auto-uppercased
onClick?: () => void       // when set, byline becomes a tappable button
title?:   string           // tooltip on hover/long-press
```

**Companion: AI-card left rail.** Cards that contain LLM output should pair the byline with a 3px left rail in the matching accent colour (moss on `--card`, warn on `--warn-bg`). The rail is an absolutely-positioned span at `left: 8px, top: paddingY, bottom: paddingY, width: 3px`. Linear/Arc-style accent — cheapest scalable "this card is coached" signal. Already baked into `CoachNoteBlock` and `PendingAdjustmentBanner`; replicate inline on bespoke AI cards (e.g. the run-feedback split).

Reference: `components/shared/CoachByline.tsx`

---

### 17. SectionLabel

Eyebrow label above a group of related rows. Used to name a category section in list-based screens (MeScreen, settings).

```
CAREFUL NOW                     ← uppercase, muted, 10px, 0.08em tracking
──────────────────────────────  ← optional top divider
[row]
[row]
```

**Rules:**
- Text: `10px 700 --mute uppercase 0.08em tracking`
- Padding: `0 16px`, margin-bottom `8px`
- No border on the label itself — the section content provides its own borders
- Use before groups of destructive or irreversible actions (account deletion, sign-out)
- Use before any grouping where the category isn't obvious from the rows alone

**Anatomy in MeScreen:**
```
[SectionLabel: Careful now]
  Sign out
  Delete account
```

Reference: `DashboardClient.tsx` → `SectionLabel` (defined inline; there is no `components/shared` file, and this line said there was) (if extracted) or inline in `DashboardClient.tsx`

---

### 17c. ME-ATHLETE — "What Kit knows about you"

Read-only synthesis card at the top of Me, above existing editors. Surfaces the inputs the engine actually runs on — zones, benchmark freshness, recovery signals — so configuration reads as identity, not as chores. Existing editor rows below remain untouched; this card is the *read*, not a replacement.

**Anatomy:**
- `--card` bg, `1px --line`, `--radius-lg`, no left rail (not a coaching surface)
- Eyebrow: `10px 700 --mute uppercase, letterSpacing 0.12em` — "What Kit knows about you"
- Three stacked rows, each: label (left) + state-dot + value (right) + optional sub-line
- Benchmark row is tappable → routes to `BenchmarkUpdateScreen` (`onOpenBenchmark`)

**State-dot colour rule:**
- `--moss` solid = healthy / set
- `--warn` = stale (benchmark > `GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS`)
- `--mute` = unset / not configured
- `--moss` 0.4 opacity = source available but not connected

**Honest staleness — the brand-defining detail:**
A benchmark four weeks old silently softens pace targets via VDOT's staleness discount. The card *names* it with a sub-line: "Targets may be soft — re-benchmark when you can." Same threshold sourced from `GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS` so the user-facing "stale" matches what the engine actually treats as stale (D-08, INV-CFG-001).

**Tier:** FREE. Read-only synthesis of inputs the user already owns — paywalling it makes no sense.

**Rules:**
- No new data model — every field is already computed elsewhere
- Stale state must be rendered (silent staleness is the bug the card exists to fix)
- Existing edit affordances below remain visible — the card surfaces, doesn't bury

Reference: inline render in `MeScreen` above the existing Identity card.

---

### 18. Plan Rationale — "Why this plan" (PLAN-NOTE-SURFACE-01)

> ⚠️ **REVISED BY SLT 2026-09-17 after the founder read a real plan on device.**
> Measured across 563 plans: **91.1% of runners saw a note, 74% saw two or three,
> the mean was 130 words and the worst case 254** — a page of shortfall read
> before the runner had seen a single session. The MAINTENANCE and VOLUME tiles
> appeared together on 200 plans and **157 of those (78.5%) blamed the same cause**
> (the weekday time cap), with 68 prescribing the identical lever. The runner read
> the same advice twice with different numbers.
>
> Three rules now govern this section:
>
> 1. **One cause, one tile.** The volume-shortfall note is not shown beside the
>    maintenance note; the maintenance note is the larger statement and wins.
>    Applied inside a note too — two readings of "your mileage does not climb"
>    collapse to the one that names an actionable gap.
> 2. **Consequence, then cause, then the one lever.** No thresholds, no ratios, no
>    "% of race distance". *"Peak-phase volume 52 km is 104% of week 1, below the
>    110% overload threshold"* became *"Your weekly mileage holds steady across
>    this plan rather than climbing into the final weeks."* Same fact, actionable.
>    **Where a gap exists, both figures stay** — Hutchinson: a note that reports a
>    constraint without naming what it costs is a disclaimer, not coaching.
> 3. **Length is capped, not just count.** Wood's original guardrail capped COUNT
>    at 3 and the wall arrived anyway, three items tall.
>
> **Result: mean 130 → 67 words, worst 254 → 117, and 510 of 513 plans now carry
> exactly one tile.**
>
> ⚠️ **The runtime word budget is NOT what keeps these short.** It drops whole
> notes and always keeps the first, and after the de-dupe almost every plan has
> one note — so it decides nearly nothing at runtime. The guard that binds is the
> per-note ratchet in `planRationale.test.ts`. Do not mistake the constant for
> the control.
>
> **Still open (deliberately NOT bundled):** Wood argued the rationale does not
> belong at the top of the plan at all — a runner asks "why is my long run short"
> in week 3, not on day one. Held until the shortened version has been seen on
> device, since the 254-word version is what made that argument feel obvious.
> Filed as `PLAN-NOTE-PLACEMENT-01`.
>
> **Voice stays the RULE ENGINE'S, never Kit's.** Traynor's block: the enricher
> never runs for free users, so "route these through the model for a friendlier
> voice" would leave the free tier permanently with the cold copy. The registry's
> old optional follow-up to do exactly that is **rejected on tier grounds**. These
> notes also carry no byline and no rail (`AI-PROVENANCE-01`) because no model
> wrote them.


The engine's honest, rule-engine explanation of **why the plan is shaped this way**, surfaced on the Plan screen. Closes a systemic gap: a family of plan-level `meta` notes (`volume_constraint_note`, `volume_shortfall_note`, `long_run_shortfall_note`, `fitness_signal_note`, `terrain_effort_note`, `hard_pref_note`, plus a derived level-fit line) that were stamped but rendered nowhere.

```
[SectionLabel: Why this plan]
┌─────────────────────────────────────────────┐
│  MAINTENANCE                                │   ← CoachNoteBlock, variant="why"
│  Built to get you round, not build you   │     rule-engine → NO AIMark/rail
│  week is below what a build needs…          │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│  OFF-ROAD                                   │
│  Off-road, let effort and HR lead — the     │
│  pace targets are a road reference…         │
└─────────────────────────────────────────────┘
```

**Structure:**
- Placement: `PlanScreen`, below `PlanArc` and the AI `plan_intro`, above the this-week voice card — the plan-level orientation zone.
- `SectionLabel` **"Why this plan"** (only when ≥1 note).
- A vertical stack (8px gap) of `CoachNoteBlock` (§9), `variant="why"`, `aiGenerated={false}` → **no CoachByline, no rail** (provenance honesty: these are deterministic rule-engine output, not AI — contrast the `plan_intro` card directly above, which IS AI and carries a byline).
- Each card's eyebrow is the note's **topic label** (MAINTENANCE / VOLUME / LONG RUN / YOUR LEVEL / HARD SESSIONS / OFF-ROAD / SHAPED FOR YOU).

**Rules (SLT 2026-09-09, Wood's guardrail — surface once, honest, never a "personalised!" brag):**
- **Single owner:** `lib/plan/planRationale.ts → planRationaleNotes(meta)` decides which notes, in what order, under what label — the UI renders from it, never greps meta itself.
- **Ordering:** honest *constraints* first (they explain a surprising shape and are behaviour-relevant); the brag-risky "Shaped for you" line ranks **last**.
- **Cap:** `PLAN_RATIONALE_MAX_NOTES` (3) — a plan never becomes a wall of notes.
- **Empty state:** zero notes → render nothing (no empty card).
- **Provenance:** all rule-engine → no AIMark. If a note ever became AI-derived it would move to `aiGenerated`.

Reference: `lib/plan/planRationale.ts` (logic + tests) · inline render in `PlanScreen` (`DashboardClient.tsx`).

---

### 17a. TD-CLOSE (the day's close)

When today's session is complete, skipped, or is a rest day, Today renders a small **calm closing read** above the session card. The brand's anti-cheerleading thesis is most visible here: restraint as reward, no confetti, no streak burn, no celebration.

**Three voice lines (locked):**

| State | Eyebrow | Headline | Metric |
|---|---|---|---|
| Done (complete) | `Today's done` | "That's the day. Nothing to prove now." | distance done (km / mi) |
| Rest day | `Rest day` | "Do nothing. It helps." | — |
| Skipped | `Benched` | "Benched. Tomorrow's still the plan." | — |

**Anatomy:**
- `--card` bg, `1px --line`, `--radius-lg`, **3px `--moss` left rail** at `left: 8px` (completion accent, not warn)
- Eyebrow: `10px 700 --moss uppercase, letterSpacing 0.12em`
- Headline: `17px 600 --ink, lineHeight 1.3`
- Metric (done only): `13px 500 --ink-2, tabular-nums` — distance done in the user's preferred units
- Sits above the session card, replacing PreRunBandCard which self-hides when today is done

**Tier:** FREE. The closing read is brand infrastructure — habit-loop reward cue — and can't be paywalled credibly.

**What this does NOT do:**
- No confetti, no streak burn, no celebration (anti-gamification line — Wood)
- No motivation copy ("Great job today!" — forbidden by `CLAUDE.md` voice table)
- No re-showing the prescription post-log — the session card already flips to its done state; this read is the one-line acknowledgement above it

Reference: inline render in `TodayScreen` selectedSession render block.

---

### 17d. TD-READY steady chip (the calm half of fresh/steady/cooked)

Companion to Pattern 17b (TD-READY hero). When the readiness route returns `all_clear` or `no_trigger` with an established baseline, a small chip renders above the session card: **"READINESS · STEADY"** with a tap-to-expand affordance. Expanded body shows the underlying numbers — RHR (today vs baseline), HRV (today vs baseline), Sleep hours.

**Why it exists:** the SLT TD-READY spec called for fresh/steady/cooked. v1 shipped cooked only. Without the steady chip the runner only ever hears from readiness when something is *wrong* — app-as-pessimist. The chip lets Kit confirm the daily check happened without shouting about it. Wood's habit-loop reward cue, made calm enough to survive Sutherland's permission > score rule.

**Anatomy:**
- Tappable button row, full width
- `--card` bg, `1px --line`, `--radius-md`, **3px `--moss` left rail** at `left:8px` (coaching-surface rail)
- Eyebrow: `11px 700 --moss uppercase, letterSpacing 0.12em` — "Readiness · steady"
- Disclosure chevron: `▾` (collapsed) / `▴` (expanded)
- Expanded body: `12px --ink-2`, tabular-nums, one line — "RHR 52 (baseline 50) · HRV 65 (baseline 58) · Sleep 7.2h"

**Eligibility (must satisfy all):**
- Paid tier
- Today's session selected
- Session type ∈ {quality, long, intervals, tempo} (route returns detail only for these)
- No `readiness_signal` pending adjustment (TdReadyHero handles cooked)
- Today not done
- `readinessData.reason === 'all_clear' | 'no_trigger'`
- `readinessData.detail` present (baseline exists)

**Stacking:** sits above PreRunBandCard (if it would render). Both can coexist — different questions, different scales.

**Tier:** PAID. Underlying signal is HK-derived; free users never reach this state.

**Rule-derived — no AIMark** (Pattern 16 provenance).

Reference: `function ReadinessSteadyChip` in `app/dashboard/DashboardClient.tsx`.

---

### 17b. TD-READY hero (readiness-led permission)

When recovery signals (RHR / HRV / sleep) fire on a quality / long / intervals / tempo day, the engine writes a `plan_adjustments` row with `trigger_type = 'readiness_signal'`. Instead of the generic `AdjustmentBanner` Confirm/Revert pattern, that row renders as a **TD-READY permission pill** above today's session card. Permission > score. "Ease the session" gives the runner permission to back off; "Run it anyway →" stays equally visible (never a coercive gate).

**Anatomy:**
- `--card` bg, `1px --line`, `--radius-lg`, **3px `--warn` left rail** at `left: 8px` (coaching-caution rail, never red — INV-DS-005)
- Eyebrow `Readiness · easing today` + reason chips: `RHR up · HRV down · Short sleep`
- Permission line: 15px 400 `--ink`, line-height 1.55 — this is the adjustment's `summary`, already in Kit voice from `buildReadinessAdjustment`
- Two buttons: primary `--moss` "Ease the session" (= confirm API), secondary text "Run it anyway →" (= revert API)
- **No AIMark** — rule-derived (CoachingPrinciples §59), not model output (Pattern 16 provenance honesty)

**Stacking against PreRunBandCard (Decision 2026-06-19):**
PreRunBandCard self-hides when a readiness-signal pending adjustment exists. Same hero space, different jobs — readiness wins on a cooked morning because permission > confirmation. PreRunBandCard returns to normal once the user eases or runs anyway.

**Tier:** PAID (the underlying `/api/pre-session-readiness` route is gated; free users never see a pending readiness row).

**Eligibility:** today's session type ∈ `{quality, long, intervals, tempo}`. Easy / recovery / rest never trigger — an easy day doesn't need easing.

Reference: `function TdReadyHero` in `app/dashboard/DashboardClient.tsx`. Engine: `lib/coaching/planAdjustment.ts → buildReadinessAdjustment`. Thresholds: `GENERATION_CONFIG.READINESS`.

---

### 18a. Coach screen composition (CO-ONE)

The Coach screen carries **exactly one Kit voice** — a single authored read at the top, single `CoachByline` + `AIMark`. Everything below is **unvoiced evidence**: rings, stats, trends, ledger.

**The one read — priority assembly (top of Coach):**

| Priority | Signal | Source | Folds in as |
|---|---|---|---|
| 1 | Race window (`daysToRace ∈ [0, 14]`) | `/api/race-readiness` | Leads: "Race in {n} days." + race-readiness content |
| 2 | Phase change (suppressed by race) | `/api/phase-summary` | Leads if no race: "You've crossed into a new phase." + phase content |
| 3 | Zone drift (suppressed by race) | `zoneDriftPattern` | Body sentence: "{count} of your last {total} easy runs crept above Zone 2." |
| 4 | Trend signal | `/api/coaching/trend` with `hrIsTrending` | Body sentence: "Easy is easier than it was — {earlierHr} down to {nowHr} since {earlierMonth}." |
| 5 | Base synthesis | `/api/weekly-report` | Default headline + body + italic cta (action line) |

**Anatomy:**
- `--card` bg, `1px --line`, `--radius-lg`, `3px --moss` left rail at `left: 8px`, padding `18px 20px 18px 22px`
- ONE `<CoachByline color="moss" role="This week" working={isLoading} />` at top
- W{n}/{total} counter right-aligned in eyebrow
- Headline (17px 600), body (13px 400 line-height 1.7), italic action line
- "Generate / Refresh report" button + `ShareWeekButton` attached
- Loading: 3 shimmer lines at 85% / 100% / 70%, `rgba(107,142,107,0.12)`

**Empty state — X-FIRSTRUN state-aware (no analysed runs):**
- Dimmed Kit identity (avatar + name + eyebrow, opacity ~0.45)
- **NO AIMark** — empty-state line is hand-authored, not model output (Pattern 16 provenance honesty)
- The body line + CTA branch on which signal is actually missing — the empty state teaches the ONE next action instead of a generic "log a run":

| State | Detected when | Headline | Body | CTA button |
|---|---|---|---|---|
| **no-source** | no Strava token AND no Apple Health connection | "Nothing to coach from yet." | "Connect Apple Health or Strava so I can see your runs. I keep quiet until I have something honest to say." | "Connect a source →" → Profile |
| **no-runs** | source connected but `runs.length === 0` | "Waiting on your first run." | "Go log a session — even an easy one. Once I see a run with heart rate, I can say something useful." | none (action is real-world) |
| **no-hr** | runs exist but RHR or MaxHR missing | "One more thing." | "Set your resting and max heart rate. Without those, the zone targets are guesses." | "Set heart rate →" → Benchmark |
| **last-week** | weekly report exists for previous week | "Last week's report is below." | "Generate a report to see how this week is tracking." | "Generate report" |

The CTA button replaces the "Generate report" button when present — no generating from no data. Auto-resolves as data lands (the read re-evaluates on every render against the current user state).

**Evidence below — unvoiced, fixed order:**
1. ZoneRings (Pattern 22) — unchanged
2. Stats 2×2 (Pattern 19) — Zone discipline · Load ratio · Sessions · Weeks left, with info sheets preserved
3. LedgerCard (Pattern 11) — Weeks within the lines, unchanged
4. TrendCards (Pattern 29, `glossless`) — numbers only, AI gloss + byline stripped on Coach

**Dismissal:** v1 has no dismissal surface (one Kit read, repetition is signal). The "Manage what Kit watches" sheet is a Phase 2 backlog item gated on real user mute requests. `zone_drift_dismissed_at` / `benchmark_recal_dismissed_at` columns remain in schema, currently unread.

**Replaces:** Kit identity card + first-open coach intro + standalone weekly report card + Pattern 18 SpecialCoachCard (Race Readiness, Phase Summary) + standalone zone-drift card. All those surfaces' Kit bylines collapsed into the one read.

---

### 34. SpecialCoachCard

> **SUPERSEDED by CO-ONE (2026-06-19).** Phase Summary and Race Readiness content is no longer rendered as standalone cards on Coach. Both fold into the **one consolidated Kit read** at the top of CoachScreen — race-readiness content leads the read when in race window, phase-summary content leads when a phase just changed. The generation flow, idempotent storage, and API routes are unchanged; only the rendering surface is consolidated. The variant table below documents the legacy two-card layout for historical reference.

Timed AI coaching moments that appear on the Coach screen in specific windows. Two variants share the same anatomy but carry different visual language to distinguish them from the persistent weekly report card.

**Variants:**

| Variant | Trigger | Surface | Left accent | Eyebrow colour |
|---|---|---|---|---|
| Phase Summary (R28) | First week of a new plan phase | `--bg-soft` | `3px var(--moss)` | `--moss` |
| Race Readiness (R29) | `daysToRace ∈ [0, 14]` | `--card` | `3px var(--s-race)` | `--s-race` |

**Mutual exclusion:** R29 always suppresses R28. Both can never appear simultaneously.

**Anatomy (both variants):**
```
[3px left accent border]
  [<CoachByline role="Phase complete" /> or <CoachByline role="Race readiness" /> · counter right-aligned (days to go on Race Readiness only)]
  ─────────────────────────────────────
  [2–3 sentence AI coaching text · 15px 400 --ink · 1.65 line-height]
```

**Loading state:** Skeleton shimmer — three lines at 85% / 100% / 70% width, background `rgba(accent, 0.12)`. `<CoachByline working />` pulses the avatar's sparkle in the eyebrow row.

**Positioning on Coach screen:** Inserted directly above the weekly report amber card, below the 2×2 stats grid. No vertical gap beyond the parent `gap: 12px`.

**Generation flow:**
1. CoachScreen mounts → `useEffect` fires once
2. If condition is met and no cached content passed from DashboardClient → calls `/api/race-readiness` or `/api/phase-summary`
3. API routes are idempotent (PK on `user_id + race_date` / `user_id + phase_ended + transition_week_n`)
4. Content stored in `race_readiness_notes` / `phase_summaries` tables
5. Subsequent screen opens return cached content instantly (no AI call)

**Gating:** PAID / TRIAL (activity_intelligence gate). Free users: card is not shown and no API call is made (CoachTeaser component shown instead).

**CoachByline on these cards:**
- Both variants use `<CoachByline color="moss" role="…" />` — byline always stays moss on `--card` / `--bg-soft` surfaces (Pattern 16b)
- The *card-level left accent* (not the byline) carries the variant theme: `--moss` for Phase Summary, `--s-race` for Race Readiness
- The byline's `role` prop names the topic (`"Phase complete"` / `"Race readiness"`) — replaces the older eyebrow label

**Rules:**
- Never show both variants simultaneously
- Neither variant shows a "locked" shell for free users — timed moments with no user-accessible retry
- `CoachByline` is always present (provenance honesty — model output)
- No refresh button — the note is generated once per phase transition / race date and cached

---

### 19. Stats 2×2 Grid

Four metric cells in a 2-column grid. Used on the Coach screen for Zone discipline, Load ratio, Sessions, and Weeks left.

```
┌─────────────────┬─────────────────┐
│  ZONE DISC. ⓘ  │  LOAD RATIO ⓘ  │
│  84%            │  1.12x          │
│  Good week      │  Steady build   │
├─────────────────┼─────────────────┤
│  SESSIONS       │  WEEKS LEFT     │
│  3/5            │  8              │
│  On track       │  Build phase    │
└─────────────────┴─────────────────┘
```

**Structure:**
- Grid: `display: grid`, `gridTemplateColumns: '1fr 1fr'`, `gap: 8px`
- Each cell: `--card` background, `1px solid --line` border, `var(--radius-lg)`, `16px` padding
- Eyebrow: `10px 700 --mute uppercase 0.08em tracking`
- Interactive cells (have a drill-down sheet): rendered as `<button>`, eyebrow includes `ⓘ` marker at `11px` in `--moss`
- Static cells: rendered as `<div>`, no `ⓘ` marker
- Value: `28px 800 tabular-nums --ink` — distinct from Pattern 4 (Stat Row 24px) because the 2×2 grid has square cells not horizontal strips
- Sub-label: `11px 500`, colour reflects verdict: `--moss` (good), `--ink-2` (neutral), `--warn` (caution)

**Interactive cells tap to a slide-up sheet** with:
- Drag indicator: `36×4px` pill, `--line`, `margin: 6px auto 18px`
- Sheet header: eyebrow + 24px/600 title + current value in verdict colour
- Body: 3 paragraphs explaining the metric, `15px 400 --ink-2`, `1.55` line-height
- Sticky footer: full-width close button, `--bg-soft` background, `--ink` text

**Keyframes:** `zonna-fade-in` (backdrop) and `zonna-slide-up` (panel) remain defined once in `globals.css` for any ad-hoc reveal (e.g. RaceResultSheet's advanced-fields section). The sheet primitive itself now animates with CSS transitions so it can play an EXIT as well as an enter (see below).

> ### Slide-up Sheet — the presentation contract (SHEET-PRESENT-01, shipped 2026-09-13)
>
> **Every secondary surface arrives through one primitive: `components/shared/Sheet.tsx`. Never hand-roll a bottom sheet again.** Before this, seven copies each invented their own `zIndex`; five sat **below** the bottom nav (`zIndex: 3000`) — `ZoneInfoSheet`, both Coach stat sheets, `TrendCard`'s explainer, `MissedSessionSheet`, `ManualRunModal` (and, uncounted at filing, `GeneratePlanScreen`'s Foundation modal). Each was `position: fixed; inset: 0; alignItems: flex-end`, so the panel bottom and its own sticky close bar landed exactly where the nav paints. The sheet opened; the runner could not see the part that mattered. Founder-reported on device.
>
> **What the primitive owns, so no caller re-invents it:**
> - **Portal to `document.body`** — the sheet escapes the app's scrolling content container entirely. The shell locks `<body>` and scrolls an inner div, and WKWebView mispositions `position: fixed` descendants of a scrolling container; rendered at the body, the sheet is truly viewport-anchored.
> - **One z-index, above the nav by construction** — `Z_LAYERS.sheet` from `lib/ui/zLayers.ts` (the single owner of stacking: `guide > sheet > nav > content`, asserted by `zLayers.test.ts`). No component hardcodes a sheet z-index.
> - **Covers the nav** — the panel's bottom edge is the viewport's. 🔴 **REVERSED 2026-09-22 (S1, Design Board), explicitly and by name.** This read *"rests on the nav's top edge"*, encoding the founder's own earlier rule, *"come up from the nav bar but not overlay it"*.
>
>   ⚠️ **The reversal is NOT about room.** Measured: covering the nav buys **0px on an iPhone SE and 5px — 0.6% — on a 13/15.** When a change buys nothing measurable, the argument was never about the measurement.
>
>   **What was actually wrong:** the backdrop is `position: fixed; inset: 0` at `Z_LAYERS.sheet` (4000) against the nav's 3000, filled with `--scrim` at 40% ink and carrying `onClick={close}`. So the nav was **visible, dimmed, and lying** — it offered four destinations and delivered one behaviour, and tapping *Plan* dismissed the sheet instead of navigating. The fattest, most reachable strip on the phone, the thumb's home, wired to the wrong verb, on all six sheet instances. **A modal dialog covers the application**; the one exit is the panel's own bottom bar, which the standing rule already puts there.
>
>   ⚠️ **Wroblewski, recorded so it does not return:** the alternative — leaving the nav LIVE and un-scrimmed — is worse. The panel carries `role="dialog"`, `aria-modal="true"` and a focus trap, and a live nav outside an `aria-modal` dialog is a contradiction a screen reader cannot resolve, with two competing exit gestures inside 80px.
>
>   The measured nav height is **still published and still consumed** — by `maxHeight`, so a tall sheet cannot grow into the home-indicator strip — and the panel now carries `paddingBottom: env(safe-area-inset-bottom)` itself, because the nav used to absorb that for it. Same doctrine as A4: **the inset is a reserved strip, added, never spent as content padding.**
> - **⛔ A sheet covers the nav; it does NOT become a screen.** `maxHeightVh = 88` is **load-bearing, not a default** (Silvanto, binding). A sheet whose content cannot fit at 88vh is evidence the content belongs on a screen — and this product has retired two screens for less.
> - **Enter + exit animation, backdrop + Escape dismissal, body-scroll lock, focus capture/trap/restore, and the drag pill.**
>
> **How to use it:**
> ```tsx
> {open && (
>   <Sheet onClose={() => setOpen(false)} ariaLabel="…">
>     {(close) => (
>       <>
>         {/* header + body — own your horizontal padding (e.g. '0 20px') */}
>         <div style={{ position: 'sticky', bottom: 0, /* … */ }}>
>           <button onClick={close}>Close</button>   {/* animates out, then onClose */}
>         </div>
>       </>
>     )}
>   </Sheet>
> )}
> ```
> `onClose` = "fully closed, unmount me" (the primitive calls it *after* the exit animation). The `close` passed to children triggers that animated dismissal from any affordance (bottom Close, a ✕, "Decide later"). The primitive draws the drag pill; do not add your own. Reintroducing a below-nav sheet overlay fails `components/shared/sheetPresentation.test.ts`. ⚠️ **That test asserted the OLD rule and could not enforce it**: it read `expect(src).toContain('paddingBottom')`, which `paddingBottom: 0` satisfies exactly as well as `paddingBottom: navH`. The rule had a green tick with nothing behind it, and it was found while reversing the rule it guarded.
>
> **Exception:** `ScreenGuide` (first-load coach-mark) is deliberately NOT a `Sheet` — it teaches nav position by drawing a mirrored nav of its own — but it takes its layer from `Z_LAYERS.guide`, so it too stacks correctly.

**Rule:** Only Zone discipline and Load ratio are interactive. Sessions and Weeks left are static — same card style, no button, no ⓘ.

---

### 20. Action List Card

A grouped list of tappable rows inside a single card. Used in MeScreen for plan actions, display prefs, race prep, training intelligence, and the Careful Now section.

```
┌─────────────────────────────────────────┐
│  Row label                          [›] │  ← 13px 500 --ink
│  Supporting detail                      │  ← 12px 400 --mute
├─────────────────────────────────────────┤
│  Row label                          [›] │
│  Supporting detail                      │
└─────────────────────────────────────────┘
```

**Structure:**
- Container: `--card` background, `var(--radius-lg)` radius, `1px solid --line` border, `overflow: hidden`
- Row padding: `14px 16px`
- Row divider: `1px solid --line` — never `0.5px`
- Primary label: `13px 500 --ink`, `var(--font-ui)`
- Supporting detail: `12px 400 --mute`, `var(--font-ui)`
- Chevron: `--mute` colour, `marginLeft: 12px`, right-aligned

🟢 **NOW A COMPONENT — `components/shared/ActionRow.tsx` (ACTION-ROW-01, 2026-09-23).**

🔴 **THIS PATTERN WAS ALREADY DOCUMENTED, IN THIS SECTION, INCLUDING THE CHEVRON — AND THE PLAN
SCREEN SHIPPED WITHOUT ONE.** The founder: *"that is an action tile. It's not clear you can click
on it. We have them under Me profile so we should have a standard pattern for these."* He was
right, and the pattern he was pointing at is this one.

**The cause was structural, not an oversight: the chevron existed only as a local `const` inside
the Me screen's component.** Seven rows there used it; the Plan screen could not reach it, so its
tile was re-implemented from the same prose you are reading and lost the part that makes it legible
as a control.

🥇 **A DOCUMENTED PATTERN WITH NO COMPONENT IS A PATTERN THAT GETS RE-IMPLEMENTED FROM MEMORY.**
The prose said *"chevron, `marginLeft: 12px`, right-aligned"* and was correct the whole time. Prose
cannot be imported.

- `ActionRow` renders ONE row: title, optional subtitle, always the chevron, real `<button>`,
  `min-height: 44px`.
- **The CONTAINER stays with the caller.** Me stacks several rows in one card (`divider`); Plan has
  a single standalone card. Both are this pattern — a one-row Action List Card.
- Gated by `components/shared/actionRow.markup.test.ts`, falsified by removing the chevron.

**Toggle variant** (for boolean settings like Auto-adjust):
- Row has no chevron — replaced by a `44×26px` pill toggle
- Toggle on: `--moss` background; off: `--line` background
- Thumb: `20×20px` white circle, `3px` inset, transitions with `left 0.2s`

**Segmented selector variant** (for km/mi, distance/duration):
- Small pill buttons, `10px` radius, `5px 12px` padding
- Active: `1px solid --moss`, `--moss-soft` background, `--moss` text
- Inactive: `1px solid --line`, transparent background, `--mute` text

**Warning card variant** (e.g. HR not configured):
- `--warn-bg` background, `1px solid --line` border, `10px` radius
- Dot: `6px` circle, `--warn` fill
- Text: `12px 400 --coach-ink` — warm dark brown on amber, never `--warn` colour on `--warn-bg`

**Rules:**
- Always `var(--card)` not `var(--card-bg)` — banned alias
- Always `1px` borders not `0.5px`
- Always `var(--radius-lg)` not hardcoded `12px`
- Nested toggle or selector buttons may use `10px` radius (pill shape) — distinct from card container

---

### 21. ZoneBar

The canonical visual for "which zone is this session in." 5 segments in a row, one filled in zone colour. Highest information-per-pixel of any chart on the session surfaces — at a glance, the user sees both the zone they're in AND its position in the 5-zone arc. Anchors the "Hold the zone" brand promise visually.

```
[─][▓▓▓][─][─][─]        ← Today session card (compact, no labels)
 1   2   3   4   5

[─][▓▓▓][─][─][─]        ← Session Detail prescription card (labelled)
 1   2   3   4   5       ← active label in zone colour, others --mute
```

**Structure:**
- Container: optional outer wrapper styled by caller
- Bar row: `display: flex`, `gap: 3px`
- Segments: `flex: 1` each, `borderRadius: 2px`
- Active segment: filled with zone colour
- Inactive segments: `var(--bg-soft)`
- Optional labels row: `flex: 1` cells, `9px 600`, `0.06em letter-spacing`, centred, active label in zone colour

**Variants:**

| Surface | Height | Labels | Notes |
|---|---|---|---|
| Today session card | `4px` | off | Glance-only — labels would clutter |
| Session Detail prescription | `5px` | on | Prescription is the focal point; labels earn their space |
| Post-plan zone intro | covered by 5-zone list (Pattern 21 not used) | — | Intro uses the full zone-row pattern with HR ranges |

**Zone → colour mapping** (ui-patterns.md § HR Zone → Session Colour Coherence):

| Zone | Token | Session types |
|---|---|---|
| 1 | `--s-recov` | recovery |
| 2 | `--s-easy` | easy, run, long |
| 3 | `--s-quality` | quality, tempo |
| 4 | `--s-race` | race |
| 5 | `--s-inter` | intervals, hard |

**Helpers** (from `components/shared/ZoneBar.tsx`):
- `zoneNumberForType(type): Zone | null` — maps session.type → 1–5. Returns null for rest / strength / cross-train. Distinct from `zoneForSessionType` in `lib/coaching/zoneRules.ts` which returns a `ZoneBand` object grouping 4+5 — the visual bar wants 5 distinct segments.
- `zoneShortName(zone): string` — short label for prescription card ("aerobic", "tempo", "threshold", "VO₂ max").

**Props:**
```tsx
activeZone?: 1 | 2 | 3 | 4 | 5     // single zone
activeZones?: Zone[]               // a RANGE — every zone lights in its own colour
height?: number                    // default 4 (Today); 5 on Session Detail
showLabels?: boolean               // default false; true on Session Detail
style?: React.CSSProperties
```

**Range support (§84).** A mixed-intensity quality session is prescribed across a zone *range* ("Zone 4–5"), so `activeZones={[4,5]}` lights both segments, each in its own zone colour. This is what the session-detail header and the Today ZoneBar now pass, sourced from `session.zone` via `displayZonesForSession()` — never from `session.type`, which collapses every quality session to a flat Z3. `activeZones` wins over `activeZone`; a lone `activeZone` still works for single-zone callers.

**Rules:**
- Never render when session has no zone (rest / strength / cross-train) — caller checks `displayZonesForSession()` (or `zoneNumberForType()`) first
- Active label colour MUST match the segment colour — single token per zone
- Don't add a 6th segment, a duration overlay, or any other decoration — the value is in the constraint
- The bar is a *visual aid*, not a measurement. For HR ranges, use the prescription card's HR display line.

Reference: `components/shared/ZoneBar.tsx`. Single source of truth.

---

### 21b. Session steps

The session-detail structure block. Rebuilt 2026-09-04 (SESSION-STRUCTURE-REDESIGN) from a dense run-on sentence — *"4 × (5 min at 4:25–4:35 /km + 1:30 at no faster than 5:53–7:02 /km jog)"* — into scannable, per-phase cards you can read mid-run. Runna-informed (chunked cards, numbered steps, plain-language cues) but on Zonna terms: zones over pace-only targets, block totals, Warm Slate restraint.

```
SESSION STRUCTURE
┌ WARM-UP ─────────────── ~3km · Z1→Z2 ┐   ← tinted header (moss), not flooded
│ Conversational · 6:45/km              │
│ 1 ● Easy run              ~3km        │   ← numbered step + connector line
│                           Final third in Z2
│ 2 ● Strides               4 × 20s     │
└───────────────────────────────────────┘
┌ MAIN SET ⓘ ──────────── ~7km · Zone 4–5 ┐  ← header zone = session.zone (§84)
│   6× ROUNDS OF                        │   ← repeat bar, prominent multiplier
│ 3 ● Hard        ~0.65km  3 min · 4:30–4:42 /km
│   ○ Jog         ~0.3km   2 min · ≤ 5:53–7:02 /km
└───────────────────────────────────────┘
┌ COOL-DOWN ───────────── ~1km · Z1 ────┐
│ 4 ○ Easy jog / walk       ~1km        │
└───────────────────────────────────────┘
```

**Structure:**
- **Per-phase card** — `--card`, `1px --line`, `12px` radius. One card per phase (warm-up / main set / cool-down). Chunking is the readability win.
- **Tinted header** — `color-mix(in srgb, <accent> N%, var(--card))` background, accent-coloured label. **Never a solid colour bar** (ADR-007 "type accent, not flood"). Accent: warm-up `--moss`; main set `--s-inter` when peak zone ≥ 5 else `--s-quality`; cool-down `--s-strength`. Header right shows `~total · zone`.
- **Numbered steps + connector** — an italic step number in a 20px gutter with a `1.5px --line` connector running behind it. The first row of a repeat block carries the number; later rows in that block are blank (they are one step). Gives the runner a "step N of M" sequence.
- **Step row** — a work/recovery dot (work = the main accent, recovery = hollow `--mute-2` ring), a plain-language **role** (Hard / Jog / Uphill / Stand / Jog down / Run to base), then a right-stacked metric: primary **amount** (bold, the chosen metric) over a secondary **detail** (`duration · pace`, `RPE 8`, or `≤ band`).
- **Repeat bar** — `--bg-soft`, a bold italic `N×` in the accent + the label (`ROUNDS OF` / `HILL REPS`).
- **Per-section pace** — warm-up / cool-down show `Conversational · <easy band>` when a Strava-derived easy pace exists; omitted otherwise (never invent a pace — zone-rules.md).

**Metric follows the toggle (§ ADR-015).** Distance leads when the user's toggle is on km; a duration-native rep (an interval) shows an estimated distance derived from its pace with the duration kept in the detail. A rep with no pace (a hill rep at RPE) keeps *time* as its primary — there is no honest distance to show. Flip the toggle and primary/secondary swap.

**MP long-run variant.** A long run with a race-pace finish (§25) renders a second row *inside* the main set — the easy body, then a **Race pace** row carrying its own km/min plus `duration · pace` in the detail. The main-set header total covers both rows.

```
┌ MAIN SET ────────────── ~18km · Zone 2–3 ┐   ← easy body + segment
│ 2 ● Easy                  ~9km            │
│   ● Race pace             ~9km            │
│                           60 min · 5:41 /km
└───────────────────────────────────────────┘
```

**The figures reconcile (SESSION-RECONCILE-01).** Warm-up + main-set + cool-down always sum to the session total the runner sees at the top of the card, and on an MP long run the easy + race-pace rows sum to the main-set total — by distance under the km toggle, by duration under time. Before this the race-pace segment rendered as a bare `40%` with no km/min (so the visible parts summed to *total − segment*), and each part rounded independently (2 + 9 + 2 against a 22 km header). The single owner is `resolveDisplayFigures()` in `lib/plan/sessionSteps.ts` (whole-unit distances apportioned to the total via `apportionRoundedDistance`); the guarantee is corpus-tested in `sessionReconcile.test.ts`. **Any new session shape must keep it: its parts must sum to its total on the card.**

**Sub-unit parts fall back to minutes (UNITS-SUBUNIT-01, Design Board 2026-09-23).** A part that apportions to **zero whole units** shows its **duration** instead of a distance. A 0.71 km cool-down is 0.44 of a mile; rounded to a whole unit it printed `~0mi`, which tells the runner they cover no ground. Measured across 48,547 sessions before the fix: **39.7% of sessions in miles and 3.7% in km** carried a `~0` part, cool-down in every one of them, real distances 0.25–1.27 km. Minutes rather than a decimal or a `<1mi`, for three reasons: the bookends are **prescribed** in minutes and the distance is derived, so minutes is the source of truth; a decimal asserts a precision the derivation has not got on a card where every other figure is a whole unit behind a `~`; and minutes is a notation this card already uses, where `<` would be a third one.

> ⚠️ **This makes a card MIXED-KIND, and that is not new.** The time-trial variant below already ships `WARM-UP 10 min` beside a distance main set, and the metric rule above already mixes kinds at row level ("a hill rep at RPE keeps *time* as its primary"). What was new is that `sessionReconcile.test.ts` asserted **every section figure shares a unit** — a rule that **was never written here**, that this document's own time-trial diagram contradicts, and whose single counter-example was carved out of the assertion (`NON_PARTITIONED_SHAPES`) rather than examined. **The rule and the pattern lived in different documents and had never met**, which is the `--surface-moss-wash` shape. The assertion now tests the GUARANTEE — distance-kind parts sum to the header, and **a minutes part must have apportioned to exactly zero**, so the fallback cannot hide real ground. That is strictly stronger than the kind check it replaced.

**Time-trial variant — the one shape whose parts do NOT partition the total.** The §78 benchmark’s `distance_km` IS the measurement; `ruleEngine` puts the warm-up and cool-down *outside* it deliberately, because the trial alone is what the plan counts (`sumWeeklyKm`, §1, §52). So the main set shows the trial **exactly, with no `~`** — every other figure on this card is an estimate and this one is the prescription — while the bookends stay in **minutes**. There is no honest distance to put on them: *“cool down easy”* carries no number, and inventing one breaks `zone-rules.md`’s never-invent rule. That is the same principle the metric rule above already applies to a hill rep at RPE, applied per **part** rather than per session.

```
┌ WARM-UP ────────────── 10 min · Z1→Z2 ┐
│ 1 ● Easy run                  10 min   │
│ 2 ● Strides                  4 × 20s   │
└─────────────────────────────────────┘
┌ MAIN SET ⓘ ─────────── 5km · Zone 4–5 ┐   ← exact, the measurement itself
│ 3 ● Main set                    5km    │
│                        5K time trial    │
└─────────────────────────────────────┘
┌ COOL-DOWN ─────────────── 5 min · Z1 ┐
│ 4 ○ Easy jog / walk            5 min   │
└─────────────────────────────────────┘
```

> ⚠️ **Founder-reported, 2026-09-17 — what this variant exists to stop.** With no branch, the generic path carved the warm-up OUT of the 5 km and the card read **“warm-up ~3km · main set ~2km · cool-down ~0km”**, beside a Kit note saying *“5 km as hard as you can hold”*. The measurement the whole recalibration feature depends on was shown as 2 km. **The warm-up minutes are sourced from `warmup_min_duration_mins` precisely because that is the number the note already promises**, so the prose and the structure now read the same constant instead of drifting apart. Contract: `TT-STRUCTURE-01` in `sessionReconcile.test.ts`, which asserts the main set equals the trial AND that the card agrees with the note.

**Data:** the main set renders from `session.derived_set` (ADR-019) via `buildStepGroups()` in `lib/plan/sessionSteps.ts` (pure, tested). Falls back to the composed one-line `structure.main.description` when a session has no derived set (v1 rows, easy runs). The ⓘ on the main-set header opens the zone-education sheet.

**Provenance:** all rule-engine output — **no `<AIMark />`** (Pattern 16). Zones and pace are computed, not model-authored.

Reference: `components/shared/SessionSteps.tsx` (render) + `lib/plan/sessionSteps.ts` (display model). Integration: `DashboardClient.tsx → SessionPopupInner`.

---

### 22. WeekStripCard

Compressed weekly summary used on the Plan screen for past weeks (when expanded) and distant-future weeks (≥2 weeks ahead). 7 status dots in a single row replace the full WeekCard's day list. Lets a 16-week plan read as an arc instead of a wall of rows.

```
┌─────────────────────────────────────────────┐
│ W10 · Apr 28 – May 4 · peak begins   52km  │
│  M    T    W    T    F    S    S            │
│  —    ●    ●    ●    —    ●    ●            │
└─────────────────────────────────────────────┘
```

**Structure:**
- Container: `--card` bg, `1px solid --line` border, `var(--radius-lg)` radius, `14px 16px` padding
- Race-week variant: `borderLeft: 3px solid var(--s-race)` (parallels WeekCard race accent)
- Past variant: `opacity: 0.65` (parallels WeekCard past treatment)
- Header row: week label `12px 600 --ink-2` left, total km `14px 700 --ink-2 tabular-nums` right
- Status dots row: `display: flex, justify-between, gap: 4px`. Each day cell flex-1, column layout with `D` initial above + dot
- Day initial: `9px 600 --mute uppercase 0.06em`

**Dot vocabulary:**

| State | Visual |
|---|---|
| Complete | `8px` filled `--moss` circle |
| Future session | `8px` outlined `--mute-2` circle |
| Skipped | `8px` dashed `--mute` circle, opacity 0.6 |
| Race day | `10px` filled `--s-race` circle (slightly bigger to read as the climax) |
| Rest / empty | `6px × 1.5px` dash `--mute-2`, opacity 0.5 |
| Past + future-not-done | `8px` filled `--mute-2` circle, opacity 0.5 (signals "this slot existed and is now gone") |

**Race-week footer (optional):**
- Renders only when `isRace` is true
- `10px 700 --s-race uppercase 0.08em` — formatted as `weekday, day month` (e.g. "Sun 5 May · Marathon des Sables")
- The actual race date is derived from the last race-typed session in the week (typically Sunday)

**When to use:**
- Past weeks in `Plan` screen's PlanCalendar after the user expands "Load N past weeks"
- "Later" weeks (≥3 weeks ahead) — keeps the current + next week as full WeekCards, compresses the rest
- NOT used for the current or next week — those carry the move/swap interaction and need the full WeekCard

**Later-week tap-to-expand (PLAN-STRIP-EXPAND, shipped 2026-05-30):**
- Later-week strips render a `⌄` chevron in the header when `onTap` is provided and become tappable
- Tapping replaces the strip with a full `WeekCard` (full day rows, move/swap interaction enabled) preceded by a single brand-restraint eyebrow `LATER — STILL FLEXIBLE`
- Single-week expansion at a time — state `expandedLaterWeek: number | null` held in `PlanCalendar`
- Tapping the eyebrow collapses; navigating away resets (state is component-local)
- Past-week strips remain read-only (`onTap` is never passed) — the chevron is the affordance, and read-only past data has no use for it
- Motion: `zonna-fade-in 0.18s ease-out` on the expanded wrapper; no spinner, no height-morph

Reference: `components/training/PlanCalendar.tsx` → `WeekStripCard`.

---

### 23. PlanSectionLabel

Group header between week clusters on the Plan screen (`Past / Now / Next / Later`). Names the user's position in the plan arc explicitly so the calendar reads as a story rather than a flat list.

```
NOW                                    7 weeks    ← right-side count optional
```

**Structure:**
- Wrapper: `display: flex, justify-between, baseline`, `padding: 0 4px`, `margin-top: 18px`
- Label: `11px 700 --mute uppercase 0.12em` (slightly louder than the generic SectionLabel at 10px — these headers carry more weight on the Plan screen)
- Optional right-side count: `10px --mute 0.04em` — shown only on "Later" to signal how many weeks the strip cards cover

**Rules:**
- Only used on the Plan screen — for cross-screen eyebrow / category labels, use Pattern 17 (SectionLabel)
- Always placed *between* week-card groups, never above the first card
- The Past header only renders when past weeks are expanded

Reference: `components/training/PlanCalendar.tsx` → `PlanSectionLabel`.

---

### 24. Plan Voice Card (slim variant of CoachNoteBlock)

Inline this-week coaching surface on the Plan screen. Sibling to `PlanCoachingCard` (Coach screen) — both share the same derivation helpers (`buildWeekVoiceContext`, `getWeekVoiceHeadline`, `getWeekVoiceItems` in `DashboardClient.tsx`) but render differently for their context.

```
┌─────────────────────────────────────────────┐
│ ▌ THIS WEEK                            BUILD │
│   Quality and long run this week. Hard stuff │
│   first, long stuff rested.                 │
│   Run the quality session when fresh — not  │
│   back-to-back with another hard day.       │
│   The long run should be Zone 2 only.       │
└─────────────────────────────────────────────┘
```

**Structure:**
- `--card` bg, `1px solid --line` border, `var(--radius-lg)` radius
- 3px `--moss` left rail (coaching-surface signal) — positioned at `left: 8px`, vertical inset matches padding
- Padding: `14px 16px 14px 19px` (extra left padding to clear the rail)
- Eyebrow row: `10px 700 --mute uppercase 0.08em` "THIS WEEK" left, phase chip `10px 700 --moss uppercase 0.08em` right (e.g. "BUILD")
- Headline: `15px 600 --ink -0.01em` line-height 1.4
- Items: `12px 400 --ink-2` line-height 1.55, gap 6px between items
- Max 2 items on this surface (Coach screen's `PlanCoachingCard` shows 3)

**Provenance rule (critical) — tier-divergent (PLAN-VOICE-AI, shipped 2026-05-20):**

| Tier | Source | Eyebrow |
|---|---|---|
| Free | Rule-engine (`buildWeekVoiceContext` + `getWeekVoiceHeadline` + `getWeekVoiceItems`) | "THIS WEEK" label — no byline (provenance honesty per §16/§16b) |
| Trial / Paid (ready) | AI via `POST /api/plan-weekly-note` (Haiku, cached per `user_id × week_n`) | `<CoachByline color="moss" role="This week" onClick={→ Coach} />` |
| Trial / Paid (loading) | Skeleton placeholder lines matching final shape (no reflow) | `<CoachByline color="moss" role="This week" working onClick={→ Coach} />` — the pulsing sparkle replaces any spinner |
| Trial / Paid (failure) | Silent fallback to rule-engine (ADR-006) | Same as Free row |

The 3px moss left rail is the **canonical AI-card rail** (Pattern 16b) for paid users, and a coaching-surface accent for free users — same colour token either way, single visual rule across tiers. Continuity per AI-DEPTH-04/10: the most recent prior weekly note feeds the prompt with the "reference at most once when this week tracks against it" rule. Cache is invalidated en bloc on any plan save (`lib/plan.ts → savePlanForUser`) so a regenerated plan never narrates sessions that no longer exist; the next Plan-screen view regenerates against the new session shape.

**Rules:**
- Render only when there's a current week in the plan (skip if `getCurrentWeekIndex` doesn't resolve)
- The headline + items come from the *current* week — not next week, not whichever week is in view via the Plan screen's date strip

Reference: `app/dashboard/DashboardClient.tsx` → `PlanScreen` (inline JSX; not extracted to its own component because it depends on `Plan` + `Week` shapes that other Plan-screen components also derive locally).

---

### 24b. PlanIntroCard — free "why this plan" intro (CA-01)

The free-tier counterpart to the per-week Plan Voice Card (§24). A plan-*level* one-line intro in Kit's voice, generated once on a free user's **first plan** (the "wedge moment" fix — otherwise free users get zero AI voice). Distinct from the paid `coach_intro` (2–3 sentences + confidence); the two never co-exist on a plan.

```
┌─────────────────────────────────────────────┐
│ ▌ [K✦] Kit                                   │  ← 3px moss rail + CoachByline
│        WHY THIS PLAN                         │
│   Twelve weeks to your 10K. The work is in   │
│   holding your easy days easy — that's where │
│   the speed actually comes from.             │
└─────────────────────────────────────────────┘
```

**Structure:** identical shell to §24 — `--card` bg, `1px --line` border, `--radius-lg`, 3px `--moss` left rail at `left: 8px`, padding `14px 16px 14px 19px`. Eyebrow is always `<CoachByline color="moss" role="Why this plan" />` (model output → byline required). Body: `14px 400 --ink-2`, line-height 1.6.

**Provenance:** always genuine model output (`meta.plan_intro`, Haiku). Never render rule-engine or hand-authored copy through this card.

**Where it renders:** the generation preview (`GeneratePlanScreen`) and the top of the saved Plan screen (`DashboardClient → PlanScreen`, above the §24 "This week" card). Single field, two read sites; persists in `meta.plan_intro` across save/reload.

**Source:** the field is set in `app/api/generate-plan/route.ts` (free branch, first-plan only) via `lib/plan/freeIntro.ts` — **not** the enricher. Silent fallback (ADR-006): on any AI failure the field is simply absent and the card doesn't render.

Reference: `components/shared/PlanIntroCard.tsx`

---

### 25. ZoneRings

Brand-mark-as-data-display. The four concentric rings of the Zonna logo each represent one HR zone bucket for the week — Z1 outer through Z4-5 inner — arc-filled to the % time the runner spent in that zone. The moss centre dot is brand-constant; it never reflects data. The logo becomes functional UI on a single screen (Coach), localised on purpose so the brand mark elsewhere (login, OG cards, marketing) stays stable.

**Live (paid/trial + ≥1 analysed run):**

```
┌─────────────────────────────────────────────┐
│  THIS WEEK IN ZONES        across 3 runs    │
│                                             │
│             ╭─── Z1 ───╮                    │
│            ╱ ╭── Z2 ──╮ ╲                   │
│           │ │ ╭─Z3─╮ │ │                    │
│           │ │ │ ● │ │ │   ← --moss centre   │
│            ╲ ╰────╯ ╱                       │
│             ╰──────╯                        │
│                                             │
│   Z1     Z2     Z3     Z4-5                 │
│   8%    62%    22%      8%                  │
└─────────────────────────────────────────────┘
```

**Pending / locked / skeleton:** all three render the same ring geometry with no arc fill — the logo silhouette is preserved at every state. Pending uses `--card` background with the moss dot muted; locked uses `--bg-soft` + an "Unlock view →" moss text link; the skeleton is the loading shell used during the brief window between completion and `run_analysis` row landing.

**Structure:**
- Background: `--card` (live/pending) or `--bg-soft` (locked); border `1px solid --line`; radius `var(--radius-lg)`; padding `20px`
- Eyebrow row: `10px 700 --mute uppercase 0.08em` left, meta `10px 400 --mute` right (live only)
- SVG: 160×160 viewBox, centred. Four rings, stroke width `9`, gap `4` between adjacent rings. Track stroke `--line`. Coloured arc starts at 12 o'clock, grows clockwise, `strokeLinecap: round`
- Centre dot: `r=7`, fill `--moss` (live) or `--mute` 0.4 opacity (pending/locked)
- Numeric strip (live only): 4-up flex, each cell `9px 700 colour uppercase 0.10em` label above `15px 700 --ink tabular-nums` value (small `--mute` "%" trailing)

**Ring → zone → colour mapping** (consistent with Pattern 21 ZoneBar):

| Ring  | Zone  | Colour token |
|-------|-------|--------------|
| Outer | Z1    | `--s-recov`  |
| Next  | Z2    | `--s-easy`   |
| Next  | Z3    | `--s-quality`|
| Inner | Z4-5  | `--s-inter`  |

**Why arc-fill, not stroke-thickness:** thickness-as-percentage distorts the brand mark's silhouette (a low-Z1-time week would have a noticeably "thinner" outer ring). Arc-fill keeps every ring's shape intact and only the *coverage* varies. The mark stays identifiable at any data shape.

**Why Z1 outer, Z4-5 inner:** the majority of a healthy training week should sit in Z1/Z2. Putting easier zones on the outside means the visually-dominant rings reflect the right way to train, and matches the brand mark's natural emphasis on its outer geometry.

**Data source:**
- Live percentages from `run_analysis.hr_pct_z1` / `z2` / `z3` / `z4_5` — load-km weighted across the week's completed analysed runs (same weighting as Pattern 11's discipline score, so the two never disagree about which session weighed what).
- Columns added in migration `20260527_run_analysis_zone_histogram.sql` (mirrors the histogram from `strava_activities` with a backfill from historical rows).
- Coach screen is paid-gated at the screen level — only live/pending/skeleton states render on Coach; no locked state needed there.

**Props (discriminated union):**
```tsx
// Live (default — state omitted ⇒ live)
{ state?: 'live'; label?: string; pctByZone: { z1: number; z2: number; z3: number; z45: number }; meta?: string }
// Pending
{ state: 'pending'; label?: string }
// Locked
{ state: 'locked'; label?: string; onUpgrade?: () => void }
```

`label` defaults to `'This week in zones'` across all states.

**Tradeoff explicitly accepted:** turning the brand mark into a data display means the logo shape-shifts user-to-user on the Coach screen. The mark elsewhere stays static. Two presences for one mark — a brand-consistency cost that's localised to one screen on purpose.

Reference: `components/shared/ZoneRings.tsx`. Integration: `app/dashboard/DashboardClient.tsx` → `CoachScreen` (below the Stats 2×2 grid, Pattern 19).

---

### 29. TrendCard

Multi-month aerobic trend card. Shows how avg HR on same-effort long runs has changed over a window (default 6 months). The metric pair is formula-derived; the gloss sentence is model-written (CoachByline + 3px moss left rail). Two-metric variant of Pattern 11 (RestraintCard).

**Four states:**

```
LIVE:
┌─────────────────────────────────────────────┐
│  AEROBIC TREND     across 14 long runs · 6w  │  ← eyebrow
│                                              │
│  166          →         149                  │  ← 44px 800 tabular-nums
│  Feb avg                now                  │  ← 13px 400 --mute
│                                              │
│ ▌ [K✦] Kit                                   │  ← 3px moss rail + CoachByline
│ ▌      AEROBIC TREND                         │
│ ▌                                            │
│ ▌ Long run at 5:40/km. Easy is easier        │  ← 13px 400 --ink-2 AI gloss
│ ▌ than it was.                               │
└─────────────────────────────────────────────┘

PENDING (< MIN_BUCKETS data):
  muted —/— metrics, hand-authored pending copy, tap to open explanation sheet.

LOCKED (free tier):
  --bg-soft, muted —/—, "The receipt for your easy days.", moss CTA "Unlock trend →"

SKELETON:
  shimmer placeholders matching live shape, <CoachByline working /> pulsing.
```

**Behavioural design:**
- Count-up animation (ease-out cubic, 600ms) on both HR values at first mount — makes the data feel earned, not loaded
- Gloss fades in (200ms) after count-up completes
- Tap anywhere → slide-up explanation sheet (Pattern 19 keyframes)
- No chart — two numbers, one sentence. The brand constraint is the feature.

**Provenance (critical):**
- Numbers → formula-derived → **no AIMark** on the metric pair
- Gloss sentence → model-written → `<CoachByline color="moss" role="Aerobic trend" />` + 3px moss left rail on the AI section only
- Rail starts at the border dividing the metric pair from the AI section — not over the numbers

**Placement on Coach (CO-ONE):** numbers-only via `glossless` prop. The gloss + CoachByline are stripped so Coach carries exactly one Kit voice (the consolidated read at the top). Trend interpretation folds into that read as a templated sentence ("Easy is easier than it was — 166 down to 149 since Feb.") when the trend engine returns a live gloss. Off-Coach (any future surface), the gloss path remains available — `glossless` is opt-in.

**Tier-divergent header:**
```tsx
// TIER-DIVERGENT — FREE:  locked state, upgrade CTA, hand-authored body
//                  PAID:  live/pending/skeleton states, AI gloss for live
//                  CO-ONE: pass `glossless` on Coach to suppress the AI section
```

**Props (discriminated union):**
```tsx
{ state: 'live';     earlierMonth, earlierHr, nowHr, cohortSize, windowMonths, gloss?, glossless? }
{ state: 'pending'  }
{ state: 'locked';   onUpgrade? }
{ state: 'skeleton' }
```

**Empty-state rule:** pending renders the card body (educates the user); locked renders the locked shell. Neither hides the card entirely — the slot has value even before the signal arrives. The live card silently suppresses when `hrIsTrending === false` (pending instead of live) so noisy non-trends never surface.

Reference: `components/shared/TrendCard.tsx`. Route: `GET /api/coaching/trend?include_gloss=true`. Prompt: `lib/coaching/prompts/aerobicTrend.ts`.

### 26. Voice Anchor Strip

Single-line moss anchor — no card chrome, no border, no eyebrow. Used on the Today screen in place of the (now retired) Today RestraintCard slot. Earns presence through typography weight and the moss colour, not surface chrome.

```
   Hold the zone.
```

**Source:** `BRAND.voiceAnchor` (`lib/brand.ts` → `"Hold the zone."`). Never hardcoded.

**Structure:**
- Padding `18px 16px 0` (sits between the wordmark row and the session card; aligns to the same 16px horizontal gutter)
- Typography: `13px 600 --moss`, letter-spacing `-0.005em`, line-height `1.3`
- No background, no border, no card

**Why no card:** Today is about *today*; the brand line is anchor, not metric. Wrapping it in card chrome would imply a measurement. The unboxed moss line reads as voice — Kit speaking, not Kit measuring.

**Rules:**
- Single screen only (Today). On Coach the metric does the same job through Pattern 25 ZoneRings; doubling the voice line would be noise.
- Never combine with other copy on the same row — the line has to breathe.
- Always uses `BRAND.voiceAnchor`. Don't rephrase. If the anchor string changes, every surface picks up the new value at once.

Reference: `app/dashboard/DashboardClient.tsx` → `TodayScreen` (ZONE-VIS-02 block, replacing the prior RestraintCard wrapper).

---

### 27. NotificationBell

The bell affordance for the notification inbox (NOTIF-01). Lives top-right on the Today screen's wordmark row — home is where users land, and the most frequent push (daily training) already deep-links to Today. A bell icon is justified under "no icons unless they carry unique meaning": it's the universally-understood notifications affordance with no compact text equivalent. ⚠️ **That rule is now ICON-RULE-01** — "unique meaning" was the whole test until 2026-09-22, when the board added a second, narrower gate for FINDING on long lists. The bell still qualifies under the first.

```
ZONNA ●                         🔔 ●     ← moss unread dot, top-right of glyph
```

**Structure:**
- 44×44 tap target (iOS HIG); 22px stroke-bell glyph, `--ink-2` stroke.
- Unread indicator: `8px --moss` dot, `1.5px solid --bg` ring so it reads cleanly over the glyph. **No number badge** — calm over count ("calm guidance, not alerts").
- On the wordmark row, wrap in a `margin: -11px -10px -11px 0` box so the 44px target doesn't balloon the row height.

**Rules:**
- **Paid/trial only.** Free users can't have notifications — render nothing (`hasPaidAccess && onOpenNotifications`).
- Unread count is owned by `DashboardClient` (fetched at load, refreshed on app-resume via `visibilitychange`); opening the inbox optimistically zeroes it.

Reference: `components/shared/NotificationBell.tsx`.

---

### 28. NotificationRow

One row in the notification inbox. Read-only delivery record — the *envelope*, not the AI content surface.

```
┌─────────────────────────────────────────────┐
│ ▌ PLAN ADJUSTED                     2h ago ● │  ← rail-coloured eyebrow · time · unread dot
│   Plan's been shifted.                      │  ← title (bold)
│   Thursday's long run moved to Saturday.    │  ← body (muted, 2-line clamp)
└─────────────────────────────────────────────┘
```

**Structure:**
- Standalone card: `--card`, `1px solid --line`, `var(--radius-lg)`, padding `13px 16px 14px 18px` (extra left clears the rail), min-height 64px. 8px gap between rows; grouped under SectionLabels (`Today` / `Earlier`).
- **3px left rail — two-colour system:** `--warn` for `plan_adjustment` (design system reserves warn for coaching/adjustment surfaces), `--moss` for every other type (Kit's voice).
- Eyebrow: short type label, `10px 700 uppercase 0.08em`, in the rail colour. Map: `daily_training`→"Today's session", `weekly_report`→"Your week", `trial_insight`→"Kit noticed", `run_feedback`→"Run logged", `plan_adjustment`→"Plan adjusted".
- Title: `13px 600` — `--ink` unread, `--mute` read. Body: `12px 400 --mute`, 2-line clamp. Time: `11px --mute-2`. Unread dot: `8px --moss`.

**Provenance rule (deliberate):** rows carry **NO AIMark / CoachByline**. Most copy is rule/hand-authored, and the deep-link target (Coach, Session detail) already carries the proper byline (§16/§16b). Marking rows would violate provenance honesty and add noise.

**NotificationsScreen** (inline in `DashboardClient`): back arrow top-left → Today; `ScreenHeader title="Notifications"`; Today/Earlier `SectionLabel` groups; static skeleton rows while loading (no spinner, matches existing skeletons); Pattern 8 empty state ("Nothing from Kit yet."). Opening marks all rows read (clears the bell); loaded rows keep their unread styling for the current view.

Reference: `components/shared/NotificationRow.tsx`; `DashboardClient.tsx` → `NotificationsScreen`.

---

### 30. PullToRefresh

The dashboard's manual refresh gesture (PTR-01). Wraps the single dashboard scroll container so all four primary screens (Today / Plan / Coach / Me) share one implementation. Honest use case: the post-run window — pull to force a HealthKit sync + re-fetch so a just-finished run's verdict appears without backgrounding the app.

```
        ●                              ← neutral moss dot, pulses while refreshing
   ─────────────                       ← revealed gap (content translated down)
   Up to date.                         ← calm, always-true confirmation on success
```

**Structure:**
- A neutral `9px --moss` **dot** in the revealed gap above the content. Opacity + scale track pull progress; past threshold it's full.
- **Refreshing state pulses** (`zonna-ptr-pulse` keyframe in `globals.css`) — never spins. This is the sanctioned substitute for the banned spinner (same rationale as `ai-mark-pulse`), **but deliberately NOT the AIMark sparkle**: a data refresh is not model output, so borrowing the AI-provenance glyph would violate provenance honesty (§16).
- Content is translated down by the (resistance-damped) pull distance; the dot lives in the gap.

**Interaction:**
- Engages only from `scrollTop <= 0`, on a predominantly **vertical, downward** drag. Axis lock releases horizontal intent so the week strip (§22) is unaffected, and releases upward drags.
- Thresholds: arm at 72px, resistance ceiling 104px, damping 0.5. State machine: `idle → pulling → armed → refreshing → done | error → idle`.
- `touchmove` is bound **non-passive** to `preventDefault` while pulling; when not pulling it early-returns and normal scroll is untouched.

**Copy (brand — restraint, not novelty):** the completion state is a **two-line beat** — `"Up to date."` over `"Nothing to chase."` — held long enough to read (1200ms), not a whisper. It points at *release* (nothing left to fetch), **never at the next assignment**: this app treats over-triers, so the caught-up state should let you put the phone down, not hand you the next task (deliberately Rory-over-Wood — release, not re-engagement). The gesture *teaches* restraint rather than manufacturing something-new-every-pull. Error (offline) is `"Couldn't refresh."` in `--mute`, **never red** (§INV-DS-005). The beat lives inside the pull affordance and retracts with the gesture — never a self-dismissing toast (N-004). Respects `prefers-reduced-motion` (static dot).

**States (Complete):** idle · pulling · armed · refreshing (pulse) · done (two-line "Up to date." / "Nothing to chase.", 1200ms) · error ("Couldn't refresh.", 1200ms) · disabled (inert during onboarding / before `appReady` / on non-primary screens).

**Ownership:** the consumer passes its existing scroll ref (so scroll-to-top on screen change keeps working) and owns `onRefresh` (resolve = success, throw = error). `PullToRefresh` is a pure gesture + indicator; it never fetches.

Reference: `components/shared/PullToRefresh.tsx`; contract at `docs/contracts/components/pull-to-refresh.md`; consumer `DashboardClient.tsx` → `handleRefresh`.

---

## Form Fields & Pickers

The canonical user-input controls. **Never build a one-off input, toggle, chip, or time entry inline** — reach for one of these. Before this section existed, the same quantities (a time, a heart rate, an effort) were collected 2–3 different ways across screens; these primitives end that drift. Each lives in `components/shared/` and uses Warm Slate tokens only.

**Match the control to the nature of the quantity** — this is the rule that decides which one to use:

| Quantity | Nature | Control |
|---|---|---|
| Free text, email, password, name, a precise number typed exactly (HR, TT distance) | Objective, typed | **TextField** |
| A bounded number the runner *estimates* (weekly volume, longest run) | Continuous but stepped | **Ruler** |
| A time — finish time, target time, duration | Objective, precise, ranged | **DurationPicker** (wheels) — **always hrs : min : sec**, see below |
| Effort / RPE | Subjective, low-precision | **RPEScale** (Pattern 13) |
| One of 2–4 mutually-exclusive modes (km/mi, sign-in/up, distance/duration) | Toggle | **SegmentedControl** |
| One (or several) of a larger set — injuries, training-age bands, benchmark type | Compact select | **Chip** |
| One of a few rich options, each earning a sentence (goal, terrain, race distance) | Single-select radio cards | **CardSelect** |
| Days of the week — a plain multi/single day pick | Fixed 7-item select | **DayGridSelector** |
| A whole training week — which days run, which is the long run | Per-day Rest/Run/Long grid | **WeekGrid** |

### Chip or CardSelect? — the deciding question (2026-09-07)

Count is not the rule, and treating it as one is what let the wizard drift. Both
controls are single-select from a small set; the table above separates them on
*"each earning a sentence"*, which is the right idea stated too softly to settle an
argument. Three questions, in order — **any one "yes" means CardSelect**:

1. **Can a reasonable runner pick the wrong option because the label alone doesn't
   tell them what it means?** A self-assessment ("Where are you right now?") can.
   An ordinal fact ("< 6 months / 2–5 years") cannot.
2. **Does the answer change the SHAPE of the plan rather than a number in it?**
   Volume moves a number. Readiness moves whether quality starts in week 3 or
   week 5. Shape-changing answers get the space to explain themselves.
3. **Is the option set a judgement rather than a measurement?** Judgements need
   the sentence; measurements read fine as bare labels.

Chip stays correct — and is *preferred* — for ordinal scales with self-evident
labels (training age), multi-select from a longer list (injuries), and binary-ish
picks (benchmark type, Sat/Sun long-run day). **Wrapping those in CardSelect is
padding**, and a screen of four cards saying "< 6 months" with nothing underneath
reads as a template, not a decision.

> **Inconsistent-on-purpose is fine. Inconsistent-by-accident is the defect.**
> The wizard deliberately runs several control idioms because it asks several
> kinds of question. What it may not do is ask two questions of the *same kind*
> two different ways — which is exactly what the inventory below exists to catch.

### Wizard step inventory — control per step, and why

The full sequence, so a new step can be placed by comparison instead of by guess.
Keep this in sync with `getStepSequence` in `GeneratePlanScreen.tsx`.

| Step | Question | Control | Why |
|---|---|---|---|
| `distance` | How far? | **CardSelect** (tile) | Judgement, and each option carries a distance + lock state |
| `race-details` | Race name / date | **TextField** | Objective, typed |
| `goal` | What matters most? | **CardSelect** | Judgement — "finish" vs "time" reframes the whole plan |
| `target-time` | What's the target? | **DurationPicker** | A time |
| `teach-easy` | *(interstitial)* | **Interstitial** | Teaching seam, no input |
| `weekly-volume` | How much are you running now? | **Ruler** | Bounded estimate, stepped |
| `longest-run` | Longest run in six weeks? | **Ruler** | Bounded estimate, stepped |
| `training-age` | How long have you been at this? | **Chip** | Ordinal scale, labels self-evident — Q1/Q2/Q3 all "no" |
| `recent-quality` | Been doing the hard stuff? | **CardSelect** | **Q1 and Q2 both "yes"** — a self-assessment that gates §89/§91 quality onset |
| `your-level` | Where are you right now? | **CardSelect** | Self-assessment, carries a recommendation and an override warning |
| `birth-year` | What year were you born? | **WheelPicker** | A bounded number from a long ordered list |
| `benchmark` | Recent race result? | **Chip** + **TextField** + **DurationPicker** | Type is a binary pick; the result is typed |
| `teach-easy-day` | *(interstitial)* | **Interstitial** | Teaching seam |
| `your-week` | Which days do you run? | **WeekGrid** | A whole week, not a list |
| `weekday-ceiling` | How long on a weekday? | **Chip** | Ordinal minutes, labels self-evident |
| `hard-sessions` | You and hard sessions | **CardSelect** | Judgement about self |
| `terrain` | Where do you run? | **CardSelect** | Judgement, each option changes pace targets |
| `injuries` | Anything to flag? | **Chip** (multi) | Multi-select from a longer list |

**`recent-quality` was the one miss**, corrected 2026-09-07. It shipped as three
bare chips — *Mostly easy / Here and there / Most weeks* — while `your-level`, the
very next step and the same kind of question, got the full card treatment. It is
also the highest-stakes answer in the wizard: it is the demonstrated-readiness
signal §89 gates on, so a careless tap moves the runner's first quality session by
two weeks. That is the definition of a Q1+Q2 "yes".

**The labels stay neutral descriptions of past practice** — recognition, never an
unlock. No option may be phrased as a reward, a tier, or a thing to qualify for
(standing SLT framing guardrail; see the `RECENT_QUALITY_CHIPS` note in
`GeneratePlanScreen.tsx`). The sub-lines describe what the runner has *been doing*,
past tense, and nothing describes what they get for it.

### TextField (`components/shared/TextField.tsx`)

The single text/number/email/password/date input. Two rules are enforced inside it so they can never regress:
1. **`fontSize` is locked at 16px.** iOS zooms any focused input below 16px and the `maximum-scale=1` viewport then traps the user zoomed in. This is not negotiable per-field — the primitive owns it.
2. **Warm Slate tokens only** — `--bg-soft` fill, `--line` border, `--ink` text, `--radius-md` radius. No legacy System-B aliases.

- Optional `unit` prop renders a right-aligned suffix *inside* the field (e.g. "bpm") — use this instead of an absolutely-positioned span. Unit is a suffix, never a placeholder.
- `readOnly` switches to `--bg`/`--mute` and a default cursor (e.g. the Profile email).
- Wrap with a `labelStyle` eyebrow above; the field carries no label itself.

```tsx
<TextField type="number" inputMode="numeric" unit="bpm" placeholder="188" value={mhr} onChange={setMhr} />
```

There is no separate "NumberStepper" — a numeric value is a `TextField type="number"` with a `unit`. The only +/− stepper is DurationPicker (time).

### DurationPicker (`components/shared/DurationPicker.tsx`)

The canonical time entry — scroll **wheels** (hrs : min : sec), no keyboard, no format-guessing, no zoom. `showSeconds` adds a third wheel (default off): use it for **race finish times**, where a short race is minutes:seconds and the seconds decide a PB. Target/benchmark times stay HH:MM. `showHours={false}` drops the hours column for a **minutes:seconds** picker and runs the minutes wheel `0..maxMins` (default 90) so a slow 10K past 59 min is still reachable — used by the **5K/10K time-trial result** (RecalibrationEntryScreen). Composes `WheelPicker` columns internally; its public API (`hours`/`mins`/`secs` + `on*Change`, `maxHours`, `showSeconds`, `showHours`, `maxMins`) means callers never hand-roll a time control. **Every time/duration control in the app goes through it** (FORMS-PRIM-01): wizard target time, benchmark, race finish (RaceResultSheet), manual run log (DashboardClient), and the time-trial result. There is no bespoke hrs/min/sec stepper left.

- Anchor it: pre-fill from a known value (e.g. the plan's goal time) so most users *nudge* rather than spin from zero — the power of defaults applied to the highest-emotion input.

```tsx
<DurationPicker hours={h} mins={m} secs={s} onHoursChange={setH} onMinsChange={setM} onSecsChange={setS} showSeconds />
```

### WheelPicker (`components/shared/WheelPicker.tsx`)

The atom behind DurationPicker — one scroll-snap wheel column over a list of numbers. iOS-style: drag the strip, the value under the centre band is selected. Controlled (`values`, `value`, `onChange`, optional `format`, `rowHeight`, `visibleRows`). Scroll↔index math is pure in `WheelPicker.logic.ts` (node-tested); the loop between "scroll settles → onChange" and "value changes → scroll to it" is broken by suppressing the settle during a programmatic scroll and only re-scrolling when the strip isn't already there.

- **Reach for `DurationPicker` for time**, not this directly. Use `WheelPicker` alone only for a genuinely one-off single-wheel numeric where a Ruler (drag) or Chip (discrete set) is the wrong feel.
- The centre band is the only affordance; the scroll track is hidden via `.wheel-scroll` in `globals.css`.

### SegmentedControl (`components/shared/SegmentedControl.tsx`)

Contained-track toggle for 2–4 mutually-exclusive options. One idiom for login mode, km/mi, and distance/duration (previously two divergent toggle styles). Full-width by default; wrap in a fixed-width box for compact right-aligned settings rows.

```tsx
<SegmentedControl value={units} onChange={setUnits} options={[{value:'km',label:'KM'},{value:'mi',label:'MI'}]} />
```

### Chip (`components/shared/Chip.tsx`)

Stateless select-chip for choosing from a set. Single-select (caller tracks one active value) or multi-select (caller tracks a Set). `--moss` border + `--moss-soft` fill when active. Used for race distances, injuries, benchmark type, training-age bands.

### CardSelect (`components/shared/CardSelect.tsx`)

The canonical single-choice radio card — a large tappable card with a label, optional sub-line, and a moss active state. Two layouts:

- **`row`** (default) — full-width, sub stacked under the label. For a handful of options that each earn a sentence: goal, terrain, hard-session relationship. (This is the extracted wizard-local `OptionCard`.)
- **`tile`** — grid cell, vertical, optional lock badge top-right. For a 2-column picker: race distance.

Rules:
- Stateless; the caller owns selection and wraps the options in its own grid/stack container, then maps (same idiom as `<Chip>`).
- `locked` is **visual only** (dim + `lockLabel` badge). The caller decides what a tap does when locked — e.g. the distance picker routes a locked tap to upgrade. The primitive never swallows the handler.
- **Not for a control that carries validation state** (blocked / warn, like days-per-week) — keep those bespoke. CardSelect is a plain radio card by design.
- For a compact select from a larger set (injuries) use `<Chip>`.

```tsx
<CardSelect label="Just finish." sub="Get to the line in one piece." active={goal === 'finish'} onClick={() => setGoal('finish')} />
<CardSelect layout="tile" label="Marathon" sub="42.2 km" active={dist === 42.2} locked={!paid} lockLabel="PAID" onClick={...} />
```

**Consumers** (single-select label+sub radio cards — use CardSelect, don't rebuild): the wizard goal / terrain / hard-session pickers (`GeneratePlanScreen`), and the post-race sheet's **outcome** (pb / on_target / off_target / dnf) and **maintenance-intent** (rest / tick_over / stay_sharp) pickers (`RaceResultSheet`). The sheet pickers previously carried a bespoke leading radio-dot; that was dropped in favour of CardSelect's canonical moss active state (border + `--moss-soft` fill + moss label) — the dot was redundant chrome and a source of the drift these primitives exist to kill. **The moss active state is the only "selected" affordance; do not re-add a radio dot.**

**Deliberate non-consumer — `NextGoalCard`** (`components/training/NextGoalCard.tsx`): the post-race "what's next" goal ladder looks card-shaped but is **not** a CardSelect. It's an action/nav ladder — tapping a row navigates into the wizard, there is no persistent selected state — and it's race-themed (`--s-race` rail + inline `--s-race` target time + trailing → arrow), the opposite of CardSelect's moss radio language. Folding it in would need a nav-arrow + coloured-inline-value slot used by no other consumer, which is exactly the one-off bloat CardSelect avoids. It stays bespoke.

### Which numeric control? *(Design Board 2026-09-25, `STEPPER-CONTROL-01`)*

**One table, because the routing already existed in prose and was not being read.**

| The runner… | Control |
|---|---|
| **estimates** a bounded quantity (weekly volume, longest recent run) | `Ruler` |
| enters a **time or duration** | `DurationPicker` — every one, no exceptions (`FORMS-PRIM-01`) |
| **knows** a precise number (HR, a logged distance, a TT distance) | **`TextField`** |
| picks from a small discrete set | `Chip` / `SegmentedControl` / `CardSelect` |

🔴 **THERE IS NO `Stepper`, AND THAT IS A RULING, NOT AN OMISSION.** One was proposed for the manual
run log's distance and **declined**: § Ruler already routes *"a precise typed number… that's
`TextField`"*, and authoring a fifth numeric control for one screen's two fields is the mis-scoping
this system has hit repeatedly. ⚠️ **Not permanent** — it reopens if the swap proves wrong on a
device.

⚠️ **The manual run log still has a `+`/`−` stepper for distance and it is NOT the pattern.** It
costs **22 taps to log a 21.1 km run** and starts at zero with no keyboard route. The board declined
to swap it **blind**: a `type="number"` brings the iOS numeric keyboard and the focus-zoom trap this
file already carries a comment about, and precedent `:767` (the race-date input) is that the chair
will not rule on a native-input swap **without a device**. **The tap cost is accepted on the record,
not overlooked.** What did ship: the value is now announced (`role="spinbutton"` + `aria-valuenow`
on the readout, not the buttons) and the four legacy aliases are gone.

### Ruler (`components/shared/Ruler.tsx`)

The canonical bounded/stepped numeric input — a horizontal draggable ruler with a large value readout above (metric-pair), tick marks, and a min→max scale. For a self-reported quantity the runner *estimates* rather than knows exactly: weekly volume, longest recent run.

- **Stepped, not per-unit** (Coaching Board 2026-08-30): the value snaps to a sensible increment (weekly 5 km, longest run 1 km) so the input reads as an honest "about 35", never a false-precision 37. Bounds + step come from `GENERATION_CONFIG.WIZARD_VOLUME_RULER` — never hardcode them. Replaced the old coarse `Chip` bands, whose forced midpoints were *worse* estimates (a 25 km runner bucketed to 30). See `CoachingPrinciples §18`.
- **`value` is nullable.** Untouched → muted `–` readout, thumb resting at `restAnchor`; the runner must engage before the field counts as set. This preserves the honest-input stance — a default they blew past is not a self-report.
- **Interaction:** a transparent native `<input type="range">` is the real control (touch-drag, keyboard, screen-reader for free); the ticks/thumb/readout are painted over it. Pure math (`clamp`/`snap`/`thumbPercent`/`ticks`/`scaleLabels`) lives in `Ruler.logic.ts`, node-tested.
- **Not for a precise typed number** (HR, a TT distance you know exactly) — that's `TextField`. The Ruler is for a bounded estimate.
- Units: `unit` is a display suffix only; the Ruler operates in the wire unit (km). Per-user mi display is deferred to the ADR-015 format layer.

```tsx
<Ruler value={weeklyKm} onChange={setWeeklyKm}
  min={CFG.WEEKLY_KM_MIN} max={CFG.WEEKLY_KM_MAX} step={CFG.WEEKLY_KM_STEP}
  restAnchor={CFG.WEEKLY_KM_ANCHOR} unit="km/week" caption="Last four weeks, roughly." />
```

### DayGridSelector (`components/shared/DayGridSelector.tsx`)

The canonical Mon–Sun day-of-week selector — one row of seven 44×44 circular targets. Multi-select (which days you can't train) by default; `multiple={false}` for a single-day choice (tap-again clears). Stateless; the caller owns `value`.

- Speaks the canonical 3-letter `DayKey` (`'mon'…'sun'`, matching `lib/plan/effectiveSessions`). A caller that persists a different wire format maps at its own boundary — the wizard's `days_cannot_train` stays full-word (`'monday'`), so `GeneratePlanScreen` translates `DayKey` ⇄ full word at the call site. The primitive never emits full words.
- Owns the Mon–Sun label + order (`DAY_GRID`). Result is always returned in canonical order regardless of tap order.
- For a **2-option** day choice (Sat/Sun long-run day) use `<Chip>` — a seven-day grid is the wrong weight for two options.
- For a whole **training week** (run days + the long run in one control) use `<WeekGrid>` — the wizard's "days you can't train" was absorbed there. DayGridSelector remains the canonical control for a plain binary day pick.

```tsx
<DayGridSelector value={blockedDays} onChange={setBlockedDays} ariaLabel="Days you can never train" />
```

### WeekGrid (`components/shared/WeekGrid.tsx`)

The keystone "your week" control — a row of seven day cells, each tapped to cycle **Rest → Run → Long** (Long weekend-only on first ship; one long across the week). Absorbs the old two scheduling steps (days-per-week + days-you-can't-train) into one tactile grid: *which* days, honestly, not *how many*, aspirationally.

- Stateless; the caller owns a `WeekPlan` (`Record<DayKey, 'rest'|'run'|'long'>`). The grid → `GeneratorInput` mapping (`days_available` = run+long count, `days_cannot_train` = rest days, `preferred_long_run_day` = the long day) is pure and node-tested in `WeekGrid.logic → weekPlanToInputs`. **This is the wizard's one engine touch** — a client-side mapping onto the existing input contract, no engine code changed.
- The long cell carries the `--s-long` accent (ties to the long-run session colour).
- First ship constrains Long to Sat/Sun (matches the current engine); weekday-long-run is a fast-follow behind the `preferred_long_run_day` widening.

### DayBudgetRows (`components/shared/DayBudgetRows.tsx`)

Same family as WeekGrid, one step later. The grid answers *which* days; this answers *how long* on each weekday the runner actually runs (UX-WIZARD-01 Stage C). Rendered on the `weekday-ceiling` substep, directly under the `MAX_WEEKDAY_CHIPS` cap — **progressive disclosure**: the chips set the weekday default in one tap; these rows refine it per day only for the runner with an uneven week.

- **Tap-to-cycle rows, not chips-per-day.** Seven chips × five weekday rows would be thirty-five controls on one calm screen. Each row cycles through the cap options (`{value,label}[]`, reusing `MAX_WEEKDAY_CHIPS` minus "No limit"), mirroring the grid's own idiom the runner learned ten seconds earlier. One line per row, `min-height: 48px` (HIG tap target).
- **Sparse model.** `DayBudgets` = `Partial<Record<DayKey, number>>`; an absent day means "same as the weekday cap", **never a budget of zero**. Cycling past the last option returns to no-override, so clearing is always one more tap.
- ⚠️ **State must live in the label, never colour alone.** An override that equals the cap once differed from "same" by moss-vs-mute only (WCAG 1.4.1) with an identical `aria-label`. `defaultLabel` is therefore a **word** ("Same"), never a duration — a duration collides with a real override of that value. The `aria-label` states which state the row is in.
- Renders nothing when no weekday is a Run day (weekend-only weeks). Caller prunes with `pruneDayBudgets(budgets, plan)` on every grid change so a day switched back to Rest drops its budget.

### RPEScale (`components/shared/RPEScale.tsx`)

See Pattern 13. The **only** effort control — the post-race sheet and the post-run reflect sheet both use it. Never reimplement a 1–10 grid inline.

### Race projections card (`components/shared/RaceTimesCard.tsx`)

Coach's race surface (variant `status`; also `anchor`/`result` in the benchmark flow). Two parts, and the hierarchy between them is the point:

- **The arc is the hero** — `was · now · goal` (`RaceProgressArcRow`), the runner's own trajectory toward *their* race (§109: remember and compare, never predict).
- **The per-distance table is reference, not headline.** When the arc is present it is **collapsed behind a tap** ("Estimated times at other distances", ▾/▴), default closed. This keeps the card reading as a coach rather than a calculator, and removes the duplication where the race-distance row echoes the arc's "now". Without an arc (benchmark/result variants, or no target race) the table is the content and stays open.
- **Ultra framing (UX-COACH-01 polish, 2026-09-13).** VDOT cannot project beyond the marathon, so an ultra's arc drops to the nearest standard distance. The box then must NOT headline a marathon time under "Your race": the eyebrow reads **"Aerobic fitness"**, the sub-line **"Marathon-equivalent"**, and the runner's race name moves into the honest caveat below the arc. Non-ultra is unchanged — the arc genuinely is at the race distance, so the eyebrow stays "Your race".
- **All copy lives in `raceProjectionsCopy.ts`** — nothing user-facing is hardcoded in the component, which is what lets `raceProjectionHonesty.test.ts` guarantee no forward-looking claim reaches a runner.

### Legacy token migration

The form-control migration (2026-05-30) moved Login, Benchmark, and the Me-screen controls off System-B aliases (`--accent`, `--border-col`, `--input-bg`, `--text-*`, `--card-bg`, `--teal`) onto Warm Slate. `DashboardClient`'s non-control surfaces still carry bridged aliases by design (CLAUDE.md) — migrate them opportunistically when touched, never in a blind sweep of that file.

---

## LoadShape — where this week sits against your normal (A5, 2026-09-22)

**A shape, not a score.** `components/shared/LoadShape.tsx`.

```
        ┌──────────────────────────────────────┐
  track │        ████████████████        │     │   ← --moss-soft = your normal
        └──────────────────────┃───────────────┘   ← marker = this week
              0.8                    1.3
```

| | |
|---|---|
| **Band** | `LOAD_RATIO.under … LOAD_RATIO.watch` — **the same constants the coaching layer flags on.** A band drawn at numbers the engine does not use is a picture of nothing |
| **Marker** | Coloured by `loadRatioContext`, the single owner of the verdict, so the marker and the words above it cannot disagree |
| **No ratio** | **No marker.** An empty track reads as "nothing measured yet"; a marker parked at 1.0 would read as "you are exactly normal", which is a claim we cannot make from no data |
| **Domain** | 0.5–1.7, clamped. A presentation choice, not a coaching threshold — it exists so the band sits centrally and an extreme week lands on the track rather than off the end |

**Why it exists.** The load ratio was rendered `1.15x` at 28px / 800, its meaning demoted
to an 11px sub-line, its explanation behind a tap. Sierra: **a number that has to be tapped
to mean anything has taught nobody anything.** The verdict is the hero now, the shape shows
where the week sits, and the ratio is evidence underneath. **The number is demoted, not
deleted.**

⚠️ **This is a RECORDED REVERSAL of "no dashboards"**, on Zhuo's distinction: the rule was
against a wall of numbers substituting for a decision, not against showing a runner their
own progress. **The limit is the whole point** — a shape answers the question; axes,
gridlines, tick labels and legends pose it. `appReviewWave4.test.ts` fails if any of those
words appears in the component.

⚠️ **Not every number becomes a shape.** The Sessions tile beside it keeps `3/5`, because
`3/5` means something without a tap — which is exactly Sierra's test. **One tile changing
and one not is a distinction, and the gate asserts it so nobody "makes them consistent".**

---

## Icons — when one earns its place (ICON-RULE-01, Design Board 2026-09-22)

> 🔴 **SUPERSEDES S6 and M-2.** S6 bounded icons to *"a label that repeats down a list"* and
> M-2 amended S6 — **but S6 was not the governing rule.** Two older ones were, and neither
> was cited at either sitting: *"Icons everywhere → text labels where space allows"*
> (§ What Not to Build) and *"no icons unless they carry unique meaning"* (quoted as
> existing doctrine in § NotificationBell). **An amendment to the wrong rule is not an
> amendment.**

**An icon must earn its place by carrying what the label cannot. Two ways, and only two.**

| | Earns it | Example |
|---|---|---|
| **1. Meaning** | The glyph says something the label does not | The **notification bell** — universally understood, no compact text equivalent. A glyph that **encodes an ordinal** (a signal-bar mark filling 1→4 for ability tiers) |
| **2. Location** | On a list of **eight or more rows**, where the job is *finding*, not *understanding* | **Me** (20 rows, 10 sections) · the **modify sheet** (8 rows, 3 groups) |

**Everything else remains "text labels where space allows."**

**Qualifies today:** Me · the modify sheet. **Does not:** wizard steps, Plan rows, session
cards — all labelled, all short lists.

⛔ **Silvanto, binding.** One glyph per row · one size · one family · one tinted container.
**The container tint may NOT be semantic** — the app already spends **six session hues and
four phase hues**, and a second colour language competing with that is a palette regression
and the veto is live.

**Why the bound moved.** Sierra: *"the runner already knows what 'Distance units' means.
They cannot find it. Understanding and locating are different jobs, and the old rule only
covered the first."* Wroblewski: 20 rows and 10 section headers, and the row already occupies
that height — a glyph is a landmark, not density.

⚠️ **Collins, recorded, and the board agreed:** this is a **utility** ruling, not a wow
ruling. **Icons on settings rows will not make anyone tell a friend about this app.** The
thing in the competitor's screens that stops you is a **handwritten annotation over a bar
chart** (*"easier on purpose"*), which is not an icon. **Do not cite this ruling as progress
against "stand out".**

⚠️ **Icons are NOT the fix for colour-only encoding.** The app breaks its own WCAG 1.4.1
rule (*"state must live in the label, never colour alone"*) at **6 measured sites**, and the
worst of them is a **4px** dot where neither a glyph nor a label fits. That needs shape or
fill: `DESIGN-DAYDOT-CHANNEL-01`, still open.

**Check:** `lib/marketing/iconRule.test.ts` — a row-icon may only appear in a list of ≥8.

---

## PlanArc — reveal scale (DESIGN-REVEAL-SHAPE-01, Design Board 2026-09-22)

**At the moment a plan arrives, `PlanArc` renders at `PLOT_REVEAL` (88px) with one annotation.**
Everywhere else it is `PLOT` (36px).

🔴 **The defect this closes.** `PlanArc` rendered on the Plan screen, in `TabbedPhone` and on its
own preview page — and **not on the reveal.** `GeneratePlanScreen` imported `PlanHeroMetrics` and
never `PlanArc`, so at the one moment the plan arrives the runner met its **numbers** and never
its **shape**; the shape appeared later, on a tab they had to navigate to. That is also why the
second-typeface question could not be answered: there was no chart to annotate.

**One annotation, on the first dip, and the number is measured.** Bar pitch is **14.1–22.2px** at
the 320px content width (worst case the 18-week marathon at 14.1px), and plans carry **2–5 dips,
mean 2.8, scattered** — `4,8` on the twelve-weekers, `2,6,10,13,17` on the sub-4 marathon. An
annotation tied to a 14px target is not a relationship a reader can see (Silvanto); five captions
of one sentence is wallpaper (Sierra).

⚠️ **Set in Inter. The hand is the drawn rule, not the letterforms.** `Inter only` is standing and
Silvanto's veto is live against a handwriting face arriving quietly; **the second typeface is
DEFERRED, not refused**, and returns with this on a device to compare against.

⚠️ **Two binding constraints, both guarded against REAL generated plans:**
- the annotated week must genuinely be **easier than both neighbours** — *"easier on purpose"* over
  a week that is not is a false claim about the plan (DELOAD-OWNER-01);
- it may **never be the peak** — Wood, binding: *"no emphasis, no marker, no colour change at the
  tallest bar."*

🔴 **`firstDipWeek` is EXPORTED so the check asserts the producer, not a copy.** The gate's first
version mirrored the rule in the test file, and falsification caught it: mutating the component to
annotate the **peak** left the suite green. That is the recorded `tierResolution.test.ts` flaw —
*"the test asserted its own copy and could not catch either producer drifting."*

**Check:** `lib/marketing/revealShape.test.ts`.

---

## Time to race — one vocabulary (S5, Design Board 2026-09-22)

**There is exactly one way this product says how far away the race is, and it lives in
`lib/format.ts`.**

```ts
import { daysUntilRace, formatRaceCountdown } from '@/lib/format'

const days = daysUntilRace(plan.meta.race_date)          // ceil, ≥ 0, null if absent
formatRaceCountdown(days)                                 // "30 weeks, 4 days"
formatRaceCountdown(days, { suffix: 'out' })              // "30 weeks, 4 days out"
```

| | |
|---|---|
| **Unit** | Weeks, because plans are weekly and raw days are harder to scale mentally. The unit flips to days inside the final week, where "5 days" beats "0 weeks, 5 days" |
| **Only permitted variation** | `suffix`. It varies PLACEMENT, never the number or the unit |
| **`≤ 0`** | Returns `''`. The caller decides what race day and the past look like — the formatter does not invent a word for them |
| **Arithmetic** | `daysUntilRace` only. `Math.ceil`, so the morning of race-eve reads "1 day" instead of rounding down to 0 and tripping every `> 0` gate |

**Why it is a rule.** The board measured **three vocabularies for one fact** on screens a
runner sees in the same session: *"214 days to go"* (Plan), *"30 weeks 4 days out"* (Today),
*"77 days until then"*. Collins: **three vocabularies for one fact is the product not knowing
what it is saying.**

⚠️ **The formatter already existed and three of its four call sites went round it.** That is
the shape of every single-owner defect in this repo — the owner is written, and then not
used. Underneath the wording there were also **four** independent arithmetic sites, three
`Math.ceil` and one `Math.round`, so two surfaces could legitimately disagree by a day
either side of midnight.

⚠️ **This binds the marketing site too.** `PhoneFrame`'s countdown was hand-written with a
comment promising it *"mirrors formatRaceCountdown()"*. A format copied by hand, with a
comment asserting it matches, is drift with a certificate. It calls the owner now.

**Check:** `lib/marketing/appReviewWave3.test.ts` — no hand-built countdown string, no
hand-rolled race arithmetic, and the website imports the owner.

---

## Cross-Screen Consistency Rules

Every screen must honour these invariants before shipping. Check against this list when auditing.

| Signal | Canonical value | Common violation |
|--------|----------------|-----------------|
| ScreenHeader font | `26px 800 --font-ui --ink` | 22px/500 or `--font-brand` |
| Content horizontal padding | `0 16px` | `0 12px` in Me/Strava screens |
| Card border | `1px solid var(--line)` | `0.5px solid var(--border-col)` |
| Card radius | `var(--radius-lg)` | Hardcoded `12px` |
| Card background | `var(--card)` | `var(--card-bg)` |
| Primary text | `var(--ink)` | `var(--text-primary)` |
| Secondary text | `var(--ink-2)` | `var(--text-secondary)` |
| Muted text | `var(--mute)` | `var(--text-muted)` |
| Primary accent | `var(--moss)` | `var(--accent)` or `var(--teal)` |
| Active toggle | `var(--moss)` background | `var(--accent)` |
| Inactive toggle | `var(--line)` background | `var(--border-col)` |
| Session type ownership | `lib/session-types.ts` token | Hardcoded hex or `--session-*` alias |
| AI provenance signal | `<CoachByline>` — moss on card/bg-soft, warn on warn-bg, pair with 3px left rail on AI cards | Bare `AIMark` without byline; old `AICoachChip` pill |
| Eyebrow / section label | `10px 700 --mute uppercase 0.08em` | Varies |
| Coach amber surface text | `var(--coach-ink)` | `var(--warn)` or `var(--amber)` |
| Slide-up sheet keyframes | Defined once in `globals.css` | Inline `<style>` in JSX |

**When you change a shared pattern**, update the relevant entry in this table AND the corresponding Pattern section above in the same commit. Patterns are the reference — not a description of what happens to exist.

---

## Screen Templates

### Today Screen

```
[ZONNA wordmark · moss dot]

[Context row: phase · week · Xd out]
[Today, you run]
[56px hero: "10km," ink + "slowly." moss]

[AdjustmentBanner — if pending]
[CoachNoteBlock — plan note]

[DateStrip]

[SessionCard — today, with state]
[→ Log this session — moss CTA]
[→ Log manually — text link]

[RestraintCard — if ≥2 sessions done this week]
[Done this week — SessionCard list]

[Strava nudge text]
```

### Session Detail Screen

- Full screen, back arrow top-left (44px circle, `--bg-soft` bg) — **`components/shared/BackButton.tsx` is the single owner. Never hand-roll one.**

> 🔴 **UI-BACKARROW-01 — this line existed for months and half the app ignored it.** A census
> of every back control across the screen files found **6 of 13** obeying: two at **36px**
> (below the 44px iOS HIG minimum this document states in § What Not to Build), two 8px
> squares on `--accent-soft`, one on `--moss-soft` — the CTA colour on a control that is not
> a CTA — and **two with no container at all**. Extracted from `FounderNoteScreen`, which
> was the conforming version. ⚠️ **Four already-legal arrows gained a 2px glyph** (18→20px):
> a single owner has to pick one, and that is the price of there being one answer.
> ⚠️ **Not `ScreenHeader`** — that is title + subtitle with **no back arrow**, for tab roots;
> conflating the two was a retracted finding in the review that produced this item.
> **Check:** `lib/marketing/backArrowOwner.test.ts`, falsified both ways (a hand-rolled arrow
> re-added; the owner shrunk to 36px).
- Eyebrow: day + week label (`10px 600 --mute uppercase`)
- Title: session name (`16px 700 --ink`)
- Session type chip right-aligned
- Card: `--card` bg, `--line` border, `--radius-lg`, 3px left accent in session colour
- Metric row: HR target, zone, distance, duration
- Description block: `14px 400 --ink-2`
- RPEScale (if complete)
- CoachNoteBlock variant="why" for "WHY THIS SESSION"
- Action pinned to bottom (or within scroll)

### Plan Overview Screen

```
[Your plan — 26px 800 left]    [Race: Xd out — 16px 700 right]

[PlanArc]

[Week summary bar: phase + done/total + km target]

[PlanCalendar — week list with session cards]
```

- PlanArc shows full training arc at a glance
- PlanCalendar owns the drag-reorder + tap-to-open interaction
- No separate progress bar or chart section

---

## HR Zone → Session Colour Coherence

**Design invariant**: zone colours match session type colours. Warm Slate values apply.

| Zone | Name | Token | Matching session type |
|---|---|---|---|
| 1 | Recovery | `--s-recov` | recovery |
| 2 | Aerobic | `--s-easy` | easy, long |
| 3 | Tempo | `--s-quality` | quality, tempo |
| 4 | Threshold | `--s-race` | race |
| 5 | VO₂ Max | `--s-inter` | intervals |

**Rules:**
- Zone colours must always use session type tokens (`--s-easy`, `--s-inter`, etc.) — never semantic tokens
- `--warn` is reserved for coaching warnings only — never for zones
- Never introduce a standalone zone colour that doesn't map to an existing session type token
- Session colour ownership lives exclusively in `lib/session-types.ts`

---

## Tier-Divergent Components

A component that renders differently for FREE vs PAID/TRIAL users must follow these rules:

1. **Single file, conditional render.** Never split into `FooFree.tsx` + `FooPaid.tsx`. One component, one `tier` prop, internal branching.
2. **Free is the baseline, paid is enrichment.** Free variant must be complete and lovable on its own — not a degraded fallback.
3. **Header comment is mandatory:**
   ```tsx
   // TIER-DIVERGENT — FREE: [brief description]
   //                  PAID: [brief description]
   ```
4. **No tier logic in child components.** Tier prop travels from route to top-level screen. Children receive pre-computed data.
5. **Graceful degradation only.** If paid enrichment fails, component falls back to free variant. Never empty state where a standard plan could show.

Canonical examples: `GeneratingCeremony.tsx`, `GeneratePlanScreen.tsx`

---

### 33. PostRaceReshapeCard + RaceResultSheet

**AI-DEPTH-08 — post-race reshape flow.**

Two components, one flow: (1) log the race result, (2) accept or reject the proposed plan reshape.

### A time field always collects SECONDS *(Design Board 2026-09-25, TIME-INPUT-SECONDS-01)*

**Rule.** `DurationPicker` renders hrs : min : sec. There is no prop to turn seconds
off, and there is no call-site decision to make. `showHours={false}` remains, for a
genuinely mm:ss quantity like a time trial.

🔴 **Why: the drift this section was written to end had survived as a prop.** §Form
Fields & Pickers exists because *"the same quantities were collected 2-3 different ways
across screens; these primitives end that drift."* One component shipped — carrying a
`showSeconds` prop that defaulted to **false**, was set at three call sites and forgotten
at three.

⚠️ **AND THE THREE SCREENS DID NOT OMIT SECONDS — THEY FABRICATED THEM.** They built the
stored value as `` `${h}:${mm}:00` ``. Measured on live production data before the board
ruled: **12 of 12 stored times end `:00`** — 4 of 4 target times, 8 of 8 benchmarks. Not
one runner had ever recorded a real seconds value, because three screens could not accept
one. **The app was asserting a precision it never collected.**

⚠️ **The direction of the error is the finding.** Truncating to the minute always makes the
runner look **faster**:

| distance | worst-case pace error |
|---|---|
| **5K** | **11.8 sec/km** |
| 10K | 5.9 sec/km |
| HM | 2.8 sec/km |
| Marathon | 1.4 sec/km |

Every prescribed pace derives from that benchmark, in a product whose entire thesis is that
people run their easy days too hard. Silvanto's observation carried the sitting: the
benchmark screen **displays** `HM 1:45:28` and, eight hundred pixels below, **refused to
accept** `:28`.

⚠️ **RECORDED DISSENT — Wroblewski, not settled.** A **result** is a fact; a **target** is
an intention, and nobody decides *"I want to run 1:54:37"*. Asking for seconds under
*"what time are you aiming for?"* demands a precision the runner does not have. The chair's
amendment answers it without overruling him: the wheel ships **defaulting to `00`**, so
expressing no view costs nothing. **What would reopen it:** evidence that runners enter
non-round targets — which cannot exist until this ships.

**Exempt, and named so the exemption reads as a decision:** `'30:00'` for the 30-minute
time trial is the **protocol**, not a runner-entered value.

**Check:** `lib/timeInputSeconds.test.ts` — no call site passes `showSeconds`, every caller
passes `secs`/`onSecsChange`, and **no screen builds an `H:MM:00` literal**. Falsified both
ways.

#### RaceResultSheet (`components/training/RaceResultSheet.tsx`)

Slide-up sheet pattern (Pattern 19 keyframes). Fields: outcome picker (pb / on_target / off_target / dnf), finish time (DurationPicker with `showSeconds`, pre-filled from `plan.meta.target_time`), RPE (shared RPEScale, Pattern 13), notes textarea, optional advanced section (what worked / broke / fueling / strategy). All inputs use the § Form Fields & Pickers primitives. No close button at top — drag indicator only. Mirrored nav footer at bottom.

**Two CTAs:**
- Primary: "Log result" (moss, full-width) → POST `/api/post-race-reshape` → emits `onReshapeReady` with the proposal
- Secondary: text link "Log result only, keep my plan →" → emits `onLogOnly` (logs result, no reshape)

**Rules:**
- Outcome is required before the primary CTA activates
- Submitting state: "Checking plan…" with disabled CTA
- Error shown inline above the footer (no toast)
- Advanced section collapses by default — show/hide toggle with `⌄`/`⌃`

#### PostRaceReshapeCard (`components/training/PostRaceReshapeCard.tsx`)

TIER-DIVERGENT card. Shows the proposed reshape after `RaceResultSheet` resolves:

```
TIER-DIVERGENT — FREE:  locked state — hand-authored copy, upgrade CTA, muted left-rail
                  PAID:  live state — AI summary (Sonnet), CoachByline (moss), 3px left-rail
```

**States (discriminated union):**
- `skeleton` — shimmer placeholders while the reshape API is in flight
- `live` — AI summary + stat chips (N weeks, M sessions) + Accept + Dismiss
- `locked` — non-paid users, upgrade CTA + dismiss
- *(no 'error' state — on API failure the route falls back to rule-engine voice)*

**Live state anatomy:**
```
[3px moss rail]
[CoachByline: "POST-RACE RESHAPE"]
[AI summary — 2-3 sentences, Sonnet voice]
[Stat chips: "N weeks updated · M sessions changed"]
[Accept — update my plan]      ← full-width moss, 46px
[Keep my plan as-is →]         ← text link, muted
```

**Motion:** `zonna-fade-in` on card mount.

**On Accept:** calls POST `/api/post-race-reshape/confirm` with `reshape_id`. Route returns `reshaped_plan_json`. Card calls `onAccepted(reshapedPlan)` so parent can update plan state without re-fetching.

**On Dismiss (both states):** calls `onDismiss()`. Parent sets `reshapeDismissedAt` (session-scoped — prompt doesn't reappear until next app boot).

**Provenance:**
- CoachByline on the AI summary — Sonnet output, provenance honesty required
- No CoachByline on the locked state (hand-authored copy)
- Stats row: formula-derived (weeks_affected.length, sessions_modified from rule engine) — no AIMark

**Where it renders:** TodayScreen, above the PendingAdjustmentBanner, inside the content padding area. Triggered when `currentWeekIndex > raceWeekIndex && !raceWeek.result_embedded && !reshapeDismissedAt`.

Reference: `components/training/PostRaceReshapeCard.tsx`, `components/training/RaceResultSheet.tsx`. Routes: `POST /api/post-race-reshape`, `POST /api/post-race-reshape/confirm`, `POST /api/post-race-reshape/revert`. Prompt: `lib/coaching/prompts/postRaceReshape.ts`. Engine: `lib/coaching/postRaceReshape.ts`.

---

### 31. Post-race maintenance card (phase-aware)

**MAINT-01 / MAINT-04 / MAINT-07 — the post-race block's one Today slot.** TIER-DIVERGENT.

One slot, progressing through three beats over the block's life. **Only ever one of them renders at a time** — the slot never stacks.

| Beat | When | Anatomy |
|---|---|---|
| **Announcement** | Maintenance plan live, `meta.maintenance_transition_seen` false | `--s-recov` rail · eyebrow **AFTER THE RACE** · "That's {race} done." · one-sentence why · shape line (`N days/week · N weeks · below your base, on purpose`) · **See the plan** (moss, full-width) · *Got it* |
| **Ongoing** | Transition acknowledged, Phase 1–2 | No rail, no eyebrow. The current week's `theme` (rule-engine, already §75 phase-correct) · *Dismiss* |
| **Re-engagement (Phase 3)** | `isReengagementWeek(currentWeek, weeks)` | `--s-recov` rail + eyebrow **AFTER THE RACE** return · theme is `PHASE3_THEME` ("Still here. When you're ready.") · *Dismiss* · **CA-03 NextGoalCard appears directly below, for the first time in the block** |

**PAID overlay (any beat):** when `week.coach_debrief` is present, the card renders the AI debrief instead — moss rail + `CoachByline role="Maintenance"` (Pattern 16b).

**Rules:**
- **Never two provenance marks on one card.** The AI debrief state owns the card when present: moss rail + CoachByline, and the Phase 3 eyebrow/recov rail are suppressed. Rule-engine copy carries neither.
- **The body line is always the week's own `theme`** — never a hardcoded string. The engine writes phase-correct copy (§75 voice register), so Phase 3's register shift needs no separate string and Phase 1 can't leak forward-goal language. Fallback `'Base running.'` only if `theme` is missing.
- **Phase 3 reuses the announcement's rail and eyebrow deliberately.** Same chapter, same voice returning. Do not invent a new eyebrow — a new label reads as a new feature, which is precisely the register to avoid.
- Phase state follows the **real current week**, not the viewed week — the register is about where the runner actually is. (The PAID debrief follows the viewed week, by its own design.)
- **Never an unlock register.** No "available in week N", no lock glyph, no countdown. The wizard is reachable throughout; only the proposal waits (§67).
- Dismissal is respected permanently for the block (per-race key in `localStorage`). Phase 3 does **not** resurrect a dismissed card — the ladder still arrives on its own.

**Rendering order in TodayScreen:** maintenance card → NextGoalCard (Pattern: CA-03). The announcement beat suppresses both the ongoing beat and the ladder.

Reference: inline in `app/dashboard/DashboardClient.tsx` (`showMaintTransition` / `showMaintCard` / `maintReengagement`). Window reader: `lib/plan/maintenance.ts → isReengagementWeek`. Principles: §75 (block + Phase 3), §67 (ladder timing).

---

## What Not to Build

> ⚖️ **This table is component guidance, not the rule statement.** The restraint rules
> themselves are owned by `docs/canonical/ux-principles.md` § Screen Design Principles
> (Design Board, ADR-023). ⚠️ **"Alert/modal popups" below does NOT mean modals are
> banned** — the owner's rule permits them for destructive confirmations (delete,
> disconnect) and forbids them for information. A previous copy of that rule in
> `CLAUDE.md` lost the exception, which is why ownership was consolidated on 2026-09-22.

| Avoid | Use instead |
|---|---|
| Full card background in session colour | Left accent border + chip |
| Gradient backgrounds | Flat card with `--card` |
| Multiple box-shadows stacked | None or single `--line` border |
| Hardcoded hex in component files | CSS custom properties only |
| Space Grotesk, DM Mono, DM Sans | `var(--font-ui)` only |
| `#D4501A`, `#f5f2ee`, `#0B132B`, `#5BC0BE` | Warm Slate tokens |
| Icons everywhere | Text labels where space allows — **AMENDED by ICON-RULE-01**: an icon earns its place by carrying MEANING the label cannot, or LOCATION on a list of ≥8 rows |
| Spinner loading states | Skeleton placeholders, or `<AIMark working />` for AI-in-flight |
| AIMark on rule-engine / hand-authored copy | Mark only model-generated content — provenance honesty |
| Alert/modal popups | Navigate to full screen |
| Button tap target < 44px | `width/height: 44px` or `minHeight: 44px` — iOS HIG minimum |
| Centred-only layouts | Left-aligned with consistent margin |
| Dark mode anything | Single light theme (ADR-008) |

---

## Prompt Template for UI Requests

```
Screen: [screen or component name]
Change: [what specifically is changing]
SLC:
  Simple — [one sentence: what this does and nothing else]
  Lovable — [what makes it feel good / which ui-patterns.md pattern applies]
  Complete — [states to handle: loading / empty / error / edge cases]
Trigger frontend-design skill.
```

Example:

```
Screen: RestraintCard in TodayScreen
Change: Show Zone 2 discipline percent derived from session types this week
SLC:
  Simple — single stat card, percent + one-sentence interpretation
  Lovable — large 44px number, moss % sign, Zonna voice body copy
  Complete — hidden when <2 sessions completed, 100% edge case handled
Trigger frontend-design skill.
```


### 32. Interpretation-led screen (Coach)

The shape the Coach screen was rebuilt to on 2026-09-12 (UX-COACH-01, Coaching
Board + SLT). Reusable wherever a screen has to answer "what does this mean?"
rather than "what are my numbers?".

**The rule: one subject, stated as a sentence, with its evidence beneath it.**

```
Kit's read          ← the HERO. An interpretation, not a metric.
  + ZoneRings         the same fact PICTURED, directly under the sentence
The arc             ← where I was · where I am · the goal I chose
Supporting facts    ← two, not four
Ledger
One trend card      ← the physiological evidence
One link out        ← replaces tap-to-explain sheets on individual stats
```

**Why interpretation leads.** Wood's condition, and it is binding: *a view of
progress is the illusion-of-progress class unless it changes what the runner does
on Tuesday.* "Your easy days are creeping up again" changes Tuesday. "Aerobic
fitness +3%" does not. The screen's top line must be a reading, not a number.

**Why the word and the picture are one block.** Kit's sentence says "nine per
cent of your week sat in Zone 3" and `ZoneRings` draws that same nine per cent
immediately beneath. They are the same fact in two registers, so they belong in
one eyeful — and they must come from **one owner** (`weeklyZoneAggregate`), or
the sentence and the image can contradict each other on the same screen.

**Counting blocks is not the fix.** Coach had seven and the problem was never
seven; it was seven things answering different questions at the same volume.
Each block must answer a *different* question, in descending order of how much
it changes the runner's next decision.

**What this pattern forbids:**
- A composite "score" invented to make the screen feel decisive (§108 ruled on it).
- A predicted future value — this pattern may remember and compare, never predict (§109).
- A tile that restates a chart sitting next to it. Measured before removing:
  Coach's "Zone discipline" tile was the ZoneRings' Z2 arc, drawn worse.
- A second non-verbal encoding of something the colour and the label already
  carry (UX-SESSION-GLYPH-01, measured and declined).

**The empty state is designed FIRST, not last.** McMillan's condition: a surface
that can only speak when the arrow is up is marketing. In week 1 the hero holds a
read that points at what it will be watching, and every evidence block resolves
to a stated "not yet" rather than a skeleton that shimmers forever.

Reference: `CoachScreen` in `app/dashboard/DashboardClient.tsx`;
`docs/decisions/ux-coach-01-boards-2026-09-12.md`.

---

### 35. Post-run card (Pattern 32 applied to the post-run moment)

Shipped 2026-09-13 (UX-POSTRUN-01, SLT + Coaching Board). **Not a new shape — it
is Pattern 32's rule applied to the second screen that had the same problem.**
Coach was rebuilt to lead with interpretation on 2026-09-12; the post-run card was
still leading with a grade.

```
Kit's read          ← the HERO. Two sentences. An interpretation, not a metric.
Verdict card        ← beneath, and quieter
  headline            Zonna voice, one line
  ONE zone signal     "92% in your prescribed zone" + a single bar
  score toggle        small, top-right, opens the per-axis breakdown
Up next
```

**What it replaced, and why.** A four-column panel (HR / DISTANCE / PACE /
EFFICIENCY), each with a number out of 100, a progress bar and a band label,
above Kit. Two rules said no: **"No dashboards or noise"**, and Zonna
**"deliberately omits gamification"** — four sub-scores with bands is a
scoreboard. Sutherland: handing a runner who overtrains a number to optimise is
the grey-zone pressure the product exists to remove, rebuilt as a leaderboard.

**Why exactly ONE signal survives rather than none.** Wood's carve-out, and it is
the same line she draws on Coach: zone adherence is the single behaviour this
product exists to change, so confirming it reduces cognitive load. Distance, pace
and efficiency are *outcomes* of the run, not the behaviour — they stay behind the
score toggle (progressive disclosure) rather than leading.

**The palette follows the verdict.** Moss (`--moss-soft`) when the zone was held,
amber (`--warn-bg`) when it drifted. Every post-run card previously rendered
amber, so a runner who held the zone perfectly met *"There it is. Don't ruin it."*
on the warning palette. **Restraint cannot feel like progress if success and drift
are the same colour.** `--coach-ink` moves with the background, per its own
"on `--warn-bg` only" declaration in `globals.css`.

**An absent measurement is stated, never defaulted** (§108 Amendment 1). No heart
rate means no score and no verdict — "No heart rate on this run, so it isn't
scored." The previous copy noted the gap *beside a confident number* that had
substituted a passing grade for the missing axis.

> ⚠️ **KNOWN GAP — the same number is banded twice.** This card bands
> `hrInZonePct` through `scoreBandLabel` (**80 / 60 / 40** → On target · Close ·
> Slightly off · Off target). The Coach screen bands the *same* measurement
> through `ZONE_DISCIPLINE_BANDS` (**85 / 70 / 50** → disciplined · decent · loose
> · freelancing). So a run at 82% reads **"On target"** post-run and contributes
> to **"decent"** on Coach; 65% reads **"Close"** but **"loose"**. Two
> vocabularies and two threshold sets for one fact. Unifying them is a coaching
> decision (bands are ratified numerics), so it is filed as
> **ZONE-BAND-VOCAB-01** rather than fixed in a display change.

**Harness:** `/post-run-preview` renders the real `RunFeedbackCard` across five
states (no HR, zone held, zone drifted, manual, scored-without-Kit). 404s in
production. The card is tier-gated and authed, so this is the only way to look at
it — and this repo has shipped a comment describing a change to a component
nobody could see.

Reference: `RunFeedbackCard` in `app/dashboard/DashboardClient.tsx`.

---

### 36. Identity Card (Me screen)

The top card on Me: who is signed in, and on what. Avatar + name + tier.

```
┌─────────────────────────────────────────┐
│  (RS)   Russell Shear                   │  ← 17px 500 --ink, brand font
│         Pro                             │  ← 12px 400 --mute
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  (T)    Add your name              [›]  │  ← MISSING-NAME state: one tap target
│         Trial · Kit will use it.        │
└─────────────────────────────────────────┘
```

**Structure:**
- Container: `--card`, `var(--radius-lg)`, `1px solid --line`, `var(--shadow-card)`, `16px` padding
- Avatar: `48px` circle, `--moss` fill, initials in `var(--font-brand)` `16px 600`, `--card` text
- Name: `var(--font-brand)` `17px 500 --ink`, single line, ellipsis
- Sub-line: `var(--font-ui)` `12px 400 --mute`, single line, ellipsis
- Chevron (missing-name state only): `--mute`, `marginLeft: 12px` — Pattern 20's chevron

**The missing-name state is the whole point of this pattern.** With a name the
card is inert. Without one the entire card becomes a single `<button>` following
**Pattern 20 (Action List Card)** — label, supporting detail, chevron — and taps
through to the real first-name field further down the same screen. It does not
open a sheet or a second screen: one input does not earn a navigation.

> **A prompt with nothing to tap is Pattern 8's mistake in miniature.** This card
> previously rendered a grey `"Your name"` in the name slot: it read as a value
> the app already held, it was not tappable, and on a test account the founder
> could not tell whether the app knew his name or not. An empty state must either
> resolve itself or say plainly that there is nothing to do — never sit in
> between.

**Initials never render blank.** `lib/profileInitials.ts` is the single owner:
saved profile name → `plan.meta.athlete` → the account's email → `'?'`. The email
tail is load-bearing, not a nicety (`plan.meta.athlete` is an empty *string*, so
a `??` guard never fires). Regression-tested in `lib/profileInitials.test.ts`.

**Copy:** the sub-line names the tier, and in the missing-name state adds one
short reason sourced from `BRAND.coachName`. No exclamation, no "Complete your
profile!" — the runner is told what it is for and left to decide.

**Harness:** `/me-preview` renders the real `IdentityCard` and `ProfileSection`
across five states (no name, no name and no plan, first name only, full name,
overflowing long name) plus a live profile form. 404s in production. Both sit
behind auth, a plan and a tab, which is exactly how a hardcoded placeholder
survived to production.

Reference: `components/shared/IdentityCard.tsx`, `components/shared/ProfileSection.tsx`.

---

### 37. Patterns added 2026-09-20 (the Miles-teardown build)

Six components shipped that day. **None was added here at the time**, which is the same drift that
left this document pointing at a deleted `RestraintCard` and at a `SectionLabel` file that never
existed (both fixed under P-10, and the `Reference:` lines are now guarded by
`lib/marketing/uiPatternReferences.test.ts`). Recorded together rather than backfilled silently.

**A shared eyebrow convention, measured rather than assumed.** The scale above says section labels
track at `0.08em`, and the codebase agrees **64 times against 17**. The `0.14em` minority belongs
to the `CoachNoteBlock` amber family (pattern 9) and should stay there. Four of the components
below were written by copying their nearest neighbour and picked up `0.14em`; they were corrected
to `0.08em` on the same day. **Copy the scale, not the adjacent component.**

#### 37a. `RefusalView` — a coaching refusal, and the route out of it
A 422 from plan generation is a **deliberate coaching decision**, not a fault, and reads as a calm
"not yet" in the amber `CoachNoteBlock` palette (the one place `0.14em` is correct here). Below it,
on a **separate `--card` surface with a 3px `--moss` left rail**, sits the §118 Base Building
offer: an offer rendered inside the amber block reads as more bad news. Accepting is the primary
CTA and "Adjust my answers" demotes to the muted secondary, never hidden.
Reference: `components/shared/RefusalView.tsx` · fixture `/refusal-preview` (five states).

#### 37b. `ZoneWeekBlock` — the weekly zone statement
The brand thesis as a sentence: *"3 of 4 runs held the zone. One drifted."* Count, never a
percentage. A 3px left rail carries P-01's semantic pair (moss held / amber drifted) and the card
stays `--card`; **accent, never a coloured fill.** The free-tier state follows the locked treatment
in pattern 11. All copy belongs to `lib/coaching/zoneWeekStatement.ts`, never the component.
Reference: `components/shared/ZoneWeekBlock.tsx` · fixture `/zone-block-preview` (eight states).

#### 37c. `MePlanCard` — what you have, then what you lack
The non-manipulative upsell shape. Feature rows are **read from `lib/marketing/pricing.ts`**, the
same gate-linked rows `/pricing` renders, so the card inherits both guards on those rows; a test
fails if any feature name is retyped here. A subscriber sees the card with no upsell.
Reference: `components/shared/MePlanCard.tsx`.

#### 37d. `PlanHeroMetrics` — the three-up metric row
⚠️ **A NEW TYPOGRAPHIC ROLE, declared rather than smuggled.** The scale has Metric large (44px)
and Metric medium (17px). **Three metrics side by side cannot be 44px at 375px wide**, so this
uses **`--font-ui` 800 / 22px** with an 11px `--mute` label beneath. Value still dominates and the
label is still underneath; only the size is new. Use 22px wherever three metrics share a row.
Reference: `components/shared/PlanHeroMetrics.tsx`.

#### 37e. `ModifyPlanSheet` — batched edits, grouped by consequence
Arrives through the `Sheet` primitive (SHEET-PRESENT-01), so nothing here touches z-index or the
nav inset. Rows group by **consequence** ("Your week" / "Your body" / "The race"), each carrying
the SLT-approved consequence subtitle from `lib/plan/modifyPlan.ts`.
- **No Cancel top-right.** The bar is at the bottom, per `ux-principles.md`.
- **Two bar states, and neither is a disabled primary at rest**: `Close` when nothing has changed,
  `Apply N changes` + `Discard changes` when something has.
- **A pending edit reads in `--moss`** (a 6px dot, and the label moves `--ink-2` → `--ink`).
  **Not amber**: amber is coaching-warning voice and an unapplied edit is not a warning.
Reference: `components/shared/ModifyPlanSheet.tsx`.

#### 37f. `ModifyPlanConfirm` — diff before apply
Two scales, because one is not enough: plan-level before → after rows (**only those that moved**),
above the existing `AdjustmentDiff` for the week the runner is actually in. Everything is derived
at render; nothing is stored, because a total written once goes stale at the next reshape.
Reference: `components/shared/ModifyPlanConfirm.tsx`.

### 38. Button — the one control that asks *(Design Board 2026-09-24, built 2026-09-25, `BUTTON-COMPONENT-01`)*

`components/ui/Button.tsx` is the **single owner** of every control that asks a runner to do
something. Styling lives in `globals.css` under `.btn`; the component is the vocabulary.

🔴 **Why it exists.** The founder said the CTAs looked flat. The board measured and found something
larger: **there was no Button component.** 66 `<button>` elements carried `var(--moss)`, 27 of them
the primary-CTA shape, each one a nine-line inline style object written out again from whatever was
nearby. `--shadow-lifted` was authored for a raised state and had **zero** consumers while
`--shadow-card` had 19 — the product elevated its cards and gave its buttons nothing, so a moss
button sat visually *behind* the card it was on.

🔴 **And all 42 text-carrying moss controls failed WCAG AA.** White on `--moss` is **3.68:1**;
`--moss` as a label is **3.24:1** on `--bg` and **3.04:1** on `--bg-soft`. AA wants 4.5:1, and
nothing in this product reaches the 18.66px-bold large-text exemption. `A11Y-CONTRAST-01` had
measured this exact failure and shipped `--moss-strong` / `--moss-deep` for it — then fixed only
the **marketing** button (28 uses on the site, **0** in `app/dashboard`, **0** in `lib/email`).

| Variant | Fill | Label | Use |
|---|---|---|---|
| `primary` | `--moss-strong` | `--card` | **One per screen.** Carries `--shadow-lifted` |
| `secondary` | `--card` + `--line` border | `--ink-2` | The alternative action |
| `quiet` | none | `--moss-strong` | A label, not a surface: an **accent** text action (unlock, upgrade) |
| `ghost` | none | `--mute` | A **de-emphasised** text action: skip, cancel, dismiss, not now |
| `soft` | `--moss-soft` | **`--moss-deep`** | The moss-tinted pill (3 uses) |
| `destructive` | `--card` + `--danger` border | `--danger` | **Modal confirmations only** |

⚠️ **Labels are SENTENCE CASE and the type is 14px, both measured rather than chosen.** The board
quoted `DashboardClient:3171` as the reference button; it is uppercase at 13px with 0.08em tracking,
and the first cut of `.btn` forced both. Counting the population actually being converted, **33 of
40 were not uppercase** and 14px was the modal size. **The cited example was the minority**, and
generalising from it would have restyled 33 controls nobody asked to change.

🔴 **`quiet` and `ghost` are two variants because a standing ruling requires it, not because two
looked nicer.** `design-rulings.md` `:456` — *"dismiss is never `--moss`. `--moss` is the CTA colour;
spending the strongest colour in the system on DISMISS teaches the opposite of what it means."*
**44 de-emphasised text buttons in the app are `--mute`**, and collapsing them into `quiet` would
have turned 44 grey controls green and reversed that ruling while looking like a migration.
⚠️ **The names read backwards and it is not worth fixing:** "quiet" describes the mute one better,
but `quiet` shipped first with 14 consumers and renaming call sites to fix a word is churn with no
user impact. **The distinction that matters is ACCENT vs DE-EMPHASISED.**

🔴 **A SIZE CLASS CARRIES THE FLOOR, NOT THE BOX** *(Design Board, `BUTTON-GEOMETRY-01`, 2026-09-25)*.
`.btn--regular` / `.btn--compact` declare a **44px minimum** (`:262`) and a default; **every call site
keeps its own padding, font-size, radius, width and height.** A conversion buys hover,
`:focus-visible`, press, disabled and one owner for colour and elevation — **never a size.**

⚠️ **Why this is a rule and not a preference.** These read `min-height: 48px` PLUS fixed padding,
which is a **box wearing a minimum's syntax**: padding and line-height set the height, so the minimum
never binds. Converting therefore replaced geometry — **20 of 32 controls changed height, -19px to
+4px** — and the founder found it by opening the app while four automated gates stayed green. 48 came
from the **modal of a distribution**; an average is exactly what a design system must not encode.

⚠️ **`npm run button:geometry` is the gate**, and a conversion is only done when it reports
`geometry moved: 0`. Same declare-and-re-baseline idiom as `cohort:shape`.

⚠️ **A control that must stay small keeps its visual and gains a 44px HIT AREA** via
`.btn--inline-target` (`::after` overlay) — the Apple Health chip at 29px, four inline text links at
32px. **Padding cannot do it for a FILLED control**, because padding grows the painted box; that is
the difference from the icon inline mark, whose background is `none`.

🔻 Whether a real two-size scale should exist, **derived from the roles buttons play rather than from
a histogram**, is filed as `BUTTON-SIZE-SCALE-01` on a recorded board split.

**Sizes:** `regular` and `compact`, both floored at 44px. Both clear the touch-target floor; compact steps the
radius down with the height so the corner keeps the same curve rather than drifting to a pill.

**States** are all in `.btn`: `:hover`, `:focus-visible`, `:active` (`translateY(1px)`), `:disabled`
(flat, never lifted — an elevated control that does nothing is a lie about affordance), and `busy`,
which disables the button and sets `aria-busy` so a screen reader is told what the dimmed label
says. Transitions ride `--motion-ui` and collapse under `prefers-reduced-motion`.

⚠️ **`soft` takes `--moss-deep`, not `--moss-strong`, and that is measured.** `--moss-soft` resolves
to `#E5E6DE` on `--bg`; `--moss-strong` on that is **4.36:1**, still under AA. The tinted ground eats
more contrast than a flat one, so the gentlest-looking variant needs the strongest ink.

⚠️ **NOT every moss button is this component.** 15 of the 66 use moss as the **selected** affordance
(`WeekGrid`, `DayGridSelector`, `CardSelect`, `RPEScale`, `ZoneRings`). The moss active fill is the
only selected affordance (§ CardSelect) and a fill is graphics at 3:1, not text at 4.5:1. **They are
correct as they are.** Converting them would reverse a standing rule while looking like tidying.

⚠️ **Email is the same button by a different device.** Outlook drops `box-shadow`, so the email CTA
carries a 1px `--moss-deep` border instead of elevation. The fill still owes AA either way.

#### The site uses the CLASSES; the app uses the component *(WEBSITE-BUTTON-UNIFY-01, 2026-09-25)*

**One place to change how a button looks is `globals.css`, and it always was.** `Button.tsx` is a
convenience for the app — thirty lines of prop-spreading — not the home of the design. The marketing
site therefore writes `className="btn btn--primary btn--compact"` on its own `<a>` or `<button>`
rather than importing the component.

🔴 **Two reasons, and the second is not stylistic.** `SiteHeader.tsx` and `app/charity-runners/page.tsx`
are **server** components. Importing a client component into them pushes a client boundary onto a
static page, which is `BUNDLE-BOUNDARY-01` — the class that took the homepage **110 kB → 249 kB** and
**114 kB → 251 kB**, both times silently. `Button.tsx` therefore carries **no `'use client'`**: it
uses no hook, no state and no browser API, so the directive bought nothing and armed that trap.

**`.cta-pill` is deleted.** It was a correct SLT ruling in 2026-09 (the site had *no* hover state at
all; Fried: a missing affordance, not a fidelity nicety) and `.btn` now carries its whole contract.
⚠️ **The second definition had already drifted**, which is the real finding: it supplied only the
three interaction states while each of its 3 call sites hand-typed its own font-size, padding, radius
and label colour — and all three differed, one of them with a literal `'white'`. That is ruling
`:457` (*"one CTA vocabulary"*) one level down. **The site did not have a button; it had three.**

`.btn--pill` exists so the header's fully-round radius is a **declared choice** rather than an
inherited literal (Silvanto: a compact nav pill is a considered shape, and unification must not
flatten a choice into a default).

⚠️ **Two inline properties survive on site CTAs and both are about the NEIGHBOUR, not the button:**
`charity-runners` sets `lineHeight: 18px` to match the App Store badge's icon-driven content box, and
the waitlist button sets `flex`. A property that exists because of what sits *beside* a control is
not the control's own styling.

**Mechanical check:** `components/ui/buttonOwnership.test.ts` reads the **producer** — the buttons
themselves — which is the half `lib/a11yContrast.test.ts` structurally cannot see. That file asserts
`white on --moss-strong >= 4.5`: true, and a fact about a *token*, which is why it stayed green over
all 42 failing controls. Its own header says it checks the tokens and not where they are used.

### 39. IconButton — a control whose whole label is a glyph *(Design Board 2026-09-25, `ICON-BUTTON-01`)*

`components/ui/IconButton.tsx` + `.icon-btn` in `globals.css`. `BackButton` is a **thin wrapper**
over it and its contract is unchanged.

🔴 **The finding was a NAMING ERROR, not a missing component.** `BackButton` already *was* this
primitive — 44px, circle, `--bg-soft`, a required label, with its own contract — but it carried the
name of **one of its uses**. Everything else needing that shape could not reuse it, because reusing
it would have meant calling a close button a back button, so 13 controls were hand-rolled instead.
`ModifyPlanSheet`'s close was `44 / 44 / 50% / --bg-soft`: byte-for-byte the documented spec, written
out again. Collins: *"a taxonomy error at the naming layer produced 13 hand-rolled controls."*

🔴 **And 5 of the 12 had no accessible name.** One was truly silent (an SVG); four were the distance
stepper, where a screen-reader user hears *"minus, plus, minus, plus"* with nothing to say which
number each one moves. **`ariaLabel` is a REQUIRED prop** — an icon button that cannot be named
cannot be constructed, so the compiler stops the next one rather than a reviewer. `:860` records
that the 44px rule was standing **and ignored by half its instances**, which is what a rule with no
mechanism looks like.

| Shape | Surface | Use |
|---|---|---|
| `circle` | `--bg-soft` | Back arrow, sheet close. A surface that says "control" |
| `square` | `--card`, `--radius-sm` | Inside a bordered group (steppers) |
| `bare` | none | A glyph in a dense row (notification bell, move handle) |

**Every one takes `min-width`/`min-height` 44px** (`:262`, iOS HIG) — a minimum, not a fixed size, so
a larger glyph cannot shrink the target below it.

⚠️ **The inline-mark exception is narrow BY CONSTRUCTION and is the ONLY sanctioned way to be under
44px visually.** `SessionSteps`' 15px ringed "i" sits inside a 12px uppercase label; at 44px it stops
being an inline mark and becomes a button parked in a heading, breaking the line box. Silvanto: *"the
visual is right and the target is wrong, and those are separable."* `inlineMark` keeps the glyph and
grows the **hit area** with padding plus a compensating negative margin — **the runner sees 15px and
taps 44.**

⚠️ **A stepper is NOT an icon button** (Wroblewski). It has bounds, repeat-on-hold and a value it
announces; forcing it through this primitive gives the right pixels and the wrong control. The four
`+`/`−` controls keep their names and are filed as `STEPPER-CONTROL-01`.

**Name what the control DOES**, in the runner's words — "Close", "Increase distance" — never the
glyph, never a description of the icon.

**Mechanical check:** `buttonOwnership.test.ts` (no unnamed icon-only control; `ariaLabel` cannot
become optional) and `iconButton.markup.test.ts` (rendered, including that `BackButton` still draws
the documented arrow through the wrapper).

