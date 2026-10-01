// HOOK-RGBA-COMMENTS-01 — the ground below read `var(--bg, #111)`, a DARK-MODE
// FALLBACK. `--bg` is #F3F0EB, warm off-white, and ADR-008 removed dark mode:
// had that fallback ever fired, the dashboard would have rendered near-black,
// the opposite of the single light theme.
//
// ⚠️ It was the ONLY live hardcoded hex in `app/` or `components/` outside the
// OG routes, and it survived because the pre-commit colour guard reads STAGED
// files only and nothing had touched this one for months. **A guard scoped to
// the diff cannot see the tree.**
//
// No fallback now: `globals.css` is the token authority (ADR-007) and a
// component must not carry a second copy of the ground colour.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <main style={{ margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
