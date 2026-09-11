import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { isLongRun } from '@/lib/plan/sessionRole'
import { sessionKm, sessionKmSelfPaced, paceBandMidpointMinPerKm } from '@/lib/plan/sessionDistance'
import type { GeneratorInput, Session } from '@/types/plan'

/**
 * SESSION-KM-02 — `distance_km ?? 0` is a beginner-only defect, and it made
 * checks SILENTLY PASS rather than fire.
 *
 * The measurement that scoped the work, kept executable so nobody re-derives it:
 * 95.8% of a beginner's sessions are duration-anchored against 0% for
 * intermediate and experienced, and quality sessions are NEVER duration-anchored
 * — which is why four sites in `invariants.ts` that compare quality kilometres
 * were left alone rather than swept.
 */

const plans = (() => {
  const out: { level: string; sessions: Session[] }[] = []
  for (const input of cohortGrid()) {
    try {
      const p = generateRulePlan(input as GeneratorInput, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      const sessions = (p.weeks ?? []).flatMap(w =>
        (Object.values(w.sessions ?? {}) as (Session | null)[])
          .filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'strength'))
      out.push({ level: (input as GeneratorInput).fitness_level as string, sessions })
    } catch { /* refusals are the engine working */ }
  }
  return out
})()

const all = plans.flatMap(p => p.sessions.map(s => ({ level: p.level, s })))

describe('SESSION-KM-02 — who is actually affected', () => {
  it('generated a real corpus', () => {
    expect(plans.length).toBeGreaterThan(500)
    expect(all.length).toBeGreaterThan(20000)
  })

  it('duration-anchored plans are a BEGINNER phenomenon', () => {
    const rate = (lvl: string) => {
      const g = all.filter(x => x.level === lvl)
      return g.filter(x => x.s.distance_km == null).length / g.length
    }
    expect(rate('beginner')).toBeGreaterThan(0.9)
    expect(rate('intermediate')).toBe(0)
    expect(rate('experienced')).toBe(0)
  })

  it('quality sessions always carry a distance — why four sites were left alone', () => {
    const quality = all.filter(x => ['quality', 'intervals', 'tempo', 'hard'].includes(x.s.type ?? ''))
    expect(quality.length).toBeGreaterThan(1000)
    expect(quality.filter(x => x.s.distance_km == null)).toEqual([])
  })

  it('long runs do not — which is why the long-run sites were fixed', () => {
    const longs = all.filter(x => isLongRun(x.s))
    expect(longs.filter(x => x.s.distance_km == null).length).toBeGreaterThan(500)
  })
})

describe('sessionKm — the owner', () => {
  it('never silently reports zero for a session that has a duration', () => {
    const s = { type: 'easy', distance_km: null, duration_mins: 132 } as unknown as Session
    expect(sessionKm(s, null)).toBeNull()        // unknown, NOT zero
    expect(sessionKm(s, 6)).toBeCloseTo(22, 5)
  })

  it('converts a duration-anchored session via its own pace band', () => {
    const s = { type: 'easy', duration_mins: 132, pace_target: '6:00–6:30 /km' } as unknown as Session
    expect(sessionKmSelfPaced(s)).toBeCloseTo(132 / 6.25, 5)
  })

  it('prefers a real distance over any conversion', () => {
    const s = { type: 'easy', distance_km: 10, duration_mins: 132, pace_target: '6:00–6:30 /km' } as unknown as Session
    expect(sessionKmSelfPaced(s)).toBe(10)
  })

  it('parses both band shapes and neither of the nonsense ones', () => {
    expect(paceBandMidpointMinPerKm('6:00–6:30 /km')).toBeCloseTo(6.25, 5)
    expect(paceBandMidpointMinPerKm('5:30 /km')).toBeCloseTo(5.5, 5)
    expect(paceBandMidpointMinPerKm('easy')).toBeNull()
    expect(paceBandMidpointMinPerKm(null)).toBeNull()
  })

  it('a non-running session covers no ground even with a duration', () => {
    expect(sessionKm({ type: 'strength', duration_mins: 40 } as unknown as Session, 6)).toBe(0)
  })
})

describe('SESSION-KM-02 — the sites that were fixed stay fixed', () => {
  it('no reachable consumer reads a session distance as zero', () => {
    // The quality sites in invariants.ts are measured unreachable (above) and
    // deliberately excluded; `race_distance_km ?? 0` is a PLAN field, not a
    // session, and is excluded for the same reason — not sweeping blind was the
    // point of the measurement.
    const ALLOWED = {
      'lib/plan/invariants.ts': 5,        // 4 quality (unreachable) + race_distance_km (a PLAN field)
      'lib/plan/ruleEngine.ts': 3,        // §47 + §52 (board-gated) + the duration-from-distance inverse
    } as Record<string, number>
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const [file, cap] of Object.entries(ALLOWED)) {
      const n = (stripComments(readFileSync(file, 'utf8')).match(/distance_km \?\? 0/g) ?? []).length
      expect(n, `${file} has ${n} \`distance_km ?? 0\` sites, expected at most ${cap}`).toBeLessThanOrEqual(cap)
    }
    for (const file of ['lib/plan/cohortShape.ts', 'lib/coaching/reshapeMagnitude.ts']) {
      expect(stripComments(readFileSync(file, 'utf8'))).not.toContain('distance_km ?? 0')
    }
  })
})
