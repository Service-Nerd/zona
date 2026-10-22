# Contract — SessionSilhouette

**Authority**: This document defines the session silhouette's props. Any change must update this document in the same
commit; `lib/contracts/componentContracts.test.ts` compares the two prop-for-prop, both directions.

**Component:** `components/shared/SessionSilhouette.tsx`

```typescript
interface SessionSilhouetteProps {
  /** `sessionSilhouette(structure, derivedSet)`: minutes and zone level per segment. */
  segments: SilhouetteSegment[]
  /** `getSessionColor(session)`: a `var(--s-…)` token. */
  colour: string
  height?: number
}
```

## Rules

- **One owner of the shape:** `lib/plan/sessionSilhouette.ts → sessionSilhouette()`. Width is minutes, height is the
  prescribed zone, read from the session MODEL (`composeSession` parts plus the derived steps), never from display text.
  Null (draw nothing) with fewer than two segments.
- **Where it appears:** under "Session structure" in `SessionSteps`, when the caller passes `silhouetteColour`
  (SESSION-PRERUN-DETAIL-01). **Not on Plan rows, and not on the Today card** (withdrawn: the ZoneBar is 4px against a
  30–40px strip).
- **No labels, no axis** (Silvanto): the section cards below name the parts. Work steps in the session colour; warm-up,
  cool-down and recovery at low opacity.
- **A run-walk run step** (`transition` run carrying a zone) draws at its zone so the run/walk alternation shows
  (RUNWALK-STEPS-01).
- `SILHOUETTE_HEIGHT_PX` (40) is the default height.
