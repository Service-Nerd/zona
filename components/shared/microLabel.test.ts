import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { MICRO_LABELS, DOCUMENTED_EYEBROW, FIELD_HINT } from './microLabels'

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
      // 🔴 ALL THREE REGEXES MUST TOLERATE PADDING, not just fontSize. Wave 2 fixed the
      // size regex and left these two on a single space, so an ALIGNED block like
      // `fontWeight:    700,` read as '?' and a CANONICAL label was counted as debt.
      // ⚠️ SIXTH POPULATION DEFECT, and the first that INFLATES rather than shrinks:
      // `PendingHrCard` and `PreRunBandCard` write the exact canonical eyebrow and were
      // both in the register. **Both directions are wrong**, and a register that
      // over-counts is the one that gets "fixed" by editing correct code.
      weight: (/fontWeight:\s*(\d{3})/.exec(blk) ?? [, '?'])[1]!,
      ls: (/letterSpacing:\s*'([^']+)'/.exec(blk) ?? [, '?'])[1]!,
    })
  }
  return out
}

const CANON = new Set(Object.values(MICRO_LABELS).map(v => `${v.fontSize}|${v.fontWeight}|${v.letterSpacing}`))

/**
 * The set the chip filter REMOVES, partitioned by the element carrying the style.
 *
 * 🔴 ONE COUNTER FOR BOTH ARMS, on purpose. Two arms over one population with a human
 * in between is how a green tick hides a hole — the exact flaw recorded for
 * `deloadCadence.test.ts` and for the tier order written three times.
 */
function chipCount(): { buttons: number; spans: number } {
  let buttons = 0
  let spans = 0
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
      if (!(blk.includes('background') || blk.includes('border'))) continue
      const tagAt = src.lastIndexOf('<', start)
      const tag = /^<([A-Za-z][\w.]*)/.exec(src.slice(tagAt))?.[1] ?? '?'
      if (tag === 'Button') buttons++
      else spans++
    }
  }
  return { buttons, spans }
}

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
 *    36 →  28  −8 brand stamps converted (MICRO-LABEL-BRAND-STAMP-01).
 *    28 →  27  −1, the 9th brand stamp. The sandbox refused the password-reset file
 *              edit; the founder granted it. 🥇 BOTH STALE ARMS FIRED ON THE WAY IN
 *              and named the new number — the register was lowered because a test
 *              demanded it, not because anyone remembered.
 *    38 →  36  −2 that were never debt: `fontWeight`/`letterSpacing` were still matched
 *              with ONE SPACE, so two CANONICAL labels written on aligned blocks were
 *              counted as violations. The first over-count of the six.
 *
 * ⚠️ A register that shrinks because its DEFINITION narrowed is not progress, and this
 * one did both at once. The 47 is the debt paid; the 16 is a correction. Stated
 * separately on purpose — a single number would have hidden which was which.
 */
