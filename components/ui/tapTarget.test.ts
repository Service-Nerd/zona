// TAP-TARGET-DECISIONS-01 batch 8a (2026-10-05) — ONE owner for the 44px floor.
//
// 🔴 THE VALUE WAS WRITTEN OUT IN 29 PLACES and they agreed by luck: three named
// constants — `TAB_MIN_HEIGHT_PX` and `PROVENANCE_MIN_HEIGHT_PX` in one file, plus
// `SEGMENTED_MIN_HEIGHT_PX` — and the rest inline. This repo's most expensive
// defects are all this shape (`TIER-OWNER-01`, `DELOAD-OWNER-01`,
// `SESSION-KM-01/02`, `OPS-AI-OWNER-01`).
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { TAP_TARGET_MIN_PX } from './tapTarget'

const OWNER = 'components/ui/tapTarget.ts'
const FILES = execSync(
  "git ls-files 'app/**/*.tsx' 'app/**/*.ts' 'components/**/*.tsx' 'components/**/*.ts'",
  { encoding: 'utf8' },
).trim().split('\n').filter(f => f && !f.includes('.test.'))

describe('TAP-TARGET-DECISIONS-01 — the floor has one owner', () => {
  it('the population is real', () => {
    // An empty population passes every arm below.
    expect(FILES.length, 'the git glob stopped matching — this file would go vacuously green')
      .toBeGreaterThan(100)
    expect(FILES).toContain(OWNER)
  })

  it('the floor is 44, which is what design-rulings.md states', () => {
    expect(TAP_TARGET_MIN_PX).toBe(44)
  })

  it('🔴 no named floor constant RE-TYPES 44 — they derive from the owner', () => {
    // ⚠️ This is the arm that matters, and it is about the NAMED constants rather
    // than every inline literal. A second named constant holding its own 44 is the
    // exact shape that produced three of them: it reads as deliberate, it is
    // exported, other files import it, and it drifts silently when the rule moves.
    const offenders = FILES.filter(f => {
      if (f === OWNER) return false
      return /export\s+const\s+[A-Z_]*MIN[A-Z_]*\s*(?::\s*number\s*)?=\s*44\b/.test(
        readFileSync(f, 'utf8'),
      )
    })
    expect(offenders,
      'a named tap-target floor constant re-types 44. Derive it from ' +
      '`TAP_TARGET_MIN_PX` in components/ui/tapTarget.ts instead.',
    ).toEqual([])
  })

  // ⚠️ DECLARED DEBT, AND IT MAY ONLY FALL. Inline `minHeight: 44` is NOT converted
  // here: 17 sites across 14 files is its own batch, and a gate that blocks
  // everything gets deleted rather than satisfied (this repo's own rule). What this
  // arm does is stop it GROWING, so the next control takes the constant.
  //
  // 🔴 MEASURED, NOT GUESSED. I wrote 26 first, from a grep that also matched
  // `min-height: 44px` in CSS and other forms. The real figure for this predicate is
  // 17, and the difference is the whole reason the number is derived in the test
  // rather than typed into it.
  it('inline 44 literals do not grow', () => {
    // ✅ DEBT PAID IN FULL, 2026-11-09 (`TAP-TARGET-INLINE-44-01`). 29 → 26 → 17 → 16 → **0**.
    // All sixteen remaining inline literals import the owner; the conversion is
    // literal-to-constant and nothing else, proved on the diff (16 removals each
    // containing `minHeight: 44`, 16 additions each the constant, zero changed lines
    // touching neither that nor the import). React renders `minHeight: 44` as
    // `min-height: 44px`, so `'44px'` → `TAP_TARGET_MIN_PX` is byte-identical output.
    //
    // ⚠️ THE BASELINE IS 0 NOW, WHICH CHANGES WHAT THIS ARM IS. It was a ratchet over
    // declared debt; it is a RULE: no inline 44 at all. The next control that types the
    // number instead of importing it fails the build, which is the property the register
    // was only ever approximating.
    //
    // ⚠️ AND THE ITEM'S HEADING SAID 17 WHILE ITS OWN CORRECTION NOTE SAID 16, and a
    // fresh grep across `app/` + `components/` ALSO said 17 — because it counted the
    // regex literal in THIS file. The gate excludes `.test.` and was right all along at
    // 16. Three numbers, and the gate's was the only one derived from the population it
    // governs.
    const INLINE_BASELINE = 0
    let n = 0
    for (const f of FILES) {
      n += (readFileSync(f, 'utf8').match(/minHeight:\s*'?44(?:px)?'?/g) ?? []).length
    }
    expect(n,
      n > INLINE_BASELINE
        ? `a NEW inline 44 landed (${n} vs ${INLINE_BASELINE}). Import TAP_TARGET_MIN_PX.`
        : `debt PAID: ${n} vs baseline ${INLINE_BASELINE} — lower INLINE_BASELINE.`,
    ).toBe(INLINE_BASELINE)
  })
})
