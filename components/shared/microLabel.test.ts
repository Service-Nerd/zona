import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { MICRO_LABELS, DOCUMENTED_EYEBROW } from './microLabels'

// MICRO-LABEL-DRIFT-01 (Design Board, 2026-09-29) — three roles, and a register that can
// only fall.
//
// 🔴 MEASURED: 171 micro-labels, 37 files, 41 distinct combinations, against ONE documented
// value. Six label TEXTS rendered at different values — `optional` FOUR ways — which is
// what killed every role defence: same word, same job, four hands.
//
// 🔴 AND THE APP HAD NO TYPE CHECK AT ALL. `typeScale.test.ts` lives in `lib/marketing/`
// and governs the marketing site only. Same split this repo recorded for the em-dash
// guard, where doctrine, doc and check disagreed three ways for months. THIS is the
// app-side half.
//
// ⚠️ IT IS A DEBT REGISTER, NOT A SWEEP (`SWEEP-BASELINE-01` pattern). It makes the debt
// visible and stops it growing. It does not make it shrink, and nothing here schedules
// that — the ruling shipped "the vocabulary, not the migration" on Wroblewski's condition
// that a 37-file sweep is not reviewable.

/**
 * 🔴 TWO POPULATION DEFECTS FOUND IN THIS GATE BY *RENDERING* IT, AFTER IT SHIPPED.
 * Both made the register SHORT, which is the direction that reads as success:
 *
 *   1. `git ls-files "app/**\/*.tsx"` returns **129** files; the truth is **134**.
 *      git's `**\/` requires at least one directory level, so every file sitting
 *      DIRECTLY under `app/` or `components/` was invisible — including `app/page.tsx`,
 *      the marketing homepage, and `GeneratingCeremony.tsx`.
 *      ⚠️ **Four other shipped gates use the same short glob.** Filed: GATE-GLOB-SHORT-01.
 *
 *   2. The scanner matched `fontSize: '10px'` with EXACTLY ONE SPACE. `CoachByline.tsx`
 *      writes `fontSize:      '10px',` on an aligned block, so it and **13 labels like
 *      it** were invisible. Found because `/post-run-preview` rendered one at
 *      10px/600/0.6px while the static scan said the file was clean.
 *
 * ⚠️ FOURTH AND FIFTH POPULATION DEFECT IN TWO WAVES. Chips, opt-outs, a short glob and a
 * brittle regex — **every one made the set smaller and none made a value wrong.** That is
 * the failure this repo records more than any other, and I keep writing fresh instances
 * of it inside the checks written to catch it.
 */

/** ⚠️ DERIVED FROM THE CODE, never a hand-written list. `sectionSurfaces.test.ts` once
 *  opened `const HOME = 'app/page.tsx'` and a rule against band alternation could not see
 *  any other page. A population that is typed out is a population that goes short. */
