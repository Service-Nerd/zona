// ADR-027 B4a (ADR027-B4A-BLOCKS) — L3's block planner.
//
// 🔴 WHAT THIS FILE CANNOT PROVE, SAID FIRST SO IT IS NOT MISTAKEN FOR THE GATE.
// `composeBlocks` is a MOVE: the arithmetic came out of `ruleEngine.ts`'s `computePhases`
// unchanged. A test written here shares that derivation, so it cannot tell a faithful move from a
// faithful-looking one — "a checker sharing the producer's list is blind", at the level of a whole
// function. **The gate for the move is `npm run verify:parity`, 6,210 cases diffed against the
// previous commit, plus the full suite.** What this file gates is everything parity cannot see:
// the PROPERTIES the phase table must hold, the DECISIONS agreeing with the phases they describe,
// and the two single-owner facts that would let the old derivation creep back.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { composeBlocks, type BlockRequest } from './composeBlocks'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { RULES } from '@/lib/engine/catalogue/rules'
import type { Phase } from '@/types/plan'

const RULE_IDS = new Set(RULES.map(r => r.id))

/** Swept over every lever the block planner reads. Deliberately wider than the product sends —
 *  §89's base reaches ZERO only where a short runway meets a foundation block, which neither
 *  measurement grid can build (0 of 45,776 corpus plans, PHASE-EMPTY-01), so the grid that tests
 *  the terminal case has to go looking for it. Reach is ASSERTED below, never assumed. */
function grid(): BlockRequest[] {
  const out: BlockRequest[] = []
  for (const distance_km of [5, 10, 21.1, 42.2, 50, 100]) {
    for (const total_weeks of [5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 30]) {
      for (const early_onset of [false, true]) {
        for (const foundation_weeks of [0, 1, 2, 3, 4]) {
          for (const onset_relax of [0, 1, 2]) {
            for (const days_available of [2, 3, 4, 5, 6, 7]) {
              out.push({ total_weeks, distance_km, early_onset, foundation_weeks, onset_relax, days_available })
            }
          }
        }
      }
    }
  }
  return out
}

/** Built ONCE and memoised. Every arm below walks the same ~11k rows, and composing them per arm
 *  put two of them over `check:slow`'s 1,000 ms reporting line for work that is identical each time.
 *  A baseline entry would have recorded the waste rather than removed it. */
const CASES: readonly BlockRequest[] = grid()
const PLANS = new Map<BlockRequest, ReturnType<typeof composeBlocks>>()
const planOf = (req: BlockRequest) => {
  let p = PLANS.get(req)
  if (!p) { p = composeBlocks(req); PLANS.set(req, p) }
  return p
}

const ORDER: Phase['name'][] = ['base', 'build', 'peak', 'taper']
const lengthOf = (phases: Phase[], name: Phase['name']) => {
  const p = phases.find(x => x.name === name)
  return p ? p.end_week - p.start_week + 1 : 0
}

