// SITE-STAGED-PLAN-01 — what a staged page may and may not promise.
//
// 🏃 Coaching Board 2026-11-06, §116 Amendment 10: *"the base-build block a staged
// refusal returns may be rendered on a public page; the race it stages may not be
// claimed there."* 🧭 Design Board the same day, SHIP WITH AMENDMENT (5).
//
// 🔴 THE RULE BINDS HARDER THAN THE SITTING THOUGHT, and that is why this gate
// exists rather than a note. The submission measured a probe that omitted
// `days_available` — a field the wizard always sends — and reported
// `target_found: false`, i.e. *"the marathon block does not exist"*. With the
// field the product actually sends, the block is 16 weeks and **`target_found` is
// TRUE**: a real race block sits 13 weeks past the checkpoint. **A page that can
// see a race is more tempted to claim it, not less.**
//
// ⚠️ NOT AN ENGINE INVARIANT, structurally: `validatePlan()` takes a `Plan` and
// cannot see a page. This is the marketing surface's own check.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MARKETING_PLANS } from './plans'
import { generateMarketingPlan, stagedRaceOfPlan } from './marketingPlan'
import type { Session, Week } from '@/types/plan'

const ROOT = process.cwd()
const DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const SOURCE = 'components/marketing/StagedPlanPage.tsx'

/** Comments are not copy. This file quotes the words it forbids, and so does the
 *  page's own rationale — the trap four checks in this repo have hit. */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => ' '.repeat(m.length))
    .split('\n').map(l => (l.trim().startsWith('//') ? '' : l)).join('\n')

const staged = MARKETING_PLANS.filter(p => p.staged)
const sessionsOf = (w: Week): Session[] =>
  DAY.map(d => w.sessions[d]).filter(Boolean) as Session[]

