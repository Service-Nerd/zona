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

  it('the size classes are floors the stylesheet actually declares', () => {
    const floors = sizeFloors(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'))
    expect(floors['btn--regular'], '.btn--regular lost its floor').toBe(44)
    expect(floors['btn--compact'], '.btn--compact lost its floor').toBe(44)
    expect(floors['icon-btn--regular']).toBe(44)
  })
})
