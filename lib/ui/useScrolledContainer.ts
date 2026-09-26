'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * `useScrolledContainer` — has the scroller behind this element moved off its top?
 *
 * The single owner of "pinned chrome reveals its edge". Consumed by
 * `ScreenHeader` (tab roots) and by the two pushed-screen headers, which are a
 * different FAMILY (back arrow + title in a row, `BACK-HEADER-OWNER-01`) but the
 * same BEHAVIOUR. Writing the behaviour twice for two families is how this
 * codebase got two `ScreenHeader`s.
 *
 * 🔴 WHY THE WALK CHECKS `scrollHeight > clientHeight`, AND IT IS THE WHOLE
 * POINT OF THIS FILE.
 *
 * The first version took the nearest ancestor with `overflow-y: auto | scroll`.
 * That is what the CSS spec uses for `position: sticky`, so it looks correct —
 * and it is wrong here, because **this app has four elements that declare
 * `overflow-y: auto` and can never scroll**: `min-height: 100%` with no height,
 * inside the real scroller. They are scrollports that never move.
 *
 * That is the same defect this hook was written to fix. `SessionScreen`'s header
 * carried `position: sticky; top: 0` and **pinned to one of those boxes, so it
 * was never sticky at all** — measured in a browser, it sat at -800px after an
 * 800px scroll. The founder reported the header missing on the screen he had
 * asked for it on.
 *
 * ⚠️ AND MY OWN FIRST CUT HAD THE BUG. `ScreenHeader` shipped with the
 * spec-shaped walk and worked on Plan and Coach **by luck** — neither has the
 * inert wrapper. `MeScreen` does. A probe that cannot reach the failing state is
 * the recurring shape of my mistakes in this repo, and my browser check used a
 * container that really scrolled.
 *
 * So: a real scroller is one that **overflows**, not one that merely says it
 * might. Measured at subscribe time and re-measured on resize, because content
 * arriving async can turn a non-scroller into one.
 */
export function useScrolledContainer(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const el = ref.current
    if (!el) return

    let scroller: HTMLElement | Window = window
    let detach: (() => void) | undefined

    const findScroller = (): HTMLElement | Window => {
      let node: HTMLElement | null = el.parentElement
      while (node) {
        const oy = getComputedStyle(node).overflowY
        // BOTH conditions. Declaring `auto` is not scrolling.
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
        node = node.parentElement
      }
      return window
    }

    const read = () =>
      setScrolled((scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop) > 0)

    const attach = () => {
      detach?.()
      scroller = findScroller()
      read()
      scroller.addEventListener('scroll', read, { passive: true })
      detach = () => scroller.removeEventListener('scroll', read)
    }

    attach()
    // Content can arrive after mount (an AI analysis, a lazy card) and turn a
    // short screen into a scrolling one. Re-resolve rather than latch at mount.
    const ro = new ResizeObserver(attach)
    if (el.parentElement) ro.observe(el.parentElement)

    return () => { detach?.(); ro.disconnect() }
  }, [enabled])

  return { ref, scrolled }
}
