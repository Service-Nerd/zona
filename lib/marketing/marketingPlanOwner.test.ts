// SITE-STAGED-PLAN-01 — one owner for generating a published plan.
//
// 🔴 THIS GATE EXISTS BECAUSE MY OWN CONSUMER CHECK HAD THE WRONG POPULATION.
// Moving the marketing surfaces onto `runEngine`, I grepped `lib/marketing`,
// `components/marketing` and `app/plans`, moved five call sites, and reported it
// done. **The full suite then failed in `lib/plan/marketingPlanShape.test.ts`** —
// a sixth site, in a directory I had not searched. Two more sat in `scripts/`.
//
// **A consumer check is only as wide as the directories it searches**, so this one
// walks the repository rather than a list of folders.
//
// WHY IT MATTERS, not just tidiness: `generateRulePlan` is the generator;
// `runEngine` is the entry point the product uses, and it STAGES a designed
// refusal into a base-build block instead of throwing. Handed a staged plan's
// input, the generator throws `LongRunReadinessError` and the build dies. Every
// published plan was a race plan until the tenth page, so the gap was invisible.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MARKETING_PLANS } from './plans'
import { DEMO_BLOCK } from './demoSurfaces'

const ROOT = process.cwd()
const SKIP = new Set(['node_modules', '.next', '.git', 'dist', 'coverage', '.claude'])

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e) || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p.slice(ROOT.length + 1))
  }
  return out
}

/** Comments are not code — this file names the thing it forbids. */
const code = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => ' '.repeat(m.length))
    .split('\n').map(l => (l.trim().startsWith('//') ? '' : l)).join('\n')

const OWNER = 'lib/marketing/marketingPlan.ts'
const SELF = 'lib/marketing/marketingPlanOwner.test.ts'

/** Files that name both symbols without generating a published plan from the
 *  list. ⚠️ Each carries the SHAPE that makes it safe, and the arm below
 *  re-checks that shape rather than trusting the entry — an exemption nobody
 *  re-reads is how a gate rots. */
const SAFE: Record<string, { why: string; proof: RegExp }> = {
  'lib/marketing/whenItNotices.test.ts': {
    why: 'asserts the SOURCE of WhenItNotices.tsx contains the call; it generates nothing itself',
    proof: /toContain\('generateRulePlan\('\)/,
  },
  'lib/plan/longRunDay.test.ts': {
    why: 'filters !p.staged before picking a plan, so it can never meet a staged entry',
    proof: /!p\.staged/,
  },
}

/** Files that generate from a SPECIFIC, named, non-staged slug. They cannot meet
 *  a staged plan, and routing them through the owner would be churn for no
 *  safety.
 *
 *  🔴 EACH ENTRY NAMES THE SLUG IT RESOLVES TO, AND THE ARM BELOW CHECKS BOTH
 *  HALVES — because the first version checked neither usefully. It scraped
 *  kebab-case string literals out of the file and asserted none was staged, which
 *  is **vacuous for `demoPlanScreen.ts`: that file holds no slug literal at all**
 *  (it reads `DEMO_BLOCK.slug` from `demoSurfaces.ts`), so `hits` was always
 *  empty and the arm passed on an empty population. The exemption that most
 *  needed checking was the one the check could not see.
 *
 *  So an entry declares `expr` — how the file names its slug, which must still be
 *  present — and `slug`, the value that expression resolves to, which must still
 *  be a real, non-staged entry in `MARKETING_PLANS`. */
const FIXED_SLUG: Record<string, { why: string; resolve: (src: string) => string | null }> = {
  'lib/marketing/demoPlanScreen.ts': {
    why: 'reads DEMO_BLOCK.slug — the device still’s own block',
    resolve: src => (/DEMO_BLOCK\.slug/.test(src) ? DEMO_BLOCK.slug : null),
  },
  'components/marketing/SameWeekTwice.tsx': {
    why: 'reads its own SOURCE_SLUG constant',
    resolve: sourceSlugConst,
  },
  'components/marketing/WhenItNotices.tsx': {
    why: 'reads its own SOURCE_SLUG constant',
    resolve: sourceSlugConst,
  },
}

/** ⚠️ DERIVED FROM THE FILE, NEVER TYPED HERE. Writing the slug into this table
 *  would be a second copy of it: I typed `marathon-16-week` for `WhenItNotices`
 *  on the first pass and the real constant is `half-marathon-12-week`. A table
 *  that restates what the file says is a table that can disagree with it. */
function sourceSlugConst(src: string): string | null {
  return src.match(/const SOURCE_SLUG = '([^']+)'/)?.[1] ?? null
}

describe('SITE-STAGED-PLAN-01 — published plans generate through one owner', () => {
  const files = walk(ROOT).filter(f => f !== OWNER && f !== SELF)

  it('is walking the repository, not a folder list', () => {
    // The guard that would have caught my own miss: if this ever stops seeing
    // `lib/plan` or `scripts`, the arm below is blind exactly where it was.
    expect(files.length).toBeGreaterThan(500)
    expect(files.some(f => f.startsWith('lib/plan/'))).toBe(true)
    expect(files.some(f => f.startsWith('scripts/'))).toBe(true)
    expect(files.some(f => f.startsWith('components/marketing/'))).toBe(true)
  })

  it('nothing reaches the published list and calls generateRulePlan', () => {
    // 🔴 THE POPULATION WAS `MARKETING_PLANS` AS A LITERAL, AND CODE REVIEW
    // FALSIFIED IT: a file doing `getPlan('5k-12-week')` + `generateRulePlan` never
    // types that name, so it escaped — and that is the exact shape this item just
    // removed from `planFacts.ts` and `page7Claims.test.ts`. **The list is reached
    // through its MODULE, not through one of its exports**, so the signal is the
    // import. Anything importing the published-plans module and calling the
    // generator is generating a published plan, whichever accessor it uses.
    const IMPORTS_PLANS = /from\s+'(?:@\/lib\/marketing\/plans|\.{1,2}\/(?:lib\/marketing\/)?plans)'/
    const offenders = files.filter(f => {
      if (FIXED_SLUG[f] || SAFE[f]) return false
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      return IMPORTS_PLANS.test(src) && src.includes('generateRulePlan(')
    })
    expect(
      offenders,
      'These generate a published plan with the GENERATOR rather than the engine '
      + 'the product runs. `generateRulePlan` throws for a staged page. Use '
      + '`generateMarketingPlan` from lib/marketing/marketingPlan.ts:\n  '
      + offenders.join('\n  '),
    ).toEqual([])
  })

  it('every SAFE exemption still has the shape that makes it safe', () => {
    for (const [f, { why, proof }] of Object.entries(SAFE)) {
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      expect(proof.test(src), `${f} is exempt because it ${why} — and that is no longer true`).toBe(true)
    }
  })

  it('every fixed-slug exemption still names its slug, and that slug is a race plan', () => {
    // ⚠️ An exemption that stops being true is worse than no exemption, and one
    // whose check runs on an empty population is worse again — it reads green.
    for (const [f, { why, resolve }] of Object.entries(FIXED_SLUG)) {
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      const slug = resolve(src)
      expect(slug,
        `${f} is exempt because it ${why}, and no longer names its slug that way`).not.toBeNull()
      const entry = MARKETING_PLANS.find(p => p.slug === slug)
      expect(entry, `${f} resolves to slug "${slug}", which is not a published plan`).toBeDefined()
      expect(entry?.staged,
        `${f} (${why}) now resolves to the STAGED plan "${slug}" — `
        + '`generateRulePlan` throws for it. Route this file through `generateMarketingPlan`').toBeFalsy()
    }
  })
})
