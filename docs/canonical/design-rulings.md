# Design ruling register — what has been decided about UI and UX, and what may not be re-raised

**Authority:** ADR-023. This file is to the Design Board what
`docs/canonical/coaching-rulings.md` is to the Coaching Board and
`CoachingPrinciples.md` is to the engine: the thing you read **before** the artefact,
not after.

---

## Why this file exists

The Coaching Board learned this the expensive way and wrote it down:

> *"Each sitting was convened from the plans rather than from the prior rulings, so
> items the board had already closed came back as new findings."*
> — `coaching-rulings.md`

Design has the same failure mode and has already paid for it twice, both on 2026-09-21:

| What happened | Cost |
|---|---|
| The **v3 design handoff** asked for alternating warm bands, two ink bands, and a 3% paper-grain overlay. **All three had already been decided against, two of them the same day.** | A whole sitting spent declining things that were already dead |
| **`--surface-moss-wash`** was added by the handoff and deleted eight hours later. W-08 had already cut the site to three grounds; the wash was a fourth. **The rule and the token lived in different documents and never met.** | A token shipped, queried by the founder on sight, and removed the next day |

**A design decision that is not in this file will be re-litigated.** That is not a
prediction; it is the measured history of this repo.

---

## How the board uses it

**The settled-ground scan is mandatory and runs before any seat speaks.** For the
change in front of the board, name every row below that it touches, contradicts, or
would reverse. "No settled ground touched" is a valid result, but only after actually
scanning.

**Re-opening is allowed. Re-opening by accident is not.** To reverse a row, the board
must name it and state **what changed**: new measurement, a new surface, a decision
elsewhere that undercuts its premise, or a founder instruction. *"It feels dated"* is
a legitimate trigger for a sitting (it is exactly how PLAN-ARC-V2 started, and the
component turned out to be genuinely broken). It is not, on its own, a reason to
reverse a row.

**Status key**

| | Meaning |
|---|---|
| 🔴 **KILLED** | Ruled against, permanently. Do not re-propose without the named evidence |
| 🟢 **STANDING** | Ruled in favour. It is the rule until amended |
| 🟡 **UNRATIFIED** | Acted on in practice but never actually ruled on by a board. **Candidates for the first sitting** |
| ⚖️ **NOT DESIGN'S** | Binds design, but another body owns it. The Design Board may object; it may not overrule |

---

## The two authorities inside the board

| | Who | What it means |
|---|---|---|
| **Final say** | **Zhuo (chair)** | Issues the ruling, records dissent, carries escalations to the SLT |
| **⛔ Scoped veto** | **Silvanto** | May veto a **palette or type REGRESSION against a documented rule**. He must **name the rule** in `brand.md` or `ui-patterns.md`; an unnamed veto is a preference and the chair refuses it. Operates inside the board only — the SLT may still overturn the ruling on commercial grounds |
| **Challenge, no override** | **Collins** | May challenge anything including the veto. **Cannot override it.** The route is to change Silvanto's mind, or to propose amending the rule as its own ruling |

**A sustained veto makes the ruling DON'T SHIP**, and the register row records the rule
that was regressed. ADR-023 §1a.

⚠️ **The failure mode to watch is scope creep**: a veto exercised on *"this feels
wrong"* rather than a named regression. The chair refusing an unnamed veto is the only
control, and it is a judgement call, not a mechanical one.

---

## Ownership — owned elsewhere, deliberately

**`docs/canonical/ownership-map.md` is the single owner of the ownership question**
across all three bodies and the founder. This file does not restate it: four copies of
one rule is the defect that produced the `--surface-moss-wash` incident, and the map
exists so ownership never becomes the fifth.

**The seam rule, ratified 2026-09-22:**

> **Design owns the encoding. Coaching owns the meaning. The SLT owns the price.**

The two routings that come up most often, restated here only because they are *routing
instructions* rather than scope:

- **Does it change what the engine prescribes?** → Coaching Board, before this board
  rules. A pixel may present a prescription; it may not change one.
- **Is it a claim about outcomes, physiology, or what training does — on ANY surface,
  including marketing?** → Coaching Board. **W-03** is the precedent: a homepage
  commitments block was a coaching question and was killed as one.

