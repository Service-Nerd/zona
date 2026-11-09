// coaching-review-round.ts — open a dated coaching-review round, both sets.
//
// The trigger for a PROACTIVE coaching review used to be "someone remembers"
// (README: "roughly monthly") and it went dormant. This script is the GENERATE
// step of that loop, modernised: it runs BOTH the 4 canonical cases
// (CANONICAL_CASES, from generate-coaching-review.ts) AND the 11 charity
// personas (PLAN_PERSONAS -- charity AND engine), generates a real plan for each, runs validatePlan
// on it, writes a dated packet, and exits non-zero if any plan breaks its own
// constitution. The REVIEW step is the Coaching Board skill (/coaching-board),
// which supersedes the manual "senior coach" reviewer the folder was built around.
//
// It is wired to fire in CI whenever a coaching-doctrine file ships to main
// (.github/workflows/coaching-review-trigger.yml) — so a round is PROMPTED the
// moment doctrine changes, not when someone remembers.
//
// Run: NODE_ENV=production npx tsx scripts/coaching-review-round.ts

import fs from 'node:fs'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'
import path from 'node:path'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { CANONICAL_CASES, renderCase, type Case } from './generate-coaching-review'
import { violationBlock, tallyByCode, renderTally, tallyMatches, type CaseViolations } from '../lib/plan/violationReport'
import { PLAN_PERSONAS, charityInput, CHARITY_PLAN_START, type CharityPersona } from '../lib/plan/charityCohort'
import type { GeneratorInput } from '../types/plan'

const DATE = new Date().toISOString().slice(0, 10)
const outDir = path.resolve(__dirname, '..', 'coaching-review', DATE)

function charityToCase(p: CharityPersona): Case {
  return {
    id: p.id.split(/[ ,]/)[0].toLowerCase(),
    title: p.id,
    persona: `Charity cohort — ${p.note}`,
    tier: 'paid',
    input: { ...charityInput(p), plan_start: CHARITY_PLAN_START } as any,
    questions: [
      'Is this plan fit for a charity first-timer of this profile (low base, injury/masters as applicable)?',
      `Doctrine stressed: ${p.note}`,
    ],
  }
}

interface Row { id: string; distanceKm: number; errors: number; warns: number; status: string }

const rows: Row[] = []
const packets: string[] = []
// COACHING-ROUND-WARNS-BLIND-01 — the verdicts themselves, not just their count.
// The tally is built from THIS, never from `Row.warns`, so removing one warn
// from one case moves it.
const verdicts: CaseViolations[] = []
let hardFail = false

function run(label: string, input: GeneratorInput, tier: 'free' | 'trial' | 'paid', planStart: string,
             renderAs: Case, expectRefusal = false) {
  try {
    const plan = generateRulePlan(input, tier, planStart)
    const v = validatePlan(plan, input)
    const errors = v.filter(x => x.severity === 'error')
    const warns = v.filter(x => x.severity === 'warn')
    if (expectRefusal) {
      // Expected a refusal, got a plan — the honesty guard weakened.
      hardFail = true
      rows.push({ id: label, distanceKm: input.race_distance_km, errors: errors.length, warns: warns.length, status: '⚠ expected refusal, generated' })
    } else {
      if (errors.length) hardFail = true
      rows.push({ id: label, distanceKm: input.race_distance_km, errors: errors.length, warns: warns.length, status: errors.length ? '❌ error' : '✅' })
    }
    verdicts.push({ label, violations: v })
    // Both severities in full, appended to the case's own packet (a separate
    // `packets` entry would emit a stray `---` for a clean case). The warns are
    // what the summary asks the board to weigh, and until 2026-11-09 they were
    // a number in a table and nothing else.
    packets.push(renderCase(renderAs, plan)
      + violationBlock('ERROR VIOLATIONS', errors)
      + violationBlock("WARNS — the board's to weigh", warns))
  } catch (e: any) {
    const msg = String(e?.message ?? e).split('\n')[0]
    const refusal = isDesignedRefusal(e)   // REFUSAL-COPY-02 — type, not wording
    if (expectRefusal && refusal) {
      rows.push({ id: label, distanceKm: input.race_distance_km, errors: 0, warns: 0, status: '⛔ refused (by design)' })
    } else {
      hardFail = true
      rows.push({ id: label, distanceKm: input.race_distance_km, errors: 1, warns: 0, status: `💥 ${msg}` })
    }
    packets.push(`# ${renderAs.title}\n\n${refusal ? '⛔ BY-DESIGN REFUSAL' : '💥 THREW'}: ${msg}\n`)
  }
}

