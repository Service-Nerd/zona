// MOVE-PROTOTYPE-01 — the prototype the Design Board asked for.
//
// Sitting three ruled INSUFFICIENT EVIDENCE on the move-a-run gesture:
//
//   "The founder wants hold-and-drag; Wroblewski pushed back — drag on a
//    scrolling list, one-handed, outdoors, is the hardest gesture on a phone
//    and has no discoverability. His counter: tap the session, tap the day.
//    Board split; needs a prototype."
//
// 🔴 THE FIRST THING THE PROTOTYPE HAS TO SAY IS THAT THE SPLIT WAS RECORDED
// WRONG. Wroblewski's "counter" is what ALREADY SHIPS: tap the ↕ handle, the
// week enters move mode with "Tap where you want it", tap a day, and an inline
// confirmation row names the source, the destination and the swap before
// anything is written. So the question is not "which of these two do we build",
// it is "is drag worth REPLACING a shipped flow that an incident hardened".
//
// ⚠️ AND THE SAFETY IS HELD CONSTANT HERE, DELIBERATELY. The 2026-06-26
// incident root cause was a runner who did not realise the tap-to-move he had
// executed WAS a move; the override and the AI summary that followed corrupted
// his taper. `pendingMove` and the confirmation row exist because of that. A
// drop IS a commit gesture, so drag that writes on release re-opens exactly
// that root cause — and a prototype that let it would be comparing a safe flow
// against an unsafe one and reporting that the unsafe one is faster. Both modes
// stage into the SAME pendingMove and the SAME confirmation row. Only the
// acquire-and-place gesture varies.
//
// Committed, 404 in production, same as /wizard-preview and the rest.

'use client'

import { useState, useEffect, useRef } from 'react'
import { notFound } from 'next/navigation'
import PlanCalendar, { type MoveAttempt } from '@/components/training/PlanCalendar'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'