describe('SITE-STAGED-PLAN-01 — a staged page publishes a block, not a race', () => {
  it('there is a staged page, and it really stages', () => {
    // Guards the guard: every arm below is vacuous if this list empties, and a
    // page that stopped staging would pass them all while being a race plan.
    expect(staged.length).toBe(1)
    const { plan, kind } = generateMarketingPlan(staged[0])
    expect(kind, 'the staged page no longer produces a base_build block').toBe('base_build')
    expect(stagedRaceOfPlan(plan), 'no staged_race on a staged page').not.toBeNull()
    expect(plan.weeks.length).toBeGreaterThan(5)
  })

  it('publishes no race session and no race day', () => {
    const { plan } = generateMarketingPlan(staged[0])
    const races = plan.weeks.flatMap(w => sessionsOf(w).filter(s => s.type === 'race'))
    expect(races, '§116 Am.10: a staged page may not publish the race it stages').toEqual([])
  })

  it('names no race and no race-day countdown in its copy', () => {
    // ⚠️ The SLUG and the H1 are what the Design Board pinned (Collins: "the
    // moment it appears the reader anchors on it and the page becomes a marathon
    // page that undersells itself"). A link to another plan page may of course
    // carry that plan's own name.
    for (const p of staged) {
      expect(p.slug, 'a staged slug may not name a race distance').not.toMatch(/marathon|10k|5k|half/i)
      expect(p.h1, 'a staged h1 may not name a race distance').not.toMatch(/marathon|10k|5k|half/i)
      expect(`${p.metaTitle} ${p.h1} ${p.heroSub} ${p.ogTitle}`,
        'a staged page may not count down to a race day').not.toMatch(/race day|weeks to go|countdown/i)
    }
  })

  it('never says "couch"', () => {
    // 🎓 Sierra: the category's word, mildly contemptuous about the person it
    // describes, who does not use it about themselves.
    const p = staged[0]
    const copy = [p.slug, p.metaTitle, p.metaDescription, p.h1, p.heroSub, p.ogTitle, p.ogDescription, p.whoFor].join(' ')
    expect(copy).not.toMatch(/couch/i)
    expect(code(readFileSync(join(ROOT, SOURCE), 'utf8'))).not.toMatch(/couch/i)
  })

  it('states whose plan it is, in the body', () => {
    // 🩹 Willy, binding: the page renders ONE instance, and a 55-year-old with a
    // knee history is reading somebody else's plan unless the page says so.
    const src = code(readFileSync(join(ROOT, SOURCE), 'utf8'))
    expect(src, 'the page must say it is one runner\'s plan').toMatch(/one person&rsquo;s plan|one person's plan/)
    expect(src, 'the inputs must be named').toMatch(/injury history/i)
    expect(src, 'age must be named as an input that changes the plan').toMatch(/aged/i)
  })

  it('explains the weeks that carry no distance, and derives where they end', () => {
    // ✋ Silvanto: "a footnote explains an absence; a changed unit shows a
    // progression." 📱 Wroblewski: at 375px the header must change with the unit.
    const { plan } = generateMarketingPlan(staged[0])
    const firstMeasured = plan.weeks.findIndex(w => sessionsOf(w).some(s => s.distance_km != null))
    expect(firstMeasured, 'no week carries a distance — the unit never changes').toBeGreaterThan(0)
    const before = plan.weeks.slice(0, firstMeasured).flatMap(sessionsOf)
    expect(before.every(s => s.distance_km == null),
      'a week before the switch carries a distance; the two sections would lie').toBe(true)
    expect(before.every(s => s.duration_mins != null),
      'a minutes week with no minutes has nothing to render').toBe(true)

    const src = code(readFileSync(join(ROOT, SOURCE), 'utf8'))
    // 🔴 THIS ARM WAS HOLLOW ON ITS FIRST WRITE AND A MUTATION CAUGHT IT.
    // It matched `/splitAtFirstMeasuredWeek/`, which matches the function's own
    // DEFINITION — so replacing the CALL SITE with `weeks.slice(0, 7)` left the
    // definition sitting there unused and the arm green. Assert the call, and
    // assert the absence of the hardcode: a literal week boundary is the thing
    // that rots the first time the engine changes the ramp.
    expect(src, 'the boundary must be derived AT THE CALL SITE, not just defined')
      .toMatch(/splitAtFirstMeasuredWeek\(weeks\)/)
    // ⚠️ AND THE FIRST VERSION OF *THIS* LINE CAUGHT ITSELF: the helper slices
    // with `weeks.slice(0, i)`, whose first argument is a literal. The thing
    // that is wrong is a literal BOUNDARY — a lone number, or a number as the
    // end index — not any numeral inside a slice.
    expect(src, 'a literal week index is a hardcoded boundary')
      .not.toMatch(/weeks\.slice\(\s*\d+\s*\)|weeks\.slice\([^)]*,\s*\d+\s*\)/)
    expect(src, 'the minutes section must explain itself').toMatch(/minutes, not kilometres/i)
  })

  it('draws the checkpoint as a door, not a target to clear', () => {
    // ⚕️ Sims, binding, almost verbatim: week N is where the plan gets built from
    // what you actually ran, WHICH MAY BE LESS. 🎓 Sierra: "this reader has spent
    // a lifetime not clearing hurdles."
    const src = code(readFileSync(join(ROOT, SOURCE), 'utf8'))
    expect(src, 'the checkpoint must say the plan is built from what was actually run')
      .toMatch(/what you actually ran/i)
    expect(src, '"which may be less" is the kindest thing on the page and must survive')
      .toMatch(/may be less/i)
    expect(src, 'the checkpoint week must be read off the plan, not typed')
      .toMatch(/checkpointWeek/)
  })

  it('does not render the engine\'s race bookkeeping', () => {
    // `raceWeeks` is how far the race sits past the checkpoint. It is the engine's
    // own arithmetic about a race the page may not mention, so rendering it is the
    // claim §116 Am.10 forbids. The field is exposed for the engine; this asserts
    // the page leaves it alone.
    const src = code(readFileSync(join(ROOT, SOURCE), 'utf8'))
    expect(src, 'raceWeeks on the page is the race claim in numeric form').not.toMatch(/raceWeeks/)
    expect(src, 'targetFound on the page invites a claim about a race').not.toMatch(/targetFound/)
  })
})
