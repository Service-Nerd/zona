# Contract — RingsTapArea

**Authority**: This document defines the prop interface and rendering contract for the Coach zone rings' tap target. Any
change to props must update this document in the same commit.

**Component:** `components/shared/RingsTapArea.tsx` · **Item:** `ZONE-RINGS-HEADING-01` (defect fix, 2026-10-31)

---

## Prop Interface

```typescript
type RingsTapAreaProps = {
  onOpen: () => void        // opens the "what counts as in-zone" sheet
  children: ReactNode       // the rings, or the easy-share headline + rings + bars
}
```

## Rendering contract

| | |
|---|---|
| **Control** | A ghost `Button`, full width, no padding or background, accessible name *"What counts as in-zone. Opens an explanation."* |
| **Layout** | `flex-direction: column; align-items: stretch`. `.btn` is an inline-flex row; without the column the chromeless rings shrink to content and the eyebrow's `space-between` collapses (*"THIS WEEK IN ZONESACROSS 1 RUN"*) |
| **Consumers** | Coach (`DashboardClient.tsx`) and `/coach-preview`, so the harness renders the composition the screen does |

**Held by:** `components/shared/ringsTapArea.markup.test.ts`.
