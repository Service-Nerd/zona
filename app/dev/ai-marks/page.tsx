'use client'

// AI Mark candidates — temporary preview page.
// Shows 5 glyph designs across the contexts they'd appear in production.
// Visit /dev/ai-marks to compare. Delete this route once a glyph is chosen.

import React from 'react'

const MOSS = 'var(--moss)'
const WARN = 'var(--warn)'

// ─── GLYPH CANDIDATES ───────────────────────────────────────────────────────

interface MarkProps { size?: number; color?: string; animated?: boolean }

// 1. Four-point sparkle (clean — Notion / Linear style)
function MarkSparkle4({ size = 12, color = MOSS, animated = false }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={animated ? 'ai-mark-pulse' : undefined}>
      <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z" fill={color} />
    </svg>
  )
}

// 2. Four-point sparkle + accent dot (Apple Intelligence-ish)
function MarkSparkleDot({ size = 14, color = MOSS, animated = false }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" className={animated ? 'ai-mark-pulse' : undefined}>
      <path d="M5 1 L6 5 L10 6 L6 7 L5 11 L4 7 L0 6 L4 5 Z" fill={color} />
      <path d="M11 9 L11.4 10.6 L13 11 L11.4 11.4 L11 13 L10.6 11.4 L9 11 L10.6 10.6 Z" fill={color} />
    </svg>
  )
}

// 3. Six-point sparkle (more sparkle-y, Apple Music / iOS sparkle)
function MarkSparkle6({ size = 12, color = MOSS, animated = false }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={animated ? 'ai-mark-pulse' : undefined}>
      <g fill={color}>
        <path d="M6 0 L6.6 5.4 L12 6 L6.6 6.6 L6 12 L5.4 6.6 L0 6 L5.4 5.4 Z" />
        <circle cx="6" cy="6" r="0.8" />
      </g>
    </svg>
  )
}

// 4. Two-stroke shine (minimal — plus + X overlay)
function MarkShine({ size = 12, color = MOSS, animated = false }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className={animated ? 'ai-mark-pulse' : undefined}>
      <g stroke={color} strokeWidth="1.4" strokeLinecap="round">
        <line x1="6" y1="1.5" x2="6" y2="10.5" />
        <line x1="1.5" y1="6" x2="10.5" y2="6" />
        <line x1="2.8" y1="2.8" x2="9.2" y2="9.2" opacity="0.5" />
        <line x1="9.2" y1="2.8" x2="2.8" y2="9.2" opacity="0.5" />
      </g>
    </svg>
  )
}

// 5. Pulsing dot — most minimal (no shape, just presence)
function MarkDot({ size = 10, color = MOSS, animated = false }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" className={animated ? 'ai-mark-pulse' : undefined}>
      <circle cx="5" cy="5" r="3" fill={color} />
      <circle cx="5" cy="5" r="4.5" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3" />
    </svg>
  )
}

// 6. AI text chip — most explicit
function MarkText({ size = 12, color = MOSS, animated = false }: MarkProps) {
  return (
    <span style={{
      fontFamily: 'var(--font-ui)', fontSize: `${size - 2}px`, fontWeight: 800,
      color, letterSpacing: '0.05em',
      animation: animated ? 'ai-mark-pulse 1.6s ease-in-out infinite' : undefined,
      display: 'inline-block', lineHeight: 1,
    }}>AI</span>
  )
}

const CANDIDATES = [
  { id: 1, name: 'Sparkle (4-point)',          note: 'Notion / Linear standard. Clean, recognizable.',                Comp: MarkSparkle4 },
  { id: 2, name: 'Sparkle + accent dot',       note: 'Two-element. Reads more "magical" / Apple Intelligence.',       Comp: MarkSparkleDot },
  { id: 3, name: 'Six-point with center',      note: 'Sparkle-y, slightly more decorative.',                         Comp: MarkSparkle6 },
  { id: 4, name: 'Two-stroke shine',           note: 'Minimal cross. Less pictographic — more like a target mark.',  Comp: MarkShine },
  { id: 5, name: 'Pulsing dot',                note: 'Most restrained. Just presence — no symbol.',                  Comp: MarkDot },
  { id: 6, name: '"AI" text chip',             note: 'Explicit. Cannot be misread. Less elegant.',                   Comp: MarkText },
]

// ─── CONTEXT EXAMPLES ───────────────────────────────────────────────────────

function Eyebrow({ Comp, label }: { Comp: React.FC<MarkProps>; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
      color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>
      <Comp size={10} color={MOSS} />
      {label}
    </div>
  )
}

function CoachEyebrow({ Comp, label }: { Comp: React.FC<MarkProps>; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
      color: WARN, letterSpacing: '0.14em', textTransform: 'uppercase',
    }}>
      <Comp size={10} color={WARN} />
      {label}
    </div>
  )
}