const tracked = (): string[] =>
  execSync('git ls-files', { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(f => /^(app|components)\/.*\.tsx$/.test(f))
    .filter(f => !f.includes('.test.'))

/** A micro-label = ≤11px carrying tracking. Tracking is what makes it a label, not body. */
function microLabels(src: string): { size: string; weight: string; ls: string }[] {
  const out: { size: string; weight: string; ls: string }[] = []
  const re = /fontSize:\s*'(9|10|11|12)px'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const start = src.lastIndexOf('{{', m.index)
    if (start === -1 || m.index - start > 600) continue
    const end = src.indexOf('}}', m.index)
    if (end === -1) continue
    const blk = src.slice(start, end + 2)
    if (!blk.includes('letterSpacing')) continue
    // 🔴 A CHIP IS NOT A MICRO-LABEL, and excluding it is a correction rather than a
    // convenience. `ui-patterns.md` § Session Type Chip documents its own pattern —
    // *"10px 700, coloured bg at 15% opacity"* — and all three micro-label roles are
    // TYPE ACCENT WITH NO FILL ("type accent, not flood", standing).
    //
    // ⚠️ THIS WAS FOUND BY NEARLY BREAKING ONE. Wave 1's first classification rule was
    // "convert by size", and two `zoneVerdictColour` chips were one step from having
    // their documented fill stripped. **Second time in one day my population was wrong**
    // — the StatusBadge gate counted comment text, this one counted chips.
    if (blk.includes('background') || blk.includes('border')) continue
    // 🔴 A LABEL THAT EXPLICITLY OPTS OUT IS NOT DEBT. `letterSpacing: 0` and
    // `textTransform: 'none'` are deliberate: a lowercase field hint sitting BESIDE an
    // input is not a caption sitting ABOVE a section. Converting one to `eyebrow` would
    // force it uppercase and tracked, contradicting the two properties it sets.
    //
    // ⚠️ THIS WAS THE THIRD WRONG POPULATION IN TWO WAVES, and the scanner's own
    // definition caused it: "contains the substring letterSpacing" matches a label that
    // sets `letterSpacing: 0` to say NO tracking. **The predicate was right and the set
    // was wrong**, again — chips in wave 1a, opt-outs here.
    //
    // ⚠️ Where a FIELD HINT belongs in a three-role system is a real design question and
    // is NOT answered here. Filed: MICRO-LABEL-FIELDHINT-01.
    if (/letterSpacing: 0\b/.test(blk) || blk.includes("textTransform: 'none'")) continue
    out.push({
      size: `${m[1]}px`,
      weight: (/fontWeight: (\d{3})/.exec(blk) ?? [, '?'])[1]!,
      ls: (/letterSpacing: '([^']+)'/.exec(blk) ?? [, '?'])[1]!,
    })
  }
  return out
}

const CANON = new Set(Object.values(MICRO_LABELS).map(v => `${v.fontSize}|${v.fontWeight}|${v.letterSpacing}`))

/** ⚠️ DECLARED, with its reason. Marketing mockups render iOS chrome at mockup scale and
 *  are already exempted for that reason in `lib/marketing/typeScale.test.ts`. */
const EXEMPT = /components\/marketing\//

/**
 * 🔴 THE REGISTER. Measured 2026-09-29, app only, marketing excluded.
 *
 * ⚠️ THE BOARD WAS TOLD 116 AND THE TRUE FIGURE IS 132, and the gap is worth recording
 * because it is not a mistake in either number. My sitting measurement scanned **≤11px**,
 * which was the right population for the question *"how much drift is there?"*. The
 * ruling then created a **12px** role (`sectionLabel`), and every 12px tracked label
 * instantly became part of the population it governs.
 *
 * **The denominator moved because the ruling moved it.** A baseline taken before a ruling
 * cannot be assumed valid after it — this repo has recorded rate-moves three times where
 * the definition changed rather than the code.
 *
 * ⚠️ LOWER IT AS WAVES LAND. NEVER RAISE IT.
 *
 * 🔴 IT HAS MOVED TWICE, AND BOTH REASONS ARE RECORDED RATHER THAN ABSORBED:
 *   116 → 132  the ruling created a 12px role, so 12px labels joined the population
 *   132 →  69  −47 converted by wave 1a, and −16 CHIPS removed from the population
 *              because they are a different documented pattern (see the filter above)
 *    69 →  35  −32 converted by wave 2, and −2 explicit OPT-OUTS removed
 *              (`letterSpacing: 0` / `textTransform: 'none'` — they say NO tracking)
 *    35 →  47  🔴 IT WENT UP. Fixing the glob and the regex made 12 labels visible that
 *              had always been there. A register rising because its population got
 *              HONEST is the only rise that is allowed, and it is recorded rather than
 *              absorbed.
 *    47 →  38  −9 of those newly-visible labels converted in the same commit
 *
 * ⚠️ A register that shrinks because its DEFINITION narrowed is not progress, and this
 * one did both at once. The 47 is the debt paid; the 16 is a correction. Stated
 * separately on purpose — a single number would have hidden which was which.
 */
const NON_CONFORMING_BASELINE = 38

