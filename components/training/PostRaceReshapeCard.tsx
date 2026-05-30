// PostRaceReshapeCard — shows the proposed post-race plan reshape (AI-DEPTH-08)
// TIER-DIVERGENT — FREE:  locked state with upgrade CTA, hand-authored body
//                  PAID:  live/skeleton states, AI summary (Sonnet), CoachByline
//
// ui-patterns.md Pattern 30: PostRaceReshapeCard
//   - CoachByline (moss) on AI summary — provenance honesty
//   - 3px moss left-rail — AI-card rail per Pattern 16b
//   - Two CTAs: Accept (full-width moss) + "Keep my plan as-is" (text link below)
//   - Skeleton shimmer for loading state — no spinners
//   - Locked state: muted card, upgrade CTA, no CoachByline (not AI output)
//
// On accept → POST /api/post-race-reshape/confirm
// On dismiss → calls onDismiss (parent clears the card)

'use client'

import { useState } from 'react'
import CoachByline from '@/components/shared/CoachByline'
import { authedFetch } from '@/lib/supabase/authedFetch'
import type { Plan } from '@/types/plan'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PostRaceReshapeCardLive {
  state:               'live'
  reshapeId:           string
  summary:             string | null
  weeksAffected:       number[]
  sessionsModified:    number
  distanceBucket:      string
  onAccepted:          (reshapedPlan: Plan) => void
  onDismiss:           () => void
  onUpgrade?:          never
}

interface PostRaceReshapeCardSkeleton {
  state:       'skeleton'
  onAccepted?: never
  onDismiss?:  never
  onUpgrade?:  never
}

interface PostRaceReshapeCardLocked {
  state:      'locked'
  onUpgrade:  () => void
  onDismiss:  () => void
  onAccepted?: never
}

type Props =
  | PostRaceReshapeCardLive
  | PostRaceReshapeCardSkeleton
  | PostRaceReshapeCardLocked

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, var(--bg-soft) 25%, var(--line) 50%, var(--bg-soft) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    borderRadius: '4px',
  }
  return (
    <div style={{ position: 'relative', background: 'var(--card)', borderRadius: '16px', padding: '16px 16px 16px 22px' }}>
      <span style={{ position: 'absolute', left: '8px', top: '16px', bottom: '16px', width: '3px', borderRadius: '2px', background: 'var(--moss)' }} aria-hidden />
      <div style={{ height: '10px', width: '100px', marginBottom: '12px', ...shimmer }} />
      <div style={{ height: '15px', width: '100%', marginBottom: '6px', ...shimmer }} />
      <div style={{ height: '15px', width: '85%', marginBottom: '20px', ...shimmer }} />
      <div style={{ height: '46px', borderRadius: '12px', ...shimmer }} />
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  )
}

// ── Locked ────────────────────────────────────────────────────────────────────

function Locked({ onUpgrade, onDismiss }: { onUpgrade: () => void; onDismiss: () => void }) {
  return (
    <div style={{ position: 'relative', background: 'var(--card)', borderRadius: '16px', padding: '16px 16px 16px 22px' }}>
      <span style={{ position: 'absolute', left: '8px', top: '16px', bottom: '16px', width: '3px', borderRadius: '2px', background: 'var(--mute)' }} aria-hidden />

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
        Post-race reshape
      </div>

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, marginBottom: '8px' }}>
        Race done. Plan needs updating.
      </div>

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: '16px' }}>
        Log your race result and Zonna will reshape your training plan around your recovery — adjusting the next few weeks so you don't come back too fast.
      </div>

      <button
        onClick={onUpgrade}
        style={{
          width: '100%', height: '46px',
          background: 'var(--moss)', border: 'none', borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--card)',
          cursor: 'pointer', marginBottom: '8px',
        }}
      >
        Unlock post-race reshape
      </button>

      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', cursor: 'pointer', padding: '4px 0', width: '100%' }}
      >
        Dismiss
      </button>
    </div>
  )
}

// ── Live card ─────────────────────────────────────────────────────────────────

function Live({
  reshapeId,
  summary,
  weeksAffected,
  sessionsModified,
  distanceBucket,
  onAccepted,
  onDismiss,
}: Omit<PostRaceReshapeCardLive, 'state'>) {
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  async function handleAccept() {
    setConfirming(true)
    setConfirmError(null)
    try {
      const res = await authedFetch('/api/post-race-reshape/confirm', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reshape_id: reshapeId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setConfirmError(d?.error ?? 'Could not apply reshape.')
        return
      }
      const data = await res.json()
      onAccepted(data.reshaped_plan_json as Plan)
    } catch {
      setConfirmError('Network error.')
    } finally {
      setConfirming(false)
    }
  }

  const bucketLabel: Record<string, string> = {
    '5K': '5K', '10K': '10K', 'HM': 'half marathon',
    'MARATHON': 'marathon', '50K': '50K', '100K': '100K',
  }
  const distLabel = bucketLabel[distanceBucket] ?? distanceBucket

  return (
    <div style={{ position: 'relative', background: 'var(--card)', borderRadius: '16px', padding: '16px 16px 16px 22px', animation: 'vetra-fade-in 0.2s ease-out' }}>
      {/* 3px moss left-rail — AI provenance marker */}
      <span style={{ position: 'absolute', left: '8px', top: '16px', bottom: '16px', width: '3px', borderRadius: '2px', background: 'var(--moss)' }} aria-hidden />

      {/* CoachByline */}
      <div style={{ marginBottom: '10px' }}>
        <CoachByline color="moss" role="POST-RACE RESHAPE" />
      </div>

      {/* Summary text (AI — Sonnet) or fallback */}
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: '12px' }}>
        {summary ?? `${distLabel} done. Reshaped ${weeksAffected.length} weeks to protect your recovery.`}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <StatChip value={String(weeksAffected.length)} label="weeks updated" />
        <StatChip value={String(sessionsModified)} label="sessions changed" />
      </div>

      {confirmError && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--danger)', marginBottom: '10px', padding: '6px 10px', background: 'var(--bg-soft)', borderRadius: '8px' }}>
          {confirmError}
        </div>
      )}

      {/* Accept CTA */}
      <button
        onClick={handleAccept}
        disabled={confirming}
        style={{
          width: '100%', height: '46px',
          background: confirming ? 'var(--bg-soft)' : 'var(--moss)',
          border: 'none', borderRadius: '12px',
          fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
          color: confirming ? 'var(--mute)' : 'var(--card)',
          cursor: confirming ? 'default' : 'pointer',
          transition: 'background 0.15s',
          marginBottom: '8px',
        }}
      >
        {confirming ? 'Updating plan…' : 'Accept — update my plan'}
      </button>

      {/* Dismiss link */}
      <button
        onClick={onDismiss}
        disabled={confirming}
        style={{ background: 'none', border: 'none', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', cursor: 'pointer', padding: '4px 0', width: '100%' }}
      >
        Keep my plan as-is →
      </button>
    </div>
  )
}

function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', fontWeight: 400, marginTop: '2px' }}>
        {label}
      </span>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function PostRaceReshapeCard(props: Props) {
  if (props.state === 'skeleton') return <Skeleton />
  if (props.state === 'locked')   return <Locked onUpgrade={props.onUpgrade} onDismiss={props.onDismiss!} />
  return <Live {...props} />
}