const NON_CONFORMING_BASELINE = 27

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
    const chips = chipCount().buttons + chipCount().spans
    expect(chips, 'the chip filter matches nothing — it has stopped working').toBeGreaterThan(5)
    expect(chips, 'the chip filter is swallowing the whole population').toBeLessThan(60)
  })

  // 🔴 AND THE BAND ABOVE CANNOT TELL WHAT IT EXCLUDED. `background|border` is not a
  // chip test — it is "small text with a fill or an outline" — so of the 17 instances
  // this filter removes, **8 are `<Button>`**, excluded on the written grounds that
  // *"a chip is not a micro-label"*. They are not chips. They are buttons, and
  // `components/ui/buttonInlineOverride.test.ts` already owns them: its OWNED list is
  // exactly `background, borderRadius, fontSize, padding, minHeight, height`.
  //
  // ⚠️ THE EXCLUSION IS HARMLESS AND ITS REASON WAS FALSE, which is the dangerous
  // combination — nothing could go red, and `MICRO-LABEL-CHIPS-01` was filed on the
  // reason, claiming *"16 labels are governed by no check whatsoever."* Measured
  // 2026-10-02: **17 excluded, 8 of them governed elsewhere, 9 genuinely ungoverned.**
  // A number inherited from a comment, twice removed from the code.
  //
  // This arm partitions the excluded set by the ELEMENT that carries the style, so the
  // two halves are counted separately and neither can drift behind the other's total.
  it('the excluded set is partitioned: buttons are governed elsewhere, spans are not', () => {
    const { buttons, spans } = chipCount()
    // Governed by BUTTON-SYSTEM-01's register, not by this file. If this reaches 0 the
    // button gate has lost them, not this one.
    expect(buttons, 'no Button in the excluded set — check buttonInlineOverride.test.ts still owns them')
      .toBeGreaterThan(4)
    // The genuinely ungoverned remainder. ⚠️ NOT an upper bound on correctness: these
    // are governed by NOTHING, and whether a chip gets a role is a Design Board
    // question (MICRO-LABEL-CHIPS-01). This arm only stops the number moving unseen.
    expect(spans, 'the ungoverned chip population moved — re-measure and take it to the board')
      .toBeLessThan(14)
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
})

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-LABEL-HANDROLL-01 — RIGHT VALUES, WRONG MECHANISM (2026-10-02).
//
// 🔴 THE HALF OF THIS DEFECT CLASS THAT NEVER LOOKS LIKE ANYTHING. The register above
// counts a literal only when its VALUES are wrong (`if (!CANON.has(...)) n++`), so a label
// that retypes the canonical eyebrow by hand is **invisible to it by construction** — and
// every surface reads correctly on its own, so nothing renders differently today.
//
// ⚠️ MEASURED 2026-10-02: 51 eyebrow + 1 dataLabel literal copies, app only. **The item was
// filed at 32.** Neither number was a lie: the filed signature lists the four properties in
// ONE fixed order, and most real copies use a different order or span several lines, so an
// order-sensitive single-line match could not see them. Same recorded class as the short
// glob and the one-space regex above — **a checker that encodes one way of writing
// something is blind to every other way, and people write things more than one way.** This
// arm is order-independent because it reads the same parsed blocks the register does.
//
// 🔴 THE COST IS THE NEXT EDIT TO THE ROLE, not today's pixels. `MICRO-LABEL-DRIFT-01`
// shipped the owner and did not convert the consumers, so the role moved 144 call sites and
// would have left 52 behind — the `SUBPAGE-TYPE-SCALE-01` shape, where nine titles
// converted and two HAND-COPIED the right values.
//
// ⚠️ `components/marketing/` STAYS EXEMPT, AND ONE CONVERSION WAS REVERTED TO KEEP IT SO.
// `PhoneFrame` draws a simulated iPhone at mockup scale; its 10px label happens to equal the
// app's eyebrow, so converting it changed nothing visible and was still wrong — it would
// bind the DRAWING to the app's live token, so a future ruling on the eyebrow would silently
// redraw the picture. `globals.css` states the principle for the site scale: forcing a mockup
// onto a governed scale "would make the drawing wrong to make a grep clean."
// ─────────────────────────────────────────────────────────────────────────────
// MICRO-LABEL-FIELDHINT-01 (Design Board, 2026-10-02) — DON'T SHIP a fourth role.
//
// ⚖️ A field hint (`optional`, lowercase, beside an input) is **body text**, not a label. It
// takes the DOCUMENTED *Muted / hint* values that already existed in `ui-patterns.md` and
// that nothing was reaching. **The micro-label set stays closed at three.**
//
// 🔴 MEASURED: THREE instances, not the two the item claimed, and the same word rendered
// THREE WAYS — lowercase 10px/400 twice, and **UPPERCASE 10px/700** once, because
// `ManualRunModal` spread `MICRO_LABELS.eyebrow` and overrode only `letterSpacing`, leaving
// `textTransform: 'uppercase'` and `fontWeight: 700` alive. **A role borrowed and PARTLY
// overridden is worse than one copied**: it reads as governed, and the register cannot see it
// because the values it checks are canonical.
describe('MICRO-LABEL-FIELDHINT-01 — a field hint is body text, not a fourth role', () => {
  it('🔴 the role set is still exactly three — a fourth needs the board', () => {
    expect(Object.keys(MICRO_LABELS)).toEqual(['sectionLabel', 'eyebrow', 'dataLabel'])
    expect(Object.keys(MICRO_LABELS)).not.toContain('fieldHint')
  })

  it('FIELD_HINT carries the documented Muted / hint values', () => {
    expect(FIELD_HINT.fontSize).toBe('12px')
    expect(FIELD_HINT.fontWeight).toBe(400)
    expect(FIELD_HINT.color).toBe('var(--mute)')
    expect(readFileSync('docs/canonical/ui-patterns.md', 'utf8'),
      'the documented Muted / hint row changed — re-ratify before changing the constant')
      .toContain('| Muted / hint | `--font-ui` | 400 | 12px |')
  })

  // 🔴 THE ARM THAT CATCHES THE REAL DEFECT. A hint that SPREADS a micro-label role and
  // overrides one property away still inherits uppercase and 700, and looks governed while
  // being neither a hint nor a label.
  it('🔴 no `optional` hint borrows a micro-label role', () => {
    const offenders: string[] = []
    for (const f of tracked()) {
      const src = readFileSync(f, 'utf8')
      for (const m of Array.from(src.matchAll(/>\s*optional\s*</g))) {
        const win = src.slice(Math.max(0, m.index! - 300), m.index!)
        if (/MICRO_LABELS\.(sectionLabel|eyebrow|dataLabel)/.test(win)) {
          offenders.push(`${f}:${src.slice(0, m.index!).split('\n').length}`)
        }
      }
    }
    expect(offenders, 'a field hint is spreading a micro-label role. Use FIELD_HINT — a hint ' +
      'beside an input is body text, and the board declined a fourth role:\n' + offenders.join('\n'))
      .toEqual([])
  })

  it('the hints are real and reachable (an empty population passes the arm above)', () => {
    const n = tracked().reduce((a, f) =>
      a + (readFileSync(f, 'utf8').match(/>\s*optional\s*</g) ?? []).length, 0)
    expect(n, 'no `optional` hints found — re-anchor this gate').toBeGreaterThanOrEqual(3)
  })
})