const countNonConforming = () => {
  let n = 0
  for (const f of tracked()) {
    if (EXEMPT.test(f)) continue
    for (const l of microLabels(readFileSync(f, 'utf8'))) {
      if (!CANON.has(`${l.size}|${l.weight}|${l.ls}`)) n++
    }
  }
  return n
}

describe('MICRO-LABEL-DRIFT-01 — three roles, and exactly three', () => {
  it('there are EXACTLY three, and a fourth needs the board', () => {
    expect(Object.keys(MICRO_LABELS)).toEqual(['sectionLabel', 'eyebrow', 'dataLabel'])
  })

  // ⚠️ THE DOC WAS COMPLETED, NOT CORRECTED. The documented value is the eyebrow and it
  // did not move — which is why Silvanto declined the veto.
  it('the eyebrow IS the documented value, unchanged', () => {
    expect(DOCUMENTED_EYEBROW.fontSize).toBe('10px')
    expect(DOCUMENTED_EYEBROW.fontWeight).toBe(700)
    expect(DOCUMENTED_EYEBROW.letterSpacing).toBe('0.08em')
    expect(readFileSync('docs/canonical/ui-patterns.md', 'utf8'),
      'the documented Section label changed — re-ratify before changing the constant')
      .toContain('10px uppercase 0.08em')
  })

  // 🔴 11px IS NOT A LEVEL. Every 11px micro-label resolved to one of the three.
  it('no role is 11px', () => {
    for (const [role, v] of Object.entries(MICRO_LABELS)) {
      expect(v.fontSize, `${role} is 11px, which the board ruled is not a level`).not.toBe('11px')
    }
  })

  it('the three sizes are distinct — a hierarchy, not three names for one thing', () => {
    const sizes = Object.values(MICRO_LABELS).map(v => v.fontSize)
    expect(new Set(sizes).size).toBe(3)
  })
})

