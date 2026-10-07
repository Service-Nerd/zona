'use client'

// DASHBOARD-SCREEN-EXTRACT-04 — lifted verbatim out of `DashboardClient.tsx`, the last
// of the fourteen. Module-level in the original, so it closed over nothing.
//
// ⚠️ Bodies UNCHANGED. Edit in a separate commit so the move stays a move.

import AIMark from '@/components/shared/AIMark'
import Button from '@/components/ui/Button'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import ManualRunModal from '@/components/dashboard/ManualRunModal'
import RPEScale from '@/components/shared/RPEScale'
import ReflectionInput from '@/components/training/ReflectionInput'
import SaveImageButton from '@/components/dashboard/SaveImageButton'
import SessionCompleteCard from '@/components/shared/SessionCompleteCard'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import SessionSteps from '@/components/shared/SessionSteps'
import TodayScreen from '@/components/dashboard/TodayScreen'
import ZoneBar from '@/components/shared/ZoneBar'
import ZoneInfoSheet from '@/components/shared/ZoneInfoSheet'
import type { DerivedSet } from '@/lib/plan/resolveMainSet'
import type { Plan, Session, StravaActivity, Week } from '@/types/plan'
import type { PostRunData } from '@/components/dashboard/dashboardHelpers'
import type { Zone } from '@/components/shared/ZoneBar'
import { BRAND } from '@/lib/brand'
import { FATIGUE_TAGS, SKIP_REASONS, isFatigueTag } from '@/lib/coaching/completionVocab'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'
import { isInLinkPool, rankLinkCandidates } from '@/lib/coaching/sessionMatch'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { SESSION_COLORS, getSessionColor, getSessionLabel } from '@/lib/session-types'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { calendarDaysBetween } from '@/lib/dates'
import { catalogueRowFor } from '@/lib/plan/catalogueLink'
import { coachingSessionType, isLongRun } from '@/lib/plan/sessionRole'
import { composeSession } from '@/lib/plan/sessionComposer'
import { computeAerobicPace } from '@/lib/coaching/aerobicPace'
import { convertDistanceString, convertPaceString, formatDate, formatDistance, resolveSessionMetric } from '@/lib/format'
import { createClient } from '@/lib/supabase/client'
import { displayZonesForSession, fmtDurationMins, getReflectResponse, getSessionHRDisplay, rpeColour } from '@/components/dashboard/dashboardHelpers'
import { easyPaceAsCeiling, splitPaceQualifier } from '@/lib/plan/easyPaceCeiling'
import { getCoachingFlag } from '@/lib/coaching/coachingFlag'
import { getCompletionCopy } from '@/lib/coaching/completionCopy'
import { getSessionVoiceLine } from '@/lib/coaching/voiceLines'
import { guidanceContextFromSession, renderGuidance } from '@/lib/plan/renderGuidance'
import { hrBandForZoneString, sessionHRBand, zoneForSessionType, zoneKeyForZoneString } from '@/lib/coaching/zoneRules'
import { sessionNotesAreAiAuthored } from '@/lib/plan/notesProvenance'
import { syncOnAppOpen } from '@/lib/health/clientSync'
import { upsertCompletion } from '@/lib/plan/completions'
import { useDisciplineLedger } from '@/lib/coaching/useDisciplineLedger'
import { useEffect, useRef, useState } from 'react'
import { zoneNumberForType } from '@/components/shared/ZoneBar'
import { zoneVerdict, zoneVerdictColour, zoneVerdictLabel } from '@/lib/coaching/zoneVerdict'

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
  // DATE-DST-01 — calendar days, not milliseconds (see `lib/dates.ts`).
  const days = calendarDaysBetween(startOfDate, startOfToday)
  if (days <= 6) return `${days}d ago`
  return null
}

function getSkipResponse(reason: string): string {
  if (reason === 'Injury / illness') return "Right call. Don't push it."
  if (reason === 'Too tired') return "Body talking. Worth listening."
  if (reason === 'Life got busy') return "Life counts. Pick it back up."
  if (reason === 'Bad weather') return "It'll be there tomorrow."
  return "Fair enough. Pick it back up."
}

/** DS-07 Part B — read the effort count off a composite log's name ("3 efforts · …"). */
function parseEffortCount(name?: string | null): number {
  const m = name?.match(/^(\d+)\s+efforts/)
  return m ? parseInt(m[1], 10) : 1
}

