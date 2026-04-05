export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #111)' }}>
      <main style={{ margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
