import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import harnessPlan from '@/components/dashboard/__fixtures__/harnessPlan.json'
import { composeSession } from './sessionComposer'
import { catalogueRowFor } from './catalogueLink'
import { sessionSilhouette } from './sessionSilhouette'
import type { DerivedSet } from './resolveMainSet'
import type { Session } from '@/types/plan'

/**
 * 🔴 SESSION-PRERUN-DETAIL-01 (Design Board 2026-10-22) — the silhouette is read from the session MODEL, width by minutes,
 * height by prescribed zone, on real engine sessions (the committed harness plan), not hand-made fixtures.
 */
const sessions = (harnessPlan as unknown as { weeks: { sessions: Record<string, Session | null> }[] }).weeks
  .flatMap(w => Object.values(w.sessions ?? {})).filter((s): s is Session => !!s)
const byLabel = (label: string) => sessions.find(s => s.label === label)!
const shape = (s: Session) => {
  const structure = composeSession({ session: s, catalogueRow: catalogueRowFor(s), goalPace: null })
  return sessionSilhouette(structure, (s.derived_set as DerivedSet | undefined) ?? null)
}

describe('sessionSilhouette on real sessions', () => {
  it('a continuous tempo: warm-up, one work block, cool-down; the work is the tallest', () => {
    const s = shape(byLabel('Continuous tempo'))!
    expect(s.map(x => x.part)).toEqual(['warmup', 'main', 'cooldown'])
    expect(s[1].work).toBe(true)
    expect(s[1].level).toBeGreaterThan(s[0].level)
  })
  it('🔴 over-unders read as an over above an under, three times', () => {
    const main = shape(byLabel('Over-unders'))!.filter(x => x.part === 'main')
    const work = main.filter(x => x.work)
    expect(work.length).toBe(6)
    expect(work[0].level).toBeGreaterThan(work[1].level)
    expect(main.filter(x => !x.work).length).toBe(3)
  })
  it('🔴 the main set is as long as the composer says, so the strip agrees with the headers beneath it', () => {
    for (const label of ['Cruise intervals', 'Over-unders', 'Mile repeats', 'Progressive tempo']) {
      const s = byLabel(label)
      const structure = composeSession({ session: s, catalogueRow: catalogueRowFor(s), goalPace: null })!
      const main = shape(s)!.filter(x => x.part === 'main').reduce((a, x) => a + x.mins, 0)
      expect(main).toBeCloseTo(structure.main.duration_mins, 5)
    }
  })
  it('every drawable session yields at least two segments with positive minutes and levels 1 to 5.5', () => {
    let drawn = 0
    for (const s of sessions) {
      const sh = shape(s)
      if (!sh) continue
      drawn++
      expect(sh.length).toBeGreaterThanOrEqual(2)
      for (const x of sh) { expect(x.mins).toBeGreaterThan(0); expect(x.level).toBeGreaterThanOrEqual(1); expect(x.level).toBeLessThanOrEqual(5.5) }
    }
    expect(drawn).toBeGreaterThan(20)
  })
  it('no structure, no silhouette', () => {
    expect(sessionSilhouette(null, null)).toBeNull()
  })
})

describe('the screen', () => {
  it('🔴 it renders under the Session structure heading, coloured by the session (so a long run is --s-long)', () => {
    const steps = readFileSync('components/shared/SessionSteps.tsx', 'utf8')
    expect(steps).toMatch(/>Session structure<\/div>\s*\{silhouette && silhouetteColour && \(/)
    expect(readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')).toContain('silhouetteColour={getSessionColor(session)}')
  })
  it('it is never on Plan rows (UX-SESSION-GLYPH-01)', () => {
    expect(readFileSync('components/training/PlanCalendar.tsx', 'utf8')).not.toMatch(/\bSessionSilhouette\b|\bsessionSilhouette\b/)
  })
})
