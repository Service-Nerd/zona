import { describe, it, expect } from 'vitest'
import { buildStrengthWeeklyNotePrompt, parseStrengthNote } from './strengthWeeklyNote'
import { weekNoteKey } from '@/lib/strength-bridge/weekNoteKey'

/**
 * 🔴 STRENGTH-NOTE-01 — Coaching Board: the note describes, never prescribes, and claims
 * nothing about what strength does. A reply that breaks a rule renders NOTHING.
 */
const input = {
  units: 'km' as const, firstName: 'Sam', weekN: 4, phase: 'build', focus: 'running' as const, experience: 'some' as const,
  sessions: [{ day: 'tue', title: 'Full body', minutes: 40, afterQualityRun: true, heavyLegs: true }],
  notes: ['heavy legs are limited by the run week, so some sessions are upper body'], weeksToRace: null,
}

describe('the strength note prompt', () => {
  it('carries the week and the board’s rules', () => {
    const p = buildStrengthWeeklyNotePrompt(input)
    expect(p).toContain('tue: Full body, 40 min, heavy legs, after a hard run the same day')
    expect(p).toContain('Make NO claim')
    expect(p).toContain('Do NOT tell them to add, cut or change')
    expect(p).toContain('Never use an em dash')
  })
  it('🔴 STRENGTH-SESSION-TOP-01: the note is told the screen already says why legs are off, and not to repeat it', () => {
    const p = buildStrengthWeeklyNotePrompt(input)
    expect(p).toContain('already tells the runner why heavy legs are off')
    expect(p).toContain('do NOT say that again')
    expect(p).not.toMatch(/you may say legs were kept/)
  })
})

describe('parseStrengthNote — the guard after the model', () => {
  it('passes a plain descriptive note', () => {
    expect(parseStrengthNote('Legs on Tuesday, after the intervals. Thursday is upper body, so Saturday stays easy.'))
      .toBe('Legs on Tuesday, after the intervals. Thursday is upper body, so Saturday stays easy.')
  })
  const refused: Array<[string, string]> = [
    ['an injury claim', 'This will help prevent injury on the long run.'],
    ['injured', 'Stay strong so you do not get injured.'],
    ['a speed claim', 'Heavy legs now make you faster later.'],
    ['economy', 'Good for running economy.'],
    ['a prescription', 'Add another leg day if you feel good.'],
    ['an em dash', 'Legs Tuesday — upper Thursday.'],
    ['three sentences', 'One. Two. Three.'],
    ['empty', '   '],
    ['too long', 'x'.repeat(300)],
  ]
  for (const [name, text] of refused) it(`🔴 refuses ${name}`, () => { expect(parseStrengthNote(text)).toBeNull() })
})

describe('weekNoteKey', () => {
  const week = { n: 4, phase: 'build' as const, sessions: [{ date: '2026-11-03', day: 'tue' as const, week_n: 4, kind: 'full_body' as const, heavy_legs: true, after_quality_run: true, estimated_minutes: 40, blocks: [] }] }
  it('is stable for the same week and changes when the week is re-placed', () => {
    expect(weekNoteKey(week)).toBe(weekNoteKey(JSON.parse(JSON.stringify(week))))
    expect(weekNoteKey({ ...week, sessions: [{ ...week.sessions[0], date: '2026-11-05' }] })).not.toBe(weekNoteKey(week))
    expect(weekNoteKey(week).startsWith('4:')).toBe(true)
  })
})
