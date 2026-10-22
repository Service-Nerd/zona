# Contract — AddDistanceSheet

**Authority**: This document defines the add-distance sheet's props. Any change must update this document in the same
commit; `lib/contracts/componentContracts.test.ts` compares the two prop-for-prop, both directions.

**Component:** `components/shared/AddDistanceSheet.tsx`

```typescript
interface AddDistanceSheetProps {
  appleHealthUuid: string
  /** The runner's earlier entry, if any, else the planned distance: the starting value. */
  startKm: number | null
  units: 'km' | 'mi'
  onClose: () => void
  onSaved: (km: number) => void
}
```

## Rules (Design Board 6t-i, UNMEASURED-DISTANCE-01)
- Title `ADD_DISTANCE_TITLE` "How far did you run?" (founder, 2026-10-22). Body is `DistanceStepper`, prefilled.
- Saves through `POST /api/health/ingest` `source: 'report_distance'` (see `docs/contracts/api/health-ingest.md`). Loading
  state "Saving…"; a 409 says the device already has a distance; any other failure an `InlineError`, the sheet stays open.
