# Contract — StrengthGuidedSession

**Component:** `components/dashboard/StrengthGuidedSession.tsx`. **Item:** `STRENGTH-GUIDED-SESSION-01` (Design Board
2026-10-28 F; SLT: PAID, inherited from strength; admin-only while `STRENGTH_RELEASE = 'admin'`). Rendered by
`DashboardClient` for `screen === 'strength-guided'`, opened by the overview's **Start session**. A full screen: the
nav is not rendered on it. Pattern: `ui-patterns.md` § Strength session in parts, and the guided session.

## Prop Interface

```typescript
interface StrengthGuidedSessionProps {
  session: StrengthSession          // the day's session (eased if the runner accepted a recovery ease)
  title: string                     // strengthSessionTitle(session)
  lifts?: { suggestions, today, units, onLog? }   // as the overview's; onLog saves a lift's feel (and weight)
  onExit: () => void                // Back on the first page: to the overview, today's progress kept
  onFinish: (times: { started_at: string; ended_at: string }) => Promise<boolean>  // Done: completion 'done' with times
  now?: () => number                // test seam
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null  // test seam; default localStorage
}
```

## Behaviour

- The flow is `lib/strength-bridge/guidedSession.ts` (`guidedSteps`, `guidedReduce`): one work page per round of each
  part from `sessionParts`, a rest page after each round from the part's own `rest_s`, none inside a no-rest part
  and none after the session's last round. Rest and timers are END times (`secondsLeft`), right after the phone sleeps.
- A move with fewer sets than its part's rounds is shown only in the rounds it is done in.
- Weight stepper on each loaded main lift: prefilled from today's log, else the suggestion; ± `STRENGTH_GUIDED.stepKg`
  (the engine's `LOAD_STEP_KG_LOWER` / `_UPPER`); tapping the number opens the keypad.
- **End session** is always on screen; the last round's done also ends. The end page shows minutes, training parts
  and rounds finished (`guidedTally`), a `LiftLogPanel` per main lift prefilled with the stepper's weight, and **Done**,
  which calls `onFinish` and clears the kept progress. A failed save shows `InlineError` and keeps the page; **Back**
  (quiet) leaves without Done, and the overview can still mark the session.
- Progress is kept on this device under `STRENGTH_GUIDED.storageKey(date)` (`zona_strength_guided_<date>`) and resumed
  for the same date and session (an ended one to its end page), and only when its step still exists. Other days' keys
  are removed on open (`staleGuidedKeys`). Storage failures are ignored: losing it costs a restart.
- Screen awake through the Web Wake Lock API, best effort. **Unmeasured in the iOS webview.**

Gates: `lib/strength-bridge/guidedSession.test.ts`, `components/dashboard/strengthGuided.markup.test.ts`.
