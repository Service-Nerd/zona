# Contract — SessionSteps Component

**Authority**: This document defines the prop interface and rendering contract for the session-detail structure block (ui-patterns.md §21b "Session steps"). Any change to props or the card hierarchy must update this document in the same commit.

**Component:** `components/shared/SessionSteps.tsx`

Introduced: SESSION-STRUCTURE-REDESIGN, 2026-09-04.

---

## Prop Interface

```typescript
interface SessionStepsProps {
  structure: SessionStructure        // composeSession() result — the phases + totals
  derivedSet?: DerivedSet | null      // session.derived_set (ADR-019); main set renders as steps when present
  sessionType: string
  displayZones: Zone[]                // §84 — main-set zones from displayZonesForSession(session)
  zoneRangeLabel: string              // e.g. "Zone 4–5" — the range label the main header shows
  metric: 'distance' | 'duration'     // the resolved per-session metric (toggle)
  preferredUnits: 'km' | 'mi'
  sessionDistanceKm?: number          // added to this contract 2026-09-18: it was on the component and not here
  easyPaceStr?: string | null         // Strava-derived easy band for warm-up/cool-down; null → zone only
  catalogueId?: string                // the session's catalogue row id — drives the LEGACY ramp backfill (§8 Am.); absent is safe
  onInfo?: () => void                 // opens the zone-education sheet from the main-set ⓘ
}
```

`Zone` is `1 | 2 | 3 | 4 | 5` from `components/shared/ZoneBar.tsx`. `SessionStructure` is from `lib/plan/sessionComposer.ts`; `DerivedSet` from `lib/plan/resolveMainSet.ts`.

---


## Micro-labels (MICRO-LABEL-WAVE-2, 2026-09-29)

The step captions resolve through `MICRO_LABELS.eyebrow` (10px / 700 / 0.08em / uppercase)
rather than hand-typed values. Enforced by `microLabel.test.ts`.

⚠️ **One label in this component is still at 11px and was NOT converted.** Changing it
changes SIZE, which is a reflow, and the ruling requires a render before a size change
lands. It is part of the 36 remaining, tracked in `backlog.md` § Waves 3+.

## Rendering contract

- **One card per phase** — Warm-up, Main set, Cool-down. Each is `--card` / `1px --line` / `12px` radius. (Race / rest / strength shapes render nothing — the caller skips them.)
- **`shape: 'time_trial'` is the one shape whose parts do NOT partition the total** (TT-STRUCTURE-01, 2026-09-17). §78's benchmark sets `distance_km` to the TRIAL, and `ruleEngine` places the warm-up and cool-down OUTSIDE it deliberately — the trial alone is what the plan counts (`sumWeeklyKm`, §1, §52). So the main set renders the trial **exactly, with no `~`** (every other figure on this card is an estimate; this one is the prescription), while the bookends stay in **minutes** because *"cool down easy"* carries no number and inventing one breaks `zone-rules.md`. **Consumers must not assume warm-up + main + cool-down sums to the session distance on this shape.** SESSION-RECONCILE-01's partition assertion is scoped out for it with the reasoning, and replaced by a stricter contract (`TT-STRUCTURE-01`) that also asserts the card's warm-up minutes equal the number the coach note promises. ⚠️ Founder-reported: without this branch a 5 km time trial rendered as *"warm-up ~3km · main set ~2km · cool-down ~0km"*.
- **Tinted header, never flooded** — `color-mix()` of a token accent over `--card` (ADR-007). Accent: warm-up `--moss`; main set `--s-inter` when the peak display zone ≥ 5 else `--s-quality`; cool-down `--s-strength`. No hardcoded hex (pre-commit rule).
- **Main-set zone** — `zoneRangeLabel`, derived from `session.zone` (§84), NOT the session type. Single zone or a range.
- **Numbered steps + connector** — first row of each repeat block carries the step number; later rows in the block are blank. Warm-up run, strides, and cool-down each get their own number.
- **Row production has ONE owner: `lib/plan/sessionSteps.ts → buildSessionRows`.** It returns every row the card renders — warm-up, strides, main set (v2 groups or the v1 fallback), race-pace segment, cool-down — in order, tagged with its section. The component maps over it; it does not compose rows itself.
  - 🔴 **This exists because the gate written for `SESSION-STEP-LEGIBILITY-01` covered 11.7% of sessions.** It asserted over `buildStepGroups`, which is the **v2 main set only** — 1,974 of 16,919 sessions. It saw **no easy run or long run (14,221)**, **no 5K time trial (422)**, **no race week (302)**, and **none of the warm-up, strides or cool-down rows of any session**, all of which render through the same `StepRowView` that changed. A test that rebuilt the composition would be a second writer of the card's shape; now the component and the gate call the same producer. Coverage: **33,838 sessions / 114,386 rows**, both unit systems.