describe('ADR-027 B4a — composeBlocks: the phase table', () => {
  const cases = CASES

  it('the grid is not empty and reaches the cases the properties exist for', () => {
    expect(cases.length).toBeGreaterThan(1000)
    // An EMPTY POPULATION MUST NOT PASS. Each of these is a branch the properties below guard, and
    // one the real corpora cannot reach, so the file states the count it actually exercised.
    const reach = {
      baseDroppedToZero: 0,   // §89 + §91's foundation credit taking base to nothing (PHASE-EMPTY-01)
      buildFloorBinds: 0,     // §4's 1-week build floor, which is what drives the take-back
      peakFloorBinds: 0,      // §4's 2-week peak floor, the other half of the overage
      taperSqueezed: 0,       // the overage the take-back could NOT absorb (see the §49 arm)
      yieldRaisedBase: 0,     // §98's ladder giving base back
      shortOnRamp: 0,         // §97's one-week cap selected
    }
    for (const req of cases) {
      const r = planOf(req)
      if (lengthOf(r.phases, 'base') === 0) reach.baseDroppedToZero++
      if (lengthOf(r.phases, 'build') === 1) reach.buildFloorBinds++
      if (lengthOf(r.phases, 'peak') === 2) reach.peakFloorBinds++
      if (lengthOf(r.phases, 'taper')
        < GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[raceDistanceKey(req.distance_km)].length) reach.taperSqueezed++
      if (r.short_on_ramp) reach.shortOnRamp++
      if (req.early_onset && req.onset_relax > 0) {
        const without = composeBlocks({ ...req, onset_relax: 0 })
        if (lengthOf(r.phases, 'base') > lengthOf(without.phases, 'base')) reach.yieldRaisedBase++
      }
    }
    for (const [k, n] of Object.entries(reach)) expect(n, `${k} is unreached — the grid proves nothing about it`).toBeGreaterThan(0)
  })

  it('§4 — phases are in order, contiguous, non-empty, and cover every week exactly once', () => {
    for (const req of cases) {
      const { phases } = planOf(req)
      const label = JSON.stringify(req)
      // Order preserved, each name at most once (§4: one purpose, one block).
      const names = phases.map(p => p.name)
      expect(new Set(names).size, label).toBe(names.length)
      expect(names, label).toEqual(ORDER.filter(n => names.includes(n)))
      // No empty or inverted phase reaches plan_json (PHASE-EMPTY-01).
      for (const p of phases) expect(p.end_week, `${label} ${p.name}`).toBeGreaterThanOrEqual(p.start_week)
      // Contiguous and complete: week 1 to total_weeks, no gap, no overlap.
      expect(phases.length, label).toBeGreaterThan(0)
      expect(phases[0].start_week, label).toBe(1)
      expect(phases[phases.length - 1].end_week, label).toBe(req.total_weeks)
      for (let i = 1; i < phases.length; i++) {
        expect(phases[i].start_week, label).toBe(phases[i - 1].end_week + 1)
      }
    }
  })

  it('🔴 §49 — the taper is authored, EXCEPT where §4\'s floors squeeze it, which the old code claimed it did not', () => {
    // 🔴 THIS ARM WAS WRITTEN TO ASSERT `taper === min(authored, total_weeks)` AND IT WENT RED, which
    // is how a false comment was found. `computePhases` carried the line *"Preserves taper duration as
    // authored"* beside its overage take-back, and that is true only while build and base can absorb
    // the overage. When they cannot, `peakEnd` grows past `totalWeeks - authored` and the taper is
    // squeezed from the front — it is the residual, not a protected block.
    //
    // 📐 MEASURED, and the §44 prep gate is what bounds it: the shortest PRODUCIBLE plan is 5 weeks
    // at 5K, 7 at 10K, 9 at HM, 11 at MARATHON and over 11 for both ultras (probed against
    // `generateRulePlan`, one runway at a time, until it stopped refusing). Against the squeeze
    // table that leaves exactly TWO producible cases, both 5K: a 5-week plan gets NO taper phase and
    // a 6-week plan gets 1 against an authored 2. Everything else delivers the authored length.
    // Filed as `BLOCK-TAPER-SQUEEZE-01` (🏃 Coaching Board, non-blocking) — whether a 5-week 5K
    // SHOULD spend 2 of its 5 weeks tapering is a coaching question, not a defect to patch inside a
    // move. What this arm fixes is the claim.
    const FLOORS = GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR + 1 + 2  // §4: base ≥ 2, build ≥ 1, peak ≥ 2
    for (const req of cases) {
      const { phases } = planOf(req)
      const authored = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[raceDistanceKey(req.distance_km)].length
      const taper = lengthOf(phases, 'taper')
      const label = JSON.stringify(req)
      // It is never LONGER than authored: §49 is a cap and the squeeze only ever cuts.
      expect(taper, label).toBeLessThanOrEqual(authored)
      // And it is exactly authored once the runway clears §4's floors plus the taper. Early onset
      // and a foundation credit only shrink base, so this bound is sufficient for every row.
      if (req.total_weeks >= FLOORS + authored) expect(taper, label).toBe(authored)
    }
  })

  it('🔴 §49 Am. 1 — every runway §44 can permit now DELIVERS the authored taper', () => {
    // 🔴 THIS ARM USED TO PIN THE OPPOSITE, AND THE RULING IS WHY IT CHANGED. It asserted that the
    // phase table overruns `total_weeks` on every runway of 1–4 weeks, because §4's peak floor was
    // applied before the taper was reserved. §49 Amendment 1 (Coaching Board 2026-11-28) reversed
    // the order: the peak yields, so the overrun now occurs only at 1–2 weeks and no plan from 4
    // weeks up lacks a taper phase. Re-measured rather than re-derived.
    const noTaper: number[] = []
    const overran: number[] = []
    for (const distance_km of [5, 10, 21.1, 42.2]) {
      for (let total_weeks = 1; total_weeks <= 16; total_weeks++) {
        const { phases } = composeBlocks({
          total_weeks, distance_km, early_onset: false, foundation_weeks: 0, onset_relax: 0, days_available: 5,
        })
        const last = phases[phases.length - 1]
        if (last.end_week > total_weeks) overran.push(total_weeks)
        if (!phases.some(p => p.name === 'taper')) noTaper.push(total_weeks)
      }
    }
    // ⚠️ Both residuals are below §44's floor for EVERY distance (5K blocks under 4 weeks of prep,
    // so 5 total weeks is the shortest producible plan; 10K 7, HM 9, marathon 11). They are
    // asserted rather than assumed because §44 is a guard in a different layer: if it is ever
    // relaxed, this arm is what says what breaks.
    expect(Array.from(new Set(overran)).sort((a, b) => a - b), 'the overrun moved').toEqual([1, 2])
    expect(Array.from(new Set(noTaper)).sort((a, b) => a - b), 'a taper-less runway moved').toEqual([1, 2, 3])
  })

  it('🔴 §49 Am. 1 — no producible plan gets a peak of ONE week, below the floor this ruling added', () => {
    // 🔴 FOUND BY CODE REVIEW, AND IT WAS MY OWN RULING VIOLATING ITS OWN CONSTANT. The first cut
    // tested `remaining >= baseFloor + 1 + peakFloor` — the UNGATED base floor — so for a §89-gated
    // runner whose base had legitimately been shortened it dropped the peak floor that the same
    // commit introduces. 📐 Measured: 4 of 10,962 producible plans got a ONE-week peak; 0 now.
    // ⚠️ The cohort was outside my own test population (both arms above pass `early_onset: false`),
    // and `INV-PLAN-PEAK-LR-ALTERNATION` / `INV-PLAN-PEAK-STEPBACK-VOLUME` need ≥2 peak weeks, so
    // they would have gone SILENT rather than caught it.
    const peakFloor = GENERATION_CONFIG.MIN_PEAK_WEEKS_FLOOR
    let checked = 0, noPeak = 0
    for (const distance_km of [5, 10, 21.1, 42.2, 50, 100]) {
      const key = raceDistanceKey(distance_km)
      for (let total_weeks = GENERATION_CONFIG.PREP_TIME_THRESHOLDS[key].block + 1; total_weeks <= 30; total_weeks++)
      for (const early_onset of [false, true])
      for (const foundation_weeks of [0, 1, 2, 3])
      for (const onset_relax of [0, 1, 2])
      for (const days_available of [2, 3, 4, 5, 6, 7]) {
        const { phases } = composeBlocks({
          total_weeks, distance_km, early_onset, foundation_weeks, onset_relax, days_available,
        })
        const peak = phases.find(p => p.name === 'peak')
        const len = peak ? peak.end_week - peak.start_week + 1 : 0
        // Either the peak is absent entirely (the intended terminal case, PHASE-EMPTY-01) or it
        // meets its floor. A peak of 1 is neither.
        expect(len === 0 || len >= peakFloor,
          `${key}/${total_weeks}w eo=${early_onset} fw=${foundation_weeks} → peak of ${len}`).toBe(true)
        if (len === 0) noPeak++
        checked++
      }
    }
    expect(checked, 'nothing was checked').toBeGreaterThan(10000)
    expect(noPeak, 'no plan dropped the peak — the terminal case is unreached and the arm is weaker than it reads').toBeGreaterThan(0)
  })

  it('🔴 §49 Am. 1 — the taper FLOOR holds for every producible runway', () => {
    // The ruling's own property: §49's table is a band, so a plan delivers at least its stated
    // number of actual taper weeks BEFORE the race. Counted before the race, not including it —
    // the 6-week 5K passed the old cap check precisely because its taper phase WAS race week alone.
    // ⚠️ SCOPED TO PRODUCIBLE RUNWAYS, from §44's OWN thresholds rather than a hand-typed list.
    // Below them the floor is arithmetically unreachable — an HM at 5 weeks would need
    // base 2 + build 1 + taper 3 = 6 — and the ruling forbids the base yielding (§91) while build
    // is already at its own floor. §44 refuses every one of those, which is the same relationship
    // the overrun arm above records: a real floor whose only violations are refused upstream.
    let checked = 0
    for (const distance_km of [5, 10, 21.1, 42.2, 50, 100]) {
      const key = raceDistanceKey(distance_km)
      const authored = GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[key].length - 1
      const shortest = GENERATION_CONFIG.PREP_TIME_THRESHOLDS[key].block + 1
      for (let total_weeks = shortest; total_weeks <= 30; total_weeks++) {
        const { phases } = composeBlocks({
          total_weeks, distance_km, early_onset: false, foundation_weeks: 0, onset_relax: 0, days_available: 5,
        })
        const taper = phases.find(p => p.name === 'taper')!
        const beforeRace = taper.end_week === total_weeks
          ? taper.end_week - taper.start_week   // race week excluded
          : taper.end_week - taper.start_week + 1
        expect(beforeRace, `${distance_km}km / ${total_weeks}w`).toBeGreaterThanOrEqual(authored)
        checked++
      }
    }
    expect(checked, 'nothing was checked').toBeGreaterThan(100)
  })

  it('§91 / §98 — the base floor binds for every ungated runner, and the yield never exceeds the ungated base', () => {
    for (const req of cases) {
      const { phases } = planOf(req)
      const base = lengthOf(phases, 'base')
      const label = JSON.stringify(req)
      if (!req.early_onset) {
        // §91's floor, unless §4's take-back or a runway too short for base at all cut it.
        const remaining = Math.max(0, req.total_weeks - GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK[raceDistanceKey(req.distance_km)].length)
        if (remaining >= GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR + 3) {
          expect(base, label).toBeGreaterThanOrEqual(GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR)
        }
        // §98's relax is scoped to the gated runner: it may not move an ungated plan.
        expect(base, `${label} — onset_relax reached an ungated runner`)
          .toBe(lengthOf(composeBlocks({ ...req, onset_relax: 0 }).phases, 'base'))
      } else if (req.onset_relax > 0) {
        // §98 — bounded by the base an UNGATED runner would receive. §89 may be trimmed to
        // nothing, never past nothing, and the yield may never overshoot the other way either.
        const ungated = lengthOf(composeBlocks({ ...req, early_onset: false, onset_relax: 0 }).phases, 'base')
        expect(base, `${label} — the yield exceeded the ungated base`).toBeLessThanOrEqual(ungated)
      }
    }
  })

  it('§97 — `short_on_ramp` is false for every ungated runner and only ever true where §97 Am. 1 allows it', () => {
    for (const req of cases) {
      const r = planOf(req)
      if (!req.early_onset) {
        expect(r.short_on_ramp, JSON.stringify(req)).toBe(false)
        continue
      }
      const distKey = raceDistanceKey(req.distance_km)
      const allowed = (GENERATION_CONFIG.ONSET_SHORT_ONRAMP_DISTANCES as readonly string[]).includes(distKey)
      // §97 Am. 1 (INTENSITY-3DAY-01): the denominator scope. A 3-day 10K may not take it.
      const headroom = (GENERATION_CONFIG.INTENSITY_DISTRIBUTION[distKey].max_quality_session_pct / 100) * req.days_available
      expect(r.short_on_ramp, JSON.stringify(req))
        .toBe(allowed && headroom >= GENERATION_CONFIG.ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM)
    }
  })
})

