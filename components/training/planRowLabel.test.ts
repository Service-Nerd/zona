import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { SESSION_LABELS } from '@/lib/session-types'
import { isLongRun } from '@/lib/plan/sessionRole'
import type { Session } from '@/types/plan'

/**
 * UX-PLAN-MOVE-01 — the Plan row says a session's name once.
 *
 * The row used to carry the session label AND a type chip reading
 * `SESSION_LABELS[session.type]`. On a phone the chip took 115px of a 172px row
 * and clipped the label to 51px, so every easy day read "Easy…".
 *
 * D9 had already asserted the intent — "the session label is primary… let this
 * secondary type chip yield first" — and set `flexShrink: 1` on the chip. It
 * never fired: the label is `flex: 1 1 0%`, so its basis is 0, there is never
 * negative free space, and a shrink factor with nothing to shrink is decoration.
 *
 * Two layers here. The source guard is what actually stops the chip coming back.
 * The measurement below is why it should not, kept executable so the reason
 * cannot rot into folklore — anyone proposing to re-add it has to argue with a
 * number rather than an opinion.
 */

const SAMPLE = 120

function generatedSessions() {
  const out: { type: string; label: string; role?: Session['role'] }[] = []
  for (const input of cohortGrid().slice(0, SAMPLE)) {
    let plan
    try {
      plan = generateRulePlan(input as never, 'paid' as never, COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    } catch { continue }
    for (const w of plan.weeks ?? []) {
      for (const s of Object.values(w.sessions ?? {}) as never[]) {
        const sess = s as { type?: string; label?: string; role?: Session['role'] } | null
        if (!sess?.type || sess.type === 'rest' || !SESSION_LABELS[sess.type]) continue
        out.push({ type: sess.type, label: sess.label ?? '', role: sess.role })
      }
    }
  }
  return out
}

describe('Plan row — the type chip is gone, and stays gone', () => {
  it('PlanCalendar does not re-state the session type beside the label', () => {
    const src = readFileSync('components/training/PlanCalendar.tsx', 'utf8')
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code, [
      'The Plan row is rendering SESSION_LABELS again.',
      'Measured over thousands of generated sessions, that chip is a verbatim',
      'duplicate of the label two thirds of the time, wrong on long runs, and',
      'less informative than the label on quality. It also clips the label it',
      'sits beside. The type signal it carried in colour is already on the row,',
      'in the left accent bar.',
    ].join('\n')).not.toContain('SESSION_LABELS')
  })

  it('the chip would duplicate the label on most sessions — the reason, kept executable', () => {
    const sessions = generatedSessions()
    expect(sessions.length).toBeGreaterThan(1000) // never pass vacuously
    const dup = sessions.filter(s => {
      const chip = SESSION_LABELS[s.type]!.toLowerCase()
      const label = s.label.toLowerCase()
      return label.includes(chip) || chip.includes(label)
    })
    expect(dup.length / sessions.length).toBeGreaterThan(0.5)
  })

  it('the chip would be WRONG on a long run, not merely redundant', () => {
    // `SESSION_LABELS` reads `type`, and a long run carries `type: 'easy'`, so
    // the row wore "Easy run — Zone 2" beside a label reading "Long run —
    // marathon pace + HM-pace finish".
    const longs = generatedSessions().filter(s => isLongRun(s))
    expect(longs.length).toBeGreaterThan(50)
    const mislabelled = longs.filter(s => /easy/i.test(SESSION_LABELS[s.type] ?? ''))
    expect(mislabelled.length).toBe(longs.length)
  })
})