describe('MICRO-LABEL-DRIFT-01 — one SectionLabel, reachable', () => {
  // 🔴 FOURTH INSTANCE OF THE LOCAL-FUNCTION TRAP. `SectionLabel` was a local fn in
  // `DashboardClient`; `PlanCalendar` could not reach it and wrote `PlanSectionLabel`.
  it('no surface declares its own section label', () => {
    const offenders = tracked()
      .filter(f => f !== 'components/shared/SectionLabel.tsx')
      .filter(f => /function\s+\w*SectionLabel\s*\(/.test(readFileSync(f, 'utf8')))
    expect(offenders, 'import SectionLabel from shared instead of redeclaring it').toEqual([])
  })

  it('it is importable, and both former callers import it', () => {
    for (const f of ['app/dashboard/DashboardClient.tsx', 'components/training/PlanCalendar.tsx']) {
      expect(readFileSync(f, 'utf8'), `${f} does not import the shared SectionLabel`)
        .toContain("from '@/components/shared/SectionLabel'")
    }
  })

  it('it takes its type from the constant, not from literals', () => {
    const src = readFileSync('components/shared/SectionLabel.tsx', 'utf8')
    expect(src).toContain('MICRO_LABELS.sectionLabel')
    expect(src, 'a hardcoded size came back').not.toMatch(/fontSize: '\d+px'/)
  })
})

describe('MICRO-LABEL-DRIFT-01 — the register can only fall', () => {
  it('non-conforming micro-labels do not grow', () => {
    const n = countNonConforming()
    expect(n, `non-conforming micro-labels: ${n}, baseline ${NON_CONFORMING_BASELINE}. ` +
      'A new hand-typed micro-label is exactly what this ruling forbids — use MICRO_LABELS.')
      .toBeLessThanOrEqual(NON_CONFORMING_BASELINE)
  })

  // 🔴 THE ARM THAT STOPS THE REGISTER ROTTING UPWARD. A baseline that only catches growth
  // silently permits re-adding what a wave just removed. Recorded in `buttonInlineOverride`.
  it('a baseline that is no longer met must be LOWERED in the same commit', () => {
    const n = countNonConforming()
    expect(n, `debt fell to ${n} and the register still says ${NON_CONFORMING_BASELINE} — lower it`)
      .toBe(NON_CONFORMING_BASELINE)
  })

  // ⚠️ THE OPT-OUT EXCLUSION IS TINY AND MUST STAY TINY. Two labels. If it ever grows,
  // someone is using `letterSpacing: 0` to dodge the register rather than to say
  // "this is not a tracked label".
  it('the opt-out exclusion stays a handful, not a loophole', () => {
    let optOut = 0
    for (const f of tracked()) {
      if (EXEMPT.test(f)) continue
      const src = readFileSync(f, 'utf8')
      const re = /fontSize:\s*'(9|10|11|12)px'/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const start = src.lastIndexOf('{{', m.index)
        if (start === -1 || m.index - start > 600) continue
        const end = src.indexOf('}}', m.index)
        if (end === -1) continue
        const blk = src.slice(start, end + 2)
        if (!blk.includes('letterSpacing')) continue
        if (blk.includes('background') || blk.includes('border')) continue
        if (/letterSpacing: 0\b/.test(blk) || blk.includes("textTransform: 'none'")) optOut++
      }
    }
    expect(optOut, `opt-outs grew to ${optOut} — letterSpacing: 0 is becoming a way to dodge the register`)
      .toBeLessThanOrEqual(4)
  })

  // 🔴 THE EXCLUSION MUST STAY NARROW. `background|border` is a big hammer: widen it and
  // the register empties without a single label being fixed. This asserts the chips it
  // removes are a real, non-trivial population — if it ever reads 0, the filter has
  // stopped matching and the register silently grew a blind spot.
  it('the chip exclusion removes a real, bounded population', () => {
    let chips = 0
    for (const f of tracked()) {
      if (EXEMPT.test(f)) continue
      const src = readFileSync(f, 'utf8')
      const re = /fontSize:\s*'(9|10|11|12)px'/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const start = src.lastIndexOf('{{', m.index)
        if (start === -1 || m.index - start > 600) continue
        const end = src.indexOf('}}', m.index)
        if (end === -1) continue
        const blk = src.slice(start, end + 2)
        if (!blk.includes('letterSpacing')) continue
        if (blk.includes('background') || blk.includes('border')) chips++
      }
    }
    expect(chips, 'the chip filter matches nothing — it has stopped working').toBeGreaterThan(5)
    expect(chips, 'the chip filter is swallowing the whole population').toBeLessThan(60)
  })

  // ⚠️ AN EMPTY POPULATION PASSES EVERY OTHER ARM IN THIS FILE.
  //
  // 🔴 AND IT MUST COUNT THE CONVERTED ONES TOO, which the first version did not. It
  // counted labels carrying a LITERAL `fontSize`, so **every successful conversion shrank
  // the population that proves the scanner works** — as the migration succeeds toward
  // zero, the arm proving the scanner is alive fails. "The scanner broke" and "we fixed
  // everything" became indistinguishable, which is this repo's most-recorded failure
  // wearing a new hat. Caught by wave 2: 78 literals left, threshold was 100.
  //
  // ⚠️ Same shape as `BUTTON-GEOMETRY-SPREAD-01` — a harness that reads literals goes
  // blind as the codebase does the right thing.
  it('the population is real and derived, converted labels INCLUDED', () => {
    expect(tracked().length).toBeGreaterThan(50)
    const app = tracked().filter(f => !EXEMPT.test(f))
    const literals = app.reduce((a, f) => a + microLabels(readFileSync(f, 'utf8')).length, 0)
    const converted = app.reduce((a, f) =>
      a + (readFileSync(f, 'utf8').match(/MICRO_LABELS\.(sectionLabel|eyebrow|dataLabel)/g) ?? []).length, 0)
    expect(converted, 'no converted labels found — the constant is not being used')
      .toBeGreaterThan(50)
    expect(literals + converted, 'the scanner stopped finding micro-labels — re-anchor it')
      .toBeGreaterThan(140)
  })
})
