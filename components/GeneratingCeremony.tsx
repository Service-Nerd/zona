// TIER-DIVERGENT — FREE: 3-line ceremony, 1.8s minimum before reveal
//                  PAID/TRIAL: 5-line ceremony, 3.6s minimum (enricher runs longer)
//
// This is the signature Zonna loading moment. Not a loading state — a ceremony.
// The copy does the work. The skeleton shows the plan's shape before content arrives.
// The reveal draws the plan phase-by-phase, then hands off to the full preview.
//
// See docs/canonical/ui-patterns.md §10 for the canonical pattern.
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { weekVolumeLabel } from '@/lib/plan/weekVolume'
import type { Plan, GeneratorInput } from '@/types/plan'
import { ceremonyLinesFor } from '@/lib/plan/ceremonyLines'
import AIMark from './shared/AIMark'

// ─── Copy ─────────────────────────────────────────────────────────────────────

const COPY_PAID = [
  "Reading your race date. Working backwards from the finish line.",
  "Calculating your Zone 2 ceiling. Lower than you'd expect.",
  "Protecting you from yourself. The 10% rule applies, even here.",
  "Building in the deload weeks. You'll want them.",
  "Almost done.",
]

const COPY_FREE = [
  "Working out your schedule.",
  "The 10% rule applies. Even now.",
  "Building in the deload weeks.",
  "Almost done.",
]

const COPY_REVEAL = "There it is. Don't ruin it."

/**
 * FIRSTRUN-MOMENTS-01c — the runner's own answers lead, generic copy backfills.
 *
 * Personal lines FIRST (that is the whole point: the app proving it listened),
 * then the fixed copy tops the list up so the ceremony is never short of lines
 * for its 28-35s window. Deduped against the generic set so nothing repeats, and
 * capped at the length the timing was built for.
 */
function ceremonyCopy(input: Partial<GeneratorInput> | null | undefined, generic: string[]): string[] {
  const personal = ceremonyLinesFor(input)
  if (personal.length === 0) return generic
  // "Almost done." is the closer and must stay last.
  const closer = generic[generic.length - 1]
  const body = [...personal, ...generic.slice(0, -1)].slice(0, generic.length - 1)
  return [...body, closer]
}

// ─── Session / phase colours ──────────────────────────────────────────────────

const SESSION_COLOURS: Record<string, string> = {
  easy: 'var(--session-easy)', run: 'var(--session-easy)',
  long: 'var(--session-long)',
  quality: 'var(--session-quality)', tempo: 'var(--session-quality)',
  intervals: 'var(--session-intervals)',
  race: 'var(--session-race)', recovery: 'var(--session-recovery)',
  strength: 'var(--session-strength)', 'cross-train': 'var(--session-cross)',
}

const PHASE_COLOURS: Record<string, string> = {
  base: 'var(--session-easy)', build: 'var(--accent)',
  peak: 'var(--amber)', taper: 'var(--text-muted)',
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: '12px',
      border: '0.5px solid var(--border-col)', padding: '14px 16px',
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div className="gc-shimmer" style={{ height: '13px', width: '44%', borderRadius: '5px' }} />
        <div className="gc-shimmer" style={{ height: '18px', width: '56px', borderRadius: '20px' }} />
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="gc-shimmer" style={{ height: '24px', width: '50px', borderRadius: '6px' }} />
        ))}
      </div>
      <div style={{ paddingTop: '10px', borderTop: '0.5px solid var(--border-col)' }}>
        <div className="gc-shimmer" style={{ height: '10px', width: '28%', borderRadius: '4px' }} />
      </div>
    </div>
  )
}

// ─── Reveal card ─────────────────────────────────────────────────────────────

