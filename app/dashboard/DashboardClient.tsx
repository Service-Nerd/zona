'use client'

import { calendarDaysBetween } from '@/lib/dates'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'
import ModifyPlanSheet from '@/components/shared/ModifyPlanSheet'
import ModifyPlanConfirm from '@/components/shared/ModifyPlanConfirm'
import { canModifyPlan, type PlanEdits } from '@/lib/plan/modifyPlan'
import { resolveAutoMatch } from '@/lib/coaching/sessionAutoMatch'
import { applyHrToPlan } from '@/lib/plan/zones'
import MePlanCard from '@/components/shared/MePlanCard'
import { useIsNative } from '@/lib/useIsNative'
import ZoneWeekBlock from '@/components/shared/ZoneWeekBlock'
import { classifyRun, type RunZoneOutcome } from '@/lib/coaching/zoneWeekStatement'
import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { Plan, Week, Session, GeneratorInput } from '@/types/plan'
import type { DerivedSet } from '@/lib/plan/resolveMainSet'
import PlanChart from '@/components/training/PlanChart'
import PlanCalendar from '@/components/training/PlanCalendar'
import ReflectionInput from '@/components/training/ReflectionInput'
// Calendar screen retired — CalendarOverlay.tsx renamed to .old.tsx (brand-product-alignment v2)
import StravaPanel from '@/components/strava/StravaPanel'
import { convertDistanceString, convertPaceString, formatPace } from '@/lib/format'
import { readPlanStream } from '@/lib/planStream'
import { upsertCompletion } from '@/lib/plan/completions'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/analytics'
import AdjustmentDiff from '@/components/shared/AdjustmentDiff'
import ExternalLink from '@/components/shared/ExternalLink'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { fetchPlanFromUrl, fetchPlanForUser, savePlanForUser, DEFAULT_GIST_URL, EMPTY_PLAN, getCurrentWeek, getCurrentWeekIndex, isDatePastWeek, parseLocalDate } from '@/lib/plan'
import { resolveEffectiveSessions } from '@/lib/plan/effectiveSessions'
import { easyPaceAsCeiling, splitPaceQualifier } from '@/lib/plan/easyPaceCeiling'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { resolveMaxHr } from '@/lib/plan/maxHrGuard'
import { isLongRun, coachingSessionType } from '@/lib/plan/sessionRole'
import { buildWeekVoiceContext, getWeekVoiceHeadline, getWeekVoiceItems, PHASE_LABELS, phaseDisplayLabel } from '@/lib/coaching/weekVoice'
import { planArcSeries } from '@/lib/plan/weekVolume'
import { daysDueByEndOfYesterday } from '@/lib/coaching/dayBoundary'
import { SESSION_COLORS, SESSION_LABELS, getSessionColor, getSessionLabel } from '@/lib/session-types'
import { resolveTier, TRIAL_DAYS, type TierReason } from '@/lib/trial'
import { shouldReconcile } from '@/lib/subscriptions/shouldReconcile'
import { RedeemCodeLink } from '@/components/shared/RedeemCodeLink'
import type { AfterSheet } from '@/lib/subscriptions/redeemCode'
import { getCoachingFlag, type CoachingFlag } from '@/lib/coaching/coachingFlag'
import { computeAerobicPace } from '@/lib/coaching/aerobicPace'
import { ZONE_DRIFT_ABOVE_CEILING_PCT, LOAD_RATIO, BEHIND_VERDICT_MIN_SESSIONS } from '@/lib/coaching/constants'
import { zoneVerdict, zoneVerdictColour, zoneVerdictLabel } from '@/lib/coaching/zoneVerdict'
import { driftContextFor } from '@/lib/coaching/loadCalc'
import { BRAND, PRICING } from '@/lib/brand'
import { profileInitials } from '@/lib/profileInitials'
import { sessionNotesAreAiAuthored } from '@/lib/plan/notesProvenance'
import { Wordmark } from '@/components/ui/Wordmark'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import { planRationaleNotes } from '@/lib/plan/planRationale'
import PendingAdjustmentBanner from '@/components/shared/PendingAdjustmentBanner'
import ZoneRings, { ZoneRingsSkeleton } from '@/components/shared/ZoneRings'
import { TextField } from '@/components/shared/TextField'
import { TextArea } from '@/components/shared/TextArea'
import { IdentityCard } from '@/components/shared/IdentityCard'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import PlanArc from '@/components/shared/PlanArc'
import RPEScale from '@/components/shared/RPEScale'
import SessionCard from '@/components/shared/SessionCard'
import PendingHrCard from '@/components/shared/PendingHrCard'
import SessionCompleteCard from '@/components/shared/SessionCompleteCard'
import { useDisciplineLedger, type LedgerSnapshot } from '@/lib/coaching/useDisciplineLedger'
import AttributionRow from '@/components/shared/AttributionRow'
import { attributionAnswered, currentUserId, type UpgradeSource } from '@/lib/analytics'
import { useTrackOnce } from '@/components/shared/useTrackOnce'
import { useNavRecede } from '@/components/shared/useNavRecede'
import { getCompletionCopy } from '@/lib/coaching/completionCopy'
import { classifyHrPending } from '@/lib/coaching/hrPending'
import { useWidgetSync } from '@/lib/widget/useWidgetSync'
import { clearWidgetState } from '@/lib/native/sharedStore'
import { SKIP_REASONS, FATIGUE_TAGS, isFatigueTag } from '@/lib/coaching/completionVocab'
import { useSignOut } from '@/lib/auth/signOut'
import SignOutLink from '@/components/shared/SignOutLink'
import ZoneBar, { zoneNumberForType, zoneShortName, type Zone } from '@/components/shared/ZoneBar'
import SessionSteps from '@/components/shared/SessionSteps'
import Sheet, { NavHeightProvider } from '@/components/shared/Sheet'
import { DurationPicker } from '@/components/shared/DurationPicker'
import { Z_LAYERS } from '@/lib/ui/zLayers'
import ScreenHeader from '@/components/ui/ScreenHeader'
import { useScrolledContainer } from '@/lib/ui/useScrolledContainer'
import AIMark from '@/components/shared/AIMark'
import CoachByline from '@/components/shared/CoachByline'
import PlanIntroCard from '@/components/shared/PlanIntroCard'
import PreRunBandCard from '@/components/shared/PreRunBandCard'
import LoadShape from '@/components/shared/LoadShape'
import { RaceTimesCard } from '@/components/shared/RaceTimesCard'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { NotificationRow, type NotificationItem } from '@/components/shared/NotificationRow'
import TrendCard from '@/components/shared/TrendCard'
import type { SparkBucket } from '@/lib/coaching/trendSparkline'
import RaceResultSheet, { type ReshapeProposal } from '@/components/training/RaceResultSheet'
import PostRaceReshapeCard from '@/components/training/PostRaceReshapeCard'
import NextGoalCard from '@/components/training/NextGoalCard'
import { isReengagementWeek } from '@/lib/plan/maintenance'
import { nextGoalOptions, achievementLine, parseTimeToSeconds, type FinishedRace, type NextGoalOption } from '@/lib/coaching/goalSequencing'
import { composeSession } from '@/lib/plan/sessionComposer'
import { formatDistance, formatDuration, sumRoundedDistance, resolveSessionMetric, daysUntilRace, formatRaceCountdown } from '@/lib/format'
import { backfillAndLoadSessionMetricOverrides, setSessionMetricOverride, clearSessionMetricOverride } from '@/lib/sessionMetricOverrides'
import { didSessionHitZone, sessionHRBand, zoneForSessionType, zonesFromZoneString, hrBandForZoneString, zoneKeyForZoneString } from '@/lib/coaching/zoneRules'
import { zoneDiscipline, zoneTimeSplit, weightOf } from '@/lib/coaching/weeklyZoneAggregate'
import { trendSentence } from '@/lib/coaching/trendSentence'
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
const RedeemCodeScreen = dynamic(() => import('./RedeemCodeScreen'), { ssr: false })
const BenchmarkUpdateScreen = dynamic(() => import('./BenchmarkUpdateScreen'), { ssr: false })
const FounderNoteScreen = dynamic(() => import('./FounderNoteScreen'), { ssr: false })
import { RecalibrationReadyTile, RecalibrationEntryScreen } from './RecalibrationTile'
import { nextRecalibrationDue } from '@/lib/coaching/recalibrationPrompt'
import BackButton from '@/components/shared/BackButton'
import PinnedBackHeader from '@/components/shared/PinnedBackHeader'
import HrCalibrationSheet from '@/components/shared/HrCalibrationSheet'
import ActionRow from '@/components/shared/ActionRow'
import FaqScreen, { FAQ_TITLE, FAQ_SUBTITLE } from '@/components/shared/FaqScreen'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SectionLabel } from '@/components/shared/SectionLabel'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { PreferencesScreen, PREFERENCES_TITLE, PREFERENCES_SUBTITLE } from '@/components/shared/PreferencesScreen'
import { CONNECTIONS_TITLE, connectionsSubtitle, PLAN_ADJUSTMENTS_TITLE, PLAN_ADJUSTMENTS_SUB, PLAN_ADJUSTMENTS_PENDING_SUB } from '@/components/shared/meDoors'
import { Chevron } from '@/components/shared/Chevron'
import { TrainingZonesScreen, ZonesTabs, ZONES_TAB_HR } from '@/components/shared/TrainingZonesScreen'
// PACE-BANDS-OWNER-01 — pure, and safe across BUNDLE-BOUNDARY-01 where `ruleEngine` is not.
import { buildPaceFromVDOT, type PaceGuide } from '@/lib/plan/paceBands'
import { formatDate } from '@/lib/format'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import NavTab from '@/components/ui/NavTab'
import IconButton from '@/components/ui/IconButton'
import LockedCoachingPreview from '@/components/dashboard/LockedCoachingPreview'
import PendingAnalysisCard from '@/components/dashboard/PendingAnalysisCard'
import ConnectRunsBanner from '@/components/dashboard/ConnectRunsBanner'
import SupportScreen from '@/components/dashboard/SupportScreen'
import { DAY_OFFSETS, DOW_FULL, DOW_LETTER, DOW_ORDER, PUSH_OFF_KEY, ZONE_DEFS, calculateZones, computeSessionDate, displayZonesForSession, fmtDurationMins, getReflectResponse, getSessionHRDisplay, rpeColour } from '@/components/dashboard/dashboardHelpers'
import type { PostRunData, SessionEntry } from '@/components/dashboard/dashboardHelpers'
import IconMe from '@/components/dashboard/IconMe'
import AppleHealthConnectionRow from '@/components/dashboard/AppleHealthConnectionRow'
import { fetchRunAnalysis } from '@/lib/coaching/fetchRunAnalysis'
import { computeZoneDriftPattern, zoneDriftLine } from '@/lib/coaching/zoneDrift'
import CoachTeaser from '@/components/dashboard/CoachTeaser'
import OrientationScreen from '@/components/dashboard/OrientationScreen'
import HRZonesSection from '@/components/dashboard/HRZonesSection'
import ManualRunModal from '@/components/dashboard/ManualRunModal'
import MeScreen from '@/components/dashboard/MeScreen'
import { getDeviceToken } from '@/components/dashboard/pushDevice'
import SaveImageButton from '@/components/dashboard/SaveImageButton'
import TodayScreen from '@/components/dashboard/TodayScreen'
import SessionPopupInner from '@/components/dashboard/SessionPopupInner'

type Screen = 'zones' | 'today' | 'plan' | 'coach' | 'strava' | 'me' | 'calendar' | 'session' | 'generate' | 'upgrade' | 'benchmark' | 'reshape' | 'post-run' | 'founder' | 'redeem' | 'notifications' | 'recalibration'





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
// formatRaceCountdown + daysUntilRace moved to lib/format.ts (S5, 2026-09-22).
// ADR-015 makes that file the sole owner of every time string, and three of
// this function's four call sites used to go round it.



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



// ── Layout shell ──────────────────────────────────────────────────────────

