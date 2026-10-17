import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * STRENGTH-PLAN-GLYPH-01 (Design Board, 2026-10-17). (a) SHIP: the dumbbell marks a lift on
 * Plan, because a strength row's title ("Full body") never says strength and the rail colour
 * was the only cue. (b) DON'T SHIP: no running glyph on run rows or cards; the run label
 * already names the run and the width was measured. Bounded to DayRow, never the whole file.
 */
const src = readFileSync('components/training/PlanCalendar.tsx', 'utf8')
const dayRow = src.slice(src.indexOf('function DayRow('))

describe('glyphs on Plan', () => {
  it('a strength-only row carries the dumbbell beside its title', () => {
    const at = dayRow.indexOf('strengthRow && strength ? (')
    expect(at).toBeGreaterThan(-1)
    const block = dayRow.slice(at, dayRow.indexOf('{strength.title}', at))
    expect(block).toMatch(/<Glyph name="dumbbell" \/>/)
  })
  it('the run-day Strength mark carries it too', () => {
    const at = dayRow.indexOf('{strength && !strengthRow && (')
    expect(dayRow.slice(at, dayRow.indexOf('Strength\n', at) + 10)).toMatch(/<Glyph name="dumbbell" \/>Strength/)
  })
  it('🔴 exactly two glyphs in DayRow, both the dumbbell: no running glyph (ruled DON\'T SHIP)', () => {
    const glyphs = Array.from(dayRow.matchAll(/<Glyph name="(\w+)"/g)).map(m => m[1])
    expect(glyphs).toEqual(['dumbbell', 'dumbbell'])
  })
  it('🔴 and none on a run SessionCard: the card glyph is strength-only', () => {
    const card = readFileSync('components/shared/SessionCard.tsx', 'utf8')
    expect(card).toMatch(/\{type === 'strength' && <span[^>]*><Glyph name="dumbbell" \/><\/span>\}/)
    expect(Array.from(card.matchAll(/<Glyph name="/g)).length).toBe(1)
  })
})
