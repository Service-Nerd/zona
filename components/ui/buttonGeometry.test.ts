import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { measureAll, sizeFloors } from '../../scripts/button-geometry'

/**
 * BUTTON-GEOMETRY-01 — a conversion may change a button's COLOUR, never its BOX.
 *
 * 🔴 WHY. Migrating 32 controls onto shared classes changed 20 of their heights
 * (-19px to +4px) and 8 of their radii, and `tsc`, the ownership gate, the render
 * tests and 3,527 suite tests were ALL GREEN. The founder found it by looking at
 * the app. Every check asked "does this use the right owner?"; none asked "does
 * it still render the same box?".
 *
 * ⚠️ FOUR MODELLING BUGS WERE FOUND IN THIS HARNESS BEFORE IT WAS TRUSTED, each
 * of which would have made it lie: it was blind to component usages (no
 * `className` in source), it assumed content-box in a `border-box` app, it
 * summed inline padding with class padding instead of letting inline win, and
 * its class-padding regex broke the moment a comment was inserted above the
 * declaration. **A geometry checker that is wrong about geometry is worse than
 * none**, so each was fixed and named rather than baselined.
 */
const BASELINE = join(process.cwd(), 'components/ui/__fixtures__/buttonGeometry.json')

describe('button geometry', () => {
  it('reads real controls (a check over nothing is not a check)', () => {
    const now = measureAll()
    expect(Object.keys(now).length).toBeGreaterThan(80)
  })

  it('🔴 no control renders below the 44px tap-target floor', () => {
    // `:262`, iOS HIG — and `:860` records it as previously ignored by half its
    // instances, which is what a rule with no mechanism looks like.
    const under = Object.entries(measureAll())
      .filter(([, b]) => b.height !== null && b.height < 44)
      .map(([k, b]) => `${k} = ${b.height}px`)
    expect(under, `below the 44px floor:\n${under.join('\n')}`).toEqual([])
  })

  it('🔴 geometry matches the committed baseline', () => {
    // A MOVE IS NOT AUTOMATICALLY WRONG — it is automatically something to
    // DECLARE. Re-baseline with `npm run button:geometry -- --write` and say in
    // the commit which control moved and why. Never to turn this green.
    const now = measureAll()
    const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
    const moved: string[] = []
    for (const [k, b] of Object.entries(now)) {
      const was = base[k]
      if (!was) continue
      if (JSON.stringify(was) !== JSON.stringify(b)) moved.push(`${k}: ${JSON.stringify(was)} -> ${JSON.stringify(b)}`)
    }
    expect(moved, `geometry moved without a declared re-baseline:\n${moved.join('\n')}`).toEqual([])
  })

  it('🔴 the baseline still MATCHES the app — coverage loss is not a pass', () => {
    // 🔴 THE ARM THAT MAKES THIS FILE HONEST. The check above skips any control
    // the baseline does not hold (`if (!was) continue`), which is right for a
    // genuinely new button and catastrophic for a re-keyed one. The key WAS
    // `file:line:tag`, so inserting a single line re-keyed every control below
    // it, every one of them was skipped, and the gate printed `moved: []` — not
    // because nothing moved, but because it was no longer looking. A harness
    // that silently stops measuring is worse than no harness, because it is
    // quoted as evidence. Found 2026-09-25, in this file, by converting nine
    // more controls and watching coverage that should have dropped stay quiet.
    //
    // ⚠️ THIS IS THE FALSIFIABLE HALF: break the key format in
    // `button-geometry.ts` and this arm goes red immediately, where the arm
    // above stays green.
    const now = measureAll()
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, unknown>
    const orphaned = Object.keys(base).filter(k => !(k in now))
    const pct = orphaned.length / Math.max(1, Object.keys(base).length)
    expect(pct, `${orphaned.length} of ${Object.keys(base).length} baseline controls ` +
      `no longer match any control in the app — the check above is measuring ` +
      `less than it claims:\n${orphaned.slice(0, 15).join('\n')}`).toBeLessThan(0.05)
  })

  it('the size classes are floors the stylesheet actually declares', () => {
    const floors = sizeFloors(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'))
    expect(floors['btn--regular'], '.btn--regular lost its floor').toBe(44)
    expect(floors['btn--compact'], '.btn--compact lost its floor').toBe(44)
    expect(floors['icon-btn--regular']).toBe(44)
  })
})
