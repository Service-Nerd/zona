/**
 * BUILD-SPECIFICITY-ZERO-01 — §5's SPECIFICITY_BY_PHASE declares build 30%
 * specific. This measures what is actually delivered, per phase and per distance,
 * plus the three properties the Coaching Board's gate named:
 *
 *   - the QUALITY SESSION COUNT must not change (Sims: it must SUBSTITUTE, not add)
 *   - §1's intensity distribution must not move (Seiler: §1 counts sessions)
 *   - 5K/10K must be costed SEPARATELY from HM/marathon (Willy: at 5K goal pace
 *     is near vVO2max, so substituting it is not a reduction)
 */
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { V1_SESSION_CATALOGUE } from '../lib/plan/sessionCatalogueData'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import { isLongRun } from '../lib/plan/sessionRole'
import type { Session } from '../types/plan'

const catOf = new Map(V1_SESSION_CATALOGUE.map(r => [r.id, r.category]))
const SPECIFIC = new Set(['race_specific', 'ultra_specific'])

// ⚠️ THE DENOMINATOR INCLUDES THE LONG-RUN SLOT, AND IT MUST.
// `MIDWEEK_QUALITY_LADDER`'s own comment says race-specific work "is
// long-run-slot work, not a midweek single-day session", so a specificity
// measure counting only `type === 'quality'` cannot see the channel the
// architecture designates. A first version of this script did exactly that and
// was blind to the fix.
type Cell = { quality: number; specific: number; viaQuality: number; viaLongRun: number }
const cell = (): Cell => ({ quality: 0, specific: 0, viaQuality: 0, viaLongRun: 0 })
const hasSegment = (s: Session): boolean =>
  isLongRun(s) && Boolean((s as unknown as Record<string, unknown>).lr_segment_pace)
const byPhase = new Map<string, Cell>()
const byDist = new Map<string, Cell>()
let plans = 0, refused = 0, qualityTotal = 0, runningTotal = 0

for (const input of cohortGrid()) {
  let plan
  try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { refused++; continue }
  plans++
  for (const w of plan.weeks) {
    if (w.n < 1) continue
    for (const s of Object.values(w.sessions ?? {})) {
      if (!s || s.type === 'rest' || s.type === 'strength') continue
      runningTotal++
      const cid = (s as unknown as Record<string, unknown>).catalogue_id as string | undefined
      const cat = cid ? catOf.get(cid) : undefined
      const rowSpecific = cat != null && SPECIFIC.has(cat)
      const lrSpecific = hasSegment(s)
      const isQuality = s.type === 'quality'
      if (!isQuality && !lrSpecific) continue
      if (isQuality) qualityTotal++
      const p = byPhase.get(String(w.phase)) ?? cell()
      p.quality++
      if (isQuality && rowSpecific) { p.specific++; p.viaQuality++ }
      else if (lrSpecific) { p.specific++; p.viaLongRun++ }
      byPhase.set(String(w.phase), p)
      if (w.phase === 'build') {
        const k = `${input.race_distance_km}km`
        const d = byDist.get(k) ?? cell()
        d.quality++
        if (isQuality && rowSpecific) { d.specific++; d.viaQuality++ }
        else if (lrSpecific) { d.specific++; d.viaLongRun++ }
        byDist.set(k, d)
      }

    }
  }
}

const pc = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a')
console.log('plans:', plans, '| refused:', refused)
console.log('QUALITY SESSIONS (must not change — Sims’s substitution condition):', qualityTotal)
console.log('RUNNING SESSIONS (§1 denominator — Seiler):', runningTotal, '| quality share', pc(qualityTotal, runningTotal))
console.log()
console.log('§5 declares: base', GENERATION_CONFIG.SPECIFICITY_BY_PHASE.base.specific_pct + '%',
  '· build', GENERATION_CONFIG.SPECIFICITY_BY_PHASE.build.specific_pct + '%',
  '· peak', GENERATION_CONFIG.SPECIFICITY_BY_PHASE.peak.specific_pct + '%',
  '· taper', GENERATION_CONFIG.SPECIFICITY_BY_PHASE.taper.specific_pct + '%')
console.log('DELIVERED specific share of SPECIFIC-WORK SLOTS (quality + segmented long runs):')
for (const ph of ['base', 'build', 'peak', 'taper']) {
  const t = byPhase.get(ph)
  if (!t) { console.log(`  ${ph.padEnd(6)} (no slots)`); continue }
  console.log(`  ${ph.padEnd(6)} ${String(t.specific).padStart(6)}/${String(t.quality).padEnd(7)} = ${pc(t.specific, t.quality).padEnd(7)}`
    + `  via quality row ${String(t.viaQuality).padStart(6)} | via long run ${String(t.viaLongRun).padStart(6)}`)
}
console.log()
console.log('BUILD phase only, by race distance (Willy: 5K/10K costed separately):')
for (const k of ['5km', '10km', '21.1km', '42.2km']) {
  const t = byDist.get(k)
  console.log(`  ${k.padEnd(7)} ${t ? `${String(t.specific).padStart(6)}/${String(t.quality).padEnd(7)} = ${pc(t.specific, t.quality).padEnd(7)}  via long run ${t.viaLongRun}` : '(none)'}`)
}