- **Step row** — **THREE FIXED SLOTS, in this order, on EVERY row of EVERY session** (`SESSION-STEP-SLOTS-01`, §21b Am. 3, Design Board 2026-10-06). Slot 1: work/recovery dot (work = main accent, recovery = hollow) + **role, if any**, with the **amount in the runner's chosen metric** on the right. Slot 2: **the TARGET** — pace, zone or RPE — full width, first, never preceded by anything. Slot 3: the **other** metric, then the step's instruction from `DerivedStep.note`.
  - **Warm-up, strides, the v1 main row, the race-pace segment and cool-down are included**, and `StepRow` **requires** `target` and `secondary` so a hand-built row cannot opt out of the layout. Those five had no `DerivedStep` behind them, carried free text, and are exactly the rows that had drifted.
  - 🔴 **EVERY ROW CARRIES A TARGET, AND A RECOVERY WITH NOTHING PRESCRIBED SAYS `rest`.** The fallback keys on the step's **role**, never on how its LENGTH happens to parse. ⚠️ It did key on the length until 2026-10-07: `hill_reps`' `stand` step (length `"until ready"`, parses as text) got `rest`, while `vert_hike_repeats`' walk-back-down (length is a **mirror**, parses as a duration) got **nothing** — a 10-minute row with an empty second line, against §21b Am. 3's guarantee. **The two steps differ only in how their length parses, which has nothing to do with whether they have a target.**
  - 🔴 **A WORK STEP WITH NO PACE TARGET SAYS SO** (§21b Am. 4, Design Board re-sitting 2026-10-06 evening). The target slot reads `Zone 2–3 · effort, not pace` / `RPE 8 · effort, not pace` — the qualifier is `lib/plan/sessionSteps.ts → NO_PACE_QUALIFIER`, appended **after** what IS prescribed, never in place of it. **1,174 of 9,506 v2 work steps (12.4%)**: 941 zone-only, 233 RPE-only. ⚠️ **The reason is that a ruling and a failure rendered identically** — the engine refuses to put a pace on these steps deliberately (catalogue, Coaching Board 2026-09-03; §40b) and the card never said so, so the founder read his own session's middle step as a bug. ⚠️ **Consumers must not derive a distance for these steps**: `~1.7 km` over `9:20` IS `5:29 /km` by division, which is the number the catalogue withheld. **Recovery steps are excluded**, and the exclusion is **measured dead today** (of 5,536 non-work steps, 5,303 carry a pace and 233 carry neither zone nor RPE), kept as a declared defence.
  - 🔴 **THE ROLE IS CONDITIONAL — Amendment 2, Design Board re-sitting 2026-10-06.** A **work step that carries a note renders NO role word**: the note is the role. A work step with **no** note keeps it (384 of 3,794, 10.1%), and a **recovery step always** keeps it — `Jog`, `Walk`, `Stand`, `Hike`, `Jog down` are the only **modality** signal on the row, and a runner reading `2 min` with no verb does not know whether to run it. **A rule, not a list** (`design-rulings.md` S4: *"relabelled, not removed, and the board said removed"*).
  - 📐 **Measured: of 1,597 multi-row blocks, 373 (23.4%) rendered one role on every row and every one was the word "Hard" — while 373 of 373 (100.0%) had DISTINCT notes, DISTINCT targets AND DISTINCT lengths. ZERO were a genuine rep set**, so the word always covered three different things.
  - **Every row of a multi-step block carries its sequence number**, where previously only the first did. Stripping the role leaves a 9px dot with no left-edge anchor; the ordinal replaces it at zero pixel cost (the 20px column already existed and was being blanked).
  - ⚠️ **Line 2 is not new, it MOVED.** `detail` was previously stacked under the amount inside the right-hand column, measured at **127px at a 320px viewport**, which made the cool-down row **82.5px** tall through wrapping. Full width measures **192px**, so carrying the note costs **zero lines** and the pre-existing wrap went away (rows 57.9/57.9/82.5 → 63.4/63.4/63.4 on `/copy-preview`).
  - ⚠️ **`note` is rendered in full and NEVER truncated** (Wroblewski, binding). Measured at 320px: median 52 chars → 2 lines / 79.4px, p90 74 → 3 lines / 95.3px, longest authored 106 → 4 lines / 111.3px, no horizontal overflow. `DerivedStep.note` had a **writer and no reader** until this ruling — 5,152 of 6,014 rendered steps (85.7%) carried an instruction that reached no screen.
  - 🔴 **A pace qualifier NEVER renders as `≤` or `≥`.** `design-rulings.md` CD-11/§12: *"never a ≤ symbol, which reads backwards for pace."* The operator was inverted (ADR-019 defines ceiling as "no faster than", which on a pace NUMBER is `≥`) and was applied to a **band**. Ceilings and floors resolve through the single owner `lib/plan/easyPaceCeiling.ts` — `easyPaceAsCeiling` → *"5:53 /km or slower"*, `paceAsFloor` → *"6:30 /km or faster"*.
  - 🔴 **A step amount ALWAYS carries a unit.** `lib/format.ts → formatStepDuration` (ADR-015 §1 — *"never a lone 78m... minutes vs miles vs metres"*). A bare `9:20` in the amount column, beside siblings showing `~1.4km`, reads as a pace.