export default function DashboardClient() {
  // router.replace stays inside the WKWebView — window.location.href triggers
  // Capacitor's external-navigation handler, which on iOS opens Safari.
  const router = useRouter()
  const [plan, setPlan] = useState<Plan | null>(null)

  // ── P-02 — MODIFY-PLAN SHEET ORCHESTRATION ──────────────────────────────
  //
  // Lives here rather than in PlanScreen because this component owns the plan
  // state and the save path, and the save path is not negotiable:
  // `savePlanForUser` is the single writer (SAVE-VALIDATE-01 — nine routes
  // once bypassed it and persisted unvalidated plans), and it is also what
  // supersedes week-keyed rows on a race-identity change. Writing `plan_json`
  // from the sheet would skip BOTH.
  const [modifyOpen, setModifyOpen] = useState(false)
  /** The regenerated plan awaiting the runner's accept. Never auto-applied. */
  const [modifyPreview, setModifyPreview] = useState<{ next: Plan; resets: boolean } | null>(null)
  /** MODIFY-CONFIRM-01 — owned HERE, not in the sheet. The sheet unmounts when
   *  the confirm screen opens, so sheet-local state could not survive the one
   *  journey it exists for. `clearModify()` is the single place they are dropped. */
  const [modifyEdits, setModifyEdits] = useState<PlanEdits>({})
  // D4 (founder, app review) — WHERE THE SESSION WAS OPENED FROM.
  // `SessionScreen`'s onBack was hardcoded to 'today', and there is exactly one
  // render of it, so a session opened from Plan week 2 sent the runner to Today.
  // Both callers now say where they came from.
  // ⚠️ MINIMAL, AND THE GAP IS NAMED: this restores the SCREEN, not the open
  // week. The founder asked to land back on "week two" specifically;
  // `PlanScreen` takes no initial week, so that is a second change with its own
  // prop. Filed rather than half-built.
  // ⚠️ `NotificationsScreen` has a byte-identical `onBack` one line away and is
  // deliberately untouched — a global replace would have moved it too.
  const [sessionOrigin, setSessionOrigin] = useState<'today' | 'plan'>('today')
  /**
   * POSTRUN-ORIGIN-01 — where post-run goes BACK to.
   *
   * 🔴 `onBack` was a hardcoded `setScreen('today')` while `onDone` correctly
   * returned to the session the runner came from (POST-RUN-02 reasoned that
   * terminus out). So the two exits from one screen disagreed, and the one
   * that disagreed was BACK: open a session from Plan, tap the linked run,
   * tap back, and you land on Today — two screens from where you were.
   * **The escape hatch was worse than the completion path**, which punishes
   * the runner for changing their mind.
   *
   * Exactly D4's class, already fixed once in this file: `sessionOrigin`
   * exists because back-from-Plan was the same hardcoded line. The second
   * instance was never looked for.
   */
  const [postRunOrigin, setPostRunOrigin] = useState<'today' | 'session'>('today')
  const [modifyBusy, setModifyBusy] = useState(false)
  const [modifyError, setModifyError] = useState<string | null>(null)

  /** Regenerate from the overlaid input. Nothing is saved at this point. */
  async function runModifyPreview(nextInput: GeneratorInput, resets: boolean) {
    setModifyBusy(true); setModifyError(null)
    try {
      const res = await authedFetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextInput),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // A 422 here is a DESIGNED refusal: the runner's edit produced inputs
        // the engine will not build (too few weeks, below the base door). It
        // is not an error and must not read as one.
        setModifyError(data.error ?? 'That change could not be built into a plan.')
        return
      }
      // The free-tier path returns plain JSON; the enriched path streams NDJSON
      // and its FIRST message is the complete rule plan (ADR-006 — the runner
      // always holds a full plan before enrichment).
      //
      // 🔴 PLAN-STREAM-OWNER-01 — this used to read `await res.text()`, which
      // does not resolve until the stream CLOSES, i.e. after enrichment. The
      // comment here claimed it "avoids holding the sheet open for the model";
      // it took the first message only after awaiting every message. Measured
      // on production: a 38,924 ms enrich call the sheet sat through before it
      // could use a plan the server had sent immediately.
      //
      // Now stops at `rule_plan` and lets the owner cancel the reader. Same
      // plan object as before — only the wait is gone.
      const ct = res.headers.get('content-type') ?? ''
      let next: Plan | null = null
      if (ct.includes('ndjson')) {
        for await (const msg of readPlanStream(res)) {
          if (msg.type === 'rule_plan') { next = msg.plan; break }
        }
      } else {
        next = ((await res.json()).plan as Plan) ?? null
      }
      if (!next) { setModifyError('That change could not be built into a plan.'); return }
      setModifyOpen(false)
      setModifyPreview({ next, resets })
    } catch {
      setModifyError('Could not reach the server. Check your connection.')
    } finally {
      setModifyBusy(false)
    }
  }

  /** MODIFY-CONFIRM-01 — the ONLY place an in-progress modification is dropped.
   *  Accept and discard both end here; the back arrow deliberately does not. */
  function clearModify() {
    setModifyPreview(null); setModifyOpen(false); setModifyEdits({}); setModifyError(null)
  }

  /** Accept. ⚠️ Saves through `savePlanForUser`, never a direct write. */
  async function acceptModify() {
    if (!modifyPreview) return
    setModifyBusy(true); setModifyError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setModifyError('You are signed out. Sign in and try again.'); return }
      await savePlanForUser(user.id, modifyPreview.next, supabase)
      setPlan(modifyPreview.next)
      clearModify()
    } catch {
      setModifyError('Could not save that change. Try again.')
    } finally {
      setModifyBusy(false)
    }
  }
  const [screen, setScreen] = useState<Screen>('today')
  /** ME-DOORS-01 — a request to open Me AT a door rather than at the index. Consumed once
   *  by `MeScreen` and cleared, so returning to Me later lands on the index as usual. */
  const [meOpenSection, setMeOpenSection] = useState<string | null>(null)
  const [showMe, setShowMe] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [activeSessionData, setActiveSessionData] = useState<any | null>(null)
  const [activePostRunData, setActivePostRunData] = useState<PostRunData | null>(null)
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
  // CoachingPrinciples §50 (HR-MAX-01) — provenance of the stored max HR.
  // 'observed' = device history (a floor), 'user_confirmed' = typed in Profile.
  const [maxHRSource, setMaxHRSource] = useState<'observed' | 'user_confirmed' | null>(null)
  // X-FIRSTRUN: detect Apple Health connection state so we can render an
  // honest pre-data view ("Connect a source" vs "Set your HR" vs "Run one").
  /** ⚠️ THREE states, not two (ME-ORDER-01). `undefined` = NOT YET LOADED, `null` = loaded
   *  and not connected, string = connected. It was `string | null` initialised to `null`
   *  and only ever SET when truthy, so "not connected" and "not loaded" were the same
   *  value. That was harmless while the only reader asked `!!healthkitConnectedAt` — and
   *  becomes a **false negative flashed on every open** the moment a row says
   *  "No sources connected". A subtitle may not assert a negative it cannot know yet. */
  const [healthkitConnectedAt, setHealthkitConnectedAt] = useState<string | null | undefined>(undefined)
  const [birthYear, setBirthYear] = useState<number | null>(null)
  const [firstName, setFirstName] = useState<string>('')
  const [lastName, setLastName] = useState<string>('')
  const [profileEmail, setProfileEmail] = useState<string>('')

  // Paid access — default true to avoid flash of locked state during load
  const [hasPaidAccess, setHasPaidAccess] = useState(true)
  // SUBS-RECONCILE-TRIAL-GATE-01 — `reason` distinguishes a trial from a recorded
  // subscription, which `hasPaidAccess` cannot. Null until the tier resolves.
  const [tierReason, setTierReason] = useState<TierReason | null>(null)
  // GTM-CHARITY-04 — ISO end date of a live charity grant, or null. Surfaced on
  // Me so the grant never lapses silently.
  const [charityGrantEndsAt, setCharityGrantEndsAt] = useState<string | null>(null)
  /** FIRSTRUN-MOMENTS-01f — the partner and cohort size behind a live grant, so
   *  the plan reveal can state one true fact about not being alone. Null unless
   *  the runner holds a grant from a live batch that declared a cap. */
  const [charityCohort, setCharityCohort] =
    useState<{ partnerName: string; cohortSize: number } | null>(null)
  /** This runner was comped at some point, live grant or lapsed. Decides which
   *  words the Upgrade screen uses when access ends. */
  const [hadCharityGrant, setHadCharityGrant] = useState(false)
  /** Where to return when the redeem screen closes. There are three doors into
   *  it (Me, Upgrade, and the onboarding wizard) and `onBack` used to be hard
   *  wired to Me, so redeeming from the wizard dropped a half-finished plan. */
  const [redeemReturnTo, setRedeemReturnTo] = useState<Screen>('me')
  /** ME-DOORS-01 — the zones screen now has TWO entry points with two different correct
   *  backs: the `Zones` row on the Me index, and the `heart-rate` door. Same shape as
   *  `redeemReturnTo` above. Null means "back to the index", which is the index row's case. */
  const [zonesReturnSection, setZonesReturnSection] = useState<string | null>(null)
  // ZONES-TAB-PIN-01 — the tab state lives HERE because the pinned header group
  // lives here, and the Design Board ruled the control pins with the group. The
  // screen stays uncontrolled when no `tab` is passed, which is what keeps
  // `/zones-preview` rendering the real component honestly across every state.
  const [zonesTab, setZonesTab] = useState<string>(ZONES_TAB_HR)
  /** PTR-SUBPAGE-01 — which Me door is open, so the pull gesture can be switched off on it. */
  const [meActiveSection, setMeActiveSection] = useState('main')
  /** ZONES-HR-SHEET-01 — the HR form's only mount is a sheet on the zones screen.
   *  ⚠️ Set by the `Zones` row when HR is UNSET, so the runner who has nothing to read is
   *  taken straight to the thing that fixes that. Sending them to an empty zones screen to
   *  hunt for a control would be worse than the door this replaced (Wroblewski). */
  const [hrSheetOpen, setHrSheetOpen] = useState(false)

  /**
   * The single owner of "the runner saved their HR" (ZONES-HR-SHEET-01).
   *
   * ⚠️ MOVED VERBATIM out of `MeScreen`'s `onHRChange` prop, which went dead when the
   * `Heart rate` door was removed: `MeScreen` declared it and no longer rendered anything
   * that called it. Extracted rather than copied, because two writers of the same state is
   * the shape of this codebase's most expensive defects.
   */
  const handleHrSave = async (rhr: number, mhr: number) => {
  setRestingHR(rhr); setMaxHR(mhr)
  // CoachingPrinciples §50 (HR-MAX-01) — a value the runner typed in Profile and
  // saved IS a confirmation. Tag it 'user_confirmed' so the §50 asymmetry trusts
  // it even below the age estimate (genuine low-max athletes) instead of treating
  // it as a device floor.
  setMaxHRSource('user_confirmed')
  // `newZ2` removed 2026-09-24 — it was a second copy of the Z2 boundary living
  // in a React component, and the only reason it existed is that `computeZones`
  // was private to `ruleEngine.ts`. `applyHrToPlan` owns it now.
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // 1. user_settings is the single source of truth for live HR values
    await supabase.from('user_settings').upsert({ id: user.id, resting_hr: rhr, max_hr: mhr, max_hr_source: 'user_confirmed', updated_at: new Date().toISOString() })
    // 2. P1 — sync plan.meta so the zone2_ceiling fallback path never drifts
    //    from user_settings. Uses savePlanForUser (not savePlanForUser archives
    //    the plan — that's only done in the generate flow). Plain upsert here.
    //    §50: stamp the confirmed max + provenance so INV-PLAN-MAX-HR-NOT-BELOW-
    //    ESTIMATE-FLOOR reads a coherent state and the stale floor note clears.
    if (plan && plan !== EMPTY_PLAN) {
      // 🔴 PLAN-ZONE-VS-HRTARGET-01 — THIS USED TO UPDATE `meta` AND NOTHING ELSE.
      //
      // Every session's `hr_target` kept the band computed at generation, while
      // the session-detail HEADER derives its bpm from `session.zone` + meta. One
      // card therefore read "Zone 3 · 161–175 bpm" above a note saying
      // "158–171 bpm" — measured on 6 of 22 live plans, every quality session.
      // `applyHrToPlan` is the single owner that keeps meta and the sessions in
      // step; it also sets `zone2_ceiling`, so the hand-rolled `newZ2` below is
      // gone rather than left as a second copy of the Z2 boundary.
      const withHr = applyHrToPlan(plan as never, rhr, mhr) as never as typeof plan
      const updatedPlan = { ...withHr, meta: { ...withHr.meta, hr_derived_max: mhr, hr_max_source: 'user_confirmed', hr_zone_method: 'karvonen', hr_assumption_note: undefined } }
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
}


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
  /** ANALYSIS-SUPERSEDE-PATTERN-01 — cross-plan discipline rows for the drift
   *  detector ONLY. Never merged into `runAnalysisMap`: see the load comment. */
  const [zoneDriftRows, setZoneDriftRows] = useState<any[]>([])
  // Tracks whether the run_analysis fetch has completed (success OR empty).
  // Lets downstream UI distinguish "still loading" from "definitely no data"
  // — used to show a skeleton instead of letting the RestraintCard pop in
  // a beat after the rest of the Today screen renders.
  const [runAnalysisReady, setRunAnalysisReady] = useState(false)
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

  // OPS-ATTRIB-01 — has this viewer already answered or skipped the attribution row?
  //
  // ⚠️ READ IN AN EFFECT, NOT A LAZY useState INITIALISER. The server has no
  // localStorage, so an initialiser returns false there and possibly true on the
  // client: a hydration mismatch. Starting false and correcting after mount can
  // flash the row for one frame for someone who already answered — the cheaper of
  // the two defects, and barely visible because it renders last on the screen.
  // OPS-FUNNEL-02 — which door sent them to the paywall.
  //
  // 🔴 ONE OWNER. Nine call sites each doing `setScreen('upgrade')` plus a source
  // assignment is nine chances for the tenth to forget the second statement. This
  // is the DELOAD-OWNER-01 shape and the reason that item exists.
  // NAV-FADE-01 — the bar recedes while scrolling, returns 150ms after it stops.
  // The LOOK lives in `.nav-bar--receded`; reduced motion disables it in CSS, in
  // one place, rather than being decided here as well.
  const navReceded = useNavRecede()

  // CHARITY-OFFER-CODE-01 — "I may hold an entitlement you never recorded."
  //
  // 🔴 THE JOURNEY 500 MAKE-A-WISH RUNNERS ARE ABOUT TO TAKE: code arrives by
  // email -> redeemed in the App Store -> THEN the app is installed -> THEN an
  // account is created. At redemption there is no Zonna account, so the
  // entitlement attaches to an ANONYMOUS RevenueCat id; the webhook fires
  // carrying it and the database refuses it (verified: "invalid input syntax for
  // type uuid"). The alias that would re-key it fires SUBSCRIBER_ALIAS, which
  // RevenueCat marks deprecated and does not send to new projects.
  //
  // ⚠️ THE CLIENT NEVER CLAIMS ENTITLEMENT — it asks to be re-checked. The route
  // asks RevenueCat server-side with a secret the app never holds. Letting the
  // app assert it would be a free subscription for anyone who can call an
  // endpoint.
  //
  // Native only (there is no StoreKit on web), once per mount, and skipped when the
  // runner's access is already explained by a recorded subscription — so it costs
  // nothing for the ~all of users for whom the webhook worked normally.
  //
  // 🔴 SUBS-RECONCILE-TRIAL-GATE-01 — THE GUARD USED TO BE `if (hasPaidAccess) return`,
  // AND IT EXCLUDED EXACTLY THE POPULATION THIS EXISTS FOR. `hasPaidAccess` is
  // `tier !== 'free'`, and every brand-new account is in a 14-day reverse trial — so it
  // was `true` for every charity runner who redeems a code and then signs up. Measured:
  // `tester1@test.com` held a £0 one-year entitlement and reconcile was skipped on two
  // separate app opens, leaving `subscriptions` and `ops_events` empty.
  //
  // The question is not "does this runner have access?" but "is their access already
  // explained by a recorded subscription?" — which is what `resolveTier`'s `reason`
  // answers, and what TIER-OWNER-01 added it for. The decision lives in
  // `shouldReconcile` so it can be unit-tested; `vitest` cannot reach this file.
  const reconcileTried = useRef(false)

  // CHARITY-CODE-CONTROL-01 — ONE OWNER for "ask the server whether this runner holds
  // an entitlement we never recorded", because there are now TWO callers: this effect on
  // mount, and `RedeemCodeLink` the moment Apple's redemption sheet closes.
  //
  // 🔴 Apple's sheet returns `Promise<void>` — no success, no cancellation, no error — so
  // the control cannot report anything without re-asking. Two copies of this routine is
  // the DELOAD-OWNER-01 shape, and the repo has paid for it five times; it is one
  // function used twice instead.
  //
  // Returns whether an entitlement was found, so a caller can show a state. The mount
  // effect ignores the return value because a reload has already happened by then.
  const runEntitlementRecheck = useCallback(async (): Promise<boolean> => {
    try {
      await (window as unknown as { __rcReady?: Promise<void> }).__rcReady
      const uid = userId
      if (uid) {
        await (window as unknown as { __rcIdentify?: (u: string) => Promise<void> })
          .__rcIdentify?.(uid)
      }
      const res = await authedFetch('/api/subscriptions/reconcile', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.entitled) {
        // Reload rather than patching tier in place: `resolveTier` is the single owner
        // and a second copy of "are they paid now?" here is the drift class
        // TIER-OWNER-01 records.
        window.location.reload()
        return true
      }
      return false
    } catch {
      // Silent by design. A runner who is genuinely entitled still has the webhook and
      // the next app open; an error toast here would alarm the ~all of users who simply
      // have no entitlement to find.
      return false
    }
  }, [userId])

  useEffect(() => {
    if (!shouldReconcile({
      appReady,
      userId,
      tierReason,
      isNative: Capacitor.isNativePlatform(),
      alreadyTried: reconcileTried.current,
    })) return
    reconcileTried.current = true
    // SUBS-RECONCILE-RACE-01's sequencing now lives in `runEntitlementRecheck` above,
    // because Apple's redemption sheet needs the identical routine the instant it closes.
    void runEntitlementRecheck()
  }, [appReady, userId, tierReason, runEntitlementRecheck])
  const [upgradeSource, setUpgradeSource] = useState<UpgradeSource | null>(null)
  const openUpgrade = (source: UpgradeSource) => { setUpgradeSource(source); setScreen('upgrade') }
  const [attributionResolved, setAttributionResolved] = useState(false)
  useEffect(() => { if (attributionAnswered()) setAttributionResolved(true) }, [])

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
      // 🔴 OCCLUSION, NOT ELEMENT HEIGHT (NAV-FLOAT-01). This read
      // `getBoundingClientRect().height`, which was correct for exactly as long
      // as the nav was FLUSH to the bottom edge — then its height WAS the band
      // it covered. The floating pill is ~62px tall and sits 12px off the edge,
      // so it occludes 74px while reporting 62. Every consumer — `Sheet`'s
      // maxHeight and the scroll container's reserve — would under-reserve by
      // the float gap.
      //
      // ⚠️ AND THE `+16` SLACK IN THE RESERVE WOULD HAVE ABSORBED IT, which is
      // worse than a visible break: the app would have looked right by accident
      // and `Sheet` would have been 12px too tall on every screen. Measuring
      // from the viewport bottom is true for a flush bar AND a floating one, so
      // this cannot drift again if the shape changes a third time.
      const r = node.getBoundingClientRect()
      const h = Math.ceil(window.innerHeight - r.top)
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
      openUpgrade('link_strava')
      window.history.replaceState({}, '', '/dashboard')
    }

    // EMAIL-WAVE-1 — email CTA deep links (Design Board 2026-09-24, amendment 2).
    //
    // ⚠️ THE VOCABULARY IS SHARED, NOT RETYPED. `EMAIL_CTA_SCREENS` is the same
    // list the email templates build their hrefs from, and
    // `emailCtaTargets.test.ts` reads both sides — because the amendment exists
    // precisely to stop a CTA that looks fixed and lands nowhere.
    //
    // `connect` is not a screen: the HealthKit flow is an overlay, so the link
    // opens it over Today rather than routing. That is why it is handled here
    // and not in the `screenParam` block below.
    {
      // `post-run` is deliberately NOT handled here: the push deep-link block
      // below already parses that exact shape (weekN + sessionDay) and resolves
      // it once `plan` loads. Handling it twice would be two answers to one
      // question, which is the duplication this codebase keeps paying for.
      const emailScreen = params.get('screen')
      if (emailScreen === 'upgrade') {
        openUpgrade('link_email')
        window.history.replaceState({}, '', '/dashboard')
      } else if (emailScreen === 'connect') {
        setShowConnectRuns(true)
        window.history.replaceState({}, '', '/dashboard')
      }
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
      // POSTRUN-ORIGIN-01 — arrived from a push deep-link or a cold start, so
      // there is no screen behind this one. Today is the honest destination.
      setPostRunOrigin('today')
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

  // Avatar initials — lib/profileInitials.ts is the single owner, so the circle
  // and its regression test cannot drift apart.
  const initials = profileInitials({
    firstName,
    lastName,
    planAthlete: plan?.meta?.athlete,
    email: profileEmail,
  })

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
      // HK-ELEV-COLUMN-01 — `error` is READ now, not destructured away.
      //
      // This asked for `total_elevation_gain`. The column is `elevation_gain`,
      // and the wrong name has been here since 2026-06-06. Supabase answers a
      // bad column with `{ data: null, error }`, and with the error dropped
      // `hkRows` was null, the guard below returned, and THIS FUNCTION LOADED
      // ZERO HEALTHKIT RUNS FOR THREE AND A HALF MONTHS. The only trace was
      // Postgres errors in a log nobody reads.
      const { data: hkRows, error: hkErr } = await supabase
        .from('strava_activities')
        .select('apple_health_uuid, strava_activity_id, name, start_date, distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, avg_speed, elevation_gain')
        .eq('user_id', user.id)
        .eq('source', 'apple_health')
        .order('start_date', { ascending: false })
        .limit(100)
      if (hkErr) { console.error('[refreshHealthKitRuns] query failed', hkErr); return }
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
        total_elevation_gain: r.elevation_gain ?? 0,
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
  //
  // ⚠️ That last sentence was FALSE in production until 2026-09-11. The
  // `daily_coach_notes` table did not exist — the migration was committed and
  // recorded in the applied-migrations ledger, but never landed — so the cache
  // read errored, the route regenerated, and every app open by a paid or trial
  // runner paid for a fresh model call. Both call sites discarded the error, so
  // there was no symptom other than the bill. Table applied, and the route now
  // records `coach_note_cache_unavailable` rather than failing quietly.
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
        const [settingsRes, overridesRes, completionsRes, subRes, charityGrantRes, guidanceRes, pendingReshapeRes] = await Promise.all([
          supabase.from('user_settings').select('strava_refresh_token, gist_url, plan_json, has_onboarded, is_admin, preferred_units, preferred_metric, resting_hr, max_hr, max_hr_source, birth_year, date_of_birth, first_name, last_name, email, trial_started_at, dynamic_adjustments_enabled, orientation_seen, zone_drift_dismissed_at, benchmark_recal_dismissed_at, last_adjustment_check_at, last_adjustment_check_found_change, daily_push_enabled, timezone, connect_runs_seen, connect_runs_banner_dismissed_at, push_permission_seen, healthkit_connected_at').eq('id', user.id).single(),
          supabase.from('session_overrides').select('week_n, original_day, new_day').eq('user_id', user.id).is('superseded_at', null),
          supabase.from('session_completions').select('week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_name, strava_activity_km, rpe, fatigue_tag, skip_reason, avg_hr, coaching_flag').eq('user_id', user.id).is('superseded_at', null),
          supabase.from('subscriptions').select('status, current_period_end').eq('user_id', user.id).maybeSingle(),
          // GTM-CHARITY-04 — readable under RLS by its owner only (the policy is
          // `auth.uid() = claimed_by`), which is all the client needs.
          // FIRSTRUN-MOMENTS-01f — the batch comes back with the grant so the
          // reveal can name the partner and their cohort size. One join, in the
          // query that already runs, rather than a second round trip.
          supabase.from('charity_codes')
            .select('expires_at, charity_batches(partner_name, cap, revoked_at)')
            .eq('claimed_by', user.id).maybeSingle(),
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
        if (data?.max_hr_source === 'observed' || data?.max_hr_source === 'user_confirmed') setMaxHRSource(data.max_hr_source)
        setHealthkitConnectedAt(data?.healthkit_connected_at ?? null)   // ← null is now a LOADED answer
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


        // Trial — set trial_started_at on first load if not already set
        let trialStartedAt: string | null = data?.trial_started_at ?? null
        if (!trialStartedAt) {
          trialStartedAt = new Date().toISOString()
          void supabase.from('user_settings').upsert({ id: user.id, trial_started_at: trialStartedAt, updated_at: new Date().toISOString() })
        }

        // Paid access — resolved by `resolveTier`, the SAME pure function
        // getUserTier calls on the server. This block used to re-implement the
        // order as an OR-chain, which made three copies of one rule (here,
        // lib/trial.ts, and a private copy inside tierResolution.test.ts) and a
        // comment asking the next person to remember to keep them in step.
        // D-16 (no parallel semantics) now holds by construction rather than by
        // memory: there is one owner and the client cannot drift from it.
        const sub = subRes.data
        const charityExpiry = charityGrantRes.data?.expires_at ?? null
        // §01f — only a LIVE batch names a cohort. A revoked batch is not a
        // cohort the runner belongs to, and a null cap means the partner never
        // stated a size, so there is no honest number to show.
        const batch = (charityGrantRes.data as any)?.charity_batches ?? null
        if (batch && !batch.revoked_at && typeof batch.cap === 'number' && batch.cap > 0 && batch.partner_name) {
          setCharityCohort({ partnerName: batch.partner_name, cohortSize: batch.cap })
        }
        const now = new Date()

        const { tier, reason } = resolveTier({
          isAdmin: data?.is_admin,
          subStatus: sub?.status,
          subPeriodEnd: sub?.current_period_end,
          grantExpiresAt: charityExpiry,
          trialStartedAt,
        }, now)

        setTierReason(reason)
        setCharityGrantEndsAt(reason === 'grant' ? charityExpiry : null)
        const paidAccess = tier !== 'free'
        setHasPaidAccess(paidAccess)

        // A charity runner HAD a grant whether or not it is still live, and
        // that decides what we say when access ends — not whether a trial
        // clock also happens to have run out. Without it a comped runner was
        // shown the trial loss framing ("14 days done", "Kit's gone quiet")
        // months after being given the app.
        setHadCharityGrant(!!charityExpiry)
        const trialIsWhatEnded = !paidAccess && !!trialStartedAt && !charityExpiry
        setTrialExpired(trialIsWhatEnded)

        // Trial countdown. Gated on `reason === 'trial'` — the trial is only
        // worth counting down when it is the thing actually carrying them.
        //
        // The old gate was `trialStartedAt && !hasActiveSub`, which a charity
        // runner passes: they have a trial clock AND a grant, so on day 3 of a
        // 90-day grant the Me screen told them "11 days left in your trial" and
        // labelled their account Trial instead of Pro.
        //
        // The `0` branch is load-bearing and deliberately kept: TodayScreen
        // renders a post-trial prompt on `trialDaysLeft === 0 && !hasPaidAccess`,
        // so collapsing a lapsed trial to null would silently delete it for
        // every ordinary free user.
        if (reason === 'trial') {
          const trialEnd = new Date(trialStartedAt).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000
          const msLeft = trialEnd - now.getTime()
          setTrialDaysLeft(msLeft > 0 ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : 0)
        } else if (trialIsWhatEnded) {
          setTrialDaysLeft(0)
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
            const [analysisRes, reportRes, adjustmentsRes, unreadCountRes, phaseSummaryRes, raceReadinessRes, recentChangesRes] = await Promise.all([
              supabase.from('run_analysis').select('week_n, session_day, source, verdict, total_score, feedback_text, hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, ef_trend_pct, hr_discipline_score, distance_score, pace_score, ef_score, actual_load_km, hr_pct_z1, hr_pct_z2, hr_pct_z3, hr_pct_z4_5').eq('user_id', user.id).is('superseded_at', null),
              supabase.from('weekly_reports').select('*').eq('user_id', user.id).is('superseded_at', null).order('week_n', { ascending: false }).limit(1).maybeSingle(),
              supabase.from('plan_adjustments').select('*').eq('user_id', user.id).is('superseded_at', null).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle(),
              // NOTIF-01 — unread notification count for the Today-screen bell dot.
              // head:true returns the count without the rows (we only need the badge).
              supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
              // R28 — most recent phase-end summary (CoachScreen validates against current transition)
              supabase.from('phase_summaries').select('content, generated_at, phase_ended, transition_week_n').eq('user_id', user.id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
              // R29 — race readiness note for the plan's race date
              loadedPlan.meta.race_date
                ? supabase.from('race_readiness_notes').select('content, generated_at').eq('user_id', user.id).eq('race_date', loadedPlan.meta.race_date).maybeSingle()
                : Promise.resolve({ data: null, error: null }),
              supabase.from('plan_adjustments')
                .select('id, week_n, summary, sessions_before, sessions_after, created_at')
                .eq('user_id', user.id).eq('status', 'auto_applied')
                .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
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

        // ADR-011: HealthKit activities are a co-equal match source to Strava.
        // They already live in strava_activities (source='apple_health', written
        // by /api/health/ingest). Load them up front — regardless of whether
        // Strava is connected — so the client-side auto-match and the manual
        // picker can see treadmill / Apple Watch runs, not just Strava runs.
        let healthKitRuns: any[] = []
        let hkStravaIds = new Set<number>()
        try {
          // HK-ELEV-COLUMN-01 — same wrong column, same swallowed error, on the
          // INITIAL load. See refreshHealthKitRuns above.
          const { data: hkRows, error: hkErr } = await supabase
            .from('strava_activities')
            .select('apple_health_uuid, strava_activity_id, name, start_date, distance_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, avg_speed, elevation_gain')
            .eq('user_id', user.id)
            .eq('source', 'apple_health')
            .order('start_date', { ascending: false })
            .limit(100)
          // Marshal each HK row into the StravaActivity-like shape the matcher,
          // picker, and saveCompletion already consume. `id` is the UUID so the
          // link path can branch on `source` to write apple_health_uuid.
          if (hkErr) console.error('[dashboard load] HealthKit runs query failed', hkErr)
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
            total_elevation_gain: r.elevation_gain ?? 0,
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
        .select('week_n, session_day, status, strava_activity_id, apple_health_uuid, strava_activity_name, strava_activity_km, rpe, fatigue_tag, skip_reason, avg_hr, coaching_flag')
        .eq('user_id', user.id)
        .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
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
        .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
      if (data) {
        const map: Record<number, Record<string, any>> = {}
        data.forEach((r: any) => {
          if (r.week_n == null) return
          if (!map[r.week_n]) map[r.week_n] = {}
          map[r.week_n][r.session_day] = r
        })
        setRunAnalysisMap(map)
      }

      // ANALYSIS-SUPERSEDE-PATTERN-01 (Coaching Board, 2026-10-07) — a SECOND,
      // NARROW query for the zone-drift history, deliberately not filtered on
      // `superseded_at`.
      //
      // 🔴 IT IS SEPARATE ON PURPOSE AND MUST STAY SEPARATE. The map above feeds
      // ZoneRings, the session cards and the weekly discipline percentage, all of
      // which are PLAN-SCOPED and index by `week_n`. Old plans REUSE week numbers —
      // the founder's hidden rows are weeks 15-35 and `PLAN-WEEK-COLLISION-01` is
      // what happens when two plans' week 3 meet in one map: a new plan arrived 94%
      // pre-completed. Unfiltering the shared map to serve one card would ship that
      // again. §71 Am. 1's split is per-FIELD, so the cross-plan read is per-READER.
      //
      // Discipline columns only (`hr_above_ceiling_pct`), which is exactly what the
      // amendment authorises to cross. `ef_trend_pct` is NOT selected here: it is
      // fitness-denominated and the amendment forbids it crossing.
      const { data: driftRows, error: driftErr } = await supabase
        .from('run_analysis')
        .select('week_n, session_day, source, session_type, hr_above_ceiling_pct, superseded_at')
        .eq('user_id', user.id)
        .not('hr_above_ceiling_pct', 'is', null)
        .order('week_n', { ascending: false })
        .limit(60)
      if (driftErr) console.warn('[coach] drift history load failed', driftErr.message)
      if (driftRows) setZoneDriftRows(driftRows as any[])
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

  async function handlePlanSaved(savedPlan: Plan) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

      // SAVE-LATENCY-01 — these two writes touch DIFFERENT tables and neither
      // reads the other's result, so they are started together instead of
      // nose-to-tail. Run serially they added a whole round-trip to the
      // "Saving..." the runner sits through, on top of auth.getUser above.
      //
      // Archiving the previous plan lives inside savePlanForUser (single owner —
      // fires for every mutation path, race-change-guarded, error-surfaced).
      //
      // Promise.allSettled, not Promise.all: the plan write is the one that must
      // not be lost, and a rejected settings write must not take it down with it.
      // Their failure modes are graded separately below, exactly as before.
      const [planWrite, onboardWrite] = await Promise.allSettled([
        savePlanForUser(user.id, savedPlan, supabase),
        supabase.from('user_settings').upsert(onboardPatch),
      ])
      // The plan write keeps its original semantics: it throws, and the wizard's
      // catch surfaces it. Nothing below should run against a failed plan save.
      if (planWrite.status === 'rejected') throw planWrite.reason
      const onboardErr = onboardWrite.status === 'rejected'
        ? { message: String(onboardWrite.reason) }
        : onboardWrite.value.error
      // Non-fatal: the plan is already saved. Surface the failure rather than
      // swallowing it (the original silent-failure class). recordOpsEvent is
      // server-only (service-role key), so report it via the bearer-authed
      // ONBOARD-OBS-01 route — fire-and-forget, and never let telemetry break
      // the finalise (the daily onboarding-integrity probe backstops any miss).
      if (onboardErr) {
        console.error('Failed to persist onboarding state:', onboardErr.message)
        void authedFetch('/api/ops/onboarding-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: onboardErr.message,
            had_rhr: typeof metaRhr === 'number',
            had_mhr: typeof metaMhr === 'number',
          }),
        }).catch(() => { /* telemetry is best-effort */ })
      }
      setPlan(savedPlan)
      setScreen('today')
      // Only show orientation on first-ever plan generation (B-002)
      if (!orientationSeen) setShowOrientation(true)
    } catch (err) {
      console.error('Failed to save plan:', err)
      throw err
    }
  }

  /**
   * ENRICH-SAVE-01 — write the AI-enriched copy over the plan the runner has
   * already saved and is already looking at.
   *
   * The enricher takes 28–35s; the plan itself takes ~10ms. Rather than making
   * the runner wait (the old flow blocked 15s, then silently saved the bare rule
   * plan when that ran out), they commit immediately and the voice lands after.
   *
   * Deliberately NOT handlePlanSaved: this must not re-run the onboarding side
   * effects — has_onboarded, the HR hydration, the orientation overlay, the
   * navigation. It is the same plan with better copy, not a new plan.
   *
   * `savePlanForUser` archives only on a race-identity change, and this carries
   * the same race, so no duplicate plan_archive row is created.
   *
   * Non-fatal by design (ADR-006): the runner already holds a valid, complete
   * plan. A failure here costs them the voice layer, never the plan, so it is
   * logged and swallowed rather than surfaced.
   */
  async function handlePlanEnriched(enrichedPlan: Plan) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Identity guard. This write is fired by a stream that outlives the wizard
      // screen, so it can in principle land after the runner has generated and
      // saved a DIFFERENT plan — patching the old plan's voice over the new
      // plan. Requires saving plan A, re-running the wizard and saving plan B
      // inside the ~30s enricher window, so it is unlikely rather than
      // impossible; a stale overwrite of the runner's live plan is exactly the
      // kind of silent loss this codebase keeps paying for, so it is cheap
      // insurance. Read from the DB, not component state — the closure that
      // fires this captured an earlier render and its `plan` is stale.
      const { data: currentRow } = await supabase
        .from('plans')
        .select('plan_json')
        .eq('user_id', user.id)
        .maybeSingle()
      const current = currentRow?.plan_json as Plan | undefined
      const identity = (p?: Plan) =>
        `${p?.meta?.race_name ?? ''}|${p?.meta?.race_date ?? ''}|${p?.meta?.plan_start ?? ''}`
      if (!current || identity(current) !== identity(enrichedPlan)) {
        console.warn('[enrich] skipped — saved plan is no longer the one this enrichment belongs to')
        return
      }

      await savePlanForUser(user.id, enrichedPlan, supabase)
      setPlan(enrichedPlan)
    } catch (err) {
      console.error('Failed to persist AI enrichment (plan itself is safe):', err)
    }
  }

  const currentWeekIndex = plan ? getCurrentWeekIndex(plan.weeks) : 0

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

  // A1 — `viewWeekIndex` and this effect are GONE. They mirrored
  // `currentWeekIndex` (computed above from the same `getCurrentWeekIndex`) into
  // state purely so Today's arrows could move it. With no arrows the mirror is a
  // second answer to a question that already had one owner, which is the exact
  // shape of DELOAD-OWNER-01 and TIER-OWNER-01. Today reads `currentWeekIndex`.

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
  // CONNECT-FIRST (CI-4) — for a brand-new native user (no plan yet), show the
  // connect-runs screen BEFORE the wizard, so the benchmark can pre-fill from
  // real runs and the ConnectRunsScreen's onHRFound seeds resting/max HR (the
  // restingHR/maxHR state passed into GeneratePlanScreen). Fires only pre-plan
  // with connect_runs_seen === null on native; once the user connects or skips,
  // the flag is decided and CONNECT-01 below won't re-fire. Web + returning
  // users (who already have a plan) fall through to the CONNECT-01 path.
  useEffect(() => {
    if (plan && plan !== EMPTY_PLAN) return          // has a plan → CONNECT-01 path
    if (connectRunsSeen !== null) return              // decided, or still hydrating (undefined)
    if (showConnectRuns || showOrientation || showPushOnboarding) return
    void (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return
        setShowConnectRuns(true)
      } catch { /* web — skip */ }
    })()
  }, [plan, connectRunsSeen, showConnectRuns, showOrientation, showPushOnboarding])

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

  // CoachingPrinciples §50 asymmetry (HR-MAX-01) — the GUARDED max HR every
  // client zone computation must use. A stored max below the age estimate is a
  // device floor; resolveMaxHr (the same single owner the engine uses) rejects
  // it in favour of the Tanaka estimate unless the runner confirmed it. Without
  // this, session HR targets and the "your zones" page recompute from the raw
  // floor and run ~15% low, contradicting the plan's own guarded targets.
  const effectiveMaxHR = useMemo<number | null>(() => {
    if (maxHR == null) return null
    const age = birthYear ? new Date().getFullYear() - birthYear : null
    if (age != null && age >= 10 && age <= 100) {
      return resolveMaxHr(maxHR, age, maxHRSource ?? undefined).effectiveMax
    }
    // No age to guard against — trust the plan's already-guarded max, else raw.
    return plan?.meta?.hr_derived_max ?? maxHR
  }, [maxHR, maxHRSource, birthYear, plan])

  // Personalised zone ceiling: Karvonen 70% HRR, falls back to plan meta.
  // Returns null only when no HR data exists AND no plan is present — which
  // is impossible for any user past onboarding. Never returns a hardcoded
  // bpm value: all HR data must derive from user_settings (Apple Health or
  // Tanaka) or plan.meta (set at generation time from the same source).
  // Uses the §50-guarded max, never the raw floor.
  const effectiveZone2Ceiling = useMemo<number | null>(() => {
    if (restingHR && effectiveMaxHR) return Math.round(restingHR + 0.70 * (effectiveMaxHR - restingHR))
    return plan?.meta?.zone2_ceiling ?? null
  }, [restingHR, effectiveMaxHR, plan])

  // HEALTH-SYNC-STALENESS-01 — the most recent arrival PER SOURCE, derived from
  // the activity list already in memory. Device-independent, and no new query:
  // 📱 Wroblewski ruled out `getLastSyncIso()` because localStorage answers
  // "this device" where the question is "this runner".
  const lastArrivalBySource = useMemo(() => {
    const latest: { apple_health: string | null; strava: string | null } = { apple_health: null, strava: null }
    for (const r of stravaRuns ?? []) {
      const src = r?.source === 'strava' ? 'strava' : r?.source === 'apple_health' ? 'apple_health' : null
      if (!src || !r?.start_date) continue
      if (!latest[src] || new Date(r.start_date) > new Date(latest[src]!)) latest[src] = r.start_date
    }
    return latest
  }, [stravaRuns])

  // Aerobic pace derived from Strava runs in user's Z2 HR band
  // Aerobic pace is derived from Strava runs in the user's Z2 band — a
  // network-bound input that can lag behind first paint when Strava is
  // slow (the 2s splash safety timer caps how long we wait). Cache the
  // last computed value in localStorage so subsequent paints have an
  // immediate, stable value while fresh data is fetched.
  const liveAerobicPace = useMemo(() =>
    computeAerobicPace(stravaRuns, restingHR, effectiveMaxHR, preferredUnits),
  [stravaRuns, restingHR, effectiveMaxHR, preferredUnits])

  // POST-RUN-01 / AUTO-MATCH-02: best Strava match for the active session,
  // computed client-side so "Mark complete" can skip the picker. The webhook's
  // silent auto-link path only fires on `high`; the client surface also shows
  // `medium` candidates as a softer "Looks like this one?" CTA so the user
  // isn't left wondering why nothing matched when a plausible run exists.
  // `low` stays hidden — too noisy to surface.
  const activeAutoMatch = useMemo<{ activity: any; confidence: 'high' | 'medium' } | null>(() => {
    if (!activeSessionData || !plan || plan === EMPTY_PLAN) return null
    if (!stravaRuns || !stravaRuns.length) return null
    // LOG-ONE-INTENTION-01 — the SINGLE OWNER answers this now, so Today and
    // the session screen cannot drift. The twelve lines that were here were
    // about to be copied into TodayScreen, which is how a parallel classifier
    // gets born.
    const week = (plan.weeks as any[] | undefined)?.find((w: any) => w.n === activeSessionData.weekN)
    return resolveAutoMatch(activeSessionData, week?.date, activeSessionData.key as string, stravaRuns)
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
  const daysToRace = daysUntilRace(raceDate, now) ?? 0

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
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Wordmark size="md" className="wordmark-splash" />
        </div>

        {/* Voice anchor — NOT the tagline. 🔴 This comment said "Tagline" for
            months over a different locked string (MICRO-LABEL-BRAND-STAMP-01). */}
        <div style={{ ...MICRO_LABELS.eyebrow,
          fontFamily: 'var(--font-ui)',
          color: 'var(--text-muted)',
        }}>
          {BRAND.voiceAnchor}
        </div>
      </div>
    )
  }

  // ⚠️ THE RETIRED WELCOME SCREEN WAS DELETED HERE (`INTERSTITIAL-TITLE-ROLE-01`,
  // 2026-10-02). 41 unreachable lines: `showWelcome` was `useState(false)` and its only
  // `setShowWelcome(true)` had been commented out since the v2 brand migration, so the
  // branch could not be entered. Its `dismissWelcome` handler went with it — the
  // `has_onboarded` write it owned had already moved to the live finalise path
  // (ONBOARDING-FIX Problem A), which is recorded there as the reason the flag never
  // flipped for anyone. **An unreachable branch reads exactly like a live one**, which
  // is `SMOKE-PLUMBING-01` and `QUIT-TAB-DEAD-01` for the third time.

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
        maxHR={effectiveMaxHR}
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
          // CoachingPrinciples §50 (HR-MAX-01) — the device max is the highest
          // *recorded* HR, a floor not a maximum. Tag it 'observed' so the §50
          // asymmetry rejects it when it lands below the age estimate. Only tag
          // when we're actually writing a fresh device value, and never clobber a
          // user_confirmed value the runner already set.
          const writingDeviceMax = maxHR == null && mhr != null && maxHRSource !== 'user_confirmed'
          if (newRhr != null) setRestingHR(newRhr)
          if (newMhr != null) setMaxHR(newMhr)
          if (writingDeviceMax) setMaxHRSource('observed')
          if (newRhr != null || newMhr != null) {
            try {
              const { data: { user } } = await supabase.auth.getUser()
              if (user) {
                await supabase.from('user_settings').upsert({
                  id:         user.id,
                  resting_hr: newRhr ?? undefined,
                  max_hr:     newMhr ?? undefined,
                  ...(writingDeviceMax ? { max_hr_source: 'observed' } : {}),
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
  // 🔴 PTR-SUBPAGE-01 — `screen` IS NOT THE ONLY NAVIGATION AXIS, AND THIS RULE ONLY KNEW
  // ABOUT ONE OF THEM. The comment above has been correct and incomplete since `ME-DOORS-01`
  // introduced doors: a Me sub-page is an `activeSection` INSIDE `MeScreen`, and `screen`
  // stays `'me'` the whole time. So all EIGHT of them inherited the gesture — the founder
  // named four of them in one message: *"Something broken and common questions is still pull
  // down to refresh, so is plan history and plan adjustments."*
  // ⚠️ None of them owns refreshable data, which is exactly what the comment says
  // disqualifies a screen. The rule did not change; the set of screens did.
  const pullToRefreshEnabled =
    appReady && (screen === 'today' || screen === 'plan' || screen === 'coach' ||
                 (screen === 'me' && meActiveSection === 'main'))

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
      // AUTH-BEARER-MISSING-01 — recalibrate-zones calls getUserFromRequest,
      // which needs the bearer explicitly (cookie sync is unreliable on native).
      // authedFetch attaches it; a bare fetch here 401'd every paid recalibration.
      const res = await authedFetch('/api/recalibrate-zones', {
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
     <NavHeightProvider value={bottomNavH}>

      <PullToRefresh
        scrollRef={scrollContainerRef}
        onRefresh={handleRefresh}
        paddingBottom={(bottomNavH ?? 88) + 16}
        disabled={!pullToRefreshEnabled}
      >
        {screen === 'today'    && <TodayScreen plan={plan} weekIndex={currentWeekIndex} daysToRace={daysToRace} raceName={raceName} preferredMetric={preferredMetric} sessionMetricOverrides={sessionMetricOverrides} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} overridesReady={overridesReady} onOpenSession={(s: any) => { setActiveSessionData(s); setSessionOrigin('today'); setScreen('session') }} allCompletions={allCompletions} preferredUnits={preferredUnits} zone2Ceiling={effectiveZone2Ceiling} onManualSaved={refreshCompletions} restingHR={restingHR} maxHR={effectiveMaxHR} aerobicPace={aerobicPace} stravaLoading={stravaLoading} firstName={firstName} pendingAdjustment={pendingAdjustment} readinessData={readinessData} onAdjustmentConfirmed={(p) => { setPlan(p); setPendingAdjustment(null) }} onAdjustmentReverted={(p) => { setPlan(p); setPendingAdjustment(null) }} trialDaysLeft={trialDaysLeft} onUpgrade={() => openUpgrade('today')} hasPaidAccess={hasPaidAccess} attributionRow={
          // Behaviour-triggered by ruling: only once a plan exists. Never for an
          // unknown user — trackEvent would no-op and the tap would be silently
          // lost, which is worse than not asking at all.
          !attributionResolved && userId && plan && plan !== EMPTY_PLAN
            ? <AttributionRow supabase={supabase} userId={userId}
                onResolved={() => setAttributionResolved(true)} />
            : null
        } recalTile={recalDue ? <RecalibrationReadyTile weekN={recalDue.week_n} sessionDay={recalDue.session_day} distanceKm={recalDistanceKm} tier={hasPaidAccess ? 'paid' : 'free'} onEnter={() => { setRecalStatus('idle'); hasPaidAccess ? setScreen('recalibration') : openUpgrade('recal_tile') }} /> : null} dailyCoachNote={dailyCoachNote} coachNoteSettled={coachNoteSettled} runAnalysisMap={runAnalysisMap} runAnalysisReady={runAnalysisReady} onOpenCoach={() => setScreen('coach')} onOpenPostRun={(data) => { setPostRunOrigin('today'); setActivePostRunData(data); setScreen('post-run') }} unreadNotifications={unreadNotifications} onOpenNotifications={() => { setUnreadNotifications(0); setScreen('notifications') }} showRacePrompt={showRacePrompt} pendingReshape={pendingReshape} nextGoalData={nextGoalData} onPickNextGoal={handlePickNextGoal} onDismissNextGoal={handleDismissNextGoal} showMaintCard={showMaintCard} onDismissMaintCard={handleDismissMaintCard} showMaintTransition={showMaintTransition} maintReengagement={inReengagementWindow} maintThemeLine={plan.weeks[currentWeekIndex]?.theme} onSeeMaintPlan={handleSeeMaintenancePlan} onAckMaintTransition={handleAckMaintenanceTransition} onLogRaceResult={() => setShowRaceResultSheet(true)} onReshapeAccepted={(updatedPlan) => { setPlan(updatedPlan); setPendingReshape(null) }} onReshapeDismissed={async () => {
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
        {/* P-02 — the confirm step REPLACES the plan view while it is open.
            Not a modal over it: "no popups; all interactions navigate to full
            screens", and a diff the runner is deciding on is the screen's one
            job while it is up. */}
        {screen === 'plan' && modifyPreview && plan && (
          <div style={{ padding: '16px 0 0' }}>
            <ModifyPlanConfirm
              before={plan}
              after={modifyPreview.next}
              weekIndex={getCurrentWeekIndex(plan.weeks)}
              units={preferredUnits}
              resetsLoggedWeeks={modifyPreview.resets}
              applying={modifyBusy}
              onAccept={() => void acceptModify()}
              /* 🔴 BACK — returns to the sheet WITH THE EDITS INTACT. Before
                 MODIFY-CONFIRM-01 there was no such route: the only exit
                 discarded everything, so changing one of two edits cost both. */
              onBack={() => { setModifyPreview(null); setModifyError(null); setModifyOpen(true) }}
              /* Discard. Now genuinely destructive and nothing else is. */
              onCancel={clearModify}
            />
            {modifyError && (
              <div style={{ padding: '0 20px 20px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--warn)', lineHeight: 1.55 }}>
                {modifyError}
              </div>
            )}
          </div>
        )}
        {screen === 'plan' && modifyOpen && plan && (
          /* 🔴 D1 (founder: "the apply one change doesn't work") — THE ERROR WAS
             RENDERED BEHIND ITS OWN PRECONDITION. `modifyError` and
             `modifyBusy` are read ONLY inside the `modifyPreview` block above,
             and `runModifyPreview` sets the error and RETURNS, leaving
             `modifyPreview` null. So on every failure path — including the
             DESIGNED 422 refusal, which carries a real explanation — the sheet
             sat open and nothing happened. There was no in-flight state either.
             The button did nothing, visibly, exactly as reported.
             New catalogue class: an error surface gated on the state that only
             exists when there is no error. */
          <ModifyPlanSheet
            plan={plan}
            hasPaidAccess={!!hasPaidAccess}
            busy={modifyBusy}
            error={modifyError}
            edits={modifyEdits}
            onEditsChange={setModifyEdits}
            onClose={clearModify}
            onApply={(next, resets) => void runModifyPreview(next, resets)}
            // PLANVERB-01 — the escape out of "adjust" into "start again".
            // Closes the sheet first: leaving it mounted behind the wizard
            // would put two plan-editing surfaces on screen at once.
            onStartNewPlan={() => { clearModify(); setScreen('generate') }}
          />
        )}
        {screen === 'plan' && !modifyPreview && <PlanScreen plan={plan} runAnalysisMap={runAnalysisMap} stravaRuns={stravaRuns ?? []} allOverrides={allOverrides} allCompletions={allCompletions} onOverrideChange={setAllOverrides} onOpenSession={(s: any) => { setActiveSessionData(s); setSessionOrigin('plan'); setScreen('session') }} overridesReady={overridesReady} preferredUnits={preferredUnits} preferredMetric={preferredMetric} sessionMetricOverrides={sessionMetricOverrides} hasPaidAccess={hasPaidAccess} onOpenCoach={() => setScreen('coach')} onOpenModify={canModifyPlan(plan) ? () => setModifyOpen(true) : undefined} />}
        {screen === 'coach'    && (hasPaidAccess
          ? (() => {
              // ADR-013 §22-27: allCompletions and runAnalysisMap are keyed by
              // week.n, NOT array position. On a standalone maintenance plan the
              // array restarts at index 0 but week.n continues (26+), so the old
              // `getCurrentWeekIndex+1` key collided with the archived race plan's
              // week-1 completions (all 'complete') → false 4/4. Derive from week.n.
              // COACH-NULLWEEK-01 (2026-09-11) — `currentWeek` CAN be undefined and
              // this block used to prove it knew: the line below optional-chains
              // it, then the next two dereference it raw.
              //
              // `getCurrentWeek(plan?.weeks ?? [])` returns `past ?? weeks[0]`,
              // which is `undefined ?? undefined` for an EMPTY weeks array — so a
              // plan that loads with no weeks (or a `weeks` key that is not an
              // array) crashes Coach on render with "Cannot read properties of
              // undefined (reading 'sessions')". Reproduced against the real
              // function, not inferred. Coach is the only screen that does this:
              // Today and Plan both take `plan` and guard internally, which is
              // why this presents as a Coach-only crash.
              if (!currentWeek) return <CoachTeaser plan={plan} firstName={firstName} onUpgrade={() => openUpgrade('coach_teaser_empty')} />
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
              // Zone discipline — through the single owner. This was the same
              // formula as TodayScreen's RestraintCard, kept in agreement by a
              // comment saying so; `weeklyZoneAggregate` is the mechanism that
              // comment was standing in for.
              const zoneDisciplinePercent = zoneDiscipline(
                wSessions
                  .filter((s: any) => comps[s.key]?.status === 'complete')
                  .map((s: any) => {
                    const a = runAnalysisMap?.[wn]?.[s.key]
                    if (!a || a.hr_in_zone_pct == null) return null
                    return { inZone: a.hr_in_zone_pct as number, weight: weightOf(a.actual_load_km as number | null) }
                  })
                  .filter((v: any): v is { inZone: number; weight: number } => v !== null),
              ).pct

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
              // Per-zone split — same owner, same weighting, so the number in
              // Kit's sentence and the arc the rings draw can never disagree.
              const zoneTimePctByZone = zoneTimeSplit(zoneHistogramRows).split
              const zoneHistogramHits = zoneHistogramRows.length

              // ANALYSIS-SUPERSEDE-PATTERN-01 (Coaching Board, 2026-10-07) — the
              // detector now READS ACROSS A RACE BOUNDARY, and its logic lives in
              // `lib/coaching/zoneDrift.ts` so the board's two binding conditions
              // can actually be tested.
              //
              // 🔴 WHAT THIS REPLACED, AND WHY LIFTING THE FILTER ALONE WOULD HAVE
              // DONE NOTHING. The old block walked `runAnalysisMap` (superseded_at
              // filtered) and resolved the session type by joining `week_n` against
              // the CURRENT plan's weeks. Measured on the founder: 43 scored runs,
              // 42 hidden by the filter, 1 visible — and his hidden weeks are 15-35
              // against a current plan of 1-12, ZERO OVERLAP. So recovering the rows
              // without `session_type` would drop every one of them at the join: a
              // perfectly inert build.
              //
              // The rows come from `zoneDriftRows`, a separate narrow query; they are
              // deliberately NOT in `runAnalysisMap`, because old plans reuse week
              // numbers and that map is plan-scoped (PLAN-WEEK-COLLISION-01).
              //
              // `session_type` is stamped at write time from 2026-10-07; older rows
              // fall back to the current-plan join, which resolves `null` for a
              // previous block and is correctly EXCLUDED rather than assumed easy.
              const zoneDriftPattern = computeZoneDriftPattern(
                (zoneDriftRows ?? []).map((r: any) => {
                  const legacyType = (plan.weeks.find((w: any) => w.n === r.week_n)
                    ?.sessions as any)?.[r.session_day]?.type ?? null
                  return {
                    weekN:             r.week_n as number,
                    sessionType:       (r.session_type as string | null) ?? legacyType,
                    hrAboveCeilingPct: (r.hr_above_ceiling_pct ?? 0) as number,
                    fromPreviousBlock: r.superseded_at != null,
                    source:            r.source as string | null,
                  }
                }),
              )

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
                  // 🔴 §5b.3 — TWO callers, not one. `onConnect` is used by the Coach
                  // empty-state CTA ("Connect a source") AND by `ZoneRings`. Both used to
                  // land on the Me INDEX, where the connection rows were. They are behind
                  // a door now, so both open it.
                  onConnect={() => { setMeOpenSection('connections'); setScreen('me') }}
                  restingHR={restingHR}
                  maxHR={effectiveMaxHR}
                  healthkitConnectedAt={healthkitConnectedAt}
                />
              )
            })()
          : <CoachTeaser plan={plan} firstName={firstName} onUpgrade={() => openUpgrade('coach_teaser')} />
        )}
        {/* Strava screen: defense-in-depth gate on isAdmin at the render boundary.
            No UI path opens it for non-admins, but the render gate prevents a future commit
            from accidentally exposing admin UI via state mutation or a new entry point. */}
        {screen === 'strava'   && isAdmin && <StravaScreen runs={stravaRuns} loading={stravaLoading} connected={stravaConnected} preferredUnits={preferredUnits} raceName={plan?.meta?.race_name} raceDate={plan?.meta?.race_date} raceDistanceKm={plan?.meta?.race_distance_km} zone2Ceiling={effectiveZone2Ceiling ?? undefined} restingHR={restingHR ?? undefined} maxHR={effectiveMaxHR ?? undefined} />}
        {screen === 'me'       && <MeScreen openSection={meOpenSection} onOpenSectionConsumed={() => setMeOpenSection(null)} tierReason={tierReason} healthkitConnectedAt={healthkitConnectedAt} lastAppleHealthArrival={lastArrivalBySource.apple_health} lastStravaArrival={lastArrivalBySource.strava} stravaConnected={stravaConnected} plan={plan} initials={initials} athlete={plan?.meta?.athlete ?? ''} theme={theme} onThemeChange={() => { /* theme system retired — ADR-008 */ }} preferredUnits={preferredUnits} onUnitsChange={async (u: 'km' | 'mi') => { setPreferredUnits(u); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_units: u, updated_at: new Date().toISOString() }) } catch {} }} preferredMetric={preferredMetric} onMetricChange={async (m: 'distance' | 'duration') => { setPreferredMetric(m); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, preferred_metric: m, updated_at: new Date().toISOString() }) } catch {} }} restingHR={restingHR} maxHR={maxHR} maxHrSource={maxHRSource} birthYear={birthYear} onDeviceHRFound={async (rhr: number | null, mhr: number | null) => {
  // §50 (HR-MAX-01) — device reconnect from Settings. Fill only missing values;
  // tag a fresh device max 'observed' (a floor) so the guard rejects it below the
  // age estimate. Never clobber a user_confirmed value. Display refreshes via
  // effectiveMaxHR from the state set here.
  const newRhr = restingHR != null ? restingHR : rhr
  const newMhr = maxHR     != null ? maxHR     : mhr
  const writingDeviceMax = maxHR == null && mhr != null && maxHRSource !== 'user_confirmed'
  if (newRhr != null) setRestingHR(newRhr)
  if (newMhr != null) setMaxHR(newMhr)
  if (writingDeviceMax) setMaxHRSource('observed')
  if (newRhr != null || newMhr != null) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('user_settings').upsert({
        id: user.id,
        resting_hr: newRhr ?? undefined,
        max_hr: newMhr ?? undefined,
        ...(writingDeviceMax ? { max_hr_source: 'observed' } : {}),
        updated_at: new Date().toISOString(),
      })
    } catch {}
  }
}} firstName={firstName} lastName={lastName} profileEmail={profileEmail} onSaveName={async (name: string) => { setFirstName(name); try { const { data: { user } } = await supabase.auth.getUser(); if (!user) return false; const { error } = await supabase.from('user_settings').upsert({ id: user.id, first_name: name, updated_at: new Date().toISOString() }); if (error) { setFirstName(firstName); return false } return true } catch { setFirstName(firstName); return false } }} onOpenGenerate={() => setScreen('generate')} onOpenBenchmark={() => setScreen('benchmark')} onOpenReshape={() => setScreen('reshape')} onOpenFounderNote={() => setScreen('founder')} onRecheckEntitlement={runEntitlementRecheck} onActiveSectionChange={setMeActiveSection} onOpenZones={(returnTo?: string, editHr?: boolean) => { setZonesReturnSection(returnTo ?? null); setHrSheetOpen(!!editHr); setScreen('zones') }} charityGrantEndsAt={charityGrantEndsAt} onUpgrade={() => openUpgrade('me')} hasPaidAccess={hasPaidAccess} trialDaysLeft={trialDaysLeft} dynamicAdjustmentsEnabled={dynamicAdjustmentsEnabled} onDynamicAdjustmentsChange={async (enabled: boolean) => { setDynamicAdjustmentsEnabled(enabled); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, dynamic_adjustments_enabled: enabled, updated_at: new Date().toISOString() }) } catch {} }} dailyPushEnabled={dailyPushEnabled} onDailyPushEnabledChange={async (enabled: boolean) => { setDailyPushEnabled(enabled); try { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('user_settings').upsert({ id: user.id, daily_push_enabled: enabled, updated_at: new Date().toISOString() }) } catch {} }} lastAdjustmentCheckAt={lastAdjustmentCheckAt} lastAdjustmentCheckFoundChange={lastAdjustmentCheckFoundChange} hasPendingAdjustment={!!pendingAdjustment} recentChanges={recentChanges} />}
        {/* Calendar screen retired per brand-product-alignment v2 */}
        {screen === 'session'  && activeSessionData && <SessionScreen session={activeSessionData} aiNotes={sessionNotesAreAiAuthored(activeSessionData, plan?.meta, plan?.weeks?.find(w => w.n === activeSessionData.weekN))} preloadedRuns={stravaRuns ?? []} onBack={() => setScreen(sessionOrigin)} onSaved={refreshCompletions} preferredUnits={preferredUnits} preferredMetric={preferredMetric} onSessionMetricChange={handleSessionMetricChange} savedMetricOverride={sessionMetricOverrides[`${activeSessionData.weekN}_${activeSessionData.key}`] ?? null} zone2Ceiling={effectiveZone2Ceiling ?? undefined} restingHR={restingHR} maxHR={effectiveMaxHR} aerobicPace={aerobicPace} stravaLoading={stravaLoading} runAnalysis={(activeSessionData?.weekN != null ? runAnalysisMap[activeSessionData.weekN]?.[activeSessionData?.key ?? ''] : null) ?? null} driftContext={buildDriftContext(plan, runAnalysisMap, activeSessionData?.weekN, activeSessionData?.key)} hasPaidAccess={hasPaidAccess} onUpgrade={() => openUpgrade('session')} onOpenCoach={() => setScreen('coach')} goalPace={(plan?.meta as any)?.goal_pace_per_km ?? null} guidance={guidanceMap.get(activeSessionData?.type ?? '') ?? null} nextSession={activeNextSession} onLinkedComplete={(data) => { setPostRunOrigin('session'); setActivePostRunData(data); setScreen('post-run') }} autoMatch={activeAutoMatch} />}
        {screen === 'post-run' && activePostRunData && <PostRunScreen data={activePostRunData} onBack={() => { setActivePostRunData(null); setScreen(postRunOrigin === 'session' && activeSessionData ? 'session' : 'today') }} onDone={() => {
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
        {screen === 'generate' && <GeneratePlanScreen preferredUnits={preferredUnits} charityCohort={charityCohort} onBack={() => setScreen(plan && plan !== EMPTY_PLAN ? 'me' : 'today')} firstName={firstName} lastName={lastName} restingHR={restingHR} maxHR={maxHR} maxHrSource={maxHRSource} birthYear={birthYear} onBirthYearSave={async (y) => { setBirthYear(y); if (userId) await supabase.from('user_settings').update({ birth_year: y, date_of_birth: null }).eq('id', userId) }} onPlanSaved={handlePlanSaved} onPlanEnriched={handlePlanEnriched} isOnboarding={!plan || plan === EMPTY_PLAN} hasExistingPlan={!!(plan && plan !== EMPTY_PLAN)} hasPaidAccess={hasPaidAccess} onUpgrade={() => openUpgrade('wizard')} onRecheckEntitlement={runEntitlementRecheck} />}
        {screen === 'upgrade'  && <UpgradeScreen source={upgradeSource} trialExpired={trialExpired} grantExpired={hadCharityGrant && !hasPaidAccess} onRecheckEntitlement={runEntitlementRecheck} onBack={() => {
          // Legacy key name — preserved to avoid wiping active user state. Future: migrate via key translation layer.
          const hasWizardDraft = typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('zona_wizard_draft')
          setScreen(hasWizardDraft ? 'generate' : 'today')
        }} />}
        {screen === 'benchmark' && plan && <BenchmarkUpdateScreen plan={plan} units={preferredUnits} stravaConnected={stravaConnected} onBack={() => setScreen('me')} onUpdated={(updatedPlan) => { setPlan(updatedPlan) }} />}
        {screen === 'recalibration' && <RecalibrationEntryScreen distanceKm={recalDistanceKm} status={recalStatus} onBack={() => { setRecalStatus('idle'); setScreen('today') }} onConfirm={handleRecalConfirm} />}
        {screen === 'reshape'   && <ReshapeScreen plan={plan} onBack={() => { setMeOpenSection('plan-adjustments'); setScreen('me') }} onReshapeApplied={(updatedPlan) => { setPlan(updatedPlan); setPendingAdjustment(null); setScreen('today') }} onChecked={(foundChange) => { setLastAdjustmentCheckAt(new Date().toISOString()); setLastAdjustmentCheckFoundChange(foundChange) }} onOpenBenchmark={() => setScreen('benchmark')} preferredUnits={preferredUnits} />}
        {screen === 'founder'   && <FounderNoteScreen onBack={() => setScreen('me')} />}
        {/* ZONES-SURFACE-01 — a full screen, never a sheet (no-popups rule), entered from
            Me. 🔴 NOT from Coach: `screen-architecture.md` puts "Profile or settings" in
            Coach's does-not-belong column, and Coach is PAID while this content is FREE —
            linking it there would strand free runners from their own zones.

            ⚠️ The PaceGuide is rebuilt by calling the ENGINE'S OWN PRODUCER with the
            engine's own recorded inputs (`meta.vdot_training_anchor`, `meta.vdot`), never
            by re-deriving bands from VDOT fractions here — `ruleEngine.ts` records that as
            "the second-copy-that-drifts class this repo has recorded FIVE times".
            Measured: `meta.vdot` is present on 10 of 21 stored plans, so `pace` is null
            for roughly half of runners and the screen shows HR only. */}
        {screen === 'zones' && (() => {
          const meta = plan?.meta as { vdot?: number; vdot_training_anchor?: number } | undefined
          const raw = meta?.vdot
          const anchor = meta?.vdot_training_anchor ?? raw
          const pace: PaceGuide | null =
            typeof raw === 'number' && typeof anchor === 'number' ? buildPaceFromVDOT(anchor, raw) : null
          const hrZones = restingHR && maxHR ? calculateZones(restingHR, maxHR) : null
          return (
            <>
              {/* ⚠️ BACK GOES WHERE YOU CAME FROM. Two entries since ME-DOORS-01: the `Zones`
                  row on the index, and the `heart-rate` door. A single hardcoded `'me'`
                  is correct for one of them and loses the runner's place in the other. */}
              {/* BACK-ARROW-TITLE-COLLIDE-01 am.1 — the arrow travels INSIDE the band.
                  Rendered beside it, the opaque `--bg` header covered it on scroll and the
                  screen had a title and no way back. */}
              {/* ZONES-TAB-PIN-01 — Design Board 2026-10-01, SHIP WITH AMENDMENT.
                  THE TABS PIN WITH THE HEADER GROUP. A runner three zones down the
                  list could not switch between Heart rate and Pace without scrolling
                  back to the top, which loses the position they were comparing from.
                  🔴 Settled ground, not a new pattern: `BACK-ARROW-FLOAT-03` ruled
                  that a header GROUP pins and carries its cue, after floating the
                  arrow alone let the wizard's progress cue scroll away. Silvanto: the
                  control is what the screen is FOR; "Your zones" is only its label.
                  ⚠️ AMENDMENT: the sub-line STAYS until the band is measured on a
                  device. It is the stated height lever if the group reads too tall —
                  removing runner-facing copy on an unmeasured impression is the trap
                  this board records. Nothing has run on a device. */}
              <ScreenHeader title="Your zones" sub="Heart rate and pace targets"
                onBack={() => { setMeOpenSection(zonesReturnSection); setScreen('me') }}>
                <ZonesTabs tab={zonesTab} onTabChange={setZonesTab}
                  hasHr={!!hrZones && hrZones.length > 0} hasPace={!!pace} />
              </ScreenHeader>
              <TrainingZonesScreen zones={hrZones} pace={pace} units={preferredUnits}
                tab={zonesTab} onTabChange={setZonesTab}
                sourceHr={restingHR && maxHR ? { resting: restingHR, max: maxHR } : null}
                // ZONES-INPUTS-01 — the FORM stays on Me. This only navigates there,
                // because the HR card is a set-once input and carries the Apple Health
                // prefill, which is a connection action and belongs with `Connections`.
                // 🔴 ME-DOORS-01 BROKE THIS AND IT FAILED SILENTLY. This used to
                // `scrollIntoView` the HR card's anchor on Me. The card is now behind the
                // `heart-rate` door, so `getElementById` returned null and the chevron did
                // NOTHING — a control shipped the day before, whose test asserts it RENDERS
                // and could not assert it GOES anywhere. A relocation makes correct code
                // wrong without touching it.
                // 🔴 ZONES-HR-SHEET-01 — THIS USED TO LEAVE THE SCREEN, AND IT IS THE
                // THIRD TIME THIS ONE CONTROL HAS MOVED. It did
                // `setMeOpenSection('heart-rate'); setScreen('me')`: one tap out, TWO taps
                // back, and the runner lost the table they were reading. Before that it
                // called `getElementById(...).scrollIntoView()` at an element that had gone
                // behind a door, returned null, and DID NOTHING for a day. Now it opens the
                // form over the table it changes, which is the only arrangement where cause
                // and effect are in one field of view (Sierra).
                onEditHr={() => setHrSheetOpen(true)}
              />
              {/* ZONES-HR-SHEET-01 — the form's ONLY mount. Founder: *"it should be from
                  within zones."* A sheet, not a popup: `Sheet` is the app's one slide-up
                  primitive and this authors no new surface. It closes on save, so the
                  runner is handed the UPDATED table with nothing over it. */}
              {hrSheetOpen && (
                <HrCalibrationSheet
                  onClose={() => setHrSheetOpen(false)}
                  restingHR={restingHR}
                  maxHR={maxHR}
                  maxHrSource={maxHRSource}
                  birthYear={birthYear}
                  onSave={handleHrSave}
                  hrZoneMethod={(plan?.meta as any)?.hr_zone_method ?? null}
                  hrAssumptionNote={(plan?.meta as any)?.hr_assumption_note ?? null}
                />
              )}
            </>
          )
        })()}
        {/* GTM-CHARITY-04 — full screen, never a modal (no-popups rule). */}
        {screen === 'redeem'    && <RedeemCodeScreen onBack={() => setScreen(redeemReturnTo)} onRedeemed={(expiresAt: string | null) => { setHasPaidAccess(true); setTrialExpired(false); setTrialDaysLeft(null); setHadCharityGrant(true); setCharityGrantEndsAt(expiresAt) }} />}
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
              await upsertCompletion(supabase, {
        week_n: missedSessionPrompt.weekN,
                session_day: completionKey,
                status: 'skipped',
                // FIRSTRUN-MISSED-01 — the reason is NOT a fatigue level. It
                // used to go into fatigue_tag, where no fatigue consumer could
                // match it AND it occupied a slot in the five-entry fatigue
                // trend whose last three drive `heavyFatigue`. Measured in
                // production: 13 of 83 tagged rows were reasons, and two users
                // had all three of their last-three slots taken by them, making
                // their high-fatigue trigger unreachable.
                skip_reason: reason,
              })
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

        // UX-REDEEM-01 — the redeem screen is a FULL SCREEN, so it replaces the
        // tab bar rather than floating above it.
        //
        // Reported from a real device: "Got a code page (it has the nav bar at
        // the bottom)". `RedeemCodeScreen` has its own back arrow and owns the
        // whole viewport, but the tab bar stayed mounted underneath — so a
        // runner mid-redemption could tap away to Today/Plan/Coach and lose the
        // flow, on the one screen standing between them and free access.
        //
        // `ui-patterns.md` is explicit and this was neither of its two shapes:
        // a full screen replaces the tab bar; a slide-up sheet keeps a MIRRORED
        // nav at the bottom. It has a back arrow, so it is the former.
        if (screen === 'redeem') return null

        // 🔴 THE GEOMETRY LIVES IN THE CLASS, AND IT DID NOT FOR ONE RELEASE.
        // `NAV-FLOAT-01` added `.nav-bar--floating` and left the flush bar's
        // inline `bottom: 0` / `width: '100%'` / `maxWidth` in place. **An
        // inline style beats a class**, so the pill shipped full-width and
        // flush with only its border-radius applying — a slab with round
        // corners. Measured on the founder's device: gap below **0.9pt**
        // against a declared 12, side inset **0.9pt** against 16.
        //
        // ⚠️ Only `position` and `zIndex` stay here: `position` because the
        // class is shared with the GuideSheet mirror, which is NOT fixed, and
        // `zIndex` because it comes from the `Z_LAYERS` owner. Everything
        // with a value in `globals.css` was removed, or the class is
        // decoration.
        return (
          <div ref={bottomNavRef}
            className={`nav-bar nav-bar--floating${navReceded ? ' nav-bar--receded' : ''}`}
            style={{
            position: 'fixed',
            zIndex: Z_LAYERS.nav,
          }}>
            {NAV_ITEMS.map(({ id, label, icon }) => (
              <NavTab
                key={id}
                label={label}
                icon={icon(screen === id)}
                active={screen === id}
                onClick={() => {
                  scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
                  setScreen(id)
                  setShowMore(false)
                  const seen = getSeenGuides()
                  if (!seen.has(id)) setGuideScreen(id)
                }}
              />
            ))}
          </div>
        )
      })()}
     </NavHeightProvider>
    </div>
  )
}

