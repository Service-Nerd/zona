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
    //
    // 🔴 TAP-TARGET-FLOOR-01 — THIS ARM MEASURED ONLY THE CONVERTED POPULATION
    // AND WAS THEREFORE STRUCTURALLY INCAPABLE OF FINDING A VIOLATION.
    // `measureAll()` filters to controls already on the shared system, and
    // those have a size class that floors at 44 by construction. **The
    // hand-rolled population — the one most likely to violate the floor — was
    // invisible to the only check that governs it.**
    //
    // 📐 MEASURED 2026-10-01 with `{ all: true }`: **262 controls against 156,
    // and 21 under the floor, the smallest 18px.** The arm had been green over
    // every one of them since it was written.
    //
    // ⚠️ NOT ALL 21 ARE DEFECTS, AND THAT IS WHY THIS IS A REGISTER RATHER THAN
    // A BLANKET FAILURE. `.btn--inline-target` exists precisely because a small
    // VISUAL with a 44px HIT AREA is the right answer for a chip in a settings
    // row. The fix per control is "convert and let the floor apply" or "convert
    // and give it an inline target", never a blanket height — and choosing
    // between those is a Design Board question per control
    // (→ `TAP-TARGET-DECISIONS-01`). **Finding them is not a board question,
    // which is this arm's job and now its actual behaviour.**
    const all = measureAll({ all: true })
    const under = Object.entries(all)
      .filter(([, b]) => b.height !== null && b.height! < 44)
      // 🔴 FILE + HEIGHT, NOT THE ORDINAL KEY — AND I LEARNED THIS ONE BUILD
      // EARLIER THE SAME AFTERNOON. The first cut listed
      // `TrainingZonesScreen.tsx#button4 = 43px`; `ZONES-TAB-PIN-01` then moved
      // two tab buttons OUT of that file, the zone row became `#button3`, and
      // this arm went red over a control that had not changed by a pixel.
      // **That is precisely the instability `BUTTON-GEOMETRY-KEY-02` is about,
      // and I wrote a fresh register in the ordinal key hours after fixing the
      // old one.** The register's claim is "these controls, in these files, are
      // under the floor" — never "these ordinals are". Duplicates are kept (two
      // `MeScreen` rows at 41px), so a control vanishing still fails.
      .map(([k, b]) => `${k.split('#')[0]} = ${b.height}px`)
      .sort()

    // Registered: every control below the floor today, with the population it
    // belongs to. A preview page is a HARNESS, not a runner surface, and needs
    // no ruling; everything else is runner-facing and does.
    // 🔴 CORRECTED SAME DAY, 21 -> 19, BY A DESIGN BOARD SITTING THAT WAS ABOUT
    // TO RULE ON A WRONG NUMBER. Three `TrainingZonesScreen` entries (35, 43, 43)
    // were FALSE: its tabs declare `minHeight: TAB_MIN_HEIGHT_PX`, the constant
    // is **44**, and the component carries its own markup test asserting `>= 44`.
    // `num()` reads a px LITERAL, so an identifier fell through to padding and
    // reported 35px on a 44px control. `resolveSizeConstants` fixes it
    // (BUTTON-GEOMETRY-CONST-01) and two of the three vanished.
    //
    // ⚠️ THE COMPONENT HAD WRITTEN THE WARNING DOWN ITSELF — *"minHeight is
    // load-bearing and the gate cannot see it"* — and the register still shipped
    // the wrong number, because **widening a population inherits every blind
    // spot the old population never exercised.**
    //
    // 🥇 AND THE CORRECTED DATA SAYS SOMETHING THE WRONG DATA HID: the
    // HAND-ROLLED zones tabs carry the floor correctly at 44, while the SHARED
    // `SegmentedControl` primitive has `padding: '8px 10px'` and **no
    // `minHeight` at all** — 30px, reached from login, Preferences,
    // ModifyPlanSheet, Chip and DashboardClient. **The component extracted to be
    // reused is the one missing the floor.**
    const REGISTERED_UNDER_FLOOR = [
      // ── preview harnesses, no ruling needed ──
      'app/onboarding-preview/page.tsx = 32px',
      'app/onboarding-preview/page.tsx = 32px',
      'app/wizard-preview/page.tsx = 27px',
      'app/wizard-preview/page.tsx = 29px',
      // ── runner-facing: → TAP-TARGET-DECISIONS-01 ──
      'app/charity-runners/page.tsx = 39px',
      'app/dashboard/DashboardClient.tsx = 30px',
      // ✅ `app/page.tsx = 43px` CAME OFF 2026-10-02 (`TAP-TARGET-DECISIONS-01`, Design Board
      // SHIP WITH AMENDMENT). It was the App Store CTA — the most important tap on the
      // marketing site — and the one unarguable miss in this register, because
      // `ui-patterns.md:906` scopes this floor to a CTA. ⚠️ **It was 43 because it hand-rolled
      // seven properties `.btn` already owns**, so it never inherited `.btn--regular`'s
      // `min-height: 44px`; `/charity-runners` had used `className="btn btn--primary
      // btn--compact"` all along while `app/page.tsx` used ZERO btn classes. Now 47px, from
      // global CSS rather than a number typed into the page.
      // 🔴 THE OTHER 43px STAYS, AND THE PAIR IS THE RULING: `TrainingZonesScreen` is a
      // display GRID ROW (`alignItems: baseline`), not a control and not a CTA, so the floor
      // does not reach it. **Two controls at the same height, two different answers, and the
      // number was never the question** — `ui-patterns.md` already recorded that the content
      // box "only wants 43.4px", so 43 is what the box produces, not a floor missed by 1px.
      // ⚠️ "The floor is really 40" was REJECTED on measurement: nothing in this population
      // sits at 40, so 40 would clear 4 of 18 and invent a number to accommodate the 43s.
      'components/dashboard/MeScreen.tsx = 41px',
      // ⚠️ RE-KEYED BY A MOVE, NOT BY A REGRESSION (`ME-ADJUSTMENTS-EXTRACT-01`, 2026-10-02).
      // The second 41px settings row left `MeScreen` with the Plan adjustments door. **Proof
      // the geometry did not change: the HEIGHT MULTISET is identical both sides** — 18
      // entries, {18,24,27,29,30×3,32×2,36,37×2,38,39,41×2,43×2} — and exactly one string
      // differs, the file name. Same check ME-DOORS-01 used when this register last moved
      // under a relocation (82 both sides there). A register keyed by FILE re-keys whenever
      // code moves, which is `BUTTON-GEOMETRY-KEY-02`'s subject and is not solved here.
      'components/dashboard/PlanAdjustmentsScreen.tsx = 41px',
      'components/dashboard/SessionPopupInner.tsx = 18px',
      'components/dashboard/SessionPopupInner.tsx = 30px',
      'components/dashboard/SessionPopupInner.tsx = 37px',
      'components/dashboard/SessionPopupInner.tsx = 38px',
      'components/dashboard/SupportScreen.tsx = 24px',
      'components/shared/Chip.tsx = 37px',
      'components/shared/ModifyPlanSheet.tsx = 30px',
      'components/shared/PendingAdjustmentBanner.tsx = 36px',
      // ✅ `SegmentedControl` came OFF this list on 2026-10-01
      // (`TAP-TARGET-DECISIONS-01`, Design Board SHIP). It was the highest-reach
      // control under the floor — login, Preferences, ModifyPlanSheet, Chip and
      // DashboardClient all inherit it — at 30px with no `minHeight` at all,
      // while the hand-rolled version of the same pattern in
      // `TrainingZonesScreen` already carried 44. **One primitive, five
      // surfaces, and the register is one shorter because of it.**
      // A full-width zone LIST ROW, 1px under. A different question from a control.
      'components/shared/TrainingZonesScreen.tsx = 43px',
    ]

    // ⚠️ EXACT EQUALITY, BOTH WAYS. A new control under the floor fails, and a
    // control that gets FIXED also fails until it comes off the list — a
    // register that only ratchets one way stops describing reality in the
    // direction you want it to move.
    expect(under,
      `the set of controls below the 44px floor has changed. A NEW one is a defect; ` +
      `a FIXED one comes off REGISTERED_UNDER_FLOOR.\n` +
      `now (${under.length}):\n${under.join('\n')}`).toEqual(REGISTERED_UNDER_FLOOR.sort())
  })

  it('🔴 the floor arm measures the WHOLE population, not just the converted one', () => {
    // The arm above is only worth anything if `{ all: true }` genuinely widens
    // the population. If the filter ever comes back, the floor arm silently
    // returns to measuring 156 controls that floor at 44 by construction, and
    // its register would read as "all clear" while 106 controls go unexamined.
    const filtered = Object.keys(measureAll()).length
    const everything = Object.keys(measureAll({ all: true })).length
    expect(everything, 'all-mode is not widening the population').toBeGreaterThan(filtered)
    expect(everything - filtered,
      'the hand-rolled population has collapsed — suspect the tag scan before believing it')
      .toBeGreaterThan(50)
  })

  // ⚠️ RE-BASELINED 2026-10-02 (`INTERSTITIAL-TITLE-ROLE-01`), WITH THE DELTA PROVEN RATHER
  // THAN ACCEPTED. Deleting the retired welcome screen removed one control from
  // `DashboardClient`, which shifted every later ordinal in that file and reported **15
  // per-key differences** — `BUTTON-GEOMETRY-KEY-02`'s instability, not fifteen moves.
  // **Measured on the multiset: 157 -> 156 controls, exactly ONE box removed
  // (`{height:47, width:"full"}`, the welcome screen's own CTA) and NOTHING added.** A
  // per-key diff on an ordinal-keyed register is a rename report; the multiset is the
  // measurement. Same proof ME-DOORS-01 used (82 both sides) and the one this file used
  // earlier today for the Plan adjustments extraction.
  // ⚠️ RE-BASELINED 2026-10-02 (`DESTRUCTIVE-WIRING-01`), delta PROVEN on the multiset:
  // **156 -> 158, TWO boxes ADDED and NOTHING REMOVED** — `{47, full}` and `{45, 100%}`.
  // 🥇 THE REGISTER GREW BECAUSE TWO CONTROLS BECAME MEASURABLE, NOT BECAUSE ANY WERE ADDED.
  // Both were hand-rolled raw `<button>`s — the `Delete account` row and the delete CONFIRM —
  // and a raw button is invisible to this harness, so the most consequential control in the
  // app was outside its own geometry register. Moving them onto `Button` is what let it see
  // them. **A register rising because its population got honest is the only rise allowed**,
  // the same reason `microLabel`'s went 35 -> 47. Both clear the 44 floor (47 and 45), so the
  // floor arm is unmoved.
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

  // ─────────────────────────────────────────────────────────────────────────
  // BUTTON-SIZE-SCALE-01 (Design Board, 2026-10-02) — **THE SCALE ALREADY EXISTS AND IT IS
  // THE TWO SIZE CLASSES.** Collins asked whether one should exist at all; the measurement
  // answers it.
  //
  // 📐 MEASURED: of 155 controls, **99 override NOTHING** and land on exactly two heights —
  // **44** (`.btn--compact`: 12+12+14 = 38, caught by its own `min-height: 44`) and **47**
  // (`.btn--regular`: 15+15+17, above its floor so the content decides). The bimodality is
  // not sediment and not taste: **it is one floor and two paddings.**
  //
  // 🔴 THE "13 DISTINCT HEIGHTS" THAT FILED THIS ITEM IS NOW **8, ALL >= 44** — and 132 of
  // 155 sit on the two steps. Collins called 13 heights *"sediment, not a design"*;
  // Wroblewski answered *"one of those thirteen was 29px and deliberate, and you cannot tell
  // which from a histogram."* **Both were right, and the floor settled it without either
  // winning**: the sub-floor cases are gone and the remainder is explained.
  //
  // ⚠️ NO NEW REGISTER. All **23** off-step controls carry an inline override, and
  // `buttonInlineOverride.test.ts` already registers those by file and only lets them fall.
  // A second register over the same objects is the two-registers-one-population failure this
  // repo keeps paying for — this arm asserts the RELATIONSHIP and defers the debt to its
  // existing owner.
  //
  // ⚠️ HONEST LIMIT: for the two controls at 52px the recorded override is `radius`, which
  // cannot itself change a height — so the harness is under-recording their overrides rather
  // than those two being unexplained. Stated, not glossed.
  it('🔴 every off-step control is explained by an inline override', () => {
    const steps = new Set([44, 47])
    const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, Record<string, unknown>>
    const unexplained: string[] = []
    let offStep = 0
    for (const [key, b] of Object.entries(base)) {
      const h = b.height
      if (typeof h !== 'number' || steps.has(h)) continue
      offStep++
      if (['padY', 'font', 'radius'].every(f => b[f] == null)) unexplained.push(`${key} = ${h}px`)
    }
    // ⚠️ An empty off-step population would pass the assertion below for the wrong reason.
    expect(offStep, 'no off-step controls found — the scale arm is measuring nothing')
      .toBeGreaterThan(0)
    expect(unexplained, 'a control sits off the 44/47 scale with NO inline override, so the ' +
      'size classes did not produce it and `buttonInlineOverride.test.ts` does not own it. ' +
      'Either it is a third step (board) or an unrecorded override (harness):\n' +
      unexplained.join('\n')).toEqual([])
  })

  it('the size classes are floors the stylesheet actually declares', () => {
    const floors = sizeFloors(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'))
    expect(floors['btn--regular'], '.btn--regular lost its floor').toBe(44)
    expect(floors['btn--compact'], '.btn--compact lost its floor').toBe(44)
    expect(floors['icon-btn--regular']).toBe(44)
  })
})