- **Metric** — distance leads when `metric === 'distance'`; a duration-native rep with a pace shows an estimated distance (marked `~`) with the duration in the detail; a rep with no pace keeps time primary (ADR-015; §84 honesty). **The derivation is symmetric** — the old distance branch never consulted `metric` at all, so a duration runner read `400 m` on every distance-prescribed rep.
  - 🔴 **A SESSION WITH NO DISTANCE OF ITS OWN NEVER SHOWS A DERIVED DISTANCE ON A STEP** (§21b Am. 4b). `BuildStepOpts.sessionHasDistance` (set by `buildSessionRows` from `structure.main.distance_km != null`) suppresses the derivation. ⚠️ Before this, on a duration-anchored session the **step rows were the only figure on the card in kilometres** — the card total, both section headers and both bookends come from `resolveDisplayFigures` and were minutes, while `buildStepGroups` derived km from each step's own pace: **795 `quality_continuous` sessions**, reading `15 min | 4 × 20s | ~3.8km | 4 min`. **One fact, two producers.** ⚠️ **A step's OWN prescription is never suppressed** — a `400 m` rep still reads `400 m`; only an estimate is withheld. ⚠️ **This is NOT `UNITS-SUBUNIT-01` option B**, which is killed and stays killed: that flipped a card to minutes *because a part was short*, overruling a toggle the runner had set.
