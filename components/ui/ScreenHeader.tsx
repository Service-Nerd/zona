'use client'

import { Z_LAYERS } from '@/lib/ui/zLayers'
import { useScrolledContainer } from '@/lib/ui/useScrolledContainer'

/**
 * ScreenHeader — the tab-root header. Title, optional subtitle, NO back arrow.
 *
 * ⚠️ THIS IS NOT `BackButton`'s header. A pushed screen leads with a back arrow
 * and a title in a ROW; this is a tab root. Conflating the two is a RETRACTED
 * finding on the ruling register (`design-rulings.md:858`) and `BackButton.tsx`
 * carries the same warning, because both live at a screen's top-left.
 *
 * 🔴 WHY THIS FILE EXISTS: IT WAS ALREADY WRITTEN TWICE.
 * `DashboardClient.tsx` had it as a PRIVATE function, and
 * `components/marketing/TabbedPhone.tsx` hand-copied it for the website's phone
 * stills, with a comment reading *"Reproduced from DashboardClient's own
 * ScreenHeader … Same sizes, same tokens."*
 *
 * **That claim was already false.** The app pinned `var(--font-ui)` on the title
 * AND the subtitle; the copy pinned neither and inherited whatever the marketing
 * page supplied. Both resolve to Inter today (ADR-007), so nothing looked wrong
 * — which is the point: the drift had already happened and was invisible.
 *
 * ⚠️ AND THE GUARD THAT EXISTS FOR EXACTLY THIS COULD NOT FIRE.
 * `realComponents.test.ts` exists because a marketing still said "8 km" while
 * the app said "8km", and its whole remedy is *"import the real component."*
 * **The real component was private, so the only available method was the one the
 * guard forbids.** Same shape as `Switch`: `ui-patterns.md` described a control
 * in four bullets with nothing implementing it, while a thousand lines below it
 * said "never build a one-off toggle inline".
 *
 * ── STICKY (SCREEN-HEADER-01, Design Board) ───────────────────────────────
 *
 * **A header persists when the content below it keeps referring to something the
 * header names.** Reference qualifies a header, not position. Coach's subtitle
 * names the week every card below reports on; Plan's title names the thing the
 * week cards belong to. A profile screen's title is a label, and a label does
 * not need to follow you down the page.
 *
 * 🔴 IT IS OPAQUE, AND THE EDGE IS WHAT ARRIVES ON SCROLL. The brief was
 * "translucent when scrolling". Two things are wrong with that literally:
 *
 *   1. **No fill works on this palette.** `--bg` sits BETWEEN white and any
 *      AA-safe darker tint, so a lighter fill vanishes on cards and a darker one
 *      vanishes on the ground — best case ~10 levels. The nav spent four
 *      sittings proving it (NAV-TRANSLUCENT-01/02) and the founder, shown an
 *      A/B, said *"I don't see any difference."* The EDGE separates by 30 levels
 *      over the ground and 32 over a card, which is why `--nav-pill-edge` exists
 *      and why this reuses it: one answer for "chrome has lifted off the page".
 *   2. **"While scrolling" is motion; the state that matters is SCROLLED.** A
 *      header keyed to motion goes bare at a scroll-stop mid-page and collides
 *      with the content under it. This is keyed to `scrollTop > 0`.
 *
 * At the top of the page the header has no edge and reads as part of the page.
 * The moment anything has passed beneath it, the edge appears.
 *
 * 🔴 MY FIRST CUT OF THE SCROLLER LOOKUP WAS WRONG AND WORKED BY LUCK. It took
 * the nearest ancestor with `overflow-y: auto` — the spec's rule for sticky —
 * and this app has four boxes that declare it and can never scroll. Plan and
 * Coach have none of them, so it passed; `MeScreen` has one. The corrected walk
 * lives in `useScrolledContainer`, shared with the pushed-screen headers.
 *
 * ⚠️ `zIndex` is the ONE inline style here, and it comes from the `Z_LAYERS`
 * owner rather than the stylesheet — the same split the nav uses. Everything
 * else is `.screen-header` in `globals.css`.
 */
export default function ScreenHeader({
  title,
  sub,
  sticky = false,
}: {
  title: string
  /** Secondary line. On Coach this names the week the whole screen reports on. */
  sub?: string
  /** Pins the header while the screen scrolls. Only for screens whose content
   *  keeps referring to what the header names — see the ruling above. */
  sticky?: boolean
}) {
  const { ref, scrolled } = useScrolledContainer(sticky)

  return (
    <div
      ref={ref}
      className={[
        'screen-header',
        sticky && 'pinned-chrome',
        sticky && scrolled && 'pinned-chrome--scrolled',
      ].filter(Boolean).join(' ')}
      style={sticky ? { zIndex: Z_LAYERS.screenHeader } : undefined}
    >
      <div className="screen-header__title">{title}</div>
      {sub && <div className="screen-header__sub">{sub}</div>}
    </div>
  )
}
