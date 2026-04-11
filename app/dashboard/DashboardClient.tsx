'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Plan, Week } from '@/types/plan'
import PlanChart from '@/components/training/PlanChart'
import PlanCalendar from '@/components/training/PlanCalendar'
import StravaPanel from '@/components/strava/StravaPanel'
import { createClient } from '@/lib/supabase/client'

interface Props { plan: Plan; currentWeek: Week }

type Screen = 'today' | 'plan' | 'coach' | 'strava' | 'me' | 'calendar' | 'session'

// ── Icons ─────────────────────────────────────────────────────────────────

function IconToday({ active }: { active: boolean }) {
  const c = active ? '#E05A1C' : '#999'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  )
}

function IconPlan({ active }: { active: boolean }) {
  const c = active ? '#E05A1C' : '#999'
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
  const c = active ? '#E05A1C' : '#999'
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
  const c = active ? '#E05A1C' : '#999'
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
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null)
  const [quitDays, setQuitDays] = useState<number | null>(null)
  const [smokeTrackerEnabled, setSmokeTrackerEnabled] = useState(false)
  const [quitDate, setQuitDate] = useState<string>('')
  const [resetPhrase, setResetPhrase] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('light')
  const [appReady, setAppReady] = useState(false)

  // Global overrides — fetched once, shared across all screens
  const [allOverrides, setAllOverrides] = useState<{ week_n: number; original_day: string; new_day: string }[]>([])
  const [overridesReady, setOverridesReady] = useState(false)

  // All completions — fetched once at top level, refreshed on save
  const [allCompletions, setAllCompletions] = useState<Record<number, Record<string, any>>>({})

  const [stravaRuns, setStravaRuns] = useState<any[] | null>(null)
  const [stravaLoading, setStravaLoading] = useState(true)
  const [stravaConnected, setStravaConnected] = useState(false)
  const supabase = createClient()

  const CLIENT_ID     = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID!
  const REFRESH_TOKEN = 'b2332fbde9c23d072e4e7712afc9d5b06e253fed'

  const initials = (plan.meta.athlete ?? 'RS')
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  useEffect(() => {
    try {
      const p = localStorage.getItem('rts_phrase'); if (p) setResetPhrase(p)
      const t = localStorage.getItem('rts_theme') as 'dark' | 'light' | 'auto' | null
      if (t) { setTheme(t); applyTheme(t) } else { applyTheme('light') }
    } catch {}

    async function fetchSettings() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setStravaLoading(false); setOverridesReady(true); setAppReady(true); return }

        // Fetch overrides + user settings + completions in parallel
        const [settingsRes, overridesRes, completionsRes] = await Promise.all([
          supabase.from('user_settings').select('strava_client_secret, smoke_tracker_enabled, quit_date').eq('id', user.id).single(),
          supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id),
          supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, strava_activity_name').eq('user_id', user.id),
        ])

        if (overridesRes.data) setAllOverrides(overridesRes.data)
        if (completionsRes.data) {
          const map: Record<number, Record<string, any>> = {}
          completionsRes.data.forEach((r: any) => {
            if (!map[r.week_n]) map[r.week_n] = {}
            map[r.week_n][r.session_day] = r
          })
          setAllCompletions(map)
        }
        setOverridesReady(true)
        setAppReady(true)

        const data = settingsRes.data

        if (data?.smoke_tracker_enabled && data?.quit_date) {
          setSmokeTrackerEnabled(true)
          setQuitDate(data.quit_date)
          const days = Math.max(0, Math.floor((Date.now() - new Date(data.quit_date).getTime()) / 86400000))
          setQuitDays(days)
        }

        if (!data?.strava_client_secret) { setStravaLoading(false); return }

        const tokenRes = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: data.strava_client_secret,
            refresh_token: REFRESH_TOKEN,
            grant_type: 'refresh_token',
          }),
        })
        const { access_token } = await tokenRes.json()
        if (!access_token) { setStravaLoading(false); return }

        const after = Math.floor(new Date('2026-01-01').getTime() / 1000)
        const actRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, {
          headers: { Authorization: `Bearer ${access_token}` },
        })
        const activities = await actRes.json()
        if (!Array.isArray(activities)) { setStravaLoading(false); return }

        const { getRuns } = await import('@/lib/strava')
        const runs = getRuns(activities)
        setStravaRuns(runs)
        setStravaConnected(true)
      } catch {}
      finally { setStravaLoading(false) }
    }
    fetchSettings()
  }, [])

  async function refreshCompletions() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('session_completions')
        .select('week_n, session_day, status, strava_activity_id, strava_activity_name')
        .eq('user_id', user.id)
      if (data) {
        const map: Record<number, Record<string, any>> = {}
        data.forEach((r: any) => {
          if (!map[r.week_n]) map[r.week_n] = {}
          map[r.week_n][r.session_day] = r
        })
        setAllCompletions(map)
      }
    } catch {}
  }

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
      root.style.setProperty('--bg', '#000')
      root.style.setProperty('--card-bg', '#0d0d0d')
      root.style.setProperty('--border-col', '#1c1c1c')
      root.style.setProperty('--text-primary', '#fff')
      root.style.setProperty('--text-secondary', '#c0c0c0')
      root.style.setProperty('--text-muted', '#777')
      root.style.setProperty('--nav-bg', '#000')
    } else {
      root.style.setProperty('--bg', '#f5f3ef')
      root.style.setProperty('--card-bg', '#fff')
      root.style.setProperty('--border-col', '#e8e3dc')
      root.style.setProperty('--text-primary', '#111')
      root.style.setProperty('--text-secondary', '#444')
      root.style.setProperty('--text-muted', '#888')
      root.style.setProperty('--nav-bg', '#f5f3ef')
    }
  }

  const currentWeekIndex = plan.weeks.findIndex(w => w.type === 'current')
  const [viewWeekIndex, setViewWeekIndex] = useState(currentWeekIndex >= 0 ? currentWeekIndex : 0)

  const raceDate = new Date('2026-07-11')
  const fiftyKDate = new Date('2026-05-10')
  const now = new Date()
  const daysToRace = Math.max(0, Math.ceil((raceDate.getTime() - now.getTime()) / 86400000))
  const daysTo50k = Math.max(0, Math.ceil((fiftyKDate.getTime() - now.getTime()) / 86400000))

  const s: React.CSSProperties = {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg, #f5f3ef)',
    maxWidth: '480px',
    margin: '0 auto',
    position: 'relative',
  }

  // Loading screen — shown until overrides + settings are fetched
  if (!appReady) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg, #f5f3ef)', maxWidth: '480px', margin: '0 auto',
      }}>
        <div style={{
          fontFamily: "'DM Mono', monospace", fontSize: '12px',
          color: '#D4501A', letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: '32px',
        }}>
          @doinghardthingsbadly
        </div>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <circle cx="14" cy="14" r="11" fill="none" stroke="#1c1c1c" strokeWidth="2" />
          <circle cx="14" cy="14" r="11" fill="none" stroke="#D4501A" strokeWidth="2"
            strokeDasharray="30 46" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate"
              from="0 14 14" to="360 14 14" dur="0.9s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>
    )
  }

  return (
    <div style={s}>
      {/* Me and Calendar rendered as screens below */}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {screen === 'today'    && <TodayScreen plan={plan} weekIndex={viewWeekIndex} onWeekChange={setViewWeekIndex} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} daysToRace={daysToRace} daysTo50k={daysTo50k} stravaRuns={stravaRuns ?? []} onOpenMe={() => setScreen('me')} initials={initials} allOverrides={allOverrides} overridesReady={overridesReady} onOpenCalendar={() => setScreen('calendar')} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} allCompletions={allCompletions} />}
        {screen === 'plan'     && <PlanScreen plan={plan} stravaRuns={stravaRuns ?? []} onOpenMe={() => setScreen('me')} initials={initials} allOverrides={allOverrides} onOverrideChange={setAllOverrides} onOpenCalendar={() => setScreen('calendar')} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} />}
        {screen === 'coach'    && <CoachScreen plan={plan} currentWeek={currentWeek} runs={stravaRuns} stravaLoading={stravaLoading} onOpenMe={() => setScreen('me')} initials={initials} />}
        {screen === 'strava'   && <StravaScreen runs={stravaRuns} loading={stravaLoading} connected={stravaConnected} onOpenMe={() => setScreen('me')} initials={initials} />}
        {screen === 'me'       && <MeScreen initials={initials} athlete={plan.meta.athlete ?? 'Russell Shear'} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} quitDate={quitDate} onSmokeTrackerChange={(enabled: boolean, date: string) => { setSmokeTrackerEnabled(enabled); setQuitDate(date); if (enabled && date) { const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)); setQuitDays(days) } else { setQuitDays(null) } }} resetPhrase={resetPhrase} onSaveMental={saveMental} theme={theme} onThemeChange={saveTheme} onBack={() => setScreen('today')} />}
        {screen === 'calendar' && <CalendarOverlay plan={plan} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} allCompletions={allCompletions} onBack={() => setScreen('today')} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} />}
        {screen === 'session'  && activeSessionData && <SessionScreen session={activeSessionData} preloadedRuns={stravaRuns ?? []} onBack={() => setScreen(activeSessionData.fromCalendar ? 'calendar' : 'today')} onSaved={refreshCompletions} />}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px',
        display: 'flex', alignItems: 'center',
        background: 'var(--nav-bg, #f5f3ef)', borderTop: '0.5px solid var(--border-col, #e8e3dc)',
        padding: '10px 0 max(16px, env(safe-area-inset-bottom))',
        zIndex: 1000,
      }}>
        {(['today', 'plan', 'coach', 'strava'] as Screen[]).map(id => {
          const labels: Record<Screen, string> = { today: 'Today', plan: 'Plan', coach: 'Coach', strava: 'Strava', me: 'Me', calendar: 'Calendar', session: 'Session' }
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
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: active ? '#E05A1C' : '#999' }}>
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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px 16px 8px' }}>
      <button onClick={onOpenMe} style={{
        width: '34px', height: '34px', borderRadius: '50%', background: '#D4501A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Mono',monospace", fontSize: '12px', fontWeight: 500, color: 'var(--text-primary, #111)',
        border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: '2px',
      }}>
        {initials}
      </button>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary, #111)', fontFamily: "'DM Sans',sans-serif", letterSpacing: '-0.3px' }}>{title}</div>
        {sub && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #777)', marginTop: '3px', letterSpacing: '0.04em' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #777)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 16px', marginBottom: '8px', marginTop: '20px' }}>
      {children}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', margin: '0 12px', ...style }}>
      {children}
    </div>
  )
}

