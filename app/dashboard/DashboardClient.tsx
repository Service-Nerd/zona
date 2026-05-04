'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { Plan, Week } from '@/types/plan'
import PlanChart from '@/components/training/PlanChart'
import PlanCalendar from '@/components/training/PlanCalendar'
// Calendar screen retired — CalendarOverlay.tsx renamed to .old.tsx (brand-product-alignment v2)
import StravaPanel from '@/components/strava/StravaPanel'
import { createClient } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { fetchPlanFromUrl, fetchPlanForUser, savePlanForUser, DEFAULT_GIST_URL, EMPTY_PLAN, getCurrentWeek, getCurrentWeekIndex, parseLocalDate } from '@/lib/plan'
import { SESSION_COLORS, SESSION_LABELS, getSessionColor, getSessionLabel } from '@/lib/session-types'
import { isTrialActive } from '@/lib/trial'
import { getCoachingFlag, type CoachingFlag } from '@/lib/coaching/coachingFlag'
import { computeAerobicPace } from '@/lib/coaching/aerobicPace'
import { BRAND } from '@/lib/brand'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import PendingAdjustmentBanner from '@/components/shared/PendingAdjustmentBanner'
import RestraintCard, { RestraintCardSkeleton } from '@/components/shared/RestraintCard'
import PlanArc from '@/components/shared/PlanArc'
import RPEScale from '@/components/shared/RPEScale'
import SessionCard from '@/components/shared/SessionCard'
import ZoneInfoSheet from '@/components/shared/ZoneInfoSheet'
import ZoneShapeCard from '@/components/shared/ZoneShapeCard'
import AIMark from '@/components/shared/AIMark'
import AICoachChip from '@/components/shared/AICoachChip'
import { RaceTimesCard } from '@/components/shared/RaceTimesCard'
import { composeSession } from '@/lib/plan/sessionComposer'
import { formatDistance, sumRoundedDistance } from '@/lib/format'
import { didSessionHitZone, sessionHRBand, zoneForSessionType } from '@/lib/coaching/zoneRules'
import { renderGuidance, guidanceContextFromSession } from '@/lib/plan/renderGuidance'
import { V1_SESSION_CATALOGUE } from '@/lib/plan/sessionCatalogueData'
import dynamic from 'next/dynamic'
const GeneratePlanScreen = dynamic(() => import('./GeneratePlanScreen'), { ssr: false })
const UpgradeScreen = dynamic(() => import('./UpgradeScreen'), { ssr: false })
const BenchmarkUpdateScreen = dynamic(() => import('./BenchmarkUpdateScreen'), { ssr: false })

