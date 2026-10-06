// SESSION-ACHIEVABLE-01 — §81's second half, built (Coaching Board, 2026-10-06).
//
// §81's title carries BOTH halves: "Structured sessions are exempt from the
// weekday cap — AND the plan says when they don't fit." The exemption shipped;
// the declaration did not.
//
// 🔴 MEASURED BEFORE THE FIX, 499 capped plans: 246 (49.3%) carried a structured
// weekday session over the runner's stated cap, 182 (36.5%) past the ratified 50%
// tolerance, 675 sessions in total — and **every one belonged to a runner who
// stated a 30-minute cap**. Worst: 86 min against that 30 (+187%), an
// `HM-pace intervals` for an experienced HM runner on 20 km/week.
// `INV-PLAN-STRUCTURED-OVERRUN-DECLARED` fired **ZERO** times, because it tested
// `plan.meta.volume_constraint_note`'s PRESENCE — the MAINTENANCE note, written
// for a different reason. 74 of the 182 carried a note explicitly about VOLUME.
// The 2026-10-03 sitting named this exact defect and ruled the fix exempt; it was
// not done.
//
// ⚠️ THE RENDER ARM IS NOT OPTIONAL. This repo has shipped a stamped field with
// no reader twice that we know of — `run_walk_strategy` (schema-only for months,
// PRESCRIBED-FIELD-REACH-01) and `DerivedStep.note` (85.7% of steps, fixed this
// same day). A declaration nobody renders is the defect it was built to fix.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun, isStructuredSession } from './sessionRole'
import { formatDuration } from '@/lib/format'
import type { GeneratorInput, Session } from '@/types/plan'

const durationText = (mins: number): string => formatDuration(mins) ?? `${Math.round(mins)} min`

const TOL = GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT

interface Hit { mins: number; cap: number; note?: string; label: string }

function sweep(stride: number) {
  const grid = cohortGrid() as GeneratorInput[]
  const over: Hit[] = []
  const pastTol: Hit[] = []
  let plans = 0, invFirings = 0
  for (let i = 0; i < grid.length; i += stride) {
    const g = grid[i]!
    const cap = Number((g as { max_weekday_mins?: number }).max_weekday_mins ?? 0)
    if (!cap) continue
    let p
    try { p = generateRulePlan(g, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    plans++
    for (const w of (p as { weeks: { type?: string; sessions: Record<string, unknown> }[] }).weeks) {
      if (w.type === 'race') continue
      for (const [d, sn] of Object.entries(w.sessions)) {
        if (!sn || d === 'sat' || d === 'sun') continue
        const s = sn as Session
        if (isLongRun(s) || !isStructuredSession(s)) continue
        const mins = s.duration_mins ?? 0
        const hit: Hit = { mins, cap, note: s.weekday_overrun_note, label: s.label ?? '?' }
        if (mins > cap) over.push(hit)
        if (mins > cap * (1 + TOL / 100)) pastTol.push(hit)
      }
    }
    if ((validatePlan(p as never, g as never) as { code: string }[])
      .some(v => v.code === 'INV-PLAN-STRUCTURED-OVERRUN-DECLARED')) invFirings++
  }
  return { plans, over, pastTol, invFirings }
}

const S = sweep(53)

describe('SESSION-ACHIEVABLE-01 — a session that does not fit SAYS SO, on itself', () => {
  it('the population is real — capped plans with genuine overruns', () => {
    expect(S.plans, 'no capped plans in the sample').toBeGreaterThan(200)
    expect(S.over.length, 'no overrunning sessions — the sweep is not reaching them').toBeGreaterThan(500)
    expect(S.pastTol.length, 'no sessions past the ratified tolerance').toBeGreaterThan(100)
  })

  it('EVERY overrunning session carries its own note — not a plan-level one', () => {
    const silent = S.over.filter(h => !h.note?.trim())
    expect(silent.map(h => `"${h.label}" ${h.mins} min vs ${h.cap}`).slice(0, 5),
      `${silent.length} of ${S.over.length} overrunning sessions say nothing. §81 exempts them from ` +
      'the cap ON CONDITION the plan says they do not fit, and the 2026-10-03 sitting ruled that ' +
      'obligation is per-SESSION, "not via a shared note".').toEqual([])
  })

  it('the note names the MAGNITUDE and the LEVER (§40c), never only the loss', () => {
    const bad = S.over.filter(h => {
      const n = h.note ?? ''
      // Magnitude via ADR-015's owner, so `86 min` reads `1h 26` — the arm asks
      // that BOTH numbers appear in the reader's own duration grammar, not that
      // a raw minute count is interpolated.
      return !n.includes(durationText(h.mins)) || !n.includes(durationText(h.cap)) || !/raise your weekday|day with more room/.test(n)
    })
    expect(bad.map(h => `"${h.label}": ${h.note}`).slice(0, 3),
      '§40c: a note that reports only the loss is a disclaimer. It must name the constraint and the lever.').toEqual([])
  })

  it('INV-PLAN-STRUCTURED-OVERRUN-DECLARED is SILENT because every session is declared', () => {
    // ⚠️ Silence means nothing on its own — this invariant was silent BEFORE the
    // fix too, for the opposite reason. The arm above is what makes this one
    // meaningful: the sessions exist, they are declared, so it has nothing to say.
    expect(S.invFirings).toBe(0)
  })

  it('the note is RENDERED, not merely stamped', () => {
    // The defect this repo keeps repeating: a field with a producer and no reader.
    const card = readFileSync(join(__dirname, '..', '..', 'components', 'dashboard', 'SessionPopupInner.tsx'), 'utf8')
    expect(card.includes('session.weekday_overrun_note'),
      'SessionPopupInner does not read weekday_overrun_note — the declaration would be stamped and invisible, ' +
      'which is exactly the defect it was built to fix.').toBe(true)
    // And it must reach a block, not sit in a comment.
    const rendered = /\{session\.weekday_overrun_note\s*&&[\s\S]{0,400}?<CoachNoteBlock/.test(card)
    expect(rendered, 'the note is referenced but not rendered inside a CoachNoteBlock').toBe(true)
  })
})
