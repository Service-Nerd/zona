// CHEVRON-OWNER-01 (2026-09-28) — the one chevron, finally reachable.
//
// 🔴 THIS IS ACTION-ROW-01's OWN LESSON, FINISHED. That ruling's comment says:
//
//   "⚠️ A PATTERN THAT IS A LOCAL VARIABLE CANNOT TRAVEL. That is the whole finding. The
//    shape was already agreed and already rendering correctly in one place; nothing was
//    available to reuse, so the second surface re-implemented it from memory and lost the
//    part that makes it legible as a control."
//
// It was written because the chevron was a local `const` inside the Me screen and the Plan
// screen could not reach it. The remedy moved it into `ActionRow.tsx` — **as a local
// `const` inside `ActionRow.tsx`.** One level up, same trap.
//
// ⚠️ SO IT HAPPENED AGAIN, AND THE FOUNDER CAUGHT IT AGAIN, in the same words:
// *"the zones section in the what kit knows about you isn't obvious its clickable. Don't
// we have a pattern for that already?"* We did. It was unreachable.
//
// `DashboardClient`'s compact label/value `row()` helper renders a `<button>` when given an
// `onTap` and styles it **identically to the static version** — no chevron, no affordance.
// Five rows shipped that way, including `Benchmark`, which predates this ruling entirely.
//
// ⚠️ IT IS NOT `ActionRow`'s JOB TO BE THE ONLY HOME. `ActionRow` is title + subtitle +
// chevron; `row()` is label + value + state dot. Two legitimate row shapes, one affordance.
// The affordance is what has to be shared, not the row.

/**
 * The "this is a control" mark. `currentColor`, so the caller owns the colour.
 *
 * ⚠️ `aria-hidden` on purpose: it is decoration on something that is already a `<button>`
 * with a real label. Announcing "chevron" adds nothing a screen reader needs.
 */
export function Chevron({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none"
      style={{ flexShrink: 0 }} aria-hidden="true">
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
