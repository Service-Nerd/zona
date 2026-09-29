'use client'

// DASHBOARD-SCREEN-EXTRACT-02 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14k-line file, so it closed over nothing and this
// move changes no behaviour. What it changes is REACH: nothing could import it, so it
// could not be rendered by a harness or a mounting test.
//
// ⚠️ The body is UNCHANGED. Edit it in a separate commit so the move stays a move.


export default function IconMe({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text-muted)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke={c} strokeWidth="1.2" />
      <path d="M4 19c0-3.866 3.134-7 7-7h.5c3.866 0 7 3.134 7 7" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
