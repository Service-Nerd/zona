# Contract — PullToRefresh Component

**Authority**: This document defines the prop interface and interaction contract for `components/shared/PullToRefresh.tsx` (PTR-01). Any change to props or gesture behaviour must update this document in the same commit.

---

## Prop Interface

```typescript
interface PullToRefreshProps {
  scrollRef: React.RefObject<HTMLDivElement>  // caller-owned scroll element ref, set on this component's div
  onRefresh: () => Promise<void>              // resolve = success ("Up to date."); throw = error ("Couldn't refresh.")
  paddingBottom: number                       // px reserved for the fixed bottom nav
  disabled?: boolean                          // suppress the gesture entirely (onboarding, not appReady, non-primary screens)
  children: React.ReactNode
}
```

---

## Ownership Contract

- **The caller owns the scroll ref.** `PullToRefresh` sets the passed `scrollRef` on its own scroll `<div>`. Other code that reads the same element (e.g. `DashboardClient` scroll-to-top on screen change) keeps working — the component does not create its own ref.
- **The caller owns the refresh semantics.** `onRefresh` decides what re-fetches. `PullToRefresh` is a pure gesture + indicator; it never fetches.
- **Success/failure is signalled by resolve/throw.** Resolve → "Up to date." Throw → "Couldn't refresh." (rendered in `--mute`, never red).

## Interaction Contract

- Engages only when the drag **starts at `scrollTop <= 0`** and is **predominantly vertical & downward** (axis lock releases horizontal/upward intent, so the week strip is unaffected).
- Thresholds: `THRESHOLD = 72px` (arm), `MAX_PULL = 104px` (resistance ceiling), `RESISTANCE = 0.5`.
- State machine: `idle → pulling → armed → (release) → refreshing → done | error → idle`.
- `refreshing` holds the indicator at the rest position and **pulses a neutral moss dot** (`zonna-ptr-pulse`, in `globals.css`). No spinner. The dot is **not** the AIMark sparkle — a data refresh is not model output (provenance honesty).
- `done` renders a **two-line restraint beat** — "Up to date." (`--ink-2`, 600) over "Nothing to chase." (`--mute`, 400). Deliberately points at *release* (nothing left to fetch), never at the next assignment: the product treats over-triers, so the caught-up state should let the user put the phone down, not hand them the next task. `error` is a single "Couldn't refresh." line (`--mute`).
- `done`/`error` beat lingers `DONE_HOLD_MS = 1200ms`, then the indicator collapses. It lives inside the pull affordance and retracts with the gesture — never a self-dismissing toast (N-004).
- Respects `prefers-reduced-motion` (no pulse animation; static dot).
- `touchmove` is bound natively as **non-passive** so the pull can `preventDefault`; when not actively pulling it early-returns and normal scrolling is untouched.

## States (SLC — Complete)

| State | Visual |
|---|---|
| idle | no indicator; content at rest |
| pulling | dot fades/scales in with pull progress |
| armed | dot at full opacity/scale (past threshold) |
| refreshing | dot pulses at rest position |
| done | two-line beat under the dot — "Up to date." / "Nothing to chase.", 1200ms |
| error | "Couldn't refresh." (`--mute`) under the dot, 1200ms |
| disabled | gesture inert (no engagement) |

## Design Tokens

Colours/fonts via CSS custom properties only: `--moss` (dot), `--mute` (status text), `var(--font-ui)`. No hardcoded hex. Keyframe `zonna-ptr-pulse` lives in `globals.css` (animation owner).

## Consumer

`app/dashboard/DashboardClient.tsx` — wraps the single dashboard scroll container. Enabled only on the primary nav screens (`today`, `plan`, `coach`, `me`) and when `appReady`. `onRefresh` = `handleRefresh`: native `syncOnAppOpen()` (force HealthKit ingest) → `refreshHealthKitRuns()` + `refreshRunAnalysis()` + `refreshCompletions()` + `refreshUnreadNotifications()`. Offline (`navigator.onLine === false`) throws → error state. Reference: PTR-01, ui-patterns.md §30.
