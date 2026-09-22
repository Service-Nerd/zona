# Website audit — the site as a collection, measured

**Date:** 2026-09-22 · **For:** Design Board sitting one · **Surface:** the public marketing site
**Method:** static source analysis across all 11 rendering surfaces, plus **live computed CSS and
rendered DOM at 375×812** against `localhost:3000`. Every number below was measured, not read off a
document and not eyeballed.

⚠️ **What this does not prove.** Nothing here has run on a device. Two seats (Silvanto on craft and
legibility, Wroblewski on one-handed phone use) cannot rule on *feel* from this, only on structure.
The founder is doing a device pass; rulings that depend on feel wait for it.

⚠️ **Two of my own findings were wrong before they were checked**, both the same class — a source
grep answering a different question from the rendered page. They are recorded rather than quietly
fixed, because the corrected numbers are the interesting ones. See § Corrections.

---

## The founder's complaint, measured

> *"It looks all the same colour, it's quite bland as you scroll down on the phone, and I'm not
> really sure it's telling me a story."*

**Measured on the homepage at 375px:**

| | |
|---|---|
| Page height | **12,028px** = **14.8 phone screens** |
| Sections | 14 |
| Distinct section grounds | **2 changes in 14 sections** |
| Ground breakdown | **12 × `--bg`** (`rgb(243,240,235)`) · 1 × white · 1 × near-black |
| **First ground change** | **8,608px down — 72% of the page, 10.6 phone screens** |
| Dark close | 10,874px — **90% down** |

🔴 **A visitor scrolls ten and a half phone screens before the background changes once.** The
complaint is not a matter of taste; it is the measurement.

### And the cause is NOT a ruling that needs overturning

`W-08` banned **alternating** bands. It explicitly kept a three-ground system: `--bg` everywhere,
**one white spotlight**, **one dark close**. That system is **built and unused**:

🔴 **There are ZERO `surface=` props in the entire codebase.** All 9 `<Section>` calls on the
homepage fall through to the default `page`. The one white band and the one dark band are
hand-rolled with raw tokens, not expressed through the component.

**So the founder's instinct and the existing ruling agree.** Nothing needs to be re-litigated to fix
the flatness; the ruled design simply was never implemented.

---

## 1. Structure — the site is two sites

| Surface | `<Section>` | raw `<section>` | `--sect-y` rhythm | hardcoded px padding |
|---|---:|---:|---:|---:|
| **/ (home)** | **9** | 5 | 5 | 9 |
| /plans | 0 | 5 | 0 | 6 |
| /plans/[slug] | 0 | 7 | 0 | 14 |
| /pricing | 0 | 5 | 6 | 8 |
| /about | 0 | 3 | 3 | 2 |
| /guides + /comparisons | 0 | 3 | 0 | 5 |
| articles (×3) | 0 | 0 | 0 | 3 |
| /charity-runners | 0 | 8 | 6 | 9 |
| /support · /privacy · /terms | 0 | 0 | 0 | 4 each |

🔴 **`<Section>` is imported by exactly one surface out of eleven.** Yesterday's consistency work
landed on the homepage. Every other page hand-rolls its own sections, its own rhythm and its own
padding — which is why they cannot look consistent: **they do not share the mechanism that makes
consistency possible.**

🔴 **Vertical rhythm is hardcoded on every surface including home** (2–14 raw px paddings each), and
seven of eleven surfaces never use `--sect-y` at all.

🔴 **Content measure is ad hoc.** The homepage alone uses **six different max-widths** (520, 540,
600, 620, 720, 760). Legal pages use 640. `/charity-runners` uses 420. Most pages set none.
*(For reference, the competitor measured at a single 1080 everywhere.)*

### The documented three grounds do not exist in the component

| Source | The three grounds |
|---|---|
| `ui-patterns.md` § Section grounds | `--bg` · **`--card` white spotlight** · `--ground` dark close |
| `Section.tsx` `SURFACE` map | `--bg` · **`--bg-soft`** · `--ground` |

🔴 **The documented white spotlight cannot be expressed through the component — there is no `card`
surface.** And `sectionSurfaces.test.ts` forbids the component's actual second ground (`inset`) on
the homepage. The doc, the component and the test describe three different systems.

---

## 2. Hierarchy — nine headings that all shout equally

Rendered at 375px, homepage:

| Level | Rendered size | Count |
|---|---|---|
| H1 | 34px | 1 |
| **H2** | **26px** | **9** |
| H3 | 21px | 3 |
| H3 | **16px** | 4 |
| H2 | **11px** | 4 *(footer column labels)* |

- **H1:H2 step is 1.31×.** Better than the 1.02× the last audit found, but every one of the **nine
  H2s is the identical size**, so nothing on the page is more important than anything else. A
  reader scrolling gets nine equal announcements and no spine.
