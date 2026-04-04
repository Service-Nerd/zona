'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDuration, formatPace, hrColour, paceAtHR, getRuns } from '@/lib/strava'
import type { StravaActivity } from '@/types/plan'

const CLIENT_ID     = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID!
const REFRESH_TOKEN = 'b2332fbde9c23d072e4e7712afc9d5b06e253fed'

export default function StravaPanel() {
  const [secret, setSecret]       = useState('')
  const [runs, setRuns]           = useState<StravaActivity[] | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [popup, setPopup]         = useState<StravaActivity | null>(null)
  const [analysis, setAnalysis]   = useState<string | null>(null)
  const supabase = createClient()

  // On mount — try to load saved secret from Supabase and auto-connect
  useEffect(() => {
    async function autoConnect() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_settings')
        .select('strava_client_secret')
        .eq('id', user.id)
        .single()

      if (data?.strava_client_secret) {
        setSecret(data.strava_client_secret)
        await connectWithSecret(data.strava_client_secret, false)
      }
    }
    autoConnect()
  }, [])

  async function saveSecret(s: string, userId: string) {
    setSaving(true)
    await supabase.from('user_settings').upsert({
      id: userId,
      strava_client_secret: s,
      updated_at: new Date().toISOString()
    })
    setSaving(false)
  }

  async function connectWithSecret(s: string, shouldSave = true) {
    setLoading(true)
    setError(null)
    try {
      const tokenRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: CLIENT_ID, client_secret: s, refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token' }),
      })
      const { access_token } = await tokenRes.json()
      if (!access_token) throw new Error('No token returned')

      if (shouldSave) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await saveSecret(s, user.id)
      }

      const after = Math.floor(new Date('2026-01-01').getTime() / 1000)
      const actRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`, {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      const activities = await actRes.json()
      if (!Array.isArray(activities)) throw new Error('Bad response from Strava')

      const sorted = getRuns(activities)
      setRuns(sorted)
      setConnected(true)
      checkForNewActivity(sorted)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  async function connect() {
    if (!secret) return
    await connectWithSecret(secret, true)
  }

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

Give 3-4 sentences of direct coaching feedback. Flag if HR was too high. Note one thing done well and one to focus on next session. No fluff.`

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
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

  return (
    <div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px 18px', marginBottom: '16px', fontSize: '0.84rem', lineHeight: 1.75, color: 'var(--text-dim)' }}>
        {connected
          ? <span>✓ <span style={{ color: 'var(--green)' }}>Strava connected</span> — secret saved to your account. Auto-connects on every load.</span>
          : <span>Enter your Strava Client Secret once — it'll be saved to your account and auto-connect every time. <span style={{ color: 'var(--orange)' }}>New activities trigger an AI coaching popup.</span></span>
        }
      </div>

      {!connected && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
          <input
            type="password" value={secret} onChange={e => setSecret(e.target.value)}
            placeholder="Paste your Strava Client Secret..."
            style={{ flex: 1, minWidth: '200px', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '5px', padding: '10px 14px', color: 'var(--text)', fontFamily: "'DM Sans',sans-serif", fontSize: '0.84rem', outline: 'none' }}
          />
          <button onClick={connect} disabled={loading || !secret}
            style={{ background: 'var(--orange)', color: 'var(--black)', border: 'none', borderRadius: '5px', padding: '10px 20px', fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold', opacity: loading || !secret ? 0.6 : 1 }}>
            {loading ? 'Connecting...' : saving ? 'Saving...' : 'Connect & Save'}
          </button>
          {error && <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', color: 'var(--red)' }}>✗ {error}</span>}
        </div>
      )}

      {loading && !connected && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', color: 'var(--text-dim)', marginBottom: '16px' }}>
          Auto-connecting to Strava...
        </div>
      )}

      {runs && (
        <>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', letterSpacing: '0.07em', color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Key Metrics
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '8px', marginBottom: '20px' }}>
            {[
              { label: 'Pace @ HR 145', value: pace145 ? pace145 + '/km' : '—', sub: 'Aerobic efficiency' },
              { label: 'Avg HR (runs)',  value: avgHR ? avgHR + ' bpm' : '—',   sub: avgHR && avgHR <= 145 ? '✓ Zone 2' : avgHR ? '↑ Above target' : '' },
              { label: 'This Week',     value: thisWeekKm ? thisWeekKm.toFixed(1) + 'km' : '0km', sub: 'Running km' },
              { label: 'Longest Run',   value: longestKm ? longestKm.toFixed(1) + 'km' : '—', sub: 'Since Jan 2026' },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: '2px solid var(--orange)', borderRadius: '6px', padding: '12px 14px' }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', color: 'var(--orange)', lineHeight: 1 }}>{value}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{label}</div>
                {sub && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px' }}>{sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.1rem', letterSpacing: '0.07em', color: 'var(--text)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Recent Activities
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'grid', gap: '6px' }}>
            {runs.slice(0, 12).map(run => {
              const km   = (run.distance / 1000).toFixed(1)
              const dur  = formatDuration(run.moving_time)
              const pace = formatPace(run.moving_time, run.distance)
              const hr   = run.average_heartrate ? Math.round(run.average_heartrate) : null
              const date = new Date(run.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              const elev = run.total_elevation_gain ? `+${Math.round(run.total_elevation_gain)}m` : ''
              return (
                <div key={run.id} style={{ display: 'grid', gridTemplateColumns: '60px 48px 64px 72px 72px 50px 1fr', gap: '8px', padding: '9px 14px', background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '5px', alignItems: 'center' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: 'var(--text-dim)' }}>{date}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.72rem', color: 'var(--orange)' }}>{km}km</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', color: 'var(--text-dim)' }}>{dur}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', color: hr ? hrColour(hr) : 'var(--text-dim)' }}>{hr ? `${hr} bpm` : '—'}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.65rem', color: 'var(--text-dim)' }}>{pace}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: 'var(--text-dim)' }}>{elev}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.name}</div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {popup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--card)', border: '1px solid var(--orange)', borderTop: '3px solid var(--orange)', borderRadius: '8px', maxWidth: '520px', width: '100%', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: 'var(--orange)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>New Activity</div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.3rem', letterSpacing: '0.04em' }}>{popup.name}</div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {new Date(popup.start_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </div>
              <button onClick={() => setPopup(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
            </div>
            <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', borderBottom: '1px solid var(--border)' }}>
              {[
                { label: 'Distance', value: `${(popup.distance/1000).toFixed(2)}km`, color: 'var(--orange)' },
                { label: 'Duration', value: formatDuration(popup.moving_time),        color: 'var(--orange)' },
                { label: 'Avg HR',   value: popup.average_heartrate ? `${Math.round(popup.average_heartrate)}` : '—', color: hrColour(popup.average_heartrate) },
                { label: 'Pace',     value: formatPace(popup.moving_time, popup.distance), color: 'var(--white)' },
                { label: 'Max HR',   value: popup.max_heartrate ? `${Math.round(popup.max_heartrate)}` : '—', color: 'var(--white)' },
                { label: 'Elevation',value: `+${Math.round(popup.total_elevation_gain ?? 0)}m`, color: 'var(--white)' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.58rem', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.4rem', color, lineHeight: 1.1 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: 'var(--orange)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>Coaching Notes</div>
              <div style={{ fontSize: '0.83rem', lineHeight: 1.75, color: 'var(--text-dim)' }}>
                {analysis ?? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Analysing activity...</span>}
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <button onClick={() => setPopup(null)} style={{ background: 'var(--orange)', color: 'var(--black)', border: 'none', borderRadius: '5px', padding: '9px 22px', fontFamily: "'DM Mono',monospace", fontSize: '0.7rem', letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 'bold' }}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