export default function MovePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [mode, setMode] = useState<'tap' | 'drag'>('tap')
  const [log, setLog] = useState<MoveAttempt[]>([])

  // 🔴 A RAW BROWSER TRACE, because "it doesn't work" is not a bug report and
  // I cannot drive a real touch gesture from a dev machine.
  //
  // The first version of the drag failed on a phone and my verification could
  // not have caught it: I dispatched synthetic PointerEvents straight at the
  // element, which bypasses the browser's gesture arbitration entirely. The
  // hypothesis for that failure was that the browser claimed the gesture for
  // scrolling and fired `pointercancel`. This panel is how that gets confirmed
  // or killed by whoever holds the phone, rather than argued about.
  const [trace, setTrace] = useState<string[]>([])
  const t0 = useRef<number>(0)
  useEffect(() => {
    const push = (name: string) => (e: Event) => {
      setTrace(prev => {
        if (name === 'down') t0.current = Date.now()
        const at = t0.current ? Date.now() - t0.current : 0
        const pe = e as PointerEvent
        const line = `${String(at).padStart(4)}ms  ${name}${pe.pointerType ? ` (${pe.pointerType})` : ''}`
        return [...prev.slice(-11), line]
      })
    }
    const evs: [string, EventListener][] = [
      ['pointerdown',   push('down')],
      ['pointercancel', push('CANCEL  ← the browser took the gesture')],
      ['pointerup',     push('up')],
      ['touchmove',     push('touchmove')],
      ['scroll',        push('scroll   ← the list moved')],
    ]
    for (const [n, h] of evs) document.addEventListener(n, h, { passive: true, capture: true })
    return () => { for (const [n, h] of evs) document.removeEventListener(n, h, { capture: true }) }
  }, [])

  // A real generated week, not a fixture. The gesture's difficulty depends on
  // row heights, and rest rows are shorter than session rows — a hand-made week
  // of seven identical rows would make drag look easier than it is.
  const src = MARKETING_PLANS.find(p => p.slug === 'sub-2-hour-half-marathon-plan')!
  const { planStart, raceDate } = planAnchor(src.dayOffset)
  const plan = generateRulePlan(src.input(raceDate), 'free', planStart)

  const forMode = (m: 'tap' | 'drag') => log.filter(a => a.mode === m)
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null)

  const stat = (m: 'tap' | 'drag') => {
    const all = forMode(m)
    const staged = all.filter(a => a.outcome === 'staged')
    return {
      attempts: all.length,
      staged: staged.length,
      abandoned: all.length - staged.length,
      interactions: mean(staged.map(a => a.interactions)),
      ms: mean(staged.map(a => a.ms)),
      misses: all.reduce((n, a) => n + a.misses, 0),
    }
  }

  const cell: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink)',
    padding: '6px 10px', borderBottom: '1px solid var(--line)', textAlign: 'right',
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: 20 }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
          Moving a run: two gestures
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '0 0 4px' }}>
          Both end at the same confirmation row. Only the way you pick a session
          up and put it down is different.
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--mute)', lineHeight: 1.5, margin: '0 0 16px' }}>
          Try each one <strong>one-handed</strong>, and try scrolling the list
          while you are in drag mode. That is the thing being tested.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['tap', 'drag'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
                border: `1px solid ${mode === m ? 'var(--moss)' : 'var(--line)'}`,
                background: mode === m ? 'var(--moss-soft)' : 'var(--card)',
                color: mode === m ? 'var(--moss)' : 'var(--ink-2)',
              }}
            >
              {m === 'tap' ? 'Tap handle, tap day' : 'Hold and drag'}
              <div style={{ fontWeight: 400, fontSize: 11, color: 'var(--mute)', marginTop: 2 }}>
                {m === 'tap' ? 'what ships today' : 'the prototype'}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 16 }}>
          <PlanCalendar
            weeks={plan.weeks}
            allOverrides={[]}
            allCompletions={{}}
            onOverrideChange={() => {}}
            onSessionTap={() => {}}
            moveMode={mode}
            onMoveTelemetry={a => setLog(prev => [...prev, a])}
            onMovePhase={ph => setTrace(prev => {
              const at = t0.current ? Date.now() - t0.current : 0
              return [...prev.slice(-13), `${String(at).padStart(4)}ms  \u2039gesture\u203a ${ph}`]
            })}
          />
        </div>

        {/* The measurement. A sitting run on impressions produces a ruling
            about impressions — this is here so the board has a number. */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            What it cost
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...cell, textAlign: 'left', color: 'var(--mute)', fontWeight: 500 }} />
                <th style={{ ...cell, color: 'var(--mute)', fontWeight: 500 }}>Tap</th>
                <th style={{ ...cell, color: 'var(--mute)', fontWeight: 500 }}>Drag</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['Attempts', (x: ReturnType<typeof stat>) => String(x.attempts)],
                ['Reached the confirm row', (x: ReturnType<typeof stat>) => String(x.staged)],
                ['Backed out', (x: ReturnType<typeof stat>) => String(x.abandoned)],
                ['Interactions (mean)', (x: ReturnType<typeof stat>) => x.interactions === null ? '—' : String(x.interactions)],
                ['Time to confirm row', (x: ReturnType<typeof stat>) => x.ms === null ? '—' : `${x.ms} ms`],
                ['Dropped on nothing', (x: ReturnType<typeof stat>) => String(x.misses)],
              ] as const).map(([label, f]) => (
                <tr key={label}>
                  <td style={{ ...cell, textAlign: 'left', color: 'var(--ink-2)' }}>{label}</td>
                  <td style={cell}>{f(stat('tap'))}</td>
                  <td style={cell}>{f(stat('drag'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 12px', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', lineHeight: 1.5 }}>
            ⚠️ <strong>&ldquo;Dropped on nothing&rdquo; is the number to watch.</strong> It is the
            cost Wroblewski named, and it is the one a demo by the person who
            built the gesture will always under-report.
          </div>
          {log.length > 0 && (
            <button
              onClick={() => setLog([])}
              style={{ width: '100%', padding: '10px', border: 'none', borderTop: '1px solid var(--line)', background: 'var(--bg-soft)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
            >
              Reset
            </button>
          )}
        </div>

        {/* The raw trace. Read it after one hold-and-drag: if `CANCEL` appears,
            the browser claimed the gesture. Lines marked \u2039gesture\u203a are the
            component's OWN state — the browser lines alone cannot tell a press
            that never armed from one that armed and was torn down. */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginTop: 16 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            What the browser did
          </div>
          <pre style={{ margin: 0, padding: '10px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 11, lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
            {trace.length ? trace.join('\n') : 'Hold a session row for half a second, drag it to another day, let go.'}
          </pre>
          <button
            onClick={() => setTrace([])}
            style={{ width: '100%', padding: 10, border: 'none', borderTop: '1px solid var(--line)', background: 'var(--bg-soft)', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}
          >
            Clear trace
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', lineHeight: 1.6, marginTop: 16 }}>
          Nothing here writes. <code>onOverrideChange</code> is a no-op, so
          confirming a move changes the screen and not the database.
        </p>
      </div>
    </div>
  )
}
