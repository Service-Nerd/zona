// ADR-027 B4b (ADR027-B4B-WEEKS) — L3's week planner.
//
// 🔴 WHAT THIS FILE CANNOT PROVE, SAID FIRST. `composeWeekVolumes` is a MOVE: the three passes came
// out of `ruleEngine.ts`'s `buildVolumeSequence` unchanged. A test written here shares that
// derivation and cannot tell a faithful move from a faithful-looking one. **The gate for the move is
// the exhaustive equivalence diff against the pre-move function — 76,032 cases, 0 differences, every
// branch reached, falsified three ways** (recorded in `docs/contracts/engine.md § L3`), plus the full
// suite. ⚠️ `verify:parity` is IDENTICAL over 6,210 and it reaches MORE of this curve than I first
// wrote: code review measured that its grid sweeps `['Knee']` and `['Shin splints']`, exactly
// `hasVolumeCappedInjury`'s cohort. What it genuinely cannot reach is the **returning-runner**
// allowance — it never sets `training_age`, which `isReturningRunner` requires.
//
// What this file gates is what neither can see: the curve's PROPERTIES, the DECISIONS agreeing with
// the volumes they describe, the non-null assertion B4a proved can be undefined, and the two
// single-owner facts that would let the old derivation creep back.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { composeWeekVolumes, type WeekVolumeRequest } from './composeWeekVolumes'
import { composeBlocks, getPhaseForWeek } from './composeBlocks'
import { computeDeloadWeeks } from '@/lib/plan/deloadCadence'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { RULES } from '@/lib/engine/catalogue/rules'

const RULE_IDS = new Set(RULES.map(r => r.id))
const INJ = GENERATION_CONFIG.INJURY_WEEKLY_INCREASE_CAP_PCT

/** Swept over every lever the week planner reads. Smaller than the equivalence probe's 76,032 —
 *  that one is a one-off diff and this runs on every build — but it reaches every branch, which is
 *  ASSERTED below rather than assumed. */
function grid(): WeekVolumeRequest[] {
  const out: WeekVolumeRequest[] = []
  for (const distance_km of [5, 10, 21.1, 42.2, 100])
  for (const total_weeks of [5, 8, 12, 16, 20, 30])
  for (const early_onset of [false, true])
  for (const start_km of [6, 20, 45, 100])
  for (const peak_km of [12, 30, 60, 130])
  for (const returning_runner of [false, true])
  for (const injury_cap_pct of [undefined, INJ]) {
    const { phases } = composeBlocks({
      total_weeks, distance_km, early_onset, foundation_weeks: 0, onset_relax: 0, days_available: 5,
    })
    const deload_weeks = computeDeloadWeeks(total_weeks, 4, wn => getPhaseForWeek(wn, phases), true)
    out.push({
      total_weeks, phases, start_km, peak_km, distance_km, returning_runner, injury_cap_pct, deload_weeks,
    })
  }
  return out
}

const CASES: readonly WeekVolumeRequest[] = grid()
const PLANS = new Map<WeekVolumeRequest, ReturnType<typeof composeWeekVolumes>>()
/** Memoised: every arm walks the same grid, and composing per arm is what put two of B4a's arms
 *  over `check:slow`'s reporting line for work that is identical each time. */
const planOf = (req: WeekVolumeRequest) => {
  let p = PLANS.get(req)
  if (!p) { p = composeWeekVolumes(req); PLANS.set(req, p) }
  return p
}
const weekRules = (req: WeekVolumeRequest) =>
  planOf(req).decisions.filter(d => d.what === 'week.volume_km')

