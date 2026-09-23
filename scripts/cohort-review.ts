// cohort-review.ts — the coaching review's table, diffed against last time.
//
//   npm run review:cohort              # run and diff against the baseline
//   npm run review:cohort -- --write   # re-baseline (a DECLARED act)
//   npm run review:cohort -- --stride 3
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
// `measure:envelope` answers "what is the fit-for-purpose rate per distance"
// and diffs it. It cannot answer the question the 2026-09-23 review actually
// turned on: **WHICH RUNNERS are failing.** The marathon's 78.7% is not spread
// across marathoners; it is one cohort. At 25 km/week and above the engine is
// 93-100% clean, and at 15 km/week it is 12%. A headline rate that moves tells
// you something changed; it never tells you who it changed for, and a rise in
// one band can hide a collapse in another.
//
// So this reports the SAME table every time, by volume band, and prints the
// delta against a committed baseline. Same discipline as `measure:envelope`:
// **a move in either direction is a finding.** A rate that improves without
// anyone intending it is as much a signal as one that regresses.
//
// ⚠️ RE-BASELINING IS A DECLARED ACT. `--write`, and say in the commit which
// number moved and why. Never to turn a red run green.
//
// Exit 0 = matches baseline. 1 = moved (the diff is printed). 2 = could not run.

import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { distanceEnvelope } from '../lib/plan/useCaseEnvelope'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { isDesignedRefusal } from '../lib/plan/designedRefusal'
import { auditPlanQuality } from '../lib/plan/planQuality'

const BASELINE = join(__dirname, '..', 'lib', 'plan', '__fixtures__', 'cohortReviewBaseline.json')

const argv = process.argv.slice(2)
const WRITE = argv.includes('--write')
const STRIDE = (() => {
  const i = argv.indexOf('--stride')
  return i >= 0 && argv[i + 1] ? Math.max(1, parseInt(argv[i + 1], 10)) : 7
})()

/** The distances that have ever produced a refusal or an objection. 5K/10K/50K/
 *  100K measure 100% on every band; including them is 18,000 plans of zeros. */
const DISTANCES = [42.2, 21.1] as const

interface BandRow {
  n: number
  refusedPct: number
  cleanPct: number
  objections: Record<string, number>
}
type DistanceRows = Record<string, BandRow>   // keyed by weekly-km band
type Report = { stride: number; byDistance: Record<string, DistanceRows> }

const pc = (x: number, t: number) => t ? +(x / t * 100).toFixed(1) : 0

function measure(): Report {
  const byDistance: Record<string, DistanceRows> = {}
  for (const dist of DISTANCES) {
    const bands: Record<string, { n: number; w: number; refused: number; clean: number; obj: Record<string, number> }> = {}
    for (const c of distanceEnvelope(dist).filter((_, i) => i % STRIDE === 0)) {
      const i = c.input as unknown as Record<string, number>
      const key = String(i.current_weekly_km)
      const b = bands[key] ??= { n: 0, w: 0, refused: 0, clean: 0, obj: {} }
      b.n++; b.w += c.weight
      let plan
      try { plan = generateRulePlan(c.input, 'paid') }
      catch (e) {
        // A non-designed throw is a crash, not a refusal, and must not be
        // silently folded into the refusal rate.
        if (isDesignedRefusal(e)) b.refused += c.weight
        continue
      }
      const m = plan.meta as unknown as Record<string, unknown>
      const maintDeclared = m.volume_profile === 'maintenance' && !!m.volume_constraint_note
      const errs = validatePlan(plan, c.input).filter(v => v.severity === 'error')
      // §23 licenses a declared maintenance plan that does not build. Same
      // reconciliation `envelopeMeasure` makes, so the two agree.
      const objs = auditPlanQuality(plan, c.input)
        .filter(o => !(o as { watched?: boolean }).watched)
        .filter(o => !(o.code === 'NEVER-BUILDS' && maintDeclared))
      for (const o of objs) b.obj[o.code] = (b.obj[o.code] ?? 0) + c.weight
      if (!errs.length && !objs.length) b.clean += c.weight
    }
    const rows: DistanceRows = {}
    for (const [k, b] of Object.entries(bands).sort((x, y) => +x[0] - +y[0])) {
      rows[k] = {
        n: b.n,
        refusedPct: pc(b.refused, b.w),
        cleanPct: pc(b.clean, b.w),
        objections: Object.fromEntries(
          Object.entries(b.obj).sort((x, y) => y[1] - x[1]).map(([c2, w]) => [c2, pc(w, b.w)])),
      }
    }
    byDistance[String(dist)] = rows
  }
  return { stride: STRIDE, byDistance }
}