// Canonical cases (4)
for (const c of CANONICAL_CASES) {
  run(c.title, c.input as any, c.tier, (c.input as any).plan_start ?? '2026-04-27', c)
}
// Charity personas (11)
// ⚠️ PLAN_PERSONAS, NOT CHARITY_PERSONAS — the review must see every persona.
// PERSONA-CORPUS-01 (2026-09-19) added six ENGINE personas (E1-E6) for the
// cells no grid can construct, then derived `CHARITY_PERSONAS` as everything
// EXCEPT them. This loop still read the narrower list, so the six personas
// added that day because nothing else could reach them were invisible to the
// one review a coaching seat actually reads -- including E6, the ONLY 50K
// ultra in the round (the rest is 5K/10K/HM/marathon).
for (const p of PLAN_PERSONAS) {
  run(p.id, charityInput(p), 'paid', CHARITY_PLAN_START, charityToCase(p), p.expectRefusal)
}

// ── Write the round ──────────────────────────────────────────────────────────
fs.mkdirSync(outDir, { recursive: true })

// COACHING-ROUND-WARNS-BLIND-01 — the frequency table, so a warn firing in six
// cases reads as ONE pattern rather than six numbers in six rows.
const warnTally = tallyByCode(verdicts, 'warn')
const errorTally = tallyByCode(verdicts, 'error')

// ⚠️ A tally that disagrees with the counts printed beside it is unweighable in
// exactly the way this change exists to fix, so it is a hard failure, not a note.
const tallyOK = tallyMatches(warnTally, rows.map(r => r.warns))
  && tallyMatches(errorTally, rows.filter(r => !r.status.startsWith('💥')).map(r => r.errors))
if (!tallyOK) hardFail = true

const summary = [
  `# Coaching review round — ${DATE}`,
  '',
  `Generated by \`scripts/coaching-review-round.ts\` (both sets: ${CANONICAL_CASES.length} canonical + ${PLAN_PERSONAS.length} charity + engine).`,
  '**REVIEW PENDING** — run \`/coaching-board\` over \`generated-plans.md\`, then fill this file with the ruling and open \`backlog.md\`.',
  '',
  '## Validation summary',
  '',
  '| Case | Distance | Errors | Warns | Status |',
  '|---|---|---|---|---|',
  ...rows.map(r => `| ${r.id} | ${r.distanceKm}km | ${r.errors} | ${r.warns} | ${r.status} |`),
  '',
  hardFail && !tallyOK
    ? '> ❌ The warn tally does not account for every warn counted above — the packet cannot be weighed. This is a bug in the round, not in a plan.'
    : hardFail
    ? '> ❌ At least one plan errored or an honesty guard weakened — a doctrine change may have broken a case. Investigate before the board sits.'
    : '> ✅ Every case generated with 0 error violations, or refused by design. Warns are the board\'s to weigh — **every one of them is written out below, by code, week and message.**',
  '',
  ...renderTally(errorTally, 'Error codes, by frequency'),
  ...renderTally(warnTally, 'Warn codes, by frequency'),
].join('\n')

fs.writeFileSync(path.join(outDir, 'generated-plans.md'), summary + '\n\n---\n\n' + packets.join('\n\n---\n\n'))
// Seed the review stub only if a human/board hasn't already written one.
const reviewPath = path.join(outDir, 'review.md')
if (!fs.existsSync(reviewPath)) fs.writeFileSync(reviewPath, summary)

console.log(summary)
console.log(`\nWrote ${outDir}/generated-plans.md`)
process.exit(hardFail ? 1 : 0)
