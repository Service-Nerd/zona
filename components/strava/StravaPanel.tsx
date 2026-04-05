'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration, formatPace, hrColour, paceAtHR, getRuns } from '@/lib/strava'
import type { StravaActivity } from '@/types/plan'

export default function StravaPanel({ preloadedRuns, preloadedConnected, preloadedLoading }: {
  preloadedRuns?: any[] | null
  preloadedConnected?: boolean
  preloadedLoading?: boolean
}) {
  const runs      = preloadedRuns ?? null
  const connected = preloadedConnected ?? false
  const loading   = preloadedLoading ?? false
  const [popup, setPopup]       = useState<StravaActivity | null>(null)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const supabase = createClient()

  // Check for new activity and trigger popup
  useEffect(() => {
    if (runs && runs.length > 0) checkForNewActivity(runs)
  }, [runs])

  function checkForNewActivity(runs: StravaActivity[]) {
    if (!runs.length) return
    const latest = runs[0]
    const seenId = localStorage.getItem('rts_last_seen_activity')
    if (String(latest.id) === seenId) return
    localStorage.setItem('rts_last_seen_activity', String(latest.id))
    setPopup(latest)
    analyseActivity(latest)
  }

  async function analyseActivity(run: StravaActivity) {
    setAnalysis(null)
    const weeksToRace = Math.max(0, Math.round((new Date('2026-07-11').getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7)))
    const prompt = `You are a direct ultra running coach reviewing a single training activity for Russ, training for Race to the Stones 100km on 11 July 2026 (${weeksToRace} weeks away).

Athlete: HM 1:48:30, resting HR ~48, max HR ~186-190. Priority: Zone 2 discipline (HR ≤145). Recently quit smoking April 3rd.

Activity:
- Name: ${run.name}
- Date: ${new Date(run.start_date).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long' })}
- Distance: ${(run.distance/1000).toFixed(2)}km
- Duration: ${formatDuration(run.moving_time)}
- Avg HR: ${run.average_heartrate ?? 'not recorded'} bpm
- Max HR: ${run.max_heartrate ?? 'not recorded'} bpm
- Pace: ${formatPace(run.moving_time, run.distance)}
- Elevation: +${Math.round(run.total_elevation_gain ?? 0)}m

Give 3-4 sentences of direct coaching feedback. Flag if HR was too high. Note one thing done well and one to focus on next. No fluff.`

    try {
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      setAnalysis(data.content?.map((b: { text?: string }) => b.text || '').join('') || 'Analysis unavailable.')
    } catch {
      setAnalysis('Analysis unavailable — check your connection.')
    }
  }

  const pace145    = runs ? paceAtHR(runs) : null
  const avgHR      = runs?.length ? Math.round(runs.filter(r => r.average_heartrate).slice(0, 10).reduce((s, r) => s + (r.average_heartrate ?? 0), 0) / Math.min(runs.filter(r => r.average_heartrate).length, 10)) : null
  const longestKm  = runs?.length ? Math.max(...runs.map(r => r.distance / 1000)) : null
  const thisWeekKm = runs ? (() => {
    const monday = new Date(); monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1); monday.setHours(0,0,0,0)
    return runs.filter(r => new Date(r.start_date) >= monday).reduce((s, r) => s + r.distance / 1000, 0)
  })() : null

  // ── Not connected state ───────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <svg width="36" height="36" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#2a2a2a" strokeWidth="2" />
          <circle cx="18" cy="18" r="15" fill="none" stroke="#FC4C02" strokeWidth="2" strokeDasharray="40 60" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite" />
          </circle>
        </svg>
        <p style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#999', textAlign: 'center' }}>
          Connecting to Strava...
        </p>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={{ margin: '12px 0' }}>
        <div style={{ background: '#1a1a1a', borderRadius: '16px', border: '0.5px solid #2a2a2a', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(252,76,2,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FC4C02', opacity: 0.5 }} />
          </div>
          <div>
            <div style={{ fontSize: '15px', color: '#ccc', fontWeight: 500, marginBottom: '6px' }}>Strava not connected</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#999', lineHeight: 1.6 }}>
              Head to the <span style={{ color: '#E05A1C' }}>Me</span> screen to add your<br />Strava client secret and connect.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#555' }} />
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#555' }}>not connected</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Connected state ───────────────────────────────────────────────────

  return (
    <div>
      {/* Connection status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5a5' }} />
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#5a5' }}>Strava connected</span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#555', marginLeft: '4px' }}>· auto-syncing</span>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'Pace @ HR 145', value: pace145 ? pace145 + '/km' : '—', sub: 'Aerobic efficiency' },
          { label: 'Avg HR (last 10)', value: avgHR ? avgHR + ' bpm' : '—', sub: avgHR && avgHR <= 145 ? 'Zone 2 ✓' : avgHR ? 'Above target' : '' },
          { label: 'This week',     value: thisWeekKm ? thisWeekKm.toFixed(1) + 'km' : '0km', sub: 'Running km' },
          { label: 'Longest run',   value: longestKm ? longestKm.toFixed(1) + 'km' : '—', sub: 'Since Jan 2026' },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderTop: '2px solid #E05A1C', borderRadius: '12px', padding: '12px 14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#999', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '20px', fontWeight: 500, color: '#E05A1C', lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#666', marginTop: '4px' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Recent activities */}
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#999', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Recent activities</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {runs?.slice(0, 12).map(run => {
          const km   = (run.distance / 1000).toFixed(1)
          const dur  = formatDuration(run.moving_time)
          const pace = formatPace(run.moving_time, run.distance)
          const hr   = run.average_heartrate ? Math.round(run.average_heartrate) : null
          const date = new Date(run.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          return (
            <div key={run.id} style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '12px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontSize: '13px', color: '#ddd', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '8px' }}>{run.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#666', flexShrink: 0 }}>{date}</div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#E05A1C' }}>{km}km</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#999' }}>{dur}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: hr ? hrColour(hr) : '#999' }}>{hr ? `${hr} bpm` : '—'}</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#999' }}>{pace}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Activity popup */}
      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#1a1a1a', border: '0.5px solid #E05A1C', borderTop: '3px solid #E05A1C', borderRadius: '16px', maxWidth: '440px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ padding: '16px 18px', borderBottom: '0.5px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#E05A1C', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>New activity</div>
                <div style={{ fontSize: '16px', fontWeight: 500, color: '#fff' }}>{popup.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '13px', color: '#999', marginTop: '2px' }}>
                  {new Date(popup.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: '#999', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', borderBottom: '0.5px solid #2a2a2a' }}>
              {[
                { label: 'Distance', value: `${(popup.distance/1000).toFixed(2)}km`, color: '#E05A1C' },
                { label: 'Duration', value: formatDuration(popup.moving_time), color: '#E05A1C' },
                { label: 'Avg HR',   value: popup.average_heartrate ? `${Math.round(popup.average_heartrate)}` : '—', color: hrColour(popup.average_heartrate) },
                { label: 'Pace',     value: formatPace(popup.moving_time, popup.distance), color: '#ccc' },
                { label: 'Max HR',   value: popup.max_heartrate ? `${Math.round(popup.max_heartrate)}` : '—', color: '#ccc' },
                { label: 'Elevation',value: `+${Math.round(popup.total_elevation_gain ?? 0)}m`, color: '#ccc' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#999', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 500, color, lineHeight: 1.1 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '12px', color: '#E05A1C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Coaching notes</div>
              <div style={{ fontSize: '13px', lineHeight: 1.7, color: '#ccc' }}>
                {analysis ?? <span style={{ color: '#999', fontStyle: 'italic' }}>Analysing activity...</span>}
              </div>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '0.5px solid #2a2a2a', textAlign: 'right' }}>
              <button onClick={() => setPopup(null)} style={{ background: '#E05A1C', color: '#000', border: 'none', borderRadius: '8px', padding: '9px 22px', fontFamily: "'DM Mono',monospace", fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold' }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