function RevealCard({ week, phaseLabel, phaseColour, visible }: {
  week: Plan['weeks'][0]
  phaseLabel?: string
  phaseColour?: string
  visible: boolean
}) {
  // D8: sort chips Mon→Sun. Object.entries follows insertion order — the rule
  // engine inserts the long run (often Sunday) first, so unsorted chips read
  // Sun/Thu/Tue/… The real Plan screen already iterates a fixed day order; match it.
  const DOW_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const sessionDays = Object.entries(week.sessions ?? {})
    .filter(([, s]) => s && s.type !== 'rest')
    .sort(([a], [b]) => DOW_ORDER.indexOf(a) - DOW_ORDER.indexOf(b))

  return (
    <div style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(10px)',
      transition: 'opacity 0.3s ease-out, transform 0.3s ease-out',
      background: 'var(--card-bg)', borderRadius: '12px',
      border: '0.5px solid var(--border-col)', padding: '14px 16px',
      marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontFamily: 'var(--font-brand)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {phaseLabel
            ? `${phaseLabel.charAt(0).toUpperCase()}${phaseLabel.slice(1)} phase`
            : `Week ${week.n}`}
          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: 400, color: 'var(--text-muted)', fontSize: '13px' }}> · W{week.n}</span>
        </div>
        {phaseColour && phaseLabel && (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: phaseColour,
            border: `0.5px solid ${phaseColour}`, borderRadius: '20px',
            padding: '2px 8px', flexShrink: 0,
          }}>
            {phaseLabel}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {sessionDays.map(([day, s]) => (
          <div key={day} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-secondary)',
            background: 'var(--bg)', borderRadius: '6px', padding: '4px 8px',
          }}>
            <span style={{
              width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
              background: SESSION_COLOURS[s!.type] ?? 'var(--text-muted)', display: 'inline-block',
            }} />
            <span style={{ textTransform: 'capitalize' }}>{day}</span>
          </div>
        ))}
      </div>
      <div style={{ paddingTop: '8px', borderTop: '0.5px solid var(--border-col)', display: 'flex', gap: '16px' }}>
        {week.weekly_km > 0 && (
          /* §121 Amendment 1 — the race is named, never folded in. Same shared
             owner as the wizard preview and the published plan pages. */
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>{weekVolumeLabel(week as never) ?? `${week.weekly_km} km`}</span>
        )}
        {week.badge && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{week.badge}</span>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RepWeek = { week: Plan['weeks'][0]; phaseLabel: string; phaseColour: string }

function getRepWeeks(plan: Plan): RepWeek[] {
  const PHASES = ['base', 'build', 'peak', 'taper'] as const
  const result = PHASES.flatMap(phase => {
    const phaseWks = plan.weeks.filter(w => w.phase === phase)
    if (!phaseWks.length) return []
    const mid = phaseWks[Math.floor(phaseWks.length / 2)]
    return [{ week: mid, phaseLabel: phase, phaseColour: PHASE_COLOURS[phase] }]
  })
  if (result.length) return result
  // No phases — use first 3 weeks
  return plan.weeks.slice(0, 3).map(w => ({
    week: w, phaseLabel: `Week ${w.n}`, phaseColour: 'var(--text-muted)',
  }))
}

// ─── Main component ───────────────────────────────────────────────────────────

type CeremonyPhase = 'loading' | 'revealing' | 'done'

export default function GeneratingCeremony({
  hasPaidAccess,
  plan,
  input,
  onRevealComplete,
}: {
  hasPaidAccess: boolean
  plan: Plan | null
  /** FIRSTRUN-MOMENTS-01c — the runner's own wizard answers, so the ceremony can
   *  say something only true of them. Optional: without it the generic copy runs
   *  exactly as before. */
  input?: Partial<GeneratorInput> | null
  onRevealComplete: () => void
}) {
  const lines = useMemo(
    () => ceremonyCopy(input, hasPaidAccess ? COPY_PAID : COPY_FREE),
    [input, hasPaidAccess],
  )
  const minDelay = hasPaidAccess ? 3600 : 1800   // ms — minimum ceremony duration

  const [phase, setPhase]               = useState<CeremonyPhase>('loading')
  const [lineIdx, setLineIdx]           = useState(0)
  const [revealedCount, setRevealedCount] = useState(0)

  const startTime   = useRef(Date.now())
  const revealedRef = useRef(onRevealComplete)
  revealedRef.current = onRevealComplete

  const repWeeks = plan ? getRepWeeks(plan) : []

  // ── Copy cycling (loading phase only) ───────────────────────────────────────
  useEffect(() => {
    if (phase !== 'loading') return
    const t = setInterval(() => setLineIdx(i => i + 1), 1800)
    return () => clearInterval(t)
  }, [phase])

  // ── Transition to reveal when plan arrives + minimum delay elapsed ───────────
  useEffect(() => {
    if (!plan || phase !== 'loading') return
    const elapsed = Date.now() - startTime.current
    const remaining = Math.max(0, minDelay - elapsed)
    const t = setTimeout(() => setPhase('revealing'), remaining)
    return () => clearTimeout(t)
  }, [plan, phase, minDelay])

  // ── Stagger card reveal ──────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'revealing' || !repWeeks.length) return
    let count = 0
    const total = repWeeks.length
    const interval = setInterval(() => {
      count++
      setRevealedCount(count)
      if (count >= total) {
        clearInterval(interval)
        const t = setTimeout(() => {
          setPhase('done')
          revealedRef.current()
        }, 500)
        return () => clearTimeout(t)
      }
    }, 80)
    return () => clearInterval(interval)
  }, [phase, repWeeks.length])

  return (
    <>
      {/* Keyframe animations — component-scoped */}
      <style>{`
        @keyframes gc-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes gc-copy-in {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gc-shimmer {
          /* P-13b (2026-09-20) — this shimmer used to render the RETIRED System-B
             teal, written in rgba form so the hex-only pre-commit rule never saw
             it. A banned colour, live on the one screen every runner sees. Now a
             token, and the rule now covers rgba. The old value is deliberately
             NOT repeated here: the guard cannot tell a comment from code, and a
             banned colour should not be greppable in this file at all. */
          background: linear-gradient(90deg, var(--border-col) 25%, var(--moss-soft) 50%, var(--border-col) 75%);
          background-size: 200% 100%;
          animation: gc-shimmer 1.6s ease-in-out infinite;
        }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '48px 16px 32px',
        minHeight: '70vh',
      }}>
        {/* ── Headline copy ── */}
        <div style={{ marginBottom: '36px', minHeight: '64px' }}>
          {phase === 'loading' && (
            <>
              {/* AI mark in working state — signals the ceremony is AI-driven */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                marginBottom: '12px',
              }}>
                <AIMark size={12} color="var(--teal)" working />
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
                  color: 'var(--teal)', letterSpacing: '0.14em', textTransform: 'uppercase',
                }}>Generating</span>
              </div>
              <p key={lineIdx} style={{
                fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 500,
                color: 'var(--text-primary)', lineHeight: 1.45, margin: 0,
                animation: 'gc-copy-in 0.45s ease-out',
              }}>
                {lines[lineIdx % lines.length]}
              </p>
            </>
          )}
          {(phase === 'revealing' || phase === 'done') && (
            // D10: keep the reveal line through 'done' too. The ceremony stays
            // mounted at 'done' until the enricher's stream finishes (several
            // seconds for paid/trial); without this the copy vanished but its
            // reserved slot (minHeight 64 + margin 36) plus the container's 48px
            // top padding left a large dead gap above the phase cards.
            <p style={{
              fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 500,
              color: 'var(--teal)', lineHeight: 1.45, margin: 0,
              animation: 'gc-copy-in 0.45s ease-out',
            }}>
              {COPY_REVEAL}
            </p>
          )}
        </div>

        {/* ── Plan shape ── */}
        <div>
          {phase === 'loading' && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {(phase === 'revealing' || phase === 'done') && repWeeks.map(({ week, phaseLabel, phaseColour }, i) => (
            <RevealCard
              key={week.n}
              week={week}
              phaseLabel={phaseLabel}
              phaseColour={phaseColour}
              visible={i < revealedCount}
            />
          ))}
        </div>
      </div>
    </>
  )
}
