import type { CSSProperties, ReactNode } from 'react'

/**
 * DESIGN-V3 — one band of the marketing page.
 *
 * The surface system is the whole point of the handoff: the page reads as a
 * sequence of grounds rather than one long scroll, and the alternation is
 * what makes the white cards look like cards. Before this, every section was
 * a hand-written `<section style={{ padding: 'var(--sect-y) 24px', maxWidth:
 * ... }}>` and the surface was whatever the page background happened to be.
 *
 * ⚠️ THE BACKGROUND IS FULL-BLEED, THE CONTENT IS NOT. That is why this is a
 * component rather than a class: an inset band whose colour stops at 1100px
 * reads as a very wide card, which is the opposite of a band. The outer
 * element carries the surface and spans the viewport; the inner element
 * carries the measure.
 *
 * ⚠️ `dark` IS RATIONED TO ONE PER PAGE AND THAT IS A RULE, NOT A
 * PREFERENCE. `ui-patterns.md` § Dark Ground: "Exactly one near-black section
 * per marketing page. It is a punctuation mark, not a theme — ADR-008 stands.
 * A second dark section would make it a dark theme; don't." The v3 handoff
 * asked for two ink bands; the founder confirmed one (2026-09-21), which is
 * also how the identical request was answered during the Miles teardown
 * (W-10). `lib/marketing/sectionSurfaces.test.ts` counts them.
 */

export type SectionSurface = 'page' | 'card' | 'inset' | 'dark'

const SURFACE: Record<SectionSurface, { background: string; color: string }> = {
  page:  { background: 'var(--bg)',      color: 'var(--ink-2)' },
  // ⚠️ `card` ADDED 2026-09-22 (Design Board sitting one). It is the WHITE
  // SPOTLIGHT that `ui-patterns.md` § Section grounds has documented as one of
  // the three grounds since W-08 — and which this component could not express,
  // so the homepage hand-rolled it with a raw background instead. The doc, the
  // component and `sectionSurfaces.test.ts` described three different systems;
  // this is the reconciliation, not a new ground.
  card:  { background: 'var(--card)',    color: 'var(--ink-2)' },
  // ⚠️ `inset` IS NOT A PAGE GROUND, and brand.md says so in those words. It is
  // the containment surface `ProductStill` uses to frame a component. Spending
  // it as a section ground is band alternation, which W-08 killed.
  inset: { background: 'var(--bg-soft)', color: 'var(--ink-2)' },
  dark:  { background: 'var(--ground)',  color: 'var(--on-ground)' },
}

export function Section({
  surface = 'page',
  width = 'page',
  rhythm = 'normal',
  hairline = false,
  id,
  style,
  innerStyle,
  children,
}: {
  surface?: SectionSurface
  /** `read` is the ~70-character prose column; `full` opts out for a band
   *  that manages its own width. */
  width?: 'page' | 'read' | 'full'
  /** `hero` is lighter because the header sits above it; `close` is heavier
   *  because the page ends there. Both are existing W-07 tokens. */
  rhythm?: 'normal' | 'hero' | 'close' | 'none'
  /** A 1px top rule. Used where two bands of DIFFERENT colour meet and the
   *  colour change alone is too quiet, per the handoff. */
  hairline?: boolean
  id?: string
  style?: CSSProperties
  innerStyle?: CSSProperties
  children: ReactNode
}) {
  const pad =
    rhythm === 'hero'  ? 'var(--sect-y-hero) 24px'
    : rhythm === 'close' ? 'var(--sect-y-close) 24px'
    : rhythm === 'none'  ? '0 24px'
    : 'var(--sect-y) 24px'

  const maxWidth =
    width === 'read' ? 'var(--measure-read)'
    : width === 'full' ? undefined
    : 'var(--measure-page)'

  return (
    <section
      id={id}
      style={{
        ...SURFACE[surface],
        ...(hairline ? { borderTop: `1px solid ${surface === 'dark' ? 'var(--ground-line)' : 'var(--line)'}` } : {}),
        ...style,
      }}
    >
      {/* ⚠️ THE READ COLUMN IS NESTED, NOT NARROWED, AND THAT IS THE RULING.
          `margin: '0 auto'` on a 720px box centres it — which pushed every prose
          band **190px inboard** of everything else on the page. Measured at
          1440px: the content's left edge ran 168 · 168 · 168 · 168 · 168 · 168 ·
          358 · 358 · 168 · 358 · 338. **Three distinct left edges, moving four
          times**, while the header and the footer both sit at 168.
          `ui-patterns.md` gives `--measure-page` its purpose in those words —
          *"matching the site frame so the content edge stops moving as you
          scroll"* — so the rule's own reason was what the page was breaking.
          Found by the founder on desktop; invisible at 375px, where both
          measures collapse to the gutter, which is why two device passes missed
          it.
          The measure is not the defect. The centring was. The outer box owns the
          frame and the padding; the inner box owns the reading width and starts
          where every other band starts. */}
      <div style={{
        // `full` opts out of the frame and manages its own width — unchanged.
        maxWidth: width === 'full' ? undefined : 'var(--measure-page)',
        margin: '0 auto', padding: pad, ...innerStyle,
      }}>
        {maxWidth === 'var(--measure-read)'
          ? <div style={{ maxWidth }}>{children}</div>
          : children}
      </div>
    </section>
  )
}
