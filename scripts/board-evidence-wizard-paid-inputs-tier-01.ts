/**
 * `WIZARD-PAID-INPUTS-TIER-01` — SLT evidence, 2026-11-20. READ-ONLY (generates plans in memory only).
 *
 * Re-derives the 2026-10-28 table ("2,000 cohort inputs, each answer against no answer") and splits the
 * item's single "sessions change" column in two, because the SLT's question (safety or richness?) turns
 * on WHAT changes, not whether anything does:
 *
 *   prescription  — a session's type, catalogue row, distance, duration, zone or pace target, or a week's km
 *   session copy  — a session's coach_notes only
 *   plan notes    — any plan-level `meta.*_note` / meta flag
 *
 * Sample: `cohortGrid()` (the wizard's production shape) walked by a stride coprime to its 2^9 x 3^4 size,
 * so the 2,000 are spread across every axis (an even stride aliases this grid). The grid pins
 * `hard_session_relationship: 'neutral'`; "no answer" deletes the field, as a free runner's payload does.
 * Generated at BOTH tiers to show the engine does not read the tier for either field.
 *
 * Run: npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01.ts          (cohort, ~65s)
 *      npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01.ts --live   (production SELECT only)
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START, isDesignedRefusal } from '../lib/plan/cohortGrid'
import type { GeneratorInput, Plan } from '../types/plan'

async function live() {
  loadEnvConfig(process.cwd())
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data, error } = await db.from('plans').select('user_id, plan_json')
  if (error) throw new Error(error.message)
  const hsr: Record<string, number> = {}, ter: Record<string, number> = {}
  let withInput = 0
  const users = new Set<string>()
  for (const p of data ?? []) {
    const gi = (p.plan_json as any)?.meta?.generator_input
    if (!gi) continue
    withInput++; users.add(p.user_id)
    const h = gi.hard_session_relationship ?? '(absent)'; hsr[h] = (hsr[h] ?? 0) + 1
    const t = gi.terrain ?? '(absent)'; ter[t] = (ter[t] ?? 0) + 1
  }
  console.log(`LIVE: ${(data ?? []).length} plans, ${withInput} carry generator_input (${users.size} users)`)
  console.log('hard_session_relationship:', hsr)
  console.log('terrain:', ter)
}
if (process.argv.includes('--live')) { live().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) }) }
else main()

function main() {
const N = 2000
const STRIDE = 23 // coprime to 41,472 = 2^9 * 3^4
const grid = cohortGrid()
const sample: GeneratorInput[] = []
for (let i = 0; i < N; i++) sample.push(grid[(i * STRIDE) % grid.length])

const prescription = (p: Plan) => JSON.stringify(p.weeks.map(w => [w.n, w.weekly_km, w.type, w.phase,
  Object.entries(w.sessions).map(([d, s]: [string, any]) => [d, s?.type, s?.catalogue_id, s?.label, s?.distance_km,
    s?.duration_mins, s?.zone, s?.pace_target])]))
const sessionCopy = (p: Plan) => JSON.stringify(p.weeks.map(w =>
  Object.entries(w.sessions).map(([d, s]: [string, any]) => [d, s?.coach_notes])))
const planNotes = (p: Plan) => {
  const m = { ...(p.meta as any) }
  delete m.generator_input; delete m.generated_at
  // the field itself is echoed into meta; that echo is not an effect
  delete m.hard_session_relationship; delete m.terrain
  return JSON.stringify(m)
}

type Variant = { label: string, apply: (i: any) => any }
const strip = (i: any) => { const o = { ...i }; delete o.hard_session_relationship; delete o.terrain; return o }
const VARIANTS: Variant[] = [
  { label: 'hard sessions: overdo', apply: i => ({ ...strip(i), hard_session_relationship: 'overdo' }) },
  { label: 'hard sessions: avoid', apply: i => ({ ...strip(i), hard_session_relationship: 'avoid' }) },
  { label: 'hard sessions: love', apply: i => ({ ...strip(i), hard_session_relationship: 'love' }) },
  { label: 'hard sessions: neutral', apply: i => ({ ...strip(i), hard_session_relationship: 'neutral' }) },
  { label: 'terrain: trail', apply: i => ({ ...strip(i), terrain: 'trail' }) },
  { label: 'terrain: mixed', apply: i => ({ ...strip(i), terrain: 'mixed' }) },
  { label: 'terrain: road', apply: i => ({ ...strip(i), terrain: 'road' }) },
]

function gen(i: any, tier: 'free' | 'paid'): Plan | null {
  try { return generateRulePlan(i as GeneratorInput, tier, COHORT_PLAN_START) as Plan }
  catch (e) { if (isDesignedRefusal(e)) return null; throw e }
}

const pct = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : '-'

for (const tier of ['free', 'paid'] as const) {
  const base = sample.map(i => gen(strip(i), tier))
  const built = base.filter(Boolean).length
  console.log(`\n## tier=${tier} — ${N} sampled inputs, ${built} built (${N - built} designed refusals)`)
  console.log('| answer | prescription changes | session copy only | any session change | plan notes change | no change |')
  console.log('|---|---|---|---|---|---|')
  for (const v of VARIANTS) {
    let pr = 0, copyOnly = 0, anySess = 0, notes = 0, none = 0, n = 0, refuseFlip = 0
    sample.forEach((raw, k) => {
      const b = base[k]
      const p = gen(v.apply(raw), tier)
      if (!b || !p) { if (!!b !== !!p) refuseFlip++; return }
      n++
      const dPr = prescription(b) !== prescription(p)
      const dCopy = sessionCopy(b) !== sessionCopy(p)
      const dNotes = planNotes(b) !== planNotes(p)
      if (dPr) pr++
      if (!dPr && dCopy) copyOnly++
      if (dPr || dCopy) anySess++
      if (dNotes) notes++
      if (!dPr && !dCopy && !dNotes) none++
    })
    console.log(`| ${v.label} | ${pr} (${pct(pr, n)}) | ${copyOnly} (${pct(copyOnly, n)}) | ${anySess} (${pct(anySess, n)}) | ${notes} (${pct(notes, n)}) | ${none} (${pct(none, n)}) |${refuseFlip ? ` refusal flips: ${refuseFlip}` : ''}`)
  }
}

// Free vs paid with the SAME answer: does the engine read the tier for either field?
let tierDiff = 0, tierN = 0
for (const raw of sample.slice(0, 300)) {
  const i = { ...strip(raw), hard_session_relationship: 'overdo', terrain: 'trail' }
  const f = gen(i, 'free'), p = gen(i, 'paid')
  const fb = gen(strip(raw), 'free'), pb = gen(strip(raw), 'paid')
  if (!f || !p || !fb || !pb) continue
  tierN++
  // effect of the answers at each tier; differs only if the engine gates the field on tier
  const effF = [prescription(f) !== prescription(fb), sessionCopy(f) !== sessionCopy(fb), planNotes(f) !== planNotes(fb)].join()
  const effP = [prescription(p) !== prescription(pb), sessionCopy(p) !== sessionCopy(pb), planNotes(p) !== planNotes(pb)].join()
  if (effF !== effP) tierDiff++
}
console.log(`\nTier-dependence of the answers' effect (overdo + trail, first 300 sampled): ${tierDiff} of ${tierN} differ`)
}
