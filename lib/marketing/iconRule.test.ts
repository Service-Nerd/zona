import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
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
const ICON_SURFACES = ['app/dashboard/MeScreen.tsx', 'components/shared/ModifyPlanSheet.tsx']

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
  it('the modify sheet still has the row count its icons are justified by', () => {
    // Live, not a literal copied from the ruling: the board's LOCATION
    // argument is "eight or more rows, where the job is finding". Trim the
    // sheet to five and the icons lose the reason they were permitted, which
    // no reviewer would notice and this will.
    expect(
      MODIFIABLE_ROWS.length,
      `ICON-RULE-01 permits icons on the modify sheet because it has >= ${MIN_ROWS_FOR_ICONS} rows. `
      + `It now has ${MODIFIABLE_ROWS.length}. Either the icons go, or the board re-rules the bound.`,
    ).toBeGreaterThanOrEqual(MIN_ROWS_FOR_ICONS)
  })

  it('row icons appear only on the two surfaces the board ruled', () => {
    const offenders: string[] = []
    for (const f of tsxFiles()) {
      if (ICON_SURFACES.some(s => f.endsWith(s))) continue
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      if (/<RowIcon\b/.test(src)) offenders.push(f)
    }
    expect(
      offenders,
      'a row icon outside Me and the modify sheet. ICON-RULE-01: wizard steps, Plan rows and '
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
