'use client'

import BackButton from '@/components/shared/BackButton'
import { Z_LAYERS } from '@/lib/ui/zLayers'
import { useScrolledContainer } from '@/lib/ui/useScrolledContainer'

/**
 * PinnedBackHeader — the back arrow in an opaque band, for screens that hand-roll their
 * own title instead of using `ScreenHeader` (BACK-ARROW-TITLE-COLLIDE-01, Design Board
 * 2026-09-29, amendment 3).
 *
 * 🔴 WHY THIS EXISTS AND WHY IT IS SHARED. The `ScreenHeader` default flip fixed seven
 * screens in one line. Five more could not be reached by it, because their title is
 * hand-rolled inside the scrolling content block: `Upgrade`, `FounderNote`, `Redeem`,
 * `Faq`, `BenchmarkUpdate`. Wroblewski put them in scope in as many words — *"or we will
 * find them in a screenshot in a week"*. Doing them as five bespoke edits would have made
 * five copies of one pattern, which is this repo's single most-recorded defect: a pattern
 * that is a local variable cannot travel.
 *
 * ⚠️ THE INVARIANT IS THE BAND, NOT THE TITLE. Silvanto's finding was about WHERE the
 * overlap happens, not that it happens: `.pinned-chrome` is `--bg` with an edge that
 * appears on scroll, so content passing beneath disappears **at a line**. A floating disc
 * hides it **at a curve, mid-word**, which reads as a rendering fault. So the rule these
 * screens need is *the arrow sits in an opaque band* — and a screen whose title is a short,
 * discrete header passes it through `children` so the pair pins together, while a screen
 * whose "title" is an essay lead or sits inside a conditional keeps its title in the flow
 * and lets it scroll cleanly under the edge.
 *
 * ⚠️ IT REPLACES `FloatingBackButton` ON THESE SCREENS, AND THAT HAS A COST WORTH NAMING:
 * inside a band the arrow stops being a hovering circle. The founder overturned the board
 * once to get that hover, and has since asked for the pinned group three times. The cost is
 * in `design-rulings.md`, not buried here.
 *
 * ⚠️ Sticky, so it is in flow and cannot swallow taps meant for content beside it —
 * unlike a `position: fixed` strip, which is what `FloatingBackButton`'s own note warns
 * against. Same mechanism as the session-detail and wizard headers.
 */
export default function PinnedBackHeader({
  onClick, ariaLabel, children, padding = '16px 20px 8px', maxWidth,
}: {
  onClick: () => void
  ariaLabel?: string
  /** A short, discrete title to pin WITH the arrow. Omit for essay or conditional titles. */
  children?: React.ReactNode
  padding?: string
  /** Matches the content block's own measure, so the band's edge lines up with it. */
  maxWidth?: number
}) {
  const { ref, scrolled } = useScrolledContainer(true)
  return (
    <div
      ref={ref}
      className={`pinned-chrome${scrolled ? ' pinned-chrome--scrolled' : ''}`}
      style={{
        padding,
        zIndex: Z_LAYERS.screenHeader,
        ...(maxWidth ? { maxWidth: `${maxWidth}px`, margin: '0 auto' } : {}),
      }}
    >
      <BackButton onClick={onClick} ariaLabel={ariaLabel} />
      {children}
    </div>
  )
}
