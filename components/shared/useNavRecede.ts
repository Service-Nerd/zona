'use client'

// NAV-FADE-01 (Design Board 2026-09-25, ruled SHIP WITH AMENDMENT; built 09-28)
// — is the runner scrolling right now?
//
// The founder: *"Would be great if we could make it a bit opaque when scrolling
// then comes back when it's not."*
//
// ⚠️ THIS HOOK OWNS ONLY THE QUESTION, NEVER THE ANSWER. What "receded" LOOKS
// like is `.nav-bar--receded` in `globals.css`, and the amendment that matters
// lives there: translucency plus a backdrop blur, with the labels at full
// opacity, because a whole-bar opacity fade was measured at 4.47:1 (below AA)
// at 0.9 and 2.98:1 at 0.7. Keeping the look in CSS is also what lets
// `prefers-reduced-motion` disable the recede in ONE place rather than here and
// there.
//
// 🔴 CAPTURE-PHASE, ON `document`, AND THAT IS THE DESIGN.
// `scroll` does not bubble, so a listener on `window` hears only the window. The
// app scrolls in different places depending on the screen (several own their
// scroll context), and threading a ref through a 7,800-line component to find
// whichever one is scrolling today is exactly the kind of edit that goes wrong.
// A capture listener on `document` hears scroll from ANY element, which is the
// property we actually want, and it cannot drift when a screen changes its
// container.
//
// ⚠️ NOT A SCROLL POSITION. It deliberately does not care which direction or how
// far — only whether scrolling is HAPPENING. A direction-aware nav invents a
// second question the board explicitly flagged ("when does it come back?"); this
// answers it with "when you stop", which needs no threshold to argue about.

import { useEffect, useState } from 'react'

/** How long after the last scroll event the bar returns. The board's figure. */
export const NAV_IDLE_MS = 150

export function useNavRecede(): boolean {
  const [receded, setReceded] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const onScroll = () => {
      setReceded(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setReceded(false), NAV_IDLE_MS)
    }

    // `capture` so it hears scroll from any container; `passive` so it can never
    // delay a scroll — this is chrome reacting to the runner, not the reverse.
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      if (timer) clearTimeout(timer)
    }
  }, [])

  return receded
}
