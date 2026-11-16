import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MARKETING_PLANS } from './plans'
import { generateMarketingPlan } from './marketingPlan'
import { stepParts } from '@/lib/plan/resolveMainSet'
import { planRowPace } from './planRowPace'

/**
 * MKT-STEP-CEILING-BAND-01 (Design Board 2026-11-16) — the website expresses an easy pace as the
 * CEILING it is, through the same owner as the app.
 *
 * 📐 **MEASURED BOTH SIDES, across all 10 published plans, through `generateMarketingPlan`:**
 *
 *   · **87 of 205** rendered steps read `at no faster than 6:30–7:30 /km` — a comparison applied
 *     to a RANGE, naming two numbers where the ceiling is one. **→ 0.**
 *   · **462 of 593** session rows printed the raw band where the app shows `6:30 /km or slower`.
 *     **→ 0**, all 462 now ceilings.
 *
 * ⚠️ **Those row figures were first reported as 424 of 507, and the error was in the POPULATION,
 * not the arithmetic.** My first cut called `generateRulePlan` behind a `try/catch … continue`,
 * which silently dropped the never-run page — so I wrote "the 9 plans that generate" about a
 * page `runEngine` STAGES perfectly well. `SITE-STAGED-PLAN-01`'s owner gate caught it.
 *
 * 🔑 **The wording was never the open question the item thought.** `sessionSteps.ts` settled it for
 * the app and recorded why: `design-rulings.md` CD-11 / §12 ratifies *"X or slower"*, and routing
 * through `easyPaceAsCeiling` exists so there is not *"a second writer of a pace qualifier"*. Both
 * website renderers were second writers, printing the other phrasing on the sales surface.
 *
 * ⚠️ **The slow end is not a limit.** §12 caps an easy run at the top of Z2; running slower than
 * 7:30 is still a correct easy run, so a RANGE invents a boundary the plan does not set. A quality
 * session's band is a genuine two-ended target and is left alone — **58** stay bands, on both sides.
 */

interface Row { steps: string[]; rows: { pace: string | null; type: string }[]; plans: number }

function render(): Row {
  const steps: string[] = []
  const rows: { pace: string | null; type: string }[] = []
  let plans = 0
  for (const meta of MARKETING_PLANS) {
    // 🔴 THROUGH THE SITE'S OWN ENTRY POINT. My first cut called `generateRulePlan` with a
    // `try/catch … continue`, which SILENTLY DROPPED the tenth page and let me report "the 9
    // plans that generate". `SITE-STAGED-PLAN-01`'s owner gate caught it. The never-run page is
    // not refused: `runEngine` STAGES it as a base-build block, and it renders rows and steps
    // like any other — so it belongs in the population this gate measures.
    const plan = generateMarketingPlan(meta).plan as { weeks?: unknown[] }
    plans++
    for (const w of (plan.weeks ?? []) as { sessions?: Record<string, unknown> }[]) {
      for (const s of Object.values(w.sessions ?? {}) as ({
        type?: string; pace_target?: string | null
        derived_set?: { blocks?: { steps?: never[] }[] }
      } | null)[]) {
        if (!s || s.type === 'rest') continue
        // 🔑 THROUGH THE PAGE'S OWN OWNER, not a recomputation. Calling `easyPaceAsCeiling` here
        // made the two row arms test this harness: restoring the raw `pace_target` and
        // over-reducing both stayed GREEN.
        rows.push({ pace: planRowPace(s), type: s.type ?? '' })
        for (const blk of s.derived_set?.blocks ?? []) {
          for (const st of blk.steps ?? []) steps.push(stepParts(st).target)
        }
      }
    }
  }
  return { steps, rows, plans }
}

describe('MKT-STEP-CEILING-BAND-01 — the published plan pages', () => {
  const r = render()

  it('the corpus is EVERY published plan, and a dropped page fails here', () => {
    // 🔴 THE POPULATION ARM, and it is not a threshold. My first version guarded vacuity with
    // `rows > 520` and I falsified it by rendering 9 of the 10 plans — it stayed GREEN, because
    // 593 rows minus one plan is still over any floor loose enough to be stable. A count of
    // pages is the only thing that can see a page missing, which is the error this gate actually
    // made. Thresholds below are the vacuity guard; this is the completeness one.
    expect(r.plans, 'a published plan page was skipped').toBe(MARKETING_PLANS.length)
    expect(r.steps.length).toBeGreaterThan(150)
    expect(r.rows.length).toBeGreaterThan(520)
  })

  it('🔴 no step applies a comparison to a RANGE', () => {
    // The exact shape the item quoted: `at no faster than 6:30–7:30 /km`. 87 of 205 before.
    const bad = r.steps.filter(t => /(no faster than|no slower than)[^,]*\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/.test(t))
    expect(bad, 'a pace qualifier is applied to a two-ended band').toEqual([])
  })

  it('🔴 the website does not write its own pace qualifier', () => {
    // CD-11 ratified "X or slower"; `no faster than` is this file's old second phrasing. One owner,
    // one phrasing, both surfaces — the app says the same words through `easyPaceAsCeiling`.
    expect(r.steps.filter(t => /no faster than/.test(t)), 'the second phrasing is back').toEqual([])
  })

  it('🔴 an easy session row shows a CEILING, never a band', () => {
    // 462 of 593 rows printed the raw band before.
    const bad = r.rows.filter(x => (x.type === 'easy' || x.type === 'recovery')
      && !!x.pace && /\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/.test(x.pace))
    expect(bad.map(x => x.pace), 'an easy row still names two numbers').toEqual([])
  })

  it('🔑 a QUALITY band is left alone — it is a two-ended target, not a ceiling', () => {
    // The arm that stops an over-eager sweep: reducing these would delete a real prescription.
    const qualityBands = r.rows.filter(x => x.type !== 'easy' && x.type !== 'recovery'
      && !!x.pace && /\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}/.test(x.pace))
    expect(qualityBands.length, 'no quality band survives; the reduction is too wide').toBeGreaterThan(20)
  })

  it('🔻 the abbreviated-zone branch is LATENT, and is routed through the owner anyway', () => {
    // 📐 0 of 205 steps reach it (195 carry a pace, 5 an RPE, 5 neither), so the item's second
    // finding has no live instance. The branch exists, so it goes through `formatZone`; said as a
    // hole rather than a defect, because a latent item and a live one deserve different urgency.
    expect(r.steps.filter(t => /\bin Z\s?\d/i.test(t)), 'an abbreviated zone reached a page').toEqual([])
    const src = readFileSync('lib/plan/resolveMainSet.ts', 'utf8')
    expect(src, 'the zone branch stopped going through formatZone').toContain('`in ${formatZone(s.zone)}`')
  })

  it('both renderers route through the owners, not their own strings', () => {
    const prose = readFileSync('lib/plan/resolveMainSet.ts', 'utf8')
    const page = readFileSync('components/marketing/PlanPage.tsx', 'utf8')
    expect(prose).toContain("easyPaceAsCeiling(s.pace, 'easy')")
    expect(prose).toContain('paceAsFloor(s.pace)')
    expect(page).toContain('planRowPace(s)')
  })
})
