// plan-rules-report.ts — the founder-readable "do the plans obey the rules?" report.
//
// WHY THIS EXISTS, given `npm run verify` already passes. `verify` answers
// "did anything break?" in the engine's own vocabulary — invariant codes, sweep
// counts, cohort rates. It does not answer the question an owner actually asks
// before putting plans in front of real runners: *does volume really step up by
// no more than 10% a week, is there really a recovery week on the cadence, do
// quality sessions really appear, and do the wizard's answers really change the
// plan?* Those are four named rules and this prints them, per plan, in words.
//
// Every threshold is READ FROM CONFIG, never retyped — a report that hardcodes
// 10 would keep saying "pass" the day someone changes the rule to 8.
//
// Run: NODE_ENV=production npx tsx scripts/plan-rules-report.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { GENERATION_CONFIG as G } from '../lib/plan/generationConfig'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { isVo2maxSession } from '../lib/plan/sessionRole'
import { V1_SESSION_CATALOGUE } from '../lib/plan/sessionCatalogueData'
import type { GeneratorInput, Plan, Session } from '../types/plan'

const RAMP_CAP = G.MAX_WEEKLY_VOLUME_INCREASE_PCT
const INJURY_CAP = G.INJURY_WEEKLY_INCREASE_CAP_PCT
const DELOAD_STD = G.RECOVERY_WEEK_FREQUENCY_STANDARD
const DELOAD_MASTERS = G.RECOVERY_WEEK_FREQUENCY_MASTERS
const MASTERS_AGE = G.MASTERS_AGE_THRESHOLD

interface Finding { rule: string; detail: string }

const mainWeeks = (p: Plan) => p.weeks.filter(w => w.n >= 1)
const isDeload = (w: Plan['weeks'][number]) => w.type === 'deload' || w.badge === 'deload'
const qualityOf = (p: Plan): Session[] =>
  mainWeeks(p).flatMap(w => Object.values(w.sessions)).filter((s): s is Session => !!s && s.type === 'quality')

/**
 * RULE 1 — §2: volume may not rise more than N% week on week.
 *
 * ⚠️ §2 GOVERNS THE VOLUME CURVE, NOT THE DELIVERED WEEK. `buildVolumeSequence`
 * enforces the cap on the curve; the runner then runs PLACED SESSIONS, and
 * those diverge — ADR-022 established exactly that, scoped its remedy to
 * injury-history runners, and left the healthy residual as an HONEST WARN
 * (`INV-PLAN-DELIVERED-RAMP`, §94, firing ~5% of the swept population).
 *
 * So a delivered step above the cap is REPORTED, not failed. The first cut of
 * this report failed it and produced 63 "problems" on plans the board has
 * explicitly ratified — a report that cries wolf is worse than no report.
 * The FAIL authority stays with `validatePlan`; this function is the
 * human-readable view of the same numbers.
 */
function checkRamp(p: Plan, input: GeneratorInput): { info: Finding[] } {
  const injured = (input.injury_history ?? []).length > 0
  const cap = injured ? INJURY_CAP : RAMP_CAP
  const info: Finding[] = []
  const ws = mainWeeks(p)
  for (let i = 1; i < ws.length; i++) {
    const prev = ws[i - 1], cur = ws[i]
    // A bounce-back FROM a deload is §3's recovery being undone and is governed
    // by INV-PLAN-BOUNCEBACK-BOUNDED, not by §2.
    if (isDeload(prev) || isDeload(cur)) continue
    if (cur.phase === 'taper' || cur.type === 'race') continue
    const a = prev.weekly_km ?? 0, b = cur.weekly_km ?? 0
    if (a <= 0) continue
    const pct = ((b - a) / a) * 100
    if (pct > cap + 0.5) {
      info.push({ rule: `delivered step > ${cap}% (§94 warn, curve is capped)`,
                  detail: `wk${prev.n}→${cur.n}: ${a}→${b} km = +${pct.toFixed(1)}%` })
    }
  }
  return { info }
}