describe('ADR-027 B4b — composeWeekVolumes: the curve', () => {
  it('the grid reaches every branch the arms below exist for', () => {
    // An EMPTY POPULATION MUST NOT PASS, and a grid that misses a branch is an empty population for
    // that branch. Each of these is a distinct writer of a week's volume.
    expect(CASES.length).toBeGreaterThan(1000)
    const reach = {
      deloadDrop: 0, injuryCapped: 0, bounceback: 0, taperWeeks: 0,
      compressed: 0, startBelowFloor: 0, startAboveCeiling: 0,
    }
    for (const req of CASES) {
      const rules = new Set(weekRules(req).map(d => d.bound_by))
      if (rules.has('INV-PLAN-DELOAD-IS-A-REDUCTION')) reach.deloadDrop++
      if (rules.has('INV-PLAN-INJURY-CAP-DELIVERED')) reach.injuryCapped++
      if (rules.has('INV-PLAN-BOUNCEBACK-BOUNDED')) reach.bounceback++
      if (rules.has('INV-PLAN-TAPER-DELIVERED-DEPTH')) reach.taperWeeks++
      if (planOf(req).compressed) reach.compressed++
      const floor = req.peak_km * GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK / 100
      const ceiling = req.peak_km * GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK / 100
      if (req.start_km < floor) reach.startBelowFloor++
      if (req.start_km > ceiling) reach.startAboveCeiling++
    }
    for (const [k, n] of Object.entries(reach)) {
      expect(n, `${k} is unreached — the grid proves nothing about it`).toBeGreaterThan(0)
    }
  })

  it('every week carries a whole, positive number of km, one per week', () => {
    for (const req of CASES) {
      const { volumes } = planOf(req)
      const label = `${req.distance_km}km/${req.total_weeks}w start${req.start_km} peak${req.peak_km}`
      expect(volumes.length, label).toBe(req.total_weeks)
      for (let i = 0; i < volumes.length; i++) {
        const v = volumes[i]
        expect(Number.isInteger(v), `${label} w${i + 1} = ${v}`).toBe(true)
        expect(v, `${label} w${i + 1}`).toBeGreaterThan(0)
      }
    }
  })

  it('🔴 §106 — no week exceeds the peak target, and this arm is the ONLY check of that anywhere', () => {
    // The ramp is clamped to `peak_km` and the taper only ever cuts, so the whole curve sits under
    // it. A week above peak would mean the clamp had been bypassed by a later pass.
    //
    // 🔴 NO CATALOGUE RULE ASSERTS THIS. Found while attributing the clamp's Decision: §106's only
    // rule, `INV-PLAN-PEAK-NOT-BELOW-START`, is a FLOOR check ("a plan never peaks BELOW where the
    // runner already is"), and nothing checks the ceiling — on the figure CLAUDE.md calls the single
    // most consequential in a plan. Filed `PEAK-CEILING-NO-INVARIANT-01` (⚙️). Until a rule exists,
    // this is the gate, which is why it says so rather than reading as routine.
    for (const req of CASES) {
      const over = planOf(req).volumes.filter(v => v > Math.round(req.peak_km))
      expect(over, `${req.distance_km}km/${req.total_weeks}w peak${req.peak_km}`).toEqual([])
    }
  })

  it('🔴 §31 — the compression verdict is not forced FALSE when §49 Am. 1 removes the peak phase', () => {
    // 🔴 FOUND BY CODE REVIEW. The verdict read `phases.find(… 'peak')` and left `compressed` false
    // when there was none. §49 Am. 1 makes the peak absent on a 5- or 6-week 5K, so the ruling would
    // have forced the verdict false on exactly the plans it changed — **absence written as a value**,
    // since "did the ramp reach target?" is not answered NO when it was asked of no weeks at all.
    // 📐 Measured: a 5-week 5K beginner at start 10 / peak 14 flipped true → false, and
    // `cohort:shape` could not have caught it because `cohortGrid`'s 5K is fixed at 12 weeks.
    const { phases } = composeBlocks({
      total_weeks: 5, distance_km: 5, early_onset: false, foundation_weeks: 0, onset_relax: 0, days_available: 4,
    })
    expect(phases.some(p => p.name === 'peak'), 'the fixture must have NO peak phase or it proves nothing').toBe(false)
    const deload_weeks = computeDeloadWeeks(5, 4, wn => getPhaseForWeek(wn, phases), true)
    const squeezed = composeWeekVolumes({
      total_weeks: 5, phases, start_km: 10, peak_km: 14, distance_km: 5,
      returning_runner: false, injury_cap_pct: undefined, deload_weeks,
    })
    // The ramp cannot reach a 14 km peak from 10 in a 5-week plan whose loading block is one week.
    expect(squeezed.compressed, '§31 must still classify a plan with no peak phase').toBe(true)
    expect(squeezed.decisions.find(d => d.what === 'plan.volume_compressed')!.value).toBe(true)
  })

  it('🔴 §3 — a deload reduces, measured against the week the runner actually got', () => {
    // DELOAD-INVERSION-01: pass 1 sets the deload to a fraction of the PRE-CAP prior week, and pass
    // 2 then caps that prior week lower — so "70% of uncapped" could equal or exceed the delivered
    // prior week, a recovery week that reduces nothing (12.8% of plans). Pass 2's re-anchor is what
    // fixes it, and this is the property it exists for.
    let checked = 0
    for (const req of CASES) {
      const { volumes } = planOf(req)
      for (const n of Array.from(req.deload_weeks)) {
        if (n < 2 || n > req.total_weeks) continue
        if (getPhaseForWeek(n, req.phases) === 'taper') continue  // taper deloads are pass 3's
        expect(volumes[n - 1], `${req.distance_km}km/${req.total_weeks}w deload w${n}`)
          .toBeLessThan(volumes[n - 2])
        checked++
      }
    }
    expect(checked, 'no non-taper deload week was checked — the arm proves nothing').toBeGreaterThan(100)
  })

  it('§6 — the taper only ever descends, and race week is its lowest point', () => {
    for (const req of CASES) {
      const { volumes } = planOf(req)
      const taper = req.phases.find(p => p.name === 'taper')
      if (!taper) continue
      const weeks = []
      for (let n = taper.start_week; n <= taper.end_week; n++) weeks.push(volumes[n - 1])
      const label = `${req.distance_km}km/${req.total_weeks}w`
      for (let i = 1; i < weeks.length; i++) expect(weeks[i], `${label} taper step ${i}`).toBeLessThanOrEqual(weeks[i - 1])
      if (taper.end_week === req.total_weeks) {
        expect(Math.min(...weeks), `${label} race week`).toBe(weeks[weeks.length - 1])
      }
    }
  })

  it('🔴 the `!` in pass 3 is now safe by RULING, not by luck — and still does not throw without a taper', () => {
    // 🔴 WHAT THIS ARM USED TO SAY, AND WHY IT CHANGED. B4a proved `composeBlocks` could drop the
    // taper entirely (the 5-week 5K), so `phases.find(… 'taper')!` was `undefined` on a real plan
    // and survived only because pass 3 `continue`s on every non-taper week. §49 Amendment 1
    // (Coaching Board 2026-11-28) reserves the taper before §4's peak floor, so **no producible
    // plan lacks a taper phase any more** — the grid below has none to test.
    //
    // The `!` is therefore safe by the amendment rather than by accident. ⚠️ That is a WEAKER
    // guarantee than it sounds: it holds only while the amendment does. So the throw-safety is
    // still asserted, against a SYNTHETIC phase list with no taper, which is the shape a future
    // phase-composition change could reintroduce.
    expect(CASES.every(r => r.phases.some(p => p.name === 'taper')),
      '§49 Am. 1 should leave no producible plan without a taper phase').toBe(true)
    const base = CASES[0]
    const taperless = { ...base, phases: base.phases.filter(p => p.name !== 'taper') }
    expect(() => composeWeekVolumes(taperless)).not.toThrow()
    const { volumes } = composeWeekVolumes(taperless)
    expect(volumes.length).toBe(taperless.total_weeks)
    expect(volumes.every(v => Number.isFinite(v) && v > 0)).toBe(true)
  })

  it('🔴 §2 — the cap reduces every LOADING week, and the DELOAD comparison is non-monotone BY RULING', () => {
    // 🔴 WRITTEN TWICE AND RED BOTH TIMES, which is how two real facts got measured instead of assumed.
    //
    // Attempt 1 — "the cap can only ever reduce a week". RED: a 5-week 5K at start 6 / peak 12 gives
    // healthy [7, 5, 7, 8, 8] against injured [7, 6, 7, 8, 8]. Week 2 is the deload and the INJURED
    // runner gets MORE, because `deloadVolumeFraction` is 0.70 healthy against 0.85 injured — §2
    // Amendment 2, ratified. Willy reversed his own veto on that number (a 70% cut returning to 100%
    // is +43% onto healing tissue; a shallower cut makes the return +17.6%), under Amendment 1's
    // condition that "the curve still RISES within each block — slow is right, STUCK IS NOT".
    //
    // Attempt 2 — "then the injured deload is always HIGHER". ALSO RED: 5km/12w week 8 gives 6
    // against 7. Pass 2's §3 re-anchor takes 85% of a CAPPED prior week, and 85% of a lower number
    // can sit below 70% of a higher one. 📐 Measured across the grid: injured deload higher **1,776**,
    // lower **400**, equal **96**. So neither direction holds, and the honest arm asserts each side
    // against ITS OWN fraction rather than against the other runner.
    //
    // 🔑 Both facts are pinned because both look like defects. A future reader "fixing" the inversion
    // would re-break the 28.9% of injury plans §2 Am. 2 exists for.
    const DEEP = GENERATION_CONFIG.RECOVERY_WEEK_VOLUME_PCT / 100
    const SHALLOW = GENERATION_CONFIG.INJURY_RECOVERY_WEEK_VOLUME_PCT / 100
    expect(SHALLOW, '§2 Am. 2: the injury cut is the SHALLOWER one').toBeGreaterThan(DEEP)
    let loadingLower = 0, deloadHigher = 0, deloadLower = 0
    for (const req of CASES) {
      if (req.injury_cap_pct == null) continue
      const healthy = composeWeekVolumes({ ...req, injury_cap_pct: undefined }).volumes
      const injured = planOf(req).volumes
      for (let i = 1; i < injured.length; i++) {
        const n = i + 1
        const label = `${req.distance_km}km/${req.total_weeks}w w${n}`
        if (req.deload_weeks.has(n) && getPhaseForWeek(n, req.phases) !== 'taper') {
          // §3's re-anchor, each side against its own fraction of its own prior week.
          expect(injured[i], `${label} injured deload vs its own prior`)
            .toBeLessThanOrEqual(Math.round(injured[i - 1] * SHALLOW))
          expect(healthy[i], `${label} healthy deload vs its own prior`)
            .toBeLessThanOrEqual(Math.round(healthy[i - 1] * DEEP))
          if (injured[i] > healthy[i]) deloadHigher++
          if (injured[i] < healthy[i]) deloadLower++
        } else {
          // Every LOADING week is monotone: the cap only ever reduces.
          expect(injured[i], `${label} (loading)`).toBeLessThanOrEqual(healthy[i])
          if (injured[i] < healthy[i]) loadingLower++
        }
      }
    }
    expect(loadingLower, 'the cap never reduced a loading week — it is inert across this grid').toBeGreaterThan(0)
    expect(deloadHigher, 'the §2 Am. 2 inversion is unreached').toBeGreaterThan(0)
    expect(deloadLower, 'the re-anchor undercut is unreached — half the measurement is unproven').toBeGreaterThan(0)
  })

})