type Screen = 'today' | 'plan' | 'coach' | 'strava' | 'me' | 'calendar' | 'session' | 'admin' | 'generate' | 'upgrade' | 'benchmark' | 'reshape'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  const bytes    = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes.buffer
}

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
  // router.replace stays inside the WKWebView — window.location.href triggers
  // Capacitor's external-navigation handler, which on iOS opens Safari.
  const router = useRouter()
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
  // Splash holds until critical first-paint data is in: run_analysis (for
  // the "How this week is going" card) and Strava activities (for the
  // session-card aerobic-pace slot). Flipped by a 2s safety timeout if
  // Strava is slow — better to drop into the UI with a skeleton than to
  // hang the splash on an unreachable third party.
  const [stravaSafetyExpired, setStravaSafetyExpired] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [preferredUnits, setPreferredUnits] = useState<'km' | 'mi'>('km')
  const [preferredMetric, setPreferredMetric] = useState<'distance' | 'duration'>('distance')
  const [restingHR, setRestingHR] = useState<number | null>(null)
  const [maxHR, setMaxHR] = useState<number | null>(null)
  const [dob, setDob] = useState<string | null>(null)
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [profileEmail, setProfileEmail] = useState<string>('')

  // Paid access — default true to avoid flash of locked state during load
  const [hasPaidAccess, setHasPaidAccess] = useState(true)
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  // Trial expired — true when user had a trial that is now over and no active subscription
  const [trialExpired, setTrialExpired] = useState(false)

  // Feature 3 — dynamic adjustments opt-in
  const [dynamicAdjustmentsEnabled, setDynamicAdjustmentsEnabled] = useState(true)

  // Coaching data — run analysis + weekly report + pending adjustments
  const [runAnalysisMap, setRunAnalysisMap] = useState<Record<string, any>>({})  // keyed by session_day
  // Tracks whether the run_analysis fetch has completed (success OR empty).
  // Lets downstream UI distinguish "still loading" from "definitely no data"
  // — used to show a skeleton instead of letting the RestraintCard pop in
  // a beat after the rest of the Today screen renders.
  const [runAnalysisReady, setRunAnalysisReady] = useState(false)
  const [weeklyReport, setWeeklyReport] = useState<any | null>(null)
  const [pendingAdjustment, setPendingAdjustment] = useState<any | null>(null)
  // R28 phase-end summary + R29 race readiness — pre-fetched cached rows, generated on-demand in CoachScreen
  const [phaseSummary, setPhaseSummary] = useState<{ content: string; generated_at: string; phase_ended: string; transition_week_n: number } | null>(null)
  const [raceReadinessNote, setRaceReadinessNote] = useState<{ content: string; generated_at: string } | null>(null)
  // R30 zone drift pattern + R32 recalibration — dismiss timestamps from user_settings
  const [zoneDriftDismissedAt, setZoneDriftDismissedAt]         = useState<string | null>(null)
  const [benchmarkRecalDismissedAt, setBenchmarkRecalDismissedAt] = useState<string | null>(null)

  // Next session after activeSessionData — passed to SessionScreen for the "Up next" row.
  // Scans remaining days in the same week, then the first day of the next week.
  const activeNextSession = useMemo(() => {
    if (!plan || !activeSessionData) return null
    const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const DAY_FULL: Record<string, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
    const EXCLUDED = ['rest', 'strength']
    const currentKey = activeSessionData.key as string
    const currentWeekN = activeSessionData.weekN as number
    // Search remaining days in the same week, then the first session of the next week
    for (const searchWeek of [
      plan.weeks.find((w: any) => w.n === currentWeekN),
      plan.weeks.find((w: any) => w.n === currentWeekN + 1),
    ]) {
      if (!searchWeek) continue
      const isSameWeek = searchWeek.n === currentWeekN
      const startIdx = isSameWeek ? DAY_ORDER.indexOf(currentKey as typeof DAY_ORDER[number]) + 1 : 0
      for (let i = startIdx; i < DAY_ORDER.length; i++) {
        const day = DAY_ORDER[i]
        const s = (searchWeek.sessions as any)?.[day]
        if (!s || EXCLUDED.includes(s.type)) continue
        return {
          type:       s.type as string,
          day:        DAY_FULL[day] ?? day,
          distanceKm: s.distance_km ?? null,
          label:      s.label ?? null,
        }
      }
    }
    return null
  }, [plan, activeSessionData])

  // Trigger 3: missed session prompt — shown once per session on app open
  const [missedSessionPrompt, setMissedSessionPrompt] = useState<{ weekN: number; day: string; session: any } | null>(null)

  // Post-wizard orientation — shown once after first-ever plan generation (B-002)
  const [showOrientation, setShowOrientation] = useState(false)
  const [orientationSeen, setOrientationSeen] = useState(false)

  // Strava token failure — set when refresh call returns non-200 for a user who had a token
  const [stravaTokenFailed, setStravaTokenFailed] = useState(false)

  // Auth user ID — stored for callbacks that need to write to user_settings
  const [userId, setUserId] = useState<string | null>(null)

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

  // Session guidance pre-loaded once at app boot, keyed by session_type.
  // Eliminates the in-card pop-in that happened when SessionPopupInner fetched
  // its own guidance after mount. Empty map until fetched; the map lookup
  // returning undefined matches the previous "no guidance" render path.
  const [guidanceMap, setGuidanceMap] = useState<Map<string, any>>(new Map())

  // Daily coach note — AI-generated, paid/trial only. Null when not yet
  // fetched, AI failed, or user is free. Today screen renders the rule-based
  // fallback when null and tier is paid; renders nothing when free.
  const [dailyCoachNote, setDailyCoachNote] = useState<string | null>(null)
  // True once the fetch resolves (success or fail). Prevents flashing the
  // rule-based fallback before the AI note arrives.
  const [coachNoteSettled, setCoachNoteSettled] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    // Handle strava OAuth redirect result
    const params = new URLSearchParams(window.location.search)
    if (params.get('strava') === 'connected') {
      setStravaConnected(true)
      window.history.replaceState({}, '', '/dashboard')
    }
    if (params.get('strava') === 'upgrade') {
      setScreen('upgrade')
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [])

  // Strava safety timer: if the activities fetch hasn't settled within 2s
  // of mount, release the splash anyway. Strava can be slow / unreachable
  // and we'd rather render the Today screen with a brief pace skeleton
  // than hang the splash indefinitely.
  useEffect(() => {
    const t = setTimeout(() => setStravaSafetyExpired(true), 2000)
    return () => clearTimeout(t)
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

  // Register service worker on load — subscription requires a user gesture (iOS requirement)
  useEffect(() => {
    if (!hasPaidAccess || !appReady) return
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.register('/sw.js')
  }, [hasPaidAccess, appReady])

  // Daily coach note — paid/trial only. Skip fetch entirely for free users.
  // Cached daily; the route returns instantly on cache hit, so this only
  // pays the AI cost once per user per day.
  useEffect(() => {
    if (!hasPaidAccess || !appReady) return
    let cancelled = false
    async function loadNote() {
      try {
        const today = new Date()
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const res = await authedFetch(`/api/daily-coach-note?date=${dateStr}`)
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && typeof data?.note === 'string') setDailyCoachNote(data.note)
      } catch {
        // silent fallback — TodayScreen will use the rule-based note
      } finally {
        if (!cancelled) setCoachNoteSettled(true)
      }
    }
    loadNote()
    return () => { cancelled = true }
  }, [hasPaidAccess, appReady])

  useEffect(() => {
    try {
      const p = localStorage.getItem('rts_phrase'); if (p) setResetPhrase(p)
      // DEPRECATED — rts_theme no longer used (see ADR-008). Theme read ignored.
      // const t = localStorage.getItem('rts_theme') as 'dark' | 'light' | 'auto' | null
      // if (t) { setTheme(t); applyTheme(t) } else { applyTheme('light') }
    } catch {}

    async function fetchSettings() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        // Fetch overrides + user settings + completions in parallel
        const [settingsRes, overridesRes, completionsRes, subRes, guidanceRes] = await Promise.all([
          supabase.from('user_settings').select('strava_refresh_token, smoke_tracker_enabled, quit_date, gist_url, plan_json, has_onboarded, is_admin, preferred_units, preferred_metric, resting_hr, max_hr, date_of_birth, first_name, last_name, email, trial_started_at, dynamic_adjustments_enabled, orientation_seen, zone_drift_dismissed_at, benchmark_recal_dismissed_at').eq('id', user.id).single(),
          supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id),
          supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag').eq('user_id', user.id),
          supabase.from('subscriptions').select('status, current_period_end').eq('user_id', user.id).maybeSingle(),
          supabase.from('session_guidance').select('*').order('phase', { ascending: false, nullsFirst: false }),
        ])

        // Build session_type → guidance map. Within each type, the first row
        // wins — ordering above puts highest-phase non-null first, null last,
        // matching the previous per-card fetch behaviour.
        if (guidanceRes.data) {
          const map = new Map<string, any>()
          for (const row of guidanceRes.data as any[]) {
            if (!map.has(row.session_type)) map.set(row.session_type, row)
          }
          setGuidanceMap(map)
        }

        if (overridesRes.data) setAllOverrides(overridesRes.data)
        const completionsMap: Record<number, Record<string, any>> = {}
        if (completionsRes.data) {
          completionsRes.data.forEach((r: any) => {
            if (!completionsMap[r.week_n]) completionsMap[r.week_n] = {}
            completionsMap[r.week_n][r.session_day] = r
          })
          setAllCompletions(completionsMap)
        }

        if (settingsRes.error) console.error('user_settings query failed:', settingsRes.error)
        const data = settingsRes.data

        // Load plan — plans table first, auto-migrate from gist_url / plan_json on first load
        const loadedPlan = await fetchPlanForUser(user.id, supabase, {
          gistUrl: data?.gist_url,
          legacyPlanJson: data?.plan_json as Plan | null,
        })
        if (loadedPlan.weeks.length === 0) {
          setPlan(EMPTY_PLAN)
          setScreen('generate')
        } else {
          setPlan(loadedPlan)
        }

        // Trigger 3: miss detection — past days this week with a scheduled session and no completion
        if (loadedPlan.weeks.length > 0) {
          const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
          const jsDay    = new Date().getDay() // 0=Sun…6=Sat
          const todayKey = jsDay === 0 ? 'sun' : WEEK_DAYS[jsDay - 1]
          const todayIdx = WEEK_DAYS.indexOf(todayKey)
          const wIdx     = getCurrentWeekIndex(loadedPlan.weeks)
          const wN       = wIdx + 1
          const week     = loadedPlan.weeks[wIdx]
          const thisWeekCompletions = completionsMap[wN] ?? {}
          if (week) {
            for (const dayKey of WEEK_DAYS) {
              const dayIdx = WEEK_DAYS.indexOf(dayKey)
              if (dayIdx >= todayIdx) break // today or future
              const s = (week.sessions as any)[dayKey]
              if (!s || s.type === 'rest') continue
              if (!thisWeekCompletions[dayKey]) {
                setMissedSessionPrompt({ weekN: wN, day: dayKey, session: { ...s, key: dayKey } })
                break // one at a time
              }
            }
          }
        }

        // Admin flag
        if (data?.is_admin) setIsAdmin(true)

        // Units preference
        if (data?.preferred_units === 'mi') setPreferredUnits('mi')
        if (data?.preferred_metric === 'duration') setPreferredMetric('duration')

        // HR data
        if (data?.resting_hr) setRestingHR(data.resting_hr)
        if (data?.max_hr) setMaxHR(data.max_hr)
        if (data?.date_of_birth) setDob(data.date_of_birth)

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

        // Welcome screen retired per brand-product-alignment v2 — migration complete.
        // if (!data?.has_onboarded && loadedPlan.weeks.length > 0) {
        //   setShowWelcome(true)
        // }

        // Trial — set trial_started_at on first load if not already set
        let trialStartedAt: string | null = data?.trial_started_at ?? null
        if (!trialStartedAt) {
          trialStartedAt = new Date().toISOString()
          void supabase.from('user_settings').upsert({ id: user.id, trial_started_at: trialStartedAt, updated_at: new Date().toISOString() })
        }

        // Paid access — active subscription OR within trial window
        const sub = subRes.data
        const hasActiveSub = sub?.status &&
          ['trialing', 'active'].includes(sub.status) &&
          new Date(sub.current_period_end) > new Date()
        const paidAccess = !!(hasActiveSub || isTrialActive(trialStartedAt))
        setHasPaidAccess(paidAccess)
        setTrialExpired(!paidAccess && !!trialStartedAt)

        // Trial countdown — for day-10 nudge banner. Only meaningful while trial active and no active sub.
        if (trialStartedAt && !hasActiveSub) {
          const trialEnd = new Date(trialStartedAt).getTime() + 14 * 24 * 60 * 60 * 1000
          const msLeft = trialEnd - Date.now()
          setTrialDaysLeft(msLeft > 0 ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : 0)
        } else {
          setTrialDaysLeft(null)
        }

        // Dynamic adjustments toggle
        if (data?.dynamic_adjustments_enabled === false) setDynamicAdjustmentsEnabled(false)

        // Orientation seen flag (B-002) — true means we've shown it before, don't show again
        if (data?.orientation_seen) setOrientationSeen(true)

        // R30 + R32 dismiss timestamps — gate the coaching cards in CoachScreen
        if (data?.zone_drift_dismissed_at) setZoneDriftDismissedAt(data.zone_drift_dismissed_at)
        if (data?.benchmark_recal_dismissed_at) setBenchmarkRecalDismissedAt(data.benchmark_recal_dismissed_at)

        // Coaching data — run analysis, weekly report, pending adjustments (paid/trial only).
        // Awaited inline now (was fire-and-forget) so the splash can hold
        // until run_analysis is in hand — prevents the "How this week is
        // going" card from popping in a beat after the Today screen lands.
        // Free users skip the fetch entirely and flip ready immediately.
        if (paidAccess) {
          try {
            // Pre-flight: pre-session readiness check.
            // Fires HealthKit RHR/HRV/sleep deviations into a pending plan_adjustment
            // row before we read the table below. Silent failure — readiness is one of
            // many adjustment paths and shouldn't block the rest of the dashboard data.
            try { await authedFetch('/api/pre-session-readiness') } catch {}

            const [analysisRes, reportRes, adjustmentsRes, phaseSummaryRes, raceReadinessRes] = await Promise.all([
              supabase.from('run_analysis').select('session_day, source, verdict, total_score, feedback_text, hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, ef_trend_pct, hr_discipline_score, distance_score, pace_score, ef_score, actual_load_km').eq('user_id', user.id),
              supabase.from('weekly_reports').select('*').eq('user_id', user.id).order('week_n', { ascending: false }).limit(1).maybeSingle(),
              supabase.from('plan_adjustments').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle(),
              // R28 — most recent phase-end summary (CoachScreen validates against current transition)
              supabase.from('phase_summaries').select('content, generated_at, phase_ended, transition_week_n').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
              // R29 — race readiness note for the plan's race date
              loadedPlan.meta.race_date
                ? supabase.from('race_readiness_notes').select('content, generated_at').eq('user_id', user.id).eq('race_date', loadedPlan.meta.race_date).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            ])
            if (analysisRes.data) {
              const map: Record<string, any> = {}
              analysisRes.data.forEach((r: any) => { map[r.session_day] = r })
              setRunAnalysisMap(map)
            }
            if (reportRes.data) setWeeklyReport(reportRes.data)
            if (adjustmentsRes.data) setPendingAdjustment(adjustmentsRes.data)
            if (phaseSummaryRes.data) setPhaseSummary(phaseSummaryRes.data as any)
            if (raceReadinessRes.data) setRaceReadinessNote(raceReadinessRes.data as any)
          } catch {}
          finally { setRunAnalysisReady(true) }
        } else {
          setRunAnalysisReady(true)
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

        // Fetch activities from the past 12 months — paginate until exhausted or 5 pages max
        const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
        const after = Math.floor(oneYearAgo.getTime() / 1000)
        const activities: any[] = []
        for (let page = 1; page <= 5; page++) {
          const actRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, {
            headers: { Authorization: `Bearer ${access_token}` },
          })
          const batch = await actRes.json()
          if (!Array.isArray(batch) || batch.length === 0) break
          activities.push(...batch)
          if (batch.length < 100) break
        }
        const { getRuns } = await import('@/lib/strava')
        const runs = getRuns(activities)
        setStravaRuns(runs)
        setStravaConnected(true)
      } catch {}
      finally { setStravaLoading(false) }
    }
    // Use onAuthStateChange rather than calling fetchSettings() directly.
    // This handles both the normal case (existing session → INITIAL_SESSION fires)
    // and the OAuth PKCE case (?code= in URL → exchange happens in browser →
    // SIGNED_IN fires after exchange completes). Both events wait for
    // initializePromise so the session is always ready when we get here.
    let loaded = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && !loaded) {
        loaded = true
        if (!session) {
          router.replace('/auth/login')
          return
        }
        // Clean up OAuth code from URL if present
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('code')) {
          window.history.replaceState({}, '', '/dashboard')
        }
        fetchSettings()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function refreshCompletions() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('session_completions')
        .select('week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag')
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
      // Load their plan — plans table (RLS returns empty for other users), fall back to gist_url
      const { data: planRow } = await supabase.from('plans').select('plan_json').eq('user_id', userId).single()
      if (planRow?.plan_json) {
        setPlan(planRow.plan_json as Plan)
      } else {
        const { data: settings } = await supabase.from('user_settings').select('gist_url').eq('id', userId).single()
        const gistUrl = settings?.gist_url || DEFAULT_GIST_URL
        const loadedPlan = await fetchPlanFromUrl(gistUrl)
        setPlan(loadedPlan)
      }

      // Load their overrides
      const { data: overrides } = await supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', userId)
      setAllOverrides(overrides ?? [])

      // Load their completions
      const { data: completions } = await supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag').eq('user_id', userId)
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
    const loadedPlan = await fetchPlanForUser(user.id, supabase)
    setPlan(loadedPlan)

    const { data: overrides } = await supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id)
    setAllOverrides(overrides ?? [])

    const { data: completions } = await supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag').eq('user_id', user.id)
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
      // Archive the previous plan before overwriting — data protection, no restore UI at v1
      if (plan && plan !== EMPTY_PLAN && plan.weeks.length > 0) {
        void supabase.from('plan_archive').insert({
          user_id: user.id,
          plan_json: plan,
          race_name: (plan.meta as any)?.race_name ?? null,
          race_date: (plan.meta as any)?.race_date ?? null,
        })
      }
      await savePlanForUser(user.id, savedPlan, supabase)
      setPlan(savedPlan)
      setScreen('today')
      // Only show orientation on first-ever plan generation (B-002)
      if (!orientationSeen) setShowOrientation(true)
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
  // Aerobic pace is derived from Strava runs in the user's Z2 band — a
  // network-bound input that can lag behind first paint when Strava is
  // slow (the 2s splash safety timer caps how long we wait). Cache the
  // last computed value in localStorage so subsequent paints have an
  // immediate, stable value while fresh data is fetched.
  const liveAerobicPace = useMemo(() =>
    computeAerobicPace(stravaRuns, restingHR, maxHR, preferredUnits),
  [stravaRuns, restingHR, maxHR, preferredUnits])
  const PACE_CACHE_KEY = 'rts_aerobic_pace_cache'
  const [cachedAerobicPace, setCachedAerobicPace] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try { return localStorage.getItem(PACE_CACHE_KEY) } catch { return null }
  })
  useEffect(() => {
    if (liveAerobicPace && liveAerobicPace !== cachedAerobicPace) {
      try { localStorage.setItem(PACE_CACHE_KEY, liveAerobicPace) } catch {}
      setCachedAerobicPace(liveAerobicPace)
    }
  }, [liveAerobicPace, cachedAerobicPace])
  const aerobicPace = liveAerobicPace ?? cachedAerobicPace

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

  // Splash holds until everything that drives Today's first paint is in:
  // settings/overrides (appReady), run_analysis (runAnalysisReady — gates
  // the "How this week is going" card), and Strava activities (gates the
  // session-card aerobic-pace slot). The 2s safety timer releases the
  // Strava gate so an unreachable Strava can't hang the splash.
  const stravaGateOpen = !stravaLoading || stravaSafetyExpired
  const bootReady = appReady && runAnalysisReady && stravaGateOpen
  if (!bootReady) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
        gap: '0',
      }}>
        {/* Vetra wordmark */}
        <div style={{ marginBottom: '10px' }}>
          <span className="wordmark-splash" style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '38px', fontWeight: 500, letterSpacing: '0.08em',
            color: 'var(--accent)', lineHeight: 1,
          }}>{BRAND.name}</span>
        </div>

        {/* Tagline */}
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {BRAND.tagline}
        </div>
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
        {/* Vetra wordmark */}
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '36px', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '8px' }}>
          {BRAND.name}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '48px' }}>
          {BRAND.tagline}
        </div>

        {/* Welcome message */}
        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px', marginBottom: '16px', lineHeight: 1.3 }}>
            Your plan is ready.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '12px' }}>
            {/* TODO: brand voice review — sentences referencing the product name may benefit from rewording in a follow-up content polish pass. */}
            Vetra keeps track of your sessions, adapts when things shift, and keeps you focused on what matters — finishing.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '48px' }}>
            Train with intention. The rest follows.
          </div>

          <button
            onClick={dismissWelcome}
            style={{
              width: '100%', padding: '16px',
              background: 'var(--accent)', color: 'var(--card)',
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

  // Post-wizard orientation — shown once after first-ever plan generation (B-002)
  if (showOrientation) {
    return (
      <OrientationScreen
        plan={plan}
        firstName={firstName}
        zone2Ceiling={effectiveZone2Ceiling}
        onDismiss={async () => {
          setShowOrientation(false)
          setOrientationSeen(true)
          try {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) void supabase.from('user_settings').upsert({ id: user.id, orientation_seen: true, updated_at: new Date().toISOString() })
          } catch {}
        }}
      />
    )
  }

  const currentWeek = getCurrentWeek(plan?.weeks ?? [])

  return (
    <div style={s}>

      {/* Impersonation banner */}
      {impersonating && (
        <div style={{
          background: 'var(--accent)', padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 2000,
        }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--card)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Viewing as {impersonating.name}
          </div>
          <button onClick={exitImpersonation} style={{
            background: 'rgba(0,0,0,0.2)', border: 'none', borderRadius: '6px',
            color: 'var(--card)', fontFamily: 'var(--font-ui)', fontSize: '11px',
            letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 10px',
            cursor: 'pointer',
          }}>
            Exit
          </button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '72px' }}>
        {screen === 'today'    && <TodayScreen plan={plan} weekIndex={viewWeekIndex} onWeekChange={setViewWeekIndex} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} daysToRace={daysToRace} raceName={raceName} preferredMetric={preferredMetric} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} overridesReady={overridesReady} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} allCompletions={allCompletions} preferredUnits={preferredUnits} zone2Ceiling={effectiveZone2Ceiling} onManualSaved={refreshCompletions} restingHR={restingHR} maxHR={maxHR} aerobicPace={aerobicPace} stravaLoading={stravaLoading} firstName={firstName} pendingAdjustment={pendingAdjustment} onAdjustmentConfirmed={(p) => { setPlan(p); setPendingAdjustment(null) }} onAdjustmentReverted={(p) => { setPlan(p); setPendingAdjustment(null) }} trialDaysLeft={trialDaysLeft} onUpgrade={() => setScreen('upgrade')} hasPaidAccess={hasPaidAccess} dailyCoachNote={dailyCoachNote} coachNoteSettled={coachNoteSettled} runAnalysisMap={runAnalysisMap} runAnalysisReady={runAnalysisReady} />}
        {screen === 'plan'     && <PlanScreen plan={plan} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} allCompletions={allCompletions} onOverrideChange={setAllOverrides} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} overridesReady={overridesReady} preferredUnits={preferredUnits} />}
        {screen === 'coach'    && (hasPaidAccess
          ? (() => {
              const wn = getCurrentWeekIndex(plan.weeks) + 1
              const comps = allCompletions[wn] ?? {}
              const wSessions = Object.entries((currentWeek as any).sessions ?? {})
                .map(([day, s]: [string, any]) => ({ ...(s as any), key: day }))
                .filter((s: any) => s?.type && s.type !== 'rest' && s.type !== 'strength')
              // Live sessions count — reads from allCompletions, not the cached
              // weekly_reports row. The cache is generated once-per-day and
              // its sessions_completed value goes stale every time a user
              // logs another run. UI count must match what the user just did.
              const liveSessionsPlanned   = wSessions.length
              const liveSessionsCompleted = wSessions.filter(
                (s: any) => comps[s.key]?.status === 'complete'
              ).length
              // Zone discipline — time-weighted hr_in_zone_pct, same formula
              // as the TodayScreen RestraintCard so the two surfaces never
              // disagree about the same week.
              const analysisRows = wSessions
                .filter((s: any) => comps[s.key]?.status === 'complete')
                .map((s: any) => {
                  const a = runAnalysisMap?.[s.key]
                  if (!a || a.hr_in_zone_pct == null) return null
                  return {
                    inZone: a.hr_in_zone_pct as number,
                    weight: (a.actual_load_km as number | null) ?? 1,
                  }
                })
                .filter((v: any): v is { inZone: number; weight: number } => v !== null)
              const zoneDisciplinePercent = analysisRows.length >= 1
                ? Math.round(
                    analysisRows.reduce((s: number, r: any) => s + r.inZone * r.weight, 0)
                    / analysisRows.reduce((s: number, r: any) => s + r.weight, 0)
                  )
                : null

              // R30 — zone drift pattern detection.
              // Join runAnalysisMap with plan sessions to identify easy/recovery rows,
              // then check the most recent 8 for hr_in_zone_pct < 60%.
              const allEasyRecoveryRows = Object.entries(runAnalysisMap ?? {})
                .map(([sessionDay, analysis]: [string, any]) => {
                  if (analysis.hr_in_zone_pct == null) return null
                  if (analysis.source === 'manual') return null
                  const m = sessionDay.match(/^week_(\d+)_([a-z]+)$/)
                  if (!m) return null
                  const weekN    = parseInt(m[1], 10)
                  const dayShort = m[2].slice(0, 3)
                  const weekData = plan.weeks.find((w: any) => w.n === weekN)
                  const sType    = (weekData?.sessions as any)?.[dayShort]?.type ?? null
                  if (sType !== 'easy' && sType !== 'recovery') return null
                  return { weekN, hr_in_zone_pct: analysis.hr_in_zone_pct as number }
                })
                .filter((r): r is { weekN: number; hr_in_zone_pct: number } => r !== null)
                .sort((a, b) => b.weekN - a.weekN)
                .slice(0, 8)
              const zoneDriftCount   = allEasyRecoveryRows.filter(r => r.hr_in_zone_pct < 60).length
              const zoneDriftPattern = allEasyRecoveryRows.length >= 4 && zoneDriftCount >= 4
                ? { count: zoneDriftCount, total: allEasyRecoveryRows.length }
                : null

              // R30 dismiss handler — 14-day window
              async function dismissZoneDrift() {
                const { data: { user: u } } = await supabase.auth.getUser()
                if (!u) return
                const now = new Date().toISOString()
                setZoneDriftDismissedAt(now)
                await supabase.from('user_settings').upsert({ id: u.id, zone_drift_dismissed_at: now, updated_at: now })
              }

              // R32 dismiss handler — 21-day window
              async function dismissBenchmarkRecal() {
                const { data: { user: u } } = await supabase.auth.getUser()
                if (!u) return
                const now = new Date().toISOString()
                setBenchmarkRecalDismissedAt(now)
                await supabase.from('user_settings').upsert({ id: u.id, benchmark_recal_dismissed_at: now, updated_at: now })
              }

              return (
                <CoachScreen
                  plan={plan} currentWeek={currentWeek} runs={stravaRuns}
                  stravaLoading={stravaLoading} stravaConnected={stravaConnected}
                  stravaTokenFailed={stravaTokenFailed} firstName={firstName}
                  weeklyReport={weeklyReport} onReportGenerated={setWeeklyReport}
                  preferredUnits={preferredUnits}
                  zoneDisciplinePercent={zoneDisciplinePercent}
                  liveSessionsCompleted={liveSessionsCompleted}
                  liveSessionsPlanned={liveSessionsPlanned}
                  phaseSummary={phaseSummary}
                  onPhaseSummaryGenerated={setPhaseSummary as any}
                  raceReadinessNote={raceReadinessNote}
                  onRaceReadinessGenerated={setRaceReadinessNote}
                  zoneDriftPattern={zoneDriftPattern}
                  zoneDriftDismissedAt={zoneDriftDismissedAt}
                  onDismissZoneDrift={dismissZoneDrift}
                  benchmarkRecalDismissedAt={benchmarkRecalDismissedAt}
                  onDismissRecal={dismissBenchmarkRecal}
                  onOpenBenchmark={() => setScreen('benchmark')}
                />
              )
            })()
          : <CoachTeaser plan={plan} firstName={firstName} onUpgrade={() => setScreen('upgrade')} />
        )}
        {screen === 'strava'   && <StravaScreen runs={stravaRuns} loading={stravaLoading} connected={stravaConnected} raceName={plan?.meta?.race_name} raceDate={plan?.meta?.race_date} raceDistanceKm={plan?.meta?.race_distance_km} zone2Ceiling={effectiveZone2Ceiling} restingHR={restingHR ?? undefined} maxHR={maxHR ?? undefined} />}
        {screen === 'me'       && <MeScreen plan={plan} initials={initials} athlete={plan?.meta?.athlete ?? ''} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} quitDate={quitDate} onSmokeTrackerChange={(enabled: boolean, date: string) => { setSmokeTrackerEnabled(enabled); setQuitDate(date); if (enabled && date) { const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)); setQuitDays(days) } else { setQuitDays(null) } }} resetPhrase={resetPhrase} onSaveMental={saveMental} theme={theme} onThemeChange={() => { /* theme system retired — ADR-008 */ }} isAdmin={isAdmin} onOpenAdmin={() => setScreen('admin')} preferredUnits={preferredUnits} onUnitsChange={async (u: 'km' | 'mi') => { setPreferredUnits(u); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_units: u, updated_at: new Date().toISOString() }) } catch {} }} preferredMetric={preferredMetric} onMetricChange={async (m: 'distance' | 'duration') => { setPreferredMetric(m); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_metric: m, updated_at: new Date().toISOString() }) } catch {} }} restingHR={restingHR} maxHR={maxHR} onHRChange={async (rhr: number, mhr: number) => { setRestingHR(rhr); setMaxHR(mhr); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, resting_hr: rhr, max_hr: mhr, updated_at: new Date().toISOString() }) } catch {} }} firstName={firstName} lastName={lastName} profileEmail={profileEmail} onProfileChange={async (fn: string, ln: string, em: string) => { setFirstName(fn); setLastName(ln); setProfileEmail(em); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, first_name: fn, last_name: ln, email: em, updated_at: new Date().toISOString() }) } catch {} }} onOpenGenerate={() => setScreen('generate')} onOpenBenchmark={() => setScreen('benchmark')} onOpenReshape={() => setScreen('reshape')} onUpgrade={() => setScreen('upgrade')} hasPaidAccess={hasPaidAccess} trialDaysLeft={trialDaysLeft} dynamicAdjustmentsEnabled={dynamicAdjustmentsEnabled} onDynamicAdjustmentsChange={async (enabled: boolean) => { setDynamicAdjustmentsEnabled(enabled); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, dynamic_adjustments_enabled: enabled, updated_at: new Date().toISOString() }) } catch {} }} />}
        {/* Calendar screen retired per brand-product-alignment v2 */}
        {screen === 'session'  && activeSessionData && <SessionScreen session={activeSessionData} preloadedRuns={stravaRuns ?? []} onBack={() => setScreen('today')} onSaved={impersonating ? undefined : refreshCompletions} preferredUnits={preferredUnits} preferredMetric={preferredMetric} zone2Ceiling={effectiveZone2Ceiling} restingHR={restingHR} maxHR={maxHR} aerobicPace={aerobicPace} stravaLoading={stravaLoading} runAnalysis={runAnalysisMap[activeSessionData?.key ?? ''] ?? null} hasPaidAccess={hasPaidAccess} onUpgrade={() => setScreen('upgrade')} goalPace={(plan?.meta as any)?.goal_pace_per_km ?? null} guidance={guidanceMap.get(activeSessionData?.type ?? '') ?? null} nextSession={activeNextSession} />}
        {screen === 'admin'    && <AdminScreen onBack={() => setScreen('me')} onImpersonate={impersonateUser} />}
        {screen === 'generate' && <GeneratePlanScreen onBack={() => setScreen(plan && plan !== EMPTY_PLAN ? 'me' : 'today')} firstName={firstName} lastName={lastName} restingHR={restingHR} maxHR={maxHR} dob={dob} onDobSave={async (d) => { setDob(d); if (userId) await supabase.from('user_settings').update({ date_of_birth: d }).eq('id', userId) }} onPlanSaved={handlePlanSaved} isOnboarding={!plan || plan === EMPTY_PLAN} hasExistingPlan={!!(plan && plan !== EMPTY_PLAN)} hasPaidAccess={hasPaidAccess} onUpgrade={() => setScreen('upgrade')} />}
        {screen === 'upgrade'  && <UpgradeScreen trialExpired={trialExpired} onBack={() => {
          // Legacy key name — preserved to avoid wiping active user state. Future: migrate via key translation layer.
          const hasWizardDraft = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('zona_wizard_draft')
          setScreen(hasWizardDraft ? 'generate' : 'today')
        }} />}
        {screen === 'benchmark' && plan && <BenchmarkUpdateScreen plan={plan} stravaConnected={stravaConnected} onBack={() => setScreen('me')} onUpdated={(updatedPlan) => { setPlan(updatedPlan) }} />}
        {screen === 'reshape'   && <ReshapeScreen plan={plan} onBack={() => setScreen('me')} onReshapeApplied={(updatedPlan) => { setPlan(updatedPlan); setPendingAdjustment(null); setScreen('today') }} />}
      </div>

      {/* Screen guide — first-load popup */}
      {guideScreen && (
        <ScreenGuide screen={guideScreen} onDismiss={() => setGuideScreen(null)} />
      )}

      {/* Trigger 3: missed session prompt */}
      {missedSessionPrompt && (
        <MissedSessionSheet
          day={missedSessionPrompt.day}
          session={missedSessionPrompt.session}
          weekN={missedSessionPrompt.weekN}
          onSkip={async (reason) => {
            setMissedSessionPrompt(null)
            // Mark as skipped with the given reason
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (!user) return
              await supabase.from('session_completions').upsert({
                user_id: user.id,
                week_n: missedSessionPrompt.weekN,
                session_day: missedSessionPrompt.day,
                status: 'skipped',
                fatigue_tag: reason,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id,week_n,session_day' })
              // Trigger 2: fire skip adjustment (except "Too tired" — absorbed)
              if (reason !== 'Too tired') {
                void authedFetch('/api/adjust-plan', {
                  method: 'POST',
                  body: JSON.stringify({
                    skipReason: reason,
                    sessionType: missedSessionPrompt.session.type,
                    sessionDay: missedSessionPrompt.day,
                  }),
                })
              }
            } catch {}
            void refreshCompletions()
          }}
          onDidIt={() => {
            // Open the session so the user can log it properly
            setActiveSessionData(missedSessionPrompt.session)
            setScreen('session')
            setMissedSessionPrompt(null)
          }}
          onDismiss={() => setMissedSessionPrompt(null)}
        />
      )}


      {/* ── Bottom nav bar ── */}
      {(() => {
        // Hide nav entirely during first-time onboarding — user has no plan to navigate to
        const isOnboarding = screen === 'generate' && (!plan || plan === EMPTY_PLAN)
        if (isOnboarding) return null

        const navItems: { id: Screen; label: string; icon: (a: boolean) => React.ReactNode }[] = [
          { id: 'today', label: 'Today', icon: (a) => <IconToday active={a} /> },
          { id: 'plan',  label: 'Plan',  icon: (a) => <IconPlan  active={a} /> },
          { id: 'coach', label: 'Coach', icon: (a) => <IconCoach active={a} /> },
          { id: 'me',    label: 'Me',    icon: (a) => <IconMe    active={a} /> },
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
        {BRAND.name}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '40px' }}>
        {BRAND.tagline}
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
            background: 'var(--accent)', color: 'var(--card)',
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

// Legacy key name — preserved to avoid wiping active user state. Future: migrate via key translation layer.
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

// ── MOVE SESSION VIEW (Trigger 1) ────────────────────────────────────────────

// ── MISSED SESSION SHEET (Trigger 3) ─────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

function MissedSessionSheet({
  day, session, weekN, onSkip, onDidIt, onDismiss,
}: {
  day: string
  session: any
  weekN: number
  onSkip: (reason: string) => void
  onDidIt: () => void
  onDismiss: () => void
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t) }, [])
  const dayLabel = DAY_LABELS[day] ?? day

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: visible ? 'rgba(26,26,26,0.45)' : 'transparent',
        transition: 'background 0.2s',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: 'var(--card)', borderRadius: '20px 20px 0 0',
          padding: '24px 20px 36px',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)', margin: '0 auto 20px' }} />

        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 6 }}>
          Missed session
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          {session.label ?? 'Session'} — {dayLabel}
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', marginBottom: 24 }}>
          Looks like {dayLabel}&apos;s session wasn&apos;t logged. What happened?
        </p>

        {/* Skip reason buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {(['Injury / illness', 'Too tired', 'Life got busy', 'Bad weather'] as const).map(reason => (
            <button
              key={reason}
              onClick={() => onSkip(reason)}
              style={{
                padding: '12px 10px', borderRadius: 10,
                border: '0.5px solid var(--line)', background: 'var(--bg-soft)',
                fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
              }}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* I actually did it */}
        <button
          onClick={onDidIt}
          style={{
            width: '100%', padding: '13px 0', borderRadius: 100,
            background: 'var(--moss)', border: 'none',
            fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
            color: 'var(--card)', cursor: 'pointer', marginBottom: 8,
          }}
        >
          I actually ran it →
        </button>

        <button
          onClick={onDismiss}
          style={{
            width: '100%', padding: '10px 0', background: 'transparent', border: 'none',
            fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', cursor: 'pointer',
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

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
              background: 'var(--accent)', color: 'var(--card)',
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

// ── Vetra REFLECT RESPONSE ────────────────────────────────────────────────

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
// getCoachingFlag imported from lib/coaching/coachingFlag.ts

// ── SESSION POPUP ─────────────────────────────────────────────────────────

function SessionPopupInner({ session, weekTheme, weekN, preloadedRuns, onClose, onSaved, preferredUnits, zone2Ceiling, preferredMetric, restingHR, maxHR, aerobicPace, stravaLoading, hasPaidAccess, onUpgrade, goalPace, guidance }: {
  session: any; weekTheme: string; weekN: number; preloadedRuns: any[]
  onClose: () => void; onSaved?: () => void
  preferredUnits: 'km' | 'mi'; zone2Ceiling: number; preferredMetric?: 'distance' | 'duration'
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
  stravaLoading?: boolean
  hasPaidAccess?: boolean; onUpgrade?: () => void
  goalPace?: string | null
  guidance?: any | null
}) {
  const [view, setView] = useState<'detail' | 'complete' | 'skip' | 'success' | 'reflect' | 'skip-reflect'>('detail')
  const [showManualModal, setShowManualModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())
  const [loadingClaimed, setLoadingClaimed] = useState(false)
  const [zoneSheetOpen, setZoneSheetOpen] = useState(false)
  const [rpe, setRpe] = useState<number | null>(null)
  const [fatigueTag, setFatigueTag] = useState<string | null>(null)
  const [savingRPE, setSavingRPE] = useState(false)
  const [reflectResponse, setReflectResponse] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState<string | null>(null)
  // Staged activity link — set in saveCompletion, fired in handleReflectDone so
  // RPE + fatigue are already in the DB when analyse-run reads the completion row.
  const pendingLinkRef = useRef<number | null>(null)
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
      // Trigger 4: fatigue accumulation check after heavy log
      if (newTag && ['Heavy', 'Wrecked', 'Cooked'].includes(newTag)) {
        void authedFetch('/api/adjust-plan', { method: 'POST', body: JSON.stringify({}) })
      }
      // Trigger 5: RPE disconnect check — fires when RPE ≥ 8 on easy/long session
      if (newRpe != null && newRpe >= 8 && (session.type === 'easy' || session.type === 'long')) {
        void authedFetch('/api/adjust-plan', { method: 'POST', body: JSON.stringify({ rpe: newRpe, sessionType: session.type }) })
      }
      onSaved?.()
    } catch {} finally { setSavingRPE(false) }
  }

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

      // Stage the activity link — fired when the reflect screen closes so RPE
      // and fatigue are already written to the DB when analyse-run reads them.
      if (status === 'complete' && selectedActivity?.id) {
        pendingLinkRef.current = selectedActivity.id
      }

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
  // Tile label tells the user where the value came from. Plan-prescribed
  // ranges aren't HR-derived; only aerobicPace is.
  const paceSource: 'plan' | 'aerobic' | null = session.pace_target
    ? 'plan'
    : ((session.type === 'easy' || session.type === 'run') && aerobicPace ? 'aerobic' : null)

  // Render the pace tile shell (with a skeleton value) while we're still
  // waiting on Strava-derived aerobicPace. Avoids a layout flash where the
  // tile pops in a beat after the rest of the card.
  const paceTileExpected =
    !paceBracket
    && (session.type === 'easy' || session.type === 'run')
    && !!stravaLoading

  const color = getSessionColor(session.type)
  const config = { color, label: getSessionLabel(session.type) }

  // Per-session metric values — session may come from TodayScreen (formatted) or raw plan object (unformatted)
  const rawDuration = session.duration ?? (session.duration_mins != null ? fmtDurationMins(Number(session.duration_mins)) : null)
  const estimatedDuration = rawDuration ?? (session.distance ?? session.distance_km ? `~${fmtDurationMins(Math.round(Number(session.distance ?? session.distance_km) * 6.5))}` : null)
  const estimatedDistance = session.distance ?? session.distance_km ?? null

  // Fire the staged link-activity call (if any) when the reflect screen closes.
  // By this point saveRPEFatigue has already run, so RPE/fatigue are in the DB.
  // If no activity was staged but the user logged RPE/fatigue, write a manual
  // coaching row via the rule-engine (FREE tier, no AI, no activity data needed).
  function handleReflectDone() {
    const actId = pendingLinkRef.current
    if (actId) {
      pendingLinkRef.current = null
      void authedFetch('/api/strava/link-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strava_activity_id: actId,
          week_n: weekN,
          session_day: session.key,
        }),
      }).catch(() => {})
    } else if ((rpe !== null || fatigueTag !== null) && session.type !== 'rest') {
      // No activity linked — derive feedback from RPE/fatigue alone.
      // Call onSaved after the write so runAnalysisMap refreshes and the
      // coaching card appears next time the session is opened.
      void authedFetch('/api/analyse-run/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_n:       weekN,
          session_day:  session.key,
          session_type: session.type,
          rpe:          rpe ?? null,
          fatigue_tag:  fatigueTag ?? null,
        }),
      }).then(() => onSaved?.()).catch(() => {})
    }
    onClose()
  }

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

        {/* Vetra response */}
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

        <button onClick={handleReflectDone} style={{
          width: '100%', padding: '14px',
          background: reflectResponse ? 'var(--teal)' : 'var(--bg)',
          color: reflectResponse ? 'var(--card)' : 'var(--text-muted)',
          border: reflectResponse ? 'none' : '0.5px solid var(--border-col)',
          borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          fontWeight: reflectResponse ? 600 : 400,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {reflectResponse ? 'Done' : 'Skip for now'}
        </button>

        {/* Analysis hint — paid users with a linked Strava activity.
            Analysis fires when Done is pressed so RPE/fatigue land first. */}
        {hasPaidAccess && selectedActivity && (
          <div style={{
            marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px',
            justifyContent: 'center',
          }}>
            <AIMark size={10} color="var(--moss)" working />
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
            }}>
              Done — your run gets analysed in the background.
            </span>
          </div>
        )}

        {/* Upgrade nudge — free users only, shown after logging a session manually */}
        {!hasPaidAccess && onUpgrade && (
          <button
            onClick={onUpgrade}
            style={{
              marginTop: '10px', width: '100%',
              background: 'none', border: 'none', padding: '8px 0',
              cursor: 'pointer', textAlign: 'center',
              fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)',
            }}
          >
            Connect Strava or Apple Health to unlock coaching.{' '}
            <span style={{ color: 'var(--moss)' }}>→</span>
          </button>
        )}
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
                    // Trigger 2: skip with reason — fire adjustment check (not "Too tired" — absorbed)
                    if (reason !== 'Too tired') {
                      void authedFetch('/api/adjust-plan', {
                        method: 'POST',
                        body: JSON.stringify({ skipReason: reason, sessionType: session.type, sessionDay: session.key }),
                      })
                    }
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
          color: reflectResponse ? 'var(--card)' : 'var(--text-muted)',
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
          {isComplete && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: 'var(--accent-soft)', color: 'var(--teal)', border: '0.5px solid var(--teal-dim)', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Done</span>}
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
                  <button key={m} onClick={() => updateSessionMetric(m === effectiveMetric && isMetricCustom ? null : m)} style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', padding: '3px 9px', borderRadius: '4px', border: 'none', background: effectiveMetric === m ? config.color : 'none', color: effectiveMetric === m ? 'var(--card)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s' }}>
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
          {['easy','run','quality','intervals','hard','tempo','race','recovery'].includes(session.type) && (() => {
            const sessionColor = getSessionColor(session.type)
            const zoneLabel = zoneForSessionType(session.type)?.label ?? session.zone ?? 'Target HR'
            const isInteractive = !!zoneForSessionType(session.type)
            return (
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid var(--border-col)' }}>
              <button
                onClick={() => { if (isInteractive) setZoneSheetOpen(true) }}
                aria-label={isInteractive ? `${zoneLabel} — tap for details` : zoneLabel}
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                  color: sessionColor,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: `${sessionColor}14`,
                  border: `0.5px solid ${sessionColor}33`,
                  borderRadius: '100px', padding: '3px 9px',
                  marginBottom: '6px',
                  cursor: isInteractive ? 'pointer' : 'default',
                }}
              >
                {zoneLabel}
              </button>
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
            )
          })()}
          {/* Pace card — skeleton while Strava-derived aerobic pace is still loading */}
          {paceBracket && (
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Est. pace</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1 }}>~{paceBracket}</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>{paceSource === 'plan' ? 'Pace target' : 'HR-derived estimate'}</div>
            </div>
          )}
          {!paceBracket && paceTileExpected && (
            <div style={{ background: 'var(--bg)', borderRadius: '10px', padding: '10px 12px', border: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Est. pace</div>
              <div style={{
                height: '18px', width: '64px', background: 'var(--bg-soft)', borderRadius: '4px',
                animation: 'ai-mark-pulse 1.6s ease-in-out infinite',
              }} />
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '6px' }}>HR-derived estimate</div>
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
                      {(() => {
                        // Single source of truth: live Karvonen via getSessionHRDisplay,
                        // matching the session-card hero. Falls back to baked hr_target
                        // when restingHR/maxHR are missing. CoachingPrinciples §14, ADR-009.
                        const hrVal = getSessionHRDisplay(session.type, session.hr_target, restingHR ?? null, maxHR ?? null, zone2Ceiling)
                        const hrStr = hrVal ? `${hrVal} bpm` : null
                        const line  = [plannedZone, hrStr].filter(Boolean).join(' · ')
                        if (!line) return null
                        return (
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {line}
                          </span>
                        )
                      })()}
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

          {/* ── STRUCTURED SESSION (R23 composer) ── */}
          {(() => {
            const catalogueRow = V1_SESSION_CATALOGUE.find(r => r.name === session.label) ?? null
            const structure = composeSession({ session, catalogueRow, goalPace })
            // Only render for run-based sessions where the structure is meaningful
            if (!structure) return null
            const skipShapes = ['rest', 'race', 'strength']
            if (skipShapes.includes(structure.shape)) return null

            const partRow = (label: string, mins: number | string, zone: string, body: string, accentColor: string, isMain = false) => (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '10px' }}>
                <div style={{
                  width: isMain ? '4px' : '3px',
                  borderRadius: '2px',
                  background: accentColor,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: isMain ? '3px' : '2px' }}>
                    <div style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: isMain ? '14px' : '13px',
                      fontWeight: isMain ? 700 : 600,
                      color: 'var(--ink)',
                    }}>{label}</div>
                    <div style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: isMain ? '13px' : '12px',
                      color: isMain ? 'var(--ink-2)' : 'var(--mute)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {mins} · {zone}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: isMain ? '13px' : '12px',
                    color: isMain ? 'var(--ink-2)' : 'var(--mute)',
                    lineHeight: 1.5,
                  }}>{body}</div>
                </div>
              </div>
            )

            return (
              <div style={{ padding: '16px 18px', borderBottom: '0.5px solid var(--border-col)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Session structure</div>
                {partRow('Warm-up', `${structure.warmup.duration_mins} min`, structure.warmup.zone, structure.warmup.description, 'var(--mute-2)')}
                {structure.strides && (
                  <div style={{ marginLeft: '15px', marginBottom: '10px', paddingLeft: '12px', borderLeft: '0.5px dashed var(--line)' }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--moss)' }}>
                      Strides — {structure.strides.count} × {structure.strides.duration_secs}s
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.5 }}>{structure.strides.description}</div>
                  </div>
                )}
                {partRow('Main set', `${structure.main.duration_mins} min`, structure.main.zone, structure.main.description, getSessionColor(session.type ?? 'easy'), true)}
                {structure.race_pace_segment && (
                  <div style={{ marginLeft: '15px', marginBottom: '10px', paddingLeft: '12px', borderLeft: '0.5px dashed var(--line)' }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>
                      Race-pace — {structure.race_pace_segment.duration_pct}% @ {structure.race_pace_segment.pace_target}
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.5 }}>{structure.race_pace_segment.description}</div>
                  </div>
                )}
                {partRow('Cool-down', `${structure.cooldown.duration_mins} min`, structure.cooldown.zone, structure.cooldown.description, 'var(--mute-2)')}
              </div>
            )
          })()}

          {/* Week theme — readable, not footnote */}
          {weekTheme && (
            <div style={{ padding: '12px 18px', background: 'var(--bg)', borderBottom: '0.5px solid var(--border-col)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>Week focus</div>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{weekTheme}</div>
            </div>
          )}

          {/* ── WHY THIS SESSION: CoachNoteBlock variant="why" ──
               AI mark only when content came from the plan enricher
               (session.coach_notes). DB guidance fallback is hand-authored
               so no mark — provenance honesty. */}
          {(session.coach_notes?.filter(Boolean).length > 0 || guidance) && (
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border-col)' }}>
              <CoachNoteBlock
                label="WHY THIS SESSION"
                variant="why"
                aiGenerated={(session.coach_notes?.filter(Boolean).length ?? 0) > 0}
              >
                {session.coach_notes?.filter(Boolean).length > 0 ? (
                  // Structured coach notes from plan JSON (AI-generated). Pass through
                  // renderGuidance so {{token}} placeholders the enricher emitted resolve
                  // to live values (Z2 ceiling, session HR, etc.) rather than carrying
                  // stale baked literals after the athlete updates restingHR/maxHR.
                  // Pre-tokenised legacy plans pass through unchanged (no tokens, no-op).
                  renderGuidance(
                    (session.coach_notes as string[]).filter(Boolean).join(' '),
                    guidanceContextFromSession({
                      session,
                      zone2Ceiling: sessionHRBand('easy', restingHR ?? null, maxHR ?? null)?.hi ?? zone2Ceiling,
                      maxHR, restingHR, goalPace,
                    }),
                  )
                ) : guidance ? (
                  // Render only the "why" field — the "what" and "how" fields belong
                  // to other surfaces, not this WHY THIS SESSION block.
                  // Use live Karvonen Z2 ceiling (matches session-card source of truth)
                  // rather than the baked plan.meta.zone2_ceiling, which can drift after
                  // restingHR/maxHR updates. Falls back to the baked value when HR data missing.
                  renderGuidance(guidance.why, guidanceContextFromSession({
                    session,
                    zone2Ceiling: sessionHRBand('easy', restingHR ?? null, maxHR ?? null)?.hi ?? zone2Ceiling,
                    maxHR, restingHR, goalPace,
                  }))
                ) : null}
              </CoachNoteBlock>
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
                // Conditional primary: once an RPE has been set (either from a
                // previous log or just now via the RPEScale above), elevate the
                // Update log CTA from ghost to moss-filled primary so it reads
                // as the obvious next tap. Gate is `rpe != null` — same state
                // the RPEScale writes via setRpe.
                const isRpeSet = rpe != null
                return (
                  <button
                    onClick={() => isRunType ? setView('complete') : saveCompletion('complete')}
                    style={{
                      flex: 1,
                      background: isRpeSet ? 'var(--moss)' : 'none',
                      color:      isRpeSet ? 'var(--card)' : 'var(--text-muted)',
                      border:     isRpeSet ? 'none'        : '0.5px solid var(--border-col)',
                      borderRadius: '10px',
                      padding: '13px',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '12px',
                      fontWeight: isRpeSet ? 600 : 400,
                      letterSpacing: isRpeSet ? '0.06em' : '0.04em',
                      textTransform: isRpeSet ? 'uppercase' : 'none',
                      cursor: 'pointer',
                      transition: 'background 0.18s ease, color 0.18s ease, letter-spacing 0.18s ease',
                    }}
                  >
                    Update log
                  </button>
                )
              }
              if (!isComplete && !isSkipped) {
                if (isRunType) {
                  return (
                    <>
                      <button onClick={() => setView('complete')} style={{ flex: 1, minWidth: '120px', background: config.color, color: 'var(--card)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                        Match a Strava run
                      </button>
                      <button onClick={() => setShowManualModal(true)} style={{ flex: 1, minWidth: '100px', background: 'var(--card-bg)', color: config.color, border: `0.5px solid ${config.color}40`, borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500 }}>
                        Log manually
                      </button>
                      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                        <button onClick={() => setView('skip')} style={{ flex: 1, background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '10px', padding: '11px', fontFamily: 'var(--font-ui)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                          Skip
                        </button>
                      </div>
                    </>
                  )
                } else {
                  return (
                    <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                      <button onClick={() => saveCompletion('complete')} disabled={saving} style={{ flex: 2, background: config.color, color: 'var(--card)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
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

              {/* RPE — RPEScale shared component */}
              <div style={{ marginBottom: '20px' }}>
                <RPEScale
                  value={rpe}
                  onChange={(n) => { setRpe(n); saveRPEFatigue(n, fatigueTag) }}
                  hint="On an easy run, a 3–4 is what you want."
                />
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
                        style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '10px 18px', minHeight: '44px', borderRadius: '20px', border: `0.5px solid ${isActive ? tagColor : 'var(--border-col)'}`, background: isActive ? `${tagColor}18` : 'transparent', color: isActive ? tagColor : 'var(--text-muted)', cursor: 'pointer', fontWeight: isActive ? 500 : 400, transition: 'all 0.12s' }}>
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
            <button onClick={() => saveCompletion('complete')} disabled={saving} style={{ flex: 2, background: config.color, color: 'var(--card)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
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

      {view === 'skip' && (
        <div style={{ padding: '16px 18px 24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
            Skip it. It'll stay in your log.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer' }}>Back</button>
            <button onClick={() => saveCompletion('skipped')} disabled={saving} style={{ flex: 2, background: 'var(--card-bg)', color: 'var(--text-secondary)', border: '1px solid var(--border-col)', borderRadius: '12px', padding: '14px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Mark as skipped'}
            </button>
          </div>
        </div>
      )}

      {/* Zone education sheet */}
      {zoneSheetOpen && (() => {
        const zone = zoneForSessionType(session.type)
        if (!zone) return null
        const band = sessionHRBand(session.type, restingHR ?? null, maxHR ?? null)
        return <ZoneInfoSheet zoneKey={zone.zone} hrBand={band ? { lo: band.lo, hi: band.hi } : null} onClose={() => setZoneSheetOpen(false)} />
      })()}
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
  // Canonical fields preserved so SessionPopupInner / composer can read them
  // when the session is opened from TodayScreen. Without these, the structured
  // session block doesn't render (composer needs distance_km/duration_mins/label).
  label?: string
  distance_km?: number
  duration_mins?: number
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
  const touchStartY = useRef<number | null>(null)

  function getDotColor(key: string): string | null {
    const s = sessionMap[key]
    if (!s || s.type === 'rest') return null
    const comp = completions[s.key] // use originalDay for completion lookup
    if (comp?.status === 'complete') return 'var(--teal)'
    if (comp?.status === 'skipped') return 'var(--text-muted)'
    return getSessionColor(s.type)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const diffX = touchStartX.current - e.changedTouches[0].clientX
    const diffY = touchStartY.current - e.changedTouches[0].clientY
    touchStartX.current = null
    touchStartY.current = null
    // Only fire week change if horizontal movement dominates — ignore vertical scrolls
    if (Math.abs(diffX) < 60 || Math.abs(diffY) > Math.abs(diffX)) return
    if (diffX > 0 && weekIndex < totalWeeks - 1) onWeekChange(weekIndex + 1)
    if (diffX < 0 && weekIndex > 0) onWeekChange(weekIndex - 1)
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
          style={{ background: 'none', border: 'none', color: weekIndex > 0 ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: weekIndex > 0 ? 'pointer' : 'default', padding: 0, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        ><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Week {weekIndex + 1} of {totalWeeks}
        </span>
        <button
          onClick={() => weekIndex < totalWeeks - 1 && onWeekChange(weekIndex + 1)}
          style={{ background: 'none', border: 'none', color: weekIndex < totalWeeks - 1 ? 'var(--text-secondary)' : 'var(--text-muted)', cursor: weekIndex < totalWeeks - 1 ? 'pointer' : 'default', padding: 0, minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}
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
                  color: isSelected ? 'var(--card)' : isToday ? 'var(--accent)' : dateNum ? 'var(--text-muted)' : 'var(--text-primary)',
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
      // Trigger 4: fatigue accumulation
      if (newTag && ['Heavy', 'Wrecked', 'Cooked'].includes(newTag)) {
        void authedFetch('/api/adjust-plan', { method: 'POST', body: JSON.stringify({}) })
      }
      // Trigger 5: RPE disconnect
      if (newRpe != null && newRpe >= 8 && (sessionType === 'easy' || sessionType === 'long')) {
        void authedFetch('/api/adjust-plan', { method: 'POST', body: JSON.stringify({ rpe: newRpe, sessionType }) })
      }
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
          <button onClick={() => onChange(Math.max(min, value - step))} style={{ width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0, background: 'var(--bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <div style={{ minWidth: '34px', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', flexShrink: 0 }}>
            {pad ? String(value).padStart(2, '0') : value}
          </div>
          <button onClick={() => onChange(Math.min(max, value + step))} style={{ width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0, background: 'var(--bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
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
                      fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '10px 16px', minHeight: '44px',
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

            {/* Vetra response */}
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
              color: reflectResponse ? 'var(--card)' : 'var(--text-muted)',
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
              <button onClick={handleClose} style={{ background: 'var(--bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
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
                  <button onClick={() => setDistWhole(Math.max(0, distWhole - 1))} style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--text-primary)', minWidth: '32px', textAlign: 'center' }}>{distWhole}</span>
                  <button onClick={() => setDistWhole(distWhole + 1)} style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--text-muted)', padding: '0 4px' }}>.</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px 8px' }}>
                  <button onClick={() => setDistDecimal(Math.max(0, distDecimal - 1))} style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--text-primary)', minWidth: '16px', textAlign: 'center' }}>{distDecimal}</span>
                  <button onClick={() => setDistDecimal(Math.min(9, distDecimal + 1))} style={{ width: '44px', height: '44px', borderRadius: '8px', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', color: 'var(--text-primary)', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
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
                color: hasData ? 'var(--card)' : 'var(--teal)',
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

/** Returns the HR string to display for a session, using zoneRules so every
 *  session type gets the same shape ("Zone X · A–B bpm" or "< X bpm" for Z2).
 *  Live Karvonen takes precedence over baked plan strings — stale hr_target
 *  on a regenerated user is the bug, not a feature. */
function getSessionHRDisplay(
  sessionType: string,
  hr_target: string | undefined,
  restingHR: number | null,
  maxHR: number | null,
  zone2Ceiling: number | undefined,
): string | null {
  const band = sessionHRBand(sessionType, restingHR, maxHR)
  if (band) {
    return band.zone.zone === 'Z2' ? `< ${band.hi}` : `${band.lo}–${band.hi}`
  }
  // No HR data — fall back to the baked plan string. Strip "bpm" so callers
  // can append it themselves (every render site adds its own bpm suffix).
  if (hr_target) return hr_target.replace(/\s*bpm\s*$/i, '')
  if ((sessionType === 'easy' || sessionType === 'long' || sessionType === 'recovery' || sessionType === 'run') && zone2Ceiling) {
    return `< ${zone2Ceiling}`
  }
  return null
}

// computeAerobicPace imported from lib/coaching/aerobicPace.ts

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
  // Same shape for every session type: "Zone X". Falls back to the plan's
  // session.zone string if the type isn't in our zone map.
  const hrLabel = zoneForSessionType(session.type)?.label
    ?? (session.zone as string | undefined)
    ?? null
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
    <div onClick={onTap} className="card-primary" style={{
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
              if (flag === 'ok') return <span style={{ ...pill, background: 'var(--teal-soft)', color: 'var(--teal)', border: '0.5px solid var(--teal-dim)' }}>On target</span>
              if (flag === 'watch' || flag === 'flag') return <span style={{ ...pill, background: 'var(--amber-soft)', color: 'var(--amber)', border: '0.5px solid var(--amber-mid)' }}>— Check this</span>
              return <span style={{ ...pill, background: 'var(--teal-soft)', color: 'var(--teal)', border: '0.5px solid var(--teal-dim)' }}>Done</span>
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

// ── ADJUSTMENT BANNER ────────────────────────────────────────────────────

// AdjustmentBanner — now wraps PendingAdjustmentBanner with API call logic.
// State management lives here (and in DashboardClient), UI delegated to the shared component.
function AdjustmentBanner({ adjustment, onConfirmed, onReverted }: {
  adjustment: any
  onConfirmed?: (plan: any) => void
  onReverted?:  (plan: any) => void
}) {
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  async function confirm() {
    setLoading(true)
    try {
      const res  = await authedFetch('/api/confirm-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onConfirmed?.(data.plan)
    } catch { /* keep visible on error */ } finally { setLoading(false) }
  }

  async function revert() {
    setLoading(true)
    try {
      const res  = await authedFetch('/api/revert-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onReverted?.(data.plan)
      setDismissed(true)
    } catch { /* keep visible on error */ } finally { setLoading(false) }
  }

  return (
    <div style={{ margin: '0 0 12px' }}>
      <PendingAdjustmentBanner
        onConfirm={confirm}
        onRevert={revert}
        loading={loading}
      >
        {adjustment.summary}
      </PendingAdjustmentBanner>
    </div>
  )
}

// ── ReshapeScreen ─────────────────────────────────────────────────────────────
// User-initiated plan reshape. Calls /api/adjust-plan with manual:true, shows result.

function ReshapeScreen({ plan: _plan, onBack, onReshapeApplied }: {
  plan: Plan | null
  onBack: () => void
  onReshapeApplied: (plan: any) => void
}) {
  const [status, setStatus]               = useState<'loading' | 'found' | 'clean' | 'error'>('loading')
  const [adjustment, setAdjustment]       = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => { void analyse() }, [])

  async function analyse() {
    setStatus('loading')
    setError(null)
    try {
      const res  = await authedFetch('/api/adjust-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setStatus('error'); return }
      if (data.skipped) { setError('Dynamic adjustments are turned off in your settings.'); setStatus('error'); return }
      if (data.adjustment) { setAdjustment(data.adjustment); setStatus('found') }
      else setStatus('clean')
    } catch { setError('Could not reach the server. Check your connection.'); setStatus('error') }
  }

  async function handleConfirm() {
    if (!adjustment) return
    setActionLoading(true)
    try {
      const res  = await authedFetch('/api/confirm-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onReshapeApplied(data.plan)
    } catch { /* keep visible */ } finally { setActionLoading(false) }
  }

  async function handleDismiss() {
    if (!adjustment) return
    setActionLoading(true)
    try {
      const res = await authedFetch('/api/revert-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adjustment_id: adjustment.id }),
      })
      if (res.ok) onBack()
    } catch { /* keep visible */ } finally { setActionLoading(false) }
  }

  const backBtn = (
    <button onClick={onBack} style={{
      width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-soft)',
      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink)', marginBottom: '20px', flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        {backBtn}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          Plan adjustment
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Reshape plan
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)', lineHeight: 1.5, marginBottom: '28px' }}>
          {status === 'loading' ? 'Checking your recent sessions for adjustment signals.' : 'Here\'s what Vetra found.'}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 24px' }}>
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <style>{`@keyframes vetra-shimmer { 0%,100%{opacity:.3} 50%{opacity:.6} }`}</style>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: '64px', borderRadius: '12px', background: 'var(--line-strong)', animation: 'vetra-shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {status === 'found' && adjustment && (
          <PendingAdjustmentBanner onConfirm={handleConfirm} onRevert={handleDismiss} loading={actionLoading}>
            {adjustment.summary}
          </PendingAdjustmentBanner>
        )}

        {status === 'clean' && (
          <div style={{ background: 'var(--card)', borderRadius: '14px', border: '1px solid var(--line)', padding: '20px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--moss-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3.5 3.5L13 5" stroke="var(--moss)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
              Plan looks good.
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
              No adjustment signals in your recent sessions. Keep going.
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ background: 'var(--warn-bg)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--warn)', marginBottom: '6px' }}>
              Something went wrong.
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coach-ink)', lineHeight: 1.55, marginBottom: '16px' }}>
              {error}
            </div>
            <button onClick={() => void analyse()} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--warn)', background: 'none', color: 'var(--warn)', fontFamily: 'var(--font-ui)', fontSize: '13px', cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        )}
      </div>

      {(status === 'clean' || status === 'error') && (
        <div style={{ flexShrink: 0, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          <button onClick={onBack} style={{ width: '100%', padding: '15px', borderRadius: 'var(--radius-md)', background: 'var(--moss)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--card)' }}>
            Back
          </button>
        </div>
      )}
    </div>
  )
}

function TodayScreen({ plan, weekIndex, onWeekChange, quitDays, smokeTrackerEnabled, daysToRace, raceName, preferredMetric, stravaRuns, allOverrides, overridesReady, onOpenSession, allCompletions, preferredUnits, zone2Ceiling, onManualSaved, restingHR, maxHR, aerobicPace, stravaLoading, firstName, pendingAdjustment, onAdjustmentConfirmed, onAdjustmentReverted, trialDaysLeft, onUpgrade, hasPaidAccess, dailyCoachNote, coachNoteSettled, runAnalysisMap, runAnalysisReady }: {
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
  stravaLoading?: boolean
  firstName?: string
  pendingAdjustment?: any | null
  onAdjustmentConfirmed?: (plan: any) => void
  onAdjustmentReverted?: (plan: any) => void
  trialDaysLeft?: number | null
  onUpgrade?: () => void
  hasPaidAccess?: boolean
  dailyCoachNote?: string | null
  coachNoteSettled?: boolean
  runAnalysisMap?: Record<string, any>
  runAnalysisReady?: boolean
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
  const touchStartY = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const diffX = touchStartX.current - e.changedTouches[0].clientX
    const diffY = touchStartY.current - e.changedTouches[0].clientY
    touchStartX.current = null
    touchStartY.current = null
    // Only fire week change if horizontal movement dominates — ignore vertical scrolls
    if (Math.abs(diffX) < 60 || Math.abs(diffY) > Math.abs(diffX)) return
    if (diffX > 0 && weekIndex < totalWeeks - 1) onWeekChange(weekIndex + 1)
    if (diffX < 0 && weekIndex > 0) onWeekChange(weekIndex - 1)
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
      today: key === todayDow && d.toDateString() === now.toDateString(),
      distance: s?.distance_km ?? parsed.distance,
      duration: s?.duration_mins != null ? fmtDurationMins(s.duration_mins) : parsed.duration,
      // Canonical fields preserved for SessionPopupInner / composer
      label: s?.label ?? undefined,
      distance_km: s?.distance_km ?? undefined,
      duration_mins: s?.duration_mins ?? undefined,
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

  // ── Hero display line builder ────────────────────────────────────────
  // Derives the two-part hero: "[distance]km," (ink) + "[adjective]." (moss)
  // For rest days: "Today, you rest" / "Do nothing." / "It helps."
  // Fatigue-aware: heavy trend on easy sessions → "really slowly"
  function getHeroAdverb(type: string): string {
    if (heavyFatigue && ['easy', 'recovery', 'run'].includes(type)) return 'really slowly'
    const map: Record<string, string> = {
      easy:          'slowly',
      recovery:      'slowly',
      long:          'long and slow',
      quality:       'at tempo',
      tempo:         'at tempo',
      intervals:     'hard',
      hard:          'hard',
      race:          'fast',
      strength:      'with weights',
      'cross-train': 'easy',
      cross:         'easy',
      run:           'slowly',
    }
    return map[type] ?? 'steadily'
  }

  // ── Coaching note headline (plan-derived + fatigue + injury context) ─
  function getPlanCoachNote(): string {
    const phase = (currentWeek as any).phase as string | undefined
    const ws = (currentWeek as any).sessions ?? {}
    const sessionList = Object.values(ws) as any[]
    const hasQuality = sessionList.some(s => s && ['quality','tempo','intervals','hard'].includes(s.type))
    const hasLong    = sessionList.some(s => s && s.type === 'long')
    const injuries   = (plan.meta as any)?.injury_history as string[] | undefined

    // Fatigue context — prepend when there's a heavy trend
    const fatiguePrepend = heavyFatigue ? "Heavy effort showing. " : ""

    // Injury context on long run weeks
    const injuryNote = (() => {
      if (!hasLong || !injuries?.length) return ""
      if (injuries.some(i => i.includes('achilles'))) return " Watch the achilles on the long run."
      if (injuries.some(i => i.includes('knee')))     return " Protect the knee on hills."
      if (injuries.some(i => i.includes('shin')))     return " Easy on the downhills — shin splints risk."
      return ""
    })()

    let base: string
    if (phase === 'taper') base = "Taper week. Back off and trust the work."
    else if (phase === 'peak')  base = "Peak week. You're sharp. Don't add more."
    else if (hasQuality && hasLong) base = "Quality and long run this week. Hard stuff first, long stuff rested."
    else if (hasQuality) base = "Quality session this week. Everything else is recovery."
    else if (hasLong)    base = `Long run week. Keep easy runs genuinely easy.${injuryNote}`
    else base = "Steady week. Execute consistently."

    return fatiguePrepend + base
  }

  // ── Zone discipline (HR-derived, time-weighted) ──────────────────────
  // Show actual % of time spent in the prescribed zone, weighted by run
  // distance. Replaces the earlier binary per-session check on avg_hr,
  // which could pass a run that drifted high but averaged out across
  // walking. Time-weighted matches what the per-session AI analysis says.
  // Sessions without run_analysis data (no Strava/HK HR stream) are
  // excluded from the denominator.
  const completedThisWeek = sessions.filter(s =>
    s.type !== 'rest' && completions[s.key]?.status === 'complete'
  )
  const analysisRows = completedThisWeek
    .map(s => {
      const a = runAnalysisMap?.[s.key]
      if (!a || a.hr_in_zone_pct == null) return null
      return {
        inZone: a.hr_in_zone_pct as number,
        weight: (a.actual_load_km as number | null) ?? 1,
      }
    })
    .filter((v): v is { inZone: number; weight: number } => v !== null)
  const zoneDisciplinePercent = analysisRows.length >= 1
    ? Math.round(
        analysisRows.reduce((s, r) => s + r.inZone * r.weight, 0)
        / analysisRows.reduce((s, r) => s + r.weight, 0)
      )
    : null
  const zoneDisciplineHits = analysisRows.length

  // ── Done sessions for "Done this week" section ───────────────────────
  const doneSessions = sessions.filter(s =>
    s.type !== 'rest' && completions[s.key]?.status === 'complete'
  )
  const skippedSessions = sessions.filter(s =>
    s.type !== 'rest' && completions[s.key]?.status === 'skipped'
  )

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ paddingBottom: '32px' }}>

      {/* ── WORDMARK ROW ─────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 16px 0',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span className="wordmark-today" style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '14px',
          fontWeight: 800,
          color: 'var(--ink)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {BRAND.name.toUpperCase()}
        </span>
        {/* Moss dot with soft halo */}
        <div style={{ position: 'relative', width: '8px', height: '8px', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', inset: '-3px',
            borderRadius: '50%',
            background: 'var(--moss-soft)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: 'var(--moss)',
          }} />
        </div>
      </div>

      {/* ── HERO BLOCK ───────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 0' }}>

        {/* Context row: Week N · hairline · 84 days out */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {weekPhaseLabel ? `${weekPhaseLabel} · ` : ''}Week {weekNum}
          </span>
          <div style={{ flex: 1, height: '1px', background: 'var(--line)' }} />
          {daysToRace > 0 && (
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--moss)',
              letterSpacing: '0.04em',
              background: 'var(--moss-soft)',
              borderRadius: '20px',
              padding: '3px 9px',
            }}>
              {daysToRace} days out
            </span>
          )}
        </div>

        {/* Hero label + display */}
        {showSessionHero && selectedSession ? (
          <>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--mute)',
              marginBottom: '4px',
              lineHeight: 1,
            }}>
              {(() => {
                const h = new Date().getHours()
                const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Evening'
                return firstName ? `${greeting}, ${firstName}` : greeting
              })()}
            </div>
            <div style={{ lineHeight: 1, marginBottom: '16px' }}>
              {selectedSession.distance != null ? (
                <>
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-2.5px',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatDistance(selectedSession.distance, preferredUnits, { exact: selectedSession.type === 'race' })},{' '}
                  </span>
                  <br />
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--moss)',
                    letterSpacing: '-2.5px',
                  }}>
                    {getHeroAdverb(selectedSession.type)}.
                  </span>
                </>
              ) : selectedSession.duration ? (
                <>
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    letterSpacing: '-2.5px',
                  }}>
                    {selectedSession.duration},{' '}
                  </span>
                  <br />
                  <span style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '56px',
                    fontWeight: 800,
                    color: 'var(--moss)',
                    letterSpacing: '-2.5px',
                  }}>
                    {getHeroAdverb(selectedSession.type)}.
                  </span>
                </>
              ) : (
                <span style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '40px',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  letterSpacing: '-1.5px',
                }}>
                  {selectedSession.title}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--mute)',
              marginBottom: '4px',
            }}>
              {(() => {
                const h = new Date().getHours()
                const greeting = h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 17 ? 'Good afternoon' : h >= 17 && h < 22 ? 'Good evening' : 'Evening'
                return firstName ? `${greeting}, ${firstName}` : greeting
              })()}
            </div>
            <div style={{ lineHeight: 1, marginBottom: '16px' }}>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-2.5px',
              }}>
                Do nothing.{' '}
              </span>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--moss)',
                letterSpacing: '-2.5px',
              }}>
                It helps.
              </span>
            </div>
          </>
        )}

        {/* Trial nudge — appears when ≤4 days remain (CoachingPrinciples §15, Option A).
            Calm reminder, not a paywall. The plan stays either way. */}
        {trialDaysLeft != null && trialDaysLeft > 0 && trialDaysLeft <= 4 && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={onUpgrade}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 16px',
                background: 'var(--card)', border: '1px solid var(--line)',
                borderLeft: '3px solid var(--moss)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
                  {trialDaysLeft === 1
                    ? 'One day of full access left.'
                    : `${trialDaysLeft} days of full access left.`}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.4 }}>
                  Plan is yours either way.
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                See plans →
              </span>
            </button>
          </div>
        )}

        {/* Pending adjustment — above coach note, prominent position */}
        {pendingAdjustment && (
          <div style={{ marginBottom: '16px' }}>
            <AdjustmentBanner
              adjustment={pendingAdjustment}
              onConfirmed={onAdjustmentConfirmed}
              onReverted={onAdjustmentReverted}
            />
          </div>
        )}

        {/* Coach note — paid/trial only. Free users see no coach card.
            AI note (cached daily) preferred; rule-based fallback when AI is
            unavailable so paid users always see something.
            While the fetch is in flight (coachNoteSettled = false) we show a
            skeleton so the rule-based copy never flashes before the AI note. */}
        {hasPaidAccess && (() => {
          if (!coachNoteSettled) {
            return (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  background: 'var(--warn-bg)',
                  borderRadius: '14px',
                  padding: '16px 18px',
                }}>
                  <div style={{ height: '8px', width: '48px', background: 'var(--warn)', opacity: 0.25, borderRadius: '4px', marginBottom: '12px' }} />
                  <div style={{ height: '10px', background: 'var(--warn)', opacity: 0.12, borderRadius: '4px', marginBottom: '8px', animation: 'ai-mark-pulse 1.6s ease-in-out infinite' }} />
                  <div style={{ height: '10px', width: '70%', background: 'var(--warn)', opacity: 0.12, borderRadius: '4px', animation: 'ai-mark-pulse 1.6s ease-in-out infinite' }} />
                </div>
              </div>
            )
          }
          const ruleNote = getPlanCoachNote()
          const coachLabel = weekPhaseLabel ?? 'COACH'
          if (dailyCoachNote) {
            return (
              <div style={{ marginBottom: '20px' }}>
                <CoachNoteBlock label={coachLabel} aiGenerated>
                  {dailyCoachNote}
                </CoachNoteBlock>
              </div>
            )
          }
          if (heavyFatigue) {
            return (
              <div style={{ marginBottom: '20px' }}>
                <CoachNoteBlock label="COACH">
                  Heavy trend. {ruleNote ? `${ruleNote} ` : ''}Ease it back today.
                </CoachNoteBlock>
              </div>
            )
          }
          return (
            <div style={{ marginBottom: '20px' }}>
              <CoachNoteBlock label={coachLabel}>
                {ruleNote}
              </CoachNoteBlock>
            </div>
          )
        })()}
      </div>

      {/* ── DATE STRIP ───────────────────────────────────────────────── */}
      <DateStrip
        sessions={sessions}
        completions={completions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        weekIndex={weekIndex}
        totalWeeks={totalWeeks}
        onWeekChange={onWeekChange}
      />

      {/* ── TODAY'S SESSION ──────────────────────────────────────────── */}
      <div style={{ padding: '16px 16px 0' }}>

        {/* Section label */}
        {showSessionHero && selectedSession && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '10px',
                fontWeight: 700,
                color: 'var(--mute)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>
                {selectedSession.today ? "Today's session" : selectedSession.day}
              </span>
              {/* Right metric: zone or type */}
              {(selectedSession.zone || selectedSession.type !== 'rest') && (
                <span style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '10px',
                  color: 'var(--mute-2)',
                }}>
                  {selectedSession.zone ?? getSessionLabel(selectedSession.type)}
                </span>
              )}
            </div>

            {/* Session card.
                Pace fallback chain: plan-baked pace_target → live aerobicPace
                (computed from Strava history) → '—' placeholder while Strava
                runs are still loading and an aerobic pace is expected. The
                placeholder reserves the slot so the detail line doesn't
                reflow when aerobicPace lands a beat later. */}
            {(() => {
              const expectsAerobicPace = (selectedSession.type === 'easy' || selectedSession.type === 'run') && !selectedSession.pace_target
              const paceForDetail = selectedSession.pace_target
                ?? aerobicPace
                ?? (expectsAerobicPace && stravaLoading ? '—' : null)
              return (
            <SessionCard
              type={selectedSession.type}
              name={selectedSession.title}
              detail={[
                selectedSession.zone,
                selectedSession.hr_target,
                paceForDetail,
              ].filter(Boolean).join(' · ') || undefined}
              distanceKm={selectedSession.distance}
              units={preferredUnits}
              durationMin={selectedSession.duration
                ? parseInt(selectedSession.duration)
                : undefined}
              state={
                completions[selectedKey]?.status === 'complete' ? 'done'
                : completions[selectedKey]?.status === 'skipped' ? 'skipped'
                : selectedSession.today ? 'current'
                : 'future'
              }
              completion={completions[selectedKey]?.status === 'complete' ? {
                distanceKm: completions[selectedKey]?.strava_activity_km ?? undefined,
                avgBpm: completions[selectedKey]?.avg_hr ?? undefined,
                viaStrava: !!completions[selectedKey]?.strava_activity_id,
                activityName: completions[selectedKey]?.strava_activity_name ?? undefined,
              } : undefined}
              onClick={() => {
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
              )
            })()}

            {/* Primary CTA — only on today's session if not yet done */}
            {selectedSession.today && !completions[selectedKey]?.status && (
              <button
                onClick={() => {
                  onOpenSession?.({
                    ...selectedSession,
                    rawDate: selectedSession.rawDate.toISOString(),
                    completion: completions[selectedKey],
                    isPast: false,
                    isFuture: false,
                    weekN: weekNum,
                    weekTheme,
                  })
                }}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  padding: '14px',
                  background: 'var(--moss)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--card)',
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                }}
              >
                Log this session
              </button>
            )}

            {/* Manual log — secondary, shown for today or past sessions */}
            {(selectedSession.today || selectedSession.rawDate < now) && (
              <button
                onClick={() => setShowManualLog(true)}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  padding: '10px',
                  background: 'none',
                  border: `1px solid var(--line)`,
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--mute)',
                  letterSpacing: '0.04em',
                  cursor: 'pointer',
                }}
              >
                Log manually
              </button>
            )}
          </>
        )}

        {/* Rest day — show RestDayCard */}
        {!showSessionHero && (
          <RestDayCard
            session={selectedSession}
            nextSession={nextRunSession}
            weekPhase={(currentWeek as any).phase}
            weekType={(currentWeek as any).type}
            fitnessLevel={fitnessLevel}
            firstName={firstName}
          />
        )}

      </div>

      {/* ── ZONE DISCIPLINE CARD ─────────────────────────────────────── */}
      {/* Title flips based on week phase: "is going" while the week is
          still active, "went" once the end-of-week boundary passes. */}
      {(() => {
        const weekStart = parseLocalDate((currentWeek as any).date)
        const weekEnd   = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)
        const weekIsOver = new Date() >= weekEnd
        const weekLabel  = weekIsOver ? 'How this week went' : 'How this week is going'

        // Skeleton path: there are completed runs to score this week, but
        // run_analysis hasn't loaded yet. Render the card shell so the
        // Today screen layout doesn't reflow when the data lands.
        if (!runAnalysisReady && completedThisWeek.length > 0 && zoneDisciplinePercent === null) {
          return (
            <div style={{ padding: '20px 16px 0' }}>
              <RestraintCardSkeleton label={weekLabel} />
            </div>
          )
        }
        if (zoneDisciplinePercent === null) return null
        return (
          <div style={{ padding: '20px 16px 0' }}>
            <RestraintCard
              label={weekLabel}
              percent={zoneDisciplinePercent}
              meta={`across ${zoneDisciplineHits} ${zoneDisciplineHits === 1 ? 'run' : 'runs'}`}
              body={
                <>
                  of your time was spent in{' '}
                  <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>
                    Zone 2
                  </strong>
                  .{' '}
                  {zoneDisciplinePercent >= 80
                    ? "Easy was easy. That's the work."
                    : zoneDisciplinePercent >= 60
                    ? "Mostly on target. Watch the drift on easy days."
                    : "Too much grey-zone running. The fix is slower, not harder."}
                </>
              }
            />
          </div>
        )
      })()}

      {/* ── ZONE SHAPE CARD ─────────────────────────────────────────── */}
      {/* Actual analyses for completed runs in the week. When ≥1 analysed
          run is available, ZoneShapeCard shows actual time-in-zone instead
          of the prescribed shape — honest about what happened, not what
          was planned. */}
      <div style={{ padding: '12px 16px 0' }}>
        <ZoneShapeCard
          sessions={sessions.filter(s => s.type !== 'rest')}
          analyses={completedThisWeek
            .map(s => {
              const a = runAnalysisMap?.[s.key]
              if (!a || a.hr_in_zone_pct == null) return null
              const distKm = (a.actual_load_km as number | null)
                ?? completions[s.key]?.strava_activity_km
                ?? s.distance ?? null
              if (!distKm) return null
              // Estimate minutes from distance — used purely as a weight.
              // ~6.5 min/km is a reasonable easy-pace average; exact value
              // doesn't matter since each row's weight is proportional.
              const durationMins = distKm * 6.5
              return {
                inZonePct:       a.hr_in_zone_pct as number,
                aboveCeilingPct: (a.hr_above_ceiling_pct as number | null) ?? 0,
                belowFloorPct:   (a.hr_below_floor_pct as number | null) ?? 0,
                durationMins,
              }
            })
            .filter((v): v is NonNullable<typeof v> => v !== null)}
        />
      </div>

      {/* ── DONE THIS WEEK ───────────────────────────────────────────── */}
      {(doneSessions.length > 0 || skippedSessions.length > 0) && (
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--mute)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}>
            Done this week
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...doneSessions, ...skippedSessions].map(s => (
              <SessionCard
                key={s.key}
                type={s.type}
                name={s.title}
                distanceKm={completions[s.key]?.strava_activity_km ?? s.distance}
                units={preferredUnits}
                state={completions[s.key]?.status === 'skipped' ? 'skipped' : 'done'}
                completion={{
                  distanceKm: completions[s.key]?.strava_activity_km ?? undefined,
                  avgBpm: completions[s.key]?.avg_hr ?? undefined,
                  viaStrava: !!completions[s.key]?.strava_activity_id,
                  activityName: completions[s.key]?.strava_activity_name ?? undefined,
                }}
                onClick={() => {
                  onOpenSession?.({
                    ...s,
                    rawDate: s.rawDate.toISOString(),
                    completion: completions[s.key],
                    isPast: true,
                    isFuture: false,
                    weekN: weekNum,
                    weekTheme,
                  })
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Strava nudge — muted text link if no runs connected */}
      {stravaRuns.length === 0 && (
        <div style={{
          padding: '20px 16px 0',
          textAlign: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '12px',
            color: 'var(--mute)',
          }}>
            Connect{' '}
            <span style={{ color: 'var(--strava)', fontWeight: 500 }}>Strava</span>
            {' '}in Profile for auto-logging after each run.
          </span>
        </div>
      )}

      {/* Manual log modal */}
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

      {/* Smoke tracker removed per brand-product-alignment v2 */}

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

function PlanScreen({ plan, stravaRuns, allOverrides, allCompletions, onOverrideChange, onOpenSession, overridesReady, preferredUnits = 'km' }: {
  plan: Plan; stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onOpenSession?: (s: any) => void
  overridesReady: boolean
  preferredUnits?: 'km' | 'mi'
}) {
  const currentWeekIndex = getCurrentWeekIndex(plan.weeks)
  const weekNum = currentWeekIndex + 1
  const totalWeeks = plan.weeks.length
  const raceName = (plan as any)?.meta?.race_name ?? ''
  const raceDate = (plan as any)?.meta?.race_date ? new Date((plan as any).meta.race_date) : null
  const raceDateStr = raceDate ? raceDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null
  const daysToRace = raceDate ? Math.max(0, Math.ceil((raceDate.getTime() - Date.now()) / 86400000)) : null

  // Derive done weeks count and deload week numbers from plan
  const doneWeeksCount = (() => {
    let count = 0
    for (let i = 0; i < currentWeekIndex; i++) count++
    return count
  })()
  const deloadWeekNumbers = plan.weeks.reduce<number[]>((acc, wk, i) => {
    const w = wk as any
    if (w.type === 'deload' || w.badge === 'deload') acc.push(i + 1)
    return acc
  }, [])
  const raceWeekNumber = (() => {
    const idx = plan.weeks.findIndex((wk) => (wk as any).type === 'race' || (wk as any).badge === 'race')
    return idx >= 0 ? idx + 1 : undefined
  })()

  // Phase label: "base → build → peak → taper" or from plan phases
  const phaseLabel = (() => {
    const phases = Array.from(new Set(plan.weeks.map((wk) => (wk as any).phase).filter(Boolean)))
    const caps: Record<string, string> = { base: 'base', build: 'build', peak: 'peak', taper: 'taper' }
    return phases.map(p => caps[p] ?? p).join(' → ')
  })()

  return (
    <div style={{ paddingBottom: '32px' }}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <ScreenHeader title="Your plan" />

      {/* ── RACE NAME HEADING ────────────────────────────────────── */}
      {raceName && (
        <div style={{ padding: '0 16px 12px', fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
          {raceName}
        </div>
      )}

      {/* ── PLAN ARC ─────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px 0' }}>
        <PlanArc
          totalWeeks={totalWeeks}
          currentWeek={weekNum}
          doneWeeks={doneWeeksCount}
          deloadWeeks={deloadWeekNumbers}
          raceWeek={raceWeekNumber}
          phaseLabel={phaseLabel || undefined}
        />
      </div>

      {/* ── WEEK SUMMARY ─────────────────────────────────────────── */}
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
        // Week target = sum of rounded session distances, so it agrees with
        // the rounded values displayed on each session row.
        const weeklyKm = sumRoundedDistance(
          SESSION_KEYS.map(k => ws[k]?.distance_km as number | undefined),
          preferredUnits,
        )
        const weekPhase = (wk as any).phase as string | undefined
        const phaseCap = weekPhase ? ({ foundation: 'Foundation Block', base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' }[weekPhase] ?? weekPhase) : null
        return (
          <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {phaseCap && (
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                color: weekPhase === 'foundation' ? 'var(--mute)' : 'var(--moss)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>{phaseCap}</span>
            )}
            {phaseCap && <span style={{ color: 'var(--mute-2)', fontSize: '10px' }}>·</span>}
            {total > 0 && (
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '10px',
                color: done === total && total > 0 ? 'var(--moss)' : 'var(--mute)',
              }}>
                {done}/{total} done
              </span>
            )}
            {total > 0 && weeklyKm > 0 && (
              <span style={{ color: 'var(--mute-2)', fontSize: '10px' }}>·</span>
            )}
            {weeklyKm > 0 && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)' }}>
                {weeklyKm}{preferredUnits} target
              </span>
            )}
          </div>
        )
      })()}

      {/* ── PLAN CALENDAR (existing component, keeps drag-reorder, tap-to-open) ── */}
      <div style={{ paddingTop: '12px' }}>
        <PlanCalendar
          weeks={plan.weeks}
          allOverrides={allOverrides}
          allCompletions={allCompletions}
          onOverrideChange={onOverrideChange}
          overridesReady={overridesReady}
          units={preferredUnits}
          onSessionTap={(session, weekN, weekTheme) => {
            onOpenSession?.({ ...session, weekN, weekTheme })
          }}
        />
      </div>
    </div>
  )
}

