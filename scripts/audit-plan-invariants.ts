// I1–I10 — the published-plan shape audit (MKT-PLAN-SHAPE-01, 2026-09-21).
//
// `npm run audit:plan-shape`. Measures the nine published /plans/* pages against
// the ten shape invariants proposed in the 2026-09-21 coaching-logic brief, then
// reports the easy share by TIME for each plan (the number the carousel covers
// quote, so it has to come from the engine and not from a spreadsheet).
//
// ⚠️ THIS IS A MEASUREMENT SCRIPT, NOT THE GATE. The gate is
// `lib/plan/marketingPlanShape.test.ts`, which runs the SAME predicates from
// `lib/plan/planShapeInvariants.ts` inside `npm run verify`. A script you have
// to remember to type is a check that does not run — this repo has recorded
// that three times (the liveness debt, decorative config, the eslint rule that
// was installed and never configured). This script exists for the readable
// per-week table; the test exists so a regression fails the build.

import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { checkPlanShape, easySharePctByTime, weekRows } from '@/lib/plan/planShapeInvariants'

const args = new Set(process.argv.slice(2))
const quiet = args.has('--quiet')

let violations = 0
const tally = new Map<string, number>()
const shares: { slug: string; pct: number }[] = []

for (const p of MARKETING_PLANS) {
  const { planStart, raceDate } = planAnchor(p.dayOffset)
  const plan = generateRulePlan(p.input(raceDate) as any, 'free', planStart)
  const findings = checkPlanShape(plan as any)
  const share = easySharePctByTime(plan as any)
  shares.push({ slug: p.slug, pct: share })

  if (!quiet) {
    console.log(`\n## ${p.slug}  —  easy share ${share.toFixed(1)}% by time`)
    for (const r of weekRows(plan as any)) {
      console.log(
        String(r.n).padStart(2),
        r.phase.padEnd(5),
        (r.deload ? 'R' : r.race ? '*' : ' '),
        String(r.weeklyKm).padStart(4) + ' km',
        '| easy', JSON.stringify(r.easyKm),
        '| long', r.longKm ?? '-',
        '| quality', JSON.stringify(r.qualityKm),
      )
    }
  }

  violations += findings.filter(f => f.gate).length
  for (const f of findings) {
    console.log(`  ${f.gate ? 'GATE    ' : 'advisory'}  ${f.id.padEnd(4)} w${String(f.weekN).padStart(2)}  ${f.message}`)
    if (f.conflictsWith) console.log(`            ↳ conflicts with ${f.conflictsWith}`)
    const k = `${f.id}|${f.gate}`
    tally.set(k, (tally.get(k) ?? 0) + 1)
  }
  if (!findings.length) console.log('  ✅ I1–I10 clean')
}

console.log('\n## Easy share by time (post-engine, the carousel number)')
for (const s of shares.sort((a, b) => a.pct - b.pct)) {
  console.log(' ', s.slug.padEnd(32), s.pct.toFixed(1) + '%')
}

console.log('\n## Tally')
for (const [k, n] of Array.from(tally).sort()) {
  const [id, gate] = k.split('|')
  console.log(' ', id.padEnd(5), gate === 'true' ? 'GATE    ' : 'advisory', String(n).padStart(3))
}
console.log(`\n${violations} GATING violation${violations === 1 ? '' : 's'} across ${MARKETING_PLANS.length} plans (advisories are measured, not gated)`)
process.exit(violations > 0 ? 1 : 0)