/**
 * NAV-SLIM-01 — the nav's SINGLE SOURCE OF TRUTH.
 *
 * 🔴 There were two renderers in this file and they had drifted. The real bar
 * lists today/plan/coach/**me**; `GuideSheet`'s mirror listed
 * today/plan/coach/**strava** — a tab removed from the nav in Phase 1
 * (`CLAUDE.md`: *"Strava — Admin-only via URL, nav entry removed"*). So a sheet
 * whose entire job is showing a runner WHERE a screen lives drew a nav that had
 * not existed for months, and its `screen === id` test highlighted nothing when
 * the guide fired for Me.
 *
 * ⚠️ Editing the string would have fixed today's symptom and left the mechanism.
 * The marketing site's two replicas already had the right tabs AND the right
 * 60px height, so the divergence was app-internal: two hand-maintained lists.
 */
const NAV_ITEMS: { id: Screen; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: (a) => <IconToday active={a} /> },
  { id: 'plan',  label: 'Plan',  icon: (a) => <IconPlan  active={a} /> },
  { id: 'coach', label: 'Coach', icon: (a) => <IconCoach active={a} /> },
  { id: 'me',    label: 'Me',    icon: (a) => <IconMe    active={a} /> },
]

// ── ORIENTATION SCREEN ────────────────────────────────────────────────────



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
  // ONBOARD-SKIP-LABEL-01 — the pending action, NOT a bare boolean. The primary
  // button's label must key on WHICH action is running, or tapping "Connect
  // later" (skip) makes the primary button claim it is "Connecting…".
  const [pending, setPending] = useState<'connect' | 'skip' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function connectHealthKit() {
    if (pending) return
    setPending('connect')
    setError(null)
    try {
      const { requestHealthKitAuth, syncOnAppOpen, fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
      const granted = await requestHealthKitAuth()
      if (!granted) {
        // Denial / unavailable / framework not linked — Capacitor doesn't
        // distinguish in the return value. Calm one-liner, Zona voice.
        setError('Apple Health said no. Enable in iOS Settings → Health, or connect later.')
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
      setPending(null)
    }
  }

  async function skip() {
    if (pending) return
    setPending('skip')
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
      setPending(null)
    }
  }

  return (
    <div style={{
      // Own scroll context — see OrientationScreen note. Early-return screens
      // sit outside the dashboard's inner scroll container, and the body is
      // locked (overflow:hidden; position:fixed), so this must scroll itself or
      // the primary CTA can clip off-screen on shorter devices.
      height: '100dvh', overflowY: 'auto',
        overscrollBehavior: 'contain', // SCROLL-NATIVE-01 — bounce locally, never chain
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'safe center',
      background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
      padding: '32px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Wordmark size="md" />
      </div>
      <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-7)' }}>
        {BRAND.voiceAnchor}
      </div>

      <div style={{ width: '100%', maxWidth: '340px' }}>
        {/* The ask — single sentence, BRAND-sourced. */}
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.25, marginBottom: 'var(--space-3)' }}>
          {BRAND.connect.ask}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          {BRAND.connect.subline}
        </div>

        {/* Primary CTA — Apple Health.
            When Strava is approved, add a second equal-weight button BELOW this
            one with the same visual treatment (moss fill, full width). Do not
            change the ask copy above. */}
        <Button variant="primary" fullWidth
          onClick={connectHealthKit} busy={pending !== null} style={{ minHeight: '52px', borderRadius: '12px', letterSpacing: '-0.01em' }}>
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
          {pending === 'connect' ? 'Connecting…' : 'Connect Apple Health'}
        </Button>

        {error && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--warn)', lineHeight: 1.55, marginTop: 'var(--space-3)' }}>
            {error}
          </div>
        )}

        {/* CONSENT-DISCLOSURE-01 (SLT 2026-09-20) — ONE HONEST LINE, AT THE
            DECISION POINT. Not a consent screen: Wood used the kill mandate on
            that version, because a granular screen at onboarding is ceremony,
            clicked through in two seconds. This is the moment with a real
            consequence the runner can feel.

            ⚠️ iOS's own HealthKit sheet does NOT cover this. That permission is
            device-to-app; the app-to-Anthropic transfer is the undisclosed leg
            and no OS prompt mentions it.

            ⚠️ Deliberately NOT here: a GPS-routes toggle (ADR-011 — we cannot
            collect routes at all, and a toggle for data we cannot get is a lie
            on a privacy surface) and a usage-analytics toggle (one analytics
            event exists in the product, and gating it would throttle the
            instrumentation GTM-CHARITY-06 needs).

            ✅ SLT 2026-09-20 — THE SENTENCE WAS CUT AND ONLY THE LINK REMAINS.
            Four seats, three independent reasons. Sutherland: standing at a door
            marked *Health data* and volunteering "we never send your name to the
            AI" introduces two concepts nobody asked about at the moment they are
            deciding to hand over their heart rate. Fried: the policy is one tap
            away and says all of it properly; a line at the decision point should
            describe the decision, not pre-empt the FAQ. Traynor: he cannot cost
            it — no code redeemed, no analytics event on this screen — and the
            cheaper mistake is the shorter screen.
            ⚠️ **Do NOT swap it for a line naming injury history.** Explicitly
            rejected: same conversation, more alarming words. */}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.55, marginTop: 'var(--space-4)', maxWidth: '340px' }}>
          {/* ⚠️ ExternalLink, not <a>. Caught by `externalLink.test.ts`: inside
              the Capacitor webview a bare href to a marketing page REPLACES the
              app and the runner has no way back. SFSafariViewController has its
              own Done button. */}
          <ExternalLink href="/privacy" style={{ color: 'var(--mute)', textDecoration: 'underline' }}>
            What we share
          </ExternalLink>
        </div>

        {/* D5: always-visible exit. Design system requires a visible "no thanks"
            path (a CTA without one is a dark pattern) and ux-principles bars dead
            ends. This is also the Apple-5.1.1 compliant direction — the guideline
            requires that the user CAN proceed without granting, not that the skip
            be hidden. Previously gated behind permissionAsked, so the first frame
            looked exit-less until the user had already tapped Connect. */}
        <Button variant="ghost" 
          onClick={skip}
          disabled={pending !== null} style={{ width: '100%', padding: '14px 0', marginTop: 'var(--space-2)', minHeight: '44px', fontSize: '13px', textDecoration: 'underline', textUnderlineOffset: '3px', cursor: pending ? 'default' : 'pointer' }}>
          {pending === 'skip' ? 'One sec…' : 'Connect later'}
        </Button>

        {/* ONBOARD-EXIT-01 — was a hand-rolled copy of this button, and it had
            already DRIFTED: it never called `clearWidgetState()`, so signing out
            here left the previous account's race countdown on the home-screen
            widget. A user at this screen HAS a plan, so that was reachable.
            One owner now; the drift cannot recur. */}
        <SignOutLink disabled={pending !== null} />
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
  // ONBOARD-SKIP-LABEL-01 — the pending action, not a bare boolean (see
  // ConnectRunsScreen). Tapping "Skip for now" must not make the primary button
  // say "Setting up…".
  const [pending, setPending] = useState<'enable' | 'skip' | null>(null)
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
    if (pending) return
    setPending('enable')
    setError(null)
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      const perm = await PushNotifications.requestPermissions()
      if (perm.receive !== 'granted') {
        // iOS denied — stamp false so the screen doesn't reappear.
        // User needs Settings → {BRAND.name} → Notifications to reverse this.
        await stampFlag(false)
        setDenied(true)
        setPending(null)
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
      setError(`Couldn't set up notifications. Skip for now; try from Me later.`)
    } finally {
      setPending(null)
    }
  }

  async function skip() {
    if (pending) return
    setPending('skip')
    try {
      await stampFlag(false)
      onSkip()
    } finally {
      setPending(null)
    }
  }

  return (
    <div style={{
      height: '100dvh', overflowY: 'auto',
        overscrollBehavior: 'contain', // SCROLL-NATIVE-01 — bounce locally, never chain
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'safe center',
      background: 'var(--bg)', maxWidth: '480px', margin: '0 auto',
      padding: '32px 24px calc(32px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Wordmark size="md" />
      </div>
      <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-7)' }}>
        {BRAND.voiceAnchor}
      </div>

      <div style={{ width: '100%', maxWidth: '340px' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.4px', lineHeight: 1.25, marginBottom: 'var(--space-3)' }}>
          {BRAND.notify.ask}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
          {denied
            ? `Notifications are blocked. Go to Settings → ${BRAND.name} → Notifications to enable them.`
            : BRAND.notify.subline}
        </div>

        {!denied && (
          <Button variant="primary" fullWidth
            onClick={enableNotifications}
            disabled={pending !== null} style={{ minHeight: '52px', borderRadius: '12px', letterSpacing: '-0.01em' }}>
            {/* Bell icon — same roundel pattern as ConnectRunsScreen */}
            <span style={{
              width: '24px', height: '24px', borderRadius: '7px',
              background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontSize: '13px',
            }}>
              🔔
            </span>
            {pending === 'enable' ? 'Setting up…' : 'Enable Notifications'}
          </Button>
        )}

        {error && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--warn)', lineHeight: 1.55, marginTop: 'var(--space-3)' }}>
            {error}
          </div>
        )}

        <Button variant="ghost" 
          onClick={skip}
          disabled={pending !== null} style={{ width: '100%', padding: '14px 0', marginTop: denied ? '0' : '8px', minHeight: '44px', fontSize: '13px', textDecoration: 'underline', textUnderlineOffset: '3px', cursor: pending ? 'default' : 'pointer' }}>
          {pending === 'skip' ? 'One sec…' : denied ? 'Continue without notifications.' : "Skip for now."}
        </Button>

        {/* ONBOARD-EXIT-01 — last screen of the onboarding gate, still in front
            of the nav. Secondary to "Skip for now", not part of the flow. */}
        <SignOutLink disabled={pending !== null} />
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
  if (diffMs < 7 * 86400000) return formatDate(d, 'weekday-only') ?? ''
  return formatDate(d, 'short') ?? ''
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

  // BACK-ARROW-FLOAT-04 — the arrow supplies its own inset, so it leaves the padded div.
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
      <ScreenHeader title="Notifications" onBack={onBack} />

      {items === null ? (
        // Loading — static skeleton rows matching the row shape (no spinner).
        <div aria-busy="true" style={{ padding: '8px 16px 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              background: 'var(--card)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
              padding: '13px 16px 14px 18px', minHeight: '64px',
            }}>
              <div style={{ width: '38%', height: '9px', borderRadius: '3px', background: 'var(--bg-soft)', marginBottom: 'var(--space-3)' }} />
              <div style={{ width: '70%', height: '11px', borderRadius: '3px', background: 'var(--bg-soft)', marginBottom: 'var(--space-2)' }} />
              <div style={{ width: '90%', height: '10px', borderRadius: '3px', background: 'var(--bg-soft)' }} />
            </div>
          ))}
        </div>
      ) : (today.length + earlier.length) === 0 ? (
        // Empty state — Pattern 8, Zonna voice.
        <div style={{ padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--space-2)' }}>
            Nothing from Kit yet.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.5, maxWidth: '260px', margin: '0 auto' }}>
            Coaching notes, plan changes, and your weekly review land here.
          </div>
        </div>
      ) : (
        <div style={{ paddingBottom: 'var(--space-5)' }}>
          {today.length > 0 && (
            <>
              <SectionLabel>Today</SectionLabel>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {today.map(renderRow)}
              </div>
            </>
          )}
          {earlier.length > 0 && (
            <>
              <SectionLabel>Earlier</SectionLabel>
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {earlier.map(renderRow)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ScreenHeader moved to `components/ui/ScreenHeader.tsx` (SCREEN-HEADER-01).
// It was PRIVATE to this file, which is why `components/marketing/TabbedPhone`
// hand-copied it for the website's phone stills — and why `realComponents.test.ts`,
// whose entire remedy is "import the real component", could not fire on it.

// ── Section label ─────────────────────────────────────────────────────────

// ✅ MICRO-LABEL-DRIFT-01 — the local function is gone. It lived here, unimportable, for
// long enough that `PlanCalendar` wrote its own at different values. Now
// `components/shared/SectionLabel.tsx`, imported above; the 8 call sites are unchanged.

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
  const dayLabel = DAY_LABELS[day] ?? day

  return (
    <Sheet onClose={onDismiss} ariaLabel="Missed session">
      {(close) => (
      <div style={{ padding: '6px 20px 24px' }}>

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
          {SKIP_REASONS.map(reason => (
            <Button variant="secondary" 
              key={reason}
              onClick={() => onSkip(reason)}>
              {reason}
            </Button>
          ))}
        </div>

        {/* I actually did it */}
        <Button variant="primary" fullWidth
          onClick={onDidIt} style={{ marginBottom: 8 }}>
          I actually ran it →
        </Button>

        {/* 🔴 FIRSTRUN-MARATHON-01 — the DISMISS BUTTON IS GONE (Design Board
            re-sitting, 2026-10-05). 📱 Wroblewski: six controls on the screen
            where someone has just missed a run. `Sheet` already carries its own
            close, so this was a second way to do the one thing the sheet does by
            default — `LOG-ONE-INTENTION-01`'s class, one intention one control.
            Five now: four reasons and the escape.

            ⚠️ AND NO SHIFT IS CLAIMED HERE, DELIBERATELY. The board's first
            ruling led this sheet with the locked line "Plan's been shifted."
            Measured: this sheet renders BEFORE anything shifts, `/api/adjust-plan`
            fires AFTER the runner answers and is `void authedFetch` (fire and
            forget), and for `'Too tired'` it is absorbed and NEVER fires. There is
            no moment here at which that sentence is true.
            The shift is announced where it actually happens, by surfaces that
            already exist and already gate on a real adjustment: the pending
            banner on Today, and "Changed this week" in Plan adjustments. */}
      </div>
      )}
    </Sheet>
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

  return (
    <>
      {/* Scrim */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: Z_LAYERS.guide,
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
        zIndex: Z_LAYERS.guide + 1,
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
            color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: 'var(--space-3)',
          }}>
            {content.title}
          </div>
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '13px', lineHeight: 1.7,
            color: 'var(--text-muted)', marginBottom: 'var(--space-5)',
          }}>
            {content.body}
          </div>
          <Button variant="secondary" fullWidth
            onClick={dismiss}
             style={{ marginBottom: 'var(--space-4)' }}>
            Got it
          </Button>
        </div>

        {/* Mirrored nav bar — a PICTURE of the real nav, from the same source.
            It listed `strava` (retired in Phase 1) and omitted `me`, so it
            taught a nav that no longer existed. NavTab with no `onClick`
            renders inert and aria-hidden: a mirror is not a control. */}
        <div className="nav-bar nav-bar--floating">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <NavTab key={id} label={label} icon={icon(screen === id)} active={screen === id} />
          ))}
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