// ── PLAN-BASED COACHING ───────────────────────────────────────────────────

function PlanCoachingCard({ plan, currentWeek, units = 'km', trackedKm }: {
  plan: Plan; currentWeek: Week; units?: 'km' | 'mi'; trackedKm?: number | null
}) {
  const sessions = Object.values((currentWeek as any).sessions ?? {}) as any[]
  const runningSessions = sessions.filter(s => s && s.type && s.type !== 'rest' && s.type !== 'strength')
  const hasQuality = sessions.some(s => s && ['quality','tempo','intervals','hard'].includes(s.type))
  const hasLong    = sessions.some(s => s && s.type === 'long')
  const phase      = (currentWeek as any).phase as string | undefined
  const theme      = (currentWeek as any).theme as string | undefined
  // Sum of rounded session distances — agrees with per-row displays.
  const weeklyKm   = sumRoundedDistance(sessions.map(s => s?.distance_km as number | undefined), units)
  const weeksToRace = Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))

  const phaseCap = phase ? ({ foundation: 'Foundation Block', base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper' }[phase] ?? phase) : null

  function getWeekHeadline(): string {
    if (phase === 'foundation') return "Foundation week. Easy only — no effort required."
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

  const doneDisplay = trackedKm != null && trackedKm > 0
    ? `${trackedKm.toFixed(1)}${units} done`
    : null

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Plan notes</span>
        {phaseCap && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {phaseCap}
          </span>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35, marginBottom: theme || items.length > 0 ? '10px' : 0, letterSpacing: '-0.2px' }}>
          {getWeekHeadline()}
        </div>
        {theme && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.6, marginBottom: items.length > 0 ? '12px' : 0, fontStyle: 'italic' }}>
            {theme}
          </div>
        )}
        {items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map((item, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.65 }}>
                {item}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Distance footer — target + done together so the gap is visible */}
      {weeklyKm > 0 && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>
            {weeklyKm}{units} target
          </span>
          {doneDisplay && (
            <>
              <span style={{ color: 'var(--line-strong)', fontSize: '12px' }}>·</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--moss)', fontWeight: 500 }}>
                {doneDisplay}
              </span>
            </>
          )}
          {!doneDisplay && (
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>no runs logged yet</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── COACH SCREEN ──────────────────────────────────────────────────────────

function CoachTeaser({ plan, firstName, onUpgrade }: {
  plan: Plan; firstName?: string; onUpgrade: () => void
}) {
  const weekNum    = getCurrentWeekIndex(plan.weeks) + 1
  const totalWeeks = plan.weeks.length

  return (
    <div>
      <ScreenHeader title="Coach" sub={firstName ? `${firstName} · W${weekNum} of ${totalWeeks}` : `W${weekNum} of ${totalWeeks}`} />
      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Locked Kit identity — dimmed preview of the coach identity card */}
        <div style={{
          background:   'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border:       '1px solid var(--line)',
          borderLeft:   '3px solid var(--moss)',
          padding:      '16px 18px',
          opacity:      0.45,
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <AICoachChip />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
              W{weekNum} of {totalWeeks}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: 0 }}>
            Kit reads your sessions and surfaces what&apos;s worth knowing.
          </p>
        </div>

        {/* Locked report card — mirrors the paid CoachScreen weekly report card anatomy */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-muted)', opacity: 0.3 }} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>This week</span>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '-0.3px', lineHeight: 1.3, marginBottom: '8px', opacity: 0.45 }}>
              Your weekly coaching report.
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, opacity: 0.5 }}>
              Connect Strava and run a few sessions. We'll tell you exactly what's working — and what isn't.
            </p>
          </div>
          {/* Locked stats row */}
          <div style={{ padding: '10px 16px', borderTop: '0.5px solid var(--border-col)', display: 'flex', gap: '16px' }}>
            {(['Zone discipline', 'Load ratio'] as const).map((label) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--text-muted)', opacity: 0.3 }}>—</span>
              </div>
            ))}
          </div>
        </div>

        {/* Teaser card — same left-accent pattern as wizard teaser card */}
        <button
          onClick={onUpgrade}
          style={{
            width: '100%', textAlign: 'left',
            background: 'var(--card-bg)',
            border: '0.5px solid var(--border-col)',
            borderLeft: '3px solid var(--teal)',
            borderRadius: '10px',
            padding: '14px 16px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
              See your zone discipline score
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Weekly report, session feedback, plan adjustments — all from your Strava data.
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--teal)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Upgrade →
          </span>
        </button>

        {/* Locked race projections stub */}
        <button
          onClick={onUpgrade}
          style={{ width: '100%', textAlign: 'left', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', borderRadius: '16px', padding: '16px', cursor: 'pointer' }}
        >
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', opacity: 0.5 }}>
            Race projections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', opacity: 0.25, marginBottom: '12px' }}>
            {(['5K', '10K', 'HM', 'Marathon'] as const).map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '0.5px solid var(--border-col)' : undefined }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>—:——</span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--teal)', fontWeight: 600 }}>
            Upgrade to see your times →
          </div>
        </button>

      </div>
    </div>
  )
}

