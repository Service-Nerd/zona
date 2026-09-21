import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { planArcSeries, trainingKm } from '@/lib/plan/weekVolume'
import { phaseDisplayLabel } from '@/lib/coaching/weekVoice'
import type { Plan } from '@/types/plan'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const SRC = 'components/shared/PlanArc.tsx'

/** A week with one session of the given distance, plus an optional race. */
function week(n: number, km: number, opts: { phase?: string; raceKm?: number } = {}) {
  const sessions: Record<string, unknown> = {
    mon: { type: 'easy', distance_km: km - (opts.raceKm ?? 0) },
  }
  if (opts.raceKm) sessions.sun = { type: 'race', distance_km: opts.raceKm }
  return { n, weekly_km: km, phase: opts.phase, sessions } as unknown as Plan['weeks'][number]
}

describe('PLAN-ARC-V2 — planArcSeries is the single owner of the arc’s data', () => {
  it('reports TRAINING volume, so race week is not the tallest bar of the taper', () => {
    // The defect `weekVolume.ts` was written for: `weekly_km` includes the
    // race, so a height-encoded race week would tower over the taper it sits
    // at the end of.
    const weeks = [week(1, 40), week(2, 32), week(3, 26), week(4, 36, { raceKm: 21.1 })]
    const { km } = planArcSeries(weeks)
    expect(km).toEqual([40, 32, 26, trainingKm(weeks[3])])
    expect(km[3], 'race week must draw SHORTER than the taper that precedes it').toBeLessThan(km[2])
    expect(Math.max(...km), 'the peak must not be race week').toBe(40)
  })

  it('returns raw phase keys, leaving the display mapping to its own owner', () => {
    const { phase } = planArcSeries([week(1, 10, { phase: 'maintenance_base' }), week(2, 10)])
    expect(phase).toEqual(['maintenance_base', null])
  })

  it('returns one entry per week, so a length mismatch cannot be padded away', () => {
    const weeks = [week(1, 10), week(2, 20), week(3, 30)]
    const s = planArcSeries(weeks)
    expect(s.km).toHaveLength(weeks.length)
    expect(s.phase).toHaveLength(weeks.length)
  })
})

/**
 * ⚠️ THE BOARD'S CONDITIONS, NOT STYLE PREFERENCES (SLT 2026-09-21).
 *
 * Wood's ruling was explicit and she holds the kill mandate: the strip shows
 * SHAPE, never COMPLETION. "The moment a number aggregates, this becomes a
 * progress bar, and a progress bar is the illusion-of-progress class in its
 * purest form." She allowed the component on the strength of ANTICIPATION —
 * a deload notch visible three weeks out is an advance commitment device, so
 * taking the easy week costs no willpower on the day — and that mechanism
 * dies the moment the object becomes a score.
 *
 * A written condition in a decision record is not a condition in this repo.
 */
