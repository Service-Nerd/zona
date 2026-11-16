import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MARKETING_PLANS } from './plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { stepParts } from '@/lib/plan/resolveMainSet'
import { planRowPace } from './planRowPace'

/**
 * MKT-STEP-CEILING-BAND-01 (Design Board 2026-11-16) — the website expresses an easy pace as the
 * CEILING it is, through the same owner as the app.
 *
 * 📐 **MEASURED BEFORE, across the 9 published plans that generate** (the 10th is the staged
 * never-run page, refused by design):
 *
 *   · **87 of 205** rendered steps read `at no faster than 6:30–7:30 /km` — a comparison applied
 *     to a RANGE, naming two numbers where the ceiling is one.
 *   · **424 of 507** session rows printed the raw band where the app shows `6:30 /km or slower`.
 *
 * 🔑 **The wording was never the open question the item thought.** `sessionSteps.ts` settled it for
 * the app and recorded why: `design-rulings.md` CD-11 / §12 ratifies *"X or slower"*, and routing
 * through `easyPaceAsCeiling` exists so there is not *"a second writer of a pace qualifier"*. Both
 * website renderers were second writers, printing the other phrasing on the sales surface.
 *
 * ⚠️ **The slow end is not a limit.** §12 caps an easy run at the top of Z2; running slower than
 * 7:30 is still a correct easy run, so a RANGE invents a boundary the plan does not set. A quality
 * session's band is a genuine two-ended target and is left alone — **58 of 482** stay bands.
 */

const START = '2026-11-23'
const iso = (d: number) => new Date(Date.parse(`${START}T00:00:00Z`) + d * 864e5).toISOString().slice(0, 10)

interface Row { steps: string[]; rows: { pace: string | null; type: string }[] }

function render(): Row {
  const steps: string[] = []
  const rows: { pace: string | null; type: string }[] = []
  for (const meta of MARKETING_PLANS) {
    let plan: { weeks?: unknown[] }
    try { plan = generateRulePlan(meta.input(iso(meta.dayOffset)) as never, 'free', START) as never }
    catch { continue }   // the staged never-run page refuses by design
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
  return { steps, rows }
}

describe('MKT-STEP-CEILING-BAND-01 — the published plan pages', () => {
  const r = render()

  it('the corpus is real: nine plans, hundreds of steps and rows', () => {
    // Vacuity guard. Every arm below passes on an empty corpus, which is how a gate dies quietly.
    expect(r.steps.length).toBeGreaterThan(150)
    expect(r.rows.length).toBeGreaterThan(400)
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
    // 424 of 507 rows printed the raw band before.
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