// Session voice lines live in lib/coaching/voiceLines.ts (HOOK-01).
// Same job as Today's hero ("10km, slowly.") — Zonna voice in the moment.

// ── COACHING FLAG ─────────────────────────────────────────────────────────
// getCoachingFlag imported from lib/coaching/coachingFlag.ts

// ── SESSION POPUP ─────────────────────────────────────────────────────────




// ── DATE STRIP ────────────────────────────────────────────────────────────








const FATIGUE_COLORS: Record<string, string> = {
  Fresh:  'var(--session-green)',
  Fine:   'var(--accent)',
  Normal: 'var(--accent)',
  Heavy:  'var(--amber)',
  Wrecked:'var(--coral)',
  Cooked: 'var(--coral)',
}





// ── MANUAL RUN MODAL ─────────────────────────────────────────────────────



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





// ── UTILITIES ─────────────────────────────────────────────────────────────





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





// computeAerobicPace imported from lib/coaching/aerobicPace.ts

// ── REST DAY CARD ─────────────────────────────────────────────────────────





// ── CALENDAR OVERLAY ──────────────────────────────────────────────────────
// Moved to CalendarOverlay.tsx — imported at top of file.
// To re-expose in the UI: add 'calendar' entry point back to TodayScreen header
// and pass onOpenCalendar prop through DateStrip.