- 🔴 **H3 renders at two different sizes** (21px and 16px) for the same semantic level.
- 🔴 **Four `<h2>` elements render at 11px uppercase** — they are footer column labels
  (*Train / Read / Company / Get Zonna*) wearing a heading tag. They sit at the same level in the
  document outline as the page's actual content sections, which **dilutes the outline for a
  crawler** and misleads a screen-reader user navigating by heading.

---

## 3. Conversion — the middle of the page is a dead zone

App Store CTAs on the homepage, by scroll position:

| Position | Screen | CTA |
|---|---|---|
| 1% | 0.1 | "Get the app" (header) |
| 4% | 0.6 | App Store badge |
| **—** | **0.6 → 13.9** | 🔴 **NOTHING** |
| 94% | 13.9 | "Get Zonna →" |
| 98% | 14.6 | App Store badge (footer) |

🔴 **A 13.3-phone-screen gap with no way to download the app.** If a visitor is convinced at screen
6 — by the proof card, the zone story, the anti-qualification — there is nothing to act on.

### In-body CTAs across the site

Header and footer carry an App Store link on **every** page (2 each). The real distinction is
whether the page makes a **contextual** ask in its own content:

| Surface | In body | Header/footer |
|---|---:|---:|
| / | 3 | 2 |
| /charity-runners | 2 | 2 |
| /plans · /plans/[slug] · /pricing · /runna-alternatives | 1 | 2 |
| 🔴 **/about · /guides · /comparisons · /support · /privacy · /terms** | **0** | 2 |

🔴 **`/guides` and `/comparisons` are the SEO acquisition hubs and neither makes a download ask in
its content.** Given the founder's ruling that plans and guides are the traffic channel and the app
download is the conversion, **the pages built to catch traffic are the ones that do not convert it.**

---

## 4. The QR code — killed by founder instruction

✅ **DONE 2026-09-22 (SITE-WAVE-1a-i).** All five artefacts removed: the component, the
`public/appstore-qr.svg`, `scripts/generate-appstore-qr.mjs`, `lib/marketing/appStoreQr.test.ts`
and the `readFileSync` in `page.tsx`. Nothing in `package.json` or CI referenced the generator.
⚠️ **Deleting the feature deleted its test**, which left the kill recorded in prose and guarded by
nothing — a new guard now lives in `sectionSurfaces.test.ts` beside W-11's paper grain and the
moss wash, and was falsified by re-adding the reference.

**Design rationale worth recording:** a QR code on a page that is *already being viewed on a phone*
asks the visitor to photograph their own screen. It only works from desktop, and the desktop
visitor is the one least likely to install right now.

---

## Corrections — two of my own findings were wrong

Recorded because the corrected numbers matter and because the class keeps recurring.

1. 🔴 **"Six pages have no App Store CTA."** My source grep matched `apps.apple.com` and missed the
   `AppStoreBadge` component and `BRAND.appStore.url`. **Every page has a header/footer link.** The
   true finding is narrower and sharper: six pages have no **in-body** ask.
2. 🔴 **"Six pages have zero of everything."** They are thin routes delegating to shared components
   (`PlanPage`, `ArticleHub`, `ArticlePage`). Auditing the route files measured the wrappers, not
   the pages.

**Both are the same class this repo has recorded repeatedly: a grep answers the question you wrote,
not the question you meant.** The live DOM settled both.

---

## What the board must rule on

| # | Question | Seats |
|---|---|---|
| 1 | **Adopt `Section` across all 11 surfaces**, or accept two systems? | Zhuo, Silvanto |
| 2 | **Reconcile the three grounds** — doc, component and test disagree. Which three, and where is each spent? | Silvanto ⛔ (palette), Zhuo |
| 3 | **The flat 10.6 screens.** Implement the ruled spotlight/close, or go further now the palette is open? | All five |
| 4 | **Nine equal H2s.** Does the page need a hierarchy of sections, not just of headings? | Silvanto, Collins |
| 5 | **The 13.3-screen CTA dead zone**, and zero in-body asks on the acquisition hubs | Sierra, Wroblewski, Zhuo |
| 6 | **Content measure** — one measure site-wide, or per page-type? | Silvanto |
| 7 | **Footer H2s at 11px** — outline and a11y | Wroblewski |
| 8 | **Is the story right?** Nine sections, no spine. Collins' taxonomy lens on the page itself | Collins |

⚠️ **Palette is open (founder, 2026-09-22), including `--moss` and `--warn`.** By the seam rule the
Design Board rules the hue and the **Coaching Board rules the meaning** of the semantic pair, and
any change lands in the app. Item 2 and item 3 both touch it.