describe('ADR-027 B4a — the decisions (L4\'s input, ARCH-ENG-009)', () => {
  const cases = CASES

  it('🔴 every phase-length decision equals the phase it describes', () => {
    // THIS IS THE ARM THAT MATTERS, and it is the L4 failure class caught at its source: the HLD's
    // whole case for decision records is that a note generated from them "cannot contradict the
    // sessions". A decision whose value disagrees with the phase it names is that contradiction,
    // one layer earlier, and nothing downstream could tell.
    for (const req of cases) {
      const { phases, decisions } = planOf(req)
      for (const name of ORDER) {
        const d = decisions.find(x => x.what === `plan.phases.${name}_weeks`)
        expect(d, `${JSON.stringify(req)} — no decision for ${name}`).toBeTruthy()
        expect(d!.unit).toBe('weeks')
        expect(d!.value, `${JSON.stringify(req)} — ${name}`).toBe(lengthOf(phases, name))
      }
      // The week counts in the decisions must add up to the plan. A decision set that is
      // individually right and collectively wrong is still wrong.
      const summed = ORDER.reduce((n, name) =>
        n + Number(decisions.find(x => x.what === `plan.phases.${name}_weeks`)!.value), 0)
      expect(summed, JSON.stringify(req)).toBe(req.total_weeks)
    }
  })

  it('every `bound_by` is a real catalogue rule, and a dropped phase is recorded rather than silent', () => {
    const boundBy = new Set<string>()
    let droppedRecorded = 0
    for (const req of cases) {
      const { phases, decisions } = planOf(req)
      for (const d of decisions) {
        expect(RULE_IDS.has(d.bound_by), `${d.what} cites ${d.bound_by}, which is not in the catalogue`).toBe(true)
        boundBy.add(d.bound_by)
        expect(d.week, 'a block decision is plan-level').toBeNull()
        expect(d.day).toBeNull()
      }
      // PHASE-EMPTY-01: a phase that was dropped leaves a record saying so, because "the base is
      // absent" and "the base was never considered" are different facts and read identically.
      const present = new Set(phases.map(p => p.name))
      const missing = ORDER.filter(n => !present.has(n))
      const dropped = decisions.filter(d => d.what === 'plan.phases.dropped').map(d => d.value)
      expect([...dropped].sort(), JSON.stringify(req)).toEqual([...missing].sort())
      droppedRecorded += dropped.length
    }
    expect(droppedRecorded, 'no case dropped a phase — the arm above proves nothing').toBeGreaterThan(0)
    // Each onset rule must actually be reachable as a binding, or it is a string nothing can produce.
    for (const id of ['INV-PLAN-PHASE-STRUCTURE', 'INV-PLAN-TAPER-DURATION-CAP',
      'INV-PLAN-EARLY-ONSET-GATED', 'INV-PLAN-ONRAMP-FLOOR', 'INV-PLAN-ONSET-YIELD-BOUNDED']) {
      expect(boundBy.has(id), `${id} is cited by no decision the grid can produce`).toBe(true)
    }
  })

  it('🔴 the base names the rule that ACTUALLY bound it — §91\'s floor is not §4', () => {
    // 🔴 FOUND BY CODE REVIEW. The first cut cited `INV-PLAN-PHASE-STRUCTURE` (§4) whenever the base
    // was not shortened by §89 — including every row where `Math.max(baseFloor, …)` is what set it.
    // §4 governs ORDER and CONTIGUITY; the floor is Seiler's on-ramp, `INV-PLAN-ONRAMP-FLOOR` (§91),
    // which `invariants.ts` applies to the UNGATED runner too (it selects `MIN_BASE_WEEKS_FLOOR`
    // when `early_quality_onset` is false). 23,040 grid rows carried the wrong attribution — latent
    // only because nothing reads decisions until L4, which is the moment it becomes runner-facing copy.
    //
    // ⚠️ PINNED CASES, hand-derived, NOT a recomputation of the producer's expression. A test that
    // recomputed `round(remaining × base_pct / denom)` would share the derivation and be blind to it.
    const baseRule = (req: BlockRequest) =>
      composeBlocks(req).decisions.find(d => d.what === 'plan.phases.base_weeks')!.bound_by
    const req = (over: Partial<BlockRequest>): BlockRequest => ({
      total_weeks: 20, distance_km: 10, early_onset: false,
      foundation_weeks: 0, onset_relax: 0, days_available: 4, ...over,
    })
    // Ungated, runway long enough that the proportional share clears the floor → §4's split set it.
    expect(baseRule(req({}))).toBe('INV-PLAN-PHASE-STRUCTURE')
    expect(baseRule(req({ total_weeks: 7, distance_km: 5 }))).toBe('INV-PLAN-PHASE-STRUCTURE')
    // Ungated, 5-week 5K — the shortest PRODUCIBLE plan there is. The proportional share rounds
    // below 2, so §91's floor is what lifted it. This is the row the old attribution got wrong.
    expect(baseRule(req({ total_weeks: 5, distance_km: 5 }))).toBe('INV-PLAN-ONRAMP-FLOOR')
    // Gated: §91's week cap, then its foundation credit, then §98's yield, each in turn.
    expect(baseRule(req({ early_onset: true }))).toBe('INV-PLAN-ONRAMP-FLOOR')
    expect(baseRule(req({ early_onset: true, foundation_weeks: 2 }))).toBe('INV-PLAN-ONRAMP-FLOOR')
    expect(baseRule(req({ early_onset: true, foundation_weeks: 2, onset_relax: 2 })))
      .toBe('INV-PLAN-ONSET-YIELD-BOUNDED')
  })

  it('§97\'s verdict is recorded only when the gate it modifies opened', () => {
    // Emitting `short_on_ramp: false` for an ungated runner would read as "§97 considered this and
    // declined". It did not run at all.
    let withGate = 0
    for (const req of cases) {
      const { decisions } = planOf(req)
      const d = decisions.find(x => x.what === 'plan.phases.short_on_ramp')
      if (req.early_onset) { expect(d).toBeTruthy(); withGate++ } else expect(d).toBeUndefined()
    }
    expect(withGate).toBeGreaterThan(0)
  })
})