// CalendarOverlay moved to CalendarOverlay.tsx — imported at top of file.

// ── TODAY SCREEN ──────────────────────────────────────────────────────────

// ── ADJUSTMENT BANNER ────────────────────────────────────────────────────







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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
      {/* BACK-ARROW-TITLE-COLLIDE-01 am.1 — arrow, eyebrow and title pin as ONE group.
          The earlier diagnosis (a `flexShrink: 0` header beside a body whose `overflowY:
          auto` can never overflow) still stands; the remedy moved on. */}
      <PinnedBackHeader onClick={onBack} padding="16px 20px 0">
        <div style={{ paddingTop: 'var(--space-4)' }}>
        <div style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)', marginBottom: 'var(--space-2)' }}>
          Plan adjustment
        </div>
        {/* SUBPAGE-TYPE-SCALE-01 — the documented screen-title role, from its owner.
            It HAND-COPIED these exact values: right value, wrong mechanism. */}
        <div className="screen-header__title" style={{ marginBottom: 'var(--space-2)' }}>
          Reshape plan
        </div>
        {/* SUBPAGE-TYPE-SCALE-01 — the documented screen-SUBTITLE role, from its owner. */}
        <div className="screen-header__sub" style={{ marginBottom: 'var(--space-6)' }}>
          {status === 'loading' ? 'Checking your recent sessions for adjustment signals.' : `Here's what ${BRAND.name} found.`}
        </div>
        </div>
      </PinnedBackHeader>

      <div style={{ flex: 1, padding: '0 20px 24px' }}>
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
              <Button variant="primary" fullWidth
                onClick={onOpenBenchmark} style={{ marginTop: 'var(--space-3)' }}>
                Update benchmark →
              </Button>
            )}
          </>
        )}

        {status === 'clean' && (
          <div style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', borderRadius: '14px', border: '1px solid var(--line)', padding: '20px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--moss-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 'var(--space-3)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l3.5 3.5L13 5" stroke="var(--moss)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--space-2)' }}>
              Plan looks good.
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
              No adjustment signals in your recent sessions. Keep going.
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ background: 'var(--warn-bg)', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--warn)', marginBottom: 'var(--space-2)' }}>
              Something went wrong.
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coach-ink)', lineHeight: 1.55, marginBottom: 'var(--space-4)' }}>
              {error}
            </div>
            <Button variant="ghost"  onClick={() => void analyse()} style={{ padding: '8px 16px', borderRadius: '8px', background: 'none', color: 'var(--warn-strong)', fontSize: '13px' }}>
              Try again
            </Button>
          </div>
        )}
      </div>

      {(status === 'clean' || status === 'error') && (
        <div style={{ flexShrink: 0, padding: '12px 20px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--line)', background: 'var(--bg)' }}>
          {/* S2 — dismiss is never the CTA colour. */}
          <Button variant="secondary" fullWidth  onClick={onBack}>
            Back
          </Button>
        </div>
      )}
    </div>
  )
}



// ── PLAN SCREEN ───────────────────────────────────────────────────────────

// ── PLAN PROGRESS BAR ─────────────────────────────────────────────────────

// P-10 (2026-09-20) — `PlanProgressBar` DELETED, not fixed.
//
// It rendered "0 of N sessions complete · 0%" on a cold start: it guarded
// `totalSessions === 0` but not `doneSessions === 0`, which is the zero-state
// defect the teardown found on a competitor's screens. It also had **zero
// render sites**, and had for its whole life.
//
// ⚠️ DELETED RATHER THAN CORRECTED, and the distinction was called in the
// filing for a reason: fixing it would have put a NON-EXISTENT BUG into a
// build and left 45 lines of unreachable code behind, now carrying a test and
// a changelog entry implying someone relies on it. The zero-state work that
// matters is in the two live holes (the web connect prompt, and actually
// looking at day one), not in reviving this.

