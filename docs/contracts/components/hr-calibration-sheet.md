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
- 🔴 **`onSave` hands over the RAW typed values, and the caller MUST resolve them through
  `lib/plan/hrSaveResolution.ts → resolveHrSave` before persisting or re-zoning a plan**
  (PLAN-META-HR-DIVERGENCE-01, 2026-11-08). `HRZonesSection` calls that owner to decide which
  zone table to SHOW; a caller that does not call it with the same inputs will persist and
  re-zone from a different number than the runner was just looking at. Two things come out of
  it: the max's **provenance** (a typed-over max is a §50 confirmation; an untouched one keeps
  what it arrived with, so editing only the RESTING HR cannot promote a device floor) and the
  **§50-guarded max** the plan is built from. ⚠️ **The signature cannot enforce this** — it was
  a 2-argument callback before and after, and `tsc` accepts a narrower callback for a wider
  prop, so the gate is `lib/plan/hrSaveResolution.test.ts`, not the type.

## Consumers

- `app/dashboard/DashboardClient.tsx` — the `zones` screen, gated on `hrSheetOpen`
- `app/sheet-preview/page.tsx` — the harness, under "Heart rate"

## Not verified

Nothing has run on a device. Whether the panel covers the zone rows it changes, and whether
Save is reachable with the keyboard raised, are both open (Design Board amendment 4).

## `onSave` carries a verdict and the sheet holds on a failure (USER-SETTINGS-TELL-THE-RUNNER-01, 2026-11-14)

`onSave: (rhr, mhr) => void | Promise<boolean>`.

🔴 **It used to be `=> void`, and `close()` ran synchronously beside it** — so the sheet was gone
before the write resolved, which is why a failed HR save had nowhere to report. The inner handler
awaits the verdict and calls `close()` only when it is not `false`.

⚠️ **Only an explicit `false` closes nothing.** A `void`-returning caller resolves `undefined` and
still closes, exactly as it always did, so no existing consumer changes behaviour.
