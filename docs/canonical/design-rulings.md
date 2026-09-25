# Design ruling register — what has been decided about UI and UX, and what may not be re-raised

**Authority:** ADR-023. This file is to the Design Board what
`docs/canonical/coaching-rulings.md` is to the Coaching Board and
`CoachingPrinciples.md` is to the engine: the thing you read **before** the artefact,
not after.

---



## 2026-09-25 — UI-PATTERNS-REVIEW-01 · SHIP, no amendment. The doctrine was sound; the reading was wrong.

Founder asked the board to review `ui-patterns.md` as a whole against the brand and the
goal of wow moments, and specifically to revisit **"no chrome"**.

🔴 **THE SITTING WAS BRIEFED ON A FALSE PREMISE AND THE REGISTER CAUGHT IT.** The brief
said *"no chrome has never been board-ruled"*. It is row **:202**, 🟢 STANDING, transferred
to this board **2026-09-22**. Recorded because it is exactly the stale-premise trap the
skill warns about, and the scan is what stopped it.

**Nothing needed revisiting.** "No chrome" forbids **stacked** shadows, gradient **on**
gradient, and **decorative** dividers. It has never forbidden a shadow — § Card Elevation
mandates one on 20 files, and row **:203** sanctions `--shadow-lifted` by name.
**`--shadow-lifted` has ZERO consumers.** The doctrine had already authorised the tool
nobody was using, and the reading of it blocked `BUTTON-COMPONENT-01` for a month.

**Wroblewski:** motion is not banned either — sheets animate both ways, `AIMark` pulses,
`prefers-reduced-motion` exists. The one *"no motion"* is scoped to the marketing header.
**Second constraint in the same sitting that people believed in and does not exist.**

**Ruling: SHIP, no amendment.** `BUTTON-COMPONENT-01` is **unblocked and needs no ruling** —
it proceeds against existing doctrine. Two gaps filed rather than fixed:

- **Sierra — enforcement.** 3,230 lines, 28 sections, **~10 guarded by a test**. The other
  18 are held by whoever remembers, and this repo's record is that such a rule is not a
  rule. `UI-PATTERNS-ENFORCEMENT-01`.
- **Collins — moments.** The document describes components and almost no *moments*; one
  line (*"Highest-emotion moment — treat it as such"*) in 3,230. Named as a gap, not a
  fault. `UI-PATTERNS-MOMENTS-01`.

**Veto:** none — Silvanto declined for the second consecutive sitting and asked for the
declining to be recorded, so the seat reads as narrow rather than dormant.

⚠️ **Unanimous, and recorded as such rather than dramatised**: the question had already
been answered and misfiled.

---

## 2026-09-25 — TIME-INPUT-SECONDS-01 · SHIP WITH AMENDMENT

**Should every time-entry field take seconds? Yes, and the decision leaves the call site.**
`DurationPicker` was already the canonical shared control across six sites and already
supported seconds — behind a prop defaulting to **false**, set at three and forgotten at
three. **The drift § Form Fields & Pickers was written to end had survived as a prop.**

🔴 **The three screens did not omit seconds, they FABRICATED them** (`` `${h}:${mm}:00` ``).
Measured live before the board spoke: **12 of 12 stored times end `:00`** (4/4 targets,
8/8 benchmarks). ⚠️ **And the error always runs FAST** — 11.8 sec/km at 5K, 5.9 at 10K,
2.8 at HM — feeding every prescribed pace in a product built to stop people running too
hard. Silvanto: the benchmark screen **displays** `1:45:28` and **refuses** `:28`, in the
same scroll.

