# Contract — AddDistanceRow

**Authority**: This document defines the add-distance row's props. Any change must update this document in the same
commit; `lib/contracts/componentContracts.test.ts` compares the two prop-for-prop, both directions.

**Component:** `components/shared/AddDistanceRow.tsx`

```typescript
interface AddDistanceRowProps {
  appleHealthUuid: string
  /** What the runner already entered, km; null when nothing yet. */
  reportedKm: number | null
  plannedKm: number | null
  units: 'km' | 'mi'
  onSaved: (km: number) => void
}
```

## Rules (Design Board 6t-i, UNMEASURED-DISTANCE-01)
- **Full width, under the planned/actual block**, never inside the half-width column (it wrapped at 375px).
- Shown only for an Apple Health run whose device recorded no distance; never when `distance_m > 0`.
- Labels: `ADD_DISTANCE_LABEL` "Add the distance", `CHANGE_DISTANCE_LABEL` "Change the distance" after an entry. The
  module also owns `DISTANCE_NOT_RECORDED` and `DISTANCE_REPORTED_LABEL` ("you added this"), so the session detail and the
  post-run screen say the same words. Opens `AddDistanceSheet`.