function CoachScreen({ plan, currentWeek, runs, stravaLoading, stravaConnected, stravaTokenFailed, firstName, weeklyReport, onReportGenerated, preferredUnits = 'km', zoneDisciplinePercent, liveSessionsCompleted, liveSessionsPlanned, phaseSummary, onPhaseSummaryGenerated, raceReadinessNote, onRaceReadinessGenerated, zoneDriftPattern, zoneDriftDismissedAt, onDismissZoneDrift, benchmarkRecalDismissedAt, onDismissRecal, onOpenBenchmark }: {
  plan: Plan; currentWeek: Week; runs: any[] | null; stravaLoading: boolean
  stravaConnected: boolean
  stravaTokenFailed?: boolean; firstName?: string
  weeklyReport?: any | null; onReportGenerated?: (report: any) => void
  preferredUnits?: 'km' | 'mi'
  zoneDisciplinePercent?: number | null
  liveSessionsCompleted?: number
  liveSessionsPlanned?: number
  // R28 phase-end summary + R29 race readiness
  phaseSummary?: { content: string; generated_at: string; phase_ended: string; transition_week_n: number } | null
  onPhaseSummaryGenerated?: (s: { content: string; generated_at: string; phase_ended: string; transition_week_n: number }) => void
  raceReadinessNote?: { content: string; generated_at: string } | null
  onRaceReadinessGenerated?: (n: { content: string; generated_at: string }) => void
  // R30 zone drift pattern
  zoneDriftPattern?: { count: number; total: number } | null
  zoneDriftDismissedAt?: string | null
  onDismissZoneDrift?: () => void
  // R32 recalibration nudge (passed through to RaceTimesCard)
  benchmarkRecalDismissedAt?: string | null
  onDismissRecal?: () => void
  onOpenBenchmark?: () => void
}) {
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [refreshBlocked, setRefreshBlocked] = useState(false)

  const weekNum    = getCurrentWeekIndex(plan.weeks) + 1
  const totalWeeks = plan.weeks.length
  const reportIsCurrent = weeklyReport?.week_n === weekNum
  // Live score from completions (passed in from DashboardClient — requires Strava HR data).
  // Falls back to the most recent report score if no live data is available.
  const currentScore: number | null =
    zoneDisciplinePercent ?? (reportIsCurrent ? (weeklyReport.zone_discipline_score ?? null) : null)
  // If the cached report is from last week, surface it as a reference point
  const lastWeekScore: number | null =
    weeklyReport?.week_n === weekNum - 1 ? (weeklyReport.zone_discipline_score ?? null) : null

  // Tracked km from Strava runs this week
  const trackedKm: number | null = (() => {
    if (!runs?.length) return null
    const weekStart = parseLocalDate((currentWeek as any).date)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const total = runs
      .filter(r => { const d = new Date(r.start_date); return d >= weekStart && d < weekEnd })
      .reduce((sum, r) => sum + (r.distance ?? 0) / 1000, 0)
    return total > 0 ? parseFloat(total.toFixed(1)) : null
  })()

  // Metrics derived from report or defaults
  const loadRatio: number | null       = reportIsCurrent ? (weeklyReport?.acute_chronic_ratio ?? null) : null
  // Sessions count: prefer live values from completions state. The cached
  // weekly_reports row snapshots count at generation time and the route's
  // once-per-day cache cap blocks force-refresh, so the cached value goes
  // stale every time a user logs another run.
  const sessionsCompleted: number | null = liveSessionsCompleted
    ?? (reportIsCurrent ? (weeklyReport?.sessions_completed ?? null) : null)
  const sessionsPlanned: number | null   = liveSessionsPlanned
    ?? (reportIsCurrent ? (weeklyReport?.sessions_planned ?? null) : null)
  const weeksToRace = Math.max(0, Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))

  // ── R28 / R29 detection ─────────────────────────────────────────────────
  const daysToRace = Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / 86_400_000)
  const isRaceWindow = daysToRace >= 0 && daysToRace <= 14

  // Phase transition: compare current week's phase with previous week's phase
  const prevWeek = plan.weeks.find((w: any) => w.n === weekNum - 1)
  const currentPhase: string | null = (currentWeek as any).phase ?? null
  const prevPhase: string | null    = (prevWeek as any)?.phase ?? null
  const phaseJustChanged = !!(currentPhase && prevPhase && currentPhase !== prevPhase)
  const phaseEnded       = phaseJustChanged ? prevPhase! : null
  const transitionWeekN  = phaseJustChanged ? weekNum : null

  // Validate cached phase summary against current transition (stale rows from prior phases are ignored)
  const cachedPhaseSummaryValid =
    phaseSummary?.phase_ended === phaseEnded &&
    phaseSummary?.transition_week_n === transitionWeekN

  // Mutual exclusion: R29 suppresses R28
  const showRaceCard  = isRaceWindow
  const showPhaseCard = phaseJustChanged && !isRaceWindow

  // Local state — pre-seeded from DashboardClient pre-fetch, updated after generation
  const [localPhaseSummary,  setLocalPhaseSummary]  = useState<{ content: string; generated_at: string } | null>(
    cachedPhaseSummaryValid && phaseSummary ? { content: phaseSummary.content, generated_at: phaseSummary.generated_at } : null
  )
  const [localRaceReadiness, setLocalRaceReadiness] = useState<{ content: string; generated_at: string } | null>(
    raceReadinessNote ?? null
  )
  const [specialCardLoading, setSpecialCardLoading] = useState(false)

  // Auto-generate on mount when conditions are met and no cached content exists
  useEffect(() => {
    async function maybeGenerate() {
      if (showRaceCard && !localRaceReadiness) {
        setSpecialCardLoading(true)
        try {
          const res  = await authedFetch('/api/race-readiness', { method: 'POST' })
          if (res.ok) {
            const data = await res.json()
            const note = { content: data.content, generated_at: new Date().toISOString() }
            setLocalRaceReadiness(note)
            onRaceReadinessGenerated?.(note)
          }
        } catch { /* silent */ } finally { setSpecialCardLoading(false) }
      } else if (showPhaseCard && !localPhaseSummary && phaseEnded && transitionWeekN) {
        setSpecialCardLoading(true)
        try {
          const res  = await authedFetch('/api/phase-summary', { method: 'POST', body: JSON.stringify({ phase_ended: phaseEnded, transition_week_n: transitionWeekN }) })
          if (res.ok) {
            const data = await res.json()
            const summary = { content: data.content, generated_at: new Date().toISOString(), phase_ended: phaseEnded!, transition_week_n: transitionWeekN! }
            setLocalPhaseSummary(summary)
            onPhaseSummaryGenerated?.(summary)
          }
        } catch { /* silent */ } finally { setSpecialCardLoading(false) }
      }
    }
    void maybeGenerate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fire once on mount — conditions are stable for the lifetime of this screen

  async function generateReport() {
    setLoading(true)
    setError(null)
    setRefreshBlocked(false)
    try {
      const res  = await authedFetch('/api/weekly-report?force=true', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      if (data.refresh_blocked) {
        setRefreshBlocked(true)
      } else {
        onReportGenerated?.(data.report)
      }
    } catch {
      setError('Could not generate report. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  // ── Score body copy ──────────────────────────────────────────────────────
  function scoreBodyCopy(score: number | null): string {
    if (score === null) {
      // Don't mention Strava if already connected — just need more sessions with HR data
      return runs?.length
        ? "Need at least two sessions with HR data this week to score."
        : "Connect Strava in Profile to start tracking this."
    }
    if (score >= 80) return "Easy was easy. Hard was hard. That's the work."
    if (score >= 60) return "Getting there. A few easy sessions went a bit hard."
    return "Easy days ran too hot. The fix is slower, not harder."
  }

  // ── Load ratio context ──────────────────────────────────────────────────
  function loadRatioContext(ratio: number | null): { label: string; color: string } {
    if (ratio === null) return { label: '—', color: 'var(--mute)' }
    if (ratio >= 1.3)   return { label: 'overloading', color: 'var(--danger)' }
    if (ratio < 0.8)    return { label: 'underloaded', color: 'var(--warn)' }
    return { label: 'balanced', color: 'var(--moss)' }
  }

  // ── Sessions context ────────────────────────────────────────────────────
  function sessionsContext(done: number | null, planned: number | null): { label: string; color: string } {
    if (done === null || planned === null) return { label: '—', color: 'var(--mute)' }
    const behind = planned - done
    if (behind <= 0) return { label: 'complete', color: 'var(--moss)' }
    if (done / planned >= 0.7) return { label: 'on track', color: 'var(--moss)' }
    return { label: `${behind} behind`, color: 'var(--warn)' }
  }

  // ── Weeks to race context ───────────────────────────────────────────────
  function weeksContext(weeks: number): { label: string; color: string } {
    if (weeks === 0) return { label: 'race week', color: 'var(--warn)' }
    if (weeks === 1) return { label: '1 week left', color: 'var(--warn)' }
    return { label: `${weeks} weeks left`, color: 'var(--mute)' }
  }

  const lrc  = loadRatioContext(loadRatio)
  const sc   = sessionsContext(sessionsCompleted, sessionsPlanned)
  const wtrc = weeksContext(weeksToRace)

  const [loadSheetOpen, setLoadSheetOpen] = useState(false)
  const [zoneDisciplineSheetOpen, setZoneDisciplineSheetOpen] = useState(false)

  // ── Option E: first-open coach intro card ───────────────────────────
  // One-time card that sets the user's mental model of the AI coach.
  // Persisted in localStorage so it survives tab changes and reloads.
  const [coachIntroSeen, setCoachIntroSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true // SSR: don't flash
    return localStorage.getItem('zona_coach_intro_seen') === 'true'
  })
  function dismissCoachIntro() {
    if (typeof window !== 'undefined') localStorage.setItem('zona_coach_intro_seen', 'true')
    setCoachIntroSeen(true)
  }

  // ── Dynamic coach headline ──────────────────────────────────────────
  function getCoachHeadline(): string {
    const behind = (sessionsPlanned ?? 0) - (sessionsCompleted ?? 0)
    const name = firstName ? `, ${firstName}` : ''
    if (loadRatio !== null && loadRatio >= 1.3) return `Ease up this week${name}`
    if (sessionsCompleted !== null && sessionsPlanned !== null && behind >= 2) return `Let's catch up${name}`
    if (sessionsCompleted !== null && sessionsPlanned !== null && behind <= 0) return `You're on track${name}`
    return `Here's your week${name}`
  }

  return (
    <div>
      <ScreenHeader title="Your coach" sub={`W${weekNum} of ${totalWeeks}`} />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '32px' }}>

        {/* ── KIT COACH IDENTITY — persistent presence, replaces headline ── */}
        <div style={{
          background:   'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border:       '1px solid var(--line)',
          borderLeft:   '3px solid var(--moss)',
          padding:      '16px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <AICoachChip />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', fontVariantNumeric: 'tabular-nums' }}>
              {sessionsCompleted
                ? `W${weekNum} · ${sessionsCompleted} session${sessionsCompleted !== 1 ? 's' : ''}`
                : `W${weekNum} of ${totalWeeks}`}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: 0 }}>
            {getCoachHeadline()}
          </p>
        </div>

        {/* ── OPTION E: FIRST-OPEN COACH INTRO ────────────────────────── */}
        {/* Shown once to set the user's mental model. localStorage-gated. */}
        {!coachIntroSeen && (
          <div style={{
            background:   'var(--card)',
            borderRadius: 'var(--radius-lg)',
            border:       '1px solid var(--line)',
            borderLeft:   '3px solid var(--moss)',
            padding:      '16px 18px',
          }}>
            <div style={{ marginBottom: '10px' }}>
              <AICoachChip />
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 14px' }}>
              Kit watches your training. Says something when it&apos;s worth saying.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={dismissCoachIntro}
                style={{
                  fontFamily:   'var(--font-ui)',
                  fontSize:     '13px',
                  fontWeight:   600,
                  color:        'var(--moss)',
                  background:   'rgba(107,142,107,0.10)',
                  border:       'none',
                  borderRadius: '20px',
                  padding:      '7px 16px',
                  cursor:       'pointer',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* ── STATS 2×2 GRID ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {([
            {
              label: 'Zone discipline',
              value: currentScore !== null ? `${currentScore}%` : '—',
              sub: scoreBodyCopy(currentScore).split('.')[0],
              subColor: currentScore !== null && currentScore >= 80 ? 'var(--moss)' : currentScore !== null && currentScore >= 60 ? 'var(--ink-2)' : currentScore !== null ? 'var(--warn)' : 'var(--mute)',
              onTap: () => setZoneDisciplineSheetOpen(true),
            },
            {
              label: 'Load ratio',
              value: loadRatio !== null ? `${loadRatio.toFixed(2)}x` : '—',
              sub: lrc.label,
              subColor: lrc.color,
              onTap: () => setLoadSheetOpen(true),
            },
            {
              label: 'Sessions',
              value: sessionsCompleted !== null && sessionsPlanned !== null ? `${sessionsCompleted}/${sessionsPlanned}` : '—',
              sub: sc.label,
              subColor: sc.color,
              onTap: undefined,
            },
            {
              label: 'Weeks left',
              value: weeksToRace > 0 ? String(weeksToRace) : 'Race',
              sub: wtrc.label,
              subColor: wtrc.color,
              onTap: undefined,
            },
          ] as const).map((m) => {
            const inner = (
              <>
                <div className="label-uppercase" style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {m.label}
                  {m.onTap && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', opacity: 0.6 }}>ⓘ</span>}
                </div>
                <div className="num-data" style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.8px', lineHeight: 1, marginBottom: '6px' }}>
                  {m.value}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 500, color: m.subColor, lineHeight: 1.3 }}>
                  {m.sub}
                </div>
              </>
            )
            const cardStyle = { background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px' }
            return m.onTap ? (
              <button key={m.label} onClick={m.onTap} className="card-data" style={{ ...cardStyle, textAlign: 'left', cursor: 'pointer', width: '100%' }}>
                {inner}
              </button>
            ) : (
              <div key={m.label} className="card-data" style={cardStyle}>{inner}</div>
            )
          })}
        </div>

        {/* ── LOAD RATIO SHEET ────────────────────────────────────────── */}
        {loadSheetOpen && (
          <div
            onClick={() => setLoadSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,26,26,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'vetra-fade-in 0.18s ease-out' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '480px', background: 'var(--card)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,0.12)', paddingTop: '8px', maxHeight: '80vh', overflowY: 'auto', animation: 'vetra-slide-up 0.22s ease-out' }}
            >
              <div style={{ width: '36px', height: '4px', background: 'var(--line)', borderRadius: '2px', margin: '6px auto 18px' }} />

              <div style={{ padding: '0 20px 4px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Load ratio
                </div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.15 }}>
                  Your training load balance
                </div>
                {loadRatio !== null && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: lrc.color, marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    {loadRatio.toFixed(2)}x — {lrc.label}
                  </div>
                )}
              </div>

              <div style={{ padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'Compares this week\'s training load to your rolling average over the past four weeks. A ratio of 1.0 means you\'re doing exactly what your body is used to.',
                  'Under 0.8 — you\'re doing less than normal, which is fine for recovery weeks. Between 0.8 and 1.3 is the safe build zone. Above 1.3 means this week is harder than your recent baseline.',
                  'Big spikes in load are where injuries happen and where performance dips. Consistent load, week over week, is how fitness actually builds.',
                ].map((text, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>{text}</div>
                ))}
              </div>

              <div style={{ position: 'sticky', bottom: 0, padding: '14px 20px 20px', background: 'var(--card)', borderTop: '0.5px solid var(--line)', marginTop: '8px' }}>
                <button onClick={() => setLoadSheetOpen(false)} style={{ width: '100%', padding: '12px', background: 'var(--bg-soft)', border: 'none', borderRadius: '10px', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', letterSpacing: '0.04em' }}>
                  Close
                </button>
              </div>
            </div>

            <style>{`
              @keyframes vetra-fade-in { from { opacity: 0 } to { opacity: 1 } }
              @keyframes vetra-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
            `}</style>
          </div>
        )}

        {/* ── ZONE DISCIPLINE SHEET ───────────────────────────────────── */}
        {zoneDisciplineSheetOpen && (
          <div
            onClick={() => setZoneDisciplineSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,26,26,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'vetra-fade-in 0.18s ease-out' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '480px', background: 'var(--card)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,0.12)', paddingTop: '8px', maxHeight: '80vh', overflowY: 'auto', animation: 'vetra-slide-up 0.22s ease-out' }}
            >
              <div style={{ width: '36px', height: '4px', background: 'var(--line)', borderRadius: '2px', margin: '6px auto 18px' }} />

              <div style={{ padding: '0 20px 4px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Zone discipline
                </div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.15 }}>
                  Hitting the prescribed zone
                </div>
                {currentScore !== null && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: currentScore >= 80 ? 'var(--moss)' : currentScore >= 60 ? 'var(--ink-2)' : 'var(--warn)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    {currentScore}% this week
                  </div>
                )}
              </div>

              <div style={{ padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  'Each session in your plan has a prescribed zone — Zone 2 for easy runs, Zone 3 for tempo, Zone 4–5 for intervals. Zone discipline measures how many of your completed sessions actually landed in that zone.',
                  'Running easy days too hard is the most common training mistake. It doesn\'t feel like much in the moment, but it blunts the aerobic benefit and leaves you too tired to push when the hard sessions arrive.',
                  'A score above 80% means easy was easy and hard was hard. That\'s the structure that builds fitness. Below 60% usually means the easy days are drifting into grey-zone territory — hard enough to add fatigue, not hard enough to drive adaptation.',
                ].map((text, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>{text}</div>
                ))}
              </div>

              <div style={{ position: 'sticky', bottom: 0, padding: '14px 20px 20px', background: 'var(--card)', borderTop: '0.5px solid var(--line)', marginTop: '8px' }}>
                <button onClick={() => setZoneDisciplineSheetOpen(false)} style={{ width: '100%', padding: '12px', background: 'var(--bg-soft)', border: 'none', borderRadius: '10px', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', letterSpacing: '0.04em' }}>
                  Close
                </button>
              </div>
            </div>

            <style>{`
              @keyframes vetra-fade-in { from { opacity: 0 } to { opacity: 1 } }
              @keyframes vetra-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
            `}</style>
          </div>
        )}

        {/* ── R29 RACE READINESS — shows daysToRace 0–14, suppresses R28 ── */}
        {showRaceCard && (localRaceReadiness || specialCardLoading) && (
          <div style={{
            background: 'var(--card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--s-race)',
            padding: '16px 18px',
          }}>
            {/* Eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AICoachChip working={specialCardLoading && !localRaceReadiness} />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--s-race)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Race readiness
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
                {daysToRace === 0 ? 'Race day' : `${daysToRace}d to go`}
              </span>
            </div>
            {specialCardLoading && !localRaceReadiness ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[90, 100, 75].map((w, i) => (
                  <div key={i} style={{ height: '13px', background: 'rgba(200,106,42,0.12)', borderRadius: '4px', width: `${w}%` }} />
                ))}
              </div>
            ) : localRaceReadiness ? (
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>
                {localRaceReadiness.content}
              </p>
            ) : null}
          </div>
        )}

        {/* ── R28 PHASE SUMMARY — shows first week of new phase, suppressed by R29 ── */}
        {showPhaseCard && (localPhaseSummary || specialCardLoading) && (
          <div style={{
            background: 'var(--bg-soft)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--moss)',
            padding: '16px 18px',
          }}>
            {/* Eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AICoachChip working={specialCardLoading && !localPhaseSummary} />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                Phase complete
              </span>
            </div>
            {specialCardLoading && !localPhaseSummary ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[85, 100, 70].map((w, i) => (
                  <div key={i} style={{ height: '13px', background: 'rgba(107,142,107,0.12)', borderRadius: '4px', width: `${w}%` }} />
                ))}
              </div>
            ) : localPhaseSummary ? (
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.65, margin: 0 }}>
                {localPhaseSummary.content}
              </p>
            ) : null}
          </div>
        )}

        {/* ── R30 ZONE DRIFT PATTERN — rule-engine, no AI ─────────────── */}
        {/* Suppressed by R29 (race window). 14-day dismiss window checked here. */}
        {(() => {
          if (!zoneDriftPattern || isRaceWindow) return null
          if (zoneDriftDismissedAt) {
            const daysSince = (Date.now() - new Date(zoneDriftDismissedAt).getTime()) / 86_400_000
            if (daysSince <= 14) return null
          }
          return (
            <div style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--line)',
              borderLeft: '3px solid var(--warn)',
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
                  Pattern detected
                </span>
                <button
                  onClick={onDismissZoneDrift}
                  style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400, color: 'var(--mute)', background: 'none', border: 'none', padding: '0', cursor: 'pointer', flexShrink: 0 }}
                >
                  Dismiss
                </button>
              </div>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
                {zoneDriftPattern.count} of your last {zoneDriftPattern.total} easy sessions ran above Zone 2. Easy days running hot limits what the hard sessions can do.
              </p>
            </div>
          )
        })()}

        {/* ── 3. AI WEEKLY REPORT — CoachNoteBlock amber pattern ─────── */}
        <div style={{
          background: 'var(--warn-bg)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
        }}>
          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <AICoachChip working={loading} color="warn" />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
              This week
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--warn)', opacity: 0.6 }}>
              W{weekNum}/{totalWeeks}
            </span>
          </div>

          {/* Strava token failed — inline mention, reconnect via Profile */}
          {stravaTokenFailed && !stravaLoading && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--coach-ink)', opacity: 0.7 }}>
                Strava connection expired. Reconnect in Profile.
              </span>
            </div>
          )}

          {/* Content states */}
          {loading ? (
            /* Loading skeleton */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {[85, 100, 70].map((w, i) => (
                <div
                  key={i}
                  style={{ height: '13px', background: 'rgba(184,133,58,0.18)', borderRadius: '4px', width: `${w}%` }}
                />
              ))}
            </div>
          ) : reportIsCurrent && weeklyReport?.headline ? (
            /* Report content */
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600, color: 'var(--coach-ink)', letterSpacing: '-0.3px', lineHeight: 1.3, marginBottom: weeklyReport.body ? '10px' : 0 }}>
                {weeklyReport.headline}
              </div>
              {weeklyReport.body && (
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coach-ink)', lineHeight: 1.7, margin: 0, marginBottom: weeklyReport.cta ? '12px' : 0 }}>
                  {weeklyReport.body}
                </p>
              )}
              {weeklyReport.cta && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--coach-ink)', lineHeight: 1.5, fontStyle: 'italic', marginBottom: 0 }}>
                  {weeklyReport.cta}
                </div>
              )}
            </div>
          ) : (
            /* No report yet — prompt without nagging */
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--coach-ink)', marginBottom: '8px' }}>
                {weeklyReport && !reportIsCurrent ? "Last week\u2019s report is below." : 'No report yet this week.'}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coach-ink)', lineHeight: 1.6, opacity: 0.75 }}>
                {!runs?.length && !stravaTokenFailed
                  ? 'Connect Strava in Profile to get zone and load data.'
                  : 'Generate a report to see how this week is tracking.'}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: '10px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--danger)', opacity: 0.85 }}>
              {error}
            </div>
          )}

          {/* CTA button — inside the card, state-labelled */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            {refreshBlocked && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>
                Already refreshed today.
              </span>
            )}
            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={generateReport}
                disabled={loading || refreshBlocked}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                  color: 'var(--warn)',
                  background: 'rgba(184,133,58,0.12)',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '8px 16px',
                  cursor: (loading || refreshBlocked) ? 'default' : 'pointer',
                  opacity: (loading || refreshBlocked) ? 0.4 : 1,
                }}
              >
                {loading && <AIMark size={10} color="var(--warn)" working />}
                {loading ? 'Generating' : (reportIsCurrent && weeklyReport?.headline ? 'Refresh' : 'Generate report')}
              </button>
            </div>
          </div>
        </div>

        {/* ── 4. PLAN NOTES — always shown ────────────────────────────── */}
        <PlanCoachingCard plan={plan} currentWeek={currentWeek} units={preferredUnits} trackedKm={trackedKm} />

        {/* ── 5. RACE PROJECTIONS ──────────────────────────────────────── */}
        <RaceTimesCard
          stravaConnected={stravaConnected}
          benchmarkRecalDismissedAt={benchmarkRecalDismissedAt}
          onOpenBenchmark={onOpenBenchmark}
          onDismissRecal={onDismissRecal}
        />

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