- **Race-pace segment row** — rendered only when `structure.race_pace_segment` is present, i.e. `shape === 'long_run_with_mp'`. That shape is produced for the **§25 race-specific long run** (HM and marathon, time-targeted, peak, non-deload) and is gated on the catalogue row declaring `main_set_structure.type === 'long_run_with_segment'` — **never on the session's label** (ADR-018 / D-17; a label substring reached marathon only, and HM rendered nothing on 18 of 18 measured sessions). The row's amount is `duration_pct`, sourced from the row's `race_pace_pct` (HM 35, MARATHON 40) inside §25's ratified 25–40% band, and the detail names the row's `race_pace_zone` ("HM target" / "MP target"), never a hardcoded distance. **It must state the same number as the session's coach note**, which is derived from the same field — they disagreed on every such card until 2026-09-14.
- **An hour or more reads as HOURS (UNITS-DURATION-01, 2026-09-23).** Every duration figure on this card goes through `formatDuration`, ADR-015's owner: `45 min`, `1h 18`, `2h` — **never `172 min`**. ⚠️ Measured before the fix across 48,547 sessions: the **main-set header** stated 60+ raw minutes on **21,062 of them (43.4%)**, to a maximum of **172**. ⚠️ **Ten other duration sites were measured UNREACHABLE at 60+** (`sessionComposer` descriptions, `buildStepGroups` rows) because a rep or a warm-up is minutes by construction — **only the session-level header is long enough to break the rule**, which is why this was one edit rather than eleven. `sessionReconcile.test.ts`'s `parseFigure` normalises the hours form back to minutes, because the suite's promise is that the parts SUM and a sum cannot be taken across two notations.
- **A sub-unit part shows its DURATION, never `~0` (UNITS-SUBUNIT-01, 2026-09-23).** A part that apportions to **zero whole units** renders `formatDuration(part.duration_mins)` instead of a distance. ⚠️ A 0.71 km cool-down is 0.44 of a mile; rounded to a whole unit it printed **`~0mi`**, telling the runner they cover no ground — measured on **19,275 sessions (39.7%) in miles and 1,805 (3.7%) in km**, cool-down in every mile case. **The sum survives by construction**: a part apportioned to 0 contributes 0, so SESSION-RECONCILE-01 cannot break. ⚠️ **Consumers must therefore expect a MIXED-KIND card** — minutes beside distances — which the time-trial shape above already produces. The same-unit assertion that forbade it lived only in a test, never in `ui-patterns.md`, and the one shape that disproved it had been carved out of it.
- **Fallback** — when `derivedSet` is absent or not v2, the main set renders a single row from `structure.main.description`.
- **Provenance** — all rule-engine output; **no `<AIMark />`** (ui-patterns.md Pattern 16).
- 🔴 **The main-set ⓘ is a 15px VISUAL with a 44px TARGET, and the ring belongs to the GLYPH**
  (`SESSION-INFO-MARK-01`, 2026-09-26). `IconButton inlineMark` carries `padding: 16.5px;
  margin: -16.5px` to reach the 44px floor ICON-BUTTON-01 amendment 3 requires. Under
  `box-sizing: border-box` **a border on that button paints around the PADDED box**, so
  `border`/`width`/`height` on the button drew the ring at ~25pt across, overlapping the block
  label. **When the visual and the hit area are different sizes they must be different
  elements**: the button stays invisible, the icon span carries the circle. Gated by
  `components/ui/iconButton.markup.test.ts`.

## Data owners

- Display model: `buildStepGroups()` in `lib/plan/sessionSteps.ts` (pure, tested).
- One-line string (notifications / calendar / fallback): `describeDerivedSet()` in `lib/plan/resolveMainSet.ts`.

## Distance formatting — SESSION-DIST-UNITS-01 (2026-09-27)

`formatDist` is `formatDistance(km, preferredUnits, { exact: true })`, and its `??` fallback is
a bare em dash.

🔴 **It used to be `` `${km}${preferredUnits}` `` — an UNCONVERTED km value wearing the
reader's unit suffix.** It could only fire when `formatDistance` returns null (null/NaN input),
so it could never have rendered a useful number anyway — it would have printed
`"undefinedmi"`. It is fixed because it is the same shape as the six live sites a real user
reported on 2026-09-27, where 11.44 km rendered as `"11.4mi"` to a runner who had run 7.1
miles.

⚠️ The em dash here is the app's **no-value placeholder** — typography, exempt from
`brand.md` § Punctuation, which governs sentences a runner reads.

Enforced by `lib/format.distanceSuffix.test.ts`.


- Zone parsing + live HR band: `zonesFromZoneString` / `hrBandForZoneString` in `lib/coaching/zoneRules.ts`.

Reference: `components/shared/SessionSteps.tsx`. Integration: `DashboardClient.tsx → SessionPopupInner`.

## Punctuation (BRAND-EMDASH-APP-01, 2026-09-22)

The zone hint reads `{name} · tap to learn`. ⚠️ **It was `{name} — tap to learn`.** The
founder's rule is no em dash in a sentence; a label separator is not a sentence, so it takes
the **middot** the app already uses (`{raceName} · {date}`) rather than a colon. Guarded by
`lib/marketing/noEmDashApp.test.ts`.

---

## ⚠️ The info affordance is an `IconButton` inline mark (`ICON-BUTTON-01`, 2026-09-25)

The 15px ringed **i** beside the block name is `IconButton` with `inlineMark`. **Its glyph stays
15px; its hit area is 44px**, grown with padding plus a compensating negative margin.

🔴 **Why not simply enlarge it:** it sits inside a 12px uppercase label. At 44px it stops being an
inline mark and becomes a button parked in a heading, breaking the line box. Silvanto: *"the visual
is right and the target is wrong, and those are separable."* This is the **only** sanctioned route
below 44px visually (`:262`, iOS HIG); anything else owes the full 44.

Its `ariaLabel` is `` `${name} · tap to learn` `` — what the control does, never the glyph.

