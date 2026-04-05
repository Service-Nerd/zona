'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Plan, Week } from '@/types/plan'
import PlanGrid from '@/components/training/PlanGrid'
import PlanChart from '@/components/training/PlanChart'
import WeekBriefing from '@/components/training/WeekBriefing'
import StravaPanel from '@/components/strava/StravaPanel'

interface Props { plan: Plan; currentWeek: Week }

type Screen = 'today' | 'plan' | 'coach' | 'strava'

const QUIT_DATE = new Date('2026-04-03T00:00:00')

// ── Icons ─────────────────────────────────────────────────────────────────

function IconToday({ active }: { active: boolean }) {
  const c = active ? '#E05A1C' : '#777'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  )
}

function IconPlan({ active }: { active: boolean }) {
  const c = active ? '#E05A1C' : '#777'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="3" width="16" height="16" rx="2" stroke={c} strokeWidth="1.2" />
      <line x1="7" y1="1" x2="7" y2="5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="15" y1="1" x2="15" y2="5" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3" y1="8" x2="19" y2="8" stroke={c} strokeWidth="1.2" />
    </svg>
  )
}

function IconCoach({ active }: { active: boolean }) {
  const c = active ? '#E05A1C' : '#777'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke={c} strokeWidth="1.2" />
      <path d="M4 19c0-3.866 3.134-7 7-7h.5c3.866 0 7 3.134 7 7" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="15" y1="4" x2="18" y2="1" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="1" x2="18" y2="3" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function IconStrava({ active }: { active: boolean }) {
  const c = active ? '#E05A1C' : '#777'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.2" />
      <polyline points="11,7 11,11 14,13" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Layout shell ──────────────────────────────────────────────────────────

export default function DashboardClient({ plan, currentWeek }: Props) {
  const [screen, setScreen] = useState<Screen>('today')
  const [showMe, setShowMe] = useState(false)
  const [quitDays, setQuitDays] = useState(1)
  const [resetPhrase, setResetPhrase] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('dark')

  // Derive user initials from athlete name
  const initials = (plan.meta.athlete ?? 'RS')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  useEffect(() => {
    const days = Math.max(1, Math.floor((Date.now() - QUIT_DATE.getTime()) / 86400000))
    setQuitDays(days)
    try {
      const p = localStorage.getItem('rts_phrase'); if (p) setResetPhrase(p)
      const t = localStorage.getItem('rts_theme') as 'dark' | 'light' | 'auto' | null
      if (t) { setTheme(t); applyTheme(t) }
    } catch {}
  }, [])

  function saveMental(val: string) {
    setResetPhrase(val)
    try { localStorage.setItem('rts_phrase', val) } catch {}
  }

  function saveTheme(t: 'dark' | 'light' | 'auto') {
    setTheme(t)
    applyTheme(t)
    try { localStorage.setItem('rts_theme', t) } catch {}
  }

  function applyTheme(t: 'dark' | 'light' | 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = t === 'dark' || (t === 'auto' && prefersDark)
    const root = document.documentElement
    if (isDark) {
      root.style.setProperty('--bg', '#111')
      root.style.setProperty('--card-bg', '#1a1a1a')
      root.style.setProperty('--border-col', '#2a2a2a')
      root.style.setProperty('--text-primary', '#fff')
      root.style.setProperty('--text-secondary', '#ccc')
      root.style.setProperty('--text-muted', '#777')
      root.style.setProperty('--nav-bg', '#161616')
    } else {
      root.style.setProperty('--bg', '#f4f4f0')
      root.style.setProperty('--card-bg', '#fff')
      root.style.setProperty('--border-col', '#e0e0d8')
      root.style.setProperty('--text-primary', '#111')
      root.style.setProperty('--text-secondary', '#333')
      root.style.setProperty('--text-muted', '#999')
      root.style.setProperty('--nav-bg', '#fff')
    }
  }

  // Days to race
  const raceDate = new Date('2026-07-11')
  const fiftyKDate = new Date('2026-05-10')
  const now = new Date()
  const daysToRace = Math.max(0, Math.ceil((raceDate.getTime() - now.getTime()) / 86400000))
  const daysTo50k = Math.max(0, Math.ceil((fiftyKDate.getTime() - now.getTime()) / 86400000))

  const s: React.CSSProperties = {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg, #111)',
    maxWidth: '480px',
    margin: '0 auto',
    position: 'relative',
  }

  return (
    <div style={s}>
      {/* Me overlay */}
      {showMe && (
        <MeScreen
          initials={initials}
          athlete={plan.meta.athlete ?? 'Russell Shear'}
          quitDays={quitDays}
          resetPhrase={resetPhrase}
          onSaveMental={saveMental}
          theme={theme}
          onThemeChange={saveTheme}
          onClose={() => setShowMe(false)}
        />
      )}

      {/* Main content area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {screen === 'today'  && <TodayScreen plan={plan} currentWeek={currentWeek} quitDays={quitDays} daysToRace={daysToRace} daysTo50k={daysTo50k} onOpenMe={() => setShowMe(true)} initials={initials} />}
        {screen === 'plan'   && <PlanScreen plan={plan} onOpenMe={() => setShowMe(true)} initials={initials} />}
        {screen === 'coach'  && <CoachScreen plan={plan} currentWeek={currentWeek} onOpenMe={() => setShowMe(true)} initials={initials} />}
        {screen === 'strava' && <StravaScreen onOpenMe={() => setShowMe(true)} initials={initials} />}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px',
        display: 'flex', alignItems: 'center',
        background: 'var(--nav-bg, #161616)', borderTop: '0.5px solid var(--border-col, #2a2a2a)',
        padding: '10px 0 max(16px, env(safe-area-inset-bottom))',
        zIndex: 100,
      }}>
        {(['today', 'plan', 'coach', 'strava'] as Screen[]).map(id => {
          const labels: Record<Screen, string> = { today: 'Today', plan: 'Plan', coach: 'Coach', strava: 'Strava' }
          const active = screen === id
          return (
            <button key={id} onClick={() => setScreen(id)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            }}>
              {id === 'today'  && <IconToday  active={active} />}
              {id === 'plan'   && <IconPlan   active={active} />}
              {id === 'coach'  && <IconCoach  active={active} />}
              {id === 'strava' && <IconStrava active={active} />}
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: active ? '#E05A1C' : '#777' }}>
                {labels[id]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Shared header ─────────────────────────────────────────────────────────

function ScreenHeader({ title, sub, initials, onOpenMe }: { title: string; sub?: string; initials: string; onOpenMe: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 16px 8px' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--white)', fontFamily: "'DM Sans',sans-serif", letterSpacing: '-0.3px' }}>{title}</div>
        {sub && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#777', marginTop: '2px' }}>{sub}</div>}
      </div>
      <button onClick={onOpenMe} style={{
        width: '34px', height: '34px', borderRadius: '50%', background: '#E05A1C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono',monospace", fontSize: '12px', fontWeight: 500, color: '#fff',
        border: 'none', cursor: 'pointer', flexShrink: 0,
      }}>
        {initials}
      </button>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#777', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 16px', marginBottom: '6px', marginTop: '4px' }}>
      {children}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--card-bg, #1a1a1a)', borderRadius: '16px', border: '0.5px solid var(--border-col, #2a2a2a)', margin: '0 12px', ...style }}>
      {children}
    </div>
  )
}

// ── TODAY SCREEN ──────────────────────────────────────────────────────────

function TodayScreen({ plan, currentWeek, quitDays, daysToRace, daysTo50k, onOpenMe, initials }: {
  plan: Plan; currentWeek: Week; quitDays: number; daysToRace: number; daysTo50k: number; onOpenMe: () => void; initials: string
}) {
  const weekNum = plan.weeks.findIndex(w => w.type === 'current') + 1
  const totalWeeks = plan.weeks.length
  const doneKm = 0 // TODO: wire from Strava
  const targetKm = currentWeek.weekly_km ?? 0
  const progress = targetKm > 0 ? Math.min(1, doneKm / targetKm) : 0

  // Determine today's day of week
  const now = new Date()
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]

  // Get the week start date from the plan
  const weekStartDate = new Date((currentWeek as any).date ?? now)

  // Calculate actual dates for each session day
  function getSessionDate(dayKey: string): string {
    const dayOffsets: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
    const offset = dayOffsets[dayKey] ?? 0
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + offset)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  // Derive sessions from nested sessions object
  const ws = (currentWeek as any).sessions ?? {}
  const sessions = [
    { day: 'Tue', key: 'tue', title: ws.tue?.label ?? 'Easy aerobic', detail: ws.tue?.detail ?? 'Z2 · HR cap' },
    { day: 'Thu', key: 'thu', title: ws.thu?.label ?? 'Quality run',  detail: ws.thu?.detail ?? 'See plan' },
    { day: 'Sat', key: 'sat', title: ws.sat?.label ?? 'Long run',     detail: ws.sat?.detail ?? 'Z2 · easy' },
  ].map(sess => ({
    ...sess,
    date: getSessionDate(sess.key),
    today: sess.key === todayDow,
    done: false, // TODO: wire from Strava
  }))

  // Week label and theme from plan data
  const weekLabel = (currentWeek as any).label ?? 'Build phase'
  const weekTheme = (currentWeek as any).theme ?? 'Aerobic base + consistency'

  return (
    <div style={{ paddingBottom: '8px' }}>
      <ScreenHeader title="Today" sub={`W${weekNum} · ${daysToRace} days to go`} initials={initials} onOpenMe={onOpenMe} />

      {/* Week hero */}
      <div style={{ margin: '0 12px 10px' }}>
        <Card style={{ padding: '14px 16px', margin: 0 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#E05A1C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Week {weekNum} — {weekLabel}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 500, color: '#fff', marginBottom: '8px' }}>
            {weekTheme}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <span style={{ background: '#252525', borderRadius: '20px', padding: '4px 10px', fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#aaa' }}>
              <span style={{ color: '#E05A1C' }}>{targetKm}</span> km target
            </span>
            <span style={{ background: '#252525', borderRadius: '20px', padding: '4px 10px', fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#aaa' }}>
              <span style={{ color: '#E05A1C' }}>{sessions.length}</span> sessions
            </span>
          </div>
          <div style={{ background: '#252525', borderRadius: '4px', height: '4px', overflow: 'hidden' }}>
            <div style={{ background: '#E05A1C', height: '4px', width: `${Math.round(progress * 100)}%`, borderRadius: '4px' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#777' }}>{doneKm}km done</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#777' }}>{targetKm}km target</span>
          </div>
        </Card>
      </div>

      {/* Sessions */}
      <SectionLabel>This week's sessions</SectionLabel>
      <div style={{ display: 'flex', gap: '8px', padding: '0 12px', marginBottom: '10px' }}>
        {sessions.map((s, i) => (
          <div key={i} style={{
            flex: 1, background: '#1a1a1a', borderRadius: '12px', padding: '12px 10px',
            border: `0.5px solid ${s.today ? '#E05A1C' : '#2a2a2a'}`,
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.done ? '#3a7a3a' : s.today ? '#E05A1C' : '#333', marginBottom: '8px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '9px', color: s.today ? '#E05A1C' : '#777', textTransform: 'uppercase' }}>
                {s.day}{s.today ? ' · Today' : ''}
              </span>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '9px', color: '#666' }}>
                {s.date}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#ddd', fontWeight: 500, marginBottom: '4px', lineHeight: 1.3 }}>{s.title}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#666' }}>{s.detail}</div>
          </div>
        ))}
      </div>

      {/* Stats strip */}
      <SectionLabel>Race countdown</SectionLabel>
      <div style={{ display: 'flex', gap: '8px', padding: '0 12px', marginBottom: '10px' }}>
        {[
          { num: String(daysToRace), unit: 'days', label: 'To RTS 100k' },
          { num: String(daysTo50k), unit: 'days', label: 'To 50k' },
          { num: String(quitDays),  unit: 'days', label: 'Smoke-free' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: '#1a1a1a', borderRadius: '12px', padding: '10px 12px', border: '0.5px solid #2a2a2a' }}>
            <div>
              <span style={{ fontSize: '20px', color: '#fff', fontWeight: 500 }}>{s.num}</span>
              <span style={{ fontSize: '11px', color: '#E05A1C', fontWeight: 500 }}> {s.unit}</span>
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#777', marginTop: '2px', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Strava hook */}
      <SectionLabel>Latest activity</SectionLabel>
      <Card style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FC4C02' }} />
          <div>
            <div style={{ fontSize: '13px', color: '#ddd', fontWeight: 500 }}>Strava</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#666', marginTop: '1px' }}>View in Strava tab</div>
          </div>
        </div>
        <div style={{ color: '#666', fontSize: '18px' }}>›</div>
      </Card>
    </div>
  )
}

// ── PLAN SCREEN ───────────────────────────────────────────────────────────

function PlanScreen({ plan, onOpenMe, initials }: { plan: Plan; onOpenMe: () => void; initials: string }) {
  return (
    <div>
      <ScreenHeader title="Plan" sub="Race to the Stones · 11 Jul 2026" initials={initials} onOpenMe={onOpenMe} />
      <div style={{ padding: '0 12px' }}>
        <PlanChart weeks={plan.weeks} />
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: '#777', margin: '8px 0 12px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
          <span>MIDWEEK: 2× Zone 2 · STRENGTH: Mon/Wed · SAT: long run</span>
          <span style={{ color: '#666' }}>v{plan.meta.version} · {plan.meta.last_updated}</span>
        </div>
        <PlanGrid weeks={plan.weeks} />
      </div>
    </div>
  )
}

// ── COACH SCREEN ──────────────────────────────────────────────────────────

function CoachScreen({ plan, currentWeek, onOpenMe, initials }: { plan: Plan; currentWeek: Week; onOpenMe: () => void; initials: string }) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastActivityId, setLastActivityId] = useState<string | null>(null)
  const [cachedActivityId, setCachedActivityId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load cached analysis + last activity ID from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem('rts_coach_analysis')
      const cachedId = localStorage.getItem('rts_coach_activity_id')
      if (cached) setAnalysis(cached)
      if (cachedId) setCachedActivityId(cachedId)
    } catch {}
  }, [])

  // Fetch latest Strava activity ID
  useEffect(() => {
    async function fetchLatestActivity() {
      try {
        const res = await fetch('/api/strava/latest-activity')
        if (res.ok) {
          const data = await res.json()
          if (data.id) setLastActivityId(String(data.id))
        }
      } catch {}
    }
    fetchLatestActivity()
  }, [])

  // Auto-generate if new activity detected
  useEffect(() => {
    if (lastActivityId && lastActivityId !== cachedActivityId && !loading) {
      generateAnalysis()
    }
  }, [lastActivityId, cachedActivityId])

  const weekNum = plan.weeks.findIndex(w => w.type === 'current') + 1
  const totalWeeks = plan.weeks.length

  async function generateAnalysis() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/coach/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week: weekNum,
          totalWeeks,
          currentWeek,
          activityId: lastActivityId,
        }),
      })
      if (!res.ok) throw new Error('Failed to generate analysis')
      const data = await res.json()
      setAnalysis(data.analysis)
      setCachedActivityId(lastActivityId)
      try {
        localStorage.setItem('rts_coach_analysis', data.analysis)
        if (lastActivityId) localStorage.setItem('rts_coach_activity_id', lastActivityId)
      } catch {}
    } catch (e) {
      setError('Could not generate analysis. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const isNew = lastActivityId && lastActivityId !== cachedActivityId

  return (
    <div>
      <ScreenHeader title="Coach" sub={`W${weekNum} · Build phase`} initials={initials} onOpenMe={onOpenMe} />
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Activity pill */}
        <div style={{ background: '#1a1a1a', borderRadius: '10px', padding: '9px 12px', border: '0.5px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FC4C02' }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#aaa' }}>
              {loading ? 'New activity detected · analysing...' : isNew ? 'New Strava activity' : 'Latest Strava activity'}
            </span>
          </div>
          {isNew && !loading && (
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#E05A1C', background: 'rgba(224,90,28,0.1)', padding: '2px 8px', borderRadius: '20px' }}>new</span>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <>
            <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '0.5px solid #2a2a2a', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#2a2a2a" strokeWidth="2" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#E05A1C" strokeWidth="2" strokeDasharray="40 60" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite" />
                </circle>
              </svg>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#777', textAlign: 'center', lineHeight: 1.6 }}>
                Reading your latest run<br />and plan position...
              </p>
            </div>
            {/* Skeleton */}
            <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '0.5px solid #2a2a2a', padding: '14px' }}>
              {[85, 100, 70, 90].map((w, i) => (
                <div key={i} style={{ height: '10px', background: '#252525', borderRadius: '4px', marginBottom: i < 3 ? '8px' : 0, width: `${w}%` }} />
              ))}
            </div>
          </>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '0.5px solid #2a2a2a', padding: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#E05A1C', marginBottom: '8px' }}>Error</div>
            <div style={{ fontSize: '13px', color: '#888' }}>{error}</div>
            <button onClick={generateAnalysis} style={{ marginTop: '12px', fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#E05A1C', background: 'rgba(224,90,28,0.1)', border: 'none', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        )}

        {/* Analysis */}
        {analysis && !loading && (
          <>
            <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '0.5px solid #2a2a2a', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid #222', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#E05A1C' }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#666', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Plan position</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#666' }}>W{weekNum}/{totalWeeks}</span>
              </div>
              <div style={{ padding: '14px' }}>
                {analysis.split('\n\n').map((para, i) => (
                  <p key={i} style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.65, marginTop: i > 0 ? '10px' : 0 }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>

            {!isNew && (
              <button onClick={generateAnalysis} style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#777', background: 'none', border: '0.5px solid #2a2a2a', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer', alignSelf: 'center' }}>
                Refresh analysis
              </button>
            )}
          </>
        )}

        {/* Empty state — no analysis yet, no new activity */}
        {!analysis && !loading && !error && (
          <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '0.5px solid #2a2a2a', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#777', lineHeight: 1.6 }}>
              Waiting for a Strava activity<br />to generate your coaching notes.
            </div>
            <button onClick={generateAnalysis} style={{ marginTop: '16px', fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#E05A1C', background: 'rgba(224,90,28,0.1)', border: 'none', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer' }}>
              Generate now
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── STRAVA SCREEN ─────────────────────────────────────────────────────────

function StravaScreen({ onOpenMe, initials }: { onOpenMe: () => void; initials: string }) {
  return (
    <div>
      <ScreenHeader title="Strava" sub="Activity feed" initials={initials} onOpenMe={onOpenMe} />
      <div style={{ padding: '0 12px' }}>
        <StravaPanel />
      </div>
    </div>
  )
}

// ── ME SCREEN (overlay) ───────────────────────────────────────────────────

function MeScreen({ initials, athlete, quitDays, resetPhrase, onSaveMental, theme, onThemeChange, onClose }: {
  initials: string; athlete: string; quitDays: number; resetPhrase: string
  onSaveMental: (v: string) => void; theme: 'dark' | 'light' | 'auto'
  onThemeChange: (t: 'dark' | 'light' | 'auto') => void; onClose: () => void
}) {
  const [activeSection, setActiveSection] = useState<'main' | 'quit' | 'mental' | 'fueling'>('main')

  if (activeSection === 'quit')    return <QuitTab    quitDays={quitDays} onBack={() => setActiveSection('main')} />
  if (activeSection === 'mental')  return <MentalTab  resetPhrase={resetPhrase} onSave={onSaveMental} onBack={() => setActiveSection('main')} />
  if (activeSection === 'fueling') return <FuelingTab onBack={() => setActiveSection('main')} />

  const raceDate = new Date('2026-07-11')
  const daysToRace = Math.max(0, Math.ceil((raceDate.getTime() - Date.now()) / 86400000))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg, #111)', overflowY: 'auto', maxWidth: '480px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 16px 8px' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 500, color: '#fff', fontFamily: "'DM Sans',sans-serif" }}>Me</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#777', marginTop: '2px' }}>@doinghardthingsbadly</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', fontSize: '22px', cursor: 'pointer', padding: '4px' }}>✕</button>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '10px', paddingBottom: '32px' }}>

        {/* Profile card */}
        <div style={{ background: '#1a1a1a', borderRadius: '16px', padding: '14px 16px', border: '0.5px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#E05A1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '15px', fontWeight: 500, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '15px', color: '#fff', fontWeight: 500 }}>{athlete}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#777', marginTop: '2px' }}>Berkshire, UK</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#E05A1C', marginTop: '4px' }}>Race to the Stones · {daysToRace} days</div>
          </div>
        </div>

        {/* Appearance */}
        <SectionLabel>Appearance</SectionLabel>
        <div style={{ background: '#1a1a1a', borderRadius: '14px', border: '0.5px solid #2a2a2a', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px' }}>
            <div style={{ fontSize: '13px', color: '#ccc' }}>Theme</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['dark', 'light', 'auto'] as const).map(t => (
                <button key={t} onClick={() => onThemeChange(t)} style={{
                  borderRadius: '10px', padding: '6px 10px', border: `0.5px solid ${theme === t ? '#E05A1C' : '#333'}`,
                  background: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '10px',
                  color: theme === t ? '#E05A1C' : '#666', textTransform: 'capitalize',
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Connections */}
        <SectionLabel>Connections</SectionLabel>
        <div style={{ background: '#1a1a1a', borderRadius: '14px', border: '0.5px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(252,76,2,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FC4C02' }} />
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#ccc' }}>Strava</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#777', marginTop: '1px' }}>Client secret + OAuth</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5a5' }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color: '#5a5' }}>connected</span>
            </div>
          </div>
        </div>

        {/* Training support */}
        <SectionLabel>Training support</SectionLabel>
        <div style={{ background: '#1a1a1a', borderRadius: '14px', border: '0.5px solid #2a2a2a', overflow: 'hidden' }}>
          {[
            { id: 'quit' as const,    label: 'Quit tracker',    sub: `${quitDays} days smoke-free`,      color: '#5a5' },
            { id: 'mental' as const,  label: 'Mental toolkit',  sub: 'Race mantras + strategies',         color: '#378ADD' },
            { id: 'fueling' as const, label: 'Fueling plan',    sub: 'Gel strategy + hydration',          color: '#E05A1C' },
          ].map(({ id, label, sub, color }, i, arr) => (
            <button key={id} onClick={() => setActiveSection(id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '13px 14px', background: 'none', border: 'none',
              borderBottom: i < arr.length - 1 ? '0.5px solid #222' : 'none', cursor: 'pointer',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: '#ccc' }}>{label}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '11px', color, marginTop: '1px' }}>{sub}</div>
              </div>
              <div style={{ color: '#666', fontSize: '18px' }}>›</div>
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}

// ── SUPPORT SCREENS ───────────────────────────────────────────────────────

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#E05A1C', fontSize: '18px', cursor: 'pointer', padding: '0' }}>‹</button>
      <div style={{ fontSize: '20px', fontWeight: 500, color: '#fff', fontFamily: "'DM Sans',sans-serif" }}>{title}</div>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '16px 18px', fontSize: '13px', lineHeight: 1.75, color: '#888', marginBottom: '10px' }}>
      {children}
    </div>
  )
}

function MentalTab({ resetPhrase, onSave, onBack }: { resetPhrase: string; onSave: (v: string) => void; onBack: () => void }) {
  const tools = [
    { title: 'The Box',          text: "Don't think about 100km. Next checkpoint only. That's your entire world. Shrink it right down and stay in it." },
    { title: 'The Reset Phrase', text: 'Pick one phrase now, before race day. Short. Yours. Use it the moment the voice starts. Write it below.' },
    { title: 'Feeling ≠ Fact',   text: '"I can\'t do this" is a feeling. Not information. Your legs are still moving — that\'s information. It passes.' },
    { title: 'The Fuel Check',   text: '80% of dark patches are underfueling in a trench coat. Before you spiral, eat something. Wait 8 minutes.' },
    { title: 'The Why Card',     text: 'Make-A-Wish. When you want to stop, think about why you started. That one doesn\'t move when everything else does.' },
    { title: 'Walk = Strategy',  text: 'The elites walk the uphills at RTTS. Walking a climb at km 72 is a tactic, not a failure.' },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#111', overflowY: 'auto', maxWidth: '480px', margin: '0 auto' }}>
      <BackHeader title="Mental toolkit" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          The dark patch is coming. Probably around <span style={{ color: '#E05A1C' }}>km 65–75</span>. It's not a sign you're broken — it's a sign you've been going long enough to feel something real.
        </InfoBox>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {tools.map(t => (
            <div key={t.title} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', letterSpacing: '0.05em', color: '#E05A1C', marginBottom: '6px', textTransform: 'uppercase' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: '#888', lineHeight: 1.6 }}>{t.text}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#E05A1C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your Reset Phrase</div>
          <textarea value={resetPhrase} onChange={e => onSave(e.target.value)} placeholder="What's the phrase you'll use when it gets dark at km 70?" style={{ width: '100%', background: 'transparent', border: 'none', color: '#ccc', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', lineHeight: 1.7, resize: 'vertical', minHeight: '60px', outline: 'none' }} />
        </div>
      </div>
    </div>
  )
}

function FuelingTab({ onBack }: { onBack: () => void }) {
  const protocol = [
    { timing: 'Pre-run · 90 min before', what: 'Porridge + banana + coffee',       why: "Slow carbs, familiar, not ambitious. Don't experiment on race morning." },
    { timing: '0–60 minutes',            what: 'Water only',                         why: "Glycogen tanks are full. Let your body warm up before fueling." },
    { timing: 'Every 45 min after',      what: '1 gel OR real food',                 why: '~60g carbs/hr target. Alternate to avoid sweet fatigue.' },
    { timing: 'Every 20–30 min',         what: 'Small sips — water or electrolyte',  why: "Don't wait for thirst. By then you're already behind." },
    { timing: 'Hour 3+',                 what: 'Salty real food',                    why: 'Pretzels, nuts, cheese. Sweet fatigue is real.' },
    { timing: 'Aid stations',            what: 'Eat at every single one',            why: "You'll never regret eating at a checkpoint. You will regret skipping one." },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#111', overflowY: 'auto', maxWidth: '480px', margin: '0 auto' }}>
      <BackHeader title="Fueling plan" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          Real food + gels is the right call. The goal now is <span style={{ color: '#E05A1C' }}>stress-testing your gut before June</span> so there are zero surprises on race day.
        </InfoBox>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {protocol.map(p => (
            <div key={p.timing} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#E05A1C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{p.timing}</div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#ddd', marginBottom: '4px' }}>{p.what}</div>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.55 }}>{p.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuitTab({ quitDays, onBack }: { quitDays: number; onBack: () => void }) {
  const milestones = [
    { days: 3,  label: 'Day 3 — Nicotine clearing' },
    { days: 7,  label: 'Week 1' },
    { days: 14, label: 'Day 14 — Habit breaking' },
    { days: 30, label: 'Day 30 — Lung function' },
    { days: 99, label: 'Race Day — Job done' },
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#111', overflowY: 'auto', maxWidth: '480px', margin: '0 auto' }}>
      <BackHeader title="Quit tracker" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <div style={{ background: '#1a1a1a', border: '0.5px solid #2a5a2a', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '3.5rem', color: '#5a5', lineHeight: 1 }}>{quitDays}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#5a5', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>Smoke-free days</div>
            <div style={{ fontSize: '13px', color: '#888', lineHeight: 1.55 }}>Started 3 April 2026. Your aerobic efficiency is already improving.</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
              {milestones.map(m => (
                <div key={m.days} style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', padding: '3px 10px', borderRadius: '20px', border: `0.5px solid ${quitDays >= m.days ? '#5a5' : '#333'}`, color: quitDays >= m.days ? '#5a5' : '#666' }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <InfoBox>
          <strong style={{ color: '#ddd' }}>What quitting does to your running:</strong><br /><br />
          <span style={{ color: '#E05A1C' }}>48 hours</span> — CO leaves bloodstream. O₂ delivery improves immediately.<br />
          <span style={{ color: '#E05A1C' }}>Week 1–2</span> — Resting HR starts dropping. Recovery improves noticeably.<br />
          <span style={{ color: '#E05A1C' }}>Week 3–4</span> — Aerobic efficiency measurably better. Zone 2 feels easier.<br />
          <span style={{ color: '#E05A1C' }}>Month 2+</span> — Cardiac drift reduces. That late-run HR creep? Less of it.<br /><br />
          <strong style={{ color: '#ddd' }}>You quit 99 days before a 100km race. That's an upgrade.</strong>
        </InfoBox>
      </div>
    </div>
  )
}
