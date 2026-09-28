// LOCAL DESIGN HARNESS — 404s in production, not linked from anywhere, not in the sitemap.
//
// ME-DOORS-01. Exists for the same reason `/me-preview` does: the Preferences door sits
// behind auth, a plan and a tab, so the only way to SEE it is to be signed in. That is how
// `/me-preview`'s own fixtures once shipped hand-typed two-letter initials while the real
// function returned one, and how a placeholder nobody had looked at reached a runner.
//
// ⚠️ It renders the REAL component with real state, including the free-runner case where
// `notifications` is absent and the screen must render calmly rather than show an empty
// heading. A preview that does not import the thing it previews is testing a different
// program (recorded 2026-09-26).

'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { PreferencesScreen, PREFERENCES_TITLE, PREFERENCES_SUBTITLE } from '@/components/shared/PreferencesScreen'
import ActionRow from '@/components/shared/ActionRow'
import { HEART_RATE_TITLE, HEART_RATE_UNSET_SUB, PLAN_ADJUSTMENTS_TITLE, PLAN_ADJUSTMENTS_SUB, PLAN_ADJUSTMENTS_PENDING_SUB } from '@/components/shared/meDoors'

export default function PreferencesPreview() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [units, setUnits] = useState<'km' | 'mi'>('km')
  const [metric, setMetric] = useState<'distance' | 'duration'>('distance')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '24px 0 64px' }}>
      <div style={{ maxWidth: '420px', margin: '0 auto' }}>

        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            The three doors, as the index shows them
          </div>
          <div style={{ marginTop: 'var(--space-3)', background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <ActionRow title={PREFERENCES_TITLE} subtitle={PREFERENCES_SUBTITLE} onClick={() => {}} divider />
            <ActionRow title={HEART_RATE_TITLE} subtitle={HEART_RATE_UNSET_SUB} onClick={() => {}} divider />
            <ActionRow title={HEART_RATE_TITLE} subtitle="51 / 185 bpm" onClick={() => {}} divider />
            <ActionRow title={PLAN_ADJUSTMENTS_TITLE} subtitle={PLAN_ADJUSTMENTS_SUB} onClick={() => {}} divider />
            <ActionRow title={PLAN_ADJUSTMENTS_TITLE} subtitle={PLAN_ADJUSTMENTS_PENDING_SUB} onClick={() => {}} />
          </div>
        </div>

        <div style={{ padding: '0 16px 8px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>
          Behind the first door, paid runner (notifications present)
        </div>
        <PreferencesScreen
          preferredUnits={units} onUnitsChange={setUnits}
          preferredMetric={metric} onMetricChange={setMetric}
          notifications={
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '14px 16px', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)' }}>
              [PushNotificationsRow + DailyPushToggleRow render here]
            </div>
          }
        />

        <div style={{ padding: '24px 16px 8px', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>
          Free runner: no notifications passed. No empty heading, no empty card.
        </div>
        <PreferencesScreen
          preferredUnits={units} onUnitsChange={setUnits}
          preferredMetric={metric} onMetricChange={setMetric}
        />
      </div>
    </div>
  )
}
