'use client'

/**
 * `lastPressedRect` — where the runner last put their finger.
 *
 * 🔴 WHY THIS EXISTS INSTEAD OF A PROP. `Sheet` needs to know which control
 * opened it, so the panel can grow out of that control rather than out of the
 * bottom of the screen (`SHEET-ORIGIN-01`). The obvious design is an `origin`
 * prop — and that means editing **nine call sites across six files** and
 * remembering to do it on the tenth.
 *
 * ⚠️ The last control pressed before a sheet mounts **is** the control that
 * opened it. That is not a heuristic dressed up as a fact: a sheet is opened by
 * a tap, and the tap that opened it is the most recent one by construction.
 *
 * Guards, because "by construction" is doing real work in that sentence:
 *   · **older than `MAX_AGE_MS`** — the sheet was not opened by that tap
 *     (a timer, a push, a state change). Fall back.
 *   · **off-screen or zero-sized** — the control has scrolled away or
 *     unmounted; growing from a point nobody can see is worse than not trying.
 *
 * Both fall back to `null`, and `Sheet` then uses the nav pill's top edge.
 */
let rect: DOMRect | null = null
let at = 0

const MAX_AGE_MS = 1200

if (typeof window !== 'undefined') {
  // `pointerdown`, not `click`: it fires before the handler that opens the
  // sheet, and it fires for touch, mouse and pen alike.
  window.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('button, [role="button"], a')
    rect = el ? el.getBoundingClientRect() : null
    at = Date.now()
  }, { capture: true, passive: true })
}

export function lastPressedRect(): DOMRect | null {
  if (!rect) return null
  if (Date.now() - at > MAX_AGE_MS) return null
  if (rect.width < 1 || rect.height < 1) return null
  // Off-screen: the control scrolled away or was unmounted.
  if (rect.bottom < 0 || rect.top > window.innerHeight) return null
  return rect
}
