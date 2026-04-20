'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import type { Plan, Week } from '@/types/plan'
import PlanChart from '@/components/training/PlanChart'
import PlanCalendar from '@/components/training/PlanCalendar'
import CalendarOverlay from './CalendarOverlay'
import StravaPanel from '@/components/strava/StravaPanel'
import { createClient } from '@/lib/supabase/client'
import { fetchPlanFromUrl, DEFAULT_GIST_URL, EMPTY_PLAN, getCurrentWeek, getCurrentWeekIndex, parseLocalDate } from '@/lib/plan'
import { SESSION_COLORS, SESSION_LABELS, getSessionColor, getSessionLabel } from '@/lib/session-types'
import dynamic from 'next/dynamic'
const GeneratePlanScreen = dynamic(() => import('./GeneratePlanScreen'), { ssr: false })

type Screen = 'today' | 'plan' | 'coach' | 'strava' | 'me' | 'calendar' | 'session' | 'admin' | 'generate'

// ── Icons ─────────────────────────────────────────────────────────────────

function IconToday({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text-muted)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="11" width="4" height="8" rx="1" fill={c} />
      <rect x="9" y="7" width="4" height="12" rx="1" fill={c} />
      <rect x="15" y="4" width="4" height="15" rx="1" fill={c} />
    </svg>
  )
}

function IconPlan({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text-muted)'
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
  const c = active ? 'var(--accent)' : 'var(--text-muted)'
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
  const c = active ? 'var(--accent)' : 'var(--text-muted)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="7" stroke={c} strokeWidth="1.2" />
      <polyline points="11,7 11,11 14,13" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconMore({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text-muted)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="6"  cy="11" r="1.5" fill={c} />
      <circle cx="11" cy="11" r="1.5" fill={c} />
      <circle cx="16" cy="11" r="1.5" fill={c} />
    </svg>
  )
}

function IconMe({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : 'var(--text-muted)'
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" stroke={c} strokeWidth="1.2" />
      <path d="M4 19c0-3.866 3.134-7 7-7h.5c3.866 0 7 3.134 7 7" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

// ── Layout shell ──────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [showWelcome, setShowWelcome] = useState(false)
  const [screen, setScreen] = useState<Screen>('today')
  const [showMe, setShowMe] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null)
  const [quitDays, setQuitDays] = useState<number | null>(null)
  const [smokeTrackerEnabled, setSmokeTrackerEnabled] = useState(false)
  const [quitDate, setQuitDate] = useState<string>('')
  const [resetPhrase, setResetPhrase] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light' | 'auto'>('light')
  const [appReady, setAppReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [preferredUnits, setPreferredUnits] = useState<'km' | 'mi'>('km')
  const [preferredMetric, setPreferredMetric] = useState<'distance' | 'duration'>('distance')
  const [restingHR, setRestingHR] = useState<number | null>(null)
  const [maxHR, setMaxHR] = useState<number | null>(null)
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [profileEmail, setProfileEmail] = useState<string>('')

  // Post-wizard orientation — shown once after plan generation
  const [showOrientation, setShowOrientation] = useState(false)

  // Strava token failure — set when refresh call returns non-200 for a user who had a token
  const [stravaTokenFailed, setStravaTokenFailed] = useState(false)

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

  // Screen guide state — shows first-load popup per screen
  const [guideScreen, setGuideScreen] = useState<Screen | null>(null)

  const supabase = createClient()

  useEffect(() => {
    // Handle strava OAuth redirect result
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      setStravaConnected(true)
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  const initials = (() => {
    if (firstName || lastName) {
      return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase().slice(0, 2) || '?'
    }
    return (plan?.meta?.athlete ?? '?')
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  })()

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
          supabase.from('user_settings').select('strava_refresh_token, smoke_tracker_enabled, quit_date, gist_url, plan_json, has_onboarded, is_admin, preferred_units, preferred_metric, resting_hr, max_hr, first_name, last_name, email').eq('id', user.id).single(),
          supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id),
          supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag').eq('user_id', user.id),
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

        if (settingsRes.error) console.error('user_settings query failed:', settingsRes.error)
        const data = settingsRes.data

        // Load plan from user's gist_url or plan_json; new users go to the generator
        if (data?.gist_url) {
          const loadedPlan = await fetchPlanFromUrl(data.gist_url)
          setPlan(loadedPlan)
        } else if (data?.plan_json) {
          setPlan(data.plan_json as Plan)
        } else {
          setPlan(EMPTY_PLAN)
          setScreen('generate')
        }

        // Admin flag
        if (data?.is_admin) setIsAdmin(true)

        // Units preference
        if (data?.preferred_units === 'mi') setPreferredUnits('mi')
        if (data?.preferred_metric === 'duration') setPreferredMetric('duration')

        // HR data
        if (data?.resting_hr) setRestingHR(data.resting_hr)
        if (data?.max_hr) setMaxHR(data.max_hr)

        // Profile data — prefer DB, fall back to auth provider metadata
        if (data?.first_name) setFirstName(data.first_name)
        if (data?.last_name) setLastName(data.last_name)
        if (data?.email) setProfileEmail(data.email)

        if (!data?.first_name && !data?.last_name) {
          const fullName = (user.user_metadata?.full_name || user.user_metadata?.name || '') as string
          if (fullName) {
            const parts = fullName.trim().split(' ')
            const fn = parts[0] || ''
            const ln = parts.slice(1).join(' ') || ''
            if (fn) setFirstName(fn)
            if (ln) setLastName(ln)
            void supabase.from('user_settings').upsert({ id: user.id, first_name: fn, last_name: ln, updated_at: new Date().toISOString() })
          }
        }
        if (!data?.email) {
          const authEmail = user.email || (user.user_metadata?.email as string) || ''
          if (authEmail) {
            setProfileEmail(authEmail)
            void supabase.from('user_settings').upsert({ id: user.id, email: authEmail, updated_at: new Date().toISOString() })
          }
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

        // Use cached access token if still valid (Strava tokens last 6 hours)
        let access_token: string | null = null
        const cachedToken   = localStorage.getItem('strava_access_token')
        const cachedExpiry  = localStorage.getItem('strava_token_expires_at')
        const nowSec        = Math.floor(Date.now() / 1000)
        if (cachedToken && cachedExpiry && nowSec < Number(cachedExpiry) - 300) {
          access_token = cachedToken
        } else {
          // Refresh token via server-side route — keeps client secret safe
          const tokenRes = await fetch('/api/strava/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          })
          if (!tokenRes.ok) { setStravaTokenFailed(true); setStravaLoading(false); return }
          const tokenData = await tokenRes.json()
          if (!tokenData.access_token) { setStravaTokenFailed(true); setStravaLoading(false); return }
          access_token = tokenData.access_token
          localStorage.setItem('strava_access_token', tokenData.access_token)
          localStorage.setItem('strava_token_expires_at', String(tokenData.expires_at))
        }

        // Fetch activities from the past 12 months
        const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        const after = Math.floor(oneYearAgo.getTime() / 1000)
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
    // Just toggle the attribute — globals.css handles all the var values.
    // Using setProperty here would override the CSS vars with inline styles,
    // which breaks the cascade and causes the colour flash.
    root.setAttribute('data-theme', isDark ? 'dark' : 'light')
    // Remove any stale inline style overrides from old versions
    const vars = ['--bg','--card-bg','--border-col','--text-primary','--text-secondary','--text-muted','--nav-bg']
    vars.forEach(v => root.style.removeProperty(v))
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
      const { data: completions } = await supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag').eq('user_id', userId)
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

    const { data: completions } = await supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag').eq('user_id', user.id)
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

  async function handlePlanSaved(savedPlan: Plan) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        plan_json: savedPlan,
        updated_at: new Date().toISOString(),
      })
      setPlan(savedPlan)
      setScreen('today')
      setShowOrientation(true)
    } catch (err) {
      console.error('Failed to save plan:', err)
      throw err
    }
  }

  const currentWeekIndex = plan ? getCurrentWeekIndex(plan.weeks) : 0
  const [viewWeekIndex, setViewWeekIndex] = useState(0)

  // Update to current week once plan loads
  useEffect(() => {
    if (plan) {
      const idx = getCurrentWeekIndex(plan.weeks)
      setViewWeekIndex(idx >= 0 ? idx : 0)
    }
  }, [plan])

  // Personalised zone ceiling: Karvonen 70% HRR, falls back to plan meta or 145
  const effectiveZone2Ceiling = useMemo(() => {
    if (restingHR && maxHR) return Math.round(restingHR + 0.70 * (maxHR - restingHR))
    return plan?.meta?.zone2_ceiling ?? 145
  }, [restingHR, maxHR, plan])

  // Aerobic pace derived from Strava runs in user's Z2 HR band
  const aerobicPace = useMemo(() =>
    computeAerobicPace(stravaRuns, restingHR, maxHR, preferredUnits),
  [stravaRuns, restingHR, maxHR, preferredUnits])

  const now = new Date()
  const raceDate = plan?.meta?.race_date ? new Date(plan.meta.race_date) : null
  const raceName = plan?.meta?.race_name ?? ''
  const daysToRace = raceDate ? Math.max(0, Math.ceil((raceDate.getTime() - now.getTime()) / 86400000)) : 0

  const s: React.CSSProperties = {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
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
        background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
        gap: '0',
      }}>
        {/* Zona wordmark — O has zone arc */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '38px', fontWeight: 500, letterSpacing: '0.08em',
            color: 'var(--accent)', lineHeight: 1,
          }}>Z</span>
          {/* Custom O with zone arc */}
          <svg width="28" height="38" viewBox="0 0 28 38" fill="none" style={{ margin: '0 1px' }}>
            <text x="14" y="30" textAnchor="middle"
              fontFamily="'Space Grotesk', sans-serif"
              fontSize="38" fontWeight="500" letterSpacing="0"
              fill="var(--accent)">O</text>
            {/* Zone arc overlay — sits on top right of O */}
            <path d="M 21 8 A 9 9 0 0 1 26 16" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M 21 8 A 9 9 0 0 1 26 16" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" fill="none" strokeDasharray="3 3" opacity="0.6" />
          </svg>
          <span style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '38px', fontWeight: 500, letterSpacing: '0.08em',
            color: 'var(--accent)', lineHeight: 1,
          }}>NA</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: '52px',
        }}>
          Do less. Improve more.
        </div>

        {/* Spinner */}
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="11" cy="11" r="8" fill="none" stroke="var(--border-col)" strokeWidth="1.5" />
          <circle cx="11" cy="11" r="8" fill="none" stroke="var(--accent)" strokeWidth="1.5"
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
        background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
        padding: '32px 24px',
      }}>
        {/* Zona wordmark */}
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '36px', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '8px' }}>
          Zona
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '48px' }}>
          Do less. Improve more.
        </div>

        {/* Welcome message */}
        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px', marginBottom: '16px', lineHeight: 1.3 }}>
            Your plan is ready.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '12px' }}>
            Zona keeps track of your sessions, adapts when things shift, and keeps you focused on what matters — finishing.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '48px' }}>
            Train with intention. The rest follows.
          </div>

          <button
            onClick={dismissWelcome}
            style={{
              width: '100%', padding: '16px',
              background: 'var(--accent)', color: 'var(--zona-navy)',
              border: 'none', borderRadius: '14px',
              fontFamily: 'var(--font-ui)', fontSize: '13px',
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

  // Post-wizard orientation — shown once after a plan is generated or replaced
  if (showOrientation) {
    return (
      <OrientationScreen
        plan={plan}
        firstName={firstName}
        zone2Ceiling={effectiveZone2Ceiling}
        onDismiss={() => setShowOrientation(false)}
      />
    )
  }

  const currentWeek = getCurrentWeek(plan.weeks)

  return (
    <div style={s}>

      {/* Impersonation banner */}
      {impersonating && (
        <div style={{
          background: 'var(--accent)', padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 2000,
        }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--zona-navy)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Viewing as {impersonating.name}
          </div>
          <button onClick={exitImpersonation} style={{
            background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '6px',
            color: 'var(--zona-navy)', fontFamily: 'var(--font-ui)', fontSize: '11px',
            letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px',
            cursor: 'pointer',
          }}>
            Exit
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {screen === 'today'    && <TodayScreen plan={plan} weekIndex={viewWeekIndex} onWeekChange={setViewWeekIndex} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} daysToRace={daysToRace} raceName={raceName} preferredMetric={preferredMetric} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} overridesReady={overridesReady} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} allCompletions={allCompletions} preferredUnits={preferredUnits} zone2Ceiling={effectiveZone2Ceiling} onManualSaved={refreshCompletions} restingHR={restingHR} maxHR={maxHR} aerobicPace={aerobicPace} firstName={firstName} />}
        {screen === 'plan'     && <PlanScreen plan={plan} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} allCompletions={allCompletions} onOverrideChange={setAllOverrides} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} overridesReady={overridesReady} />}
        {screen === 'coach'    && <CoachScreen plan={plan} currentWeek={currentWeek} runs={stravaRuns} stravaLoading={stravaLoading} stravaTokenFailed={stravaTokenFailed} firstName={firstName} onGoToMe={() => setScreen('me')} />}
        {screen === 'strava'   && <StravaScreen runs={stravaRuns} loading={stravaLoading} connected={stravaConnected} raceName={plan?.meta?.race_name} raceDate={plan?.meta?.race_date} raceDistanceKm={plan?.meta?.race_distance_km} zone2Ceiling={effectiveZone2Ceiling} restingHR={restingHR ?? undefined} maxHR={maxHR ?? undefined} />}
        {screen === 'me'       && <MeScreen plan={plan} initials={initials} athlete={plan?.meta?.athlete ?? ''} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} quitDate={quitDate} onSmokeTrackerChange={(enabled: boolean, date: string) => { setSmokeTrackerEnabled(enabled); setQuitDate(date); if (enabled && date) { const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)); setQuitDays(days) } else { setQuitDays(null) } }} resetPhrase={resetPhrase} onSaveMental={saveMental} theme={theme} onThemeChange={saveTheme} onBack={() => setScreen('today')} isAdmin={isAdmin} onOpenAdmin={() => setScreen('admin')} preferredUnits={preferredUnits} onUnitsChange={async (u: 'km' | 'mi') => { setPreferredUnits(u); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_units: u, updated_at: new Date().toISOString() }) } catch {} }} preferredMetric={preferredMetric} onMetricChange={async (m: 'distance' | 'duration') => { setPreferredMetric(m); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_metric: m, updated_at: new Date().toISOString() }) } catch {} }} restingHR={restingHR} maxHR={maxHR} onHRChange={async (rhr: number, mhr: number) => { setRestingHR(rhr); setMaxHR(mhr); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, resting_hr: rhr, max_hr: mhr, updated_at: new Date().toISOString() }) } catch {} }} firstName={firstName} lastName={lastName} profileEmail={profileEmail} onProfileChange={async (fn: string, ln: string, em: string) => { setFirstName(fn); setLastName(ln); setProfileEmail(em); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, first_name: fn, last_name: ln, email: em, updated_at: new Date().toISOString() }) } catch {} }} onOpenGenerate={() => setScreen('generate')} />}
        {/* CalendarOverlay hidden — entry point removed. Component lives in CalendarOverlay.tsx. */}
        {screen === 'calendar' && <CalendarOverlay plan={plan} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} allCompletions={allCompletions} onBack={() => setScreen('today')} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} />}
        {screen === 'session'  && activeSessionData && <SessionScreen session={activeSessionData} preloadedRuns={stravaRuns ?? []} onBack={() => setScreen('today')} onSaved={impersonating ? undefined : refreshCompletions} preferredUnits={preferredUnits} preferredMetric={preferredMetric} zone2Ceiling={effectiveZone2Ceiling} restingHR={restingHR} maxHR={maxHR} aerobicPace={aerobicPace} />}
        {screen === 'admin'    && <AdminScreen onBack={() => setScreen('me')} onImpersonate={impersonateUser} />}
        {screen === 'generate' && <GeneratePlanScreen onBack={() => setScreen(plan && plan !== EMPTY_PLAN ? 'me' : 'today')} firstName={firstName} lastName={lastName} restingHR={restingHR} maxHR={maxHR} onPlanSaved={handlePlanSaved} isOnboarding={!plan || plan === EMPTY_PLAN} />}
      </div>

      {/* Screen guide — first-load popup */}
      {guideScreen && (
        <ScreenGuide screen={guideScreen} onDismiss={() => setGuideScreen(null)} />
      )}

      {/* ── More expansion panel ── */}
      {showMore && (
        <>
          {/* Scrim — tap outside to close */}
          <div
            onClick={() => setShowMore(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 2998 }}
          />
          {/* Panel — slides up from just above nav */}
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '480px',
            paddingBottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 66px)',
            padding: '0 12px calc(max(16px, env(safe-area-inset-bottom)) + 66px)',
            zIndex: 2999,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'var(--card-bg)', borderRadius: '16px',
              border: '0.5px solid var(--border-col)',
              overflow: 'hidden',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
              pointerEvents: 'auto',
              animation: 'slideUp 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
            }}>
              {([
                ...(isAdmin ? [{ id: 'coach' as Screen, label: 'Coach', icon: (a: boolean) => <IconCoach active={a} /> }] : []),
                { id: 'strava' as Screen, label: 'Strava',  icon: (a: boolean) => <IconStrava active={a} /> },
                { id: 'me'     as Screen, label: 'Profile', icon: (a: boolean) => <IconMe     active={a} /> },
              ]).map(({ id, label, icon }, i) => {
                const active = screen === id
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setScreen(id)
                      setShowMore(false)
                      const seen = getSeenGuides()
                      if (!seen.has(id)) setGuideScreen(id)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 18px',
                      background: active ? 'var(--accent-soft)' : 'none',
                      border: 'none',
                      borderTop: i > 0 ? '0.5px solid var(--border-col)' : 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {icon(active)}
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 500,
                      color: active ? 'var(--accent)' : 'var(--text-primary)',
                      flex: 1,
                    }}>
                      {label}
                    </span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom nav bar ── */}
      {(() => {
        const moreActive = showMore || ['strava', 'me'].includes(screen) || (isAdmin && screen === 'coach')
        const navItems: { id: Screen; label: string; icon: (a: boolean) => React.ReactNode }[] = [
          { id: 'today', label: 'Today', icon: (a) => <IconToday active={a} /> },
          { id: 'plan',  label: 'Plan',  icon: (a) => <IconPlan  active={a} /> },
        ]
        return (
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: '480px',
            display: 'flex', alignItems: 'center',
            background: 'var(--nav-bg)', borderTop: '0.5px solid var(--border-col)',
            padding: '10px 0 max(16px, env(safe-area-inset-bottom))',
            zIndex: 3000,
          }}>
            {navItems.map(({ id, label, icon }) => {
              const active = screen === id
              return (
                <button key={id} onClick={() => {
                  setScreen(id)
                  setShowMore(false)
                  const seen = getSeenGuides()
                  if (!seen.has(id)) setGuideScreen(id)
                }} style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                }}>
                  {icon(active)}
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                </button>
              )
            })}
            {/* More button */}
            <button onClick={() => setShowMore(prev => !prev)} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            }}>
              <IconMore active={moreActive} />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: moreActive ? 'var(--accent)' : 'var(--text-muted)' }}>
                More
              </span>
            </button>
          </div>
        )
      })()}
    </div>
  )
}

