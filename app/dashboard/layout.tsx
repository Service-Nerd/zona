

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
 

  const RACE_DATE = new Date('2026-07-11T07:00:00')
  const daysLeft  = Math.max(0, Math.ceil((RACE_DATE.getTime() - Date.now()) / 86400000))

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        background: 'var(--off-black)',
        borderBottom: '2px solid var(--orange)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.7rem', color: 'var(--orange)', letterSpacing: '0.05em', lineHeight: 1 }}>
            @doinghardthingsbadly
          </div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '2px' }}>
            Race to the Stones · Training Hub · 2026
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '2.8rem', color: 'var(--orange)', lineHeight: 1, textShadow: '0 0 30px rgba(255,107,26,0.35)' }}>
              {daysLeft}
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Days to Race Day
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 12px', cursor: 'pointer' }}>
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
        {children}
      </main>
    </div>
  )
}
