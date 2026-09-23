// foundation-review-round.ts — the coaching round, through the path a RUNNER takes.
//
//   NODE_ENV=production npx tsx scripts/foundation-review-round.ts
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
// `coaching-review-round.ts` calls `generateRulePlan` and stops there. So does
// `envelopeMeasure.ts` (fit-for-purpose), `audit-plan-quality.ts` (coach
// objections) and `cohortGrid.ts` (population shape). None of them calls
// `composePlanWithFoundation`, which since ADR-020 is the single owner of
// `plan.weeks` mutation post-generation and the function `/api/generate-plan`
// actually calls.
//
// Consequence, and it is the reason the ops digest calls foundation weeks "the
// least-guarded part of the engine": FOUR of the five harnesses cannot see a
// foundation week at all. Every board round to date — including the 27 plans of
// 2026-09-20 that were ruled "proud to hand over" — reviewed plans that
// structurally could not contain one, while a real runner with a runway over
// 28 days gets a block composed onto the front of theirs.
//
// ⚠️ IT IS WORSE THAN "UNCHECKED". `INV-PLAN-UNCOVERED-RUNWAY-DECLARED` reads
// `meta.uncovered_runway_weeks`, a stamp only `composePlanWithFoundation`
// writes, and is deliberately SILENT when the stamp is absent (invariants.ts,
// "firing there would report the harness rather than the plan"). That silence
// is correct for an uncomposed plan and it means the rule reports CLEAN in
// every harness that never composes. A green board round was not evidence.
//
// The sweep (`property-validate-plans.ts`) is the one harness that does compose
// — 8,472 of 14,253 plans carry a block — and it finds no new violations. So
// this script is NOT filling a validation hole. It is filling a REVIEW hole:
// the sweep answers "is it legal", nobody has ever asked "would a coach hand
// this to a runner", because the board has never been shown one.
//
// ── WHAT IT DOES ───────────────────────────────────────────────────────────
// Every canonical case and persona × six runway gaps × three decisions, each
// generated with `today` explicitly passed (so generation and composition
// reason about one calendar — the INTENSITY-FOUNDATION-BLIND-02 defect) and
// then composed exactly as the route does. Reports the honesty stamps a
// foundation plan must carry, not just its violation count.
//
// Exits non-zero on any error-severity violation, or on a plan that leaves
// uncovered runway with no note.

import fs from 'node:fs'
import path from 'node:path'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { validatePlan } from '../lib/plan/invariants'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'
import { CANONICAL_CASES } from './generate-coaching-review'
import { PLAN_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { GeneratorInput } from '../types/plan'

const DATE = new Date().toISOString().slice(0, 10)
const outDir = path.resolve(__dirname, '..', 'coaching-review', DATE)

/** Runway gaps in days. Chosen to land one value in each band the engine
 *  classifies, plus two well past FOUNDATION_MAX_WEEKS where uncovered runway
 *  is unavoidable and the NOTE is the only thing standing between the runner
 *  and an uncoached void (§76). */
const GAPS = [0, 10, 24, 40, 90, 180]
const DECISIONS = ['add', 'skip', 'start_now'] as const

interface Row {
  id: string; distanceKm: number; gapDays: number; decision: string
  fbWeeks: number; uncovered: number | undefined; noteOK: boolean
  errors: number; warns: number; status: string; codes: string[]
}

const rows: Row[] = []
let hardFail = false

function shiftDate(iso: string, days: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() - days * 86_400_000)
    .toISOString().slice(0, 10)
}

function run(label: string, input: GeneratorInput, tier: 'free' | 'trial' | 'paid',
             planStart: string, gapDays: number, decision: typeof DECISIONS[number]) {
  // `today` is derived BEFORE generation and handed to BOTH sides. Deriving it
  // afterwards and giving it only to compose is INTENSITY-FOUNDATION-BLIND-02:
  // generation then believes no block is coming while one is built anyway.
  const today = shiftDate(planStart, gapDays)
  let plan
  try {
    plan = generateRulePlan(input, tier, planStart, undefined, today)
  } catch (e) {
    if (isDesignedRefusal(e)) {
      rows.push({ id: label, distanceKm: input.race_distance_km, gapDays, decision,
        fbWeeks: 0, uncovered: undefined, noteOK: true, errors: 0, warns: 0,
        status: '⛔ refused (by design)', codes: [] })
      return
    }
    hardFail = true
    rows.push({ id: label, distanceKm: input.race_distance_km, gapDays, decision,
      fbWeeks: 0, uncovered: undefined, noteOK: false, errors: 1, warns: 0,
      status: `💥 threw: ${String((e as Error)?.message ?? e).split('\n')[0].slice(0, 70)}`, codes: [] })
    return
  }

  const composed = composePlanWithFoundation(plan, input, today, decision)
  const p = composed.plan
  const v = validatePlan(p, input)
  const errors = v.filter(x => x.severity === 'error')
  const warns = v.filter(x => x.severity === 'warn')

  const fbWeeks = p.weeks.filter(w => w.n <= 0).length
  const uncovered = p.meta.uncovered_runway_weeks
  // The honesty condition the sweep does not phrase: uncovered runway at or
  // above the threshold MUST carry the note. §76 — a runner handed an
  // uncoached void fills it by guessing.
  const noteOK = !(typeof uncovered === 'number'
    && uncovered >= GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD
    && !p.meta.uncovered_runway_note)

  if (errors.length || !noteOK) hardFail = true
  rows.push({
    id: label, distanceKm: input.race_distance_km, gapDays, decision,
    fbWeeks, uncovered, noteOK, errors: errors.length, warns: warns.length,
    status: errors.length ? '❌ error' : !noteOK ? '🔇 silent void' : '✅',
    codes: Array.from(new Set(errors.map(e => e.code))),
  })
}

