// A section is separated from a section. A BEAT must be separated from a beat.
//
// SITE-BEAT-01, Design Board 2026-09-22. Found by the founder on a phone, on
// the third look at the same page: "the tile above A plan that fits you, the
// spacing is very tight. Same with the your zones on Coach image and How it
// goes. Same to the what's not in the app tile and HONESTLY. there's no space."
//
// Measured live on www.zonna.run, all three: 0px. 0px. 0px.
//
// 🔴 DESIGN BOARD SITTING TWO CREATED THIS DEFECT. It merged four sections into
// two, and it was right to. But the `<Section>` boundary was the thing carrying
// the vertical space, so deleting the boundary deleted the space. The merged
// sections are the ONLY ones affected — /pricing, /about, /plans and
// /charity-runners all measured clean. When you merge two containers, the gap
// between them was a property of the CONTAINER, not of the content.
//
// 🔴 WHY `spacingScale.test.ts` COULD NOT HAVE CAUGHT IT, stated because the
// founder's question was "I thought you fixed those." SITE-WAVE-4 measured 448
// gaps THAT EXISTED. A gap of zero is not a gap — it is an absent decision, and
// a scale test can only tokenise a value somebody already typed. A spacing
// audit finds wrong values and is structurally blind to missing ones.
//
// ⚠️ WHAT THIS TEST DOES NOT PROVE. It anchors on `<Eyebrow>`, which is how two
// of the three beats open. The third (the product-still trio) opens with a bare
// grid, and there is no general way to recognise "a block that starts a beat"
// from source — so that one is held by the count assertion alone. A NEW
// block-opened beat with no gap would pass this file. The browser sweep in the
// investigation note is the wider instrument; this is the regression gate.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8')

// Strip comments BEFORE scanning. This file's own subject matter is quoted in
// the page's comments, and a naive whole-file grep reads the paragraph
// describing the rule as an instance of it. Seventh time this repo has met that
// shape, which is why it is the default here rather than a fix applied later.
const stripComments = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('SITE-BEAT-01 — the beat token', () => {
  it('is DERIVED from --sect-y, so a beat can never out-space a section', () => {
    const css = read('app/globals.css')
    const decl = css.match(/--beat-y:\s*([^;]+);/)
    expect(decl, '--beat-y is missing from globals.css').toBeTruthy()

    const value = decl![1].trim()
    // The whole design decision is the derivation. An independent clamp would
    // let a beat drift up to or past a section boundary at some viewport, and
    // that makes sitting two's merge cosmetic: the reader still meets two equal
    // announcements. `calc(var(--sect-y) * f)` with f < 1 makes it impossible.
    const m = value.match(/^calc\(\s*var\(--sect-y\)\s*\*\s*([\d.]+)\s*\)$/)
    expect(m, `--beat-y must be calc(var(--sect-y) * f), got: ${value}`).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThan(0.4)   // below this it reads as no gap
    expect(Number(m![1])).toBeLessThan(1)        // at or above this the merge is undone
  })

  it('applies as paddingTop in Eyebrow, because a first child margin collapses', () => {
    const page = stripComments(read('app/page.tsx'))
    // Bound the region to the Eyebrow declaration, never the whole file: the
    // page contains other paddingTop and other --beat-y uses, and a file-wide
    // grep would pass on either of them.
    const i = page.indexOf('function Eyebrow(')
    expect(i, 'Eyebrow component not found').toBeGreaterThan(-1)
    const body = page.slice(i, i + 600)
    expect(body).toMatch(/paddingTop:\s*beat\s*\?\s*'var\(--beat-y\)'/)
    expect(body).not.toMatch(/marginTop:\s*beat/)
  })
})

describe('SITE-BEAT-01 — the three beats are spaced', () => {
  // The homepage is the only surface with merged sections, which is why it is
  // the only surface here. If another page ever merges two sections, add it.
  const page = () => stripComments(read('app/page.tsx'))

  it('opens every second-and-later Eyebrow in a Section with `beat`', () => {
    // Split on the Section boundary so each chunk is ONE section. The first
    // Eyebrow in a section needs no beat gap — the section padding is above it.
    // Every later one does, and that is the exact shape of the defect.
    const chunks = page().split(/<Section\b/)
    const offenders: string[] = []
    for (const chunk of chunks) {
      const eyebrows = Array.from(chunk.matchAll(/<Eyebrow(\s+beat)?>([^<]*)</g))
      eyebrows.slice(1).forEach(m => {
        if (!m[1]) offenders.push(m[2].trim())
      })
    }
    expect(offenders, 'second-or-later Eyebrow in a Section with no beat gap').toEqual([])
  })

  it('holds all three beats — a deleted gap fails here even if nothing else moved', () => {
    const uses = Array.from(page().matchAll(/var\(--beat-y\)/g)).length
    const eyebrowBeats = Array.from(page().matchAll(/<Eyebrow\s+beat>/g)).length
    // Three beats on the page: two open with an Eyebrow (passed as a prop, so
    // they do not name the token) and one opens with the trio grid.
    expect(eyebrowBeats).toBe(2)
    // Two literal uses of the token: Eyebrow's conditional declaration, and the
    // trio grid's marginTop. Deleting either one fails here.
    expect(uses).toBe(2)
  })

  it('spaces the product-still trio, which opens with a grid and not an Eyebrow', () => {
    const p = page()
    // Bound to the trio grid by its own distinctive track definition, not by a
    // file-wide search for the token. `toContain` on a component name is how a
    // check in this repo passed for `<ZoneRingsX`; an anchored slice is the fix.
    const i = p.indexOf("minmax(min(100%, 280px), 1fr)")
    expect(i, 'the trio grid template moved — re-anchor this test').toBeGreaterThan(-1)
    // The trio is the SECOND such grid on the page (the hero uses the same
    // guard), so take the one followed by the Pillar trio.
    const trio = p.indexOf('A plan that fits you')
    const gridBefore = p.lastIndexOf("minmax(min(100%, 280px), 1fr)", trio)
    expect(gridBefore).toBeGreaterThan(-1)
    expect(p.slice(gridBefore, trio)).toContain("marginTop: 'var(--beat-y)'")
  })
})
