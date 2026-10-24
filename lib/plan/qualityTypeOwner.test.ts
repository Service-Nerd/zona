// QUALITY-TYPE-NO-OWNER-01 (Coaching Board 2026-10-24). Three questions, three owners in sessionRole.ts, and the three
// guards that named the dead `type: 'long'` to catch the long run (which is `easy` + `role: 'long_run'`) and so never did.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { isQualitySession, isHardEffort, isHardDay, isHardDayLabel, isQualityType, isHardEffortType } from './sessionRole'
import { hasBackToBackHardDays } from '@/lib/coaching/planAdjustment'
import { computePostRaceReshape } from '@/lib/coaching/postRaceReshape'
import { keySessionLabel } from '@/lib/coaching/voiceLines'
import type { Plan, Week, Session, RaceResult } from '@/types/plan'

const s = (type: string, extra: Record<string, unknown> = {}) => ({ type, label: type, distance_km: 10, ...extra }) as unknown as Session
const QUALITY = s('quality'), TT = s('hard'), LONG = s('easy', { role: 'long_run' }), EASY = s('easy'), RACE = s('race')

describe('the three owners answer three questions', () => {
  it('isQualitySession: a training stimulus; the time trial is NOT one (§78)', () => {
    expect([QUALITY, TT, LONG, EASY, RACE].map(isQualitySession)).toEqual([true, false, false, false, false])
  })
  it('isHardEffort: effortful; the time trial IS one', () => {
    expect([QUALITY, TT, LONG, EASY, RACE].map(isHardEffort)).toEqual([true, true, false, false, false])
  })
  it('isHardDay: a stressor for spacing (§7); the long run IS one, by role', () => {
    expect([QUALITY, TT, LONG, EASY, RACE].map(isHardDay)).toEqual([true, true, true, false, false])
    expect(isHardDayLabel('long')).toBe(true)
    expect(isHardDayLabel('easy')).toBe(false)
  })
  it('legacy intervals/tempo still classify, for a stored plan that ever carried them', () => {
    expect(['intervals', 'tempo'].every(isQualityType)).toBe(true)
    expect(isHardEffortType('hard') && !isQualityType('hard')).toBe(true)
  })
})

describe('§7 — the spacing guard sees the long run', () => {
  it('a quality session the day before a long run is back-to-back hard days', () => {
    expect(hasBackToBackHardDays([EASY, QUALITY, LONG, EASY])).toBe(true)
  })
  it('quality, easy, long is fine', () => {
    expect(hasBackToBackHardDays([QUALITY, EASY, LONG])).toBe(false)
  })
})

describe('§62 — the post-race blackout converts the long run too, and it stops being a long run', () => {
  const week = (n: number, type: string): Week => ({
    n, date: '2026-04-27', phase: 'build', type, weekly_km: 120,
    sessions: { mon: s('rest', { distance_km: 0 }), tue: s('quality', { distance_km: 24 }), thu: s('easy', { distance_km: 24 }),
                sat: s('easy', { distance_km: 24 }), sun: s('easy', { distance_km: 48, role: 'long_run' }) },
  } as unknown as Week)
  const plan = { meta: { race_distance_km: 42.2 }, weeks: [1, 2, 3, 4, 5, 6, 7, 8].map(n => week(n, n === 2 ? 'race' : 'build')) } as unknown as Plan
  const out = computePostRaceReshape(plan, { distance_km: 42.2 } as RaceResult, 2)!
  it('in the first blackout week no hard day survives: quality AND the long run are easy recovery', () => {
    const firstAfter = out.reshapedPlan.weeks[2]
    const days = Object.values(firstAfter.sessions).filter(Boolean) as Session[]
    expect(days.filter(isHardDay)).toEqual([])
    expect((firstAfter.sessions as any).sun.type).toBe('recovery')
    expect((firstAfter.sessions as any).sun.role).toBeUndefined()
  })
})

describe('the morning push — the long run is a key session', () => {
  it('a long run is found and named "long" (the noun table already says "Long run")', () => {
    expect(keySessionLabel(LONG as any)).toBe('long')
    expect(keySessionLabel(EASY as any)).toBeNull()
    expect(keySessionLabel(QUALITY as any)).toBe('quality')
    expect(keySessionLabel(RACE as any)).toBe('race')
  })
})

// The gate. A hand-written set naming quality with intervals or tempo (the shape of all 42) may live only in
// sessionRole.ts. Run-type lists that also name easy/run/recovery are a different question and are allowed.
const ROOT = path.resolve(__dirname, '../..')
function walk(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return []
    const p = path.join(d, e.name)
    return e.isDirectory() ? walk(p) : /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) && !p.includes('__fixtures__') ? [p] : []
  })
}
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, '')).replace(/\/\/[^\n]*/g, '')
// A different question, named with its reason. Matched by file AND line content, never by line number.
const EXEMPT: ReadonlyArray<[string, string, string]> = [
  ['lib/ops/storedPlanProbes.ts', "expected !== 'intervals'", 'compares HR BAND names, not session types'],
  ['app/api/og/session-complete-card/route.tsx', "case 'tempo'", 'a zone number PER type: a map, not a classifier'],
  ['app/api/og/session-complete-card/route.tsx', "case 'intervals'", 'the same map'],
  ['components/dashboard/SessionPopupInner.tsx', "'Zone 3'", 'a zone label PER type: a map, not a classifier'],
  ['components/dashboard/SessionPopupInner.tsx', "'Zone 4–5'", 'the same map'],
  ['components/shared/ZoneBar.tsx', "return 3", 'a zone number PER type: a map, not a classifier'],
  ['components/shared/ZoneBar.tsx', "return 5", 'the same map'],
  ['lib/ui/recoveryCardCopy.ts', "'interval session'", 'the WORD for each type in copy: a map, not a classifier'],
]
const exempt = (f: string, line: string) => EXEMPT.some(([ef, snip]) => path.relative(ROOT, f) === ef && line.includes(snip))
export function handWrittenTypeSets(): string[] {
  return ['lib', 'app', 'components'].flatMap(d => walk(path.join(ROOT, d)))
    .filter(f => !f.endsWith(path.join('lib', 'plan', 'sessionRole.ts')))
    .flatMap(f => stripComments(fs.readFileSync(f, 'utf8')).split('\n').map((line, i) => ({ f, i: i + 1, line })))
    .filter(({ line }) => /'(quality|intervals|tempo)'/.test(line) && /'(quality|intervals|tempo)'[\s\S]*'(quality|intervals|tempo)'/.test(line) && !/'(easy|run|recovery)'/.test(line))
    .filter(({ f, line }) => !exempt(f, line))
    .map(({ f, i }) => `${path.relative(ROOT, f)}:${i}`)
}
describe('the gate — no hand-written "is this quality" set outside sessionRole.ts', () => {
  it('none remain', () => expect(handWrittenTypeSets()).toEqual([]))
  it('every exemption still matches a real line (a stale exemption is a hole)', () => {
    for (const [f, snip] of EXEMPT) expect(fs.readFileSync(path.join(ROOT, f), 'utf8'), `${f} / ${snip}`).toContain(snip)
  })
  it('the sessionRole owner is still the one place they live', () => {
    expect(fs.readFileSync(path.join(ROOT, 'lib/plan/sessionRole.ts'), 'utf8')).toContain("new Set(['quality', 'intervals', 'tempo'])")
  })
})
