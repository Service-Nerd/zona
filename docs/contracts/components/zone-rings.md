# `ZoneRings` — contract

**Components:**
- `components/shared/ZoneRings.tsx` — `ZoneRings` (default export)
- `components/shared/ZoneRings.tsx` — `ZoneRingsSkeleton` (named export)

⚠️ **A `**Components:**` LIST, DELIBERATELY, AND THE GATE'S OWN RULE SAYS WHY.** This file
governs two exports and a **four-way discriminated union**; `componentContracts.test.ts` skips the
prop-for-prop check for multi-component contracts because *"pinning it to ONE component's props
would be a false comparison"*, and a flat `interface` block cannot express a union whose required
props differ per `state`. 🔴 **Writing this contract found the gate reading the WRONG component:**
`ZoneRings(props: Props)` is not destructured, so the parser fell through to `ZoneRingsSkeleton`'s
`{ label, chromeless }` — the `sheet.md` / `NavHeightProvider` defect in a new shape. Fixed in the
gate the same day (**1 of 74 contracts affected**): a default export it cannot read now returns
`null`, which is loud, instead of a sibling's props, which is confidently wrong.

Brand-mark-as-data-display: the four concentric rings of the Zonna mark, each one an HR-zone
bucket for the week. **5 importers.** Pattern 22.

⚠️ **Written 2026-11-10 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

A **discriminated union on `state`**, not one optional-heavy shape:

```typescript
type ChromeProps = { chromeless?: boolean }

type LiveProps    = ChromeProps & { state?: 'live'; label?: string;
                                    pctByZone: ZoneSlice; meta?: string; headless?: boolean }
type PendingProps = ChromeProps & { state: 'pending'; label?: string }
type LockedProps  = ChromeProps & { state: 'locked';  label?: string; onUpgrade?: () => void }
type EmptyProps   = ChromeProps & { state: 'empty';   label?: string;
                                    reason: 'not-linked' | 'no-data'; onConnect?: () => void }

export default function ZoneRings(props: LiveProps | PendingProps | LockedProps | EmptyProps)
export function ZoneRingsSkeleton(props: { label?: string; chromeless?: boolean })
export type { ZoneSlice }
```

⚠️ **`state` is OPTIONAL only on `LiveProps`**, so omitting it means live and `pctByZone` becomes
required. That is what makes the union discriminate without a caller having to write
`state: 'live'` everywhere.

## Invariants

1. 🔴 **ARC-FILL, NEVER THICKNESS.** Each ring is a full stroke in `--line` with a coloured arc
   overlaid from 12 o'clock clockwise to `pct × 360°`. **Thickness-as-data distorts the brand
   mark's silhouette; arc-fill keeps every ring's shape intact and only the coverage varies**, so
   the mark stays recognisable at any data shape. This is a ratified phase decision, not a
   rendering convenience.
2. 🔴 **THE CENTRE DOT IS BRAND-CONSTANT AND NEVER DATA-DRIVEN.** `--moss`, always. The four rings
   map outer→inner as Z1 `--s-recov`, Z2 `--s-easy`, Z3 `--s-quality`, Z4-5 `--s-inter`.
3. 🔴 **THE SHAPE IS OWNED BY THE AGGREGATE, NOT BY THIS RENDERER.** `ZoneSlice` is imported from
   `lib/coaching/weeklyZoneAggregate` and re-exported; this component never computes a percentage.
   The source is `hr_pct_z1 / z2 / z3 / z4_5` from `run_analysis` across the week's completed
   runs, **load-km weighted — the same weighting as `RestraintCard`'s discipline score, so the two
   can never disagree about what dominated the week.**
4. **`pctByZone` is 0–100 per zone and the component is TOLERANT of a sum that is not 100.** It
   draws each ring independently; it does not normalise and it does not warn. An aggregate that
   sums wrong is the aggregate's defect to surface, not the renderer's to hide.
5. 🔴 **`chromeless` EXISTS BECAUSE THE DESIGN SAID ONE BLOCK AND THE DOM SAID TWO.** `UX-COACH-01`:
   Kit's read and this mark are the same fact in two registers, word and image. The rings were
   moved under the read but **kept their own border**, so the founder read them as two cards —
   correctly. It defaults to `false`, so the marketing homepage and every other caller are
   untouched, which `zoneRingsChrome.test.tsx` holds in place.
6. 🔴 **`headless` IS A SEPARATE CONCERN FROM `chromeless` AND MUST STAY ONE.** `COACH-DISCIPLINE-
   HEADLINE-01`: when the parent card owns the heading, the rings must not say *"This week in
   zones"* a second time. Chrome is the shell; headless is the label. Collapsing them into one
   prop would make the homepage lose its heading or the coach card grow a border.
7. 🔴 **`empty` IS AN HONEST END STATE, NEVER A PERPETUAL SHIMMER**, and `reason` is required so it
   says which: `'not-linked'` (no Strava/Health source, so zones can **never** be computed — offer
   to connect) against `'no-data'` (source linked, but this week's runs carry no usable HR
   breakdown — a manual log, missing HR, or a link that was never analysed). ⚠️ **The two are
   different sentences to the runner and a single "no data" would be a lie to one of them.**
8. **`ZoneRingsSkeleton` is a separate export, not a fifth state.** The loading window is a
   shimmer; `pending`, `locked` and `empty` are all *resolved* states with something to say.
9. **Geometry is SVG user units at `SIZE = 160`; the PARENT owns layout dimensions** through the
   wrapping flex container. A caller that needs a different footprint sizes the container, never
   the viewBox.

## Pattern

`ui-patterns.md` § ZoneRings (Pattern 22). State model mirrors `RestraintCard` (Pattern 11):
live / pending / locked, plus the separate skeleton. Rulings: `UX-COACH-01`,
`COACH-DISCIPLINE-HEADLINE-01`.
