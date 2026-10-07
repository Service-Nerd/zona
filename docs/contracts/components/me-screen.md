# Contract — MeScreen

**Authority**: This document is the prop inventory for the Me screen. Any change to
`MeScreen`'s props must update this document in the same commit —
`lib/contracts/componentContracts.test.ts` compares the two **prop for prop, both
directions**, so an undocumented prop and a fictional one both fail the build.

**Component:** `components/dashboard/MeScreen.tsx`

> 🔴 **THIS CONTRACT COULD NOT EXIST UNTIL MeScreen BECAME A MODULE, AND THEN NOBODY CAME
> BACK.** `ME-SCREEN-CONTRACT-01` was filed on 2026-09-28 stating the blocker in terms of
> architecture: *"`MeScreen` is a function inside `DashboardClient.tsx`, so
> `componentContracts.test.ts` has no file to parse props from… **Extracting MeScreen is what
> would make it contractable**."* `DASHBOARD-SCREEN-EXTRACT-03` extracted it to
> `components/dashboard/MeScreen.tsx` — and the item kept naming a blocker that had gone.
> **An item is a snapshot of the code on the day it was written** (CLAUDE.md), and this is the
> second recorded form: not an item half-closed by another ship, but an item whose stated
> *impossibility* was lifted by one.
>
> ⚠️ **`me-door-navigation.md` IS NOT SUPERSEDED AND IS NOT A DUPLICATE.** It holds the
> navigation **semantics** — when `openSection` is consumed, where `Back` goes, why connection
> state comes from above — which a prop list cannot express, and it is cited as authority by
> `ui-patterns.md` and `design-rulings.md`. It keeps `**Component:** none` because only one
> contract per component can own the prop gate. **Its stated reason was corrected in the same
> commit as this file**, because it said MeScreen had no module.

---

## Prop Interface