// ── ORIENTATION SCREEN ────────────────────────────────────────────────────

function OrientationScreen({ plan, firstName, zone2Ceiling, onDismiss }: {
  plan: Plan; firstName: string; zone2Ceiling: number; onDismiss: () => void
}) {
  const raceName   = plan.meta.race_name || 'your race'
  const raceDate   = plan.meta.race_date ? new Date(plan.meta.race_date) : null
  const raceDateStr = raceDate ? raceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const totalWeeks = plan.weeks.length
  const daysToRace = raceDate ? Math.max(0, Math.ceil((raceDate.getTime() - Date.now()) / 86400000)) : null

  // Find first upcoming non-rest session
  const DOW_KEYS = ['mon','tue','wed','thu','fri','sat','sun']
  const now = new Date(); now.setHours(0, 0, 0, 0)
  let firstSession: { day: string; label: string; type: string } | null = null
  for (const week of plan.weeks) {
    const wDate = parseLocalDate((week as any).date)
    for (const key of DOW_KEYS) {
      const s = (week as any).sessions?.[key]
      if (!s || s.type === 'rest') continue
      const d = new Date(wDate)
      d.setDate(d.getDate() + DOW_KEYS.indexOf(key))
      if (d >= now) {
        firstSession = {
          day: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }),
          label: s.label || getSessionLabel(s.type),
          type: s.type,
        }
        break
      }
    }
    if (firstSession) break
  }

  const accent = firstSession ? getSessionColor(firstSession.type) : 'var(--accent)'
  const greeting = firstName ? `${firstName}, your` : 'Your'

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
      padding: '32px 24px',
    }}>
      {/* Brand mark */}
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: '32px', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '6px' }}>
        Zona
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '40px' }}>
        effort-first training
      </div>

      <div style={{ width: '100%', maxWidth: '340px' }}>
        {/* Headline */}
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.25, marginBottom: '6px' }}>
          {greeting} plan is set.
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '28px' }}>
          {totalWeeks} weeks. One session at a time.
        </div>

        {/* Race card */}
        {(raceName || raceDateStr) && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '14px', border: '0.5px solid var(--border-col)', padding: '16px', marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Goal race</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{raceName}</div>
            {raceDateStr && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {raceDateStr}{daysToRace !== null ? ` · ${daysToRace} days` : ''}
              </div>
            )}
          </div>
        )}

        {/* First session card */}
        {firstSession && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '14px', border: `0.5px solid var(--border-col)`, borderLeft: `4px solid ${accent}`, padding: '14px 16px', marginBottom: '12px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>First session</div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{firstSession.label}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{firstSession.day}</div>
          </div>
        )}

        {/* Zone 2 note */}
        <div style={{ background: 'var(--accent-soft)', borderRadius: '12px', border: '0.5px solid var(--accent-dim)', padding: '12px 14px', marginBottom: '32px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', lineHeight: 1.6 }}>
            Your Zone 2 ceiling is <strong>{zone2Ceiling} bpm</strong>. Easy runs stay under that. If your HR climbs above it, walk until it drops.
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onDismiss}
          style={{
            width: '100%', padding: '16px',
            background: 'var(--accent)', color: 'var(--zona-navy)',
            border: 'none', borderRadius: '14px',
            fontFamily: 'var(--font-ui)', fontSize: '13px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          Start training
        </button>
      </div>
    </div>
  )
}

// ── Shared header ─────────────────────────────────────────────────────────

function ScreenHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: '16px 16px 8px' }}>
      <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px' }}>{title}</div>
      {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 16px', marginBottom: '8px', marginTop: '20px' }}>
      {children}
    </div>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', margin: '0 12px', ...style }}>
      {children}
    </div>
  )
}

// ── SCREEN GUIDE ──────────────────────────────────────────────────────────

const GUIDE_CONTENT: Partial<Record<Screen, { title: string; body: string }>> = {
  today: {
    title: 'Today',
    body: "Your day. Tap a date, see what's on. Log it when you're done. That's the whole thing.",
  },
  plan: {
    title: 'Plan',
    body: "Your full build, laid out. Hold any session to move it or mark it done. Don't skip leg day!",
  },
  coach: {
    title: 'Coach',
    body: 'Occasionally harsh. Always right.',
  },
  strava: {
    title: 'Strava',
    body: 'Your runs, linked to your plan. Connects the effort to the training. Nothing else.',
  },
}

const GUIDE_SEEN_KEY = 'zona_guide_seen'

