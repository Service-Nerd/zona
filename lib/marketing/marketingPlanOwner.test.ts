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
 *  safety. ⚠️ The arm below checks each one's slug is still non-staged, so the
 *  exemption cannot rot the day someone repoints a constant. */
const FIXED_SLUG: Record<string, string> = {
  'lib/marketing/demoPlanScreen.ts': 'reads DEMO_BLOCK.slug — the device still’s own block',
  'components/marketing/SameWeekTwice.tsx': 'reads its own SOURCE_SLUG constant',
  'components/marketing/WhenItNotices.tsx': 'reads its own SOURCE_SLUG constant',
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

  it('nothing iterates MARKETING_PLANS and calls generateRulePlan', () => {
    const offenders = files.filter(f => {
      if (FIXED_SLUG[f] || SAFE[f]) return false
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      if (!src.includes('MARKETING_PLANS') || !src.includes('generateRulePlan(')) return false
      // A `.find(...)` on a literal slug is the fixed-slug shape and is handled
      // above by name; anything else is iterating the published list.
      return true
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

  it('every fixed-slug exemption still points at a non-staged plan', () => {
    // ⚠️ An exemption that stops being true is worse than no exemption. These
    // files are safe only because their slug is a race plan.
    const stagedSlugs = new Set(MARKETING_PLANS.filter(p => p.staged).map(p => p.slug))
    expect(stagedSlugs.size).toBeGreaterThan(0)
    for (const [f, why] of Object.entries(FIXED_SLUG)) {
      const src = code(readFileSync(join(ROOT, f), 'utf8'))
      const slugs = Array.from(src.matchAll(/'([a-z0-9]+(?:-[a-z0-9]+)+)'/g)).map(m => m[1])
      const hits = slugs.filter(s => stagedSlugs.has(s))
      expect(hits, `${f} (${why}) now names a STAGED slug: ${hits.join(', ')}`).toEqual([])
    }
  })
})