// ── PUSH NOTIFICATIONS ROW ────────────────────────────────────────────────

function PushNotificationsRow() {
  const [status, setStatus] = useState<'checking' | 'unsupported' | 'subscribed' | 'denied' | 'idle'>('checking')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function check() {
      // Native: ask the plugin whether iOS already granted permission.
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        try {
          const perm = await PushNotifications.checkPermissions()
          if (perm.receive === 'denied')  { setStatus('denied'); return }
          if (perm.receive === 'granted') { setStatus('subscribed'); return }
          setStatus('idle')
        } catch { setStatus('idle') }
        return
      }

      // Web: rely on the service worker / PushManager check.
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setStatus('unsupported'); return }
      const perm = (Notification as any).permission
      if (perm === 'denied') { setStatus('denied'); return }
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        if (!regs.length) { setStatus('idle'); return }
        const sub = await regs[0].pushManager.getSubscription()
        setStatus(sub ? 'subscribed' : 'idle')
      } catch { setStatus('idle') }
    }
    void check()
  }, [])

  async function enablePush() {
    setLoading(true)
    const { Capacitor } = await import('@capacitor/core')

    // Native iOS path: request permission, register, send the device token
    // returned via the `registration` event up to /api/push/subscribe.
    if (Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const perm = await PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') {
          setStatus('denied')
          return
        }
        // Resolve once APNs hands back a device token (or errors).
        await new Promise<void>((resolve, reject) => {
          let settled = false
          const settle = (fn: () => void) => { if (!settled) { settled = true; fn() } }
          PushNotifications.addListener('registration', async (token) => {
            try {
              await authedFetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'ios', token: token.value }),
              })
              settle(resolve)
            } catch (err) {
              settle(() => reject(err))
            }
          })
          PushNotifications.addListener('registrationError', (err) => {
            settle(() => reject(new Error(err.error)))
          })
          PushNotifications.register().catch((err) => settle(() => reject(err)))
        })
        setStatus('subscribed')
      } catch {
        setStatus('idle')
      } finally {
        setLoading(false)
      }
      return
    }

    // Web path: existing service-worker + VAPID flow.
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setLoading(false); return }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) { setLoading(false); return }
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      await authedFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setStatus('subscribed')
    } catch { setStatus((Notification as any).permission === 'denied' ? 'denied' : 'idle') }
    finally { setLoading(false) }
  }

  if (status === 'checking' || status === 'unsupported') return null

  return (
    <div style={{ margin: '4px 0', background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>Run notifications</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {status === 'subscribed' ? 'Push notifications on' : status === 'denied' ? 'Blocked in device settings' : 'Get notified after each run is analysed'}
          </div>
        </div>
        {status === 'idle' && (
          <button onClick={enablePush} disabled={loading} style={{ background: 'var(--accent)', color: 'var(--card)', border: 'none', borderRadius: '8px', padding: '7px 14px', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Enabling…' : 'Enable'}
          </button>
        )}
        {status === 'subscribed' && (
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />
        )}
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
              background: 'var(--strava)', color: 'var(--card)',
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
          Vetra will read your Strava activities to provide coaching insights. No other data is accessed.
        </div>
      )}
    </div>
  )
}

/**
 * Apple Health connect row — iOS-native only, hidden on web.
 * Mirrors StravaConnectionRow shape; HealthKit auth is plugin-based (no OAuth
 * redirect), so the connect button calls the plugin directly.
 */
function AppleHealthConnectionRow() {
  const [isNative, setIsNative] = useState(false)
  const [connectedAt, setConnectedAt] = useState<string | null | undefined>(undefined)  // undefined = checking
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) { setConnectedAt(null); return }
        setIsNative(true)
      } catch {
        setConnectedAt(null)
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConnectedAt(null); return }
      const { data } = await supabase
        .from('user_settings')
        .select('healthkit_connected_at')
        .eq('id', user.id)
        .single()
      setConnectedAt((data as any)?.healthkit_connected_at ?? null)
    })()
  }, [])

  // Hidden on web
  if (!isNative) return null

  async function connect() {
    setBusy(true)
    try {
      const { requestHealthKitAuth, syncOnAppOpen } = await import('@/lib/health/clientSync')
      const granted = await requestHealthKitAuth()
      if (!granted) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const nowIso = new Date().toISOString()
      await supabase.from('user_settings').upsert({
        id: user.id,
        healthkit_connected_at: nowIso,
        updated_at: nowIso,
      })
      setConnectedAt(nowIso)
      // First sync — best-effort, don't block UI
      void syncOnAppOpen().catch(() => {})
    } catch {
      // Plugin not yet installed (Phase G); button remains in not-connected state
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        healthkit_connected_at: null,
        updated_at: new Date().toISOString(),
      })
      setConnectedAt(null)
    } finally { setBusy(false) }
  }

  const isLoading = connectedAt === undefined
  const connected = !!connectedAt

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(107,142,107,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--moss)' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>Apple Health</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', marginTop: '1px', color: isLoading ? 'var(--text-muted)' : connected ? 'var(--teal)' : 'var(--text-muted)' }}>
              {isLoading ? 'checking...' : connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
        </div>

        {!isLoading && (
          connected ? (
            <button onClick={disconnect} disabled={busy} style={{
              background: 'none', border: '0.5px solid var(--border-col)',
              borderRadius: '8px', padding: '6px 12px',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              color: 'var(--text-muted)', letterSpacing: '0.06em',
              textTransform: 'uppercase', cursor: 'pointer',
              opacity: busy ? 0.6 : 1,
            }}>
              {busy ? 'Saving...' : 'Disconnect'}
            </button>
          ) : (
            <button onClick={connect} disabled={busy} style={{
              background: 'var(--moss)', color: 'var(--card)',
              border: 'none', borderRadius: '8px', padding: '8px 14px',
              fontFamily: 'var(--font-ui)', fontSize: '11px',
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}>
              {busy ? 'Connecting...' : 'Connect'}
            </button>
          )
        )}
      </div>
      {!isLoading && !connected && (
        <div style={{ padding: '0 16px 12px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
          Vetra reads your runs from Apple Health to coach you. Read-only — Vetra never writes to Apple Health.
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
  { zone: 1, name: 'Recovery',  pctMin: 50, pctMax: 60, colour: 'var(--session-recovery)', desc: 'Active recovery · warm-up · cool-down' },
  { zone: 2, name: 'Aerobic',   pctMin: 60, pctMax: 70, colour: 'var(--session-easy)',     desc: 'Aerobic base · conversational · fat burning' },
  { zone: 3, name: 'Tempo',     pctMin: 70, pctMax: 80, colour: 'var(--session-quality)',  desc: 'Comfortably hard · 3-word sentences' },
  { zone: 4, name: 'Threshold', pctMin: 80, pctMax: 90, colour: 'var(--session-race)',     desc: 'Hard · sustained race effort' },
  { zone: 5, name: 'VO₂ Max',  pctMin: 90, pctMax: 100, colour: 'var(--coral)',            desc: 'Maximum effort · short intervals only' },
]

function calculateZones(restingHR: number, maxHR: number) {
  const hrr = maxHR - restingHR
  return ZONE_DEFS.map(d => ({
    ...d,
    minHR: Math.round(restingHR + (d.pctMin / 100) * hrr),
    maxHR: Math.round(restingHR + (d.pctMax / 100) * hrr),
  }))
}

/**
 * Apple Health one-tap prefill button — gated by Capacitor.isNativePlatform().
 * Renders only on iOS native shell (web/PWA users see nothing).
 *
 * The actual HealthKit plugin call lives in lib/health/clientSync.ts, which the
 * iOS native build wires up (Phase G). Until then the dynamic import fails
 * silently and the button is a no-op — no broken behaviour on PWA, no crash.
 */
function AppleHealthPrefillButton({ onPrefill }: { onPrefill: (rhr: number, mhr: number) => void }) {
  const [isNative, setIsNative] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) setIsNative(true)
      } catch {
        // not running in Capacitor — leave hidden
      }
    })()
  }, [])

  if (!isNative) return null

  async function handleClick() {
    setBusy(true)
    setErr(null)
    try {
      const { fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
      const snapshot = await fetchAppleHealthHRSnapshot()
      if (!snapshot) {
        setErr('No data — open Apple Health and let your Watch sync')
        return
      }
      onPrefill(snapshot.restingHR, snapshot.maxHR)
    } catch (e) {
      setErr('Apple Health unavailable')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <button onClick={handleClick} disabled={busy}
        style={{
          width: '100%', padding: '10px',
          background: 'var(--bg)',
          border: '0.5px solid var(--moss)',
          borderRadius: '8px', cursor: busy ? 'wait' : 'pointer',
          fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em',
          color: 'var(--moss)', textAlign: 'center',
        }}>
        {busy ? 'Reading Apple Health…' : 'Use your Apple Health values'}
      </button>
      {err && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'center' }}>
          {err}
        </div>
      )}
    </div>
  )
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
  const [openZone, setOpenZone] = useState<1 | 2 | 3 | 4 | 5 | null>(null)

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

      {/* Header — parallels Race benchmark row: title + sublabel framing */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border-col)' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.55 }}>Heart rate zones</div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
          How hard. Training zones set from your resting and max HR.
        </div>
      </div>

      {/* Editable HR inputs */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border-col)' }}>
        <AppleHealthPrefillButton onPrefill={(r, m) => { setRhr(String(r)); setMhr(String(m)) }} />
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
          {saved ? 'Saved' : 'Save HR data'}
        </button>
      </div>

      {/* Calculated zones — read only */}
      {zones.length > 0 && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* System intro — answers "what are my zones?" before the table answers "what are mine?" */}
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
            color: 'var(--ink-2)', lineHeight: 1.55,
            padding: '4px 2px 10px',
            borderBottom: '0.5px solid var(--border-col)',
            marginBottom: '6px',
          }}>
            Five zones. Most of your running stays in Zone 2 — easy, conversational. Some of it pushes into Zone 3 (tempo) or Zone 4–5 (intervals). The grey middle is where amateurs go to stall. Tap a zone to learn more.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
            Your zones · HRR method
          </div>
          {zones.map(z => (
            <button
              key={z.zone}
              onClick={() => setOpenZone(z.zone as 1 | 2 | 3 | 4 | 5)}
              style={{
                display: 'grid', gridTemplateColumns: '24px 1fr auto',
                alignItems: 'center', gap: '10px',
                padding: '9px 10px', borderRadius: '8px',
                background: 'var(--bg)',
                border: '0.5px solid var(--border-col)',
                cursor: 'pointer', textAlign: 'left',
                width: '100%',
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
            </button>
          ))}
        </div>
      )}

      {/* Zone education sheet — opened by tap on a zone row */}
      {openZone && (() => {
        const z = zones.find(zz => zz.zone === openZone)
        if (!z) return null
        const zoneKey = openZone === 1 ? 'Z1' : openZone === 2 ? 'Z2' : openZone === 3 ? 'Z3' : openZone === 4 ? 'Z4-5' : 'Z5'
        return <ZoneInfoSheet zoneKey={zoneKey} hrBand={{ lo: z.minHR, hi: z.maxHR }} onClose={() => setOpenZone(null)} />
      })()}

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
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setFn(firstName) }, [firstName])
  useEffect(() => { setLn(lastName) }, [lastName])

  // Email is read-only — it's the auth identity, owned by the OAuth provider.
  // Changing it requires a re-verification flow we don't have, so the field
  // is shown for orientation only ("which account am I logged in with?").
  const isDirty = fn !== firstName || ln !== lastName
  const isValid = fn.trim().length > 0 || ln.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    await onSave(fn.trim(), ln.trim(), email)
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
        <input
          type="email"
          value={email}
          readOnly
          tabIndex={-1}
          aria-readonly="true"
          style={{ ...inputStyle, background: 'var(--bg-soft)', color: 'var(--text-muted)', cursor: 'default' }}
        />
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
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save profile'}
      </button>
    </div>
  )
}

