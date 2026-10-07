# Contract — Me door navigation

**Authority**: This document defines how a screen opens **at a door** on Me rather than at
the index, and where `Back` returns to. Any change to these props must update this document
in the same commit.

**Component:** `none`

⚠️ **Still deliberate, but THE ORIGINAL REASON IS NO LONGER TRUE and is corrected here
(2026-10-02).** It read: *"`MeScreen` is not its own module: it is a function inside
`app/dashboard/DashboardClient.tsx`, so there is no file for the gate to parse props from, and
its ~40 other props are undocumented debt."* **`DASHBOARD-SCREEN-EXTRACT-03` extracted it** to
`components/dashboard/MeScreen.tsx`, and nobody returned to this sentence or to the item that
quoted it as a blocker.

✅ **The 42 props are now documented and ENFORCED** in
[`me-screen.md`](me-screen.md) (`ME-SCREEN-CONTRACT-01`), which declares the component and is
compared prop-for-prop in both directions.

**Why this file keeps `none`:** only one contract per component can own the prop gate, and what
lives here is the navigation **semantics** — when `openSection` is consumed, where `Back`
returns to, why connection state comes from above — which a prop list cannot express. It is
cited as authority by `ui-patterns.md` and `design-rulings.md`. **Not a duplicate: an enforced
inventory and a behavioural authority are two different documents.**

---

## Prop Interface

```typescript
interface MeDoorNavigation {
  /** Open Me AT a door instead of at the index. Consumed once on mount, then cleared. */
  openSection?: string | null
  /** Called immediately after `openSection` is consumed, so a later visit lands on the index. */
  onOpenSectionConsumed?: () => void
  /** The origin travels with the request: the zones screen has two entry points. */
  onOpenZones?: (returnTo?: string) => void
  /** ME-ORDER-01 — read ONLY for the Connections row's subtitle. `undefined` = not loaded. */
  healthkitConnectedAt?: string | null | undefined
  /** HEALTH-SYNC-STALENESS-01 — start date of the most recent activity PER SOURCE,
   *  server-side. `null` = nothing has ever arrived. Derived in `DashboardClient` from
   *  the activity list already in memory, so it costs no query, and deliberately NOT
   *  from `getLastSyncIso()`: localStorage answers "this device" where the question is
   *  "this runner". Drives the honest-staleness sub-line (ui-patterns.md §17c
   *  amendment) on both connection rows and on the ME-ATHLETE Recovery row. */
  lastAppleHealthArrival?: string | null
  lastStravaArrival?: string | null
  stravaConnected?: boolean
}
```

## Why `openSection` is consumed and cleared

`MeScreen` is conditionally rendered (`{screen === 'me' && <MeScreen …/>}`), so it
**unmounts** whenever another screen is showing and `activeSection` resets to `'main'` on
remount. That is what makes `Back` land on the index by default, and it is what makes this
prop work: the request survives the screen switch in `DashboardClient`, is applied on mount,
and is cleared straight away.

🔴 **It must be cleared.** An uncleared value would re-open that door the *next* time the
runner visits Me from anywhere — an invisible sticky navigation state.

## ⚠️ Why the connection state comes from above, not from the rows

The `Connections` row's subtitle shows live state. It cannot read it from
`AppleHealthConnectionRow`, because **that row is behind the door and does not mount until
the door opens** — it can tell the index nothing. Both values already existed as
`DashboardClient` state and are passed down read-only, so the index and the rows cannot
disagree and there is no second owner of "is this connected?".

🔴 **`undefined` is a third state and it matters.** `healthkitConnectedAt` was
`string | null` initialised to `null` and only ever *set* when truthy, so *"not connected"*
and *"not loaded"* were the same value. A subtitle saying *"Not connected"* would have
flashed a false negative on every open. `connectionsSubtitle()` returns `null` for unknown
and the row renders no subtitle at all.

## Where Back goes

| From | Back returns to | Why |
|---|---|---|
| `reshape` | the `plan-adjustments` door | Its **only** entry point is that door |
| `zones` opened from the `heart-rate` door | that door | `zonesReturnSection` carries the origin |
| `zones` opened from the index `Zones` row | the index | No origin supplied, which is the default |
| `onConnect` (Coach empty state **and** `ZoneRings`) | the `connections` door | **TWO callers**, both previously landing on the index |
| every other door | the index | `setActiveSection('main')` |

⚠️ **The zones screen has TWO entries and one hardcoded back is wrong for one of them.**
Modelled on `redeemReturnTo`, which already existed in this file for the same problem.

## 🔴 The failure this contract exists to prevent

`ZONES-INPUTS-01`'s provenance chevron did `setScreen('me')` then
`document.getElementById(HR_CARD_ANCHOR_ID)?.scrollIntoView(…)`. Once the HR card moved
behind a door, `getElementById` returned **null**, `scrollIntoView` was never called, and the
control did nothing — **no error, no log**. Its markup test asserts the chevron *renders*; no
test could assert it *goes* anywhere.

**An anchor scroll is a navigation dependency on layout.** A door breaks it at a distance,
without editing the code that holds it.

## Checks

`components/shared/meDoorNavigation.test.ts` — 5 arms, all falsified 2026-09-28: the anchor
scroll returning, reshape forgetting its door, zones forgetting its origin, the general
"nothing scrolls to an element behind a door" arm, and the `openSection` effect being moved
below an early return (a conditional hook — React error 310, already shipped once).
