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
  const out: { level: string; engineLevel: string; sessions: Session[] }[] = []
  for (const input of cohortGrid()) {
    try {
      const p = generateRulePlan(input as GeneratorInput, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      const sessions = (p.weeks ?? []).flatMap(w =>
        (Object.values(w.sessions ?? {}) as (Session | null)[])
          .filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'strength'))
      // The DECLARED level and the level the ENGINE classified are different
      // axes (§79) and they disagree often — a runner declaring `experienced`
      // at 12 km/week is classified beginner, which is what governs catalogue
      // eligibility and the duration anchor. Capture both.
      out.push({
        level: (input as GeneratorInput).fitness_level as string,
        engineLevel: String(p.meta?.fitness_intensity_level ?? p.meta?.fitness_level ?? ''),
        sessions,
      })
    } catch { /* refusals are the engine working */ }
  }
  return out
})()

const all = plans.flatMap(p => p.sessions.map(s => ({ level: p.level, engineLevel: p.engineLevel, s })))

describe('SESSION-KM-02 — who is actually affected', () => {
  it('generated a real corpus', () => {
    expect(plans.length).toBeGreaterThan(500)
    expect(all.length).toBeGreaterThan(20000)
  })

  it('duration-anchored plans are a BEGINNER phenomenon', () => {
    // TWO DIFFERENT QUESTIONS, and they need two different measures — amended
    // 2026-09-17 (PLAN-FITNESS-01).
    //
    // For NON-beginners the question is SESSION-KM-02's blast radius: does any
    // session lack `distance_km`, so that `?? 0` under-counted it? Must be zero.
    //
    // For BEGINNERS the question is the §79/§80 CONTRACT: are they prescribed in
    // minutes? `distance_km == null` is only a proxy for that, and §80's
    // finish-goal long run breaks the proxy by design — it is duration-anchored
    // (`duration_anchored`, `primary_metric: 'duration'`) AND carries distance as
    // a deliberate SECONDARY value so the card can show both. The §24/§80
    // specificity ramp makes that lift fire in build as well as peak, which moved
    // the proxy 92.1% -> 90.0% while the contract itself did not change. Measured
    // before and after; the drift is entirely secondary distances.
    const lacksDistance = (x: { s: { distance_km?: number | null } }) => x.s.distance_km == null
    const durationAnchored = (x: { s: { distance_km?: number | null; primary_metric?: string; duration_anchored?: boolean } }) =>
      lacksDistance(x) || x.s.duration_anchored === true || x.s.primary_metric === 'duration'
    const rate = (lvl: string, f: (x: never) => boolean) => {
      const g = all.filter(x => x.level === lvl)
      return g.filter(f as (x: unknown) => boolean).length / g.length
    }
    expect(rate('beginner', durationAnchored as never)).toBeGreaterThan(0.9)
    expect(rate('intermediate', lacksDistance as never)).toBe(0)
    expect(rate('experienced', lacksDistance as never)).toBe(0)
  })

  it('NON-BEGINNER quality carries a distance; BEGINNER quality does not — and that changed', () => {
    // ⚠️ THIS ASSERTION USED TO READ "quality sessions ALWAYS carry a distance",
    // and SESSION-KM-02 used that measured fact to justify leaving four
    // `distance_km ?? 0` sites in `invariants.ts` alone. **§110 Am.2 (2026-09-19)
    // invalidated it**: a beginner who set a time target now receives quality,
    // and beginners are duration-anchored (§79/§80), so those sessions carry
    // `duration_mins` and no `distance_km`.
    //
    // The recorded assumption was TRUE when written and a later ruling made it
    // false. That is why this test exists — it is the tripwire on a premise,
    // not a restatement of it.
    //
    // Consequence, recorded not silently accepted: §9's km floor
    // (`INV-PLAN-MIN-SESSION-SIZE`) skips duration-anchored sessions, so it
    // does not reach beginner quality. Filed as `S9-DURATION-FLOOR-01`. The
    // obvious fix — reading the size through `sessionKmSelfPaced` — was tried
    // and is WRONG: it fires on ordinary beginner easy runs too (30 minutes at
    // a beginner's pace is 3.9 km against a 4 km floor). A km floor applied to
    // a session prescribed in minutes asks the wrong question, and §9 has no
    // minutes equivalent yet.
    const quality = all.filter(x => ['quality', 'intervals', 'tempo', 'hard'].includes(x.s.type ?? ''))
    expect(quality.length).toBeGreaterThan(1000)

    const paceless = quality.filter(x => x.s.distance_km == null)
    // Every one of them must be a duration-anchored prescription, never a
    // session that simply lost its size.
    for (const x of paceless) {
      expect(x.s.duration_mins, 'a quality session with neither distance nor duration').toBeGreaterThan(0)
    }
    // And they must all be BEGINNER plans — if a non-beginner quality session
    // ever loses its distance, the four `?? 0` sites under-count it for real.
    const nonBeginnerPaceless = paceless.filter(x => x.engineLevel !== 'beginner')
    expect(nonBeginnerPaceless).toEqual([])
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
