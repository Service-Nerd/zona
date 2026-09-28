# Contract — Me door navigation

**Authority**: This document defines how a screen opens **at a door** on Me rather than at
the index, and where `Back` returns to. Any change to these props must update this document
in the same commit.

**Component:** `none`

⚠️ **Deliberate, and the reason matters.** `MeScreen` is not its own module: it is a function
inside `app/dashboard/DashboardClient.tsx`, so there is no file for the gate to parse props
from, and its ~40 other props are undocumented debt this contract does not pretend to cover.
What is documented here is the navigation surface `ME-DOORS-01` introduced, which is the part
that can break silently. Filed: `ME-SCREEN-CONTRACT-01`.

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

## Where Back goes

| From | Back returns to | Why |
|---|---|---|
| `reshape` | the `plan-adjustments` door | Its **only** entry point is that door |
| `zones` opened from the `heart-rate` door | that door | `zonesReturnSection` carries the origin |
| `zones` opened from the index `Zones` row | the index | No origin supplied, which is the default |
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