function PlanScreen({ plan, stravaRuns, allOverrides, allCompletions, onOverrideChange, onOpenSession, overridesReady, runAnalysisMap = {}, onOpenModify, preferredUnits = 'km', preferredMetric = 'distance', sessionMetricOverrides = {}, hasPaidAccess = false, onOpenCoach }: {
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
  /** P-02 — opens the modify sheet. `undefined` when the plan predates
   *  `meta.generator_input` (45% of live plans on 2026-09-20): the entry point
   *  is withheld rather than offering an edit the engine cannot honour from
   *  guessed inputs. */
  onOpenModify?: () => void
  /** P-04 — nested runAnalysisMap[week_n][session_day]. Already fetched on this
   *  client for the Coach screen; the Plan screen never received it, which is
   *  why the one question this product is built on was answerable only there. */
  runAnalysisMap?: Record<number, Record<string, { hr_above_ceiling_pct?: number | null }>>
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

  // ── P-04 — this week's zone outcomes, one entry per COMPLETED run ────────
  //
  // ⚠️ Keyed by `weekNum` (week.n), never by array position. ADR-013: on a
  // standalone maintenance plan the array restarts at 0 while week.n continues
  // at 26+, and `allCompletions` / `runAnalysisMap` are both keyed by week.n.
  // Using the ordinal here would read another plan's week, which is the
  // PLAN-WEEK-COLLISION-01 shape.
  //
  // ⚠️ A completed run with no analysis row is `unknown`, NOT a failure. That
  // is the Coaching Board's second ruling and the reason the denominator is
  // measured runs rather than completed ones: "none of 4 held the zone" when
  // two had no heart rate is a false statement, and it is the one a free-tier
  // runner would see most.
  const zoneOutcomesThisWeek = useMemo<RunZoneOutcome[]>(() => {
    const comps    = allCompletions[weekNum] ?? {}
    const analysed = runAnalysisMap[weekNum] ?? {}
    return Object.entries(comps)
      .filter(([, c]: [string, any]) => c?.status === 'complete')
      .map(([day]) => classifyRun(analysed[day]?.hr_above_ceiling_pct))
  }, [allCompletions, runAnalysisMap, weekNum])
  const raceName = (plan as any)?.meta?.race_name ?? ''
  const raceDate = (plan as any)?.meta?.race_date ? new Date((plan as any).meta.race_date) : null
  const raceDateStr = raceDate ? formatDate(raceDate, 'medium') : null
  const daysToRace = daysUntilRace(raceDate)

  // Derive done weeks count and deload week numbers from plan
  const doneWeeksCount = (() => {
    let count = 0
    for (let i = 0; i < currentWeekIndex; i++) count++
    return count
  })()
  // PLAN-ARC-V2: the arc no longer takes `deloadWeeks`. Height encodes a
  // recovery week as the short bar it is, and a second opacity encoding
  // would only make the notch fainter. `deloadWeekNumbers` fed nothing else,
  // so it went with the prop rather than sitting here unread.
  const arcSeries = planArcSeries(plan.weeks)
  const raceWeekNumber = (() => {
    // Goal race = LAST race-flagged week (mid-plan 'race_event' tune-ups also
    // carry a 'race' badge; findIndex would mark the tune-up on the plan arc).
    const idx = plan.weeks.findLastIndex((wk) => (wk as any).type === 'race' || (wk as any).badge === 'race')
    return idx >= 0 ? idx + 1 : undefined
  })()

  // PLAN-ARC-V2: the arc names the phases on its own rail, at the widths
  // they actually occupy, so the joined "base → build → peak → taper" chain
  // is gone. It never fitted — measured, it truncated to
  // "16 WEEKS · BASE → BUILD → PEAK → …" in 5 of 5 plans at 320px.
  // `phaseDisplayLabel` keeps the ADR-013 maintenance mapping this chain
  // used to own, so a raw "maintenance_restoration" still cannot leak.

  // Race Projections sheet — tapping the Plan Arc opens this (screen-architecture.md)

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
    <div style={{ paddingBottom: 'var(--space-6)' }}>

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <ScreenHeader title="Your plan" sticky />

      {/* ── THE RACE, ONCE ───────────────────────────────────────────────
          A3 (Design Board, sitting three): the race appeared TWICE on this
          screen — as this heading, and again under the arc as
          `{raceName} · {N} days to go`. One statement of the goal: its name,
          its date, and how far away it is, in the app's one countdown
          vocabulary (S5, `formatRaceCountdown` in lib/format.ts).

          ⚠️ The countdown lives HERE and not under the arc on purpose. The arc
          is the shape of the training; the countdown is a property of the
          RACE, and attaching it to the arc is what made the race read twice. */}
      {(raceName || raceDateStr) && (
        <div style={{ padding: inMaintenance ? '0 16px 2px' : '0 16px 12px' }}>
          {raceName && (
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.2 }}>
              {raceName}
            </div>
          )}
          {raceDateStr && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '3px', lineHeight: 1.4 }}>
              {raceDateStr}
              {daysToRace !== null && daysToRace > 0 ? ` · ${formatRaceCountdown(daysToRace, { suffix: 'out' })}` : daysToRace === 0 ? ' · Race day' : ''}
            </div>
          )}
        </div>
      )}
      {/* #3b — when the athlete is inside the post-race maintenance block, the
          screen must stop reading as active race prep. A recovery-green eyebrow
          under the race title names the chapter; the per-week accents + seam
          in PlanCalendar carry it through the week list. Rule-engine → no AIMark. */}
      {inMaintenance && (
        <div style={{ ...MICRO_LABELS.eyebrow, padding: '0 16px 12px', fontFamily: 'var(--font-ui)', color: 'var(--s-recov)' }}>
          Maintenance
        </div>
      )}

      {/* ── PLAN ARC ────────────────────────────────────────────────────
          No longer tappable. Race Projections moved to Coach on 2026-09-12
          (UX-COACH-01, SLT): the card's own header has always called Coach its
          canonical home, and "how am I tracking toward my race goal?" is
          Coach's subject, not a shortcut hidden behind a progress bar on the
          diary screen. screen-architecture.md updated in the same commit so the
          doc and the code agree. ── */}
      {/* Inset to the screen's 16px content margin — PlanArc is a full-width
          component, and every other block on this screen is inset 16px. Rendered
          flush to the edges it read as "the progress runs off the page" and sat
          misaligned under the (inset) race title. */}
      <div style={{ padding: '0 16px' }}>
        <PlanArc
          totalWeeks={totalWeeks}
          currentWeek={weekOrdinal}
          doneWeeks={doneWeeksCount}
          weekKm={arcSeries.km}
          weekPhase={arcSeries.phase.map(phaseDisplayLabel)}
          raceWeek={raceWeekNumber}
        />
      </div>

      {/* ══ A2 — PLAN LEADS WITH THE PLAN (Design Board, sitting three) ══════
          Measured before the ruling: FIVE cards stood between the header and
          the first week, on a screen called Plan — zone compliance, change
          your plan, the plan intro, the rationale notes and the week-voice
          card. The weeks are the screen's job (screen-architecture.md § Plan:
          "own the training arc"), and they were the sixth thing on it.

          NOTHING IS CUT. The order changes: the race, the arc, then the weeks,
          then everything that explains them. "Change your plan" is kept FIRST
          of the blocks below so the screen's one action is the next thing
          after the calendar rather than the last thing on the page. ══════ */}
      {/* ── PLAN CALENDAR ────────────────────────────────────────────────
           ⚠️ This comment used to say "keeps drag-reorder". There has never
           been any drag code in the component — no pointer handlers, no
           `draggable`, nothing. The claim was false for as long as it existed
           and was found while building MOVE-PROTOTYPE-01, which is the first
           drag this component has ever had (and is off by default). ── */}
      {/* ── R-4 (Design Board, five-screen review) — ONE ACTION ROW EARNS
          THE SPACE ABOVE THE WEEKS. ────────────────────────────────────────
          A2 ruled what should LEAD this screen (race → arc → weeks) and
          shipped this row FIRST BELOW the calendar. R-4 amends it: A2 never
          asked which single thing below the fold is not furniture. The weeks
          are long — on an 18-week plan the runner scrolls past every one of
          them before meeting the only control on the screen that changes any
          of it.

          ⚠️ This is an AMENDMENT, not a reversal. A2's ordering claim (race,
          then arc, then weeks, then everything that explains them) is intact;
          the action moves from "first of the explainers" to "last of the
          headers", which is the one position A2 did not consider. */}
      {/* ── P-02 — the way in. ─────────────────────────────────────────────
          Before this there was NO surface on which a runner could change a
          plan parameter: the only route was re-running the fourteen-screen
          wizard, which archives the existing plan.

          ⚠️ Withheld entirely when `onOpenModify` is undefined, which is a
          plan with no stored `generator_input` (45% of live plans on
          2026-09-20). Offering an edit we would have to regenerate from
          GUESSED inputs would silently change things the runner never asked
          to change. A row that cannot work is worse than no row. */}
      {onOpenModify && (
        // ⚠️ THE TOP GAP IS DECLARED, NOT INHERITED (APP-SPACE-01). This wrapper
        // carried a bottom margin and NO top margin, so the only thing between
        // the arc and this tile was `PlanArc`'s own trailing 6px — the founder
        // read it as "too close" and he was reading an ABSENT DECISION, not a
        // small one. `design-rulings.md` § 332: *"a gap of zero is not a gap,
        // it is an absent decision … a spacing audit finds wrong values and is
        // structurally blind to missing ones."* Sweeping alone could not have
        // fixed this.
        <div style={{ padding: '0 16px', marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
          {/* ACTION-ROW-01 — the shared pattern, with the affordance. This was a
              hand-rolled card with NO chevron, on a screen where every session
              row beside it has one. The cause was structural: the chevron was a
              local `const` inside the Me screen, so it could not travel here. */}
          <ActionRow
            onClick={onOpenModify}
            title="Adjust your plan"
            subtitle="Days, time limits, injuries or the race date. Without starting again."
          />
          </div>
        </div>
      )}

      <div style={{ paddingTop: 'var(--space-3)' }}>
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

      {/* ── P-04: ZONE COMPLIANCE, THE ONE INTENSITY METRIC ON THIS SCREEN ──
          The teardown's finding: a competitor's plan screen shows distance
          covered, total distance, current pace, race-day pace and projected
          finish. Every metric is volume or speed and there is no intensity
          metric anywhere, in an app whose own marketing argues runners go too
          fast. Ours had none either, so "am I actually holding the zone?" was
          answerable only on Coach.

          Placed directly under the arc, above the rationale: it is meant to be
          glanceable. ⚠️ It deliberately does NOT settle
          `PLAN-NOTE-PLACEMENT-01` (whether the rationale belongs at the top at
          all) — that is a separate SLT question and bundling it would answer it
          by accident. */}
      <div style={{ padding: '0 16px', marginBottom: 'var(--space-4)' }}>
        <ZoneWeekBlock outcomes={zoneOutcomesThisWeek} locked={!hasPaidAccess} />
      </div>

      {/* ── PLAN INTRO — CA-01 free first-plan "why this plan" (Kit's voice) ──
          Plan-level intro generated once on a free user's first plan. The one
          AI surface a free user gets; carries CoachByline provenance. Persists
          in meta.plan_intro, so it survives save/reload. Only set for free
          first-plans — paid plans carry coach_intro instead and never this. */}
      {plan.meta.plan_intro && (
        <div style={{ padding: '16px 16px 0' }}>
          <PlanIntroCard text={convertDistanceString(plan.meta.plan_intro, preferredUnits) ?? plan.meta.plan_intro} />
        </div>
      )}

      {/* ── WHY THIS PLAN — rule-engine plan rationale (PLAN-NOTE-SURFACE-01) ──
          The engine's honest notes about WHY the plan is shaped this way
          (why maintenance, a volume/long-run shortfall, your assessed level,
          off-road effort, a conditional hard-session preference, and the level
          decisions it made). These are RULE-ENGINE output → rendered WITHOUT the
          AIMark/CoachByline (provenance honesty, unlike the AI plan_intro above).
          Ordered, labelled and capped by the single owner planRationaleNotes();
          nothing renders when the plan carries none. */}
      {(() => {
        const rationale = planRationaleNotes(plan.meta, preferredUnits)
        if (rationale.length === 0) return null
        return (
          <div style={{ padding: '16px 16px 0' }}>
            <SectionLabel>Why this plan</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              {rationale.map((n, i) => (
                <CoachNoteBlock key={i} label={n.label} variant="why">
                  {n.text}
                </CoachNoteBlock>
              ))}
            </div>
          </div>
        )
      })()}

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
              background: 'var(--card)', boxShadow: 'var(--shadow-card)',
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
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  {showByline ? (
                    <CoachByline
                      color="moss"
                      role="This week"
                      working={isLoading}
                      onClick={onOpenCoach}
                    />
                  ) : (
                    <span style={{
                      fontFamily: 'var(--font-ui)',
                      ...MICRO_LABELS.eyebrow,
                      color: 'var(--mute)',
                    }}>This week</span>
                  )}
                  {phaseCap && (
                    <span style={{
                      marginLeft: 'auto',
                      fontFamily: 'var(--font-ui)',
                      ...MICRO_LABELS.eyebrow,
                      color: 'var(--moss)',
                    }}>{phaseCap}</span>
                  )}
                </div>
                {isLoading ? (
                  <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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


    </div>
  )
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

  // SESSION-DIST-UNITS-01 — km with a unit suffix, unconverted.
  const doneDisplay = trackedKm != null && trackedKm > 0
    ? `${formatDistance(trackedKm, units, { exact: true }) ?? ''} done`
    : null

  return (
    <div style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <span style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)' }}>Week notes</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)', opacity: 0.6 }}>· Your training plan</span>
        {phaseCap && (
          <span style={{ ...MICRO_LABELS.eyebrow, marginLeft: 'auto', fontFamily: 'var(--font-ui)', color: 'var(--moss)' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
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
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
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
    // OPS-ARTIFACT-REACH-01 — measured before this shipped: only TWO users can
    // see this button at all, and nothing recorded whether it had ever been
    // pressed. Fired BEFORE the platform sheet, so a sheet that never opens is
    // still visible as an attempt with no result.
    const sb = createClient()
    const uid = await currentUserId(sb)
    trackEvent(sb, uid, 'share_week_pressed', { week_n: weekN })
    try {
      const { shareWeeklyZoneCard } = await import('@/lib/share/shareWeeklyZoneCard')
      await shareWeeklyZoneCard({
        weekN,
        onStatus: (s) => {
          if (s.kind === 'downloaded')  setStatus('Downloaded')
          else if (s.kind === 'cancelled') setStatus(null)
          else if (s.kind === 'success')   setStatus(null)
          else if (s.kind === 'error')     setStatus(s.message || 'Share failed')
          // `cancelled` is NOT a failure and must stay separable: a dismissed
          // share sheet and a broken share lead to opposite conclusions.
          trackEvent(sb, uid, 'share_week_result', { outcome: s.kind, week_n: weekN })
        },
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="primary" fullWidth
      onClick={onShare}
      disabled={busy}>
      {status ?? (busy ? 'Preparing…' : 'Share')}
    </Button>
  )
}





function CoachScreen({ plan, currentWeek, runs, stravaLoading, stravaConnected, stravaTokenFailed, firstName, weeklyReport, onReportGenerated, preferredUnits = 'km', zoneDisciplinePercent, zoneTimePctByZone, zoneHistogramHits, liveSessionsCompleted, liveSessionsPlanned, liveSessionsDueToDate, phaseSummary, onPhaseSummaryGenerated, raceReadinessNote, onRaceReadinessGenerated, zoneDriftPattern, zoneDriftDismissedAt, onDismissZoneDrift, benchmarkRecalDismissedAt, onDismissRecal, onOpenBenchmark, runAnalysisReady = true, onConnect, restingHR, maxHR, healthkitConnectedAt }: {
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
  /** ANALYSIS-SUPERSEDE-PATTERN-01 — `crossesBlockBoundary` is McMillan's BINDING
   *  condition: a comparison that reaches into a finished block says so. */
  zoneDriftPattern?: { count: number; total: number; crossesBlockBoundary?: boolean } | null
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
  /** Navigate to where a runner connects a run source (Profile). Shown in the
   *  ZoneRings empty state when nothing is linked. */
  onConnect?: () => void
  /** X-FIRSTRUN: pre-data state detection. The empty Kit read selects copy +
   *  CTA based on which signal is missing (source / runs / HR). */
  restingHR?: number | null
  maxHR?: number | null
  healthkitConnectedAt?: string | null
}) {
  // P-10 / GAP-04 — platform drives the no-source copy: on web there is no
  // route to Apple Health at all, so telling the runner to connect one is an
  // instruction with no button behind it.
  const isNative = useIsNative()
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
  // On a race week the zone-discipline % and load-ratio spike by design — a race
  // is run at race effort, not by holding easy zones. The verdict copy on those
  // two tiles must NOT scold ("ran too hot" / "overloading") on this week.
  const isRaceWeek = (currentWeek as any)?.type === 'race'

  // ── R28 / R29 detection ─────────────────────────────────────────────────
  const daysToRace = daysUntilRace(plan.meta.race_date) ?? -1
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
  // OPS-ARTIFACT-REACH-01 — did either shipped restraint artifact get REACHED?
  //
  // 🔴 MEASURED BEFORE BUILDING: only TWO users can see the share button (it needs a
  // CURRENT weekly report carrying a zone_discipline_score), and `analytics_events`
  // held exactly ONE event type, so "are we making the most of LEDGER-01 / SHARE-01"
  // was unanswerable. The SLT declined to touch their UX or marketing until these
  // two events exist.
  //
  // ⚠️ `weekly_report_open` REPLACES wiring `weekly_reports.opened_at`, which EXISTS
  // AND IS WRITTEN BY NOTHING. A dead column nearly got quoted as "0 reports opened"
  // — a column nothing writes is not a measurement.
  useTrackOnce('weekly_report_open', !!weeklyReport?.headline,
    { week_n: weeklyReport?.week_n ?? null })
  // `ledger_view` lives INSIDE `LedgerCard` (LEDGER-REACH-01), not here.
  // ⚠️ "both render surfaces" was true until LEDGER-COACH-SITE-REMOVE-01 (2026-10-05)
  // killed the Coach one. There is ONE surface now and the event still carries it,
  // because `surface` stays a REQUIRED prop: a default is how the next second surface
  // would ship mislabelled, which is the whole reason the event moved into the card.

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

  // ── Load ratio context ──────────────────────────────────────────────────
  // UX-COACH-01 polish (2026-09-13) — plain language, not telemetry. The number
  // is the same; the verdict reads as Kit, not a readout ("overloading" →
  // "above your recent normal"). Colour still carries the severity. Single
  // owner: both the tile sub-line and the load-ratio sheet use this label.
  function loadRatioContext(ratio: number | null): { label: string; color: string } {
    if (ratio === null) return { label: '—', color: 'var(--mute)' }
    if (ratio >= LOAD_RATIO.watch) return { label: 'above your recent normal', color: 'var(--danger)' }
    if (ratio < LOAD_RATIO.under) return { label: 'under your recent normal', color: 'var(--warn)' }
    return { label: 'right on your normal', color: 'var(--moss)' }
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
    // COACH-BEHIND-DAY-TWO-01 / §65 Amendment (Coaching Board 2026-09-22) —
    // A SINGLE OUTSTANDING SESSION IS NEVER A JUDGEMENT.
    //
    // The 0.7 softener above cannot fire below four sessions due, and `dueRef`
    // never exceeds the week's planned sessions — so for a THREE-DAY-A-WEEK
    // runner it could never fire at all, in any week, at any point in any
    // plan. 29.0% of the cohort grid. They miss one Tuesday and read amber,
    // every time, forever. §65's date arithmetic was right and its purpose was
    // not. Seiler's CD-21 Am.1 is the precedent: at small n a ratio is not
    // violated, it is undefined.
    //
    // Additive: `done: 0, dueRef: 3` is still a real verdict, and a runner 2 of
    // 7 behind is still softened by the ratio above. Only the single-session
    // case changes, and it states the fact without the judgement.
    if (behind < BEHIND_VERDICT_MIN_SESSIONS) {
      return { label: `${behind} still to do`, color: 'var(--mute)' }
    }
    return { label: `${behind} behind`, color: 'var(--warn)' }
  }

  // ── Weeks to race context ───────────────────────────────────────────────

  const lrc  = loadRatioContext(loadRatio)
  const sc   = sessionsContext(sessionsCompleted, sessionsPlanned, liveSessionsDueToDate ?? null)

  const [loadSheetOpen, setLoadSheetOpen] = useState(false)
  const [zoneDisciplineSheetOpen, setZoneDisciplineSheetOpen] = useState(false)

  // ── R25 Cut #3: Easy-run trend card ────────────────────────────────────
  // Same pattern as the long-run aerobic trend (AI-DEPTH-03) below.
  // Only renders when live — no pending/skeleton clutter (long run card covers that).
  // UX-COACH-01 (2026-09-12) — the easy-run trend is now the SINGLE trend card
  // on Coach, so it carries the full state machine the long-run card used to
  // own. It was live-only by design ("no pending/skeleton to avoid clutter —
  // the long-run card above already handles the 'not enough data' state"), and
  // that card has been retired, so those states move here rather than
  // disappearing. Week 1 has to say something; that was Traynor's condition.
  // One owner for what this card is CALLED, because it has to be identical
  // across four render paths (skeleton, live, pending, and the sheet each of
  // them opens) and they drifted the moment it was written out four times.
  const EASY_TREND_LABELS = { label: 'Easy run trend', sessionLabel: 'easy run' } as const

  const [easyTrendData, setEasyTrendData] = useState<{
    state: 'live'
    earlierMonth: string; earlierHr: number; nowHr: number
    cohortSize: number; windowMonths: number; gloss?: string
    // TREND-PACE-CLAIM-01 — the cohort matches on DISTANCE only, so pace is
    // free to move inside it. Without these two the card (and Kit) claimed
    // "at the same pace" and could not possibly know.
    earlierPace: number | null; nowPace: number | null
    // The whole series, not just its endpoints. This fetch used to read
    // buckets[0] and buckets[last] and throw the middle away, so the card
    // could state the change and never show its shape.
    series: SparkBucket[]
  } | { state: 'pending' } | null>(null)
  const [easyTrendLoading, setEasyTrendLoading] = useState(true)
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
      // Each exit below RESOLVES the state. A bare `return` here is what makes
      // a skeleton shimmer forever — the bug the long-run card's comment named.
      if (!easyDistances.length) { setEasyTrendData({ state: 'pending' }); setEasyTrendLoading(false); return }
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
        if (!res.ok) { setEasyTrendData({ state: 'pending' }); return }
        const data = await res.json()
        const trend = data.trend
        if (!trend?.hrIsTrending) { setEasyTrendData({ state: 'pending' }); return }
        const first = trend.buckets[0]
        const last  = trend.buckets[trend.buckets.length - 1]
        const cohortSize = trend.buckets.reduce((s: number, b: any) => s + b.cohortSize, 0)
        // `?? 0` here was the `distance_km ?? 0` family: a bucket with no
        // usable HR would have rendered as "0 (Apr avg) → 146 (now)" and Kit
        // would have narrated a 146-bpm collapse in aerobic fitness. A missing
        // endpoint means there is no trend to draw, not a trend from zero.
        if (first.avgHr == null || last.avgHr == null) {
          setEasyTrendData({ state: 'pending' }); return
        }
        setEasyTrendData({
          state:        'live',
          earlierMonth: first.shortLabel,
          earlierHr:    first.avgHr,
          nowHr:        last.avgHr,
          cohortSize,
          windowMonths: trend.windowMonths,
          gloss:        data.gloss,
          earlierPace:  first.avgPaceSecPerKm ?? null,
          nowPace:      last.avgPaceSecPerKm  ?? null,
          series:       trend.buckets.map((bk: any) => ({
            monthKey:   bk.monthKey,
            shortLabel: bk.shortLabel,
            avgHr:      bk.avgHr ?? null,
          })),
        })
      } catch {
        // A failed fetch is "not enough data to claim a trend", not a spinner.
        setEasyTrendData({ state: 'pending' })
      } finally {
        setEasyTrendLoading(false)
      }
    }
    void fetchEasyTrend()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fire once on CoachScreen mount

  // ── AI-DEPTH-03 long-run trend: RETIRED 2026-09-12 (UX-COACH-01) ─────
  // Coach rendered two near-identical TrendCards; the founder cut to one and
  // the easy-run trend survived (it is what the hero line and Kit's sentence
  // are about). This fetch went with the card rather than lingering to feed a
  // fallback sentence — it carried an AI gloss call (~500ms, Haiku, per load)
  // and the easy-run trend already covers that sentence. Dead fetches that
  // cost money are worse than dead code.

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
        const daysLine = daysToRace === 0 ? 'Race day.' : `Race in ${formatRaceCountdown(daysToRace)}.`
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
          body.push(zoneDriftLine(zoneDriftPattern as any))
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
        // The voice clause stays; the SENTENCE is the owner's (it now names a
        // crossed block boundary, which it could not before).
        body.push(`${zoneDriftLine(zoneDriftPattern as any)} If easy isn't easy, hard can't be hard.`)
      }
      // Trend fold — when the trend engine returned a live state with a gloss
      // (i.e. hrIsTrending), surface as a templated sentence in Kit's voice.
      // The TrendCard below shows the numbers; this is the interpretation.
      //
      // 🔴 DIRECTION-AWARE SINCE 2026-09-12 (UX-COACH-01 regression case).
      // This sentence was hardcoded to improvement — "Easy is easier than it
      // was — X DOWN TO Y" — but its only guard is `gloss`, and the gloss is
      // produced whenever `hrIsTrending`, which is
      // `Math.abs(hrDeltaBpm) >= MIN_HR_DELTA_BPM`. ABSOLUTE VALUE: it fires in
      // BOTH directions. So a runner whose easy HR had risen 4+ bpm was told
      // "Easy is easier than it was — 147 down to 152" — a claim contradicted
      // by the two numbers inside the same sentence. Same family as the
      // "stepped volume up from 32 to 32 km" defect.
      //
      // The board made the regression case binding for this screen (McMillan:
      // a surface that can only speak when the arrow is up is marketing). This
      // is that case, and it was a live false statement rather than silence.
      //
      // 🔴 AND IT WAS NAMING THE WRONG SESSION TYPE. This read "Easy is easier
      // than it was" while being fed `trendCardData`, which fetches
      // `session_type: 'long'` — while a card labelled "Easy run trend" renders
      // directly below from `easyTrendData` (`session_type: 'easy'`), a
      // different cohort with different numbers. Kit made a claim about easy
      // running from long-run data, beside a card of the same name showing
      // something else.
      //
      // Prefer the easy-run trend: it is what the hero line is about ("your
      // easy days are creeping up") and it agrees with the card that shares its
      // name. Fall back to the long-run trend, which then SAYS long run.
      // Only the easy-run trend now — the long-run fetch was retired with its
      // card. One source, and it is the one the hero line is about.
      if (easyTrendData?.state === 'live') {
        body.push(trendSentence({
          earlierHr:    easyTrendData.earlierHr,
          nowHr:        easyTrendData.nowHr,
          earlierMonth: easyTrendData.earlierMonth,
          // Without these the sentence claims fitness from a heart rate that
          // may simply reflect an easier week. TREND-PACE-CLAIM-01.
          earlierPace:  easyTrendData.earlierPace,
          nowPace:      easyTrendData.nowPace,
        }))
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
      // ── P-10 / GAP-04 (2026-09-20) — THE WEB RUNNER HAD NO ROUTE ─────────
      //
      // This told EVERY user to "Connect Apple Health or Strava" and offered a
      // "Connect a source" button. On web both halves are false: Apple Health
      // is an iOS-only Capacitor plugin, and `CONNECT-FIRST` plus `CONNECT-01`
      // both `return` early off-native, so a web runner was instructed to do
      // something with no route to doing it.
      //
      // ⚠️ THE HONEST LINE, NOT A PROMPT. The filing offered both options; a
      // prompt is only correct if the action exists, and for a web runner it
      // does not. Naming the constraint is the option that does not send
      // someone looking for a button that was never rendered.
      //
      // ⚠️ IT DOES NOT MENTION STRAVA. The Strava application is currently
      // Inactive at Strava's end (`STRAVA-APP-INACTIVE-01`, founder action),
      // so naming it as a web route would be the second false instruction on
      // the same screen.
      //
      // ⚠️ THE FLASH RULE (see useIsNative). `useIsNative` starts `false`, so native renders as
      // web for one frame. The web sentence is therefore the SAFE default: an
      // iOS runner may briefly see the app mentioned, which is harmless, where
      // the reverse would hide the only route from the person who has it.
      emptyHeadline = "Nothing to coach from yet."
      emptyBody     = isNative
        ? 'Connect Apple Health so I can see your runs. I keep quiet until I have something honest to say.'
        : 'Your runs come from Apple Health, which needs the iOS app. I keep quiet until I have something honest to say.'
      emptyCta      = isNative && onConnect ? { label: 'Connect a source', onClick: onConnect } : null
    } else if (!hasRuns) {
      emptyHeadline = "Waiting on your first run."
      emptyBody     = "Go log a session, even an easy one. Once I see a run with heart rate, I can say something useful."
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
      <ScreenHeader title="Your coach" sub={`W${weekNum} of ${totalWeeks}`} sticky />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-6)' }}>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            {consolidatedRead.hasAiContent ? (
              <CoachByline working={consolidatedRead.isLoading} color="moss" role="This week" />
            ) : (
              // 🔴 COACHBYLINE-EMPTY-VARIANT-01 — this was 17 hand-rolled lines
              // reproducing the avatar, the name and the eyebrow, because the component
              // always stamped `<AIMark />` and an empty line is hand-authored (Pattern
              // 16 provenance honesty). The REASON was right and it survives: `empty`
              // suppresses the whole provenance badge and dims the unit. The component
              // owns its own empty state now.
              <CoachByline empty color="moss" role="This week" />
            )}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', fontVariantNumeric: 'tabular-nums' }}>
              W{weekNum}/{totalWeeks}
            </span>
          </div>

          {stravaTokenFailed && !stravaLoading && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-2)', opacity: 0.7 }}>
                Strava connection expired. Reconnect in Profile.
              </span>
            </div>
          )}

          {consolidatedRead.isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {[85, 100, 70].map((w, i) => (
                <div key={i} style={{ height: '13px', background: 'var(--moss-soft)', borderRadius: '4px', width: `${w}%` }} />
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
            <div style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--danger)', opacity: 0.85 }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            {refreshBlocked && (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', display: 'block', width: '100%', marginBottom: '4px' }}>
                Already refreshed today.
              </span>
            )}
            {consolidatedRead.cta ? (
              // X-FIRSTRUN: pre-data primary action takes over the button slot.
              // No "Generate report" until there's data to generate from — the
              // empty state teaches the one next action that unblocks coaching.
              <Button variant="primary"
                onClick={consolidatedRead.cta.onClick}>
                {consolidatedRead.cta.label} →
              </Button>
            ) : (
              <Button variant="soft"
                onClick={generateReport} busy={loading || refreshBlocked}>
                {loading && <AIMark size={10} color="var(--moss)" working />}
                {loading ? 'Generating' : (reportIsCurrent && weeklyReport?.headline ? 'Refresh' : 'Generate report')}
              </Button>
            )}
            {reportIsCurrent && weeklyReport?.zone_discipline_score != null && (
              <ShareWeekButton weekN={weeklyReport.week_n} />
            )}
          </div>

          {/* ── THE WEEK, PICTURED — one card with the read, not a second one.
              UX-COACH-01 (boards 2026-09-12), corrected 2026-09-12 after the
              founder looked at the shipped screen: "the zone and lots narrative
              appear to be separate". They were. The rings had been MOVED under
              the read and the pairing written into a comment, but ZoneRings still
              drew its own card, so the DOM said two boxes while the design note
              said one. `chromeless` drops the rings' shell and this card owns it.

              Why it has to be one card: Kit's sentence and this mark are the same
              fact in two registers, word and image. "Nine per cent of your week sat
              in Zone 3" directly above rings showing Z3 at nine per cent. Both come
              from ONE owner (`weeklyZoneAggregate`), so they cannot disagree about
              the number; they should not disagree about being one thought either.

              A hairline rule, not a gap: inside a card a rule separates without
              severing, which is the whole point. ── */}
          <div style={{ height: '1px', background: 'var(--line)', margin: '18px 0 16px' }} />

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
              // Tappable HERE only. The 2×2 grid's "Zone discipline" tile used
              // to own this sheet; the rings say the same thing better and sit
              // directly under the sentence that claims it, so the sheet moves
              // to what it explains. ZoneRings itself is untouched — the
              // marketing homepage renders it bare and must stay inert.
              <Button variant="ghost" 
                type="button"
                onClick={() => setZoneDisciplineSheetOpen(true)}
                aria-label="What counts as in-zone. Opens an explanation." style={{ width: '100%', padding: 0, textAlign: 'inherit', background: 'none', font: 'inherit' }}>
                <ZoneRings
                  chromeless
                  pctByZone={zoneTimePctByZone}
                  meta={`across ${zoneHistogramHits} ${zoneHistogramHits === 1 ? 'run' : 'runs'}`}
                />
              </Button>
            )
          }
          // Genuine loading — the analysis fetch hasn't returned on first paint.
          if (!runAnalysisReady) {
            return <ZoneRingsSkeleton chromeless />
          }
          // Ready, but no zone histogram for this week's runs. Honest resting
          // state — NOT a perpetual shimmer (the old bug). Prompt to connect a
          // source if there isn't one; otherwise explain zones need a heart-rate
          // run (covers manual logs, HR-less runs, and links that never analysed).
          return (
            <ZoneRings
              chromeless
              state="empty"
              // DS-03: reason is now based on whether we have any runs (source-agnostic),
              // not whether Strava is specifically connected. HealthKit runs populate
              // the same `runs` array, so 'not-linked' correctly means "no data at all".
              // 🔴 D5 (founder, app review) — THE REASON READ THE WRONG THING.
              // `runs?.length ? 'no-data' : 'not-linked'` derives "is a source
              // linked?" from **whether any runs exist**. A runner who HAS
              // connected Health and simply has no run yet this week — week 1,
              // Monday missed, 0 of 4 — was told "Allow health access →" for a
              // permission they had already granted.
              //
              // Catalogue class: a checker reading a different source from the
              // producer. `healthkitConnectedAt` was already a prop on this
              // screen and says exactly what the reason needs to know.
              reason={(healthkitConnectedAt || stravaConnected) ? 'no-data' : 'not-linked'}
              onConnect={onConnect}
            />
          )
        })()}
        </div>

        {/* ── THE ARC — where I was · where I am · the goal I chose ─────
            UX-COACH-01, both boards 2026-09-12. §109: this surface may REMEMBER
            and COMPARE; it may not predict. `baselineSeconds` is the plan-start
            estimate, `currentSeconds` is measured fitness with its confidence,
            and the goal is the runner's OWN `target_time`. No projected
            race-day finish, no rising line toward a date — §44.1's
            fabricated-precision doctrine.

            ⚠️ THIS COMMENT WAS A LIE FOR SIX HOURS. The first cut of
            UX-COACH-01 moved the card to this screen and wrote this block, and
            changed NOTHING inside the component: it went on rendering one
            number and a delta chip, `baselineSeconds` arrived in the payload
            and was drawn by nothing, and `meta.target_time` was never read by
            the route at all. The founder found it by looking at the live screen.
            Built for real 2026-09-12 — `lib/coaching/raceProgressArc.ts`
            (pure, unit-tested), `components/shared/RaceProgressArcRow.tsx`
            (renderable without auth at `/coach-preview`, which is the whole
            reason the gap survived review: nobody could SEE it).

            ⚠️ THIS IS THE COMPONENT'S OWN DOCUMENTED HOME. Its header has read
            "Coach screen (variant='status') — canonical home" since it was
            written, while it rendered inside a sheet on PlanScreen. Sutherland,
            on the founder's "where I was, I am, and what the potential is":
            it was filed next to a list of appointments.

            🔴 AND IT WAKES R32. The recalibration nudge renders only on
            `variant="status"`, and Plan passed `onDismissRecal={undefined}` +
            `benchmarkRecalDismissedAt={undefined}`, so it has been DORMANT
            EVERYWHERE. The working handlers were already plumbed to this screen
            (`onDismissRecal={dismissBenchmarkRecal}`) and destructured here
            unused — dead props waiting for the card that was documented to
            live beside them. ── */}
        <RaceTimesCard
          variant="status"
          stravaConnected={stravaConnected}
          benchmarkRecalDismissedAt={benchmarkRecalDismissedAt}
          onOpenBenchmark={onOpenBenchmark}
          onDismissRecal={onDismissRecal}
        />

        {/* ── SUPPORTING FACTS — UX-COACH-01 (boards 2026-09-12) ───────
            Was a 2×2 grid of four tiles. Now two, and both earn their place:

            · "Zone discipline" REMOVED — the ZoneRings directly above say the
              same thing better, and its explanation sheet moved onto them. A
              tile and a picture of the same number, stacked, is what made this
              screen read as a dashboard rather than a coach.
            · "Phase / Weeks left" REMOVED — `ScreenHeader` already renders
              `W{weekNum} of {totalWeeks}` at the top of THIS screen. It was
              duplicated two blocks apart.

            Numbers still follow the read: the read is the hero, these are the
            evidence, and there are two pieces of it now instead of four. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          {([
            {
              // ── A5 — SHAPE, NEVER SCORE (Design Board, app review) ────────
              // This read `1.15x` at 28px/800 with its meaning demoted to an
              // 11px sub-line and the explanation behind a tap. Sierra: *a
              // number that has to be tapped to mean anything has taught nobody
              // anything.* The VERDICT is the hero now, the shape shows where
              // the week sits against the runner's normal, and the ratio is
              // evidence underneath rather than the headline.
              //
              // ⚠️ The Sessions tile beside it deliberately KEEPS its number:
              // "3/5" means something without a tap, which is exactly the test.
              // One tile changing and one not is a distinction, not a drift.
              label: 'This week\u2019s load',
              value: isRaceWeek ? 'Race week' : loadRatio !== null ? lrc.label : 'Not enough runs yet',
              valueColor: isRaceWeek ? 'var(--ink)' : loadRatio !== null ? lrc.color : 'var(--mute)',
              shape: <LoadShape ratio={loadRatio} color={isRaceWeek ? 'var(--ink-2)' : lrc.color} />,
              sub: isRaceWeek
                ? 'A spike is the point'
                : loadRatio !== null ? `${loadRatio.toFixed(2)}\u00d7 your recent average` : 'Log a few runs',
              subColor: 'var(--mute)',
              onTap: () => setLoadSheetOpen(true),
            },
            {
              label: 'Sessions',
              value: sessionsCompleted !== null && sessionsPlanned !== null ? `${sessionsCompleted}/${sessionsPlanned}` : '\u2014',
              valueColor: 'var(--ink)',
              shape: null,
              sub: sc.label,
              subColor: sc.color,
              onTap: undefined,
            },
          ] as const).map((m) => {
            const inner = (
              <>
                <div className="label-uppercase" style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {m.label}
                  {m.onTap && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)' }}>ⓘ</span>}
                </div>
                {/* A5 — a tile whose value is a VERDICT is set in words, not in
                    the 28px tabular-numeral treatment, which exists for digits
                    and would wrap a phrase. `num-data` follows the number. */}
                <div
                  className={m.shape ? undefined : 'num-data'}
                  style={m.shape
                    ? { fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: m.valueColor, letterSpacing: '-0.2px', lineHeight: 1.25 }
                    : { fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 800, color: m.valueColor, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.8px', lineHeight: 1, marginBottom: 'var(--space-2)' }}
                >
                  {m.value}
                </div>
                {m.shape}
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 500, color: m.subColor, lineHeight: 1.3, marginTop: m.shape ? '8px' : 0 }}>
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
          <Sheet onClose={() => setLoadSheetOpen(false)} ariaLabel="Your training load balance">
            {(close) => (
            <>
              <div style={{ padding: '0 20px 4px' }}>
                <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: 'var(--space-2)' }}>
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

              <div style={{ padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {[
                  'Compares this week\'s training load to your rolling average over the past four weeks. A ratio of 1.0 means you\'re doing exactly what your body is used to.',
                  'Under 0.8: you\'re doing less than normal, which is fine for recovery weeks. Between 0.8 and 1.3 is the safe build zone. Above 1.3 means this week is harder than your recent baseline.',
                  'Big spikes in load are where injuries happen and where performance dips. Consistent load, week over week, is how fitness actually builds.',
                ].map((text, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>{text}</div>
                ))}
              </div>

            </>
            )}
          </Sheet>
        )}

        {/* ── ZONE DISCIPLINE SHEET ───────────────────────────────────── */}
        {zoneDisciplineSheetOpen && (
          <Sheet onClose={() => setZoneDisciplineSheetOpen(false)} ariaLabel="Hitting the prescribed zone">
            {(close) => (
            <>
              <div style={{ padding: '0 20px 4px' }}>
                <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: 'var(--space-2)' }}>
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

              <div style={{ padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {[
                  'Each session in your plan has a prescribed zone: Zone 2 for easy runs, Zone 3 for tempo, Zone 4–5 for intervals. Zone discipline measures how many of your completed sessions actually landed in that zone.',
                  'Running easy days too hard is the most common training mistake. It doesn\'t feel like much in the moment, but it blunts the aerobic benefit and leaves you too tired to push when the hard sessions arrive.',
                  'A score above 80% means easy was easy and hard was hard. That\'s the structure that builds fitness. Below 60% usually means the easy days are drifting into grey-zone territory: hard enough to add fatigue, not hard enough to drive adaptation.',
                ].map((text, i) => (
                  <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>{text}</div>
                ))}
              </div>

            </>
            )}
          </Sheet>
        )}

        {/* 🔴 LEDGER-COACH-SITE-REMOVE-01 — THE LEDGER'S SECOND RENDER SITE WAS HERE
            AND THE DESIGN BOARD KILLED IT (2026-10-05, unanimous), on the measurement:
            `me` 123 views / 9 users against `coach` 33 / 8. Nine users and eight is ONE
            audience with a preference, not two audiences. Collins: "two doors to one
            thing is not generosity, it is indecision made visible."
            Sierra: the ledger is an EXECUTION metric — did you do what you said you
            would — so it belongs on Me, which `LEDGER-PLACEMENT-01` already settled as
            "an identity / execution metric, not admin chrome".
            ⚠️ Its whole prefetch chain went with it (state, the `/api/discipline-ledger`
            request in the orchestrated load, the prop and the prop type): Me's card uses
            `useDisciplineLedger`, so the prefetch had NO consumer left. Leaving it is the
            `SMOKE-PLUMBING-01` shape — dead props and a live SELECT nobody reads. */}

        {/* ── AEROBIC TREND — the physiological answer to "am I getting
            fitter?". ONE card, founder's call 2026-09-12.

            Coach used to render TWO TrendCards: the long-run trend
            (AI-DEPTH-03) and this easy-run one (R25 cut 3). Both PAID, both
            near-identical, stacked at the bottom — part of what made the screen
            read as a dashboard. The easy-run trend is the one that survives,
            because it is what the hero line is about ("your easy days are
            creeping up") and what Kit's sentence names. The long-run card and
            its fetch are retired; the skeleton/pending states it owned have
            moved onto this one, so week 1 still says something.

            Glossless: the AI gloss and its byline are stripped so the card
            reads as raw evidence. The interpretation lives in the one Kit read
            at the top (CO-ONE, trend fold). ── */}
        {/* The label pair is passed to EVERY state, not just `live`. Until
            2026-09-12 the skeleton and pending states carried no label, so a
            runner watching this card load saw "Aerobic trend" flip to "Easy run
            trend", and the explanation sheet said "long runs" regardless. */}
        {easyTrendLoading
          ? <TrendCard state="skeleton" label={EASY_TREND_LABELS.label} />
          : easyTrendData?.state === 'live'
          ? <TrendCard
              state="live"
              label={EASY_TREND_LABELS.label}
              sessionLabel={EASY_TREND_LABELS.sessionLabel}
              earlierMonth={easyTrendData.earlierMonth}
              earlierHr={easyTrendData.earlierHr}
              nowHr={easyTrendData.nowHr}
              cohortSize={easyTrendData.cohortSize}
              windowMonths={easyTrendData.windowMonths}
              gloss={easyTrendData.gloss}
              series={easyTrendData.series}
              earlierPace={easyTrendData.earlierPace}
              nowPace={easyTrendData.nowPace}
              preferredUnits={preferredUnits}
              glossless
            />
          : <TrendCard state="pending" {...EASY_TREND_LABELS} />
        }

      </div>
    </div>
  )
}

