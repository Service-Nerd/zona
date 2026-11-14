# Contract — PreferencesScreen

**Authority**: This document defines the prop interface and rendering contract for the
Preferences door off the Me index. Any change to props must update this document in the
same commit.

**Component:** `components/shared/PreferencesScreen.tsx`

ME-DOORS-01, executing ME-PURPOSE-01 (Design Board, 2026-09-28).

The first door off the Me index. Display and notification preferences, which sat inline on
Me as two separate labelled sections.

## Prop Interface

```typescript
export interface PreferencesScreenProps {
  /** Global distance unit (ADR-015). */
  preferredUnits: 'km' | 'mi'
  onUnitsChange: (u: 'km' | 'mi') => void
  /** Default metric on session cards. */
  preferredMetric: 'distance' | 'duration'
  onMetricChange: (m: 'distance' | 'duration') => void
  /** The push rows, passed in rather than imported. See below. */
  notifications?: React.ReactNode
}
```

## Props

| Prop | Type | Required | Notes |
|---|---|---|---|
| `preferredUnits` | `'km' \| 'mi'` | yes | Global distance unit (ADR-015) |
| `onUnitsChange` | `(u: 'km' \| 'mi') => void` | yes | Persists via the caller; this screen holds no state |
| `preferredMetric` | `'distance' \| 'duration'` | yes | Default metric on session cards |
| `onMetricChange` | `(m: 'distance' \| 'duration') => void` | yes | |
| `notifications` | `ReactNode` | no | The push rows, **passed in, not imported** |

## Exports

`PREFERENCES_TITLE = 'Preferences'` · `PREFERENCES_SUBTITLE = 'Units, session display, notifications'`

Both are consumed by `DashboardClient`'s `ActionRow` and by this screen's own `ScreenHeader`.
The row label and the screen title are one string by definition; a second literal is a drift
waiting to happen and each surface reads correctly on its own, so nobody notices.

## ⚠️ Why `notifications` is a ReactNode and not props

`PushNotificationsRow` owns push-permission state that `DashboardClient` already holds and
threads (`setPushSubscribed`, plus the paid gate on the daily toggle). Pulling that state
down here would create a **second owner** of "is push registered?" — the D-08
duplicate-ownership shape this repo keeps paying for.

It also defines the empty state: **a free runner passes nothing and the screen renders
nothing there.** No heading over an absent card. *Empty means calm, not broken.*

## States

| State | Behaviour |
|---|---|
| Paid/trial | Both segmented controls + the notifications node |
| Free | Both segmented controls, no notifications region at all |
| Loading | None — the caller has the values before it opens the door |
| Error | None — `onUnitsChange` / `onMetricChange` own persistence and its failure |

## Checks

`components/shared/preferencesScreen.markup.test.ts` — 5 arms, all falsified 2026-09-28:
the empty-notifications state, the passed node, a hand-rolled control appearing in a screen
whose only job was relocation, and the label reached from both surfaces rather than typed twice.

## Both toggles report a failed write (USER-SETTINGS-TELL-THE-RUNNER-01, 2026-11-14)

`onUnitsChange: (u) => void | Promise<boolean>` · `onMetricChange: (m) => void | Promise<boolean>`.

Each row owns its own message state and renders `<SettingsWriteError />` beneath its
`SegmentedControl`. The message is reset before the next write, which is the board's amendment: a
transient failure must not leave a red line on a row that is now correct.

⚠️ **`=== false`, never truthiness.** A `void`-returning handler resolves `undefined`; testing
truthiness would show an error on a write that succeeded.
