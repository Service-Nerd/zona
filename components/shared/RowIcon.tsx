/**
 * STRENGTH-ENTRY-01 — the one icon family (ICON-RULE-01, Design Board 2026-09-22 + 2026-10-17).
 *
 * An icon earns its place two ways, and this file serves both:
 *  · `RowIcon` — LOCATION. A landmark on a list of eight or more rows (Me, the modify
 *    sheet). `iconRule.test.ts` keeps `<RowIcon` to those two surfaces.
 *  · `Glyph` — MEANING. The bare glyph, where it says what the label cannot: the dumbbell
 *    on a strength session card tells a lift from a run without relying on the rail hue,
 *    which a colour-blind runner cannot read.
 *
 * ⛔ Silvanto, binding: one family (the nav's line glyphs, stroke 1.2, round caps), one
 * size, one container, and the container tint is NEVER semantic: the app already spends
 * six session hues and four phase hues. So the container is `--bg-soft` and the glyph is
 * `--ink-2`, everywhere, for every row.
 *
 * 🔴 One owner. A glyph drawn inline in a screen is how the nav icons ended up as local
 * functions nothing else could reach, the exact trap `ActionRow`'s own header records.
 */

import type { ReactNode } from 'react'

/** One size for every glyph. */
export const GLYPH_PX = 16
/** One container for every row icon; 32px sits inside the row's 44px tap target. */
export const ROW_ICON_BOX_PX = 32

const S = { stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

/** Drawn on a 16×16 grid. Add a glyph here, never in a screen. */
const GLYPHS = {
  // RUNWALK-STEPS-01 (§21b Am.4c): the run/walk pair, on a run-walk session's steps only (never on Plan or Today rows,
  // STRENGTH-PLAN-GLYPH-01 b). Same family: line glyphs, stroke 1.2, round caps, 16×16.
  run:      <><circle cx="10" cy="2.8" r="1.3" {...S} /><path d="M6.5 6.2l2.6-1 2 1.8 2 .6" {...S} /><path d="M9.1 5.2l-1.3 3.6 2.4 1.8-.8 3.4" {...S} /><path d="M7.8 8.8l-2.3 1.4-2.3-.4" {...S} /></>,
  walk:     <><circle cx="8.5" cy="2.8" r="1.3" {...S} /><path d="M8.2 5.2v4.4l1.8 4.2" {...S} /><path d="M8.2 9.6l-1.6 4.2" {...S} /><path d="M8.2 6.4l2.2 1.6M8.2 6.4L6.2 8.2" {...S} /></>,
  dumbbell: <><path d="M1.5 8h13" {...S} /><rect x="3" y="4.5" width="2" height="7" rx="0.6" {...S} /><rect x="11" y="4.5" width="2" height="7" rx="0.6" {...S} /><path d="M1.5 6.5v3M14.5 6.5v3" {...S} /></>,
  plus:     <><circle cx="8" cy="8" r="6" {...S} /><path d="M8 5v6M5 8h6" {...S} /></>,
  history:  <><path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9" {...S} /><path d="M2.5 2.5v2.2h2.2" {...S} /><path d="M8 5.2V8l2 1.3" {...S} /></>,
  adjust:   <><path d="M2 4.5h12M2 11.5h12" {...S} /><circle cx="5.5" cy="4.5" r="1.5" {...S} /><circle cx="10.5" cy="11.5" r="1.5" {...S} /></>,
  settings: <><circle cx="8" cy="8" r="2" {...S} /><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2" {...S} /></>,
  link:     <><path d="M6.5 9.5l3-3" {...S} /><path d="M7 4.5l1.2-1.2a2.5 2.5 0 0 1 3.5 3.5L10.5 8M9 11.5l-1.2 1.2a2.5 2.5 0 0 1-3.5-3.5L5.5 8" {...S} /></>,
  question: <><circle cx="8" cy="8" r="6" {...S} /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.3" {...S} /><path d="M8 11.4v.1" {...S} /></>,
  mail:     <><rect x="2" y="3.5" width="12" height="9" rx="1.2" {...S} /><path d="M2.5 4.5L8 8.5l5.5-4" {...S} /></>,
  calendar: <><rect x="2" y="3" width="12" height="11" rx="1.2" {...S} /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" {...S} /></>,
  blocked:  <><rect x="2" y="3" width="12" height="11" rx="1.2" {...S} /><path d="M2 6.5h12M6 9l4 3M10 9l-4 3" {...S} /></>,
  route:    <><circle cx="4" cy="12" r="1.5" {...S} /><circle cx="12" cy="4" r="1.5" {...S} /><path d="M5.5 12H10a2 2 0 0 0 0-4H6a2 2 0 0 1 0-4h4.5" {...S} /></>,
  clock:    <><circle cx="8" cy="8" r="6" {...S} /><path d="M8 4.8V8l2.2 1.4" {...S} /></>,
  care:     <><path d="M8 13.5S2.5 10.2 2.5 6.3A2.8 2.8 0 0 1 8 5a2.8 2.8 0 0 1 5.5 1.3C13.5 10.2 8 13.5 8 13.5z" {...S} /></>,
  bolt:     <><path d="M9 1.5L3.5 9H8l-1 5.5L12.5 7H8z" {...S} /></>,
  terrain:  <><path d="M1.5 13l4.5-7 3 4.5 2-3 3.5 5.5z" {...S} /></>,
  star:     <><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" {...S} /></>,
  flag:     <><path d="M3.5 14.5V2" {...S} /><path d="M3.5 2.5h8l-1.8 2.8 1.8 2.7h-8" {...S} /></>,
} satisfies Record<string, ReactNode>

export type GlyphName = keyof typeof GLYPHS
export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[]

export interface RowIconProps {
  name: GlyphName
}

/** The bare glyph, in the current text colour. `aria-hidden`: the label beside it is the name. */
export function Glyph({ name }: RowIconProps) {
  return (
    <svg width={GLYPH_PX} height={GLYPH_PX} viewBox="0 0 16 16" aria-hidden focusable="false" style={{ flexShrink: 0, display: 'block' }}>
      {GLYPHS[name]}
    </svg>
  )
}

/** The location landmark for a long list: one glyph in one neutral container. */
export function RowIcon({ name }: RowIconProps) {
  return (
    <span aria-hidden style={{
      width: ROW_ICON_BOX_PX, height: ROW_ICON_BOX_PX, borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-soft)', color: 'var(--ink-2)', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Glyph name={name} />
    </span>
  )
}
