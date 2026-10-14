import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyVdotDiscount } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'

/**
 * PARITY-NO-BENCHMARK-01 — the parity grid's benchmark cases must be CLOCK-STABLE.
 *
 * 🔴 WHY THIS FILE EXISTS. `verify-parity.ts` had never set a benchmark — the string
 * appeared ZERO times in it, across 6,066 cases — and `benchmark` is the ONLY input that
 * reaches the engine's wall-clock read, `applyVdotDiscount(raw, b, new Date())`. VDOT
 * prices every pace, so the harness used to prove "my refactor changed nothing" was blind
 * to the entire pace path.
 *
 * ⚠️ BUT ADDING BENCHMARKS CARELESSLY WOULD BE WORSE THAN NOT ADDING THEM. A benchmark
 * sitting on the staleness ramp has a discount that moves with the real date, so parity
 * would stop being reproducible — it would fail tomorrow on code that had not changed, and
 * a harness that cries wolf gets deleted. The grid therefore carries only variants that are
 * stable BY CONSTRUCTION, and this file checks that claim rather than trusting the comment
 * next to them.
 *
 * ⚠️ The clock read itself is DELIBERATE and is not being fixed here. `ruleEngine.ts`
 * argues it: the staleness ramp measures how long ago the runner actually ran, which is a
 * fact about the wall clock rather than the plan's anchoring, and changing it "would
 * reprice every stale-benchmark plan".
 */

const BASE = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT
const FRESH = GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS
const PER_4WK = GENERATION_CONFIG.VDOT_STALENESS_PER_4WK_PCT
const MAX = GENERATION_CONFIG.VDOT_STALENESS_MAX_DISCOUNT_PCT

/** Two "todays" a decade apart. Anything stable must agree across them. */
const EARLY = new Date('2026-10-14T12:00:00Z')
const LATE = new Date('2036-10-14T12:00:00Z')

const RAW = 50
const bm = (benchmark_date?: string) =>
  ({ type: 'race' as const, distance_km: 10, time: '45:00', ...(benchmark_date ? { benchmark_date } : {}) })

describe('PARITY-NO-BENCHMARK-01 — the grid\'s benchmark variants cannot drift', () => {
  it('the config still has the shape this reasoning depends on', () => {
    // If any of these move, the >=16-week claim below is no longer the cap and the
    // grid's `bm-capped` case silently rejoins the ramp.
    expect(BASE).toBe(3)
    expect(FRESH).toBe(4)
    expect(PER_4WK).toBe(1)
    expect(MAX).toBe(7)
  })

  it('variant 1 — NO benchmark_date never reads the clock', () => {
    const early = applyVdotDiscount(RAW, bm(), EARLY)
    const late = applyVdotDiscount(RAW, bm(), LATE)
    expect(early.discountPct).toBe(BASE)
    expect(late.discountPct).toBe(BASE)
    expect(early.vdot).toBe(late.vdot)
  })

  it('variant 2 — the grid\'s actual date is at the cap, and stays there a decade later', () => {
    // The date is read FROM THE GRID, not retyped. If someone edits the grid to a
    // fresher date, this arm fails rather than parity becoming flaky months later.
    const src = readFileSync('scripts/verify-parity.ts', 'utf8')
    const m = /tag: 'bm-capped',[\s\S]{0,200}?benchmark_date: '(\d{4}-\d{2}-\d{2})'/.exec(src)
    expect(m, 'the bm-capped case is gone from the parity grid').not.toBeNull()
    const gridDate = m![1]

    const early = applyVdotDiscount(RAW, bm(gridDate), EARLY)
    const late = applyVdotDiscount(RAW, bm(gridDate), LATE)
    expect(early.discountPct, `${gridDate} is not at the ${MAX}% cap as of 2026 — it is on the ramp`).toBe(MAX)
    expect(late.discountPct).toBe(MAX)
    expect(early.vdot).toBe(late.vdot)
  })

  it('🔴 a date ON THE RAMP genuinely does drift — this is what we are avoiding', () => {
    // The arm that proves the other two mean something. Without it, "stable" could be
    // true of every input and the checks above would be vacuous.
    const onRamp = '2026-09-01'                       // ~6 weeks before EARLY
    const early = applyVdotDiscount(RAW, bm(onRamp), EARLY)
    const late = applyVdotDiscount(RAW, bm(onRamp), LATE)
    expect(early.discountPct).toBeLessThan(MAX)       // still climbing
    expect(late.discountPct).toBe(MAX)                // capped by then
    expect(early.discountPct).not.toBe(late.discountPct)
  })

  it('the cap is reached at 16 weeks, which is the number the grid comment claims', () => {
    // Derived, not asserted from memory: BASE + n*PER_4WK >= MAX at n = 4 blocks,
    // and blocks = floor((weeks - FRESH)/4) + 1, so weeks >= FRESH + 12 = 16.
    const weeksToCap = FRESH + 4 * (Math.ceil((MAX - BASE) / PER_4WK) - 1)
    expect(weeksToCap).toBe(16)
    const justUnder = new Date(EARLY.getTime() - (weeksToCap - 1) * 7 * 864e5)
    const atCap = new Date(EARLY.getTime() - weeksToCap * 7 * 864e5)
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    expect(applyVdotDiscount(RAW, bm(iso(justUnder)), EARLY).discountPct).toBeLessThan(MAX)
    expect(applyVdotDiscount(RAW, bm(iso(atCap)), EARLY).discountPct).toBe(MAX)
  })
})