describe('MICRO-LABEL-HANDROLL-01 — the values come from the owner, never a literal', () => {
  const handRolled = (): string[] => {
    const out: string[] = []
    for (const f of tracked()) {
      if (EXEMPT.test(f)) continue
      for (const l of microLabels(readFileSync(f, 'utf8'))) {
        if (CANON.has(`${l.size}|${l.weight}|${l.ls}`)) out.push(`${f} = ${l.size}/${l.weight}/${l.ls}`)
      }
    }
    return out.sort()
  }

  // 🔴 EXACTLY THE INVERSE OF THE REGISTER ARM ABOVE, and that is the point: between them
  // the two arms partition every micro-label literal in the app. Non-canonical values are
  // debt that may only FALL; canonical values written as a literal are forbidden outright,
  // because there is no migration to schedule — the owner already exists and is imported in
  // 40 files. A label is therefore either converted, or wrong, or registered. Nothing else.
  it('🔴 no surface retypes a canonical micro-label value', () => {
    expect(handRolled(),
      'a micro-label carries the canonical values as a LITERAL. Spread the role instead: ' +
      "style={{ ...MICRO_LABELS.eyebrow, color: 'var(--mute)' }}. The owner is " +
      'components/shared/microLabels.ts.')
      .toEqual([])
  })

  // ⚠️ THE POPULATION ARM, because an empty result passes the arm above for two different
  // reasons and only one of them is good news. If the scanner stops finding blocks, this
  // file reports a clean migration and a dead parser identically — the failure this repo
  // records more than any other.
  it('the scanner still reaches the converted population', () => {
    const app = tracked().filter(f => !EXEMPT.test(f))
    const converted = app.reduce((a, f) =>
      a + (readFileSync(f, 'utf8').match(/MICRO_LABELS\.(sectionLabel|eyebrow|dataLabel)/g) ?? []).length, 0)
    expect(converted, 'the role is no longer spread anywhere — the parser or the glob broke')
      .toBeGreaterThan(90)
  })
})

describe('MICRO-LABEL-DRIFT-01 — population', () => {
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

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-LABEL-BRAND-STAMP-01 — the brand stamp is an eyebrow, not a fourth role.
//
// The brand's own locked words were the LEAST governed type in the product: nine
// uppercase stamps written nine ways — three trackings (0.12em ×7, 0.14em ×2) and
// FOUR weights (unset/400 ×3, 500 ×2, 600 ×3, 700 ×2) — on the splash, the welcome
// screen, login, password reset, three onboarding screens and the founder note.
//
// 🥇 THE RULING WAS ALREADY SHIPPED IN CODE, ON THE SURFACE THE STALE DOC NAMED.
// `SessionCompleteCard` renders both `BRAND.voiceAnchor` and `BRAND.brandStatement`
// through `MICRO_LABELS.eyebrow`, its comment reading "Matches Pattern 10 eyebrow
// tracking" — while `DOCTRINE-01`'s registry line (2026-05-23) claimed the stamp was
// "canonical 10px/0.14em". That line predates the 0.08em standardisation (2026-09-20,
// 64:17) by four months. It was superseded doc, not competing doctrine, and I filed
// this item believing the opposite.
//
// 🔴 AND THE LOOKAHEAD IS THE POINT OF THIS SCANNER'S SHAPE. My own measurement said
// TEN labels. The tenth was the `Connect` button's hand-typed geometry, matched only
// because `BRAND.name` appeared in a SENTENCE 200 characters BELOW the style block.
// Seventh population defect of the week and the first caused by the WINDOW rather than
// the regex or the glob. So this arm reads only the element's OWN children — the text
// between `}}>` and the next `<` — never a fixed character budget.
//
//   bound the region, never grep the neighbourhood.
const LOCKED = /\{?BRAND\.(voiceAnchor|brandStatement|tagline|name)\b/

/** Uppercase tracked type whose OWN CHILDREN are a locked BRAND string. */
function brandStamps(src: string): { size: string; ls: string }[] {
  const out: { size: string; ls: string }[] = []
  const re = /fontSize:\s*'(9|10|11|12)px'/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const start = src.lastIndexOf('{{', m.index)
    if (start === -1 || m.index - start > 600) continue
    const end = src.indexOf('}}', m.index)
    if (end === -1) continue
    const blk = src.slice(start, end + 2)
    if (!blk.includes('letterSpacing')) continue
    if (blk.includes('MICRO_LABELS')) continue
    if (!blk.includes("textTransform: 'uppercase'")) continue
    // The element's own children only: from `}}>` to the next tag.
    const openEnd = src.indexOf('>', end)
    if (openEnd === -1) continue
    const nextTag = src.indexOf('<', openEnd)
    const children = src.slice(openEnd + 1, nextTag === -1 ? openEnd + 1 : nextTag)
    if (!LOCKED.test(children)) continue
    const ls = /letterSpacing:\s*'([^']+)'/.exec(blk)
    out.push({ size: m[1]!, ls: ls ? ls[1]! : '?' })
  }
  return out
}