// ── render ──────────────────────────────────────────────────────────────────
const d = (now: number, was: number | undefined): string => {
  if (was === undefined) return '  NEW '
  const diff = +(now - was).toFixed(1)
  if (diff === 0) return '   ·  '
  return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}`.padStart(6)
}

function render(now: Report, was: Report | null): boolean {
  let moved = false
  for (const dist of Object.keys(now.byDistance)) {
    const label = dist === '42.2' ? 'MARATHON' : dist === '21.1' ? 'HALF MARATHON' : `${dist} km`
    console.log(`\n═══ ${label} ═══  (stride ${now.stride})\n`)
    console.log('  km/wk │    n │ refused │    Δ │  clean │    Δ │ objections')
    console.log('  ──────┼──────┼─────────┼──────┼────────┼──────┼───────────')
    const prev = was?.byDistance[dist]
    for (const [band, row] of Object.entries(now.byDistance[dist])) {
      const p = prev?.[band]
      const dr = d(row.refusedPct, p?.refusedPct)
      const dc = d(row.cleanPct, p?.cleanPct)
      if (dr.trim() !== '·' && p) moved = true
      if (dc.trim() !== '·' && p) moved = true
      const objs = Object.entries(row.objections).map(([c, v]) => {
        const pv = p?.objections[c]
        const delta = pv === undefined ? ' NEW' : (+(v - pv).toFixed(1) === 0 ? '' : ` (${v - pv > 0 ? '+' : ''}${(v - pv).toFixed(1)})`)
        if (delta) moved = true
        return `${c} ${v}%${delta}`
      }).join(', ') || '—'
      // An objection that DISAPPEARED is a move too, and is invisible if you
      // only walk today's keys.
      for (const gone of Object.keys(p?.objections ?? {})) {
        if (!(gone in row.objections)) { moved = true; console.log(`  ${band.padStart(5)} │ ${'CLEARED'.padStart(4)} │        │      │        │      │ ${gone} GONE (was ${p!.objections[gone]}%)`) }
      }
      console.log(`  ${band.padStart(5)} │ ${String(row.n).padStart(4)} │ ${(row.refusedPct + '%').padStart(7)} │${dr} │ ${(row.cleanPct + '%').padStart(6)} │${dc} │ ${objs}`)
    }
    for (const gone of Object.keys(prev ?? {})) {
      if (!(gone in now.byDistance[dist])) { moved = true; console.log(`  ${gone.padStart(5)} │ BAND GONE from the envelope`) }
    }
  }
  return moved
}

// ── main ────────────────────────────────────────────────────────────────────
const now = measure()
const was: Report | null = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null

if (was && was.stride !== now.stride) {
  console.error(`✗ stride ${now.stride} cannot be compared to a baseline taken at ${was.stride}.`)
  console.error('  Re-run without --stride, or re-baseline deliberately with --write.')
  process.exit(2)
}

const moved = render(now, was)

if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 1))
  console.log(`\n✓ baseline written: ${BASELINE}`)
  console.log('  ⚠️ Say in the commit which number moved and WHY. Never re-baseline to turn a run green.')
  process.exit(0)
}
if (!was) {
  console.log('\n· no baseline yet. Run with --write to create one.')
  process.exit(0)
}
if (moved) {
  console.log('\n✗ the cohort table MOVED. A move in either direction is a finding.')
  console.log('  An improvement nobody intended is as much a signal as a regression.')
  console.log('  Explain it, then re-baseline with: npm run review:cohort -- --write')
  process.exit(1)
}
console.log('\n✓ unchanged against the baseline, every band.')
