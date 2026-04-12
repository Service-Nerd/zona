'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { Plan, Week } from '@/types/plan'
import PlanChart from '@/components/training/PlanChart'
import PlanCalendar from '@/components/training/PlanCalendar'
import StravaPanel from '@/components/strava/StravaPanel'
import { createClient } from '@/lib/supabase/client'
import { fetchPlanFromUrl, DEFAULT_GIST_URL, getCurrentWeek } from '@/lib/plan'

type Screen = 'today' | 'plan' | 'coach' | 'strava' | 'me' | 'calendar' | 'session' | 'admin'

// ── HR zone constants — defined here so available to all components ────────
const DEFAULT_ZONE_BOUNDARIES = [46, 60, 73, 87, 100] // upper HRR% per zone
const DEFAULT_ZONE_FLOOR = 33                          // lower HRR% of Z1

// ── Icons ─────────────────────────────────────────────────────────────────

function IconToday({ active }: { active: boolean }) {
  const c = active ? '#5BC0BE' : '#3A506B'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  )
}

function IconPlan({ active }: { active: boolean }) {
  const c = active ? '#5BC0BE' : '#3A506B'
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
  const c = active ? '#5BC0BE' : '#3A506B'
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
  const c = active ? '#5BC0BE' : '#3A506B'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.2" />
      <polyline points="11,7 11,11 14,13" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Layout shell ──────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [screen, setScreen] = useState<Screen>('today')
  const [showMe, setShowMe] = useState(false)
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null)
  const [quitDays, setQuitDays] = useState<number | null>(null)
  const [smokeTrackerEnabled, setSmokeTrackerEnabled] = useState(false)
  const [quitDate, setQuitDate] = useState<string>('')
  const [resetPhrase, setResetPhrase] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('light')
  const [appReady, setAppReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [preferredUnits, setPreferredUnits] = useState<'km' | 'mi'>('km')
  const [restingHR, setRestingHR] = useState<number | null>(null)
  const [maxHR, setMaxHR] = useState<number | null>(null)
  const [zoneBoundaries, setZoneBoundaries] = useState<number[]>([DEFAULT_ZONE_FLOOR, ...DEFAULT_ZONE_BOUNDARIES])

  // Impersonation state
  const [impersonating, setImpersonating] = useState<{ userId: string; name: string } | null>(null)

  // Global overrides — fetched once, shared across all screens
  const [allOverrides, setAllOverrides] = useState<{ week_n: number; original_day: string; new_day: string }[]>([])
  const [overridesReady, setOverridesReady] = useState(false)

  // All completions — fetched once at top level, refreshed on save
  const [allCompletions, setAllCompletions] = useState<Record<number, Record<string, any>>>({})

  const [stravaRuns, setStravaRuns] = useState<any[] | null>(null)
  const [stravaLoading, setStravaLoading] = useState(true)
  const [stravaConnected, setStravaConnected] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Handle strava OAuth redirect result
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      setStravaConnected(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  const initials = (plan?.meta?.athlete ?? 'RS')
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
          supabase.from('user_settings').select('strava_refresh_token, smoke_tracker_enabled, quit_date, gist_url, has_onboarded, is_admin, preferred_units, resting_hr, max_hr, zone_boundaries').eq('id', user.id).single(),
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

        const data = settingsRes.data

        // Load plan from user's gist_url, fallback to default
        const gistUrl = data?.gist_url || DEFAULT_GIST_URL
        const loadedPlan = await fetchPlanFromUrl(gistUrl)
        setPlan(loadedPlan)

        // Admin flag
        if (data?.is_admin) setIsAdmin(true)

        // Units preference
        if (data?.preferred_units === 'mi') setPreferredUnits('mi')

        // HR data
        if (data?.resting_hr) setRestingHR(data.resting_hr)
        if (data?.max_hr) setMaxHR(data.max_hr)
        if (data?.zone_boundaries) {
          try {
            const parsed = typeof data.zone_boundaries === 'string' ? JSON.parse(data.zone_boundaries) : data.zone_boundaries
            if (Array.isArray(parsed) && parsed.length === 5) setZoneBoundaries(parsed)
          } catch {}
        }

        // Show welcome screen if not yet onboarded
        if (!data?.has_onboarded) {
          setShowWelcome(true)
        }

        setOverridesReady(true)
        setAppReady(true)

        if (data?.smoke_tracker_enabled && data?.quit_date) {
          setSmokeTrackerEnabled(true)
          setQuitDate(data.quit_date)
          const days = Math.max(0, Math.floor((Date.now() - new Date(data.quit_date).getTime()) / 86400000))
          setQuitDays(days)
        }

        if (!data?.strava_refresh_token) { setStravaLoading(false); return }

        // Refresh token via server-side route — keeps client secret safe
        const tokenRes = await fetch('/api/strava/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        })
        if (!tokenRes.ok) { setStravaLoading(false); return }
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
      root.setAttribute('data-theme', 'dark')
      root.style.setProperty('--bg', '#0B132B')
      root.style.setProperty('--card-bg', '#162040')
      root.style.setProperty('--border-col', '#1e2e55')
      root.style.setProperty('--text-primary', '#F7F9FB')
      root.style.setProperty('--text-secondary', '#A0AEC0')
      root.style.setProperty('--text-muted', '#3A506B')
      root.style.setProperty('--nav-bg', '#0B132B')
      root.style.setProperty('--accent', '#5BC0BE')
      root.style.setProperty('--accent-amber', '#F2C14E')
      root.style.setProperty('--input-bg', '#162040')
    } else {
      root.setAttribute('data-theme', 'light')
      root.style.setProperty('--bg', '#F7F9FB')
      root.style.setProperty('--card-bg', '#ffffff')
      root.style.setProperty('--border-col', '#E2E8F0')
      root.style.setProperty('--text-primary', '#0B132B')
      root.style.setProperty('--text-secondary', '#3A506B')
      root.style.setProperty('--text-muted', '#94A3B8')
      root.style.setProperty('--nav-bg', '#F7F9FB')
      root.style.setProperty('--accent', '#5BC0BE')
      root.style.setProperty('--accent-amber', '#F2C14E')
      root.style.setProperty('--input-bg', '#F7F9FB')
    }
  }

  async function dismissWelcome() {
    setShowWelcome(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({ id: user.id, has_onboarded: true, updated_at: new Date().toISOString() })
    } catch {}
  }

  async function impersonateUser(userId: string, name: string) {
    try {
      // Load their plan
      const { data: settings } = await supabase.from('user_settings').select('gist_url').eq('id', userId).single()
      const gistUrl = settings?.gist_url || DEFAULT_GIST_URL
      const loadedPlan = await fetchPlanFromUrl(gistUrl)
      setPlan(loadedPlan)

      // Load their overrides
      const { data: overrides } = await supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', userId)
      setAllOverrides(overrides ?? [])

      // Load their completions
      const { data: completions } = await supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, strava_activity_name').eq('user_id', userId)
      if (completions) {
        const map: Record<number, Record<string, any>> = {}
        completions.forEach((r: any) => {
          if (!map[r.week_n]) map[r.week_n] = {}
          map[r.week_n][r.session_day] = r
        })
        setAllCompletions(map)
      }

      setImpersonating({ userId, name })
      setScreen('today')
    } catch (e) {
      console.error('Impersonation failed', e)
    }
  }

  async function exitImpersonation() {
    // Reload own data
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: settings } = await supabase.from('user_settings').select('gist_url').eq('id', user.id).single()
    const gistUrl = settings?.gist_url || DEFAULT_GIST_URL
    const loadedPlan = await fetchPlanFromUrl(gistUrl)
    setPlan(loadedPlan)

    const { data: overrides } = await supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id)
    setAllOverrides(overrides ?? [])

    const { data: completions } = await supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, strava_activity_name').eq('user_id', user.id)
    if (completions) {
      const map: Record<number, Record<string, any>> = {}
      completions.forEach((r: any) => {
        if (!map[r.week_n]) map[r.week_n] = {}
        map[r.week_n][r.session_day] = r
      })
      setAllCompletions(map)
    }

    setImpersonating(null)
    setScreen('today')
  }

  const currentWeekIndex = plan ? plan.weeks.findIndex(w => w.type === 'current') : 0
  const [viewWeekIndex, setViewWeekIndex] = useState(0)

  // Update to current week once plan loads
  useEffect(() => {
    if (plan) {
      const idx = plan.weeks.findIndex(w => w.type === 'current')
      setViewWeekIndex(idx >= 0 ? idx : 0)
    }
  }, [plan])

  const raceDate = new Date('2026-07-11')
  const fiftyKDate = new Date('2026-05-10')
  const now = new Date()
  const daysToRace = Math.max(0, Math.ceil((raceDate.getTime() - now.getTime()) / 86400000))
  const daysTo50k = Math.max(0, Math.ceil((fiftyKDate.getTime() - now.getTime()) / 86400000))

  const s: React.CSSProperties = {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg, #F7F9FB)',
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
        background: 'var(--bg, #F7F9FB)', maxWidth: '480px', margin: '0 auto', gap: '0',
      }}>
        {/* ZONA wordmark — O has zone arc */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '38px', fontWeight: 500, letterSpacing: '0.08em',
            color: '#5BC0BE', lineHeight: 1,
          }}>Z</span>
          {/* Custom O with zone arc */}
          <svg width="28" height="38" viewBox="0 0 28 38" fill="none" style={{ margin: '0 1px' }}>
            <text x="14" y="30" textAnchor="middle"
              fontFamily="'Space Grotesk', sans-serif"
              fontSize="38" fontWeight="500" letterSpacing="0"
              fill="#5BC0BE">O</text>
            {/* Zone arc overlay — sits on top right of O */}
            <path d="M 21 8 A 9 9 0 0 1 26 16" stroke="#F7F9FB" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 21 8 A 9 9 0 0 1 26 16" stroke="#5BC0BE" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="3 3" opacity="0.6" />
          </svg>
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: '38px', fontWeight: 500, letterSpacing: '0.08em',
            color: '#5BC0BE', lineHeight: 1,
          }}>NA</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: '11px',
          color: 'var(--text-muted, #94A3B8)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '52px',
        }}>
          effort-first training
        </div>

        {/* Spinner */}
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="8" fill="none" stroke="var(--border-col, #E2E8F0)" strokeWidth="1.5" />
          <circle cx="11" cy="11" r="8" fill="none" stroke="#5BC0BE" strokeWidth="1.5"
            strokeDasharray="20 34" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate"
              from="0 11 11" to="360 11 11" dur="0.9s" repeatCount="indefinite" />
            </circle>
        </svg>
      </div>
    )
  }

  // Welcome screen — shown once on first login
  if (showWelcome) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg, #F7F9FB)', maxWidth: '480px', margin: '0 auto',
        padding: '32px 24px',
      }}>
        {/* ZONA wordmark */}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '36px', fontWeight: 500, letterSpacing: '0.08em', color: '#5BC0BE', marginBottom: '8px' }}>
          ZONA
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '48px' }}>
          effort-first training
        </div>

        {/* Welcome message */}
        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif", letterSpacing: '-0.3px', marginBottom: '16px', lineHeight: 1.3 }}>
            Your plan is ready.
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.7, marginBottom: '12px' }}>
            ZONA keeps track of your sessions, adapts when things shift, and keeps you focused on what matters — finishing.
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.7, marginBottom: '48px' }}>
            Train with intention. The rest follows.
          </div>

          <button
            onClick={dismissWelcome}
            style={{
              width: '100%', padding: '16px',
              background: '#5BC0BE', color: '#fff',
              border: 'none', borderRadius: '14px',
              fontFamily: "'Inter', sans-serif", fontSize: '13px',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontWeight: 500,
            }}
          >
            Let's go
          </button>
        </div>
      </div>
    )
  }

  // Plan not loaded yet (shouldn't normally reach here)
  if (!plan) return null

  const currentWeek = getCurrentWeek(plan.weeks)

  return (
    <div style={s}>

      {/* Impersonation banner */}
      {impersonating && (
        <div style={{
          background: '#5BC0BE', padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 2000,
        }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Viewing as {impersonating.name}
          </div>
          <button onClick={exitImpersonation} style={{
            background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '6px',
            color: '#fff', fontFamily: "'Inter', sans-serif", fontSize: '11px',
            letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px',
            cursor: 'pointer',
          }}>
            Exit
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {screen === 'today'    && <TodayScreen plan={plan} weekIndex={viewWeekIndex} onWeekChange={setViewWeekIndex} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} daysToRace={daysToRace} daysTo50k={daysTo50k} stravaRuns={stravaRuns ?? []} onOpenMe={() => setScreen('me')} initials={initials} allOverrides={allOverrides} overridesReady={overridesReady} onOpenCalendar={() => setScreen('calendar')} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} allCompletions={allCompletions} preferredUnits={preferredUnits} zone2Ceiling={plan?.meta?.zone2_ceiling ?? 145} onManualSaved={refreshCompletions} />}
        {screen === 'plan'     && <PlanScreen plan={plan} stravaRuns={stravaRuns ?? []} onOpenMe={() => setScreen('me')} initials={initials} allOverrides={allOverrides} allCompletions={allCompletions} onOverrideChange={setAllOverrides} onOpenCalendar={() => setScreen('calendar')} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} />}
        {screen === 'coach'    && <CoachScreen plan={plan} currentWeek={currentWeek} runs={stravaRuns} stravaLoading={stravaLoading} onOpenMe={() => setScreen('me')} initials={initials} />}
        {screen === 'strava'   && <StravaScreen runs={stravaRuns} loading={stravaLoading} connected={stravaConnected} onOpenMe={() => setScreen('me')} initials={initials} />}
        {screen === 'me'       && <MeScreen initials={initials} athlete={plan.meta.athlete ?? 'Russell Shear'} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} quitDate={quitDate} onSmokeTrackerChange={(enabled: boolean, date: string) => { setSmokeTrackerEnabled(enabled); setQuitDate(date); if (enabled && date) { const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)); setQuitDays(days) } else { setQuitDays(null) } }} resetPhrase={resetPhrase} onSaveMental={saveMental} theme={theme} onThemeChange={saveTheme} onBack={() => setScreen('today')} isAdmin={isAdmin} onOpenAdmin={() => setScreen('admin')} preferredUnits={preferredUnits} onUnitsChange={async (u: 'km' | 'mi') => { setPreferredUnits(u); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_units: u, updated_at: new Date().toISOString() }) } catch {} }} restingHR={restingHR} maxHR={maxHR} zoneBoundaries={zoneBoundaries} onHRChange={async (rhr: number, mhr: number, bounds: number[]) => { setRestingHR(rhr); setMaxHR(mhr); setZoneBoundaries(bounds); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, resting_hr: rhr, max_hr: mhr, zone_boundaries: JSON.stringify(bounds), updated_at: new Date().toISOString() }) } catch {} }} />}
        {screen === 'calendar' && <CalendarOverlay plan={plan} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} allCompletions={allCompletions} onBack={() => setScreen('today')} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} />}
        {screen === 'session'  && activeSessionData && <SessionScreen session={activeSessionData} preloadedRuns={stravaRuns ?? []} onBack={() => setScreen(activeSessionData.fromCalendar ? 'calendar' : 'today')} onSaved={impersonating ? undefined : refreshCompletions} preferredUnits={preferredUnits} zone2Ceiling={plan?.meta?.zone2_ceiling ?? 145} />}
        {screen === 'admin'    && <AdminScreen onBack={() => setScreen('me')} onImpersonate={impersonateUser} />}
      </div>

      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px',
        display: 'flex', alignItems: 'center',
        background: 'var(--nav-bg, #F7F9FB)', borderTop: '0.5px solid var(--border-col, #E2E8F0)',
        padding: '10px 0 max(16px, env(safe-area-inset-bottom))',
        zIndex: 3000,
      }}>
        {(['today', 'plan', 'coach', 'strava'] as Screen[]).map(id => {
          const labels: Record<Screen, string> = { today: 'Today', plan: 'Plan', coach: 'Coach', strava: 'Strava', me: 'Me', calendar: 'Calendar', session: 'Session', admin: 'Admin' }
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
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: active ? '#5BC0BE' : '#3A506B' }}>
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
        width: '34px', height: '34px', borderRadius: '50%', background: '#5BC0BE',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: 'var(--text-primary, #0B132B)',
        border: 'none', cursor: 'pointer', flexShrink: 0, marginTop: '2px',
      }}>
        {initials}
      </button>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif", letterSpacing: '-0.3px' }}>{title}</div>
        {sub && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '3px', letterSpacing: '0.04em' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 16px', marginBottom: '8px', marginTop: '20px' }}>
      {children}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', margin: '0 12px', ...style }}>
      {children}
    </div>
  )
}

