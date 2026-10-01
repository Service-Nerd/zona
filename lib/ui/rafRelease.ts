// SHEET-RAF-FALLBACK-01 — the single owner of "do this on the next frame, and
// do it even if there is never a next frame".
//
// 🔴 WHY THIS IS A MODULE AND NOT TWO LINES IN A COMPONENT.
// `requestAnimationFrame` DOES NOT FIRE WHILE `document.hidden` IS TRUE. A
// one-shot rAF used to RELEASE a state therefore leaves that state stuck for as
// long as the document stays hidden, and both live uses were a stuck state the
// runner can see:
//
//   · `Sheet` — `shown` stays false, so the panel sits at `translateY(100%)`
//     while the scrim is already up and the body is already scroll-locked. The
//     app looks broken and cannot be scrolled out of.
//   · `WheelPicker` — `suppress.current` stays TRUE, and `onScroll` early
//     returns on every event, so the wheel stops responding to the user
//     entirely. Found by the consumer check on this fix, not reported.
//
// ⚠️ BOTH SELF-HEAL ON RETURN, which is exactly why they stayed filed: a
// pending rAF callback fires when the document becomes visible, so the broken
// window is the one nobody is looking at. It is still a window a runner lands
// in -- open a sheet, take a call, come back -- and it is the window this
// repo's own verification pane lives in permanently, which is why four
// successive attempts on `/sheet-preview` reported a sheet that had not opened.
//
// ⚠️ NOT FOR ANIMATION LOOPS. `TrendCard` drives a count-up with a recursive
// rAF tick. That is a different shape: a loop that has not started is a value
// that has not moved, and it resumes correctly on visibility. Forcing it
// through here would run the easing off a timer, which is worse. Left alone,
// deliberately.
//
// Timers are injectable because this repo's vitest environment is `node`, with
// no jsdom and no testing-library, so the only alternative gate would be a
// source grep -- and a source grep passes on a comment, which is the hollow
// check class recorded in `hollowTestShapes.test.ts`.

/** The ambient timer functions, injectable for tests. */
export interface FrameTimers {
  requestAnimationFrame: (cb: (t: number) => void) => number
  cancelAnimationFrame: (handle: number) => void
  setTimeout: (cb: () => void, ms: number) => number
  clearTimeout: (handle: number) => void
}

/**
 * The backstop delay.
 *
 * Long enough that rAF wins every normal frame (~16ms at 60Hz, and a slow first
 * paint still beats this, so a visible runner sees the real transition), short
 * enough that someone returning to a hidden-tab sheet does not watch it arrive.
 * Not a coaching or business numeric, so it is not GENERATION_CONFIG's.
 */
export const RAF_FALLBACK_MS = 50

/**
 * Run `release` on the next animation frame, or after `RAF_FALLBACK_MS` if that
 * frame never comes. **Runs at most once**, whichever wins.
 *
 * Returns a cancel function that clears both pending handles, so a teardown
 * cannot leave either one armed.
 */
export function releaseOnNextFrame(
  release: () => void,
  timers?: Partial<FrameTimers>,
): () => void {
  const raf    = timers?.requestAnimationFrame ?? ((cb) => requestAnimationFrame(cb))
  const unraf  = timers?.cancelAnimationFrame  ?? ((h) => cancelAnimationFrame(h))
  const after  = timers?.setTimeout            ?? ((cb, ms) => window.setTimeout(cb, ms) as unknown as number)
  const unwait = timers?.clearTimeout          ?? ((h) => window.clearTimeout(h))

  // The race guard. Both timers may fire -- a document that becomes visible at
  // the wrong moment runs the queued rAF callback right after the timeout -- and
  // a double release re-sets state React has already committed.
  let done = false
  const once = () => { if (done) return; done = true; release() }

  const r = raf(once)
  const t = after(once, RAF_FALLBACK_MS)

  return () => { done = true; unraf(r); unwait(t) }
}
