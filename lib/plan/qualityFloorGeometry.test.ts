// §110 Amendment 3 — the quality floor does not fire where the open days cannot hold it.
//
// 🔴 HOW THIS WAS FOUND, because the item it came from was wrong about itself.
// `ALL-DAYS-BLOCKED-01` said an all-seven-days-blocked input "generates a plan whose long
// run sits on a blocked Sunday". In the shape the wizard actually posts
// (`days_available = 7 - blocked`) that input is REFUSED, and 0 sessions land on a blocked
// day at any day count. The symptom does not exist.
//
// 🔑 What does exist: a week whose open days cannot hold both a long run and a §7-spaced
// quality session gets zero quality, silently, and `INV-PLAN-QUALITY-NOT-ZERO` then
// reports an error whose cause is arithmetic.
//
// 📐 Measured across all 21 two-open-day placements: **gap 1 gives 0 quality sessions,
// gap 2 or more gives 6.** Exactly the 7 adjacent pairs, `sat+sun` among them, which is
// the commonest two-day week there is.
//
// ⚠️ AND MY FIRST MEASUREMENT OF THIS WAS WRONG IN A WAY WORTH RECORDING. Blocking
// `DAYS.slice(0, n)` always leaves the WEEKEND open, so every "2-day" case I generated was
// `sat+sun` — gap 1 — and I reported "150 of 150 two-day plans" when the real answer is
// 7 of 21 PLACEMENTS. Varying the day COUNT is not reaching the day-PLACEMENT axis.
import { describe, it, expect } from 'vitest'
import { canHoldSpacedQuality, dayGap, DAY_ORDER, type Day } from './days'
import { GENERATION_CONFIG } from './generationConfig'
import { runEngine } from './engine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const MIN_GAP = Math.ceil(GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY_AND_LONG / 24)

describe('dayGap — ONE owner, after two copies', () => {
  it('is circular: sunday and monday are one day apart', () => {
    expect(dayGap('sun', 'mon')).toBe(1)
    expect(dayGap('mon', 'sun')).toBe(1)
  })
  it('is zero for the same day and never exceeds three', () => {
    for (const a of DAY_ORDER) {
      expect(dayGap(a, a)).toBe(0)
      for (const b of DAY_ORDER) expect(dayGap(a, b)).toBeLessThanOrEqual(3)
    }
  })
  it('matches the arithmetic BOTH retired copies implemented', () => {
    // `ruleEngine` used an index map, `invariants` used indexOf. They agreed; the point is
    // that a checker holding its own copy of its producer's predicate can only drift.
    for (const a of DAY_ORDER) for (const b of DAY_ORDER) {
      const d = Math.abs(DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b))
      expect(dayGap(a, b)).toBe(Math.min(d, 7 - d))
    }
  })
})

describe('§110 Am. 3 — canHoldSpacedQuality is keyed to GEOMETRY, not day count', () => {
  it('is false for one open day: §9 takes the only session as the long run', () => {
    expect(canHoldSpacedQuality(['sun'], 'sun', MIN_GAP)).toBe(false)
  })

  it('is false for every ADJACENT pair, and sat+sun is one of them', () => {
    const adjacent: [Day, Day][] = [
      ['mon', 'tue'], ['tue', 'wed'], ['wed', 'thu'],
      ['thu', 'fri'], ['fri', 'sat'], ['sat', 'sun'], ['mon', 'sun'],
    ]
    for (const [a, b] of adjacent) {
      expect(canHoldSpacedQuality([a, b], b, MIN_GAP), `${a}+${b}`).toBe(false)
      expect(canHoldSpacedQuality([a, b], a, MIN_GAP), `${a}+${b}`).toBe(false)
    }
  })

  it('is TRUE for every non-adjacent pair — a 2-day runner is not exempt by count', () => {
    // This is the arm that makes the amendment a geometry rule rather than §1 CD-21's
    // day-count shape. A 2-day runner on tue+sat gets 6 quality sessions and the floor
    // binds on them in full.
    let pairs = 0
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
      const a = DAY_ORDER[i], b = DAY_ORDER[j]
      if (dayGap(a, b) < MIN_GAP) continue
      pairs++
      expect(canHoldSpacedQuality([a, b], b, MIN_GAP), `${a}+${b}`).toBe(true)
    }
    // 21 pairs in all, 7 adjacent, so 14 must reach this.
    expect(pairs).toBe(14)
  })

  it('counts all 21 placements, 7 blocked and 14 not, so the population is asserted', () => {
    let blocked = 0, ok = 0
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
      const a = DAY_ORDER[i], b = DAY_ORDER[j]
      ;(canHoldSpacedQuality([a, b], b, MIN_GAP) ? () => ok++ : () => blocked++)()
    }
    expect({ blocked, ok }).toEqual({ blocked: 7, ok: 14 })
  })

  it('never exempts a week with three or more spread days', () => {
    expect(canHoldSpacedQuality(['tue', 'thu', 'sat'], 'sat', MIN_GAP)).toBe(true)
    expect(canHoldSpacedQuality(['mon', 'wed', 'fri', 'sun'], 'sun', MIN_GAP)).toBe(true)
  })

  it('reads §7 from config, so relaxing the spacing cannot be done here by accident', () => {
    // At a 1-day spacing the adjacent pairs WOULD hold a quality — which is exactly the
    // relaxation Willy refused. The predicate must follow §7, not carry its own number.
    expect(canHoldSpacedQuality(['sat', 'sun'], 'sun', 1)).toBe(true)
    expect(MIN_GAP).toBe(2)
  })
})

