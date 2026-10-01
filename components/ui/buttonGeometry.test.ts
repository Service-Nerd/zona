import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { measureAll, sizeFloors, boxOf, borderWidth, expandStyleSpreads } from '../../scripts/button-geometry'

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
    //
    // 🔴 BUTTON-GEOMETRY-KEY-02 — RE-KEYS ARE RECONCILED AGAINST THE MULTISET,
    // AND THAT IS THE ACTUAL FIX. Both previous keys failed, in opposite
    // directions: `file:line:tag` gave a false PASS (insert one line, every
    // control below it re-keys, all of them hit `if (!was) continue`, gate
    // prints `moved: 0`), and the ordinal gives a false ALARM (`ME-DOORS-01`
    // reordered blocks and this file reported two controls moved while the
    // geometry MULTISET was identical, 82 controls both sides — `Button63` and
    // `Button65` had swapped). **An alarm that is routinely re-baselined stops
    // being read, which this repo records as equivalent to no check.**
    //
    // ⚠️ A CLEVERER KEY DOES NOT FIX IT, MEASURED. Keying on the control's own
    // identity (`aria-label` / `key` / `title` / `className`) reaches **14 of
    // 156** controls: the rest are anonymous in source, and `className` is
    // shared so it collides and the ordinal does the work anyway. The identity
    // is kept because it makes a diff readable, but it is not the defence.
    //
    // The defence is: compare per key where BOTH sides have it (precise, names
    // the control), and reconcile the leftovers as a MULTISET. A reordering
    // leaves the multiset identical by construction, so it is silent. A real
    // regression changes it, so it fails and prints the shape delta.
    const now  = measureAll()
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, unknown>

    // ⚠️ GEOMETRY ONLY. `unreadable` is an ANNOTATION about how well this
    // harness could read the source, not a property of the box, and leaving it
    // in the comparison made the arm fire on three controls whose heights were
    // provably unchanged (44, 44, 47 both sides) the moment the field was
    // added. **A harness that reports its own new metadata as a design
    // regression is the false-alarm failure this file already records twice.**
    // The register arm below owns that field.
    const geom = (b: unknown): string => {
      const { unreadable: _drop, ...rest } = b as Record<string, unknown>
      return JSON.stringify(rest)
    }

    // 🔴 THE TWO WAYS A REORDER SHOWS UP, AND THE FIRST CUT OF THIS ARM ONLY
    // HANDLED ONE OF THEM. Falsifying it caught that: simulating the real
    // `ME-DOORS-01` case turned the arm red when it should have stayed silent.
    //
    //   · a key APPEARS or DISAPPEARS — a control was added, removed, or gained
    //     an identity slug. Collected as leftovers below.
    //   · a key PERSISTS and its VALUE swaps — two ordinals trade places, which
    //     is precisely what `ME-DOORS-01` did (`Button63` and `Button65`). Both
    //     keys exist on both sides, so leftover reconciliation never sees it.
    //     **This is the case the item was filed for and the one I nearly
    //     shipped unfixed.**
    //
    // So mismatches and leftovers are reconciled TOGETHER: every box the
    // baseline claims, against every box the app renders. A permutation
    // balances and is silent; a genuine regression does not and names its shape.
    const mismatchWas: string[] = []
    const mismatchNow: string[] = []
    const named: string[] = []
    for (const [k, b] of Object.entries(now)) {
      if (!(k in base)) { mismatchNow.push(geom(b)); continue }
      if (geom(base[k]) !== geom(b)) {
        mismatchWas.push(geom(base[k]))
        mismatchNow.push(geom(b))
        named.push(`${k}: ${geom(base[k])} -> ${geom(b)}`)
      }
    }
    for (const [k, b] of Object.entries(base)) if (!(k in now)) mismatchWas.push(geom(b))

    // Counts, not sets: two controls collapsing onto one identical box is a real
    // loss of coverage that a Set would hide.
    const tally = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {})
    const tw = tally(mismatchWas), tnw = tally(mismatchNow)
    const unbalanced = Array.from(new Set([...Object.keys(tw), ...Object.keys(tnw)]))
      .filter(shape => (tw[shape] ?? 0) !== (tnw[shape] ?? 0))
      .map(shape => `${tw[shape] ?? 0} -> ${tnw[shape] ?? 0} of ${shape}`)

    // ⚠️ THE TRADE, STATED. Two controls genuinely SWAPPING boxes (A takes B's
    // size and B takes A's) balances and is therefore silent. That is accepted:
    // it is not a shape a regression takes, and the alternative is the false
    // alarm this file records as the reason a gate stops being read. The per-key
    // detail is still printed when the multiset DOES move, so a real failure
    // names the control rather than only its shape.
    expect(unbalanced,
      `geometry moved without a declared re-baseline. ${named.length} control(s) differ per key ` +
      `and the boxes do not reconcile as a permutation, so this is a real move:\n` +
      `${unbalanced.join('\n')}\n\nper-key detail:\n${named.slice(0, 15).join('\n')}`).toEqual([])
  })

  it('🔴 no control has a style this harness cannot read', () => {
    // BUTTON-GEOMETRY-SPREAD-01. The harness reads LITERALS, so the moment a
    // call site hoists its style into a constant the values vanish from the tag
    // text and the box is measured from what is left, silently. Same-file
    // constants are expanded now; these three cannot be.
    //
    // ⚠️ A DEBT REGISTER, NOT A PASS. It stops the unreadable population GROWING
    // and does nothing to shrink it, which is the honest limit of this pattern
    // (`SWEEP-BASELINE-01`, and CLAUDE.md's note that nothing schedules the
    // shrinking).
    //
    // ⚠️ TWO DIFFERENT KINDS, and the second is worse. `MICRO_LABELS` is an
    // IMPORTED constant: knowable with module resolution, just not done. `style`
    // is a PROP — the component forwards whatever its caller passes, so that
    // control's box depends on the call site and **cannot be measured from
    // source at all**, by construction, not by omission.
    const KNOWN_UNREADABLE: Record<string, string[]> = {
      'components/dashboard/SessionPopupInner.tsx#Button16': ['MICRO_LABELS'],
      'components/shared/BackButton.tsx#Button2': ['style'],
      'components/shared/RedeemCodeLink.tsx#Button1': ['style'],
    }
    const now = measureAll()
    const unreadable = Object.entries(now)
      .filter(([, b]) => b.unreadable)
      .map(([k, b]) => `${k}: ${JSON.stringify(b.unreadable)}`)
    const expected = Object.entries(KNOWN_UNREADABLE).map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    expect(unreadable.sort(),
      'a control gained an unresolvable style spread. Hoist the constant into the ' +
      'same file, or add it here with its reason.').toEqual(expected.sort())
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

  it('🔴 a border grows a CONTENT-SIZED box and never a floored one', () => {
    // BUTTON-GEOMETRY-BORDER-01, and this arm exists because the baseline
    // CANNOT prove it. Six classes carry `border: 1px` and every one composes
    // with a size class that floors, so **no control in the app today is
    // content-sized and bordered** and the baseline diff stays silent whether
    // the border is parsed or not. A structural fix needs a structural test:
    // the mechanism is asserted on a constructed tag, so the first real
    // bordered control written without a size class is measured correctly
    // instead of printing `moved: 0`.
    const bordered = `<button style={{ padding: '10px 14px', border: '1px solid var(--line)', fontSize: '14px' }}>`
    const plain    = `<button style={{ padding: '10px 14px', fontSize: '14px' }}>`

    expect(borderWidth(bordered), 'a px border width must be read').toBe(1)
    expect(borderWidth(plain)).toBe(0)
    expect(borderWidth(`<button style={{ border: 'none' }}>`), "'none' is not a width").toBe(0)

    // Content-sized: the border paints on BOTH edges and the outer box grows.
    const content = boxOf(bordered, {}, {}, 'button', {}).height
    expect(content, 'border not added to a content-sized box')
      .toBe(boxOf(plain, {}, {}, 'button', {}).height! + 2)

    // Floored: under `box-sizing: border-box` the border paints INSIDE the
    // declared height, so the outer box cannot move. Adding it here would have
    // invented a regression on every bordered button in the app.
    const floors = { 'btn--regular': 44 }
    const flooredTag = `<button className="btn btn--regular" style={{ border: '1px solid var(--line)' }}>`
    const plainFloored = `<button className="btn btn--regular">`
    expect(boxOf(flooredTag, floors, {}, 'button', {}).height,
      'a floored box must not grow: border-box paints the border inside')
      .toBe(boxOf(plainFloored, floors, {}, 'button', {}).height)
  })

  it('🔴 a same-file style constant is expanded, not silently dropped', () => {
    // BUTTON-GEOMETRY-SPREAD-01. Without expansion the padding below is
    // invisible and the box is measured from what is left.
    const src = `const common = { padding: '12px 16px', fontSize: '15px' }`
    const tag = `<button className="btn" style={{ ...common, width: '100%' }}>`
    const { text, unresolved } = expandStyleSpreads(tag, src)
    expect(unresolved, 'a same-file constant is resolvable').toEqual([])
    expect(boxOf(text, {}, {}, 'button', {}).padY, 'spread padding not seen').toBe(12)
    expect(boxOf(text, {}, {}, 'button', {}).font).toBe(15)

    // An inline value AFTER the spread must still win, as JS object spread does.
    const over = `<button style={{ ...common, padding: '4px' }}>`
    expect(boxOf(expandStyleSpreads(over, src).text, {}, {}, 'button', {}).padY,
      'the inline override must beat the spread').toBe(4)

    // An imported constant is honestly reported as unreadable, not guessed.
    expect(expandStyleSpreads(`<button style={{ ...MICRO_LABELS.eyebrow }}>`, src).unresolved)
      .toEqual(['MICRO_LABELS'])
  })

  it('the size classes are floors the stylesheet actually declares', () => {
    const floors = sizeFloors(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'))
    expect(floors['btn--regular'], '.btn--regular lost its floor').toBe(44)
    expect(floors['btn--compact'], '.btn--compact lost its floor').toBe(44)
    expect(floors['icon-btn--regular']).toBe(44)
  })
})
