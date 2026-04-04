'use client'

import { useState, useEffect } from 'react'
import type { Week } from '@/types/plan'

interface Props { week: Week }

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<string, string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }

export default function WeekBriefing({ week }: Props) {
  const [done, setDone]   = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`rts_sessions_w${week.n}`)
      if (saved) setDone(new Set(JSON.parse(saved)))
      const n = localStorage.getItem('rts_notes')
      if (n) setNotes(n)
    } catch {}
  }, [week.n])

  function toggleSession(day: string) {
    setDone(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      try { localStorage.setItem(`rts_sessions_w${week.n}`, JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }

  function saveNotes(val: string) {
    setNotes(val)
    try { localStorage.setItem('rts_notes', val) } catch {}
  }

  const d = new Date(week.date)
  const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--orange-mid)', borderLeft: '3px solid var(--orange)', borderRadius: '6px', padding: '22px', marginBottom: '20px' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.5rem', color: 'var(--orange)', marginBottom: '3px', letterSpacing: '0.04em' }}>
        Week {week.n} · {dateLabel}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.7rem', color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
        {week.theme || week.label}
      </div>

      {/* Sessions */}
      <div style={{ display: 'grid', gap: '6px', marginBottom: '16px' }}>
        {DAYS.map(day => {
          const session = week.sessions[day]
          if (!session) return null
          const isDone = done.has(day)

          const typeColour: Record<string, string> = {
            run: 'var(--orange)', easy: 'var(--green)', strength: 'var(--yellow)',
            rest: 'var(--muted)', race: 'var(--red)',
          }

          return (
            <div
              key={day}
              onClick={() => toggleSession(day)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'var(--card2)', border: `1px solid ${isDone ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: '5px', padding: '10px 14px', cursor: 'pointer',
                opacity: isDone ? 0.4 : 1, transition: 'all 0.15s',
              }}
            >
              {/* Checkbox */}
              <div style={{ width: 20, height: 20, borderRadius: '4px', border: `2px solid ${isDone ? 'var(--green)' : 'var(--border)'}`, background: isDone ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.65rem', color: isDone ? 'var(--black)' : 'transparent', fontWeight: 'bold' }}>
                ✓
              </div>
              {/* Day */}
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--orange)', letterSpacing: '0.1em', textTransform: 'uppercase', width: '42px', flexShrink: 0 }}>
                {DAY_LABELS[day]}
              </div>
              {/* Label */}
              <div style={{ fontSize: '0.84rem', flex: 1, textDecoration: isDone ? 'line-through' : 'none' }}>
                {session.label}
              </div>
              {/* Detail */}
              {session.detail && (
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'var(--orange-bright)' }}>
                  {session.detail}
                </div>
              )}
              {/* Type badge */}
              <div style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '20px', border: `1px solid ${typeColour[session.type] || 'var(--muted)'}`, color: typeColour[session.type] || 'var(--muted)', fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                {session.type}
              </div>
            </div>
          )
        })}
      </div>

      {/* Race notes */}
      {week.race_notes && (
        <div style={{ background: 'rgba(255,107,26,0.08)', border: '1px solid var(--orange-mid)', borderRadius: '5px', padding: '12px 14px', marginBottom: '14px', fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.65 }}>
          <span style={{ color: 'var(--orange)', fontFamily: "'DM Mono', monospace", fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: '5px' }}>Race notes</span>
          {week.race_notes}
        </div>
      )}

      {/* Notes */}
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px' }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.62rem', color: 'var(--orange)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
          Weekly notes
        </div>
        <textarea
          value={notes}
          onChange={e => saveNotes(e.target.value)}
          placeholder="How did the week go? What surprised you. What was hard."
          style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: '0.84rem', lineHeight: 1.7, resize: 'vertical', minHeight: '72px', outline: 'none' }}
        />
      </div>
    </div>
  )
}