// ── the corpus ──────────────────────────────────────────────────────────────
for (const c of CANONICAL_CASES) {
  const planStart = (c.input as Record<string, unknown>).plan_start as string
    ?? CHARITY_PLAN_START
  for (const gap of GAPS) for (const d of DECISIONS) {
    run(c.id, c.input as GeneratorInput, c.tier as 'free' | 'trial' | 'paid', planStart, gap, d)
  }
}
for (const persona of PLAN_PERSONAS) {
  const input = { ...charityInput(persona), plan_start: CHARITY_PLAN_START } as GeneratorInput
  const label = persona.id.split(/[ ,]/)[0]
  for (const gap of GAPS) for (const d of DECISIONS) {
    run(label, input, 'paid', CHARITY_PLAN_START, gap, d)
  }
}

// ── report ──────────────────────────────────────────────────────────────────
const composedRows = rows.filter(r => !r.status.startsWith('⛔'))
const withBlock = composedRows.filter(r => r.fbWeeks > 0)
const errored = rows.filter(r => r.errors > 0)
const silent = rows.filter(r => !r.noteOK)
const refused = rows.filter(r => r.status.startsWith('⛔'))

const lines: string[] = []
lines.push(`# Foundation-composed review round — ${DATE}`)
lines.push('')
lines.push('Every canonical case and persona put through `composePlanWithFoundation`,')
lines.push('the function `/api/generate-plan` calls and that four of the five existing')
lines.push('harnesses never reach. **This is the first time the board round has seen a**')
lines.push('**foundation week.**')
lines.push('')
lines.push(`- plans attempted: **${rows.length}** (${GAPS.length} runway gaps × ${DECISIONS.length} decisions)`)
lines.push(`- generated and composed: **${composedRows.length}**`)
lines.push(`- carrying a foundation block: **${withBlock.length}**`)
lines.push(`- refused by design: **${refused.length}**`)
lines.push(`- error-severity violations: **${errored.length}**`)
lines.push(`- uncovered runway with NO note (§76 breach): **${silent.length}**`)
lines.push('')

if (errored.length) {
  lines.push('## ❌ Error-severity violations')
  lines.push('')
  lines.push('| case | km | gap | decision | fb wks | codes |')
  lines.push('|---|---|---|---|---|---|')
  for (const r of errored) {
    lines.push(`| ${r.id} | ${r.distanceKm} | ${r.gapDays}d | ${r.decision} | ${r.fbWeeks} | ${r.codes.join(', ')} |`)
  }
  lines.push('')
}
if (silent.length) {
  lines.push('## 🔇 Uncovered runway, no note')
  lines.push('')
  lines.push('| case | km | gap | decision | fb wks | uncovered wks |')
  lines.push('|---|---|---|---|---|---|')
  for (const r of silent) {
    lines.push(`| ${r.id} | ${r.distanceKm} | ${r.gapDays}d | ${r.decision} | ${r.fbWeeks} | ${r.uncovered} |`)
  }
  lines.push('')
}

// Coverage by gap — so a band that silently stopped producing blocks is visible
// rather than being read as "clean". A zero here is a REACH failure, not a pass.
lines.push('## Coverage by runway gap')
lines.push('')
lines.push('| gap | composed | with block | mean fb wks | uncovered>0 | errors |')
lines.push('|---|---|---|---|---|---|')
for (const g of GAPS) {
  const at = composedRows.filter(r => r.gapDays === g)
  const wb = at.filter(r => r.fbWeeks > 0)
  const mean = wb.length ? (wb.reduce((s, r) => s + r.fbWeeks, 0) / wb.length).toFixed(1) : '—'
  const unc = at.filter(r => (r.uncovered ?? 0) > 0).length
  lines.push(`| ${g}d | ${at.length} | ${wb.length} | ${mean} | ${unc} | ${at.filter(r => r.errors > 0).length} |`)
}
lines.push('')
lines.push('## Every plan')
lines.push('')
lines.push('| case | km | gap | decision | fb wks | uncovered | note | err | warn | status |')
lines.push('|---|---|---|---|---|---|---|---|---|---|')
for (const r of rows) {
  lines.push(`| ${r.id} | ${r.distanceKm} | ${r.gapDays}d | ${r.decision} | ${r.fbWeeks} | ${r.uncovered ?? '—'} | ${r.noteOK ? 'ok' : '**MISSING**'} | ${r.errors} | ${r.warns} | ${r.status} |`)
}

fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'foundation-composed-plans.md')
fs.writeFileSync(out, lines.join('\n'))

console.log(lines.slice(0, 60).join('\n'))
console.log(`\nWrote ${out}`)
if (hardFail) { console.error('\n✗ foundation round FAILED'); process.exit(1) }
console.log('\n✓ foundation round clean')
