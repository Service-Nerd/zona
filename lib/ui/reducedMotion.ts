/**
 * `prefers-reduced-motion`, asked once.
 *
 * 🧭 `A11Y-REDUCED-MOTION-01`. The CSS half has had one owner since DESIGN-V3 — the six motion
 * tokens collapse in a single `@media` block in `globals.css`, *"so a component that uses them
 * cannot forget"*. **The JS half was written out by hand three times** (`Sheet`, `PullToRefresh`,
 * `HeroTrace`), each with slightly different guards, and a fourth animation had no check at all:
 * `useCountUp` in `TrendCard` drove a 600 ms ease-out cubic on the Coach trend numbers for
 * everybody, whatever the runner had told their phone.
 *
 * ⚠️ THE ITEM'S PREMISE WAS PARTLY WRONG and the measurement is worth keeping: *"animations
 * ignore `prefers-reduced-motion`"* is true of exactly one animation. Three honoured it already.
 * What was missing was the owner, which is why the fourth could be written without one.
 *
 * ⚠️ SSR AND OLD WEBVIEWS. `window` is absent on the server and `matchMedia` is absent in some
 * embedded webviews, so both are checked. **The default when it cannot be determined is FALSE —
 * animate.** That is the safe direction here: a runner who has not expressed a preference gets
 * the designed motion, and one who has is on a browser that implements the query.
 *
 * ⚠️ READ AT THE MOMENT OF USE, NEVER CACHED AT MODULE SCOPE. The preference can change while
 * the app is open (iOS Settings → Accessibility → Motion), and a module-level constant would
 * freeze whatever was true when the bundle loaded.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
