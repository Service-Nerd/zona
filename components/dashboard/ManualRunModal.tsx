'use client'

// DASHBOARD-SCREEN-EXTRACT-02 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14k-line file, so it closed over nothing and this
// move changes no behaviour. What it changes is REACH: nothing could import it, so it
// could not be rendered by a harness or a mounting test.
//
// ⚠️ The body is UNCHANGED. Edit it in a separate commit so the move stays a move.

import { fmtDurationMins, getReflectResponse, rpeColour } from '@/components/dashboard/dashboardHelpers'
import { DurationPicker } from '@/components/shared/DurationPicker'
import Sheet from '@/components/shared/Sheet'
import { TextArea } from '@/components/shared/TextArea'
import { TextField } from '@/components/shared/TextField'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import Button from '@/components/ui/Button'
import IconButton from '@/components/ui/IconButton'
import { getCoachingFlag } from '@/lib/coaching/coachingFlag'
import { FATIGUE_TAGS } from '@/lib/coaching/completionVocab'
import { formatDistance } from '@/lib/format'
import { upsertCompletion } from '@/lib/plan/completions'
import { getSessionColor } from '@/lib/session-types'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { createClient } from '@/lib/supabase/client'
import type { Session } from '@/types/plan'
import { useState } from 'react'

export default function ManualRunModal({ weekN, sessionKey, preferredUnits, onClose, onSaved, sessionName, sessionType, plannedDistanceKm, plannedDurationMins, loggedDistanceKm, isEdit, accumulate, existingTotalKm, existingEffortCount, offPlan = false, sessionDate }: {
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
  /**
   * 🔴 LOG-OFFPLAN-02 — a run the plan did not prescribe.
   *
   * Before this there was NO way to record one. `session_completions` is keyed
   * `(user_id, week_n, session_day)` — a plan coordinate — so a run with no
   * session day had no slot, and the save path's `sessionKey ?? todayKey`
   * bound every manual log to a prescribed day whether or not one was meant.
   * On a rest day `showSessionHero` is false, so no control rendered at all:
   * **4 of 7 days on a 3-day plan.**
   *
   * In this mode the modal writes the ACTIVITY ROW ONLY — the same
   * `/api/health/ingest` `source: 'manual'` call the session path already
   * makes — and skips the completion and the scoring. That is not a shortcut:
   * an off-plan run has no prescription to be scored against, and
   * `LOG-OFFPLAN-01`'s owner reads exactly this shape as `offPlanKm`, so the
   * run reaches actual load and shadow load and never the auto-trimming ratio.
   */
  offPlan?: boolean
  /**
   * 🔴 LOAD-DEDUPE-MANUAL-01 — WHEN THE RUN HAPPENED, not when it was typed.
   *
   * The ingest call stamped `new Date().toISOString()`, so a Monday run logged
   * on Wednesday was recorded as a Wednesday run. That is wrong for everything
   * downstream that reads `start_date`: `bucketLoadByPlanWeek` can file it in
   * the wrong PLAN WEEK, and the §58 cohort and pace trend order it wrongly.
   *
   * Measured on production: two 7.5 km logs entered in one sitting for
   * `week_1 mon` and `week_1 wed` both carry the same timestamp, which is what
   * made them look like one duplicated run.
   *
   * Optional, and falls back to now — an off-plan log genuinely has no session
   * date, and a caller that cannot supply one must still be able to log.
   */
  sessionDate?: string | Date | null
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
  const [savedStep, setSavedStep] = useState(false)
  const [reflectResponse, setReflectResponse] = useState<string | null>(null)
  const supabase = createClient()

  const sessionColour = sessionType ? getSessionColor(sessionType) : 'var(--teal)'

  // Sheet owns the enter/exit animation; this is just the semantic teardown it
  // calls once the exit has played. onSaved() fires only if the runner reached
  // the reflect step (a completion was written).
  function requestUnmount() {
    if (savedStep) onSaved()
    onClose()
  }

  const todayKey = ['sun','mon','tue','wed','thu','fri','sat'][new Date().getDay()]
  /** LOAD-DEDUPE-MANUAL-01 — when the RUN happened. `sessionDate` when the
   *  caller knows it, else now (an off-plan log has no session to date from). */
  const loggedAtIso = (() => {
    if (!sessionDate) return new Date().toISOString()
    const d = new Date(sessionDate)
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
  })()
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
      const durationSecs = hours * 3600 + minutes * 60 + seconds

      // 🔴 LOG-OFFPLAN-02 — the activity log ONLY. No completion (there is no
      // session to complete) and no scoring (there is no prescription to score
      // against). ⚠️ AWAITED, not fire-and-forget: on the session path the
      // completion is the durable record and the ingest is a supplement, so a
      // dropped call loses enrichment. Here the ingest IS the record, and a
      // silent failure would look exactly like a run that was never logged.
      if (offPlan) {
        const res = await authedFetch('/api/health/ingest', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source:          'manual',
            // Unique per run, NOT per session — two off-plan runs on one day are
            // two runs. The session path's `manual-w{n}-{day}` key is
            // deliberately deterministic so a re-log upserts; that is the wrong
            // semantic here and reusing it would silently overwrite the first.
            manualUuid:      `manual-offplan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            startDate:       loggedAtIso,
            distanceMeters:  Math.round(distKm * 1000),
            durationSeconds: durationSecs,
            avgHeartRate:    avgHr ?? undefined,
            name:            notes || undefined,
          }),
        })
        if (!res.ok) { setSaving(false); return }
        setSavedStep(true)
        return
      }

      if (accumulate) {
        // DS-07 Part B — add this effort onto the existing logged total. Preserve
        // any existing activity link (omit strava_activity_id) — the distance
        // becomes the composite aggregate, the name carries the effort count.
        const finalKm   = (existingTotalKm ?? 0) + distKm
        const count     = (existingEffortCount ?? 1) + 1
        const finalDisp = (preferredUnits === 'mi' ? finalKm / 1.60934 : finalKm).toFixed(1)
        await upsertCompletion(supabase, {
        week_n: weekN,
          session_day: key,
          status: 'complete',
          strava_activity_name: `${count} efforts · ${finalDisp}${preferredUnits}`,
          strava_activity_km: +finalKm.toFixed(1),
        })
        setSavedStep(true)
        return
      }

      await upsertCompletion(supabase, {
        week_n: weekN,
        session_day: key,
        status: 'complete',
        strava_activity_id: null,
        strava_activity_name: notes || `Manual log · ${distanceStr}${preferredUnits} · ${durationStr}`,
        strava_activity_km: +distKm.toFixed(1),
        // rpe / fatigue_tag intentionally omitted: on a DS-07 edit this upsert
        // must not wipe body-state the runner already logged. New logs leave
        // them null (schema default) and set them in the reflect step below.
      })
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
            // LOAD-DEDUPE-MANUAL-01 — the SESSION's date when we know it.
            startDate:       loggedAtIso,
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
      await upsertCompletion(supabase, {
        week_n: weekN, session_day: key,
        status: 'complete', rpe: newRpe, fatigue_tag: newTag,
        coaching_flag: flag,
      })
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
    letterSpacing: '0.08em', marginBottom: 'var(--space-2)',
  }

  return (
    <Sheet onClose={requestUnmount} maxHeightVh={90} ariaLabel="Log a run">
      {(close) => (
      <div style={{ padding: '0 20px 24px' }}>
        {/* ── REFLECT STEP — shown after save ── */}
        {/* 🔴 LOG-OFFPLAN-02 — an off-plan run has NO reflect step, and that is a
            correctness constraint rather than a trim. The chips below call
            `saveReflect`, which upserts `session_completions` at
            `sessionKey ?? todayKey` — on a rest day that would invent a
            completion for a session the plan never prescribed, and on a run day
            it would silently mark the prescribed session done because the
            runner logged an EXTRA run. Both are the defect this item exists to
            end. RPE without a prescription has nothing to be an effort
            relative to; the run still reaches load via the activity row. */}
        {savedStep && offPlan ? (
          <div style={{ padding: '8px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--teal-soft)', border: '0.5px solid var(--teal-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Logged.</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)' }}>{distanceStr}{preferredUnits} · {durationStr}</div>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-5)' }}>
              It counts toward your week. Your plan is unchanged.
            </div>
            <Button variant="primary" fullWidth onClick={requestUnmount}>Done</Button>
          </div>
        ) : savedStep ? (
          <div style={{ padding: '8px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
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

            <div style={{ height: '0.5px', background: 'var(--border-col)', marginBottom: 'var(--space-5)' }} />

            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '19px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
              How did that land?
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-5)' }}>
              Effort and body state. That's all I need.
            </div>

            {/* RPE */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Effort (RPE)</div>
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
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Body state</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {FATIGUE_TAGS.map(tag => {
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
              minHeight: '48px', marginBottom: 'var(--space-4)',
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
              onClick={close}
              variant={reflectResponse ? 'primary' : 'secondary'}
              fullWidth
              style={{
                padding: '14px', borderRadius: '12px', fontSize: '13px',
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}
            >
              {reflectResponse ? 'Done' : 'Skip for now'}
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>{accumulate ? 'Add another effort' : isEdit ? 'Update your log' : 'Log a run'}</div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {accumulate
                    ? `Adds to your ${formatDistance(existingTotalKm ?? 0, preferredUnits, { exact: true }) ?? ''} so far`
                    : isEdit ? 'Correct what you logged' : 'Manual entry · no Strava needed'}
                </div>
              </div>
            </div>

            {/* Session context strip — shown when opened from a planned session */}
            {sessionName && (
              <div style={{
                background: `color-mix(in srgb, ${sessionColour} 8%, transparent)`,
                border: `0.5px solid color-mix(in srgb, ${sessionColour} 30%, transparent)`,
                borderRadius: '10px', padding: '10px 14px', marginBottom: 'var(--space-5)',
              }}>
                <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: 'var(--font-ui)', color: sessionColour, marginBottom: '3px' }}>
                  Planned
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {sessionName}
                </div>
                {(plannedDistanceKm != null || plannedDurationMins != null) && (
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {/* SESSION-DIST-UNITS-01 — was the raw km with a unit suffix. */}
                    {plannedDistanceKm != null ? (formatDistance(plannedDistanceKm, preferredUnits) ?? '') : ''}
                    {plannedDistanceKm != null && plannedDurationMins != null ? ' · ' : ''}
                    {plannedDurationMins != null ? fmtDurationMins(plannedDurationMins) : ''}
                    {' · '}<span style={{ opacity: 0.6 }}>edit below if different</span>
                  </div>
                )}
              </div>
            )}

            {/* Distance */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={labelStyle}>Distance ({preferredUnits})</div>
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--line)', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', padding: '14px 8px' }}>
                  {/* 🔴 THESE FOUR PASSED `border: '0.5px solid var(--line)'` INLINE,
                      and an inline style beats a class — so `ICON-EDGE-01`'s
                      `1px var(--chrome-edge)`, ruled and shipped the same day,
                      never landed on them. It also broke § 20 ("always 1px, not
                      0.5px"). NAV-PILL-FLUSH-01's lesson exactly: the gates
                      assert a rule exists with the right values and never that
                      those values WIN. Only the 18px glyph is the call site's. */}
                  <IconButton onClick={() => setDistWhole(Math.max(0, distWhole - 1))} ariaLabel="Decrease whole distance" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>−</span>} />
                  <span
                    role="spinbutton"
                    aria-label="Whole distance"
                    aria-valuenow={distWhole}
                    aria-valuemin={0}
                    aria-valuetext={`${distWhole} ${preferredUnits}`}
                    style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--ink)', minWidth: '32px', textAlign: 'center' }}
                  >{distWhole}</span>
                  <IconButton onClick={() => setDistWhole(distWhole + 1)} ariaLabel="Increase whole distance" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>+</span>} />
                </div>
                <div aria-hidden style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--mute)', padding: '0 4px' }}>.</div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', padding: '14px 8px' }}>
                  <IconButton onClick={() => setDistDecimal(Math.max(0, distDecimal - 1))} ariaLabel="Decrease distance decimal" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>−</span>} />
                  <span
                    role="spinbutton"
                    aria-label="Distance decimal"
                    aria-valuenow={distDecimal}
                    aria-valuemin={0}
                    aria-valuemax={9}
                    aria-valuetext={`point ${distDecimal}`}
                    style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--ink)', minWidth: '16px', textAlign: 'center' }}
                  >{distDecimal}</span>
                  <IconButton onClick={() => setDistDecimal(Math.min(9, distDecimal + 1))} ariaLabel="Increase distance decimal" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>+</span>} />
                </div>
              </div>
              <div aria-live="polite" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '4px', textAlign: 'center' }}>{distanceStr} {preferredUnits}</div>
            </div>

            {/* Duration — shared wheel primitive (FORMS-PRIM-01), no keyboard,
                no iOS zoom trap, one owner of the HH:MM:SS control. */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={labelStyle}>Duration</div>
              <DurationPicker
                hours={hours} mins={minutes} secs={seconds}
                maxHours={12}
                onHoursChange={setHours} onMinsChange={setMinutes} onSecsChange={setSeconds}
              />
            </div>

            {/* Average HR — DS-06, optional. Stored on the run; unlocks a coarse
                zone-discipline read in the coaching card. 16px font avoids the
                iOS focus-zoom trap. */}
            {!accumulate && (
              <div style={{ marginBottom: 'var(--space-5)' }}>
                <div style={labelStyle}>Average HR <span style={{ ...MICRO_LABELS.eyebrow, letterSpacing: 0, opacity: 0.6 }}>optional · bpm</span></div>
                {/* ⚠️ `TextField`, not a raw <input> (STEPPER-CONTROL-01 (c),
                    Design Board 2026-09-25). This sat beside `DurationPicker`
                    — a component that exists precisely so nobody hand-rolls a
                    control — and was a bare <input> with nine inline styles.
                    `ui-patterns.md` § Ruler names the routing in as many words:
                    a precise number the runner KNOWS is `TextField`'s job.
                    Silvanto: "that is not a redesign, it is using what we have."
                    The 16px font that avoids the iOS focus-zoom trap is
                    `TextField`'s, so the comment above is now its problem. */}
                <TextField
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
                  ariaLabel="Average heart rate in beats per minute"
                  min={60}
                  max={240}
                  value={avgHr === null ? '' : String(avgHr)}
                  onChange={v => {
                    const n = parseInt(v, 10)
                    setAvgHr(Number.isFinite(n) ? Math.min(240, Math.max(60, n)) : null)
                  }}
                />
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  From your watch or chest strap, if you had one.
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <div style={labelStyle}>Notes <span style={{ ...MICRO_LABELS.eyebrow, letterSpacing: 0, opacity: 0.6 }}>optional</span></div>
              {/* 🔴 13px HERE WAS A LIVE iOS TRAP, and `TextField.tsx`'s own
                  header had already written it down: below 16px iOS zooms the
                  focused input and `maximum-scale=1` strands the runner zoomed
                  in. It sat ELEVEN LINES below the Average HR field that
                  `STEPPER-CONTROL-01 (c)` moved onto `TextField` for exactly
                  that reason — the remedy applied to one twin. */}
              <TextArea
                placeholder="Anything worth remembering?"
                ariaLabel="Notes about this run"
                value={notes}
                onChange={setNotes}
                rows={2}
              />
            </div>

            {/* Save */}
            {/* ⚠️ THE FOUNDER NAMED THIS BUTTON AND I DID NOT CHECK IT (2026-09-25):
                  *"there is also a save button at the bottom"*. It was still
                  hand-rolled after every other control in this flow had moved,
                  and `buttonOwnership.test.ts`'s "a FILLED control is on the
                  shared system" arm could not see it for TWO reasons at once:
                  it was filled with `--teal`, a legacy ALIAS of `--moss`, and
                  its label colour was a CONDITIONAL rather than the literal
                  `var(--card)` the arm matched. Both arms widened in the same
                  commit. Geometry (16px padding, 14px radius) is preserved
                  inline per BUTTON-GEOMETRY-01 — this is a colour change. */}
              <Button
                onClick={save}
                fullWidth
                disabled={!hasData}
                busy={saving}
                busyLabel="Saving…"
                style={{
                  padding: '16px', borderRadius: '14px',
                  fontFamily: 'var(--font-brand)', letterSpacing: '-0.1px',
                }}
              >
                {hasData ? `Save · ${distanceStr}${preferredUnits} · ${durationStr}` : 'Enter distance or duration'}
              </Button>
          </>
        )}
      </div>
      )}
    </Sheet>
  )
}
