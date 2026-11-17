// ZONE-STRING-CLASSIFIER-01 — the mandated BEFORE/AFTER delta, measured as VIOLATIONS.
//
//   npx tsx scripts/board-evidence-zone-classifier.ts [stride]
//
// The item asked for a BUCKET delta. A bucket delta is the wrong unit and the first cut
// proved it: the zone string and the catalogue row disagree on 46.6% of quality sessions,
// almost all of it §22 re-prescribing a threshold row at goal pace, which is a correct
// decision recorded in the string. What matters is whether a GUARD changes its verdict.
//
// ⚠️ AND ONE ARM OF THE FIRST CUT WAS HOLLOW: it compared `classifyStimulus(sn)` against the
// new path, and `classifyStimulus` returns `session.stimulus` first — so both sides read the
// same stamp and it reported 0 flips for the site that actually flips. The stamp COMPUTATION
// is reproduced from label/zone/category here, both ways, rather than called.
//
// Read-only. Today's engine, no ADR-026 band wiring.

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { cohortGrid, COHORT_PLAN_START, isDesignedRefusal } from '../lib/plan/cohortGrid'
import { V1_SESSION_CATALOGUE } from '../lib/plan/sessionCatalogueData'
import { labelImplications } from '../lib/plan/invariants'
import { parsePaceMidpoint } from '../lib/plan/paceParse'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import { STIMULUS_OF_CATEGORY } from '../lib/plan/sessionRole'

const stride = Number(process.argv[2] ?? 1)
const grid = cohortGrid().filter((_, i) => i % stride === 0)

const rowOf = (s: { catalogue_id?: string }) =>
  s.catalogue_id ? V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id) ?? null : null

// ── the label heuristic, verbatim as it was BEFORE the re-key (zone included) ──
function stimulusHeuristic(label: string, zone: string, vo2First: boolean): string | null {
  const l = label.toLowerCase(), z = zone.toLowerCase()
  if (vo2First && (l.includes('vo2') || z.includes('zone 4–5') || z.includes('zone 5'))) return 'vo2max'
  if (!vo2First && l.includes('vo2')) return 'vo2max'
  if (l.includes('-pace') || l.includes('goal pace') || l.includes('sharpener')) return 'race_pace'
  if (l.includes('tempo') || l.includes('cruise') || l.includes('threshold') || l.includes('progressive')) return 'tempo'
  if (l.includes('hill'))  return 'hills'
  if (l.includes('strid')) return 'strides'
  if (l.includes('aerobic') || l.includes('steady')) return 'steady_aerobic'
  return null
}

let plans = 0, quality = 0, noRow = 0
let lmpOld = 0, lmpNew = 0, lmpOnlyOld = 0, lmpOnlyNew = 0
let ordOld = 0, ordNew = 0
let stampFlips = 0
const stampDetail = new Map<string, number>()
const lmpDetail  = new Map<string, number>()