export default function SessionPopupInner({ session, weekTheme, weekN, aiNotes, preloadedRuns, onClose, onSaved, preferredUnits, zone2Ceiling, preferredMetric, onSessionMetricChange, savedMetricOverride = null, restingHR, maxHR, aerobicPace, stravaLoading, hasPaidAccess, onUpgrade, goalPace, guidance, onLinkedComplete, autoMatch, runAnalysis = null }: {
  /** P-01 — the completion pill's verdict comes from here. `null` is the honest
   *  majority case (no HR, or a free-tier runner without `activity_intelligence`)
   *  and resolves to `unknown`, never to `held`. */
  runAnalysis?: { hr_above_ceiling_pct?: number | null } | null
  session: any; weekTheme: string; weekN: number; preloadedRuns: any[]
  /** AI-PROVENANCE-01 — did a MODEL write this session's coach notes? Resolved by
   *  `sessionNotesAreAiAuthored` where the plan is in scope; never re-derived here,
   *  and never inferred from whether the notes array is non-empty (the rule engine
   *  writes coach_notes too, which is the defect this replaced). */
  aiNotes: boolean
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
  // Mirrors resolveSessionMetric's priority chain (lib/format.ts, ADR-015)
  // minus the override step — the override lives as `sessionMetric` local
  // state here (seeded from the parent's DB-backed map below), layered on
  // top via `effectiveMetric`, rather than a second `overrides[key]` lookup.
  // Same rule, one deliberate layering difference — not drift.
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
    // Same owner as the trend filter: only a real fatigue value may prefill a
    // Fresh/Fine/Heavy/Wrecked control (FIRSTRUN-MISSED-01).
    if (isFatigueTag(completion?.fatigue_tag)) setFatigueTag(completion.fatigue_tag)
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
      await upsertCompletion(supabase, {
        week_n: weekN,
        session_day: session.key,
        status: completion?.status ?? 'complete',
        rpe: newRpe,
        fatigue_tag: newTag,
        coaching_flag: flag,
      })
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
            .or('strava_activity_id.not.is.null,apple_health_uuid.not.is.null')
            .is('superseded_at', null),   // PLAN-WEEK-COLLISION-01: live plan only
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

  // 🔴 MATCH-LIST-WINDOW-01. The pool window and the RANKING are two different
  // questions and both now have one owner in `lib/coaching/sessionMatch.ts`.
  //
  // What was here: a hand-rolled -5/+0-day date test with NO distance component —
  // a SECOND answer to "which run could be this session?", parallel to the matcher
  // the parent ALREADY ran to produce the `autoMatch` CTA above this list. So the
  // screen showed the ranked answer as a button and then a recency-sorted list that
  // contradicted it: a 20 Sep / 14 km run sat at the top for a Fri 25 Sep / 8 km
  // session (25 Sep - 5 = 20 Sep, exactly the boundary; 14/8 = 1.75, far outside the
  // matcher's 0.75-1.40). The item was filed as "no date filter". There WAS one.
  //
  // `isInLinkPool` keeps the window deliberately wide — a runner does a Tuesday
  // session on Saturday and must still be able to link it — and `rankLinkCandidates`
  // puts the likely run first using the SAME owner the auto-linker uses.
  const sessionDate = session.rawDate ? new Date(session.rawDate) : null
  const stravaRuns = rankLinkCandidates(
    session as Session,
    sessionDate,
    [...preloadedRuns, ...freshRuns].filter((r: any) => {
      if (claimedIds.has(r.id) && r.id !== completion?.strava_activity_id && r.id !== completion?.apple_health_uuid) return false
      return isInLinkPool(new Date(r.start_date), sessionDate)
    }) as StravaActivity[],
  ) as any[]

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
      await upsertCompletion(supabase, {
        week_n: weekN,
        session_day: session.key,
        status,
        ...linkFields,
      })

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
  //
  // P-03 (2026-09-20) — CD-11 / §12: for an EASY or RECOVERY run the only number
  // that matters is the Zone 2 ceiling, so the band renders as "7:11 /km or
  // slower". `easyPaceAsCeiling` has done this since CD-11 and was called from
  // exactly ONE place — Session Detail — so the idea the whole product is built
  // around appeared on one screen and not on the card the runner actually looks
  // at. Quality, long and race sessions keep their band: there the range IS the
  // target, and the function leaves them alone (proven: 748 sessions, 656
  // transformed, 0 non-easy altered).
  // PACE-UNITS-01 — the plan bakes pace as "5:53–7:02 /km" at generation, so
  // the units toggle could never reach it. Converted HERE, before
  // `easyPaceAsCeiling`, which reads the unit back out of the text and would
  // otherwise preserve the km it was handed. `aerobicPace` is already in the
  // reader's units (computeAerobicPace takes preferredUnits) and is left alone.
  const paceBracket = easyPaceAsCeiling(
    convertPaceString(session.pace_target, preferredUnits)
      ?? ((session.type === 'easy' || session.type === 'run') ? aerobicPace ?? null : null),
    session.type,
  )
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

  const color = getSessionColor(session)
  const config = { color, label: getSessionLabel(session) }

  // Per-session metric values — session may come from TodayScreen (formatted) or raw plan object (unformatted)
  const rawDuration = session.duration ?? (session.duration_mins != null ? fmtDurationMins(Number(session.duration_mins)) : null)
  const estimatedDuration = rawDuration ?? (session.distance ?? session.distance_km ? `~${fmtDurationMins(Math.round(Number(session.distance ?? session.distance_km) * 6.5))}` : null)
  // §79/ADR-015 (HR-MAX-01 part 3) — the distance/duration toggle must work both
  // ways. A duration-primary session (beginner / returning / §80 time-on-feet)
  // carries duration_mins but no distance_km; deriving distance from duration lets
  // the runner switch to distance instead of seeing "—". Derived distance is an
  // ESTIMATE (shown with ~), never an exact prescribed target — the Coaching Board
  // amendment: a converted distance must not masquerade as a prescription.
  const exactDistanceKm = session.distance ?? session.distance_km ?? null
  const durationMinsNum = session.duration_mins != null ? Number(session.duration_mins) : null
  const estimatedDistance = exactDistanceKm
    ?? (durationMinsNum != null ? Math.round((durationMinsNum / 6.5) * 10) / 10 : null)
  const distanceIsEstimated = exactDistanceKm == null && estimatedDistance != null

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
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
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
          Effort and body state. That's all I need.
        </div>

        {/* RPE */}
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>Effort (RPE)</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
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
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>Body state</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {FATIGUE_TAGS.map(tag => {
              const isActive = fatigueTag === tag
              const tagColor = tag === 'Fresh' ? 'var(--session-green)' : tag === 'Fine' ? 'var(--accent)' : tag === 'Heavy' ? 'var(--amber)' : 'var(--coral)'
              return (
                <button key={tag} onClick={() => {
                  const newTag = isActive ? null : tag
                  setFatigueTag(newTag)
                  saveRPEFatigue(rpe, newTag)
                  if (!reflectResponse) setReflectResponse(getReflectResponse(session.type, rpe, newTag))
                }} style={{
                  // 🔴 TAP-TARGET-DECISIONS-01 batch 8a — was 30px.
                  // ⚠️ NOT converted to `<Chip>`, and the reason is semantic, not
                  // cosmetic: `Chip` is moss-only, while these carry a colour PER TAG
                  // (Fresh / Fine / Heavy / Wrecked). A conversion would delete meaning —
                  // the exact trap `DANGER-TEXT-CONTRAST-01` recorded, where two controls
                  // were excluded by name "because both carry a semantic colour a
                  // conversion would delete". Whether `Chip` should gain a colour axis is
                  // a 🧭 Design Board question, filed as `CHIP-SEMANTIC-COLOUR-01`.
                  minHeight: TAP_TARGET_MIN_PX, display: 'inline-flex', alignItems: 'center',
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
            <div style={{ marginBottom: 'var(--space-3)' }}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-5)' }}>
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
          minHeight: '48px', marginBottom: 'var(--space-5)',
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

        <Button
          onClick={handleReflectDone}
          variant={reflectResponse ? 'primary' : 'secondary'}
          fullWidth
          style={{
            padding: '14px', borderRadius: '12px', fontSize: '13px',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}
        >
          {reflectResponse ? 'Done' : 'Skip for now'}
        </Button>

        {/* Analysis hint — paid users with a linked Strava activity.
            Analysis fires when Done is pressed so RPE/fatigue land first. */}
        {hasPaidAccess && selectedActivity && (
          <div style={{
            marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            justifyContent: 'center',
          }}>
            <AIMark size={10} color="var(--moss)" working />
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
            }}>
              Done. Your run gets analysed in the background.
            </span>
          </div>
        )}

        {/* Upgrade nudge — free users only, shown after logging a session manually */}
        {!hasPaidAccess && onUpgrade && (
          <Button variant="secondary" size="compact" fullWidth 
            onClick={onUpgrade} style={{ marginTop: 'var(--space-3)' }}>
            Upgrade to unlock zone coaching.{' '}
            <span style={{ color: 'var(--moss)' }}>→</span>
          </Button>
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
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
          What got in the way?
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          {SKIP_REASONS.map(reason => {
            const isActive = skipReason === reason
            return (
              <button key={reason} onClick={async () => {
                setSkipReason(reason)
                setReflectResponse(getSkipResponse(reason))
                try {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (user) {
                    await upsertCompletion(supabase, {
        week_n: weekN, session_day: session.key,
                      status: 'skipped', skip_reason: reason, })
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
                // 🔴 TAP-TARGET-DECISIONS-01 batch 8a — was 38px.
                // ⚠️ NOT converted to `<Chip>`: no semantics would be lost (`--accent`
                // is a moss alias) but `Chip` is 14px on `--card`, against 12px on
                // `--bg` here, inside a 2-column grid. That is a VISIBLE type-scale and
                // ground change on a live screen and the board has not seen it — a
                // conversion is not a floor fix. Filed as `SKIP-REASON-CHIP-01`.
                minHeight: TAP_TARGET_MIN_PX, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
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
          minHeight: '48px', marginBottom: 'var(--space-5)',
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

        <Button
          onClick={onClose}
          variant={reflectResponse ? 'primary' : 'secondary'}
          fullWidth
          style={{
            padding: '14px', borderRadius: '12px', fontSize: '13px',
            letterSpacing: '0.06em', textTransform: 'uppercase',
          }}
        >
          {reflectResponse ? 'Close' : 'Close without answering'}
        </Button>
      </div>
    )
  }

  return (
    <>
      {/* ── TOP BLOCK ── */}
      <div style={{ padding: '14px 18px 16px 18px', borderBottom: '1px solid var(--line)' }}>
        {/* Date + status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', letterSpacing: '0.02em' }}>
            {session.day} · {session.date}
          </span>
          {/* P-01 — THE SEMANTIC PAIR, on the one state it is scoped to.
              Moss no longer means "done"; it means the intensity was right.
              Amber means it drifted above the ceiling. Mute means we cannot say,
              which is the honest majority case — no HR, or a free-tier runner
              without `activity_intelligence`.
              ⚠️ Verdict resolved through `zoneVerdict`, the single owner. The
              pill NEVER computes it. ⚠️ The two verdict labels are new copy and
              are pattern-setting (§4A) — flagged for sign-off; "Done" is
              retained unchanged for the unknown case so nothing is claimed. */}
          {isComplete && (() => {
            const verdict = zoneVerdict(runAnalysis?.hr_above_ceiling_pct)
            const tint = verdict === 'held' ? 'var(--moss-soft)' : verdict === 'drifted' ? 'var(--warn-bg)' : 'var(--bg-soft)'
            return (
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: tint, color: zoneVerdictColour(verdict), border: `1px solid ${zoneVerdictColour(verdict)}`, borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {zoneVerdictLabel(verdict) ?? 'Done'}
              </span>
            )
          })()}
          {isSkipped && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', background: 'var(--bg-soft)', color: 'var(--mute)', border: '1px solid var(--line)', borderRadius: '20px', padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skipped</span>}
        </div>
        {/* ── ZONE PRESCRIPTION CARD ──────────────────────────────────
            The biggest single element on the screen besides the title —
            Session Detail exists to sell the prescription. Whole card is
            the tap target for ZoneInfoSheet (the education popup that used
            to hang off the now-removed HR tile). ⓘ in the eyebrow row
            signals drill-down. Renders only for zone-bearing sessions. */}
        {(() => {
          // §84 — display the PRESCRIBED zone (session.zone), not the coarse
          // session.type slot. Every quality session is typed 'quality', so the
          // old zoneNumberForType(type) showed "Zone 3 · tempo" for tempo, VO2
          // intervals and hill reps alike — contradicting the coach note, which
          // reads session.zone. One source now feeds both.
          const dz = displayZonesForSession(session)
          if (!dz) return null
          const { zones, hi, rangeLabel, peakName } = dz
          // Live band from the prescribed zone string; fall back to baked hr_target.
          const band = hrBandForZoneString(session.zone, restingHR ?? null, maxHR ?? null)
          const hrDisplay = band
            ? (hi <= 2 ? `< ${band.hi}` : `${band.lo}–${band.hi}`)
            : getSessionHRDisplay(session.type, session.hr_target, restingHR ?? null, maxHR ?? null, zone2Ceiling ?? undefined)
          const isInteractive = !!zoneForSessionType(session.type)
          return (
            <button
              type="button"
              onClick={() => { if (isInteractive) setZoneSheetOpen(true) }}
              aria-label={isInteractive ? `${rangeLabel} · tap to learn` : rangeLabel}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                marginBottom: 'var(--space-4)',
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
                display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
                marginBottom: 'var(--space-2)',
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'var(--moss)',
                  animation: 'ai-mark-pulse 2.4s ease-in-out infinite',
                  flexShrink: 0,
                }} />
                <span style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)',
                  color: 'var(--moss)' }}>Hold the zone</span>
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
                {rangeLabel} · {peakName}
              </div>
              {/* HR range as supporting detail */}
              {hrDisplay && (
                <div style={{
                  fontFamily: 'var(--font-ui)', fontSize: '12px',
                  color: 'var(--mute)', marginBottom: 'var(--space-3)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {hrDisplay} bpm
                </div>
              )}
              {/* Labelled zone bar — every prescribed zone lights (range-aware) */}
              <ZoneBar activeZones={zones} height={5} showLabels />
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
              padding: '0 4px', marginBottom: 'var(--space-4)',
            }}>
              {voice}
            </div>
          )
        })()}

        {/* ── METRIC GRID ────────────────────────────────────────────
            2-up: Distance/Duration + Pace. HR tile removed — the prescription
            card above owns Zone + HR + ZoneBar (no more duplicate rendering). */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
          {/* Primary metric card with per-session toggle */}
          {(estimatedDistance || estimatedDuration) && ['easy','run','quality','intervals','hard','tempo','long','race','recovery'].includes(session.type) && (
            /* 🔴 CLAUSE 1 — THIS TILE HAD NO SURFACE AT ALL, ON EVERY SESSION.
               `SESSION_COLORS` values are CSS VARIABLES (`var(--session-long)`),
               so `${config.color}10` produced the literal string
               "var(--session-long)10" — invalid CSS the browser drops. The fill
               and the border were declared, reviewed, and never once painted.
               The founder reported the symptom: *"one side is bigger than the
               other"*, the right tile having a real hairline and this one none.

               ⚠️ `color-mix()` is not a new idiom — it is used TEN times in this
               file for exactly this, including four lines above one of the other
               two broken sites. Two ways to tint a token lived side by side and
               only one worked. */
            <div style={{ background: `color-mix(in srgb, ${config.color} 6%, transparent)`, borderRadius: '10px', padding: '10px 12px', border: `1px solid color-mix(in srgb, ${config.color} 19%, transparent)` }}>
              <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)', color: config.color, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {effectiveMetric === 'distance' ? 'Distance' : 'Duration'}
                {isMetricCustom && (
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--line)', borderRadius: '4px', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>custom</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: config.color, lineHeight: 1, marginBottom: 'var(--space-2)' }}>
                {effectiveMetric === 'distance'
                  ? <>{distanceIsEstimated ? '~' : ''}{formatDistance(estimatedDistance, preferredUnits, { noSuffix: true, exact: session.type === 'race' }) ?? '—'}<span style={{ fontSize: '11px', fontWeight: 400, color: config.color, opacity: 0.7 }}> {preferredUnits}</span></>
                  : <span style={{ fontSize: '18px' }}>{estimatedDuration ?? '—'}</span>
                }
              </div>
              {/* Toggle */}
              {/* 🔴 METRIC-TOGGLE-SEGMENTED-01 — Design Board SHIP (adoption sitting,
                  2026-10-05). This was a hand-rolled contained track at **18px**, the
                  smallest control in the product, and `SegmentedControl`'s own doc names
                  "distance/duration" as its use case: it is not a near-duplicate, it is
                  the thing. 🎪 Collins: *"the other two are chips the way a hammer is a
                  mallet — this one IS a segmented control."*

                  🔴 THE "FULL-WIDTH BAND" THE BOARD ACCEPTED DOES NOT EXIST, and the
                  refusal note that used to sit here said it would. MEASURED in the browser
                  at 375px: the control is **124 x 50px inside a 150px metric card**, the
                  same width as the "Distance" label and the "11 km" value above it, and
                  `DISTANCE` / `EST. PACE` stay **exactly equal** at 150 x 120. Segments are
                  57 x 44.
                  🥇 `flex: 1` is a statement about a PARENT, not about a screen — it fills
                  its 150px card, not the viewport. Both the board and this file's previous
                  comment reasoned from an unmeasured assumption about the container, and it
                  ran in the direction of NOT doing the right thing.
                  📱 Wroblewski's argument stands and is now cheaper than he was told: *"an
                  unobtrusive control is one you miss."*

                  🔴 AND THE THIRD BEHAVIOUR IS DROPPED, DELIBERATELY — it was the board's
                  one condition on this build. Tapping the ALREADY-ACTIVE segment used to
                  reset to global. Measured: `isMetricCustom` gates **both** that hidden
                  path and the visible "Reset to global" control below, so the hidden one
                  was redundant in **every state where it existed** — a perfect
                  substitution, not a trade. Keeping it would leave two paths to one
                  outcome with one of them undiscoverable, which is `LOG-ONE-INTENTION-01`'s
                  class: one intention, one verb, one control. */}
              <SegmentedControl
                ariaLabel="Show distance or duration"
                options={[
                  { value: 'distance', label: preferredUnits },
                  { value: 'duration', label: 'min' },
                ]}
                value={effectiveMetric === 'duration' ? 'duration' : 'distance'}
                onChange={(v: 'distance' | 'duration') => updateSessionMetric(v)}
              />
              {isMetricCustom && (
                <Button variant="ghost"  onClick={() => updateSessionMetric(null)} style={{ justifyContent: 'flex-start', fontSize: '10px', color: 'var(--warn-strong)', background: 'none', padding: '4px 0 0', textDecoration: 'underline', textAlign: 'left' }}>
                  Reset to global
                </Button>
              )}
            </div>
          )}
          {/* Pace card — render only when pace is available; no skeleton noise while loading */}
          {paceBracket && (
            <div style={{ background: 'var(--card)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--line)' }}>
              <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: '4px' }}>Est. pace</div>
              {/* 🔴 CLAUSES 2 + 3 — A METRIC AND ITS QUALIFIER ARE NOT THE SAME
                  SIZE. "~5:53 /km or slower" is 19 characters at 22px in a
                  half-width column with ~129px of content width: about 1.8x what
                  it has, so it wrapped and grew the tile. That wrap is the whole
                  of *"one side is bigger than the other"*.

                  ⚠️ THE WORDS STAY. "or slower" is CD-11 / §12 — a ceiling, and
                  "never a ≤ symbol, which reads backwards for pace". Design owns
                  its SIZE; coaching owns whether it is said. It is demoted into
                  the slot "Pace target" used to occupy, which was redundant
                  under a tile already labelled EST. PACE.

                  The distance tile beside this one has always done exactly this:
                  `10` at 22px, ` km` at 11px. */}
              {(() => {
                const split = splitPaceQualifier(paceBracket)
                return (
                  <>
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1 }}>~{split?.value ?? paceBracket}</div>
                    {split?.qualifier && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 400, color: 'var(--mute)', marginTop: 'var(--space-2)' }}>{split.qualifier}</div>
                    )}
                    {!split?.qualifier && paceSource === 'plan' && (
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', color: 'var(--mute)', marginTop: 'var(--space-2)' }}>Pace target</div>
                    )}
                  </>
                )
              })()}
            </div>
          )}
          {/* Duration tile for strength sessions (no zone, no pace) */}
          {session.type === 'strength' && (
            <div style={{ background: 'var(--card)', borderRadius: '10px', padding: '10px 12px', border: '1px solid var(--line)' }}>
              <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: '4px' }}>Duration</div>
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
            // 🔴 THE MARSHALLED SHAPE USES STRAVA'S NAMES, NOT THE DB'S
            // (SESSION-ACTUAL-SHAPE-01). `preloadedRuns` rows are mapped out of
            // `strava_activities` into a Strava-API-shaped object at FOUR sites:
            // `distance_m -> distance` (metres), `moving_time_s -> moving_time`
            // (seconds), `avg_hr -> average_heartrate`. This block read the DB
            // names off the already-renamed object, so:
            //   `undefined / 1000` -> NaN -> **"NaNmi" on screen**
            //   `moving_time_s`    -> undefined -> the duration row silently gone
            //   `avg_hr`           -> undefined, MASKED because `completion.avg_hr`
            //                         is tried first, which is why HR looked fine
            //
            // ⚠️ `NaN != null` IS TRUE, which is how it rendered. The guard below
            // is `Number.isFinite`, because a "not null" check cannot catch NaN —
            // that is the whole mechanism, not a detail.
            //
            // ⚠️ LATENT SINCE 2026-06-08, ACTIVATED 2026-09-22. The consumer was
            // written two days AFTER the marshaller and was wrong from the first
            // keystroke, but `HK-ELEV-COLUMN-01` had this query asking for
            // `total_elevation_gain` against a column called `elevation_gain`, so
            // it loaded ZERO HealthKit runs for three and a half months:
            // `linkedRun` was always undefined and the correct fallback ran.
            // **Fixing that column woke a dead consumer.**
            const actualDistM    = linkedRun ? (linkedRun.distance as number | undefined) : undefined
            const actualDistKm   = Number.isFinite(actualDistM) ? (actualDistM as number) / 1000
                                 : (completion?.strava_activity_km ?? null)
            const actualAvgHr    = completion?.avg_hr ?? (linkedRun?.average_heartrate as number | null | undefined) ?? null
            const actualMovingS  = linkedRun?.moving_time as number | undefined
            const actualDuration = Number.isFinite(actualMovingS) && (actualMovingS as number) > 0
              ? fmtDurationMins(Math.round((actualMovingS as number) / 60))
              : null
            const isZoneBreach = actualAvgHr != null && zone2Ceiling != null &&
              actualAvgHr > zone2Ceiling &&
              ['easy', 'run', 'long', 'recovery'].includes(session.type)
            const flag = completion?.coaching_flag as string | null | undefined
            return (
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>

                  {/* Planned column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: 'var(--space-2)' }}>Planned</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {(estimatedDistance || estimatedDuration) && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)' }}>
                          {effectiveMetric === 'distance' ? `${distanceIsEstimated ? '~' : ''}${formatDistance(estimatedDistance, preferredUnits, { exact: session.type === 'race' }) ?? '—'}` : (estimatedDuration ?? '—')}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                      <div style={{ ...MICRO_LABELS.dataLabel, fontFamily: 'var(--font-ui)', color: 'var(--mute)' }}>Actual</div>
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
                      {/* 🔴 THROUGH `formatDistance`, THE OWNER (ADR-015). This read
                          `${actualDistKm}${preferredUnits}` — a KILOMETRE value
                          concatenated with the user's UNIT LABEL — while the Planned
                          column two blocks above called `formatDistance` correctly.
                          On the fallback path a miles user saw **8.1mi for an 8.05 km
                          run**; the truth is 5.0 mi. A 61% overstatement, silently, on
                          every completed session. The NaN was the visible half of
                          this; the wrong number was the half nobody could see. */}
                      {(effectiveMetric === 'distance'
                        ? (actualDistKm != null ? formatDistance(actualDistKm, preferredUnits) : null)
                        : actualDuration) != null && (
                        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)' }}>
                          {effectiveMetric === 'distance'
                            ? formatDistance(actualDistKm as number, preferredUnits)
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

            // SESSION-STRUCTURE-REDESIGN (2026-09-04) — per-section cards with
            // numbered steps, rendering the main set from the resolved
            // derived_set (ADR-019) when present. §84 — the main-set zone shown
            // is the prescription (session.zone), not the coarse type slot.
            const dz = displayZonesForSession(session)
            return (
              <SessionSteps
                structure={structure}
                derivedSet={(session.derived_set as DerivedSet | undefined) ?? null}
                sessionType={session.type}
                displayZones={dz?.zones ?? []}
                zoneRangeLabel={dz?.rangeLabel ?? structure.main.zone}
                metric={effectiveMetric}
                preferredUnits={preferredUnits}
                sessionDistanceKm={session.distance_km ?? null}
                easyPaceStr={aerobicPace ?? null}
                catalogueId={(session as { catalogue_id?: string }).catalogue_id}
                onInfo={() => setZoneSheetOpen(true)}
              />
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
                <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--mute)', marginBottom: 'var(--space-2)' }}>What to do</div>
                <div style={{ fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.7 }}>{session.detail}</div>
              </div>
            )
          })()}

          {/* Week focus block removed (May 2026) — it is a plan-level statement,
              not a session-level statement. Lives on Plan / Today screens. */}

          {/* ── WHY THIS SESSION ──────────────────────────────────────
               🔴 A8 (Design Board, app review 2026-09-22) — THIS USED TO SIT
               ABOVE THE STRUCTURE, and the comment below used to justify it:
               "brand-defining content reads first."

               The founder asked for the whole screen on one page. NOT GRANTED
               as stated: this screen's job is the full prescription, and
               compressing it means deleting prescription, which is the Coaching
               Board's to decide, not this board's. THE COMPLAINT IS RIGHT AND
               THE DIAGNOSIS IS WRONG — the problem was never length. The thing
               you need with a phone in your hand at the start of a rep was the
               SIXTH block down, below the reason you are doing it.

               Nothing is cut. The rationale still reads, one scroll later, when
               the runner is deciding rather than executing.
               AI mark only when content came from the plan enricher
               (session.coach_notes). DB guidance fallback is hand-authored
               so no mark — provenance honesty. */}
          {/* ── HOW TO RUN IT — §117's run-walk prescription ───────────
              🔴 WRITTEN SINCE 2026-09-20 AND RENDERED NOWHERE UNTIL NOW.
              `applyRunWalk` stamps `run_walk_strategy` onto every running
              session of a finish-goal plan, `INV-PLAN-RUNWALK-PRESCRIBED`
              asserts the stamp is present, and **zero files under app/ or
              components/ ever read it** — no commit had ever touched it.

              §117 Amendment 3 is the entire safety argument for admitting this
              runner: the lower peak lowers §111's door, and *"that trade is
              only honest if the runner is actually doing the thing the lower
              peak prepares them for."* McMillan: *"'run 40 minutes, walk if you
              need to' is a dare. '6 minutes running, 1 minute walking, ten
              times' is a session."* A prescription the runner cannot read is
              the first of those, not the second.

              ⚠️ ABOVE "WHY THIS SESSION", DELIBERATELY. This is an INSTRUCTION,
              not a rationale — CLAUDE.md's card hierarchy puts the prescription
              above the why, and the block below this one makes exactly that
              argument about its own placement.

              ⚠️ NO AIMark. `runWalkStrategy()` is rule-engine copy from §117,
              not model output. */}
          {session.run_walk_strategy && (
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border-col)' }}>
              <CoachNoteBlock label="HOW TO RUN IT">
                {session.run_walk_strategy}
              </CoachNoteBlock>
            </div>
          )}

          {/* §81's second half — SESSION-ACHIEVABLE-01 (Coaching Board 2026-10-06).
              The session is EXEMPT from the runner's stated weekday cap ("don't
              shrink to fit", unanimous), and the exemption is conditional on the
              plan saying it does not fit. Measured before this shipped: **675
              structured weekday sessions past the ratified tolerance, every one
              belonging to a runner who stated 30 minutes**, worst 86 min against
              that 30 — and the card said nothing.

              🎯 McMillan: *"They do not conclude the session is ambitious; they
              conclude the app does not listen."*

              ⚠️ ABOVE "WHY THIS SESSION", like the run-walk block it mirrors:
              this is an INSTRUCTION about what the session asks of their day, not
              a rationale, and CLAUDE.md's card hierarchy puts the prescription
              above the why.

              ⚠️ NO AIMark. Rule-engine copy from §81, not model output. */}
          {session.weekday_overrun_note && (
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border-col)' }}>
              <CoachNoteBlock label="LONGER THAN YOUR WEEKDAY">
                {session.weekday_overrun_note}
              </CoachNoteBlock>
            </div>
          )}

          {(session.coach_notes?.filter(Boolean).length > 0 || guidance) && (
            <div style={{ padding: '14px 18px', borderBottom: '0.5px solid var(--border-col)' }}>
              <CoachNoteBlock
                label="WHY THIS SESSION"
                variant="why"
                aiGenerated={aiNotes}
              >
                {session.coach_notes?.filter(Boolean).length > 0 ? (
                  // Structured coach notes from plan JSON (AI-generated). Pass through
                  // renderGuidance so {{token}} placeholders the enricher emitted resolve
                  // to live values (Z2 ceiling, session HR, etc.) rather than carrying
                  // stale baked literals after the athlete updates restingHR/maxHR.
                  renderGuidance(
                    // UNITS-PROSE-01 — coach notes bake `km` at generation time.
                    convertDistanceString((session.coach_notes as string[]).filter(Boolean).join(' '), preferredUnits) ?? '',
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

          {/* ── HOW DID IT FEEL (shown when complete or skipped) ──
               Moved above the sticky CTA — the reflective state outranks
               the corrective action. Was previously rendered below the
               sticky bar, which inverted the layout. */}
          {(isComplete || isSkipped) && (
            <div style={{ padding: '18px 18px 8px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--space-4)' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.2px' }}>
                  How did it feel?
                </div>
                {savingRPE && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)' }}>saving…</span>}
              </div>

              {/* RPE — RPEScale shared component */}
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <RPEScale
                  value={rpe}
                  onChange={(n) => { setRpe(n); saveRPEFatigue(n, fatigueTag) }}
                  hint="On an easy run, a 3–4 is what you want."
                />
              </div>

              {/* Fatigue tags */}
              <div style={{ marginBottom: '4px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>Body feeling</div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {FATIGUE_TAGS.map(tag => {
                    const isActive = fatigueTag === tag
                    const tagColor = tag === 'Fresh' ? 'var(--moss)' : tag === 'Fine' ? 'var(--moss)' : tag === 'Heavy' ? 'var(--warn)' : 'var(--danger)'
                    return (
                      <button key={tag} onClick={() => { const next = isActive ? null : tag; setFatigueTag(next); saveRPEFatigue(rpe, next) }}
                        style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '10px 18px', minHeight: '44px', borderRadius: '20px', border: `1px solid ${isActive ? tagColor : 'var(--line)'}`, background: isActive ? `color-mix(in srgb, ${tagColor} 9%, transparent)` : 'transparent', color: isActive ? tagColor : 'var(--mute)', cursor: 'pointer', fontWeight: isActive ? 500 : 400, transition: 'all 0.12s' }}>
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
            display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap',
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
                    <Button
                      onClick={isManualCompletion ? () => setShowManualModal(true) : handleMarkComplete}
                      variant={isRpeSet ? 'primary' : 'secondary'}
                      style={{
                        flex: 1, borderRadius: '10px', padding: '13px', fontSize: '12px',
                        letterSpacing: isRpeSet ? '0.06em' : '0.04em',
                        textTransform: isRpeSet ? 'uppercase' : 'none',
                      }}
                    >
                      Update log
                    </Button>
                    {/* DS-07 Part B — stack a second activity onto a logged run
                        (e.g. hike + treadmill top-up = one session). */}
                    {isComplete && isRunType && (
                      <Button variant="ghost" 
                        onClick={() => { setManualAccumulate(true); setShowManualModal(true) }} style={{ flexBasis: '100%', fontSize: '12px', padding: '6px 0', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
                        + Add another effort
                      </Button>
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
                    // SESSION-DIST-UNITS-01 — km with a unit suffix, unconverted.
                    const distStr = km != null
                      ? (formatDistance(km, preferredUnits, { exact: true }) ?? null)
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', width: '100%' }}>
                        <Button
                          onClick={handleMarkComplete}
                          variant={isHigh ? 'primary' : 'secondary'}
                          fullWidth
                          style={{
                            borderRadius: '10px', padding: '13px', fontSize: '12px',
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                          }}
                        >
                          {isHigh ? 'Log this run' : 'Looks like this one?'}
                        </Button>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
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
                          <Button variant="ghost" className="btn--inline-target" 
                            onClick={() => setView('complete')} style={{ padding: '6px 0', fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', minHeight: '32px' }}>
                            Wrong one?
                          </Button>
                          <span style={{ padding: '0 8px', color: 'var(--mute-2)' }}>·</span>
                          <Button variant="ghost" className="btn--inline-target" 
                            onClick={() => setShowManualModal(true)} style={{ padding: '6px 0', fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', minHeight: '32px' }}>
                            Enter it manually
                          </Button>
                          <span style={{ padding: '0 8px', color: 'var(--mute-2)' }}>·</span>
                          <Button variant="ghost" className="btn--inline-target" 
                            onClick={() => setView('skip')} style={{ padding: '6px 0', fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', minHeight: '32px' }}>
                            Skip
                          </Button>
                        </div>
                      </div>
                    )
                  }
                  return (
                    <>
                          {/* 📐 `compact`, NOT `regular` (LINK-HIERARCHY-01). Measured at
                              375pt: `regular`'s `padding: 15px 20px` at `flex: 1`
                              leaves too little room, so BOTH labels wrapped to two
                              lines and the row rendered **74px** against a 44px
                              floor. `compact` puts each on one line at exactly 44.
                              The founder: *"they look too big/fat"* — and it was
                              the size class, not the copy and not the uppercase,
                              which measured identical at 74px. */}
                      {/* SESSION-ACTIONS-01 — one grammar: secondary LEFT,
                          primary RIGHT, one size class, 2:1. `Skip` left the
                          primary row: it is not a peer of "I did this"
                          (Collins), and three equal-width buttons told the
                          runner three outcomes were equally likely (Zhuo). */}
                      {/* 🔴 LOG-ONE-INTENTION-01 — ONE button, not two.
                          "Match a run" and "Log manually" were the same
                          intention ("I did this run") differing only in whether
                          we can find the data — Collins, September. The runner
                          was being asked a question `handleMarkComplete` already
                          answers: auto-match logs against it, no match opens the
                          picker, and the picker now carries manual entry so
                          nothing is lost by removing its sibling here.

                          "run", not "session": the runner ran. */}
                      <Button variant="primary" size="compact" onClick={handleMarkComplete} style={{ flex: 1, minWidth: '120px', fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '10px' }}>
                        Log this run
                      </Button>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%' }}>
                        <Button variant="ghost"  onClick={() => setView('skip')} style={{ flex: 1 }}>
                          Skip
                        </Button>
                      </div>
                    </>
                  )
                } else {
                  return (
                    <div style={{ display: 'flex', gap: 'var(--space-2)', width: '100%' }}>
                      {/* RESHAPE-FIX-WAVE2B (Defect 10): non-run "Mark as done"
                          previously fired saveCompletion('complete') with no
                          activity / no RPE / no fatigue — producing a bare
                          stub the engine couldn't distinguish from a real
                          session. Routes to reflect now; RPE chip-tap creates
                          the row with metadata via saveReflect. */}
                      <Button variant="ghost"  onClick={() => setView('skip')} style={{ flex: 1 }}>
                        Skip
                      </Button>
                      <Button variant="primary"  onClick={() => setView('reflect')} disabled={saving} style={{ flex: 2, fontSize: '12px', letterSpacing: '0.06em', textTransform: 'uppercase', borderRadius: '10px' }}>
                        Mark as done
                      </Button>
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
          <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--teal)', marginBottom: 'var(--space-4)' }}>Link an activity</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Optional, select from recent runs</div>
          {loadingClaimed ? (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0' }}>Loading activities...</div>
          ) : claimedError ? (
            // Explicit failure path. Without this branch the same UI rendered
            // for a real load error as for "no matches" — silent breakage was
            // unrecoverable by sight. Honest one-line says what happened and
            // points to the only meaningful next action (retry by reopening).
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--warn)', padding: '12px 0', marginBottom: 'var(--space-2)', lineHeight: 1.5 }}>
              Couldn&apos;t load activities. Tap Back, then try again.
            </div>
          ) : stravaRuns.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', maxHeight: '200px', overflowY: 'auto',
                          /* SCROLL-NATIVE-01 — a 200px list inside a screen. Without this,
                             reaching its end scrolls the whole screen underneath it. */
                          overscrollBehavior: 'contain' }}>
              {stravaRuns.slice(0, 20).map((run: any) => {
                const isSelected = selectedActivity?.id === run.id
                return (
                  /* 🔴 (2) THIS WAS A `<div onClick>` — NOT A BUTTON AT ALL.
                     No role, no tabIndex, no focus ring: invisible to the
                     keyboard and to a screen reader. The founder: *"the Run
                     (Connect) above Log without activity is actually a button.
                     It's not clear."* It was not clear because it was not one.

                     🔴 (3) AND ITS FILL SEPARATED FROM ITS GROUND BY **ZERO
                     LEVELS** — `--bg` painted on `--bg`, marked only by an 8%
                     hairline. `GHOST-AFFORDANCE-01` already forbids this: a
                     primary action on its screen takes a surface, and on this
                     screen picking a run IS the primary action.

                     Now `--bg-soft` + a 1px hairline, which is ruling `:191`'s
                     inset pattern verbatim, and `--moss-soft` / `--moss-mid`
                     when selected.

                     ⚠️ THE EDGE IS `--chrome-edge` (14%), NOT `--line` (8%), and
                     that FOLLOWS settled ground rather than choosing. `ICON-EDGE-01`
                     ruled THIS MORNING that `--bg-soft`'s 7.7 levels against the
                     page ground is not enough on its own for a control — it is
                     less than the nav tint the founder was shown and could not
                     see. Same evidence, same day, same answer — a CONDITIONAL fill, which `:240` permits as
                     a selected state. `aria-pressed` carries the selection,
                     because a checkmark glyph announces nothing. */
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setSelectedActivity(isSelected ? null : run)}
                    aria-pressed={isSelected}
                    style={{
                    // 🔴 TAP-TARGET-DECISIONS-01 batch 8a — was 37px. NOT converted:
                    // this is a full-width SELECTED LIST ROW and no shared primitive
                    // owns that shape. `Chip` and `SegmentedControl` are both the wrong
                    // job, and inventing a third primitive for one call site is how a
                    // design system acquires near-duplicates.
                    minHeight: TAP_TARGET_MIN_PX,
                    width: '100%', textAlign: 'left', font: 'inherit', cursor: 'pointer',
                    background: isSelected ? 'var(--moss-soft)' : 'var(--bg-soft)',
                    border: `1px solid ${isSelected ? 'var(--moss-mid)' : 'var(--chrome-edge)'}`,
                    borderRadius: '12px', padding: '10px 12px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--ink)', fontWeight: 500 }}>{run.name}</div>
                      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {formatDate(run.start_date, 'short')} · {formatDistance(run.distance / 1000, preferredUnits, { exact: true })} {run.average_heartrate ? `· ${Math.round(run.average_heartrate)} bpm` : ''} · {run.source === 'apple_health' ? 'Apple Health' : 'Strava'}
                      </div>
                    </div>
                    {isSelected && <span aria-hidden style={{ color: 'var(--moss-strong)', fontSize: '16px' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', padding: '12px 0', marginBottom: 'var(--space-2)' }}>No activities found near this session date</div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="compact" onClick={() => setView('detail')} style={{ flex: 1 }}>Back</Button>
            {/* RESHAPE-FIX-WAVE2B (Defect 10): the 2026-06-26 incident's
                phantom completion came from this exact button — tapped
                with no activity selected, it wrote a bare stub the engine
                then displayed as "Long run done on Thursday." Behaviour:
                with an activity selected → save it (existing path). With
                no activity → route to reflect where RPE chip-tap creates
                the row with body-state metadata. No path from this view
                produces a bare stub now. */}
            {/* 🔴 (4) THE HIERARCHY WAS INVERTED AND THE SCREEN ARGUED WITH ITSELF.
                The runner taps a green **MATCH A RUN** and lands here, where the
                loudest control said **LOG WITHOUT ACTIVITY** while the run they
                came to link sat above as an invisible div. This screen promoted
                the opposite of the action that reached it.

                ⚠️ THE PREFERENCE IS DOCTRINAL, NOT TASTE. ADR-011: HealthKit is
                the SOR and carries the HR stream; a manual log carries none, and
                CLAUDE.md states the consequence — those runners "get no HR-based
                coaching". Linking is materially better COACHING, not tidier data.

                So the primary EMERGES once a run is picked. Before that the row
                has no primary, deliberately: **the primary is the run card.**
                ⚠️ `SESSION-ACTIONS-01` flagged a primary-less row as a defect —
                this one is intentional and says so, so it is not "fixed" later. */}
            <Button variant={selectedActivity ? 'primary' : 'secondary'} size="compact"
              onClick={() => selectedActivity ? saveCompletion('complete', selectedActivity) : setView('reflect')}
              disabled={saving}
              style={{ ...MICRO_LABELS.sectionLabel, flex: 2 }}>
              {saving ? 'Saving...' : (selectedActivity ? 'Confirm complete' : 'Just mark it done')}
            </Button>
          </div>

          {/* 🔴 LOG-ONE-INTENTION-01 — the manual-entry route MOVED here; it was
              not deleted. Removing the standalone "Log manually" from the detail
              view would otherwise strand the runner whose run never reached
              HealthKit (ADR-011 §5) with no way to enter a distance at all —
              "Just mark it done" records the session without one. That
              population is real and this is the whole of what they lose if it
              is missed, so it is a row rather than a rename. */}
          {!selectedActivity && (
            <Button variant="ghost" size="compact" fullWidth className="btn--inline-target"
              onClick={() => setShowManualModal(true)} style={{ marginTop: 'var(--space-2)' }}>
              Enter it manually
            </Button>
          )}
        </div>
      )}

      {/* ManualRunModal — opened from session screen, pre-filled with session context */}
      {showManualModal && (
        <ManualRunModal
          weekN={weekN}
          sessionKey={session.key}
          sessionDate={session.rawDate ?? null}
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
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-5)' }}>
            Skip it. It'll stay in your log.
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="compact" onClick={() => setView('detail')} style={{ flex: 1 }}>Back</Button>
            <Button variant="primary"  onClick={() => saveCompletion('skipped')} disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Saving...' : 'Mark as skipped'}
            </Button>
          </div>
        </div>
      )}

      {/* Zone education sheet (ZONE-SHEET-01) */}
      {zoneSheetOpen && (() => {
        // §84: the sheet reads `session.zone`, NOT the coarse `session.type`.
        //
        // ZONE-SHEET-01 (2026-09-12). This called `zoneForSessionType(session.type)`
        // and `sessionHRBand(session.type, …)` — the pre-§84 path the header was
        // moved off and the sheet was not. Measured across the 621-plan cohort,
        // the sheet disagreed with the header directly above it on 837 sessions
        // (2.3%): 549 where the header read "Zone 4–5" and tapping it taught
        // ZONE 3, showing the LOWER Zone 3 HR band on VO2max work, plus 288
        // segmented long runs (Zone 2–3 header, Zone 2 sheet). Teaching a runner
        // that hard work is moderate is the exact harm §84 names.
        //
        // Falls back to the type-derived zone ONLY for legacy plans carrying no
        // `session.zone` — §84's own graceful-degradation rule.
        const keyFromZone = zoneKeyForZoneString(session.zone)
        const fallback = keyFromZone ? null : zoneForSessionType(session.type)
        const zoneKey = keyFromZone ?? fallback?.zone ?? null
        if (!zoneKey) return null
        const band = keyFromZone
          ? hrBandForZoneString(session.zone, restingHR ?? null, maxHR ?? null)
          : sessionHRBand(session.type, restingHR ?? null, maxHR ?? null)
        return <ZoneInfoSheet zoneKey={zoneKey} hrBand={band ? { lo: band.lo, hi: band.hi } : null} onClose={() => setZoneSheetOpen(false)} />
      })()}
    </>
  )
}
