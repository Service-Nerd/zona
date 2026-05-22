/**
 * ReflectionInput — post-run reflection textarea + AI reframe surface.
 *
 * Lives under the session reflect view (and PostRunScreen). Optional input;
 * the runner can log a session without writing anything. When they DO write,
 * Kit generates a 3-4 sentence reframe and persists it to session_reflections.
 *
 * Doctrine:
 *   - Tier-gated by the caller (only mount for paid/trial users).
 *   - Single composed surface: input → working state → reframe card.
 *   - On mount, hydrates from any existing session_reflection so re-entering
 *     the screen surfaces the reframe again, not a blank input.
 *   - AIMark on every reframe — provenance is non-negotiable.
 *   - Silent failure: if the API errors, the textarea reappears with no banner.
 *
 * Canonical authority: docs/canonical/brand.md § Reframe Voice.
 */

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AIMark from '@/components/shared/AIMark'
import { REFRAME_TIER } from '@/lib/coaching/constants'
import { messageForReframeRiskReason, type ReframeRiskReason } from '@/lib/coaching/reframeRiskGate'

type ViewState = 'input' | 'submitting' | 'reframe' | 'silenced'

export interface ReflectionInputProps {
  weekN: number
  /** Session day key — matches session_completions.session_day (e.g. 'tuesday'). */
  sessionDay: string
}

export default function ReflectionInput({ weekN, sessionDay }: ReflectionInputProps) {
  const supabase = createClient()
  const [view, setView] = useState<ViewState>('input')
  const [noteText, setNoteText] = useState('')
  const [reframeText, setReframeText] = useState<string | null>(null)
  const [silencedMessage, setSilencedMessage] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  // ── Hydrate on mount: if a reflection already exists for this session,
  // surface the reframe instead of a blank input.
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (!cancelled) setHydrated(true); return }
        const { data } = await supabase
          .from('session_reflections')
          .select('note_text, reframe_text, reframe_silenced, reframe_silenced_reason')
          .eq('user_id', user.id)
          .eq('week_n', weekN)
          .eq('session_day', sessionDay)
          .maybeSingle()
        if (cancelled) return
        if (data?.reframe_silenced && data.reframe_silenced_reason) {
          setNoteText((data.note_text as string) ?? '')
          setSilencedMessage(messageForReframeRiskReason(data.reframe_silenced_reason as ReframeRiskReason))
          setView('silenced')
        } else if (data?.reframe_text) {
          setNoteText((data.note_text as string) ?? '')
          setReframeText(data.reframe_text as string)
          setView('reframe')
        }
      } catch {
        // Silent — fall through to input state
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [supabase, weekN, sessionDay])

  async function handleSubmit() {
    const trimmed = noteText.trim()
    if (!trimmed) return
    setView('submitting')
    try {
      const res = await fetch('/api/post-run-reframe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_n: weekN, session_day: sessionDay, user_note: trimmed }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as {
        reframe: string | null
        tier: 'A' | 'B' | 'C'
        silenced?: boolean
        silencedMessage?: string | null
        fallback: boolean
      }
      if (json.silenced && json.silencedMessage) {
        setSilencedMessage(json.silencedMessage)
        setView('silenced')
      } else if (json.reframe) {
        setReframeText(json.reframe)
        setView('reframe')
      } else {
        // Silent fallback — back to input
        setView('input')
      }
    } catch {
      // Silent fallback
      setView('input')
    }
  }

  // Don't render anything until hydration completes — avoids flashing the
  // input state before a stored reframe surfaces.
  if (!hydrated) return null

  // ── Reframe card ──────────────────────────────────────────────────────
  if (view === 'reframe' && reframeText) {
    return (
      <div style={{ marginBottom: '20px' }}>
        {/* Eyebrow with AIMark — provenance always visible */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
        }}>
          <AIMark size={10} color="var(--moss)" />
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--mute)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Kit
          </span>
        </div>
        <div style={{
          background: 'var(--card)', borderRadius: '12px',
          border: '0.5px solid var(--border-col)',
          borderLeft: '3px solid var(--moss)',
          padding: '14px 16px',
          fontFamily: 'var(--font-brand)', fontSize: '14px',
          fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.55,
          letterSpacing: '-0.1px',
        }}>
          {reframeText}
        </div>
        {noteText && (
          <div style={{
            marginTop: '10px',
            fontFamily: 'var(--font-ui)', fontSize: '11px',
            color: 'var(--mute)', lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            You wrote: &ldquo;{noteText}&rdquo;
          </div>
        )}
      </div>
    )
  }

  // ── Silenced state — risk gate fired, reframe suppressed ─────────────
  // Brand voice: calm guidance, not alerts. No AIMark — this is rule-engine
  // output (the risk gate), not model output.
  if (view === 'silenced' && silencedMessage) {
    return (
      <div style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px',
        }}>
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--warn)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Worth a check
          </span>
        </div>
        <div style={{
          background: 'var(--card)', borderRadius: '12px',
          border: '0.5px solid var(--border-col)',
          borderLeft: '3px solid var(--warn)',
          padding: '14px 16px',
          fontFamily: 'var(--font-brand)', fontSize: '14px',
          fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.55,
          letterSpacing: '-0.1px',
        }}>
          {silencedMessage}
        </div>
        {noteText && (
          <div style={{
            marginTop: '10px',
            fontFamily: 'var(--font-ui)', fontSize: '11px',
            color: 'var(--mute)', lineHeight: 1.5,
            fontStyle: 'italic',
          }}>
            You wrote: &ldquo;{noteText}&rdquo;
          </div>
        )}
      </div>
    )
  }

  // ── Working state ─────────────────────────────────────────────────────
  if (view === 'submitting') {
    return (
      <div style={{
        marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 16px',
        background: 'var(--bg)', borderRadius: '12px',
        border: '0.5px solid var(--border-col)',
      }}>
        <AIMark size={12} color="var(--moss)" working />
        <span style={{
          fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)',
        }}>
          Kit&rsquo;s reading…
        </span>
      </div>
    )
  }

  // ── Input state ───────────────────────────────────────────────────────
  const trimmed = noteText.trim()
  const submitEnabled = trimmed.length > 0 && trimmed.length <= REFRAME_TIER.USER_NOTE_MAX_CHARS

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
      }}>
        Tell me how that felt &middot; optional
      </div>
      <textarea
        value={noteText}
        onChange={e => setNoteText(e.target.value.slice(0, REFRAME_TIER.USER_NOTE_MAX_CHARS))}
        placeholder="Anything you want me to know about that run — how it felt, what was on your mind. I'll read it back."
        rows={4}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '12px 14px',
          background: 'var(--bg)',
          border: '0.5px solid var(--border-col)',
          borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          color: 'var(--text-primary)', lineHeight: 1.55,
          resize: 'vertical',
          outline: 'none',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!submitEnabled}
        style={{
          marginTop: '10px',
          width: '100%', padding: '12px',
          background: submitEnabled ? 'var(--moss)' : 'var(--bg)',
          color: submitEnabled ? 'var(--card)' : 'var(--text-muted)',
          border: submitEnabled ? 'none' : '0.5px solid var(--border-col)',
          borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '12px',
          fontWeight: submitEnabled ? 600 : 400,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: submitEnabled ? 'pointer' : 'default',
          transition: 'all 0.18s',
        }}
      >
        Read it back
      </button>
    </div>
  )
}
