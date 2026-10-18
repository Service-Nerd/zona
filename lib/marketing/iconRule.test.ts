import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { MODIFIABLE_ROWS } from '@/lib/plan/modifyPlan'

/**
 * ICON-RULE-01 (Design Board, 2026-09-22) — an icon earns its place by
 * MEANING the label cannot carry, or by LOCATION on a list of eight or more
 * rows, where the job is finding rather than understanding.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE THE RULING NAMED IT AND NOBODY WROTE IT.
 * `ui-patterns.md` cited `lib/marketing/iconRule.test.ts` as the ruling's
 * mechanical check in the same commit that made the ruling, and the file did
 * not exist — caught by `uiPatternReferences.test.ts`, one commit later. That
 * is this repo's recorded "a principle can CLAIM an invariant that was never
 * written" class (§92 named `INV-PLAN-FOUNDATION-BLOCK` as its enforcer for
 * eight days while the checker did not exist). **A ruling's third artifact is
 * not a sentence naming a file.**
 *
 * ⚠️ AND THE OBVIOUS VERSION OF THIS CHECK WOULD BE INERT. No row icons are
 * built yet — they are wave 3 — so a gate that only walks for `<RowIcon` would
 * pass over an empty set and prove nothing, which is the decorative-config /
 * dead-`flexShrink` class this repo has shipped more than once. So the first
 * assertion reads the LIVE row count that justifies the ruling, and wakes
 * today if that count moves.
 */

/** The two surfaces the board ruled qualify. Adding a third is a board
 *  decision, not an edit — which is the point of the list being here. */
// 🔴 STRENGTH-ENTRY-01 (2026-10-17): this said `app/dashboard/MeScreen.tsx` from the day it was
// written. Me lives in `components/dashboard/`, so the exemption matched nothing and the
// "only these two surfaces" arm could not tell Me from any other file. Nothing failed because
// no row icon existed; the first one found it. `existsSync` below keeps it from drifting again.
// 🧭 2026-10-18 (ICON-RULE-01 × PINNED-DAYS-01): the modify sheet left this list at seven rows.
const ICON_SURFACES = ['components/dashboard/MeScreen.tsx']
/** The owner draws the container; it is not a surface. */
const ICON_OWNER = 'components/shared/RowIcon.tsx'

/** The ruling's own threshold. */
const MIN_ROWS_FOR_ICONS = 8

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

describe('ICON-RULE-01 — an icon earns its place', () => {
  it('the surfaces it names exist (a stale path exempts nothing and checks nothing)', () => {
    for (const f of [...ICON_SURFACES, ICON_OWNER]) expect(existsSync(join(process.cwd(), f)), f).toBe(true)
  })

  it('Me carries its door icons', () => {
    const me = readFileSync(join(process.cwd(), ICON_SURFACES[0]), 'utf8')
    expect((me.match(/<RowIcon\b/g) ?? []).length, 'Me door rows').toBeGreaterThanOrEqual(MIN_ROWS_FOR_ICONS)
  })

  it('🔴 the modify sheet carries no row icon while it has fewer rows than the bound', () => {
    // The board kept the bound at eight rather than moving it to fit the merge. A sheet back at eight rows
    // may carry icons again, and that is a ruling, not a re-add.
    const sheet = readFileSync(join(process.cwd(), 'components/shared/ModifyPlanSheet.tsx'), 'utf8')
    if (MODIFIABLE_ROWS.length < MIN_ROWS_FOR_ICONS) expect(sheet, 'ICON-RULE-01: seven rows do not earn location icons').not.toMatch(/<RowIcon\b|from '\.\/RowIcon'/)
  })

  it('row icons appear only on the surface the board ruled', () => {
    const offenders: string[] = []
    for (const f of tsxFiles()) {
      if (ICON_SURFACES.some(s => f === s) || f === ICON_OWNER) continue
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      if (/<RowIcon\b/.test(src)) offenders.push(f)
    }
    expect(
      offenders,
      'a row icon outside Me. ICON-RULE-01: wizard steps, Plan rows and '
      + 'session cards are all labelled short lists and do NOT qualify',
    ).toEqual([])
  })

  it('an icon container is never tinted with a session or phase hue', () => {
    // ⛔ Silvanto, binding: the container tint may NOT be semantic. The app
    // already spends six session hues and four phase hues; a second colour
    // language competing with that is a palette regression and the veto is
    // live. Bounded to the icon component so this cannot fire on a session
    // card legitimately using its own accent.
    for (const f of tsxFiles()) {
      if (!/RowIcon/.test(f)) continue
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      expect(src, `${f}: an icon container may not use a session hue`).not.toMatch(/var\(--s-/)
      expect(src, `${f}: an icon container may not use the CTA colour`).not.toMatch(/var\(--moss\)/)
    }
  })
})