> 🟢 **RATIFIED 2026-09-22 — the restraint rules TRANSFERRED to this board.** *No popups
> · one job per screen / no dashboards, no noise · calm guidance, not alerts · restraint =
> progress · back arrow top-left · slide-up sheets · no red in the training UI* are now
> owned by **`docs/canonical/ux-principles.md` § Screen Design Principles** and are
> **amendable by Design Board ruling** — three artifacts and a row here.
>
> ⚠️ **Amendable is not weak.** Changing one is now a visible, recorded act, which is
> more than `brand.md` ever required. The transfer was made on evidence, not preference:
> four copies, three measured divergences, including `CLAUDE.md` banning modals outright
> by dropping the destructive-confirmation exception. Guarded by
> `lib/marketing/restraintRulesOwnership.test.ts`.

---

## 1. Permanent kills — the marketing site

Record: `slt-2026-09-21-website-slickness.md` · `slt-2026-09-21-homepage-three.md` ·
`brand.md` § Three surfaces.

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **Paper-grain / film-grain overlay (W-11)** | 🔴 **KILLED** — SLT 2026-09-21, unanimous, Wood's kill mandate | Changes no decision, contradicts the documented "no chrome" rule, and **the sole argument for it was that a competitor has it**. Re-asked by the v3 handoff the next day and declined again |
| **A price adjacent to a proof moment** | 🔴 **FORBIDDEN** — Sutherland's reading governs | Three readings were offered (repetition, dilution, timing). **Only timing generalises**: the other two would permit re-adding a price here as long as one was removed elsewhere. The rule is about **where**, not **how often** |
| **The three-card proof band (56px numerals)** | 🔴 **DEAD ON MEASUREMENT, not taste** | All three claims measured false: our easy share is **85.6%** and §1 is per-distance so **there is no single number to print**; two of three cards describe **PAID** features to a free reader; *"most runners manage half that"* is **a statistic about a population we have never observed** (40% exists because it is half of an invented 80%). ⚠️ **It cannot return as "we just need better numbers."** Sutherland: *"when you have a photograph, don't also draw a diagram"* |
| **Phone-geometry resize to 390×844 (3.2)** | 🔴 **DEAD** | Fails Fried's test, the same test that **passed** the hero swap in the same sitting: *does this FIX something, or merely COMPLY?* No reader can perceive the difference, and it means re-measuring every screen inside the frame |
| **Alternating band colours on the marketing site** | 🔴 **KILLED** (W-08) | The site has **three grounds, each spent once**: `page`, one white `inset` spotlight, one `dark` close. Enforced by `lib/marketing/sectionSurfaces.test.ts` |
| **A second full-bleed ink band** | 🔴 **KILLED** | *"Exactly one near-black section per marketing page"* (ADR-008). It goes **last** (W-09) |
| **A tinted surface to make one card special (`--surface-moss-wash`)** | 🔴 **KILLED 2026-09-21**, the day after it was added | It was a fourth ground on a site cut to three. **If a card needs emphasis, it is an inset** (`--bg-soft` + one hairline, `ProductStill`'s pattern). No new token, no new ground |
| **`#5A7C5A` as the CTA colour** | 🔴 **NOT ADOPTED** | The problem it solves was already solved: **`--moss-strong` `#557055`** measures **5.48:1** against the handoff's 4.62:1. Adding it would be a second dark moss for one job |
| **A competitor's price on our pages** | 🔴 **FORBIDDEN** unless it joins `COMPETITOR_FACTS` | Sutherland: *"the moment you say 'cheaper than Miles' you have entered their frame and made price the axis."* Traynor: we cannot maintain a claim about someone else's pricing |
| **A commitments block answering "will I get slower?"** | ⚖️ 🔴 **KILLED** — Coaching Board, W-03 | A block of promises is the weakest instrument against an evidence question. `SameWeekTwice` (W-04) already does the proof job with real plan data. **This is the precedent that a marketing section can be a coaching question** |

---

## 2. Permanent kills — the app

Record: `plan-arc-v2.md` · `slt-2026-08-29-planzy-ux.md` ·
`2026-09-20-p13c-p11-illustration-research.md` · `slt-2026-09-20-miles-teardown-batch.md`.

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **PlanArc variant D — phase track only, no per-week marks** | 🔴 **KILLED** | Three lozenges that restate the label row and discard the deloads, the taper and the shape. Sutherland: **reassurance furniture** |
| **The "rising volume ridge is a growth chart" objection** | 🔴 **ANSWERED, do not reopen** | ⚠️ **This kills the OBJECTION, not the feature.** The risk was misidentified: nobody reads a sawtooth as a trend line, **they read the teeth**. What survives is Wood's two conditions (below) and nothing else |
| **A cumulative total or % complete on PlanArc** | 🔴 **FORBIDDEN** — Wood, binding | **Shape, never completion.** The moment a number aggregates, it is a progress bar, *"the illusion-of-progress class in its purest form"* |
| **Celebrating the peak week** | 🔴 **FORBIDDEN** — Wood, binding | No emphasis, marker or colour change at the tallest bar. *"The peak is the middle of a process, not a summit."* Race week is not special-cased either: a full-height finish-post is the same prohibition in costume |
| **A conversational / chatbot plan wizard** | 🔴 **KILLED** — unanimous | Sutherland: *"a form that's decided to have a personality."* Wood: raises cognitive load and hands an anxious Type-A runner a conversation to manage. Traynor: a conversion risk on the one flow you cannot afford to leak |
| **A projection graph / trajectory curve (UX-PROGRESS-01)** | ⚖️ 🔴 **KILLED** | A smooth downward curve is a promise the app cannot keep, and violates "no dashboards or noise". **The honest ceiling is three points** — baseline → current → goal, never an interpolated slope. Any trajectory viz is a **Coaching Board correctness question first** (§109, §44.1) |
| **A three-tier plan picker ("challenging")** | 🔴 **VETOED** (CD-21c) | The tier flatters the ego the product exists to disarm; Wood: it recruits the over-motivated Type-A's willpower |
| **Weight / height capture in the wizard** | 🔴 **KILLED** | Hutchinson veto + Wood: **illusion-of-progress data**. No formula we hold reads it |
| **Empty-state illustration (bought, free, or commissioned)** | 🟡 **RECOMMENDED AGAINST, never formally ruled** | Free licences exist and are not the problem; the objection is that decoration in an empty state contradicts a product whose argument is the absence of decoration. ⚠️ **Explicitly recorded as "a taste call made against the documented rule"** and never put to a board. **First-sitting candidate** |
| **A commissioned line-art illustration style** | 🔴 **SUPERSEDED** | The value in the competitor's is that **the drawing IS the volume curve** — and neither a stock pack nor a commissioned one can know the runner's curve. We hold it. Folds into P-06 as generated output |
| **A stock-footage launch screen (P-11)** | 🟡 **RECOMMENDED CLOSE, never ruled** | *"The single most generic thing a running app can do"*, and there is no launch-screen problem: the Capacitor splash holds and hands off. **First-sitting candidate** |
| **A paid "coach register" / DHTB voice tier (P-07)** | 🔴 **KILLED** | Traynor's reason is distinct from the others': it makes the personal brand a **purchasable component**, a dependency on a person written into the revenue line, and `brand.md` says the app must outlive the personal brand |
| **Pill words on the compliance statement** | 🔴 **CUT** | The colour carries the meaning. Sutherland: *"a glossary entry is what you write when you don't trust the thing you made."* Most runners see no change; a minority see jargon |
| **A privacy reassurance sentence at the health-connect step** | 🔴 **CUT**, link only | Sutherland: *"a man saying 'I've never been to prison' during a job interview."* It introduces an AI, and things being sent to it, at the moment someone decides whether to hand over their heart rate |
| **Dropping `ZoneRings`** | 🔴 **REVERSED — retained** | It is **one of three** components on the marketing homepage's ProductStill trio: literally one third of the public face. Its own header calls it *brand-mark-as-data-display* — the four concentric rings of the Zonna mark **are** the four zone buckets. Dropping it would recreate the defect class where the site promises what the app no longer contains |

---

## 3. Standing rules — the visual system

Sources: ADR-007, ADR-008, `brand.md` § Visual Principles, `ui-patterns.md`,
`ux-principles.md`, `CLAUDE.md`.

| Rule | Status | Owner |
|---|---|---|
| **Warm Slate, single light theme. No dark mode, no toggle** | 🟢 STANDING | ADR-007 / ADR-008 → Design Board |
| **All colour from CSS custom properties. No hardcoded hex, ever, in a component** | 🟢 STANDING | Design Board (pre-commit enforced) |
| **Inter only.** Space Grotesk, DM Mono, DM Sans retired | 🟢 STANDING | Design Board |
| **Session accent resolves through `getSessionColor(session)`**, passing the whole session | 🟢 STANDING | Design Board (`sessionColourReach.test.ts`) |
| **moss = held the zone · amber = cooked it** | 🟢 STANDING (P-01) | Design Board; the **threshold** is Coaching Board (`ZONE_DRIFT_ABOVE_CEILING_PCT = 20`) |
| **Amber's drift meaning is scoped to completion states only** (option A) | 🟢 STANDING | Otherwise a race week drawn in amber reads as a reprimand for racing |
| **Type accent, not flood.** Session colour as left border, dot or chip; never a full card background | 🟢 STANDING | Design Board |
| **No chrome.** No stacked shadows, no gradient on gradient, no decorative dividers | 🟢 STANDING | **Design Board** (transferred 2026-09-22) |
| **Elevation is `--shadow-card` / `--shadow-lifted`.** Do not design a new elevation system | 🟢 STANDING (P-13 correction) | Both are already warm-tinted on `26,26,26`, which is the mistake most briefs warn about and we had already avoided |
| **Eyebrow tracking is 0.08em** | 🟢 STANDING (standardised 2026-09-20, 64:17) | A competitor's 0.14em is explicitly not a reason to reopen it |
| **The four numeral tokens are NOT part of the reading scale** | 🟢 STANDING | Keeping `--fs-verdict/numeral/numeral-lg/step` separate is what stops the reading scale drifting back to nineteen values (`SITE-TYPE-01`) |
| **Every motion token collapses to `0s` under `prefers-reduced-motion`** | 🟢 STANDING | One `@media` block at the end of `globals.css`, so a component cannot forget. The JS half is the component's |
| **A cross-fade is ≤12% of the loop and ≥0.15s** | 🟢 STANDING, gated | Tuned against a 7s loop, then the loop became 3s and nothing else changed: the fades became **21.7%** of the cycle. ⚠️ **First dismissed as a screenshot artefact** |
| **No red in training UI** | 🟢 STANDING | **Design Board** (transferred 2026-09-22). `--danger` for form/error only |

---

## 4. Standing rules — interaction and screens

| Rule | Status | Owner |
|---|---|---|
| **One job per screen. No dashboards. No noise.** | 🟢 STANDING | **Design Board** — owner is `ux-principles.md` (transferred 2026-09-22) |
| **No popups.** All interactions navigate to a full screen. ⚠️ **Modals ARE permitted for destructive confirmation (delete, disconnect) and forbidden for information** — `CLAUDE.md` lost that exception, which is what triggered the ownership transfer | 🟢 STANDING | **Design Board** (transferred 2026-09-22) |
| **Back arrow always top-left** | 🟢 STANDING | Design Board |
| **Slide-up sheets carry a mirrored nav bar at the BOTTOM**, never a top-right Cancel | 🟢 STANDING | Explicitly the point of difference from the competitor's sheet (P-02) |
| **Never a disabled primary as the resting state** | 🟢 STANDING (P-02) | "Nothing changed" shows a single full-width Close, not a greyed Apply implying the runner has failed to do something |
| **Skeleton shimmer, never a spinner.** `<AIMark working />` for AI in flight; `zonna-ptr-pulse` for refresh | 🟢 STANDING | Design Board |
| **AIMark only on actual model output** — provenance honesty | 🟢 STANDING | Never on rule-engine output, hand-authored copy, or Strava data. A refresh pulse deliberately does **not** borrow the sparkle |
| **44×44pt minimum tap target; session cards ≥64px** | 🟢 STANDING | iOS HIG |
| **Left-aligned with a consistent margin. Never centred-only** | 🟢 STANDING | Design Board |
| **Vertical scroll only**, except the week strip | 🟢 STANDING | Design Board |
| **All five states ship together**: loading, empty, error, data, edge | 🟢 STANDING | SLC "Complete". A screen without its empty state is not shipped |
| **Upgrade prompts are behaviour-triggered, never calendar-triggered** | ⚖️ SLT / `ux-principles.md` | No countdown, no "X days remaining" |
| **Gate richness, never access.** A locked row stays visible and readable | 🟢 STANDING | One lock language across the product (`CardSelect` `locked` + `lockLabel`) |
| **Marketing stills must be the REAL components** | 🟢 STANDING | ⚠️ *A doc about a screen is not the screen.* A still rebuilt from `screen-architecture.md` passed its gate over a Plan tab **with no weeks on it** |

---

## 5. Standing rules — how this board reaches a verdict

These are not visual rules. They are the ones that stop a design ruling being wrong,
and every one was bought with a defect.

| Rule | Why it exists |
|---|---|
| 🔬 **Rule on the MEASUREMENT where a measurement is possible.** Computed CSS, contrast ratio, rendered geometry, bundle size, Lighthouse. Say which surface and which method | The website audit found **no type scale at all** (170 hand-typed sizes, 30 half-pixels) and an **H1:H2 step of 1.02×**. None of that was visible by looking |
| ⚠️ **A screenshot is evidence about a screenshot.** Confirm against the live DOM before ruling | Twice in one day: a headless full-page capture showed the page clipped at the right (**a capture artefact** — "fixing" it would have broken a working layout), and a real cross-fade defect was **dismissed as** a capture artefact |
| ⚠️ **A passing layout assertion is not a passing layout.** Bound what you measure | `scrollWidth === innerWidth` stayed true while the gutter collapsed from 320px to **5px** |
| ⚠️ **Bound the region; never grep the file.** | A new check was hollow: deleting the inset border did not fail it, because the card *inside* has an identical one. **Third substring-bias miss in one day.** `toContain('<PlanCalendar')` also matches `<PlanCalendarX` |
| ⚠️ **A guard that fires on ordinary work gets switched off**, which this repo has twice recorded as equivalent to having no guard | The rgba rule must not fire on legitimate scrims; it needs an escape with a stated reason, not a blanket ban |
| ⚠️ **Flexbox merges loose text once the element between them is hidden.** Declare pairs; never leave a separator's line break to the browser | The fact row took **four** cuts at one middot. Three failed because CSS cannot select "first or last on its line" |
| ⚠️ **An inline style beats a media rule.** | A centring media query never applied because `justifyContent` was set inline |
| ⚠️ **A client import pulls the whole module graph.** A marketing page can drag the plan engine into the browser | 110→249 kB and 114→251 kB, **both silent**. Stubbing the suspected component did not move the number. Now gated at +6 kB by `clientBundleBoundary.test.ts` |
| ⚠️ **Check the rule and the token in the same pass.** | `--surface-moss-wash` was legal in `globals.css` and forbidden by a rule in `ui-patterns.md`. **The rule and the token lived in different documents and never met** |

---

## 6. Sitting one — the website as a collection (2026-09-22)

Record: `docs/investigations/website-audit-2026-09-22.md` · backlog `SITE-WAVE-1/2/3`.

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **The three grounds are IMPLEMENTED, not re-litigated** | 🟢 **SHIP (wave 1)** | ⚠️ **W-08 was never the cause.** It banned *alternating* bands and kept one white spotlight and one dark close. **Zero `surface=` props exist in the codebase** — the system was ruled, built and never used. **Do not re-open W-08 to fix flatness** |
| **`<Section>` adopted across all 11 surfaces** | 🟢 **SHIP (wave 1)** | Used by **1 of 11** today. Pages that do not share the mechanism cannot share the result |
| **The doc/component ground mismatch is a DEFECT** | 🟢 **SHIP (wave 1)** | `ui-patterns.md` says `--card` white; `Section.tsx` implements `--bg-soft`; the test forbids `inset` on home. **Three documents, three systems.** The documented white spotlight cannot currently be expressed through the component |
| **One content measure** | 🟢 **SHIP (wave 1)** | The homepage alone uses **six** max-widths |
| **Section hierarchy, not just heading size** | 🟢 **SHIP (wave 1)** | Nine `<h2>` at identical 26px is a list. H3 renders at two sizes for one level |
| **The QR code** | 🔴 **KILLED** — founder instruction | A QR on a page already being read on a phone asks the visitor to photograph their own screen. It only works from desktop, and the desktop visitor is least likely to install now |
| **A contextual CTA at the proof moment** | 🟢 **SHIP (wave 2)** | **13.3 phone screens with no download route.** The most persuasive section is at 53% and there is nothing to tap. ⚠️ **Never adjacent to a price** |
| **In-body CTAs on `/guides` and `/comparisons`** | 🟢 **SHIP (wave 2)** | Zero in-body asks on the two SEO acquisition hubs |
| **Adopting the app's session-colour language on the site** | 🟡 **INSUFFICIENT EVIDENCE — blocked on wave 1** | **The app uses six session + four phase colours; the site's own language is greyscale plus one green.** Session colours appear only in `PhoneFrame` and `PlanPage`, i.e. where the app is *shown*. **What settles it:** ship wave 1, founder looks again |
| **Decorating all fourteen sections equally** | 🔴 **REJECTED** — Sierra | Most sections are *about the app*; one makes the reader **better** at running. The answer is fewer sections at full weight, not more colour on all of them |

⚠️ **Recorded disagreement, unresolved by design: Silvanto vs Collins** on whether the
ruled three grounds are *sufficient* or merely *unimplemented*. Both hold; the wave
order sequences it without either conceding.

⚠️ **Sitting one did not settle whether the page's STORY is right.** Wave 1 makes it
legible, not an argument. **That is sitting two.**

---

## 6b. Built — SITE-WAVE-1a and 1b-i/ii (2026-09-22)

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **The App Store QR code** | 🔴 **KILLED, all 5 artefacts removed** | ⚠️ **Deleting the feature deleted its test**, which left the kill guarded by nothing. A guard now sits in `sectionSurfaces.test.ts` beside W-11 and the moss wash |
| **The hardware caveat follows the proof** | 🟢 **SHIPPED** | It sat above the evidence card on mobile, so a hardware requirement gated the one asset a competitor cannot copy |
| **Footer column labels are `<h3>`** | 🟢 **SHIPPED** | Four 11px `<h2>` sat at the same outline level as content sections |
| **`Section` has a `card` surface** | 🟢 **SHIPPED** | `ui-patterns.md` documented the white spotlight since W-08 and the component could not express it, so the homepage hand-rolled `background: var(--card)`. Doc, component and test described three different systems |
| **All 11 marketing surfaces use `<Section>`** | 🟢 **SHIPPED, zero visual delta** | Adoption was **1 of 11**. Pages that do not share the mechanism cannot share the result. ⚠️ **Zero delta measured on 7 surfaces at 375px** — the win is that `surface=` now EXISTS everywhere, so 1b-iii can spend a ground |
| 🎯 **PROOF PRECEDES MECHANISM** | 🟢 **SHIPPED** — proof moved **52% → 24%** | The founder stopped reading at screen 2.5 of 15.2 and never reached the one section that teaches. Guard binds to **source order**, not a percentage |
| **"Three things, done with restraint" SECTION** | 🔴 **CUT** | A feature list between the hook and the proof |
| 🔴 **…but the ProductStill trio SURVIVED** | 🟢 **RETAINED — the settled-ground scan caught this** | Cutting the section wholesale would have **deleted ZoneRings**, which the register retains as *"one third of the product's public face"*. Dropping it recreates PLAN-LONGRUN-COLOUR-01. **The wrapper died; the trio moved** |
| **The two refusal sections are one** | 🟢 **SHIPPED** | *"What's not in the app"* now sits inside the white band with *"Probably not for you if…"*. One move done twice made both weaker |

**Measured:** sections **14 → 11**, page **12,317 → 11,841px** (15.2 → 14.6 screens), content `<h2>` **9 → 8**.

⚠️ **The page is only 4% shorter, and that is a real tension with sitting two.** The ruling
said *"the page gets shorter and makes an argument"*. It makes a better argument — proof at
24% instead of 52% — but the **content was preserved by settled ground**, so only section
chrome was removed. **Sitting three should decide whether the ProductStill trio earns its
place now that it no longer has a section of its own.**

---

## 6c. SITE-WAVE-1b-iii — the spotlight and the hierarchy (2026-09-22)

| Ruling | Status | May not be re-raised without |
|---|---|---|
| 🎯 **The white spotlight marks the PROOF, not the refusal** | 🟢 **SHIPPED.** First ground change **screen 9.2 → 3.4 (63% → 24%)** | ⚠️ **`ui-patterns.md` §257 AMENDED, not contradicted.** It read *"the white band is spent on 'Probably not for you if…'; anti-qualification is the most distinctive thing on the site."* **That was true of a page whose proof sat at 52%, and sitting two moved the proof to 24% — we changed the premise ourselves, two hours earlier.** Sierra: the refusals are the brand enjoying itself, good writing and zero transfer; the proof is the only section that makes the reader better and the one a competitor whose proposition is encouragement **structurally cannot print** |
| **Still exactly ONE white spotlight** | 🟢 **GUARDED** | W-08's *"a spotlight, not a rhythm"* is untouched. The test counts across every marketing file, not just the homepage. A second white band is the alternation W-08 killed |
| **The dark close did not move** | 🟢 W-09 binding | Still one near-black band, still last, still 88% |
| **Heading hierarchy: 8 equal H2 → a real scale** | 🟢 **SHIPPED** | H1 34 → **H2 26 ×4** → **H3 23** sub-beats → H2 23 standalone-but-quieter. Eight headings at one size is a list with eight equal entries, not a hierarchy |
| ⚠️ **SIZE and TAG are separate** | 🟢 **GUARDED** | 🔴 **The first cut conflated them and produced two real defects:** standalone sections (FAQ, free tier) became `<h3>` subordinate to whatever preceded them, and **the refusal band inverted** so its subordinate heading led. **A tag is an outline claim; a size is a design one.** Caught by reading the RENDERED OUTLINE, not the source |

**Measured:** page **11,841 → 11,773px**, first ground change **screen 9.2 → 3.4**, content `<h2>` **8 → 6**.

⚠️ **Collins dissents on sufficiency, not direction, and it is recorded rather than
synthesised:** one ground change at 24% beats one at 63%, but it is still **two changes in
14.5 screens**. His wave 3 question — should the site adopt the app's session-colour
language — is **not answered by this** and remains open.

⚠️ **A guard of ours went red and was RIGHT to.** The sitting-two merge check anchored on
`surface="card"` because the refusal band held the spotlight at the time. 1b-iii moved it
and the check failed. **It was encoding a premise a later ruling changed**, so it now
anchors on the merge itself. A guard that asserts today's incidental arrangement will fail
the next ruling; assert what was actually ruled.

---

## 7. Assigned and not yet ruled

| Item | Seat | State |
|---|---|---|
| **CD-1 — the taxonomy half** | **Collins (first assignment)** | Five differently-named quality sessions resolving to one prescribed pace is a **presentation** question: does the product show the runner distinctions the engine does not make? That is CD-1 **option (a)**. Options (b) and (c) change what the engine prescribes and **route to the Coaching Board**. ⚠️ **The premise has MOVED** — the 2026-08-19 catalogue audit found *three* distinct quality intensities for a time-goal 10K and concluded CD-1 is **conditional on goal type and distance**; CD-2's half is already ruled (**§120**). **Take the measurement before the board speaks:** across the nine published plans, how many distinct prescribed paces do the differently-named quality sessions resolve to, per distance and per goal type? |
| ~~The restraint rules~~ | — | 🟢 **CLOSED 2026-09-22 — transferred to this board by founder ruling.** No longer a sitting-one agenda item |

---

## 8. Open, and the founder's

Not this board's to close without him.

| Item | State |
|---|---|
| **Is the fact row the right MESSAGE?** | Open since 2026-09-21. Dropping the price was recommended and deliberately **not** shipped: it touches W-05, and *a question is not an instruction* |
| **The unreproduced "things aligned to the right" on mobile** | Needs a screenshot or a section name. Measured live, `scrollWidth === innerWidth` |
| **Whether the week-2 deload notch is EXPLAINABLE to a runner who asks** | PLAN-ARC-V2 chose to make a known defect visible. §119's producer fix is now **URGENT, not deferred** — Hutchinson's reasoning governs over Traynor's "nobody is watching" |

---

## Maintenance

**Every Design Board ruling appends here in the same commit as its decision note.** A
process whose memory depends on someone remembering to write it down has no memory:
that sentence is in `coaching-rulings.md` because the Coaching Board proved it.

`.claude/hooks/design-guard.py` fires on edits to the doctrine files and asks for the
board or a stated exemption. It cannot check that this file was updated. That is the
known hole, and it is the same hole `ship-record-check.py` was built to close on the
feature registry.