// ── Dot / accent colours ──────────────────────────────────────────────────

const TYPE_DOT: Record<string, string> = {
  easy:     '#5BC0BE',
  quality:  '#F2C14E',
  run:      '#5BC0BE',
  race:     '#5BC0BE',
  strength: '#3A506B',
  rest:     'transparent',
}

const TYPE_ACCENT: Record<string, string> = {
  easy:     '#5BC0BE',
  quality:  '#F2C14E',
  run:      '#5BC0BE',
  race:     '#5BC0BE',
  strength: '#3A506B',
  rest:     '#3A506B',
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

function SessionPopupInner({ session, weekTheme, weekN, preloadedRuns, onClose, onSaved, preferredUnits, zone2Ceiling }: {
  session: any; weekTheme: string; weekN: number; preloadedRuns: any[]
  onClose: () => void; onSaved?: () => void
  preferredUnits: 'km' | 'mi'; zone2Ceiling: number
}) {
  const [view, setView] = useState<'detail' | 'complete' | 'skip' | 'manual'>('detail')
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())
  const [loadingClaimed, setLoadingClaimed] = useState(false)
  const [guidance, setGuidance] = useState<any | null>(null)
  const [manualDistance, setManualDistance] = useState('')
  const [manualDuration, setManualDuration] = useState('')
  const [manualNotes, setManualNotes] = useState('')
  const supabase = createClient()

  const isPast = session.isPast
  const completion = session.completion
  const isComplete = completion?.status === 'complete'
  const isSkipped = completion?.status === 'skipped'

  // Fetch session guidance from Supabase
  useEffect(() => {
    async function loadGuidance() {
      try {
        // Try phase-specific first, fall back to null phase
        const { data } = await supabase
          .from('session_guidance')
          .select('*')
          .eq('session_type', session.type)
          .order('phase', { ascending: false, nullsFirst: false })
          .limit(2)
        if (data && data.length > 0) setGuidance(data[0])
      } catch {}
    }
    if (session.type && session.type !== 'rest') loadGuidance()
  }, [session.type])

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

  async function saveManualRun() {
    if (!manualDistance && !manualDuration) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const distKm = manualDistance ? parseFloat(manualDistance) : null
      await supabase.from('session_completions').upsert({
        user_id: user.id,
        week_n: weekN,
        session_day: session.key,
        status: 'complete',
        strava_activity_id: null,
        strava_activity_name: manualNotes || `Manual log · ${manualDuration || ''}`,
        strava_activity_km: distKm,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      onSaved?.()
      onClose()
    } catch {} finally { setSaving(false) }
  }

  // Pace bracket calculation from zone2_ceiling using HRR
  function getPaceBracket(): string | null {
    if (session.type !== 'easy' && session.type !== 'run') return null
    // Approximate pace from zone2_ceiling — lower HR = slower pace
    // Zone 2 for a HM 1:48 runner is roughly 6:00–7:30/km
    // We use zone2_ceiling to estimate: 145 bpm ≈ 6:30/km, adjust ±15s per 5bpm
    const baseHR = 145
    const basePaceSecPerKm = 390 // 6:30/km
    const secondsPerBpm = 3
    const diffBpm = zone2Ceiling - baseHR
    const loPaceKm = basePaceSecPerKm + (5 * secondsPerBpm) - (diffBpm * secondsPerBpm)
    const hiPaceKm = basePaceSecPerKm + (15 * secondsPerBpm) - (diffBpm * secondsPerBpm)

    function fmtPace(secPerKm: number, units: 'km' | 'mi'): string {
      const sec = units === 'mi' ? secPerKm * 1.60934 : secPerKm
      const m = Math.floor(sec / 60)
      const s = Math.round(sec % 60)
      return `${m}:${String(s).padStart(2, '0')}`
    }

    const unit = preferredUnits === 'mi' ? '/mi' : '/km'
    return `${fmtPace(loPaceKm, preferredUnits)}–${fmtPace(hiPaceKm, preferredUnits)}${unit}`
  }

  const paceBracket = getPaceBracket()

  const typeConfig: Record<string, { color: string; label: string }> = {
    easy:     { color: '#378ADD', label: 'Easy run — Zone 2' },
    quality:  { color: '#5BC0BE', label: 'Quality session' },
    run:      { color: '#5BC0BE', label: 'Long run' },
    race:     { color: '#ff7777', label: 'Race' },
    strength: { color: '#3A506B', label: 'Strength' },
  }
  const config = typeConfig[session.type] ?? typeConfig['easy']

  return (
    <>
      {/* Header */}
      <div style={{ padding: '12px 18px 8px', borderBottom: '0.5px solid var(--border-col, #E2E8F0)' }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: config.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
          {session.day} · {session.date}
          {isComplete && <span style={{ color: '#3A506B', marginLeft: '8px' }}>✓ Complete</span>}
          {isSkipped && <span style={{ color: 'var(--text-muted, #94A3B8)', marginLeft: '8px' }}>Skipped</span>}
        </div>
        {session.detail && <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #666)', marginTop: '2px' }}>{session.detail}</div>}
      </div>

      {view === 'detail' && (
        <>
          {/* Week theme */}
          <div style={{ padding: '12px 18px', background: 'var(--bg, #F7F9FB)', borderBottom: '0.5px solid var(--border-col, #E2E8F0)' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Week focus</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary, #555)', lineHeight: 1.5 }}>{weekTheme}</div>
          </div>

          {/* Zone + pace bracket */}
          {(session.type === 'easy' || session.type === 'run' || session.type === 'quality') && (
            <div style={{ margin: '14px 18px 0', background: 'var(--bg, #F7F9FB)', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid var(--border-col, #E2E8F0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', marginBottom: '3px' }}>
                    {session.type === 'quality' ? 'Target HR zone' : 'Zone 2 ceiling'}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 500, color: session.type === 'quality' ? '#5BC0BE' : '#378ADD' }}>
                    {session.type === 'quality' ? '155–165' : zone2Ceiling}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginLeft: '4px' }}>bpm</span>
                  </div>
                </div>
                {paceBracket && session.type !== 'quality' && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', marginBottom: '3px' }}>Est. pace bracket</div>
                    <div style={{ fontSize: '18px', fontWeight: 500, color: '#378ADD' }}>{paceBracket}</div>
                  </div>
                )}
              </div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)' }}>
                {session.type === 'quality' ? 'Controlled efforts. Not maximal. Warm up 15 min first.' : 'Walk immediately if HR exceeds this. No exceptions.'}
              </div>
            </div>
          )}

          {/* Why this session */}
          {guidance && (
            <div style={{ padding: '16px 18px 0' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: config.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Why this session</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary, #3A506B)', lineHeight: 1.7, marginBottom: '16px' }}>
                {guidance.why}
              </div>

              {guidance.what && (
                <>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>What</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary, #3A506B)', lineHeight: 1.6, marginBottom: '16px' }}>
                    {guidance.what}
                  </div>
                </>
              )}

              {guidance.how && (
                <>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>How</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary, #3A506B)', lineHeight: 1.6, marginBottom: '8px' }}>
                    {guidance.how}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ padding: '16px 18px 24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!isComplete && !isSkipped && !session.isFuture && (
              <>
                <button onClick={() => setView('complete')} style={{ flex: 1, minWidth: '120px', background: 'rgba(91,192,190,0.15)', color: '#3A506B', border: '0.5px solid rgba(74,124,111,0.4)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold' }}>
                  Log with Strava
                </button>
                <button onClick={() => setView('manual')} style={{ flex: 1, minWidth: '120px', background: 'rgba(91,192,190,0.08)', color: '#3A506B', border: '0.5px solid rgba(74,124,111,0.3)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Log manually
                </button>
                <button onClick={() => setView('skip')} style={{ width: '100%', background: 'none', color: 'var(--text-muted, #94A3B8)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '12px', fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                  Skip
                </button>
              </>
            )}
            {(isComplete || isSkipped) && (
              <button onClick={() => setView('complete')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #94A3B8)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', cursor: 'pointer' }}>
                Update
              </button>
            )}
            {session.isFuture && !isComplete && !isSkipped && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #444)', textAlign: 'center', padding: '12px', width: '100%' }}>
                Available to log on {session.date}
              </div>
            )}
            {isPast && !isComplete && !isSkipped && !session.isFuture && (
              <button onClick={() => setView('complete')} style={{ flex: 1, background: 'var(--bg, #F7F9FB)', color: 'var(--text-muted, #666)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', cursor: 'pointer' }}>
                Log retroactively
              </button>
            )}
          </div>
        </>
      )}

      {/* Strava log view */}
      {view === 'complete' && (
        <div style={{ padding: '16px 18px 24px' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: '#3A506B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Link a Strava activity</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #666)', marginBottom: '8px' }}>Optional — select from recent runs</div>
          {loadingClaimed ? (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #444)', padding: '12px 0' }}>Loading activities...</div>
          ) : stravaRuns.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
              {stravaRuns.slice(0, 20).map((run: any) => {
                const isSelected = selectedActivity?.id === run.id
                return (
                  <div key={run.id} onClick={() => setSelectedActivity(isSelected ? null : run)} style={{
                    background: isSelected ? 'rgba(91,192,190,0.1)' : 'var(--bg, #F7F9FB)',
                    border: `0.5px solid ${isSelected ? 'rgba(91,192,190,0.4)' : 'var(--border-col, #E2E8F0)'}`,
                    borderRadius: '12px', padding: '10px 12px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary, #0B132B)', fontWeight: 500 }}>{run.name}</div>
                      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>
                        {new Date(run.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {(run.distance / 1000).toFixed(1)}km {run.average_heartrate ? `· ${Math.round(run.average_heartrate)} bpm` : ''}
                      </div>
                    </div>
                    {isSelected && <span style={{ color: '#3A506B', fontSize: '16px' }}>✓</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #444)', padding: '12px 0', marginBottom: '8px' }}>No Strava activities found near this session date</div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #94A3B8)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => saveCompletion('complete')} disabled={saving} style={{ flex: 2, background: 'rgba(91,192,190,0.15)', color: '#3A506B', border: '0.5px solid rgba(74,124,111,0.4)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Confirm complete'}
            </button>
          </div>
        </div>
      )}

      {/* Manual log view */}
      {view === 'manual' && (
        <div style={{ padding: '16px 18px 24px' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: '#3A506B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Log manually</div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', marginBottom: '6px' }}>Distance ({preferredUnits})</div>
              <input
                type="number"
                inputMode="decimal"
                placeholder={`e.g. ${preferredUnits === 'km' ? '8.5' : '5.3'}`}
                value={manualDistance}
                onChange={e => setManualDistance(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg, #F7F9FB)',
                  border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '8px',
                  padding: '12px', color: 'var(--text-primary, #0B132B)',
                  fontFamily: "'Inter', sans-serif", fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', marginBottom: '6px' }}>Duration</div>
              <input
                type="text"
                placeholder="e.g. 1:05:30"
                value={manualDuration}
                onChange={e => setManualDuration(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg, #F7F9FB)',
                  border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '8px',
                  padding: '12px', color: 'var(--text-primary, #0B132B)',
                  fontFamily: "'Inter', sans-serif", fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', marginBottom: '6px' }}>Notes (optional)</div>
            <textarea
              placeholder="How did it go?"
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              rows={2}
              style={{
                width: '100%', background: 'var(--bg, #F7F9FB)',
                border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '8px',
                padding: '12px', color: 'var(--text-primary, #0B132B)',
                fontFamily: "'Inter',sans-serif", fontSize: '13px',
                outline: 'none', resize: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #94A3B8)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', cursor: 'pointer' }}>Back</button>
            <button onClick={saveManualRun} disabled={saving || (!manualDistance && !manualDuration)} style={{ flex: 2, background: 'rgba(91,192,190,0.15)', color: '#3A506B', border: '0.5px solid rgba(74,124,111,0.4)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold', opacity: saving || (!manualDistance && !manualDuration) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : 'Save run'}
            </button>
          </div>
        </div>
      )}

      {/* Skip view */}
      {view === 'skip' && (
        <div style={{ padding: '16px 18px 24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary, #555)', lineHeight: 1.6, marginBottom: '20px' }}>
            Mark this session as skipped? It will show in your log.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted, #94A3B8)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => saveCompletion('skipped')} disabled={saving} style={{ flex: 2, background: 'var(--bg, #F7F9FB)', color: 'var(--text-muted, #666)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px', fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
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
    if (comp?.status === 'complete') return '#3A506B'
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
      style={{ borderBottom: '0.5px solid var(--border-col, #E2E8F0)', background: 'var(--bg, #F7F9FB)', paddingBottom: '10px' }}
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
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
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
                fontFamily: "'Inter', sans-serif", fontSize: '10px',
                color: isSelected ? '#5BC0BE' : isToday ? '#5BC0BE' : '#444',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {DOW_LETTER[key]}
              </span>

              {/* Date circle */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? '#5BC0BE' : isToday && !isSelected ? 'rgba(212,80,26,0.12)' : 'transparent',
                border: isToday && !isSelected ? '1px solid rgba(212,80,26,0.35)' : 'none',
                transition: 'background 0.15s',
              }}>
                <span style={{
                  fontFamily: "'Inter', sans-serif", fontSize: '13px',
                  color: isSelected ? '#fff' : isToday ? '#5BC0BE' : dateNum ? '#999' : '#2a2a2a',
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

// ── MANUAL RUN MODAL ─────────────────────────────────────────────────────

function ManualRunModal({ weekN, sessionKey, preferredUnits, onClose, onSaved }: {
  weekN: number
  sessionKey: string | null
  preferredUnits: 'km' | 'mi'
  onClose: () => void
  onSaved: () => void
}) {
  const [distWhole, setDistWhole] = useState(5)
  const [distDecimal, setDistDecimal] = useState(0)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(30)
  const [seconds, setSeconds] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Trigger slide-up animation on mount
    requestAnimationFrame(() => setVisible(true))
  }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]

  const distanceStr = `${distWhole}.${distDecimal}`
  const durationStr = `${hours > 0 ? hours + 'h ' : ''}${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
  const hasData = distWhole > 0 || distDecimal > 0 || hours > 0 || minutes > 0 || seconds > 0

  async function save() {
    if (!hasData) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const dist = parseFloat(distanceStr)
      const distKm = preferredUnits === 'mi' ? dist * 1.60934 : dist
      const key = sessionKey ?? todayKey
      await supabase.from('session_completions').upsert({
        user_id: user.id,
        week_n: weekN,
        session_day: key,
        status: 'complete',
        strava_activity_id: null,
        strava_activity_name: notes || `Manual run · ${distanceStr}${preferredUnits} · ${durationStr}`,
        strava_activity_km: +distKm.toFixed(1),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      setVisible(false)
      setTimeout(onSaved, 300)
    } catch {} finally { setSaving(false) }
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: '10px',
    color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '8px',
  }

  const stepperBtn = (onClick: () => void, label: string): React.CSSProperties => ({
    width: '36px', height: '36px', borderRadius: '8px',
    background: 'var(--bg, #F7F9FB)', border: '0.5px solid var(--border-col, #E2E8F0)',
    color: 'var(--text-primary, #0B132B)', fontSize: '18px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', sans-serif", flexShrink: 0,
  })

  function Stepper({ label, value, min, max, step = 1, onChange, pad = false }: {
    label: string; value: number; min: number; max: number
    step?: number; onChange: (v: number) => void; pad?: boolean
  }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <div style={labelStyle}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}>
          <button onClick={() => onChange(Math.max(min, value - step))} style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: 'var(--bg, #F7F9FB)', border: '0.5px solid var(--border-col, #E2E8F0)', color: 'var(--text-primary, #0B132B)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>−</button>
          <div style={{ minWidth: '34px', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '20px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', flexShrink: 0 }}>
            {pad ? String(value).padStart(2, '0') : value}
          </div>
          <button onClick={() => onChange(Math.min(max, value + step))} style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: 'var(--bg, #F7F9FB)', border: '0.5px solid var(--border-col, #E2E8F0)', color: 'var(--text-primary, #0B132B)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>+</button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        transition: 'background 0.3s',
      }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg, #ffffff)', width: '100%', maxWidth: '480px',
          borderRadius: '20px 20px 0 0', padding: '8px 20px 24px',
          border: '0.5px solid var(--border-col, #E2E8F0)',
          marginBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          maxHeight: 'calc(90vh - 64px)', overflowY: 'auto',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-col, #E2E8F0)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #0B132B)' }}>Log a run</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Manual entry · no Strava needed</div>
          </div>
          <button onClick={handleClose} style={{ background: 'rgba(0,0,0,0.06)', border: 'none', color: 'var(--text-muted, #94A3B8)', fontSize: '16px', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Distance */}
        <div style={{ marginBottom: '24px' }}>
          <div style={labelStyle}>Distance ({preferredUnits})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', background: 'var(--bg, #F7F9FB)', borderRadius: '12px', border: '0.5px solid var(--border-col, #E2E8F0)', overflow: 'hidden' }}>
            {/* Whole number */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 8px' }}>
              <button onClick={() => setDistWhole(Math.max(0, distWhole - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary, #0B132B)', fontSize: '18px', cursor: 'pointer' }}>−</button>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '28px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', minWidth: '32px', textAlign: 'center' }}>{distWhole}</span>
              <button onClick={() => setDistWhole(distWhole + 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary, #0B132B)', fontSize: '18px', cursor: 'pointer' }}>+</button>
            </div>
            {/* Decimal separator */}
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '28px', fontWeight: 500, color: 'var(--text-muted, #94A3B8)', padding: '0 4px' }}>.</div>
            {/* Decimal */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 8px' }}>
              <button onClick={() => setDistDecimal(Math.max(0, distDecimal - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary, #0B132B)', fontSize: '18px', cursor: 'pointer' }}>−</button>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '28px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', minWidth: '16px', textAlign: 'center' }}>{distDecimal}</span>
              <button onClick={() => setDistDecimal(Math.min(9, distDecimal + 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary, #0B132B)', fontSize: '18px', cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted, #94A3B8)', marginTop: '4px', textAlign: 'center' }}>{distanceStr} {preferredUnits}</div>
        </div>

        {/* Duration — CSS grid keeps all 3 steppers fully on screen */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Duration</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 16px 1fr 16px 1fr', alignItems: 'start', width: '100%' }}>
            <Stepper label="hrs" value={hours} min={0} max={12} onChange={setHours} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '24px', color: 'var(--text-muted, #94A3B8)', fontSize: '18px', fontFamily: "'Inter', sans-serif" }}>:</div>
            <Stepper label="min" value={minutes} min={0} max={59} onChange={setMinutes} pad />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '24px', color: 'var(--text-muted, #94A3B8)', fontSize: '18px', fontFamily: "'Inter', sans-serif" }}>:</div>
            <Stepper label="sec" value={seconds} min={0} max={59} step={5} onChange={setSeconds} pad />
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '20px' }}>
          <div style={labelStyle}>Notes (optional)</div>
          <textarea
            placeholder="How did it go?"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            style={{
              width: '100%', background: 'var(--bg, #F7F9FB)',
              border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '8px',
              padding: '12px', color: 'var(--text-primary, #0B132B)',
              fontFamily: "'Inter',sans-serif", fontSize: '13px',
              outline: 'none', resize: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          style={{
            width: '100%', padding: '16px',
            background: '#3A506B', color: '#fff',
            border: 'none', borderRadius: '14px',
            fontFamily: "'Inter', sans-serif", fontSize: '13px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer', fontWeight: 500,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : `Save · ${distanceStr}${preferredUnits} · ${durationStr}`}
        </button>
      </div>
    </div>
  )
}

// ── SESSION HERO ──────────────────────────────────────────────────────────

function SessionHero({ session, completion, onTap }: {
  session: SessionEntry; completion?: any; onTap: () => void
}) {
  const accent = TYPE_ACCENT[session.type] ?? '#5BC0BE'
  const isComplete = completion?.status === 'complete'
  const isSkipped = completion?.status === 'skipped'

  return (
    <div onClick={onTap} style={{
      margin: '12px 12px 0',
      background: isComplete ? 'rgba(91,192,190,0.06)' : isSkipped ? 'rgba(80,80,80,0.06)' : 'var(--card-bg, #ffffff)',
      borderRadius: '16px',
      border: `0.5px solid ${isComplete ? 'rgba(91,192,190,0.35)' : isSkipped ? '#2a2a2a' : 'var(--border-col, #E2E8F0)'}`,
      borderLeft: `4px solid ${isComplete ? '#3A506B' : isSkipped ? '#444' : accent}`,
      padding: '16px',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{
          fontFamily: "'Inter', sans-serif", fontSize: '10px',
          color: isComplete ? '#3A506B' : isSkipped ? '#555' : accent,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {session.today ? 'Today · ' : ''}{session.day} {session.date} · {TYPE_LABEL[session.type] ?? session.type}
        </span>
        {isComplete && (
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: '10px', letterSpacing: '0.08em',
            background: 'rgba(91,192,190,0.15)', color: '#3A506B',
            border: '0.5px solid rgba(74,124,111,0.4)',
            borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase',
          }}>✓ Done</span>
        )}
        {isSkipped && (
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: '10px', letterSpacing: '0.08em',
            background: 'rgba(80,80,80,0.12)', color: '#666',
            border: '0.5px solid #333',
            borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase',
          }}>Skipped</span>
        )}
      </div>

      <div style={{
        fontSize: '20px', fontWeight: 500, letterSpacing: '-0.3px',
        color: isSkipped ? 'var(--text-muted, #94A3B8)' : 'var(--text-primary, #0B132B)',
        lineHeight: 1.2, marginBottom: session.detail ? '6px' : '14px',
        textDecoration: isSkipped ? 'line-through' : 'none',
      }}>
        {session.title}
      </div>

      {session.detail && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginBottom: '14px' }}>
          {session.detail}
        </div>
      )}

      {isComplete && completion?.strava_activity_name && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#FC4C02', marginBottom: '12px' }}>
          ● {completion.strava_activity_name}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: "'Inter', sans-serif", fontSize: '12px',
          color: isComplete ? '#3A506B' : isSkipped ? '#555' : 'var(--text-muted, #94A3B8)',
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {isComplete ? 'View details' : isSkipped ? 'Update' : session.today ? 'Log this session' : 'View session'}
        </span>
        <span style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '18px' }}>›</span>
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
        background: 'var(--card-bg, #ffffff)', borderRadius: '16px',
        border: '0.5px solid var(--border-col, #E2E8F0)', padding: '20px 18px', marginBottom: '10px',
      }}>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
          No run today
        </div>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', lineHeight: 1.25, marginBottom: '8px', letterSpacing: '-0.3px' }}>
          {session?.type === 'rest' || !session ? 'Rest is the work.' : session.title}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.6 }}>
          {session?.type === 'rest' || !session
            ? "No session today. Adaptation happens here, not in the run."
            : 'No running today. Keep it easy, stay off the legs.'}
        </div>
      </div>

      {nextSession && (
        <div style={{
          background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
          border: '0.5px solid var(--border-col, #E2E8F0)', padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Next run · {nextSession.day} {nextSession.date}
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted, #94A3B8)', fontWeight: 500 }}>{nextSession.title}</div>
            {nextSession.detail && (
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>{nextSession.detail}</div>
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
    if (completion?.status === 'complete') return '#3A506B'
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
          fontFamily: "'Inter', sans-serif", fontSize: '10px',
          color: isCurrent ? '#5BC0BE' : '#333',
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
                fontFamily: "'Inter', sans-serif", fontSize: '12px',
                color: isToday ? '#5BC0BE' : '#555',
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
          background: 'var(--card-bg, #ffffff)',
          borderRadius: '16px',
          border: isCurrent ? '0.5px solid rgba(212,80,26,0.4)' : '0.5px solid var(--border-col, #1e2e55)',
          overflow: 'hidden',
          marginBottom: '10px',
        }}>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: '10px',
            color: isCurrent ? '#5BC0BE' : '#555',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '12px 12px 6px',
            borderBottom: '0.5px solid var(--border-col, #E2E8F0)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {label}
            {isCurrent && <span style={{ background: 'rgba(212,80,26,0.12)', color: '#5BC0BE', fontSize: '10px', padding: '2px 8px', borderRadius: '20px', border: '0.5px solid rgba(212,80,26,0.3)' }}>current</span>}
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
    <div style={{ minHeight: '100%', background: 'var(--bg, #F7F9FB)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 8px',
        borderBottom: '0.5px solid var(--border-col, #E2E8F0)',
        position: 'sticky', top: 0, background: 'var(--bg, #F7F9FB)', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onBack} style={{ border: 'none', color: '#5BC0BE', fontSize: '22px', cursor: 'pointer', padding: '0', lineHeight: 1 , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
          <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif", letterSpacing: '-0.3px' }}>
            Plan
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {[{ color: '#378ADD', label: 'Easy' }, { color: '#5BC0BE', label: 'Run' }, { color: '#3A506B', label: 'Done' }].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day header row — sticky below title */}
      <div style={{
        display: 'grid', gridTemplateColumns: '40px repeat(7, 1fr)',
        padding: '8px 12px 4px',
        position: 'sticky', top: '53px', background: 'var(--bg, #F7F9FB)', zIndex: 9,
        borderBottom: '0.5px solid var(--border-col, #E2E8F0)',
      }}>
        <div />
        {DOW_ORDER.map(key => (
          <div key={key} style={{ textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                    fontFamily: "'Inter', sans-serif", fontSize: '12px',
                    color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.06em', textTransform: 'uppercase',
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
                  fontFamily: "'Inter', sans-serif", fontSize: '12px',
                  color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.06em', textTransform: 'uppercase',
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

function TodayScreen({ plan, weekIndex, onWeekChange, quitDays, smokeTrackerEnabled, daysToRace, daysTo50k, stravaRuns, onOpenMe, initials, allOverrides, overridesReady, onOpenCalendar, onOpenSession, allCompletions, preferredUnits, zone2Ceiling, onManualSaved }: {
  plan: Plan; weekIndex: number; onWeekChange: (i: number) => void; quitDays: number | null
  smokeTrackerEnabled: boolean; daysToRace: number; daysTo50k: number
  stravaRuns: any[]; onOpenMe: () => void; initials: string
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  overridesReady: boolean
  onOpenCalendar?: () => void
  onOpenSession?: (s: any) => void
  allCompletions: Record<number, Record<string, any>>
  preferredUnits: 'km' | 'mi'
  zone2Ceiling: number
  onManualSaved?: () => void
}) {
  const currentWeek = plan.weeks[weekIndex]
  const weekNum = weekIndex + 1
  const totalWeeks = plan.weeks.length

  // Guard against empty plan (e.g. failed Gist fetch)
  if (!currentWeek) return (
    <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)' }}>
      Unable to load plan. Check your connection and try again.
    </div>
  )

  // Completions for this week — derived from shared allCompletions prop
  const completions = allCompletions[weekNum] ?? {}
  const [showManualLog, setShowManualLog] = useState(false)

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

  const selectedSession = sessions.find(s => s.key === selectedKey && s.type !== 'rest')
    ?? sessions.find(s => s.key === selectedKey)
    ?? null
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
          width: '32px', height: '32px', borderRadius: '50%', background: '#5BC0BE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Inter', sans-serif", fontSize: '12px', fontWeight: 500, color: 'var(--text-primary, #0B132B)',
          border: 'none', cursor: 'pointer', flexShrink: 0,
        }}>
          {initials}
        </button>
        {/* Brand slug — centre */}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 500, color: '#5BC0BE', letterSpacing: '0.06em' }}>
          ZONA
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

      {/* Manual log button — always visible */}
      <button
        onClick={() => setShowManualLog(true)}
        style={{
          margin: '10px 12px 0', width: 'calc(100% - 24px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'rgba(212,80,26,0.08)',
          border: '0.5px solid rgba(212,80,26,0.3)',
          borderRadius: '12px', padding: '13px',
          fontFamily: "'Inter', sans-serif", fontSize: '12px',
          color: '#5BC0BE', letterSpacing: '0.06em',
          textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <line x1="7" y1="2" x2="7" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Log a run manually
      </button>

      {/* Manual log modal */}
      {showManualLog && (
        <ManualRunModal
          weekN={weekNum}
          sessionKey={selectedSession?.today ? selectedSession.key : null}
          preferredUnits={preferredUnits}
          onClose={() => setShowManualLog(false)}
          onSaved={() => { setShowManualLog(false); onManualSaved?.() }}
        />
      )}



      {/* Week focus */}
      {weekTheme && (
        <div style={{ margin: '10px 12px 0', padding: '10px 14px', background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #E2E8F0)' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '3px' }}>Week focus</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.5 }}>{weekTheme}</div>
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
          <div key={i} style={{ flex: 1, background: 'var(--card-bg, #ffffff)', borderRadius: '12px', padding: '10px 12px', border: '0.5px solid var(--border-col, #E2E8F0)' }}>
            <div>
              <span style={{ fontSize: '20px', color: 'var(--text-primary, #0B132B)', fontWeight: 500 }}>{s.num}</span>
              <span style={{ fontSize: '13px', color: '#5BC0BE', fontWeight: 500 }}> {s.unit}</span>
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '2px', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>


    </div>
  )
}

// ── PLAN SCREEN ───────────────────────────────────────────────────────────

function PlanScreen({ plan, stravaRuns, onOpenMe, initials, allOverrides, allCompletions, onOverrideChange, onOpenCalendar, onOpenSession }: {
  plan: Plan; stravaRuns: any[]; onOpenMe: () => void; initials: string
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onOpenCalendar?: () => void
  onOpenSession?: (s: any) => void
}) {
  return (
    <div>
      <ScreenHeader title="Plan" sub="Race to the Stones · 11 Jul 2026" initials={initials} onOpenMe={onOpenMe} />
      <div style={{ padding: '0 12px' }}>
        <PlanChart weeks={plan.weeks} />
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.6rem', color: 'var(--text-muted, #94A3B8)', margin: '8px 0 4px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
          <span>MIDWEEK: 2× Zone 2 · STRENGTH: Mon/Wed · SAT: long run</span>
          <span style={{ color: 'var(--text-muted, #94A3B8)' }}>v{plan.meta.version} · {plan.meta.last_updated}</span>
        </div>
      </div>

      <PlanCalendar
        weeks={plan.weeks}
        stravaRuns={stravaRuns}
        allOverrides={allOverrides}
        allCompletions={allCompletions}
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
          <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', padding: '9px 12px', border: '0.5px solid var(--border-col, #E2E8F0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FC4C02' }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>
                {stravaLoading ? 'Loading Strava...' : loading ? 'Analysing latest run...' : latestRunLabel ?? 'Latest activity'}
              </span>
            </div>
            {isNew && !loading && (
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#5BC0BE', background: 'rgba(212,80,26,0.1)', padding: '2px 8px', borderRadius: '20px' }}>new</span>
            )}
          </div>
        )}

        {!stravaLoading && !latestRun && (
          <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.6 }}>
              Connect Strava in the <span style={{ color: '#5BC0BE' }}>Me</span> screen<br />to get coaching notes.
            </div>
          </div>
        )}

        {(loading || (stravaLoading && !analysis)) && (
          <>
            <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#1c1c1c" strokeWidth="2" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="#5BC0BE" strokeWidth="2" strokeDasharray="40 60" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite" />
                </circle>
              </svg>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', textAlign: 'center', lineHeight: 1.6 }}>
                {stravaLoading ? 'Loading Strava data...' : 'Reading your latest run\nand plan position...'}
              </p>
            </div>
            <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', padding: '14px' }}>
              {[85, 100, 70, 90].map((w, i) => (
                <div key={i} style={{ height: '10px', background: 'var(--bg, #F7F9FB)', borderRadius: '4px', marginBottom: i < 3 ? '8px' : 0, width: `${w}%` }} />
              ))}
            </div>
          </>
        )}

        {error && !loading && (
          <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', padding: '16px' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#5BC0BE', marginBottom: '8px' }}>Error</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)' }}>{error}</div>
            <button onClick={generateAnalysis} style={{ marginTop: '12px', fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#5BC0BE', background: 'rgba(212,80,26,0.1)', border: 'none', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        )}

        {analysis && !loading && (
          <>
            <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid #111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#5BC0BE' }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Coaching notes</span>
                <span style={{ marginLeft: 'auto', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)' }}>W{weekNum}/{totalWeeks}</span>
              </div>
              <div style={{ padding: '14px' }}>
                {analysis.split('\n\n').map((para, i) => (
                  <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary, #3A506B)', lineHeight: 1.65, marginTop: i > 0 ? '10px' : 0 }}>{para}</p>
                ))}
              </div>
            </div>
            <button onClick={generateAnalysis} style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted, #94A3B8)', background: 'none', border: '0.5px solid #1c1c1c', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer', alignSelf: 'center' }}>
              Refresh analysis
            </button>
          </>
        )}

        {!analysis && !loading && !error && latestRun && !stravaLoading && (
          <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.6 }}>
              Strava connected. Ready to generate<br />your coaching notes.
            </div>
            <button onClick={generateAnalysis} style={{ marginTop: '16px', fontFamily: "'Inter', sans-serif", fontSize: '13px', color: '#5BC0BE', background: 'rgba(212,80,26,0.1)', border: 'none', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer' }}>
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
  const [connected, setConnected] = useState<boolean | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConnected(false); return }
      setUserId(user.id)
      const { data } = await supabase.from('user_settings').select('strava_refresh_token').eq('id', user.id).single()
      setConnected(!!(data?.strava_refresh_token))
    }
    check()

    // Handle redirect back from Strava OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      setConnected(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  async function disconnect() {
    setDisconnecting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        strava_access_token: null,
        strava_refresh_token: null,
        strava_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      setConnected(false)
    } finally { setDisconnecting(false) }
  }

  const isLoading = connected === null

  return (
    <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #E2E8F0)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(252,76,2,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FC4C02' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary, #3A506B)', lineHeight: 1.55 }}>Strava</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', marginTop: '1px', color: isLoading ? '#888' : connected ? '#3A506B' : '#888' }}>
              {isLoading ? 'checking...' : connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
        </div>

        {!isLoading && (
          connected ? (
            <button onClick={disconnect} disabled={disconnecting} style={{
              background: 'none', border: '0.5px solid var(--border-col, #E2E8F0)',
              borderRadius: '8px', padding: '6px 12px',
              fontFamily: "'Inter', sans-serif", fontSize: '11px',
              color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
              opacity: disconnecting ? 0.6 : 1,
            }}>
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button onClick={() => { window.location.href = `/api/strava/connect?user_id=${userId}` }} disabled={!userId} style={{
              background: '#FC4C02', color: '#fff',
              border: 'none', borderRadius: '8px', padding: '8px 14px',
              fontFamily: "'Inter', sans-serif", fontSize: '11px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: userId ? 'pointer' : 'default',
              opacity: userId ? 1 : 0.5,
            }}>
              Connect
            </button>
          )
        )}
      </div>
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
    <div onClick={toggle} style={{ width: '44px', height: '26px', borderRadius: '13px', background: enabled ? '#1e3d37' : '#1c1c1c', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: enabled ? '#3A506B' : '#444', position: 'absolute', top: '3px', left: enabled ? '21px' : '3px', transition: 'left 0.2s, background 0.2s' }} />
    </div>
  )
}

// ── ME SCREEN ─────────────────────────────────────────────────────────────

// ── HR ZONE CALCULATION (Karvonen / HRR method) ───────────────────────────

// ── HR ZONE CALCULATION (HRR% with configurable boundaries) ──────────────
//
// Zone boundaries are the UPPER HRR% for each zone.
// Defaults reverse-engineered from Garmin (resting 48, max 190):
//   Z1: 95–114, Z2: 114–133, Z3: 133–152, Z4: 152–171, Z5: 171–190
// Z1 has a lower floor (33% HRR = 95bpm) — below this is pure rest, not Z1.

const ZONE_META = [
  { zone: 1, name: 'Recovery',  colour: '#5BC0BE', desc: 'Active recovery · warm-up · cool-down' },
  { zone: 2, name: 'Aerobic',   colour: '#378ADD', desc: 'Aerobic base · conversational · fat burning' },
  { zone: 3, name: 'Tempo',     colour: '#d4a017', desc: 'Comfortably hard · 3-word sentences' },
  { zone: 4, name: 'Threshold', colour: '#5BC0BE', desc: 'Hard · sustained race effort' },
  { zone: 5, name: 'VO₂ Max',  colour: '#c0392b', desc: 'Maximum effort · short intervals only' },
]

function calculateZones(restingHR: number, maxHR: number, boundaries: number[], floor: number = DEFAULT_ZONE_FLOOR) {
  const hrr = maxHR - restingHR
  return ZONE_META.map((meta, i) => {
    const upperPct = boundaries[i] ?? 100
    const lowerPct = i === 0 ? floor : (boundaries[i - 1] ?? 0)
    return {
      ...meta,
      pctMin: lowerPct,
      pctMax: upperPct,
      minHR: Math.round(restingHR + (lowerPct / 100) * hrr),
      maxHR: Math.round(restingHR + (upperPct / 100) * hrr),
    }
  })
}

function HRZonesSection({ restingHR, maxHR, zoneBoundaries, onSave }: {
  restingHR: number | null
  maxHR: number | null
  zoneBoundaries: number[]
  onSave: (rhr: number, mhr: number, boundaries: number[]) => void
}) {
  const [rhr, setRhr] = useState(restingHR ? String(restingHR) : '')
  const [mhr, setMhr] = useState(maxHR ? String(maxHR) : '')
  // First element of zoneBoundaries is the floor, rest are upper bounds
  const storedFloor = zoneBoundaries[0] ?? DEFAULT_ZONE_FLOOR
  const storedBounds = zoneBoundaries.slice(1).length === 5 ? zoneBoundaries.slice(1) : DEFAULT_ZONE_BOUNDARIES
  const [floor, setFloor] = useState(String(storedFloor))
  const [bounds, setBounds] = useState<string[]>(storedBounds.map(String))
  const [showBounds, setShowBounds] = useState(false)
  const [saved, setSaved] = useState(false)

  const rhrNum = parseInt(rhr)
  const mhrNum = parseInt(mhr)
  const floorNum = parseInt(floor)
  const boundsNum = bounds.map(b => parseInt(b))
  const boundsValid = !isNaN(floorNum) && floorNum >= 0 && floorNum < boundsNum[0] &&
    boundsNum.every((b, i) => !isNaN(b) && b > 0 && b <= 100 && (i === 0 || b > boundsNum[i - 1]))
  const valid = rhrNum > 0 && mhrNum > 0 && mhrNum > rhrNum && boundsValid
  const zones = valid ? calculateZones(rhrNum, mhrNum, boundsNum, floorNum) : []

  function handleSave() {
    if (!valid) return
    // Store floor as first element, then the 5 upper bounds
    onSave(rhrNum, mhrNum, [floorNum, ...boundsNum])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: '10px',
    color: 'var(--text-muted, #94A3B8)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '6px', display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg, #F7F9FB)',
    border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '8px',
    padding: '11px 36px 11px 12px', color: 'var(--text-primary, #0B132B)',
    fontFamily: "'Inter', sans-serif", fontSize: '15px',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #E2E8F0)', overflow: 'hidden' }}>

      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border-col, #E2E8F0)' }}>

        {/* Resting + Max HR */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Resting HR</label>
            <div style={{ position: 'relative' }}>
              <input type="number" inputMode="numeric" placeholder="48" value={rhr}
                onChange={e => setRhr(e.target.value)} style={inputStyle} />
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)' }}>bpm</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Max HR</label>
            <div style={{ position: 'relative' }}>
              <input type="number" inputMode="numeric" placeholder="190" value={mhr}
                onChange={e => setMhr(e.target.value)} style={inputStyle} />
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)' }}>bpm</span>
            </div>
          </div>
        </div>

        {/* Collapsible boundary editor */}
        <button onClick={() => setShowBounds(v => !v)} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 10px',
          fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted, #94A3B8)',
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <span>Zone boundaries (HRR%)</span>
          <span>{showBounds ? '▲' : '▼'}</span>
        </button>

        {showBounds && (
          <div style={{ marginBottom: '12px' }}>
            {/* Floor + 5 upper bounds in one row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '8px' }}>
              {/* Floor */}
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'var(--text-muted, #94A3B8)', textAlign: 'center', marginBottom: '4px', textTransform: 'uppercase' }}>Floor</div>
                <div style={{ position: 'relative' }}>
                  <input type="number" inputMode="numeric" value={floor}
                    onChange={e => setFloor(e.target.value)}
                    style={{
                      width: '100%', background: 'var(--bg, #F7F9FB)', borderRadius: '6px',
                      border: `0.5px solid ${!isNaN(floorNum) && floorNum >= 0 && floorNum < boundsNum[0] ? 'var(--border-col, #E2E8F0)' : 'rgba(212,80,26,0.5)'}`,
                      padding: '8px 18px 8px 8px', color: 'var(--text-primary, #0B132B)',
                      fontFamily: "'Inter', sans-serif", fontSize: '13px',
                      outline: 'none', boxSizing: 'border-box' as const, textAlign: 'center' as const,
                    }} />
                  <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'var(--text-muted, #94A3B8)' }}>%</span>
                </div>
              </div>
              {/* Z1–Z5 upper bounds */}
              {ZONE_META.map((meta, i) => (
                <div key={i}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: meta.colour, textAlign: 'center', marginBottom: '4px', textTransform: 'uppercase' }}>Z{i + 1}</div>
                  <div style={{ position: 'relative' }}>
                    <input type="number" inputMode="numeric" value={bounds[i]}
                      onChange={e => { const next = [...bounds]; next[i] = e.target.value; setBounds(next) }}
                      style={{
                        width: '100%', background: 'var(--bg, #F7F9FB)', borderRadius: '6px',
                        border: `0.5px solid ${!isNaN(boundsNum[i]) && boundsNum[i] > (boundsNum[i-1] ?? floorNum) && boundsNum[i] <= 100 ? 'var(--border-col, #E2E8F0)' : 'rgba(212,80,26,0.5)'}`,
                        padding: '8px 18px 8px 8px', color: 'var(--text-primary, #0B132B)',
                        fontFamily: "'Inter', sans-serif", fontSize: '13px',
                        outline: 'none', boxSizing: 'border-box' as const, textAlign: 'center' as const,
                      }} />
                    <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'var(--text-muted, #94A3B8)' }}>%</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { setFloor(String(DEFAULT_ZONE_FLOOR)); setBounds(DEFAULT_ZONE_BOUNDARIES.map(String)) }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif", fontSize: '10px',
              color: 'var(--text-muted, #94A3B8)', textDecoration: 'underline', padding: 0,
            }}>Reset to Garmin defaults</button>
          </div>
        )}

        <button onClick={handleSave} disabled={!valid} style={{
          width: '100%', padding: '11px',
          background: saved ? 'rgba(91,192,190,0.12)' : valid ? 'rgba(212,80,26,0.1)' : 'var(--bg, #F7F9FB)',
          border: `0.5px solid ${saved ? 'rgba(91,192,190,0.4)' : valid ? 'rgba(212,80,26,0.3)' : 'var(--border-col)'}`,
          borderRadius: '8px', cursor: valid ? 'pointer' : 'not-allowed',
          fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.08em',
          textTransform: 'uppercase', color: saved ? '#5BC0BE' : valid ? '#5BC0BE' : 'var(--text-muted, #94A3B8)',
        }}>
          {saved ? '✓ Saved' : 'Save HR data'}
        </button>
      </div>

      {/* Calculated zones — read only */}
      {zones.length > 0 && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'var(--text-muted, #94A3B8)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Calculated zones · HRR%
          </div>
          {zones.map(z => (
            <div key={z.zone} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto',
              alignItems: 'center', gap: '10px', padding: '9px 10px',
              borderRadius: '8px', background: 'var(--bg, #F7F9FB)',
              border: '0.5px solid var(--border-col, #E2E8F0)',
            }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: z.colour + '18', border: `1.5px solid ${z.colour}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Inter', sans-serif", fontSize: '10px',
                color: z.colour, fontWeight: 'bold', flexShrink: 0,
              }}>{z.zone}</div>
              <div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-primary, #0B132B)', fontWeight: 500 }}>{z.name}</div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: '11px', color: 'var(--text-muted, #94A3B8)', marginTop: '1px' }}>{z.desc}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: z.colour, whiteSpace: 'nowrap' }}>{z.minHR}–{z.maxHR}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '9px', color: 'var(--text-muted, #94A3B8)', marginTop: '1px' }}>{z.pctMin}–{z.pctMax}%</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {zones.length === 0 && (rhr || mhr) && (
        <div style={{ padding: '14px 16px', fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted, #94A3B8)', textAlign: 'center' }}>
          Enter both values to calculate zones
        </div>
      )}
    </div>
  )
}

// ── ME SCREEN ─────────────────────────────────────────────────────────────

function MeScreen({ initials, athlete, quitDays, smokeTrackerEnabled, quitDate, onSmokeTrackerChange, resetPhrase, onSaveMental, theme, onThemeChange, onBack, isAdmin, onOpenAdmin, preferredUnits, onUnitsChange, restingHR, maxHR, zoneBoundaries, onHRChange }: {
  initials: string; athlete: string; quitDays: number | null; smokeTrackerEnabled: boolean; quitDate: string
  onSmokeTrackerChange: (enabled: boolean, date: string) => void
  resetPhrase: string; onSaveMental: (v: string) => void
  theme: 'dark' | 'light' | 'auto'; onThemeChange: (t: 'dark' | 'light' | 'auto') => void; onBack: () => void
  isAdmin?: boolean; onOpenAdmin?: () => void
  preferredUnits: 'km' | 'mi'; onUnitsChange: (u: 'km' | 'mi') => void
  restingHR: number | null; maxHR: number | null; zoneBoundaries: number[]; onHRChange: (rhr: number, mhr: number, bounds: number[]) => void
}) {
  const [activeSection, setActiveSection] = useState<'main' | 'quit' | 'mental' | 'fueling'>('main')

  if (activeSection === 'quit')    return <QuitTab    quitDays={quitDays} onBack={() => setActiveSection('main')} />
  if (activeSection === 'mental')  return <MentalTab  resetPhrase={resetPhrase} onSave={onSaveMental} onBack={() => setActiveSection('main')} />
  if (activeSection === 'fueling') return <FuelingTab onBack={() => setActiveSection('main')} />

  const daysToRace = Math.max(0, Math.ceil((new Date('2026-07-11').getTime() - Date.now()) / 86400000))

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #F7F9FB)', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 8px' }}>
        <button onClick={onBack} style={{ border: 'none', color: '#5BC0BE', fontSize: '22px', cursor: 'pointer', padding: '0', lineHeight: 1 , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif" }}>Me</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>effort-first training</div>
        </div>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '32px' }}>

        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', padding: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'space-between' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#5BC0BE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", fontSize: '15px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', color: 'var(--text-primary, #0B132B)', fontWeight: 500 }}>{athlete}</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '2px' }}>Berkshire, UK</div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#5BC0BE', marginTop: '4px' }}>Race to the Stones · {daysToRace} days</div>
          </div>
          <form action="/auth/signout" method="post">
            <button style={{ background: 'none', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '8px', color: 'var(--text-muted, #94A3B8)', fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '6px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Sign out
            </button>
          </form>
        </div>

        <SectionLabel>Appearance</SectionLabel>
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #E2E8F0)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border-col, #E2E8F0)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary, #3A506B)', lineHeight: 1.55 }}>Theme</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['dark', 'light', 'auto'] as const).map(t => (
                <button key={t} onClick={() => onThemeChange(t)} style={{ borderRadius: '12px', padding: '6px 10px', border: `0.5px solid ${theme === t ? '#5BC0BE' : 'var(--border-col)'}`, background: 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: theme === t ? '#5BC0BE' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary, #3A506B)', lineHeight: 1.55 }}>Distance units</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>Pace brackets and distances</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['km', 'mi'] as const).map(u => (
                <button key={u} onClick={() => onUnitsChange(u)} style={{ borderRadius: '12px', padding: '6px 14px', border: `0.5px solid ${preferredUnits === u ? '#5BC0BE' : 'var(--border-col)'}`, background: preferredUnits === u ? 'rgba(212,80,26,0.08)' : 'none', cursor: 'pointer', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: preferredUnits === u ? '#5BC0BE' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SectionLabel>Connections</SectionLabel>
        <StravaConnectionRow />

        <SectionLabel>Heart rate zones</SectionLabel>
        <HRZonesSection restingHR={restingHR} maxHR={maxHR} zoneBoundaries={zoneBoundaries} onSave={onHRChange} />

        <SectionLabel>Training support</SectionLabel>
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '0.5px solid var(--border-col, #E2E8F0)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '0.5px solid #111' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: smokeTrackerEnabled ? '10px' : 0 }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary, #A0AEC0)', lineHeight: 1.55 }}>Smoke-free tracker</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: smokeTrackerEnabled ? '#3A506B' : '#444', marginTop: '1px' }}>
                  {smokeTrackerEnabled && quitDays !== null ? `${quitDays} days smoke-free` : 'Off'}
                </div>
              </div>
              <SmokeToggle enabled={smokeTrackerEnabled} quitDate={quitDate} onChange={onSmokeTrackerChange} />
            </div>
            {smokeTrackerEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)' }}>Quit date:</span>
                <input type="date" value={quitDate} onChange={async e => {
                  const newDate = e.target.value
                  onSmokeTrackerChange(true, newDate)
                  try {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    await supabase.from('user_settings').upsert({ id: user.id, smoke_tracker_enabled: true, quit_date: newDate, updated_at: new Date().toISOString() })
                  } catch {}
                }} style={{ background: 'var(--bg, #F7F9FB)', border: '0.5px solid #222', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-muted, #94A3B8)', fontFamily: "'Inter', sans-serif", fontSize: '12px', outline: 'none' }} />
              </div>
            )}
          </div>

          {smokeTrackerEnabled && (
            <button onClick={() => setActiveSection('quit')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid #111', cursor: 'pointer' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary, #A0AEC0)', lineHeight: 1.55 }}>Quit tracker</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#3A506B', marginTop: '1px' }}>Milestones + benefits</div>
              </div>
              <div style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '18px' }}>›</div>
            </button>
          )}

          {[
            { id: 'mental'  as const, label: 'Mental toolkit', sub: 'Race mantras + strategies', color: '#378ADD' },
            { id: 'fueling' as const, label: 'Fueling plan',   sub: 'Gel strategy + hydration',  color: '#5BC0BE' },
          ].map(({ id, label, sub, color }, i, arr) => (
            <button key={id} onClick={() => setActiveSection(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '0.5px solid #111' : 'none', cursor: 'pointer' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary, #A0AEC0)', lineHeight: 1.55 }}>{label}</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color, marginTop: '1px' }}>{sub}</div>
              </div>
              <div style={{ color: 'var(--text-muted, #94A3B8)', fontSize: '18px' }}>›</div>
            </button>
          ))}
        </div>

        {isAdmin && (
          <>
            <SectionLabel>Admin</SectionLabel>
            <button onClick={onOpenAdmin} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: 'var(--card-bg, #ffffff)',
              borderRadius: '12px', border: '0.5px solid rgba(212,80,26,0.3)',
              cursor: 'pointer',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13px', color: '#5BC0BE', lineHeight: 1.55 }}>User management</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', marginTop: '1px' }}>Impersonate · view plans</div>
              </div>
              <div style={{ color: '#5BC0BE', fontSize: '18px' }}>›</div>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── ADMIN SCREEN ──────────────────────────────────────────────────────────

function AdminScreen({ onBack, onImpersonate }: {
  onBack: () => void
  onImpersonate: (userId: string, name: string) => void
}) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('id, gist_url, has_onboarded, is_admin')
        if (data) setUsers(data)
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #F7F9FB)', overflowY: 'auto', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border-col, #E2E8F0)', position: 'sticky', top: 0, background: 'var(--bg, #F7F9FB)', zIndex: 10 }}>
        <button onClick={onBack} style={{ border: 'none', color: '#5BC0BE', cursor: 'pointer', padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif" }}>User management</div>
      </div>

      <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', padding: '24px 0', textAlign: 'center' }}>Loading users...</div>
        ) : users.length === 0 ? (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted, #94A3B8)', padding: '24px 0', textAlign: 'center' }}>No users found</div>
        ) : users.map(u => {
          const name = u.gist_url
            ? u.gist_url.split('/').pop()?.replace('.json', '').replace('zona_plan_', '') ?? u.id.slice(0, 8)
            : u.id.slice(0, 8)
          const displayName = name.charAt(0).toUpperCase() + name.slice(1)

          return (
            <div key={u.id} style={{
              background: 'var(--card-bg, #ffffff)', borderRadius: '12px',
              border: '0.5px solid var(--border-col, #E2E8F0)',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif" }}>
                  {displayName}
                  {u.is_admin && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: '#5BC0BE', marginLeft: '8px', border: '0.5px solid rgba(212,80,26,0.4)', borderRadius: '10px', padding: '1px 6px' }}>admin</span>}
                </div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted, #94A3B8)', marginTop: '3px' }}>
                  {u.has_onboarded ? 'Onboarded' : 'Not yet onboarded'} · {u.gist_url ? 'Plan set' : 'No plan'}
                </div>
              </div>
              {!u.is_admin && (
                <button
                  onClick={() => onImpersonate(u.id, displayName)}
                  style={{
                    background: 'rgba(212,80,26,0.1)', border: '0.5px solid rgba(212,80,26,0.3)',
                    borderRadius: '8px', color: '#5BC0BE',
                    fontFamily: "'Inter', sans-serif", fontSize: '11px',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '6px 12px', cursor: 'pointer',
                  }}
                >
                  View
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── SESSION SCREEN ────────────────────────────────────────────────────────

function SessionScreen({ session, preloadedRuns, onBack, onSaved, preferredUnits, zone2Ceiling }: {
  session: any; preloadedRuns: any[]; onBack: () => void; onSaved?: () => void
  preferredUnits?: 'km' | 'mi'; zone2Ceiling?: number
}) {
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg, #F7F9FB)', overflowY: 'auto', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border-col, #E2E8F0)', position: 'sticky', top: 0, background: 'var(--bg, #F7F9FB)', zIndex: 10 }}>
        <button onClick={onBack} style={{ border: 'none', color: '#5BC0BE', fontSize: '22px', cursor: 'pointer', padding: '0', lineHeight: 1 , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif" }}>{session.title}</div>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ background: 'var(--card-bg, #ffffff)', borderRadius: '16px', border: '0.5px solid var(--border-col, #E2E8F0)', overflow: 'hidden' }}>
          <SessionPopupInner
            session={session}
            weekTheme={session.weekTheme ?? ''}
            weekN={session.weekN ?? 1}
            preloadedRuns={preloadedRuns}
            onClose={onBack}
            onSaved={onSaved}
            preferredUnits={preferredUnits ?? 'km'}
            zone2Ceiling={zone2Ceiling ?? 145}
          />
        </div>
      </div>
    </div>
  )
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px' }}>
      <button onClick={onBack} style={{ border: 'none', color: '#5BC0BE', fontSize: '18px', cursor: 'pointer', padding: '0' , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(212,80,26,0.1)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary, #0B132B)', fontFamily: "'Inter',sans-serif" }}>{title}</div>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '16px 18px', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-secondary, #3A506B)', marginBottom: '10px' }}>
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
    <div style={{ minHeight: '100%', background: 'var(--bg, #F7F9FB)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Mental toolkit" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          The dark patch is coming. Probably around <span style={{ color: '#5BC0BE' }}>km 65–75</span>. That's not a sign something's wrong — it's a sign you've been working long enough for it to be real. These tools exist for that moment.
        </InfoBox>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {tools.map(t => (
            <div key={t.title} style={{ background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', letterSpacing: '0.05em', color: '#5BC0BE', marginBottom: '8px', textTransform: 'uppercase' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.6 }}>{t.text}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#5BC0BE', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your Reset Phrase</div>
          <textarea value={resetPhrase} onChange={e => onSave(e.target.value)} placeholder="What's the phrase you'll use when it gets dark at km 70?" style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-secondary, #A0AEC0)', fontFamily: "'Inter',sans-serif", fontSize: '13px', lineHeight: 1.7, resize: 'vertical', minHeight: '60px', outline: 'none' }} />
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
    <div style={{ minHeight: '100%', background: 'var(--bg, #F7F9FB)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Fueling plan" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          Real food plus gels is the right call. The goal now is <span style={{ color: '#5BC0BE' }}>stress-testing your gut before race day</span>. No surprises on the day. None.
        </InfoBox>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {protocol.map(p => (
            <div key={p.timing} style={{ background: 'var(--card-bg, #ffffff)', border: '0.5px solid var(--border-col, #E2E8F0)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#5BC0BE', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{p.timing}</div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary, #A0AEC0)', marginBottom: '4px' }}>{p.what}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.55 }}>{p.why}</div>
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
    <div style={{ minHeight: '100%', background: 'var(--bg, #F7F9FB)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Quit tracker" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <div style={{ background: 'var(--card-bg, #ffffff)', border: '0.5px solid #1e3d37', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '3.5rem', color: '#3A506B', lineHeight: 1, fontWeight: 500 }}>{days}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: '#3A506B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Smoke-free days</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted, #94A3B8)', lineHeight: 1.55 }}>Your aerobic capacity is recovering. The data will show it.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {milestones.map(m => (
                <div key={m.days} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', padding: '3px 10px', borderRadius: '20px', border: `0.5px solid ${days >= m.days ? '#1e3d37' : '#222'}`, color: days >= m.days ? '#3A506B' : '#444' }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <InfoBox>
          <strong style={{ color: 'var(--text-secondary, #A0AEC0)' }}>What quitting does to your running:</strong><br /><br />
          <span style={{ color: '#5BC0BE' }}>48 hours</span> — CO leaves bloodstream. O₂ delivery improves immediately.<br />
          <span style={{ color: '#5BC0BE' }}>Week 1–2</span> — Resting HR starts dropping. Recovery improves noticeably.<br />
          <span style={{ color: '#5BC0BE' }}>Week 3–4</span> — Aerobic efficiency measurably better. Zone 2 feels easier.<br />
          <span style={{ color: '#5BC0BE' }}>Month 2+</span> — Cardiac drift reduces. That late-run HR creep? Less of it.<br /><br />
          <strong style={{ color: 'var(--text-secondary, #A0AEC0)' }}>You quit 99 days before a 100km race. That's an upgrade.</strong>
        </InfoBox>
      </div>
    </div>
  )
}