describe('ADR-027 B4b — the decisions (L4\'s input, ARCH-ENG-009)', () => {
  it('🔴 every week decision carries that week\'s km, and the set covers the plan exactly once', () => {
    // The L4 contradiction class at its source: a note generated from a decision whose value is not
    // the volume the runner was given would be a true-sounding sentence about a different plan.
    for (const req of CASES) {
      const { volumes } = planOf(req)
      const weeks = weekRules(req)
      const label = `${req.distance_km}km/${req.total_weeks}w`
      expect(weeks.length, label).toBe(req.total_weeks)
      expect(weeks.map(d => d.week), label).toEqual(volumes.map((_, i) => i + 1))
      for (const d of weeks) {
        expect(d.value, `${label} w${d.week}`).toBe(volumes[d.week! - 1])
        expect(d.unit).toBe('km')
        expect(d.day).toBeNull()
      }
    }
  })

  it('every `bound_by` resolves in the catalogue, and the plan-level pair is always present', () => {
    const seen = new Set<string>()
    for (const req of CASES) {
      const { decisions, compressed } = planOf(req)
      for (const d of decisions) {
        expect(RULE_IDS.has(d.bound_by), `${d.what} cites ${d.bound_by}, not in the catalogue`).toBe(true)
        seen.add(d.bound_by)
      }
      const start = decisions.find(d => d.what === 'plan.volume_start_km')
      const comp = decisions.find(d => d.what === 'plan.volume_compressed')
      expect(start, 'the opening volume is a decision').toBeTruthy()
      expect(comp, '§31\'s verdict is a decision').toBeTruthy()
      expect(comp!.value).toBe(compressed)
      // The opening volume is the clamped band, so it never sits outside it.
      const floor = Math.round(req.peak_km * GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK / 100)
      const ceiling = Math.round(req.peak_km * GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK / 100)
      expect(start!.value as number).toBeGreaterThanOrEqual(Math.min(floor, ceiling))
      expect(start!.value as number).toBeLessThanOrEqual(Math.max(floor, ceiling))
    }
    for (const id of ['INV-PLAN-DELIVERED-RAMP', 'INV-PLAN-DELOAD-IS-A-REDUCTION',
      'INV-PLAN-INJURY-CAP-DELIVERED', 'INV-PLAN-BOUNCEBACK-BOUNDED',
      'INV-PLAN-TAPER-DELIVERED-DEPTH',
      'INV-PLAN-COMPRESSION-CLASSIFICATION']) {
      expect(seen.has(id), `${id} is cited by no decision the grid can produce`).toBe(true)
    }
  })

  it('🔴 the opening volume carries a lever unless the CEILING clamped it', () => {
    // 🔴 FOUND BY CODE REVIEW, AND THE FIX WAS THEN UNGATED — a mutation restoring the old
    // expression stayed GREEN, so this arm exists because the first repair had no check.
    // The lever is "tell us you run more". It is real when the runner's declared volume is what the
    // plan opened on, and real when the FLOOR lifted it (measured: peak 130 + declared 20 opens at
    // 46, and declaring more would move that). It is null only when the CEILING cut it back, where
    // a bigger number changes nothing.
    const reach = { floor: 0, declared: 0, ceiling: 0 }
    for (const req of CASES) {
      const d = planOf(req).decisions.find(x => x.what === 'plan.volume_start_km')!
      const floor = req.peak_km * GENERATION_CONFIG.BUILD_VOL_INIT_FLOOR_VS_PEAK / 100
      const ceiling = req.peak_km * GENERATION_CONFIG.BUILD_VOL_INIT_CEILING_VS_PEAK / 100
      const label = `peak${req.peak_km} start${req.start_km}`
      if (req.start_km > ceiling) {
        expect(d.lever, `${label} — ceiling clamped, nothing the runner says moves it`).toBeNull()
        reach.ceiling++
      } else {
        expect(d.lever, `${label} — the runner's own volume is still in play`)
          .toEqual({ field: 'current_weekly_km', direction: 'increase' })
        if (req.start_km < floor) reach.floor++; else reach.declared++
      }
    }
    for (const [k, n] of Object.entries(reach)) {
      expect(n, `the ${k} case is unreached — the arm proves nothing about it`).toBeGreaterThan(0)
    }
  })

  it('🔴 a week the injury cap reduced names the INJURY rule, not the generic ramp', () => {
    // §2 Amendment 3: for an injury history the cap binds even on a bounceback ("cardiovascular
    // readiness != tissue readiness"), so the injury rule is named first. A healthy bounceback keeps
    // §2's unbounded exemption, so when IT is what reduced a week the bounceback rule is named.
    // ⚠️ Pinned, hand-derived cases, not a recomputation of the producer's expression.
    const base = CASES.find(r =>
      r.injury_cap_pct === INJ && r.distance_km === 42.2 && r.total_weeks === 20
      && r.start_km === 20 && r.peak_km === 130 && !r.returning_runner)
    expect(base, 'the pinned injury case is not in the grid').toBeTruthy()
    const injured = new Set(weekRules(base!).map(d => d.bound_by))
    expect(injured.has('INV-PLAN-INJURY-CAP-DELIVERED')).toBe(true)
    // The same runner without the flag: the injury rule must not be cited at all.
    const healthy = new Set(composeWeekVolumes({ ...base!, injury_cap_pct: undefined })
      .decisions.filter(d => d.what === 'week.volume_km').map(d => d.bound_by))
    expect(healthy.has('INV-PLAN-INJURY-CAP-DELIVERED'), 'an uninjured runner cited the injury cap').toBe(false)
  })
})