**Amendment (Wroblewski's, and he did not move):** a target is an intention, not a fact, so
the wizard's seconds wheel **defaults to `00`** — a runner with no view expresses none at
zero cost. **Recorded as unsettled**; the evidence that would decide it cannot exist until
this ships.

**Veto:** none — Silvanto declined explicitly, first sitting he has, and the register
should show the seat is narrow rather than dormant.

**Routing:** flagged to the **Coaching Board**, not blocked on it — input precision changed,
no prescription rule did, but the coaching seats should know their benchmarks have been
optimistic by up to 11.8 sec/km. Same shape as §50's max-HR asymmetry.

**Artifacts:** `ui-patterns.md` § *A time field always collects SECONDS* · the prop deleted
from `DurationPicker` · `lib/timeInputSeconds.test.ts`, falsified both ways.

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
| **`Section surface="inset"` as a full-bleed PAGE BAND, on any marketing page** | 🔴 **KILLED 2026-09-22**, sitting five § 6q | `Section.tsx`'s own header already said it: *"`inset` IS NOT A PAGE GROUND… Spending it as a section ground is band alternation, which W-08 killed."* `/about` did exactly that for weeks because **`sectionSurfaces.test.ts` opened `const HOME = 'app/page.tsx'` — the gate was scoped to one page**, so a rule written against band alternation could not see it anywhere else. **If a card needs emphasis it is an inset CARD, not an inset BAND** |
| **A tinted surface to make one card special (`--surface-moss-wash`)** | 🔴 **KILLED 2026-09-21**, the day after it was added | It was a fourth ground on a site cut to three. **If a card needs emphasis, it is an inset** (`--bg-soft` + one hairline, `ProductStill`'s pattern). No new token, no new ground |
| **`#5A7C5A` as the CTA colour** | 🔴 **NOT ADOPTED** | The problem it solves was already solved: **`--moss-strong` `#557055`** measures **5.48:1** against the handoff's 4.62:1. Adding it would be a second dark moss for one job |
| **A competitor's price on our pages** | 🔴 **FORBIDDEN** unless it joins `COMPETITOR_FACTS` | Sutherland: *"the moment you say 'cheaper than Miles' you have entered their frame and made price the axis."* Traynor: we cannot maintain a claim about someone else's pricing |
| **`SITE-WAVE-3` — the site adopting the app's session-colour language** | 🔴 **KILLED 2026-09-22 on the founder's device verdict** | Collins' question was ruled INSUFFICIENT EVIDENCE at sitting one, with the settling artefact named as *"ship wave 1, founder looks again."* Waves 1, 2 and 4 shipped; he looked, on a phone, and the answer was **"its better."** ⚠️ **The measured finding stands and does not reopen it**: the app uses **six session colours and four phase colours** while the site's language is greyscale plus one green, so the product IS more colourful than the page selling it. That was true before the verdict and is not new evidence. ⚠️ **This row existed only as prose in §6e for several hours** — the state blocks said KILLED and the register, which the settled-ground scan actually reads, did not. A kill that is not in the register is a kill the next sitting re-proposes |
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
| **Empty-state illustration (bought, free, or commissioned)** | 🔴 **KILLED 2026-09-22 — RATIFIED, sitting five, § 6q** | Free licences exist and were never the objection: decoration in an empty state **contradicts a product whose argument is the absence of decoration**, on the same screen. Sierra: an empty state exists to say what to do next, and a drawing takes that sentence's space. Collins declined to fight it and said why. ⚠️ **Measured: 16 empty-state strings in `DashboardClient` alone, none carrying an illustration** — the ruling builds nothing and changes only that it may not be re-proposed. It had been recorded as *"a taste call made against the documented rule"*, made by one person with no board |
| **A commissioned line-art illustration style** | 🔴 **SUPERSEDED** | The value in the competitor's is that **the drawing IS the volume curve** — and neither a stock pack nor a commissioned one can know the runner's curve. We hold it. Folds into P-06 as generated output |
| **Building the ICON-RULE-01 row icons (Me + the modify sheet)** | 🔴 **NOT DOING IT — founder, 2026-09-22.** A decision, not a park | ⚠️ **The RULE still governs**: if a row icon ever appears it must earn its place by MEANING or by LOCATION on a list of >= 8 rows, one glyph, one size, one family, one non-semantic tint (Silvanto binding), and `lib/marketing/iconRule.test.ts` enforces it. What is declined is BUILDING the set now. **Collins had already said so on the record at the ruling itself** — *"icons on settings rows will not make anyone tell a friend about this app"* — and asked that it never be cited as progress against "stand out". The founder's call is the same call, one day later. **May not be re-proposed as a wow item; only as a measured findability problem on Me** |
| **A swipeable plan-reveal card stack with a "3 / 5" position counter** (the P-06(b) half) | 🔴 **KILLED 2026-09-22** — Wroblewski + Zhuo, § 6p | **The reveal takes ZERO input today** — `GeneratingCeremony` staggers `RevealCard` over `repWeeks` and hands off. A swipe adds N gestures and a dismissal decision to someone who has just answered fifteen wizard questions. **The pacing it was proposed to add already exists** |
| **A handwriting typeface for the plan annotation, shipped without amending `Inter only` by name** | ⚖️ 🔴 **VETO STANDS** — Silvanto, § 6p | The veto is against it arriving quietly, **not** against the rule being amended openly. ⚠️ **The typeface question itself is DEFERRED, not refused**, and cannot be answered until there is a chart at the reveal to annotate (`DESIGN-REVEAL-SHAPE-01`) |
| **A stock-footage launch screen (P-11)** | 🔴 **KILLED 2026-09-22 — RATIFIED, sitting five, § 6q** | *"The single most generic thing a running app can do."* ⚠️ **Wroblewski: there is no problem to solve, and that is the ruling** — the splash is configured and working (`backgroundColor: #F3F0EB` = `--bg`, `showSpinner: false`, `launchAutoHide` with a 10s cold-start net, hidden on web mount by `CapacitorBoot.tsx`), so a launch screen would add a wait that does not currently exist. If ever revived, § 6's non-identifiable rule applies to anyone in frame |
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
| **A contextual CTA at the proof moment** | 🟢 **SHIPPED 2026-09-22** — at screen 5.1, right after the proof. Largest in-body CTA gap **12.7 screens → 8.3**. ⚠️ **No card wrapper**: 1b-iii gave the proof the white spotlight, so the usual in-body CTA card would be a white box on a white ground | **13.3 phone screens with no download route.** The most persuasive section is at 53% and there is nothing to tap. ⚠️ **Never adjacent to a price** |
| **In-body CTAs on `/guides` and `/comparisons`** | 🟢 **SHIPPED 2026-09-22** — both hubs went from **zero** in-body asks to one, reusing `PlanPage`'s established CTA card rather than inventing a hub variant | Zero in-body asks on the two SEO acquisition hubs |
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

## 6d. Founder device pass, 2026-09-22 — two findings, two root causes

The founder looked at the pushed site on his phone. Both observations were correct and both
turned out to be larger than the symptom.

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **Step numerals must clear 3:1** | 🟢 **SHIPPED** — `--bg-soft` (1.07:1) → `--mute` (4.80:1) | 🔴 **Reverses `DESIGN-V3`.** They were near-invisible ON PURPOSE and drawn as SVG *because "axe does not evaluate SVG as text"* — **a decision not to be told about a failure**, which also failed on its own terms because the target reader could not see them. Sierra: 01/02/03/04 is **wayfinding**; perceivable or deleted, never invisible-but-present |
| **A ground token may never be an SVG `fill`** | 🟢 **GUARDED** | `--bg`, `--bg-soft`, `--card`, `--line` cannot clear 3:1 on their own ground by definition |
| **`a11yContrast.test.ts` now checks USAGE, not just tokens** | 🟢 **SHIPPED** | ⚠️ **The file could not see the defect it exists to catch.** Every other check reads tokens pairwise and never looks at where one is used. Same shape as `--surface-moss-wash` |
| **`SITE-WAVE-4` / `SITE-SPACE-01` — a spacing scale** | 🟢 **SHIPPED 2026-09-22.** `--space-1…7`; **69 occurrences swept**, 32 already exact, 37 shifted ≤4px; largest page impact **26px on 11,773 (0.2%)** | **448 gaps measured on six pages: 24 distinct values, 19 of them real spacing decisions** (≤5px are line-box artefacts, excluded). **19 is the same number `SITE-TYPE-01` found for font sizes.** Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48`; **52% of gaps already land on it exactly**, 48% shift by ≤4px. ⚠️ **Ships WITH its sweep, never before** — a token family nobody applies is the `surface=` failure repeated |

⚠️ **THE BOARD RULED ON NUMBERS I INVENTED.** The contrast table put to the seats used
GUESSED hex values: `--mute` was presented as 3.22:1 and is actually **4.80:1**; `--mute-2`
as 2.21:1, actually **1.90:1**. The ruling survives on the corrected figures and `--mute`
is still right on semantics, but the record shows the board deciding on fabricated
measurements. **Read the token, never recall it.**

---

## 6e. Second founder device pass, 2026-09-22 — `SITE-BEAT-01`, and the board's own merge caused it

He answered the wave-3 question — **"its better"** — and in the same breath named three more
gaps: *"the tile above A plan that fits you… the your zones on Coach image and How it goes…
the what's not in the app tile and HONESTLY. there's no space."* **Measured live on all three
before the board spoke: 0px, 0px, 0px.** He found the entire population; a browser sweep of
the page and of `/pricing`, `/about`, `/plans` and `/charity-runners` found nothing else.

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **`--beat-y` — a section is separated from a section; a BEAT must be separated from a beat** | 🟢 **SHIPPED.** `calc(var(--sect-y) * 0.7)` → 39 / 43 / 56px at 375 / 1024 / 1440 | 🔴 **SITTING TWO CAUSED THIS.** The merges were right, and a `<Section>` boundary was the thing carrying the space: deleting the boundary deleted the space. Only the merged sections were affected; four other pages measured clean. **When you merge two containers, the gap between them was a property of the CONTAINER** |
| **Derived from `--sect-y`, never a fourth independent clamp** | 🟢 **GUARDED** — the test rejects any value that is not `calc(var(--sect-y) * f)`, `0.4 < f < 1` | A beat spaced like a section makes the merge **cosmetic**: the reader still meets two equal announcements, which is exactly what sitting two set out to remove. `calc` makes subordination true at every viewport rather than true because two clamps happen to agree |
| **`Eyebrow beat` applies `paddingTop`, not `marginTop`** | 🟢 **SHIPPED** | An eyebrow is frequently the FIRST child of its wrapper, and a first child's top margin collapses out through a padding-less, border-less parent. **It renders identically today** — which is why the next wrapper to gain a border would move the gap with nothing failing |

🔴 **"I thought you fixed those" — he was right to ask, and the honest answer is that
`SITE-WAVE-4` could not have.** That sweep measured **448 gaps that existed**. A gap of zero
is not a gap, it is an **absent decision**, and a scale test can only tokenise a value
somebody already typed. **A spacing audit finds wrong values and is structurally blind to
missing ones.** Wave 4's own register row above records "448 gaps measured" as its evidence;
that number was never the population, and nothing said so until now.

⚠️ **Two of our own guards went red on a change that reversed no ruling.** `sectionSurfaces`
anchored beat order on the literal string `<Eyebrow>Honestly</Eyebrow>`; adding a prop broke
it. The rule those tests carry is the **order of the page's beats**, and a tag's attribute
list is not part of that claim. Same shape as the four refusal strings that broke eight prose
matchers. They now match by text, tolerant of props.

⚠️ **What the new gate does NOT prove.** It anchors on `<Eyebrow>`, which is how two of the
three beats open. The third opens with a bare grid and is held by a count assertion alone —
**a new block-opened beat with no gap would pass.** There is no general way to recognise "a
block that starts a beat" from source; the browser sweep is the wider instrument.

---

## 6f. SITE-MEASURE-EDGE — the content edge walked down the page (2026-09-22)

Third founder device pass, and the first on **desktop**.

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **One left edge: a narrower measure narrows the box, it does not move it** | 🟢 **SHIPPED.** `--measure-read` nests inside the page frame; **3 left edges → 2, edge moves 4 → 1** | Measured at 1440px: `168 · 168 · 168 · 168 · 168 · 168 · 358 · 358 · 168 · 358 · 338`, while header and footer both sat at **168**. 🔴 **`ui-patterns.md` gives `--measure-page` its purpose in those words — *"matching the site frame so the content edge stops moving as you scroll"* — so the rule's own reason was what the page was breaking.** The cause was one property: `margin: '0 auto'` on a 720px box inside an 1100px frame pushes it **190px inboard** |
| **720px for prose stays** | 🟢 **STANDING, untouched** | The measure was never the defect. A 1100px line of body text is unreadable; W-07's two measures are correct. **Do not re-propose collapsing to one measure** |
| **The dark close is centred — the ONE exception** | 🟢 **RATIFIED** | W-09 makes it the page's punctuation and it goes last. One deliberate break at the end is a full stop; four accidental ones mid-page are a mess |
| **`SITE-MEASURE-THIRD-01` — the 760px third measure** | 🔴 **RETIRED** | It matched no rule and existed because somebody typed a number (Collins). Now `--measure-read` |

| **A `width="full"` Section must re-wrap its content in the page column** | 🟢 **SHIPPED** — found by the founder on the SECOND desktop pass, after the edge fix | The ProductStill trio was moved into the mechanism band by sitting two and landed as a **sibling** of the page-column wrapper. The Section is `width="full"`, so at 1440px the trio rendered **24-1412 — the full screen** — while every other band sat at 168. 🔴 **IT SURVIVED A MEASUREMENT AIMED STRAIGHT AT IT:** the edge audit collected elements carrying a `max-width` and took the smallest left edge; this grid has **no max-width at all**, so the band reported its neighbour's 168 and read as correct. **A measurement that only looks at elements WITH the property cannot find the element that is MISSING it.** |

⚠️ **THE EDGE FIX DID NOT FIX WHAT HE ASKED ABOUT.** His words were *"those are using the full span of the page"* — the trio, literally full-bleed — and I measured the prose bands' centring, found a real defect, fixed it, and reported done. **Both were real; only one was his.** Read the complaint against the artefact before deciding which defect it names.

⚠️ **INVISIBLE AT 375px**, where both measures collapse to the gutter. **Two founder device passes missed it and a third, on desktop, did not.** A viewport is part of a design check's scope, not a detail of how it was run — and every measurement in this register until now was taken at 375.

⚠️ **The gate was first written as `.tsx` and vitest never ran it** — the include pattern is `components/**/*.test.ts`, so it reported "No test files found" and would have sat green-by-absence forever. A test the runner cannot see is the purest hollow check there is.

---

## 6g. THE APP REVIEW — sitting three (2026-09-22)

**Brief:** `docs/canonical/app-review-brief.md`, founder, verbatim. **Blank sheet**, conditional on
naming up- and downstream impact; a significant brand change goes to the SLT first. The standard is
**feeling** — *"I want them to talk to their friends about the app"* — and correct-and-forgettable
has failed it.

**Evidence:** the founder's notes on Today, Plan, Coach, Me, Session Detail (screenshots), Login;
`WIZARD-HARNESS-01`'s walk of the full 18-step flow; and the measurements below.

### Systems — ruled before any screen, because six of his notes are one decision each

| Ruling | Status | May not be re-raised without |
|---|---|---|
| **S1 — one sheet pattern, over the nav** | 🟢 **RULED 2026-09-22 — SHIP WITH AMENDMENT. See § 6i.** (was: ⚠️ RETURNED TO THE BOARD, mis-escalated.) Slide-up sheets are ALREADY approved (`ux-principles.md`) and a shared `Sheet` primitive already exists (`SHEET-PRESENT-01`) owning z-index, nav inset, animation, focus trap. 🔴 **The founder is reversing HIS OWN prior rule**, encoded in that primitive: *"come up from the nav bar but not overlay it."* Not a brand change, not the SLT's — **one property on one primitive.** ⚠️ **The board escalated this as "reverses no-popups" and that was wrong: the scan ran against the restraint rules and never looked for the primitive** |
| **S2 — dismiss is never `--moss`** | 🟢 **SHIP** | `--moss` is the CTA colour. Spending the strongest colour in the system on *dismiss* teaches the opposite of what it means, on every sheet. Silvanto: not a veto today, **but a `--moss` close shipping after this sitting is one** |
| **S3 — one CTA vocabulary** | 🟢 **SHIP** | Measured in the wizard: **four labels for one button** — `Continue` · `Continue →` · `Got it →` · `Skip this →` — with the arrow on some and not others |
| **S4 — an optional step's primary may never be the SKIP** | 🟢 **SHIP.** The sharpest finding of the review | Measured: the moss primary (`rgb(107,142,107)`, white text), largest target on the screen, in the thumb zone, reads **"Skip this →" on 5 of 15 steps.** Answering costs a tap; declining costs none. **We built a wizard that is easiest not to fill in** (Wroblewski) |
| **S5 — one time-to-race vocabulary** | 🟢 **SHIP** | Three today: *"214 days to go"* (Plan) · *"30 weeks 4 days out"* (Today) · *"77 days until then"*. Collins: **three vocabularies for one fact is the product not knowing what it is saying** |
| **S6 — an icon language, bounded** | 🟢 **SHIP WITH AMENDMENT** | Only where a label **repeats down a list** (session types, day markers, plan adjustments). **Never replacing a label read once.** Silvanto: *an icon is a word the reader has to learn* |

### Screens

| Ruling | Status | |
|---|---|---|
| **A1 — week navigation leaves Today** | 🟢 SHIP | Today is one day; Plan owns weeks. Duplicated today |
| **A2 — Plan leads with the plan** | 🟢 SHIP | Five tiles before the first week, on a screen called Plan |
| **A3 — the race appears once on Plan** | 🟢 SHIP | Twice today |
| **A4 — tab bar rebalanced** | 🟢 SHIP | Measured: `padding: '6px 0 max(12px, env(safe-area-inset-bottom))'` — **6px above the icons, 34px below**, asymmetric by 28px. The safe-area inset is being spent as CONTENT padding; it is **background**. ⚠️ The founder said *"move the menu down"*; the fix is to rebalance the content, not move the bar |
| **A5 — Coach gets a progress language: SHAPE, never SCORE** | 🟢 SHIP | **Load ratio as a bare number is KILLED.** Sierra: *a number that has to be tapped to mean anything has taught nobody anything.* 🔴 **This reverses "no dashboards" — recorded as a reversal**, on Zhuo's distinction: the rule was against a wall of numbers substituting for a decision, not against showing a runner their own progress |
| **A6 — Me stays a settings screen** | 🟢 SHIP | See the permanent kill below. Fix **flat** — order, hierarchy, visualisation, icons — not with a price |
| **A7 — Login unchanged** | 🟢 SHIP | Fit for purpose is the right answer for a door |
| **A8 — Session Detail: a RUN-NOW block** | ⚖️ **SHIP WITH AMENDMENT — and it contradicts the founder** | He asked for one page. **Not granted as stated:** the screen's job is the full prescription, and compressing it means deleting prescription, which is the Coaching Board's. **The complaint is right and the diagnosis is wrong** — the problem is not length, it is that the thing you need mid-run is not at the top. A run-now block fits one screen; everything else stays below it. **Nothing is cut; the order changes** |

### 🔴 Permanent kills

| | |
|---|---|
| **A settings screen that merchandises** | **SLT, unanimous.** Sutherland: *a feature list is the weakest instrument you own* — put the answer where the question occurs. Fried: every screen doing a second job does the first worse. Wood: **Me is the lowest-frequency surface in the product**, so it is the worst place for a conversion moment and the best place to feel like nagging. ⚠️ **Traynor's seat is VACANT and this was his question** — no seat prices conversion, and his recall trigger (a measurable trial-to-paid rate) does not exist. We would be designing a funnel nobody has observed, which is the three-card proof band's error. **May not return without a measured conversion problem traceable to Me** |
| **"Wow" delivered as ornament** | Collins: *the wow in this product is the honesty.* Gradients, decorative iconography, chrome. Already standing as W-11 |

### INSUFFICIENT EVIDENCE

- **The move-a-run gesture.** The founder wants hold-and-drag; **Wroblewski pushed back** — drag on a scrolling list, one-handed, outdoors, is the hardest gesture on a phone and has no discoverability. His counter: **tap the session, tap the day.** Board split; needs a prototype. 🔴 **CLOSED 2026-09-22 — WE ARE NOT DOING IT** (founder). Not parked, not unsettled: decided. The tap flow stands as the only move gesture. **The prototype and every trace of it have been REMOVED from the code.** May not be re-proposed without named new evidence. See § 6l. 🔴 **And the split above was recorded wrong: Wroblewski's "counter" is what ALREADY SHIPS.** See § 6k.
- **The black line above the nav.** Untraced — it is **not** the nav's border, which resolves to `rgba(26,26,26,0.08)`. No ruling on an unidentified artefact.
- **Anything past wizard submission** — ceremony, plan preview, confidence badge, difficulty card. Unwalked.

⚠️ **Seven defects were separated out and are NOT this board's**: `Apply 1 change` doing nothing ·
units ignoring the profile · week totals on some weeks only · back returning to Today · health
access prompting while connected · "one session behind" when none was due · em dashes in Coach copy.
They go through `/zona-debug`.

---

## 6h. BUILT — app review waves 1–3 (2026-09-22)

| Ruling | Built | The artifact, and what it cost to prove |
|---|---|---|
| **S2** dismiss is never `--moss` | ✅ `APP-REVIEW-W1` | ⚠️ **The check was wrong three times**: a hand-written three-file list that missed the actual offender, a word match that fired on the prose `'Close. Bit of fine-tuning to do.'`, a handler match that fired on Orientation's `"I'm ready"`. The property is the **label**, on a tree walk |
| **S3** one CTA vocabulary | ✅ `APP-REVIEW-W1` | Four labels → one. Arrows stripped |
| **S4** an optional step's primary is never the skip | ✅ `APP-REVIEW-W1` | 🔴 **RELABELLED, NOT REMOVED — and the board said removed.** Five of six optional steps have no `FieldLabel` to hang *optional* on, so "remove" literally would delete it from one step and leave it on five. Departure recorded |
| **A4** tab bar rebalanced | ✅ `APP-REVIEW-W1` | 6px above the icons, 34px below. The safe-area inset is background, not content padding |
| **S5** one time-to-race vocabulary | ✅ `APP-REVIEW-W3` | Owner moved to `lib/format.ts` (`daysUntilRace` + `formatRaceCountdown`), ADR-015's file. ⚠️ **The formatter already existed and three of four call sites went round it**, and there were **four** arithmetic sites — three `ceil`, one `round`. 🔴 **The website was mirroring the format BY HAND with a comment promising it matched**; the consumer check found it and it calls the owner now |
| **A1** week navigation leaves Today | ✅ `APP-REVIEW-W3` | ⚠️ **A restoration, not a new rule** — `screen-architecture.md § Today` already listed weekly navigation under *does not belong here*, and the code had drifted. Arrows, screen-wide swipe and the mirrored `viewWeekIndex` state all gone. The seven day cells stay |
| **A2** Plan leads with the plan | ✅ `APP-REVIEW-W3` | Race → arc → **weeks** → everything that explains them, with *"Change your plan"* first below so the screen's one action is the next thing after the calendar. **Nothing cut**, and the gate asserts all five blocks still render |
| **A3** the race appears once on Plan | ✅ `APP-REVIEW-W3` | Name, date and countdown in one block under the header. The countdown is deliberately **not** under the arc: the arc is the shape of the training, the countdown is a property of the race, and hanging it there is what made the race read twice |

⚠️ **One falsification was a NO-OP and read as a passing gate.** A2's reversion sliced the
file using post-fix indices, so nothing moved and the check stayed green — which is
indistinguishable from a hollow check until you look. Redone against the real ordering, it
goes red on two assertions. **Third time this repo has recorded a falsification that did not
apply; a mutation must be shown to have changed the file.**

---

## 6i. S1 — the sheet covers the nav (2026-09-22)

**Ruling: SHIP WITH AMENDMENT.** The founder's ask is granted. **The amendment is that the
reason on the record is neither his nor the board's first one.**

| | |
|---|---|
| **Asked for** | *"These load above the NAV bar, the nav goes grey. I'd like them to load on top of it."* |
| **First handled as** | An SLT escalation, *"reverses no-popups"*. 🔴 **Wrong.** Slide-up sheets are separately approved in `ux-principles.md`; the no-popups rule governs whether a sheet EXISTS, not where its bottom edge lands. **The scan ran against the restraint rules and never looked for the primitive** |
| **Reverses** | SHEET-PRESENT-01's *"come up from the nav bar but not overlay it"* — the founder's own earlier rule. Explicitly, by name |

**📐 The measurement killed the argument both sides were having.** Covering the nav buys
**0px on an iPhone SE and 5px (0.6%) on a 13/15.** This was never about room.

**What the measurement found instead** — source geometry, not impression:

| Property | Value | Consequence |
|---|---|---|
| Backdrop | `position: fixed; inset: 0` | Spans the nav |
| Layer | `Z_LAYERS.sheet` 4000 vs `nav` 3000 | Paints over it |
| Fill | `--scrim` `rgba(26,26,26,0.40)` | Nav dimmed 40% toward ink |
| Handler | `onClick={close}` | **Tapping a nav icon dismissed the sheet. It did not navigate** |

The nav was **visible, dimmed, and lying** — four destinations, one behaviour — across all
**six** sheet instances, in the thumb's home strip. Sierra: *trust in navigation is the
cheapest thing a product owns and the most expensive to rebuild.* Collins: *resting on the
nav was hedging; a sheet is a commitment.*

⚠️ **Wroblewski, recorded so it does not return: the alternative was WORSE.** Leaving the
nav live and un-scrimmed contradicts `role="dialog"` + `aria-modal="true"` + the focus trap,
which no screen reader can resolve, and puts two competing exit gestures inside 80px.

⛔ **Silvanto, binding, not a veto:** `maxHeightVh = 88` is load-bearing. **A sheet covers
the nav; it does not become a screen.** He would veto a later move to full height; what
would move him is content that genuinely cannot fit at 88vh, which would itself be evidence
the content belongs on a screen. Not tested.

🔴 **The rule this reverses was never actually guarded.** `sheetPresentation.test.ts` asserted
`expect(src).toContain('paddingBottom')`, which `paddingBottom: 0` satisfies exactly as well
as `paddingBottom: navH`. Nine days of a green tick with nothing behind it — the
`--section-gap` class — **found while reversing the rule it was supposed to protect.** Four
real assertions now, each falsified, and mutation A was verified to have changed the file
before its red was believed.

**Artifacts:** pattern → `ui-patterns.md` § Slide-up Sheet (amended) · constant →
`maxHeightVh = 88` + `Z_LAYERS` unchanged · check → `sheetPresentation.test.ts`, 4 new
assertions, all falsified.

**⚠️ What this does not settle:** nobody has seen it on a device. The ruling turns on a
control that lies, which is a source fact; whether covering the nav *feels* right in the
hand is not established, and this product's standing weakness is that nothing has ever run
on one.

---

## 6j. BUILT — app review wave 4: A5, A6, A8, and S6 building nothing (2026-09-22)

| Ruling | Built | |
|---|---|---|
| **A5** Coach: shape, never score | ✅ | The verdict is the hero, `LoadShape` shows where the week sits against the runner's real normal, the ratio is evidence underneath. **Demoted, not deleted.** The band reads `LOAD_RATIO.under/.watch` — the constants the coaching layer flags on — because a band drawn at numbers the engine does not use is a picture of nothing. ⚠️ **`0.8` was a bare literal inside a display function**, governing what the runner is told and invisible to every config check this repo owns; now `LOAD_RATIO.under`, value unchanged. ⚠️ **The Sessions tile deliberately keeps its number** — `3/5` means something without a tap, which is exactly Sierra's test — and the gate asserts the asymmetry so nobody "makes them consistent" |
| **A8** Session Detail: run-now first | ✅ | The structured set was the **sixth** block, below the rationale, whose own comment read *"brand-defining content reads first"*. The set now precedes it. **Nothing cut** — the rationale reads one scroll later, when the runner is deciding rather than executing. ⚠️ **The founder asked for one page and that was not granted**: compressing means deleting prescription, which is the Coaching Board's |
| **A6** Me stays settings, fixed flat | ✅ | Two findings, both about a section not describing itself. (1) The display toggles sat **unlabelled inside "Your training"**, justified by *"they affect session cards"* — by which argument almost everything on the screen is training. They have a `Display` section now. (2) 🔴 **The section called "Plan" contains the SUBSCRIPTION card**, in a product where *plan* is the noun on the nav bar, the wizard, the arc and the marketing site. Collins: a word used for two things is not a word. Renamed `Subscription`; the SLT's kill on a merchandising settings screen stands, and the gate asserts no feature list appears there |
| **S6** an icon language, bounded | ⚪ **APPLIED — AND IT BUILDS NOTHING TODAY.** Correct outcome, recorded so it is not re-opened as an oversight | Measured against S6's own three named surfaces: **Plan rows** print `session.label` at 15px/500 → labelled; **plan adjustments** print `labelSession()` before and after → labelled; the **day marker** is a **4px** dot → no room for a glyph. The founder asked for icons, the board bounded them, and the bound does not reach. **Inventing a set anyway would be decoration with a ruling stapled to it** |

🔵 **What S6's measurement DID expose, filed not built:** the `DateStrip` dot carries **two
orthogonal facts on one channel** — eight session-type hues *and* completion state — so a
completed interval and a completed easy run are the same teal dot, and a skipped session is
grey, which is also how a muted type reads. `DESIGN-DAYDOT-CHANNEL-01`. It needs its own
ruling, not a paragraph inside someone else's.

⚠️ **What wave 4 does not settle:** nothing ran on a device. A5's claim is that a shape is
read faster than a decoded ratio, and **that has not been observed** — the source facts
(hero type size, channel, constants) are what was verified. A8's ruling says a run-now block
*fits one screen*; the reorder puts the right things first, and **whether it fits was not
measured.**

---

## 6k. MOVE-PROTOTYPE-01 — the artefact for the one thing the board could not settle (2026-09-22)

Sitting three left the move gesture at **INSUFFICIENT EVIDENCE**, needing a prototype.
`/move-preview` is it: real generated week, both gestures, instrumented, 404 in production.

🔴 **The split was recorded wrong, and it changes the question.** Wroblewski's "counter" —
*tap the session, tap the day* — **is what already ships**: tap the `↕` handle, the week
enters move mode with *"Tap where you want it"*, tap a day, and an inline confirmation row
names source, destination and swap before anything is written. So the board is not choosing
between two designs. It is asking whether drag is worth **replacing a shipped flow that an
incident hardened**.

⚠️ **The safety is held constant, deliberately.** The 2026-06-26 root cause was a runner who
did not realise the tap-to-move he had executed *was* a move; the override and the AI summary
that followed corrupted his taper. **A drop IS a commit gesture** — so drag that wrote on
release would re-open exactly that, and the prototype would be comparing a safe flow against
an unsafe one and reporting that the unsafe one is faster. Both modes stage into the **same
`pendingMove` and the same confirmation row.** Only acquire-and-place varies.

🔴 **AND IT DID NOT WORK ON A PHONE. The founder tried it; my verification could not have
caught that.** I drove the gesture with **synthetic `PointerEvent`s dispatched straight at
the element**, which bypasses the browser's gesture arbitration entirely — so it tested the
handlers, not the gesture. Three mechanisms, fixed:

| | |
|---|---|
| **`touch-action` was set only once the press ARMED** | The browser resolves it **at touch start**, and the press arms 350 ms later — so the property changed and the in-flight gesture did not. The list scrolled, the browser fired `pointercancel`, the drag died every time. Now a **non-passive `touchmove` listener** takes the gesture once armed, which is what every real drag library does. ⚠️ React's own `onTouchMove` is attached passively and `preventDefault()` in it is ignored |
| **`pointercancel` was wired to the RELEASE handler** | A scroll the runner never meant as a drop could stage a move or count a miss. It aborts now |
| **The row's `onClick` fires on release** | Dropping a run on Thursday and landing on Session Detail is not a drop. Suppressed |

⚠️ **The gate was ENFORCING the bug.** `movePrototype.test.ts` required the exact
`touchAction: dragMode && isMoving` expression that does not work — a green, falsified check
guarding the wrong mechanism, and only a real finger could ever have caught it.

⚠️ **A second defect found on the way:** `endAttempt()` ran **inside a `setMovingDay` state
updater**, so the telemetry called the parent's setter during render (React said so) and
under StrictMode would have **double-counted the very measurement the prototype exists to
produce**. Side effects moved out of the updater.

📟 **The page now prints a raw browser trace** — `pointerdown` / `CANCEL` / `scroll` / `up`
with timings — because *"it doesn't work"* is not a bug report and **a dev machine cannot
drive a real touch gesture.** If `CANCEL` appears, the browser claimed the gesture.

**Verified on a running server, both paths end at the identical confirmation row** (*"Move
Long run — Zone 2 from Sun to Thu?"*), and a press that moves before it arms is correctly
treated as a scroll and logs nothing.

🔴 **Two defects found in the instrument before anyone used it, both in the board's favour
to miss:**

| | |
|---|---|
| **The clock started when the press ARMED, not at first touch.** A 450 ms hold plus a move reported **162 ms** | Drag was timed from 350 ms in while tap was timed from the finger landing — under-reporting drag by exactly the cost under test. **A biased instrument does not produce a weak ruling, it produces a confident wrong one.** Corrected: the same gesture now reads **515 ms** |
| A scroll that never armed was going to be logged as an **abandoned attempt** | Every flick down the list would have inflated drag's abandon rate, turning the number into a count of scrolling |

⚠️ **What the numbers on the page are NOT.** The synthetic run reads tap **2 interactions /
63 ms** against drag **2 interactions / 515 ms**, and **neither is a human measurement** —
the tap figure has no dwell between targets, and the drag figure is dominated by a scripted
hold. **The page exists so the founder generates real ones on a device.** The one structural
fact that is not synthetic: **drag carries a mandatory ~350 ms floor before anything happens
at all**, and tap does not.

📐 **The number to rule on is "dropped on nothing"** — the cost Wroblewski named, and the one
a demo run by whoever built the gesture will always under-report.

---

## 6l. MOVE-PROTOTYPE-01 — CLOSED, NOT DOING IT (2026-09-22)

**Founder:** *"The move-drag gesture you can mark as complete as we are not doing it."*
**This is a DECISION, not a park.** Four rounds, never made to work in his hand.

🔴 **The code is GONE, not disabled.** `moveMode`, `onMoveTelemetry`, `onMovePhase`, the
pointer handlers and `/move-preview` are all removed. An unreachable path behind a
default-off prop is not a spare tyre — it is dead weight that the next reader has to
understand before they can change anything near it. The tap flow is the only move gesture
and always was.

⚠️ **May not be re-proposed without named new evidence.** Wroblewski's original objection
stands unrefuted: drag on a scrolling list, one-handed, outdoors, has no discoverability and
a hold threshold the user cannot feel.

**Nothing is lost and nothing is at risk.** `moveMode` defaults to `'tap'`, the Plan screen
passes no such prop, and the shipped tap-tap-confirm flow is untouched. The prototype is a
committed page that 404s in production.

**Where it actually stands, so a future sitting does not restart from zero:**

| | |
|---|---|
| **Fixed and proven by test** | `touch-action` set after the press armed (the browser resolves it at touch START) · `pointercancel` wired to the release handler · the row's `onClick` firing on drop · `setTimeout`'s id left in the ref, so the **first movement cancelled a press that had already succeeded** · `endAttempt()` inside a state updater, which would have **double-counted under StrictMode** |
| **Never established** | **Whether the gesture works on a real touch device.** Nothing in this repo has ever run on one, and the dev machine could not drive real input — the browser pane was not compositing frames |
| **The instrument now** | The page prints the gesture's **own** phases (`press` / `ARMED` / `press cancelled` / `drop` / `released on nothing`) interleaved with browser events |

🥇 **The lesson worth more than the feature: instrument what YOUR CODE did, not what the
browser did.** The first trace logged `pointerdown` / `pointercancel` / `scroll`, and **a
press that never armed and a press that armed and was torn down produce an identical
browser trace.** Two rounds of *"still doesn't work"* carried no diagnosis for that reason
alone.

⚠️ **To unpark, the first move is a device, not more code.** One run of the phase panel
answers in a line what three rounds of reasoning did not.

---


## 6t. UNITS-SUBUNIT-01 — the card told 39.7% of mile runners they covered zero (2026-09-23)

| Decision | Status | Why |
|---|---|---|
| **A session part that apportions to zero whole units shows its DURATION** | 🟢 **SHIP WITH AMENDMENT** | A 0.71 km cool-down is 0.44 mi and printed `~0mi`. Measured on 48,547 sessions via `resolveDisplayFigures`, the owner the card calls: **19,275 sessions (39.7%) in miles, 1,805 (3.7%) in km**, cool-down in every one of the mile cases, real distances 0.25–1.27 km (median 0.71). Every zero part has 2–9 real minutes; **zero cases of both-zero**. Sierra: the runner is *prescribed* "cool down easy, 5 minutes" — `<1mi` is a measurement of a thing they do not measure and cannot act on without knowing their pace |
| **The SAME-UNIT rule does not survive, because it was never a ruling** | 🔴 **AMENDED** | 🥇 **It lived only in `sessionReconcile.test.ts`, never in `ui-patterns.md`** — which documents that the parts *sum* and never that the headers share a kind, and whose **shipped time-trial diagram renders `WARM-UP 10 min` beside a distance main set**. The one shape that disproved the assertion was **carved out of it** (`NON_PARTITIONED_SHAPES`) rather than examined. **The carve-out was the tell.** Same shape as `--surface-moss-wash`: the rule and the pattern in different documents, never meeting |
| **Whole card flips to minutes when any part is sub-unit (option B)** | 🔴 **KILLED** | Wroblewski: it silently disables the distance toggle on **~40% of sessions in miles**. The runner set that toggle; removing it because a cool-down is short is the product overruling a stated preference without saying so |
| **`<1mi` for a sub-unit part (option C)** | 🔴 **KILLED** | Silvanto: a third notation on a card whose language is whole units behind a `~`. Collins: three ways to say "a short bit at the end" is taxonomy bloat when minutes already exist |
| **The replacement check asserts the GUARANTEE, not the mechanism** | 🟢 **SHIPPED** | Distance-kind parts sum to the header; **a minutes part must have apportioned to exactly 0**, so the fallback cannot hide real ground — which a kind check could not have told you either way. ⚠️ **Tested in km as well as miles**: the obvious version would have run on miles alone, where the founder saw it and where 91% of it lives, and been green on the 1,805 km sessions with the same defect |

⚠️ **The filing RCA was wrong twice, and measuring is what corrected it.** It said *"never happens in km"* (it does, 3.7%) and blamed `formatDistance(0.8,'mi')`, which fires **zero** times on session distances. `apportionRoundedDistance` is the only live mechanism.

⚠️ **Not measured: nobody has seen this on a device.** The ruling is on `resolveDisplayFigures` output, not on a rendered card.

⛔ **Veto check:** Silvanto declined — no documented palette or type rule is regressed.

## 6u. The plan surfaces — six findings from one screenshot pair (2026-09-23)

| Decision | Status | Why |
|---|---|---|
| **`APP-SPACE-01` — the ruled spacing scale reaches the APP** | 🟢 **SHIPPED** | 🔴 **`SITE-WAVE-4` ruled `--space-1…7` and swept the SITE. Measured a day later: `var(--space-*)` appeared 17× in `components/marketing` and ZERO times in `app/dashboard` or `components/shared`** — against **578 hand-typed gaps, 25 distinct values, 13 off-scale >5px**. The site had **24 / 19** when ruled: **the app was in the state the site was in before the fix**, and Wave 4's own row had warned *"a token family nobody applies is the `surface=` failure repeated."* Swept **295 tokenised with no visual change, 277 shifted, none >4px** (260 looser, 17 tighter) |
| **The tie breaks UPWARD** | 🟢 **SHIPPED — and the first cut got it wrong** | 6px is equidistant from 4 and 8; rounding DOWN tightened the app's **commonest** off-scale gap, **74 of them**, **on the day the complaint was crowding**. Whitespace is a documented feature, so a tie resolves in favour of more of it |
| **Bottom clearance is NOT a gap** | 🟢 **DECLARED EXCLUSION** | Three `paddingBottom` values (120/120/80px) on `minHeight:100%/overflowY:auto` containers are the room the **fixed tab bar** needs; snapping to 48px puts content **under the nav**. The mirror of Wave 4 excluding ≤5px: one end of the range is noise, the other is safe area, **neither is spacing** |
| **The reported gap was an ABSENT decision, not a wrong value** | 🟢 **SHIPPED** | § 332 said it already: *"a gap of zero is not a gap, it is an absent decision … a spacing audit is structurally blind to missing ones."* The arc-to-tile gap read 6px because the tile declared **no top margin at all**. **The sweep alone could not have fixed the thing that was reported** — the value is now declared (`--space-4`) |
| **`ACTION-ROW-01` — one pattern, and it carries the chevron** | 🟢 **SHIPPED** | Founder: *"it's not clear you can click on it."* 🔴 **Cause was STRUCTURAL: the chevron was a local `const` inside the Me screen.** Seven rows used it; the Plan screen **could not reach it**, so its tile shipped with **no affordance**, beside session rows that all have one. 🥇 **A PATTERN THAT IS A LOCAL VARIABLE CANNOT TRAVEL.** `components/shared/ActionRow.tsx`; the CONTAINER stays with the caller (Me stacks rows in one card, Plan has a standalone one) |
| **Dates** | 🟢 **ANSWERED SAME DAY — `DATE-OWNER-01` SHIPPED. DO NOT RE-PROPOSE THE PREFERENCE.** | Measured: **9 distinct formats, 22 hand-written sites, no owner, every one hardcoding `'en-GB'`**, plus **one raw ISO** (`starts 2026-12-07`). ⚠️ **But NOT ONE FORMAT WAS AMBIGUOUS** — every one names its month, so `24 Apr 2027` reads correctly to an American, merely in an unfamiliar order. **And no date/locale preference exists** in `user_settings` (units + metric only). 🔴 **SLT RULED: BUILD THE OWNER, DON'T BUILD THE PREFERENCE.** Fried: *"a new setting is permanent surface area — a preference, a migration, a Me-screen row and a branch in every call, to change WORD ORDER for people who can already read the date."* Sutherland: the rational problem is localisation; **the real one is that the app looks assembled rather than designed.** ⚠️ **The founder ASKED for the preference and was told plainly we were building the opposite.** **RECALL TRIGGER:** we ship outside the anglosphere, or a runner actually asks. Record: `docs/decisions/slt-2026-09-23-dates.md` |
| **Two charts on the plan preview** | ⚠️ **INSUFFICIENT EVIDENCE** | `PlanHeroMetrics` + `PlanArc`, plus a phase-colour strip and PLAN SHAPE cards. Collins: *"three encodings of one fact — collapse it."* Chair declined to collapse a reveal moment on a screenshot. **Settling artefact: what does each element tell the runner that the others do not?** |
| **`ModifyPlanSheet` — "functional but a bit meh, doesn't line up"** | ⚠️ **INSUFFICIENT EVIDENCE** | A symptom, not a measurement. The board rules on geometry: **what is misaligned, in px, on which element.** Not taken |

⚠️ **Three of the six were SHIPPED and three were NOT.** The three that shipped each had a number
behind them before a seat spoke; the three that did not are the ones where the founder described an
impression and nobody had yet measured it. **That split is the board's evidence rule working, not
the board being slow.**

## 6v. The plan preview had FOUR encodings of one plan (2026-09-23)

| Decision | Status | Why |
|---|---|---|
| **`PreviewPhaseStrip` is removed from the plan preview** | 🔴 **DON'T SHIP** | 🔴 **TWO BAR-LIKE ROWS WHERE HEIGHT MEANT DIFFERENT THINGS.** `PlanArc` sits ~90 lines above on the **same scroll** and encodes **weekly volume as bar height**. The strip was also a row of bars and **its height carried no meaning** — 60% for foundation, 100% for everything else. Collins: *"a runner who has just learned that tall means hard scrolls ninety lines and meets bars that are all the same height. **That is not redundancy, it is a contradiction.**"* Its only unique channel was **colour = phase**, which the `Plan shape` cards name **in words immediately below**; its volume lived in a `title=` attribute, **unreachable on a phone** (Wroblewski) |
| **Removing it fixed a SECOND contradiction nobody had reported** | 🟢 **RECORDED** | The strip rendered `Race · Wk {mainWeeks.length}` = **20** while `PlanHeroMetrics` renders `plan.weeks.length` = **23**. **Two week counts for one plan, on one scroll**, differing by the foundation block. Found during the pre-delete check of what the strip uniquely carried |
| **The "before your plan" framing is NOT lost** | 🟢 **VERIFIED BEFORE DELETING** | The foundation `PhaseSummaryCard` renders **"3 weeks"** and its description opens **"Pre-plan easy running"**. Each of the strip's three parts was checked for coverage before removal, not after |
| **Collapsing `PlanArc`, `PlanHeroMetrics` or the phase cards** | 🔴 **NOT GRANTED on this evidence** | Collins wanted the taxonomy collapsed further. **Each of the three carries a channel the others do not**: numbers (peak + total), shape (per-week volume, progress, race), and words (phase names, ranges, prose). Four was never the problem; **two contradicting bar rows were** |

⚠️ **MEASURED, NOT IMPRESSION.** Phase was encoded **three times** (arc rail, strip colour, card
names) and peak volume **three times** (hero metric, tallest bar, card "peak 41km"). The chair
declined to rule on the screenshot and required the encoding table first.

⚠️ **THE GATE ASSERTS THE GUARANTEE, NOT THE ABSENCE OF A COMPONENT** — *"only one element maps
weeks to a row of bars"* and *"the screen states ONE week count"*. A test that said
`PreviewPhaseStrip is gone` would pass against a renamed re-implementation of the same defect.
🔴 **Falsifying it found TWO flaws in the test itself, both mine**: my own JSX comment quoting
`mainWeeks.length` failed my own assertion (**seventh** *bound the region, never grep the file*),
and `toContain('<PlanArc')` passed against `<PlanArcX` — **the exact substring-bias flaw quoted in
that file's own header, committed three lines after quoting it.**

## 6w. `ModifyPlanSheet` — "I just don't like it", measured (2026-09-23)

⚠️ **THE INPUT WAS AN IMPRESSION AND THE BOARD'S JOB WAS TO MEASURE IT, not to ask the founder for
px.** Taking the measurement then **withdrew two of my own four findings** — which is the rule
working against the person who invoked it.

| Decision | Status | Why |
|---|---|---|
| **The day selector lays out on a fixed COLUMN COUNT** | 🟢 **SHIPPED** | It was `flex` + `flexWrap`: **six days on row one, "Sun" alone on row two.** Collins: *"'Sun' on its own line is the whole impression, in one row."* ⚠️ **Seven across is NOT AVAILABLE at 375pt** — 7 × 44px + 6 × 8px = **356px** against ~**307px** of card content width; **even at zero gap 7 × 44 = 308 > 307.** One row costs the **44px tap target**, which is not worth trading for tidiness. So the wrap is made **deliberate**: `repeat(4, minmax(0,1fr))` → **4 + 3**. **An orphan reads as a mistake; a balanced pair reads as a layout** |
| **The dashed border is removed** | 🟢 **SHIPPED** | `1px dashed var(--line-strong)` on "Start a new plan" was **the only dashed border in the product** and read as *unfinished* rather than *optional*. The row's subtitle already carries that it replaces the plan (PLANVERB-01); the border was not the thing saying it |
| **"Four corner radii in one sheet"** | 🔴 **WITHDRAWN — I over-called it** | Two of the four are `50%` on **a close button and a 6px dot** — both legitimately circles. The remaining pair is `--radius-md` on the Apply button against `--radius-lg` on cards, and **no convention exists to breach**: 27 `lg` vs 14 `md` across `components/shared`. **Not a defect** |
| **"The injury chips orphan too"** | 🔴 **WITHDRAWN — I over-called it** | They are **variable-width** pills. Wrapping is what chips do, and forcing them into a grid would give equal columns to labels of very different lengths — **worse**. The day circles are different in kind: **seven equal items in a fixed set**, where 6 + 1 is unambiguously wrong |
| **The race date input** | ⚠️ **DEFERRED to its own sitting** | It is the **only centred control and the only native one** on a sheet of six left-aligned segmented controls — the "doesn't line up". But replacing a native `<input type="date">` carries an iOS keyboard/zoom history already recorded in that file, and the chair will not rule on it **without a device** |
| **Redesigning the sheet** | ⚠️ **NOT DONE, and offered explicitly** | The chair declined to redesign off two screenshots at the end of a long day, and told the founder plainly that three tidy-ups **may not make him like it** — if he wants a different sheet, that gets scoped, not polished |

⚠️ **THE HONEST RESIDUAL, stated because the fixes are small and the complaint was not:** the sheet
still has **four control species** — 6 × `SegmentedControl`, 2 wrapping chip rows, 1 native date
input, 1 action row. **Two of those were ruled acceptable and one was deferred**, so the *"no single
control vocabulary"* finding is **recorded and unresolved**, not fixed.

## 6m. Miles — the OPEN-LENS re-read (2026-09-22)

Full document: `docs/competitor/miles-open-lens-review.md`. All 17 screenshots, **no item
list**.

🔴 **Why it was needed:** `MILES-GAP-ANALYSIS.md`'s `T-01…T-20` came from the brief's own
screenshot index — **one item per screenshot, decided before anyone looked.** Every verdict
answers *"how do we score against this item?"*; none answers *"what is on this screen nobody
thought to ask about?"* The founder caught it: *"it seems like there's just been a focus on
change plan."* **Nine findings had no slot. Two are the most important in the teardown.**

| | |
|---|---|
| 🔴 **They are saying OUR thing, before their paywall** | The plan-reveal chart is annotated *"easier on purpose"*; the build screen's last step is *"Making recovery part of the plan"*; the first easy run is prescribed *"Not faster than 13:12/mi"*. ⚠️ T-09 rated that loading screen PARTIAL on CRAFT — *"ours is better written, theirs is better drawn"* — and missed that the CONTENT is our positioning. **A checklist scores the slot; it cannot notice the competitor has taken your sentence.** Not a reason to move; a reason to stop saying "only we say this" |
| 🔴 **Their exit offer abandons their own typeface** | A serif display face used nowhere else in 17 screens, plus a struck-through **£155.88** anchor they have never charged. The gap analysis caught the £24 undercut and stopped. **The paywall was built by a different hand with a different visual system, and it is two scrolls apart** |

**Rulings M-1…M-9** in the review document. Headlines: **M-2 amends S6** (icons on a row with
a current value, or where the glyph encodes data — Silvanto binding on one family/size/tint);
**M-6 KILLS a week streak or any cumulative total on the profile, permanently** (Wood
extended — a streak punishes the rest day this product defends, and a competitor shipping it
is not evidence); **M-7 the merchandising-profile kill STANDS** on re-examination; **M-5
routes to the SLT** — 🔴 **our charity codes have never once been redeemed and our redeem
screen sits on Me, the lowest-frequency surface; Miles puts it IN the onboarding flow.**
**M-8 INSUFFICIENT EVIDENCE** — Collins wants the ticket-stub perforation, Silvanto calls it
chrome and cites W-11; settles with one artefact at 375px.

⚠️ **Not settled: no motion or transition comparison is possible from 17 stills**, and that
is probably where much of "feeling something" lives.

---

## 6n. ICON-RULE-01 — the icon rule, re-ruled on the CORRECT doctrine (2026-09-22)

🔴 **SUPERSEDES S6 and M-2.** Both amended a rule that was not governing. **S6** was written
during the app review and bounded icons to *"a label that repeats down a list"*; **M-2**
amended S6. The actual doctrine is older and broader, in two places, and **neither sitting
cited it**: *"Icons everywhere → text labels where space allows"* and *"no icons unless they
carry unique meaning"*. **An amendment to the wrong rule is not an amendment**, and this is
the second time this week a sitting has been re-run for that reason (the other was
TAPER-OVER-PEAK-01).

**The ruling.** An icon earns its place two ways only: **MEANING** the label cannot give (the
bell; a glyph encoding an ordinal), or **LOCATION** on a list of **≥8 rows**, where the job is
finding rather than understanding. Everything else stays *text labels where space allows*.

**Qualifies:** Me (20 rows / 10 sections) · modify sheet (8 rows / 3 groups). **Does not:**
wizard steps, Plan rows, session cards.

⛔ **Silvanto binding:** one glyph, one size, one family, one tinted container, and **the tint
may not be semantic** — six session hues and four phase hues are already spent, and a second
colour language is a palette regression with the veto live.

⚠️ **Collins, recorded and agreed: this is a UTILITY ruling, not a wow ruling.** *"Icons on
settings rows will not make anyone tell a friend about this app."* The competitor's stopping
moment is a **handwritten annotation over a bar chart**, not an icon. **Do not cite this as
progress against "stand out."**

⚠️ **Icons are NOT the fix for colour-only encoding.** Measured: **6 sites** resolve session
type through `getSessionColor` with **no adjacent label**, against 3 that are labelled — and
`ui-patterns.md` already rules *"state must live in the label, never colour alone"* (WCAG
1.4.1). The worst is a **4px** dot where neither glyph nor label fits.
`DESIGN-DAYDOT-CHANNEL-01` remains the fix and remains open.

---

## 6o. The rule challenges this review produced (2026-09-22)

Every existing rule the app review, the Miles re-read and the five-screen review put in
question, and what happened to it. **The founder's standing mandate is that any UI/UX rule
may be reviewed if the board thinks it adds value**; this is the record of what was.

| Rule | Outcome |
|---|---|
| **S6** — icons only where a label repeats down a list | 🔴 **SUPERSEDED** by ICON-RULE-01 (wrong rule amended) |
| **M-2** — the Miles icon amendment | 🔴 **SUPERSEDED** by ICON-RULE-01, one day old |
| *"Icons everywhere → text labels where space allows"* | ⚖️ **AMENDED** — meaning, or location on ≥8 rows |
| *"No icons unless they carry unique meaning"* | ⚖️ **AMENDED** — same |
| **SHEET-PRESENT-01** — *"come up from the nav bar but not overlay it"* | 🔴 **REVERSED** (S1, § 6i). Shipped. The measurement killed the argument both sides were having: **0px on an SE, 5px on a 13/15** |
| *"Slide-up sheets: mirrored nav bar at bottom"* | ⚖️ **QUALIFIED BY SHAPE** (R-5): a sheet you **act in** keeps the bottom bar; a sheet you **browse** takes a top-right dismiss. **Wroblewski conceded his own rule.** 🔴 **Applied and recorded in § 6r — LATE.** This row and R-4's were the ONLY surviving trace of that sitting; the rulings themselves were never written down |
| **A2** — Plan leads with the plan | ⚖️ **AMENDED** (R-4): it asked what should lead and never asked which single thing below the fold is not furniture. One action row earns the space above the weeks. ⚠️ **A2's own gate matched that row by its LABEL and went red when `PLANVERB-01` renamed it** — re-anchored on the handler (§ 6r) |
| **§109** — never state a projection without its derivation | ⚖️ **NEEDS A SECOND HALF** → **Coaching Board**: the derivation must **exist**. The competitor states *"projected from your logged runs"* against **0 runs** |
| *"State must live in the label, never colour alone"* (WCAG 1.4.1) | 🟢 **UNCHANGED, and now carries a measured debt of 6 sites** |
| **M-1** consequence subtitles · **M-4** trial timeline | 🔴 **RETRACTED — already built.** Both found during verification, not at the sitting |
| **"Use `ScreenHeader` on pushed screens"** | 🔴 **RETRACTED — my error.** It is title + sub, **no back arrow**; it is for tab roots |
| **S2** — dismiss is never `--moss` | 🟢 **STANDS**, but 🔴 **its gate is too narrow**: `DISMISS_WORDS` omits `back` and `not now`, and **4 full-width moss dismiss buttons** sit behind that gap |
| *"Back arrow top-left (44px circle, `--bg-soft`)"* | 🟢 **STANDS, and is measurably ignored**: **6 of 12** back arrows obey. Two are **36px**, under our own documented iOS HIG minimum |

---

## 6p. `P-06(b)` — the annotation, and the question that was one step early (2026-09-22)

**Convened on the founder's question about Collins' observation in § 6n** — that the icon
ruling is utility, not wow, and the competitor's stopping moment is *"a handwritten
annotation over a bar chart."* The observation was **already filed**, as `P-06(b)`, owner
RUSS, gated on granting a second typeface against the `Inter only` rule in § 3.

⚠️ **This is the first time any part of the post-wizard surface has been reviewed.** The
register's own INSUFFICIENT EVIDENCE list carries *"anything past wizard submission —
ceremony, plan preview, confidence badge, difficulty card. Unwalked."* One corner of it
is now walked. The rest is not.

### The measurements, taken before any seat spoke

| # | Measured | Method |
|---|---|---|
| 1 | **Bar pitch is 14.1–22.2px.** Worst case `sub-4-hour-marathon-plan`, 18 weeks: **14.1px** | `PlanArc` bars are `flex:1` with `gap:2px` in a 288px plot at the 320px content width |
| 2 | **2–5 dips per plan, mean 2.8, and they are SCATTERED** — `4,8` on the 12-weekers, `2,6,10,13,17` on the sub-4 marathon | All nine published plans, `zonna-plans-export.json` |
| 3 | 🔴 **There is no chart at the reveal to annotate.** `PlanArc` renders on the Plan screen, `TabbedPhone` and its preview page. `GeneratePlanScreen` imports `PlanHeroMetrics` and never `PlanArc` | grep, both files |
| 4 | 🔴 **We already say the sentence, and then throw it away.** `GeneratingCeremony`'s fourth line is *"Building in the deload weeks. You'll want them."* — our "easier on purpose", in voice, on a screen that evaporates ~2s before the preview | `COPY_PAID` / `COPY_FREE` |
| 5 | 🔴 **The paced card stack already exists.** `RevealCard` over `repWeeks`, staggered and phase-coloured | `GeneratingCeremony.tsx:96,335` |

**Measurements 3, 4 and 5 are the sitting.** The proposal was three things; two were built
and the third had nothing to attach to.

### Settled ground

`Inter only` (§ 3, the rule under challenge) · `No chrome` (§ 3) · **`No celebration of the
peak` — Wood, binding** (§ 2), which forbids annotating the tallest bar · `Shape, never
completion` (§ 2) · *A commissioned line-art style — SUPERSEDED, "folds into P-06 as
generated output"* (§ 2), which is the row that put the annotation here in the first place.

### The board

- **Zhuo (chair).** Three decisions bundled, two already built. **The typeface is the last
  question in the chain, not the first** — you cannot choose a face for a mark with nothing
  to attach to.
- **Silvanto.** Before type, scale: an annotation tied to a **14.1px** target is not a
  relationship a reader can see, and 2–5 scattered dips is not the competitor's one region.
  ⚖️ **On the rule: a handwriting face IS a regression against `Inter only` unless that row
  is amended by name in the same ruling. Veto stands against it shipping quietly; not
  against it being amended openly.**
- **Sierra.** Said once it teaches; said five times it is wallpaper. **The better outcome is
  the runner recognising a short week without a caption** — perceptual expertise, worth more
  than a font.
- **Wroblewski.** The reveal takes **zero input** today. A swipeable stack with a counter
  adds N gestures and a dismissal decision to someone who has just answered fifteen wizard
  questions. At 320px there is no gutter for a margin note to live in.
- **Collins**, who raised it and moved on the measurements: **the competitor's move is not
  the handwriting, it is the PERMANENCE.** Their sentence is attached to the artefact the
  runner keeps; ours is attached to a loading screen. *"We have the better sentence and we
  throw it away."* The takeable is to put the shape on the reveal and attach the sentence to
  it — not to buy a font.

### ⚖️ Ruling

| Part | Verdict |
|---|---|
| **Swipeable card stack + "3 / 5" position counter** | 🔴 **DON'T SHIP — permanent.** The stagger already paces the reveal; a swipe adds input to the one moment in the product that has none. Row in § 2 |
| **`P-06(b)` re-scoped → `DESIGN-REVEAL-SHAPE-01`** | 🟢 **SHIP WITH AMENDMENT.** `PlanArc` at reveal scale on the plan preview, carrying **ONE** annotation on the **first dip**, set in Inter, the hand-gesture carried by a drawn SVG rule rather than by letterforms |
| **The second typeface** | 🟡 **DEFERRED, NOT REFUSED.** Unanswerable until a chart exists to annotate. It returns to the founder as one narrow decision — annotations only, this surface only — with the Inter version built and on a device to compare against |

⚠️ **The founder was not asked for the typeface exception, and that was the point.** The
question that had blocked `P-06(b)` was one step early.

### 📦 Artifacts

1. **Pattern** — `ui-patterns.md § PlanArc`, new *Reveal scale* subsection: the plot height,
   and the one-annotation rule with its reason (measurements 1 and 2).
2. **Constant** — `PLOT_REVEAL` beside `PLOT = 36`; the annotated week resolved through
   `computeDeloadWeeks()` (DELOAD-OWNER-01), **never an array position** — *"easier on
   purpose"* over a week that is not a deload is a false claim about the plan.
3. **Mechanical check** — the annotated week **is** a deload and **is not** the peak. Wood's
   binding condition has been mechanical for `PlanArc`'s own bars since PLAN-ARC-V2; this is
   the first time it reaches a caption.

---

## 6q. Sitting five — four decisions that were made and never ruled (2026-09-22)

Three of these were filed in the register's own words as *"recommended, never put to a
board"*, and one had been ruled INSUFFICIENT EVIDENCE with no settling artefact named.
**The settled-ground scan changed two of the four before a seat spoke.**

### 🔬 Measurements

| Item | Measured |
|---|---|
| Empty-state art | **16** "nothing yet"-shaped strings in `DashboardClient` alone, **none carrying an illustration**. The recommendation is already the de-facto state on every surface |
| Launch screen | The Capacitor splash works: `backgroundColor: '#F3F0EB'` (`--bg`), `showSpinner: false`, `launchAutoHide` with a 10s cold-start net, hidden manually on web mount by `CapacitorBoot.tsx`. **There is no gap to fill** |
| `/about` ground | Three sections: `page` · **`surface="inset"` full-bleed band** · `page`. The homepage's 18 sections spend `card` once and `dark` once (last) and **no `inset` at all** |
| Day marker | 🔴 Three facts on one channel, not the two filed, plus a fourth on `opacity` — and the one redundant channel is keyed on a **banned token string** |

---

### 1. `DESIGN-EMPTYSTATE-ART-01` — 🟢 SHIP, ratified as doctrine

No illustration in an empty state: not commissioned, not a free pack (unDraw, Open Peeps,
Humaaans, Storyset are all licence-clean and that was never the objection). **Collins did not
fight it and said why:** the argument is not taste, it is that the product's whole claim is the
absence of decoration, so an illustration contradicts the pitch on the same screen. **Sierra:**
an empty state exists to say what to do next, and a drawing occupies the space that sentence
needs. ⚠️ **Nothing is built by this ruling** — it ratifies the state the app is already in. What
changes is that it may not be re-proposed without named new evidence, which is the entire point:
it was recorded as *"a taste call made against the documented rule"*, made by one person.

### 2. `DESIGN-LAUNCH-SCREEN-01` (P-11) — 🔴 DON'T SHIP, permanent

**Wroblewski: there is no problem here.** The splash holds, the app mounts, the splash hides; a
stock-footage screen would add a wait that does not currently exist. **Collins:** *"the single
most generic thing a running app can do"* was right the first time. ⚠️ If ever revived, § 6's
non-identifiable rule applies to anyone in frame.

### 3. `SITE-GROUND-ABOUT-01` — 🟢 SHIP WITH AMENDMENT

🔴 **The scan settled this.** `components/marketing/Section.tsx`'s own header says it in those
words: *"`inset` IS NOT A PAGE GROUND, and brand.md says so in those words. It is the containment
surface `ProductStill` uses to frame a component. Spending it as a section ground is band
alternation, which W-08 killed."* `/about` does exactly that, full-bleed, hairlined top and
bottom.

⛔ **Silvanto names the rule:** W-08, and the `--surface-moss-wash` kill, which already settled
the remedy — *if a card needs emphasis, it is an inset CARD, not an inset BAND.* This is the same
defect in a different file.

🔴 **And the reason it survived is the reason everything survives here.**
`lib/marketing/sectionSurfaces.test.ts` opens `const HOME = 'app/page.tsx'`. **The gate was
scoped to one page**, so a rule written against band alternation could not see band alternation
on any other page. Third time in one day this board has hit *an audit is only as wide as its
list*.

**Amendment:** the band becomes `page`; the gate widens from the homepage to every marketing
page.

### 4. `DESIGN-DAYDOT-CHANNEL-01` — 🟢 SHIP WITH AMENDMENT, and it SPLITS

The filing said *two orthogonal facts on one channel*. Measured, it is **three**, in one
cascading ternary on `PlanCalendar`'s 3x34px rail:

```
background: isComplete ? 'var(--moss)' : isSkipped ? 'var(--line)'
          : isMoving || isSwapTarget ? 'var(--moss)' : accent
```

- **Completion overwrites the session type entirely** — a completed interval and a completed easy
  run are one colour, so the type information is destroyed by finishing the run
- **Moss means both "complete" and "being moved"**
- Skipped is `--line`, the hairline colour, which is also how absence reads
- `opacity` carries a fourth channel at **0.5** (skipped), **0.45** (past, not complete) and
  **0.4** (move mode) — three meanings inside 0.1 of each other

🔴 **And on Today's `DateStrip` the one piece of redundant encoding that exists is booby-trapped:**

```
width: dotColor === 'var(--teal)' ? '6px' : '4px'
```

The size channel is keyed on a **string comparison against `--teal`** — a token `CLAUDE.md` lists
as **BANNED** (`#5BC0BE`, *"replaced by `--moss`"*), surviving only as a legacy alias in
`globals.css`. `getDotColor` returns the literal `'var(--teal)'` for a completed session. **The
moment anyone does the obvious tidy-up and returns `'var(--moss)'`, the dot silently stops
growing and completion loses its only non-colour channel.** That is D-17 — classify by a
structural signal, never by a display string another layer can rewrite — reappearing in the
palette layer.

**Sierra:** the runner cannot learn to read this, because it is not consistent enough to learn.
**Wroblewski:** 4px, outdoors, one-handed.

| Split | |
|---|---|
| **`DAYDOT-TEALKEY-01`** | ⚙️ **NO BOARD** — defect. Key the size on the STATE, never on a colour token string. Gate: the size branch never compares a colour |
| **`DESIGN-DAYDOT-CHANNEL-01`** | Completion gets a **shape** channel rather than a colour one, so session type survives completion. **Wave 3**, with the Plan-screen work |

### 5. `DESIGN-PERFORATION-01` — 🟡 INSUFFICIENT EVIDENCE, artefact NAMED

It was ruled this once already, and re-running it on the same evidence is the re-litigation this
register exists to prevent. **The settling artefact, named so it cannot come back without one:
the ticket-stub device rendered on a real Plan card at 375px, beside the current card, on a
device.** Nothing in this product has ever run on one.

---

## 6r. `PLANVERB-01` — the five-screen review's rulings, LANDED LATE (2026-09-22)

🔴 **THE SITTING HAPPENED AND ITS RULINGS WERE NEVER WRITTEN HERE.** § 6o cites **R-4** and
**R-5** by their outcomes — *"one action row earns the space above the weeks"* and *"a sheet you
act in keeps the bottom bar; a sheet you browse takes a top-right dismiss. Wroblewski conceded
his own rule"* — so the sitting demonstrably ran. **No section recorded it.** This file's own
maintenance note says every ruling appends in the same commit as its decision, *"a process whose
memory depends on someone remembering to write it down has no memory"*, and that is exactly what
happened. Found when the next build went looking for its own scope and could not find it.

⚠️ **What that cost, stated rather than glossed:** the rulings below were rebuilt from § 6o's two
surviving rows, the founder's verbatim brief, and **fresh measurements of the surfaces**. Any
ruling from that sitting not reflected in § 6o and not re-derivable from a measurement **is
lost.** The reconstruction is honest about which part is re-derived and which is new.

### 🔬 Measurements, taken before building

| # | Measured |
|---|---|
| 1 | 🔴 **Two rows, one title, two destinations.** `DashboardClient:8614` (Plan) and `:12138` (Me) both read **"Change your plan"**. Plan's opens `ModifyPlanSheet` and KEEPS the plan; **Me's opens the wizard, which ARCHIVES it.** The subtitles carried the difference; the title is what a runner reads |
| 2 | 🔴 **The race-date field is the ONLY input in the app below 16px.** `ModifyPlanSheet` hand-rolled `<input type="date">` at **`fontSize: '13px'`**. Every other non-checkbox input measured 16px or a token. `TextField`'s own header exists to lock this: *"iOS zooms any focused input below 16px"* |
| 3 | The wizard asks the same question through `WizardInput` → `TextField`, and `WIZARD-HARNESS-01` measured **zero overflow on all 15 steps at 375px**. **Two surfaces, one question, different results** — recorded in the brief as *"itself the finding"* |

⚠️ **One correction to `TextField`'s own comment**, made while measuring: it names two
consequences of a sub-16px input — the zoom, and being *trapped* zoomed in by
`maximum-scale=1`. **The viewport lock was removed** (it failed WCAG 2.1 SC 1.4.4). The zoom
still happens; the trap no longer does. **Half a documented reason is still a reason, and saying
which half is the difference between a rule and folklore.**

### ⚖️ Rulings

| | |
|---|---|
| **`PLANVERB-01` — two doors, two verbs** | 🟢 **SHIP.** Plan → **"Adjust your plan"** (*keeps the plan*); Me → **"Start a new plan"** (*replaces it*). ⚠️ **The destructive row's subtitle changed too**: *"Build a new plan around a different race or goal"* described the destination and never said the plan you have goes away. A verb change that makes a destructive path **more** discoverable has to be honest about what it costs |
| **R-5 applied — the sheet has two shapes, in sequence** | 🟢 **SHIP.** With nothing pending there is nothing to apply, so the runner is **browsing**: a top-right dismiss, no bar. The moment an edit is pending the bar arrives with Apply and the dismiss goes. ⚠️ **The standing rule that a slide-up sheet carries a mirrored bottom bar is NOT reversed — it is qualified by shape**, which is R-5's whole content. It also answers the founder directly: *"the close button is kind of static in and over the top of the modal and the scroll. I don't like it."* And *"never a disabled primary as the resting state"* is now satisfied more completely: there is no primary in the resting state at all |
| **The race date goes through `TextField`** | 🟢 **SHIP** — a defect fix, no board needed. **Same shape as S5's countdown formatter: the owner existed and the call site went round it.** Third time this month |
| **A "Start a new plan" row inside the sheet** | 🟢 **SHIP — and it is NOT from the sitting.** Splitting the verbs closed the only door from Plan to the wizard, so a runner who opens "Adjust" because they want a different race has nowhere to go. **The gap is created by our own change, so the escape belongs in the same build** (SLC: Complete). Deliberately not amber — the sheet's own note already rules amber is coaching-warning voice, and wanting a different race is not a warning. Hidden while an edit is pending: offering to throw the plan away mid-edit offers to discard work not yet applied |

### 📦 Artifacts

`lib/marketing/planVerb.test.ts` — 7 assertions, all falsified. **Including one that was HOLLOW
on its first write**: `toContain('onStartNewPlan')` passes against `onStartNewPlanX`, because a
substring of a renamed identifier is still a substring. **Fifth time this repo has recorded
substring bias in a single day**, and only falsification found it. Now bounded to the
declaration, the guarded render and the call site.

⚠️ **Three existing gates went red on the rename, and re-anchoring them is part of the ruling.**
`appReviewWave3`'s A2 matched the literal `'Change your plan'` twice — but **A2's claim is about
ORDER and PRESENCE, not about which verb the row uses.** One now anchors on
`onClick={onOpenModify}`, the thing that makes it the action. The third, *"never renders a
disabled primary as the resting state"*, asserted the ternary rather than the rule; it now
asserts the rule. **Anchoring a test on incidental copy is the recorded "never match a designed
refusal by its MESSAGE" class, and this is its third appearance.**

---

## 6s. Wave 3a — `R-4`, `M-3` and the day-marker channel, built (2026-09-22)

Three rulings applied. **The fourth wave-3 item, `ICON-RULE-01`'s icons, is deliberately NOT in
this commit** — it covers two surfaces (Me, 13 hand-written rows; the modify sheet, 8
config-driven ones) and shipping one of them would be shipping half a ruling.

| Ruling | Built |
|---|---|
| **R-4** — one action row earns the space above the weeks | 🟢 The adjust row moves from *first below the calendar* to *last of the headers*. ⚠️ **An amendment to A2, not a reversal**: A2's ordering claim (race → arc → weeks → the explainers) is intact. A2 ruled what should LEAD and never asked which single thing below the fold is not furniture — on an 18-week plan the runner scrolls past every week before meeting the only control that changes any of them |
| **M-3** — the dashed border is the grammar for an option that BRANCHES | 🟢 Applied to the *Start a new plan* row `PLANVERB-01` added to the sheet. Every row above it is a setting you change inside the plan you have; this one leaves. **A solid card on `--card` made it read as a ninth setting**, which is the exact confusion `PLANVERB-01` exists to remove. No fill, so it does not compete with the eight rows that are the sheet's job |
| **`DESIGN-DAYDOT-CHANNEL-01`** | 🟢 See below |

### The day marker — hue carries type, and nothing else overwrites it

The rail read `isComplete ? --moss : isSkipped ? --line : isMoving||isSwapTarget ? --moss :
accent`. **Three facts on one channel**, plus a fourth on `opacity` at 0.5 / 0.45 / 0.4.

**The remedy is the rule `ui-patterns.md` already carries** — *state must live in the label,
never colour alone* (WCAG 1.4.1) — **split by whether there is room for a label**, which is the
distinction `ICON-RULE-01` had already drawn when it recorded that the 4px dot is where neither
a glyph nor a label fits:

| Surface | Room? | Completion now reads as |
|---|---|---|
| Plan row | yes | the word **"Done"**, first in the wrapping metric row |
| Today's dot | **4px** | the **fill** — solid = done, ring = outstanding, ring at 45% = skipped |

⚠️ **Three consequences worth stating.** (1) **Moss on the rail now means exactly one thing**:
this row is in flight. It used to mean *complete* as well. (2) The dot is drawn in a **constant
8px box** — the previous encoding swapped 4px/6px, so logging one run **moved every dot on the
row**. (3) *"Done"* is moss **on text, not a filled chip**: moss is the CTA colour and a green
pill on a finished row is a reward, which is the illusion-of-progress class Wood's binding
conditions exist to keep out.

### 📦 Artifacts

`lib/marketing/dayDotShape.test.ts` — 5 assertions, falsified four ways (repaint the rail on
completion; delete the "Done" label; put a state colour back in the producer; reintroduce the
size swap). `appReviewWave3`'s A2 gate amended for R-4.

⚠️ **And one existing gate was anchored on the MECHANISM rather than the guarantee.**
`DAYDOT-TEALKEY-01` asserted the literal `complete ? '6px' : '4px'` and went red when this
replaced the size channel with a **better** one. It now asserts what must hold — *completion
changes something that is not the colour* — rather than how. **That is "never match by its
MESSAGE" one layer down, and it is the fourth appearance of the class today.**

---

## 6t. Sitting six — post-run and reshape, the last two unreviewed screens (2026-09-22)

The founder's list from the screens brief was *upgrade, post-run, benchmark, recalibration,
reshape*. The five-screen review covered the first three and the change-plan surface; these two
were the remainder, and they close the walk of every screen in the product.

### 🔬 Measurements

| Screen | Measured |
|---|---|
| **Reshape** | ✅ **All four states present** — a shimmer skeleton while checking, `found`, `clean` and `error` — **and the error carries a "Try again"**, which is the state this product most often omits. One entry point (Me), and `onBack` matches it. **No ruling; nothing to build** |
| **Post-run** | 🔴 **Three entry points, one hardcoded exit** |

### The finding, and it is a REPEAT

`PostRunScreen`'s two exits disagreed:

- **`onDone`** routed to the session the runner came from. POST-RUN-02 reasoned that terminus out
  and left a comment saying why: *"so the verdict is the resting state — not Today."*
- **`onBack`** was a hardcoded `setScreen('today')`.

So: open a session **from Plan**, tap the linked run, tap **Back** — and you land on **Today**,
two screens from where you were. Tap **Done** instead and you land correctly. ⚠️ **The escape
hatch was worse than the completion path**, which punishes the runner for changing their mind.

🔴 **This is D4's class and it was already fixed once IN THIS FILE.** `sessionOrigin` exists
because back-from-Plan was the same hardcoded line, and that write-up recorded *"the identical
line appears TWICE in that file."* **The note observed the duplication and nobody went looking
for the next screen with the same shape.**

### ⚖️ Ruling — SHIP

Post-run gets an origin, exactly as sessions already have one. Three entries, three stamps: the
push deep-link / cold start and Today both resolve to Today (**honestly** — on a cold start there
is no screen behind it), Session Detail resolves back to the session.

### 📦 Artifacts

`lib/marketing/screenOrigin.test.ts`, falsified three ways (restore the hardcoded back; drop the
stamp from one of three entries; delete the `sessionOrigin` pattern it copies).

⚠️ **The gate is deliberately GENERAL and counts rather than checks presence.** It asserts
`setPostRunOrigin` is called **as many times as `setScreen('post-run')` is** — because a stamped
origin on two of three entries is the same defect with better odds, and this repo has shipped
exactly that (`fix-cap-config.mjs` knew one local plugin of two for months). It also asserts
`sessionOrigin` still exists: if the pattern this copies is deleted, the reason this exists goes
with it.

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
| **Do CTA buttons earn elevation?** | ✅ **SAT 2026-09-24 — and the question was wrong.** The answer is a missing Button component; elevation is one of its properties. Ruled, not built: mock-ups first. `BUTTON-COMPONENT-01`. Original filing — founder, 2026-09-24: *"all our cta buttons [are] very flat visually"*, across app, site AND email. **Measured:** `--shadow-card` has **19 consumers**, `--shadow-lifted` has **ZERO**, and the only CTA class is a hover background swap — **the product elevates its cards and gives its buttons nothing**, so the button sits visually behind the card it is on. ⚠️ Email cannot use `box-shadow` (Outlook drops it), so any answer needs an email-safe equivalent. `CTA-FLAT-01` |
| **Whether the week-2 deload notch is EXPLAINABLE to a runner who asks** | PLAN-ARC-V2 chose to make a known defect visible. §119's producer fix is now **URGENT, not deferred** — Hutchinson's reasoning governs over Traynor's "nobody is watching" |

---

## 2026-09-24 — The customer email programme · SHIP WITH AMENDMENT (4)

**Trigger:** hard. A surface with no pattern, no token entry and no ruling anywhere.
**Decision note:** `docs/decisions/design-2026-09-24-email-programme.md`.

🔍 **Settled-ground scan: NOTHING TOUCHED, and that is the first finding.** `design-rulings.md`
had **zero rows on email**, `brand.md` has **no email voice section**, `ui-patterns.md` has no
email pattern. The templates hardcode `#F3F0EB`, `#6B8E6B`, `#1A1A1A`, `#3D3A36`, `#8A857D` as
literals, legal only because the pre-commit hex hook scopes to `app/` and `components/` and this
lives in `lib/`. **The token layer and this surface have never met.**

📐 **Measured in production, 2026-09-24.** 30 users, all on a trial. **15** day-11 emails sent,
**20** day-14. **Only 8 of 30 have ANY logged activity**, and the run paragraph is the only
personalised element in either email — so **22 of 30 received a countdown headline, one sentence
about what they are losing, and a button.** ⚠️ **Five people received *"Your coaching pauses
today"* as the first and only email Zonna has ever sent them.** Not measured: open and click rates
(no instrumentation exists) and nothing has been seen rendered in a mail client.

| Amendment | |
|---|---|
| **1. A first email that is not about money** | Triggered by the first analysed run, not a fixed day. **Does not send without one.** The only new email authorised |
| **2. Day 11 leads with the runner, not the clock** | The verdict line becomes the headline where it exists; where it does not, the email says so honestly rather than padding |
| **3. Day 14 ends on what they gained** | Runs read, easy days held, before any mention of what pauses |
| **4. Fix the CTA target** | It points at the marketing homepage: **four steps, two of them guesses** |

**⛔ Veto: NONE, and Silvanto said why** — hardcoded-but-correct palette values are a maintenance
defect, not a regression against a documented rule, and a veto there would be the *"this feels
wrong"* veto the chair should refuse. **His veto remains untested.**

**⚡ Recorded disagreement, unresolved by the board:** Sierra holds that a day-11 email to a runner
with no analysed runs **should not send at all** — it advertises that we have nothing. Wroblewski
holds that silence then a cliff is worse. Neither could be settled: **no open or click data exists.**
Sutherland resolved it at the SLT in Sierra's favour on a different argument (below).

**🎪 Collins, recorded:** *"We send more emails about our billing than about their running —
infinitely more, because the second number is zero."* Not a loss; it is the framing the ruling rests on.

**↗️ Escalated to the SLT** (Zhuo carrying, ADR-023 §5) because amendments 1 and 3 change what a
trial is worth. **SLT outcome: build differently, in two tranches** — see the decision note. The
board's ruling was **not overturned**; it was split on sequencing and one amendment was blocked on
a measurement that has since been taken.

⚠️ **What this does not settle:** nothing here has been seen rendered in a real mail client, and
every claim about effect is inference from content and reach, never from behaviour.

**↩️ Follow-up, same day — the SLT approved the programme in a different ORDER and added a
gate this board missed.** Wood moved the Connect email ahead of the First-read email on the
measurement (**22 of 30 never reach the state First-read requires**), and the SLT found that
**no email has an unsubscribe link, a `List-Unsubscribe` header, or a consent column** —
35 sent on that basis. That is now tranche 0 and blocks everything. **Not an overturn:** no
amendment of this board's was reversed.

🔴 **Two emails in the founder's full proposal have NEVER been through this board** —
*Connect* and *Pattern*, written after this sitting at the founder's request. **SLT approval
does not substitute for the design ruling**, and they are recorded here as outstanding so
they are not built on the strength of a commercial approval alone. Full ruling:
`docs/decisions/design-2026-09-24-email-programme-proposal.md`.


---

## 2026-09-24 — CTA-FLAT-01 · SHIP WITH AMENDMENT (4), **RULED AND DELIBERATELY NOT BUILT**

**Trigger:** founder observation — *"I find all our cta buttons very flat visually"*, across app,
site **and** email. Superseded by `BUTTON-COMPONENT-01`, which carries it forward with mock-ups.

🔍 **Settled-ground scan changed the question before any seat spoke.** The item was filed asking
whether the CTA should use the unused `--shadow-lifted` **or a new button-specific token**. The
standing rule directly below no-chrome reads *"Elevation is `--shadow-card` / `--shadow-lifted`. Do
not design a new elevation system"* (P-13 correction) — **the second option was already forbidden.**

📐 **Measured.** `--shadow-card` **19 consumers** · **`--shadow-lifted` ZERO** · no shared `Button`
component (`BackButton` is the only one) · **65 hand-rolled moss-background elements** · the one CTA
class, `.cta-pill`, used by 4 files, declares `transition: transform` and **nothing ever uses it**.

**The product elevates its cards and gives its buttons nothing**, so a moss button sits visually
behind the card it is on.

⚡ **Collins won the framing, recorded as such.** The item asked about a shadow; he and Zhuo
independently reached the larger finding — **the absence of a Button component is the cause and
elevation is one of its properties.** *"Sixty-five buttons and not one of them is ours."* Nobody
defended the narrow version.

**Ruling:** one `Button` component · primary takes **the existing `--shadow-lifted`**, no new token
· a press state that **moves** (`translateY(1px)` on `:active`, riding `--motion-ui` so it collapses
under reduced motion) · **email gets a 1px `--moss-deep` border, because Outlook drops
`box-shadow`** · 44px minimum height (Wroblewski). No gradient, no glow, no bounce — W-11 stands.

⛔ **Veto: none.** Silvanto declined and said why: *"a single named elevation token is not chrome.
Chrome is what W-11 killed — texture over everything, changing no decision."*

🔻 **NOT BUILT, at the founder's request the same day:** he wants **mock-ups before a ruling binds**,
and a **revisit of the no-chrome rule with worked examples**. This row stands as the reasoning the
mock-up round starts from, **not as a settled answer.** ⚠️ Recording a RULED-but-not-built outcome
is the case `audit-docs.sh` § board rulings exists for — a ruling that edits no doctrine file trips
no guard, and an unrecorded one gets re-proposed.

⚠️ **What this does not settle:** nothing has been pressed on a device, and the 65 conversions are a
migration this authorises but does not scope.

✅ **MOCK-UP ROUND CLOSED 2026-09-25 — founder chose direction B**, which is this ruling's own
answer: `--moss-strong` fill on `--shadow-lifted`. Four directions on a real card plus a five-rung
chrome ladder with worked examples (`claude.ai/artifact/QSzkbpvULg5HNnrHZitKBN`). **The no-chrome
revisit needed nothing overturned** — the ladder shows the rule bans a second authored effect, not
depth, so rung 1 sits inside it and Silvanto's declined veto holds unchanged.

🔴 **AND THE ROUND FOUND A DEFECT THE SITTING MISSED: white on `--moss` is 3.68:1 at 13px, so every
primary CTA in the product FAILS WCAG AA.** The board sat on this button for a whole sitting, ruled
on its elevation, its press state, its height and its email fallback, and **nobody measured its
contrast** — while `globals.css` had carried `--moss-strong` and `--moss-deep` since
`A11Y-CONTRAST-01`, authored for this exact failure on the marketing button. **A sitting about how a
control looks did not ask whether its text could be read.** The fill choice is therefore a defect fix
restoring documented intent, not a new palette decision, and `BUTTON-COMPONENT-01` moves from polish
to must-ship.

---

## Maintenance

**Every Design Board ruling appends here in the same commit as its decision note.** A
process whose memory depends on someone remembering to write it down has no memory:
that sentence is in `coaching-rulings.md` because the Coaching Board proved it.

`.claude/hooks/design-guard.py` fires on edits to the doctrine files and asks for the
board or a stated exemption. It cannot check that this file was updated. That is the
known hole, and it is the same hole `ship-record-check.py` was built to close on the
feature registry.