function getSeenGuides(): Set<string> {
  try {
    const raw = localStorage.getItem(GUIDE_SEEN_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch { return new Set() }
}

function markGuideSeen(screen: string) {
  try {
    const seen = getSeenGuides()
    seen.add(screen)
    localStorage.setItem(GUIDE_SEEN_KEY, JSON.stringify(Array.from(seen)))
  } catch {}
}

function ScreenGuide({ screen, onDismiss }: { screen: Screen; onDismiss: () => void }) {
  const content = GUIDE_CONTENT[screen]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    markGuideSeen(screen)
    setVisible(false)
    setTimeout(onDismiss, 280)
  }

  if (!content) return null

  const NAV_SCREENS: Screen[] = ['today', 'plan', 'coach', 'strava']
  const NAV_LABELS: Record<string, string> = { today: 'Today', plan: 'Plan', coach: 'Coach', strava: 'Strava' }

  return (
    <>
      {/* Scrim */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 4000,
          background: 'rgba(0,0,0,0.45)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '100%'})`,
        transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        width: '100%', maxWidth: '480px',
        background: 'var(--card-bg)',
        borderRadius: '20px 20px 0 0',
        zIndex: 4001,
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-col)' }} />
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px 16px' }}>
          <div style={{
            fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 500,
            color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '10px',
          }}>
            {content.title}
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '13px', lineHeight: 1.7,
            color: 'var(--text-muted)', marginBottom: '24px',
          }}>
            {content.body}
          </div>
          <button
            onClick={dismiss}
            style={{
              width: '100%', padding: '16px',
              background: 'var(--accent)', color: 'var(--zona-navy)',
              border: 'none', borderRadius: '14px',
              fontFamily: 'var(--font-ui)', fontSize: '13px',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontWeight: 500,
              marginBottom: '16px',
            }}
          >
            Got it
          </button>
        </div>

        {/* Mirrored nav bar — sits at bottom to show position */}
        <div style={{
          display: 'flex', alignItems: 'center',
          borderTop: '0.5px solid var(--border-col)',
          padding: '10px 0 4px',
          background: 'var(--nav-bg)',
        }}>
          {NAV_SCREENS.map(id => {
            const active = screen === id
            return (
              <div key={id} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              }}>
                {id === 'today'  && <IconToday  active={active} />}
                {id === 'plan'   && <IconPlan   active={active} />}
                {id === 'coach'  && <IconCoach  active={active} />}
                {id === 'strava' && <IconStrava active={active} />}
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {NAV_LABELS[id]}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Dot / accent colours — resolved via lib/session-types.ts ─────────────

// ── COMPLETION COPY ───────────────────────────────────────────────────────

function getCompletionCopy(type: string): { headline: string; body: string } {
  switch (type) {
    case 'easy':
    case 'run':      return { headline: 'Kept it easy.', body: "That's where the fitness is built. Zone 2 does its work quietly." }
    case 'long':     return { headline: 'Long one done.', body: "Resist the urge to add miles tomorrow. The adaptation happens now." }
    case 'quality':
    case 'tempo':    return { headline: 'Hard session logged.', body: "Earn that rest. Don't follow it with more effort." }
    case 'intervals':
    case 'hard':     return { headline: 'That was the hard part.', body: "The next 48 hours are when your body catches up. Let it." }
    case 'race':     return { headline: 'Race done.', body: "Whatever happened, happened. You showed up and finished." }
    case 'recovery': return { headline: 'Recovery done.', body: "More useful than it felt. That one counts." }
    case 'strength': return { headline: 'Strength session done.', body: "The legs will thank you eventually. Usually around km 70." }
    default:         return { headline: 'Session done.', body: "Next one when you're ready." }
  }
}

// ── Zona REFLECT RESPONSE ─────────────────────────────────────────────────

function getZonaReflectResponse(sessionType: string, rpe: number | null, fatigueTag: string | null): string {
  if (rpe === null && fatigueTag) {
    if (fatigueTag === 'Fresh') return "Legs felt good. That's what easy days are for."
    if (fatigueTag === 'Fine') return "Solid. Nothing to worry about."
    if (fatigueTag === 'Heavy') return "Noted. The load is building."
    if (fatigueTag === 'Wrecked') return "Proper recovery tonight. Not optional."
    return ''
  }
  if (rpe === null) return ''
  const isEasy = ['easy', 'recovery', 'run'].includes(sessionType)
  const isHard = ['quality', 'intervals', 'tempo', 'hard'].includes(sessionType)
  const isLong = sessionType === 'long'
  const isRace = sessionType === 'race'
  if (isEasy) {
    if (rpe <= 3) return "That's exactly it. Easy should feel easy."
    if (rpe <= 5) return "Comfortable. You're in the right zone."
    if (rpe <= 7) return "A touch warm for an easy day. Worth noting."
    return "That ran too hot. Easy days are where most people quietly wreck their week."
  }
  if (isHard) {
    if (rpe <= 4) return "Left some in the tank. Fine, sometimes."
    if (rpe <= 7) return "Solid work. Controlled effort where it matters."
    if (rpe <= 9) return "Hard session in the bank. Earn the rest."
    return "Maximum. Now actually rest."
  }
  if (isLong) {
    if (rpe <= 3) return "Easy long run. That's the whole point."
    if (rpe <= 6) return "Good distance. Keep the long one honest."
    if (rpe <= 8) return "Ran a bit hot. The legs need a proper day now."
    return "Too hard for a long one. Sleep properly and back off tomorrow."
  }
  if (isRace) {
    if (rpe <= 5) return "Maybe left a bit there."
    if (rpe <= 7) return "Solid race effort. Well managed."
    if (rpe <= 9) return "Good race. That's how you do it."
    return "Left nothing behind. That's how you race."
  }
  if (rpe <= 3) return "Easy session done. That's in the bank."
  if (rpe <= 5) return "Comfortable effort. Right zone."
  if (rpe <= 7) return "Solid work. Let the legs recover."
  if (rpe <= 9) return "Hard session logged. Earn that rest."
  return "Maximum effort. Now actually rest."
}

function getSkipResponse(reason: string): string {
  if (reason === 'Injury / illness') return "Smart call. Come back when you're ready."
  if (reason === 'Too tired') return "Body talking. Worth listening."
  if (reason === 'Life got busy') return "Life counts. Pick it back up."
  if (reason === 'Bad weather') return "It'll be there tomorrow."
  return "Fair enough. Pick it back up."
}

// ── COACHING FLAG ─────────────────────────────────────────────────────────
// Per-session quality-of-execution signal. Stored in session_completions.coaching_flag.
// R18 (confidence score) will aggregate these into a weekly signal.

type CoachingFlag = 'ok' | 'watch' | 'flag'

/** Pure function — no side effects. Returns null for session types without effort targets. */
function getCoachingFlag({
  sessionType,
  rpe,
  avgHr,
  zone2Ceiling,
}: {
  sessionType: string
  rpe: number | null
  avgHr: number | null
  zone2Ceiling: number | undefined
}): CoachingFlag | null {
  const isEasySession = ['easy', 'run', 'long', 'recovery'].includes(sessionType)
  const isHardSession = ['quality', 'intervals', 'tempo', 'hard'].includes(sessionType)
  const isRaceSession = sessionType === 'race'

  if (!isEasySession && !isHardSession && !isRaceSession) return null
  if (rpe === null && avgHr === null) return null

  if (isEasySession) {
    // Zone 2 breach is the strongest signal — takes precedence over RPE
    if (avgHr !== null && zone2Ceiling !== undefined && avgHr > zone2Ceiling) return 'flag'
    if (rpe !== null && rpe >= 7) return 'flag'
    if (rpe !== null && rpe >= 5) return 'watch'
    return 'ok'
  }

  if (isHardSession) {
    // Quality sessions: goal is to push. Very low RPE = didn't engage.
    if (rpe !== null && rpe <= 3) return 'watch'
    return 'ok'
  }

  if (isRaceSession) {
    if (rpe !== null && rpe <= 4) return 'watch'
    return 'ok'
  }

  return null
}

// ── SESSION POPUP ─────────────────────────────────────────────────────────

function SessionPopupInner({ session, weekTheme, weekN, preloadedRuns, onClose, onSaved, preferredUnits, zone2Ceiling, preferredMetric, restingHR, maxHR, aerobicPace }: {
  session: any; weekTheme: string; weekN: number; preloadedRuns: any[]
  onClose: () => void; onSaved?: () => void
  preferredUnits: 'km' | 'mi'; zone2Ceiling: number; preferredMetric?: 'distance' | 'duration'
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
}) {
  const [view, setView] = useState<'detail' | 'complete' | 'skip' | 'success' | 'reflect' | 'skip-reflect'>('detail')
  const [showManualModal, setShowManualModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())
  const [loadingClaimed, setLoadingClaimed] = useState(false)
  const [guidance, setGuidance] = useState<any | null>(null)
  const [rpe, setRpe] = useState<number | null>(null)
  const [fatigueTag, setFatigueTag] = useState<string | null>(null)
  const [savingRPE, setSavingRPE] = useState(false)
  const [reflectResponse, setReflectResponse] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState<string | null>(null)
  const [sessionMetric, setSessionMetric] = useState<'distance' | 'duration' | null>(null)
  const supabase = createClient()
  const metricStorageKey = `rts_metric_${weekN}_${session.key}`
  const sessionDefault = session.primary_metric ?? preferredMetric ?? 'distance'
  const effectiveMetric = sessionMetric ?? sessionDefault
  const isMetricCustom = sessionMetric !== null && sessionMetric !== sessionDefault

  // Load saved per-session metric from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(metricStorageKey)
      if (saved === 'distance' || saved === 'duration') setSessionMetric(saved)
    } catch {}
  }, [metricStorageKey])

  function updateSessionMetric(m: 'distance' | 'duration' | null) {
    setSessionMetric(m)
    try {
      if (m) localStorage.setItem(metricStorageKey, m)
      else localStorage.removeItem(metricStorageKey)
    } catch {}
  }

  const isPast = session.isPast
  const completion = session.completion
  const isComplete = completion?.status === 'complete'
  const isSkipped = completion?.status === 'skipped'

  // Load existing RPE/fatigue from completion
  useEffect(() => {
    if (completion?.rpe != null) setRpe(completion.rpe)
    if (completion?.fatigue_tag) setFatigueTag(completion.fatigue_tag)
  }, [completion])

  async function saveRPEFatigue(newRpe: number | null, newTag: string | null) {
    setSavingRPE(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const flag = getCoachingFlag({
        sessionType: session.type,
        rpe: newRpe,
        avgHr: completion?.avg_hr ?? null,
        zone2Ceiling,
      })
      await supabase.from('session_completions').upsert({
        user_id: user.id,
        week_n: weekN,
        session_day: session.key,
        status: completion?.status ?? 'complete',
        rpe: newRpe,
        fatigue_tag: newTag,
        coaching_flag: flag,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      onSaved?.()
    } catch {} finally { setSavingRPE(false) }
  }

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
        avg_hr: status === 'complete' ? (selectedActivity?.average_heartrate ? Math.round(selectedActivity.average_heartrate) : null) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      onSaved?.()
      if (status === 'complete') {
        setView('reflect')
      } else {
        setView('skip-reflect')
      }
    } catch {} finally { setSaving(false) }
  }


  // Pace from session structured field → Strava aerobic pace → null (no hardcoded fallback)
  const paceBracket = session.pace_target
    ?? ((session.type === 'easy' || session.type === 'run') ? aerobicPace ?? null : null)

  const color = getSessionColor(session.type)
  const config = { color, label: getSessionLabel(session.type) }

  // Per-session metric values — session may come from TodayScreen (formatted) or raw plan object (unformatted)
  const rawDuration = session.duration ?? (session.duration_mins != null ? fmtDurationMins(Number(session.duration_mins)) : null)
  const estimatedDuration = rawDuration ?? (session.distance ?? session.distance_km ? `~${fmtDurationMins(Math.round(Number(session.distance ?? session.distance_km) * 6.5))}` : null)
  const estimatedDistance = session.distance ?? session.distance_km ?? null

  // Reflect view — shown after any run is logged (Strava or non-run completion)
  if (view === 'reflect') {
    const copy = getCompletionCopy(session.type)
    return (
      <div style={{ padding: '24px 20px 32px' }}>
        {/* Logged confirmation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--teal-soft)', border: '0.5px solid var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>{copy.headline}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', lineHeight: 1.5 }}>{copy.body}</div>
          </div>
        </div>

        <div style={{ height: '0.5px', background: 'var(--border-col)', marginBottom: '24px' }} />

        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
          How did that land?
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
          Effort and body state. That's all I need.
        </div>

        {/* RPE */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Effort (RPE)</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => {
              const isActive = rpe === n
              const col = rpeColour(n)
              return (
                <button key={n} onClick={() => {
                  const newRpe = isActive ? null : n
                  setRpe(newRpe)
                  saveRPEFatigue(newRpe, fatigueTag)
                  setReflectResponse(getZonaReflectResponse(session.type, newRpe, fatigueTag))
                }} style={{
                  flex: 1, aspectRatio: '1', borderRadius: '8px',
                  border: `0.5px solid ${isActive ? col : 'var(--border-col)'}`,
                  background: isActive ? `color-mix(in srgb, ${col} 18%, transparent)` : 'var(--bg)',
                  color: isActive ? col : 'var(--text-muted)',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>{n}</button>
              )
            })}
          </div>
        </div>

        {/* Feel tags */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Body state</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['Fresh', 'Fine', 'Heavy', 'Wrecked'] as const).map(tag => {
              const isActive = fatigueTag === tag
              const tagColor = tag === 'Fresh' ? 'var(--session-green)' : tag === 'Fine' ? 'var(--accent)' : tag === 'Heavy' ? 'var(--amber)' : 'var(--coral)'
              return (
                <button key={tag} onClick={() => {
                  const newTag = isActive ? null : tag
                  setFatigueTag(newTag)
                  saveRPEFatigue(rpe, newTag)
                  if (!reflectResponse) setReflectResponse(getZonaReflectResponse(session.type, rpe, newTag))
                }} style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '8px 18px',
                  borderRadius: '20px',
                  border: `0.5px solid ${isActive ? tagColor : 'var(--border-col)'}`,
                  background: isActive ? `color-mix(in srgb, ${tagColor} 12%, transparent)` : 'transparent',
                  color: isActive ? tagColor : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: isActive ? 500 : 400, transition: 'all 0.12s',
                }}>{tag}</button>
              )
            })}
          </div>
        </div>

        {/* Zona response */}
        <div style={{
          minHeight: '48px', marginBottom: '20px',
          opacity: reflectResponse ? 1 : 0,
          transform: reflectResponse ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          pointerEvents: 'none',
        }}>
          {reflectResponse && (
            <div style={{
              background: 'var(--bg)', borderRadius: '10px',
              border: '0.5px solid var(--border-col)',
              padding: '12px 16px',
              fontFamily: 'var(--font-brand)', fontSize: '14px',
              fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5,
              letterSpacing: '-0.1px',
            }}>
              {reflectResponse}
            </div>
          )}
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '14px',
          background: reflectResponse ? 'var(--teal)' : 'var(--bg)',
          color: reflectResponse ? 'var(--zona-navy)' : 'var(--text-muted)',
          border: reflectResponse ? 'none' : '0.5px solid var(--border-col)',
          borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          fontWeight: reflectResponse ? 600 : 400,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {reflectResponse ? 'Done' : 'Skip for now'}
        </button>
      </div>
    )
  }

  // Skip reflect — shown after skipping a session
  if (view === 'skip-reflect') {
    return (
      <div style={{ padding: '24px 20px 32px' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
          Skipped.
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '28px' }}>
          What got in the way?
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '28px' }}>
          {(['Injury / illness', 'Too tired', 'Life got busy', 'Bad weather'] as const).map(reason => {
            const isActive = skipReason === reason
            return (
              <button key={reason} onClick={async () => {
                setSkipReason(reason)
                setReflectResponse(getSkipResponse(reason))
                try {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (user) {
                    await supabase.from('session_completions').upsert({
                      user_id: user.id, week_n: weekN, session_day: session.key,
                      status: 'skipped', fatigue_tag: reason, updated_at: new Date().toISOString(),
                    }, { onConflict: 'user_id,week_n,session_day' })
                    onSaved?.()
                  }
                } catch {}
              }} style={{
                padding: '12px 10px', borderRadius: '10px',
                border: `0.5px solid ${isActive ? 'var(--accent)' : 'var(--border-col)'}`,
                background: isActive ? 'var(--accent-soft)' : 'var(--bg)',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-ui)', fontSize: '12px',
                cursor: 'pointer', transition: 'all 0.12s', textAlign: 'center',
              }}>{reason}</button>
            )
          })}
        </div>

        <div style={{
          minHeight: '48px', marginBottom: '20px',
          opacity: reflectResponse ? 1 : 0,
          transform: reflectResponse ? 'translateY(0)' : 'translateY(6px)',
          transition: 'opacity 0.35s ease, transform 0.35s ease',
          pointerEvents: 'none',
        }}>
          {reflectResponse && (
            <div style={{
              background: 'var(--bg)', borderRadius: '10px',
              border: '0.5px solid var(--border-col)',
              padding: '12px 16px',
              fontFamily: 'var(--font-brand)', fontSize: '14px',
              fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5,
              letterSpacing: '-0.1px',
            }}>
              {reflectResponse}
            </div>
          )}
        </div>

        <button onClick={onClose} style={{
          width: '100%', padding: '14px',
          background: reflectResponse ? 'var(--teal)' : 'var(--bg)',
          color: reflectResponse ? 'var(--zona-navy)' : 'var(--text-muted)',
          border: reflectResponse ? 'none' : '0.5px solid var(--border-col)',
          borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          fontWeight: reflectResponse ? 600 : 400,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {reflectResponse ? 'Close' : 'Close without answering'}
        </button>
      </div>
    )
  }

  return (
    <>
      {/* ── TOP BLOCK ── */}
      <div style={{ padding: '14px 18px 16px 18px', borderBottom: '0.5px solid var(--border-col)' }}>
        {/* Date + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
            {session.day} · {session.date}
          </span>
          {isComplete && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: 'var(--accent-soft)', color: 'var(--teal)', border: '0.5px solid var(--teal-dim)', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✓ Done</span>}
          {isSkipped && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: 'rgba(80,80,80,0.08)', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skipped</span>}
        </div>
        {/* Zone label */}
        {(() => {
          const zL: string | null = (session.zone as string | undefined) ?? (
            session.type === 'recovery' ? 'Zone 1' :
            session.type === 'easy' || session.type === 'run' || session.type === 'long' ? 'Zone 2' :
            session.type === 'quality' || session.type === 'tempo' ? 'Zone 3' :
            session.type === 'intervals' || session.type === 'hard' ? 'Zone 4–5' : null
          )
          if (!zL || !['easy','run','quality','intervals','hard','tempo','race','recovery','long'].includes(session.type)) return null
          return (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: config.color, fontWeight: 500, background: `${config.color}12`, borderRadius: '5px', padding: '3px 9px', letterSpacing: '0.04em' }}>{zL}</span>
            </div>
          )
        })()}
        {/* Metric grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Primary metric card with per-session toggle */}
          {(estimatedDistance || estimatedDuration) && ['easy','run','quality','intervals','hard','tempo','race','recovery'].includes(session.type) && (
            <div style={{ background: `${config.color}10`, borderRadius: '10px', padding: '10px 12px', border: `0.5px solid ${config.color}30` }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: config.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {effectiveMetric === 'distance' ? 'Distance' : 'Duration'}
                {isMetricCustom && (
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', background: 'var(--amber-soft)', color: 'var(--amber)', border: '0.5px solid var(--amber-mid)', borderRadius: '4px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>custom</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: config.color, lineHeight: 1, marginBottom: '6px' }}>
                {effectiveMetric === 'distance'
                  ? <>{estimatedDistance ?? '—'}<span style={{ fontSize: '11px', fontWeight: 400, color: config.color, opacity: 0.7 }}> {preferredUnits}</span></>
                  : <span style={{ fontSize: '18px' }}>{estimatedDuration ?? '—'}</span>
                }
              </div>
              {/* Toggle */}
              <div style={{ display: 'flex', background: 'var(--toggle-inner-bg)', borderRadius: '6px', padding: '2px', width: 'fit-content', border: '0.5px solid var(--border-col)' }}>
                {(['distance', 'duration'] as const).map(m => (
                  <button key={m} onClick={() => updateSessionMetric(m === effectiveMetric && isMetricCustom ? null : m)} style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', padding: '3px 9px', borderRadius: '4px', border: 'none', background: effectiveMetric === m ? config.color : 'none', color: effectiveMetric === m ? 'var(--zona-navy)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s' }}>
                    {m === 'distance' ? preferredUnits : 'min'}
                  </button>
                ))}
              </div>
              {isMetricCustom && (
                <button onClick={() => updateSessionMetric(null)} style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0', textDecoration: 'underline', textAlign: 'left' }}>
                  Reset to global
                </button>
              )}
            </div>
          )}
          {/* HR card */}
          {['easy','run','quality','intervals','hard','tempo','race','recovery'].includes(session.type) && (
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                {session.zone ? session.zone : (session.type === 'quality' || session.type === 'intervals' || session.type === 'hard' ? 'Target HR' : 'Zone 2 ceiling')}
              </div>
              {(() => {
                const hrVal = getSessionHRDisplay(session.type, session.hr_target, restingHR ?? null, maxHR ?? null, zone2Ceiling)
                return (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>
                      {hrVal ?? '—'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)' }}>bpm</span>
                  </div>
                )
              })()}
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {session.type === 'quality' || session.type === 'intervals' || session.type === 'hard' ? 'Warm up 15 min first' : 'Walk if exceeded'}
              </div>
            </div>
          )}
          {/* Pace card */}
          {paceBracket && (
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Est. pace</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{paceBracket}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>HR-derived estimate</div>
            </div>
          )}
          {/* Zone card for strength */}
          {session.type === 'strength' && (
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Duration</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>{estimatedDuration ?? '45min'}</div>
            </div>
          )}
        </div>
      </div>

      {view === 'detail' && (
        <>
          {/* ── EXECUTION SUMMARY: planned vs actual — only when complete with actuals ── */}
          {isComplete && (completion?.strava_activity_km || completion?.avg_hr || completion?.rpe != null) && (() => {
            const plannedZone = (session.zone as string | undefined) ?? (
              session.type === 'recovery' ? 'Zone 1' :
              session.type === 'easy' || session.type === 'run' || session.type === 'long' ? 'Zone 2' :
              session.type === 'quality' || session.type === 'tempo' ? 'Zone 3' :
              session.type === 'intervals' || session.type === 'hard' ? 'Zone 4–5' : null
            )
            const isZoneBreach = completion?.avg_hr && zone2Ceiling &&
              completion.avg_hr > zone2Ceiling &&
              ['easy', 'run', 'long', 'recovery'].includes(session.type)
            const flag = completion?.coaching_flag as string | null | undefined
            return (
              <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border-col)', background: 'var(--bg)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

                  {/* Planned column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Planned</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {(estimatedDistance || estimatedDuration) && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {effectiveMetric === 'distance' ? `${estimatedDistance ?? '—'}${preferredUnits}` : (estimatedDuration ?? '—')}
                        </span>
                      )}
                      {(plannedZone || session.hr_target) && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {[plannedZone, session.hr_target].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {session.rpe_target != null && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                          RPE {session.rpe_target}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vertical divider */}
                  <div style={{ width: '0.5px', background: 'var(--border-col)', alignSelf: 'stretch', flexShrink: 0 }} />

                  {/* Actual column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Actual</div>
                      {flag && (
                        <span style={{
                          fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '0.05em',
                          textTransform: 'uppercase', borderRadius: '4px', padding: '2px 6px',
                          color: flag === 'ok' ? 'var(--teal)' : 'var(--amber)',
                          background: flag === 'ok' ? 'var(--teal-soft)' : 'var(--amber-soft)',
                        }}>
                          {flag === 'ok' ? 'On target' : 'Check this'}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {completion?.strava_activity_km && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)' }}>
                          {completion.strava_activity_km}{preferredUnits}
                        </span>
                      )}
                      {completion?.avg_hr && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: isZoneBreach ? 'var(--amber)' : 'var(--text-primary)' }}>
                          {completion.avg_hr} bpm avg
                          {isZoneBreach && <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.8 }}>↑</span>}
                        </span>
                      )}
                      {completion?.rpe != null && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: rpeColour(completion.rpe) }}>
                          RPE {completion.rpe}
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )
          })()}

          {/* ── MIDDLE BLOCK: session description ── */}
          {session.detail && (
            <div style={{ padding: '16px 18px', borderBottom: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>What to do</div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{session.detail}</div>
            </div>
          )}

          {/* Week theme — readable, not footnote */}
          {weekTheme && (
            <div style={{ padding: '12px 18px', background: 'var(--bg)', borderBottom: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Week focus</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{weekTheme}</div>
            </div>
          )}

          {/* ── BOTTOM BLOCK: coach notes — prefer session.coach_notes, fall back to DB guidance ── */}
          {(session.coach_notes?.filter(Boolean).length > 0 || guidance) && (
            <div style={{ padding: '14px 18px 4px', borderBottom: '0.5px solid var(--border-col)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: config.color, flexShrink: 0 }} />
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: config.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Coach notes</div>
              </div>
              {session.coach_notes?.filter(Boolean).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                  {(session.coach_notes as string[]).filter(Boolean).map((note, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: config.color, marginTop: '6px', flexShrink: 0, opacity: 0.7 }} />
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{note}</div>
                    </div>
                  ))}
                </div>
              ) : guidance ? (
                <>
                  {guidance.why && (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: guidance.what || guidance.how ? '14px' : '10px', fontStyle: 'italic' }}>
                      {guidance.why}
                    </div>
                  )}
                  {guidance.what && (
                    <div style={{ marginBottom: guidance.how ? '12px' : '10px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>What</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{guidance.what}</div>
                    </div>
                  )}
                  {guidance.how && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>How</div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{guidance.how}</div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* Action buttons — sticky to bottom of scroll container */}
          <div style={{
            position: 'sticky', bottom: 0,
            padding: '12px 18px 16px',
            background: 'var(--card-bg)',
            borderTop: '0.5px solid var(--border-col)',
            display: 'flex', gap: '8px', flexWrap: 'wrap',
            borderRadius: '0 0 12px 12px',
          }}>
            {(() => {
              const isRunType = ['easy', 'run', 'quality', 'race'].includes(session.type)
              if (session.isFuture && !isComplete && !isSkipped) {
                return (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px', width: '100%' }}>
                    Available to log on {session.date}
                  </div>
                )
              }
              if (isComplete || isSkipped) {
                return (
                  <button onClick={() => isRunType ? setView('complete') : saveCompletion('complete')} style={{ flex: 1, background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer', letterSpacing: '0.04em' }}>
                    Update log
                  </button>
                )
              }
              if (!isComplete && !isSkipped) {
                if (isRunType) {
                  return (
                    <>
                      <button onClick={() => setView('complete')} style={{ flex: 1, minWidth: '120px', background: config.color, color: 'var(--zona-navy)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                        Match a Strava run
                      </button>
                      <button onClick={() => setShowManualModal(true)} style={{ flex: 1, minWidth: '100px', background: 'var(--card-bg)', color: config.color, border: `0.5px solid ${config.color}40`, borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500 }}>
                        Log manually
                      </button>
                      <button onClick={() => setView('skip')} style={{ width: '100%', background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '10px', padding: '11px', fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Skip this session
                      </button>
                    </>
                  )
                } else {
                  return (
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <button onClick={() => saveCompletion('complete')} disabled={saving} style={{ flex: 2, background: config.color, color: 'var(--zona-navy)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Saving...' : 'Mark as done'}
                      </button>
                      <button onClick={() => setView('skip')} style={{ flex: 1, background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                        Skip
                      </button>
                    </div>
                  )
                }
              }
              return null
            })()}
          </div>

          {/* ── HOW DID IT FEEL (shown when complete or skipped) ── */}
          {(isComplete || isSkipped) && (
            <div style={{ padding: '18px 18px 8px', borderTop: '0.5px solid var(--border-col)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px' }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
                  How did it feel?
                </div>
                {savingRPE && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)' }}>saving…</span>}
              </div>

              {/* RPE — tappable 1–10 buttons */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Effort (RPE)</span>
                  {rpe != null && (
                    <span style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: rpe <= 3 ? 'var(--session-green)' : rpe <= 6 ? 'var(--session-easy)' : rpe <= 8 ? 'var(--amber)' : 'var(--coral)', lineHeight: 1 }}>
                      {rpe}<span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>/10</span>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => {
                    const isActive = rpe === n
                    const btnColor = n <= 3 ? 'var(--session-green)' : n <= 6 ? 'var(--session-easy)' : n <= 8 ? 'var(--amber)' : 'var(--coral)'
                    return (
                      <button
                        key={n}
                        onClick={() => { setRpe(n); saveRPEFatigue(n, fatigueTag) }}
                        style={{
                          flex: 1, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: isActive ? 700 : 400,
                          borderRadius: '8px', border: `0.5px solid ${isActive ? btnColor : 'var(--border-col)'}`,
                          background: isActive ? btnColor : 'var(--bg)',
                          color: isActive ? 'var(--zona-navy)' : 'var(--text-muted)',
                          cursor: 'pointer', transition: 'all 0.12s', padding: '0',
                          minWidth: 0,
                        }}
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '5px' }}>
                  <span>Easy</span><span>Moderate</span><span>Max</span>
                </div>
              </div>

              {/* Fatigue tags */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Body feeling</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['Fresh', 'Fine', 'Heavy', 'Wrecked'] as const).map(tag => {
                    const isActive = fatigueTag === tag
                    const tagColor = tag === 'Fresh' ? 'var(--session-green)' : tag === 'Fine' ? 'var(--accent)' : tag === 'Heavy' ? 'var(--amber)' : 'var(--coral)'
                    return (
                      <button key={tag} onClick={() => { const next = isActive ? null : tag; setFatigueTag(next); saveRPEFatigue(rpe, next) }}
                        style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '8px 18px', borderRadius: '20px', border: `0.5px solid ${isActive ? tagColor : 'var(--border-col)'}`, background: isActive ? `${tagColor}18` : 'transparent', color: isActive ? tagColor : 'var(--text-muted)', cursor: 'pointer', fontWeight: isActive ? 500 : 400, transition: 'all 0.12s' }}>
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Strava log view */}
      {view === 'complete' && (
        <div style={{ padding: '16px 18px 24px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Link a Strava activity</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Optional — select from recent runs</div>
          {loadingClaimed ? (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>Loading activities...</div>
          ) : stravaRuns.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
              {stravaRuns.slice(0, 20).map((run: any) => {
                const isSelected = selectedActivity?.id === run.id
                return (
                  <div key={run.id} onClick={() => setSelectedActivity(isSelected ? null : run)} style={{
                    background: isSelected ? 'var(--teal-soft)' : 'var(--bg)',
                    border: `0.5px solid ${isSelected ? 'var(--teal-mid)' : 'var(--border-col)'}`,
                    borderRadius: '12px', padding: '10px 12px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{run.name}</div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(run.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {(run.distance / 1000).toFixed(1)}km {run.average_heartrate ? `· ${Math.round(run.average_heartrate)} bpm` : ''}
                      </div>
                    </div>
                    {isSelected && <span style={{ color: 'var(--teal)', fontSize: '16px' }}>✓</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', marginBottom: '8px' }}>No Strava activities found near this session date</div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => saveCompletion('complete')} disabled={saving} style={{ flex: 2, background: config.color, color: 'var(--zona-navy)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Confirm complete'}
            </button>
          </div>
        </div>
      )}

      {/* ManualRunModal — opened from session screen, pre-filled with session context */}
      {showManualModal && (
        <ManualRunModal
          weekN={weekN}
          sessionKey={session.key}
          preferredUnits={preferredUnits}
          onClose={() => setShowManualModal(false)}
          onSaved={() => { setShowManualModal(false); onSaved?.(); onClose() }}
          sessionName={session.title}
          sessionType={session.type}
          plannedDistanceKm={session.distance_km ?? session.distance ?? undefined}
          plannedDurationMins={session.duration_mins ? Number(session.duration_mins) : undefined}
        />
      )}

      {/* Skip view */}
      {view === 'skip' && (
        <div style={{ padding: '16px 18px 24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
            Mark this session as skipped? It will show in your log.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => saveCompletion('skipped')} disabled={saving} style={{ flex: 2, background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-col)', borderRadius: '12px', padding: '14px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
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

const FATIGUE_COLORS: Record<string, string> = {
  Fresh:  'var(--session-green)',
  Fine:   'var(--accent)',
  Normal: 'var(--accent)',
  Heavy:  'var(--amber)',
  Wrecked:'var(--coral)',
  Cooked: 'var(--coral)',
}

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
  distance?: number
  duration?: string
  primary_metric?: 'distance' | 'duration'
  zone?: string
  hr_target?: string
  pace_target?: string
  rpe_target?: number
  coach_notes?: [string, string?, string?]
}

function DateStrip({ sessions, completions, selectedKey, onSelect, weekIndex, totalWeeks, onWeekChange }: {
  sessions: SessionEntry[]
  completions: Record<string, any>
  selectedKey: string | null
  onSelect: (key: string) => void
  weekIndex: number
  totalWeeks: number
  onWeekChange: (i: number) => void
}) {
  const sessionMap = Object.fromEntries(sessions.map(s => [s.displayKey, s]))
  const touchStartX = useRef<number | null>(null)

  function getDotColor(key: string): string | null {
    const s = sessionMap[key]
    if (!s || s.type === 'rest') return null
    const comp = completions[s.key] // use originalDay for completion lookup
    if (comp?.status === 'complete') return 'var(--teal)'
    if (comp?.status === 'skipped') return 'var(--text-muted)'
    return getSessionColor(s.type)
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
      style={{ borderBottom: '0.5px solid var(--border-col)', background: 'var(--bg)', paddingBottom: '10px' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Week label row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px 8px' }}>
        <button
          onClick={() => weekIndex > 0 && onWeekChange(weekIndex - 1)}
          style={{ background: 'none', border: 'none', color: weekIndex > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: '18px', cursor: weekIndex > 0 ? 'pointer' : 'default', padding: 0, lineHeight: 1 }}
        ><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Week {weekIndex + 1} of {totalWeeks}
        </span>
        <button
          onClick={() => weekIndex < totalWeeks - 1 && onWeekChange(weekIndex + 1)}
          style={{ background: 'none', border: 'none', color: weekIndex < totalWeeks - 1 ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: '18px', cursor: weekIndex < totalWeeks - 1 ? 'pointer' : 'default', padding: 0, lineHeight: 1 }}
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
                fontFamily: 'var(--font-ui)', fontSize: '10px',
                color: isSelected ? 'var(--accent)' : isToday ? 'var(--accent)' : 'var(--text-secondary)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>
                {DOW_LETTER[key]}
              </span>

              {/* Date circle */}
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isSelected ? 'var(--accent)' : isToday && !isSelected ? 'var(--accent-soft)' : 'transparent',
                border: isToday && !isSelected ? '1px solid var(--accent-mid)' : 'none',
                transition: 'background 0.15s',
              }}>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '13px',
                  color: isSelected ? 'var(--zona-navy)' : isToday ? 'var(--accent)' : dateNum ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontWeight: isToday || isSelected ? 600 : 400,
                }}>
                  {dateNum}
                </span>
              </div>

              {/* Session dot — larger for completed */}
              <div style={{
                width: dotColor === 'var(--teal)' ? '6px' : '4px',
                height: dotColor === 'var(--teal)' ? '6px' : '4px',
                borderRadius: '50%',
                background: dotColor ?? 'transparent',
                transition: 'width 0.1s, height 0.1s',
              }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── MANUAL RUN MODAL ─────────────────────────────────────────────────────

function rpeColour(n: number): string {
  if (n <= 3) return 'var(--session-recovery)'
  if (n <= 6) return 'var(--accent)'
  if (n <= 8) return 'var(--amber)'
  return 'var(--coral)'
}

function rpeLabel(n: number): string {
  if (n <= 2) return 'Very easy. Barely working.'
  if (n <= 4) return 'Comfortable. Zone 2 territory.'
  if (n <= 6) return 'Moderate. You could still talk.'
  if (n <= 8) return 'Hard. Breathing heavy.'
  if (n <= 9) return 'Very hard. Lactate territory.'
  return 'Maximum. Left nothing behind.'
}

function savedCopy(rpe: number | null): string {
  if (rpe === null) return "Logged. That's in the books."
  if (rpe <= 3) return "Easy day done. That's the zone."
  if (rpe <= 5) return "Comfortable effort. Exactly right."
  if (rpe <= 7) return "Solid work. Let the legs recover."
  if (rpe <= 9) return "Hard session logged. Earn that rest."
  return "Maximum effort. Now actually rest."
}

function ManualRunModal({ weekN, sessionKey, preferredUnits, onClose, onSaved, sessionName, sessionType, plannedDistanceKm, plannedDurationMins }: {
  weekN: number
  sessionKey: string | null
  preferredUnits: 'km' | 'mi'
  onClose: () => void
  onSaved: () => void
  sessionName?: string
  sessionType?: string
  plannedDistanceKm?: number
  plannedDurationMins?: number
}) {
  const initWhole   = plannedDistanceKm ? Math.floor(plannedDistanceKm) : 5
  const initDecimal = plannedDistanceKm ? Math.round((plannedDistanceKm % 1) * 10) : 0
  const initHours   = plannedDurationMins ? Math.floor(plannedDurationMins / 60) : 0
  const initMinutes = plannedDurationMins ? plannedDurationMins % 60 : 30

  const [distWhole, setDistWhole] = useState(initWhole)
  const [distDecimal, setDistDecimal] = useState(initDecimal)
  const [hours, setHours]   = useState(initHours)
  const [minutes, setMinutes] = useState(initMinutes)
  const [seconds, setSeconds] = useState(0)
  const [notes, setNotes]   = useState('')
  const [rpe, setRpe]       = useState<number | null>(null)
  const [fatigueTag, setFatigueTag] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)
  const [savedStep, setSavedStep] = useState(false)
  const [reflectResponse, setReflectResponse] = useState<string | null>(null)
  const supabase = createClient()

  const sessionColour = sessionType ? getSessionColor(sessionType) : 'var(--teal)'

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  function handleClose() {
    setVisible(false)
    setTimeout(() => {
      if (savedStep) onSaved()
      onClose()
    }, 300)
  }

  const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
  const distanceStr = `${distWhole}.${distDecimal}`
  const durationStr = `${hours > 0 ? hours + 'h ' : ''}${String(minutes).padStart(2, '0')}m${seconds > 0 ? ' ' + String(seconds).padStart(2, '0') + 's' : ''}`
  const hasData = distWhole > 0 || distDecimal > 0 || hours > 0 || minutes > 0 || seconds > 0

  async function save() {
    if (!hasData) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const dist  = parseFloat(distanceStr)
      const distKm = preferredUnits === 'mi' ? dist * 1.60934 : dist
      const key   = sessionKey ?? todayKey
      await supabase.from('session_completions').upsert({
        user_id: user.id,
        week_n: weekN,
        session_day: key,
        status: 'complete',
        strava_activity_id: null,
        strava_activity_name: notes || `Manual log · ${distanceStr}${preferredUnits} · ${durationStr}`,
        strava_activity_km: +distKm.toFixed(1),
        rpe: null,
        fatigue_tag: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      setSavedStep(true)
    } catch {} finally { setSaving(false) }
  }

  async function saveReflect(newRpe: number | null, newTag: string | null) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const key = sessionKey ?? todayKey
      const flag = getCoachingFlag({ sessionType: sessionType ?? '', rpe: newRpe, avgHr: null, zone2Ceiling: undefined })
      await supabase.from('session_completions').upsert({
        user_id: user.id, week_n: weekN, session_day: key,
        status: 'complete', rpe: newRpe, fatigue_tag: newTag,
        coaching_flag: flag,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
    } catch {}
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '10px',
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '8px',
  }

  function Stepper({ label, value, min, max, step = 1, onChange, pad = false }: {
    label: string; value: number; min: number; max: number
    step?: number; onChange: (v: number) => void; pad?: boolean
  }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minWidth: 0 }}>
        <div style={labelStyle}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}>
          <button onClick={() => onChange(Math.max(min, value - step))} style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: 'var(--bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <div style={{ minWidth: '34px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>
            {pad ? String(value).padStart(2, '0') : value}
          </div>
          <button onClick={() => onChange(Math.min(max, value + step))} style={{ width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0, background: 'var(--bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: visible ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
        zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        transition: 'background 0.3s',
      }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card-bg)', width: '100%', maxWidth: '480px',
          borderRadius: '20px 20px 0 0', padding: '8px 20px 24px',
          border: '0.5px solid var(--border-col)',
          marginBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
          maxHeight: 'calc(90vh - 64px)', overflowY: 'auto',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 16px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-col)' }} />
        </div>

        {/* ── REFLECT STEP — shown after save ── */}
        {savedStep ? (
          <div style={{ padding: '8px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--teal-soft)', border: '0.5px solid var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Logged.</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)' }}>{distanceStr}{preferredUnits} · {durationStr}</div>
              </div>
            </div>

            <div style={{ height: '0.5px', background: 'var(--border-col)', marginBottom: '20px' }} />

            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '19px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              How did that land?
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Effort and body state. That's all I need.
            </div>

            {/* RPE */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Effort (RPE)</div>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => {
                  const active = rpe === n
                  const col = rpeColour(n)
                  return (
                    <button key={n} onClick={() => {
                      const newRpe = active ? null : n
                      setRpe(newRpe)
                      const resp = getZonaReflectResponse(sessionType ?? '', newRpe, fatigueTag)
                      setReflectResponse(resp || null)
                      saveReflect(newRpe, fatigueTag)
                    }} style={{
                      flex: 1, aspectRatio: '1', borderRadius: '8px',
                      border: `0.5px solid ${active ? col : 'var(--border-col)'}`,
                      background: active ? `color-mix(in srgb, ${col} 18%, transparent)` : 'var(--bg)',
                      color: active ? col : 'var(--text-muted)',
                      fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: active ? 700 : 400,
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}>{n}</button>
                  )
                })}
              </div>
            </div>

            {/* Feel tags */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Body state</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['Fresh', 'Fine', 'Heavy', 'Wrecked'] as const).map(tag => {
                  const active = fatigueTag === tag
                  const tagColor = tag === 'Fresh' ? 'var(--session-green)' : tag === 'Fine' ? 'var(--accent)' : tag === 'Heavy' ? 'var(--amber)' : 'var(--coral)'
                  return (
                    <button key={tag} onClick={() => {
                      const newTag = active ? null : tag
                      setFatigueTag(newTag)
                      if (!reflectResponse) {
                        const resp = getZonaReflectResponse(sessionType ?? '', rpe, newTag)
                        setReflectResponse(resp || null)
                      }
                      saveReflect(rpe, newTag)
                    }} style={{
                      fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '7px 16px',
                      borderRadius: '20px',
                      border: `0.5px solid ${active ? tagColor : 'var(--border-col)'}`,
                      background: active ? `color-mix(in srgb, ${tagColor} 12%, transparent)` : 'transparent',
                      color: active ? tagColor : 'var(--text-muted)',
                      cursor: 'pointer', fontWeight: active ? 500 : 400, transition: 'all 0.12s',
                    }}>{tag}</button>
                  )
                })}
              </div>
            </div>

            {/* Zona response */}
            <div style={{
              minHeight: '48px', marginBottom: '16px',
              opacity: reflectResponse ? 1 : 0,
              transform: reflectResponse ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
              pointerEvents: 'none',
            }}>
              {reflectResponse && (
                <div style={{
                  background: 'var(--bg)', borderRadius: '10px',
                  border: '0.5px solid var(--border-col)',
                  padding: '12px 16px',
                  fontFamily: 'var(--font-brand)', fontSize: '14px',
                  fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5,
                  letterSpacing: '-0.1px',
                }}>
                  {reflectResponse}
                </div>
              )}
            </div>

            <button onClick={handleClose} style={{
              width: '100%', padding: '14px',
              background: reflectResponse ? 'var(--teal)' : 'var(--bg)',
              color: reflectResponse ? 'var(--zona-navy)' : 'var(--text-muted)',
              border: reflectResponse ? 'none' : '0.5px solid var(--border-col)',
              borderRadius: '12px',
              fontFamily: 'var(--font-ui)', fontSize: '13px',
              fontWeight: reflectResponse ? 600 : 400,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {reflectResponse ? 'Done' : 'Skip for now'}
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Log a run</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Manual entry · no Strava needed
                </div>
              </div>
              <button onClick={handleClose} style={{ background: 'var(--bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Session context strip — shown when opened from a planned session */}
            {sessionName && (
              <div style={{
                background: `color-mix(in srgb, ${sessionColour} 8%, transparent)`,
                border: `0.5px solid color-mix(in srgb, ${sessionColour} 30%, transparent)`,
                borderRadius: '10px', padding: '10px 14px', marginBottom: '20px',
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: sessionColour, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
                  Planned
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {sessionName}
                </div>
                {(plannedDistanceKm != null || plannedDurationMins != null) && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {plannedDistanceKm != null ? `${plannedDistanceKm}${preferredUnits}` : ''}
                    {plannedDistanceKm != null && plannedDurationMins != null ? ' · ' : ''}
                    {plannedDurationMins != null ? fmtDurationMins(plannedDurationMins) : ''}
                    {' '}<span style={{ opacity: 0.6 }}>— edit below if different</span>
                  </div>
                )}
              </div>
            )}

            {/* Distance */}
            <div style={{ marginBottom: '24px' }}>
              <div style={labelStyle}>Distance ({preferredUnits})</div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 8px' }}>
                  <button onClick={() => setDistWhole(Math.max(0, distWhole - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer' }}>−</button>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--text-primary)', minWidth: '32px', textAlign: 'center' }}>{distWhole}</span>
                  <button onClick={() => setDistWhole(distWhole + 1)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--text-muted)', padding: '0 4px' }}>.</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 8px' }}>
                  <button onClick={() => setDistDecimal(Math.max(0, distDecimal - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer' }}>−</button>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--text-primary)', minWidth: '16px', textAlign: 'center' }}>{distDecimal}</span>
                  <button onClick={() => setDistDecimal(Math.min(9, distDecimal + 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer' }}>+</button>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>{distanceStr} {preferredUnits}</div>
            </div>

            {/* Duration */}
            <div style={{ marginBottom: '20px' }}>
              <div style={labelStyle}>Duration</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 16px 1fr 16px 1fr', alignItems: 'start', width: '100%' }}>
                <Stepper label="hrs" value={hours}   min={0} max={12} onChange={setHours} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '24px', color: 'var(--text-muted)', fontSize: '18px' }}>:</div>
                <Stepper label="min" value={minutes} min={0} max={59} onChange={setMinutes} pad />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '24px', color: 'var(--text-muted)', fontSize: '18px' }}>:</div>
                <Stepper label="sec" value={seconds} min={0} max={59} step={5} onChange={setSeconds} pad />
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '20px' }}>
              <div style={labelStyle}>Notes <span style={{ textTransform: 'none', letterSpacing: 0, opacity: 0.6, fontSize: '10px' }}>optional</span></div>
              <textarea
                placeholder="Anything worth remembering?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                style={{
                  width: '100%', background: 'var(--bg)',
                  border: '0.5px solid var(--border-col)', borderRadius: '8px',
                  padding: '12px', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-ui)', fontSize: '13px',
                  outline: 'none', resize: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Save */}
            <button
              onClick={save}
              disabled={saving || !hasData}
              style={{
                width: '100%', padding: '16px',
                background: hasData ? 'var(--teal)' : 'var(--teal-dim)',
                color: hasData ? 'var(--zona-navy)' : 'var(--teal)',
                border: 'none', borderRadius: '14px',
                fontFamily: 'var(--font-brand)', fontSize: '14px',
                fontWeight: 600, letterSpacing: '-0.1px',
                cursor: hasData ? 'pointer' : 'not-allowed',
                opacity: saving ? 0.7 : 1,
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'Saving…' : hasData ? `Save · ${distanceStr}${preferredUnits} · ${durationStr}` : 'Enter distance or duration'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── UTILITIES ─────────────────────────────────────────────────────────────

/** Format a duration in minutes as a human-readable string: 45 → "45min", 90 → "1h30", 120 → "2h00" */
function fmtDurationMins(mins: number): string {
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

/** Parse legacy free-text detail field into structured distance/duration */
function parseSessionDetail(detail: string | null): { distance?: number; duration?: string } {
  if (!detail) return {}
  const s = detail.trim()
  const hm = s.match(/^(\d+)h(\d{2})\b/)
  if (hm) return { duration: `${hm[1]}h${hm[2]}` }
  const h = s.match(/^(\d+)h\b/)
  if (h) return { duration: `${h[1]}h` }
  const min = s.match(/^(\d+(?:\.\d+)?)\s*min\b/i)
  if (min) return { duration: `${min[1]}min` }
  const km = s.match(/^(\d+(?:\.\d+)?)\s*km\b/i)
  if (km) return { distance: parseFloat(km[1]) }
  return {}
}

/** Karvonen HR zones: returns {lo, hi} or null if HR data unavailable */
function karvonenZone(
  restingHR: number | null,
  maxHR: number | null,
  loPct: number,
  hiPct: number,
): { lo: number; hi: number } | null {
  if (!restingHR || !maxHR) return null
  const hrr = maxHR - restingHR
  return {
    lo: Math.round(restingHR + (loPct / 100) * hrr),
    hi: Math.round(restingHR + (hiPct / 100) * hrr),
  }
}

/** Returns the HR string to display for a session type, using Karvonen if available */
function getSessionHRDisplay(
  sessionType: string,
  hr_target: string | undefined,
  restingHR: number | null,
  maxHR: number | null,
  zone2Ceiling: number | undefined,
): string | null {
  // Generated plan already has a personalised hr_target
  if (hr_target) return hr_target
  if (sessionType === 'easy' || sessionType === 'run') {
    const z = karvonenZone(restingHR, maxHR, 60, 70)
    if (z) return `< ${z.hi}`
    return zone2Ceiling ? `< ${zone2Ceiling}` : null
  }
  if (sessionType === 'quality' || sessionType === 'intervals' || sessionType === 'hard' || sessionType === 'tempo') {
    const z = karvonenZone(restingHR, maxHR, 75, 85)
    if (z) return `${z.lo}–${z.hi}`
    return null
  }
  return null
}

/** Returns aerobic pace bracket derived from Strava runs in the user's Z2 HR band */
function computeAerobicPace(
  runs: any[] | null,
  restingHR: number | null,
  maxHR: number | null,
  preferredUnits: 'km' | 'mi' = 'km',
): string | null {
  if (!runs || !runs.length || !restingHR || !maxHR) return null
  const hrr = maxHR - restingHR
  const lo = Math.round(restingHR + 0.60 * hrr)
  const hi = Math.round(restingHR + 0.70 * hrr)
  const sample = runs.filter((r: any) =>
    r.average_heartrate && r.average_heartrate >= lo && r.average_heartrate <= hi
    && r.moving_time > 0 && r.distance > 2000
  ).slice(0, 6)
  if (!sample.length) return null
  const avgSecPerKm = sample.reduce((s: number, r: any) => s + r.moving_time / (r.distance / 1000), 0) / sample.length
  const sec = preferredUnits === 'mi' ? avgSecPerKm * 1.60934 : avgSecPerKm
  const unit = preferredUnits === 'mi' ? '/mi' : '/km'
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}${unit}`
}

// ── SESSION HERO ──────────────────────────────────────────────────────────

function SessionHero({ session, completion, onTap, zone2Ceiling, preferredUnits, preferredMetric, weekN, restingHR, maxHR, aerobicPace }: {
  session: SessionEntry; completion?: any; onTap: () => void
  zone2Ceiling?: number; preferredUnits?: 'km' | 'mi'; preferredMetric?: 'distance' | 'duration'
  weekN?: number; restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
}) {
  const accent = getSessionColor(session.type)
  const isComplete = completion?.status === 'complete'
  const isSkipped = completion?.status === 'skipped'

  const metricStorageKey = `rts_metric_${weekN ?? 0}_${session.key}`
  const sessionDefault = session.primary_metric ?? preferredMetric ?? 'distance'
  const [heroMetric, setHeroMetric] = useState<'distance' | 'duration'>(sessionDefault)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(metricStorageKey)
      if (saved === 'distance' || saved === 'duration') setHeroMetric(saved)
      else setHeroMetric(sessionDefault)
    } catch {}
  }, [metricStorageKey, sessionDefault])

  const hrDisplay = getSessionHRDisplay(session.type, session.hr_target, restingHR ?? null, maxHR ?? null, zone2Ceiling)
  const hrLabel = session.zone
    ? session.zone
    : (session.type === 'quality' || session.type === 'intervals' || session.type === 'hard' || session.type === 'tempo')
      ? 'Target HR'
      : 'Zone 2 ceiling'
  const pace = (session.type === 'easy' || session.type === 'run')
    ? (session.pace_target ?? aerobicPace ?? null)
    : (session.type === 'quality' || session.type === 'intervals' || session.type === 'hard' || session.type === 'tempo')
      ? (session.pace_target ?? null)
      : null

  const estimatedDuration = session.duration ?? (session.distance ? `~${fmtDurationMins(Math.round(session.distance * 6.5))}` : null)
  const estimatedDistance = session.distance ?? null
  const showMetrics = ['easy', 'run', 'quality', 'intervals', 'hard', 'tempo', 'race', 'recovery'].includes(session.type)
  const zoneLabel: string | null = (session.zone as string | undefined) ?? (
    session.type === 'recovery' ? 'Zone 1' :
    session.type === 'easy' || session.type === 'run' || session.type === 'long' ? 'Zone 2' :
    session.type === 'quality' || session.type === 'tempo' ? 'Zone 3' :
    session.type === 'intervals' || session.type === 'hard' ? 'Zone 4–5' : null
  )

  return (
    <div onClick={onTap} style={{
      margin: '12px 12px 0',
      background: 'var(--card-bg)',
      borderRadius: '16px',
      border: `0.5px solid ${isComplete ? `${accent}40` : isSkipped ? 'var(--border-col)' : 'var(--border-col)'}`,
      overflow: 'hidden',
      cursor: 'pointer',
      display: 'flex',
      opacity: isSkipped ? 0.6 : 1,
    }}>
      {/* Left accent bar */}
      <div style={{ width: '5px', flexShrink: 0, background: isComplete ? 'var(--teal)' : isSkipped ? 'var(--border-col)' : accent }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: type label + moved badge + date */}
        <div style={{ padding: '12px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 500, color: isComplete ? 'var(--teal)' : isSkipped ? 'var(--text-muted)' : accent, textTransform: 'uppercase', letterSpacing: '0.09em', flexShrink: 0 }}>
              {getSessionLabel(session.type)}
            </span>
            {session.key !== session.displayKey && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', background: 'var(--bg)', border: '0.5px solid var(--border-col)', borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.03em', flexShrink: 0 }}>
                moved from {DOW_FULL[session.key]}
              </span>
            )}
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
            {session.today ? 'Today' : `${session.day} · ${session.date}`}
          </span>
        </div>

        {/* Row 2: session title */}
        <div style={{ padding: '0 14px 10px' }}>
          <div style={{ fontSize: '18px', fontWeight: 500, letterSpacing: '-0.3px', color: isSkipped ? 'var(--text-muted)' : 'var(--text-primary)', lineHeight: 1.25, fontFamily: 'var(--font-brand)', textDecoration: isSkipped ? 'line-through' : 'none' }}>
            {session.title}
          </div>
        </div>

        {/* Row 3: compact metric strip — zone · HR · pace · metric */}
        {showMetrics && !isSkipped && (() => {
          const metricVal = heroMetric === 'distance'
            ? (estimatedDistance ? `${estimatedDistance}${preferredUnits ?? 'km'}` : null)
            : (estimatedDuration ?? null)
          const items = [zoneLabel, hrDisplay ? `${hrDisplay} bpm` : null, pace, metricVal].filter(Boolean) as string[]
          if (!items.length) return null
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', padding: '0 14px 12px' }}>
              {items.map((item, i) => (
                <Fragment key={i}>
                  {i > 0 && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', opacity: 0.4 }}>·</span>}
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: i === 0 ? accent : 'var(--text-muted)', fontWeight: i === 0 ? 500 : 400 }}>{item}</span>
                </Fragment>
              ))}
            </div>
          )
        })()}

        {/* Strava if complete */}
        {isComplete && completion?.strava_activity_name && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px 10px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--strava)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--strava)' }}>{completion.strava_activity_name}</span>
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '9px 14px', borderTop: '0.5px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg)' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: isComplete ? 'var(--teal)' : isSkipped ? 'var(--text-muted)' : accent }}>
            {isComplete ? 'View details' : isSkipped ? 'Update' : session.today ? 'Log this session' : 'View session'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isComplete && completion?.rpe != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: rpeColour(completion.rpe) }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: rpeColour(completion.rpe), display: 'inline-block', flexShrink: 0 }} />
                {completion.rpe}
              </span>
            )}
            {isComplete && (() => {
              const flag = completion?.coaching_flag as string | null | undefined
              const pill = { fontFamily: 'var(--font-ui)', fontSize: '10px', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
              if (flag === 'ok') return <span style={{ ...pill, background: 'var(--teal-soft)', color: 'var(--teal)', border: '0.5px solid var(--teal-dim)' }}>✓ On target</span>
              if (flag === 'watch' || flag === 'flag') return <span style={{ ...pill, background: 'var(--amber-soft)', color: 'var(--amber)', border: '0.5px solid var(--amber-mid)' }}>— Check this</span>
              return <span style={{ ...pill, background: 'var(--teal-soft)', color: 'var(--teal)', border: '0.5px solid var(--teal-dim)' }}>✓ Done</span>
            })()}
            {isSkipped && completion?.fatigue_tag && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>{completion.fatigue_tag}</span>
            )}
            {isSkipped && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: 'rgba(80,80,80,0.08)', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase' }}>Skipped</span>}
            {!isComplete && !isSkipped && <span style={{ color: 'var(--text-muted)', fontSize: '16px', lineHeight: 1 }}>›</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── REST DAY CARD ─────────────────────────────────────────────────────────

function getRestCopy(weekType?: string, weekPhase?: string, sessionType?: string, fitnessLevel?: string, firstName?: string): { label: string; headline: string; body: string } {
  const name = firstName ? `, ${firstName}` : ''

  // Non-running session types
  if (sessionType === 'strength') return { label: 'Strength today', headline: 'No running today.', body: "Legs get a pass. The gym work matters. Don't skip it thinking you're saving energy for the run." }
  if (sessionType === 'cross') return { label: 'Cross-train today', headline: 'No running today.', body: 'Keep the effort aerobic. This counts. Your legs will thank you on the long run.' }

  // Special week types take priority
  if (weekType === 'race' || weekType === 'race_event') {
    return { label: 'Race week', headline: "It's race week.", body: "Your legs need to forget how tired they were. One more run fixes nothing. Leave it." }
  }
  if (weekType === 'deload' || weekType === 'deload_done') {
    return { label: 'Deload week', headline: "Deload week.", body: "You've been piling on the load. This is the week your body catches up. Don't ruin it with extra miles." }
  }

  // Phase-based rest copy — varied by fitness level
  const isBeginner    = fitnessLevel === 'beginner'
  const isExperienced = fitnessLevel === 'experienced'

  switch (weekPhase) {
    case 'taper':
      return {
        label: 'No run today',
        headline: 'Step away from the trainers.',
        body: isBeginner
          ? `You've earned this${name}. The fitness is there — rest is how it stays.`
          : isExperienced
          ? "Fitness is locked. Any run now is a liability. Leave it."
          : "You've done the work. The fitness is locked in. Resting now is the last thing on the plan.",
      }
    case 'peak':
      return {
        label: 'No run today',
        headline: "You're sharp enough.",
        body: isBeginner
          ? `Rest is part of the plan${name}. Your body is catching up to the training load.`
          : isExperienced
          ? "Peak sharpness requires restraint. One more run won't help. One bad recovery will."
          : "One more run won't make you fitter. This rest keeps you there. Trust it.",
      }
    case 'build':
      return {
        label: 'No run today',
        headline: 'The work is done.',
        body: isBeginner
          ? `Your body is adapting${name}. Rest is where the fitness actually gets built.`
          : isExperienced
          ? "The hard sessions are compressing your system. Recovery is the other half of the adaptation equation."
          : "The hard sessions are taxing your system. This is where adaptation happens. Sit down.",
      }
    case 'base':
    default:
      return {
        label: 'No run today',
        headline: 'Rest is the work.',
        body: isBeginner
          ? `This is how it works${name}. Run, rest, adapt — in that order. The rest day is non-negotiable.`
          : isExperienced
          ? "Aerobic base is built in the margins — the sleep, the rest, the boring discipline of doing nothing."
          : "Aerobic fitness isn't built during the run. It's built in the recovery that follows. This day matters.",
      }
  }
}

function RestDayCard({ session, nextSession, weekPhase, weekType, fitnessLevel, firstName }: {
  session: SessionEntry | null
  nextSession: SessionEntry | null
  weekPhase?: string
  weekType?: string
  fitnessLevel?: string
  firstName?: string
}) {
  const isRestOrEmpty = !session || session.type === 'rest'
  const copy = getRestCopy(weekType, weekPhase, isRestOrEmpty ? undefined : session?.type, fitnessLevel, firstName)

  return (
    <div style={{ margin: '12px 12px 0' }}>
      <div style={{
        background: 'var(--card-bg)', borderRadius: '16px',
        border: '0.5px solid var(--border-col)', padding: '20px 18px', marginBottom: '10px',
      }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {copy.label}
        </div>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.25, marginBottom: '8px', letterSpacing: '-0.3px' }}>
          {copy.headline}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {copy.body}
        </div>
      </div>

      {nextSession && (
        <div style={{
          background: 'var(--card-bg)', borderRadius: '12px',
          border: '0.5px solid var(--border-col)', padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Next run · {nextSession.day} {nextSession.date}
            </div>
            <div style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: 500 }}>{nextSession.title}</div>
            {nextSession.detail && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{nextSession.detail}</div>
            )}
          </div>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: getSessionColor(nextSession.type), flexShrink: 0, marginLeft: '12px' }} />
        </div>
      )}
    </div>
  )
}

// ── CALENDAR OVERLAY ──────────────────────────────────────────────────────
// Moved to CalendarOverlay.tsx — imported at top of file.
// To re-expose in the UI: add 'calendar' entry point back to TodayScreen header
// and pass onOpenCalendar prop through DateStrip.

// CalendarOverlay moved to CalendarOverlay.tsx — imported at top of file.

// ── TODAY SCREEN ──────────────────────────────────────────────────────────

function TodayScreen({ plan, weekIndex, onWeekChange, quitDays, smokeTrackerEnabled, daysToRace, raceName, preferredMetric, stravaRuns, allOverrides, overridesReady, onOpenSession, allCompletions, preferredUnits, zone2Ceiling, onManualSaved, restingHR, maxHR, aerobicPace, firstName }: {
  plan: Plan; weekIndex: number; onWeekChange: (i: number) => void; quitDays: number | null
  smokeTrackerEnabled: boolean; daysToRace: number; raceName: string; preferredMetric: 'distance' | 'duration'
  stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  overridesReady: boolean
  onOpenSession?: (s: any) => void
  allCompletions: Record<number, Record<string, any>>
  preferredUnits: 'km' | 'mi'
  zone2Ceiling: number
  onManualSaved?: () => void
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
  firstName?: string
}) {
  const currentWeek = plan.weeks[weekIndex]
  const weekNum = weekIndex + 1
  const totalWeeks = plan.weeks.length

  // Guard against empty plan (e.g. failed Gist fetch)
  if (!currentWeek) return (
    <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>
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
  const weekStartDate = parseLocalDate((currentWeek as any).date)
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
    // Parse legacy free-text detail as fallback for hand-authored plans
    const parsed = s ? parseSessionDetail(s.detail ?? null) : {}
    return {
      key: originalDay,
      displayKey: key,
      day: DOW_FULL[key],
      title: s?.label ?? '',
      detail: s?.detail ?? '',
      type: s?.type ?? 'rest',
      date: displayDate,
      rawDate: d,
      today: key === todayDow,
      distance: s?.distance_km ?? parsed.distance,
      duration: s?.duration_mins != null ? fmtDurationMins(s.duration_mins) : parsed.duration,
      primary_metric: s?.primary_metric ?? undefined,
      zone: s?.zone ?? undefined,
      hr_target: s?.hr_target ?? undefined,
      pace_target: s?.pace_target ?? undefined,
      rpe_target: s?.rpe_target ?? undefined,
      coach_notes: s?.coach_notes ?? undefined,
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
  }, [weekIndex, overridesReady, sessions])

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

  // Week narrative data — phase, session progress, km target
  const totalSessionsThisWeek = sessions.filter(s => s.type !== 'rest').length
  const completedSessionsThisWeek = sessions.filter(s =>
    s.type !== 'rest' && (completions[s.key]?.status === 'complete' || completions[s.key]?.status === 'skipped')
  ).length
  const weeklyKm = (currentWeek as any).weekly_km as number | undefined
  const weekPhaseLabel = (() => {
    const p = (currentWeek as any).phase as string | undefined
    return p ? ({ base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' }[p] ?? null) : null
  })()

  // Fatigue trend — last 5 tagged completions sorted chronologically
  const fatigueHistory = (() => {
    const entries: { tag: string; weekN: number; dayIdx: number }[] = []
    Object.entries(allCompletions).forEach(([wn, days]) => {
      const wNum = Number(wn)
      Object.entries(days).forEach(([day, c]: [string, any]) => {
        if (c?.fatigue_tag) {
          const di = DOW_ORDER.indexOf(day)
          entries.push({ tag: c.fatigue_tag, weekN: wNum, dayIdx: di >= 0 ? di : 99 })
        }
      })
    })
    entries.sort((a, b) => a.weekN !== b.weekN ? a.weekN - b.weekN : a.dayIdx - b.dayIdx)
    return entries.slice(-5)
  })()

  // Fatigue warning — 2+ of last 3 tags are Heavy or Wrecked
  const heavyFatigue = fatigueHistory.length >= 3 &&
    fatigueHistory.slice(-3).filter(f => ['Heavy', 'Wrecked', 'Cooked'].includes(f.tag)).length >= 2

  // Fitness level from plan meta — for RestDayCard copy calibration
  const fitnessLevel = (plan.meta as any)?.fitness_level as string | undefined

  if (!overridesReady) return (
    <div style={{ paddingBottom: '8px' }}>
      <div style={{ padding: '16px 16px 6px' }}>
        <div style={{ width: '180px', height: '28px', borderRadius: '6px', background: 'var(--border-col)', marginBottom: '8px' }} />
        <div style={{ width: '100px', height: '14px', borderRadius: '4px', background: 'var(--border-col)' }} />
      </div>
      <div style={{ margin: '12px', height: '60px', borderRadius: '12px', background: 'var(--border-col)' }} />
      <div style={{ margin: '12px', height: '120px', borderRadius: '14px', background: 'var(--border-col)' }} />
    </div>
  )

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ paddingBottom: '8px' }}>

      {/* Date + plan context header */}
      <div style={{ padding: '16px 16px 6px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.1 }}>
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.02em' }}>
            {firstName ? `${firstName} · ` : ''}{(currentWeek as any).label || `Week ${weekNum} of ${totalWeeks}`}
          </div>
          {/* Week narrative — phase · sessions done · km target */}
          {(weekPhaseLabel || totalSessionsThisWeek > 0 || (weeklyKm && weeklyKm > 0)) && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
              {weekPhaseLabel && <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{weekPhaseLabel}</span>}
              {weekPhaseLabel && totalSessionsThisWeek > 0 && <span style={{ opacity: 0.4 }}>·</span>}
              {totalSessionsThisWeek > 0 && <span>{completedSessionsThisWeek}/{totalSessionsThisWeek} done</span>}
              {totalSessionsThisWeek > 0 && weeklyKm && weeklyKm > 0 && <span style={{ opacity: 0.4 }}>·</span>}
              {weeklyKm && weeklyKm > 0 && <span>{weeklyKm}km</span>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>
            {daysToRace}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            days left
          </div>
        </div>
      </div>

      <DateStrip
        sessions={sessions}
        completions={completions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        weekIndex={weekIndex}
        totalWeeks={totalWeeks}
        onWeekChange={onWeekChange}
      />



      {/* Fatigue trend — last 5 tagged sessions as a dot trail */}
      {fatigueHistory.length >= 3 && (
        <div style={{
          margin: '8px 12px 0', padding: '8px 12px',
          background: 'var(--card-bg)', borderRadius: '10px',
          border: '0.5px solid var(--border-col)',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', flexShrink: 0 }}>
            Effort trend
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
            {fatigueHistory.map((f, i) => {
              const isLast = i === fatigueHistory.length - 1
              return (
                <div key={i} style={{
                  width: isLast ? '10px' : '7px',
                  height: isLast ? '10px' : '7px',
                  borderRadius: '50%',
                  background: FATIGUE_COLORS[f.tag] ?? 'var(--border-col)',
                  opacity: isLast ? 1 : 0.55 + (i / fatigueHistory.length) * 0.35,
                }} />
              )
            })}
          </div>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px',
            color: FATIGUE_COLORS[fatigueHistory[fatigueHistory.length - 1].tag] ?? 'var(--text-muted)',
            letterSpacing: '0.04em', flexShrink: 0,
          }}>
            {fatigueHistory[fatigueHistory.length - 1].tag}
          </span>
        </div>
      )}

      {/* Week focus — above the session hero */}
      {weekTheme && (
        <div style={{ margin: '10px 12px 0', padding: '12px 14px', background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Week focus</div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>{weekTheme}</div>
        </div>
      )}

      {showSessionHero && selectedSession ? (
        <SessionHero
          session={selectedSession}
          completion={completions[selectedKey]}
          zone2Ceiling={zone2Ceiling}
          preferredUnits={preferredUnits}
          preferredMetric={preferredMetric}
          weekN={weekNum}
          restingHR={restingHR}
          maxHR={maxHR}
          aerobicPace={aerobicPace}
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
        <RestDayCard
          session={selectedSession}
          nextSession={nextRunSession}
          weekPhase={(currentWeek as any).phase}
          weekType={(currentWeek as any).type}
          fitnessLevel={fitnessLevel}
          firstName={firstName}
        />
      )}

      {/* Fatigue note — shown on today's run session when recent effort trend is heavy */}
      {showSessionHero && selectedSession?.today && heavyFatigue && (
        <div style={{ margin: '6px 12px 0', padding: '10px 12px', background: 'var(--amber-soft)', border: '0.5px solid var(--amber-mid)', borderRadius: '10px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--amber)', lineHeight: 1.5 }}>
            You've been logging heavy effort. Keep it honest today.
          </span>
        </div>
      )}

      {/* Manual log — elevated when no Strava connected, secondary otherwise */}
      {selectedSession && (selectedSession.today || selectedSession.rawDate < now) && (
        <button
          onClick={() => setShowManualLog(true)}
          style={{
            margin: '10px 12px 0', width: 'calc(100% - 24px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            background: stravaRuns.length === 0 ? 'var(--accent-soft)' : 'none',
            border: `0.5px solid ${stravaRuns.length === 0 ? 'var(--accent)' : 'var(--border-col)'}`,
            borderRadius: '10px', padding: '11px',
            fontFamily: 'var(--font-ui)', fontSize: '12px',
            color: stravaRuns.length === 0 ? 'var(--accent)' : 'var(--text-muted)',
            letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Log a run manually
        </button>
      )}

      {/* Manual log modal — pre-filled from selected session */}
      {showManualLog && (
        <ManualRunModal
          weekN={weekNum}
          sessionKey={selectedSession?.today ? selectedSession.key : null}
          preferredUnits={preferredUnits}
          onClose={() => setShowManualLog(false)}
          onSaved={() => { setShowManualLog(false); onManualSaved?.() }}
          sessionName={selectedSession?.title}
          sessionType={selectedSession?.type}
          plannedDistanceKm={selectedSession?.distance}
        />
      )}

      {/* Secondary stats row — smoke tracker only */}
      {(smokeTrackerEnabled && quitDays !== null) && (
        <div style={{ margin: '10px 12px 0', display: 'flex', gap: '8px' }}>
          <div style={{ flex: 1, background: 'var(--card-bg)', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid var(--border-col)' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>{quitDays}</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Smoke-free days</div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── PLAN SCREEN ───────────────────────────────────────────────────────────

// ── PLAN PROGRESS BAR ─────────────────────────────────────────────────────

function PlanProgressBar({ plan, allCompletions }: { plan: Plan; allCompletions: Record<number, Record<string, any>> }) {
  const SESSION_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
    'mon2', 'tue2', 'wed2', 'thu2', 'fri2', 'sat2', 'sun2']

  let totalSessions = 0
  let doneSessions = 0

  plan.weeks.forEach((week, wi) => {
    const weekN = wi + 1
    const weekAny = week as any
    const sessions = weekAny.sessions ?? weekAny
    const weekCompletions = allCompletions[weekN] ?? {}
    SESSION_KEYS.forEach(k => {
      if (sessions[k] && typeof sessions[k] === 'object' && sessions[k].type !== 'rest') {
        totalSessions++
        const c = weekCompletions[k]
        if (c?.status === 'complete' || c?.status === 'skipped') doneSessions++
      }
    })
  })

  const pct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0

  if (totalSessions === 0) return null

  return (
    <div style={{ padding: '10px 16px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {doneSessions} of {totalSessions} sessions complete
        </div>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '13px', color: 'var(--teal)', fontWeight: 600 }}>{pct}%</div>
      </div>
      <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border-col)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: '2px',
          background: 'var(--teal)',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}

function PlanScreen({ plan, stravaRuns, allOverrides, allCompletions, onOverrideChange, onOpenSession, overridesReady }: {
  plan: Plan; stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onOpenSession?: (s: any) => void
  overridesReady: boolean
}) {
  const currentWeekIndex = getCurrentWeekIndex(plan.weeks)
  const weekNum = currentWeekIndex + 1
  const totalWeeks = plan.weeks.length
  const raceName = (plan as any)?.meta?.race_name ?? ''
  const raceDate = (plan as any)?.meta?.race_date ? new Date((plan as any).meta.race_date) : null
  const raceDateStr = raceDate ? raceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  const daysToRace = raceDate ? Math.max(0, Math.ceil((raceDate.getTime() - Date.now()) / 86400000)) : null

  return (
    <div>
      {/* Race context header — with countdown matching Today screen */}
      <div style={{ padding: '16px 16px 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          {raceName && (
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.1 }}>
              {raceName}
            </div>
          )}
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.02em' }}>
            {raceDateStr ? `${raceDateStr} · ` : ''}Week {weekNum} of {totalWeeks}
          </div>
        </div>
        {daysToRace !== null && (
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.5px' }}>
              {daysToRace}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              days left
            </div>
          </div>
        )}
      </div>

      {/* Progress — anchored to header, not floating */}
      <PlanProgressBar plan={plan} allCompletions={allCompletions} />

      {/* This week strip */}
      {(() => {
        const wk = plan.weeks[currentWeekIndex]
        if (!wk) return null
        const SESSION_KEYS = ['mon','tue','wed','thu','fri','sat','sun']
        const ws = (wk as any).sessions ?? {}
        const weekCompletions = allCompletions[weekNum] ?? {}
        let total = 0, done = 0
        SESSION_KEYS.forEach(k => {
          if (ws[k] && ws[k].type !== 'rest') {
            total++
            if (weekCompletions[k]?.status === 'complete' || weekCompletions[k]?.status === 'skipped') done++
          }
        })
        const weeklyKm = (wk as any).weekly_km as number | undefined
        if (total === 0 && !weeklyKm) return null
        return (
          <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>This week</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.4 }}>·</span>
            {total > 0 && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: done === total && total > 0 ? 'var(--teal)' : 'var(--text-muted)' }}>
                {done}/{total} done
              </span>
            )}
            {total > 0 && weeklyKm && weeklyKm > 0 && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', opacity: 0.4 }}>·</span>
            )}
            {weeklyKm && weeklyKm > 0 && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)' }}>{weeklyKm}km target</span>
            )}
          </div>
        )
      })()}

      {/* Load chart */}
      <div style={{ padding: '0 12px 12px' }}>
        <PlanChart weeks={plan.weeks} />
      </div>

      <PlanCalendar
        weeks={plan.weeks}
        stravaRuns={stravaRuns}
        allOverrides={allOverrides}
        allCompletions={allCompletions}
        onOverrideChange={onOverrideChange}
        overridesReady={overridesReady}
        onSessionTap={(session, weekN, weekTheme) => {
          onOpenSession?.({ ...session, weekN, weekTheme })
        }}
      />
    </div>
  )
}

// ── PLAN-BASED COACHING ───────────────────────────────────────────────────

function PlanCoachingCard({ plan, currentWeek }: { plan: Plan; currentWeek: Week }) {
  const sessions = Object.values((currentWeek as any).sessions ?? {}) as any[]
  const runningSessions = sessions.filter(s => s && s.type && s.type !== 'rest' && s.type !== 'strength')
  const hasQuality = sessions.some(s => s && ['quality','tempo','intervals','hard'].includes(s.type))
  const hasLong    = sessions.some(s => s && s.type === 'long')
  const phase      = (currentWeek as any).phase as string | undefined
  const theme      = (currentWeek as any).theme as string | undefined
  const weeklyKm   = (currentWeek as any).weekly_km as number | undefined
  const weeksToRace = Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))

  const phaseCap = phase ? ({ base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' }[phase] ?? phase) : null

  function getWeekHeadline(): string {
    if (phase === 'taper') return "Taper week. Back off and trust the work."
    if (phase === 'peak')  return "Peak week. You're sharp. Don't add more."
    if (hasQuality && hasLong) return "Quality and long run this week. Hard stuff first, long stuff rested."
    if (hasQuality) return "Quality session this week. Everything else is recovery."
    if (hasLong)    return "Long run week. Keep easy runs genuinely easy."
    return "Steady week. Execute consistently."
  }

  function getWeekItems(): string[] {
    const items: string[] = []
    if (hasQuality && hasLong) {
      items.push("Do the quality session before fatigue builds — earlier in the week is better.")
      items.push("The long run should be Zone 2 only. No heroics.")
    } else if (hasQuality) {
      items.push("Run the quality session when fresh — not back-to-back with another hard day.")
      items.push("Everything else this week is recovery. Treat it that way.")
    } else if (hasLong) {
      items.push("Keep the pace honest throughout — if HR climbs, walk.")
      items.push("Fuel and hydrate from the start, not when you're already behind.")
    }
    if (phase === 'base') items.push("Base phase: volume over intensity. The fitness accrues slowly. That's fine.")
    if (phase === 'taper') items.push("Resist adding miles. Your goal is to arrive fresh, not to cram.")
    if (weeksToRace <= 4 && weeksToRace > 0) items.push(`${weeksToRace} week${weeksToRace !== 1 ? 's' : ''} out. Stay disciplined.`)
    return items.slice(0, 3)
  }

  const items = getWeekItems()

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Plan notes</span>
        {phaseCap && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: '20px', border: '0.5px solid var(--accent-dim)' }}>
            {phaseCap}
          </span>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35, marginBottom: '10px', letterSpacing: '-0.2px' }}>
          {getWeekHeadline()}
        </div>
        {theme && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '12px', fontStyle: 'italic' }}>
            {theme}
          </div>
        )}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: weeklyKm ? '12px' : '0' }}>
            {items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent)', marginTop: '6px', flexShrink: 0, opacity: 0.7 }} />
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{item}</div>
              </div>
            ))}
          </div>
        )}
        {weeklyKm && weeklyKm > 0 && (
          <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--bg)', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Target</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{weeklyKm}km this week</span>
          </div>
        )}
      </div>
      {/* Strava nudge */}
      <div style={{ padding: '10px 16px', borderTop: '0.5px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--strava)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Connect <span style={{ color: 'var(--strava)' }}>Strava</span> in Profile to get coaching notes after each run.
        </span>
      </div>
    </div>
  )
}

// ── COACH SCREEN ──────────────────────────────────────────────────────────

function CoachScreen({ plan, currentWeek, runs, stravaLoading, stravaTokenFailed, firstName, onGoToMe }: {
  plan: Plan; currentWeek: Week; runs: any[] | null; stravaLoading: boolean
  stravaTokenFailed?: boolean; firstName?: string; onGoToMe?: () => void
}) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [cachedActivityId, setCachedActivityId] = useState<string | null>(null)

  const weekNum    = getCurrentWeekIndex(plan.weeks) + 1
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
      const weeksToRace = plan.meta.race_date ? Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))) : 0
      const weekLabel   = (currentWeek as any).label ?? 'build phase'
      const weekTheme   = (currentWeek as any).theme ?? ''
      const raceName    = plan.meta.race_name || 'target race'
      const raceDist    = plan.meta.race_distance_km ? `${plan.meta.race_distance_km}km` : ''
      const raceDesc    = [raceName, raceDist].filter(Boolean).join(' ')
      const raceContext = plan.meta.race_date ? `${raceDesc} on ${new Date(plan.meta.race_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} (${weeksToRace} weeks away)` : raceDesc
      const z2          = plan.meta.zone2_ceiling || 145
      const hrProfile   = plan.meta.resting_hr && plan.meta.max_hr
        ? `Resting HR ~${plan.meta.resting_hr}, max HR ~${plan.meta.max_hr}. Zone 2 ceiling: HR ${z2}.`
        : `Zone 2 ceiling: HR ${z2}.`

      const prompt = `You are a direct, no-fluff running coach giving an athlete a weekly check-in. They are training for ${raceContext}.

Athlete profile: ${hrProfile} Key metric to track: pace at Zone 2 HR.

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

Write 2 short paragraphs. First: where the athlete is in the plan and whether they're on track. Second: direct feedback on the latest run — what was good, what to focus on next. Be specific, honest, no fluff. Use "you" throughout.`

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
      <ScreenHeader title="Coach" sub={firstName ? `${firstName} · W${weekNum} · ${(currentWeek as any).label ?? 'Build phase'}` : `W${weekNum} · ${(currentWeek as any).label ?? 'Build phase'}`} />
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {stravaTokenFailed && !stravaLoading && !latestRun && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--amber-mid)', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>Strava connection expired.</span>
            <button
              onClick={onGoToMe}
              style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-soft)', border: 'none', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Reconnect in Profile
            </button>
          </div>
        )}

        {(stravaLoading || latestRun) && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '9px 12px', border: '0.5px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--strava)' }} />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>
                {stravaLoading ? 'Loading Strava...' : loading ? 'Analysing latest run...' : latestRunLabel ?? 'Latest activity'}
              </span>
            </div>
            {isNew && !loading && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: '20px' }}>new</span>
            )}
          </div>
        )}

        {!stravaLoading && !latestRun && (
          <PlanCoachingCard plan={plan} currentWeek={currentWeek} />
        )}

        {(loading || (stravaLoading && !analysis)) && (
          <>
            <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <svg width="36" height="36" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-col)" strokeWidth="2" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="40 60" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite" />
                </circle>
              </svg>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
                {stravaLoading ? 'Loading Strava data...' : 'Reading your latest run\nand plan position...'}
              </p>
            </div>
            <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', padding: '14px' }}>
              {[85, 100, 70, 90].map((w, i) => (
                <div key={i} style={{ height: '10px', background: 'var(--bg)', borderRadius: '4px', marginBottom: i < 3 ? '8px' : 0, width: `${w}%` }} />
              ))}
            </div>
          </>
        )}

        {error && !loading && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', marginBottom: '8px' }}>Error</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{error}</div>
            <button onClick={generateAnalysis} style={{ marginTop: '12px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--accent)', background: 'var(--accent-soft)', border: 'none', borderRadius: '20px', padding: '6px 14px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        )}

        {analysis && !loading && (
          <>
            <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Coaching notes</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>W{weekNum}/{totalWeeks}</span>
              </div>
              <div style={{ padding: '14px' }}>
                {analysis.split('\n\n').map((para, i) => (
                  <p key={i} style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65, marginTop: i > 0 ? '10px' : 0 }}>{para}</p>
                ))}
              </div>
            </div>
            <button onClick={generateAnalysis} style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', background: 'none', border: '0.5px solid var(--border-col)', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer', alignSelf: 'center' }}>
              Refresh analysis
            </button>
          </>
        )}

        {!analysis && !loading && !error && latestRun && !stravaLoading && (
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Strava connected. Ready to generate<br />your coaching notes.
            </div>
            <button onClick={generateAnalysis} style={{ marginTop: '16px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--accent)', background: 'var(--accent-soft)', border: 'none', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer' }}>
              Generate now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── STRAVA SCREEN ─────────────────────────────────────────────────────────

function StravaScreen({ runs, loading, connected, raceName, raceDate, raceDistanceKm, zone2Ceiling, restingHR, maxHR }: {
  runs: any[] | null; loading: boolean; connected: boolean
  raceName?: string; raceDate?: string; raceDistanceKm?: number
  zone2Ceiling?: number; restingHR?: number; maxHR?: number
}) {
  return (
    <div>
      <ScreenHeader title="Strava" sub="Activity feed" />
      <div style={{ padding: '0 12px' }}>
        <StravaPanel preloadedRuns={runs} preloadedConnected={connected} preloadedLoading={loading} raceName={raceName} raceDate={raceDate} raceDistanceKm={raceDistanceKm} zone2Ceiling={zone2Ceiling} restingHR={restingHR} maxHR={maxHR} />
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
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(252,76,2,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--strava)' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Strava</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', marginTop: '1px', color: isLoading ? 'var(--text-muted)' : connected ? 'var(--teal)' : 'var(--text-muted)' }}>
              {isLoading ? 'checking...' : connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
        </div>

        {!isLoading && (
          connected ? (
            <button onClick={disconnect} disabled={disconnecting} style={{
              background: 'none', border: '0.5px solid var(--border-col)',
              borderRadius: '8px', padding: '6px 12px',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'var(--text-muted)', letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
              opacity: disconnecting ? 0.6 : 1,
            }}>
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button onClick={() => { window.location.href = `/api/strava/connect?user_id=${userId}` }} disabled={!userId} style={{
              background: 'var(--strava)', color: 'var(--zona-navy)',
              border: 'none', borderRadius: '8px', padding: '8px 14px',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: userId ? 'pointer' : 'default',
              opacity: userId ? 1 : 0.5,
            }}>
              Connect
            </button>
          )
        )}
      </div>
      {!isLoading && !connected && (
        <div style={{ padding: '0 16px 12px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Zona will read your Strava activities to provide coaching insights. No other data is accessed.
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
    <div onClick={toggle} style={{ width: '44px', height: '26px', borderRadius: '13px', background: enabled ? 'var(--teal-bg)' : 'var(--border-col)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: enabled ? 'var(--teal)' : 'var(--text-secondary)', position: 'absolute', top: '3px', left: enabled ? '21px' : '3px', transition: 'left 0.2s, background 0.2s' }} />
    </div>
  )
}

// ── ME SCREEN ─────────────────────────────────────────────────────────────

// ── HR ZONE CALCULATION (Karvonen / HRR method) ───────────────────────────

const ZONE_DEFS = [
  { zone: 1, name: 'Recovery',  pctMin: 50, pctMax: 60, colour: 'var(--teal)', desc: 'Active recovery · warm-up · cool-down' },
  { zone: 2, name: 'Aerobic',   pctMin: 60, pctMax: 70, colour: 'var(--blue)', desc: 'Aerobic base · conversational · fat burning' },
  { zone: 3, name: 'Tempo',     pctMin: 70, pctMax: 80, colour: 'var(--amber)', desc: 'Comfortably hard · 3-word sentences' },
  { zone: 4, name: 'Threshold', pctMin: 80, pctMax: 90, colour: 'var(--accent)', desc: 'Hard · sustained race effort' },
  { zone: 5, name: 'VO₂ Max',  pctMin: 90, pctMax: 100, colour: 'var(--red)', desc: 'Maximum effort · short intervals only' },
]

function calculateZones(restingHR: number, maxHR: number) {
  const hrr = maxHR - restingHR
  return ZONE_DEFS.map(d => ({
    ...d,
    minHR: Math.round(restingHR + (d.pctMin / 100) * hrr),
    maxHR: Math.round(restingHR + (d.pctMax / 100) * hrr),
  }))
}

function HRZonesSection({ restingHR, maxHR, onSave }: {
  restingHR: number | null
  maxHR: number | null
  onSave: (rhr: number, mhr: number) => void
}) {
  const [rhr, setRhr] = useState(restingHR ? String(restingHR) : '')
  const [mhr, setMhr] = useState(maxHR ? String(maxHR) : '')

  useEffect(() => { setRhr(restingHR ? String(restingHR) : '') }, [restingHR])
  useEffect(() => { setMhr(maxHR ? String(maxHR) : '') }, [maxHR])
  const [saved, setSaved] = useState(false)

  const rhrNum = parseInt(rhr)
  const mhrNum = parseInt(mhr)
  const valid = rhrNum > 0 && mhrNum > 0 && mhrNum > rhrNum
  const zones = valid ? calculateZones(rhrNum, mhrNum) : []

  function handleSave() {
    if (!valid) return
    onSave(rhrNum, mhrNum)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '10px',
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '6px', display: 'block',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg)',
    border: '0.5px solid var(--border-col)', borderRadius: '8px',
    padding: '11px 36px 11px 12px', color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)', fontSize: '15px',
    outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>

      {/* Editable HR inputs */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border-col)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Resting HR</label>
            <div style={{ position: 'relative' }}>
              <input type="number" inputMode="numeric" placeholder="48" value={rhr}
                onChange={e => setRhr(e.target.value)} style={inputStyle} />
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)' }}>bpm</span>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Max HR</label>
            <div style={{ position: 'relative' }}>
              <input type="number" inputMode="numeric" placeholder="188" value={mhr}
                onChange={e => setMhr(e.target.value)} style={inputStyle} />
              <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)' }}>bpm</span>
            </div>
          </div>
        </div>
        <button onClick={handleSave} disabled={!valid}
          style={{
            width: '100%', padding: '11px',
            background: saved ? 'var(--teal-dim)' : valid ? 'var(--accent-soft)' : 'var(--bg)',
            border: `0.5px solid ${saved ? 'rgba(74,154,90,0.4)' : valid ? 'var(--accent-mid)' : 'var(--border-col)'}`,
            borderRadius: '8px', cursor: valid ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: saved ? 'var(--teal)' : valid ? 'var(--accent)' : 'var(--text-muted)',
          }}>
          {saved ? '✓ Saved' : 'Save HR data'}
        </button>
      </div>

      {/* Calculated zones — read only */}
      {zones.length > 0 && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Calculated zones · HRR method
          </div>
          {zones.map(z => (
            <div key={z.zone} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr auto',
              alignItems: 'center', gap: '10px',
              padding: '9px 10px', borderRadius: '8px',
              background: 'var(--bg)',
              border: '0.5px solid var(--border-col)',
            }}>
              {/* Zone number */}
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%',
                background: z.colour + '18', border: `1.5px solid ${z.colour}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-ui)', fontSize: '10px',
                color: z.colour, fontWeight: 'bold', flexShrink: 0,
              }}>{z.zone}</div>
              {/* Name + desc */}
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{z.name}</div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>{z.desc}</div>
              </div>
              {/* HR range */}
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: z.colour, whiteSpace: 'nowrap', textAlign: 'right' }}>
                {z.minHR}–{z.maxHR}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prompt if incomplete */}
      {zones.length === 0 && (rhr || mhr) && (
        <div style={{ padding: '14px 16px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Enter both values to calculate zones
        </div>
      )}
    </div>
  )
}

// ── PROFILE SECTION ───────────────────────────────────────────────────────

function ProfileSection({ firstName, lastName, email, onSave }: {
  firstName: string; lastName: string; email: string
  onSave: (fn: string, ln: string, em: string) => void
}) {
  const [fn, setFn] = useState(firstName)
  const [ln, setLn] = useState(lastName)
  const [em, setEm] = useState(email)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setFn(firstName) }, [firstName])
  useEffect(() => { setLn(lastName) }, [lastName])
  useEffect(() => { setEm(email) }, [email])

  const isDirty = fn !== firstName || ln !== lastName || em !== email
  const isValid = fn.trim().length > 0 || ln.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    await onSave(fn.trim(), ln.trim(), em.trim())
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg)',
    border: '0.5px solid var(--border-col)', borderRadius: '8px',
    padding: '11px 12px', color: 'var(--text-primary)',
    fontFamily: 'var(--font-brand)', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '10px',
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: '6px', display: 'block',
  }

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={labelStyle}>First name</label>
          <input type="text" placeholder="Russell" value={fn} onChange={e => setFn(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Last name</label>
          <input type="text" placeholder="Shear" value={ln} onChange={e => setLn(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Email</label>
        <input type="email" placeholder="you@example.com" value={em} onChange={e => setEm(e.target.value)} style={inputStyle} />
      </div>
      <button
        onClick={handleSave}
        disabled={!isDirty || !isValid || saving}
        style={{
          width: '100%', padding: '11px',
          background: saved ? 'var(--teal-dim)' : isDirty && isValid ? 'var(--accent-soft)' : 'var(--bg)',
          border: `0.5px solid ${saved ? 'rgba(74,154,90,0.4)' : isDirty && isValid ? 'var(--accent-mid)' : 'var(--border-col)'}`,
          borderRadius: '8px', cursor: isDirty && isValid ? 'pointer' : 'not-allowed',
          fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: saved ? 'var(--teal)' : isDirty && isValid ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'all 0.15s',
        }}
      >
        {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save profile'}
      </button>
    </div>
  )
}

// ── ME SCREEN ─────────────────────────────────────────────────────────────

function MeScreen({ plan, initials, athlete, quitDays, smokeTrackerEnabled, quitDate, onSmokeTrackerChange, resetPhrase, onSaveMental, theme, onThemeChange, onBack, isAdmin, onOpenAdmin, preferredUnits, onUnitsChange, preferredMetric, onMetricChange, restingHR, maxHR, onHRChange, firstName, lastName, profileEmail, onProfileChange, onOpenGenerate }: {
  plan: Plan; initials: string; athlete: string; quitDays: number | null; smokeTrackerEnabled: boolean; quitDate: string
  onSmokeTrackerChange: (enabled: boolean, date: string) => void
  resetPhrase: string; onSaveMental: (v: string) => void
  theme: 'dark' | 'light' | 'auto'; onThemeChange: (t: 'dark' | 'light' | 'auto') => void; onBack: () => void
  isAdmin?: boolean; onOpenAdmin?: () => void
  preferredUnits: 'km' | 'mi'; onUnitsChange: (u: 'km' | 'mi') => void
  preferredMetric: 'distance' | 'duration'; onMetricChange: (m: 'distance' | 'duration') => void
  restingHR: number | null; maxHR: number | null; onHRChange: (rhr: number, mhr: number) => void
  firstName: string; lastName: string; profileEmail: string
  onProfileChange: (fn: string, ln: string, em: string) => void
  onOpenGenerate?: () => void
}) {
  const [activeSection, setActiveSection] = useState<'main' | 'quit' | 'mental' | 'fueling'>('main')

  const raceDistKm = plan?.meta?.race_distance_km ?? 0
  const raceNm     = plan?.meta?.race_name ?? ''
  const charity    = plan?.meta?.charity ?? ''

  if (activeSection === 'quit')    return <QuitTab    quitDays={quitDays} raceDistanceKm={raceDistKm} onBack={() => setActiveSection('main')} />
  if (activeSection === 'mental')  return <MentalTab  resetPhrase={resetPhrase} onSave={onSaveMental} onBack={() => setActiveSection('main')} raceDistanceKm={raceDistKm} raceName={raceNm} charity={charity} />
  if (activeSection === 'fueling') return <FuelingTab onBack={() => setActiveSection('main')} />

  const daysToRace = plan?.meta?.race_date ? Math.max(0, Math.ceil((new Date(plan.meta.race_date).getTime() - Date.now()) / 86400000)) : 0
  const hasPlan = !!(plan?.meta?.race_name)

  // Compute Zone 2 ceiling for display — mirrors DashboardClient logic
  const z2Ceiling = (restingHR && maxHR)
    ? Math.round(restingHR + 0.70 * (maxHR - restingHR))
    : plan?.meta?.zone2_ceiling ?? null
  const hrConfigured = !!(restingHR && maxHR)

  const chevron = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 8px' }}>
        <button onClick={onBack} style={{ border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--accent-soft)', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px' }}>
          {firstName ? `${firstName}'s profile` : 'Profile'}
        </div>
      </div>

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px' }}>

        {/* Identity card — avatar + race goal. Name/email live in Profile section below. */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '16px', padding: '16px', border: '0.5px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-brand)', fontSize: '16px', fontWeight: 600, color: 'var(--zona-navy)', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {hasPlan ? (
              <>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {plan.meta.race_name}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', marginTop: '4px', letterSpacing: '0.02em' }}>
                  {daysToRace} days to go
                </div>
              </>
            ) : (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)' }}>No race set</div>
            )}
          </div>
        </div>

        {/* ── Your profile ───────────────────────────────────────── */}
        <SectionLabel>Your profile</SectionLabel>
        <ProfileSection firstName={firstName} lastName={lastName} email={profileEmail} onSave={onProfileChange} />

        {/* ── Your training ──────────────────────────────────────── */}
        {/* Plan · HR data · display preferences — everything that shapes session cards */}
        <SectionLabel>Your training</SectionLabel>

        {/* Plan button */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
          <button
            onClick={onOpenGenerate}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.55 }}>
                {hasPlan ? 'Change your plan' : 'Generate a plan'}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {hasPlan ? 'Build a new plan around a different race or goal' : 'Choose a template or build a custom plan'}
              </div>
            </div>
            <div style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>{chevron}</div>
          </button>
        </div>

        {/* HR payoff callout */}
        {hrConfigured && z2Ceiling && (
          <div style={{ background: 'var(--accent-soft)', borderRadius: '10px', border: '0.5px solid var(--accent-dim)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', lineHeight: 1.5 }}>
              Your Zone 2 ceiling is <strong>{z2Ceiling} bpm</strong> — shown on every session card.
            </div>
          </div>
        )}
        {!hrConfigured && (
          <div style={{ background: 'var(--amber-soft)', borderRadius: '10px', border: '0.5px solid var(--amber-mid)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--amber)', lineHeight: 1.5 }}>
              Add your HR data below to personalise every session's HR targets.
            </div>
          </div>
        )}

        <HRZonesSection restingHR={restingHR} maxHR={maxHR} onSave={onHRChange} />

        {/* Display preferences — grouped with training since they affect session cards */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
          {/* Units */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '0.5px solid var(--border-col)' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Distance units</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>Pace brackets and distances</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['km', 'mi'] as const).map(u => (
                <button key={u} onClick={() => onUnitsChange(u)} style={{ borderRadius: '10px', padding: '5px 12px', border: `0.5px solid ${preferredUnits === u ? 'var(--accent)' : 'var(--border-col)'}`, background: preferredUnits === u ? 'var(--accent-soft)' : 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: preferredUnits === u ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          {/* Session display */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Session display</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>Default metric on session cards</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['distance', 'duration'] as const).map(m => (
                <button key={m} onClick={() => onMetricChange(m)} style={{ borderRadius: '10px', padding: '5px 12px', border: `0.5px solid ${preferredMetric === m ? 'var(--accent)' : 'var(--border-col)'}`, background: preferredMetric === m ? 'var(--accent-soft)' : 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: preferredMetric === m ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'capitalize', letterSpacing: '0.04em' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Connections ────────────────────────────────────────── */}
        {/* Strava powers run matching and post-run coaching analysis */}
        <SectionLabel>Connections</SectionLabel>
        <StravaConnectionRow />

        {/* ── Race prep ──────────────────────────────────────────── */}
        <SectionLabel>Race prep</SectionLabel>
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
          {[
            { id: 'mental'  as const, label: 'Mental toolkit', sub: '6 tools for when it gets dark at km 70', color: 'var(--session-easy)' },
            { id: 'fueling' as const, label: 'Fueling plan',   sub: 'Gel + hydration protocol for race day',  color: 'var(--accent)' },
          ].map(({ id, label, sub, color }, i, arr) => (
            <button key={id} onClick={() => setActiveSection(id)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: i < arr.length - 1 ? '0.5px solid var(--border-col)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.55 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color, marginTop: '2px' }}>{sub}</div>
              </div>
              <div style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>{chevron}</div>
            </button>
          ))}
        </div>

        {/* ── App settings ───────────────────────────────────────── */}
        {/* Theme and personal tracking — not training-related */}
        <SectionLabel>App settings</SectionLabel>
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
          {/* Theme */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: smokeTrackerEnabled ? '0.5px solid var(--border-col)' : 'none' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Theme</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['dark', 'light', 'auto'] as const).map(t => (
                <button key={t} onClick={() => onThemeChange(t)} style={{ borderRadius: '10px', padding: '5px 10px', border: `0.5px solid ${theme === t ? 'var(--accent)' : 'var(--border-col)'}`, background: theme === t ? 'var(--accent-soft)' : 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', color: theme === t ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* Smoke tracker — inline in app settings */}
          <div style={{ padding: '14px 16px', borderBottom: smokeTrackerEnabled ? '0.5px solid var(--border-col)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: smokeTrackerEnabled ? '10px' : 0 }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Smoke-free tracker</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: smokeTrackerEnabled ? 'var(--teal)' : 'var(--text-muted)', marginTop: '1px' }}>
                  {smokeTrackerEnabled && quitDays !== null ? `${quitDays} days smoke-free` : 'Off'}
                </div>
              </div>
              <SmokeToggle enabled={smokeTrackerEnabled} quitDate={quitDate} onChange={onSmokeTrackerChange} />
            </div>
            {smokeTrackerEnabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>Quit date:</span>
                <input type="date" value={quitDate} onChange={async e => {
                  const newDate = e.target.value
                  onSmokeTrackerChange(true, newDate)
                  try {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (!user) return
                    await supabase.from('user_settings').upsert({ id: user.id, smoke_tracker_enabled: true, quit_date: newDate, updated_at: new Date().toISOString() })
                  } catch {}
                }} style={{ background: 'var(--bg)', border: '0.5px solid var(--border-col)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px', outline: 'none' }} />
              </div>
            )}
          </div>
          {smokeTrackerEnabled && (
            <button onClick={() => setActiveSection('quit')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Quit tracker</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--teal)', marginTop: '1px' }}>Milestones + benefits</div>
              </div>
              <div style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>{chevron}</div>
            </button>
          )}
        </div>

        {/* ── Admin ──────────────────────────────────────────────── */}
        {isAdmin && (
          <>
            <SectionLabel>Admin</SectionLabel>
            <button onClick={onOpenAdmin} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--accent-mid)', cursor: 'pointer', textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: '13px', color: 'var(--accent)', lineHeight: 1.55 }}>User management</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>Impersonate · view plans</div>
              </div>
              <div style={{ color: 'var(--accent)', marginLeft: '12px' }}>{chevron}</div>
            </button>
          </>
        )}

        {/* ── Sign out — bottom, destructive action de-emphasised ── */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '0.5px solid var(--border-col)' }}>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/auth/login'
            }}
            style={{ width: '100%', padding: '12px', background: 'none', border: '0.5px solid var(--border-col)', borderRadius: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Sign out
          </button>
        </div>

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
          .select('id, gist_url, has_onboarded, is_admin, first_name, last_name, email')
        if (data) {
          const { data: { user } } = await supabase.auth.getUser()
          setUsers(data.filter((u: any) => u.id !== user?.id))
        }
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', paddingBottom: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px', borderBottom: '0.5px solid var(--border-col)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10 }}>
        <button onClick={onBack} style={{ border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--accent-soft)' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)' }}>User management</div>
      </div>

      <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>Loading users...</div>
        ) : users.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '24px 0', textAlign: 'center' }}>No users found</div>
        ) : users.map(u => {
          const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || u.id.slice(0, 8)

          return (
            <div key={u.id} style={{
              background: 'var(--card-bg)', borderRadius: '12px',
              border: '0.5px solid var(--border-col)',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)' }}>
                  {displayName}
                  {u.is_admin && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--accent)', marginLeft: '8px', border: '0.5px solid var(--accent-mid)', borderRadius: '10px', padding: '1px 6px' }}>admin</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                  {u.has_onboarded ? 'Onboarded' : 'Not yet onboarded'} · {u.gist_url ? 'Plan set' : 'No plan'}
                </div>
              </div>
              {!u.is_admin && (
                <button
                  onClick={() => onImpersonate(u.id, displayName)}
                  style={{
                    background: 'var(--accent-soft)', border: '0.5px solid var(--accent-mid)',
                    borderRadius: '8px', color: 'var(--accent)',
                    fontFamily: 'var(--font-ui)', fontSize: '11px',
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

function SessionScreen({ session, preloadedRuns, onBack, onSaved, preferredUnits, zone2Ceiling, preferredMetric, restingHR, maxHR, aerobicPace }: {
  session: any; preloadedRuns: any[]; onBack: () => void; onSaved?: () => void
  preferredUnits?: 'km' | 'mi'; zone2Ceiling?: number; preferredMetric?: 'distance' | 'duration'
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
}) {
  const color = getSessionColor(session.type ?? 'easy')
  const typeLabel = getSessionLabel(session.type ?? 'easy')
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', paddingBottom: '120px' }}>
      {/* Sticky header — type chip + session title */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px 12px',
        borderBottom: '0.5px solid var(--border-col)',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          border: 'none', color, cursor: 'pointer', padding: '0', lineHeight: 1,
          width: '36px', height: '36px', display: 'flex', alignItems: 'center',
          justifyContent: 'center', borderRadius: '8px', background: `${color}18`, flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.09em', background: `${color}15`, borderRadius: '5px', padding: '2px 8px', display: 'inline-block', marginBottom: '4px' }}>
            {typeLabel}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title}
          </div>
        </div>
      </div>

      {/* Card — left accent border on card, no overflow:hidden needed */}
      <div style={{ padding: '12px' }}>
        <div style={{
          background: 'var(--card-bg)',
          borderRadius: '16px',
          border: '0.5px solid var(--border-col)',
          borderLeft: `4px solid ${color}`,
        }}>
          <SessionPopupInner
            session={session}
            weekTheme={session.weekTheme ?? ''}
            weekN={session.weekN ?? 1}
            preloadedRuns={preloadedRuns}
            onClose={onBack}
            onSaved={onSaved}
            preferredUnits={preferredUnits ?? 'km'}
            zone2Ceiling={zone2Ceiling ?? 145}
            preferredMetric={preferredMetric}
            restingHR={restingHR}
            maxHR={maxHR}
            aerobicPace={aerobicPace}
          />
        </div>
      </div>
    </div>
  )
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 12px' }}>
      <button onClick={onBack} style={{ border: 'none', color: 'var(--accent)', fontSize: '18px', cursor: 'pointer', padding: '0' , width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--accent-soft)'}}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{verticalAlign:'middle'}}><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
      <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)' }}>{title}</div>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '16px 18px', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: '10px' }}>
      {children}
    </div>
  )
}

function MentalTab({ resetPhrase, onSave, onBack, raceDistanceKm, raceName, charity }: { resetPhrase: string; onSave: (v: string) => void; onBack: () => void; raceDistanceKm?: number; raceName?: string; charity?: string }) {
  const distLabel  = raceDistanceKm ? `${raceDistanceKm}km` : 'the full distance'
  const raceLabel  = raceName || 'your race'
  const darkKmLow  = raceDistanceKm ? Math.round(raceDistanceKm * 0.65) : null
  const darkKmHigh = raceDistanceKm ? Math.round(raceDistanceKm * 0.75) : null
  const darkRange  = darkKmLow && darkKmHigh ? `km ${darkKmLow}–${darkKmHigh}` : 'the back half'
  const whyCard    = charity
    ? `${charity}. When you want to stop, think about why you started. That one doesn't move when everything else does.`
    : "When you want to stop, think about why you started. That one doesn't move when everything else does."
  const tools = [
    { title: 'The Box',          text: `Don't think about ${distLabel}. Next checkpoint only. That's your entire world. Shrink it right down and stay in it.` },
    { title: 'The Reset Phrase', text: 'Pick one phrase now, before race day. Short. Yours. Use it the moment the voice starts. Write it below.' },
    { title: 'Feeling ≠ Fact',   text: '"I can\'t do this" is a feeling. Not information. Your legs are still moving — that\'s information. It passes.' },
    { title: 'The Fuel Check',   text: '80% of dark patches are underfueling in a trench coat. Before you spiral, eat something. Wait 8 minutes.' },
    { title: 'The Why Card',     text: whyCard },
    { title: 'Walk = Strategy',  text: `Elites walk the uphills at ${raceLabel}. Walking a climb is a tactic, not a failure.` },
  ]
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Mental toolkit" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          The dark patch is coming. Probably around <span style={{ color: 'var(--accent)' }}>{darkRange}</span>. That's not a sign something's wrong — it's a sign you've been working long enough for it to be real. These tools exist for that moment.
        </InfoBox>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          {tools.map(t => (
            <div key={t.title} style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.05em', color: 'var(--accent)', marginBottom: '8px', textTransform: 'uppercase' }}>{t.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{t.text}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your Reset Phrase</div>
          <textarea value={resetPhrase} onChange={e => onSave(e.target.value)} placeholder="What's the phrase you'll use when it gets dark?" style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontFamily: 'var(--font-brand)', fontSize: '13px', lineHeight: 1.7, resize: 'vertical', minHeight: '60px', outline: 'none' }} />
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
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Fueling plan" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <InfoBox>
          Real food plus gels is the right call. The goal now is <span style={{ color: 'var(--accent)' }}>stress-testing your gut before race day</span>. No surprises on the day. None.
        </InfoBox>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {protocol.map(p => (
            <div key={p.timing} style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{p.timing}</div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>{p.what}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.55 }}>{p.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuitTab({ quitDays, raceDistanceKm, onBack }: { quitDays: number | null; raceDistanceKm?: number; onBack: () => void }) {
  const days = quitDays ?? 0
  const milestones = [
    { days: 3,  label: 'Day 3 — Nicotine clearing' },
    { days: 7,  label: 'Week 1' },
    { days: 14, label: 'Day 14 — Habit breaking' },
    { days: 30, label: 'Day 30 — Lung function' },
    { days: 60, label: 'Day 60 — Aerobic gains' },
  ]
  const raceCtx = raceDistanceKm ? `a ${raceDistanceKm}km race` : 'your race'
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', paddingBottom: '80px' }}>
      <BackHeader title="Quit tracker" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: '32px' }}>
        <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--teal-bg)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '3.5rem', color: 'var(--teal)', lineHeight: 1, fontWeight: 500 }}>{days}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--teal)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Smoke-free days</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>Your aerobic capacity is recovering. The data will show it.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {milestones.map(m => (
                <div key={m.days} style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '3px 10px', borderRadius: '20px', border: `0.5px solid ${days >= m.days ? 'var(--teal-bg)' : 'var(--border-col)'}`, color: days >= m.days ? 'var(--teal)' : 'var(--text-secondary)' }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <InfoBox>
          <strong style={{ color: 'var(--text-secondary)' }}>What quitting does to your running:</strong><br /><br />
          <span style={{ color: 'var(--accent)' }}>48 hours</span> — CO leaves bloodstream. O₂ delivery improves immediately.<br />
          <span style={{ color: 'var(--accent)' }}>Week 1–2</span> — Resting HR starts dropping. Recovery improves noticeably.<br />
          <span style={{ color: 'var(--accent)' }}>Week 3–4</span> — Aerobic efficiency measurably better. Zone 2 feels easier.<br />
          <span style={{ color: 'var(--accent)' }}>Month 2+</span> — Cardiac drift reduces. That late-run HR creep? Less of it.<br /><br />
          <strong style={{ color: 'var(--text-secondary)' }}>Quitting while training for {raceCtx}. That's an upgrade.</strong>
        </InfoBox>
      </div>
    </div>
  )
}