// ── STRAVA SCREEN ─────────────────────────────────────────────────────────

function StravaScreen({ runs, loading, connected, raceName, raceDate, raceDistanceKm, zone2Ceiling, restingHR, maxHR, preferredUnits }: {
  runs: any[] | null; loading: boolean; connected: boolean
  raceName?: string; raceDate?: string; raceDistanceKm?: number
  zone2Ceiling?: number; restingHR?: number; maxHR?: number
  /** FMT-02 / INV-PREF-001 — threaded through so the panel renders the
   *  runner's own unit rather than a hardcoded `km`. */
  preferredUnits?: 'km' | 'mi'
}) {
  return (
    <div>
      <ScreenHeader title="Strava" sub="Activity feed" />
      <div style={{ padding: '0 12px' }}>
        <StravaPanel preloadedRuns={runs} preloadedConnected={connected} preloadedLoading={loading} raceName={raceName} raceDate={raceDate} raceDistanceKm={raceDistanceKm} zone2Ceiling={zone2Ceiling} restingHR={restingHR} maxHR={maxHR} preferredUnits={preferredUnits} />
      </div>
    </div>
  )
}

// ── PUSH NOTIFICATIONS ROW ────────────────────────────────────────────────



// iOS hands back the APNs device token via the `registration` event, but only
// reliably on the FIRST `register()` of an app session. A second register()
// — e.g. toggling Run notifications off then back on without relaunching —
// frequently never re-fires the event, so a register-and-wait hangs for the
// full timeout and then errors ("Working…" forever → "Couldn't enable push").
// We sidestep that by caching the token at module scope the first time it
// arrives and reusing it for every later subscribe/unsubscribe this session.









// ── DAILY PUSH TOGGLE ROW ─────────────────────────────────────────────────
// HOOK-01 — opt-out for the daily morning training-day push. Mirrors the
// PushNotificationsRow visual but renders inline (no permission ask — the
// permission belongs to PushNotificationsRow above).



// ── STRAVA CONNECTION ROW ─────────────────────────────────────────────────







// ── SMOKE TOGGLE ──────────────────────────────────────────────────────────


// ── ME SCREEN ─────────────────────────────────────────────────────────────

// ── HR ZONE CALCULATION (Karvonen / HRR method) ───────────────────────────











// ── ME SCREEN ─────────────────────────────────────────────────────────────



// ── SupportScreen ─────────────────────────────────────────────────────────────
// In-app contact entry (FREE). Opens a pre-filled email to support@zonna.run with
// a quiet diagnostic footer (app version · platform · account · plan) so support
// can act on the first reply. Copy-address fallback covers users with no mail
// ── PlanHistoryScreen ─────────────────────────────────────────────────────────
// CA-06 — FREE. Read-only reverse-chron list of archived plans from plan_archive.
// No restore at v1. The user sees the races they've trained for as a quiet timeline.











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





// Shown when polling gives up after ~40s — keeps the card slot visible
// with a calm fallback rather than silently disappearing.
function GaveUpCard({ onOpenCoach }: { onOpenCoach?: () => void }) {
  return (
    <div style={{
      marginTop: 'var(--space-3)',
      background: 'var(--bg-soft)',
      borderRadius: '14px',
      padding: '16px 18px',
    }}>
      <div style={{ marginBottom: 'var(--space-2)', opacity: 0.4 }}>
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

  // Planned vs actual, ON THE AXIS THE SESSION WAS ANCHORED ON (§66 Amendment 1).
  //
  // This block used to read `planned_load_km` only, and that column is null on
  // every duration-anchored analysis — so a beginner, whose plan speaks in
  // minutes on 95.8% of sessions, met "No distance data." after every single
  // run, forever, while the run in front of them plainly had a distance.
  //
  // The comparison is not derived into kilometres. §80 expects walk breaks on
  // this cohort and holds that time on feet accumulates whether or not every
  // step is running — so a completed 60-minute long run with walk breaks covers
  // less ground than the pace band implies, and reporting that as "short" would
  // name a failure the runner did not have.
  const planned = analysis.planned_load_km as number | null | undefined
  const actual  = analysis.actual_load_km  as number | null | undefined
  const plannedMins = analysis.planned_load_mins as number | null | undefined
  const actualMins  = analysis.actual_load_mins  as number | null | undefined
  let distLine: string
  if (planned != null && actual != null) {
    if (Math.abs(actual - planned) < 0.3) {
      distLine = `Hit the planned distance: ${formatDistance(actual, units, { exact: true })}.`
    } else if (actual > planned) {
      distLine = `Planned ${formatDistance(planned, units, { exact: true })}, ran ${formatDistance(actual, units, { exact: true })}.`
    } else {
      distLine = `Planned ${formatDistance(planned, units, { exact: true })}, ran ${formatDistance(actual, units, { exact: true })}. Short.`
    }
  } else if (plannedMins != null && actualMins != null) {
    // 2 minutes is the time-axis sibling of the 0.3 km tolerance above: at the
    // engine's easy pace (~6.3 min/km) 0.3 km IS about two minutes, so the two
    // axes forgive the same amount of session rather than two different amounts.
    const TIME_TOLERANCE_MINS = 2
    if (Math.abs(actualMins - plannedMins) < TIME_TOLERANCE_MINS) {
      distLine = `Hit the planned time: ${formatDuration(actualMins)}.`
    } else if (actualMins > plannedMins) {
      distLine = `Planned ${formatDuration(plannedMins)}, ran ${formatDuration(actualMins)}.`
    } else {
      distLine = `Planned ${formatDuration(plannedMins)}, ran ${formatDuration(actualMins)}. Short.`
    }
  } else {
    distLine = 'No distance data.'
  }

  // Pace
  let paceLine: string
  if (paceTarget && actualAvgSpeedMs && actualAvgSpeedMs > 0) {
    const sec = 1000 / actualAvgSpeedMs
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    // PACE-UNITS-01 — `paceTarget` arrives already converted (the caller runs it
    // through `convertPaceString`), so hardcoding `/km` on the ACTUAL pace beside
    // it printed a miles target next to a km actual in the same sentence.
    // `formatPace` takes seconds-per-km and owns the conversion.
    // ⚠️ `units` was ALREADY a parameter here and the caller ALREADY passed
    // preferredUnits — it was used for distance on the line above and never for
    // pace. A declared-but-inert argument on the one line that needed it.
    const ranPace = formatPace(sec, units) ?? `${m}:${String(s).padStart(2, '0')}`
    paceLine = `Target ${paceTarget}, ran ${ranPace}.`
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
    efLine = 'No baseline yet: need a few similar runs.'
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

// Exported for the local design harness at /post-run-preview. This card is
// tier-gated and authed, so "it compiles" is not the same claim as "it renders
// correctly in every state" — and this repo has already shipped a comment
// describing a change to an unchanged component because nobody could look at it.
/**
 * POST-RUN-CONTEXT-01 — gather the recent EASY/recovery analyses, oldest first,
 * up to and including this session, and hand them to the decision owner.
 *
 * Selection lives here; the DECISION lives in `driftContextFor`. Keeping them
 * apart is the point — every board binding (silence by default, never twice in a
 * row, directional, count-never-conclude) is in the owner and unit-tested, so a
 * change to this gathering cannot quietly reinterpret a ruling.
 *
 * Easy/recovery only, read off the PLAN's session type rather than any label
 * (D-17: the enricher rewrites labels, it does not rewrite `plan_json` types).
 */
const DRIFT_CONTEXT_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DRIFT_CONTEXT_WINDOW = 8

function buildDriftContext(
  plan: any,
  runAnalysisMap: Record<number, Record<string, any>>,
  weekN: number | null | undefined,
  sessionKey: string | null | undefined,
): { show: boolean; drifted: number; total: number } | null {
  if (!plan?.weeks || weekN == null || !sessionKey) return null
  const ordered: { aboveCeilingPct: number | null }[] = []
  for (const w of plan.weeks) {
    if (w.n > weekN) break
    for (const d of DRIFT_CONTEXT_DAYS) {
      if (w.n === weekN && DRIFT_CONTEXT_DAYS.indexOf(d) > DRIFT_CONTEXT_DAYS.indexOf(sessionKey as any)) break
      const sType = (w.sessions as any)?.[d]?.type
      if (sType !== 'easy' && sType !== 'recovery') continue
      const a = runAnalysisMap[w.n]?.[d]
      if (!a || a.source === 'manual') continue
      ordered.push({ aboveCeilingPct: a.hr_above_ceiling_pct ?? null })
    }
  }
  if (ordered.length === 0) return null
  return driftContextFor(ordered.slice(-DRIFT_CONTEXT_WINDOW), ZONE_DRIFT_ABOVE_CEILING_PCT)
}

export function RunFeedbackCard({
  analysis,
  paceTarget = null,
  actualAvgSpeedMs = null,
  onOpenCoach,
  preferredUnits = 'km',
  driftContext = null,
}: {
  analysis: any
  paceTarget?: string | null
  actualAvgSpeedMs?: number | null
  onOpenCoach?: () => void
  preferredUnits?: 'km' | 'mi'
  // POST-RUN-CONTEXT-01 — the block-level count, decided by `driftContextFor`.
  // The card renders it; it does not decide it. Null when there is nothing to say.
  driftContext?: { show: boolean; drifted: number; total: number } | null
}) {
  const verdict    = analysis.verdict as string
  const score      = analysis.total_score as number | null
  const feedback   = analysis.feedback_text as string | null
  const isManual   = (analysis.source as string | undefined) === 'manual'
  const voice      = getVerdictVoice(verdict)
  const [expanded, setExpanded] = useState(false)
  const explanations = buildScoreExplanations(analysis, paceTarget, actualAvgSpeedMs, preferredUnits)

  // UX-POSTRUN-01 — the one behavioural signal that survives the dashboard cut.
  // `hr_discipline_score` IS the in-zone percentage (scoreSession returns
  // `min(100, hrInZonePct)`), so this reads the score row rather than
  // recomputing from `hr_in_zone_pct` and risking two answers to one question.
  const zoneSignal = analysis.hr_discipline_score as number | null
  /** POSTRUN-JOURNEY-01 — the signed pair. Null on a manual run and on any analysis
   *  written before these columns were selected; the bar then renders the single
   *  segment it always did, so an old row degrades rather than breaking. */
  const aboveCeilingPct = (analysis.hr_above_ceiling_pct ?? null) as number | null
  const belowFloorPct   = (analysis.hr_below_floor_pct   ?? null) as number | null
  const hrNotAvailable = !isManual && zoneSignal == null

  // UX-POSTRUN-01 — the card's palette follows the verdict.
  //
  // Every post-run card rendered on `--warn-bg` regardless of outcome, so a run
  // where the runner HELD the zone met "There it is. Don't ruin it." on the
  // warning palette. CLAUDE.md reserves warn/amber for coaching; moss is the
  // accent for completion. Getting it right is most of what "does this make them
  // feel the right thing" means at this moment — restraint is supposed to feel
  // like progress, and it cannot if success and drift look identical.
  //
  // `--coach-ink` is declared in globals.css as "coach copy on --warn-bg only",
  // so the ink moves with the background rather than being left behind on a
  // surface it was never specified against.
  // Threshold reuses the ≥80 already used for the bar and `scoreBandLabel` — no
  // new coaching numeric enters through a colour decision.
  const zoneHeld = zoneSignal != null && zoneSignal >= 80
  const pal = zoneHeld
    ? { bg: 'var(--moss-soft)', ink: 'var(--ink)', label: 'var(--moss)', track: 'var(--line-strong)', rule: 'var(--line-strong)' }
    : { bg: 'var(--warn-bg)',   ink: 'var(--coach-ink)', label: 'var(--warn)', track: 'var(--coach-line)', rule: 'var(--coach-line)' }

  return (
    <>
      {/* 🔴 POSTRUN-JOURNEY-01 (2026-10-07) — THE SIGNAL LEADS, THE READ FOLLOWS.
       * THIS REVERSES UX-POSTRUN-01's "KIT LEADS", AND THE REVERSAL IS THE FOUNDER'S.
       *
       * UX-POSTRUN-01 (SLT, 2026-09-13) put Kit first and its reasoning was sound:
       * Traynor — "this is PAID surface leading with the commodity; any free tracker
       * computes a score, the read is what they are paying for", and "a mark out of
       * 100 answers 'tracker'". That argument is NOT withdrawn and the score is still
       * demoted to a collapsed chip: what leads now is the ZONE SIGNAL, which is the
       * one number only this product produces, not the grade.
       *
       * ⚠️ The Design Board could not have made this change — ADR-023 runs one way,
       * the SLT may overturn design and not the reverse. 6ah's part 1 was ruled
       * against settled ground that the sitting's own scan missed, and the FOUNDER
       * overruled it on 2026-10-07 after being shown both orders as mockups.
       *
       * His reason, recorded: a runner opening this screen is asking "how did I do?",
       * and today they meet 76 words before the one number that answers it. Measured:
       * mean read 12 words, but his own was 76 and fully rule-compliant.
       *
       * ⚠️ Kit has NOT been demoted to the bottom of the screen — the read sits
       * immediately below, above the fold on a 390pt phone. The grade did not move
       * back up; it is still behind the toggle. */}
      {/* Verdict card — rule-derived zone signal + headline. No AI mark. */}
      <div style={{
        marginTop: 'var(--space-2)',
        background: pal.bg,
        borderRadius: '14px',
        padding: '16px 18px',
      }}>
        {/* Top row — score toggle (right-aligned), only when !isManual && score !== null */}
        {!isManual && score !== null && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
            <Button variant="ghost" 
              type="button"
              onClick={() => setExpanded(e => !e)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide score breakdown' : 'Show score breakdown'} style={{ background: 'transparent', padding: '2px 4px', margin: '-2px -4px', gap: '4px', fontSize: '11px', fontWeight: 600, color: pal.ink, opacity: 0.5, fontVariantNumeric: 'tabular-nums' }}>
              {score}/100
              <span style={{
                fontSize: '9px',
                display: 'inline-block',
                transform: expanded ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.18s',
              }}>▾</span>
            </Button>
          </div>
        )}

        {/* Zonna-voice headline */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 700,
          color: pal.ink, letterSpacing: '-0.1px', lineHeight: 1.4,
          marginBottom: !isManual ? '14px' : 0,
        }}>
          {voice.headline}
        </div>

        {/* UX-POSTRUN-01 (SLT 2026-09-13) — ONE zone signal, not a four-column dashboard.
         *
         * This was HR / DISTANCE / PACE / EFFICIENCY, each with a number, a
         * progress bar and a band label. Two rules said no:
         *   · "No dashboards or noise" (CLAUDE.md UI principles)
         *   · Zonna "deliberately omits gamification" — four sub-scores out of
         *     100 with bars is a scoreboard, and handing a runner who overtrains
         *     a number to optimise is the grey-zone pressure the product exists
         *     to remove, rebuilt as a leaderboard (Sutherland).
         *
         * Wood's carve-out is why ONE signal survives rather than none: zone
         * adherence is the single behaviour this product exists to change, and
         * confirming it reduces cognitive load rather than rewarding a score.
         * Distance, pace and efficiency are outcomes of the run, not the
         * behaviour — they stay available behind the score toggle for anyone who
         * wants them (progressive disclosure), rather than leading.
         *
         * Reuses `scoreBandLabel` and the existing ≥80 moss threshold, so no new
         * coaching numeric enters through a display change.
         */}
        {!isManual && zoneSignal != null && (
          <div>
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
              gap: 'var(--space-3)', marginBottom: 'var(--space-2)',
            }}>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                color: pal.ink, letterSpacing: '-0.1px',
              }}>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>
                  {Math.round(zoneSignal)}%
                </span>
                {' '}in your prescribed zone
              </div>
              <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)',
                color: pal.label, opacity: 0.7, whiteSpace: 'nowrap' }}>
                {scoreBandLabel(zoneSignal)}
              </div>
            </div>
            {/* 🔴 POSTRUN-JOURNEY-01 — THE BAR IS SIGNED, and that is the point of it.
              * `hr_in_zone_pct` alone says you missed; it cannot say whether you went
              * too HARD or too EASY, and those need opposite advice. Garmin's Training
              * Effect is unsigned, so this split is a thing only this product can show
              * — and §12 Am. 1 already established the direction matters, after the old
              * detector flagged 6 of 22 runs (27%) that were merely too easy.
              * ⚠️ Above-ceiling is `--warn`; below-floor is MUTED, never alarming:
              * running easier than prescribed breaks no principle. */}
            <div style={{
              height: '6px', background: pal.track, borderRadius: '3px',
              overflow: 'hidden', display: 'flex',
            }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, zoneSignal))}%`,
                background: zoneHeld ? 'var(--moss)' : 'var(--warn)',
                opacity: zoneHeld ? 0.8 : zoneSignal >= 60 ? 0.55 : 1,
                transition: 'width 0.4s ease',
              }} />
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, aboveCeilingPct ?? 0))}%`,
                background: 'var(--warn)',
                transition: 'width 0.4s ease',
              }} />
              <div style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, belowFloorPct ?? 0))}%`,
                background: pal.label,
                opacity: 0.35,
                transition: 'width 0.4s ease',
              }} />

            {/* The sentence the bar cannot say on its own. One line, only when there
              * is a direction worth naming. */}
            {(aboveCeilingPct != null || belowFloorPct != null) && (
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 'var(--space-2)',
                fontFamily: 'var(--font-ui)', fontSize: '11px', color: pal.label,
              }}>
                <span>{Math.round(zoneSignal)}% in the band</span>
                {(aboveCeilingPct ?? 0) >= (belowFloorPct ?? 0)
                  ? <span style={{ fontWeight: 600 }}>{Math.round(aboveCeilingPct ?? 0)}% above it</span>
                  : <span>{Math.round(belowFloorPct ?? 0)}% below it</span>}
              </div>
            )}            </div>
          </div>
        )}
        {hrNotAvailable && (
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: '12px', color: pal.ink,
            opacity: 0.75, margin: 0, lineHeight: 1.45,
          }}>
            {/* §108 Amendment 1 — the score is WITHHELD now, not softened, so the
              * copy says the honest thing rather than noting a gap beside a
              * confident number. No em dash (founder call 2026-09-11). */}
            No heart rate on this run, so it isn&rsquo;t scored.
          </p>
        )}

        {/* POST-RUN-CONTEXT-01 (Coaching Board + SLT 2026-09-13) — the block-level
         *  line. The differentiator: none of Runna, Trenara, Garmin, Coopah,
         *  Planzy or Runzy joins the individual run to the block. Garmin's
         *  Training Effect is UNSIGNED and cannot say an easy run was too hard;
         *  the directional columns here can.
         *
         *  It COUNTS. It does not conclude. "which is why Saturday felt heavy"
         *  asserts a mechanism we cannot demonstrate from one runner and three
         *  data points, and the chair vetoed the hedged form too. Silence is the
         *  default and it never speaks twice running (Wood) — both decided by
         *  `driftContextFor`, not here. */}
        {driftContext?.show && (
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
            color: pal.ink, opacity: 0.85, margin: '10px 0 0', lineHeight: 1.45,
          }}>
            That&rsquo;s {driftContext.drifted} of your last {driftContext.total} easy
            runs above the ceiling.
          </p>
        )}

        {/* Expanded breakdown — one line per sub-score, derived from analysis row */}
        {!isManual && expanded && (
          <div style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: `1px solid ${pal.rule}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}>
            {explanations.map(({ label, value, line }) => value !== undefined && (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)' }}>
                <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)',
                  color: pal.label, opacity: 0.7,
                  width: '78px', flexShrink: 0 }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400,
                  color: pal.ink, lineHeight: 1.45,
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
          marginTop: 'var(--space-3)',
          background: 'var(--card)',
          borderRadius: '14px',
          border: '1px solid var(--line)',
          padding: '14px 16px 14px 22px',
        }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: '8px', top: '14px', bottom: '14px',
            width: '3px', borderRadius: '2px', background: 'var(--moss)',
          }} />
          <div style={{ marginBottom: 'var(--space-3)' }}>
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