function GeneratingButton({ Comp }: { Comp: React.FC<MarkProps> }) {
  return (
    <button style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '11px 16px', borderRadius: '100px',
      background: 'var(--moss)', color: 'var(--card)',
      border: 'none',
      fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
      letterSpacing: '0.04em',
    }}>
      <Comp size={12} color="var(--card)" animated />
      Generating
    </button>
  )
}

function Card({ children, warn = false }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <div style={{
      background: warn ? 'var(--warn-bg)' : 'var(--card)',
      borderRadius: '14px',
      border: warn ? 'none' : '0.5px solid var(--line)',
      padding: '14px 16px',
      maxWidth: '320px',
    }}>
      {children}
    </div>
  )
}

// ─── PAGE ──────────────────────────────────────────────────────────────────

export default function AIMarksPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      padding: '40px 24px 80px',
      fontFamily: 'var(--font-ui)',
      color: 'var(--ink)',
      maxWidth: '900px',
      margin: '0 auto',
    }}>
      <h1 style={{
        fontSize: '24px', fontWeight: 800, letterSpacing: '-0.5px',
        marginBottom: '8px',
      }}>AI mark candidates</h1>
      <p style={{ fontSize: '14px', color: 'var(--mute)', marginBottom: '32px', lineHeight: 1.5 }}>
        Six glyphs across four contexts. Pick one and I'll wire it everywhere.
        All shown at production sizes in moss (or warn for coach surfaces).
      </p>

      {CANDIDATES.map(({ id, name, note, Comp }) => (
        <section key={id} style={{
          marginBottom: '40px',
          paddingBottom: '32px',
          borderBottom: '0.5px solid var(--line)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '4px' }}>
            <span style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
              color: 'var(--mute)', letterSpacing: '0.1em',
            }}>#{id}</span>
            <h2 style={{ fontSize: '17px', fontWeight: 700, letterSpacing: '-0.2px' }}>{name}</h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--mute)', marginBottom: '20px', lineHeight: 1.5 }}>{note}</p>

          {/* Standalone — sizes + states */}
          <div style={{
            display: 'flex', gap: '32px', alignItems: 'center',
            padding: '20px', background: 'var(--bg-soft)', borderRadius: '12px',
            marginBottom: '16px', flexWrap: 'wrap',
          }}>
            <Cell label="10px static">          <Comp size={10} color={MOSS} /></Cell>
            <Cell label="12px static">          <Comp size={12} color={MOSS} /></Cell>
            <Cell label="16px static">          <Comp size={16} color={MOSS} /></Cell>
            <Cell label="12px working">         <Comp size={12} color={MOSS} animated /></Cell>
            <Cell label="16px working">         <Comp size={16} color={MOSS} animated /></Cell>
            <Cell label="warn coach context">   <Comp size={12} color={WARN} /></Cell>
          </div>

          {/* Context examples */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Card>
              <Eyebrow Comp={Comp} label="This week" />
              <div style={{ fontSize: '15px', color: 'var(--ink)', marginTop: '6px', fontWeight: 500 }}>
                Easy was easy. Hard was hard.
              </div>
              <div style={{ fontSize: '12px', color: 'var(--mute)', marginTop: '4px', lineHeight: 1.5 }}>
                You hit the right zone on 4 of 5 sessions. That's the work.
              </div>
            </Card>

            <Card warn>
              <CoachEyebrow Comp={Comp} label="Why this session" />
              <div style={{ fontSize: '13px', color: 'var(--coach-ink)', marginTop: '6px', lineHeight: 1.55 }}>
                Long runs build the engine. Keep it Zone 2 and finish strong.
              </div>
            </Card>

            <Card>
              <Eyebrow Comp={Comp} label="Zona feedback" />
              <div style={{ fontSize: '13px', color: 'var(--ink-2)', marginTop: '6px', lineHeight: 1.55 }}>
                HR ran 14 beats hot for most of it. Pull it back next time.
              </div>
            </Card>

            <div>
              <GeneratingButton Comp={Comp} />
              <div style={{ fontSize: '11px', color: 'var(--mute)', marginTop: '8px' }}>working state in CTA</div>
            </div>
          </div>
        </section>
      ))}

      <style>{`
        @keyframes ai-mark-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.92); }
          50%      { opacity: 1;    transform: scale(1.05); }
        }
        .ai-mark-pulse {
          animation: ai-mark-pulse 1.6s ease-in-out infinite;
          transform-origin: center;
        }
      `}</style>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '32px', height: '32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{children}</div>
      <div style={{ fontSize: '10px', color: 'var(--mute)', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}