```typescript
interface MeScreenProps {
  // ── Door navigation (ME-DOORS-01) — semantics in me-door-navigation.md ──
  /** Open Me AT a door instead of at the index. Consumed once on mount, then cleared. */
  openSection?: string | null
  /** Clears `openSection` so a later visit to Me lands on the index as usual. */
  onOpenSectionConsumed?: () => void
  /** 🔴 PTR-SUBPAGE-01 — reports the open door so the hub can switch pull-to-refresh off.
   *  Every door keeps `screen === 'me'`, so without this they inherit the index's gesture. */
  onActiveSectionChange?: (section: string) => void

  // ── Identity ──
  plan: Plan
  initials: string
  athlete: string
  firstName: string
  lastName: string
  profileEmail: string
  /** PROFILE-IDENTITY-01 — resolves false if the write failed; the card reverts. */
  onSaveName: (name: string) => Promise<boolean>

  // ── Tier and access ──
  /** TIER-BADGE-01 — the resolved access REASON, for the identity card's status badge.
   *  ⚠️ NOT `hasPaidAccess`: that collapses five states into three and tells a comped
   *  charity runner they are a subscriber. */
  tierReason?: TierReason | null
  hasPaidAccess?: boolean
  trialDaysLeft?: number | null
  /** GTM-CHARITY-04 — ISO end date of a live charity grant, or null. */
  charityGrantEndsAt?: string | null
  onUpgrade?: () => void
  onRecheckEntitlement?: AfterSheet

  // ── Connections (ME-ORDER-01) ──
  /** ⚠️ Both come from `DashboardClient`, NOT from the connection rows: those live behind
   *  the door and do not mount until it is opened, so they cannot tell the index anything.
   *  `undefined` = not loaded yet, which is a third state the subtitle must render. */
  healthkitConnectedAt?: string | null | undefined
  stravaConnected?: boolean
  /* 🔴 ONE ROW, ONE SIZE SYSTEM (`CONNECTIONS-ROW-TWIN-01`, Design Board 2026-10-07).
   * Every Button inside a connection row — Apple Health AND Strava, connect AND
   * disconnect — is `.btn--inline-target`, never `size="compact"`. A settings row is one
   * line of text with an action at its end; the action is a chip (ui-patterns §38).
   * ⚠️ Measured before the fix: Disconnect 99x44 beside Connect 88x29. Both passed every
   * per-control check — the defect was the RELATIONSHIP. Gate:
   * `lib/ui/connectionRowSizing.test.ts`, population derived from this file.
   * ⚠️ `StravaConnectionRow` is declared INSIDE MeScreen while `AppleHealthConnectionRow`
   * has its own file; the gate resolves either, and the asymmetry is plausibly how they
   * drifted. */

  // ── Display preferences (ADR-015) ──
  theme: 'dark' | 'light' | 'auto'
  onThemeChange: (t: 'dark' | 'light' | 'auto') => void
  preferredUnits: 'km' | 'mi'
  onUnitsChange: (u: 'km' | 'mi') => void
  preferredMetric: 'distance' | 'duration'
  onMetricChange: (m: 'distance' | 'duration') => void

  // ── Heart rate (§50 / HR-MAX-01) ──
  restingHR: number | null
  maxHR: number | null
  maxHrSource?: 'observed' | 'user_confirmed' | null
  birthYear?: number | null
  /** Device-sourced HR from a Settings reconnect. Tags 'observed' provenance (a floor),
   *  distinct from a user_confirmed manual save.
   *  ⚠️ `onHRChange` IS DELIBERATELY ABSENT (ZONES-HR-SHEET-01): it fed the removed
   *  `Heart rate` door's form, and its owner is now `handleHrSave` on `DashboardClient`
   *  with one consumer, the HR sheet on the zones screen. */
  onDeviceHRFound?: (rhr: number | null, mhr: number | null) => void

  // ── Doors out ──
  onOpenGenerate?: () => void
  onOpenBenchmark?: () => void
  onOpenReshape?: () => void
  onOpenFounderNote?: () => void
  /** ZONES-SURFACE-01 / ZONES-HR-SHEET-01 — `editHr` opens the HR sheet on arrival,
   *  for the unset row. `returnTo` is the existing return-to state, not a second one. */
  onOpenZones?: (returnTo?: string, editHr?: boolean) => void

  // ── Plan adjustments (paid/trial only) ──
  /** ⚠️ REQUIRED, not optional (SWITCH-PRIMITIVE-01). It was `?: boolean` while the parent
   *  always passed it and the state defaults to TRUE — so an `undefined` would render the
   *  row's copy as "off" against a real default of on, and `Switch` would announce the
   *  wrong state to a screen reader. `Switch.checked` being required is what surfaced it. */
  dynamicAdjustmentsEnabled: boolean
  onDynamicAdjustmentsChange?: (enabled: boolean) => void
  lastAdjustmentCheckAt?: string | null
  lastAdjustmentCheckFoundChange?: boolean | null
  /** A `plan_adjustments` row with status='pending' exists. Distinct from
   *  `lastAdjustmentCheckFoundChange`, which stays true after the engine auto-applies
   *  silently. Drives the tappable "View change" copy. */
  hasPendingAdjustment?: boolean
  /** Recent auto_applied adjustments, last 14 days, newest first. Feeds "Changed this
   *  week" (§69): sub-threshold changes applied without asking need a passive place to be
   *  seen. Rows: { id, week_n, summary, sessions_before, sessions_after, created_at }. */
  recentChanges?: any[]

  // ── Notifications ──
  dailyPushEnabled?: boolean
  onDailyPushEnabledChange?: (enabled: boolean) => void
}
```

---

## ⚠️ What this contract does NOT settle

**42 props is the finding, not the deliverable.** This documents the interface as it is; it
does not claim the interface is right. `MeScreen` takes four separate HR values, six
preference pairs and seven adjustment fields, and several arrive only so the **index** can
render a subtitle for a door that has not mounted. Whether that is the right boundary is a
design question this file deliberately does not answer — recording it is what makes it
arguable.

🔻 **`recentChanges?: any[]`** is the one genuinely untyped prop. Its row shape is documented
above in prose because nothing enforces it; a real type belongs with the
`plan_adjustments` reader, not here.

## Checks

| Check | Where |
|---|---|
| Props match this contract, both directions | `lib/contracts/componentContracts.test.ts` |
| Me is an index — every row a door | `components/dashboard/meIsAnIndex.test.ts` |
| Door navigation semantics | `docs/contracts/components/me-door-navigation.md` |
