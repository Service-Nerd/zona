# Contract — ZoneTrace

**Authority**: This document defines the Zone Trace's props. Any change must update this document in the same commit;
`lib/contracts/componentContracts.test.ts` compares the two prop-for-prop, both directions.

**Component:** `components/shared/ZoneTrace.tsx`

```typescript
interface ZoneTraceProps {
  /** Smoothed points (`smoothTrace`). Thinned here for drawing. */
  points: TracePoint[]
  band: TraceBand
  ceilingOnly: boolean
  /** `getSessionColor(session)`: a `var(--s-…)` token. */
  colour: string
  height?: number
}
```

## Rules

- **One owner of the data and the sentence:** `lib/coaching/zoneTrace.ts` (`buildRunTrace`, `traceSentence`,
  §12 Amendment 3). This component only draws; it never decides what the run meant.
- **Where it appears:** inside `SessionCompleteCard` (post-run, the reopened logged session, the session popup's reflect
  view), fed by `components/dashboard/useRunTrace.ts`; the OG share route draws the same shape with resolved colours
  because `next/og` cannot read CSS variables. **FREE** (SLT 2026-10-21).
- **Below `TRACE_MIN_SAMPLES` (100) there is no trace**, and the card keeps the zone bar. Strava and manual rows carry no
  samples (ADR-011).
- **One band, one line** (Silvanto): the band in the session colour; the line in the session colour where held,
  `--zone-drifted` (amber, never red) above the ceiling, `--zone-unknown` under a quality session's floor. A
  ceiling-only run (easy, long, recovery: §12) fills the band to the bottom.