/** ✅ ZERO. Every locked BRAND string in the product renders through the role.
 *
 *  It was 1 for one commit: the edit to `app/auth/reset/page.tsx` was refused by the
 *  sandbox as a password-reset file change, registered rather than hidden, and the
 *  founder granted the permission. 🥇 THE STALE ARM IS WHAT CLOSED IT — the moment the
 *  ninth stamp landed the build went red and named the new number. A debt register
 *  with no stale arm would have sat at 1 forever, correct on the day it was written
 *  and wrong from the next commit on.
 *
 *  ⚠️ At zero this is no longer a register, it is a RULE: any new brand stamp off the
 *  role fails the build on its first commit. */
const BRAND_STAMP_BASELINE = 0

describe('MICRO-LABEL-BRAND-STAMP-01 — a locked brand string is an eyebrow', () => {
  const offenders = () => {
    const out: string[] = []
    for (const f of tracked()) {
      if (EXEMPT.test(f)) continue
      for (const s of brandStamps(readFileSync(f, 'utf8'))) {
        out.push(`${f}: ${s.size}px / ${s.ls}`)
      }
    }
    return out
  }

  it('no NEW brand string is stamped outside MICRO_LABELS', () => {
    const o = offenders()
    expect(o.length, `brand stamps off the role: ${o.join(' · ')}`)
      .toBeLessThanOrEqual(BRAND_STAMP_BASELINE)
  })

  it('and a baseline that is no longer met must be LOWERED in the same commit', () => {
    // The stale arm. Without it, paying the debt leaves a number that says the
    // opposite, and the next reader trusts it. Same shape as SWEEP-BASELINE-01.
    expect(offenders().length, 'brand-stamp debt is paid — lower BRAND_STAMP_BASELINE')
      .toBe(BRAND_STAMP_BASELINE)
  })

  it('the canonical precedent is real: SessionCompleteCard stamps via the role', () => {
    // 🔴 This is the arm that makes the ruling falsifiable rather than asserted. If
    // the precedent it rests on is reverted, the ruling loses its evidence and this
    // goes red — not the prose in design-rulings.md.
    const src = readFileSync('components/shared/SessionCompleteCard.tsx', 'utf8')
    for (const str of ['BRAND.voiceAnchor', 'BRAND.brandStatement']) {
      // 🔴 `indexOf(str)` finds the module COMMENT first, which sits above every
      // `<div>`, so `lastIndexOf('<div')` returned -1 and the slice was ''. Fourth
      // comment-matching defect this week. Anchor on the BRACED JSX form.
      const i = src.indexOf(`{${str}}`)
      expect(i, `${str} rendered on SessionCompleteCard`).toBeGreaterThan(-1)
      // Its own style block, bounded — not a file-wide grep for MICRO_LABELS.
      const open = src.lastIndexOf('<div style={{', i)
      expect(src.slice(open, i)).toContain('MICRO_LABELS.eyebrow')
    }
  })

  it('the scanner reads CHILDREN, not a character budget (the tenth label)', () => {
    // Falsification of the fix itself: the Connect button's geometry sits directly
    // above a sentence containing BRAND.name. A neighbourhood scan counts it; a
    // children scan must not.
    const bled = `
      <Button style={{ padding: '8px 14px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {busy ? 'Connecting...' : 'Connect'}
      </Button>
      <div>{BRAND.name} reads your runs from Apple Health.</div>`
    expect(brandStamps(bled)).toEqual([])
  })
})
