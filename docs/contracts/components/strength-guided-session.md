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

- The flow is `lib/strength-bridge/guidedSession.ts` (`guidedSteps`, `guidedReduce`): **one page per round of each
  part** from `sessionParts`. Rest and timers are END times (`secondsLeft`), right after the phone sleeps.

### Rest is a STATE, not a step (STRENGTH-GUIDED-DEVICE-01, Design Board 2026-11-04)

`GuidedStep` was `{kind:'work'} | {kind:'rest'}`. It is now **only** `{ kind: 'work'; part; round; restAfter_s }` —
the rest that follows a round lives ON that round, and renders as a band inside its page. The runner never leaves the
lift they are doing. `restAfter_s` is 0 on the session's last round and throughout a no-rest part (the warm-up),
exactly as the old `!last` guard was.

| action | effect |
|---|---|
| `next` while **not** resting, round has rest | **stays on the step**, starts the countdown, marks `restedStep` |
| `next` while resting, or after skip | advances; past the last round it ends the session |
| `skipRest` | **ends the countdown and does NOT advance** — Skip rest and Start round N are two controls on one page |
| `back` | previous round, clears any rest; from the first page returns `null` (the caller leaves) |
| `jump` | ⭐ **new** — any round, forward or back. **Out of range is IGNORED, never clamped** |

🔴 **`restedStep` is load-bearing.** Without it, "not rested yet" and "rest skipped" are both `restEndsAt == null`,
so `skipRest` then `next` restarts the same rest — an infinite loop for the runner. Caught by the round-trip arm in
`guidedSession.test.ts` before it shipped.

### Contents sheet

A control in the top band says where the runner is (`contentsAt`, e.g. `4 of 8`) and opens a slide-up **sheet** at
`Z_LAYERS.sheet` — never a modal (CLAUDE.md § UI Principles). One row per part, landing on that part's **first
round**: the runner is choosing a machine, not a set. Rows are real `<button>`s so Tab reaches them.
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