describe('ADR-027 B4b — the strangler boundary', () => {
  const root = process.cwd()
  const src = (f: string) => readFileSync(join(root, f), 'utf8')
  /** A comment is prose (HOOK-RGBA-COMMENTS-01). Line count preserved. */
  const strip = (s: string) => s
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))

  it('🔴 `buildVolumeSequence` and `getPhaseForWeek` are GONE from the old engine', () => {
    const engine = strip(src('lib/plan/ruleEngine.ts'))
    expect(engine).not.toMatch(/function\s+buildVolumeSequence/)
    expect(engine).not.toMatch(/function\s+getPhaseForWeek/)
    expect(engine, 'the engine must still call the new owner').toMatch(/composeWeekVolumes\(\{/)
    // The population must be non-empty: a `strip` that blanked the file would pass arms 1–2 silently.
    expect(engine).toMatch(/import/)
  })

  it('🔴 `recoveryFreq` is not threaded into the week planner — it was dead and stays dead', () => {
    // It sat in the old signature and was referenced nowhere in 227 lines. The request type is the
    // gate: a field named for it would have to be added deliberately.
    const mod = strip(src('lib/engine/planner/composeWeekVolumes.ts'))
    expect(mod).not.toMatch(/recovery_freq|recoveryFreq/)
  })

  it('🔴 the week planner does not re-derive deload placement — §87 owns it', () => {
    // DELOAD-OWNER-01's fault, one layer up: the curve and the week badge disagreeing because each
    // computed the cadence. `deload_weeks` is an INPUT. `deloadCadence.test.ts` holds the other half.
    const mod = strip(src('lib/engine/planner/composeWeekVolumes.ts'))
    expect(mod).not.toMatch(/computeDeloadWeeks|isDeloadWeek\(/)
    expect(mod, 'it must still read the set it is given').toMatch(/deloadWeeks\.has\(/)
  })

})