// ── End to end: the INVARIANT, in both directions ────────────────────────────
//
// The arms above prove the predicate. They cannot prove that the invariant consults it,
// nor — far more important — that the floor STILL BITES where §110 was written to bite:
// `suppressQuality` zeroed quality on 2,197 non-beginner plans and raised nothing.
// An exemption that buys silence instead of precision is worse than no exemption.
describe('§110 Am. 3 end to end — the floor goes quiet ONLY on the geometry', () => {
  const DAYS = DAY_ORDER
  const planStart = (() => {
    const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
    return d.toISOString().slice(0, 10)
  })()
  const raceIn = (w: number) =>
    new Date(Date.parse(`${planStart}T00:00:00Z`) + (w * 7 - 1) * 864e5).toISOString().slice(0, 10)

  const mk = (o: Record<string, unknown> = {}) => ({
    race_distance_km: 10, race_date: raceIn(16), goal: 'finish',
    user_declared_level: 'intermediate', days_available: 4, current_weekly_km: 30,
    longest_recent_run_km: 10, age: 38, training_age: '3-5yr',
    recent_quality_training: 'regular', injury_history: [], acknowledged_prep_warning: true, ...o,
  }) as unknown as GeneratorInput

  const planFor = (input: GeneratorInput) => {
    const r = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart, today: planStart })
    expect(r.kind, 'the fixture no longer generates a plan').toBe('plan')
    return (r as Extract<typeof r, { kind: 'plan' }>).plan
  }
  const fires = (plan: Plan, input: GeneratorInput) =>
    (validatePlan(plan, input) ?? []).some(v => v.code === 'INV-PLAN-QUALITY-NOT-ZERO')
  /** The `suppressQuality` mechanism, reproduced: turn every quality session easy. */
  const stripQuality = (plan: Plan): Plan => {
    const copy = JSON.parse(JSON.stringify(plan)) as Plan
    let n = 0
    for (const w of copy.weeks) for (const d of DAYS) {
      const s = (w.sessions as Record<string, Session | undefined>)?.[d]
      if (s && s.type === 'quality') { s.type = 'easy'; delete (s as { role?: unknown }).role; n++ }
    }
    expect(n, 'nothing was stripped, so this fixture proves nothing').toBeGreaterThan(0)
    return copy
  }

  it('STILL FIRES on an ample-day plan with its quality removed — §110’s whole purpose', () => {
    const input = mk()
    expect(fires(stripQuality(planFor(input)), input)).toBe(true)
  })

  it('does not fire on that same plan untouched', () => {
    const input = mk()
    expect(fires(planFor(input), input)).toBe(false)
  })

  it('STILL FIRES for a 2-day runner whose days are SPREAD — not a day-count exemption', () => {
    // open: tue + sat, gap 3. The geometry can hold a spaced quality, so the floor binds.
    const input = mk({ days_available: 2, days_cannot_train: ['mon', 'wed', 'thu', 'fri', 'sun'] })
    expect(fires(stripQuality(planFor(input)), input)).toBe(true)
  })

  it('goes quiet for a 2-day runner whose only days are ADJACENT', () => {
    const input = mk({ days_available: 2, days_cannot_train: ['mon', 'tue', 'wed', 'thu', 'fri'] })
    expect(fires(planFor(input), input)).toBe(false)
  })

  it('and RECORDS why, so zero quality is explained rather than silent (CD-22)', () => {
    const input = mk({ days_available: 2, days_cannot_train: ['mon', 'tue', 'wed', 'thu', 'fri'] })
    const adj = (planFor(input).meta.rule_adjustments ?? [])
      .filter(a => a.rule.includes('§110 Am. 3'))
    expect(adj).toHaveLength(1)
    expect(adj[0].violation).toContain('sat, sun')
    expect(adj[0].resolution).toMatch(/Opening one more day/)
    // ⚠️ No em dash: a sentence the runner reads (founder, 2026-09-22).
    expect(adj[0].violation + adj[0].resolution).not.toContain('—')
  })

  it('records NOTHING when the geometry is fine, so the note is not boilerplate', () => {
    const adj = (planFor(mk()).meta.rule_adjustments ?? [])
      .filter(a => a.rule.includes('§110 Am. 3'))
    expect(adj).toEqual([])
  })
})
