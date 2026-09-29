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
import { SectionLabel } from '@/components/shared/SectionLabel'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { HEART_RATE_TITLE, HEART_RATE_UNSET_SUB, PLAN_ADJUSTMENTS_TITLE, PLAN_ADJUSTMENTS_SUB, PLAN_ADJUSTMENTS_PENDING_SUB,
  CONNECTIONS_TITLE, connectionsSubtitle, ME_SECTION_ORDER } from '@/components/shared/meDoors'

export default function PreferencesPreview() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [units, setUnits] = useState<'km' | 'mi'>('km')
  const [metric, setMetric] = useState<'distance' | 'duration'>('distance')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '24px 0 64px' }}>
      <div style={{ maxWidth: '420px', margin: '0 auto' }}>

        {/* ME-ORDER-01 — every state of the Connections subtitle, which is the one
            string on the index that can LIE. `undefined` must render no subtitle at all. */}
        {/* MICRO-LABEL-DRIFT-01 — the three roles, rendered. ⚠️ THIS PAGE IS ALSO THE
            PROOF OF THE FIX: `SectionLabel` could not be imported before (it was a local
            function inside `DashboardClient`), which is exactly why `PlanCalendar` wrote
            its own. That it can appear here at all is the defect being closed. */}
        <div style={{ padding: '0 16px 24px' }}>
          <SectionLabel>Section label</SectionLabel>
          <SectionLabel right="trailing value">With a trailing value</SectionLabel>
          <div style={{ marginTop: 'var(--space-4)', background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--mute)', ...MICRO_LABELS.eyebrow }}>Eyebrow, inside a card</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--ink)', marginTop: '4px' }}>The thing it captions</div>
            <div style={{ display: 'flex', gap: 'var(--space-5)', marginTop: 'var(--space-3)' }}>
              {[['Planned', '8 km'], ['Actual', '8.2 km']].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontFamily: 'var(--font-ui)', color: 'var(--mute)', ...MICRO_LABELS.dataLabel }}>{l}</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--ink)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Connections, all four states
          </div>
          <div style={{ marginTop: 'var(--space-3)', background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            {([
              ['still loading', undefined, false],
              ['nothing connected', null, false],
              ['Apple Health only', '2026-09-01T00:00:00Z', false],
              ['both', '2026-09-01T00:00:00Z', true],
            ] as [string, string | null | undefined, boolean][]).map(([label, hk, st], i, arr) => (
              <ActionRow
                key={label}
                title={CONNECTIONS_TITLE}
                subtitle={connectionsSubtitle(hk, st) ?? undefined}
                onClick={() => {}}
                divider={i < arr.length - 1}
              />
            ))}
          </div>
          <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>
            Row 1 is the loading state: no subtitle, because a negative it cannot know yet would be a lie.
          </div>
          <div style={{ marginTop: 'var(--space-5)', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Section order: {ME_SECTION_ORDER.join(' · ')}
          </div>
        </div>

        <div style={{ padding: '0 16px 24px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            The doors, as the index shows them
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