for (const input of grid) {
  let plan
  try {
    const raw = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    plan = composePlanWithFoundation(raw, input, COHORT_PLAN_START, 'add').plan
  } catch (e) {
    if (!isDesignedRefusal(e)) console.error('UNEXPECTED:', (e as Error).message?.split('\n')[0])
    continue
  }
  plans++

  // ── INV-PLAN-INTENSITY-ORDERING, reproduced both ways, per plan ─────────────
  const tol = GENERATION_CONFIG.INTENSITY_ORDERING_TOLERANCE_PCT / 100
  const best = { oldVo2: Infinity, oldThr: Infinity, newVo2: Infinity, newThr: Infinity }

  for (const w of plan.weeks) {
    for (const sn of Object.values(w.sessions)) {
      if (!sn || sn.type !== 'quality') continue
      quality++
      const row = rowOf(sn)
      if (!row) noRow++
      const zone = (sn.zone ?? '').toLowerCase()
      const label = (sn.label ?? '').toLowerCase()
      const cls = row ? row.category : null

      // ── INV-PLAN-LABEL-MATCHES-PACE: the three arms, both ways ─────────────
      const { vo2: lVo2, threshold: lThr, easy: lEasy } = labelImplications(label)
      const zVo2 = zone.includes('zone 4') || zone.includes('zone 5')
      const zThr = zone.includes('zone 3') && !zone.includes('zone 4')
      const zEasy = zone.includes('zone 1') || zone.includes('zone 2')
      const oldFire = (lVo2 && !zVo2) || (lThr && !lVo2 && !zThr && !zVo2) || (lEasy && !zEasy)

      // AS SHIPPED: only the vo2max arm is re-keyed. The threshold and easy arms stay on the
      // zone string — §33 repurposing and §22's override move the prescription OFF the row, so
      // the category describes what the row is FOR and not what this instance was prescribed AS,
      // and both arms test "at least Z3" / "at most Z2", which survives ADR-026 by construction.
      const pVo2 = cls !== null ? cls === 'vo2max' : zVo2
      const newFire = (lVo2 && !pVo2) || (lThr && !lVo2 && !zThr && !zVo2) || (lEasy && !zEasy)

      if (oldFire) lmpOld++
      if (newFire) lmpNew++
      if (oldFire && !newFire) { lmpOnlyOld++; lmpDetail.set(`OLD-ONLY ${row?.id ?? '(no row)'} "${sn.label}" zone="${sn.zone}"`, (lmpDetail.get(`OLD-ONLY ${row?.id ?? '(no row)'} "${sn.label}" zone="${sn.zone}"`) ?? 0) + 1) }
      if (newFire && !oldFire) { lmpOnlyNew++; lmpDetail.set(`NEW-ONLY ${row?.id ?? '(no row)'} "${sn.label}" zone="${sn.zone}"`, (lmpDetail.get(`NEW-ONLY ${row?.id ?? '(no row)'} "${sn.label}" zone="${sn.zone}"`) ?? 0) + 1) }

      // ── the stamp at ruleEngine.ts:2122, both ways ─────────────────────────
      // `race_pace` by construction when goal pace was used; the generator decided that
      // before either formula runs, so it is identical on both sides and excluded.
      if (sn.stimulus !== 'race_pace') {
        const catFb = cls ? STIMULUS_OF_CATEGORY[cls] ?? null : null
        const oldStamp = stimulusHeuristic(label, zone, true) ?? catFb
        const newStamp = (label.includes('vo2') ? 'vo2max'
          : cls === 'vo2max' ? 'vo2max'
          : cls === null && (zone.includes('zone 4–5') || zone.includes('zone 5')) ? 'vo2max'
          : stimulusHeuristic(label, zone, false)) ?? catFb
        if (oldStamp !== newStamp) {
          stampFlips++
          const k = `${row?.id ?? '(no row)'} "${sn.label}" zone="${sn.zone}": ${oldStamp} -> ${newStamp}`
          stampDetail.set(k, (stampDetail.get(k) ?? 0) + 1)
        }
      }

      // ORDERING is NOT re-keyed either (carried into ANCHOR-BAND-FLIP-01 with condition 3);
      // these two sides measure what the category reading WOULD have done, which is the evidence
      // for leaving it alone.
      if (!sn.pace_target) continue
      const mid = parsePaceMidpoint(sn.pace_target)
      if (mid == null) continue
      if (zVo2) best.oldVo2 = Math.min(best.oldVo2, mid)
      if (zThr) best.oldThr = Math.min(best.oldThr, mid)
      // NEW: race-pace work excluded from both sides (§83 Amendment)
      if (cls !== null) {
        if (cls === 'vo2max')    best.newVo2 = Math.min(best.newVo2, mid)
        if (cls === 'threshold') best.newThr = Math.min(best.newThr, mid)
      } else {
        if (zVo2) best.newVo2 = Math.min(best.newVo2, mid)
        if (zThr) best.newThr = Math.min(best.newThr, mid)
      }
    }
  }

  const surfaced = plan.meta.goal_beyond_measured_fitness === true
    && plan.meta.difficulty_band !== undefined && plan.meta.difficulty_band !== 'comfortable'
  const fires = (v: number, t: number) => Number.isFinite(v) && Number.isFinite(t) && t < v * (1 - tol) && !surfaced
  if (fires(best.oldVo2, best.oldThr)) ordOld++
  if (fires(best.newVo2, best.newThr)) ordNew++
}

const pct = (n: number, d: number) => d === 0 ? 'n/a' : `${(100 * n / d).toFixed(2)}%`
console.log(`\nstride ${stride} · ${grid.length} inputs · ${plans} plans · ${quality} quality sessions`)
console.log(`no resolvable catalogue row: ${noRow} (${pct(noRow, quality)}) — the zone-string fallback's reach`)
console.log(`\nINV-PLAN-LABEL-MATCHES-PACE   old ${lmpOld} · new ${lmpNew}   (old-only ${lmpOnlyOld}, new-only ${lmpOnlyNew})`)
for (const [k, n] of Array.from(lmpDetail).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`   ×${n}  ${k}`)
console.log(`\nINV-PLAN-INTENSITY-ORDERING    old ${ordOld} plans · new ${ordNew} plans`)
console.log(`\nstimulus stamp (ruleEngine.ts:2122, non-goal-pace only): ${stampFlips} flips of ${quality} (${pct(stampFlips, quality)})`)
for (const [k, n] of Array.from(stampDetail).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`   ×${n}  ${k}`)