// ── ME SCREEN ─────────────────────────────────────────────────────────────

function DeleteAccountScreen({ onBack }: { onBack: () => void }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      const res = await authedFetch('/api/delete-account', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Something went wrong. Try again.')
        setLoading(false)
        return
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      router.replace('/auth/login')
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 8px' }}>
        <button onClick={onBack} style={{ border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--accent-soft)', flexShrink: 0 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px' }}>
          Delete your account
        </div>
      </div>

      <div style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
            Your sessions, plan, and profile will be permanently removed.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            There&apos;s no going back. Your training history, HR data, and account details will be gone for good.
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <div
            onClick={() => setChecked(c => !c)}
            style={{ width: '20px', height: '20px', borderRadius: '5px', border: `1.5px solid ${checked ? 'var(--coral)' : 'var(--border-col)'}`, background: checked ? 'var(--session-intervals-soft)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px', cursor: 'pointer' }}
          >
            {checked && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="var(--coral)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span
            onClick={() => setChecked(c => !c)}
            style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.55, userSelect: 'none' }}
          >
            I understand this can&apos;t be undone
          </span>
        </label>

        {error && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coral)', background: 'var(--session-intervals-soft)', borderRadius: '8px', padding: '10px 14px' }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button
            onClick={handleDelete}
            disabled={!checked || loading}
            style={{ width: '100%', padding: '15px', background: checked && !loading ? 'var(--session-intervals)' : 'var(--session-intervals-soft)', border: 'none', borderRadius: '12px', color: checked && !loading ? 'var(--bg-primary)' : 'var(--coral)', fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, letterSpacing: '0.02em', cursor: checked && !loading ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' }}
          >
            {loading ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MeScreen({ plan, initials, athlete, quitDays, smokeTrackerEnabled, quitDate, onSmokeTrackerChange, resetPhrase, onSaveMental, theme, onThemeChange, isAdmin, onOpenAdmin, preferredUnits, onUnitsChange, preferredMetric, onMetricChange, restingHR, maxHR, onHRChange, firstName, lastName, profileEmail, onProfileChange, onOpenGenerate, onOpenBenchmark, onOpenReshape, onUpgrade, hasPaidAccess, trialDaysLeft, dynamicAdjustmentsEnabled, onDynamicAdjustmentsChange }: {
  plan: Plan; initials: string; athlete: string; quitDays: number | null; smokeTrackerEnabled: boolean; quitDate: string
  onSmokeTrackerChange: (enabled: boolean, date: string) => void
  resetPhrase: string; onSaveMental: (v: string) => void
  theme: 'dark' | 'light' | 'auto'; onThemeChange: (t: 'dark' | 'light' | 'auto') => void
  isAdmin?: boolean; onOpenAdmin?: () => void
  preferredUnits: 'km' | 'mi'; onUnitsChange: (u: 'km' | 'mi') => void
  preferredMetric: 'distance' | 'duration'; onMetricChange: (m: 'distance' | 'duration') => void
  restingHR: number | null; maxHR: number | null; onHRChange: (rhr: number, mhr: number) => void
  firstName: string; lastName: string; profileEmail: string
  onProfileChange: (fn: string, ln: string, em: string) => void
  onOpenGenerate?: () => void
  onOpenBenchmark?: () => void
  onOpenReshape?: () => void
  onUpgrade?: () => void
  hasPaidAccess?: boolean
  trialDaysLeft?: number | null
  dynamicAdjustmentsEnabled?: boolean
  onDynamicAdjustmentsChange?: (enabled: boolean) => void
}) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<'main' | 'quit' | 'mental' | 'fueling' | 'delete-account'>('main')

  const raceDistKm = plan?.meta?.race_distance_km ?? 0
  const raceNm     = plan?.meta?.race_name ?? ''
  const charity    = plan?.meta?.charity ?? ''

  if (activeSection === 'quit')           return <QuitTab    quitDays={quitDays} raceDistanceKm={raceDistKm} onBack={() => setActiveSection('main')} />
  if (activeSection === 'mental')         return <MentalTab  resetPhrase={resetPhrase} onSave={onSaveMental} onBack={() => setActiveSection('main')} raceDistanceKm={raceDistKm} raceName={raceNm} charity={charity} />
  if (activeSection === 'fueling')        return <FuelingTab onBack={() => setActiveSection('main')} />
  if (activeSection === 'delete-account') return <DeleteAccountScreen onBack={() => setActiveSection('main')} />

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

  // Tier label: Trial / Pro / Free
  const tierLabel = hasPaidAccess
    ? ((trialDaysLeft ?? 0) > 0 ? 'Trial' : 'Pro')
    : 'Free'

  // Plan progress for read-only training section
  const currentWeekIndex = getCurrentWeekIndex(plan.weeks)
  const weekNum    = currentWeekIndex + 1
  const totalWeeks = plan.weeks.length
  const raceDateFormatted = plan?.meta?.race_date
    ? new Date(plan.meta.race_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto' }}>

      {/* Header — tab destination, no back button */}
      <ScreenHeader title="Your profile" />

      <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px' }}>

        {/* Identity card — avatar + name + tier */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', padding: '16px', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--moss)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-brand)', fontSize: '16px', fontWeight: 600, color: 'var(--card)', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[firstName, lastName].filter(Boolean).join(' ') || 'Your name'}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '3px' }}>
              {tierLabel}
            </div>
          </div>
        </div>

        {/* ── Your profile ───────────────────────────────────────── */}
        <SectionLabel>Your profile</SectionLabel>
        <ProfileSection firstName={firstName} lastName={lastName} email={profileEmail} onSave={onProfileChange} />

        {/* ── Your training ──────────────────────────────────────── */}
        {/* Plan · HR data · display preferences — everything that shapes session cards */}
        <SectionLabel>Your training</SectionLabel>

        {/* Read-only plan overview */}
        {hasPlan && (
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {[
              { label: 'Current race', value: plan.meta.race_name },
              { label: 'Race date',    value: raceDateFormatted ?? '—' },
              { label: 'Plan',         value: `W${weekNum} of ${totalWeeks}` },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : undefined }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Plan + benchmark actions */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
          <button
            onClick={onOpenGenerate}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-col)', cursor: 'pointer', textAlign: 'left' }}
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
          <button
            onClick={onOpenBenchmark}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.55 }}>Race benchmark</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                How fast. Pace targets calibrated from a recent race.
              </div>
            </div>
            <div style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>{chevron}</div>
          </button>
        </div>

        {!hrConfigured && (
          <div style={{ background: 'var(--amber-soft)', borderRadius: '10px', border: '0.5px solid var(--amber-mid)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--amber)', lineHeight: 1.5 }}>
              Set your resting and max HR below to see your training zones.
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
        {/* Apple Health (iOS) is the primary v1 data source — runs, RHR, HRV, sleep, VO2 max.
            Strava remains an optional secondary import. */}
        <SectionLabel>Connections</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <AppleHealthConnectionRow />
          <StravaConnectionRow />
        </div>
        {hasPaidAccess && <PushNotificationsRow />}

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

        {/* ── Training intelligence (paid/trial only) ──────────── */}
        {hasPaidAccess && onDynamicAdjustmentsChange && (
          <>
            <SectionLabel>Training intelligence</SectionLabel>
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
              {/* Reshape plan — manual trigger. Free users see upgrade prompt. */}
              <button
                onClick={hasPaidAccess ? onOpenReshape : onUpgrade}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-col)', cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4, marginBottom: '2px' }}>Reshape plan</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {hasPaidAccess
                      ? 'Check your recent sessions for adjustment signals now'
                      : 'Reshape needs Premium. The plan you have keeps running.'}
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', marginLeft: '12px' }}>{chevron}</div>
              </button>
              {/* Dynamic adjustments toggle */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '2px' }}>Auto-adjust</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {/* TODO: brand voice review — sentences referencing the product name may benefit from rewording in a follow-up content polish pass. */}
                    {dynamicAdjustmentsEnabled
                      ? 'Vetra suggests plan changes based on your Strava data.'
                      : 'Plan stays fixed. Vetra tracks data but won\'t suggest changes.'}
                  </div>
                </div>
                <button
                  onClick={() => onDynamicAdjustmentsChange(!dynamicAdjustmentsEnabled)}
                  style={{
                    width: '44px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                    background: dynamicAdjustmentsEnabled ? 'var(--accent)' : 'var(--border-col)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                  aria-label="Toggle dynamic adjustments"
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: dynamicAdjustmentsEnabled ? '21px' : '3px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s',
                  }} />
                </button>
              </div>
            </div>
          </>
        )}

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

        {/* ── Careful Now — destructive account actions ───────── */}
        <SectionLabel>Careful Now</SectionLabel>
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.replace('/auth/login')
            }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-col)', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Sign out</span>
          </button>
          <button
            onClick={() => setActiveSection('delete-account')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>Delete account</span>
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
        <button onClick={onBack} style={{ border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--accent-soft)' }}>
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

// ── RUN FEEDBACK CARD ─────────────────────────────────────────────────────

// Verdict → colour token + Vetra-voice headline. Single source of truth for run-feedback voice.
// Maps both legacy verdict names (nailed/close/off_target/concerning) and engine names
// (strong/good/ok/drifted/hard) to keep the surface stable across rule-engine versions.
function getVerdictVoice(verdict: string): { accent: string; headline: string } {
  switch (verdict) {
    case 'nailed':
    case 'strong':
      return { accent: 'var(--moss)', headline: "There it is. Don't ruin it." }
    case 'good':
      return { accent: 'var(--moss)', headline: 'Kept it under control. Bank it.' }
    case 'close':
      return { accent: 'var(--moss)', headline: 'Close. Bit of fine-tuning to do.' }
    case 'ok':
      return { accent: 'var(--warn)', headline: "Logged. Worth a look at zones." }
    case 'off_target':
    case 'drifted':
      return { accent: 'var(--warn)', headline: "Drifted off plan. Worth knowing why." }
    case 'concerning':
    case 'hard':
      return { accent: 'var(--warn)', headline: "Bit hot in there. Have a look." }
    default:
      return { accent: 'var(--mute)', headline: 'Logged.' }
  }
}

// Loading-state sibling of RunFeedbackCard — shown while analyse-run is in flight.
// Uses the AIMark pulse instead of a spinner (per ui-patterns.md § AIMark).
function PendingAnalysisCard() {
  return (
    <div style={{
      marginTop: '12px',
      background: 'var(--warn-bg)',
      borderRadius: '14px',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
        <AIMark size={10} color="var(--warn)" working />
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>
          Coach · Working
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400,
        color: 'var(--coach-ink)', lineHeight: 1.55,
        marginBottom: '16px',
      }}>
        Analysing your run — usually takes 15–30 seconds.
      </div>
      {/* Skeleton metric row — hint at what's coming */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {['HR', 'Distance', 'Pace', 'Efficiency'].map(label => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
              color: 'var(--warn)', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '6px',
            }}>{label}</div>
            <div style={{
              height: '3px', background: 'rgba(61,38,0,0.12)', borderRadius: '2px',
              animation: 'ai-mark-pulse 1.6s ease-in-out infinite',
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Shown for free users on completed sessions — communicates the value of
// coaching without exposing any actual coaching data (INV-GATE-005).
function LockedCoachingPreview({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <div style={{
      marginTop: '12px',
      background: 'var(--bg-soft)',
      borderRadius: '14px',
      padding: '16px 18px',
      border: '1px solid var(--line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
        <AIMark size={10} color="var(--mute)" />
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>
          Coach
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
        color: 'var(--mute)', lineHeight: 1.55, marginBottom: '14px',
      }}>
        Your coaching appears here. Connect Strava or Apple Health to unlock it.
      </div>
      {onUpgrade && (
        <button onClick={onUpgrade} style={{
          fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
          color: 'var(--moss)', background: 'none', border: 'none',
          padding: 0, cursor: 'pointer',
        }}>
          Unlock coaching →
        </button>
      )}
    </div>
  )
}

// Shown when polling gives up after ~40s — keeps the card slot visible
// with a calm fallback rather than silently disappearing.
function GaveUpCard() {
  return (
    <div style={{
      marginTop: '12px',
      background: 'var(--bg-soft)',
      borderRadius: '14px',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
        <AIMark size={10} color="var(--mute)" />
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.14em',
        }}>
          Coach
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
        color: 'var(--mute)', lineHeight: 1.55,
      }}>
        Taking longer than usual. Check back in a few minutes.
      </div>
    </div>
  )
}

/** One-line explanation per sub-score, derived from analysis row data. */
function buildScoreExplanations(
  analysis: any,
  paceTarget: string | null,
  actualAvgSpeedMs: number | null,
): { label: string; value: number | undefined; line: string }[] {
  // HR
  const inZone = analysis.hr_in_zone_pct as number | null | undefined
  const above  = analysis.hr_above_ceiling_pct as number | null | undefined
  const below  = analysis.hr_below_floor_pct as number | null | undefined
  let hrLine: string
  if (inZone === null || inZone === undefined) {
    hrLine = 'No HR data.'
  } else {
    const inZoneText = `${Math.round(inZone)}% in zone`
    if (above != null && above > 10) {
      hrLine = `${inZoneText}, ${Math.round(above)}% above ceiling.`
    } else if (below != null && below > 15) {
      hrLine = `${inZoneText}, ${Math.round(below)}% below floor.`
    } else {
      hrLine = `${inZoneText}.`
    }
  }

  // Distance
  const planned = analysis.planned_load_km as number | null | undefined
  const actual  = analysis.actual_load_km  as number | null | undefined
  let distLine: string
  if (planned == null || actual == null) {
    distLine = 'No distance data.'
  } else if (Math.abs(actual - planned) < 0.3) {
    distLine = `Hit the planned distance — ${actual.toFixed(1)}km.`
  } else if (actual > planned) {
    distLine = `Planned ${planned.toFixed(1)}km, ran ${actual.toFixed(1)}km.`
  } else {
    distLine = `Planned ${planned.toFixed(1)}km, ran ${actual.toFixed(1)}km — short.`
  }

  // Pace
  let paceLine: string
  if (paceTarget && actualAvgSpeedMs && actualAvgSpeedMs > 0) {
    const sec = 1000 / actualAvgSpeedMs
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    paceLine = `Target ${paceTarget}, ran ${m}:${String(s).padStart(2, '0')}/km.`
  } else if (paceTarget) {
    paceLine = `Target ${paceTarget}.`
  } else if (analysis.pace_score != null) {
    if (analysis.pace_score >= 80)      paceLine = 'On target.'
    else if (analysis.pace_score >= 60) paceLine = 'Slightly off target.'
    else                                paceLine = 'Off target.'
  } else {
    paceLine = 'No pace data.'
  }

  // Efficiency
  const trend = analysis.ef_trend_pct as number | null | undefined
  let efLine: string
  if (trend == null) {
    efLine = 'No baseline yet — need a few similar runs.'
  } else if (trend >= 0) {
    efLine = `${trend.toFixed(1)}% above your baseline.`
  } else {
    efLine = `${Math.abs(trend).toFixed(1)}% below your baseline.`
  }

  return [
    { label: 'HR',         value: analysis.hr_discipline_score, line: hrLine },
    { label: 'Distance',   value: analysis.distance_score,      line: distLine },
    { label: 'Pace',       value: analysis.pace_score,          line: paceLine },
    { label: 'Efficiency', value: analysis.ef_score,            line: efLine },
  ]
}

/** Bar verdict label — bands aligned to VERDICT_BANDS in lib/coaching/constants.ts. */
function scoreBandLabel(value: number): string {
  if (value >= 80) return 'On target'
  if (value >= 60) return 'Close'
  if (value >= 40) return 'Slightly off'
  return 'Off target'
}

function RunFeedbackCard({
  analysis,
  paceTarget = null,
  actualAvgSpeedMs = null,
}: {
  analysis: any
  paceTarget?: string | null
  actualAvgSpeedMs?: number | null
}) {
  const verdict    = analysis.verdict as string
  const score      = analysis.total_score as number | null
  const feedback   = analysis.feedback_text as string | null
  const isManual   = (analysis.source as string | undefined) === 'manual'
  const voice      = getVerdictVoice(verdict)
  const [expanded, setExpanded] = useState(false)
  const explanations = buildScoreExplanations(analysis, paceTarget, actualAvgSpeedMs)

  const metrics: { label: string; value: number | undefined }[] = [
    { label: 'HR',         value: analysis.hr_discipline_score },
    { label: 'Distance',   value: analysis.distance_score },
    { label: 'Pace',       value: analysis.pace_score },
    { label: 'Efficiency', value: analysis.ef_score },
  ]

  return (
    <div style={{
      marginTop: '12px',
      background: 'var(--warn-bg)',
      borderRadius: '14px',
      padding: '16px 18px',
    }}>
      {/* Eyebrow — matches CoachNoteBlock exactly; score chip hidden for manual rows */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.14em', lineHeight: 1,
        }}>
          <AIMark size={10} color="var(--warn)" />
          Coach
        </span>
        {!isManual && score !== null && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Hide score breakdown' : 'Show score breakdown'}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              padding: '2px 4px',
              margin: '-2px -4px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600,
              color: 'var(--coach-ink)', opacity: 0.5,
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
            }}
          >
            {score}/100
            <span style={{
              fontSize: '9px',
              display: 'inline-block',
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.18s',
            }}>▾</span>
          </button>
        )}
      </div>

      {/* Vetra-voice headline */}
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
        color: 'var(--coach-ink)', letterSpacing: '-0.1px', lineHeight: 1.4,
        marginBottom: feedback ? '8px' : '14px',
      }}>
        {voice.headline}
      </div>

      {/* AI feedback paragraph */}
      {feedback && (
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
          color: 'var(--coach-ink)', lineHeight: 1.55,
          marginBottom: '14px',
        }}>
          {feedback}
        </div>
      )}

      {/* Metric quartet — hidden for manual rows (no activity data to score) */}
      {!isManual && <div style={{ display: 'flex', gap: '10px' }}>
        {metrics.map(({ label, value }) => value !== undefined && (
          <div key={label} style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
              color: 'var(--warn)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '4px',
            }}>
              {label}
            </div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 700,
              color: 'var(--coach-ink)', fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.5px', marginBottom: '6px',
            }}>
              {value}
            </div>
            <div style={{
              height: '3px', background: 'rgba(61,38,0,0.12)', borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${value}%`,
                background: value >= 80 ? 'var(--moss)' : 'var(--warn)',
                opacity: value >= 80 ? 0.8 : value >= 60 ? 0.55 : 1,
                borderRadius: '2px',
                transition: 'width 0.4s ease',
              }} />
            </div>
            {/* Verbal backup for the bar colour */}
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
              color: 'var(--warn)', opacity: 0.7,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              marginTop: '5px',
            }}>
              {scoreBandLabel(value)}
            </div>
          </div>
        ))}
      </div>}

      {/* Expanded breakdown — one line per sub-score, derived from analysis row */}
      {!isManual && expanded && (
        <div style={{
          marginTop: '14px',
          paddingTop: '14px',
          borderTop: '1px solid rgba(61,38,0,0.10)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {explanations.map(({ label, value, line }) => value !== undefined && (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                color: 'var(--warn)', opacity: 0.7,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                width: '78px', flexShrink: 0,
              }}>
                {label}
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400,
                color: 'var(--coach-ink)', lineHeight: 1.45,
              }}>
                {line}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SessionScreen({ session, preloadedRuns, onBack, onSaved, preferredUnits, zone2Ceiling, preferredMetric, restingHR, maxHR, aerobicPace, stravaLoading, runAnalysis, hasPaidAccess, onUpgrade, goalPace, guidance, nextSession }: {
  session: any; preloadedRuns: any[]; onBack: () => void; onSaved?: () => void
  preferredUnits?: 'km' | 'mi'; zone2Ceiling?: number; preferredMetric?: 'distance' | 'duration'
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
  stravaLoading?: boolean
  runAnalysis?: any | null; hasPaidAccess?: boolean; onUpgrade?: () => void
  goalPace?: string | null
  guidance?: any | null
  /** Next scheduled session in the plan — shown as an "Up next" row below the feedback card. */
  nextSession?: { type: string; day: string; distanceKm?: number | null; label?: string | null } | null
}) {
  const color = getSessionColor(session.type ?? 'easy')
  const typeLabel = getSessionLabel(session.type ?? 'easy')
  // Date display: "Tuesday · Week 14"
  const weekEyebrow = session.weekN ? `Week ${session.weekN}` : ''
  const dayEyebrow  = session.day ?? ''

  // Local analysis state — seeded from prop, then polled if a Strava activity
  // is linked but analysis hasn't landed yet (analyse-run runs in background
  // ~15–30s after manual link including AI call).
  const supabase = createClient()
  const [analysis, setAnalysis] = useState<any | null>(runAnalysis ?? null)
  useEffect(() => { setAnalysis(runAnalysis ?? null) }, [runAnalysis])

  // HealthKit-primary, Strava-secondary. A session counts as "linked" if either
  // sibling ref is present on the completion row. Truthy gates the narrative;
  // exact ID values are only used downstream for source-specific lookups.
  const linkedActivityId  = session.completion?.apple_health_uuid ?? session.completion?.strava_activity_id ?? null
  const sessionDay        = session.key as string | undefined
  const isAnalysisPending = !!hasPaidAccess && !!linkedActivityId && !analysis
  const [pollGaveUp, setPollGaveUp] = useState(false)
  const [unlinkConfirm, setUnlinkConfirm] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const isComplete = session.completion?.status === 'complete'

  async function handleUnlink() {
    setUnlinking(true)
    try {
      await authedFetch('/api/strava/unlink-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_n: session.weekN, session_day: session.key }),
      })
      setAnalysis(null)
      setUnlinkConfirm(false)
      onSaved?.()
    } catch {} finally { setUnlinking(false) }
  }

  useEffect(() => {
    if (!isAnalysisPending || !sessionDay) return
    setPollGaveUp(false)
    let cancelled = false
    let attempts  = 0
    const tick = async () => {
      if (cancelled) return
      attempts++
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('run_analysis')
          .select('session_day, source, verdict, total_score, feedback_text, hr_in_zone_pct, ef_trend_pct, hr_discipline_score, distance_score, pace_score, ef_score')
          .eq('user_id', user.id)
          .eq('session_day', sessionDay)
          .maybeSingle()
        if (!cancelled && data) {
          setAnalysis(data)
          return
        }
      } catch {}
      if (!cancelled && attempts < 16) {
        setTimeout(tick, 2500)  // up to ~40s
      } else if (!cancelled) {
        setPollGaveUp(true)
      }
    }
    const initial = setTimeout(tick, 2500)
    return () => { cancelled = true; clearTimeout(initial) }
  }, [isAnalysisPending, sessionDay])
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', paddingBottom: '120px' }}>

      {/* ── HEADER ROW ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px 12px',
        borderBottom: `1px solid var(--line)`,
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
      }}>
        <button onClick={onBack} style={{
          border: 'none', cursor: 'pointer', padding: '0',
          width: '44px', height: '44px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', background: 'var(--bg-soft)',
          color: 'var(--ink)',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11.5 3.5L6 9L11.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Eyebrow + title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600,
            color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '2px',
          }}>
            {[dayEyebrow, weekEyebrow].filter(Boolean).join(' · ')}
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 700,
            color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {session.title}
          </div>
        </div>

        {/* Session type chip — right aligned */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color, textTransform: 'uppercase', letterSpacing: '0.08em',
          background: `${color}18`, borderRadius: '100px', padding: '4px 10px',
          flexShrink: 0,
        }}>
          {typeLabel.split(' ')[0]}
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────── */}
      <div style={{ padding: '0 16px' }}>
        {/* Run analysis sits at the top for completed sessions — the headline
            content. Pending state shows AIMark working pulse while analyse-run
            is in flight; real card replaces it when run_analysis lands. */}
        {hasPaidAccess && linkedActivityId && analysis && (() => {
          // Look up the linked Strava activity in preloadedRuns to surface its
          // avg_speed for the Pace explanation. Activity ID lives on the
          // analysis row; preloadedRuns is the StravaActivity[] already prefetched.
          const linkedAct = Array.isArray(preloadedRuns)
            ? preloadedRuns.find((r: any) => r.id === analysis.strava_activity_id)
            : null
          // HealthKit provenance label — shown when the session was auto-matched
          // from Apple Health rather than Strava. Uses strava_activity_km from
          // the completion row (populated by autoMatchAndAnalyse for both sources).
          const isHealthKitSource = !!session.completion?.apple_health_uuid
          const actKm = session.completion?.strava_activity_km
          return (
            <>
              {isHealthKitSource && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  marginBottom: '8px',
                  fontFamily: 'var(--font-ui)', fontSize: '11px',
                  color: 'var(--mute)', letterSpacing: '0.02em',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" fill="var(--mute)" opacity="0.5"/>
                  </svg>
                  Apple Health{actKm ? ` · ${actKm}km` : ''}
                </div>
              )}
              <RunFeedbackCard
                analysis={analysis}
                paceTarget={session.pace_target ?? null}
                actualAvgSpeedMs={linkedAct?.average_speed ?? null}
              />
              {/* Unlink — only shown when an activity is actually linked (not manual rows) */}
              {analysis.source !== 'manual' && <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!unlinkConfirm && (
                  <button
                    onClick={() => setUnlinkConfirm(true)}
                    style={{
                      fontFamily: 'var(--font-ui)', fontSize: '11px',
                      color: 'var(--mute)', background: 'none', border: 'none',
                      padding: 0, cursor: 'pointer', textDecoration: 'underline',
                      textDecorationColor: 'var(--line)',
                    }}
                  >
                    Unlink this run
                  </button>
                )}
                {unlinkConfirm && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
                      Unlink this run?
                    </span>
                    <button
                      onClick={handleUnlink}
                      disabled={unlinking}
                      style={{
                        fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600,
                        color: 'var(--danger)', background: 'none', border: 'none',
                        padding: 0, cursor: unlinking ? 'default' : 'pointer',
                      }}
                    >
                      {unlinking ? 'Unlinking…' : 'Yes, unlink'}
                    </button>
                    <button
                      onClick={() => setUnlinkConfirm(false)}
                      style={{
                        fontFamily: 'var(--font-ui)', fontSize: '11px',
                        color: 'var(--mute)', background: 'none', border: 'none',
                        padding: 0, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>}
            </>
          )
        })()}
        {hasPaidAccess && !analysis && isAnalysisPending && !pollGaveUp && <PendingAnalysisCard />}
        {hasPaidAccess && !analysis && isAnalysisPending && pollGaveUp && <GaveUpCard />}

        {/* Locked coaching preview — free users who have completed the session */}
        {!hasPaidAccess && isComplete && session.type !== 'rest' && session.type !== 'strength' && (
          <LockedCoachingPreview onUpgrade={onUpgrade} />
        )}

        {/* Up next — next scheduled session in the week, shown below the feedback card */}
        {nextSession && (hasPaidAccess || isComplete) && (
          <div style={{
            marginTop: '8px', marginBottom: '4px',
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg-soft)', borderRadius: '10px',
          }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: getSessionColor(nextSession.type), flexShrink: 0,
            }} />
            <div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom: '2px',
              }}>Up next</div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)',
              }}>
                {nextSession.day} · {getSessionLabel(nextSession.type)}{nextSession.distanceKm ? ` · ${nextSession.distanceKm}km` : ''}
              </div>
            </div>
          </div>
        )}

        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid var(--line)`,
          borderLeft: `3px solid ${color}`,
          marginTop: '12px',
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
            stravaLoading={stravaLoading}
            hasPaidAccess={hasPaidAccess}
            onUpgrade={onUpgrade}
            goalPace={goalPace}
            guidance={guidance}
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