// ── Dot / accent colours ──────────────────────────────────────────────────

const TYPE_DOT: Record<string, string> = {
  easy:     '#378ADD',
  quality:  '#D4501A',
  run:      '#D4501A',
  race:     '#ff7777',
  strength: '#4a9a5a',
  rest:     'transparent',
}

const TYPE_ACCENT: Record<string, string> = {
  easy:     '#378ADD',
  quality:  '#D4501A',
  run:      '#D4501A',
  race:     '#ff7777',
  strength: '#4a9a5a',
  rest:     '#555',
}

const TYPE_LABEL: Record<string, string> = {
  easy:     'Easy run — Zone 2',
  quality:  'Quality session',
  run:      'Long run',
  race:     'Race',
  strength: 'Strength',
  rest:     'Rest day',
}

// ── SESSION POPUP ─────────────────────────────────────────────────────────

function SessionPopupInner({ session, weekTheme, weekN, preloadedRuns, onClose, onSaved }: {
  session: any; weekTheme: string; weekN: number; preloadedRuns: any[]; onClose: () => void; onSaved?: () => void
}) {
  const [view, setView] = useState<'detail' | 'complete' | 'skip'>('detail')
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())
  const [loadingClaimed, setLoadingClaimed] = useState(false)
  const supabase = createClient()

  const isPast = session.isPast
  const completion = session.completion
  const isComplete = completion?.status === 'complete'
  const isSkipped = completion?.status === 'skipped'

  useEffect(() => {
    if (view !== 'complete') return
    async function loadClaimed() {
      setLoadingClaimed(true)
      try {
        const { data } = await supabase.from('session_completions').select('strava_activity_id').not('strava_activity_id', 'is', null)
        setClaimedIds(new Set((data ?? []).map((r: any) => r.strava_activity_id)))
      } catch {} finally { setLoadingClaimed(false) }
    }
    loadClaimed()
  }, [view])

  const stravaRuns = preloadedRuns.filter((r: any) => {
    if (claimedIds.has(r.id) && r.id !== completion?.strava_activity_id) return false
    const actDate = new Date(r.start_date)
    const today = new Date()
    if (session.rawDate) {
      const sessionDate = new Date(session.rawDate)
      if (sessionDate > today) {
        const fiveDaysAgo = new Date(today)
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
        return actDate >= fiveDaysAgo
      } else {
        const sessionEnd = new Date(sessionDate)
        sessionEnd.setHours(23, 59, 59, 999)
        const fiveDaysBefore = new Date(sessionDate)
        fiveDaysBefore.setDate(fiveDaysBefore.getDate() - 5)
        return actDate >= fiveDaysBefore && actDate <= sessionEnd
      }
    }
    const fiveDaysAgo = new Date(today)
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5)
    return actDate >= fiveDaysAgo
  })

  async function saveCompletion(status: 'complete' | 'skipped') {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('session_completions').upsert({
        user_id: user.id,
        week_n: weekN,
        session_day: session.key,
        status,
        strava_activity_id: status === 'complete' ? (selectedActivity?.id ?? null) : null,
        strava_activity_name: status === 'complete' ? (selectedActivity?.name ?? null) : null,
        strava_activity_km: status === 'complete' ? (selectedActivity ? +(selectedActivity.distance / 1000).toFixed(1) : null) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      onSaved?.()
      onClose()
    } catch {} finally { setSaving(false) }
  }

  const typeConfig: Record<string, { color: string; label: string; tips: string[] }> = {
    easy:     { color: '#378ADD', label: 'Easy run — Zone 2', tips: ['HR cap: 145 bpm. Walk if it goes above.', 'Pace is irrelevant — HR is everything.', "Nose breathing test: can't hold a conversation? Slow down.", 'Cardiac drift is normal — walk breaks are correct, not failure.'] },
    quality:  { color: '#D4501A', label: 'Quality session',   tips: ['Warm up 10–15 min easy first.', 'Target HR 155–165 bpm during efforts. Controlled, not maximal.', 'Cool down 10 min easy. Don\'t skip it.', 'Legs dead? Dial it back — don\'t force quality on fatigue.'] },
    run:      { color: '#D4501A', label: 'Long run',          tips: ['Start slower than feels right. First 30 min embarrassingly easy.', 'Fuel every 45 min from the gun — don\'t wait.', 'Walk the hills. Strategy, not weakness.', 'HR above 150 late in run? Walk break. Drop to 135 before resuming.'] },
    race:     { color: '#ff7777', label: 'Race',              tips: ['Training run with a bib. Not a race.', 'HR-capped — Zone 2 long run.', 'Walk all significant climbs.', 'Fuel every 45 min. Use every aid station.', 'Finish feeling like you have 10k left.'] },
    strength: { color: '#4a9a5a', label: 'Strength session',  tips: ['Keep it functional — glutes, hips, single-leg stability.', 'Don\'t go to failure. Leave 2–3 reps in the tank.', 'Legs trashed from running? Reduce load, don\'t skip.'] },
  }
  const config = typeConfig[session.type] ?? typeConfig['easy']

  return (
    <>
      <div style={{ padding: '12px 18px 8px', borderBottom: '0.5px solid var(--border-col, #e8e3dc)' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: config.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
          {session.day} · {session.date}
          {isComplete && <span style={{ color: '#4a9a5a', marginLeft: '8px' }}>✓ Complete</span>}
          {isSkipped && <span style={{ color: 'var(--text-muted, #777)', marginLeft: '8px' }}>Skipped</span>}
        </div>
        {session.detail && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #666)', marginTop: '2px' }}>{session.detail}</div>}
      </div>

        {view === 'detail' && (
          <>
            <div style={{ padding: '12px 18px', background: 'var(--bg, #f5f3ef)', borderBottom: '0.5px solid var(--border-col, #e8e3dc)' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #777)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Week focus</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary, #555)', lineHeight: 1.5 }}>{weekTheme}</div>
            </div>
            <div style={{ padding: '18px 18px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: config.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>{config.label} — key points</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {config.tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: config.color, flexShrink: 0, marginTop: '5px' }} />
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary, #bbb)', lineHeight: 1.6 }}>{tip}</div>
                  </div>
                ))}
              </div>
            </div>
            {(session.type === 'easy' || session.type === 'run') && (
              <div style={{ margin: '0 18px 16px', background: 'var(--bg, #f5f3ef)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border-col, #e8e3dc)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #777)', textTransform: 'uppercase' }}>Zone 2 ceiling</div>
                  <div style={{ fontSize: '20px', fontWeight: 500, color: '#378ADD' }}>145 <span style={{ fontSize: '12px', color: 'var(--text-muted, #777)' }}>bpm</span></div>
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #444)', marginTop: '4px' }}>Walk if HR exceeds this. No exceptions.</div>
              </div>
            )}
            <div style={{ padding: '0 18px 24px', display: 'flex', gap: '8px' }}>
              {!isComplete && !isSkipped && !session.isFuture && (
                <>
                  <button onClick={() => setView('complete')} style={{ flex: 1, background: 'rgba(74,154,90,0.15)', color: '#4a9a5a', border: '0.5px solid rgba(74,154,90,0.4)', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold' }}>
                    Mark complete
                  </button>
                  <button onClick={() => setView('skip')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #777)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                    Skip
                  </button>
                </>
              )}
              {(isComplete || isSkipped) && (
                <button onClick={() => setView('complete')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #777)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', cursor: 'pointer' }}>
                  Update
                </button>
              )}
              {session.isFuture && !isComplete && !isSkipped && (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #444)', textAlign: 'center', padding: '12px', width: '100%' }}>
                  Available to log on {session.date}
                </div>
              )}
              {isPast && !isComplete && !isSkipped && !session.isFuture && (
                <button onClick={() => setView('complete')} style={{ flex: 1, background: 'var(--bg, #111)', color: 'var(--text-muted, #666)', border: 'none', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', cursor: 'pointer' }}>
                  Log retroactively
                </button>
              )}
            </div>
          </>
        )}

        {view === 'complete' && (
          <div style={{ padding: '16px 18px 24px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: '#4a9a5a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Mark as complete</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #666)', marginBottom: '8px' }}>Link a Strava activity (optional)</div>
            {loadingClaimed ? (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #444)', padding: '12px 0' }}>Loading activities...</div>
            ) : stravaRuns.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                {stravaRuns.slice(0, 20).map((run: any) => {
                  const isSelected = selectedActivity?.id === run.id
                  return (
                    <div key={run.id} onClick={() => setSelectedActivity(isSelected ? null : run)} style={{
                      background: isSelected ? 'rgba(74,154,90,0.1)' : 'var(--bg, #080808)',
                      border: `0.5px solid ${isSelected ? 'rgba(74,154,90,0.4)' : 'var(--border-col, #1c1c1c)'}`,
                      borderRadius: '12px', padding: '10px 12px', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', color: isSelected ? 'var(--text-primary, #fff)' : 'var(--text-secondary, #bbb)', fontWeight: 500 }}>{run.name}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #777)', marginTop: '2px' }}>
                          {new Date(run.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {(run.distance / 1000).toFixed(1)}km {run.average_heartrate ? `· ${Math.round(run.average_heartrate)} bpm` : ''}
                        </div>
                      </div>
                      {isSelected && <span style={{ color: '#4a9a5a', fontSize: '16px' }}>✓</span>}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #444)', padding: '12px 0', marginBottom: '8px' }}>No Strava activities found in the 5 days before this session</div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #777)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', cursor: 'pointer' }}>Back</button>
              <button onClick={() => saveCompletion('complete')} disabled={saving} style={{ flex: 2, background: 'rgba(74,154,90,0.15)', color: '#4a9a5a', border: '0.5px solid rgba(74,154,90,0.4)', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Confirm complete'}
              </button>
            </div>
          </div>
        )}

        {view === 'skip' && (
          <div style={{ padding: '16px 18px 24px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary, #555)', lineHeight: 1.6, marginBottom: '20px' }}>
              Mark this session as skipped? It'll show as grey in your log.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #777)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', cursor: 'pointer' }}>Back</button>
              <button onClick={() => saveCompletion('skipped')} disabled={saving} style={{ flex: 2, background: 'var(--bg, #111)', color: 'var(--text-muted, #666)', border: '0.5px solid var(--border-col, #333)', borderRadius: '12px', padding: '14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Mark as skipped'}
              </button>
            </div>
          </div>
        )}
    </>
  )
}

// ── DATE STRIP ────────────────────────────────────────────────────────────

const DOW_ORDER = ['mon','tue','wed','thu','fri','sat','sun']
const DOW_LETTER: Record<string, string> = { mon:'M', tue:'T', wed:'W', thu:'T', fri:'F', sat:'S', sun:'S' }
const DOW_FULL:   Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const DAY_OFFSETS: Record<string, number> = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 }

interface SessionEntry {
  key: string
  displayKey: string
  day: string
  title: string
  detail: string
  type: string
  date: string
  rawDate: Date
  today: boolean
}

function DateStrip({ sessions, completions, selectedKey, onSelect, weekIndex, totalWeeks, onWeekChange, onOpenCalendar }: {
  sessions: SessionEntry[]
  completions: Record<string, any>
  selectedKey: string | null
  onSelect: (key: string) => void
  weekIndex: number
  totalWeeks: number
  onWeekChange: (i: number) => void
  onOpenCalendar: () => void
}) {
  const sessionMap = Object.fromEntries(sessions.map(s => [s.displayKey, s]))
  const touchStartX = useRef<number | null>(null)

  function getDotColor(key: string): string | null {
    const s = sessionMap[key]
    if (!s || s.type === 'rest') return null
    const comp = completions[s.key] // use originalDay for completion lookup
    if (comp?.status === 'complete') return '#4a9a5a'
    if (comp?.status === 'skipped') return '#333'
    return TYPE_DOT[s.type] ?? '#666'
  }

  function handleTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) < 60) return
    if (diff > 0 && weekIndex < totalWeeks - 1) onWeekChange(weekIndex + 1)
    if (diff < 0 && weekIndex > 0) onWeekChange(weekIndex - 1)
    touchStartX.current = null
  }

  return (
    <div
      style={{ borderBottom: '0.5px solid var(--border-col, #e8e3dc)', background: 'var(--bg, #f5f3ef)', paddingBottom: '10px' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Week label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px' }}>
        <button
          onClick={() => weekIndex > 0 && onWeekChange(weekIndex - 1)}
          style={{ background: 'none', border: 'none', color: weekIndex > 0 ? '#555' : '#222', fontSize: '18px', cursor: weekIndex > 0 ? 'pointer' : 'default', padding: 0, lineHeight: 1 }}
        ><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <button onClick={onOpenCalendar} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="#555" strokeWidth="1.1"/>
            <line x1="1" y1="5.5" x2="13" y2="5.5" stroke="#555" strokeWidth="1.1"/>
            <line x1="4.5" y1="1" x2="4.5" y2="3.5" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/>
            <line x1="9.5" y1="1" x2="9.5" y2="3.5" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Week {weekIndex + 1} of {totalWeeks}
          </span>
        </button>
        <button
          onClick={() => weekIndex < totalWeeks - 1 && onWeekChange(weekIndex + 1)}
          style={{ background: 'none', border: 'none', color: weekIndex < totalWeeks - 1 ? '#555' : '#222', fontSize: '18px', cursor: weekIndex < totalWeeks - 1 ? 'pointer' : 'default', padding: 0, lineHeight: 1 }}
        >›</button>
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px', gap: '2px' }}>
        {DOW_ORDER.map(key => {
          const s = sessionMap[key]
          const isSelected = s?.key === selectedKey && s?.type !== 'rest'
          const isToday = s?.today ?? false
          const dotColor = getDotColor(key)
          const dateNum = s ? s.rawDate.getDate().toString() : ''
          const hasEntry = !!s

          return (
            <button
              key={key}
              onClick={() => hasEntry && onSelect(s?.key ?? key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '4px 2px', background: 'none', border: 'none',
                cursor: hasEntry ? 'pointer' : 'default', borderRadius: '12px',
              }}
            >
              {/* Day letter */}
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '10px',
                color: isSelected ? '#D4501A' : isToday ? '#D4501A' : '#444',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {DOW_LETTER[key]}
              </span>

              {/* Date circle */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? '#D4501A' : isToday && !isSelected ? 'rgba(212,80,26,0.12)' : 'transparent',
                border: isToday && !isSelected ? '1px solid rgba(212,80,26,0.35)' : 'none',
                transition: 'background 0.15s',
              }}>
                <span style={{
                  fontFamily: "'DM Mono',monospace", fontSize: '13px',
                  color: isSelected ? '#fff' : isToday ? '#D4501A' : dateNum ? '#999' : '#2a2a2a',
                  fontWeight: isToday || isSelected ? 600 : 400,
                }}>
                  {dateNum}
                </span>
              </div>

              {/* Session dot */}
              <div style={{
                width: '4px', height: '4px', borderRadius: '50%',
                background: dotColor ?? 'transparent',
              }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── SESSION HERO ──────────────────────────────────────────────────────────

function SessionHero({ session, completion, onTap }: {
  session: SessionEntry; completion?: any; onTap: () => void
}) {
  const accent = TYPE_ACCENT[session.type] ?? '#D4501A'
  const isComplete = completion?.status === 'complete'
  const isSkipped = completion?.status === 'skipped'

  return (
    <div onClick={onTap} style={{
      margin: '12px 12px 0',
      background: isComplete ? 'rgba(74,154,90,0.06)' : isSkipped ? 'rgba(80,80,80,0.06)' : 'var(--card-bg, #fff)',
      borderRadius: '16px',
      border: `0.5px solid ${isComplete ? 'rgba(74,154,90,0.35)' : isSkipped ? '#2a2a2a' : 'var(--border-col, #e8e3dc)'}`,
      borderLeft: `4px solid ${isComplete ? '#4a9a5a' : isSkipped ? '#444' : accent}`,
      padding: '16px',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: '10px',
          color: isComplete ? '#4a9a5a' : isSkipped ? '#555' : accent,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {session.today ? 'Today · ' : ''}{session.day} {session.date} · {TYPE_LABEL[session.type] ?? session.type}
        </span>
        {isComplete && (
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: '10px', letterSpacing: '0.08em',
            background: 'rgba(74,154,90,0.15)', color: '#4a9a5a',
            border: '0.5px solid rgba(74,154,90,0.4)',
            borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase',
          }}>✓ Done</span>
        )}
        {isSkipped && (
          <span style={{
            fontFamily: "'DM Mono',monospace", fontSize: '10px', letterSpacing: '0.08em',
            background: 'rgba(80,80,80,0.12)', color: '#666',
            border: '0.5px solid #333',
            borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase',
          }}>Skipped</span>
        )}
      </div>

      <div style={{
        fontSize: '20px', fontWeight: 500, letterSpacing: '-0.3px',
        color: isSkipped ? 'var(--text-muted, #888)' : 'var(--text-primary, #111)',
        lineHeight: 1.2, marginBottom: session.detail ? '6px' : '14px',
        textDecoration: isSkipped ? 'line-through' : 'none',
      }}>
        {session.title}
      </div>

      {session.detail && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', marginBottom: '14px' }}>
          {session.detail}
        </div>
      )}

      {isComplete && completion?.strava_activity_name && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#FC4C02', marginBottom: '12px' }}>
          ● {completion.strava_activity_name}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: "'DM Mono',monospace", fontSize: '12px',
          color: isComplete ? '#4a9a5a' : isSkipped ? '#555' : 'var(--text-muted, #888)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {isComplete ? 'View details' : isSkipped ? 'Update' : session.today ? 'Log this session' : 'View session'}
        </span>
        <span style={{ color: 'var(--text-muted, #777)', fontSize: '18px' }}>›</span>
      </div>
    </div>
  )
}

// ── REST DAY CARD ─────────────────────────────────────────────────────────

function RestDayCard({ session, nextSession }: {
  session: SessionEntry | null; nextSession: SessionEntry | null
}) {
  return (
    <div style={{ margin: '12px 12px 0' }}>
      <div style={{
        background: 'var(--card-bg, #fff)', borderRadius: '16px',
        border: '0.5px solid var(--border-col, #e8e3dc)', padding: '20px 18px', marginBottom: '10px',
      }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #888)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
          No run today
        </div>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary, #111)', lineHeight: 1.25, marginBottom: '8px', letterSpacing: '-0.3px' }}>
          {session?.type === 'rest' || !session ? 'Rest is the training.' : session.title}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', lineHeight: 1.6 }}>
          {session?.type === 'rest' || !session
            ? "Nothing to run today. Your body is building fitness while you rest. Don't undo it."
            : 'No running today. Keep it easy, stay off the legs.'}
        </div>
      </div>

      {nextSession && (
        <div style={{
          background: 'var(--card-bg, #fff)', borderRadius: '12px',
          border: '0.5px solid var(--border-col, #e8e3dc)', padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #888)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Next run · {nextSession.day} {nextSession.date}
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted, #888)', fontWeight: 500 }}>{nextSession.title}</div>
            {nextSession.detail && (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', marginTop: '2px' }}>{nextSession.detail}</div>
            )}
          </div>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: TYPE_DOT[nextSession.type] ?? '#555', flexShrink: 0, marginLeft: '12px' }} />
        </div>
      )}
    </div>
  )
}

// ── CALENDAR OVERLAY ──────────────────────────────────────────────────────

function CalendarOverlay({ plan, stravaRuns, allOverrides, allCompletions, onBack, onOpenSession }: {
  plan: Plan
  stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>
  onBack: () => void
  onOpenSession: (s: any) => void
}) {
  const [showPast, setShowPast] = useState(false)

  const now = new Date()
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]
  const todayStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  // Find current week index
  const currentWeekIndex = plan.weeks.findIndex(w => (w as any).type === 'current')

  // Split weeks: past = before current, present+future = current onwards
  const pastWeeks = plan.weeks.slice(0, currentWeekIndex).map((week, i) => ({ week, weekNum: i + 1 }))
  const futureWeeks = plan.weeks.slice(currentWeekIndex).map((week, i) => ({ week, weekNum: currentWeekIndex + i + 1 }))

  // Group into months
  function groupByMonth(items: { week: any; weekNum: number }[]) {
    const months: { label: string; weeks: { week: any; weekNum: number }[] }[] = []
    items.forEach(({ week, weekNum }) => {
      const weekDate = new Date((week as any).date)
      const monthLabel = weekDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      const last = months[months.length - 1]
      if (!last || last.label !== monthLabel) {
        months.push({ label: monthLabel, weeks: [{ week, weekNum }] })
      } else {
        last.weeks.push({ week, weekNum })
      }
    })
    return months
  }

  const pastMonths = groupByMonth(pastWeeks)
  const futureMonths = groupByMonth(futureWeeks)

  function getDotColor(type: string, completion?: any): string {
    if (completion?.status === 'complete') return '#4a9a5a'
    if (completion?.status === 'skipped') return '#2a2a2a'
    return TYPE_DOT[type] ?? 'transparent'
  }

  function renderWeekRow(week: any, weekNum: number) {
    const ws = (week as any).sessions ?? {}
    const weekStartDate = new Date((week as any).date)
    const isCurrent = (week as any).type === 'current'
    const weekCompletions = allCompletions[weekNum] ?? {}

    // Apply overrides for this week
    const weekOverrides = allOverrides.filter(o => o.week_n === weekNum)
    const effectiveWs: Record<string, any> = {}
    DOW_ORDER.forEach(key => {
      if (weekOverrides.some(o => o.original_day === key)) return
      if (ws[key]) effectiveWs[key] = { ...ws[key], originalDay: key }
    })
    weekOverrides.forEach(o => {
      if (ws[o.original_day]) effectiveWs[o.new_day] = { ...ws[o.original_day], originalDay: o.original_day }
    })

    return (
      <div key={weekNum} style={{
        display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)',
        marginBottom: '4px',
        background: isCurrent ? 'rgba(212,80,26,0.04)' : 'transparent',
        borderRadius: '8px',
        border: isCurrent ? '0.5px solid rgba(212,80,26,0.15)' : '0.5px solid transparent',
        padding: '4px 0',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'DM Mono',monospace", fontSize: '10px',
          color: isCurrent ? '#D4501A' : '#333',
        }}>
          W{weekNum}
        </div>
        {DOW_ORDER.map(key => {
          const s = effectiveWs[key]
          const originalDay = s?.originalDay ?? key
          const d = new Date(weekStartDate)
          d.setDate(d.getDate() + DAY_OFFSETS[key])
          const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          const isToday = key === todayDow && displayDate === todayStr
          const completion = weekCompletions[originalDay]
          const dotColor = s && s.type !== 'rest' ? getDotColor(s.type, completion) : null
          const isPast = d < now && !isToday
          const isFuture = d > now && !isToday

          return (
            <button
              key={key}
              onClick={() => {
                if (!s || s.type === 'rest') return
                onOpenSession?.({
                  key: originalDay, day: DOW_FULL[key],
                  title: s.label ?? '', detail: s.detail ?? '',
                  type: s.type, date: displayDate,
                  rawDate: d.toISOString(), today: isToday,
                  completion, isPast: isPast && !isToday, isFuture,
                  fromCalendar: true,
                })
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '3px',
                background: 'none', border: 'none',
                cursor: s && s.type !== 'rest' ? 'pointer' : 'default',
                padding: '4px 2px', borderRadius: '6px',
                opacity: isPast && !completion && s && s.type !== 'rest' ? 0.35 : 1,
              }}
            >
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: '12px',
                color: isToday ? '#D4501A' : '#555',
                fontWeight: isToday ? 600 : 400,
                background: isToday ? 'rgba(212,80,26,0.12)' : 'transparent',
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {d.getDate()}
              </span>
              <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: dotColor ?? 'transparent' }} />
            </button>
          )
        })}
      </div>
    )
  }

  const currentMonthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  function renderMonths(months: { label: string; weeks: { week: any; weekNum: number }[] }[]) {
    return months.map(({ label, weeks }) => {
      const isCurrent = label === currentMonthLabel
      return (
        <div key={label} style={{
          background: 'var(--card-bg, #fff)',
          borderRadius: '16px',
          border: isCurrent ? '0.5px solid rgba(212,80,26,0.4)' : '0.5px solid var(--border-col, #1c1c1c)',
          overflow: 'hidden',
          marginBottom: '10px',
        }}>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: '10px',
            color: isCurrent ? '#D4501A' : '#555',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '12px 12px 6px',
            borderBottom: '0.5px solid var(--border-col, #e8e3dc)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {label}
            {isCurrent && <span style={{ background: 'rgba(212,80,26,0.12)', color: '#D4501A', fontSize: '10px', padding: '2px 8px', borderRadius: '20px', border: '0.5px solid rgba(212,80,26,0.3)' }}>current</span>}
          </div>
          <div style={{ padding: '6px 8px 8px' }}>
            {weeks.map(({ week, weekNum }) => renderWeekRow(week, weekNum))}
          </div>
        </div>
      )
    })
  }

  // Find week number for a session popup
  function getWeekNumForDate(rawDate: string): number {
    const d = new Date(rawDate)
    const idx = plan.weeks.findIndex((w: any) => {
      const ws = new Date((w as any).date)
      return d >= ws && d < new Date(ws.getTime() + 7 * 86400000)
    })
    return idx + 1
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #f5f3ef)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 8px',
        borderBottom: '0.5px solid var(--border-col, #e8e3dc)',
        position: 'sticky', top: 0, background: 'var(--bg, #f5f3ef)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ border: 'none', color: '#D4501A', fontSize: '22px', cursor: 'pointer', padding: '0', lineHeight: 1 , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #111)', fontFamily: "'DM Sans',sans-serif", letterSpacing: '-0.3px' }}>
            Plan
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[{ color: '#378ADD', label: 'Easy' }, { color: '#D4501A', label: 'Run' }, { color: '#4a9a5a', label: 'Done' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #888)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day header row — sticky below title */}
      <div style={{
        display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)',
        padding: '8px 12px 4px',
        position: 'sticky', top: '53px', background: 'var(--bg, #f5f3ef)', zIndex: 9,
        borderBottom: '0.5px solid var(--border-col, #e8e3dc)',
      }}>
        <div />
        {DOW_ORDER.map(key => (
          <div key={key} style={{ textAlign: 'center', fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #888)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {DOW_LETTER[key]}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 12px 32px' }}>

        {/* Load past — always visible at top */}
        {pastWeeks.length > 0 && (
          <div style={{ padding: '12px 0 4px' }}>
            {showPast ? (
              <>
                {renderMonths(pastMonths)}
                <button
                  onClick={() => setShowPast(false)}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'none', border: '0.5px solid #1c1c1c',
                    borderRadius: '8px', cursor: 'pointer',
                    fontFamily: "'DM Mono',monospace", fontSize: '12px',
                    color: 'var(--text-muted, #888)', letterSpacing: '0.06em', textTransform: 'uppercase',
                    marginBottom: '8px',
                  }}
                >
                  ↑ Hide past weeks
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowPast(true)}
                style={{
                  width: '100%', padding: '12px',
                  background: 'none', border: '0.5px solid #1c1c1c',
                  borderRadius: '8px', cursor: 'pointer',
                  fontFamily: "'DM Mono',monospace", fontSize: '12px',
                  color: 'var(--text-muted, #888)', letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
              >
                ↑ Load {pastWeeks.length} past week{pastWeeks.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {/* Current + future months */}
        {renderMonths(futureMonths)}
      </div>


    </div>
  )
}

// ── TODAY SCREEN ──────────────────────────────────────────────────────────

function TodayScreen({ plan, weekIndex, onWeekChange, quitDays, smokeTrackerEnabled, daysToRace, daysTo50k, stravaRuns, onOpenMe, initials, allOverrides, overridesReady, onOpenCalendar, onOpenSession, allCompletions }: {
  plan: Plan; weekIndex: number; onWeekChange: (i: number) => void; quitDays: number | null
  smokeTrackerEnabled: boolean; daysToRace: number; daysTo50k: number
  stravaRuns: any[]; onOpenMe: () => void; initials: string
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  overridesReady: boolean
  onOpenCalendar?: () => void
  onOpenSession?: (s: any) => void
  allCompletions: Record<number, Record<string, any>>
}) {
  const currentWeek = plan.weeks[weekIndex]
  const weekNum = weekIndex + 1
  const totalWeeks = plan.weeks.length

  // Completions for this week — derived from shared allCompletions prop
  const completions = allCompletions[weekNum] ?? {}

  // Derive this week's overrides from shared prop — no fetch needed
  const overrides = useMemo(() => {
    const map: Record<string, string> = {}
    allOverrides.filter(o => o.week_n === weekNum).forEach(o => { map[o.original_day] = o.new_day })
    return map
  }, [allOverrides, weekNum])

  // Swipe whole screen = week change
  const touchStartX = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) < 60) return
    if (diff > 0 && weekIndex < totalWeeks - 1) onWeekChange(weekIndex + 1)
    if (diff < 0 && weekIndex > 0) onWeekChange(weekIndex - 1)
    touchStartX.current = null
  }

  // Build 7-day session list
  const now = new Date()
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]
  const weekStartDate = new Date((currentWeek as any).date)
  const todayStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const ws = (currentWeek as any).sessions ?? {}

  // Apply overrides — memoised so it recomputes when overrides state changes
  // Each entry carries originalDay so completion lookups always use the stable key
  const effectiveWs = useMemo(() => {
    const result: Record<string, any> = {}
    DOW_ORDER.forEach(key => {
      if (Object.keys(overrides).includes(key)) return // moved away
      if (ws[key]) result[key] = { ...ws[key], originalDay: key }
    })
    Object.entries(overrides).forEach(([originalDay, newDay]) => {
      if (ws[originalDay]) result[newDay] = { ...ws[originalDay], originalDay }
    })
    return result
  }, [overrides, weekIndex])

  const sessions: SessionEntry[] = useMemo(() => DOW_ORDER.map(key => {
    const s = effectiveWs[key]
    const originalDay = s?.originalDay ?? key
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + DAY_OFFSETS[key])
    const displayDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return {
      key: originalDay, // stable completion key
      displayKey: key,  // display position in the week
      day: DOW_FULL[key],
      title: s?.label ?? '',
      detail: s?.detail ?? '',
      type: s?.type ?? 'rest',
      date: displayDate,
      rawDate: d,
      today: key === todayDow && displayDate === todayStr,
    }
  }), [effectiveWs, weekIndex])

  // Default selected day
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const t = sessions.find(s => s.today)
    if (t) return t.key
    const next = sessions.find(s => s.rawDate >= now && effectiveWs[s.displayKey] && effectiveWs[s.displayKey].type !== 'rest')
    if (next) return next.key
    const last = [...sessions].reverse().find(s => effectiveWs[s.displayKey])
    return last?.key ?? 'mon'
  })

  // Reset selected key on week change
  useEffect(() => {
    const t = sessions.find(s => s.today)
    if (t) { setSelectedKey(t.key); return }
    const next = sessions.find(s => s.rawDate >= now && effectiveWs[s.displayKey] && effectiveWs[s.displayKey].type !== 'rest')
    if (next) { setSelectedKey(next.key); return }
    const last = [...sessions].reverse().find(s => effectiveWs[s.displayKey])
    if (last) setSelectedKey(last.key)
  }, [weekIndex, overridesReady])

  const selectedSession = sessions.find(s => s.key === selectedKey) ?? null
  const selectedEntry = selectedSession ? effectiveWs[selectedSession.displayKey] : null

  const RUN_TYPES = ['run', 'easy', 'quality', 'race']
  const isRunDay      = selectedEntry && RUN_TYPES.includes(selectedEntry.type)
  const isStrengthDay = selectedEntry?.type === 'strength'
  const showSessionHero = isRunDay || isStrengthDay

  // Next run session after selected day
  const nextRunSession = sessions.find(s =>
    s.rawDate > (selectedSession?.rawDate ?? now) && RUN_TYPES.includes(s.type)
  ) ?? null

  const weekTheme = (currentWeek as any).theme ?? ''

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ paddingBottom: '8px' }}>

      {/* Minimal today header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 8px' }}>
        {/* Me avatar — left */}
        <button onClick={onOpenMe} style={{
          width: '32px', height: '32px', borderRadius: '50%', background: '#D4501A',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'DM Mono',monospace", fontSize: '12px', fontWeight: 500, color: 'var(--text-primary, #111)',
          border: 'none', cursor: 'pointer', flexShrink: 0,
        }}>
          {initials}
        </button>
        {/* Brand slug — centre */}
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          @doinghardthingsbadly
        </div>
        {/* Calendar icon — right */}
        <button onClick={() => onOpenCalendar?.()} style={{
          width: '32px', height: '32px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: '0.5px solid #222', cursor: 'pointer', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" stroke="#555" strokeWidth="1.1"/>
            <line x1="1.5" y1="6.5" x2="14.5" y2="6.5" stroke="#555" strokeWidth="1.1"/>
            <line x1="5" y1="1" x2="5" y2="4" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/>
            <line x1="11" y1="1" x2="11" y2="4" stroke="#555" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <DateStrip
        sessions={sessions}
        completions={completions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        weekIndex={weekIndex}
        totalWeeks={totalWeeks}
        onWeekChange={onWeekChange}
        onOpenCalendar={() => onOpenCalendar?.()}
      />



      {showSessionHero && selectedSession ? (
        <SessionHero
          session={selectedSession}
          completion={completions[selectedKey]}
          onTap={() => {
            const isPast = selectedSession.rawDate < now && !selectedSession.today
            const isFuture = !selectedSession.today && selectedSession.rawDate > now
            onOpenSession?.({
              ...selectedSession,
              rawDate: selectedSession.rawDate.toISOString(),
              completion: completions[selectedKey],
              isPast,
              isFuture,
              weekN: weekNum,
              weekTheme,
            })
          }}
        />
      ) : (
        <RestDayCard session={selectedSession} nextSession={nextRunSession} />
      )}



      {/* Week focus */}
      {weekTheme && (
        <div style={{ margin: '10px 12px 0', padding: '10px 14px', background: 'var(--card-bg, #fff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #e8e3dc)' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '10px', color: 'var(--text-muted, #888)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>Week focus</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted, #888)', lineHeight: 1.5 }}>{weekTheme}</div>
        </div>
      )}

      {/* Race countdown */}
      <SectionLabel>Race countdown</SectionLabel>
      <div style={{ display: 'flex', gap: '8px', padding: '0 12px', marginBottom: '10px' }}>
        {[
          { num: String(daysToRace), unit: 'days', label: 'To RTS 100k' },
          { num: String(daysTo50k), unit: 'days', label: 'To 50k' },
          ...(smokeTrackerEnabled && quitDays !== null ? [{ num: String(quitDays), unit: 'days', label: 'Smoke-free' }] : []),
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: 'var(--card-bg, #fff)', borderRadius: '12px', padding: '10px 12px', border: '0.5px solid var(--border-col, #e8e3dc)' }}>
            <div>
              <span style={{ fontSize: '20px', color: 'var(--text-primary, #111)', fontWeight: 500 }}>{s.num}</span>
              <span style={{ fontSize: '13px', color: '#D4501A', fontWeight: 500 }}> {s.unit}</span>
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', marginTop: '2px', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>


    </div>
  )
}

// ── PLAN SCREEN ───────────────────────────────────────────────────────────

function PlanScreen({ plan, stravaRuns, onOpenMe, initials, allOverrides, onOverrideChange, onOpenCalendar, onOpenSession }: {
  plan: Plan; stravaRuns: any[]; onOpenMe: () => void; initials: string
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onOpenCalendar?: () => void
  onOpenSession?: (s: any) => void
}) {
  return (
    <div>
      <ScreenHeader title="Plan" sub="Race to the Stones · 11 Jul 2026" initials={initials} onOpenMe={onOpenMe} />
      <div style={{ padding: '0 12px' }}>
        <PlanChart weeks={plan.weeks} />
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: 'var(--text-muted, #888)', margin: '8px 0 4px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
          <span>MIDWEEK: 2× Zone 2 · STRENGTH: Mon/Wed · SAT: long run</span>
          <span style={{ color: 'var(--text-muted, #888)' }}>v{plan.meta.version} · {plan.meta.last_updated}</span>
        </div>
      </div>

      <PlanCalendar
        weeks={plan.weeks}
        stravaRuns={stravaRuns}
        allOverrides={allOverrides}
        onOverrideChange={onOverrideChange}
        onSessionTap={(session, weekN, weekTheme) => {
          onOpenSession?.({ ...session, weekN, weekTheme })
        }}
      />


    </div>
  )
}

// ── COACH SCREEN ──────────────────────────────────────────────────────────

function CoachScreen({ plan, currentWeek, runs, stravaLoading, onOpenMe, initials }: {
  plan: Plan; currentWeek: Week; runs: any[] | null; stravaLoading: boolean; onOpenMe: () => void; initials: string
}) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cachedActivityId, setCachedActivityId] = useState<string | null>(null)

  const weekNum    = plan.weeks.findIndex(w => w.type === 'current') + 1
  const totalWeeks = plan.weeks.length
  const latestRun  = runs?.[0] ?? null
  const latestId   = latestRun ? String(latestRun.id) : null
  const isNew      = latestId && latestId !== cachedActivityId

  useEffect(() => {
    try {
      const cached   = localStorage.getItem('rts_coach_analysis')
      const cachedId = localStorage.getItem('rts_coach_activity_id')
      if (cached)   setAnalysis(cached)
      if (cachedId) setCachedActivityId(cachedId)
    } catch {}
  }, [])

  useEffect(() => {
    if (isNew && !loading && !stravaLoading) generateAnalysis()
  }, [latestId, stravaLoading])

  async function generateAnalysis() {
    if (!latestRun) return
    setLoading(true)
    setError(null)
    try {
      const { formatDuration, formatPace } = await import('@/lib/strava')
      const weeksToRace = Math.max(0, Math.round((new Date('2026-07-11').getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)))
      const weekLabel   = (currentWeek as any).label ?? 'build phase'
      const weekTheme   = (currentWeek as any).theme ?? ''

      const prompt = `You are a direct, no-fluff ultra running coach giving Russ a weekly check-in. He is training for Race to the Stones 100km on 11 July 2026 (${weeksToRace} weeks away).

Athlete profile: HM 1:48:30, resting HR ~48, max HR ~188. Zone 2 ceiling: HR 145. Recently quit smoking 3 April 2026. Key metric to track: pace at HR 145.

Current plan position: Week ${weekNum} of ${totalWeeks}. Phase: ${weekLabel}. Focus: ${weekTheme}.

Latest activity:
- Name: ${latestRun.name}
- Date: ${new Date(latestRun.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
- Distance: ${(latestRun.distance / 1000).toFixed(2)}km
- Duration: ${formatDuration(latestRun.moving_time)}
- Avg HR: ${latestRun.average_heartrate ? Math.round(latestRun.average_heartrate) + ' bpm' : 'not recorded'}
- Max HR: ${latestRun.max_heartrate ? Math.round(latestRun.max_heartrate) + ' bpm' : 'not recorded'}
- Pace: ${formatPace(latestRun.moving_time, latestRun.distance)}
- Elevation: +${Math.round(latestRun.total_elevation_gain ?? 0)}m

Write 2 short paragraphs. First: where Russ is in the plan and whether he's on track. Second: direct feedback on the latest run — what was good, what to focus on next. Be specific, honest, no fluff. Use "you" not "Russ".`

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const text = data.content?.map((b: { text?: string }) => b.text || '').join('') || ''
      if (!text) throw new Error('Empty response')

      setAnalysis(text)
      setCachedActivityId(latestId)
      try {
        localStorage.setItem('rts_coach_analysis', text)
        if (latestId) localStorage.setItem('rts_coach_activity_id', latestId)
      } catch {}
    } catch {
      setError('Could not generate analysis — check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const latestRunLabel = latestRun
    ? `${new Date(latestRun.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${(latestRun.distance / 1000).toFixed(1)}km`
    : null

  return (
    <div>
      <ScreenHeader title="Coach" sub={`W${weekNum} · ${(currentWeek as any).label ?? 'Build phase'}`} initials={initials} onOpenMe={onOpenMe} />
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {(stravaLoading || latestRun) && (
          <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '12px', padding: '9px 12px', border: '0.5px solid var(--border-col, #e8e3dc)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FC4C02' }} />
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: 'var(--text-muted, #888)' }}>
                {stravaLoading ? 'Loading Strava...' : loading ? 'Analysing latest run...' : latestRunLabel ?? 'Latest activity'}
              </span>
            </div>
            {isNew && !loading && (
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#D4501A', background: 'rgba(212,80,26,0.1)', padding: '2px 8px', borderRadius: '20px' }}>new</span>
            )}
          </div>
        )}

        {!stravaLoading && !latestRun && (
          <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', lineHeight: 1.6 }}>
              Connect Strava in the <span style={{ color: '#D4501A' }}>Me</span> screen<br />to get coaching notes.
            </div>
          </div>
        )}

        {(loading || (stravaLoading && !analysis)) && (
          <>
            <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#1c1c1c" strokeWidth="2" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#D4501A" strokeWidth="2" strokeDasharray="40 60" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite" />
                </circle>
              </svg>
              <p style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', textAlign: 'center', lineHeight: 1.6 }}>
                {stravaLoading ? 'Loading Strava data...' : 'Reading your latest run\nand plan position...'}
              </p>
            </div>
            <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', padding: '14px' }}>
              {[85, 100, 70, 90].map((w, i) => (
                <div key={i} style={{ height: '10px', background: 'var(--bg, #f5f3ef)', borderRadius: '4px', marginBottom: i < 3 ? '8px' : 0, width: `${w}%` }} />
              ))}
            </div>
          </>
        )}

        {error && !loading && (
          <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', padding: '16px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#D4501A', marginBottom: '8px' }}>Error</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted, #888)' }}>{error}</div>
            <button onClick={generateAnalysis} style={{ marginTop: '12px', fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#D4501A', background: 'rgba(212,80,26,0.1)', border: 'none', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        )}

        {analysis && !loading && (
          <>
            <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid #111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D4501A' }} />
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Coaching notes</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)' }}>W{weekNum}/{totalWeeks}</span>
              </div>
              <div style={{ padding: '14px' }}>
                {analysis.split('\n\n').map((para, i) => (
                  <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary, #444)', lineHeight: 1.65, marginTop: i > 0 ? '10px' : 0 }}>{para}</p>
                ))}
              </div>
            </div>
            <button onClick={generateAnalysis} style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: 'var(--text-muted, #888)', background: 'none', border: '0.5px solid #1c1c1c', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer', alignSelf: 'center' }}>
              Refresh analysis
            </button>
          </>
        )}

        {!analysis && !loading && !error && latestRun && !stravaLoading && (
          <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', lineHeight: 1.6 }}>
              Strava connected. Ready to generate<br />your coaching notes.
            </div>
            <button onClick={generateAnalysis} style={{ marginTop: '16px', fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#D4501A', background: 'rgba(212,80,26,0.1)', border: 'none', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer' }}>
              Generate now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── STRAVA SCREEN ─────────────────────────────────────────────────────────

function StravaScreen({ runs, loading, connected, onOpenMe, initials }: {
  runs: any[] | null; loading: boolean; connected: boolean; onOpenMe: () => void; initials: string
}) {
  return (
    <div>
      <ScreenHeader title="Strava" sub="Activity feed" initials={initials} onOpenMe={onOpenMe} />
      <div style={{ padding: '0 12px' }}>
        <StravaPanel preloadedRuns={runs} preloadedConnected={connected} preloadedLoading={loading} />
      </div>
    </div>
  )
}

// ── STRAVA CONNECTION ROW ─────────────────────────────────────────────────

function StravaConnectionRow() {
  const [secret, setSecret]       = useState('')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [saving, setSaving]       = useState(false)
  const [expanded, setExpanded]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConnected(false); return }
      const { data } = await supabase.from('user_settings').select('strava_client_secret').eq('id', user.id).single()
      setConnected(!!(data?.strava_client_secret))
    }
    check()
  }, [])

  async function save() {
    if (!secret.trim()) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in')
      const { error: err } = await supabase.from('user_settings').upsert({ id: user.id, strava_client_secret: secret.trim(), updated_at: new Date().toISOString() })
      if (err) throw err
      setConnected(true)
      setExpanded(false)
      setSecret('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally { setSaving(false) }
  }

  async function disconnect() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('user_settings').upsert({ id: user.id, strava_client_secret: null, updated_at: new Date().toISOString() })
    setConnected(false)
    setExpanded(false)
  }

  const isLoading = connected === null

  return (
    <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #e8e3dc)', overflow: 'hidden' }}>
      <button onClick={() => !isLoading && setExpanded(e => !e)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(252,76,2,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FC4C02' }} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary, #c0c0c0)', lineHeight: 1.55 }}>Strava</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', marginTop: '1px' }}>Client secret + OAuth</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLoading ? (
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)' }}>checking...</span>
          ) : connected ? (
            <><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4a9a5a' }} /><span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#4a9a5a' }}>connected</span></>
          ) : (
            <><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8a3a3a' }} /><span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#8a3a3a' }}>not connected</span></>
          )}
          <span style={{ color: 'var(--text-muted, #888)', fontSize: '15px', marginLeft: '4px' }}>{expanded ? '˅' : '›'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{ borderTop: '0.5px solid var(--border-col, #e8e3dc)', padding: '14px' }}>
          {!connected ? (
            <>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', marginBottom: '10px', lineHeight: 1.6 }}>
                Paste your Strava Client Secret. Find it at strava.com → Settings → My API Application.
              </div>
              <input type="password" value={secret} onChange={e => setSecret(e.target.value)} placeholder="Client secret..." style={{ width: '100%', background: 'var(--bg, #f5f3ef)', border: '0.5px solid #222', borderRadius: '8px', padding: '10px 12px', color: 'var(--text-secondary, #444)', fontFamily: "'DM Mono',monospace", fontSize: '12px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box' }} />
              {error && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#8a3a3a', marginBottom: '8px' }}>{error}</div>}
              <button onClick={save} disabled={saving || !secret.trim()} style={{ width: '100%', background: '#D4501A', color: 'var(--text-primary, #111)', border: 'none', borderRadius: '8px', padding: '12px', fontFamily: "'DM Mono',monospace", fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold', opacity: saving || !secret.trim() ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save & Connect'}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#4a9a5a', marginBottom: '12px' }}>Secret saved. Auto-connects on every load.</div>
              <button onClick={disconnect} style={{ background: 'none', border: '0.5px solid #5a2a2a', borderRadius: '8px', padding: '8px 14px', fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#8a3a3a', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Disconnect
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── SMOKE TOGGLE ──────────────────────────────────────────────────────────

function SmokeToggle({ enabled, quitDate, onChange }: {
  enabled: boolean; quitDate: string; onChange: (enabled: boolean, date: string) => void
}) {
  const supabase = createClient()

  async function toggle() {
    const newEnabled = !enabled
    const newDate = newEnabled && !quitDate ? new Date().toISOString().split('T')[0] : quitDate
    onChange(newEnabled, newDate)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({ id: user.id, smoke_tracker_enabled: newEnabled, quit_date: newEnabled ? newDate : null, updated_at: new Date().toISOString() })
    } catch {}
  }

  return (
    <div onClick={toggle} style={{ width: '44px', height: '26px', borderRadius: '13px', background: enabled ? '#2a5a2a' : '#1c1c1c', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: enabled ? '#4a9a5a' : '#444', position: 'absolute', top: '3px', left: enabled ? '21px' : '3px', transition: 'left 0.2s, background 0.2s' }} />
    </div>
  )
}

// ── ME SCREEN ─────────────────────────────────────────────────────────────

function MeScreen({ initials, athlete, quitDays, smokeTrackerEnabled, quitDate, onSmokeTrackerChange, resetPhrase, onSaveMental, theme, onThemeChange, onBack }: {
  initials: string; athlete: string; quitDays: number | null; smokeTrackerEnabled: boolean; quitDate: string
  onSmokeTrackerChange: (enabled: boolean, date: string) => void
  resetPhrase: string; onSaveMental: (v: string) => void
  theme: 'dark' | 'light' | 'auto'; onThemeChange: (t: 'dark' | 'light' | 'auto') => void; onBack: () => void
}) {
  const [activeSection, setActiveSection] = useState<'main' | 'quit' | 'mental' | 'fueling'>('main')

  if (activeSection === 'quit')    return <QuitTab    quitDays={quitDays} onBack={() => setActiveSection('main')} />
  if (activeSection === 'mental')  return <MentalTab  resetPhrase={resetPhrase} onSave={onSaveMental} onBack={() => setActiveSection('main')} />
  if (activeSection === 'fueling') return <FuelingTab onBack={() => setActiveSection('main')} />

  const daysToRace = Math.max(0, Math.ceil((new Date('2026-07-11').getTime() - Date.now()) / 86400000))

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #f5f3ef)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 8px' }}>
        <button onClick={onBack} style={{ border: 'none', color: '#D4501A', fontSize: '22px', cursor: 'pointer', padding: '0', lineHeight: 1 , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary, #111)', fontFamily: "'DM Sans',sans-serif" }}>Me</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: 'var(--text-muted, #888)', marginTop: '2px' }}>@doinghardthingsbadly</div>
        </div>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '32px' }}>

        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', padding: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'space-between' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#D4501A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '15px', fontWeight: 500, color: 'var(--text-primary, #111)', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', color: 'var(--text-primary, #111)', fontWeight: 500 }}>{athlete}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)', marginTop: '2px' }}>Berkshire, UK</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#D4501A', marginTop: '4px' }}>Race to the Stones · {daysToRace} days</div>
          </div>
          <form action="/auth/signout" method="post">
            <button style={{ background: 'none', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '8px', color: 'var(--text-muted, #888)', fontFamily: "'DM Mono',monospace", fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Sign out
            </button>
          </form>
        </div>

        <SectionLabel>Appearance</SectionLabel>
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #e8e3dc)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary, #c0c0c0)', lineHeight: 1.55 }}>Theme</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['dark', 'light', 'auto'] as const).map(t => (
                <button key={t} onClick={() => onThemeChange(t)} style={{ borderRadius: '12px', padding: '6px 10px', border: `0.5px solid ${theme === t ? '#D4501A' : '#222'}`, background: 'none', cursor: 'pointer', fontFamily: "'DM Mono',monospace", fontSize: '12px', color: theme === t ? '#D4501A' : '#444', textTransform: 'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SectionLabel>Connections</SectionLabel>
        <StravaConnectionRow />

        <SectionLabel>Training support</SectionLabel>
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #e8e3dc)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #111' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: smokeTrackerEnabled ? '10px' : 0 }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary, #c0c0c0)', lineHeight: 1.55 }}>Smoke-free tracker</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: smokeTrackerEnabled ? '#4a9a5a' : '#444', marginTop: '1px' }}>
                  {smokeTrackerEnabled && quitDays !== null ? `${quitDays} days smoke-free` : 'Off'}
                </div>
              </div>
              <SmokeToggle enabled={smokeTrackerEnabled} quitDate={quitDate} onChange={onSmokeTrackerChange} />
            </div>
            {smokeTrackerEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: 'var(--text-muted, #888)' }}>Quit date:</span>
                <input type="date" value={quitDate} onChange={async e => {
                  const newDate = e.target.value
                  onSmokeTrackerChange(true, newDate)
                  try {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    await supabase.from('user_settings').upsert({ id: user.id, smoke_tracker_enabled: true, quit_date: newDate, updated_at: new Date().toISOString() })
                  } catch {}
                }} style={{ background: 'var(--bg, #f5f3ef)', border: '0.5px solid #222', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-muted, #888)', fontFamily: "'DM Mono',monospace", fontSize: '12px', outline: 'none' }} />
              </div>
            )}
          </div>

          {smokeTrackerEnabled && (
            <button onClick={() => setActiveSection('quit')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid #111', cursor: 'pointer' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary, #c0c0c0)', lineHeight: 1.55 }}>Quit tracker</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#4a9a5a', marginTop: '1px' }}>Milestones + benefits</div>
              </div>
              <div style={{ color: 'var(--text-muted, #777)', fontSize: '18px' }}>›</div>
            </button>
          )}

          {[
            { id: 'mental'  as const, label: 'Mental toolkit', sub: 'Race mantras + strategies', color: '#378ADD' },
            { id: 'fueling' as const, label: 'Fueling plan',   sub: 'Gel strategy + hydration',  color: '#D4501A' },
          ].map(({ id, label, sub, color }, i, arr) => (
            <button key={id} onClick={() => setActiveSection(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '0.5px solid #111' : 'none', cursor: 'pointer' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary, #c0c0c0)', lineHeight: 1.55 }}>{label}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color, marginTop: '1px' }}>{sub}</div>
              </div>
              <div style={{ color: 'var(--text-muted, #777)', fontSize: '18px' }}>›</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── SUPPORT SCREENS ───────────────────────────────────────────────────────


// ── SESSION SCREEN ────────────────────────────────────────────────────────

function SessionScreen({ session, preloadedRuns, onBack, onSaved }: {
  session: any; preloadedRuns: any[]; onBack: () => void; onSaved?: () => void
}) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #f5f3ef)', overflowY: 'auto', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border-col, #e8e3dc)', position: 'sticky', top: 0, background: 'var(--bg, #f5f3ef)', zIndex: 10 }}>
        <button onClick={onBack} style={{ border: 'none', color: '#D4501A', fontSize: '22px', cursor: 'pointer', padding: '0', lineHeight: 1 , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #111)', fontFamily: "\'DM Sans\',sans-serif" }}>{session.title}</div>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ background: 'var(--card-bg, #fff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #e8e3dc)', overflow: 'hidden' }}>
          <SessionPopupInner
            session={session}
            weekTheme={session.weekTheme ?? ''}
            weekN={session.weekN ?? 1}
            preloadedRuns={preloadedRuns}
            onClose={onBack}
            onSaved={onSaved}
          />
        </div>
      </div>
    </div>
  )
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px' }}>
      <button onClick={onBack} style={{ border: 'none', color: '#D4501A', fontSize: '18px', cursor: 'pointer', padding: '0' , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #111)', fontFamily: "'DM Sans',sans-serif" }}>{title}</div>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg, #fff)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '16px 18px', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-secondary, #444)', marginBottom: '10px' }}>
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
    <div style={{ minHeight: '100%', background: 'var(--bg, #f5f3ef)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Mental toolkit" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          The dark patch is coming. Probably around <span style={{ color: '#D4501A' }}>km 65–75</span>. It's not a sign you're broken — it's a sign you've been going long enough to feel something real.
        </InfoBox>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {tools.map(t => (
            <div key={t.title} style={{ background: 'var(--card-bg, #fff)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', letterSpacing: '0.05em', color: '#D4501A', marginBottom: '8px', textTransform: 'uppercase' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #888)', lineHeight: 1.6 }}>{t.text}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--card-bg, #fff)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#D4501A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your Reset Phrase</div>
          <textarea value={resetPhrase} onChange={e => onSave(e.target.value)} placeholder="What's the phrase you'll use when it gets dark at km 70?" style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-secondary, #c0c0c0)', fontFamily: "'DM Sans',sans-serif", fontSize: '13px', lineHeight: 1.7, resize: 'vertical', minHeight: '60px', outline: 'none' }} />
        </div>
      </div>
    </div>
  )
}

function FuelingTab({ onBack }: { onBack: () => void }) {
  const protocol = [
    { timing: 'Pre-run · 90 min before', what: 'Porridge + banana + coffee',      why: "Slow carbs, familiar, not ambitious. Don't experiment on race morning." },
    { timing: '0–60 minutes',            what: 'Water only',                        why: "Glycogen tanks are full. Let your body warm up before fueling." },
    { timing: 'Every 45 min after',      what: '1 gel OR real food',                why: '~60g carbs/hr target. Alternate to avoid sweet fatigue.' },
    { timing: 'Every 20–30 min',         what: 'Small sips — water or electrolyte', why: "Don't wait for thirst. By then you're already behind." },
    { timing: 'Hour 3+',                 what: 'Salty real food',                   why: 'Pretzels, nuts, cheese. Sweet fatigue is real.' },
    { timing: 'Aid stations',            what: 'Eat at every single one',           why: "You'll never regret eating at a checkpoint. You will regret skipping one." },
  ]
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #f5f3ef)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Fueling plan" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          Real food + gels is the right call. The goal now is <span style={{ color: '#D4501A' }}>stress-testing your gut before June</span> so there are zero surprises on race day.
        </InfoBox>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {protocol.map(p => (
            <div key={p.timing} style={{ background: 'var(--card-bg, #fff)', border: '0.5px solid var(--border-col, #e8e3dc)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#D4501A', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{p.timing}</div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary, #c0c0c0)', marginBottom: '4px' }}>{p.what}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #888)', lineHeight: 1.55 }}>{p.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuitTab({ quitDays, onBack }: { quitDays: number | null; onBack: () => void }) {
  const days = quitDays ?? 0
  const milestones = [
    { days: 3,  label: 'Day 3 — Nicotine clearing' },
    { days: 7,  label: 'Week 1' },
    { days: 14, label: 'Day 14 — Habit breaking' },
    { days: 30, label: 'Day 30 — Lung function' },
    { days: 99, label: 'Race Day — Job done' },
  ]
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #f5f3ef)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Quit tracker" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <div style={{ background: 'var(--card-bg, #fff)', border: '0.5px solid #1a3a1a', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '3.5rem', color: '#4a9a5a', lineHeight: 1, fontWeight: 500 }}>{days}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#4a9a5a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Smoke-free days</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted, #888)', lineHeight: 1.55 }}>Your aerobic efficiency is already improving.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {milestones.map(m => (
                <div key={m.days} style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', padding: '3px 10px', borderRadius: '20px', border: `0.5px solid ${days >= m.days ? '#2a5a2a' : '#222'}`, color: days >= m.days ? '#4a9a5a' : '#444' }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <InfoBox>
          <strong style={{ color: 'var(--text-secondary, #c0c0c0)' }}>What quitting does to your running:</strong><br /><br />
          <span style={{ color: '#D4501A' }}>48 hours</span> — CO leaves bloodstream. O₂ delivery improves immediately.<br />
          <span style={{ color: '#D4501A' }}>Week 1–2</span> — Resting HR starts dropping. Recovery improves noticeably.<br />
          <span style={{ color: '#D4501A' }}>Week 3–4</span> — Aerobic efficiency measurably better. Zone 2 feels easier.<br />
          <span style={{ color: '#D4501A' }}>Month 2+</span> — Cardiac drift reduces. That late-run HR creep? Less of it.<br /><br />
          <strong style={{ color: 'var(--text-secondary, #c0c0c0)' }}>You quit 99 days before a 100km race. That's an upgrade.</strong>
        </InfoBox>
      </div>
    </div>
  )
}
