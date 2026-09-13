// Z-LAYER SINGLE OWNER (SHEET-PRESENT-01, 2026-09-13)
//
// Before this module, every overlay in the app invented its own z-index. The
// bottom nav sits at 3000; secondary sheets were written at 100 / 200 / 2000
// (below the nav) and 4000 (above it) — five of seven guessed too low, so the
// nav painted over the part of the sheet that mattered, including its own close
// bar. Founder-reported on device.
//
// The fix is not seven new numbers — it is ONE owner of the stacking order, so
// "a secondary sheet sits above the bottom nav" is true by construction and
// testable (see lib/ui/zLayers.test.ts). The <Sheet> primitive consumes
// `sheet`; the bottom nav consumes `nav`; the first-load ScreenGuide coach-mark
// consumes `guide`. Nothing in app/ or components/ should hardcode a bottom
// sheet z-index again.
//
// Ordering contract (asserted by the test): guide > sheet > nav > content.

export const Z_LAYERS = {
  /** In-flow screen content and the scroll container. */
  content: 0,
  /** The fixed bottom navigation bar (Today / Plan / Coach / Me). */
  nav: 3000,
  /** Every secondary slide-up sheet. MUST be above `nav` so the panel and its
   *  sticky close bar rest on the nav's top edge rather than under it. */
  sheet: 4000,
  /** First-load onboarding coach-mark (ScreenGuide). Above sheets and the nav
   *  because it teaches nav position by drawing a mirrored nav of its own. */
  guide: 4500,
} as const

export type ZLayer = keyof typeof Z_LAYERS
