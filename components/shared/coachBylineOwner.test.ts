// COACHBYLINE-EMPTY-VARIANT-01 (2026-10-05) — the component owns its own empty state.
//
// 🔴 WHAT THIS HOLDS SHUT. `CoachByline` always stamped `<AIMark />`, and an empty
// coach line is HAND-AUTHORED — stamping it would claim a model wrote something no
// model wrote (ui-patterns.md § AIMark, Pattern 16 provenance honesty). So the only
// correct thing a caller could do was hand-roll the byline without the glyph, and
// `DashboardClient` did: 17 lines reproducing the 22px avatar, the name and the
// eyebrow.
//
// ⚠️ THE REASON WAS RIGHT AND THE HAND-ROLL WAS THE SYMPTOM. The defect was a
// MISSING STATE, not a careless call site — which is why the fix is a variant and
// not a lint rule. Zhuo: "a component that does not cover its own empty state will
// be hand-rolled again." It is also the SLC rule: a surface without its empty state
// is not complete.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

// Population DERIVED, not typed. A hand-written list is how a guard ends up
// reporting on a smaller world than the one it guards (four times on 2026-09-25).
const APP_FILES = execSync(
  "git ls-files 'app/**/*.tsx' 'components/**/*.tsx'",
  { encoding: 'utf8' },
).trim().split('\n').filter(f => f && !f.includes('.test.'))

// ⚠️ EXEMPT BY NAME, WITH ITS REASON AND ITS ITEM — not a blanket skip.
//   • CoachByline.tsx IS the owner.
//   • PhoneFrame.tsx declares `KitByline`, whose own doc comment says "copy of
//     CoachByline". That is a REAL second duplication and it is FILED as
//     `MKT-KITBYLINE-COPY-01` for the 🧭 Design Board — whether a marketing still
//     uses the live component or a deliberately pinned copy is a design decision,
//     not a defect, and `TabbedPhone.tsx` next to it uses the real one.
//     **The exemption is the record**: it cannot be quietly forgotten while it
//     names the item that owns it.
const OWNER   = 'components/shared/CoachByline.tsx'
const FILED_ELSEWHERE = 'components/marketing/PhoneFrame.tsx'

describe('COACHBYLINE-EMPTY-VARIANT-01 — one owner of Kit\'s byline', () => {
  it('the population is real', () => {
    // An empty population passes every other arm in this file.
    expect(APP_FILES.length, 'the git glob stopped matching — this file would go vacuously green')
      .toBeGreaterThan(50)
    expect(APP_FILES).toContain(OWNER)
  })

  it('🔴 nothing outside the owner draws Kit\'s avatar initial', () => {
    // The avatar initial is the byline's signature: `BRAND.coachName.charAt(0)`
    // has no other legitimate use. Matching the EXPRESSION, not the word "avatar",
    // because a name is not a usage.
    const offenders = APP_FILES.filter(f => {
      if (f === OWNER || f === FILED_ELSEWHERE) return false
      return /coachName\.charAt\(/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))
    })
    expect(offenders,
      'a second byline is being hand-rolled. `CoachByline` covers working, warn, ' +
      'onClick AND empty — use it. If a state is genuinely missing, add the state.',
    ).toEqual([])
  })

  it('the empty variant exists and suppresses the provenance badge', () => {
    const src = fs.readFileSync(path.join(ROOT, OWNER), 'utf8')
    expect(src, 'the `empty` prop is gone — the hand-roll will come back').toMatch(/empty\?:\s*boolean/)
    // 🔴 THE WHOLE BADGE, not just the glyph. The white circle is itself the
    // provenance marker, and an empty circle reads as a rendering fault.
    expect(src, 'the AIMark badge must be suppressed, not just the glyph swapped')
      .toMatch(/\{!empty && \(/)
    expect(src, 'the empty state must be dimmed as one unit').toMatch(/empty \? \{ opacity:/)
  })

  it('`empty` beats `working` — an empty line cannot be being generated', () => {
    const src = fs.readFileSync(path.join(ROOT, OWNER), 'utf8')
    // A caller passing both must degrade to the HONEST state, never to a false claim.
    expect(src).toMatch(/const isWorking\s*=\s*working && !empty/)
    expect(src, 'the raw `working` must not still drive the glyph')
      .not.toMatch(/working=\{working\}/)
  })

  it('the dashboard empty state uses the variant, not 17 lines of copy', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    expect(src).toMatch(/<CoachByline empty/)
  })
})