function SessionScreen({ session, aiNotes, preloadedRuns, onBack, onSaved, preferredUnits, zone2Ceiling, preferredMetric, onSessionMetricChange, savedMetricOverride = null, restingHR, maxHR, aerobicPace, stravaLoading, runAnalysis, hasPaidAccess, onUpgrade, onOpenCoach, goalPace, guidance, nextSession, onLinkedComplete, autoMatch, driftContext = null }: {
  /** AI-PROVENANCE-01 — see SessionPopupInner. Resolved once where the plan is
   *  in scope and passed down; never re-derived in the view. */
  aiNotes: boolean
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
  /** POST-RUN-CONTEXT-01 — block-level drift count, decided by `driftContextFor`. */
  driftContext?: { show: boolean; drifted: number; total: number } | null
  /** Next scheduled session in the plan — shown as an "Up next" row below the feedback card. */
  nextSession?: { type: string; day: string; distanceKm?: number | null; label?: string | null } | null
  /** POST-RUN-01: route a Strava-linked completion to the new PostRunScreen. */
  onLinkedComplete?: (data: PostRunData) => void
  /** AUTO-MATCH-02: best Strava match (high or medium) for this session. */
  autoMatch?: { activity: any; confidence: 'high' | 'medium' } | null
}) {
  const color = getSessionColor({ ...session, type: session.type ?? 'easy' })
  const typeLabel = getSessionLabel(session ?? 'easy')
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
          .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
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

  // Pinned header — see the header row below.
  const { ref: pinRef, scrolled: pinScrolled } = useScrolledContainer(true)

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>

      {/* ── HEADER ROW ────────────────────────────────────────────── */}
      {/* 🔴 THIS HEADER WAS NEVER STICKY. It carried `position: sticky; top: 0`
          and pinned to the wrapper above, which declared `overflow-y: auto`
          with `min-height: 100%` — a scrollport that can never scroll. Measured
          in a browser: -800px after an 800px scroll. The founder asked for a
          pinned header on THIS screen and the code already claimed to do it.

          Behaviour now comes from `.pinned-chrome` + `useScrolledContainer`,
          shared with `ScreenHeader`. The TYPOGRAPHY stays this screen's — the
          two families diverge by 5 treatments and that needs a ruling
          (`BACK-HEADER-OWNER-01`), not a sweep. */}
      <div
        ref={pinRef}
        className={`pinned-chrome${pinScrolled ? ' pinned-chrome--scrolled' : ''}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: '14px 16px 12px',
          zIndex: Z_LAYERS.screenHeader,
        }}
      >
        <BackButton onClick={onBack} />

        {/* Eyebrow + title */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
            color: 'var(--mute)',
            marginBottom: '2px' }}>
            {[dayEyebrow, weekEyebrow].filter(Boolean).join(' · ')}
          </div>
          {/* BACK-HEADER-OWNER-01 — the documented COMPACT screen-title role, from its
              owner. It rendered 16px/700 here, which is one pixel and one weight-step
              above `Card primary` (15/600): not a hierarchy. The truncation stays inline
              because it is a property of the ROW, not of the type role. */}
          <div className="screen-header__title--compact" style={{
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {session.title}
          </div>
        </div>

        {/* Session type chip — right aligned */}
        <div style={{
          fontFamily: 'var(--font-ui)',
          ...MICRO_LABELS.eyebrow,
          background: `${color}18`,
          borderRadius: '100px',
          padding: '4px 10px',
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
                  marginBottom: 'var(--space-2)',
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
                paceTarget={convertPaceString(session.pace_target, preferredUnits) ?? null}
                actualAvgSpeedMs={linkedAct?.average_speed ?? null}
                onOpenCoach={onOpenCoach}
                preferredUnits={preferredUnits}
                driftContext={driftContext}
              />
            </>
          )
        })()}
        {hasPaidAccess && !analysis && isAnalysisPending && !pollGaveUp && <PendingAnalysisCard onOpenCoach={onOpenCoach} />}
        {hasPaidAccess && !analysis && isAnalysisPending && pollGaveUp && <GaveUpCard onOpenCoach={onOpenCoach} />}

        {/* Locked coaching preview — free users who have completed the session */}
        {!hasPaidAccess && isComplete && session.type !== 'rest' && session.type !== 'strength' && (
          <LockedCoachingPreview onUpgrade={onUpgrade} onOpenCoach={onOpenCoach} />
        )}

        {/* Up next — next scheduled session in the week, promoted above the unlink escape hatch (UX-POSTRUN-01) */}
        {nextSession && (hasPaidAccess || isComplete) && (
          <div style={{
            marginTop: 'var(--space-2)', marginBottom: '4px',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: '10px 14px',
            background: 'var(--bg-soft)', borderRadius: '10px',
          }}>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: getSessionColor(nextSession), flexShrink: 0,
            }} />
            <div>
              <div style={{
                fontFamily: 'var(--font-ui)',
                ...MICRO_LABELS.dataLabel,
                color: 'var(--mute)',
                marginBottom: '2px',
              }}>Up next</div>
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)',
              }}>
                {nextSession.day} · {getSessionLabel(nextSession)}{nextSession.distanceKm ? ` · ${formatDistance(nextSession.distanceKm, preferredUnits)}` : ''}
              </div>
            </div>
          </div>
        )}

        {/* UX-POSTRUN-01 residual (SLT 2026-09-13) — Unlink moved BELOW "Up next".
         *  It was a bare underlined link sitting directly under the coaching, at
         *  the emotional peak of the screen. "Up next" is the most behaviourally
         *  useful element here (Wood: it changes the decision on Tuesday), so it
         *  goes first and the escape hatch goes last.
         *
         *  Guard widened from `analysis.source` to `analysis && analysis.source`
         *  because this now sits OUTSIDE the `analysis &&` IIFE that used to
         *  wrap it. `analysis` and `unlinkConfirm` are both SessionScreen-scope,
         *  which is what makes the move safe rather than a restructure. */}
        {analysis && analysis.source !== 'manual' && <div style={{ marginTop: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {!unlinkConfirm && (
            <Button variant="ghost" 
              onClick={() => setUnlinkConfirm(true)} style={{ fontSize: '11px', padding: 0, textDecoration: 'underline', textDecorationColor: 'var(--line)' }}>
              Unlink this run
            </Button>
          )}
          {unlinkConfirm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
                Unlink this run?
              </span>
              <Button variant="ghost" 
                onClick={handleUnlink}
                disabled={unlinking} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger-strong)', background: 'none', padding: 0, cursor: unlinking ? 'default' : 'pointer' }}>
                {unlinking ? 'Unlinking…' : 'Yes, unlink'}
              </Button>
              <Button variant="ghost" size="compact" 
                onClick={() => setUnlinkConfirm(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>}

        <div style={{
          background: 'var(--card)', boxShadow: 'var(--shadow-card)',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid var(--line)`,
          borderLeft: `3px solid ${color}`,
          marginTop: 'var(--space-3)',
          overflow: 'hidden',
        }}>
          {isComplete && (
            <Button variant="ghost" 
              onClick={() => setBriefOpen(o => !o)}
              aria-expanded={briefOpen} style={{ width: '100%', background: 'transparent', padding: '14px 18px', borderBottom: briefOpen ? `1px solid var(--line)` : 'none', color: 'var(--ink-2)', minHeight: '44px' }}>
              <span style={{
                ...MICRO_LABELS.eyebrow,
                color: 'var(--mute)',
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
            </Button>
          )}
          {briefOpen && (
            <SessionPopupInner
              runAnalysis={runAnalysis}
              session={session}
              weekTheme={session.weekTheme ?? ''}
              weekN={session.weekN ?? 1}
              aiNotes={aiNotes}
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
//   2. Collect RPE + fatigue inline (auto-save on every interaction)
//   3. Show the LLM "Read of your run" (PendingAnalysisCard → RunFeedbackCard)
//
// 🔴 THE ORDER OF 2 AND 3 IS THE PRODUCT, NOT THE LAYOUT (POSTRUN-JOURNEY-01
// part 4, Design Board 6ah + founder). It was 3-then-2 until 2026-10-07, which
// meant the first read a runner saw was written with `RPE: not logged` — then
// `saveRPEFatigue` re-ran analyse-run and REPLACED the card underneath them.
// The payoff was already wired; it was just unreachable in time. Asking first
// is what makes the first read they see the one that used their answer.
// ⚠️ The question is NEVER A GATE: the read renders whether or not they answer,
// so there is nothing to skip and no skip control was built. Gated by
// `lib/ui/postRunOrder.test.ts`, including an arm asserting this block stays
// OUTSIDE `hasPaidAccess` — RPE logging is FREE (DS-06) and it now sits
// directly above a paid-gated cluster, which is the LEDGER-01 class.
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
  /** POSTRUN-PACE-NULL-01 — metres/second from the linked activity, so the Pace row
   *  can say what was actually run rather than only what was targeted. */
  const [avgSpeedMs, setAvgSpeedMs] = useState<number | null>(null)
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
          .select('rpe, fatigue_tag, strava_activity_name, strava_activity_km, apple_health_uuid, strava_activity_id')
          .eq('user_id', user.id)
          .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
          .eq('week_n', weekN)
          .eq('session_day', sessionDay)
          .maybeSingle()
        if (!cancelled && row) {
          if (row.rpe != null) setRpe(row.rpe as number)
          if (isFatigueTag(row.fatigue_tag)) setFatigueTag(row.fatigue_tag)
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
          //
          // 🔴 POSTRUN-PACE-NULL-01 (2026-10-07) — `avg_speed` is now read here too,
          // and the fetch runs for a STRAVA-linked completion as well, because
          // `RunFeedbackCard` was being handed `actualAvgSpeedMs={null}` HARDCODED on
          // this screen. `buildScoreExplanations` then took its `else if (paceTarget)`
          // branch and the Pace row read "Target 5:07–5:22 /km." with no actual pace —
          // **forever, on the screen the runner lands on straight after a run.**
          // `SessionScreen` passed the real value all along: eleventh recorded instance
          // of the one-twin class, two call sites of one component.
          //
          // ⚠️ THE HR-PENDING GATE STAYS HK-ONLY. `classifyHrPending` is about
          // HealthKit's late HR delivery and means nothing for Strava, so only the
          // SPEED read is generalised; `setHrPendingActivity` is still inside `isHK`.
          {
            const q = supabase
              .from('strava_activities')
              .select('avg_hr, start_date, moving_time_s, avg_speed')
              .eq('user_id', user.id)
            const { data: act } = await (isHK
              ? q.eq('apple_health_uuid', row.apple_health_uuid)
              : q.eq('strava_activity_id', row.strava_activity_id)
            ).maybeSingle()
            if (!cancelled && act) {
              setAvgSpeedMs((act.avg_speed as number | null) ?? null)
              if (isHK) {
                setHrPendingActivity({
                  avg_hr:        (act.avg_hr as number | null) ?? null,
                  start_date:    (act.start_date as string | null) ?? null,
                  moving_time_s: (act.moving_time_s as number | null) ?? null,
                })
              }
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
        // 🔴 POSTRUN-POLL-WEEK-BLIND-01 (2026-10-07) — `.eq('week_n', weekN)` WAS
        // MISSING, and `.maybeSingle()` ERRORS ON MORE THAN ONE ROW.
        //
        // `session_day` alone is not a key. A runner with analysed runs on the same
        // weekday in two different weeks has two live rows, `maybeSingle()` returns
        // `{ data: null, error }`, and `const { data: row }` THREW THE ERROR AWAY —
        // so the poll could never resolve, ticked 16 × 2.5s and gave up.
        //
        // MEASURED ON THE FOUNDER'S OWN RUN: the `ai_call` landed at 13:45:52.945Z
        // and the row was written at 13:45:53.072Z — **127 ms**. His screenshots show
        // "Analysing your run" at 13:46Z, "Taking longer than usual" at 14:00Z and the
        // finished read at 14:03Z. **He watched a loading state for 17 minutes over
        // data that was already on the server.** The analysis was never slow.
        //
        // ⚠️ 2 of the 5 users with any analysis were ALREADY in this state, worst
        // collision 19 rows on one weekday — and it degrades for EVERY runner over
        // time, because week 2 onward is when weekdays start repeating.
        //
        // ⚠️ THE CORRECT PATTERN WAS NINETY LINES ABOVE THIS, in the completion
        // hydration: `.eq('week_n', weekN).eq('session_day', sessionDay)`. Same file,
        // same screen, same `weekN` in scope.
        //
        // Same family as `HK-ELEV-COLUMN-01` (quoted in `lib/contracts/tableColumns.ts`):
        // Supabase answers with `{ data: null, error }` and the call site destructures
        // the error away, so a hard failure reads as "no data yet". There the COLUMN
        // was wrong; here the query is valid and the CARDINALITY is wrong.
        const { row, error: pollError } = await fetchRunAnalysis(supabase, user.id, weekN, sessionDay)
        // Read it. A swallowed error is why this took seventeen minutes to notice.
        if (pollError) console.warn('[post-run] analysis poll failed', pollError.message)
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
  }, [isAnalysisPending, sessionDay, weekN, supabase, onSaved, onAnalysisLoaded])

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
      // ⚠️ `sessionDay` is `session?.key`, so it is optional. Every OTHER use in
      // this component guards it (the completion load at :13673 does); this
      // write did not, because the old untyped `.upsert()` accepted
      // `session_day: undefined`, PostgREST dropped the key, and the NOT NULL
      // constraint rejected the row into a `catch {}`. Silent, and found only
      // because the typed helper would not compile.
      if (!sessionDay) return
      await upsertCompletion(supabase, {
        week_n:        weekN,
        session_day:   sessionDay,
        status:        'complete',
        rpe:           newRpe,
        fatigue_tag:   newTag,
        coaching_flag: flag,
      })
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

  // 🔴 SESSION-DIST-UNITS-01 — THIS IS THE LINE A REAL USER REPORTED.
  // It printed KILOMETRES with a "mi" suffix: 11.44 km rendered as "11.4mi" on
  // a runner who had run 7.1 miles. He read it, knew it was wrong, and
  // concluded Kit's (correct) "0.4 miles short" was wrong too. **One
  // unconverted string made an accurate coaching read look broken.**
  // `formatDistance` is the sole owner of every distance string (ADR-015 /
  // INV-FMT-001) and converts: formatDistance(11.44, 'mi') === '7mi'.
  //
  // ⚠️ `exact: true` BECAUSE THIS IS A MEASURED VALUE, NOT A PRESCRIBED ONE.
  // The default rounds — correct for "your session is 8km", wrong for "you ran
  // 7.1mi", and the line being replaced used `.toFixed(1)` for exactly that
  // reason. Rounding 7.11 to "7mi" would be a smaller version of the same
  // complaint. `promptFormat.ts` draws the same distinction for the AI layer:
  // `fmtPlanned` rounds, `fmtDist` keeps the decimal.
  const distLabel = displayActivity?.km != null
    ? (formatDistance(displayActivity.km, preferredUnits, { exact: true }) ?? '')
    : ''
  const sessionLabel = getSessionLabel(session ?? 'easy')
  const dayLabel     = session.day ?? ''
  const weekLabel    = session.weekN ?? weekN
  // PACE-UNITS-01 — `goal_pace_per_km` is baked in km by its very name, so it
  // needs the same conversion as `pace_target`.
  const paceTarget   = convertPaceString(session.pace_target, preferredUnits)
    ?? ((session.type === 'easy' || session.type === 'run') ? aerobicPace ?? null : null)
    ?? convertPaceString(goalPace, preferredUnits) ?? null

  // Pinned header — see the header row below.
  const { ref: pinRef, scrolled: pinScrolled } = useScrolledContainer(true)

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      {/* ── HEADER ─────────────────────────────────────────────────── */}
      {/* Same defect as SessionScreen's header, same fix — it pinned to an
          inert scrollport and never moved. */}
      <div
        ref={pinRef}
        className={`pinned-chrome${pinScrolled ? ' pinned-chrome--scrolled' : ''}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          padding: '14px 16px 12px',
          zIndex: Z_LAYERS.screenHeader,
        }}
      >
        <BackButton onClick={onBack} ariaLabel="Back to Today" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-ui)',
            ...MICRO_LABELS.eyebrow,
            color: 'var(--mute)',
            marginBottom: '2px',
          }}>
            Run logged · W{weekLabel}
          </div>
          {/* BACK-HEADER-OWNER-01 — the documented COMPACT screen-title role, from its
              owner. These were already the ruled values; they were HAND-COPIED, which is
              the same defect in the mechanism rather than in the value. */}
          <div className="screen-header__title--compact">
            {sessionLabel}{dayLabel ? ` · ${dayLabel}` : ''}
          </div>
          {/* POST-RUN-02: subtitle reflects analysis state so the wait isn't a
              silent gap. AIMark working state replaces a spinner; this is the
              one screen in the app where the AI verdict is the focal payoff. */}
          {hasPaidAccess && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
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

      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

        {/* ── LINKED ACTIVITY CONFIRMATION ─────────────────────────── */}
        {displayActivity && (
          <div style={{
            background: 'var(--bg-soft)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
          }}>
            {/* source chip */}
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--moss)', flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-ui)',
                ...MICRO_LABELS.eyebrow,
                color: 'var(--mute)',
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

        {/* ── HOW DID IT FEEL? ────────────────────────────────────── */}
        <div style={{
          background: 'var(--card)', boxShadow: 'var(--shadow-card)',
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
            marginBottom: 'var(--space-4)', lineHeight: 1.5,
          }}>
            Effort and body state. That&apos;s all I need.
          </div>

          {/* RPE 1–10 */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: 'var(--space-3)' }}>
              Effort (RPE)
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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
            <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: 'var(--space-3)' }}>
              Body state
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {FATIGUE_TAGS.map(tag => {
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
                      // 🔴 TAP-TARGET-DECISIONS-01 — was 30px.
                      // ⚠️ NOT converted to `<Chip>`: these carry a colour PER TAG
                      // (Fresh / Fine / Heavy / Wrecked), and `Chip` is moss-only, so
                      // conversion DELETES MEANING — Design Board 2026-10-05 refused
                      // exactly this, by name, on the identical control.
                      // 🔴 AND IT IS THE IDENTICAL CONTROL: `SessionPopupInner` carries
                      // a SECOND copy of this chip row, floored the same day for the
                      // same reason. Filed as `FATIGUE-CHIP-DUPLICATE-01`.
                      minHeight: TAP_TARGET_MIN_PX, display: 'inline-flex', alignItems: 'center',
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
            actualAvgSpeedMs={avgSpeedMs}
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

        {/* COMPLETE-01 — peak-end artefact. Mounts once RPE is set. Renders
            State A (zone bar + % in zone) when the run_analysis row has
            arrived from the analyse-run pipeline; falls back to State B
            (RPE / 10 + fatigue chip) while the analysis is still polling.
            Same component as the manual-completion reflect view; data
            sources differ. */}
        {rpe !== null && (
          <>
            <div style={{ padding: '0 24px', marginBottom: 'var(--space-3)' }}>
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
        <Button variant="primary" fullWidth
          onClick={onDone ?? onBack} style={{ marginTop: '4px' }}>
          Done
        </Button>
      </div>
    </div>
  )
}






