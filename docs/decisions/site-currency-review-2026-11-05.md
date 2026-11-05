# Design Board — `SITE-CURRENCY-REVIEW-01` (2026-11-05)

**Founder's ask:** *"I want you to look at our website. I want you to do a full review of all pages and tell me if
they are up to date with current styling and feature narrative and screens etc. Dont include strength etc but lets
ensure all the screens and features are up to date. Also take to design board to see if we can betters show them
off"*

**Scope:** every public marketing surface. Strength excluded by instruction.

---

## Method, and its limit

Source and gates only. **Nothing was rendered** — no browser, no viewport, no device, no Lighthouse, no bundle
measurement. That limit is stated first because it is larger than usual for this board and it is why finding 4
could not be ruled.

Baseline before the review: **47 marketing gate files, 475 tests, all green.** Every finding below is invisible to
that suite, and two were found by deliberately making one of its checks go red.

## The two falsifications

**1. The spacing gate governs one declaration.** `lib/marketing/spacingScale.test.ts` matches
`(marginBottom|marginTop|gap|rowGap|columnGap|paddingTop|paddingBottom):\s*'(\d+)px'` — a single bare value. The
`padding:` / `margin:` shorthand, and every left/right property, are outside it.

| | count |
|---|---|
| declarations the gate can read | **18** |
| ...of those, ≤5px and therefore exempt (Wroblewski's line-box rule) | 17 |
| ...of those, the `ALLOWED` 56px | 1 |
| **live declarations actually governed** | **1** |
| declarations it cannot read | **256** |
| ...individual off-scale px values >5px inside them | **187** |
| on files outside its surface list entirely | 70 |

Scale is 4/8/12/16/24/32/48. Most frequent off-scale values: `18px ×37`, `20px ×36`, `14px ×31`, `28px ×19`.
Surfaces outside the list: `/support`, `/privacy`, `/terms`, `/guides`, `/comparisons`.

**Falsified:** changed a `/pricing` card to `padding: '19px 21px'`. All three arms green. Reverted.

**2. The free column can shrink to nothing.** `pricing.test.ts` has four arms in the paid direction plus one that
stops us claiming something is free when it is gated. There is no arm asserting a free gate reaches the page.

**Falsified:** deleted the whole `plan_difficulty_band` row from `FREE_FEATURES`. `pricing.test.ts` and
`pricingRowTruth.test.ts` both green. Reverted.

Both reverted; tree confirmed clean before the sitting.

## Evidence that decided finding 5

The Coach screen's live composition, `app/dashboard/DashboardClient.tsx`:

```
read (CoachByline, arrives untapped) → ShareControl → ZoneRings (tap, "N% easy", 8 weeks)
→ LoadShape + LoadHistory (8 weeks) → WeekFacts → EffortRecord :6247 → TrendCard :6269 → RaceTimesCard :6327
```

`components/marketing/TabbedPhone.tsx → CoachStill` renders: the read, the rings, and a standalone race-arc card.
**Two of eight**, plus one card that no longer exists in the app in that form — the arc now lives inside
`RaceTimesCard`.

Cost of closing it, measured per component:

| Component | Boundary | Hooks |
|---|---|---|
| `EffortRecord` | server | 0 |
| `LoadHistory` · `LoadShape` · `WeekFacts` | server | 0 |
| `SessionSteps` · `SessionSilhouette` | server | 0 |
| **`TrendCard`** | **`'use client'`** | **8** |
| **`ShareControl`** | **`'use client'`** | **4** |

`EffortRecord`'s prop surface is `{ runs: EffortRun[]; weeks: number }` and it exports its own `effortHeadline()`.
`clientBundleBoundary.test.ts` exists because two client edges on this page cost **110 kB → 251 kB**, twice,
silently.

## The scan did most of the ruling

Three findings arrived in a form the register had already killed:

- *"Website: a list of the eight things we look for"* — **DON'T SHIP, PERMANENT**, *"may not return as a list with
  better wording"*
- *"The three-card proof band"* — **DEAD ON MEASUREMENT**, *"cannot return as 'we just need better numbers'"*
- *"A commitments block answering 'will I get slower?'"* — **KILLED**, Coaching Board, W-03: *"a block of promises is
  the weakest instrument against an evidence question"*

And the rule that separates what may proceed, from the same sitting that killed the list:

> *"A competitor can write 'we adapt your plan' this afternoon; what they cannot do is run their own engine on the
> page and print the sentence it produces."*

**Engine, not diagram.** Finding 7 therefore ships as a gate with no new copy; finding 8 is refused as filed.

One phantom conflict was checked and rejected: `SITE-WAVE-3` killed *the site adopting the app's session-colour
language*, not *a product component rendering inside a frame*. `ZoneRings` and `SessionCard` already do the latter,
shipped, under the same register.

## Rulings

See the register row in `docs/canonical/design-rulings.md` (2026-11-05) for the full table, the three recorded
disagreements, and what the sitting does not settle.

Build order agreed with the founder: **1 → 3, then 6, then 7, then 5.** Defects and the hollow gate first; then the
plan-page session structure, which Sierra and Wroblewski independently called the most valuable and which costs
nothing in the client bundle.
