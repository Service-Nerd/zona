# Contract — HrCalibrationSheet

**Component:** `components/shared/HrCalibrationSheet.tsx`

**Authority**: this document defines the prop interface and rendering contract. Any change
to props updates it in the same commit.

The resting/max HR form, as a slide-up sheet
opened from inside the Training Zones screen. **ZONES-HR-SHEET-01** (Design Board,
2026-09-29). Tier: **FREE**.

## Props

```ts
interface HrCalibrationSheetProps {
  onClose: () => void
  restingHR: number | null
  maxHR: number | null
  maxHrSource?: 'observed' | 'user_confirmed' | null
  birthYear?: number | null
  onSave: (rhr: number, mhr: number) => void
  hrZoneMethod?: string | null
  hrAssumptionNote?: string | null
}
```


| Prop | Type | Required | Meaning |
|---|---|---|---|
| `onClose` | `() => void` | yes | Dismiss. Called by the backdrop, Escape, swipe-down and after save |
| `restingHR` | `number \| null` | yes | Current resting HR, or null when unset |
| `maxHR` | `number \| null` | yes | Current max HR, or null when unset |
| `maxHrSource` | `'observed' \| 'user_confirmed' \| null` | no | §50 provenance. `observed` is a device floor; `user_confirmed` is trusted below the age estimate |
| `birthYear` | `number \| null` | no | Drives the Tanaka age estimate used by `resolveMaxHr` |
| `onSave` | `(rhr: number, mhr: number) => void` | yes | The runner saved. **The sheet closes immediately after calling this** |
| `hrZoneMethod` | `string \| null` | no | Karvonen vs %MaxHR, passed through for display |
| `hrAssumptionNote` | `string \| null` | no | Engine note about assumed values, passed through |

## Contract

- **One mount.** This is the only place `HRZonesSection` renders in the product. Enforced by
  `components/shared/hrSheet.test.ts`.
- **The title comes from `meDoors.ts`** (`HEART_RATE_TITLE` / `HEART_RATE_SUB`), never a
  literal, so the door label and the sheet title cannot drift.
- **It closes on save**, so the caller sees `onSave` then `onClose` in that order. The caller
  must not also close on its own.
- **The caller owns the open state.** Render it conditionally; it does not self-gate.
- **It does not link to the zones screen.** It renders inside it; a link would be a loop.
  `HRZonesSection`'s `onOpenZones` prop was removed for this reason.

## Consumers

- `app/dashboard/DashboardClient.tsx` — the `zones` screen, gated on `hrSheetOpen`
- `app/sheet-preview/page.tsx` — the harness, under "Heart rate"

## Not verified

Nothing has run on a device. Whether the panel covers the zone rows it changes, and whether
Save is reachable with the keyboard raised, are both open (Design Board amendment 4).