/** RULE 2 — §3/§87/§95: a recovery week on the cadence, correctly placed. */
function checkDeload(p: Plan, input: GeneratorInput): Finding[] {
  const freq = (input.age ?? 0) >= MASTERS_AGE ? DELOAD_MASTERS : DELOAD_STD
  const out: Finding[] = []
  const ws = mainWeeks(p)
  const deloads = ws.filter(isDeload).map(w => w.n)
  // In scope = weeks that can legally hold one (peak/taper never deload).
  const inScope = ws.filter(w => w.phase !== 'peak' && w.phase !== 'taper')
  if (inScope.length >= freq && deloads.length === 0) {
    out.push({ rule: `§3 recovery every ${freq}th week`, detail: `${inScope.length} eligible weeks and NO recovery week at all` })
  }
  // §87/§95 re-anchor the cadence around phase boundaries, so the gap is not a
  // fixed modulo. What must hold: never two in a row, and never a loading run
  // longer than the cadence promises.
  for (let i = 1; i < deloads.length; i++) {
    if (deloads[i] - deloads[i - 1] === 1) {
      out.push({ rule: '§87/§95 no adjacent recovery weeks', detail: `wk${deloads[i - 1]} and wk${deloads[i]} back to back` })
    }
  }
  let run = 0
  for (const w of inScope) {
    if (isDeload(w)) run = 0
    else if (++run > freq) {
      out.push({ rule: `§3 loading run ≤ ${freq}`, detail: `${run} consecutive loading weeks by wk${w.n}` })
      break
    }
  }
  return out
}

/** RULE 3 — §8: quality count is capped by fitness, and 0 for a true beginner. */
function checkQuality(p: Plan): Finding[] {
  const level = (p.meta.fitness_intensity_level ?? p.meta.fitness_level) as keyof typeof G.QUALITY_SESSIONS_PER_WEEK_MAX
  const ceiling = G.QUALITY_SESSIONS_PER_WEEK_MAX[level] ?? 0
  const out: Finding[] = []
  for (const w of mainWeeks(p)) {
    const n = Object.values(w.sessions).filter(s => s?.type === 'quality').length
    if (n > ceiling) out.push({ rule: `§8 ≤ ${ceiling} quality/week (${level})`, detail: `wk${w.n} has ${n}` })
  }
  return out
}

/** RULE 4 — §53: the quality sessions must VARY, not repeat one row. */
function checkVariety(p: Plan): Finding[] {
  const q = qualityOf(p)
  if (q.length < 3) return []
  const ids = q.map(s => s.catalogue_id ?? s.label ?? '?')
  const counts = new Map<string, number>()
  ids.forEach(i => counts.set(i, (counts.get(i) ?? 0) + 1))
  const worst = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
  const cap = Math.floor(q.length / 3) + 1
  return worst[1] > cap
    ? [{ rule: `§53 variety (≤ ${cap} of ${q.length})`, detail: `"${worst[0]}" appears ${worst[1]}×` }]
    : []
}

function report(label: string, input: GeneratorInput, tier: 'free' | 'trial' | 'paid' = 'paid') {
  let plan: Plan
  try { plan = generateRulePlan(input, tier, CHARITY_PLAN_START, undefined, CHARITY_PLAN_START) }
  catch (e) { console.log(`${label.padEnd(44)} REFUSED — ${(e as Error).message.split('\n')[0].slice(0, 60)}`); return 0 }

  const ramp = checkRamp(plan, input)
  const findings = [...checkDeload(plan, input), ...checkQuality(plan), ...checkVariety(plan)]
  const all = validatePlan(plan, input)
  const errors = all.filter(v => v.severity === 'error')
  const warns = all.filter(v => v.severity === 'warn')
  const q = qualityOf(plan)
  const deloads = mainWeeks(plan).filter(isDeload).map(w => w.n)
  const distinct = new Set(q.map(s => s.catalogue_id ?? s.label)).size
  const peak = Math.max(...mainWeeks(plan).map(w => w.weekly_km ?? 0))
  const sharp = q.filter(s => isVo2maxSession(s, V1_SESSION_CATALOGUE)).length

  const status = findings.length === 0 && errors.length === 0 ? 'OK ' : 'FAIL'
  console.log(
    `${status} ${label.padEnd(42)} peak ${String(peak).padStart(3)}km  ` +
    `deloads [${deloads.join(',') || '-'}]  quality ${String(q.length).padStart(2)} (${distinct} distinct, ${sharp} vo2max)` +
    (warns.length ? `  · ${warns.length} warn` : ''))
  for (const f of findings) console.log(`      ✗ ${f.rule} — ${f.detail}`)
  for (const f of ramp.info) console.log(`      · ${f.rule} — ${f.detail}`)
  for (const e of errors) console.log(`      ✗ ${e.code}: ${e.message.slice(0, 110)}`)
  return findings.length + errors.length
}

