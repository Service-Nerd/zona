'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { Plan, Week } from '@/types/plan'
import PlanChart from '@/components/training/PlanChart'
import PlanCalendar from '@/components/training/PlanCalendar'
import ReflectionInput from '@/components/training/ReflectionInput'
// Calendar screen retired — CalendarOverlay.tsx renamed to .old.tsx (brand-product-alignment v2)
import StravaPanel from '@/components/strava/StravaPanel'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'
import AdjustmentDiff from '@/components/shared/AdjustmentDiff'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { fetchPlanFromUrl, fetchPlanForUser, savePlanForUser, DEFAULT_GIST_URL, EMPTY_PLAN, getCurrentWeek, getCurrentWeekIndex, isDatePastWeek, parseLocalDate } from '@/lib/plan'
import { resolveEffectiveSessions } from '@/lib/plan/effectiveSessions'
import { easyPaceAsCeiling } from '@/lib/plan/easyPaceCeiling'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { isLongRun, coachingSessionType } from '@/lib/plan/sessionRole'
import { daysDueByEndOfYesterday } from '@/lib/coaching/dayBoundary'
import { SESSION_COLORS, SESSION_LABELS, getSessionColor, getSessionLabel } from '@/lib/session-types'
import { isTrialActive, TRIAL_DAYS } from '@/lib/trial'
import { getCoachingFlag, type CoachingFlag } from '@/lib/coaching/coachingFlag'
import { computeAerobicPace } from '@/lib/coaching/aerobicPace'
import { BRAND, PRICING } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import PendingAdjustmentBanner from '@/components/shared/PendingAdjustmentBanner'
import ZoneRings, { ZoneRingsSkeleton } from '@/components/shared/ZoneRings'
import { TextField } from '@/components/shared/TextField'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import PlanArc from '@/components/shared/PlanArc'
import RPEScale from '@/components/shared/RPEScale'
import SessionCard from '@/components/shared/SessionCard'
import PendingHrCard from '@/components/shared/PendingHrCard'
import SessionCompleteCard from '@/components/shared/SessionCompleteCard'
import { useDisciplineLedger, type LedgerSnapshot } from '@/lib/coaching/useDisciplineLedger'
import { getCompletionCopy } from '@/lib/coaching/completionCopy'
import { classifyHrPending } from '@/lib/coaching/hrPending'
import { useWidgetSync } from '@/lib/widget/useWidgetSync'
import { clearWidgetState } from '@/lib/native/sharedStore'
import ZoneBar, { zoneNumberForType, zoneShortName } from '@/components/shared/ZoneBar'
import ZoneInfoSheet from '@/components/shared/ZoneInfoSheet'
import AIMark from '@/components/shared/AIMark'
import CoachByline from '@/components/shared/CoachByline'
import PlanIntroCard from '@/components/shared/PlanIntroCard'
import PreRunBandCard from '@/components/shared/PreRunBandCard'
import { RaceTimesCard } from '@/components/shared/RaceTimesCard'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { NotificationRow, type NotificationItem } from '@/components/shared/NotificationRow'
import TrendCard from '@/components/shared/TrendCard'
import RaceResultSheet, { type ReshapeProposal } from '@/components/training/RaceResultSheet'
import PostRaceReshapeCard from '@/components/training/PostRaceReshapeCard'
import NextGoalCard from '@/components/training/NextGoalCard'
import { isReengagementWeek } from '@/lib/plan/maintenance'
import { nextGoalOptions, achievementLine, parseTimeToSeconds, type FinishedRace, type NextGoalOption } from '@/lib/coaching/goalSequencing'
import { composeSession } from '@/lib/plan/sessionComposer'
import { formatDistance, formatDuration, sumRoundedDistance, resolveSessionMetric } from '@/lib/format'
import { backfillAndLoadSessionMetricOverrides, setSessionMetricOverride, clearSessionMetricOverride } from '@/lib/sessionMetricOverrides'
import { didSessionHitZone, sessionHRBand, zoneForSessionType } from '@/lib/coaching/zoneRules'
import { getSessionVoiceLine } from '@/lib/coaching/voiceLines'
import { renderGuidance, guidanceContextFromSession } from '@/lib/plan/renderGuidance'
import { catalogueRowFor } from '@/lib/plan/catalogueLink'
import dynamic from 'next/dynamic'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import PullToRefresh from '@/components/shared/PullToRefresh'
import { syncOnAppOpen } from '@/lib/health/clientSync'
const GeneratePlanScreen = dynamic(() => import('./GeneratePlanScreen'), { ssr: false })
const UpgradeScreen = dynamic(() => import('./UpgradeScreen'), { ssr: false })
const BenchmarkUpdateScreen = dynamic(() => import('./BenchmarkUpdateScreen'), { ssr: false })
const FounderNoteScreen = dynamic(() => import('./FounderNoteScreen'), { ssr: false })
import { RecalibrationReadyTile, RecalibrationEntryScreen } from './RecalibrationTile'
import { nextRecalibrationDue } from '@/lib/coaching/recalibrationPrompt'

type Screen = 'today' | 'plan' | 'coach' | 'strava' | 'me' | 'calendar' | 'session' | 'generate' | 'upgrade' | 'benchmark' | 'reshape' | 'post-run' | 'founder' | 'notifications' | 'recalibration'

/**
 * Data passed to PostRunScreen — the destination screen for a Strava-linked
 * session completion. Replaces the old Reflect sheet for the linked path.
 *
 * `pendingActivityId` is set when the user just selected an activity in the
 * picker and the link hasn't been committed yet (PostRunScreen fires
 * /api/strava/link-activity on mount). On deep-link or retroactive entry,
 * the link already exists so this is null.
 */
type PostRunData = {
  session: any
  weekN: number
  pendingActivityId: number | null
  /** Set instead of pendingActivityId when the just-linked activity came from
   *  HealthKit (its strava_activities row already exists; link by UUID). */
  pendingAppleHealthUuid?: string | null
  /** Display info for the linked-activity confirmation row */
  linkedActivity: { name: string; km: number | null } | null
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  const bytes    = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i)
  return bytes.buffer
}

// ── Race countdown formatter ──────────────────────────────────────────────
//
// Runners think in weeks (training plans are weekly). Raw "63 days out" is
// harder to scale mentally than "9 weeks out". Close to race day the unit
// flips — "5 days" is more useful than "0 weeks 5 days". This helper picks
// the unit by proximity:
//
//   1 day        →  "1 day"
//   5 days       →  "5 days"
//   7 days       →  "1 week"
//   8 days       →  "1 week, 1 day"
//   14 days      →  "2 weeks"
//   65 days      →  "9 weeks, 2 days"
//   ≤ 0 days     →  "" (caller decides what to render for race day / past)
//
// Caller is responsible for gating on `days > 0` — Today screen hides the
// row on race day, MeScreen suppresses the suffix block.
function formatRaceCountdown(days: number, opts?: { suffix?: string }): string {
  if (days <= 0) return ''
  const suffix = opts?.suffix ? ` ${opts.suffix}` : ''
  if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'}${suffix}`
  const weeks = Math.floor(days / 7)
  const rem   = days % 7
  const wPart = `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
  if (rem === 0) return `${wPart}${suffix}`
  return `${wPart}, ${rem} ${rem === 1 ? 'day' : 'days'}${suffix}`
}

// POST-RUN-02: human-readable relative time for the auto-match subline.
// Honest and short — "this morning" / "earlier today" / "yesterday" / "{N}d ago".
// Returns null when the date is missing or in the future (avoids weird "in 2h" cases).
function formatRelativeTime(date: Date | null | undefined): string | null {
  if (!date || !Number.isFinite(date.getTime())) return null
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return null
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) {
    const h = date.getHours()
    if (h < 12) return 'this morning'
    if (h < 17) return 'earlier today'
    return 'this evening'
  }
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfToday.getDate() - 1)
  const startOfDate = new Date(date)
  startOfDate.setHours(0, 0, 0, 0)
  if (startOfDate.getTime() === startOfYesterday.getTime()) return 'yesterday'
  const days = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86400000)
  if (days <= 6) return `${days}d ago`
  return null
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
  const [activePostRunData, setActivePostRunData] = useState<PostRunData | null>(null)
  const [quitDays, setQuitDays] = useState<number | null>(null)
  const [smokeTrackerEnabled, setSmokeTrackerEnabled] = useState(false)
  const [quitDate, setQuitDate] = useState<string>('')
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
  // Per-session metric overrides — canonical store is the DB table
  // `session_metric_overrides` (ADR-015), loaded once userId is known and kept in
  // this map so cross-device + notifications agree. Drives the metric resolver on
  // collapsed cards / PlanCalendar / the session toggle. Keyed `${weekN}_${sessionKey}`.
  const [sessionMetricOverrides, setSessionMetricOverrides] = useState<Record<string, 'distance' | 'duration'>>({})
  const [restingHR, setRestingHR] = useState<number | null>(null)
  const [maxHR, setMaxHR] = useState<number | null>(null)
  // X-FIRSTRUN: detect Apple Health connection state so we can render an
  // honest pre-data view ("Connect a source" vs "Set your HR" vs "Run one").
  const [healthkitConnectedAt, setHealthkitConnectedAt] = useState<string | null>(null)
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [profileEmail, setProfileEmail] = useState<string>('')

  // Paid access — default true to avoid flash of locked state during load
  const [hasPaidAccess, setHasPaidAccess] = useState(true)

  // PV2-H — recalibration prompt (the living plan). Status drives the entry screen.
  const [recalStatus, setRecalStatus] = useState<'idle' | 'confirming' | 'applied' | 'error'>('idle')
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null)
  // Trial expired — true when user had a trial that is now over and no active subscription
  const [trialExpired, setTrialExpired] = useState(false)

  // Feature 3 — dynamic adjustments opt-in
  const [dynamicAdjustmentsEnabled, setDynamicAdjustmentsEnabled] = useState(true)

  // HOOK-01 — daily morning training-day push opt-in. Default true; the cron
  // (lib/api/push/send-daily) reads `daily_push_enabled` and `timezone` on
  // user_settings to decide whether to send at user-local 06:30.
  const [dailyPushEnabled, setDailyPushEnabled] = useState(true)

  // Last engine evaluation — drives the "Last checked …" line on the Me screen.
  // Stamped by /api/adjust-plan on every successful run (manual or auto).
  const [lastAdjustmentCheckAt, setLastAdjustmentCheckAt]                   = useState<string | null>(null)
  const [lastAdjustmentCheckFoundChange, setLastAdjustmentCheckFoundChange] = useState<boolean | null>(null)

  // Coaching data — run analysis + weekly report + pending adjustments
  // Nested: runAnalysisMap[week_n][session_day] = row. Keyed by week THEN day
  // because run_analysis.session_day is a bare weekday ('tue') — without the
  // week dimension, rows from different weeks collide on the same key and
  // "this week" silently reads another week's run. (Bug fixed 2026-05-27.)
  const [runAnalysisMap, setRunAnalysisMap] = useState<Record<number, Record<string, any>>>({})
  // Tracks whether the run_analysis fetch has completed (success OR empty).
  // Lets downstream UI distinguish "still loading" from "definitely no data"
  // — used to show a skeleton instead of letting the RestraintCard pop in
  // a beat after the rest of the Today screen renders.
  const [runAnalysisReady, setRunAnalysisReady] = useState(false)
  // Discipline ledger prefetched as part of the orchestrated paid-data load so
  // the Coach LedgerCard is present on first paint instead of popping in after
  // its own mount-time fetch. Coach is paid/trial-only, so this block covers
  // every surface that shows the card; MeScreen/PostRun keep the hook.
  const [disciplineLedger, setDisciplineLedger] = useState<LedgerSnapshot | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<any | null>(null)
  const [pendingAdjustment, setPendingAdjustment] = useState<any | null>(null)
  // RESHAPE-FIX-WAVE3-PHASE2 — recent silent (auto_applied) adjustments for the
  // Me-screen "what changed this week" audit surface (§69 honest absorption).
  const [recentChanges, setRecentChanges] = useState<any[]>([])
  // Readiness check response captured from /api/pre-session-readiness at boot.
  // When `adjustment` is null and `reason` is 'all_clear' / 'no_trigger', the
  // chip on Today renders "Readiness · steady" with the detail (RHR / HRV /
  // sleep vs baseline). When `adjustment` is set, `TdReadyHero` handles it
  // (cooked path). Other reasons (baseline_dormant, session_type_not_eligible,
  // tier, no_session, no_plan, no_week) render nothing.
  const [readinessData, setReadinessData] = useState<{
    adjustment?: any | null
    reason?: string
    detail?: {
      rhrBaseline?: number; rhrToday?: number
      hrvBaseline?: number; hrvToday?: number; hrvSd?: number
      sleepHours?: number
      samplesUsed?: number
    }
  } | null>(null)
  // NOTIF-01 — unread notification count drives the Today-screen bell dot.
  // Fetched once at load (paid only) and refreshed on app-resume. Auto-applied
  // plan adjustments (formerly the MeScreen "Recent tweaks" log) now live in
  // the notification inbox instead.
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  // R28 phase-end summary + R29 race readiness — pre-fetched cached rows, generated on-demand in CoachScreen
  const [phaseSummary, setPhaseSummary] = useState<{ content: string; generated_at: string; phase_ended: string; transition_week_n: number } | null>(null)
  const [raceReadinessNote, setRaceReadinessNote] = useState<{ content: string; generated_at: string } | null>(null)
  // R30 zone drift pattern + R32 recalibration — dismiss timestamps from user_settings
  const [zoneDriftDismissedAt, setZoneDriftDismissedAt]         = useState<string | null>(null)
  const [benchmarkRecalDismissedAt, setBenchmarkRecalDismissedAt] = useState<string | null>(null)

  // AI-DEPTH-08 — post-race reshape flow.
  // showRaceResultSheet: the log-result form (slide-up)
  // pendingReshape: proposed reshape waiting for user confirm/dismiss
  // reshapeDismissedAt: timestamp the user dismissed the card (session-scoped)
  const [showRaceResultSheet, setShowRaceResultSheet] = useState(false)
  const [pendingReshape, setPendingReshape]           = useState<ReshapeProposal | null>(null)
  // CA-03 — post-race "what next" goal ladder. Dismissal persists in
  // localStorage keyed by the race signature, so it stays dismissed for this
  // race but re-surfaces for the next one (and auto-clears once a new plan
  // moves the goal race into the future).
  const [nextGoalDismissedSig, setNextGoalDismissedSig] = useState<string | null>(null)
  useEffect(() => {
    try { setNextGoalDismissedSig(localStorage.getItem('zona_next_goal_dismissed')) } catch {}
  }, [])
  // MAINT-01 — "Base running" quiet card dismissal, keyed by race signature
  const [maintCardDismissedSig, setMaintCardDismissedSig] = useState<string | null>(null)
  useEffect(() => {
    try { setMaintCardDismissedSig(localStorage.getItem('zona_maint_card_dismissed')) } catch {}
  }, [])
  const [reshapeDismissedAt, setReshapeDismissedAt]   = useState<string | null>(null)

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

  // CONNECT-01 — Connect-Your-Runs ceremonial onboarding screen.
  //   connectRunsSeen: undefined = not yet hydrated from DB
  //                    null      = never shown (default for fresh users + pre-migration users)
  //                    false     = shown the screen, user skipped
  //                    true      = shown the screen, user connected at least one source
  //   connectRunsBannerDismissedAt: timestamp the post-skip reminder banner
  //                                 was dismissed (or tapped); null means the
  //                                 banner is still eligible for one display.
  const [connectRunsSeen, setConnectRunsSeen] = useState<boolean | null | undefined>(undefined)
  const [connectRunsBannerDismissedAt, setConnectRunsBannerDismissedAt] = useState<string | null>(null)
  const [showConnectRuns, setShowConnectRuns] = useState(false)
  const [orientationSeen, setOrientationSeen] = useState(false)

  // PUSH-ONBOARD — Push-permission ceremonial onboarding screen.
  //   pushPermissionSeen: undefined = not yet hydrated from DB
  //                       null      = never shown (default for fresh + pre-migration users)
  //                       false     = shown; user skipped or denied
  //                       true      = shown; user enabled push
  const [pushPermissionSeen, setPushPermissionSeen] = useState<boolean | null | undefined>(undefined)
  const [showPushOnboarding, setShowPushOnboarding] = useState(false)

  // Strava token failure — set when refresh call returns non-200 for a user who had a token
  const [stravaTokenFailed, setStravaTokenFailed] = useState(false)

  // Auth user ID — stored for callbacks that need to write to user_settings
  const [userId, setUserId] = useState<string | null>(null)

  // Global overrides — fetched once, shared across all screens
  const [allOverrides, setAllOverrides] = useState<{ week_n: number; original_day: string; new_day: string }[]>([])
  const [overridesReady, setOverridesReady] = useState(false)

  // All completions — fetched once at top level, refreshed on save
  const [allCompletions, setAllCompletions] = useState<Record<number, Record<string, any>>>({})

  // Activity ids the orphan auto-heal has already re-tried this session, so a
  // persistently-failing link (e.g. deleted Strava activity) can't re-fire on
  // every render. See the self-heal effect below.
  const healAttemptedRef = useRef<Set<number>>(new Set())

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

  // INSTRUMENT-01: record each Coach-screen open (one per navigation into Coach)
  // for the CO-ONE engagement gate. Fire-and-forget — never blocks or fails the
  // UI. Fires once per screen→'coach' transition; a null userId (pre-auth) is a
  // no-op and the effect re-runs to capture the open once the id resolves.
  useEffect(() => {
    if (screen === 'coach') trackEvent(supabase, userId, 'coach_open')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, userId])

  // Deep-link target for push notifications. Captured on mount; applied by a
  // separate effect once `plan` has loaded (we need the plan to resolve the
  // session by week_n + session_day). `target` selects which screen to land
  // on: POST-RUN-01 uses 'post-run', HOOK-02 ("Kit noticed") uses 'session'.
  const pendingDeepLinkRef = useRef<{ target: 'post-run' | 'session'; weekN: number; sessionDay: string } | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // The bottom nav is position:fixed, so the scroll container has to reserve
  // exactly its rendered height as paddingBottom or last-row content scrolls
  // under it. Font metrics + safe-area insets vary by device, so we measure at
  // runtime (ResizeObserver) and apply via React state. The nav is
  // conditionally rendered (hidden during first-time onboarding), so we use a
  // callback ref to re-observe whenever the node mounts/unmounts. Fallback in
  // the scroll container's paddingBottom calc covers first paint.
  const [bottomNavH, setBottomNavH] = useState<number | null>(null)
  const bottomNavObserverRef = useRef<ResizeObserver | null>(null)
  const bottomNavRef = useCallback((node: HTMLDivElement | null) => {
    bottomNavObserverRef.current?.disconnect()
    bottomNavObserverRef.current = null
    if (!node) { setBottomNavH(null); return }
    const apply = () => {
      const h = Math.ceil(node.getBoundingClientRect().height)
      if (h > 0) setBottomNavH(h)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(node)
    bottomNavObserverRef.current = ro
  }, [])

  // Lock document scroll while the dashboard shell is mounted. The shell is a
  // 100dvh flex column with a fixed bottom nav; only the inner content div
  // (scrollContainerRef) is meant to scroll. Without this, iOS WKWebView
  // (contentInset: 'automatic') keeps its own scroll view live, so overscroll
  // rubber-bands the whole document — dragging the fixed nav off the bottom
  // and getting stuck there. position:fixed is required because iOS ignores
  // overflow:hidden on body. Restored on unmount so standalone scrollable
  // routes (login, landing) are unaffected.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prev = {
      htmlOverflow: html.style.overflow,
      overflow: body.style.overflow,
      position: body.style.position,
      width: body.style.width,
      height: body.style.height,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.width = '100%'
    body.style.height = '100%'
    return () => {
      html.style.overflow = prev.htmlOverflow
      body.style.overflow = prev.overflow
      body.style.position = prev.position
      body.style.width = prev.width
      body.style.height = prev.height
    }
  }, [])

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

    // Push-notification deep links.
    //   POST-RUN-01 — "Run linked": /dashboard?screen=post-run&weekN=14&sessionDay=tue
    //   HOOK-02     — "Kit noticed": /dashboard?screen=session&weekN=14&sessionDay=tue
    // Both resolve the session via week_n + session_day once `plan` loads; the
    // applying effect (see below) branches on `target` to pick the screen.
    {
      const screenParam = params.get('screen')
      if (screenParam === 'post-run' || screenParam === 'session') {
        const weekN      = parseInt(params.get('weekN') ?? '', 10)
        const sessionDay = params.get('sessionDay') ?? ''
        if (Number.isFinite(weekN) && sessionDay) {
          pendingDeepLinkRef.current = { target: screenParam, weekN, sessionDay }
        }
        window.history.replaceState({}, '', '/dashboard')
      } else if (screenParam === 'plan' || screenParam === 'coach' || screenParam === 'notifications') {
        // Non-session deep links (weekly report → coach, plan adjustment → plan,
        // and a future "unread coaching" → notifications) route straight away.
        setScreen(screenParam)
        window.history.replaceState({}, '', '/dashboard')
      }
    }

    // Per-session metric overrides now load from the DB in a userId-keyed effect
    // below (with a one-time localStorage backfill), so they survive across
    // devices and are visible to server sends. See loadMetricOverrides effect.
  }, [])

  // Load per-session metric overrides from the DB once we know who the user is.
  // backfillAndLoadSessionMetricOverrides migrates any legacy localStorage entries
  // on first run, then reads the canonical table (ADR-015).
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const map = await backfillAndLoadSessionMetricOverrides(supabase, userId)
        if (!cancelled) setSessionMetricOverrides(map)
      } catch (e) {
        console.error('[metric-overrides] load failed', e)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  // Keep the override map in sync with the per-session toggle AND persist to the
  // DB (ADR-015). Called by SessionPopupInner. Passing null clears the override
  // (back to plan default / global). State updates optimistically; the DB write
  // is fire-and-forget but logs on failure (N-015).
  const handleSessionMetricChange = useCallback((weekN: number, sessionKey: string, metric: 'distance' | 'duration' | null) => {
    setSessionMetricOverrides(prev => {
      const k = `${weekN}_${sessionKey}`
      if (metric == null) {
        if (!(k in prev)) return prev
        const next = { ...prev }
        delete next[k]
        return next
      }
      if (prev[k] === metric) return prev
      return { ...prev, [k]: metric }
    })
    if (!userId) return
    const persist = metric == null
      ? clearSessionMetricOverride(supabase, userId, weekN, sessionKey)
      : setSessionMetricOverride(supabase, userId, weekN, sessionKey, metric)
    persist.catch(e => console.error('[metric-overrides] persist failed', e))
  }, [userId])

  // Strava safety timer: if the activities fetch hasn't settled within 2s
  // of mount, release the splash anyway. Strava can be slow / unreachable
  // and we'd rather render the Today screen with a brief pace skeleton
  // than hang the splash indefinitely.
  useEffect(() => {
    const t = setTimeout(() => setStravaSafetyExpired(true), 2000)
    return () => clearTimeout(t)
  }, [])

  // Resolve a week_n + session_day deep link to a session object and route to
  // the right screen. Shared by the push cold-start effect below and by
  // in-app notification-row taps (NOTIF-01). Needs `plan` loaded to resolve.
  //   target='post-run' (POST-RUN-01) → PostRunScreen
  //   target='session'  (HOOK-02)     → SessionScreen
  const applyDeepLink = useCallback((target: 'post-run' | 'session', weekN: number, sessionDay: string) => {
    if (!plan || plan === EMPTY_PLAN) return
    const week = plan.weeks?.find((w: any) => w.n === weekN)
    if (!week) return
    const session = (week.sessions as Record<string, any> | undefined)?.[sessionDay]
    if (!session) return

    // Build the same shape TodayScreen passes via onOpenSession.
    const enrichedSession = {
      ...session,
      key:       sessionDay,
      day:       sessionDay,
      weekN,
      weekTheme: week.theme ?? '',
    }

    if (target === 'post-run') {
      setActivePostRunData({
        session:           enrichedSession,
        weekN,
        pendingActivityId: null,  // already linked by webhook
        linkedActivity:    null,  // PostRunScreen reads from session_completions if needed
      })
      setScreen('post-run')
    } else {
      setActiveSessionData(enrichedSession)
      setScreen('session')
    }
  }, [plan])

  // Apply the captured push deep-link target once `plan` has loaded. Fires
  // once and clears the ref.
  useEffect(() => {
    if (!pendingDeepLinkRef.current) return
    if (!plan || plan === EMPTY_PLAN) return
    const { target, weekN, sessionDay } = pendingDeepLinkRef.current
    pendingDeepLinkRef.current = null
    applyDeepLink(target, weekN, sessionDay)
  }, [plan, applyDeepLink])

  // NOTIF-01 — route from a tapped notification row's stored url. Session /
  // post-run links resolve through applyDeepLink (needs the plan); the rest map
  // straight to a screen. Mirrors the push deep-link param convention.
  const navigateFromNotificationUrl = useCallback((url: string | null) => {
    if (!url) return
    try {
      const sp = new URL(url, window.location.origin).searchParams
      const screenParam = sp.get('screen')
      const weekN       = parseInt(sp.get('weekN') ?? '', 10)
      const sessionDay  = sp.get('sessionDay') ?? ''
      if ((screenParam === 'session' || screenParam === 'post-run') && Number.isFinite(weekN) && sessionDay) {
        applyDeepLink(screenParam, weekN, sessionDay)
      } else if (screenParam === 'today' || screenParam === 'plan' || screenParam === 'coach' || screenParam === 'me') {
        setScreen(screenParam)
      }
    } catch { /* malformed url — leave the user on the inbox */ }
  }, [applyDeepLink])

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

  // NOTIF-01 — re-read the unread notification count. Called on app-resume so a
  // push that landed while backgrounded bumps the bell dot, and by the
  // NotificationsScreen after it marks everything read.
  const refreshUnreadNotifications = useCallback(async () => {
    if (!hasPaidAccess) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null)
      if (typeof count === 'number') setUnreadNotifications(count)
    } catch { /* best-effort — leave the current badge */ }
  }, [hasPaidAccess, supabase])

  useEffect(() => {
    if (!hasPaidAccess) return
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshUnreadNotifications() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [hasPaidAccess, refreshUnreadNotifications])

  // Re-merge HealthKit activities from Supabase when the app comes back to
  // foreground. Covers the race between CapacitorBoot's syncOnAppOpen() and
  // the initial fetchSettings() call — ingest takes ~3–5 s, so on first open
  // after a run the row isn't in strava_activities yet. On the next
  // visibilitychange it is, and the picker + auto-match see it immediately
  // without needing a full app restart.
  const refreshHealthKitRuns = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: hkRows } = await supabase
        .from('strava_activities')
        .select('apple_health_uuid, strava_activity_id, name, start_date, distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, avg_speed, total_elevation_gain')
        .eq('user_id', user.id)
        .eq('source', 'apple_health')
        .order('start_date', { ascending: false })
        .limit(100)
      if (!hkRows?.length) return
      const newHkRuns = hkRows.map((r: any) => ({
        id:                   r.apple_health_uuid,
        source:               'apple_health' as const,
        apple_health_uuid:    r.apple_health_uuid,
        type:                 'Run',
        sport_type:           'Run',
        name:                 r.name ?? 'Apple Health run',
        start_date:           r.start_date,
        distance:             r.distance_m ?? 0,
        moving_time:          r.moving_time_s ?? 0,
        elapsed_time:         r.elapsed_time_s ?? r.moving_time_s ?? 0,
        total_elevation_gain: r.total_elevation_gain ?? 0,
        average_heartrate:    r.avg_hr ?? undefined,
        max_heartrate:        r.max_hr ?? undefined,
        average_speed:        r.avg_speed ?? undefined,
      }))
      const newHkIds = new Set(newHkRuns.map((r: any) => r.id))
      setStravaRuns(prev => {
        if (!prev) return newHkRuns
        // Replace any existing HK entries + keep non-HK runs (Strava)
        const nonHk = prev.filter((r: any) => r.source !== 'apple_health')
        // Only update if something actually changed (new UUIDs)
        const existingHkIds = new Set(prev.filter((r: any) => r.source === 'apple_health').map((r: any) => r.id))
        const hasNew = newHkRuns.some((r: any) => !existingHkIds.has(r.id))
        if (!hasNew) return prev
        return [...newHkRuns, ...nonHk]
      })
      // Also refresh completions — auto-match may have written a completion
      // while the app was backgrounded / while ingest was in flight.
      void refreshCompletions()
    } catch {}
  }, [supabase, refreshCompletions])

  useEffect(() => {
    if (!appReady) return
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshHealthKitRuns() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [appReady, refreshHealthKitRuns])

  // After CapacitorBoot finishes syncOnAppOpen() it fires 'zonna:sync-complete'.
  // autoMatchAndAnalyse runs inside waitUntil (after ingest response), so the
  // completion it writes is invisible to the initial fetchSettings load. This
  // listener closes that race: refreshHealthKitRuns() re-queries strava_activities
  // AND calls refreshCompletions(), so the Today screen reflects the auto-link
  // without the user needing to background+foreground or open the session card.
  useEffect(() => {
    if (!appReady) return
    const handler: EventListener = () => { void refreshHealthKitRuns() }
    window.addEventListener('zonna:sync-complete', handler)
    return () => window.removeEventListener('zonna:sync-complete', handler)
  }, [appReady, refreshHealthKitRuns])

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
    async function fetchSettings() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)

        // Fetch overrides + user settings + completions in parallel
        const [settingsRes, overridesRes, completionsRes, subRes, guidanceRes, pendingReshapeRes] = await Promise.all([
          supabase.from('user_settings').select('strava_refresh_token, smoke_tracker_enabled, quit_date, gist_url, plan_json, has_onboarded, is_admin, preferred_units, preferred_metric, resting_hr, max_hr, birth_year, date_of_birth, first_name, last_name, email, trial_started_at, dynamic_adjustments_enabled, orientation_seen, zone_drift_dismissed_at, benchmark_recal_dismissed_at, last_adjustment_check_at, last_adjustment_check_found_change, daily_push_enabled, timezone, connect_runs_seen, connect_runs_banner_dismissed_at, push_permission_seen, healthkit_connected_at').eq('id', user.id).single(),
          supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id),
          supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_name, strava_activity_km, rpe, fatigue_tag, avg_hr, coaching_flag').eq('user_id', user.id),
          supabase.from('subscriptions').select('status, current_period_end').eq('user_id', user.id).maybeSingle(),
          supabase.from('session_guidance').select('*').order('phase', { ascending: false, nullsFirst: false }),
          supabase.from('post_race_reshapes')
            .select('id, summary_text, weeks_affected, sessions_modified, recovery_config_key')
            .eq('user_id', user.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
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
          // Rehydrate any pending reshape from the DB so the race prompt stays
          // suppressed across app restarts. The result is committed to the plan
          // only when the user confirms — until then pendingReshape is the gate.
          if (pendingReshapeRes.data) {
            const pr = pendingReshapeRes.data as any
            setPendingReshape({
              reshapeId:           pr.id,
              summary:             pr.summary_text ?? null,
              weeksAffected:       pr.weeks_affected ?? [],
              sessionsModified:    pr.sessions_modified ?? 0,
              recoveryWindowWeeks: 0,
              distanceBucket:      pr.recovery_config_key ?? '',
            })
          }
        }

        // Trigger 3: miss detection — past days this week with a scheduled session and no completion.
        // Compare actual calendar dates, not day-of-week indices: a plan that
        // hasn't started yet has its first week's Mon-Fri in the calendar
        // future, which the day-of-week-only check would falsely flag as
        // "missed". Same logic protects the in-flight current week — only
        // sessions whose calendar date is strictly before today can be missed.
        if (loadedPlan.weeks.length > 0) {
          const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const wIdx     = getCurrentWeekIndex(loadedPlan.weeks)
          const wN       = wIdx + 1
          const week     = loadedPlan.weeks[wIdx]
          const thisWeekCompletions = completionsMap[wN] ?? {}
          if (week) {
            const weekStart = parseLocalDate((week as any).date)
            // Apply swap/move overrides so a swapped session is checked against
            // the slot it now sits in, not the day it was originally defined on.
            // Completions are keyed by original_day — see effectiveSessions.ts.
            const weekOverrides = (overridesRes.data ?? []).filter((o: any) => o.week_n === wN)
            const effective = resolveEffectiveSessions(week, weekOverrides)
            for (const dayKey of WEEK_DAYS) {
              const dayDate = computeSessionDate(weekStart, dayKey)
              if (dayDate >= today) break // today or future — not missable
              const eff = effective[dayKey]
              if (!eff || eff.session.type === 'rest') continue
              if (!thisWeekCompletions[eff.originalDay]) {
                // Build the activeSessionData shape now — same fields the card
                // path attaches (rawDate, weekN, completion) — so opening the
                // session via "I actually ran it" yields the same picker
                // behaviour as opening via the card. Without these fields the
                // picker falls back to a date-agnostic 5-day window and shows
                // runs from days after the missed session (which look like
                // duplicates of the actual run when Strava names are generic).
                setMissedSessionPrompt({
                  weekN: wN,
                  day: dayKey,                        // slot — used for display
                  session: {
                    ...eff.session,
                    key:        eff.originalDay,      // canonical id for upsert
                    weekN:      wN,
                    rawDate:    dayDate.toISOString(),
                    completion: thisWeekCompletions[eff.originalDay] ?? null,
                  },
                })
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
        if (data?.healthkit_connected_at) setHealthkitConnectedAt(data.healthkit_connected_at)
        // Prefer birth_year (post-migration source of truth). Fall back to the
        // year of legacy date_of_birth for rows where the backfill migration
        // hasn't run yet (dev environments). App Store 5.1.1 — App stores only
        // year now; day/month were never read by any consumer.
        if (typeof data?.birth_year === 'number') {
          setBirthYear(data.birth_year)
        } else if (data?.date_of_birth) {
          const y = new Date(data.date_of_birth).getFullYear()
          if (Number.isFinite(y)) setBirthYear(y)
        }

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

        // Paid access — admin OR active subscription OR within trial window.
        // Mirrors getUserTier's resolution order (admin → sub → trial → free)
        // so the client gate and every server gate agree. ADR-003 § Admin
        // entitlement; D-16 (no parallel semantics).
        const sub = subRes.data
        const hasActiveSub = sub?.status &&
          ['trialing', 'active'].includes(sub.status) &&
          new Date(sub.current_period_end) > new Date()
        const paidAccess = !!(data?.is_admin || hasActiveSub || isTrialActive(trialStartedAt))
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

        // HOOK-01 — hydrate daily-push toggle + auto-capture device timezone.
        // The migration default is true so an undefined value is treated as
        // "not yet set on this row" rather than "explicitly off".
        if (data?.daily_push_enabled === false) setDailyPushEnabled(false)
        // Only overwrite the stored tz when it's the placeholder 'UTC' (the
        // column default). User-set values (e.g. via a future tz picker) are
        // preserved. Browsers in UTC will write 'UTC' over 'UTC' — harmless.
        if (!data?.timezone || data.timezone === 'UTC') {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
          if (tz && tz !== 'UTC') {
            void supabase.from('user_settings').update({ timezone: tz }).eq('id', user.id)
          }
        }

        // Last adjustment-engine evaluation — drives the "Last checked …" line.
        if (data?.last_adjustment_check_at) setLastAdjustmentCheckAt(data.last_adjustment_check_at)
        if (typeof data?.last_adjustment_check_found_change === 'boolean') {
          setLastAdjustmentCheckFoundChange(data.last_adjustment_check_found_change)
        }

        // Orientation seen flag (B-002) — true means we've shown it before, don't show again
        if (data?.orientation_seen) setOrientationSeen(true)

        // CONNECT-01 — hydrate the tri-state flag + banner dismissal stamp.
        // Treats undefined as null (column may not exist on rows that haven't
        // been touched since the migration landed).
        setConnectRunsSeen(
          data?.connect_runs_seen === true  ? true  :
          data?.connect_runs_seen === false ? false :
          null
        )
        setConnectRunsBannerDismissedAt(data?.connect_runs_banner_dismissed_at ?? null)

        // PUSH-ONBOARD — hydrate the tri-state flag.
        setPushPermissionSeen(
          data?.push_permission_seen === true  ? true  :
          data?.push_permission_seen === false ? false :
          null
        )

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
            // Response is captured so the Today screen can render the "steady" chip
            // when baseline exists but no adjustment fired (the fresh/steady half of
            // the SLT TD-READY spec). Cooked path stays driven by `plan_adjustments`.
            try {
              const readinessRes = await authedFetch('/api/pre-session-readiness')
              if (readinessRes.ok) {
                const json = await readinessRes.json().catch(() => null)
                if (json) setReadinessData(json)
              }
            } catch {}

            // RESHAPE-FIX-WAVE3-PHASE2 — silent auto-applied changes from the last
            // 14 days for the Me-screen audit surface. Read-only; capped at 10.
            const recentChangesCutoff = new Date(Date.now() - 14 * 86_400_000).toISOString()
            const [analysisRes, reportRes, adjustmentsRes, unreadCountRes, phaseSummaryRes, raceReadinessRes, ledgerData, recentChangesRes] = await Promise.all([
              supabase.from('run_analysis').select('week_n, session_day, source, verdict, total_score, feedback_text, hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, ef_trend_pct, hr_discipline_score, distance_score, pace_score, ef_score, actual_load_km, hr_pct_z1, hr_pct_z2, hr_pct_z3, hr_pct_z4_5').eq('user_id', user.id),
              supabase.from('weekly_reports').select('*').eq('user_id', user.id).order('week_n', { ascending: false }).limit(1).maybeSingle(),
              supabase.from('plan_adjustments').select('*').eq('user_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle(),
              // NOTIF-01 — unread notification count for the Today-screen bell dot.
              // head:true returns the count without the rows (we only need the badge).
              supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
              // R28 — most recent phase-end summary (CoachScreen validates against current transition)
              supabase.from('phase_summaries').select('content, generated_at, phase_ended, transition_week_n').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
              // R29 — race readiness note for the plan's race date
              loadedPlan.meta.race_date
                ? supabase.from('race_readiness_notes').select('content, generated_at').eq('user_id', user.id).eq('race_date', loadedPlan.meta.race_date).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
              // Discipline ledger — prefetched here so the Coach LedgerCard
              // doesn't pop in from its own mount fetch. authedFetch never
              // throws on non-2xx, so guard on res.ok and swallow network errors.
              authedFetch('/api/discipline-ledger').then(r => r.ok ? r.json() : null).catch(() => null),
              supabase.from('plan_adjustments')
                .select('id, week_n, summary, sessions_before, sessions_after, created_at')
                .eq('user_id', user.id).eq('status', 'auto_applied')
                .gte('created_at', recentChangesCutoff)
                .order('created_at', { ascending: false }).limit(10),
            ])
            if (analysisRes.data) {
              const map: Record<number, Record<string, any>> = {}
              analysisRes.data.forEach((r: any) => {
                if (r.week_n == null) return
                if (!map[r.week_n]) map[r.week_n] = {}
                map[r.week_n][r.session_day] = r
              })
              setRunAnalysisMap(map)
            }
            if (reportRes.data) setWeeklyReport(reportRes.data)
            if (adjustmentsRes.data) setPendingAdjustment(adjustmentsRes.data)
            if (recentChangesRes.data) setRecentChanges(recentChangesRes.data)
            if (typeof unreadCountRes.count === 'number') setUnreadNotifications(unreadCountRes.count)
            if (phaseSummaryRes.data) setPhaseSummary(phaseSummaryRes.data as any)
            if (raceReadinessRes.data) setRaceReadinessNote(raceReadinessRes.data as any)
            if (ledgerData) setDisciplineLedger({
              weeksWithinLines:  ledgerData.weeksWithinLines ?? 0,
              currentWeekStatus: ledgerData.currentWeekStatus ?? 'pending',
              advancedThisWeek:  !!ledgerData.advancedThisWeek,
              tier:              ledgerData.tier ?? 'free',
            })
          } catch {}
          finally { setRunAnalysisReady(true) }

          // ENGINE-04 — taper recalibration. Fires once when the runner enters
          // their taper phase, re-anchoring volume targets to actual functional
          // peak. Silent: skips if insufficient data, already run, or within
          // tolerance. No user confirmation needed — it's a forward-only volume
          // scale, not a structural change. CoachingPrinciples §68.
          const taperPhaseEntry = loadedPlan.phases?.find((p: any) => p.name === 'taper')
            ?? (() => {
              const ft = loadedPlan.weeks.find((w: any) => w.phase === 'taper')
              const lt = [...loadedPlan.weeks].reverse().find((w: any) => w.phase === 'taper')
              return ft && lt ? { start_week: ft.n } : null
            })()
          const taperCurrentWeekN = (getCurrentWeekIndex(loadedPlan.weeks)) + 1
          if (
            taperPhaseEntry &&
            taperCurrentWeekN === taperPhaseEntry.start_week &&
            !(loadedPlan.meta as any).taper_recalibrated_at
          ) {
            try {
              const recalRes = await authedFetch('/api/recalibrate-taper', { method: 'POST' })
              if (recalRes.ok) {
                const recalJson = await recalRes.json().catch(() => null)
                if (recalJson?.recalibrated && recalJson.plan) {
                  setPlan(recalJson.plan)
                }
              }
            } catch {}
          }
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

        // ADR-011: HealthKit activities are a co-equal match source to Strava.
        // They already live in strava_activities (source='apple_health', written
        // by /api/health/ingest). Load them up front — regardless of whether
        // Strava is connected — so the client-side auto-match and the manual
        // picker can see treadmill / Apple Watch runs, not just Strava runs.
        let healthKitRuns: any[] = []
        let hkStravaIds = new Set<number>()
        try {
          const { data: hkRows } = await supabase
            .from('strava_activities')
            .select('apple_health_uuid, strava_activity_id, name, start_date, distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, avg_speed, total_elevation_gain')
            .eq('user_id', user.id)
            .eq('source', 'apple_health')
            .order('start_date', { ascending: false })
            .limit(100)
          // Marshal each HK row into the StravaActivity-like shape the matcher,
          // picker, and saveCompletion already consume. `id` is the UUID so the
          // link path can branch on `source` to write apple_health_uuid.
          healthKitRuns = (hkRows ?? []).map((r: any) => ({
            id:                   r.apple_health_uuid,
            source:               'apple_health' as const,
            apple_health_uuid:    r.apple_health_uuid,
            type:                 'Run',
            sport_type:           'Run',
            name:                 r.name ?? 'Apple Health run',
            start_date:           r.start_date,
            distance:             r.distance_m ?? 0,
            moving_time:          r.moving_time_s ?? 0,
            elapsed_time:         r.elapsed_time_s ?? r.moving_time_s ?? 0,
            total_elevation_gain: r.total_elevation_gain ?? 0,
            average_heartrate:    r.avg_hr ?? undefined,
            max_heartrate:        r.max_hr ?? undefined,
            average_speed:        r.avg_speed ?? undefined,
          }))
          hkStravaIds = new Set(
            (hkRows ?? [])
              .map((r: any) => r.strava_activity_id)
              .filter((x: any): x is number => x != null)
          )
        } catch {}

        if (!data?.strava_refresh_token) { setStravaRuns(healthKitRuns); setStravaLoading(false); return }

        // Use cached access token if still valid (Strava tokens last 6 hours)
        let access_token: string | null = null
        const cachedToken   = localStorage.getItem('strava_access_token')
        const cachedExpiry  = localStorage.getItem('strava_token_expires_at')
        const nowSec        = Math.floor(Date.now() / 1000)
        if (cachedToken && cachedExpiry && nowSec < Number(cachedExpiry) - 300) {
          access_token = cachedToken
        } else {
          // Refresh token via server-side route — keeps client secret safe.
          // authedFetch attaches the bearer token; the route derives the user
          // from it (Finding 1) rather than trusting a body-supplied userId.
          const tokenRes = await authedFetch('/api/strava/refresh', {
            method: 'POST',
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
        // Drop Strava rows already consolidated into a HealthKit row (same
        // physical run, per tryEnrichHealthKitRow) so the list never shows the
        // workout twice. HealthKit runs lead — Apple Health is the primary
        // iOS source (ADR-011).
        const runs = getRuns(activities).filter((r: any) => !hkStravaIds.has(r.id))
        setStravaRuns([...healthKitRuns, ...runs])
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

  // Re-fetch run_analysis and rebuild the nested (week → day) map. Used by the
  // orphan auto-heal after it backfills a missing analysis row.
  async function refreshRunAnalysis() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('run_analysis')
        .select('week_n, session_day, source, verdict, total_score, feedback_text, hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, ef_trend_pct, hr_discipline_score, distance_score, pace_score, ef_score, actual_load_km, hr_pct_z1, hr_pct_z2, hr_pct_z3, hr_pct_z4_5')
        .eq('user_id', user.id)
      if (data) {
        const map: Record<number, Record<string, any>> = {}
        data.forEach((r: any) => {
          if (r.week_n == null) return
          if (!map[r.week_n]) map[r.week_n] = {}
          map[r.week_n][r.session_day] = r
        })
        setRunAnalysisMap(map)
      }
    } catch {}
  }

  // ── Orphan analysis auto-heal ──────────────────────────────────────────────
  // The link path writes the completion immediately but fires the zone-analysis
  // call (link-activity) fire-and-forget. A transient Strava error, a token
  // refresh, or the app backgrounding mid-call leaves a completion that has an
  // activity id but no run_analysis row — so the Coach zone rings have nothing
  // to draw, permanently and silently. Here we detect that for the current week
  // and re-run the analysis. Idempotent (link-activity upserts) and bounded:
  // current week only, each activity tried at most once per session.
  useEffect(() => {
    if (!hasPaidAccess || !stravaConnected || !runAnalysisReady) return
    if (!plan?.weeks?.length) return
    const wn       = getCurrentWeekIndex(plan.weeks) + 1
    const comps    = allCompletions[wn] ?? {}
    const analysed = runAnalysisMap[wn] ?? {}
    const orphans  = Object.entries(comps).filter(([day, c]: [string, any]) =>
      c?.status === 'complete'
      && c?.strava_activity_id != null
      && !analysed[day]
      && !healAttemptedRef.current.has(c.strava_activity_id)
    ) as [string, any][]
    if (!orphans.length) return

    let cancelled = false
    ;(async () => {
      let healed = false
      for (const [day, c] of orphans) {
        healAttemptedRef.current.add(c.strava_activity_id)
        try {
          // authedFetch never throws on 4xx/5xx — must check res.ok.
          const res = await authedFetch('/api/strava/link-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strava_activity_id: c.strava_activity_id, week_n: wn, session_day: day }),
          })
          if (res.ok) healed = true
          else console.warn('[auto-heal] link-activity failed', day, res.status, await res.text().catch(() => ''))
        } catch (e) { console.warn('[auto-heal] link-activity threw', day, e) }
      }
      if (healed && !cancelled) {
        await refreshRunAnalysis()
        await refreshCompletions()
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPaidAccess, stravaConnected, runAnalysisReady, allCompletions, runAnalysisMap, plan])

  async function dismissWelcome() {
    setShowWelcome(false)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({ id: user.id, has_onboarded: true, updated_at: new Date().toISOString() })
    } catch {}
  }

  async function handlePlanSaved(savedPlan: Plan) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Archiving the previous plan now lives in savePlanForUser (single owner —
      // fires for every mutation path, race-change-guarded, error-surfaced).
      await savePlanForUser(user.id, savedPlan, supabase)

      // D3: the wizard writes HR into plan.meta only — never into this component's
      // restingHR/maxHR state (populated from user_settings at mount) nor into
      // user_settings itself. For a brand-new user both were null, so the
      // orientation screen's zone cards all rendered '—'. Hydrate state from the
      // just-generated plan (truth at save time) so the cards show real ranges,
      // and persist HR below so downstream zone surfaces survive a reload.
      const metaRhr = (savedPlan.meta as { resting_hr?: number })?.resting_hr
      const metaMhr = (savedPlan.meta as { max_hr?: number })?.max_hr
      if (typeof metaRhr === 'number') setRestingHR(metaRhr)
      if (typeof metaMhr === 'number') setMaxHR(metaMhr)

      // ONBOARDING-FIX (Problem A): flip has_onboarded on the live finalise path.
      // This previously lived ONLY in dismissWelcome, whose trigger — the retired
      // Welcome screen — was commented out, so the flag never flipped for anyone
      // (9/14 users had a saved plan but has_onboarded=false). The same browser
      // client just persisted the plan above, so this write shares its auth context
      // and succeeds identically on web and native. Idempotent on re-generation.
      // authedFetch pattern not used: this is the live browser session (not a
      // bearer route), proven to write by the savePlanForUser call directly above.
      const onboardPatch: {
        id: string; has_onboarded: boolean; updated_at: string
        resting_hr?: number; max_hr?: number
      } = { id: user.id, has_onboarded: true, updated_at: new Date().toISOString() }
      if (typeof metaRhr === 'number') onboardPatch.resting_hr = metaRhr
      if (typeof metaMhr === 'number') onboardPatch.max_hr = metaMhr
      const { error: onboardErr } = await supabase.from('user_settings').upsert(onboardPatch)
      // Non-fatal: the plan is already saved. Surface the failure rather than
      // swallowing it (the original silent-failure class). No client-side
      // recordOpsEvent — that helper is server-only (service-role key).
      if (onboardErr) console.error('Failed to persist onboarding state:', onboardErr.message)
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

  // AI-DEPTH-08 — post-race detection.
  // raceWeekIndex: index of the race week in plan.weeks (first race found)
  // showRacePrompt: true when the current week is after the race week and no
  //   result has been logged yet. Free users see a locked card; paid users see live.
  const postRaceState = (() => {
    if (!plan) return null
    // Goal race = the LAST race-flagged week. A mid-plan tune-up event is typed
    // 'race_event' but still carries a 'race' badge; findIndex would grab that
    // tune-up and fire the post-race prompt the moment the current week passes it
    // (weeks before the real race). findLastIndex selects the culminating race.
    const raceWeekIdx = plan.weeks.findLastIndex(
      w => w.type === 'race' || (w as any).badge === 'race'
    )
    if (raceWeekIdx < 0) return null
    // §73 — date-window, not index compare. currentWeekIndex saturates at the
    // last week once the plan is over, so `currentWeekIndex > raceWeekIdx` never
    // fires when the race is the final week (the normal case). "Post-race" = the
    // race week's 7-day window has ended.
    const isPostRace = isDatePastWeek(plan.weeks[raceWeekIdx], new Date())
    const hasResult  = !!(plan.weeks[raceWeekIdx] as any)?.result_embedded
    if (!isPostRace || hasResult) return null
    return {
      raceWeekN:  raceWeekIdx + 1,
      raceName:   plan.meta.race_name ?? '',
      targetTime: plan.meta.target_time,
    }
  })()
  const showRacePrompt = !!postRaceState && !reshapeDismissedAt && !pendingReshape

  // CA-03 — once the goal race is run AND its result is logged, surface the
  // "what next" goal ladder. Independent of the reshape lifecycle (it fills the
  // post-race void that opens once the reshape is resolved). PAID-gated.
  const finishedRace = (() => {
    if (!plan) return null
    const idx = plan.weeks.findLastIndex(w => w.type === 'race' || (w as any).badge === 'race')
    // §73 — date-window, not index compare (same saturating-pointer bug: CA-03's
    // goal ladder was dead when the race was the final week, even with a result).
    if (idx < 0 || !isDatePastWeek(plan.weeks[idx], new Date())) return null
    const result = (plan.weeks[idx] as any)?.result_embedded
    if (!result) return null
    const race: FinishedRace = {
      distanceKm: result.distance_km ?? plan.meta.race_distance_km,
      finishTime: result.finish_time ?? null,
      targetTime: plan.meta.target_time ?? null,
      outcome:    result.outcome ?? null,
    }
    // #1 — has the runner been shown the one-time maintenance transition
    // announcement for this race? Stored on result_embedded so it's self-keyed
    // per race and travels with plan_json (no schema change, cross-device).
    return { sig: plan.meta.race_date ?? `race-${idx}`, race, transitionSeen: !!result.maintenance_transition_seen }
  })()
  // MAINT-06 — the active plan is now a standalone maintenance plan (`plan_kind`)
  // once the race is done; the race plan is archived. The finished-race context
  // the next-goal ladder + maintenance copy need is then carried on the
  // maintenance plan's `source_*` meta rather than the (now-archived) race week.
  const isMaintenancePlan = (plan?.meta as any)?.plan_kind === 'maintenance'
  const finishedRaceForGoal: { sig: string; race: FinishedRace } | null = (() => {
    if (finishedRace) return { sig: finishedRace.sig, race: finishedRace.race }
    if (isMaintenancePlan && plan) {
      const m = plan.meta as any
      return {
        sig: m.source_race_name ?? 'maintenance',
        race: {
          distanceKm: m.source_race_distance_km ?? plan.meta.race_distance_km,
          finishTime: m.source_finish_time ?? null,
          targetTime: plan.meta.target_time ?? null,
          outcome:    m.source_race_outcome ?? null,
        },
      }
    }
    return null
  })()
  function handlePickNextGoal(opt: NextGoalOption) {
    // Seed the plan wizard with the chosen goal, then open it. GeneratePlanScreen
    // restores this draft on mount (sessionStorage key 'zona_wizard_draft').
    try {
      const draft: Record<string, unknown> = { appStep: 'distance', distanceKm: opt.distanceKm, goal: opt.goal }
      const sec = parseTimeToSeconds(opt.targetTime)
      if (opt.goal === 'time_target' && sec != null) {
        const totalMin = Math.round(sec / 60)
        draft.targetHours = Math.floor(totalMin / 60)
        draft.targetMins  = totalMin % 60
      }
      sessionStorage.setItem('zona_wizard_draft', JSON.stringify(draft))
    } catch {}
    setScreen('generate')
  }

  function handleDismissNextGoal() {
    if (!finishedRaceForGoal) return
    try { localStorage.setItem('zona_next_goal_dismissed', finishedRaceForGoal.sig) } catch {}
    setNextGoalDismissedSig(finishedRaceForGoal.sig)
  }

  // MAINT-06 — post-race surfaces key off the standalone maintenance plan
  // (`plan_kind`), not the (now-archived) race week. The transition announcement
  // + ongoing "Base running" card + their seen/dismiss state live on the
  // maintenance plan's meta, so they survive the race→maintenance handoff.
  const maintCardSig = isMaintenancePlan ? ((plan!.meta as any).source_race_name ?? 'maintenance') : null
  const maintTransitionSeen = !!(plan?.meta as any)?.maintenance_transition_seen
  // #1 — one-time transition announcement. The maintenance plan is auto-live, but
  // the runner hasn't been told the race is done and this is the after-block.
  // Shows once (until acknowledged), and SUPPRESSES the ongoing status card until
  // then, so Today shows one maintenance slot that progresses announce → status.
  const showMaintTransition = !!(isMaintenancePlan && !maintTransitionSeen)
  const showMaintCard = !!(
    isMaintenancePlan &&
    maintTransitionSeen &&
    maintCardSig &&
    maintCardDismissedSig !== maintCardSig
  )
  // MAINT-07 — is the runner inside the §75 Phase 3 re-engagement window?
  // `getCurrentWeekIndex` saturates at the final week (§73), which is the wanted
  // behaviour here: once the block is behind them, the last week — a Phase 3 week
  // — stays current, so the window opens and stays open.
  const inReengagementWindow = !!(
    isMaintenancePlan && plan && isReengagementWeek(plan.weeks[currentWeekIndex], plan.weeks)
  )

  // CA-03 goal ladder (§67, amended 2026-08-02 — SLT decision).
  // The forward conversation opens in Phase 3 and nowhere earlier. Two reasons,
  // both from the board: a runner four weeks post-race judges "same distance,
  // faster" on perceived readiness, which is least reliable exactly then
  // (Hutchinson); and the card's dismissal persists for the whole block, so
  // offering it on day one spends the single shot at the moment the runner is
  // least able to answer (Wood). The wizard stays reachable throughout — this
  // delays the PROPOSAL, never the action (Fried).
  //
  // Gate is scoped to maintenance plans: a finished race with no maintenance
  // block (generation failed, or a plan shape that produces none) keeps the
  // original CA-03 behaviour rather than losing the ladder entirely.
  const nextGoalGateOpen = !isMaintenancePlan || (!showMaintTransition && inReengagementWindow)
  const nextGoalData = (finishedRaceForGoal && hasPaidAccess && nextGoalGateOpen && nextGoalDismissedSig !== finishedRaceForGoal.sig)
    ? { achievement: achievementLine(finishedRaceForGoal.race), options: nextGoalOptions(finishedRaceForGoal.race) }
    : null

  function handleDismissMaintCard() {
    if (!maintCardSig) return
    try { localStorage.setItem('zona_maint_card_dismissed', maintCardSig) } catch {}
    setMaintCardDismissedSig(maintCardSig)
  }

  // #1 — mark the transition announcement seen on the maintenance plan's meta.
  // race_name is unchanged, so savePlanForUser won't archive (race-change-guarded).
  // The in-memory setPlan dismisses the card immediately; the save persists it.
  async function markMaintenanceTransitionSeen() {
    if (!plan || !isMaintenancePlan) return
    if ((plan.meta as any).maintenance_transition_seen) return
    const updatedPlan = { ...plan, meta: { ...plan.meta, maintenance_transition_seen: true } } as Plan
    setPlan(updatedPlan)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await savePlanForUser(user.id, updatedPlan, supabase)
    } catch (err) { console.error('[maintenance] transition-seen save failed', err) }
  }
  function handleSeeMaintenancePlan() {
    void markMaintenanceTransitionSeen()
    setScreen('plan')
  }
  function handleAckMaintenanceTransition() {
    void markMaintenanceTransitionSeen()
  }

  // MAINT-01 — auto-generate maintenance block when the plan is complete and the
  // race result has been logged. Fire-and-forget; the returned plan replaces the
  // local state so Today screen shows the first maintenance session immediately.
  // authedFetch never throws on 4xx/5xx — must check res.ok.
  useEffect(() => {
    if (!plan || !finishedRace) return
    const hasMaintenance = plan.weeks.some(
      w => (w as any).phase === 'maintenance_restoration' || (w as any).phase === 'maintenance_base',
    )
    if (hasMaintenance) return
    void (async () => {
      const res = await authedFetch('/api/maintenance-block', { method: 'POST' })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      if (data?.plan) setPlan(data.plan)
    })()
  // finishedRace changes when result is logged; plan changes after we setPlan.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, finishedRace])

  // Update to current week once plan loads
  useEffect(() => {
    if (plan) {
      const idx = getCurrentWeekIndex(plan.weeks)
      setViewWeekIndex(idx >= 0 ? idx : 0)
    }
  }, [plan])

  // WIDGET-01 — push race countdown + today's session into the App
  // Group container so the iOS home-screen widget can render them.
  // No-op on web. Debounced inside the hook — repeated identical
  // payloads don't re-write.
  useWidgetSync(plan, allOverrides)

  // HOOK-01 — beacon the server when the Today screen is in view so the daily
  // push cron can suppress the 06:30 push for runners already in the app.
  // Fire-and-forget; failure is silent — at worst the cron sends a push the
  // runner doesn't need, which is still better than crashing the dashboard.
  useEffect(() => {
    if (screen !== 'today' || !userId) return
    void authedFetch('/api/me/today-heartbeat', { method: 'POST' }).catch(() => {})
  }, [screen, userId])

  // CONNECT-01 — trigger the ConnectRuns ceremony when:
  //   • plan is loaded (not the empty plan, not loading)
  //   • orientation has been seen (we sit AFTER orientation in the flow)
  //   • connect_runs_seen is exactly null (tri-state — false means skipped,
  //     true means already connected). undefined = still hydrating.
  //   • we're on a native platform (HealthKit is iOS-only — web users keep
  //     the NULL flag and see the screen if they ever open the native app).
  useEffect(() => {
    if (!plan || plan === EMPTY_PLAN) return
    if (!orientationSeen) return
    if (connectRunsSeen !== null) return
    if (showConnectRuns) return
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        setShowConnectRuns(true)
      } catch {
        // Capacitor unavailable — treat as web, skip.
      }
    })()
  }, [plan, orientationSeen, connectRunsSeen, showConnectRuns])

  // PUSH-ONBOARD — trigger the push-permission ceremony when:
  //   • plan is loaded
  //   • orientation has been seen
  //   • connect_runs_seen is decided (true or false — not null/undefined meaning it's been acted on)
  //   • push_permission_seen is exactly null (never shown; undefined = still hydrating)
  //   • we're on a native platform (APNs is iOS-only)
  useEffect(() => {
    if (!plan || plan === EMPTY_PLAN) return
    if (!orientationSeen) return
    if (connectRunsSeen === undefined || connectRunsSeen === null) return
    if (pushPermissionSeen !== null) return
    if (showPushOnboarding) return
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        setShowPushOnboarding(true)
      } catch {}
    })()
  }, [plan, orientationSeen, connectRunsSeen, pushPermissionSeen, showPushOnboarding])

  // Personalised zone ceiling: Karvonen 70% HRR, falls back to plan meta.
  // Returns null only when no HR data exists AND no plan is present — which
  // is impossible for any user past onboarding. Never returns a hardcoded
  // bpm value: all HR data must derive from user_settings (Apple Health or
  // Tanaka) or plan.meta (set at generation time from the same source).
  const effectiveZone2Ceiling = useMemo<number | null>(() => {
    if (restingHR && maxHR) return Math.round(restingHR + 0.70 * (maxHR - restingHR))
    return plan?.meta?.zone2_ceiling ?? null
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

  // POST-RUN-01 / AUTO-MATCH-02: best Strava match for the active session,
  // computed client-side so "Mark complete" can skip the picker. The webhook's
  // silent auto-link path only fires on `high`; the client surface also shows
  // `medium` candidates as a softer "Looks like this one?" CTA so the user
  // isn't left wondering why nothing matched when a plausible run exists.
  // `low` stays hidden — too noisy to surface.
  const activeAutoMatch = useMemo<{ activity: any; confidence: 'high' | 'medium' } | null>(() => {
    if (!activeSessionData || !plan || plan === EMPTY_PLAN) return null
    if (!stravaRuns || !stravaRuns.length) return null
    const week = (plan.weeks as any[] | undefined)?.find((w: any) => w.n === activeSessionData.weekN)
    if (!week?.date) return null
    const dayKey = activeSessionData.key as string
    const offsets: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }
    const sessionDate = parseLocalDate(week.date)
    sessionDate.setDate(sessionDate.getDate() + (offsets[dayKey] ?? 0))
    try {
      // findMatchCandidates is pure — safe to call client-side
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { findMatchCandidates } = require('@/lib/coaching/sessionMatch')
      const candidates = findMatchCandidates(activeSessionData, sessionDate, stravaRuns)
      const top = candidates[0]
      if (!top) return null
      if (top.confidence === 'high' || top.confidence === 'medium') {
        return { activity: top.activity, confidence: top.confidence as 'high' | 'medium' }
      }
      return null
    } catch {
      return null
    }
  }, [activeSessionData, plan, stravaRuns])
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
    height: '100dvh',
    overflow: 'hidden',
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
        {/* Brand wordmark — Wordmark component sources text from BRAND.name */}
        <div style={{ marginBottom: '10px' }}>
          <Wordmark size="md" className="wordmark-splash" />
        </div>

        {/* Tagline */}
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {BRAND.voiceAnchor}
        </div>
      </div>
    )
  }

  // Welcome screen — shown once on first login
  if (showWelcome) {
    return (
      <div style={{
        // Own scroll context — see OrientationScreen note. Retired screen, but
        // kept scroll-safe in case the trigger is ever re-enabled.
        height: '100dvh', overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'safe center',
        background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
        padding: '32px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
      }}>
        {/* Brand wordmark — Wordmark component sources text from BRAND.name */}
        <div style={{ marginBottom: '8px' }}>
          <Wordmark size="md" />
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '48px' }}>
          {BRAND.voiceAnchor}
        </div>

        {/* Welcome message */}
        <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px', marginBottom: '16px', lineHeight: 1.3 }}>
            Your plan is ready.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '12px' }}>
            {/* TODO: brand voice review — sentences referencing the product name may benefit from rewording in a follow-up content polish pass. */}
            {BRAND.name} keeps track of your sessions, adapts when things shift, and keeps you focused on what matters — finishing.
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
        restingHR={restingHR}
        maxHR={maxHR}
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

  // CONNECT-01 — Connect-Your-Runs ceremonial onboarding screen.
  // Gated on: plan exists, connect_runs_seen IS NULL (tri-state), and native
  // platform (HealthKit is iOS-only). Web users skip this entirely — the
  // flag stays NULL on their account, and they'll see the screen if they
  // ever open the native app.
  if (showConnectRuns) {
    return (
      <ConnectRunsScreen
        onConnected={() => { setConnectRunsSeen(true); setShowConnectRuns(false) }}
        onSkip={() => { setConnectRunsSeen(false); setShowConnectRuns(false) }}
        onHRFound={async (rhr, mhr) => {
          // Only write values that are currently missing — never overwrite what
          // the user already entered manually. The plan may already have Tanaka
          // zones baked in; updating user_settings here means all future coaching
          // (and any re-generation) uses the real Karvonen values instead.
          const newRhr = restingHR != null ? restingHR : rhr
          const newMhr = maxHR     != null ? maxHR     : mhr
          if (newRhr != null) setRestingHR(newRhr)
          if (newMhr != null) setMaxHR(newMhr)
          if (newRhr != null || newMhr != null) {
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                await supabase.from('user_settings').upsert({
                  id:         user.id,
                  resting_hr: newRhr ?? undefined,
                  max_hr:     newMhr ?? undefined,
                  updated_at: new Date().toISOString(),
                })
              }
            } catch {}
          }
        }}
      />
    )
  }

  // PUSH-ONBOARD — Push-permission ceremonial onboarding screen.
  // Gated on: connect_runs_seen decided, push_permission_seen IS NULL, native platform.
  // Free users see this — push registration is free; the daily reminder is paid.
  if (showPushOnboarding) {
    return (
      <PushOnboardingScreen
        onEnabled={() => { setPushPermissionSeen(true); setShowPushOnboarding(false) }}
        onSkip={() => { setPushPermissionSeen(false); setShowPushOnboarding(false) }}
      />
    )
  }

  const currentWeek = getCurrentWeek(plan?.weeks ?? [])

  // PTR-01 — pull-to-refresh handler. One more trigger into the existing
  // resume-path refreshes: force a HealthKit ingest (native) so a just-finished
  // run lands now, then re-fetch runs, completions, analysis, and the unread
  // count. Daily-cached coaching (daily note, weekly report) is intentionally
  // out of scope — it's server-cached per day, so a pull can't change it.
  // Throwing surfaces the "Couldn't refresh." state; offline is the honest case.
  const handleRefresh = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error('offline')
    }
    if (Capacitor.isNativePlatform()) {
      try { await syncOnAppOpen() } catch { /* ingest best-effort; still re-fetch below */ }
    }
    await Promise.all([
      refreshHealthKitRuns(),   // also calls refreshCompletions() when HK rows exist
      refreshRunAnalysis(),
      refreshCompletions(),     // explicit — covers the no-HK-rows path
      refreshUnreadNotifications(),
    ])
  }
  // Only the primary nav screens carry the gesture. Detail/checkout screens
  // (session, post-run, upgrade, notifications) push on top and don't own
  // refreshable data.
  const pullToRefreshEnabled =
    appReady && (screen === 'today' || screen === 'plan' || screen === 'coach' || screen === 'me')

  // PV2-H / ADR-014 — the living plan. Flatten completions to the {week_n,
  // session_day} shape the trigger reads; recalDue is the earliest recovery-week
  // time trial that's completed and not yet applied (null otherwise).
  const recalDue = (() => {
    if (!plan?.weeks?.length) return null
    const flat: { week_n: number; session_day: string }[] = []
    for (const [wk, days] of Object.entries(allCompletions)) {
      for (const day of Object.keys(days ?? {})) flat.push({ week_n: Number(wk), session_day: day })
    }
    return nextRecalibrationDue(plan, flat, plan.meta?.recalibrations_applied ?? [])
  })()

  const recalDistanceKm = GENERATION_CONFIG.RECALIBRATION_TIME_TRIAL.distance_km
  const secondsToTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const handleRecalConfirm = async (timeSeconds: number) => {
    if (!recalDue) return
    setRecalStatus('confirming')
    try {
      const res = await fetch('/api/recalibrate-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benchmark: { type: 'time_trial', distance_km: recalDistanceKm, time: secondsToTime(timeSeconds) },
          recalibration_week_n: recalDue.week_n,
        }),
      })
      if (!res.ok) { setRecalStatus('error'); return }
      const { plan: updatedPlan } = await res.json()
      if (updatedPlan) setPlan(updatedPlan)
      setRecalStatus('applied')
    } catch {
      setRecalStatus('error')
    }
  }

  return (
    <div style={s}>

      <PullToRefresh
        scrollRef={scrollContainerRef}
        onRefresh={handleRefresh}
        paddingBottom={(bottomNavH ?? 88) + 16}
        disabled={!pullToRefreshEnabled}
      >
        {screen === 'today'    && <TodayScreen plan={plan} weekIndex={viewWeekIndex} onWeekChange={setViewWeekIndex} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} daysToRace={daysToRace} raceName={raceName} preferredMetric={preferredMetric} sessionMetricOverrides={sessionMetricOverrides} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} overridesReady={overridesReady} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} allCompletions={allCompletions} preferredUnits={preferredUnits} zone2Ceiling={effectiveZone2Ceiling} onManualSaved={refreshCompletions} restingHR={restingHR} maxHR={maxHR} aerobicPace={aerobicPace} stravaLoading={stravaLoading} firstName={firstName} pendingAdjustment={pendingAdjustment} readinessData={readinessData} onAdjustmentConfirmed={(p) => { setPlan(p); setPendingAdjustment(null) }} onAdjustmentReverted={(p) => { setPlan(p); setPendingAdjustment(null) }} trialDaysLeft={trialDaysLeft} onUpgrade={() => setScreen('upgrade')} hasPaidAccess={hasPaidAccess} recalTile={recalDue ? <RecalibrationReadyTile weekN={recalDue.week_n} sessionDay={recalDue.session_day} distanceKm={recalDistanceKm} tier={hasPaidAccess ? 'paid' : 'free'} onEnter={() => { setRecalStatus('idle'); setScreen(hasPaidAccess ? 'recalibration' : 'upgrade') }} /> : null} dailyCoachNote={dailyCoachNote} coachNoteSettled={coachNoteSettled} runAnalysisMap={runAnalysisMap} runAnalysisReady={runAnalysisReady} onOpenCoach={() => setScreen('coach')} onOpenPostRun={(data) => { setActivePostRunData(data); setScreen('post-run') }} unreadNotifications={unreadNotifications} onOpenNotifications={() => { setUnreadNotifications(0); setScreen('notifications') }} showRacePrompt={showRacePrompt} pendingReshape={pendingReshape} nextGoalData={nextGoalData} onPickNextGoal={handlePickNextGoal} onDismissNextGoal={handleDismissNextGoal} showMaintCard={showMaintCard} onDismissMaintCard={handleDismissMaintCard} showMaintTransition={showMaintTransition} maintReengagement={inReengagementWindow} maintThemeLine={plan.weeks[currentWeekIndex]?.theme} onSeeMaintPlan={handleSeeMaintenancePlan} onAckMaintTransition={handleAckMaintenanceTransition} onLogRaceResult={() => setShowRaceResultSheet(true)} onReshapeAccepted={(updatedPlan) => { setPlan(updatedPlan); setPendingReshape(null) }} onReshapeDismissed={async () => {
                  // Stamp DB so the dismiss survives a page reload. Dismiss every
                  // pending row for this user, not just pendingReshape.reshapeId:
                  // historical pending rows from repeated test runs (the POST route
                  // used to insert unconditionally) would otherwise resurface on
                  // reload and make the card look un-dismissable.
                  if (userId) {
                    const { error } = await supabase
                      .from('post_race_reshapes')
                      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
                      .eq('user_id', userId)
                      .eq('status', 'pending')
                    if (error) console.error('[post-race-reshape] dismiss failed', error)
                  }
                  setPendingReshape(null)
                  setReshapeDismissedAt(new Date().toISOString())
                }} />}
        {screen === 'plan'     && <PlanScreen plan={plan} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} allCompletions={allCompletions} onOverrideChange={setAllOverrides} onOpenSession={(s: any) => { setActiveSessionData(s); setScreen('session') }} overridesReady={overridesReady} preferredUnits={preferredUnits} preferredMetric={preferredMetric} sessionMetricOverrides={sessionMetricOverrides} hasPaidAccess={hasPaidAccess} onOpenCoach={() => setScreen('coach')} />}
        {screen === 'coach'    && (hasPaidAccess
          ? (() => {
              // ADR-013 §22-27: allCompletions and runAnalysisMap are keyed by
              // week.n, NOT array position. On a standalone maintenance plan the
              // array restarts at index 0 but week.n continues (26+), so the old
              // `getCurrentWeekIndex+1` key collided with the archived race plan's
              // week-1 completions (all 'complete') → false 4/4. Derive from week.n.
              const wn = (currentWeek as any)?.n ?? (getCurrentWeekIndex(plan.weeks) + 1)
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
              // CoachingPrinciples §65: today is in flight. "Behind / on
              // track" judgement compares done against what was due by
              // end of yesterday, not against the full-week target. The
              // headline number stays "X / full-week" — only the verdict
              // line beneath honours in-flight.
              const dueByYesterday = daysDueByEndOfYesterday((currentWeek as any).date)
              const dueSet = new Set<string>(dueByYesterday)
              const liveSessionsDueToDate = wSessions.filter(
                (s: any) => dueSet.has(s.key),
              ).length
              // Zone discipline — time-weighted hr_in_zone_pct, same formula
              // as the TodayScreen RestraintCard so the two surfaces never
              // disagree about the same week.
              const analysisRows = wSessions
                .filter((s: any) => comps[s.key]?.status === 'complete')
                .map((s: any) => {
                  const a = runAnalysisMap?.[wn]?.[s.key]
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

              // Per-zone weekly aggregates for the Coach ZoneRings (Pattern 22).
              // Same load-km weighting as zoneDisciplinePercent — the two
              // numbers describe the same week from different angles, so they
              // must never disagree about which session weighed what.
              const zoneHistogramRows = wSessions
                .filter((s: any) => comps[s.key]?.status === 'complete')
                .map((s: any) => {
                  const a = runAnalysisMap?.[wn]?.[s.key]
                  if (!a) return null
                  if (a.hr_pct_z1 == null && a.hr_pct_z2 == null && a.hr_pct_z3 == null && a.hr_pct_z4_5 == null) return null
                  return {
                    z1:     Number(a.hr_pct_z1   ?? 0),
                    z2:     Number(a.hr_pct_z2   ?? 0),
                    z3:     Number(a.hr_pct_z3   ?? 0),
                    z45:    Number(a.hr_pct_z4_5 ?? 0),
                    weight: (a.actual_load_km as number | null) ?? 1,
                  }
                })
                .filter((v: any): v is { z1: number; z2: number; z3: number; z45: number; weight: number } => v !== null)
              const zoneTimePctByZone = zoneHistogramRows.length >= 1
                ? (() => {
                    const totalW = zoneHistogramRows.reduce((s: number, r: any) => s + r.weight, 0)
                    return {
                      z1:  zoneHistogramRows.reduce((s: number, r: any) => s + r.z1  * r.weight, 0) / totalW,
                      z2:  zoneHistogramRows.reduce((s: number, r: any) => s + r.z2  * r.weight, 0) / totalW,
                      z3:  zoneHistogramRows.reduce((s: number, r: any) => s + r.z3  * r.weight, 0) / totalW,
                      z45: zoneHistogramRows.reduce((s: number, r: any) => s + r.z45 * r.weight, 0) / totalW,
                    }
                  })()
                : null
              const zoneHistogramHits = zoneHistogramRows.length

              // R30 — zone drift pattern detection.
              // Walk the nested runAnalysisMap (week → day → row), keep easy/
              // recovery rows, then check the most recent 8 for hr_in_zone_pct
              // < 60%. (Previously parsed a `week_N_day` string key that the map
              // never produced — so this was dead. Revived by the nested-map fix.)
              const allEasyRecoveryRows = Object.entries(runAnalysisMap ?? {})
                .flatMap(([weekNStr, days]: [string, any]) =>
                  Object.entries((days ?? {}) as Record<string, any>).map(([dayShort, analysis]: [string, any]) => {
                    if (!analysis || analysis.hr_in_zone_pct == null) return null
                    if (analysis.source === 'manual') return null
                    const weekN    = parseInt(weekNStr, 10)
                    const weekData = plan.weeks.find((w: any) => w.n === weekN)
                    const sType    = (weekData?.sessions as any)?.[dayShort]?.type ?? null
                    if (sType !== 'easy' && sType !== 'recovery') return null
                    return { weekN, hr_in_zone_pct: analysis.hr_in_zone_pct as number }
                  })
                )
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
                  zoneTimePctByZone={zoneTimePctByZone}
                  zoneHistogramHits={zoneHistogramHits}
                  liveSessionsCompleted={liveSessionsCompleted}
                  liveSessionsPlanned={liveSessionsPlanned}
                  liveSessionsDueToDate={liveSessionsDueToDate}
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
                  runAnalysisReady={runAnalysisReady}
                  disciplineLedger={disciplineLedger}
                  onConnect={() => setScreen('me')}
                  restingHR={restingHR}
                  maxHR={maxHR}
                  healthkitConnectedAt={healthkitConnectedAt}
                />
              )
            })()
          : <CoachTeaser plan={plan} firstName={firstName} onUpgrade={() => setScreen('upgrade')} />
        )}
        {/* Strava screen: defense-in-depth gate on isAdmin at the render boundary.
            No UI path opens it for non-admins, but the render gate prevents a future commit
            from accidentally exposing admin UI via state mutation or a new entry point. */}
        {screen === 'strava'   && isAdmin && <StravaScreen runs={stravaRuns} loading={stravaLoading} connected={stravaConnected} raceName={plan?.meta?.race_name} raceDate={plan?.meta?.race_date} raceDistanceKm={plan?.meta?.race_distance_km} zone2Ceiling={effectiveZone2Ceiling ?? undefined} restingHR={restingHR ?? undefined} maxHR={maxHR ?? undefined} />}
        {screen === 'me'       && <MeScreen plan={plan} initials={initials} athlete={plan?.meta?.athlete ?? ''} quitDays={quitDays} smokeTrackerEnabled={smokeTrackerEnabled} quitDate={quitDate} onSmokeTrackerChange={(enabled: boolean, date: string) => { setSmokeTrackerEnabled(enabled); setQuitDate(date); if (enabled && date) { const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000)); setQuitDays(days) } else { setQuitDays(null) } }} theme={theme} onThemeChange={() => { /* theme system retired — ADR-008 */ }} preferredUnits={preferredUnits} onUnitsChange={async (u: 'km' | 'mi') => { setPreferredUnits(u); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_units: u, updated_at: new Date().toISOString() }) } catch {} }} preferredMetric={preferredMetric} onMetricChange={async (m: 'distance' | 'duration') => { setPreferredMetric(m); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_metric: m, updated_at: new Date().toISOString() }) } catch {} }} restingHR={restingHR} maxHR={maxHR} birthYear={birthYear} onHRChange={async (rhr: number, mhr: number) => {
  setRestingHR(rhr); setMaxHR(mhr)
  const newZ2 = Math.round(rhr + 0.70 * (mhr - rhr))
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // 1. user_settings is the single source of truth for live HR values
    await supabase.from('user_settings').upsert({ id: user.id, resting_hr: rhr, max_hr: mhr, updated_at: new Date().toISOString() })
    // 2. P1 — sync plan.meta so the zone2_ceiling fallback path never drifts
    //    from user_settings. Uses savePlanForUser (not savePlanForUser archives
    //    the plan — that's only done in the generate flow). Plain upsert here.
    if (plan && plan !== EMPTY_PLAN) {
      const updatedPlan = { ...plan, meta: { ...plan.meta, resting_hr: rhr, max_hr: mhr, zone2_ceiling: newZ2 } }
      setPlan(updatedPlan as any)
      // RESHAPE-FIX-WAVE1: savePlanForUser now throws on persistence failure.
      // This call is deliberately fire-and-forget (the resting-HR save above
      // is the load-bearing write; plan.meta sync is best-effort), so swallow
      // the rejection here rather than re-architect the call shape.
      savePlanForUser(user.id, updatedPlan as any, supabase).catch((err: unknown) => {
        console.error('plan.meta sync failed:', err)
      })
    }
    // 3. P3 — re-bucket past run analyses with new zone boundaries (fire-and-forget).
    //    The route updates strava_activities.hr_pct_z* for Strava-sourced runs
    //    (re-fetches HR streams from Strava API) and recomputes run_analysis
    //    zone columns for all recent sessions. Failure is silent — stale data
    //    is better than blocking the HR save.
    void authedFetch('/api/recalibrate-hr', { method: 'POST' })
  } catch {}
}} firstName={firstName} lastName={lastName} profileEmail={profileEmail} onProfileChange={async (fn: string, ln: string, em: string) => { setFirstName(fn); setLastName(ln); setProfileEmail(em); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, first_name: fn, last_name: ln, email: em, updated_at: new Date().toISOString() }) } catch {} }} onOpenGenerate={() => setScreen('generate')} onOpenBenchmark={() => setScreen('benchmark')} onOpenReshape={() => setScreen('reshape')} onOpenFounderNote={() => setScreen('founder')} onUpgrade={() => setScreen('upgrade')} hasPaidAccess={hasPaidAccess} trialDaysLeft={trialDaysLeft} dynamicAdjustmentsEnabled={dynamicAdjustmentsEnabled} onDynamicAdjustmentsChange={async (enabled: boolean) => { setDynamicAdjustmentsEnabled(enabled); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, dynamic_adjustments_enabled: enabled, updated_at: new Date().toISOString() }) } catch {} }} dailyPushEnabled={dailyPushEnabled} onDailyPushEnabledChange={async (enabled: boolean) => { setDailyPushEnabled(enabled); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, daily_push_enabled: enabled, updated_at: new Date().toISOString() }) } catch {} }} lastAdjustmentCheckAt={lastAdjustmentCheckAt} lastAdjustmentCheckFoundChange={lastAdjustmentCheckFoundChange} hasPendingAdjustment={!!pendingAdjustment} recentChanges={recentChanges} />}
        {/* Calendar screen retired per brand-product-alignment v2 */}
        {screen === 'session'  && activeSessionData && <SessionScreen session={activeSessionData} preloadedRuns={stravaRuns ?? []} onBack={() => setScreen('today')} onSaved={refreshCompletions} preferredUnits={preferredUnits} preferredMetric={preferredMetric} onSessionMetricChange={handleSessionMetricChange} savedMetricOverride={sessionMetricOverrides[`${activeSessionData.weekN}_${activeSessionData.key}`] ?? null} zone2Ceiling={effectiveZone2Ceiling ?? undefined} restingHR={restingHR} maxHR={maxHR} aerobicPace={aerobicPace} stravaLoading={stravaLoading} runAnalysis={(activeSessionData?.weekN != null ? runAnalysisMap[activeSessionData.weekN]?.[activeSessionData?.key ?? ''] : null) ?? null} hasPaidAccess={hasPaidAccess} onUpgrade={() => setScreen('upgrade')} onOpenCoach={() => setScreen('coach')} goalPace={(plan?.meta as any)?.goal_pace_per_km ?? null} guidance={guidanceMap.get(activeSessionData?.type ?? '') ?? null} nextSession={activeNextSession} onLinkedComplete={(data) => { setActivePostRunData(data); setScreen('post-run') }} autoMatch={activeAutoMatch} />}
        {screen === 'post-run' && activePostRunData && <PostRunScreen data={activePostRunData} onBack={() => { setActivePostRunData(null); setScreen('today') }} onDone={() => {
          // POST-RUN-02: terminus. Route to SessionScreen for this session
          // with the freshest completion merged in, so the verdict (which
          // SessionScreen renders inline) is the resting state — not Today.
          const sess = activePostRunData.session
          const wN   = activePostRunData.weekN
          if (!sess || wN == null) { setActivePostRunData(null); setScreen('today'); return }
          const freshCompletion = allCompletions[wN]?.[sess.key as string] ?? sess.completion ?? null
          setActiveSessionData({ ...sess, completion: freshCompletion })
          setActivePostRunData(null)
          setScreen('session')
        }} onSaved={refreshCompletions} onAnalysisLoaded={(sessionDay, row) => {
          // POST-RUN-02: keep parent map in sync so Done → SessionScreen
          // doesn't re-poll for analysis we already have in hand. Nested by week.
          const wN = activePostRunData.weekN
          if (wN == null) return
          setRunAnalysisMap(prev => ({ ...prev, [wN]: { ...(prev[wN] ?? {}), [sessionDay]: row } }))
        }} preferredUnits={preferredUnits} zone2Ceiling={effectiveZone2Ceiling} hasPaidAccess={hasPaidAccess} onOpenCoach={() => setScreen('coach')} runAnalysis={(activePostRunData.weekN != null ? runAnalysisMap[activePostRunData.weekN]?.[activePostRunData.session?.key ?? ''] : null) ?? null} aerobicPace={aerobicPace} goalPace={(plan?.meta as any)?.goal_pace_per_km ?? null} />}
        {screen === 'generate' && <GeneratePlanScreen onBack={() => setScreen(plan && plan !== EMPTY_PLAN ? 'me' : 'today')} firstName={firstName} lastName={lastName} restingHR={restingHR} maxHR={maxHR} birthYear={birthYear} onBirthYearSave={async (y) => { setBirthYear(y); if (userId) await supabase.from('user_settings').update({ birth_year: y, date_of_birth: null }).eq('id', userId) }} onPlanSaved={handlePlanSaved} isOnboarding={!plan || plan === EMPTY_PLAN} hasExistingPlan={!!(plan && plan !== EMPTY_PLAN)} hasPaidAccess={hasPaidAccess} onUpgrade={() => setScreen('upgrade')} />}
        {screen === 'upgrade'  && <UpgradeScreen trialExpired={trialExpired} onBack={() => {
          // Legacy key name — preserved to avoid wiping active user state. Future: migrate via key translation layer.
          const hasWizardDraft = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('zona_wizard_draft')
          setScreen(hasWizardDraft ? 'generate' : 'today')
        }} />}
        {screen === 'benchmark' && plan && <BenchmarkUpdateScreen plan={plan} stravaConnected={stravaConnected} onBack={() => setScreen('me')} onUpdated={(updatedPlan) => { setPlan(updatedPlan) }} />}
        {screen === 'recalibration' && <RecalibrationEntryScreen distanceKm={recalDistanceKm} status={recalStatus} onBack={() => { setRecalStatus('idle'); setScreen('today') }} onConfirm={handleRecalConfirm} />}
        {screen === 'reshape'   && <ReshapeScreen plan={plan} onBack={() => setScreen('me')} onReshapeApplied={(updatedPlan) => { setPlan(updatedPlan); setPendingAdjustment(null); setScreen('today') }} onChecked={(foundChange) => { setLastAdjustmentCheckAt(new Date().toISOString()); setLastAdjustmentCheckFoundChange(foundChange) }} onOpenBenchmark={() => setScreen('benchmark')} preferredUnits={preferredUnits} />}
        {screen === 'founder'   && <FounderNoteScreen onBack={() => setScreen('me')} />}
        {screen === 'notifications' && <NotificationsScreen onBack={() => setScreen('today')} onNavigate={navigateFromNotificationUrl} onAllRead={() => setUnreadNotifications(0)} />}
      </PullToRefresh>

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
              // Completion key = original_day (session.key). After a swap, the slot
              // (missedSessionPrompt.day) and the original day diverge; the rest of
              // the system reads completions by original_day.
              const completionKey = missedSessionPrompt.session.key ?? missedSessionPrompt.day
              await supabase.from('session_completions').upsert({
                user_id: user.id,
                week_n: missedSessionPrompt.weekN,
                session_day: completionKey,
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
                    sessionType: coachingSessionType(missedSessionPrompt.session),
                    sessionDay: completionKey,
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


      {/* ── AI-DEPTH-08: Race result sheet (global overlay) ── */}
      {showRaceResultSheet && postRaceState && (
        <RaceResultSheet
          raceWeekN={postRaceState.raceWeekN}
          raceName={postRaceState.raceName}
          targetTime={postRaceState.targetTime}
          onClose={() => setShowRaceResultSheet(false)}
          onReshapeReady={(proposal, updatedPlan) => {
            // §74 — the result is already live; apply it so the debrief + goal
            // ladder reflect immediately. The reshape stays pending for review.
            if (updatedPlan) setPlan(updatedPlan)
            setPendingReshape(proposal)
            setShowRaceResultSheet(false)
          }}
          onLogOnly={(updatedPlan) => {
            // §74 — result saved on submit. Apply it so the CA-03 "what's next"
            // goal ladder appears as the acknowledgment (no reshape to show).
            if (updatedPlan) setPlan(updatedPlan)
            setReshapeDismissedAt(new Date().toISOString())
            setShowRaceResultSheet(false)
          }}
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
          <div ref={bottomNavRef} style={{
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
                  scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
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

function OrientationScreen({ plan, firstName, zone2Ceiling, restingHR, maxHR, onDismiss }: {
  plan: Plan; firstName: string; zone2Ceiling: number | null
  restingHR: number | null; maxHR: number | null
  onDismiss: () => void
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
      // Own scroll context: the dashboard body-lock (overflow:hidden;
      // position:fixed, set on mount) leaves this early-return screen with no
      // scrollable ancestor, so it must scroll itself — otherwise content
      // taller than the viewport clips the CTA off-screen and bricks onboarding.
      // 'safe center' keeps the layout centred when it fits, but falls back to
      // top-aligned + scrollable when it overflows.
      height: '100dvh', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'safe center',
      background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
      padding: '32px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
    }}>
      {/* Brand mark — Wordmark component sources text from BRAND.name */}
      <div style={{ marginBottom: '6px' }}>
        <Wordmark size="md" />
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '40px' }}>
        {BRAND.voiceAnchor}
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
                {raceDateStr}{daysToRace !== null && daysToRace > 0 ? ` · ${formatRaceCountdown(daysToRace)}` : ''}
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

        {/* ── ZONE INTRO ──────────────────────────────────────────────
            First visible use of "Hold the zone" anywhere in the product UI.
            Shows the full 5-zone system at the moment the user just got
            their plan — the moment they're most receptive to the framework
            the plan operates in. HR ranges from calculateZones() when HR
            data is set, otherwise zone names only (still useful). */}
        {(() => {
          const haveHR = restingHR != null && maxHR != null && maxHR > restingHR
          const zones = haveHR ? calculateZones(restingHR!, maxHR!) : null
          return (
            <>
              {/* Hold the zone eyebrow */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '8px',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--moss)',
                  animation: 'ai-mark-pulse 2s ease-in-out infinite',
                }} />
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
                  color: 'var(--moss)',
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>Hold the zone</span>
              </div>

              {/* Headline */}
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '24px', fontWeight: 800,
                color: 'var(--ink)', letterSpacing: '-0.025em', lineHeight: 1.1,
                marginBottom: '6px',
              }}>
                These are <span style={{ color: 'var(--moss)' }}>your zones.</span>
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px',
                color: 'var(--mute)', lineHeight: 1.55, marginBottom: '18px',
              }}>
                Every session tells you which one. Hold the line — that&apos;s the whole job.
              </div>

              {/* Zone list — 5 rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {ZONE_DEFS.map(z => {
                  const isHome = z.zone === 2
                  const hr = zones?.find(zz => zz.zone === z.zone)
                  return (
                    <div key={z.zone} style={{
                      display: 'grid', gridTemplateColumns: '32px 1fr auto',
                      gap: '12px', alignItems: 'center',
                      padding: '11px 13px',
                      background: 'var(--card)', border: '1px solid var(--line)',
                      borderLeft: isHome ? `3px solid ${z.colour}` : '1px solid var(--line)',
                      paddingLeft: isHome ? '11px' : '13px',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      {/* Zone number badge */}
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: z.colour,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 800,
                        color: 'var(--card)', flexShrink: 0,
                      }}>{z.zone}</div>
                      {/* Name + description */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{
                            fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
                            color: 'var(--ink)', letterSpacing: '-0.005em',
                          }}>{z.name}</div>
                          {isHome && (
                            <span style={{
                              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                              color: 'var(--moss)', background: 'var(--moss-soft)',
                              padding: '2px 6px', borderRadius: '3px',
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>Your home</span>
                          )}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-ui)', fontSize: '11px',
                          color: 'var(--mute)', marginTop: '2px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{z.desc}</div>
                      </div>
                      {/* HR range or em-dash if no HR data */}
                      <div style={{
                        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                        color: z.colour, fontVariantNumeric: 'tabular-nums',
                        textAlign: 'right', whiteSpace: 'nowrap',
                      }}>
                        {hr ? `${hr.minHR}–${hr.maxHR}` : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* The whole job callout — brand position in two sentences */}
              <div style={{
                background: 'var(--moss-soft)',
                border: '1px solid var(--moss-mid)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '24px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                  color: 'var(--moss)', letterSpacing: '0.12em', textTransform: 'uppercase',
                  marginBottom: '4px',
                }}>The whole job</div>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '13px',
                  color: 'var(--ink)', lineHeight: 1.5,
                }}>
                  Easy when it&apos;s easy. Hard when it&apos;s hard. The grey middle is where amateurs go to stall — and where most of your improvement is hiding.
                </div>
              </div>

              {/* Zone-method disclosure — honest about how these were derived.
                  plan.meta.hr_zone_method is always written by the rule engine. */}
              {(() => {
                const method = (plan?.meta as any)?.hr_zone_method as string | undefined
                const note   = (plan?.meta as any)?.hr_assumption_note as string | undefined
                let msg: string | null = null
                if (!method || method === 'karvonen') {
                  // Karvonen: real data used — no disclaimer needed, but confirm it.
                  if (haveHR) msg = 'Zones personalised from your heart rate data.'
                } else if (method === 'karvonen_estimated_max') {
                  msg = 'Resting HR used. Max HR estimated from age — add your measured max in Profile to refine.'
                } else if (method === 'percent_of_max') {
                  msg = 'Max HR used. Add your resting HR in Profile for more accurate zones.'
                } else {
                  // percent_of_estimated_max — no HR data at all
                  msg = note ?? 'Zones estimated from age — no HR data available. Add values in Profile, or connect Apple Health, to personalise.'
                }
                if (!msg) return null
                return (
                  <div style={{
                    fontFamily: 'var(--font-ui)', fontSize: '11px',
                    color: 'var(--mute)', lineHeight: 1.55,
                    marginBottom: '16px', textAlign: 'center',
                  }}>
                    {msg}
                  </div>
                )
              })()}
              {/* If HR isn't set at all, also prompt them to add values */}
              {!haveHR && !(plan?.meta as any)?.hr_zone_method && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px',
                  color: 'var(--mute)', lineHeight: 1.55,
                  marginBottom: '16px', textAlign: 'center',
                }}>
                  Add your resting + max HR in Profile to see your personal ranges.
                </div>
              )}
            </>
          )
        })()}

        {/* CTA */}
        <button
          onClick={onDismiss}
          style={{
            width: '100%', padding: '16px',
            background: 'var(--moss)', color: 'var(--card)',
            border: 'none', borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-ui)', fontSize: '13px',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          I&apos;m ready
        </button>
      </div>
    </div>
  )
}

// ── CONNECT-01 — Connect-Your-Runs ceremonial onboarding screen ────────────
// Sutherland signalling — a dedicated screen, not a settings checkbox.
// Layout absorbs a future "Connect Strava" CTA below Apple Health without
// any redesign or copy change (per spec).

function ConnectRunsScreen({ onConnected, onSkip, onHRFound }: {
  onConnected: () => void
  onSkip: () => void
  /** Called after a successful connect with whatever resting/max HR HealthKit
   *  had available. Null for either value = HealthKit didn't have that reading
   *  (e.g. Garmin user — no Apple Watch resting HR). Parent decides whether to
   *  write to user_settings based on what's currently saved. */
  onHRFound?: (rhr: number | null, mhr: number | null) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks whether the iOS permission dialog has already been presented.
  // Apple 5.1.1(iv): no skip path before the request — only after.
  const [permissionAsked, setPermissionAsked] = useState(false)
  const supabase = createClient()

  async function connectHealthKit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { requestHealthKitAuth, syncOnAppOpen, fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
      setPermissionAsked(true)
      const granted = await requestHealthKitAuth()
      if (!granted) {
        // Denial / unavailable / framework not linked — Capacitor doesn't
        // distinguish in the return value. Calm one-liner, Zona voice.
        setError('Apple Health said no. Enable in iOS Settings → Health — or connect later.')
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const nowIso = new Date().toISOString()
      await supabase.from('user_settings').upsert({
        id: user.id,
        healthkit_connected_at: nowIso,
        connect_runs_seen:      true,
        updated_at:             nowIso,
      })
      void syncOnAppOpen().catch((e) => {
        console.warn('[HealthKit] first sync after connect failed:', e)
      })
      // Auto-populate HR zones from HealthKit if we can — fire-and-forget so it
      // never blocks the connect confirmation. Parent writes to user_settings
      // only if the values are currently null (don't overwrite user-entered data).
      if (onHRFound) {
        fetchAppleHealthHRSnapshot()
          .then(snap => onHRFound(snap?.restingHR ?? null, snap?.maxHR ?? null))
          .catch(() => onHRFound(null, null))
      }
      onConnected()
    } catch (e: any) {
      console.warn('[HealthKit] connect failed:', e)
      setError("Couldn't reach Apple Health. Try again, or connect from Me later.")
    } finally {
      setBusy(false)
    }
  }

  async function skip() {
    if (busy) return
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        connect_runs_seen: false,
        updated_at: new Date().toISOString(),
      })
      onSkip()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      // Own scroll context — see OrientationScreen note. Early-return screens
      // sit outside the dashboard's inner scroll container, and the body is
      // locked (overflow:hidden; position:fixed), so this must scroll itself or
      // the primary CTA can clip off-screen on shorter devices.
      height: '100dvh', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'safe center',
      background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
      padding: '32px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ marginBottom: '6px' }}>
        <Wordmark size="md" />
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '48px' }}>
        {BRAND.voiceAnchor}
      </div>

      <div style={{ width: '100%', maxWidth: '340px' }}>
        {/* The ask — single sentence, BRAND-sourced. */}
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.25, marginBottom: '10px' }}>
          {BRAND.connect.ask}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
          {BRAND.connect.subline}
        </div>

        {/* Primary CTA — Apple Health.
            When Strava is approved, add a second equal-weight button BELOW this
            one with the same visual treatment (moss fill, full width). Do not
            change the ask copy above. */}
        <button
          onClick={connectHealthKit}
          disabled={busy}
          style={{
            width: '100%',
            background: 'var(--moss)', color: 'var(--card)',
            border: 'none', borderRadius: '12px',
            padding: '14px 16px',
            minHeight: '52px',  // bigger than the 44pt min — primary ceremony CTA.
            fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}
        >
          {/* Adapted from AppleHealthConnectionRow icon — 24px white-on-moss
              roundel containing the canonical moss dot. Reads as "Apple Health"
              identity on the button surface without needing Apple's marks. */}
          <span style={{
            width: '24px', height: '24px', borderRadius: '7px',
            background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--card)' }} />
          </span>
          {busy ? 'Connecting…' : 'Connect Apple Health'}
        </button>

        {error && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--warn)', lineHeight: 1.55, marginTop: '12px' }}>
            {error}
          </div>
        )}

        {/* Skip only shown AFTER the iOS permission dialog has fired (Apple
            5.1.1(iv): no exit path before the request). permissionAsked flips
            true the moment requestHealthKitAuth() is called. */}
        {permissionAsked && (
          <button
            onClick={skip}
            disabled={busy}
            style={{
              width: '100%',
              background: 'none', border: 'none',
              padding: '14px 0',
              marginTop: '8px',
              minHeight: '44px',
              fontFamily: 'var(--font-ui)', fontSize: '13px',
              color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '3px',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Connect later
          </button>
        )}
      </div>
    </div>
  )
}

// ── PUSH-ONBOARD: push permission ceremony ─────────────────────────────────
// Third step in the onboarding gate sequence (Orientation → Connect Runs → here).
// Matches ConnectRunsScreen layout exactly. Stamps push_permission_seen so it
// never re-appears. Denial and skip both stamp false — iOS can't re-prompt once
// denied; user can re-enable from Me → Notifications.

function PushOnboardingScreen({ onEnabled, onSkip }: {
  onEnabled: () => void
  onSkip: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function stampFlag(value: boolean) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        push_permission_seen: value,
        updated_at: new Date().toISOString(),
      })
    } catch {}
  }

  async function enableNotifications() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const perm = await PushNotifications.requestPermissions()
      if (perm.receive !== 'granted') {
        // iOS denied — stamp false so the screen doesn't reappear.
        // User needs Settings → {BRAND.name} → Notifications to reverse this.
        await stampFlag(false)
        setDenied(true)
        setBusy(false)
        return
      }
      try { localStorage.removeItem(PUSH_OFF_KEY) } catch {}
      const token = await getDeviceToken()
      const res = await authedFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'ios', token, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`)
      await stampFlag(true)
      onEnabled()
    } catch (e: any) {
      console.warn('[push onboarding] failed:', e)
      setError(`Couldn't set up notifications. Skip for now — try from Me later.`)
    } finally {
      setBusy(false)
    }
  }

  async function skip() {
    if (busy) return
    setBusy(true)
    try {
      await stampFlag(false)
      onSkip()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      height: '100dvh', overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'safe center',
      background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
      padding: '32px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ marginBottom: '6px' }}>
        <Wordmark size="md" />
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '48px' }}>
        {BRAND.voiceAnchor}
      </div>

      <div style={{ width: '100%', maxWidth: '340px' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.25, marginBottom: '10px' }}>
          {BRAND.notify.ask}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '32px' }}>
          {denied
            ? `Notifications are blocked. Go to Settings → ${BRAND.name} → Notifications to enable them.`
            : BRAND.notify.subline}
        </div>

        {!denied && (
          <button
            onClick={enableNotifications}
            disabled={busy}
            style={{
              width: '100%',
              background: 'var(--moss)', color: 'var(--card)',
              border: 'none', borderRadius: '12px',
              padding: '14px 16px',
              minHeight: '52px',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            }}
          >
            {/* Bell icon — same roundel pattern as ConnectRunsScreen */}
            <span style={{
              width: '24px', height: '24px', borderRadius: '7px',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '13px',
            }}>
              🔔
            </span>
            {busy ? 'Setting up…' : 'Enable Notifications'}
          </button>
        )}

        {error && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--warn)', lineHeight: 1.55, marginTop: '12px' }}>
            {error}
          </div>
        )}

        <button
          onClick={skip}
          disabled={busy}
          style={{
            width: '100%', background: 'none', border: 'none',
            padding: '14px 0',
            marginTop: denied ? '0' : '8px',
            minHeight: '44px',
            fontFamily: 'var(--font-ui)', fontSize: '13px',
            color: 'var(--text-muted)', textDecoration: 'underline', textUnderlineOffset: '3px',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {denied ? 'Continue without notifications.' : "Skip for now."}
        </button>
      </div>
    </div>
  )
}

// ── Shared header ─────────────────────────────────────────────────────────

// ── NOTIFICATIONS SCREEN (NOTIF-01) ───────────────────────────────────────
// Reverse-chron inbox of every push the app sent. Read-only. Opening it marks
// everything read (clears the bell). Tapping a row navigates to its deep link.
// One job: show Kit's messages and let the user jump to what they're about.

// Relative timestamp for a notification row: just-now / Nm / Nh today, then
// weekday within the last week, then day-month.
function formatNotifTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m`
  if (d.toDateString() === now.toDateString()) return `${Math.floor(min / 60)}h`
  if (diffMs < 7 * 86400000) return d.toLocaleDateString('en-GB', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function NotificationsScreen({ onBack, onNavigate, onAllRead }: {
  onBack: () => void
  onNavigate: (url: string | null) => void
  onAllRead: () => void
}) {
  const supabase = createClient()
  const [items, setItems] = useState<NotificationItem[] | null>(null) // null = loading

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) setItems([]); return }
        const { data } = await supabase
          .from('notifications')
          .select('id, type, title, body, url, read_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
        if (cancelled) return
        const rows = (data ?? []) as NotificationItem[]
        setItems(rows)
        // Mark everything read — clears the bell. Loaded rows keep their unread
        // styling for this view (already in state); gone next visit.
        if (rows.some(r => !r.read_at)) {
          await supabase.from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .is('read_at', null)
          onAllRead()
        }
      } catch {
        if (!cancelled) setItems([])
      }
    })()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const backBtn = (
    <button onClick={onBack} aria-label="Back" style={{
      width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-soft)',
      border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink)', flexShrink: 0,
    }}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )

  // Split into Today vs Earlier (loaded list only).
  const todayStr = new Date().toDateString()
  const today: NotificationItem[]   = []
  const earlier: NotificationItem[] = []
  for (const it of items ?? []) {
    (new Date(it.created_at).toDateString() === todayStr ? today : earlier).push(it)
  }

  const renderRow = (it: NotificationItem) => (
    <NotificationRow
      key={it.id}
      item={it}
      relativeTime={formatNotifTime(it.created_at)}
      onClick={it.url ? () => onNavigate(it.url) : undefined}
    />
  )

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <div style={{ padding: '16px 16px 0' }}>{backBtn}</div>
      <ScreenHeader title="Notifications" />

      {items === null ? (
        // Loading — static skeleton rows matching the row shape (no spinner).
        <div aria-busy="true" style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
              padding: '13px 16px 14px 18px', minHeight: '64px',
            }}>
              <div style={{ width: '38%', height: '9px', borderRadius: '3px', background: 'var(--bg-soft)', marginBottom: '10px' }} />
              <div style={{ width: '70%', height: '11px', borderRadius: '3px', background: 'var(--bg-soft)', marginBottom: '7px' }} />
              <div style={{ width: '90%', height: '10px', borderRadius: '3px', background: 'var(--bg-soft)' }} />
            </div>
          ))}
        </div>
      ) : (today.length + earlier.length) === 0 ? (
        // Empty state — Pattern 8, Zonna voice.
        <div style={{ padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
            Nothing from Kit yet.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.5, maxWidth: '260px', margin: '0 auto' }}>
            Coaching notes, plan changes, and your weekly review land here.
          </div>
        </div>
      ) : (
        <div style={{ paddingBottom: '24px' }}>
          {today.length > 0 && (
            <>
              <SectionLabel>Today</SectionLabel>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {today.map(renderRow)}
              </div>
            </>
          )}
          {earlier.length > 0 && (
            <>
              <SectionLabel>Earlier</SectionLabel>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {earlier.map(renderRow)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ScreenHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ padding: '16px 16px 8px' }}>
      <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-ui)', letterSpacing: '-0.5px' }}>{title}</div>
      {sub && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '3px', letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  )
}

// ── Section label ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 16px', marginBottom: '8px', marginTop: '20px' }}>
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
// Extracted to lib/coaching/completionCopy.ts so the share-image OG route
// (SAVE-IMG-01) can render the same lines server-side.

// ── Zonna REFLECT RESPONSE ────────────────────────────────────────────────

function getReflectResponse(sessionType: string, rpe: number | null, fatigueTag: string | null): string {
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
  if (reason === 'Injury / illness') return "Right call. Don't push it."
  if (reason === 'Too tired') return "Body talking. Worth listening."
  if (reason === 'Life got busy') return "Life counts. Pick it back up."
  if (reason === 'Bad weather') return "It'll be there tomorrow."
  return "Fair enough. Pick it back up."
}

// Session voice lines live in lib/coaching/voiceLines.ts (HOOK-01).
// Same job as Today's hero ("10km, slowly.") — Zonna voice in the moment.

// ── COACHING FLAG ─────────────────────────────────────────────────────────
// getCoachingFlag imported from lib/coaching/coachingFlag.ts

// ── SESSION POPUP ─────────────────────────────────────────────────────────

function SessionPopupInner({ session, weekTheme, weekN, preloadedRuns, onClose, onSaved, preferredUnits, zone2Ceiling, preferredMetric, onSessionMetricChange, savedMetricOverride = null, restingHR, maxHR, aerobicPace, stravaLoading, hasPaidAccess, onUpgrade, goalPace, guidance, onLinkedComplete, autoMatch }: {
  session: any; weekTheme: string; weekN: number; preloadedRuns: any[]
  onClose: () => void; onSaved?: () => void
  preferredUnits: 'km' | 'mi'; zone2Ceiling: number | null; preferredMetric?: 'distance' | 'duration'
  onSessionMetricChange?: (weekN: number, sessionKey: string, metric: 'distance' | 'duration' | null) => void
  /** Current per-session override for this session from the DB-backed parent map
   *  (ADR-015). Seeds the toggle; null = no override (plan default / global). */
  savedMetricOverride?: 'distance' | 'duration' | null
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
  stravaLoading?: boolean
  hasPaidAccess?: boolean; onUpgrade?: () => void
  goalPace?: string | null
  guidance?: any | null
  /**
   * Called instead of opening the Reflect view when a Strava-linked completion
   * is confirmed. Closes the popup and routes the user to PostRunScreen, where
   * the LLM "Read of your run" + RPE/fatigue collection happens. POST-RUN-01.
   */
  onLinkedComplete?: (data: PostRunData) => void
  /**
   * Best Strava activity match for this session — computed by the parent from
   * `preloadedRuns` + plan dates. AUTO-MATCH-02 surfaces both confidence tiers:
   *   - `high` (≥70): "Log this run" filled-moss CTA, treats tap as confirmation.
   *   - `medium` (≥40): "Looks like this one?" outline CTA, same handler, but
   *     the question framing + softer styling sets expectations.
   * `low` candidates are not passed through — too noisy. Null when no match.
   * POST-RUN-01 set the high-only baseline; AUTO-MATCH-02 added medium.
   */
  autoMatch?: { activity: any; confidence: 'high' | 'medium' } | null
}) {
  const [view, setView] = useState<'detail' | 'complete' | 'skip' | 'success' | 'reflect' | 'skip-reflect'>('detail')
  const [showManualModal, setShowManualModal] = useState(false)
  // DS-07 Part B — "Add another effort" opens the manual modal in accumulate mode
  // (the entered distance is added on top of the logged total, not a replacement).
  const [manualAccumulate, setManualAccumulate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null)
  const [claimedIds, setClaimedIds] = useState<Set<number>>(new Set())
  const [freshRuns, setFreshRuns] = useState<any[]>([])
  // LEDGER-01 / DOCTRINE-01 — when the discipline ledger advanced this week,
  // SessionCompleteCard surfaces BRAND.brandStatement quietly below the
  // voice anchor. Hook handles its own fetch + cancellation.
  const ledgerSnapshot = useDisciplineLedger()
  const [loadingClaimed, setLoadingClaimed] = useState(false)
  // Picker load errors used to disappear into `catch {} finally {}` and the
  // user just saw "No activities found" — same UI as a legitimate empty list.
  // Surface failures explicitly so silent fetch breakage stops looking like
  // missing data. Layer 2 of the sync fix.
  const [claimedError, setClaimedError] = useState<string | null>(null)
  const [zoneSheetOpen, setZoneSheetOpen] = useState(false)
  const [rpe, setRpe] = useState<number | null>(null)
  const [fatigueTag, setFatigueTag] = useState<string | null>(null)
  const [savingRPE, setSavingRPE] = useState(false)
  const [reflectResponse, setReflectResponse] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState<string | null>(null)
  // Staged activity link — set in saveCompletion, fired in handleReflectDone so
  // RPE + fatigue are already in the DB when analyse-run reads the completion row.
  const pendingLinkRef = useRef<number | null>(null)
  const [sessionMetric, setSessionMetric] = useState<'distance' | 'duration' | null>(savedMetricOverride)
  const supabase = createClient()
  const sessionDefault = session.primary_metric ?? preferredMetric ?? 'distance'
  const effectiveMetric = sessionMetric ?? sessionDefault
  const isMetricCustom = sessionMetric !== null && sessionMetric !== sessionDefault

  // Seed from the DB-backed parent override (ADR-015) — no localStorage. Tracks
  // changes if the parent map updates while the screen is open.
  useEffect(() => {
    setSessionMetric(savedMetricOverride ?? null)
  }, [savedMetricOverride])

  function updateSessionMetric(m: 'distance' | 'duration' | null) {
    setSessionMetric(m)
    // Lift to DashboardClient, which updates the shared map AND persists to the
    // DB so collapsed cards, other devices, and notifications all agree.
    onSessionMetricChange?.(weekN, session.key, m)
  }

  const isPast = session.isPast
  const completion = session.completion
  const isComplete = completion?.status === 'complete'
  // DS-07 Part A — a completion logged by hand (no linked Strava/HealthKit
  // activity). "Update log" on one of these opens the manual editor pre-filled,
  // not the activity picker (which has nothing to link).
  const isManualCompletion = isComplete
    && !completion?.strava_activity_id
    && !completion?.apple_health_uuid
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
        sessionType: coachingSessionType(session),
        rpe: newRpe,
        avgHr: completion?.avg_hr ?? null,
        zone2Ceiling: zone2Ceiling ?? undefined,
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
      if (newRpe != null && newRpe >= 8 && (session.type === 'easy' || isLongRun(session))) {
        void authedFetch('/api/adjust-plan', { method: 'POST', body: JSON.stringify({ rpe: newRpe, sessionType: coachingSessionType(session) }) })
      }
      onSaved?.()
    } catch {} finally { setSavingRPE(false) }
  }

  useEffect(() => {
    if (view !== 'complete') return
    async function loadClaimed() {
      setLoadingClaimed(true)
      setClaimedError(null)
      try {
        const [completionsRes, activitiesRes] = await Promise.all([
          supabase
            .from('session_completions')
            .select('strava_activity_id, apple_health_uuid')
            .or('strava_activity_id.not.is.null,apple_health_uuid.not.is.null'),
          // Re-query strava_activities to pick up runs ingested after the boot-time
          // snapshot in preloadedRuns (race: CapacitorBoot.syncOnAppOpen writes the
          // run concurrently with DashboardClient.fetchSettings reading the DB).
          // No explicit user_id filter — RLS (auth.uid() = user_id) handles scoping.
          supabase
            .from('strava_activities')
            .select('apple_health_uuid, strava_activity_id, source, name, start_date, distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, avg_speed, elevation_gain')
            .order('start_date', { ascending: false })
            .limit(100),
        ])

        // Supabase returns `.error` on RLS / query failures without throwing.
        // The old `catch {}` block missed these entirely — the picker showed
        // "No activities found" against a real DB error. Treat as failure.
        if (completionsRes.error || activitiesRes.error) {
          const msg = completionsRes.error?.message || activitiesRes.error?.message || 'Unknown error'
          console.error('[picker] load failed', msg)
          setClaimedError(msg)
          return
        }

        const ids = new Set<any>()
        ;(completionsRes.data ?? []).forEach((r: any) => {
          if (r.strava_activity_id != null) ids.add(r.strava_activity_id)
          if (r.apple_health_uuid != null) ids.add(r.apple_health_uuid)
        })
        setClaimedIds(ids)

        // Marshal fresh DB rows into the same shape the picker consumes.
        // Dedup against preloadedRuns so a run already in the boot snapshot
        // isn't shown twice.
        const preloadedHkIds  = new Set(preloadedRuns.filter((r: any) => r.source === 'apple_health').map((r: any) => r.apple_health_uuid))
        const preloadedStrIds = new Set(preloadedRuns.filter((r: any) => r.source !== 'apple_health').map((r: any) => String(r.id)))
        const extras = (activitiesRes.data ?? [])
          .filter((r: any) => {
            if (r.source === 'apple_health') return r.apple_health_uuid && !preloadedHkIds.has(r.apple_health_uuid)
            return r.strava_activity_id != null && !preloadedStrIds.has(String(r.strava_activity_id))
          })
          .map((r: any) => r.source === 'apple_health'
            ? {
                id:                   r.apple_health_uuid,
                source:               'apple_health' as const,
                apple_health_uuid:    r.apple_health_uuid,
                type:                 'Run',
                sport_type:           'Run',
                name:                 r.name ?? 'Apple Health run',
                start_date:           r.start_date,
                distance:             r.distance_m ?? 0,
                moving_time:          r.moving_time_s ?? 0,
                elapsed_time:         r.elapsed_time_s ?? r.moving_time_s ?? 0,
                total_elevation_gain: r.elevation_gain ?? 0,
                average_heartrate:    r.avg_hr ?? undefined,
                max_heartrate:        r.max_hr ?? undefined,
                average_speed:        r.avg_speed ?? undefined,
              }
            : {
                id:                   r.strava_activity_id,
                source:               'strava' as const,
                type:                 'Run',
                sport_type:           'Run',
                name:                 r.name ?? 'Run',
                start_date:           r.start_date,
                distance:             r.distance_m ?? 0,
                moving_time:          r.moving_time_s ?? 0,
                elapsed_time:         r.elapsed_time_s ?? r.moving_time_s ?? 0,
                total_elevation_gain: r.elevation_gain ?? 0,
                average_heartrate:    r.avg_hr ?? undefined,
                max_heartrate:        r.max_hr ?? undefined,
                average_speed:        r.avg_speed ?? undefined,
              }
          )
        setFreshRuns(extras)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[picker] load threw', msg)
        setClaimedError(msg)
      } finally { setLoadingClaimed(false) }
    }
    loadClaimed()
  }, [view])

  const stravaRuns = [...preloadedRuns, ...freshRuns].filter((r: any) => {
    if (claimedIds.has(r.id) && r.id !== completion?.strava_activity_id && r.id !== completion?.apple_health_uuid) return false
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

  async function saveCompletion(status: 'complete' | 'skipped', overrideActivity?: any) {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // POST-RUN-01: override path lets the on-demand matcher pass an activity
      // synchronously (state updates are async — using selectedActivity alone
      // would race the next render).
      const activity = overrideActivity ?? selectedActivity
      // Source-link fields. A bare manual "complete" (no activity selected) must
      // NOT clobber a link that auto-match already attached (POST-RUN-01) — that
      // wiped the Strava run + its HR off the day. So: clear the link on skip,
      // write it when we actually have an activity, and otherwise OMIT the fields
      // entirely so the upsert preserves whatever's already on the row.
      const linkFields =
        status === 'skipped'
          ? { strava_activity_id: null, apple_health_uuid: null, strava_activity_name: null, strava_activity_km: null, avg_hr: null }
          : activity
            ? {
                // Source-aware link column: HealthKit runs key on
                // apple_health_uuid, Strava runs on strava_activity_id.
                ...(activity.source === 'apple_health'
                  ? { apple_health_uuid: activity.apple_health_uuid ?? activity.id }
                  : { strava_activity_id: activity.id ?? null }),
                strava_activity_name: activity.name ?? null,
                strava_activity_km:   +(activity.distance / 1000).toFixed(1),
                avg_hr:               activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
              }
            : {}
      await supabase.from('session_completions').upsert({
        user_id: user.id,
        week_n: weekN,
        session_day: session.key,
        status,
        ...linkFields,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })

      // Stage the activity link. For the manual-link path through Reflect this
      // ref fires on Reflect close (legacy flow). For the new POST-RUN-01 path
      // it's handed to PostRunScreen via onLinkedComplete and fired on mount.
      if (status === 'complete' && activity?.id) {
        pendingLinkRef.current = activity.id
      }

      onSaved?.()
      if (status === 'complete') {
        // POST-RUN-01: Strava-linked completions route to PostRunScreen — the
        // LLM analysis is the focal payoff, not a tap-back-to-find-it artifact.
        // Manual completions (no activity) still flow through the Reflect view.
        if (activity?.id && onLinkedComplete) {
          pendingLinkRef.current = null  // PostRunScreen takes ownership of the link fire
          const isHK = activity.source === 'apple_health'
          onLinkedComplete({
            session,
            weekN,
            pendingActivityId:      isHK ? null : activity.id,
            pendingAppleHealthUuid: isHK ? (activity.apple_health_uuid ?? activity.id) : null,
            linkedActivity: {
              name: activity.name ?? 'Run',
              km: typeof activity.distance === 'number'
                ? activity.distance / 1000
                : null,
            },
          })
          return
        }
        setView('reflect')
      } else {
        setView('skip-reflect')
      }
    } catch {} finally { setSaving(false) }
  }

  // POST-RUN-01 / AUTO-MATCH-02: when the parent has computed a Strava match
  // (high OR medium), tapping the primary CTA logs against that activity and
  // routes to PostRunScreen. Medium confirms-by-tap because the button label,
  // run name, distance and timestamp are all visible — tapping is consent.
  // Falls back to the manual picker when no match (or for non-run sessions).
  function handleMarkComplete() {
    const isRun = ['easy', 'run', 'quality', 'race'].includes(session.type)
    // RESHAPE-FIX-WAVE2B (Defect 10): non-run sessions previously dropped
    // straight into saveCompletion('complete') with no activity, no RPE,
    // no fatigue tag — a bare-stub row that the engine then treated as a
    // verified done session. Route through reflect instead so RPE +
    // body state are collected before the row is created. saveReflect's
    // upsert creates the row on first chip-tap with full metadata.
    if (!isRun) { setView('reflect'); return }
    if (autoMatch) {
      void saveCompletion('complete', autoMatch.activity)
      return
    }
    setView('complete')
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
      ;(async () => {
        try {
          // Check res.ok — authedFetch resolves (not rejects) on 4xx/5xx, so a
          // server failure must be read off the response, not the catch.
          const res = await authedFetch('/api/strava/link-activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              strava_activity_id: actId,
              week_n: weekN,
              session_day: session.key,
            }),
          })
          if (!res.ok) {
            console.error('[reflect] link-activity failed', res.status, await res.text().catch(() => ''))
          }
        } catch (e) {
          console.error('[reflect] link-activity threw', e)
        }
      })()
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
        {/* Compact logged-confirmation header. The SessionCompleteCard below
            owns the completion copy + voice anchor as the peak-end artefact
            once the runner has entered RPE; this row just acknowledges the
            save instantly so they know the action landed. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--teal-soft)', border: '0.5px solid var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7L5.5 10L11.5 4" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Logged.</div>
        </div>

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
                  setReflectResponse(getReflectResponse(session.type, newRpe, fatigueTag))
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
                  if (!reflectResponse) setReflectResponse(getReflectResponse(session.type, rpe, newTag))
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

        {/* COMPLETE-01 — peak-end artefact. Renders once RPE is set so the
            card has something to display. Always State B in this view: the
            manual completion path doesn't have a run_analysis row at log
            time (the rule engine writes one asynchronously after the route
            call). Strava/HealthKit-matched completions surface a State A
            card inside PostRunScreen instead. */}
        {rpe !== null && (
          <>
            <div style={{ marginBottom: '12px' }}>
              <SessionCompleteCard
                sessionType={session.type}
                date={new Date()}
                completionCopy={copy}
                zonePct={null}
                rpe={rpe}
                fatigueTag={fatigueTag}
                ledgerAdvancedThisWeek={ledgerSnapshot?.advancedThisWeek ?? false}
              />
            </div>
            {/* SAVE-IMG-01 — Save image button. Lives OUTSIDE the card
                surface so a user-initiated iOS screenshot frames the card
                cleanly. The route renders the same artefact at higher
                fidelity (1080×1920 PNG via next/og). */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <SaveImageButton weekN={weekN} sessionDay={session.key} />
            </div>
          </>
        )}

        {/* POST-RUN-REFRAME-01 — optional reflection + AI reframe.
            Paid-only. Sits between the structured RPE/fatigue inputs and the
            static reflectResponse one-liner. When a reframe is generated, it
            shows alongside the static line, not instead of it. */}
        {hasPaidAccess && rpe !== null && (
          <ReflectionInput weekN={weekN} sessionDay={session.key} />
        )}

        {/* Zonna response */}
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
            Upgrade to unlock zone coaching.{' '}
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
                        body: JSON.stringify({ skipReason: reason, sessionType: coachingSessionType(session), sessionDay: session.key }),
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
      <div style={{ padding: '14px 18px 16px 18px', borderBottom: '1px solid var(--line)' }}>
        {/* Date + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', letterSpacing: '0.02em' }}>
            {session.day} · {session.date}
          </span>
          {isComplete && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: 'var(--moss-soft)', color: 'var(--moss)', border: '1px solid var(--moss-mid)', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Done</span>}
          {isSkipped && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: 'var(--bg-soft)', color: 'var(--mute)', border: '1px solid var(--line)', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skipped</span>}
        </div>
        {/* ── ZONE PRESCRIPTION CARD ──────────────────────────────────
            The biggest single element on the screen besides the title —
            Session Detail exists to sell the prescription. Whole card is
            the tap target for ZoneInfoSheet (the education popup that used
            to hang off the now-removed HR tile). ⓘ in the eyebrow row
            signals drill-down. Renders only for zone-bearing sessions. */}
        {(() => {
          const zone = zoneNumberForType(session.type)
          if (!zone) return null
          const hrDisplay = getSessionHRDisplay(session.type, session.hr_target, restingHR ?? null, maxHR ?? null, zone2Ceiling ?? undefined)
          const isInteractive = !!zoneForSessionType(session.type)
          return (
            <button
              type="button"
              onClick={() => { if (isInteractive) setZoneSheetOpen(true) }}
              aria-label={isInteractive ? `Zone ${zone} — tap to learn` : `Zone ${zone}`}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                marginBottom: '14px',
                background: 'var(--card)',
                border: '1px solid var(--line)',
                borderLeft: `3px solid ${config.color}`,
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px 12px',
                cursor: isInteractive ? 'pointer' : 'default',
                fontFamily: 'inherit',
              }}
            >
              {/* Hold the zone eyebrow + ⓘ affordance */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                marginBottom: '6px',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--moss)',
                  animation: 'ai-mark-pulse 2.4s ease-in-out infinite',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                  color: 'var(--moss)',
                  letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>Hold the zone</span>
                {isInteractive && (
                  <span style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-ui)', fontSize: '11px',
                    color: 'var(--moss)', opacity: 0.7,
                    lineHeight: 1,
                  }}>ⓘ</span>
                )}
              </div>
              {/* Big zone label */}
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 800,
                color: config.color, letterSpacing: '-0.015em', lineHeight: 1.1,
                marginBottom: '4px',
              }}>
                Zone {zone} · {zoneShortName(zone)}
              </div>
              {/* HR range as supporting detail */}
              {hrDisplay && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px',
                  color: 'var(--mute)', marginBottom: '10px',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {hrDisplay} bpm
                </div>
              )}
              {/* Labelled zone bar */}
              <ZoneBar activeZone={zone} height={5} showLabels />
            </button>
          )
        })()}

        {/* ── VOICE LINE ─────────────────────────────────────────────
            One-sentence Zonna voice anchor under the prescription card.
            Same job as Today's hero — voice in the moment. Session-type-aware. */}
        {(() => {
          const voice = getSessionVoiceLine(session.type)
          if (!voice) return null
          return (
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '13px',
              color: 'var(--ink-2)', lineHeight: 1.5,
              padding: '0 4px', marginBottom: '14px',
            }}>
              {voice}
            </div>
          )
        })()}

        {/* ── METRIC GRID ────────────────────────────────────────────
            2-up: Distance/Duration + Pace. HR tile removed — the prescription
            card above owns Zone + HR + ZoneBar (no more duplicate rendering). */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* Primary metric card with per-session toggle */}
          {(estimatedDistance || estimatedDuration) && ['easy','run','quality','intervals','hard','tempo','long','race','recovery'].includes(session.type) && (
            <div style={{ background: `${config.color}10`, borderRadius: '10px', padding: '10px 12px', border: `1px solid ${config.color}30` }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: config.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {effectiveMetric === 'distance' ? 'Distance' : 'Duration'}
                {isMetricCustom && (
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--line)', borderRadius: '4px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>custom</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: config.color, lineHeight: 1, marginBottom: '6px' }}>
                {effectiveMetric === 'distance'
                  ? <>{formatDistance(estimatedDistance, preferredUnits, { noSuffix: true, exact: session.type === 'race' }) ?? '—'}<span style={{ fontSize: '11px', fontWeight: 400, color: config.color, opacity: 0.7 }}> {preferredUnits}</span></>
                  : <span style={{ fontSize: '18px' }}>{estimatedDuration ?? '—'}</span>
                }
              </div>
              {/* Toggle */}
              <div style={{ display: 'flex', background: 'var(--bg-soft)', borderRadius: '6px', padding: '2px', width: 'fit-content', border: '1px solid var(--line)' }}>
                {(['distance', 'duration'] as const).map(m => (
                  <button key={m} onClick={() => updateSessionMetric(m === effectiveMetric && isMetricCustom ? null : m)} style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', padding: '3px 9px', borderRadius: '4px', border: 'none', background: effectiveMetric === m ? config.color : 'none', color: effectiveMetric === m ? 'var(--card)' : 'var(--mute)', cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s' }}>
                    {m === 'distance' ? preferredUnits : 'min'}
                  </button>
                ))}
              </div>
              {isMetricCustom && (
                <button onClick={() => updateSessionMetric(null)} style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--warn)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0', textDecoration: 'underline', textAlign: 'left' }}>
                  Reset to global
                </button>
              )}
            </div>
          )}
          {/* Pace card — render only when pace is available; no skeleton noise while loading */}
          {paceBracket && (
            <div style={{ background: 'var(--card)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Est. pace</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>~{paceBracket}</div>
              {paceSource === 'plan' && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', marginTop: '6px' }}>Pace target</div>
              )}
            </div>
          )}
          {/* Duration tile for strength sessions (no zone, no pace) */}
          {session.type === 'strength' && (
            <div style={{ background: 'var(--card)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--line)' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Duration</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>{estimatedDuration ?? '45min'}</div>
            </div>
          )}
        </div>
      </div>

      {view === 'detail' && (
        <>
          {/* ── EXECUTION SUMMARY: planned vs actual — only when complete with actuals ── */}
          {isComplete && (
            completion?.strava_activity_km || completion?.avg_hr || completion?.rpe != null ||
            completion?.apple_health_uuid != null || completion?.strava_activity_id != null
          ) && (() => {
            const plannedZone = (session.zone as string | undefined) ?? (
              session.type === 'recovery' ? 'Zone 1' :
              session.type === 'easy' || session.type === 'run' || isLongRun(session) ? 'Zone 2' :
              session.type === 'quality' || session.type === 'tempo' ? 'Zone 3' :
              session.type === 'intervals' || session.type === 'hard' ? 'Zone 4–5' : null
            )
            // ADR-011: strava_activities is the SOR for activity metrics. Read
            // distance, HR, and duration from preloadedRuns rather than from
            // session_completions denormalised copies — those can be null when
            // the first sync had incomplete data (watch hadn't finished uploading
            // HR). session_completions owns only RPE, fatigue, and link IDs.
            const linkedRun = Array.isArray(preloadedRuns)
              ? preloadedRuns.find((r: any) =>
                  (completion?.apple_health_uuid && r.id === completion.apple_health_uuid) ||
                  (completion?.strava_activity_id && r.id === completion.strava_activity_id)
                )
              : null
            const actualDistKm   = linkedRun
              ? +(linkedRun.distance_m / 1000).toFixed(1)
              : (completion?.strava_activity_km ?? null)
            const actualAvgHr    = completion?.avg_hr ?? (linkedRun?.avg_hr as number | null | undefined) ?? null
            const actualDuration = linkedRun?.moving_time_s
              ? fmtDurationMins(Math.round((linkedRun.moving_time_s as number) / 60))
              : null
            const isZoneBreach = actualAvgHr != null && zone2Ceiling != null &&
              actualAvgHr > zone2Ceiling &&
              ['easy', 'run', 'long', 'recovery'].includes(session.type)
            const flag = completion?.coaching_flag as string | null | undefined
            return (
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

                  {/* Planned column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Planned</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {(estimatedDistance || estimatedDuration) && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)' }}>
                          {effectiveMetric === 'distance' ? (formatDistance(estimatedDistance, preferredUnits, { exact: session.type === 'race' }) ?? '—') : (estimatedDuration ?? '—')}
                        </span>
                      )}
                      {(() => {
                        // Single source of truth: live Karvonen via getSessionHRDisplay,
                        // matching the session-card hero. Falls back to baked hr_target
                        // when restingHR/maxHR are missing. CoachingPrinciples §14, ADR-009.
                        const hrVal = getSessionHRDisplay(session.type, session.hr_target, restingHR ?? null, maxHR ?? null, zone2Ceiling ?? undefined)
                        const hrStr = hrVal ? `${hrVal} bpm` : null
                        const line  = [plannedZone, hrStr].filter(Boolean).join(' · ')
                        if (!line) return null
                        return (
                          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)' }}>
                            {line}
                          </span>
                        )
                      })()}
                      {session.rpe_target != null && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)' }}>
                          RPE {session.rpe_target}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vertical divider */}
                  <div style={{ width: '1px', background: 'var(--line)', alignSelf: 'stretch', flexShrink: 0 }} />

                  {/* Actual column — metrics from strava_activities via linkedRun,
                      RPE from session_completions (user-entered, ADR-011) */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Actual</div>
                      {flag && (
                        <span style={{
                          fontFamily: 'var(--font-ui)', fontSize: '9px', letterSpacing: '0.05em',
                          textTransform: 'uppercase', borderRadius: '4px', padding: '2px 6px',
                          color: flag === 'ok' ? 'var(--moss)' : 'var(--warn)',
                          background: flag === 'ok' ? 'var(--moss-soft)' : 'var(--warn-bg)',
                        }}>
                          {flag === 'ok' ? 'On target' : 'Check this'}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {(effectiveMetric === 'distance' ? actualDistKm : actualDuration) != null && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)' }}>
                          {effectiveMetric === 'distance'
                            ? `${actualDistKm}${preferredUnits}`
                            : actualDuration}
                        </span>
                      )}
                      {actualAvgHr != null && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: isZoneBreach ? 'var(--warn)' : 'var(--ink)' }}>
                          {actualAvgHr} bpm avg
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

          {/* ── WHY THIS SESSION ──────────────────────────────────────
               Moved directly under the prescription/voice/metric block
               (above structure). Brand-defining content reads first.
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
                  renderGuidance(
                    (session.coach_notes as string[]).filter(Boolean).join(' '),
                    guidanceContextFromSession({
                      session,
                      zone2Ceiling: sessionHRBand('easy', restingHR ?? null, maxHR ?? null)?.hi ?? zone2Ceiling,
                      maxHR, restingHR, goalPace,
                    }),
                  )
                ) : guidance ? (
                  renderGuidance(guidance.why, guidanceContextFromSession({
                    session,
                    zone2Ceiling: sessionHRBand('easy', restingHR ?? null, maxHR ?? null)?.hi ?? zone2Ceiling,
                    maxHR, restingHR, goalPace,
                  }))
                ) : null}
              </CoachNoteBlock>
            </div>
          )}

          {/* ── STRUCTURED SESSION (R23 composer) ──────────────────────
               When a structured composer result exists, it is the canonical
               "what to do". The plain `session.detail` description below is
               suppressed in that case — same instruction, two formats. */}
          {(() => {
            const catalogueRow = catalogueRowFor(session)
            const structure = composeSession({ session, catalogueRow, goalPace })
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
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>Session structure</div>
                {partRow('Warm-up', fmtDurationMins(structure.warmup.duration_mins), structure.warmup.zone, structure.warmup.description, 'var(--mute-2)')}
                {structure.strides && (
                  <div style={{ marginLeft: '15px', marginBottom: '10px', paddingLeft: '12px', borderLeft: '1px dashed var(--line)' }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--moss)' }}>
                      Strides — {structure.strides.count} × {structure.strides.duration_secs}s
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.5 }}>{structure.strides.description}</div>
                  </div>
                )}
                {partRow('Main set', fmtDurationMins(structure.main.duration_mins), structure.main.zone, structure.main.description, getSessionColor(session.type ?? 'easy'), true)}
                {structure.race_pace_segment && (
                  <div style={{ marginLeft: '15px', marginBottom: '10px', paddingLeft: '12px', borderLeft: '1px dashed var(--line)' }}>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--ink-2)' }}>
                      Race-pace — {structure.race_pace_segment.duration_pct}% @ {structure.race_pace_segment.pace_target}
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.5 }}>{structure.race_pace_segment.description}</div>
                  </div>
                )}
                {partRow('Cool-down', fmtDurationMins(structure.cooldown.duration_mins), structure.cooldown.zone, structure.cooldown.description, 'var(--mute-2)')}
              </div>
            )
          })()}

          {/* ── DESCRIPTION FALLBACK ──────────────────────────────────
               Renders only when the structured composer didn't — e.g.
               race/rest/strength shapes or sessions without a catalogue row.
               Avoids duplicating the same instruction in two formats. */}
          {session.detail && (() => {
            const catalogueRow = catalogueRowFor(session)
            const structure = composeSession({ session, catalogueRow, goalPace })
            const skipShapes = ['rest', 'race', 'strength']
            const hasStructure = !!structure && !skipShapes.includes(structure.shape)
            if (hasStructure) return null
            return (
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>What to do</div>
                <div style={{ fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.7 }}>{session.detail}</div>
              </div>
            )
          })()}

          {/* Week focus block removed (May 2026) — it is a plan-level statement,
              not a session-level statement. Lives on Plan / Today screens. */}

          {/* ── HOW DID IT FEEL (shown when complete or skipped) ──
               Moved above the sticky CTA — the reflective state outranks
               the corrective action. Was previously rendered below the
               sticky bar, which inverted the layout. */}
          {(isComplete || isSkipped) && (
            <div style={{ padding: '18px 18px 8px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '18px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.2px' }}>
                  How did it feel?
                </div>
                {savingRPE && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)' }}>saving…</span>}
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
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Body feeling</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['Fresh', 'Fine', 'Heavy', 'Wrecked'] as const).map(tag => {
                    const isActive = fatigueTag === tag
                    const tagColor = tag === 'Fresh' ? 'var(--moss)' : tag === 'Fine' ? 'var(--moss)' : tag === 'Heavy' ? 'var(--warn)' : 'var(--danger)'
                    return (
                      <button key={tag} onClick={() => { const next = isActive ? null : tag; setFatigueTag(next); saveRPEFatigue(rpe, next) }}
                        style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '10px 18px', minHeight: '44px', borderRadius: '20px', border: `1px solid ${isActive ? tagColor : 'var(--line)'}`, background: isActive ? `${tagColor}18` : 'transparent', color: isActive ? tagColor : 'var(--mute)', cursor: 'pointer', fontWeight: isActive ? 500 : 400, transition: 'all 0.12s' }}>
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Action buttons — sticky to bottom of scroll container */}
          <div style={{
            position: 'sticky', bottom: 0,
            padding: '12px 18px 16px',
            background: 'var(--card)',
            borderTop: '1px solid var(--line)',
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
                  <>
                    <button
                      onClick={isManualCompletion ? () => setShowManualModal(true) : handleMarkComplete}
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
                    {/* DS-07 Part B — stack a second activity onto a logged run
                        (e.g. hike + treadmill top-up = one session). */}
                    {isComplete && isRunType && (
                      <button
                        onClick={() => { setManualAccumulate(true); setShowManualModal(true) }}
                        style={{
                          flexBasis: '100%', background: 'none', border: 'none',
                          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
                          cursor: 'pointer', padding: '6px 0',
                          textDecoration: 'underline', textUnderlineOffset: '3px',
                        }}
                      >
                        + Add another effort
                      </button>
                    )}
                  </>
                )
              }
              if (!isComplete && !isSkipped) {
                if (isRunType) {
                  // POST-RUN-02 / AUTO-MATCH-02: when a Strava match exists,
                  // commit to it as the primary CTA. High confidence renders as
                  // a confident filled moss button ("Log this run"); medium
                  // renders as an outline question ("Looks like this one?") so
                  // the user reads the run name before tapping. Both call the
                  // same handler — the visible run name + distance + timestamp
                  // make the tap an explicit confirmation either way. The
                  // picker is the "wrong one?" escape.
                  if (autoMatch) {
                    const { activity, confidence } = autoMatch
                    const isHigh = confidence === 'high'
                    const km = typeof activity.distance === 'number'
                      ? activity.distance / 1000
                      : null
                    const distStr = km != null
                      ? `${km.toFixed(1)}${preferredUnits === 'mi' ? 'mi' : 'km'}`
                      : null
                    const startDate = activity.start_date
                      ? new Date(activity.start_date)
                      : null
                    const subline = [
                      activity.name,
                      distStr,
                      formatRelativeTime(startDate),
                    ].filter(Boolean).join(' · ')
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <button
                          onClick={handleMarkComplete}
                          style={{
                            width: '100%',
                            background: isHigh ? 'var(--moss)' : 'transparent',
                            color: isHigh ? 'var(--card)' : 'var(--moss)',
                            border: isHigh ? 'none' : '1px solid var(--moss)',
                            borderRadius: '10px', padding: '13px',
                            fontFamily: 'var(--font-ui)', fontSize: '12px',
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                            cursor: 'pointer', fontWeight: 600,
                            minHeight: '44px',
                          }}
                        >
                          {isHigh ? 'Log this run' : 'Looks like this one?'}
                        </button>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '0 4px',
                          fontFamily: 'var(--font-ui)', fontSize: '11px',
                          color: 'var(--mute)', lineHeight: 1.4,
                        }}>
                          <AIMark
                            size={11}
                            color="var(--moss)"
                            label={isHigh ? 'Run matched by Zonna' : 'Possible match'}
                          />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {subline}
                          </span>
                        </div>
                        {/* Secondary actions — single inline text-link row.
                            For high-confidence auto-match the dominant choice
                            is the moss primary; these three are quiet escapes.
                            For medium ("Looks like this one?"), the same row
                            doubles as the "no, find the right one" path. */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0',
                          marginTop: '2px',
                          fontFamily: 'var(--font-ui)', fontSize: '11px',
                          color: 'var(--mute)',
                        }}>
                          <button
                            onClick={() => setView('complete')}
                            style={{
                              background: 'none', border: 'none', padding: '6px 0',
                              fontFamily: 'inherit', fontSize: 'inherit',
                              color: 'var(--mute)',
                              cursor: 'pointer', textDecoration: 'underline',
                              textUnderlineOffset: '3px', minHeight: '32px',
                            }}
                          >
                            Wrong one?
                          </button>
                          <span style={{ padding: '0 8px', color: 'var(--mute-2)' }}>·</span>
                          <button
                            onClick={() => setShowManualModal(true)}
                            style={{
                              background: 'none', border: 'none', padding: '6px 0',
                              fontFamily: 'inherit', fontSize: 'inherit',
                              color: 'var(--mute)',
                              cursor: 'pointer', textDecoration: 'underline',
                              textUnderlineOffset: '3px', minHeight: '32px',
                            }}
                          >
                            Log manually
                          </button>
                          <span style={{ padding: '0 8px', color: 'var(--mute-2)' }}>·</span>
                          <button
                            onClick={() => setView('skip')}
                            style={{
                              background: 'none', border: 'none', padding: '6px 0',
                              fontFamily: 'inherit', fontSize: 'inherit',
                              color: 'var(--mute)',
                              cursor: 'pointer', textDecoration: 'underline',
                              textUnderlineOffset: '3px', minHeight: '32px',
                            }}
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <>
                      <button onClick={handleMarkComplete} style={{ flex: 1, minWidth: '120px', background: config.color, color: 'var(--card)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600 }}>
                        Match a run
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
                      {/* RESHAPE-FIX-WAVE2B (Defect 10): non-run "Mark as done"
                          previously fired saveCompletion('complete') with no
                          activity / no RPE / no fatigue — producing a bare
                          stub the engine couldn't distinguish from a real
                          session. Routes to reflect now; RPE chip-tap creates
                          the row with metadata via saveReflect. */}
                      <button onClick={() => setView('reflect')} disabled={saving} style={{ flex: 2, background: config.color, color: 'var(--card)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}>
                        Mark as done
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

        </>
      )}

      {/* Strava log view */}
      {view === 'complete' && (
        <div style={{ padding: '16px 18px 24px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px' }}>Link an activity</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Optional — select from recent runs</div>
          {loadingClaimed ? (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>Loading activities...</div>
          ) : claimedError ? (
            // Explicit failure path. Without this branch the same UI rendered
            // for a real load error as for "no matches" — silent breakage was
            // unrecoverable by sight. Honest one-line says what happened and
            // points to the only meaningful next action (retry by reopening).
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--warn)', padding: '12px 0', marginBottom: '8px', lineHeight: 1.5 }}>
              Couldn&apos;t load activities. Tap Back, then try again.
            </div>
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
                        {new Date(run.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · {formatDistance(run.distance / 1000, preferredUnits, { exact: true })} {run.average_heartrate ? `· ${Math.round(run.average_heartrate)} bpm` : ''} · {run.source === 'apple_health' ? 'Apple Health' : 'Strava'}
                      </div>
                    </div>
                    {isSelected && <span style={{ color: 'var(--teal)', fontSize: '16px' }}>✓</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', marginBottom: '8px' }}>No activities found near this session date</div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setView('detail')} style={{ flex: 1, background: 'none', color: 'var(--text-muted)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '14px', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer' }}>Back</button>
            {/* RESHAPE-FIX-WAVE2B (Defect 10): the 2026-06-26 incident's
                phantom completion came from this exact button — tapped
                with no activity selected, it wrote a bare stub the engine
                then displayed as "Long run done on Thursday." Behaviour:
                with an activity selected → save it (existing path). With
                no activity → route to reflect where RPE chip-tap creates
                the row with body-state metadata. No path from this view
                produces a bare stub now. */}
            <button
              onClick={() => selectedActivity ? saveCompletion('complete', selectedActivity) : setView('reflect')}
              disabled={saving}
              style={{ flex: 2, background: config.color, color: 'var(--card)', border: 'none', borderRadius: '10px', padding: '13px', fontFamily: 'var(--font-ui)', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : (selectedActivity ? 'Confirm complete' : 'Log without activity')}
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
          onClose={() => { setShowManualModal(false); setManualAccumulate(false) }}
          onSaved={() => { setShowManualModal(false); setManualAccumulate(false); onSaved?.(); onClose() }}
          sessionName={session.title}
          sessionType={session.type}
          plannedDistanceKm={session.distance_km ?? session.distance ?? undefined}
          plannedDurationMins={session.duration_mins ? Number(session.duration_mins) : undefined}
          loggedDistanceKm={isManualCompletion && !manualAccumulate ? (completion?.strava_activity_km ?? undefined) : undefined}
          isEdit={isManualCompletion && !manualAccumulate}
          accumulate={manualAccumulate}
          existingTotalKm={manualAccumulate ? (completion?.strava_activity_km ?? 0) : undefined}
          existingEffortCount={manualAccumulate ? parseEffortCount(completion?.strava_activity_name) : undefined}
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

/** Single source of truth for "what calendar date does this session fall on?".
 *  Used by TodayScreen.sessions[], PlanScreen, and the missed-session boot scan
 *  so every entry point computes rawDate identically. Picker date-window logic
 *  depends on consistent rawDate construction across paths. */
function computeSessionDate(weekStartDate: Date, dayKey: string): Date {
  const d = new Date(weekStartDate)
  d.setDate(d.getDate() + (DAY_OFFSETS[dayKey] ?? 0))
  return d
}

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
          const isSelected = key === selectedKey
          const isToday = s?.today ?? false
          const dotColor = getDotColor(key)
          const dateNum = s ? s.rawDate.getDate().toString() : ''

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '4px 2px', background: 'none', border: 'none',
                cursor: 'pointer', borderRadius: '12px',
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

/** DS-07 Part B — read the effort count off a composite log's name ("3 efforts · …"). */
function parseEffortCount(name?: string | null): number {
  const m = name?.match(/^(\d+)\s+efforts/)
  return m ? parseInt(m[1], 10) : 1
}

function ManualRunModal({ weekN, sessionKey, preferredUnits, onClose, onSaved, sessionName, sessionType, plannedDistanceKm, plannedDurationMins, loggedDistanceKm, isEdit, accumulate, existingTotalKm, existingEffortCount }: {
  weekN: number
  sessionKey: string | null
  preferredUnits: 'km' | 'mi'
  onClose: () => void
  onSaved: () => void
  sessionName?: string
  sessionType?: string
  plannedDistanceKm?: number
  plannedDurationMins?: number
  /** DS-07 Part A — when editing an existing manual log, the already-logged
   *  distance (stored in km) to pre-fill instead of the planned distance. */
  loggedDistanceKm?: number
  /** DS-07 Part A — true when correcting an existing log (vs first-time logging). */
  isEdit?: boolean
  /** DS-07 Part B — accumulate mode: the entered distance is added on top of the
   *  logged total instead of replacing it (composite effort). */
  accumulate?: boolean
  /** DS-07 Part B — current logged total (km) to add onto. */
  existingTotalKm?: number
  /** DS-07 Part B — efforts already counted on this session (default 1). */
  existingEffortCount?: number
}) {
  // Edit pre-fills the logged distance (converted to the user's unit); first-log
  // pre-fills the planned distance (left raw). Accumulate starts at zero — the
  // runner enters the NEW effort, which is added to the existing total.
  const initDistDisplay = accumulate
    ? 0
    : loggedDistanceKm != null
      ? (preferredUnits === 'mi' ? loggedDistanceKm / 1.60934 : loggedDistanceKm)
      : (plannedDistanceKm ?? null)
  const initWhole   = initDistDisplay != null ? Math.floor(initDistDisplay) : 5
  const initDecimal = initDistDisplay != null ? Math.round((initDistDisplay % 1) * 10) : 0
  const initHours   = plannedDurationMins ? Math.floor(plannedDurationMins / 60) : 0
  const initMinutes = plannedDurationMins ? plannedDurationMins % 60 : 30

  const [distWhole, setDistWhole] = useState(initWhole)
  const [distDecimal, setDistDecimal] = useState(initDecimal)
  const [hours, setHours]   = useState(initHours)
  const [minutes, setMinutes] = useState(initMinutes)
  const [seconds, setSeconds] = useState(0)
  const [notes, setNotes]   = useState('')
  const [avgHr, setAvgHr]   = useState<number | null>(null)   // DS-06 — optional
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

      if (accumulate) {
        // DS-07 Part B — add this effort onto the existing logged total. Preserve
        // any existing activity link (omit strava_activity_id) — the distance
        // becomes the composite aggregate, the name carries the effort count.
        const finalKm   = (existingTotalKm ?? 0) + distKm
        const count     = (existingEffortCount ?? 1) + 1
        const finalDisp = (preferredUnits === 'mi' ? finalKm / 1.60934 : finalKm).toFixed(1)
        await supabase.from('session_completions').upsert({
          user_id: user.id,
          week_n: weekN,
          session_day: key,
          status: 'complete',
          strava_activity_name: `${count} efforts · ${finalDisp}${preferredUnits}`,
          strava_activity_km: +finalKm.toFixed(1),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,week_n,session_day' })
        setSavedStep(true)
        return
      }

      await supabase.from('session_completions').upsert({
        user_id: user.id,
        week_n: weekN,
        session_day: key,
        status: 'complete',
        strava_activity_id: null,
        strava_activity_name: notes || `Manual log · ${distanceStr}${preferredUnits} · ${durationStr}`,
        strava_activity_km: +distKm.toFixed(1),
        // rpe / fatigue_tag intentionally omitted: on a DS-07 edit this upsert
        // must not wipe body-state the runner already logged. New logs leave
        // them null (schema default) and set them in the reflect step below.
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      setSavedStep(true)

      // DS-06 — store the run as a source='manual' row in the activity log (so it
      // counts in history / R25 cohorts / load) and trigger metric scoring
      // (distance/pace + coarse avg-HR read; PAID computes scores, FREE stays
      // RPE-only). Both fire-and-forget: the completion above is the durable
      // "done" state. Deterministic manual_uuid per session → re-logs/edits
      // upsert the same row rather than piling up duplicates.
      const durationS = hours * 3600 + minutes * 60 + seconds
      if (distKm > 0 && durationS > 0) {
        void authedFetch('/api/health/ingest', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source:          'manual',
            manualUuid:      `manual-w${weekN}-${key}`,
            startDate:       new Date().toISOString(),
            distanceMeters:  Math.round(distKm * 1000),
            durationSeconds: durationS,
            avgHeartRate:    avgHr ?? undefined,
            name:            notes || undefined,
          }),
        }).catch(() => {})
        void authedFetch('/api/analyse-run/manual', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            week_n:       weekN,
            session_day:  key,
            session_type: sessionType ?? 'run',
            distance_km:  +distKm.toFixed(2),
            duration_s:   durationS,
            avg_hr:       avgHr ?? null,
          }),
        }).catch(() => {})
      }
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
                      const resp = getReflectResponse(sessionType ?? '', newRpe, fatigueTag)
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
                        const resp = getReflectResponse(sessionType ?? '', rpe, newTag)
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

            {/* Zonna response */}
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
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{accumulate ? 'Add another effort' : isEdit ? 'Update your log' : 'Log a run'}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {accumulate
                    ? `Adds to your ${(preferredUnits === 'mi' ? (existingTotalKm ?? 0) / 1.60934 : (existingTotalKm ?? 0)).toFixed(1)}${preferredUnits} so far`
                    : isEdit ? 'Correct what you logged' : 'Manual entry · no Strava needed'}
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

            {/* Average HR — DS-06, optional. Stored on the run; unlocks a coarse
                zone-discipline read in the coaching card. 16px font avoids the
                iOS focus-zoom trap. */}
            {!accumulate && (
              <div style={{ marginBottom: '20px' }}>
                <div style={labelStyle}>Average HR <span style={{ textTransform: 'none', letterSpacing: 0, opacity: 0.6, fontSize: '10px' }}>optional · bpm</span></div>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  value={avgHr ?? ''}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10)
                    setAvgHr(Number.isFinite(v) ? Math.min(240, Math.max(60, v)) : null)
                  }}
                  style={{
                    width: '100%', background: 'var(--bg)',
                    border: '0.5px solid var(--border-col)', borderRadius: '8px',
                    padding: '12px', color: 'var(--text-primary)',
                    fontFamily: 'var(--font-ui)', fontSize: '16px',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  From your watch or chest strap, if you had one.
                </div>
              </div>
            )}

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

/** Canonical duration display (45 → "45 min", 90 → "1h 30", 120 → "2h").
 *  Delegates to lib/format so the ≥60→hours rule lives in exactly one place
 *  (ADR-015 / INV-FMT-001). Kept as a named local so existing call sites are
 *  unchanged. */
function fmtDurationMins(mins: number): string {
  return formatDuration(mins) ?? ''
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

// TD-READY hero — readiness-led pre-session permission.
//
// When recovery signals (RHR / HRV / sleep) say today is cooked, the plan
// proposes an eased prescription. Default action: "Ease the session" — the
// app gives permission to back off. Override: "Run it anyway →" — never a
// coercive gate; the runner stays in charge. Rule-derived (no AIMark).
//
// Replaces the generic AdjustmentBanner for trigger_type === 'readiness_signal'
// so the call-to-action reads as permission, not as system-prompts-please-confirm.
// Other adjustment types (load_spike, fatigue, etc.) keep using AdjustmentBanner.
//
// CoachingPrinciples §59. PAID gated upstream — the readiness signal route
// returns null for free users, so no pending row is ever written.
function TdReadyHero({ adjustment, onConfirmed, onReverted }: {
  adjustment: any
  onConfirmed?: (plan: any) => void
  onReverted?:  (plan: any) => void
}) {
  const [loading, setLoading] = useState(false)
  const detail = adjustment.trigger_detail ?? {}

  // Compose the reason chips from the boolean signals the engine recorded.
  const reasonChips: string[] = []
  if (detail.isElevatedRHR) reasonChips.push('RHR up')
  if (detail.isLowHRV)      reasonChips.push('HRV down')
  if (detail.isShortSleep)  reasonChips.push('Short sleep')

  async function ease() {
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

  async function runAnyway() {
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
    } catch { /* keep visible on error */ } finally { setLoading(false) }
  }

  return (
    <div style={{
      background:   'var(--card)',
      borderRadius: 'var(--radius-lg)',
      border:       '1px solid var(--line)',
      padding:      '18px 20px 16px 22px',
      position:     'relative',
      marginBottom: '16px',
    }}>
      {/* 3px warn left rail — coaching-warning rail, NOT moss CTA rail.
          Same colour rule as the discipline ledger: rule-derived caution
          uses --warn, never --danger (no red in training UI per INV-DS-005). */}
      <div style={{
        position:     'absolute',
        left:         '8px',
        top:          '14px',
        bottom:       '14px',
        width:        '3px',
        background:   'var(--warn)',
        borderRadius: '2px',
      }} />

      {/* Eyebrow + reason chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
          color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>
          Readiness · easing today
        </span>
        {reasonChips.length > 0 && (
          <>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', opacity: 0.5 }}>·</span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
              {reasonChips.join(' · ')}
            </span>
          </>
        )}
      </div>

      {/* Permission line — the summary IS Kit-voice already (see
          buildReadinessAdjustment in lib/coaching/planAdjustment.ts). */}
      <p style={{
        fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400,
        color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 14px',
      }}>
        {adjustment.summary}
      </p>

      {/* Two actions: ease (primary) + run-anyway (secondary).
          Override stays equally visible — restraint isn't enforced. */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={ease}
          disabled={loading}
          style={{
            background:   'var(--moss)',
            color:        'var(--card)',
            border:       'none',
            borderRadius: '22px',
            padding:      '0 18px',
            minHeight:    '44px',
            fontFamily:   'var(--font-ui)', fontSize: '13px', fontWeight: 600,
            letterSpacing:'0.04em',
            cursor:       loading ? 'default' : 'pointer',
            opacity:      loading ? 0.5 : 1,
          }}
        >
          Ease the session
        </button>
        <button
          onClick={runAnyway}
          disabled={loading}
          style={{
            background:   'transparent',
            color:        'var(--ink-2)',
            border:       'none',
            padding:      '0 12px',
            minHeight:    '44px',
            fontFamily:   'var(--font-ui)', fontSize: '13px', fontWeight: 500,
            cursor:       loading ? 'default' : 'pointer',
            opacity:      loading ? 0.5 : 1,
          }}
        >
          Run it anyway →
        </button>
      </div>
    </div>
  )
}

// ReadinessSteadyChip — the calm/positive half of the SLT TD-READY spec
// (fresh/steady/cooked). When the readiness route returns `all_clear` or
// `no_trigger` with a baseline, render a small chip above the session card
// so the runner sees Kit IS watching, not just hears from him when something
// goes wrong. Tap once to expand the underlying numbers (RHR / HRV / sleep
// vs baseline). Rule-derived — no AIMark per Pattern 16 provenance.
//
// CoachingPrinciples §59. Gated upstream — only the cooked path writes a
// pending row; this chip surfaces the "we ran the check and it's fine" state
// the route already computes but never previously reached the UI.
function ReadinessSteadyChip({ detail }: {
  detail: {
    rhrBaseline?: number; rhrToday?: number
    hrvBaseline?: number; hrvToday?: number; hrvSd?: number
    sleepHours?: number
    samplesUsed?: number
  }
}) {
  const [expanded, setExpanded] = useState(false)

  // Compose individual signal lines only when the underlying numbers exist.
  // Some users will have RHR and sleep but not HRV (depends on watch).
  const lines: string[] = []
  if (detail.rhrToday != null && detail.rhrBaseline != null) {
    lines.push(`RHR ${detail.rhrToday} bpm (baseline ${Math.round(detail.rhrBaseline)})`)
  }
  if (detail.hrvToday != null && detail.hrvBaseline != null) {
    lines.push(`HRV ${detail.hrvToday} ms (baseline ${Math.round(detail.hrvBaseline)})`)
  }
  if (detail.sleepHours != null) {
    lines.push(`Sleep ${detail.sleepHours.toFixed(1)}h`)
  }
  if (lines.length === 0) return null

  return (
    <button
      onClick={() => setExpanded(v => !v)}
      style={{
        width:        '100%',
        background:   'var(--card)',
        border:       '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding:      '10px 14px 10px 16px',
        marginBottom: '8px',
        cursor:       'pointer',
        textAlign:    'left',
        position:     'relative',
      }}
    >
      {/* 3px moss left rail — same coaching-surface rule as elsewhere */}
      <div style={{
        position:     'absolute',
        left:         '8px',
        top:          '10px',
        bottom:       '10px',
        width:        '3px',
        background:   'var(--moss)',
        borderRadius: '2px',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
          color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.12em',
        }}>
          Readiness · steady
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
          {expanded ? '▴' : '▾'}
        </span>
      </div>
      {expanded && (
        <div style={{
          marginTop: '8px',
          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-2)',
          lineHeight: 1.55,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {lines.join(' · ')}
        </div>
      )}
    </button>
  )
}

// AdjustmentBanner — now wraps PendingAdjustmentBanner with API call logic.
// State management lives here (and in DashboardClient), UI delegated to the shared component.
function AdjustmentBanner({ adjustment, onConfirmed, onReverted, preferredUnits = 'km' }: {
  adjustment: any
  onConfirmed?: (plan: any) => void
  onReverted?:  (plan: any) => void
  preferredUnits?: 'km' | 'mi'
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

  // RESHAPE-FIX-WAVE2A — pass the structural diff to the banner so the
  // per-day before/after strip renders under the prose. Defends against
  // the 2026-06-26 incident pattern: AI summary said one thing, diff
  // showed another; the user could only see the prose.
  return (
    <div style={{ margin: '0 0 12px' }}>
      <PendingAdjustmentBanner
        onConfirm={confirm}
        onRevert={revert}
        loading={loading}
        sessionsBefore={adjustment.sessions_before ?? undefined}
        sessionsAfter={adjustment.sessions_after ?? undefined}
        units={preferredUnits}
      >
        {adjustment.summary}
      </PendingAdjustmentBanner>
    </div>
  )
}

// ── ReshapeScreen ─────────────────────────────────────────────────────────────
// User-initiated plan reshape. Calls /api/adjust-plan with manual:true, shows result.

function ReshapeScreen({ plan: _plan, onBack, onReshapeApplied, onChecked, onOpenBenchmark, preferredUnits = 'km' }: {
  plan: Plan | null
  onBack: () => void
  onReshapeApplied: (plan: any) => void
  /** Fired after a successful engine evaluation (manual run). Lets the parent
   *  refresh the "Last checked …" line on the Me screen without a re-fetch. */
  onChecked?: (foundChange: boolean) => void
  /** ENGINE-01 fitness_signal: CTA routes to BenchmarkUpdateScreen. */
  onOpenBenchmark?: () => void
  preferredUnits?: 'km' | 'mi'
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
      if (data.adjustment) { setAdjustment(data.adjustment); setStatus('found'); onChecked?.(true) }
      else { setStatus('clean'); onChecked?.(false) }
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
          {status === 'loading' ? 'Checking your recent sessions for adjustment signals.' : `Here's what ${BRAND.name} found.`}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 24px' }}>
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <style>{`@keyframes zonna-shimmer { 0%,100%{opacity:.3} 50%{opacity:.6} }`}</style>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: '64px', borderRadius: '12px', background: 'var(--line-strong)', animation: 'zonna-shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        )}

        {status === 'found' && adjustment && (
          <>
            <PendingAdjustmentBanner
              onConfirm={adjustment.trigger_type === 'fitness_signal' ? undefined : handleConfirm}
              onRevert={handleDismiss}
              loading={actionLoading}
              sessionsBefore={adjustment.sessions_before ?? undefined}
              sessionsAfter={adjustment.sessions_after ?? undefined}
              units={preferredUnits}
            >
              {adjustment.summary}
            </PendingAdjustmentBanner>
            {/* ENGINE-01: fitness_signal has no plan change — show benchmark CTA instead */}
            {adjustment.trigger_type === 'fitness_signal' && onOpenBenchmark && (
              <button
                onClick={onOpenBenchmark}
                style={{
                  width: '100%', marginTop: '12px', padding: '15px',
                  borderRadius: 'var(--radius-md)', background: 'var(--moss)',
                  border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--card)',
                }}
              >
                Update benchmark →
              </button>
            )}
          </>
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

function TodayScreen({ plan, weekIndex, onWeekChange, quitDays, smokeTrackerEnabled, daysToRace, raceName, preferredMetric, sessionMetricOverrides, stravaRuns, allOverrides, overridesReady, onOpenSession, allCompletions, preferredUnits, zone2Ceiling, onManualSaved, restingHR, maxHR, aerobicPace, stravaLoading, firstName, pendingAdjustment, readinessData, onAdjustmentConfirmed, onAdjustmentReverted, trialDaysLeft, onUpgrade, hasPaidAccess, dailyCoachNote, coachNoteSettled, runAnalysisMap, runAnalysisReady, onOpenCoach, onOpenPostRun, unreadNotifications = 0, onOpenNotifications, showRacePrompt, pendingReshape, nextGoalData, onPickNextGoal, onDismissNextGoal, showMaintCard, onDismissMaintCard, showMaintTransition, maintReengagement, maintThemeLine, onSeeMaintPlan, onAckMaintTransition, onLogRaceResult, onReshapeAccepted, onReshapeDismissed, recalTile }: {
  recalTile?: React.ReactNode
  plan: Plan; weekIndex: number; onWeekChange: (i: number) => void; quitDays: number | null
  smokeTrackerEnabled: boolean; daysToRace: number; raceName: string; preferredMetric: 'distance' | 'duration'
  sessionMetricOverrides: Record<string, 'distance' | 'duration'>
  stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  overridesReady: boolean
  onOpenSession?: (s: any) => void
  allCompletions: Record<number, Record<string, any>>
  preferredUnits: 'km' | 'mi'
  zone2Ceiling: number | null
  onManualSaved?: () => void
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
  stravaLoading?: boolean
  firstName?: string
  pendingAdjustment?: any | null
  /** Captured response from /api/pre-session-readiness — drives the steady chip
   *  on Today (fresh/steady half of the SLT TD-READY spec). Cooked path is on
   *  pendingAdjustment, not here. */
  readinessData?: {
    adjustment?: any | null
    reason?: string
    detail?: {
      rhrBaseline?: number; rhrToday?: number
      hrvBaseline?: number; hrvToday?: number; hrvSd?: number
      sleepHours?: number
      samplesUsed?: number
    }
  } | null
  onAdjustmentConfirmed?: (plan: any) => void
  onAdjustmentReverted?: (plan: any) => void
  trialDaysLeft?: number | null
  onUpgrade?: () => void
  hasPaidAccess?: boolean
  dailyCoachNote?: string | null
  coachNoteSettled?: boolean
  runAnalysisMap?: Record<number, Record<string, any>>
  runAnalysisReady?: boolean
  /** Navigates to the Coach tab — wired to Kit chip on AI-generated notes. */
  onOpenCoach?: () => void
  /** POST-RUN-01: route the retroactive RPE nudge into PostRunScreen. */
  onOpenPostRun?: (data: PostRunData) => void
  /** NOTIF-01: unread count + opener for the bell on the wordmark row. */
  unreadNotifications?: number
  onOpenNotifications?: () => void
  /** AI-DEPTH-08: post-race prompt and reshape card. */
  showRacePrompt?: boolean
  pendingReshape?: ReshapeProposal | null
  nextGoalData?: { achievement: string; options: NextGoalOption[] } | null
  onPickNextGoal?: (opt: NextGoalOption) => void
  onDismissNextGoal?: () => void
  /** MAINT-01 — quiet "Base running" card visible during the maintenance block. */
  showMaintCard?: boolean
  onDismissMaintCard?: () => void
  /** #1 — one-time post-race announcement that the maintenance block is live. */
  showMaintTransition?: boolean
  /** MAINT-07 — runner is in the §75 Phase 3 window (real current week, not the
   *  viewed one: the register follows where they actually are). */
  maintReengagement?: boolean
  /** Rule-engine line for the ongoing maintenance card — the real current week's
   *  `theme`, which is already phase-correct per §75. */
  maintThemeLine?: string
  onSeeMaintPlan?: () => void
  onAckMaintTransition?: () => void
  onLogRaceResult?: () => void
  onReshapeAccepted?: (plan: Plan) => void
  onReshapeDismissed?: () => void
}) {
  const currentWeek = plan.weeks[weekIndex]
  // week_n keyed by canonical week.n, not array position (MAINT-06) — so a
  // standalone maintenance plan keys completions at 26+ not 1. No-op for race plans.
  const weekNum = (currentWeek as any)?.n ?? (weekIndex + 1)
  // Display ordinal (1-indexed array position) — what the user sees ("Week 4"),
  // never the week.n key (which reads "Week 29" on a maintenance plan). ADR-013.
  const weekOrdinal = weekIndex + 1
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

  // MAINT-02 — AI weekly debrief for the viewed maintenance week (PAID; present
  // only when the enricher ran). Distinct from the rule-engine card copy so the
  // provenance byline marks only the model output.
  const maintDebrief =
    currentWeek.phase === 'maintenance_restoration' || currentWeek.phase === 'maintenance_base'
      ? currentWeek.coach_debrief
      : undefined

  // #1 — shape summary for the transition announcement (rule-engine; no AIMark).
  // Days/week from a representative maintenance week; rest/cross-train excluded.
  const maintWeeksAll = plan.weeks.filter(
    w => (w as any).phase === 'maintenance_restoration' || (w as any).phase === 'maintenance_base',
  )
  const maintWeekCount = maintWeeksAll.length
  const maintDaysPerWeek = maintWeekCount
    ? Object.values(maintWeeksAll[0].sessions ?? {}).filter(
        (s: any) => s && s.type !== 'rest' && s.type !== 'cross-train' && s.type !== 'cross_train',
      ).length
    : 0

  // POST-RUN-01: retroactive RPE nudges. Sessions auto-completed via the
  // webhook (strava_activity_id set, status='complete') but missing RPE in the
  // last 7 days. Tap → PostRunScreen with the analysis pre-loaded. Capped at
  // 3 to avoid burying Today.
  const missingRpeNudges = useMemo(() => {
    if (!plan?.weeks?.length) return []
    const now    = new Date()
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const days   = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
    type Nudge = {
      session: any; weekN: number; dayKey: string
      dayName: string; distKm: number | null
      stravaActivityId: number | null; stravaActivityName: string | null
      sessionDate: Date
    }
    const result: Nudge[] = []
    for (const week of plan.weeks) {
      const weekStart = parseLocalDate((week as any).date)
      days.forEach((dayKey, idx) => {
        const completion = allCompletions[week.n]?.[dayKey]
        if (!completion) return
        if (completion.status !== 'complete') return
        if (completion.rpe != null) return
        if (!completion.strava_activity_id && !completion.apple_health_uuid) return
        const sessionDate = computeSessionDate(weekStart, dayKey)
        if (sessionDate < cutoff || sessionDate > now) return
        const session = (week.sessions as Record<string, any> | undefined)?.[dayKey]
        if (!session) return
        result.push({
          session,
          weekN:               week.n,
          dayKey,
          dayName:             dayNames[idx],
          distKm:              completion.strava_activity_km ?? null,
          stravaActivityId:    completion.strava_activity_id ?? null,
          stravaActivityName:  completion.strava_activity_name ?? null,
          sessionDate,
        })
      })
    }
    // Most recent first, max 3
    return result.sort((a, b) => b.sessionDate.getTime() - a.sessionDate.getTime()).slice(0, 3)
  }, [plan, allCompletions])

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
  now.setHours(0, 0, 0, 0)
  const todayDow = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()]
  const weekStartDate = parseLocalDate((currentWeek as any).date)
  const todayStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const ws = (currentWeek as any).sessions ?? {}

  // Pre-start state: viewing the first plan week before its start date.
  // Plans created with a future start date land here on the first open and
  // need different framing — the regular session hero would render the
  // first session ("5km, slowly.") as if today, which falsely implies the
  // user should be running. Gated on weekIndex === 0 so a user swiping to
  // future weeks for a peek doesn't trip the pre-start view.
  const planStartDate = parseLocalDate((plan.weeks[0] as any).date)
  const daysToPlanStart = Math.max(0, Math.ceil((planStartDate.getTime() - now.getTime()) / 86400000))
  const planNotStarted = planStartDate > now && weekIndex === 0

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
    const d = computeSessionDate(weekStartDate, key)
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

  // Default selected day. selectedKey holds the calendar day (displayKey),
  // not the session's originalDay — otherwise a moved session and the now-empty
  // origin day collide on the same key and the lookup picks the wrong entry.
  const [selectedKey, setSelectedKey] = useState<string>(() => {
    const t = sessions.find(s => s.today)
    if (t) return t.displayKey
    const next = sessions.find(s => s.rawDate >= now && effectiveWs[s.displayKey] && effectiveWs[s.displayKey].type !== 'rest')
    if (next) return next.displayKey
    const last = [...sessions].reverse().find(s => effectiveWs[s.displayKey])
    return last?.displayKey ?? 'mon'
  })

  // Reset selected key on week change
  useEffect(() => {
    const t = sessions.find(s => s.today)
    if (t) { setSelectedKey(t.displayKey); return }
    const next = sessions.find(s => s.rawDate >= now && effectiveWs[s.displayKey] && effectiveWs[s.displayKey].type !== 'rest')
    if (next) { setSelectedKey(next.displayKey); return }
    const last = [...sessions].reverse().find(s => effectiveWs[s.displayKey])
    if (last) setSelectedKey(last.displayKey)
  }, [weekIndex, overridesReady, sessions])

  const selectedSession = sessions.find(s => s.displayKey === selectedKey) ?? null
  const selectedEntry = selectedSession ? effectiveWs[selectedSession.displayKey] : null
  // Completion lookups must use the session's originalDay (stable id), not the
  // calendar day — completions are keyed by originalDay so they survive moves.
  const selectedCompletionKey = selectedSession?.key ?? ''

  // R25 Cut #2 — pre-run band: cohort stats for similar past runs shown above
  // today's session card. PAID only. Fires when a today session with a planned
  // distance is selected; silently absent when < 3 similar runs exist.
  const [preRunBand, setPreRunBand] = useState<{ cohortSize: number; avgHr: number | null; avgInZonePct: number | null; medianDistanceKm: number } | null>(null)
  const [preRunBandLoading, setPreRunBandLoading] = useState(false)
  useEffect(() => {
    const PRE_RUN_TYPES = new Set(['easy', 'long', 'run', 'quality', 'tempo', 'intervals', 'recovery'])
    if (!hasPaidAccess || !selectedSession?.today || !PRE_RUN_TYPES.has(selectedSession.type) || !selectedSession.distance) {
      setPreRunBand(null)
      return
    }
    setPreRunBandLoading(true)
    const params = new URLSearchParams({
      session_type: selectedSession.type,
      distance_km:  String(selectedSession.distance),
    })
    authedFetch(`/api/coaching/prerun-band?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { cohort: { cohortSize: number; avgHr: number | null; avgInZonePct: number | null; medianDistanceKm: number } | null } | null) => {
        setPreRunBand(data?.cohort ?? null)
      })
      .catch(() => { setPreRunBand(null) })
      .finally(() => setPreRunBandLoading(false))
  // selectedSession.displayKey changes when user picks a different day
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.displayKey, hasPaidAccess])

  const RUN_TYPES = ['run', 'easy', 'quality', 'race']
  const isRunDay      = selectedEntry && RUN_TYPES.includes(selectedEntry.type)
  const isStrengthDay = selectedEntry?.type === 'strength'
  const showSessionHero = isRunDay || isStrengthDay

  // HR-SYNC-02: per-card retry state. Tracks which apple_health_uuid is
  // currently mid-retry so the matching SessionCard renders the "Checking…"
  // copy. Single key — only one retry can be in flight at a time (matches
  // the throttle behaviour in retryHrFromUi).
  const [retryingForHrUuid, setRetryingForHrUuid] = useState<string | null>(null)
  const handleHrRetry = useCallback(async (uuid: string) => {
    setRetryingForHrUuid(uuid)
    try {
      const { retryHrFromUi } = await import('@/lib/health/clientSync')
      await retryHrFromUi()
    } finally {
      // Brief hold so the "Checking…" state is felt even on instant returns.
      setTimeout(() => setRetryingForHrUuid(cur => (cur === uuid ? null : cur)), 400)
    }
  }, [])

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
    const hasLong    = sessionList.some(s => s && isLongRun(s))
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
  // Show actual % of time spent in each session's PRESCRIBED zone (i.e.
  // Z2 for easy/long, Z3 for tempo, Z4-5 for intervals), weighted by run
  // distance. Until 2026-05-22 the underlying figure was always "% in Z2"
  // regardless of session type — so a perfectly executed tempo run pulled
  // the discipline score down. The figure now honours each session's own
  // prescription. Sessions without run_analysis data (no Strava/HK HR
  // stream) are excluded from the denominator.
  const completedThisWeek = sessions.filter(s =>
    s.type !== 'rest' && completions[s.key]?.status === 'complete'
  )
  const analysisRows = completedThisWeek
    .map(s => {
      const a = runAnalysisMap?.[weekNum]?.[s.key]
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

  return (
    <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ paddingBottom: '32px' }}>

      {/* CONNECT-01 — one-shot reminder banner for users who skipped the
          ConnectRuns ceremony. Self-contained; renders null on the wrong
          platform / state. Dismiss stamps connect_runs_banner_dismissed_at
          so the banner never reappears — the runner can still connect later
          via the Me-screen Apple Health row. */}
      <ConnectRunsBanner />

      {/* PV2-H — recalibration prompt (the living plan). Renders when a recovery-week
          time trial is completed and not yet applied; null otherwise. */}
      {recalTile && <div style={{ padding: '12px 16px 0' }}>{recalTile}</div>}

      {/* ── WORDMARK ROW ─────────────────────────────────────────────── */}
      <div style={{
        padding: '16px 16px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Wordmark size="xs" className="wordmark-today" />
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
        {/* NOTIF-01 — bell. Paid/trial only (free users can't have notifications).
            Negative margins absorb the 44px tap target so it doesn't balloon the row. */}
        {hasPaidAccess && onOpenNotifications && (
          <div style={{ margin: '-11px -10px -11px 0' }}>
            <NotificationBell unreadCount={unreadNotifications} onClick={onOpenNotifications} />
          </div>
        )}
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
            {weekPhaseLabel ? `${weekPhaseLabel} · ` : ''}Week {weekOrdinal}
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
              {formatRaceCountdown(daysToRace, { suffix: 'out' })}
            </span>
          )}
        </div>

        {/* Hero label + display */}
        {planNotStarted ? (
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
            <div style={{ lineHeight: 1, marginBottom: '12px' }}>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '-2.5px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {daysToPlanStart === 1 ? 'Tomorrow.' : `${daysToPlanStart} days.`}
              </span>
              <br />
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '56px',
                fontWeight: 800,
                color: 'var(--moss)',
                letterSpacing: '-2.5px',
              }}>
                {/* CD-5/N7 — a short gap before the plan can rest; a longer one
                    must keep ticking over, or the runner detrains before week 1. */}
                Until then, {daysToPlanStart > 3 ? 'keep it easy.' : 'rest up.'}
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              color: 'var(--mute)',
              marginBottom: daysToPlanStart > 3 ? '8px' : '20px',
            }}>
              Plan begins {planStartDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}.
            </div>
            {daysToPlanStart > 3 && (
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--ink-2)',
                lineHeight: 1.5,
                marginBottom: '20px',
              }}>
                A few easy runs a week, nothing hard. Arrive at week one fresh.
              </div>
            )}
          </>
        ) : showSessionHero && selectedSession ? (
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

        {/* Trial nudge — appears when ≤4 days remain (TRIAL-NUDGE-01).
            Day-keyed escalation: factual → attachment → loss preview → stark.
            Calm reminder, not a paywall. Plan stays either way; coaching pauses. */}
        {trialDaysLeft != null && trialDaysLeft > 0 && trialDaysLeft <= 4 && (() => {
          const daysIn = TRIAL_DAYS - trialDaysLeft
          const messages: Record<1 | 2 | 3 | 4, { headline: string; sub: string }> = {
            4: { headline: 'Four days of full access left.',                 sub: 'Plan is yours either way.' },
            3: { headline: `Kit's read ${daysIn} days of your runs.`,        sub: 'Three days left to keep him.' },
            2: { headline: 'Two days. Then this becomes a static plan.',     sub: 'Plan still works. Coaching stops.' },
            1: { headline: 'One day left.',                                  sub: 'Kit goes quiet at midnight.' },
          }
          const msg = messages[trialDaysLeft as 1 | 2 | 3 | 4]
          return (
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
                    {msg.headline}
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.4 }}>
                    {msg.sub}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                  See plans →
                </span>
              </button>
            </div>
          )
        })()}

        {/* Trial expired banner — shown when trial has ended and no active subscription.
            Voice aligned with UpgradeScreen trial-expired headline (TRIAL-NUDGE-01).
            Warn accent (not moss — this is not a nudge). Plan still runs. */}
        {trialDaysLeft === 0 && !hasPaidAccess && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={onUpgrade}
              style={{
                width: '100%', textAlign: 'left', padding: '14px 16px',
                background: 'var(--card)', border: '1px solid var(--line)',
                borderLeft: '3px solid var(--warn)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
                  Kit&rsquo;s gone quiet.
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.4 }}>
                  Plan still runs. Coaching needs a sub.
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--warn)', whiteSpace: 'nowrap' }}>
                Bring Kit back →
              </span>
            </button>
          </div>
        )}

        {/* AI-DEPTH-08: post-race reshape prompt + card ───────────────────
            Shown when the race week is in the past and no result logged yet.
            Priority order: pendingReshape card > prompt button > nothing. */}
        {pendingReshape && (
          <div style={{ marginBottom: '16px', animation: 'zonna-fade-in 0.2s ease-out' }}>
            <PostRaceReshapeCard
              state="live"
              reshapeId={pendingReshape.reshapeId}
              summary={pendingReshape.summary}
              weeksAffected={pendingReshape.weeksAffected}
              sessionsModified={pendingReshape.sessionsModified}
              distanceBucket={pendingReshape.distanceBucket}
              onAccepted={(reshapedPlan) => {
                // PostRaceReshapeCard called /api/post-race-reshape/confirm which
                // saved the plan to Supabase and returned the reshaped_plan_json.
                // We set local state directly to avoid a round-trip fetch.
                onReshapeAccepted?.(reshapedPlan)
              }}
              onDismiss={() => onReshapeDismissed?.()}
            />
          </div>
        )}

        {showRacePrompt && !pendingReshape && (
          <div style={{ marginBottom: '16px' }}>
            {hasPaidAccess ? (
              <button
                onClick={() => onLogRaceResult?.()}
                style={{
                  width: '100%', padding: '14px 16px',
                  background: 'var(--card)',
                  border: '1.5px solid var(--moss)',
                  borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px' }}>
                    Race done
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.2 }}>
                    How did it go?
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '2px' }}>
                    Log your result · Zonna will adjust your plan
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', color: 'var(--moss)', flexShrink: 0 }}>→</span>
              </button>
            ) : (
              <PostRaceReshapeCard
                state="locked"
                onUpgrade={() => onUpgrade?.()}
                onDismiss={() => onReshapeDismissed?.()}
              />
            )}
          </div>
        )}

        {/* MAINT-01/02: quiet "Base running" card — visible throughout the
            maintenance block. No ceremony, no push. When the AI enricher (MAINT-02,
            PAID) has written a weekly debrief, the card carries Kit's voice with a
            CoachByline + moss rail (Pattern 16b); otherwise it shows the rule-engine
            line with NO provenance mark. AIMark marks the enriched copy only. */}
        {/* #1 — one-time transition announcement. Marks the race done, explains
            (§75) why the plan eased, shows the block shape. Auto-live: the
            affordance is "See the plan" (→ adjust on the Plan screen), never
            accept/decline. Rule-engine copy → NO AIMark. Recovery-green rail
            mirrors the Plan-screen seam. */}
        {showMaintTransition && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              position: 'relative',
              background: 'var(--card)',
              borderRadius: 'var(--radius-lg)',
              padding: '16px 16px 12px 19px',
              border: '1px solid var(--line)',
              overflow: 'hidden',
            }}>
              <span style={{
                position: 'absolute', left: '8px', top: '16px', bottom: '16px',
                width: '3px', borderRadius: '2px', background: 'var(--s-recov)',
              }} />
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                color: 'var(--s-recov)', letterSpacing: '0.12em', textTransform: 'uppercase',
                marginBottom: '6px',
              }}>
                After the race
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 800,
                color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: '6px',
              }}>
                {(() => {
                  const src = (plan.meta as any).source_race_name as string | undefined
                  return src ? `That's ${src} done.` : "That's the race done."
                })()}
              </div>
              <p style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)',
                lineHeight: '1.45', margin: '0 0 10px',
              }}>
                Your body&apos;s still repairing — the plan&apos;s eased to base running while it does.
              </p>
              {maintWeekCount > 0 && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
                  color: 'var(--mute)', marginBottom: '14px', letterSpacing: '0.01em',
                }}>
                  {maintDaysPerWeek} day{maintDaysPerWeek === 1 ? '' : 's'}/week · {maintWeekCount} week{maintWeekCount === 1 ? '' : 's'} · below your base, on purpose
                </div>
              )}
              <button
                onClick={onSeeMaintPlan}
                style={{
                  width: '100%', padding: '14px',
                  background: 'var(--moss)', color: 'var(--card)',
                  border: 'none', borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-ui)', fontSize: '13px',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: 'pointer', fontWeight: 600, marginBottom: '4px',
                }}
              >
                See the plan
              </button>
              <button
                onClick={onAckMaintTransition}
                style={{ background: 'none', border: 'none', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', cursor: 'pointer', padding: '8px 0', width: '100%' }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* MAINT-07 — §75 Phase 3. In the block's final weeks the card changes
            register: it takes back the recovery-green rail and the "After the
            race" eyebrow it opened the chapter with (the transition card, above),
            so the block closes in the same voice that opened it — the app coming
            back, not a card appearing. Rule-engine copy → NO AIMark. When the PAID
            debrief is present it owns the card instead (CoachByline + moss rail);
            never both marks at once — provenance stays unambiguous. */}
        {showMaintCard && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              position: 'relative',
              background: 'var(--card)',
              borderRadius: 'var(--radius-lg)',
              padding: (maintDebrief || maintReengagement) ? '14px 16px 10px 19px' : '14px 16px 10px',
              border: '1px solid var(--line)',
              overflow: 'hidden',
            }}>
              {maintDebrief ? (
                <>
                  {/* Moss left rail — canonical AI-card signal (Pattern 16b) */}
                  <span style={{
                    position: 'absolute', left: '8px', top: '14px', bottom: '34px',
                    width: '3px', borderRadius: '2px', background: 'var(--moss)',
                  }} />
                  <div style={{ marginBottom: '8px' }}>
                    <CoachByline color="moss" role="Maintenance" />
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)',
                    lineHeight: '1.45', margin: '0 0 10px',
                  }}>
                    {maintDebrief}
                  </p>
                </>
              ) : (
                <>
                  {maintReengagement && (
                    <>
                      {/* Recovery-green rail — the transition card's rail, returning */}
                      <span style={{
                        position: 'absolute', left: '8px', top: '14px', bottom: '34px',
                        width: '3px', borderRadius: '2px', background: 'var(--s-recov)',
                      }} />
                      <div style={{
                        fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                        color: 'var(--s-recov)', letterSpacing: '0.12em', textTransform: 'uppercase',
                        marginBottom: '6px',
                      }}>
                        After the race
                      </div>
                    </>
                  )}
                  {/* The week's own theme — rule-engine copy, already phase-correct
                      (§75 voice register). Phase 3 weeks carry PHASE3_THEME, so the
                      closing line needs no separate string. Replaces a hardcoded
                      "…while you decide what's next", which was forward-goal
                      language during Phase 1, where §75 forbids it. */}
                  <p style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '13px',
                    color: 'var(--ink-2)',
                    lineHeight: '1.4',
                    margin: '0 0 10px',
                  }}>
                    {maintThemeLine || 'Base running.'}
                  </p>
                </>
              )}
              <button
                onClick={onDismissMaintCard}
                style={{ background: 'none', border: 'none', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', cursor: 'pointer', padding: '4px 0', width: '100%' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* CA-03: post-race "what next" goal ladder — sequenced next goals that
            seed the wizard. Rule-engine output (no AIMark).
            MAINT-07: when a maintenance block exists, this is held until its §75
            Phase 3 window (gate: `nextGoalGateOpen`) so it never lands beside the
            "plan's eased to base running" announcement, and never asks for a
            racing decision while the runner is still repairing. */}
        {nextGoalData && (
          <div style={{ marginBottom: '16px' }}>
            <NextGoalCard
              achievement={nextGoalData.achievement}
              options={nextGoalData.options}
              onPick={(opt) => onPickNextGoal?.(opt)}
              onDismiss={() => onDismissNextGoal?.()}
            />
          </div>
        )}

        {/* Pending adjustment — above coach note, prominent position.
            TD-READY: readiness-signal adjustments render as a permission
            pill instead of the generic confirm/revert banner — "ease the
            session" reads as permission, not as system-please-confirm.
            Other adjustment triggers (load_spike, fatigue, etc.) keep the
            existing banner. */}
        {pendingAdjustment && (
          pendingAdjustment.trigger_type === 'readiness_signal' ? (
            <TdReadyHero
              adjustment={pendingAdjustment}
              onConfirmed={onAdjustmentConfirmed}
              onReverted={onAdjustmentReverted}
            />
          ) : (
            <div style={{ marginBottom: '16px' }}>
              <AdjustmentBanner
                adjustment={pendingAdjustment}
                onConfirmed={onAdjustmentConfirmed}
                onReverted={onAdjustmentReverted}
                preferredUnits={preferredUnits}
              />
            </div>
          )
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
                <CoachNoteBlock label={coachLabel} aiGenerated onChipClick={onOpenCoach}>
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

      {/* ── HOLD THE ZONE ──────────────────────────────────────────────
          First daily use of BRAND.voiceAnchor in the product UI. Renders
          only when today is a zone-bearing run session (skipped on rest /
          strength / cross-train). Names the zone explicitly without
          hijacking the hero's poetic slot. */}
      {showSessionHero && selectedSession && (() => {
        const zone = zoneNumberForType(selectedSession.type)
        if (!zone) return null
        return (
          <div style={{
            padding: '0 16px',
            marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--moss)',
              animation: 'ai-mark-pulse 2.4s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
              color: 'var(--moss)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              Hold the zone · Zone {zone} today
            </span>
          </div>
        )
      })()}

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

            {/* TD-CLOSE — the day's close. When today is done (logged,
                skipped, or a rest day) Today resolves to a calm one-line
                read above the session card. The brand's anti-cheerleading
                voice: "Do nothing. It helps." for rest; "That's the day.
                Nothing to prove now." for a logged session; "Benched.
                Tomorrow's still the plan." for skipped.
                No confetti. The reward is closure, not celebration. */}
            {selectedSession.today && (() => {
              const todayCompletion = completions[selectedCompletionKey]
              const isDone    = todayCompletion?.status === 'complete'
              const isSkipped = todayCompletion?.status === 'skipped'
              const isRest    = selectedSession.type === 'rest'
              if (!isDone && !isSkipped && !isRest) return null

              const headline = isRest ? 'Do nothing. It helps.'
                : isSkipped ? "Benched. Tomorrow's still the plan."
                : "That's the day. Nothing to prove now."

              // The day's one number. For a logged run: distance. For rest /
              // skipped: nothing — the headline IS the read.
              const distKm = isDone ? todayCompletion?.strava_activity_km ?? null : null
              const metric = distKm != null ? formatDistance(distKm, preferredUnits) : null

              return (
                <div style={{
                  background:   'var(--card)',
                  border:       '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  padding:      '16px 20px 16px 22px',
                  marginBottom: '8px',
                  position:     'relative',
                }}>
                  {/* 3px moss left rail — completion accent, no warn here.
                      Restraint is the reward; --moss is the brand's quiet
                      "well done" colour without saying "well done". */}
                  <div style={{
                    position:     'absolute',
                    left:         '8px',
                    top:          '14px',
                    bottom:       '14px',
                    width:        '3px',
                    background:   'var(--moss)',
                    borderRadius: '2px',
                  }} />
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>
                    {isRest ? 'Rest day' : isSkipped ? 'Benched' : "Today's done"}
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600,
                    color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3,
                    margin: 0,
                  }}>
                    {headline}
                  </p>
                  {metric && (
                    <div style={{
                      marginTop: '8px',
                      fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                      color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {metric}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* R25 Cut #2 — pre-run band. Shows cohort stats for similar past
                runs when the user is about to head out. PAID, today only.
                Formula-derived: no AIMark. Absent when < 3 similar runs.
                TD-READY (Decision #3): hides when a readiness-signal pending
                adjustment exists. Both want this real-estate; readiness wins
                because permission > confirmation on a cooked morning.
                TD-CLOSE: also hides when today is done — pre-run guidance
                is irrelevant after the run. */}
            {/* TD-READY steady chip — the calm/positive half of fresh/steady/
                cooked. Renders ONLY when: paid, today is selected, today's
                session is eligible (route returns detail only for quality/
                long/intervals/tempo), no cooked adjustment firing (TdReadyHero
                gets that), today isn't done, baseline exists. Tap to expand
                the numbers (RHR / HRV / sleep vs baseline). Rule-derived,
                no AIMark per Pattern 16 provenance. */}
            {hasPaidAccess
              && selectedSession.today
              && pendingAdjustment?.trigger_type !== 'readiness_signal'
              && !completions[selectedCompletionKey]?.status
              && selectedSession.type !== 'rest'
              && readinessData
              && !readinessData.adjustment
              && (readinessData.reason === 'all_clear' || readinessData.reason === 'no_trigger')
              && readinessData.detail
              && <ReadinessSteadyChip detail={readinessData.detail} />
            }

            {hasPaidAccess && selectedSession.today && pendingAdjustment?.trigger_type !== 'readiness_signal' && !completions[selectedCompletionKey]?.status && selectedSession.type !== 'rest' && (
              preRunBandLoading
                ? <PreRunBandCard state="skeleton" />
                : preRunBand
                ? <PreRunBandCard state="live" cohort={preRunBand} sessionType={selectedSession.type} />
                : null
            )}

            {/* Session card.
                Pace fallback chain: plan-baked pace_target → live aerobicPace
                (computed from Strava history) → '—' placeholder while Strava
                runs are still loading and an aerobic pace is expected. The
                placeholder reserves the slot so the detail line doesn't
                reflow when aerobicPace lands a beat later. */}
            {(() => {
              const expectsAerobicPace = (selectedSession.type === 'easy' || selectedSession.type === 'run') && !selectedSession.pace_target
              const rawPaceForDetail = selectedSession.pace_target
                ?? (expectsAerobicPace ? aerobicPace : null)
                ?? (expectsAerobicPace && stravaLoading ? '—' : null)
              // CD-11 / §12 — an easy run's pace is a ceiling, not a window.
              const paceForDetail = easyPaceAsCeiling(rawPaceForDetail, selectedSession.type)
              // P2 fix: route HR through getSessionHRDisplay (live Karvonen) instead of
              // reading the baked plan string directly. Mirrors what the expanded card does.
              const liveHrStr = getSessionHRDisplay(
                selectedSession.type,
                selectedSession.hr_target,
                restingHR ?? null,
                maxHR ?? null,
                zone2Ceiling ?? undefined,
              )
              return (
            <SessionCard
              type={selectedSession.type}
              name={selectedSession.title}
              detail={[
                selectedSession.zone,
                liveHrStr ? `${liveHrStr} bpm` : undefined,
                paceForDetail,
              ].filter(Boolean).join(' · ') || undefined}
              distanceKm={selectedSession.distance}
              units={preferredUnits}
              metric={resolveSessionMetric(weekNum, selectedSession.key, selectedSession.primary_metric, sessionMetricOverrides, preferredMetric)}
              durationMin={selectedSession.duration_mins}
              state={
                completions[selectedCompletionKey]?.status === 'complete' ? 'done'
                : completions[selectedCompletionKey]?.status === 'skipped' ? 'skipped'
                : selectedSession.today ? 'current'
                : 'future'
              }
              completion={completions[selectedCompletionKey]?.status === 'complete' ? {
                distanceKm: completions[selectedCompletionKey]?.strava_activity_km ?? undefined,
                avgBpm: completions[selectedCompletionKey]?.avg_hr ?? undefined,
                viaStrava: !!completions[selectedCompletionKey]?.strava_activity_id,
                activityName: completions[selectedCompletionKey]?.strava_activity_name ?? undefined,
              } : undefined}
              {...(() => {
                // HR-SYNC-02: look up the activity matching this completion and
                // classify HR-pending. Only applies when complete + an HK uuid
                // links the completion to an activity log row.
                const comp = completions[selectedCompletionKey]
                if (comp?.status !== 'complete' || !comp?.apple_health_uuid) return {}
                const act: any = stravaRuns?.find((r: any) => r.apple_health_uuid === comp.apple_health_uuid)
                if (!act || act.source !== 'apple_health') return {}
                const state = classifyHrPending({
                  source:        act.source,
                  avg_hr:        act.average_heartrate ?? null,
                  start_date:    act.start_date ?? null,
                  moving_time_s: act.moving_time ?? null,
                }, new Date())
                if (state !== 'pending' && state !== 'fallback') return {}
                return {
                  hrPendingState: state,
                  onHrRetry: state === 'fallback' ? () => handleHrRetry(comp.apple_health_uuid) : undefined,
                  isHrRetrying: retryingForHrUuid === comp.apple_health_uuid,
                }
              })()}
              onClick={() => {
                const isPast = selectedSession.rawDate < now && !selectedSession.today
                const isFuture = !selectedSession.today && selectedSession.rawDate > now
                onOpenSession?.({
                  ...selectedSession,
                  rawDate: selectedSession.rawDate.toISOString(),
                  completion: completions[selectedCompletionKey],
                  isPast,
                  isFuture,
                  weekN: weekNum,
                  weekTheme,
                })
              }}
            />
              )
            })()}

            {/* Zone bar — 5-segment strip under the session card. Reinforces
                "you are here" in the 5-zone arc. No labels on Today (this is
                glance-only); Session Detail's prescription card carries the
                labelled version. Renders only for zone-bearing sessions. */}
            {(() => {
              const zone = zoneNumberForType(selectedSession.type)
              if (!zone) return null
              return <ZoneBar activeZone={zone} style={{ marginTop: '10px' }} />
            })()}

            {/* Primary CTA — only on today's session if not yet done */}
            {selectedSession.today && !completions[selectedCompletionKey]?.status && (
              <button
                onClick={() => {
                  onOpenSession?.({
                    ...selectedSession,
                    rawDate: selectedSession.rawDate.toISOString(),
                    completion: completions[selectedCompletionKey],
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

      {/* ── RETROACTIVE RPE NUDGES (POST-RUN-01) ─────────────────────── */}
      {/* For paid users only — sessions auto-linked from Strava that the user
       *  never came back to rate. One subtle row per missing RPE; tap routes
       *  to PostRunScreen so they can add it now. Capped at 3. */}
      {hasPaidAccess && missingRpeNudges.length > 0 && onOpenPostRun && (
        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {missingRpeNudges.map(nudge => {
            const distLabel = nudge.distKm != null
              ? `${nudge.distKm < 10 ? nudge.distKm.toFixed(1) : Math.round(nudge.distKm)}${preferredUnits === 'mi' ? 'mi' : 'K'}`
              : 'run'
            return (
              <button
                key={`${nudge.weekN}-${nudge.dayKey}`}
                onClick={() => onOpenPostRun({
                  session: { ...nudge.session, key: nudge.dayKey, day: nudge.dayName, weekN: nudge.weekN },
                  weekN:   nudge.weekN,
                  pendingActivityId: null,  // already linked
                  linkedActivity: nudge.stravaActivityName ? {
                    name: nudge.stravaActivityName,
                    km:   nudge.distKm,
                  } : null,
                })}
                style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '10px',
                  width:        '100%',
                  background:   'var(--bg-soft)',
                  border:       'none',
                  borderRadius: '12px',
                  padding:      '12px 14px',
                  cursor:       'pointer',
                  textAlign:    'left',
                }}
              >
                <span aria-hidden="true" style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--moss)', flexShrink: 0,
                }} />
                <span style={{
                  flex: 1, minWidth: 0,
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                  color: 'var(--ink-2)', lineHeight: 1.4,
                }}>
                  Tell Kit how {nudge.dayName}&apos;s {distLabel} felt
                </span>
                <span aria-hidden="true" style={{
                  fontFamily: 'var(--font-ui)', fontSize: '14px',
                  color: 'var(--moss)', fontWeight: 600, flexShrink: 0,
                }}>
                  →
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── VOICE ANCHOR STRIP (ZONE-VIS-02) ─────────────────────────────
          Replaces the Today-screen RestraintCard. The discipline NUMBER now
          lives on Coach (where retrospection belongs); Today keeps the
          discipline RHETORIC — a single moss line that anchors the day's
          job. Source: BRAND.voiceAnchor ("Hold the zone."). No card chrome:
          the strip earns presence through typography, not borders. */}
      <div style={{ padding: '18px 16px 0' }}>
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--moss)',
            letterSpacing: '-0.005em',
            lineHeight: 1.3,
          }}
        >
          {BRAND.voiceAnchor}
        </div>
      </div>

      {/* "Done this week" retrospective list removed — it duplicated the Plan
          calendar (which shows completed/skipped state per session) and added a
          second, review-shaped job to a present-moment screen. Today's own
          completion still shows via the hero card's `done` state above. */}

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
    const weekN = (week as any).n ?? (wi + 1)   // week.n-keyed (MAINT-06)
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

function PlanScreen({ plan, stravaRuns, allOverrides, allCompletions, onOverrideChange, onOpenSession, overridesReady, preferredUnits = 'km', preferredMetric = 'distance', sessionMetricOverrides = {}, hasPaidAccess = false, onOpenCoach }: {
  plan: Plan; stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
  allCompletions: Record<number, Record<string, any>>
  onOverrideChange: (overrides: { week_n: number; original_day: string; new_day: string }[]) => void
  onOpenSession?: (s: any) => void
  overridesReady: boolean
  preferredUnits?: 'km' | 'mi'
  preferredMetric?: 'distance' | 'duration'
  sessionMetricOverrides?: Record<string, 'distance' | 'duration'>
  hasPaidAccess?: boolean
  onOpenCoach?: () => void
}) {
  const currentWeekIndex = getCurrentWeekIndex(plan.weeks)
  // ADR-013: two distinct week numbers. `weekNum` is the canonical week.n KEY
  // (session_completions, plan-weekly-note) — continues at 26+ on a standalone
  // maintenance plan. `weekOrdinal` is the 1-indexed array POSITION, and is the
  // only value shown to the user ("Wk 4 of 11") or fed to the PlanArc — never
  // week.n, which would render the nonsensical "Wk 29 of 11".
  const weekNum = (plan.weeks[currentWeekIndex] as any)?.n ?? (currentWeekIndex + 1)
  const weekOrdinal = currentWeekIndex + 1
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
    // Goal race = LAST race-flagged week (mid-plan 'race_event' tune-ups also
    // carry a 'race' badge; findIndex would mark the tune-up on the plan arc).
    const idx = plan.weeks.findLastIndex((wk) => (wk as any).type === 'race' || (wk as any).badge === 'race')
    return idx >= 0 ? idx + 1 : undefined
  })()

  // Phase label: "base → build → peak → taper" or from plan phases
  const phaseLabel = (() => {
    const phases = Array.from(new Set(plan.weeks.map((wk) => (wk as any).phase).filter(Boolean)))
    // Use the shared PHASE_LABELS map so maintenance phases (ADR-013) render as
    // "Restoration"/"Base" — a local partial map leaked raw "maintenance_restoration"
    // strings that CSS then uppercased on the Plan arc.
    return phases.map(p => PHASE_LABELS[p as string] ?? p).join(' → ')
  })()

  // Race Projections sheet — tapping the Plan Arc opens this (screen-architecture.md)
  const [showRaceProjections, setShowRaceProjections] = useState(false)

  // Tracked km for the current week (for the This Week card footer)
  const currentWeek = plan.weeks[currentWeekIndex] as any
  // #3b — is the athlete currently inside the post-race maintenance block?
  const inMaintenance = currentWeek?.phase === 'maintenance_restoration' || currentWeek?.phase === 'maintenance_base'
  const currentWeekSessions = Object.values((currentWeek as any)?.sessions ?? {}) as any[]
  const weeklyKmTarget = sumRoundedDistance(currentWeekSessions.map((s: any) => s?.distance_km as number | undefined), preferredUnits)

  // PLAN-VOICE-AI — paid/trial users get an AI-voiced headline + items via
  // /api/plan-weekly-note (cached per week, regenerated when the plan changes).
  // Free users keep the rule-engine voice (no fetch). AI failure silently
  // falls back to the rule-engine path per ADR-006.
  const [aiNote, setAiNote] = useState<
    { headline: string; items: string[] } | 'loading' | 'failed' | null
  >(null)

  useEffect(() => {
    if (!hasPaidAccess) {
      setAiNote(null)
      return
    }
    const wk = plan.weeks[currentWeekIndex]
    if (!wk) return
    setAiNote('loading')
    let cancelled = false
    ;(async () => {
      try {
        const res = await authedFetch('/api/plan-weekly-note', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ week_n: weekNum }),
        })
        if (cancelled) return
        if (!res.ok) { setAiNote('failed'); return }
        const data = await res.json()
        if (cancelled) return
        if (typeof data?.headline === 'string') {
          setAiNote({
            headline: data.headline,
            items:    Array.isArray(data.items) ? data.items.slice(0, 2) : [],
          })
        } else {
          setAiNote('failed')
        }
      } catch {
        if (!cancelled) setAiNote('failed')
      }
    })()
    return () => { cancelled = true }
  }, [hasPaidAccess, currentWeekIndex, plan])

  return (
    <div style={{ paddingBottom: '32px' }}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <ScreenHeader title="Your plan" />

      {/* ── RACE NAME HEADING ────────────────────────────────────── */}
      {raceName && (
        <div style={{ padding: inMaintenance ? '0 16px 2px' : '0 16px 12px', fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
          {raceName}
        </div>
      )}
      {/* #3b — when the athlete is inside the post-race maintenance block, the
          screen must stop reading as active race prep. A recovery-green eyebrow
          under the race title names the chapter; the per-week accents + seam
          in PlanCalendar carry it through the week list. Rule-engine → no AIMark. */}
      {inMaintenance && (
        <div style={{ padding: '0 16px 12px', fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--s-recov)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Maintenance
        </div>
      )}

      {/* ── PLAN ARC — tap to open Race Projections (screen-architecture.md) ── */}
      <button
        onClick={() => setShowRaceProjections(true)}
        style={{ display: 'block', width: '100%', padding: '0 16px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        aria-label="View race projections"
      >
        <PlanArc
          totalWeeks={totalWeeks}
          currentWeek={weekOrdinal}
          doneWeeks={doneWeeksCount}
          deloadWeeks={deloadWeekNumbers}
          raceWeek={raceWeekNumber}
          phaseLabel={phaseLabel || undefined}
        />
        {raceDate && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '6px', letterSpacing: '0.02em' }}>
            {raceName ? `${raceName} · ` : ''}{daysToRace === 0 ? 'Race day' : daysToRace === 1 ? '1 day to go' : `${daysToRace} days to go`} · Tap for projections
          </div>
        )}
      </button>

      {/* ── PLAN INTRO — CA-01 free first-plan "why this plan" (Kit's voice) ──
          Plan-level intro generated once on a free user's first plan. The one
          AI surface a free user gets; carries CoachByline provenance. Persists
          in meta.plan_intro, so it survives save/reload. Only set for free
          first-plans — paid plans carry coach_intro instead and never this. */}
      {plan.meta.plan_intro && (
        <div style={{ padding: '16px 16px 0' }}>
          <PlanIntroCard text={plan.meta.plan_intro} />
        </div>
      )}

      {/* ── PLAN VOICE — this-week coaching card (PLAN-VOICE-AI) ─────────
          Tier-divergent: paid/trial users see AI voice with CoachByline.
          Free users see rule-engine voice (no byline — provenance honesty).
          AI failure silently falls back to rule-engine (ADR-006).
          Uses rule-engine helpers (buildWeekVoiceContext et al).
          Week Notes merged into this card (screen-architecture.md 2026-06-07). */}
      {(() => {
        const wk = plan.weeks[currentWeekIndex]
        if (!wk) return null
        const ctx           = buildWeekVoiceContext(wk, plan)
        const ruleHeadline  = getWeekVoiceHeadline(ctx)
        const phaseCap      = ctx.phase ? (PHASE_LABELS[ctx.phase] ?? ctx.phase) : null

        // Tier-divergent picker. The three branches collapse to: paid-ready,
        // paid-loading, or rule (free OR paid-failed OR paid-not-yet-fetched-when-free).
        const aiReady    = hasPaidAccess && aiNote && aiNote !== 'loading' && aiNote !== 'failed'
        const isLoading  = hasPaidAccess && aiNote === 'loading'
        const showByline = !!aiReady || isLoading

        // Plan shows the one-line framing only — the supporting items + the full
        // Week Notes merged in here (screen-architecture.md 2026-06-07):
        // headline + items (max 2) + km target footer all live on Plan now.
        const headline   = aiReady ? (aiNote as { headline: string }).headline : ruleHeadline
        const aiItems    = aiReady ? (aiNote as { headline: string; items: string[] }).items.slice(0, 2) : null
        const ruleItems  = getWeekVoiceItems(ctx, 2)
        const items      = aiItems ?? ruleItems
        const doneKm     = (() => {
          // Sum completed runs this week from allCompletions (week.n-keyed, MAINT-06)
          const weekN = weekNum
          const weekCompletions = allCompletions[weekN] ?? {}
          const total = Object.values(weekCompletions)
            .reduce((sum: number, c: any) => sum + (c?.distance_km ?? 0), 0)
          return total > 0 ? parseFloat(total.toFixed(1)) : null
        })()

        return (
          <div style={{ padding: '16px 16px 0' }}>
            <div style={{
              position: 'relative',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              {/* Main content area with left rail */}
              <div style={{ padding: '14px 16px 14px 19px', position: 'relative' }}>
                {/* Moss left rail — coaching surface signal */}
                <span style={{
                  position: 'absolute', left: '8px', top: '14px', bottom: '14px',
                  width: '3px', borderRadius: '2px', background: 'var(--moss)',
                }} />
                {/* Eyebrow row: CoachByline (paid) or rule-engine label (free) + phase chip */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  {showByline ? (
                    <CoachByline
                      color="moss"
                      role="This week"
                      working={isLoading}
                      onClick={onOpenCoach}
                    />
                  ) : (
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                      color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>This week</span>
                  )}
                  {phaseCap && (
                    <span style={{
                      marginLeft: 'auto',
                      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                      color: 'var(--moss)', letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}>{phaseCap}</span>
                  )}
                </div>
                {isLoading ? (
                  <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ height: '17px', width: '85%', borderRadius: '4px', background: 'var(--bg-soft)', opacity: 0.6 }} />
                    <div style={{ height: '13px', width: '70%', borderRadius: '4px', background: 'var(--bg-soft)', opacity: 0.4 }} />
                  </div>
                ) : (
                  <>
                    <div style={{
                      fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
                      color: 'var(--ink)', lineHeight: 1.4, letterSpacing: '-0.01em',
                      marginBottom: items.length > 0 ? '10px' : 0,
                    }}>{headline}</div>
                    {items.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {items.map((item: string, i: number) => (
                          <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Km target footer — mirrors PlanCoachingCard footer pattern */}
              {weeklyKmTarget > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>
                    {weeklyKmTarget}{preferredUnits} target
                  </span>
                  {doneKm ? (
                    <>
                      <span style={{ color: 'var(--line-strong)', fontSize: '12px' }}>·</span>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--moss)', fontWeight: 500 }}>
                        {formatDistance(doneKm, preferredUnits, { exact: true })} done
                      </span>
                    </>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>no runs logged yet</span>
                  )}
                </div>
              )}
            </div>
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
          preferredMetric={preferredMetric}
          sessionMetricOverrides={sessionMetricOverrides}
          onSessionTap={(session, weekN, weekTheme) => {
            onOpenSession?.({ ...session, weekN, weekTheme })
          }}
        />
      </div>

      {/* ── RACE PROJECTIONS SHEET — accessed via Plan Arc tap ──────────
          screen-architecture.md: Race Projections belong on Plan, one tap
          from the Plan Arc (the existing race-goal object). VDOT formula
          + R31 target row + R32 recal nudge live here. */}
      {showRaceProjections && (
        <div
          onClick={() => setShowRaceProjections(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,26,26,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'zonna-fade-in 0.18s ease-out' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', background: 'var(--card)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,0.12)', paddingTop: '8px', maxHeight: '85vh', overflowY: 'auto', animation: 'zonna-slide-up 0.22s ease-out' }}
          >
            <div style={{ width: '36px', height: '4px', background: 'var(--line)', borderRadius: '2px', margin: '6px auto 18px' }} />
            <div style={{ padding: '0 20px 4px' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Race projections
              </div>
              {raceName && (
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.2, marginBottom: '4px' }}>
                  {raceName}
                </div>
              )}
              {raceDateStr && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>
                  {raceDateStr}{daysToRace !== null && daysToRace > 0 ? ` · ${daysToRace} days to go` : daysToRace === 0 ? ' · Race day' : ''}
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px 8px' }}>
              <RaceTimesCard
                stravaConnected={false}
                benchmarkRecalDismissedAt={undefined}
                onOpenBenchmark={undefined}
                onDismissRecal={undefined}
              />
            </div>
            <div style={{ position: 'sticky', bottom: 0, padding: '14px 20px 20px', background: 'var(--card)', borderTop: '0.5px solid var(--line)', marginTop: '8px' }}>
              <button
                onClick={() => setShowRaceProjections(false)}
                style={{ width: '100%', padding: '12px', background: 'var(--bg-soft)', border: 'none', borderRadius: '10px', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', cursor: 'pointer', letterSpacing: '0.04em' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PLAN-BASED COACHING ───────────────────────────────────────────────────
//
// Week-level coaching voice — rule-engine derived, shared by two surfaces:
//   • PlanScreen  → slim inline card above the calendar
//   • CoachScreen → full PlanCoachingCard with header + footer
//
// Pure functions of (currentWeek, plan). No AI involved — so per ui-patterns.md
// § AIMark provenance rule, neither surface gets a Kit / AIMark byline.

interface WeekVoiceContext {
  phase?: string
  hasQuality: boolean
  hasLong: boolean
  weeksToRace: number
}

function buildWeekVoiceContext(currentWeek: Week, plan: Plan): WeekVoiceContext {
  const sessions = Object.values((currentWeek as any).sessions ?? {}) as any[]
  return {
    phase: (currentWeek as any).phase as string | undefined,
    hasQuality: sessions.some(s => s && ['quality','tempo','intervals','hard'].includes(s.type)),
    hasLong: sessions.some(s => s && isLongRun(s)),
    weeksToRace: Math.max(
      0,
      Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
    ),
  }
}

function getWeekVoiceHeadline(ctx: WeekVoiceContext): string {
  if (ctx.phase === 'foundation') return "Foundation week. Easy only — build the base."
  if (ctx.phase === 'taper') return "Taper week. Back off and trust the work."
  if (ctx.phase === 'peak')  return "Peak week. You're sharp. Don't add more."
  if (ctx.hasQuality && ctx.hasLong) return "Quality and long run this week. Hard stuff first, long stuff rested."
  if (ctx.hasQuality) return "Quality session this week. Everything else is recovery."
  if (ctx.hasLong)    return "Long run week. Keep easy runs genuinely easy."
  return "Steady week. Execute consistently."
}

function getWeekVoiceItems(ctx: WeekVoiceContext, max = 3): string[] {
  const items: string[] = []
  if (ctx.hasQuality && ctx.hasLong) {
    items.push("Do the quality session before fatigue builds — earlier in the week is better.")
    items.push("The long run should be Zone 2 only. No heroics.")
  } else if (ctx.hasQuality) {
    items.push("Run the quality session when fresh — not back-to-back with another hard day.")
    items.push("Everything else this week is recovery. Treat it that way.")
  } else if (ctx.hasLong) {
    items.push("Keep the pace honest throughout — if HR climbs, walk.")
    items.push("Fuel and hydrate from the start, not when you're already behind.")
  }
  if (ctx.phase === 'base') items.push("Base phase: volume over intensity. The fitness accrues slowly. That's fine.")
  if (ctx.phase === 'taper') items.push("Resist adding miles. Your goal is to arrive fresh, not to cram.")
  if (ctx.weeksToRace <= 4 && ctx.weeksToRace > 0) items.push(`${ctx.weeksToRace} week${ctx.weeksToRace !== 1 ? 's' : ''} out. Stay disciplined.`)
  return items.slice(0, max)
}

const PHASE_LABELS: Record<string, string> = {
  foundation: 'Foundation Block', base: 'Base', build: 'Build', peak: 'Peak', taper: 'Taper',
  // ADR-013 maintenance-plan phases — without these the raw lowercase phase leaks
  // through and the uppercase CSS renders "MAINTENANCE_RESTORATION" on the Plan card.
  maintenance_restoration: 'Restoration', maintenance_base: 'Base',
}

function PlanCoachingCard({ plan, currentWeek, units = 'km', trackedKm }: {
  plan: Plan; currentWeek: Week; units?: 'km' | 'mi'; trackedKm?: number | null
}) {
  const sessions = Object.values((currentWeek as any).sessions ?? {}) as any[]
  const phase    = (currentWeek as any).phase as string | undefined
  const theme    = (currentWeek as any).theme as string | undefined
  // Sum of rounded session distances — agrees with per-row displays.
  const weeklyKm = sumRoundedDistance(sessions.map(s => s?.distance_km as number | undefined), units)

  const phaseCap = phase ? (PHASE_LABELS[phase] ?? phase) : null
  const ctx      = buildWeekVoiceContext(currentWeek, plan)
  const items    = getWeekVoiceItems(ctx)

  const doneDisplay = trackedKm != null && trackedKm > 0
    ? `${trackedKm.toFixed(1)}${units} done`
    : null

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Week notes</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)', opacity: 0.6 }}>· Your training plan</span>
        {phaseCap && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {phaseCap}
          </span>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35, marginBottom: theme || items.length > 0 ? '10px' : 0, letterSpacing: '-0.2px' }}>
          {getWeekVoiceHeadline(ctx)}
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

type FreeInsightState =
  | { kind: 'loading' }
  | { kind: 'insight';      headline: string; body: string }
  | { kind: 'risk_gated';   message: string }
  | { kind: 'insufficient'; loggedCount: number }
  | { kind: 'unavailable' }

// TIER-DIVERGENT — FREE: renders KIT-TASTE-01 weekly insight card (CoachByline
//                        + AIMark + headline + body) when available; falls
//                        through to risk-gated amber warning, an insufficient-
//                        logs hint, or a dimmed Kit identity placeholder. The
//                        SHARE-01 upsell + locked race-projections stub sit
//                        below the insight slot.
//                  PAID: rendered by CoachScreen instead — this component is
//                        never mounted for paid/trial users (router in
//                        DashboardClient picks the screen by tier).
function CoachTeaser({ plan, firstName, onUpgrade }: {
  plan: Plan; firstName?: string; onUpgrade: () => void
}) {
  const weekNum    = getCurrentWeekIndex(plan.weeks) + 1
  const totalWeeks = plan.weeks.length

  // KIT-TASTE-01 — pull-on-view fetch of this week's free insight. Failure or
  // any non-insight state falls back to the existing locked layout below.
  const [insight, setInsight] = useState<FreeInsightState>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await authedFetch('/api/coaching/weekly-free-insight')
        if (!res.ok) { if (!cancelled) setInsight({ kind: 'unavailable' }); return }
        const data = await res.json()
        if (cancelled) return
        if (data.state === 'insight')      setInsight({ kind: 'insight', headline: data.headline, body: data.body })
        else if (data.state === 'risk_gated')   setInsight({ kind: 'risk_gated', message: data.message })
        else if (data.state === 'insufficient') setInsight({ kind: 'insufficient', loggedCount: data.loggedCount ?? 0 })
        else                                    setInsight({ kind: 'unavailable' })
      } catch {
        if (!cancelled) setInsight({ kind: 'unavailable' })
      }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <ScreenHeader title="Your coach" sub={firstName ? `${firstName} · W${weekNum} of ${totalWeeks}` : `W${weekNum} of ${totalWeeks}`} />
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* KIT-TASTE-01 — free insight card / risk warning / empty-state hint.
            Sits above the locked report. Locked stats below stay locked. */}
        {insight.kind === 'loading' && (
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            borderLeft: '3px solid var(--moss)', padding: '16px 18px',
          }}>
            <div style={{ marginBottom: '10px' }}>
              <CoachByline working />
            </div>
            <div style={{ height: '14px', width: '70%', borderRadius: '4px', background: 'var(--bg-soft)', marginBottom: '8px' }} />
            <div style={{ height: '12px', width: '92%', borderRadius: '4px', background: 'var(--bg-soft)' }} />
          </div>
        )}

        {insight.kind === 'insight' && (
          // AI-card anatomy per ui-patterns.md Pattern 16b § Companion — the
          // 3px left rail is an absolutely-positioned span (matches
          // CoachNoteBlock + PendingAdjustmentBanner), not a borderLeft.
          <div style={{
            position: 'relative',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            padding: '16px 18px 16px 26px',
          }}>
            <span aria-hidden="true" style={{
              position: 'absolute', left: '8px', top: '16px', bottom: '16px',
              width: '3px', background: 'var(--moss)', borderRadius: '2px',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <CoachByline role="THIS WEEK" />
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
                W{weekNum} of {totalWeeks}
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: '0 0 8px' }}>
              {insight.headline}
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.55, margin: 0 }}>
              {insight.body}
            </p>
          </div>
        )}

        {/* Risk-gated: rule-engine warning, no AIMark — output is not from
            the model. Rail anatomy matches CoachNoteBlock; eyebrow type is
            canonical 10px 700 0.14em per Pattern 10. */}
        {insight.kind === 'risk_gated' && (
          <div style={{
            position: 'relative',
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            padding: '16px 18px 16px 26px',
          }}>
            <span aria-hidden="true" style={{
              position: 'absolute', left: '8px', top: '16px', bottom: '16px',
              width: '3px', background: 'var(--warn)', borderRadius: '2px',
            }} />
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px' }}>
              Worth a look
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.55, margin: 0 }}>
              {insight.message}
            </p>
          </div>
        )}

        {/* Insufficient data: keep the locked identity card but with a clear
            "log to unlock" message instead of the marketing line. */}
        {insight.kind === 'insufficient' && (
          // KIT-PREVIEW-01 — Sample Kit reading. Shown to free users below
          // the RPE threshold so they can SEE what Kit produces before
          // earning their first real insight. Provenance honesty: the copy
          // is hand-authored, NOT model output — so we use CoachByline
          // (Kit's identity) but drop the AIMark and the moss left rail
          // (both of which signal "this card is AI-coached"). The eyebrow
          // "EXAMPLE — NOT YOUR DATA" explicitly disclaims authorship.
          <div style={{
            background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)',
            padding: '16px 18px',
          }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
              color: 'var(--mute)', letterSpacing: '0.14em', textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Example &mdash; not your data
            </div>
            <div style={{ marginBottom: '10px' }}>
              <CoachByline role="EXAMPLE" />
            </div>
            <p style={{ fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: '0 0 8px' }}>
              Easy days running hot.
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13.5px', color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 14px' }}>
              Three logs at RPE 7+ on what should be Zone 2. Pull the next
              one back from the first km.
            </p>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.55,
              paddingTop: '12px', borderTop: '1px solid var(--line)',
            }}>
              {insight.loggedCount === 0
                ? 'Log a session to unlock your own weekly reading. RPE + fatigue is all Kit needs.'
                : 'One more logged session and Kit reads your week.'}
            </div>
          </div>
        )}

        {/* Unavailable: keep the original dimmed identity placeholder so the
            layout doesn't collapse on a model failure or a totally fresh user. */}
        {insight.kind === 'unavailable' && (
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
            <CoachByline />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
              W{weekNum} of {totalWeeks}
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, margin: 0 }}>
            Kit reads your sessions and surfaces what&apos;s worth knowing.
          </p>
        </div>
        )}

        {/* Locked report card — mirrors the paid CoachScreen weekly report card anatomy */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--mute)', opacity: 0.3 }} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>This week</span>
          </div>
          <div style={{ padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600, color: 'var(--mute)', letterSpacing: '-0.3px', lineHeight: 1.3, marginBottom: '8px', opacity: 0.45 }}>
              Your weekly coaching report.
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.7, margin: 0, opacity: 0.5 }}>
              Log a few runs and we'll tell you exactly what's working — and what isn't.
            </p>
          </div>
          {/* Locked stats row */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: '16px' }}>
            {(['Zone discipline', 'Load ratio'] as const).map((label) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 600, color: 'var(--mute)', opacity: 0.3 }}>—</span>
              </div>
            ))}
          </div>
        </div>

        {/* Teaser card — same left-accent pattern as wizard teaser card */}
        <button
          onClick={onUpgrade}
          style={{
            width: '100%', textAlign: 'left',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--moss)',
            borderRadius: '10px',
            padding: '14px 16px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>
              See your zone discipline score
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              Zone score and weekly coaching. Needs Strava.
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--moss)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Upgrade →
          </span>
        </button>

        {/* SHARE-01 — free-tier upsell for the shareable weekly zone card.
            Distinct from the zone-discipline teaser above: that one sells
            the score, this one sells the share moment. Same upgrade target. */}
        <button
          onClick={onUpgrade}
          style={{
            width: '100%', textAlign: 'left',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderLeft: '3px solid var(--moss)',
            borderRadius: '10px',
            padding: '14px 16px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '3px' }}>
              Share your week
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              The card you can drop in a story.
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--moss)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Upgrade →
          </span>
        </button>

        {/* Locked race projections stub — display only, not a CTA */}
        <div style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', opacity: 0.5 }}>
            Race projections
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', opacity: 0.25 }}>
            {(['5K', '10K', 'HM', 'Marathon'] as const).map((label, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--line)' : undefined }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>—:——</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// SHARE-01 — "Share this week" button rendered alongside the weekly report
// card. Coordinates fetch + native/web share via `shareWeeklyZoneCard`.
function ShareWeekButton({ weekN }: { weekN: number }) {
  const [busy, setBusy]   = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  // Clear status messages after a short delay so the button label settles back.
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 2200)
    return () => clearTimeout(t)
  }, [status])

  async function onShare() {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      const { shareWeeklyZoneCard } = await import('@/lib/share/shareWeeklyZoneCard')
      await shareWeeklyZoneCard({
        weekN,
        onStatus: (s) => {
          if (s.kind === 'downloaded')  setStatus('Downloaded')
          else if (s.kind === 'cancelled') setStatus(null)
          else if (s.kind === 'success')   setStatus(null)
          else if (s.kind === 'error')     setStatus(s.message || 'Share failed')
        },
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={onShare}
      disabled={busy}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
        // SHARE moment — promoted to filled-moss CTA per audit item #10.
        color: 'var(--card)',
        background: 'var(--moss)',
        border: 'none',
        borderRadius: '22px',
        padding: '0 18px',
        minHeight: '44px',  // iOS HIG tap-target minimum.
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }}
    >
      {status ?? (busy ? 'Preparing…' : 'Share')}
    </button>
  )
}

// SAVE-IMG-01 — "Share" button rendered BELOW SessionCompleteCard
// (never inside). Keeps the user's iOS screenshot of the card clean.
// Tinted-moss secondary style — the card itself is the moment; the
// button is the accelerator. Same label as ShareWeekButton on Coach.
function SaveImageButton({ weekN, sessionDay }: { weekN: number; sessionDay: string }) {
  const [busy, setBusy]     = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 2200)
    return () => clearTimeout(t)
  }, [status])

  async function onSave() {
    if (busy) return
    setBusy(true)
    setStatus(null)
    try {
      const { shareSessionCompleteCard } = await import('@/lib/share/shareSessionCompleteCard')
      await shareSessionCompleteCard({
        weekN,
        sessionDay,
        onStatus: (s) => {
          if (s.kind === 'downloaded')     setStatus('Saved')
          else if (s.kind === 'cancelled') setStatus(null)
          else if (s.kind === 'success')   setStatus(null)
          else if (s.kind === 'error')     setStatus(s.message || 'Save failed')
        },
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={onSave}
      disabled={busy}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
        color: 'var(--moss)',
        background: 'rgba(107,142,107,0.12)',
        border: 'none',
        borderRadius: '22px',
        padding: '0 18px',
        minHeight: '44px',  // iOS HIG tap-target minimum.
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.7 : 1,
      }}
    >
      {status ?? (busy ? 'Preparing…' : 'Share')}
    </button>
  )
}

// LEDGER-01 — "Weeks within the lines" RestraintCard.
//
// Moved 2026-05-23 from the Me/Profile screen to the Coach screen — the metric
// belongs with the rest of the execution / discipline data, not the admin /
// connections context where it originally landed. Counter, not a streak. No
// flames, no urgency, no celebration of milestones. Resets silently to 0 on a
// broken week. Voice anchor stamp at the bottom — same anatomy as Pattern 11
// (RestraintCard) in ui-patterns.md.
function LedgerCard({ ledger: ledgerProp }: { ledger?: LedgerSnapshot | null }) {
  // Prefer the prefetched snapshot from the parent's orchestrated load so the
  // card is resolved on first paint. Fall back to the hook only when the prop
  // is absent (skip the hook's fetch when we already have the data).
  const hookLedger = useDisciplineLedger(ledgerProp != null)
  const ledger = ledgerProp ?? hookLedger
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)',
      padding: '20px',
    }}>
      {ledger == null ? (
        // Loading placeholder — same shape as the resolved card so the
        // surface doesn't reflow when the data lands.
        <>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
            color: 'var(--mute)', opacity: 0.4,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            letterSpacing: '-0.05em',
            marginBottom: '8px',
          }}>—</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.5 }}>
            weeks within the lines
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
              color: ledger.weeksWithinLines === 0 ? 'var(--mute)' : 'var(--ink)',
              opacity: ledger.weeksWithinLines === 0 ? 0.6 : 1,
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
              letterSpacing: '-0.05em',
            }}>
              {ledger.weeksWithinLines}
            </div>
            {ledger.currentWeekStatus === 'pending' && ledger.weeksWithinLines > 0 && (
              <span style={{
                fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600,
                color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>
                pending
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: ledger.weeksWithinLines === 0 ? 'var(--ink-2)' : 'var(--mute)', lineHeight: 1.5, marginBottom: '14px' }}>
            {ledger.weeksWithinLines === 0
              ? 'This week starts the count.'
              : 'weeks within the lines'}
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
            color: 'var(--mute)', letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>
            {BRAND.voiceAnchor}
          </div>
        </>
      )}
    </div>
  )
}

function CoachScreen({ plan, currentWeek, runs, stravaLoading, stravaConnected, stravaTokenFailed, firstName, weeklyReport, onReportGenerated, preferredUnits = 'km', zoneDisciplinePercent, zoneTimePctByZone, zoneHistogramHits, liveSessionsCompleted, liveSessionsPlanned, liveSessionsDueToDate, phaseSummary, onPhaseSummaryGenerated, raceReadinessNote, onRaceReadinessGenerated, zoneDriftPattern, zoneDriftDismissedAt, onDismissZoneDrift, benchmarkRecalDismissedAt, onDismissRecal, onOpenBenchmark, runAnalysisReady = true, disciplineLedger, onConnect, restingHR, maxHR, healthkitConnectedAt }: {
  plan: Plan; currentWeek: Week; runs: any[] | null; stravaLoading: boolean
  stravaConnected: boolean
  stravaTokenFailed?: boolean; firstName?: string
  weeklyReport?: any | null; onReportGenerated?: (report: any) => void
  preferredUnits?: 'km' | 'mi'
  zoneDisciplinePercent?: number | null
  zoneTimePctByZone?: { z1: number; z2: number; z3: number; z45: number } | null
  zoneHistogramHits?: number
  liveSessionsCompleted?: number
  liveSessionsPlanned?: number
  /** Sessions whose calendar day is strictly past — "due by end of yesterday".
   *  Used for the verdict line beneath the headline number so "X behind" only
   *  fires when the runner is genuinely behind. CoachingPrinciples §65. */
  liveSessionsDueToDate?: number
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
  /** Gates the ZoneRings loading skeleton — true once run_analysis has been
   *  fetched. Without it the skeleton can't tell "still loading" from "no data". */
  runAnalysisReady?: boolean
  /** Prefetched discipline ledger from the parent's orchestrated load, so the
   *  LedgerCard renders resolved on first paint. null until loaded (or if the
   *  fetch failed) — LedgerCard falls back to its own hook in that case. */
  disciplineLedger?: LedgerSnapshot | null
  /** Navigate to where a runner connects a run source (Profile). Shown in the
   *  ZoneRings empty state when nothing is linked. */
  onConnect?: () => void
  /** X-FIRSTRUN: pre-data state detection. The empty Kit read selects copy +
   *  CTA based on which signal is missing (source / runs / HR). */
  restingHR?: number | null
  maxHR?: number | null
  healthkitConnectedAt?: string | null
}) {
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [refreshBlocked, setRefreshBlocked] = useState(false)

  const weekNum    = getCurrentWeekIndex(plan.weeks) + 1
  const totalWeeks = plan.weeks.length
  // ADR-013: `weekNum` is the display ordinal (array position, shown as
  // "W4 of 11"). `weekKey` is the canonical week.n — the key weekly_reports,
  // phase_summaries and plan.weeks lookups use. They diverge on a standalone
  // maintenance plan (position 4 vs n 29); keying by the ordinal there reads the
  // archived race plan's rows. No-op on race plans (position == n).
  const weekKey    = (currentWeek as any)?.n ?? weekNum
  const reportIsCurrent = weeklyReport?.week_n === weekKey
  // Live score from completions (passed in from DashboardClient — requires Strava HR data).
  // Falls back to the most recent report score if no live data is available.
  const currentScore: number | null =
    zoneDisciplinePercent ?? (reportIsCurrent ? (weeklyReport.zone_discipline_score ?? null) : null)
  // If the cached report is from last week, surface it as a reference point
  const lastWeekScore: number | null =
    weeklyReport?.week_n === weekKey - 1 ? (weeklyReport.zone_discipline_score ?? null) : null

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
  // ADR-013 maintenance plans carry race_date === '' (no upcoming race), so the
  // date math below yields NaN. Detect that plan kind and guard the value — the
  // "Weeks left" tile is swapped for a Phase tile when there's no race to count to.
  const isMaintenancePlan = (plan.meta as any)?.plan_kind === 'maintenance'
  const rawWeeksToRace = Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
  const weeksToRace = Number.isFinite(rawWeeksToRace) ? Math.max(0, rawWeeksToRace) : 0
  // On a race week the zone-discipline % and load-ratio spike by design — a race
  // is run at race effort, not by holding easy zones. The verdict copy on those
  // two tiles must NOT scold ("ran too hot" / "overloading") on this week.
  const isRaceWeek = (currentWeek as any)?.type === 'race'

  // ── R28 / R29 detection ─────────────────────────────────────────────────
  const daysToRace = Math.round((new Date(plan.meta.race_date).getTime() - Date.now()) / 86_400_000)
  const isRaceWindow = daysToRace >= 0 && daysToRace <= 14

  // Phase transition: compare current week's phase with previous week's phase
  const prevWeek = plan.weeks.find((w: any) => w.n === weekKey - 1)
  const currentPhase: string | null = (currentWeek as any).phase ?? null
  const prevPhase: string | null    = (prevWeek as any)?.phase ?? null
  const phaseJustChanged = !!(currentPhase && prevPhase && currentPhase !== prevPhase)
  const phaseEnded       = phaseJustChanged ? prevPhase! : null
  const transitionWeekN  = phaseJustChanged ? weekKey : null

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
      // DS-03: source-neutral copy — zone discipline comes from HR data, not a specific provider
      return runs?.length
        ? "Need at least two sessions with HR data this week to score."
        : "Log a run with heart rate to start tracking your zone discipline."
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
  // CoachingPrinciples §65 — today is in flight. The headline number stays
  // "X / full-week-planned" (honest, the runner can see what's still ahead),
  // but the verdict line uses sessions-due-by-end-of-yesterday so "X behind"
  // only fires when the runner is genuinely behind, not at noon Wednesday
  // when three days remain. "Complete" still requires all planned sessions
  // done — that's an end-of-week verdict, not a mid-week one.
  function sessionsContext(done: number | null, planned: number | null, dueToDate: number | null): { label: string; color: string } {
    if (done === null || planned === null) return { label: '—', color: 'var(--mute)' }
    if (done >= planned) return { label: 'complete', color: 'var(--moss)' }
    const dueRef = dueToDate ?? planned
    if (dueRef === 0)            return { label: 'on track', color: 'var(--moss)' }
    const behind = dueRef - done
    if (behind <= 0)             return { label: 'on track', color: 'var(--moss)' }
    if (done / dueRef >= 0.7)    return { label: 'on track', color: 'var(--moss)' }
    return { label: `${behind} behind`, color: 'var(--warn)' }
  }

  // ── Weeks to race context ───────────────────────────────────────────────
  function weeksContext(weeks: number): { label: string; color: string } {
    if (weeks === 0) return { label: 'race week', color: 'var(--warn)' }
    if (weeks === 1) return { label: '1 week left', color: 'var(--warn)' }
    return { label: `${weeks} weeks left`, color: 'var(--mute)' }
  }

  const lrc  = loadRatioContext(loadRatio)
  const sc   = sessionsContext(sessionsCompleted, sessionsPlanned, liveSessionsDueToDate ?? null)
  const wtrc = weeksContext(weeksToRace)

  const [loadSheetOpen, setLoadSheetOpen] = useState(false)
  const [zoneDisciplineSheetOpen, setZoneDisciplineSheetOpen] = useState(false)

  // ── R25 Cut #3: Easy-run trend card ────────────────────────────────────
  // Same pattern as the long-run aerobic trend (AI-DEPTH-03) below.
  // Only renders when live — no pending/skeleton clutter (long run card covers that).
  const [easyTrendData, setEasyTrendData] = useState<{
    state: 'live'
    earlierMonth: string; earlierHr: number; nowHr: number
    cohortSize: number; windowMonths: number; gloss?: string
  } | null>(null)
  useEffect(() => {
    async function fetchEasyTrend() {
      const easyDistances: number[] = []
      for (const week of plan.weeks) {
        const sessions = (week as any).sessions ?? {}
        for (const s of Object.values(sessions)) {
          if ((s as any)?.type === 'easy' && (s as any)?.distance_km) {
            easyDistances.push((s as any).distance_km as number)
          }
        }
      }
      if (!easyDistances.length) return
      easyDistances.sort((a, b) => a - b)
      const anchorKm = easyDistances[Math.floor(easyDistances.length / 2)]
      try {
        const params = new URLSearchParams({
          session_type:  'easy',
          distance_km:   String(anchorKm),
          window_months: '6',
          include_gloss: 'true',
        })
        const res = await authedFetch(`/api/coaching/trend?${params}`)
        if (!res.ok) return
        const data = await res.json()
        const trend = data.trend
        if (!trend?.hrIsTrending) return
        const first = trend.buckets[0]
        const last  = trend.buckets[trend.buckets.length - 1]
        const cohortSize = trend.buckets.reduce((s: number, b: any) => s + b.cohortSize, 0)
        setEasyTrendData({
          state:        'live',
          earlierMonth: first.shortLabel,
          earlierHr:    first.avgHr ?? 0,
          nowHr:        last.avgHr  ?? 0,
          cohortSize,
          windowMonths: trend.windowMonths,
          gloss:        data.gloss,
        })
      } catch {
        // silent — easy-run trend is bonus signal
      }
    }
    void fetchEasyTrend()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fire once on CoachScreen mount

  // ── AI-DEPTH-03: Aerobic Trend card ────────────────────────────────────
  // Fetched lazily on CoachScreen mount (same pattern as race-readiness / phase-summary).
  // Lazy because it involves an AI call (~500ms); pre-fetching in the DashboardClient
  // Promise.all would slow every app load for a feature that only shows on Coach.
  const [trendCardData, setTrendCardData] = useState<{
    state: 'live'
    earlierMonth: string; earlierHr: number; nowHr: number
    cohortSize: number; windowMonths: number; gloss?: string
  } | { state: 'pending' } | null>(null)
  const [trendCardLoading, setTrendCardLoading] = useState(true)

  useEffect(() => {
    async function fetchTrend() {
      // Derive the anchor distance from the plan's long-run sessions.
      // Median of all planned long-run distances; returns null when no long runs exist.
      const longRunDistances: number[] = []
      for (const week of plan.weeks) {
        const sessions = (week as any).sessions ?? {}
        for (const s of Object.values(sessions)) {
          if (isLongRun(s as any) && (s as any)?.distance_km) {
            longRunDistances.push((s as any).distance_km as number)
          }
        }
      }
      if (!longRunDistances.length) {
        setTrendCardData({ state: 'pending' })
        setTrendCardLoading(false)
        return
      }
      longRunDistances.sort((a, b) => a - b)
      const anchorKm = longRunDistances[Math.floor(longRunDistances.length / 2)]

      try {
        const params = new URLSearchParams({
          session_type: 'long',
          distance_km:  String(anchorKm),
          window_months: '6',
          include_gloss: 'true',
        })
        const res = await authedFetch(`/api/coaching/trend?${params}`)
        if (!res.ok) { setTrendCardData({ state: 'pending' }); return }
        const data = await res.json()
        const trend = data.trend
        if (!trend || !trend.hrIsTrending) {
          setTrendCardData({ state: 'pending' })
          return
        }
        const first = trend.buckets[0]
        const last  = trend.buckets[trend.buckets.length - 1]
        const cohortSize = trend.buckets.reduce((s: number, b: any) => s + b.cohortSize, 0)
        setTrendCardData({
          state:        'live',
          earlierMonth: first.shortLabel,
          earlierHr:    first.avgHr ?? 0,
          nowHr:        last.avgHr  ?? 0,
          cohortSize,
          windowMonths: trend.windowMonths,
          gloss:        data.gloss,
        })
      } catch {
        setTrendCardData({ state: 'pending' })
      } finally {
        setTrendCardLoading(false)
      }
    }
    void fetchTrend()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fire once on CoachScreen mount — data is stable for the session

  // CO-ONE: The single Kit read assembles signals in priority order:
  //   1. Race window  → race-readiness content leads
  //   2. Phase change → phase-summary content leads (race suppresses phase)
  //   3. Zone drift   → folds in as body sentence (race suppresses)
  //   4. Trend signal → folds in as body sentence when hrIsTrending
  //   5. Base synthesis → weeklyReport headline/body/cta default
  // Highest-priority signal leads the headline + body; lower signals append.
  // Race suppresses both phase AND drift (race week is too important to dilute).
  // No CoachByline duplication anywhere else on Coach (Pattern 16b provenance).
  //
  // Hybrid scope (Decision #2): no "Manage what Kit watches" sheet in v1 —
  // existing zoneDriftDismissedAt / benchmarkRecalDismissedAt columns kept
  // in schema, no surface to set them. Folded signals appear in the read
  // whenever they fire; dismissal sheet is a Phase 2 backlog item.
  const consolidatedRead = (() => {
    type ReadShape = {
      headline:  string | null
      body:      string | null
      action:    string | null
      isLoading: boolean
      // True when this is genuine model synthesis (weeklyReport spine,
      // race-readiness content, phase-summary content). Empty state is
      // hand-authored → no AIMark in that case (Pattern 16 provenance).
      hasAiContent: boolean
      // X-FIRSTRUN: empty-state primary action. Replaces the "Generate
      // report" button when present (no point generating from no data).
      // Routes to connect-source or HR-setup depending on which signal
      // is missing.
      cta?: { label: string; onClick: () => void } | null
    }

    // Race leads (priority 1) — replaces base spine, suppresses drift.
    if (showRaceCard) {
      if (specialCardLoading && !localRaceReadiness) {
        return { headline: null, body: null, action: null, isLoading: true, hasAiContent: true } as ReadShape
      }
      if (localRaceReadiness) {
        const daysLine = daysToRace === 0 ? 'Race day.' : `Race in ${daysToRace} day${daysToRace === 1 ? '' : 's'}.`
        return { headline: daysLine, body: localRaceReadiness.content, action: null, isLoading: false, hasAiContent: true } as ReadShape
      }
    }

    // Phase leads (priority 2) — replaces base spine, drift can still fold.
    if (showPhaseCard) {
      if (specialCardLoading && !localPhaseSummary) {
        return { headline: null, body: null, action: null, isLoading: true, hasAiContent: true } as ReadShape
      }
      if (localPhaseSummary) {
        const body: string[] = [localPhaseSummary.content]
        if (zoneDriftPattern) {
          body.push(`${zoneDriftPattern.count} of your last ${zoneDriftPattern.total} easy sessions crept above Zone 2.`)
        }
        return {
          headline: "You've crossed into a new phase.",
          body:     body.join(' '),
          action:   null,
          isLoading: false,
          hasAiContent: true,
        } as ReadShape
      }
    }

    // Base synthesis (priority 5) — weeklyReport spine, with drift + trend folded in.
    if (loading) {
      return { headline: null, body: null, action: null, isLoading: true, hasAiContent: true } as ReadShape
    }

    if (reportIsCurrent && weeklyReport?.headline) {
      const body: string[] = []
      if (weeklyReport.body) body.push(weeklyReport.body)
      if (zoneDriftPattern) {
        body.push(`${zoneDriftPattern.count} of your last ${zoneDriftPattern.total} easy sessions crept above Zone 2. If easy isn't easy, hard can't be hard.`)
      }
      // Trend fold — when the trend engine returned a live state with a gloss
      // (i.e. hrIsTrending), surface as a templated sentence in Kit's voice.
      // The TrendCard below shows the numbers; this is the interpretation.
      if (trendCardData?.state === 'live' && trendCardData.gloss) {
        body.push(`Easy is easier than it was — ${trendCardData.earlierHr} down to ${trendCardData.nowHr} since ${trendCardData.earlierMonth}.`)
      }
      return {
        headline: weeklyReport.headline,
        body:     body.length ? body.join(' ') : null,
        action:   weeklyReport.cta ?? null,
        isLoading: false,
        hasAiContent: true,
      } as ReadShape
    }

    // No report yet → hand-authored line. No AIMark per Pattern 16 provenance
    // honesty — empty-state copy is not model output.
    //
    // X-FIRSTRUN: branch on which signal is actually missing so the empty
    // state teaches the ONE next action instead of a generic "log a run"
    // line. Without HR baseline, the read is honest about what's blocked —
    // a runner could be logging perfectly and still see no coaching because
    // they never set their max HR. State machine:
    //   - no-source: no Strava token AND no Apple Health connection
    //   - no-runs:   source connected but no runs in the snapshot
    //   - no-hr:     runs exist but RHR or MaxHR missing
    //   - last-week: stale weekly report (handled above; falls through)
    const hasHkConnected = !!healthkitConnectedAt
    const hasAnySource   = stravaConnected || hasHkConnected
    const hasRuns        = !!runs?.length
    const hasHr          = !!restingHR && !!maxHR

    let emptyHeadline: string
    let emptyBody:     string
    let emptyCta:      { label: string; onClick: () => void } | null = null

    if (weeklyReport && !reportIsCurrent) {
      emptyHeadline = "Last week's report is below."
      emptyBody     = 'Generate a report to see how this week is tracking.'
    } else if (!hasAnySource) {
      emptyHeadline = "Nothing to coach from yet."
      emptyBody     = 'Connect Apple Health or Strava so I can see your runs. I keep quiet until I have something honest to say.'
      emptyCta      = onConnect ? { label: 'Connect a source', onClick: onConnect } : null
    } else if (!hasRuns) {
      emptyHeadline = "Waiting on your first run."
      emptyBody     = "Go log a session — even an easy one. Once I see a run with heart rate, I can say something useful."
      emptyCta      = null
    } else if (!hasHr) {
      emptyHeadline = "One more thing."
      emptyBody     = "Set your resting and max heart rate. Without those, the zone targets are guesses."
      emptyCta      = onOpenBenchmark ? { label: 'Set heart rate', onClick: onOpenBenchmark } : null
    } else {
      emptyHeadline = 'Nothing to read yet.'
      emptyBody     = 'Generate a report to see how this week is tracking.'
    }

    return {
      headline: emptyHeadline,
      body:     emptyBody,
      action:   null,
      cta:      emptyCta,
      isLoading: false,
      hasAiContent: false,
    } as ReadShape
  })()

  return (
    <div>
      <ScreenHeader title="Your coach" sub={`W${weekNum} of ${totalWeeks}`} />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '32px' }}>

        {/* ── CO-ONE: THE ONE KIT READ ──────────────────────────────────
            Single authored synthesis. Replaces five previous standalone Kit
            surfaces: identity card, first-open intro, weekly report card,
            race readiness card, phase summary card, zone drift card. Lower-
            priority signals fold INTO this read as body sentences. This is
            the ONLY CoachByline + AIMark on the screen (Pattern 16b
            provenance). Empty state renders a dimmed Kit identity WITHOUT
            AIMark — hand-authored line, not model output. */}
        <div style={{
          background:   'var(--card)',
          borderRadius: 'var(--radius-lg)',
          border:       '1px solid var(--line)',
          padding:      '18px 20px 18px 22px',
          position:     'relative',
        }}>
          {/* 3px moss left rail at left:8px (Pattern 16b) */}
          <div style={{
            position:     'absolute',
            left:         '8px',
            top:          '14px',
            bottom:       '14px',
            width:        '3px',
            background:   'var(--moss)',
            borderRadius: '2px',
            opacity:      consolidatedRead.hasAiContent ? 1 : 0.3,
          }} />

          {/* Eyebrow — single byline + week counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            {consolidatedRead.hasAiContent ? (
              <CoachByline working={consolidatedRead.isLoading} color="moss" role="This week" />
            ) : (
              // Empty state: dimmed Kit identity, NO AIMark (Pattern 16
              // provenance honesty — empty line is hand-authored).
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', opacity: 0.45 }} aria-label={`${BRAND.coachName} — this week`}>
                <span aria-hidden="true" style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'var(--moss)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--card)', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
                  letterSpacing: '-0.02em', flexShrink: 0,
                }}>
                  {BRAND.coachName.charAt(0).toUpperCase()}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                    {BRAND.coachName}
                  </span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600, color: 'var(--moss)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    This week
                  </span>
                </span>
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', fontVariantNumeric: 'tabular-nums' }}>
              W{weekNum}/{totalWeeks}
            </span>
          </div>

          {stravaTokenFailed && !stravaLoading && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-2)', opacity: 0.7 }}>
                Strava connection expired. Reconnect in Profile.
              </span>
            </div>
          )}

          {consolidatedRead.isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {[85, 100, 70].map((w, i) => (
                <div key={i} style={{ height: '13px', background: 'rgba(107,142,107,0.12)', borderRadius: '4px', width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <>
              {consolidatedRead.headline && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600,
                  color: consolidatedRead.hasAiContent ? 'var(--ink)' : 'var(--ink-2)',
                  letterSpacing: '-0.3px', lineHeight: 1.3,
                  marginBottom: consolidatedRead.body ? '10px' : 0,
                }}>
                  {consolidatedRead.headline}
                </div>
              )}
              {consolidatedRead.body && (
                <p style={{
                  fontFamily: 'var(--font-ui)', fontSize: '13px',
                  color: 'var(--ink-2)', lineHeight: 1.7, margin: 0,
                  marginBottom: consolidatedRead.action ? '12px' : 0,
                }}>
                  {consolidatedRead.body}
                </p>
              )}
              {consolidatedRead.action && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                  color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic',
                }}>
                  {consolidatedRead.action}
                </div>
              )}
            </>
          )}

          {error && (
            <div style={{ marginTop: '10px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--danger)', opacity: 0.85 }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            {refreshBlocked && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', display: 'block', width: '100%', marginBottom: '4px' }}>
                Already refreshed today.
              </span>
            )}
            {consolidatedRead.cta ? (
              // X-FIRSTRUN: pre-data primary action takes over the button slot.
              // No "Generate report" until there's data to generate from — the
              // empty state teaches the one next action that unblocks coaching.
              <button
                onClick={consolidatedRead.cta.onClick}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                  color: 'var(--card)',
                  background: 'var(--moss)',
                  border: 'none',
                  borderRadius: '22px',
                  padding: '0 18px',
                  minHeight: '44px',
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {consolidatedRead.cta.label} →
              </button>
            ) : (
              <button
                onClick={generateReport}
                disabled={loading || refreshBlocked}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                  color: 'var(--moss)',
                  background: 'rgba(107,142,107,0.10)',
                  border: 'none',
                  borderRadius: '22px',
                  padding: '0 18px',
                  minHeight: '44px',
                  cursor: (loading || refreshBlocked) ? 'default' : 'pointer',
                  opacity: (loading || refreshBlocked) ? 0.4 : 1,
                }}
              >
                {loading && <AIMark size={10} color="var(--moss)" working />}
                {loading ? 'Generating' : (reportIsCurrent && weeklyReport?.headline ? 'Refresh' : 'Generate report')}
              </button>
            )}
            {reportIsCurrent && weeklyReport?.zone_discipline_score != null && (
              <ShareWeekButton weekN={weeklyReport.week_n} />
            )}
          </div>
        </div>

        {/* ── STATS 2×2 GRID — supporting evidence tier ────────────────
            Numbers that explain what Kit said above. Stats follow the read,
            not precede it. The read is the hero; these are the evidence. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {([
            {
              label: 'Zone discipline',
              value: currentScore !== null ? `${currentScore}%` : '—',
              sub: isRaceWeek ? 'Race effort — not an easy-zone day' : scoreBodyCopy(currentScore).split('.')[0],
              subColor: isRaceWeek ? 'var(--ink-2)' : currentScore !== null && currentScore >= 80 ? 'var(--moss)' : currentScore !== null && currentScore >= 60 ? 'var(--ink-2)' : currentScore !== null ? 'var(--warn)' : 'var(--mute)',
              onTap: () => setZoneDisciplineSheetOpen(true),
            },
            {
              label: 'Load ratio',
              value: loadRatio !== null ? `${loadRatio.toFixed(2)}x` : '—',
              sub: isRaceWeek ? 'race week — spike expected' : lrc.label,
              subColor: isRaceWeek ? 'var(--ink-2)' : lrc.color,
              onTap: () => setLoadSheetOpen(true),
            },
            {
              label: 'Sessions',
              value: sessionsCompleted !== null && sessionsPlanned !== null ? `${sessionsCompleted}/${sessionsPlanned}` : '—',
              sub: sc.label,
              subColor: sc.color,
              onTap: undefined,
            },
            isMaintenancePlan
              ? {
                  label: 'Phase',
                  value: 'Maintenance',
                  sub: PHASE_LABELS[(currentWeek as any)?.phase] ?? 'Base',
                  subColor: 'var(--mute)',
                  onTap: undefined,
                }
              : {
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
                  {m.onTap && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)' }}>ⓘ</span>}
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

        {/* ── ZONE RINGS (Pattern 22) ─────────────────────────────────────
            Per-zone weekly breakdown — concentric brand mark, one ring per
            zone, arc-filled to % time in that zone for the week. Companion
            to the discipline % tile in the 2×2 grid above: the tile gives
            the verdict, the rings give the breakdown. Coach is paid-gated
            at the screen level, so only live / skeleton / empty states
            render here (no locked state needed). */}
        {(() => {
          // Live — at least one analysed run this week carries a zone histogram.
          if (zoneTimePctByZone) {
            return (
              <ZoneRings
                pctByZone={zoneTimePctByZone}
                meta={`across ${zoneHistogramHits} ${zoneHistogramHits === 1 ? 'run' : 'runs'}`}
              />
            )
          }
          // Genuine loading — the analysis fetch hasn't returned on first paint.
          if (!runAnalysisReady) {
            return <ZoneRingsSkeleton />
          }
          // Ready, but no zone histogram for this week's runs. Honest resting
          // state — NOT a perpetual shimmer (the old bug). Prompt to connect a
          // source if there isn't one; otherwise explain zones need a heart-rate
          // run (covers manual logs, HR-less runs, and links that never analysed).
          return (
            <ZoneRings
              state="empty"
              // DS-03: reason is now based on whether we have any runs (source-agnostic),
              // not whether Strava is specifically connected. HealthKit runs populate
              // the same `runs` array, so 'not-linked' correctly means "no data at all".
              reason={runs?.length ? 'no-data' : 'not-linked'}
              onConnect={onConnect}
            />
          )
        })()}

        {/* ── LOAD RATIO SHEET ────────────────────────────────────────── */}
        {loadSheetOpen && (
          <div
            onClick={() => setLoadSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,26,26,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'zonna-fade-in 0.18s ease-out' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '480px', background: 'var(--card)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,0.12)', paddingTop: '8px', maxHeight: '80vh', overflowY: 'auto', animation: 'zonna-slide-up 0.22s ease-out' }}
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

          </div>
        )}

        {/* ── ZONE DISCIPLINE SHEET ───────────────────────────────────── */}
        {zoneDisciplineSheetOpen && (
          <div
            onClick={() => setZoneDisciplineSheetOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(26,26,26,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'zonna-fade-in 0.18s ease-out' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '480px', background: 'var(--card)', borderRadius: '20px 20px 0 0', boxShadow: '0 -8px 24px rgba(0,0,0,0.12)', paddingTop: '8px', maxHeight: '80vh', overflowY: 'auto', animation: 'zonna-slide-up 0.22s ease-out' }}
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

          </div>
        )}

        {/* ── LEDGER — "Weeks within the lines" ─────────────────────────
            After the stats evidence tier. RestraintCard anatomy (Pattern 11). */}
        <LedgerCard ledger={disciplineLedger} />

        {/* ── AI-DEPTH-03: AEROBIC TREND CARD ──────────────────────────
            HR drift over time — the receipt for zone discipline.
            Skeleton while loading; live/pending based on trend engine output.
            No locked state here — CoachScreen is already paid-gated upstream. */}
        {/* CO-ONE: glossless mode strips the AI gloss + its CoachByline so
            the trend reads as raw evidence. Trend interpretation folds into
            the one Kit read at the top of Coach instead — see
            `consolidatedRead` above (priority-4 trend fold). */}
        {trendCardLoading
          ? <TrendCard state="skeleton" />
          : trendCardData?.state === 'live'
          ? <TrendCard
              state="live"
              earlierMonth={trendCardData.earlierMonth}
              earlierHr={trendCardData.earlierHr}
              nowHr={trendCardData.nowHr}
              cohortSize={trendCardData.cohortSize}
              windowMonths={trendCardData.windowMonths}
              gloss={trendCardData.gloss}
              glossless
            />
          : <TrendCard state="pending" />
        }

        {/* R25 Cut #3 — easy-run trend. Only renders when live and the signal
            is meaningful (hrIsTrending). No pending/skeleton to avoid clutter
            — the long-run card above already handles the "not enough data" state. */}
        {easyTrendData?.state === 'live' && (
          <TrendCard
            state="live"
            label="Easy run trend"
            sessionLabel="easy run"
            earlierMonth={easyTrendData.earlierMonth}
            earlierHr={easyTrendData.earlierHr}
            nowHr={easyTrendData.nowHr}
            cohortSize={easyTrendData.cohortSize}
            windowMonths={easyTrendData.windowMonths}
            gloss={easyTrendData.gloss}
            glossless
          />
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

// ── PUSH NOTIFICATIONS ROW ────────────────────────────────────────────────

// LocalStorage flag tracking the user's explicit "off" intent. iOS won't
// let us revoke push permission programmatically, but we control our DB
// subscription row — toggling off deletes the row and stamps this flag
// so the row isn't auto-recreated by the mount-time check.
const PUSH_OFF_KEY = 'zonna_push_disabled'

// iOS hands back the APNs device token via the `registration` event, but only
// reliably on the FIRST `register()` of an app session. A second register()
// — e.g. toggling Run notifications off then back on without relaunching —
// frequently never re-fires the event, so a register-and-wait hangs for the
// full timeout and then errors ("Working…" forever → "Couldn't enable push").
// We sidestep that by caching the token at module scope the first time it
// arrives and reusing it for every later subscribe/unsubscribe this session.
type PushListenerHandle = { remove: () => Promise<void> }
let cachedDeviceToken: string | null = null
let tokenListenerAttached = false

// Attach one persistent `registration` listener so any token iOS emits is
// captured into the cache, regardless of which toggle action triggered it.
async function attachTokenListener() {
  if (tokenListenerAttached) return
  tokenListenerAttached = true
  const { PushNotifications } = await import('@capacitor/push-notifications')
  await PushNotifications.addListener('registration', tok => { cachedDeviceToken = tok.value })
}

// Resolve the APNs device token: the cached value if we've already seen one
// this session, otherwise call register() once and wait for the event (bounded
// so the UI can't hang forever — simulator/sandbox APNs can be unreachable).
// Crucially, once ANY register() fires the token is cached, so the second
// enable/disable in a session returns instantly instead of timing out.
async function getDeviceToken(timeoutMs = 30_000): Promise<string> {
  await attachTokenListener()
  if (cachedDeviceToken) return cachedDeviceToken
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let regHandle: PushListenerHandle | undefined
  let errHandle: PushListenerHandle | undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn() } }
      const timeoutId = setTimeout(() => {
        settle(() => reject(new Error('APNs registration timed out — push may be unavailable here')))
      }, timeoutMs)
      Promise.all([
        PushNotifications.addListener('registration', tok => {
          cachedDeviceToken = tok.value
          settle(() => { clearTimeout(timeoutId); resolve(tok.value) })
        }),
        PushNotifications.addListener('registrationError', err => {
          settle(() => { clearTimeout(timeoutId); reject(new Error(err.error)) })
        }),
      ]).then(([r, e]) => { regHandle = r as PushListenerHandle; errHandle = e as PushListenerHandle })
      PushNotifications.register().catch(err => settle(() => { clearTimeout(timeoutId); reject(err) }))
    })
  } finally {
    // Tear down the per-call waiters — the persistent listener keeps the cache warm.
    await regHandle?.remove?.()
    await errHandle?.remove?.()
  }
}

// Whether the server has a stored push_subscriptions row for this user on the
// given platform. Used so the toggle reflects real subscription state, not just
// OS permission. Any failure resolves false — never claim "on" unconfirmed.
async function hasServerSubscription(platform: 'ios' | 'web'): Promise<boolean> {
  try {
    const res = await authedFetch(`/api/push/subscribe?platform=${platform}`)
    if (!res.ok) return false
    const json = await res.json()
    return json?.subscribed === true
  } catch {
    return false
  }
}

function PushNotificationsRow({ onStatusChange }: { onStatusChange?: (subscribed: boolean) => void } = {}) {
  const [status, setStatus] = useState<'checking' | 'unsupported' | 'subscribed' | 'denied' | 'idle'>('checking')
  const [loading, setLoading] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Bubble the subscribed boolean up so the parent can gate the
  // dependent "Morning training push" toggle on it (you can't get a
  // morning reminder if push itself is off).
  useEffect(() => {
    onStatusChange?.(status === 'subscribed')
  }, [status, onStatusChange])

  useEffect(() => {
    async function check() {
      // Respect user's explicit-off intent — even if iOS permission is
      // still granted, treat as idle so the toggle starts off.
      const userTurnedOff = (() => {
        try { return localStorage.getItem(PUSH_OFF_KEY) === '1' } catch { return false }
      })()

      // Native: ask the plugin whether iOS already granted permission.
      const { Capacitor } = await import('@capacitor/core')
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        try {
          const perm = await PushNotifications.checkPermissions()
          if (perm.receive === 'denied')  { setStatus('denied'); return }
          // Permission granted is necessary but NOT sufficient — the APNs token
          // can fail to register, leaving no push_subscriptions row. Showing
          // "on" off permission alone is a false positive. Confirm a real row.
          if (perm.receive === 'granted' && !userTurnedOff) {
            setStatus((await hasServerSubscription('ios')) ? 'subscribed' : 'idle')
            return
          }
          setStatus('idle')
        } catch { setStatus('idle') }
        return
      }

      // Web: rely on the service worker / PushManager check, then confirm the
      // server row exists too so the toggle can't claim "on" without one.
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setStatus('unsupported'); return }
      const perm = (Notification as any).permission
      if (perm === 'denied') { setStatus('denied'); return }
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        if (!regs.length) { setStatus('idle'); return }
        const sub = await regs[0].pushManager.getSubscription()
        if (!sub || userTurnedOff) { setStatus('idle'); return }
        setStatus((await hasServerSubscription('web')) ? 'subscribed' : 'idle')
      } catch { setStatus('idle') }
    }
    void check()
  }, [])

  async function disablePush() {
    setLoading(true)
    setErrMsg(null)
    try {
      const { Capacitor } = await import('@capacitor/core')

      if (Capacitor.isNativePlatform()) {
        // Get the current device token so we can DELETE the matching row.
        // iOS won't let us revoke the permission itself — that's a Settings
        // app concern — but we can stop sending pushes at our end. Uses the
        // shared cached-token helper so it can't hang on a stale register().
        let token: string | null = null
        try { token = await getDeviceToken(5_000) } catch { token = null }
        if (token) {
          await authedFetch('/api/push/subscribe', {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ token }),
          })
        }
      } else if ('serviceWorker' in navigator) {
        // Web: read the subscription endpoint and delete the matching row.
        // The browser-side subscription stays — we don't unsubscribe from
        // PushManager so re-toggling on doesn't re-prompt for permission.
        try {
          const regs = await navigator.serviceWorker.getRegistrations()
          const sub  = regs[0] && await regs[0].pushManager.getSubscription()
          if (sub) {
            await authedFetch('/api/push/subscribe', {
              method:  'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ endpoint: sub.endpoint }),
            })
          }
        } catch {}
      }

      try { localStorage.setItem(PUSH_OFF_KEY, '1') } catch {}
      setStatus('idle')
    } catch (err) {
      console.warn('[push] disable failed:', err instanceof Error ? err.message : err)
      setErrMsg("Couldn't turn off. Try again in a moment.")
    } finally {
      setLoading(false)
    }
  }

  async function enablePush() {
    setLoading(true)
    setErrMsg(null)
    // Clearing the explicit-off flag — the user is opting back in.
    try { localStorage.removeItem(PUSH_OFF_KEY) } catch {}
    const { Capacitor } = await import('@capacitor/core')

    // Native iOS path: request permission, register, send the device token
    // returned via the `registration` event up to /api/push/subscribe.
    if (Capacitor.isNativePlatform()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')
        const perm = await PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') {
          setStatus('denied')
          setLoading(false)
          return
        }
        // Resolve the device token (cached if we've already seen one this
        // session, else register-and-wait, bounded at 30s). This is the fix
        // for the "Working… forever → Couldn't enable push" bug: a second
        // register() in a session doesn't re-fire the registration event, but
        // the cached token from the first one lets us subscribe instantly.
        const token = await getDeviceToken()
        const res = await authedFetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'ios', token, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        })
        // authedFetch resolves on ANY HTTP status — a 5xx is not a thrown error.
        // Without this check the toggle flips to "subscribed" while no row was
        // ever written. Surface the real failure instead.
        if (!res.ok) {
          throw new Error(`subscribe failed (${res.status})`)
        }
        setStatus('subscribed')
      } catch (err) {
        // Most common cause on simulator: APNs sandbox unreachable. Also fires
        // on a true APNs registration failure in TestFlight. Surface the
        // reason in the UI instead of silently returning to idle — that was
        // the "Enabling… forever" UX the user reported.
        const msg = err instanceof Error ? err.message : String(err)
        console.warn('[push] iOS registration failed:', msg)
        setStatus('idle')
        setErrMsg("Couldn't enable push. Try again in a moment.")
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
      const res = await authedFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      // Same guard as the native path: authedFetch doesn't throw on a 403/5xx,
      // so an unchecked response would fake a successful subscribe.
      if (!res.ok) {
        setStatus('idle')
        setErrMsg(res.status === 403
          ? 'Run pings are part of the paid plan.'
          : "Couldn't enable push. Try again in a moment.")
        return
      }
      setStatus('subscribed')
    } catch { setStatus((Notification as any).permission === 'denied' ? 'denied' : 'idle') }
    finally { setLoading(false) }
  }

  if (status === 'unsupported') return null

  // Toggle is "on" when subscribed; "off" otherwise. While the iOS permission
  // sheet is up we keep it visually on (optimistic) so the user gets immediate
  // feedback. On grant we stay on; on deny we revert to off + sub-copy.
  const isOn = status === 'subscribed' || loading
  // Tap behaviour: OFF → subscribe. ON → unsubscribe (delete the DB row,
  // stamp the localStorage flag so the row isn't auto-recreated on mount).
  // Denied stays a no-op — user has to fix it in iOS Settings.
  const handleTap = () => {
    if (loading || status === 'checking' || status === 'denied') return
    if (status === 'subscribed') {
      void disablePush()
    } else if (status === 'idle') {
      void enablePush()
    }
  }
  const subtitle = errMsg
    ? errMsg
    : status === 'checking' ? 'Checking…'
    : status === 'subscribed' ? "Kit pings you when he's read your run."
    : status === 'denied' ? 'Blocked in iOS Settings — open to enable.'
    : loading ? 'Working…'
    : "Off. Tap to let Kit ping you when he's read your run."

  return (
    <div style={{ margin: '4px 0', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500 }}>Run notifications</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '2px', lineHeight: 1.4 }}>
            {subtitle}
          </div>
        </div>
        <button
          onClick={handleTap}
          disabled={loading || status === 'checking' || status === 'denied'}
          style={{
            width: '44px', height: '26px', borderRadius: '13px', border: 'none',
            cursor: (status === 'denied' || loading || status === 'checking') ? 'default' : 'pointer',
            background: isOn ? 'var(--moss)' : 'var(--line)',
            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
            opacity: status === 'denied' ? 0.5 : 1,
          }}
          aria-label="Toggle run notifications"
        >
          <div style={{
            position: 'absolute', top: '3px',
            left: isOn ? '21px' : '3px',
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'white', transition: 'left 0.2s',
          }} />
        </button>
      </div>
    </div>
  )
}

// ── DAILY PUSH TOGGLE ROW ─────────────────────────────────────────────────
// HOOK-01 — opt-out for the daily morning training-day push. Mirrors the
// PushNotificationsRow visual but renders inline (no permission ask — the
// permission belongs to PushNotificationsRow above).

function DailyPushToggleRow({ enabled, onChange, disabled = false }: {
  enabled: boolean
  onChange: (v: boolean) => void
  /** Parent/child gate — true when Run notifications is off; row goes dim
   *  and toggle is non-interactive (you can't get a morning reminder if
   *  push itself is off). */
  disabled?: boolean
}) {
  // Effective on-state: only "on" when both the user preference says on AND
  // push is enabled at all. Otherwise the toggle should read as off so the
  // user isn't lied to about getting a push that can never arrive.
  const effectiveOn = enabled && !disabled
  return (
    <div style={{ margin: '4px 0', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', opacity: disabled ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500 }}>Morning training push</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '2px', lineHeight: 1.4 }}>
            {disabled
              ? 'Turn on Run notifications first.'
              : enabled
                ? `${BRAND.coachName} reminds you about today's session at 06:30.`
                : 'Off. No morning reminder.'}
          </div>
        </div>
        <button
          onClick={() => { if (!disabled) onChange(!enabled) }}
          disabled={disabled}
          style={{
            width: '44px', height: '26px', borderRadius: '13px', border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            background: effectiveOn ? 'var(--moss)' : 'var(--line)',
            position: 'relative', flexShrink: 0, transition: 'background 0.2s',
          }}
          aria-label="Toggle morning training push"
        >
          <div style={{
            position: 'absolute', top: '3px',
            left: effectiveOn ? '21px' : '3px',
            width: '20px', height: '20px', borderRadius: '50%',
            background: 'white', transition: 'left 0.2s',
          }} />
        </button>
      </div>
    </div>
  )
}

// ── STRAVA CONNECTION ROW ─────────────────────────────────────────────────

// DS-03: StravaConnectionRow is gated on is_admin.
// Strava API approval is pending — showing a Connect button that fails to all
// non-admin users damages trust and implies Strava is required (it isn't).
// Admins still see it for testing. Removes itself silently when is_admin=false.
function StravaConnectionRow() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null) // null = loading
  const [disconnecting, setDisconnecting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setConnected(false); setIsAdminUser(false); return }
      setUserId(user.id)
      const { data } = await supabase.from('user_settings').select('strava_refresh_token, is_admin').eq('id', user.id).single()
      setConnected(!!(data?.strava_refresh_token))
      setIsAdminUser(!!(data as any)?.is_admin)
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

  // Resolve loading: both flags must be non-null before rendering anything.
  const isLoading = connected === null || isAdminUser === null
  // Non-admins never see the Strava row (Strava API approval pending — DS-03).
  if (!isLoading && !isAdminUser) return null

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
            <button onClick={async () => {
              if (!userId) return
              // Finding 7: mint the authorize URL via an authenticated request
              // (authedFetch attaches the bearer token) so the server derives
              // the userId from the session and signs the OAuth state. The
              // route returns the URL as JSON; native opens it in
              // SFSafariViewController (returns via NATIVE_STRAVA_CALLBACK,
              // handled in CapacitorBoot.tsx), web navigates to it. Dynamic
              // Capacitor import keeps the web bundle free of native shims.
              const { Capacitor } = await import('@capacitor/core')
              const isNative = Capacitor.isNativePlatform()
              const res = await authedFetch(`/api/strava/connect${isNative ? '?platform=ios' : ''}`)
              if (!res.ok) return
              const { url } = await res.json()
              if (!url) return
              if (isNative) {
                const { Browser } = await import('@capacitor/browser')
                await Browser.open({ url, presentationStyle: 'popover' })
                return
              }
              window.location.href = url
            }} disabled={!userId} style={{
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
          Kit reads your Strava runs. Nothing else. We're not interested in your followers.
        </div>
      )}
    </div>
  )
}

/**
 * CONNECT-01 — One-shot reminder banner for users who skipped the
 * Connect-Your-Runs ceremony on first plan save.
 *
 * Render rules:
 *   • Native iOS only (no HealthKit on web; banner doesn't apply).
 *   • Shows when connect_runs_seen=false AND connect_runs_banner_dismissed_at IS NULL.
 *   • Dismiss (X button) stamps connect_runs_banner_dismissed_at; banner never returns.
 *
 * Self-contained: fetches its own row from user_settings on mount. Returns
 * null until the check resolves so it doesn't flicker into view on a fresh
 * page load before we know the state.
 */
function ConnectRunsBanner() {
  const [visible, setVisible] = useState<boolean | undefined>(undefined)
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) { setVisible(false); return }
      } catch { setVisible(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setVisible(false); return }
      const { data } = await supabase
        .from('user_settings')
        .select('connect_runs_seen, connect_runs_banner_dismissed_at, strava_refresh_token, healthkit_connected_at')
        .eq('id', user.id)
        .single()
      const skipped       = (data as any)?.connect_runs_seen === false
      const notYetShown   = (data as any)?.connect_runs_banner_dismissed_at == null
      // Suppress if any data source is live — Strava and HealthKit are co-equal.
      const hasDataSource = !!(data as any)?.strava_refresh_token || !!(data as any)?.healthkit_connected_at
      setVisible(skipped && notYetShown && !hasDataSource)
    })()
  }, [])

  async function dismiss() {
    setVisible(false)  // optimistic — instant fade
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('user_settings').upsert({
        id: user.id,
        connect_runs_banner_dismissed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch {
      // Stamp failed — next session-day open will retry. Acceptable.
    }
  }

  if (!visible) return null

  return (
    // Banner anatomy aligned to ui-patterns.md Pattern 10 (PendingAdjustmentBanner):
    // 14px radius, 14px 16px padding. Moss accent rail (vs Pattern 10's warn)
    // because this is a passive reminder, not a coaching warning. Rail is an
    // absolutely-positioned 3px span per Pattern 16b § Companion.
    <div style={{
      position: 'relative',
      margin: '12px 16px 0',
      padding: '14px 16px 14px 24px',
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderRadius: '14px',
      display: 'flex', alignItems: 'flex-start', gap: '10px',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: '8px', top: '14px', bottom: '14px',
        width: '3px', background: 'var(--moss)', borderRadius: '2px',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '2px' }}>
          Still need your runs.
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
          Apple Health connects from the Me screen — takes about ten seconds.
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          // 44pt tap target per iOS HIG. Negative margin keeps the visual ×
          // anchored to the card edge while the hit area extends outward.
          width: '44px', height: '44px',
          marginTop: '-10px', marginRight: '-10px', marginBottom: '-10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--mute)',
          fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 400, lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  )
}

/**
 * Apple Health connect row — iOS-native only, hidden on web.
 * Mirrors StravaConnectionRow shape; HealthKit auth is plugin-based (no OAuth
 * redirect), so the connect button calls the plugin directly.
 */
function AppleHealthConnectionRow({ onHRFound }: {
  /** Called after a successful connect with resting/max HR from HealthKit.
   *  Null = HealthKit had no reading (Garmin user etc). */
  onHRFound?: (rhr: number | null, mhr: number | null) => void
}) {
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
      if (!granted) {
        // User denied at the iOS permission sheet, OR HealthKit unavailable
        // (web/Android), OR the framework isn't linked in Xcode. Caller can
        // distinguish by whether requestHealthKitAuth threw vs returned false.
        console.warn('[HealthKit] auth not granted (denial, unavailable, or framework not linked)')
        return
      }
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
      void syncOnAppOpen().catch((e) => {
        console.warn('[HealthKit] first sync after connect failed:', e)
      })
      // Auto-populate HR zones — same pattern as ConnectRunsScreen
      if (onHRFound) {
        const { fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
        fetchAppleHealthHRSnapshot()
          .then(snap => onHRFound(snap?.restingHR ?? null, snap?.maxHR ?? null))
          .catch(() => onHRFound(null, null))
      }
    } catch (e) {
      // Most likely the plugin failed to load or HealthKit.framework isn't
      // linked. Without this log the connect button silently does nothing,
      // which makes it impossible to debug from the Xcode console.
      console.warn('[HealthKit] connect failed:', e)
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
          {BRAND.name} reads your runs from Apple Health to coach you. Read-only — {BRAND.name} never writes to Apple Health.
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
function AppleHealthPrefillButton({ onPrefill }: { onPrefill: (rhr: number | null, mhr: number | null) => void }) {
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
      const { Health } = await import('@capgo/capacitor-health')
      // Check availability first so we can give a specific reason when the
      // plugin says no — the generic "unavailable" message left users
      // staring at a connected Apple Health row with no idea what to do.
      const availability = await Health.isAvailable().catch(() => ({ available: false }))
      if (!availability.available) {
        setErr('Apple Health isn’t available on this device.')
        return
      }
      const { fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
      const snapshot = await fetchAppleHealthHRSnapshot()
      if (!snapshot) {
        setErr('No data — open Apple Health and let your Watch sync')
        return
      }
      onPrefill(snapshot.restingHR, snapshot.maxHR)
      // Soft-warn if we only got one of the two — pre-fill still happened, but
      // the user should know why the other field is still empty.
      if (snapshot.restingHR == null) {
        setErr('Got max HR, but no resting HR yet')
      } else if (snapshot.maxHR == null) {
        setErr('Got resting HR, but no max HR yet — a workout adds this')
      }
    } catch (e) {
      // Most common cause once availability passes: read permission was revoked
      // in iOS Settings. The Connections row above still shows "Connected"
      // because Supabase only tracks the first-grant moment — re-running the
      // connect flow re-prompts the system sheet and refreshes permission.
      setErr('Couldn’t read from Apple Health. Reconnect in Connections below.')
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

function HRZonesSection({ restingHR, maxHR, birthYear, onSave, hrZoneMethod, hrAssumptionNote }: {
  restingHR: number | null
  maxHR: number | null
  birthYear?: number | null
  onSave: (rhr: number, mhr: number) => void
  /** From plan.meta.hr_zone_method — which fallback level was used when the plan was generated. */
  hrZoneMethod?: string | null
  /** From plan.meta.hr_assumption_note — human-readable explanation of the fallback. */
  hrAssumptionNote?: string | null
}) {
  // Smart default: most people have never tested their max HR, so a blank field
  // leaves zones unconfigured. Pre-fill an age estimate (Tanaka: 208 − 0.7×age —
  // exempt algorithm formula) and label it as an estimate, so zones work out of
  // the box and the number stays honest. Only used when no real max is saved.
  const estMaxHr = (() => {
    if (birthYear == null) return null
    const age = new Date().getFullYear() - birthYear
    if (age < 10 || age > 100) return null
    return Math.round(208 - 0.7 * age)
  })()

  const [rhr, setRhr] = useState(restingHR ? String(restingHR) : '')
  const [mhr, setMhr] = useState(maxHR ? String(maxHR) : (estMaxHr ? String(estMaxHr) : ''))

  useEffect(() => { setRhr(restingHR ? String(restingHR) : '') }, [restingHR])
  useEffect(() => { setMhr(maxHR ? String(maxHR) : (estMaxHr ? String(estMaxHr) : '')) }, [maxHR, estMaxHr])

  // Show the "estimated" hint while no real max is saved and the field still
  // holds the estimate (user hasn't typed their own tested value over it).
  const showEstHint = !maxHR && estMaxHr != null && parseInt(mhr) === estMaxHr
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
        <AppleHealthPrefillButton onPrefill={(r, m) => { if (r != null) setRhr(String(r)); if (m != null) setMhr(String(m)) }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div>
            <label style={labelStyle}>Resting HR</label>
            <TextField type="number" inputMode="numeric" placeholder="48" unit="bpm"
              value={rhr} onChange={setRhr} ariaLabel="Resting heart rate" />
          </div>
          <div>
            <label style={labelStyle}>Max HR</label>
            <TextField type="number" inputMode="numeric" placeholder="188" unit="bpm"
              value={mhr} onChange={setMhr} ariaLabel="Max heart rate" />
          </div>
        </div>
        {showEstHint && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '12px' }}>
            Max HR estimated from your age. Edit it if you&rsquo;ve tested your true max.
          </div>
        )}
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
            {hrZoneMethod === 'karvonen'
              ? 'Your zones · Personalised from HR data'
              : hrZoneMethod
                ? 'Your zones · Age estimate'
                : 'Your zones · HRR method'}
          </div>
          {hrZoneMethod && hrZoneMethod !== 'karvonen' && hrAssumptionNote && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.5, marginBottom: '8px' }}>
              {hrAssumptionNote}
            </div>
          )}
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
          <TextField type="text" placeholder="Russell" value={fn} onChange={setFn} autoComplete="given-name" />
        </div>
        <div>
          <label style={labelStyle}>Last name</label>
          <TextField type="text" placeholder="Shear" value={ln} onChange={setLn} autoComplete="family-name" />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Email</label>
        <TextField type="email" value={email} onChange={() => {}} readOnly />
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
      await clearWidgetState()
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

// ── SupportScreen ─────────────────────────────────────────────────────────────
// In-app contact entry (FREE). Opens a pre-filled email to support@zonna.run with
// a quiet diagnostic footer (app version · platform · account · plan) so support
// can act on the first reply. Copy-address fallback covers users with no mail
// ── PlanHistoryScreen ─────────────────────────────────────────────────────────
// CA-06 — FREE. Read-only reverse-chron list of archived plans from plan_archive.
// No restore at v1. The user sees the races they've trained for as a quiet timeline.

interface ArchivedPlan {
  id:          string
  race_name:   string | null
  race_date:   string | null
  archived_at: string
  /** The live plan (from `plans`), surfaced at the top so history is never
   *  confusingly empty for a single-plan user — `plan_archive` only holds
   *  SUPERSEDED plans, so the current/just-finished plan would otherwise never
   *  appear. */
  isCurrent?:  boolean
}

function PlanHistoryScreen({ onBack }: { onBack: () => void }) {
  const [status, setStatus]   = useState<'loading' | 'loaded' | 'error'>('loading')
  const [plans, setPlans]     = useState<ArchivedPlan[]>([])

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setStatus('error'); return }
        const [{ data, error }, { data: planRow }] = await Promise.all([
          supabase
            .from('plan_archive')
            .select('id, race_name, race_date, archived_at')
            .eq('user_id', user.id)
            .order('archived_at', { ascending: false }),
          supabase.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle(),
        ])
        if (error) { setStatus('error'); return }
        // Prepend the live plan so the user's current/just-finished plan is visible
        // (plan_archive only holds superseded plans).
        const cur = planRow?.plan_json as any
        const currentEntry: ArchivedPlan | null =
          cur && (cur.weeks?.length ?? 0) > 0
            ? { id: 'current', race_name: cur.meta?.race_name ?? null, race_date: cur.meta?.race_date ?? null, archived_at: '', isCurrent: true }
            : null
        setPlans(currentEntry ? [currentEntry, ...(data ?? [])] : (data ?? []))
        setStatus('loaded')
      } catch {
        setStatus('error')
      }
    }
    void load()
  }, [])

  function formatRaceDate(dateStr: string | null): string {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return dateStr }
  }

  function relativeTime(isoStr: string): string {
    const diff = Date.now() - new Date(isoStr).getTime()
    const days = Math.floor(diff / 86400000)
    if (days < 1)   return 'today'
    if (days === 1) return 'yesterday'
    if (days < 30)  return `${days} days ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
    const years = Math.floor(months / 12)
    return `${years} year${years === 1 ? '' : 's'} ago`
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
          Your training
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: '24px' }}>
          Plan history
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 32px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {status === 'loading' && (
          <>
            <style>{`@keyframes ph-shimmer { 0%,100%{opacity:.3} 50%{opacity:.6} }`}</style>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                height: '62px', borderRadius: 'var(--radius-lg)',
                background: 'var(--card)', border: '1px solid var(--line)',
                animation: `ph-shimmer 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.1}s`,
              }} />
            ))}
          </>
        )}

        {status === 'error' && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', textAlign: 'center', marginTop: '48px' }}>
            Couldn&apos;t load plan history. Go back and try again.
          </div>
        )}

        {status === 'loaded' && plans.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: '200px', gap: '8px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
              No prior plans.
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)' }}>
              This is the first one.
            </div>
          </div>
        )}

        {status === 'loaded' && plans.map(p => {
          const raceName  = p.race_name ?? 'Unnamed plan'
          const raceDate  = formatRaceDate(p.race_date)
          let subtitle: string
          if (p.isCurrent) {
            const raceInPast = p.race_date ? new Date(p.race_date).getTime() < Date.now() : false
            subtitle = [raceDate, raceInPast ? 'race done' : 'in progress'].filter(Boolean).join(' · ')
          } else {
            const archived = relativeTime(p.archived_at)
            subtitle = [raceDate, archived ? `replaced ${archived}` : ''].filter(Boolean).join(' · ')
          }
          return (
            <div key={p.id} style={{
              background: 'var(--card)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--line)',
              borderLeft: p.isCurrent ? '3px solid var(--moss)' : '1px solid var(--line)',
              padding: '14px 16px',
            }}>
              {p.isCurrent && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Current
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: '3px' }}>
                {raceName}
              </div>
              {subtitle && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.4 }}>
                  {subtitle}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// client (common on desktop web, where mailto: silently no-ops). Mirrors the
// /support web page register and the DeleteAccountScreen sub-view structure.
const SUPPORT_EMAIL = 'support@zonna.run'

function SupportScreen({ onBack, email, hasPaidAccess, trialDaysLeft }: {
  onBack: () => void
  email?: string
  hasPaidAccess?: boolean
  trialDaysLeft?: number | null
}) {
  const [copied, setCopied] = useState(false)
  const [appInfo, setAppInfo] = useState<{ version: string; build: string } | null>(null)

  const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'
  const tier = hasPaidAccess ? ((trialDaysLeft ?? 0) > 0 ? 'Trial' : 'Pro') : 'Free'

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    CapacitorApp.getInfo()
      .then(info => setAppInfo({ version: info.version, build: info.build }))
      .catch(() => { /* not critical — email still sends without it */ })
  }, [])

  const versionLabel = appInfo ? `${appInfo.version} (${appInfo.build})` : platform

  function buildMailto() {
    const versionTag = appInfo?.version ? `v${appInfo.version}` : platform
    const subject = `${BRAND.name} support — ${versionTag}`
    const body = [
      '',
      '',
      '———',
      `Sent from ${BRAND.name} ${versionLabel} · ${platform}`,
      `Account: ${email || '(not available)'}`,
      `Plan: ${tier}`,
      '(This helps us help you — feel free to delete it.)',
    ].join('\n')
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  function handleEmail() {
    window.location.href = buildMailto()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
    } catch {
      /* address is selectable on screen as the fallback-to-the-fallback */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header — back arrow top-left (ui-patterns: back arrow always top-left) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 16px 8px' }}>
        <button onClick={onBack} style={{ border: 'none', color: 'var(--moss)', cursor: 'pointer', padding: 0, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'var(--moss-soft)', flexShrink: 0 }} aria-label="Back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-brand)', letterSpacing: '-0.3px' }}>
          Contact support
        </div>
      </div>

      <div style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
        {/* Intro + expectation-setting (the anxiety-killer line) */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--ink)', lineHeight: 1.55 }}>
            Something not working, or a question about your plan? Tell us.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
            A real person reads this. Usually within two days.
          </div>
        </div>

        {/* Primary CTA — email */}
        <button
          onClick={handleEmail}
          style={{ width: '100%', padding: '15px', background: 'var(--moss)', border: 'none', borderRadius: 'var(--radius-lg)', color: 'white', fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, letterSpacing: '0.02em', cursor: 'pointer' }}
        >
          Email us
        </button>

        {/* Fallback — copy address (covers no-mail-client case) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
            No mail app set up? Copy the address and write to us from anywhere.
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: '12px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {SUPPORT_EMAIL}
            </span>
            <button
              onClick={handleCopy}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: '10px', border: `1px solid ${copied ? 'var(--moss)' : 'var(--line)'}`, background: copied ? 'var(--moss-soft)' : 'transparent', color: copied ? 'var(--moss)' : 'var(--mute)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s, background 0.15s, border-color 0.15s' }}
              aria-label="Copy support email address"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Transparency — what gets attached (privacy honesty, brand stance) */}
        <div style={{ marginTop: 'auto', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.6 }}>
          We add your app version, platform, and account email to the message so we can help faster. You&apos;ll see it before you send — delete it if you&apos;d rather not.
        </div>
      </div>
    </div>
  )
}

function MeScreen({ plan, initials, athlete, quitDays, smokeTrackerEnabled, quitDate, onSmokeTrackerChange, theme, onThemeChange, preferredUnits, onUnitsChange, preferredMetric, onMetricChange, restingHR, maxHR, birthYear, onHRChange, firstName, lastName, profileEmail, onProfileChange, onOpenGenerate, onOpenBenchmark, onOpenReshape, onOpenFounderNote, onUpgrade, hasPaidAccess, trialDaysLeft, dynamicAdjustmentsEnabled, onDynamicAdjustmentsChange, dailyPushEnabled, onDailyPushEnabledChange, lastAdjustmentCheckAt, lastAdjustmentCheckFoundChange, hasPendingAdjustment, recentChanges }: {
  plan: Plan; initials: string; athlete: string; quitDays: number | null; smokeTrackerEnabled: boolean; quitDate: string
  onSmokeTrackerChange: (enabled: boolean, date: string) => void
  theme: 'dark' | 'light' | 'auto'; onThemeChange: (t: 'dark' | 'light' | 'auto') => void
  preferredUnits: 'km' | 'mi'; onUnitsChange: (u: 'km' | 'mi') => void
  preferredMetric: 'distance' | 'duration'; onMetricChange: (m: 'distance' | 'duration') => void
  restingHR: number | null; maxHR: number | null; birthYear?: number | null; onHRChange: (rhr: number, mhr: number) => void
  firstName: string; lastName: string; profileEmail: string
  onProfileChange: (fn: string, ln: string, em: string) => void
  onOpenGenerate?: () => void
  onOpenBenchmark?: () => void
  onOpenReshape?: () => void
  onOpenFounderNote?: () => void
  onUpgrade?: () => void
  hasPaidAccess?: boolean
  trialDaysLeft?: number | null
  dynamicAdjustmentsEnabled?: boolean
  onDynamicAdjustmentsChange?: (enabled: boolean) => void
  dailyPushEnabled?: boolean
  onDailyPushEnabledChange?: (enabled: boolean) => void
  lastAdjustmentCheckAt?: string | null
  lastAdjustmentCheckFoundChange?: boolean | null
  /**
   * True when a `plan_adjustments` row with status='pending' exists for this user.
   * Distinct from `lastAdjustmentCheckFoundChange`, which can stay true after the
   * engine auto-applies a change silently. Drives the tappable "View change" copy.
   */
  hasPendingAdjustment?: boolean
  /**
   * Recent silent (auto_applied) plan adjustments from the last 14 days, newest
   * first. Feeds the "Changed this week" audit surface (RESHAPE-FIX-WAVE3-PHASE2):
   * sub-threshold changes the engine applied without asking (§69), so honest
   * absorption requires a passive place to see them. Rows: { id, week_n, summary,
   * sessions_before, sessions_after, created_at }.
   */
  recentChanges?: any[]
}) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<'main' | 'quit' | 'delete-account' | 'support' | 'plan-history'>('main')

  // Push subscription state — bubbled up from PushNotificationsRow so we can
  // gate the dependent DailyPushToggleRow ("Morning training push" can't fire
  // if push itself is off). Defaults to false until the row checks iOS perm.
  const [pushSubscribed, setPushSubscribed] = useState(false)

  // Plan adjustments — "What we watch for" disclosure
  const [adjustmentsDisclosureOpen, setAdjustmentsDisclosureOpen] = useState(false)

  // RESHAPE-FIX-WAVE3-PHASE2 — per-change dismissal for the "Changed this week"
  // audit surface, persisted client-side (matches the MAINT-01 dismissable-card
  // precedent — informational card, no migration). Keyed by adjustment id.
  const [dismissedChanges, setDismissedChanges] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = window.localStorage.getItem('zonna_dismissed_changes')
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch { return new Set() }
  })
  const dismissChange = (id: string) => {
    setDismissedChanges(prev => {
      const next = new Set(prev)
      next.add(id)
      try { window.localStorage.setItem('zonna_dismissed_changes', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }
  const visibleChanges = (recentChanges ?? []).filter((c: any) => !dismissedChanges.has(c.id))

  // Relative-time formatter for the "Last checked" row. (The "Recent tweaks"
  // log that also used this was relocated to the notification inbox — NOTIF-01.)
  const formatRelative = (iso: string): string => {
    const ms    = Date.now() - new Date(iso).getTime()
    const days  = Math.floor(ms / 86_400_000)
    const hours = Math.floor(ms / 3_600_000)
    if (hours < 1)   return 'just now'
    if (hours < 24)  return 'today'
    if (days === 1)  return 'yesterday'
    if (days < 7)    return `${days} days ago`
    if (days < 14)   return 'last week'
    return `${Math.floor(days / 7)} weeks ago`
  }

  // "Last checked N days ago" — null when the engine has never run for this user.
  const lastCheckedLabel: string | null = (() => {
    if (!lastAdjustmentCheckAt) return null
    const ms        = Date.now() - new Date(lastAdjustmentCheckAt).getTime()
    const days      = Math.floor(ms / 86_400_000)
    const hours     = Math.floor(ms / 3_600_000)
    if (hours < 1)   return 'just now'
    if (hours < 24)  return 'today'
    if (days === 1)  return 'yesterday'
    if (days < 7)    return `${days} days ago`
    if (days < 14)   return 'last week'
    return `${Math.floor(days / 7)} weeks ago`
  })()

  const raceDistKm = plan?.meta?.race_distance_km ?? 0

  if (activeSection === 'quit')           return <QuitTab    quitDays={quitDays} raceDistanceKm={raceDistKm} onBack={() => setActiveSection('main')} />
  if (activeSection === 'delete-account') return <DeleteAccountScreen onBack={() => setActiveSection('main')} />
  if (activeSection === 'support')        return <SupportScreen onBack={() => setActiveSection('main')} email={profileEmail} hasPaidAccess={hasPaidAccess} trialDaysLeft={trialDaysLeft} />
  if (activeSection === 'plan-history')   return <PlanHistoryScreen onBack={() => setActiveSection('main')} />

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

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '40px' }}>

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

        {/* ── ME-ATHLETE — "What Kit knows about you" ──────────────────
            Read-only synthesis of the inputs the engine runs on. Surfaces
            staleness honestly — a benchmark four+ weeks old silently softens
            pace targets via VDOT_STALENESS_FRESH_WEEKS; this card names it.
            Configuration becomes identity, not chores. Existing editors
            below remain — this card is the read, not a replacement. */}
        {(() => {
          // Benchmark data + staleness signal. Threshold sourced from the
          // engine config so the user-facing freshness window matches what
          // the VDOT engine actually treats as fresh (D-08, INV-CFG-001).
          const bm = (plan?.meta as any)?.benchmark
          const bmDate = bm?.benchmark_date ? new Date(bm.benchmark_date) : null
          const bmWeeks = bmDate
            ? Math.max(0, Math.floor((Date.now() - bmDate.getTime()) / (7 * 86_400_000)))
            : null
          const bmStale = bmWeeks != null && bmWeeks > GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS

          // Row state badges: --moss for healthy, --warn for stale, --mute for unset.
          type RowState = 'set' | 'stale' | 'unset'
          const row = (label: string, value: string, sub: string | null, state: RowState, onTap?: () => void) => {
            const colour = state === 'stale' ? 'var(--warn)' : state === 'set' ? 'var(--moss)' : 'var(--mute)'
            const inner = (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>{label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colour, flexShrink: 0 }} />
                    {value}
                  </span>
                </div>
                {sub && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: state === 'stale' ? 'var(--warn)' : 'var(--mute)', marginTop: '4px', lineHeight: 1.4 }}>
                    {sub}
                  </div>
                )}
              </>
            )
            const baseStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--line)' }
            return onTap ? (
              <button onClick={onTap} style={{ ...baseStyle, width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                {inner}
              </button>
            ) : (
              <div style={baseStyle}>{inner}</div>
            )
          }

          return (
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px 4px', fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                What Kit knows about you
              </div>

              {row(
                'Zones',
                hrConfigured ? `Z2 ≤ ${z2Ceiling} · Max ${maxHR}` : 'Not set',
                hrConfigured ? null : 'Set RHR and Max HR below — your zones lock in.',
                hrConfigured ? 'set' : 'unset',
              )}

              {row(
                'Benchmark',
                bmDate ? `${bmWeeks}w old` : 'Not set',
                bmStale
                  ? 'Targets may be soft — re-benchmark when you can.'
                  : bmDate ? null : 'No benchmark — pace targets are estimated.',
                bmDate ? (bmStale ? 'stale' : 'set') : 'unset',
                onOpenBenchmark,
              )}

              {/* Recovery signals — no longer the last row now that injuries
                  sit beneath it. Same display-only treatment as before. */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>Recovery signals</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--moss)', flexShrink: 0, opacity: 0.4 }} />
                    Apple Health
                  </span>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '4px', lineHeight: 1.4 }}>
                  Connect below to feed readiness checks.
                </div>
              </div>

              {/* Injury flags — last row, no border below. Empty list reads
                  as "None reported" (moss dot — no flags is the healthy state);
                  any present injuries read as warn (something to watch on hard
                  sessions). Strings are lowercase tags from plan.meta — cap on
                  display so they read as labels, not commands. */}
              {(() => {
                const injuries = (plan?.meta as any)?.injury_history as string[] | undefined
                const hasInjuries = !!injuries?.length
                const displayList = hasInjuries
                  ? injuries.map(i => i.charAt(0).toUpperCase() + i.slice(1)).join(', ')
                  : 'None reported'
                const colour = hasInjuries ? 'var(--warn)' : 'var(--moss)'
                return (
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>Injury flags</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colour, flexShrink: 0 }} />
                        {displayList}
                      </span>
                    </div>
                    {hasInjuries && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--warn)', marginTop: '4px', lineHeight: 1.4 }}>
                        Engine eases hill and long-run prescriptions.
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })()}

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

        {/* HR Zones — promoted above plan/benchmark actions so the core
            product concept (zone discipline) sits prominently in MeScreen,
            not buried below settings. Per Hold-the-Zone audit. */}
        {!hrConfigured && (
          <div style={{ background: 'var(--warn-bg)', borderRadius: '10px', border: '1px solid var(--line)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warn)', flexShrink: 0 }} />
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--coach-ink)', lineHeight: 1.5 }}>
              Set your resting and max HR below to see your training zones.
            </div>
          </div>
        )}

        <HRZonesSection
          restingHR={restingHR}
          maxHR={maxHR}
          birthYear={birthYear}
          onSave={onHRChange}
          hrZoneMethod={(plan?.meta as any)?.hr_zone_method ?? null}
          hrAssumptionNote={(plan?.meta as any)?.hr_assumption_note ?? null}
        />

        {/* Plan + benchmark actions — moved below zones */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <button
            onClick={onOpenGenerate}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.55 }}>
                {hasPlan ? 'Change your plan' : 'Generate a plan'}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>
                {hasPlan ? 'Build a new plan around a different race or goal' : 'Choose a template or build a custom plan'}
              </div>
            </div>
            <div style={{ color: 'var(--mute)', marginLeft: '12px' }}>{chevron}</div>
          </button>
          <button
            onClick={onOpenBenchmark}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.55 }}>Race benchmark</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>
                How fast. Pace targets calibrated from a recent race.
              </div>
            </div>
            <div style={{ color: 'var(--mute)', marginLeft: '12px' }}>{chevron}</div>
          </button>
          <button
            onClick={() => setActiveSection('plan-history')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.55 }}>Plan history</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>
                All the races you&apos;ve trained for.
              </div>
            </div>
            <div style={{ color: 'var(--mute)', marginLeft: '12px' }}>{chevron}</div>
          </button>
        </div>

        {/* Display preferences — grouped with training since they affect session cards */}
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          {/* Units */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.55 }}>Distance units</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>Pace brackets and distances</div>
            </div>
            <div style={{ width: '108px', flexShrink: 0 }}>
              <SegmentedControl
                ariaLabel="Distance units"
                value={preferredUnits}
                onChange={onUnitsChange}
                options={[{ value: 'km', label: 'KM' }, { value: 'mi', label: 'MI' }]}
              />
            </div>
          </div>
          {/* Session display */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.55 }}>Session display</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>Default metric on session cards</div>
            </div>
            <div style={{ width: '168px', flexShrink: 0 }}>
              <SegmentedControl
                ariaLabel="Session display metric"
                value={preferredMetric}
                onChange={onMetricChange}
                options={[{ value: 'distance', label: 'Distance' }, { value: 'duration', label: 'Duration' }]}
              />
            </div>
          </div>
        </div>

        {/* ── Connections ────────────────────────────────────────── */}
        {/* Apple Health (iOS) is the primary v1 data source — runs, RHR, HRV, sleep, VO2 max.
            Strava remains an optional secondary import. */}
        <SectionLabel>Connections</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <AppleHealthConnectionRow
            onHRFound={async (rhr, mhr) => {
              const newRhr = restingHR != null ? restingHR : rhr
              const newMhr = maxHR     != null ? maxHR     : mhr
              if (newRhr != null || newMhr != null) {
                if (newRhr != null) onHRChange(newRhr, newMhr ?? maxHR ?? 0)
                try {
                  const supabase = createClient()
                  const { data: { user } } = await supabase.auth.getUser()
                  if (user) await supabase.from('user_settings').upsert({
                    id:         user.id,
                    resting_hr: newRhr ?? undefined,
                    max_hr:     newMhr ?? undefined,
                    updated_at: new Date().toISOString(),
                  })
                } catch {}
              }
            }}
          />
          <StravaConnectionRow />
        </div>

        {/* ── Notifications ──────────────────────────────────────── */}
        {/* Push registration is free (PUSH-ONBOARD). The daily training reminder
            sub-toggle is paid-only — it sends a push that costs a real APNs call
            per user per day, so it's gated on a subscription. */}
        <SectionLabel>Notifications</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <PushNotificationsRow onStatusChange={setPushSubscribed} />
          {hasPaidAccess && onDailyPushEnabledChange && (
            <DailyPushToggleRow
              enabled={dailyPushEnabled ?? true}
              onChange={onDailyPushEnabledChange}
              disabled={!pushSubscribed}
            />
          )}
        </div>

        {/* ── Plan adjustments (paid/trial only) ───────────────────
             One engine, two controls: Auto-adjust runs it on a schedule,
             Check now runs it on demand. The "Last checked" line and the
             "What we watch for" disclosure exist to make this engine
             visible — without them users can't tell what they're paying for. */}
        {hasPaidAccess && onDynamicAdjustmentsChange && (
          <>
            <SectionLabel>Plan adjustments</SectionLabel>
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>

              {/* Last checked status — top of the card so the engine's activity is visible at a glance.
               *  Three honest states (PROFILE-ADJ-01):
               *  - pending change waiting for user → moss accent + tappable, routes to ReshapeScreen which shows the existing row
               *  - engine ran, applied a tweak silently (auto-applied) → factual "Plan tweaked" line, not tappable
               *  - engine ran, found nothing → "No changes needed" */}
              {hasPendingAdjustment ? (
                <button
                  onClick={onOpenReshape}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderBottom: '1px solid var(--line)',
                    background: 'rgba(107,142,107,0.08)', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                      1 change pending
                    </div>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.4 }}>
                      Tap to review and accept.
                    </div>
                  </div>
                  <div style={{ color: 'var(--moss)', marginLeft: '12px' }}>{chevron}</div>
                </button>
              ) : (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                    Last checked
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.4 }}>
                    {lastCheckedLabel === null
                      ? 'Not yet — tap Check now to run.'
                      : lastAdjustmentCheckFoundChange
                        ? `${lastCheckedLabel.charAt(0).toUpperCase() + lastCheckedLabel.slice(1)} · Plan tweaked`
                        : `${lastCheckedLabel.charAt(0).toUpperCase() + lastCheckedLabel.slice(1)} · No changes needed`}
                  </div>
                </div>
              )}

              {/* RESHAPE-FIX-WAVE3-PHASE2 — "Changed this week" audit surface.
                  Sub-threshold adjustments auto-apply silently (§69); this is the
                  passive, honest place to see what the engine did without asking.
                  Read-only + dismissable per row. AdjustmentDiff is rule-engine
                  output (no AIMark); the summary is a factual record line, same
                  provenance stance as the "Plan tweaked" line above. */}
              {visibleChanges.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--line)' }}>
                  <div style={{ padding: '12px 16px 2px', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Changed this week
                  </div>
                  {visibleChanges.map((c: any) => (
                    <div key={c.id} style={{ padding: '8px 16px 14px' }}>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.45 }}>
                        {c.summary}
                      </div>
                      <AdjustmentDiff sessionsBefore={c.sessions_before ?? []} sessionsAfter={c.sessions_after ?? []} units={preferredUnits} />
                      <button
                        onClick={() => dismissChange(c.id)}
                        style={{ marginTop: '10px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--mute)' }}
                      >
                        Got it
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Auto-adjust toggle. */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4, marginBottom: '2px' }}>Auto-adjust</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
                    {dynamicAdjustmentsEnabled
                      ? `${BRAND.name} checks automatically and suggests changes when something looks off.`
                      : `Plan stays fixed. ${BRAND.name} tracks data but won't suggest changes.`}
                  </div>
                </div>
                <button
                  onClick={() => onDynamicAdjustmentsChange(!dynamicAdjustmentsEnabled)}
                  style={{
                    width: '44px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                    background: dynamicAdjustmentsEnabled ? 'var(--moss)' : 'var(--line)',
                    position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                  }}
                  aria-label="Toggle auto-adjust"
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: dynamicAdjustmentsEnabled ? '21px' : '3px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: 'white', transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* What we watch for — user-facing disclosure of trigger taxonomy.
                  SYNC RULE: keep in step with TriggerType in lib/coaching/planAdjustment.ts.
                  If you add or remove a trigger type, update this copy in the same commit. */}
              <button
                onClick={() => setAdjustmentsDisclosureOpen(o => !o)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                aria-expanded={adjustmentsDisclosureOpen}
              >
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.4 }}>
                  What we watch for
                </div>
                <div style={{ color: 'var(--mute)', marginLeft: '12px', transform: adjustmentsDisclosureOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>{chevron}</div>
              </button>
              {adjustmentsDisclosureOpen && (
                <div style={{ padding: '0 16px 16px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.6 }}>
                  Recovery signals before hard sessions — resting HR, HRV, sleep. Easy runs drifting above Zone 2. Load spiking against your recent weeks. Aerobic efficiency slipping over time. Long runs consistently finishing short. Missed or rearranged sessions. Quality sessions running faster than target at controlled effort — a signal your fitness may have moved. When something looks off, you&apos;ll get a notification and can review it here.
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Subscription — UPGRADE-ENTRY-01 ─────────────────────
            Visible to free / trial / expired users. Hidden for active
            paid subscribers (hasPaidAccess=true AND no trial days left).
            Satisfies §3.1.2 reviewer-reachability: any non-Pro user can
            reach the paywall from Me at any time. */}
        {(!hasPaidAccess || trialDaysLeft != null) && onUpgrade && (
          <>
            <SectionLabel>Subscription</SectionLabel>
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
              <button
                onClick={onUpgrade}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4, marginBottom: '2px' }}>
                    View plans
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
                    {trialDaysLeft != null
                      ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your trial.`
                      : `From ${PRICING.monthly.label}.`}
                  </div>
                </div>
                <div style={{ color: 'var(--mute)', marginLeft: '12px' }}>{chevron}</div>
              </button>
            </div>
          </>
        )}

        {/* ── Support — in-app contact (FREE; SUPPORT-01) ──────── */}
        <SectionLabel>Support</SectionLabel>
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <button
            onClick={() => setActiveSection('support')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4, marginBottom: '2px' }}>Something broken? Tell us.</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
                Email support — a real person reads it.
              </div>
            </div>
            <div style={{ color: 'var(--mute)', marginLeft: '12px' }}>{chevron}</div>
          </button>
        </div>

        {/* ── Careful Now — destructive account actions ───────── */}
        <SectionLabel>Careful Now</SectionLabel>
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          <button
            onClick={async () => {
              const supabase = createClient()
              await clearWidgetState()
              await supabase.auth.signOut()
              router.replace('/auth/login')
            }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', borderBottom: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', fontWeight: 500 }}>Sign out</span>
          </button>
          <button
            onClick={() => setActiveSection('delete-account')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>Delete account</span>
          </button>
        </div>

        {/* FOUNDER-01 — quiet footer link. Moved here from "Your profile"
            (where it competed with profile editing). Same register as
            About / Privacy / Terms — discoverable, doesn't compete. */}
        {onOpenFounderNote && (
          <button
            onClick={onOpenFounderNote}
            style={{
              alignSelf: 'center',
              marginTop: '16px',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--mute)',
            }}
          >
            A note from the founder →
          </button>
        )}

      </div>
    </div>
  )
}

// ── SESSION SCREEN ────────────────────────────────────────────────────────

// ── RUN FEEDBACK CARD ─────────────────────────────────────────────────────

// Verdict → colour token + Zonna-voice headline. Single source of truth for run-feedback voice.
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
// Uses the CoachByline pulse instead of a spinner (per ui-patterns.md § CoachByline).
// Rendered on a white card with moss rail to match the post-completion AI card —
// the thing that's coming is the LLM read of your run.
function PendingAnalysisCard({ onOpenCoach }: { onOpenCoach?: () => void }) {
  return (
    <div style={{
      position: 'relative',
      marginTop: '12px',
      background: 'var(--card)',
      borderRadius: '14px',
      border: '1px solid var(--line)',
      padding: '14px 16px 14px 22px',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: '8px', top: '14px', bottom: '14px',
        width: '3px', borderRadius: '2px', background: 'var(--moss)',
      }} />
      <div style={{ marginBottom: '12px' }}>
        <CoachByline working role="Reading your run" onClick={onOpenCoach} />
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400,
        color: 'var(--ink-2)', lineHeight: 1.55,
        marginBottom: '14px',
      }}>
        Analysing your run — usually takes 15–30 seconds.
      </div>
      {/* Skeleton metric row — hint at what's coming */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {['HR', 'Distance', 'Pace', 'Efficiency'].map(label => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
              color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '6px',
            }}>{label}</div>
            <div style={{
              height: '3px', background: 'var(--line)', borderRadius: '2px',
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
function LockedCoachingPreview({ onUpgrade, onOpenCoach }: { onUpgrade?: () => void; onOpenCoach?: () => void }) {
  return (
    <div style={{
      marginTop: '12px',
      background: 'var(--bg-soft)',
      borderRadius: '14px',
      padding: '16px 18px',
      border: '1px solid var(--line)',
    }}>
      <div style={{ marginBottom: '10px', opacity: 0.4 }}>
        <CoachByline onClick={onOpenCoach} />
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
        color: 'var(--mute)', lineHeight: 1.55, marginBottom: '14px',
      }}>
        Kit reads here. He needs your runs first — Strava or Apple Health.
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
function GaveUpCard({ onOpenCoach }: { onOpenCoach?: () => void }) {
  return (
    <div style={{
      marginTop: '12px',
      background: 'var(--bg-soft)',
      borderRadius: '14px',
      padding: '16px 18px',
    }}>
      <div style={{ marginBottom: '8px', opacity: 0.4 }}>
        <CoachByline onClick={onOpenCoach} />
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
  units: 'km' | 'mi' = 'km',
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
    distLine = `Hit the planned distance — ${formatDistance(actual, units, { exact: true })}.`
  } else if (actual > planned) {
    distLine = `Planned ${formatDistance(planned, units, { exact: true })}, ran ${formatDistance(actual, units, { exact: true })}.`
  } else {
    distLine = `Planned ${formatDistance(planned, units, { exact: true })}, ran ${formatDistance(actual, units, { exact: true })} — short.`
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
  onOpenCoach,
  preferredUnits = 'km',
}: {
  analysis: any
  paceTarget?: string | null
  actualAvgSpeedMs?: number | null
  onOpenCoach?: () => void
  preferredUnits?: 'km' | 'mi'
}) {
  const verdict    = analysis.verdict as string
  const score      = analysis.total_score as number | null
  const feedback   = analysis.feedback_text as string | null
  const isManual   = (analysis.source as string | undefined) === 'manual'
  const voice      = getVerdictVoice(verdict)
  const [expanded, setExpanded] = useState(false)
  const explanations = buildScoreExplanations(analysis, paceTarget, actualAvgSpeedMs, preferredUnits)

  const metrics: { label: string; value: number | null | undefined }[] = [
    { label: 'HR',         value: analysis.hr_discipline_score as number | null },
    { label: 'Distance',   value: analysis.distance_score },
    { label: 'Pace',       value: analysis.pace_score },
    { label: 'Efficiency', value: analysis.ef_score },
  ]
  const hrNotAvailable = !isManual && analysis.hr_discipline_score == null

  return (
    <>
      {/* Verdict card — rule-derived headline + (metrics if !isManual). No AI mark.
       *  AI-VIS-01: the LLM paragraph used to live here too — provenance was muddy.
       *  Now split into a separate AI card below. */}
      <div style={{
        marginTop: '12px',
        background: 'var(--warn-bg)',
        borderRadius: '14px',
        padding: '16px 18px',
      }}>
        {/* Top row — score toggle (right-aligned), only when !isManual && score !== null */}
        {!isManual && score !== null && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide score breakdown' : 'Show score breakdown'}
              style={{
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
          </div>
        )}

        {/* Zonna-voice headline */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
          color: 'var(--coach-ink)', letterSpacing: '-0.1px', lineHeight: 1.4,
          marginBottom: !isManual ? '14px' : 0,
        }}>
          {voice.headline}
        </div>

        {/* Metric quartet — hidden for manual rows (no activity data to score).
         *  HR shows "—" when null (watch sync race — HR not yet available).
         *  Other metrics are hidden when absent. INV-DATA-005: one-liner explains. */}
        {!isManual && <div style={{ display: 'flex', gap: '10px' }}>
          {metrics.map(({ label, value }) => (value != null || label === 'HR') && (
            <div key={label} style={{ flex: 1 }}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                color: 'var(--warn)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: '4px',
              }}>
                {label}
              </div>
              {value != null ? (
                <>
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
                  <div style={{
                    fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700,
                    color: 'var(--warn)', opacity: 0.7,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    whiteSpace: 'nowrap',
                    marginTop: '5px',
                  }}>
                    {scoreBandLabel(value)}
                  </div>
                </>
              ) : (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 700,
                  color: 'var(--mute)', letterSpacing: '-0.5px',
                }}>—</div>
              )}
            </div>
          ))}
        </div>}
        {hrNotAvailable && (
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)',
            margin: '8px 0 0', lineHeight: 1.4,
          }}>
            HR data wasn&rsquo;t available when this run was analysed.
          </p>
        )}

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

      {/* AI card — LLM-generated read of your run. Only renders when feedback exists.
       *  White card + moss rail + CoachByline = the canonical "this is from Kit" treatment. */}
      {feedback && (
        <div style={{
          position: 'relative',
          marginTop: '8px',
          background: 'var(--card)',
          borderRadius: '14px',
          border: '1px solid var(--line)',
          padding: '14px 16px 14px 22px',
        }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: '8px', top: '14px', bottom: '14px',
            width: '3px', borderRadius: '2px', background: 'var(--moss)',
          }} />
          <div style={{ marginBottom: '10px' }}>
            <CoachByline color="moss" role="Read of your run" onClick={onOpenCoach} />
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
            color: 'var(--ink-2)', lineHeight: 1.55,
          }}>
            {feedback}
          </div>
        </div>
      )}
    </>
  )
}

function SessionScreen({ session, preloadedRuns, onBack, onSaved, preferredUnits, zone2Ceiling, preferredMetric, onSessionMetricChange, savedMetricOverride = null, restingHR, maxHR, aerobicPace, stravaLoading, runAnalysis, hasPaidAccess, onUpgrade, onOpenCoach, goalPace, guidance, nextSession, onLinkedComplete, autoMatch }: {
  session: any; preloadedRuns: any[]; onBack: () => void; onSaved?: () => void
  preferredUnits?: 'km' | 'mi'; zone2Ceiling?: number; preferredMetric?: 'distance' | 'duration'
  /** Lifts per-session metric toggle into DashboardClient so collapsed cards
   *  stay in sync and it persists to the DB (ADR-015). */
  onSessionMetricChange?: (weekN: number, sessionKey: string, metric: 'distance' | 'duration' | null) => void
  /** Current DB-backed per-session override for this session (null = none). */
  savedMetricOverride?: 'distance' | 'duration' | null
  restingHR?: number | null; maxHR?: number | null; aerobicPace?: string | null
  stravaLoading?: boolean
  runAnalysis?: any | null; hasPaidAccess?: boolean; onUpgrade?: () => void
  /** Navigates to the Coach tab — wired to the Kit chip so users can always find out who Kit is. */
  onOpenCoach?: () => void
  goalPace?: string | null
  guidance?: any | null
  /** Next scheduled session in the plan — shown as an "Up next" row below the feedback card. */
  nextSession?: { type: string; day: string; distanceKm?: number | null; label?: string | null } | null
  /** POST-RUN-01: route a Strava-linked completion to the new PostRunScreen. */
  onLinkedComplete?: (data: PostRunData) => void
  /** AUTO-MATCH-02: best Strava match (high or medium) for this session. */
  autoMatch?: { activity: any; confidence: 'high' | 'medium' } | null
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

  // POST-LOG-01: when a session is logged the prescription brief is reference
  // material, not the headline — RunFeedbackCard above is. Collapse the
  // SessionPopupInner body (Plan vs Actual, Why this session, structure, RPE
  // form) behind a "Session details" toggle so the feedback can breathe.
  // Pre-log / future sessions render expanded so behaviour is unchanged.
  //
  // The re-init effect intentionally depends ONLY on session identity, not on
  // `isComplete`. If the user logs the session mid-screen and lands in the
  // reflect view inside SessionPopupInner, isComplete flips true — but the
  // brief must stay open or the RPE form tears out from under them.
  const [briefOpen, setBriefOpen] = useState(!isComplete)
  useEffect(() => {
    setBriefOpen(!isComplete)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.weekN, session.key])

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
            ? preloadedRuns.find((r: any) =>
                (analysis.strava_activity_id && r.id === analysis.strava_activity_id) ||
                (analysis.apple_health_uuid  && r.id === analysis.apple_health_uuid)
              )
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
                  Apple Health{actKm ? ` · ${formatDistance(actKm, preferredUnits, { exact: true })}` : ''}
                </div>
              )}
              <RunFeedbackCard
                analysis={analysis}
                paceTarget={session.pace_target ?? null}
                actualAvgSpeedMs={linkedAct?.average_speed ?? null}
                onOpenCoach={onOpenCoach}
                preferredUnits={preferredUnits}
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
        {hasPaidAccess && !analysis && isAnalysisPending && !pollGaveUp && <PendingAnalysisCard onOpenCoach={onOpenCoach} />}
        {hasPaidAccess && !analysis && isAnalysisPending && pollGaveUp && <GaveUpCard onOpenCoach={onOpenCoach} />}

        {/* Locked coaching preview — free users who have completed the session */}
        {!hasPaidAccess && isComplete && session.type !== 'rest' && session.type !== 'strength' && (
          <LockedCoachingPreview onUpgrade={onUpgrade} onOpenCoach={onOpenCoach} />
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
                {nextSession.day} · {getSessionLabel(nextSession.type)}{nextSession.distanceKm ? ` · ${formatDistance(nextSession.distanceKm, preferredUnits, { exact: true })}` : ''}
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
          overflow: 'hidden',
        }}>
          {isComplete && (
            <button
              onClick={() => setBriefOpen(o => !o)}
              aria-expanded={briefOpen}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderBottom: briefOpen ? `1px solid var(--line)` : 'none',
                fontFamily: 'var(--font-ui)',
                color: 'var(--ink-2)',
                minHeight: '44px',
              }}
            >
              <span style={{
                fontSize: '10px', fontWeight: 700,
                color: 'var(--mute)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {briefOpen ? 'Hide session details' : 'Session details · tweak how it felt'}
              </span>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none"
                aria-hidden="true"
                style={{
                  transform: briefOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.18s ease',
                  flexShrink: 0,
                  color: 'var(--mute)',
                }}
              >
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {briefOpen && (
            <SessionPopupInner
              session={session}
              weekTheme={session.weekTheme ?? ''}
              weekN={session.weekN ?? 1}
              preloadedRuns={preloadedRuns}
              onClose={onBack}
              onSaved={onSaved}
              preferredUnits={preferredUnits ?? 'km'}
              zone2Ceiling={zone2Ceiling ?? null}
              preferredMetric={preferredMetric}
              onSessionMetricChange={onSessionMetricChange}
              savedMetricOverride={savedMetricOverride}
              restingHR={restingHR}
              maxHR={maxHR}
              aerobicPace={aerobicPace}
              stravaLoading={stravaLoading}
              hasPaidAccess={hasPaidAccess}
              onUpgrade={onUpgrade}
              goalPace={goalPace}
              guidance={guidance}
              onLinkedComplete={onLinkedComplete}
              autoMatch={autoMatch}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── POST-RUN SCREEN (POST-RUN-01) ─────────────────────────────────────────
//
// Destination screen for a Strava-linked completion. Replaces the old Reflect
// sheet for the linked path. Three jobs on one surface:
//   1. Confirm the linked Strava activity (header row + "change" escape)
//   2. Show the LLM "Read of your run" (PendingAnalysisCard → RunFeedbackCard)
//   3. Collect RPE + fatigue inline (auto-save on every interaction)
//
// "Done" returns the user to Today only after they've actually seen the
// analysis. Manual completions (no Strava activity) keep the existing Reflect
// sheet — no auto-link, no LLM, no need for a dedicated screen.

function PostRunScreen({
  data,
  onBack,
  onDone,
  onSaved,
  onAnalysisLoaded,
  preferredUnits = 'km',
  zone2Ceiling,
  hasPaidAccess,
  onOpenCoach,
  runAnalysis,
  aerobicPace,
  goalPace,
}: {
  data: PostRunData
  /** Back arrow — returns to Today. */
  onBack: () => void
  /** POST-RUN-02: terminus action. Routes to SessionScreen for this session
   *  so the run resolves where its read lives, not on Today. Falls back to
   *  onBack if not provided. */
  onDone?: () => void
  onSaved?: () => void
  /** POST-RUN-02: lift a newly-arrived analysis row into the parent's
   *  runAnalysisMap so a subsequent route to SessionScreen renders the
   *  verdict immediately instead of re-polling. */
  onAnalysisLoaded?: (sessionDay: string, row: any) => void
  preferredUnits?: 'km' | 'mi'
  zone2Ceiling?: number | null
  hasPaidAccess?: boolean
  onOpenCoach?: () => void
  /** Latest analysis row from the parent's runAnalysisMap. May be null while polling. */
  runAnalysis?: any | null
  aerobicPace?: string | null
  goalPace?: string | null
}) {
  const supabase = createClient()
  const { session, weekN, pendingActivityId, pendingAppleHealthUuid, linkedActivity } = data

  // Local analysis state — seeded from prop, then polled until run_analysis lands.
  const [analysis, setAnalysis] = useState<any | null>(runAnalysis ?? null)
  useEffect(() => { setAnalysis(runAnalysis ?? null) }, [runAnalysis])

  // LEDGER-01 / DOCTRINE-01 — drives the conditional brand-statement surface
  // on the SessionCompleteCard rendered below.
  const ledgerSnapshot = useDisciplineLedger()

  const [rpe, setRpe]                       = useState<number | null>(null)
  const [fatigueTag, setFatigueTag]         = useState<string | null>(null)
  const [savingRPE, setSavingRPE]           = useState(false)
  const [pollGaveUp, setPollGaveUp]         = useState(false)
  const [linkFired, setLinkFired]           = useState(false)
  const [hydratedActivity, setHydratedActivity] = useState<PostRunData['linkedActivity']>(null)
  const [isHKCompletion, setIsHKCompletion] = useState(false)
  // HR-SYNC-02: fields needed to classify HR-pending for the linked HK
  // activity. Fetched alongside the completion when this is an HK-linked run.
  const [hrPendingActivity, setHrPendingActivity] = useState<{
    avg_hr:        number | null
    start_date:    string | null
    moving_time_s: number | null
  } | null>(null)
  const [isHrRetrying, setIsHrRetrying] = useState(false)
  const handlePostRunHrRetry = useCallback(async () => {
    setIsHrRetrying(true)
    try {
      const { retryHrFromUi } = await import('@/lib/health/clientSync')
      await retryHrFromUi()
    } finally {
      setTimeout(() => setIsHrRetrying(false), 400)
    }
  }, [])
  const sessionDay = session?.key as string | undefined

  // ── Hydrate RPE/fatigue + linked activity from existing completion ──
  // On deep-link entry the parent passes linkedActivity=null; we read it from
  // session_completions here. On manual-link entry the parent has it already.
  useEffect(() => {
    let cancelled = false
    async function loadCompletion() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: row } = await supabase
          .from('session_completions')
          .select('rpe, fatigue_tag, strava_activity_name, strava_activity_km, apple_health_uuid')
          .eq('user_id', user.id)
          .eq('week_n', weekN)
          .eq('session_day', sessionDay)
          .maybeSingle()
        if (!cancelled && row) {
          if (row.rpe != null) setRpe(row.rpe as number)
          if (row.fatigue_tag) setFatigueTag(row.fatigue_tag as string)
          const isHK = row.apple_health_uuid != null
          if (isHK) setIsHKCompletion(true)
          if (!linkedActivity && (row.strava_activity_name || row.strava_activity_km)) {
            setHydratedActivity({
              name: (row.strava_activity_name as string | null) ?? (isHK ? 'Apple Health run' : 'Strava run'),
              km:   (row.strava_activity_km as number | null) ?? null,
            })
          }
          // HR-SYNC-02: fetch the activity row's HR-pending fields when this
          // completion is HK-linked. Used to gate the morph chain on whether
          // HR has actually landed yet.
          if (isHK) {
            const { data: act } = await supabase
              .from('strava_activities')
              .select('avg_hr, start_date, moving_time_s')
              .eq('user_id', user.id)
              .eq('apple_health_uuid', row.apple_health_uuid)
              .maybeSingle()
            if (!cancelled && act) {
              setHrPendingActivity({
                avg_hr:        (act.avg_hr as number | null) ?? null,
                start_date:    (act.start_date as string | null) ?? null,
                moving_time_s: (act.moving_time_s as number | null) ?? null,
              })
            }
          }
        }
      } catch {}
    }
    if (sessionDay) void loadCompletion()
    return () => { cancelled = true }
  }, [sessionDay, weekN, supabase, linkedActivity])

  // Display source for the linked-activity row — prop wins when present.
  const displayActivity = linkedActivity ?? hydratedActivity
  const isHKSource = !!pendingAppleHealthUuid || isHKCompletion

  // HR-SYNC-02: HR-pending classification for the morph chain. Null when
  // not HK-linked, when the activity row hasn't loaded yet, or when HR has
  // already landed. 'pending' / 'fallback' gates the existing analysis cards.
  const hrPendingState = hrPendingActivity != null
    ? (() => {
        const s = classifyHrPending({
          source:        'apple_health',
          avg_hr:        hrPendingActivity.avg_hr,
          start_date:    hrPendingActivity.start_date,
          moving_time_s: hrPendingActivity.moving_time_s,
        }, new Date())
        return s === 'pending' || s === 'fallback' ? s : null
      })()
    : null

  // ── Fire link-activity once on mount when a fresh activity is staged ──
  // This commits the Strava → session_completions link AND triggers analyse-run
  // server-side. Idempotent on the server (autoMatchAndAnalyse is a no-op when
  // the link already exists), so safe even if the webhook beat us to it.
  useEffect(() => {
    if ((!pendingActivityId && !pendingAppleHealthUuid) || linkFired) return
    setLinkFired(true)
    ;(async () => {
      try {
        // authedFetch never throws on 4xx/5xx — must inspect res.ok, or a
        // server failure (e.g. a missing column) stays invisible. This used to
        // be `.catch(()=>{})`, which swallowed exactly that.
        // Source-aware body: HealthKit links by apple_health_uuid (row already
        // exists), Strava links by strava_activity_id (route fetches + persists).
        const res = await authedFetch('/api/strava/link-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            pendingAppleHealthUuid
              ? { apple_health_uuid: pendingAppleHealthUuid, week_n: weekN, session_day: sessionDay }
              : { strava_activity_id: pendingActivityId, week_n: weekN, session_day: sessionDay }
          ),
        })
        if (!res.ok) {
          console.error('[post-run] link-activity failed', res.status, await res.text().catch(() => ''))
        }
      } catch (e) {
        console.error('[post-run] link-activity threw', e)
      }
    })()
  }, [pendingActivityId, pendingAppleHealthUuid, linkFired, weekN, sessionDay])

  // ── Poll run_analysis until it lands (mirrors SessionScreen behaviour) ──
  const isAnalysisPending = !!hasPaidAccess && !analysis && !pollGaveUp
  useEffect(() => {
    if (!isAnalysisPending || !sessionDay) return
    let cancelled = false
    let attempts  = 0
    const tick = async () => {
      if (cancelled) return
      attempts++
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: row } = await supabase
          .from('run_analysis')
          .select('session_day, source, verdict, total_score, feedback_text, hr_in_zone_pct, ef_trend_pct, hr_discipline_score, distance_score, pace_score, ef_score')
          .eq('user_id', user.id)
          .eq('session_day', sessionDay)
          .maybeSingle()
        if (!cancelled && row) {
          setAnalysis(row)
          // POST-RUN-02: lift the row into the parent's runAnalysisMap so a
          // subsequent Done → SessionScreen route renders the verdict
          // immediately instead of triggering a fresh poll.
          onAnalysisLoaded?.(sessionDay, row)
          onSaved?.()
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
  }, [isAnalysisPending, sessionDay, supabase, onSaved, onAnalysisLoaded])

  // ── RPE / fatigue auto-save (mirrors SessionPopupInner.saveRPEFatigue) ──
  async function saveRPEFatigue(newRpe: number | null, newTag: string | null) {
    setSavingRPE(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const flag = getCoachingFlag({
        sessionType: coachingSessionType(session),
        rpe:         newRpe,
        avgHr:       null,
        zone2Ceiling: zone2Ceiling ?? undefined,
      })
      await supabase.from('session_completions').upsert({
        user_id:       user.id,
        week_n:        weekN,
        session_day:   sessionDay,
        status:        'complete',
        rpe:           newRpe,
        fatigue_tag:   newTag,
        coaching_flag: flag,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'user_id,week_n,session_day' })
      // Trigger 4: fatigue accumulation check
      if (newTag && ['Heavy', 'Wrecked', 'Cooked'].includes(newTag)) {
        void authedFetch('/api/adjust-plan', { method: 'POST', body: JSON.stringify({}) })
      }
      // Trigger 5: RPE disconnect check on easy/long
      if (newRpe != null && newRpe >= 8 && (session.type === 'easy' || isLongRun(session))) {
        void authedFetch('/api/adjust-plan', { method: 'POST', body: JSON.stringify({ rpe: newRpe, sessionType: coachingSessionType(session) }) })
      }
      onSaved?.()
      // Re-run analyse-run so the verdict card reflects the just-saved RPE/fatigue.
      // analyse-run is idempotent (upserts); it awaits the AI call server-side
      // and returns the updated row, so we can update state directly — no re-poll.
      if (hasPaidAccess && sessionDay && (pendingAppleHealthUuid || pendingActivityId)) {
        try {
          const reRes = await authedFetch('/api/analyse-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              pendingAppleHealthUuid
                ? { apple_health_uuid: pendingAppleHealthUuid, week_n: weekN, session_day: sessionDay }
                : { strava_activity_id: pendingActivityId, week_n: weekN, session_day: sessionDay }
            ),
          })
          if (reRes.ok) {
            const reData = await reRes.json()
            if (reData?.analysis) {
              setAnalysis(reData.analysis)
              onAnalysisLoaded?.(sessionDay, reData.analysis)
            }
          }
        } catch {}
      }
    } catch {} finally { setSavingRPE(false) }
  }

  const distLabel = displayActivity?.km != null
    ? `${displayActivity.km.toFixed(1)}${preferredUnits === 'mi' ? 'mi' : 'km'}`
    : ''
  const sessionLabel = getSessionLabel(session.type ?? 'easy')
  const dayLabel     = session.day ?? ''
  const weekLabel    = session.weekN ?? weekN
  const paceTarget   = session.pace_target
    ?? ((session.type === 'easy' || session.type === 'run') ? aerobicPace ?? null : null)
    ?? goalPace ?? null

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', overflowY: 'auto', paddingBottom: '120px' }}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 16px 12px',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10,
        borderBottom: '1px solid var(--line)',
      }}>
        <button onClick={onBack} style={{
          width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-soft)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink)', flexShrink: 0,
        }} aria-label="Back to Today">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
            color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '2px',
          }}>
            Run logged · W{weekLabel}
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '20px', fontWeight: 800,
            color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.2,
          }}>
            {sessionLabel}{dayLabel ? ` · ${dayLabel}` : ''}
          </div>
          {/* POST-RUN-02: subtitle reflects analysis state so the wait isn't a
              silent gap. AIMark working state replaces a spinner; this is the
              one screen in the app where the AI verdict is the focal payoff. */}
          {hasPaidAccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              marginTop: '4px',
              fontFamily: 'var(--font-ui)', fontSize: '12px',
              color: 'var(--mute)', lineHeight: 1.3,
            }}>
              {!analysis && !pollGaveUp && (
                <>
                  <AIMark size={11} color="var(--moss)" working label="Reading the run" />
                  <span>Reading the run…</span>
                </>
              )}
              {!analysis && pollGaveUp && (
                <span>Logged. Tell me how it felt.</span>
              )}
              {analysis && (
                <>
                  <AIMark size={11} color="var(--moss)" label="Read complete" />
                  <span>Here&apos;s the read.</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── LINKED ACTIVITY CONFIRMATION ─────────────────────────── */}
        {displayActivity && (
          <div style={{
            background: 'var(--bg-soft)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            {/* source chip */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--moss)', flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: '2px',
              }}>
                {isHKSource ? 'Apple Health' : 'Linked from Strava'}
              </div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                color: 'var(--ink)', lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {displayActivity.name}{distLabel ? ` · ${distLabel}` : ''}
              </div>
            </div>
          </div>
        )}

        {/* ── AI CARD — pending or done ───────────────────────────── */}
        {/* HR-SYNC-02 morph chain: PendingHrCard (waiting on HK sync) →
            PendingAnalysisCard (analyse-run in flight) → RunFeedbackCard.
            When HR is still pending we suppress the AI surfaces — coaching
            depth is meaningless without HR. */}
        {hasPaidAccess && hrPendingState && (
          <PendingHrCard
            state={hrPendingState}
            onRetry={hrPendingState === 'fallback' ? handlePostRunHrRetry : undefined}
            isRetrying={isHrRetrying}
          />
        )}
        {hasPaidAccess && !hrPendingState && analysis && (
          <RunFeedbackCard
            analysis={analysis}
            paceTarget={paceTarget}
            actualAvgSpeedMs={null}
            onOpenCoach={onOpenCoach}
            preferredUnits={preferredUnits}
          />
        )}
        {hasPaidAccess && !hrPendingState && !analysis && !pollGaveUp && (
          <PendingAnalysisCard onOpenCoach={onOpenCoach} />
        )}
        {hasPaidAccess && !hrPendingState && !analysis && pollGaveUp && (
          <GaveUpCard onOpenCoach={onOpenCoach} />
        )}

        {/* ── HOW DID IT FEEL? ────────────────────────────────────── */}
        <div style={{
          background: 'var(--card)',
          borderRadius: '14px',
          border: '1px solid var(--line)',
          padding: '16px 18px',
        }}>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700,
            color: 'var(--ink)', letterSpacing: '-0.2px', marginBottom: '4px',
          }}>
            How did it feel?
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
            marginBottom: '18px', lineHeight: 1.5,
          }}>
            Effort and body state. That&apos;s all I need.
          </div>

          {/* RPE 1–10 */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
            }}>
              Effort (RPE)
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => {
                const isActive = rpe === n
                const col = rpeColour(n)
                return (
                  <button
                    key={n}
                    onClick={() => {
                      const newRpe = isActive ? null : n
                      setRpe(newRpe)
                      void saveRPEFatigue(newRpe, fatigueTag)
                    }}
                    disabled={savingRPE}
                    style={{
                      flex: 1, aspectRatio: '1', borderRadius: '8px',
                      border: `1px solid ${isActive ? col : 'var(--line)'}`,
                      background: isActive ? `color-mix(in srgb, ${col} 18%, transparent)` : 'var(--card)',
                      color: isActive ? col : 'var(--mute)',
                      fontFamily: 'var(--font-ui)', fontSize: '13px',
                      fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fatigue tags */}
          <div>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
            }}>
              Body state
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['Fresh', 'Fine', 'Heavy', 'Wrecked'] as const).map(tag => {
                const isActive = fatigueTag === tag
                const tagColor = tag === 'Fresh'  ? 'var(--moss)'
                              : tag === 'Fine'   ? 'var(--s-easy)'
                              : tag === 'Heavy'  ? 'var(--warn)'
                              : 'var(--danger)'
                return (
                  <button
                    key={tag}
                    onClick={() => {
                      const newTag = isActive ? null : tag
                      setFatigueTag(newTag)
                      void saveRPEFatigue(rpe, newTag)
                    }}
                    disabled={savingRPE}
                    style={{
                      fontFamily: 'var(--font-ui)', fontSize: '12px',
                      padding: '8px 18px',
                      borderRadius: '20px',
                      border: `1px solid ${isActive ? tagColor : 'var(--line)'}`,
                      background: isActive ? `color-mix(in srgb, ${tagColor} 12%, transparent)` : 'transparent',
                      color: isActive ? tagColor : 'var(--mute)',
                      cursor: 'pointer',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.12s',
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* COMPLETE-01 — peak-end artefact. Mounts once RPE is set. Renders
            State A (zone bar + % in zone) when the run_analysis row has
            arrived from the analyse-run pipeline; falls back to State B
            (RPE / 10 + fatigue chip) while the analysis is still polling.
            Same component as the manual-completion reflect view; data
            sources differ. */}
        {rpe !== null && (
          <>
            <div style={{ padding: '0 24px', marginBottom: '12px' }}>
              <SessionCompleteCard
                sessionType={session.type}
                date={new Date()}
                completionCopy={getCompletionCopy(session.type)}
                zonePct={analysis?.hr_in_zone_pct != null ? Number(analysis.hr_in_zone_pct) : null}
                rpe={rpe}
                fatigueTag={fatigueTag}
                ledgerAdvancedThisWeek={ledgerSnapshot?.advancedThisWeek ?? false}
              />
            </div>
            {/* SAVE-IMG-01 — Save image affordance lives outside the card
                so a user-initiated screenshot doesn't include the button. */}
            {weekN != null && sessionDay && (
              <div style={{ padding: '0 24px', marginBottom: '4px', display: 'flex', justifyContent: 'flex-end' }}>
                <SaveImageButton weekN={weekN} sessionDay={sessionDay} />
              </div>
            )}
          </>
        )}

        {/* POST-RUN-REFRAME-01 — optional reflection + AI reframe.
            Paid-only. Mounts after RPE is set so the reflection moment comes
            after the structured inputs are captured. */}
        {hasPaidAccess && rpe !== null && weekN != null && sessionDay && (
          <div style={{ padding: '0 24px' }}>
            <ReflectionInput weekN={weekN} sessionDay={sessionDay} />
          </div>
        )}

        {/* ── DONE ──────────────────────────────────────────────────── */}
        {/* POST-RUN-02: terminus. Routes to SessionScreen for this session so
            the verdict (and the session card) is the natural resting state,
            not Today. Falls back to onBack when onDone isn't wired. */}
        <button
          onClick={onDone ?? onBack}
          style={{
            width: '100%',
            padding: '14px',
            background: 'var(--moss)',
            color: 'var(--card)',
            border: 'none',
            borderRadius: '12px',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'opacity 0.15s',
            marginTop: '4px',
          }}
        >
          Done
        </button>
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
