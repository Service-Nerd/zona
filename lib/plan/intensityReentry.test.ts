import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { computeIntensityReentry } from './intensityReentry'
import { GENERATION_CONFIG } from './generationConfig'
import { planRationaleNotes } from './planRationale'
import type { Plan } from '@/types/plan'

const NO_ARMS = {
  intensityLiftedForReturn: false,
  returningRunner: false,
  isFreshReturn: false,
  oneWeekOnRamp: false,
  tissueConditioned: false,
} as const

describe('computeIntensityReentry — the window', () => {
  it('is closed when no arm fires', () => {
    const w = computeIntensityReentry(NO_ARMS)
    expect(w.active).toBe(false)
    expect(w.weeks).toBe(0)
    expect(w.withheldIn(1)).toBe(false)
    expect(w.withheldAtQualityIndex(0)).toBe(false)
  })

  it.each([
    ['intensityLiftedForReturn'],
    ['returningRunner'],
    ['isFreshReturn'],
    ['oneWeekOnRamp'],
  ] as const)('opens on the %s arm alone', arm => {
    const w = computeIntensityReentry({ ...NO_ARMS, [arm]: true })
    expect(w.active).toBe(true)
    expect(w.weeks).toBeGreaterThan(0)
  })

  it('§97 — the one-week on-ramp takes the LONGER of the two ready windows', () => {
    // A gated runner is tissueConditioned BY CONSTRUCTION, so testing
    // tissueConditioned first would silently apply the shorter
    // REENTRY_WEEKS_TISSUE_READY and discard Willy's §97 condition. This is the
    // ordering bug the inline version was one edit away from at all times.
    const w = computeIntensityReentry({
      ...NO_ARMS, oneWeekOnRamp: true, tissueConditioned: true,
    })
    expect(w.weeks).toBe(Math.max(
      GENERATION_CONFIG.REENTRY_WEEKS_ONE_WEEK_ONRAMP,
      GENERATION_CONFIG.REENTRY_WEEKS_TISSUE_READY,
    ))
  })

  it('§89 Lever A — a conditioned returner gets the SHORTENED window, not zero', () => {
    const w = computeIntensityReentry({
      ...NO_ARMS, returningRunner: true, tissueConditioned: true,
    })
    expect(w.weeks).toBe(GENERATION_CONFIG.REENTRY_WEEKS_TISSUE_READY)
    expect(w.weeks).toBeGreaterThan(0)
  })

  it('an unconditioned returner gets the full §79 window', () => {
    const w = computeIntensityReentry({ ...NO_ARMS, returningRunner: true })
    expect(w.weeks).toBe(GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS)
  })

  it('withheldIn is inclusive of the final window week and excludes the next', () => {
    const w = computeIntensityReentry({ ...NO_ARMS, returningRunner: true })
    expect(w.withheldIn(w.weeks)).toBe(true)
    expect(w.withheldIn(w.weeks + 1)).toBe(false)
  })

  it('withheldAtQualityIndex is 0-BASED where withheldIn is 1-based', () => {
    // The two readings are deliberately different units — a plan WEEK vs an
    // index into the quality-carrying weeks. Getting this off by one is the
    // whole QUALITY-ONSET-ORDER-01 defect, so it is pinned.
    const w = computeIntensityReentry({ ...NO_ARMS, returningRunner: true })
    expect(w.withheldAtQualityIndex(0)).toBe(true)
    expect(w.withheldAtQualityIndex(w.weeks - 1)).toBe(true)
    expect(w.withheldAtQualityIndex(w.weeks)).toBe(false)
    expect(w.withheldAtQualityIndex(-1)).toBe(false)
  })
})

describe('INTENSITY-REENTRY-OWNER-01 — single ownership is mechanical', () => {
  const LIB = join(process.cwd(), 'lib')
  const OWNER = 'intensityReentry.ts'

  const tsFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const full = join(dir, name)
      if (statSync(full).isDirectory()) return tsFiles(full)
      return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [full] : []
    })

  it('no file outside the owner hand-writes the withhold comparison', () => {
    // The exact expression that existed TWICE inside generateRulePlan, twenty
    // lines apart, with different loop variables:
    //     intensityReentryActive && wn    <= intensityReentryWeeks
    //     intensityReentryActive && weekN <= intensityReentryWeeks
    // `invariants.ts` is exempt for the same reason deloadCadence exempts it —
    // a checker that imports the producer's predicate cannot catch the producer
    // being wrong. One owner among PRODUCERS, not one expression in the repo.
    const CHECKER = 'invariants.ts'
    const offenders: string[] = []
    for (const file of tsFiles(LIB)) {
      if (file.endsWith(OWNER) || file.endsWith(CHECKER)) continue
      const src = readFileSync(file, 'utf8')
      if (/<=\s*intensityReentryWeeks/.test(src)) {
        offenders.push(file.replace(process.cwd() + '/', ''))
      }
    }
    expect(
      offenders,
      'These files compare against the re-entry window themselves. Use ' +
      'reentry.withheldIn() / withheldAtQualityIndex() from ' +
      'lib/plan/intensityReentry.ts — two hand-written copies is what let the ' +
      'build-slot reservation and the per-week selector gate disagree.',
    ).toEqual([])
  })

  it('the owner is actually used — this is not a dead module', () => {
    const engine = readFileSync(join(LIB, 'plan', 'ruleEngine.ts'), 'utf8')
    expect(engine).toMatch(/computeIntensityReentry\(/)
    // Either reading counts as use — the onset-anchored flip is board-blocked
    // (REENTRY-DEPTH-01), so the calendar reading is what ships today.
    expect(engine).toMatch(/reentry\.withheld(In|AtQualityIndex)\(/)
  })
})

describe('§79 Amendment 2 — omission is legitimate, silence is not', () => {
  // The board ruled that a re-entry plan may contain NO VO2max/hill work at all
  // (§5, Seiler: "either commit to it properly in the build, or do not do it"),
  // but that the runner must be TOLD. These pin the declaration, not the dose.
  it('the omission note is rendered by the ONE note renderer, not a second path', () => {
    const notes = planRationaleNotes({
      intensity_reentry_active: true,
      intensity_reentry_omission_note: 'No interval or hill sessions this block.',
    } as unknown as Plan['meta'])
    expect(notes.some(n => n.text.includes('No interval or hill sessions'))).toBe(true)
  })

  it('a plan with no note produces no phantom line', () => {
    const notes = planRationaleNotes({ intensity_reentry_active: true } as unknown as Plan['meta'])
    expect(notes.some(n => n.label === 'Coming back')).toBe(false)
  })
})
