import { describe, it, expect } from 'vitest'
import { Z_LAYERS } from './zLayers'

// SHEET-PRESENT-01 — the whole point of the module is one property: a secondary
// sheet is above the bottom nav, by construction. If someone re-lowers the sheet
// layer (the exact defect this replaced), this fails before it ships.
describe('Z_LAYERS stacking order', () => {
  it('puts every secondary sheet above the bottom nav', () => {
    expect(Z_LAYERS.sheet).toBeGreaterThan(Z_LAYERS.nav)
  })

  it('puts the onboarding coach-mark above sheets and the nav', () => {
    expect(Z_LAYERS.guide).toBeGreaterThan(Z_LAYERS.sheet)
    expect(Z_LAYERS.guide).toBeGreaterThan(Z_LAYERS.nav)
  })

  it('keeps the nav above in-flow content', () => {
    expect(Z_LAYERS.nav).toBeGreaterThan(Z_LAYERS.content)
  })

  it('is a strictly increasing ladder (no two layers collide)', () => {
    const order: (keyof typeof Z_LAYERS)[] = ['content', 'screenHeader', 'nav', 'sheet', 'guide']
    for (let i = 1; i < order.length; i++) {
      expect(Z_LAYERS[order[i]]).toBeGreaterThan(Z_LAYERS[order[i - 1]])
    }

    // 🔴 THE LIST ABOVE WAS HAND-WRITTEN, AND A HAND-WRITTEN POPULATION IS THE
    // failure class this repo recorded five times in one day: the check is
    // correct, bounded, falsifiable — and pointed at a set that cannot contain
    // the defect. `screenHeader` was added to `Z_LAYERS` on 2026-09-26 and the
    // ladder would have stayed green while never looking at it.
    //
    // So the list must be the WHOLE enum, and a new layer fails the build until
    // someone says where in the order it belongs.
    expect(new Set(order), 'a new Z_LAYER must be placed in the ladder above')
      .toEqual(new Set(Object.keys(Z_LAYERS) as (keyof typeof Z_LAYERS)[]))
  })
})
