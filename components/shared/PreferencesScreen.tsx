'use client'

// PreferencesScreen — ME-DOORS-01, executing ME-PURPOSE-01 (Design Board, 2026-09-28).
//
// The first door off the index. Display and notification preferences, which sat inline on
// Me as two separate sections, now live behind one row.
//
// ── 🔴 WHY THESE TWO TOGETHER, AND NOT FIVE SEPARATE DOORS ──────────────────
// The board ruled *"nothing lives on Me, every row is a door"* on per-SCREEN totals — 780
// lines, 8 blocks, ZERO `ActionRow` uses, all correct. Measuring per BLOCK afterwards:
// **Display holds 2 segmented controls and Notifications holds one toggle.** A door onto
// two segmented controls is one more tap and an emptier screen; Wroblewski's own lens
// argues against that as hard as the ruling argues for it.
//
// So: one coherent screen of four controls, decided as architect and recorded in
// `backlog.md` with the measurement. The ruling owns the principle; the door count is
// implementation.
//
// ⚠️ NOTHING HERE IS NEW. Every control is lifted unchanged — `SegmentedControl`,
// `PushNotificationsRow`, `DailyPushToggleRow`. The point of the move is the INDEX, not a
// redesign, and changing behaviour in the same commit as a relocation is how a move
// becomes un-reviewable.

import type React from 'react'
import { useState } from 'react'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import SettingsWriteError from '@/components/shared/SettingsWriteError'
import { settingsWriteFailureMessage } from '@/lib/supabase/userSettingsWrite'

/** Named once. The row label and the screen title cannot drift apart. */
export const PREFERENCES_TITLE = 'Preferences'
export const PREFERENCES_SUBTITLE = 'Units, session display, notifications'

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px',
}
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.55,
}
const subStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px',
}
const cardStyle: React.CSSProperties = {
  background: 'var(--card)', borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden',
}

export interface PreferencesScreenProps {
  /** Global distance unit (ADR-015). */
  preferredUnits: 'km' | 'mi'
  /** USER-SETTINGS-TELL-THE-RUNNER-01 — resolves false when the write did not land, so the
   *  row can say so. `PROFILE-IDENTITY-01`'s `onSaveName` is the precedent, in this screen's parent. */
  onUnitsChange: (u: 'km' | 'mi') => void | Promise<boolean>
  /** Default metric on session cards. */
  preferredMetric: 'distance' | 'duration'
  onMetricChange: (m: 'distance' | 'duration') => void | Promise<boolean>
  /** The push rows, passed in rather than imported. See below. */
  notifications?: React.ReactNode
}

export function PreferencesScreen({
  preferredUnits, onUnitsChange,
  preferredMetric, onMetricChange,
  notifications,
}: PreferencesScreenProps) {
  // 🧭 Design Board 2026-11-14: inline, beneath the control that failed, value untouched.
  // The amendment is the clearing: a failure that later succeeds must not leave a red line on
  // a row that is now correct, so each handler resets its own message before awaiting.
  const [unitsError, setUnitsError] = useState<string | null>(null)
  const [metricError, setMetricError] = useState<string | null>(null)

  // ⚠️ ONLY AN EXPLICIT `false` IS A FAILURE. A `void`-returning handler resolves to
  // `undefined`, so testing truthiness would make every legacy caller start showing an error
  // on a write that succeeded — the opposite defect, and the louder one.
  async function handleUnits(u: 'km' | 'mi') {
    setUnitsError(null)
    const ok = await onUnitsChange(u)
    if (ok === false) setUnitsError(settingsWriteFailureMessage('unit preference'))
  }
  async function handleMetric(m: 'distance' | 'duration') {
    setMetricError(null)
    const ok = await onMetricChange(m)
    if (ok === false) setMetricError(settingsWriteFailureMessage('session display'))
  }
  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-7)' }}>

      <div style={cardStyle}>
        <div style={{ ...rowStyle, borderBottom: '1px solid var(--line)' }}>
          <div>
            <div style={labelStyle}>Distance units</div>
            <div style={subStyle}>Pace brackets and distances</div>
          </div>
          <div style={{ width: '108px', flexShrink: 0 }}>
            <SegmentedControl
              ariaLabel="Distance units"
              value={preferredUnits}
              onChange={handleUnits}
              options={[{ value: 'km', label: 'KM' }, { value: 'mi', label: 'MI' }]}
            />
            <SettingsWriteError message={unitsError} />
          </div>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>Session display</div>
            <div style={subStyle}>Default metric on session cards</div>
          </div>
          <div style={{ width: '168px', flexShrink: 0 }}>
            <SegmentedControl
              ariaLabel="Session display metric"
              value={preferredMetric}
              onChange={handleMetric}
              options={[{ value: 'distance', label: 'Distance' }, { value: 'duration', label: 'Duration' }]}
            />
            <SettingsWriteError message={metricError} />
          </div>
        </div>
      </div>

      {/* ⚠️ THE PUSH ROWS ARE PASSED IN, NOT IMPORTED, and that is deliberate.
          `PushNotificationsRow` owns permission state that `DashboardClient` already holds
          and threads (`setPushSubscribed`, and the paid gate on the daily toggle). Pulling
          that state down here would put a second owner of "is push registered?" in the
          tree — the D-08 duplicate-ownership shape this repo keeps paying for.

          It is also why this screen renders NOTHING when the caller passes nothing: a
          free runner has no daily-push row, and an empty card with a heading is worse
          than no card. Empty means calm, not broken. */}
      {notifications}
    </div>
  )
}