console.log('PLAN RULES REPORT — thresholds read from GENERATION_CONFIG, not retyped')
console.log(`  §2 ramp cap ${RAMP_CAP}% (injured ${INJURY_CAP}%) · §3 cadence ${DELOAD_STD} (masters ${DELOAD_MASTERS}, age ≥ ${MASTERS_AGE})`)
console.log(`  §8 quality/week ceiling ${JSON.stringify(G.QUALITY_SESSIONS_PER_WEEK_MAX)}\n`)

let problems = 0

console.log('── CHARITY COHORT (the runners the charity will send) ──')
for (const p of CHARITY_PERSONAS) {
  problems += report(p.id.slice(0, 40), { ...charityInput(p), plan_start: CHARITY_PLAN_START } as GeneratorInput)
}

console.log('\n── WIZARD INPUTS MUST CHANGE THE PLAN (§79, §8, §21) ──')
const base = { ...charityInput(CHARITY_PERSONAS.find(p => p.id.startsWith('H2'))!), plan_start: CHARITY_PLAN_START } as GeneratorInput
const variants: Array<[string, Partial<GeneratorInput>]> = [
  ['baseline', {}],
  ['declares intermediate', { user_declared_level: 'intermediate' }],
  ['declares beginner (down)', { user_declared_level: 'beginner' }],
  ['3 days/week', { days_available: 3 }],
  ['6 days/week', { days_available: 6 }],
  ['knee injury history', { injury_history: ['knee'] }],
  ['avoids hard sessions', { hard_session_relationship: 'avoid' }],
  ['weekday cap 30 min', { max_weekday_mins: 30 }],
]
const shapes = new Map<string, string>()
for (const [name, patch] of variants) {
  const input = { ...base, ...patch } as GeneratorInput
  problems += report(name, input)
  try {
    const p = generateRulePlan(input, 'paid', CHARITY_PLAN_START, undefined, CHARITY_PLAN_START)
    // A FULL digest, not just quality ids + peak. The first cut compared only
    // those two and reported "inputs are not reaching the plan" because
    // `days_available` changes the number of EASY runs without changing either
    // — a narrow signature manufacturing a false alarm.
    shapes.set(name, JSON.stringify(mainWeeks(p).map(w => ({
      n: w.n, km: w.weekly_km, d: w.type,
      s: Object.entries(w.sessions).map(([day, sn]) => [day, sn?.type, sn?.label, sn?.distance_km]),
    }))))
  } catch { shapes.set(name, 'refused') }
}
// EXPECTED EQUIVALENCES, listed with a reason — the debt-register pattern.
//
// The first cut asserted "every variant must differ" and flagged three that are
// identical BY DESIGN on this persona. An alarm that fires on correct behaviour
// trains you to ignore it, so the equivalences are named and anything OUTSIDE
// the list is a real finding.
const EXPECTED_IDENTICAL: Record<string, string> = {
  'declares intermediate':
    "H2's ASSESSED level is already intermediate — declaring what you already are is a no-op by design (§79)",
  'knee injury history':
    "H2 already carries shin_splints, and ADR-022 treats knee and shin_splints as the same volume-capped class",
}

const distinctShapes = new Set(shapes.values()).size
console.log(`\n  distinct plan shapes across ${shapes.size} wizard variants: ${distinctShapes}`)
const baselineSig = shapes.get('baseline')
for (const [name, sig] of Array.from(shapes.entries())) {
  if (name === 'baseline') continue
  if (sig !== baselineSig) { console.log(`  ✓ ${name} — changes the plan`); continue }
  const why = EXPECTED_IDENTICAL[name]
  if (why) { console.log(`  = ${name} — identical to baseline, expected: ${why}`) }
  else {
    console.log(`  ✗ ${name} — produced an IDENTICAL plan to baseline; this wizard input is not reaching the engine`)
    problems++
  }
}

console.log(problems === 0
  ? '\n✅ ALL RULES HOLD on every plan above.'
  : `\n❌ ${problems} rule problem(s) — see ✗ lines.`)
process.exit(problems === 0 ? 0 : 1)
