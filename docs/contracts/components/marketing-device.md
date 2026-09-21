# Contract — the marketing device (`PhoneShell` / `PhoneFrame` / `TabbedPhone`)

**Authority**: This document defines the one phone mockup used across the marketing site, and the two rules that are not guessable from the code. Any change to the device's props, its screens, or its import graph must update this document in the same commit.

**Components:**
- `components/marketing/PhoneShell.tsx` — the device chrome. **The only one.**
- `components/marketing/PhoneFrame.tsx` — `TodayStill` + a Today-only server wrapper.
- `components/marketing/TabbedPhone.tsx` — `'use client'`; Today / Plan / Coach via the real bottom nav.
- `components/marketing/phoneBlock.ts` — `DemoBlockView`, a leaf type module.

---

## Rule 1 — the screens are the app's screens

> A marketing mockup that shows a feature the product does not have is a promise the product then breaks.

**Founder, 2026-09-21:** *"whatever screens we're using on the website have to be exactly as they are on the app — we cannot be showing stuff that just isn't real."*

This took **three** cuts:

| Cut | Built from | Outcome |
|---|---|---|
| 1 | the v3 design handoff's description | **Fiction.** Coach drew four zone *bars* where the product plots *rings*, asserted **"Target is 80%. Last week: 62%."** — a sentence that exists nowhere in the product — and omitted Kit's weekly read. Plan invented a summary row and omitted the Plan Arc. |
| 2 | `screen-architecture.md` | **Still wrong.** That doc says what BELONGS on a screen, not what the screen IS. Plan showed three loose session cards and **no weeks**, which is the one thing the real Plan screen is made of. |
| 3 | `PlanScreen` / `CoachScreen` in `DashboardClient.tsx` | Correct, and it took one look. |

**Read the component.** A doc about a screen is not the screen; `screen-architecture.md` now carries that warning at its head.

What the screens are:

- **Today** — `TodayStill`, imported, never redrawn. It was the one screen cut 1 got right, *because* it was reused. An earlier recommendation to rebuild Today to match Plan and Coach would have spread the fiction; "built to spec" was the wrong goal and is withdrawn.
- **Plan** — `ScreenHeader "Your plan"` → `PlanArc` → the this-week card → **`PlanCalendar`**, the real week cards, over a plan from `generateRulePlan`.
- **Coach** — `ScreenHeader "Your coach · W{n} of {m}"` → **one** Kit read with `ZoneRings chromeless` **inside** it → the race arc. ⚠️ `chromeless` is load-bearing: the rings once kept their own border under the read and the founder read them as two cards. Giving them their own card reproduces a fixed bug.

**One block, one plan.** All three tabs read `weekN` / `totalWeeks` off the same generated plan. They previously disagreed — Today said "Week 6 of 16" while Plan generated a 12-week half marathon, so one device showed two runners. `DEMO_BLOCK` in `demoSurfaces.ts` is the single intent; `buildDemoPlanScreen()` is the producer.

**Prescription is real, execution is an illustration, and the page says so.** The sessions, distances, zones and paces come from the engine. The outcome figures (the zone split, Kit's read, the three race-arc times) are illustrations — we have roughly three users and there is no honest aggregate to quote. `SameWeekTwice` states this in its own header for the same reason.

**No dead affordances.** The SLT has already cut a plan-adjustment card from `PhoneFrame` for drawing Confirm/Revert buttons nobody can press — "a still pretending to be a demo". `PlanCalendar` keeps move and swap behind a tap, so at rest it shows what a runner sees. If a future change surfaces an interactive control *at rest*, that rule bites.

Gated by `lib/marketing/realComponents.test.ts`, which slices the real screen function out of `DashboardClient` and checks both directions. ⚠️ Its first cut used `toContain('<PlanCalendar')`, which `<PlanCalendarX` satisfies — mutating the app screen to prove the check worked did **not** fail it. Substring matching is biased toward passing.

---

## Rule 2 — the engine must never reach this device's client bundle

> 🔴 **This regressed TWICE in one sitting, both times silently, and cost 137 kB on the homepage.**

`TabbedPhone` is `'use client'`. **A client import pulls the whole MODULE graph, not the symbol.**

| # | The edge | Homepage First Load JS |
|---|---|---|
| 1 | `PlanCalendar` imported two DATE helpers from the `@/lib/plan` **barrel**, which also exports `savePlanForUser` and so pulls invariants, zod, the ops recorder and the charity re-anchor | 110 kB → **249 kB** |
| 2 | `PhoneFrame.tsx` imported `buildDemoPlanScreen` for a week count, and `TabbedPhone` imports `TodayStill` from that file | 114 kB → **251 kB** |

Neither showed up in a test, a type error, or a screenshot. The page looked perfect at 251 kB.

⚠️ **I stubbed the component I suspected (the race arc) and the number did not move** — the edge was two files away. Guessing does not locate these; bisect and measure.

**The rules that fell out:**

1. **Import the leaf, never the barrel.** `lib/plan/weekResolution.ts` holds ADR-016's date resolution with no persistence imports; `lib/plan.ts` re-exports it so no other call site changed.
2. **Generate on the server, pass data.** `lib/marketing/demoPlanScreen.ts` calls `generateRulePlan` and hands `TabbedPhone` a plain `DemoPlanScreen`. `app/page.tsx` is a server component and calls it.
3. **`PhoneFrame.tsx` must stay free of the engine**, because a client component imports `TodayStill` from it. `demoBlockView()` therefore lives in `demoPlanScreen.ts`, and `DemoBlockView` lives in `phoneBlock.ts` — **a leaf type module with no graph to drag**.
4. A **type-only** edge is erased at compile time and drags nothing. That is why `DemoBlockView` may cross the boundary.

Gated by `lib/marketing/clientBundleBoundary.test.ts`, which walks the import graph from every marketing client component and was falsified against **both** real regressions.

**Current cost: 117 kB, about +6 kB over the pre-DESIGN-V3 baseline, for three real screens.**

---

## Props

```typescript
// PhoneShell — the one device. Do not build a second.
{ activeTab: PhoneTab; onTab?: (t: PhoneTab) => void; children: ReactNode }

// PhoneFrame — Today only, server, no hooks. Used by /charity-runners.
(block: DemoBlockView)                      // { weekN, totalWeeks }

// TabbedPhone — three screens, client, owns the selected tab.
{ plan: DemoPlanScreen | null; initial?: PhoneTab }
```

- `Me` is in the nav because the product has four tabs and a mockup that hides one is a mockup of a different app. It has no screen here, so selecting it is a no-op rather than showing Today under a "Me" nav.
- **No segmented control.** The handoff draws one above the frame and says in as many words not to ship it: in the product, the nav changes tabs.
- **The homepage opens on Today**, asserted on `app/page.tsx` and not merely on the component default, because a stray `initial` prop would be invisible to a default-value assertion.

---

## Known limits

- Content is clipped at `CONTENT_H` (700px) — the stills are crops of longer screens, which is what `TodayStill`'s bottom fade signals.
- `DESIGN-V3-FIDELITY` tracks the device's geometry: it keeps 320 / radius 46 / 30px bar rather than the spec's 390×844 / 52 / 54. `CONTENT_H` is load-bearing, so changing it means re-measuring every screen inside the frame.
- Engine session labels render em dashes (`Easy run — Zone 2`) on this public surface. That is the **documented, deliberate** scope exclusion in `brand.md` § Punctuation, which notes those labels "render in the product as well as on the plan pages". Not a new violation; do not "fix" it here.