describe('ADR-027 B4a — the strangler boundary', () => {
  const root = process.cwd()
  const src = (f: string) => readFileSync(join(root, f), 'utf8')
  /** A comment is prose (HOOK-RGBA-COMMENTS-01). Line count is preserved so positions still line up. */
  const strip = (s: string) => s
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))

  it('🔴 `computePhases` is GONE from the old engine — this is a move, not a delegation', () => {
    const engine = src('lib/plan/ruleEngine.ts')
    // The name survives only in the comment that records where it went; a `function computePhases`
    // would mean two derivations of one number, which is the defect this slice removes.
    expect(engine).not.toMatch(/function\s+computePhases/)
    expect(engine).toMatch(/composeBlocks\(\{/)
  })

  it('🔴 §97\'s predicate has ONE owner — the old call site may not re-derive it', () => {
    // It was computed seven lines above the phase call. A sweep, not a memory: the config key is the
    // thing the derivation cannot be written without.
    //
    // ⚠️ COMMENTS ARE STRIPPED FIRST, and that is HOOK-RGBA-COMMENTS-01's lesson applied: a sweep
    // that fires on prose about the rule fires on correct work, and a guard that fires on correct
    // work gets switched off. `ruleEngine.ts` is free to say WHERE the predicate went.
    expect(strip(src('lib/plan/ruleEngine.ts'))).not.toMatch(/ONSET_SHORT_ONRAMP_DISTANCES/)
    expect(strip(src('lib/engine/planner/composeBlocks.ts'))).toMatch(/ONSET_SHORT_ONRAMP_DISTANCES/)
    // The population must be non-empty: a `strip` that blanked the file would pass arm 1 silently.
    expect(strip(src('lib/plan/ruleEngine.ts'))).toMatch(/composeBlocks\(\{/)
  })

})