describe('PLAN-ARC-V2 — shape, never completion (Wood, binding)', () => {
  const src = read(SRC)
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('renders no cumulative total', () => {
    // A `reduce`, a `sum`, or a total rendered anywhere in the strip.
    expect(code, 'no summing — the strip shows each week, never their total')
      .not.toMatch(/\.reduce\s*\(/)
    expect(code).not.toMatch(/\btotalKm\b|\bsumKm\b|\bcumulative\b/i)
  })

  it('renders no percentage-complete', () => {
    expect(code, 'no "N% through your plan"').not.toMatch(/%\s*(through|done|complete)/i)
    expect(code).not.toMatch(/\bpct(Complete|Done)\b|\bprogressPct\b/i)
  })

  it('gives the peak week no emphasis of its own', () => {
    // `peak` may be COMPUTED (it is the scale denominator). It may not be a
    // rendering branch: no `isPeak`, no "peak week" styling fork.
    expect(code, 'the peak is the scale, not an achievement').not.toMatch(/\bisPeak\b/)
    expect(code).not.toMatch(/weekN\s*===\s*peak|km\s*===\s*peak/)
  })
})

describe('PLAN-ARC-V2 — the component draws a shape', () => {
  const src = read(SRC)

  it('no bar is hardcoded to full height', () => {
    // The defect itself. `height: '100%'` on the bar is what made an "arc"
    // draw a straight line for months while `align-items: flex-end` sat
    // above it doing nothing.
    // ⚠️ Scope the check to THE BAR. My first cut grepped the whole file for
    // `height: '100%'` near a `borderRadius` and failed on the current-week
    // tick, which is legitimately full-height inside its own 2px row. A
    // whole-file regex for a property that appears on several elements tests
    // the file, not the thing.
    const i = src.indexOf("borderRadius: '2px 2px 0 0'")
    expect(i, 'the bar should be the element with top-only rounding').toBeGreaterThan(-1)
    const bar = src.slice(i - 400, i + 200)
    expect(bar, 'the bar must not be hardcoded to full height').not.toMatch(/height:\s*'100%'/)
    expect(bar, 'bar height must be derived from weekKm').toMatch(/Math\.max\(MIN_BAR/)
  })

  it('keeps flex-end, which now means something', () => {
    expect(src).toMatch(/alignItems:\s*'flex-end'/)
  })

  it('uses tokens only — no hardcoded colour', () => {
    const colours = src.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? []
    expect(colours, `hardcoded colour in ${SRC}: ${colours.join(', ')}`).toEqual([])
  })

  it('adds no motion, so there is nothing for reduced-motion to disable', () => {
    expect(src).not.toMatch(/transition|animation|@keyframes/)
  })

  it('carries no horizontal padding — the SCREEN owns the margin', () => {
    // ui-patterns.md §12, 2026-09-13: rendered flush it runs edge-to-edge and
    // reads as "the progress runs off the page".
    expect(src).not.toMatch(/padding(Left|Right|Inline)/)
    expect(src).not.toMatch(/padding:\s*'[^']*\s+\d/)
  })
})


describe('PLAN-ARC-V2 — the phase rail replaced the chain, it did not join it', () => {
  const src = read(SRC)

  it('the label row states the week count ONCE', () => {
    // It was a two-up row: "{n} weeks · base → build → peak → taper" left,
    // "Wk 6 of 16" pinned right. Dropping the chain left "16 weeks" facing
    // "Wk 6 of 16" — the same number twice. Only removing the chain made
    // that visible.
    const occurrences = (src.match(/\{totalWeeks\}/g) ?? []).length
    expect(occurrences, 'render totalWeeks once, in "Wk N of M"').toBe(1)
  })

  it('carries no joined phase chain', () => {
    // Fried's condition: the rail is a REPLACEMENT. Shipping both is the
    // outcome he said would be wrong.
    // ⚠️ Strip comments first. The doc block EXPLAINS the removed
    // `phaseLabel` prop, and a whole-file grep for a word the comment has to
    // use fails on the explanation rather than on the code. Fourth time this
    // exact slip has happened in this repo; do it centrally.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code, 'the chain belongs to the rail now').not.toMatch(/phaseLabel/)
    expect(code).not.toContain(' → ')
  })

  it('hides the rail entirely when no week carries a phase', () => {
    // An empty rail with blank labels is worse than no rail.
    expect(src).toMatch(/segments\.some\(s => s\.label\)/)
  })

  it('merges consecutive weeks into one segment sized by week count', () => {
    // Segments must flex by their week count, or the rail stops lining up
    // with the ridge above it and the widths stop being information.
    expect(src).toMatch(/flex:\s*seg\.weeks/)
    expect(src).toMatch(/last\.label === label/)
  })
})

describe('PLAN-ARC-V2 — phaseDisplayLabel is the single owner of the label', () => {
  it('maps ADR-013 maintenance keys rather than leaking them to CSS uppercase', () => {
    // The rail renders `text-transform: uppercase`, so a raw key would read
    // "MAINTENANCE_RESTORATION". This mapping used to live inside the joined
    // chain's IIFE in DashboardClient; the chain is gone, so the owner had
    // to outlive it.
    expect(phaseDisplayLabel('maintenance_restoration')).toBe('Restoration')
    expect(phaseDisplayLabel('maintenance_base')).toBe('Base')
    expect(phaseDisplayLabel('foundation')).toBe('Foundation Block')
  })

  it('passes an unknown key through rather than dropping the week', () => {
    expect(phaseDisplayLabel('some_new_phase')).toBe('some_new_phase')
  })

  it('returns null for no phase, never an empty string', () => {
    // `??` does not catch '' — a documented defect class here. An empty
    // string would make `segments.some(s => s.label)` false and silently
    // hide a rail that should render.
    expect(phaseDisplayLabel(null)).toBeNull()
    expect(phaseDisplayLabel(undefined)).toBeNull()
  })
})
