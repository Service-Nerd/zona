/**
 * STRENGTH-SESSION-REPEAT-01 — how alike are two sessions in one week, and one
 * session week to week? `S-AB-DISTINCT` only fires on a byte-identical pair, so
 * neither question has a number yet. Reuses the sweep's own grid, never a new one.
 */
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { planToRunContext } from '@/lib/strength-bridge/runContext'
import { generateStrengthPlan } from '@/packages/strength'
import { strengthProfileGrid } from '@/lib/strength-bridge/profileGrid'

// The sweep's own grid and stride, so this measures the population the gate measures.
const strideArg = process.argv.indexOf('--stride')
const STRIDE = strideArg > 0 ? Number(process.argv[strideArg + 1]) : 1500
const inputs = [...cohortGrid().filter((_, i) => i % STRIDE === 0),
                ...targetedGrid().filter((_, i) => i % Math.max(1, Math.floor(STRIDE / 8)) === 0)]
const profiles = strengthProfileGrid()

const mains = (s: any) => (s.blocks ?? [])
  .filter((b: any) => b.role !== 'warmup' && b.role !== 'mobility' && b.role !== 'cooldown')
  .flatMap((b: any) => b.items.map((i: any) => i.exercise_id)) as string[]

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a), B = new Set(b)
  const inter = Array.from(A).filter(x => B.has(x)).length
  const union = new Set(a.concat(b)).size
  return union === 0 ? 0 : inter / union
}

const bucket = (pct: number) => pct >= 100 ? '100% (identical)' : pct >= 75 ? '75-99%' : pct >= 50 ? '50-74%' : pct >= 25 ? '25-49%' : '0-24%'

function main() {
  const within: number[] = []
  const across: number[] = []
  const wb: Record<string, number> = {}
  const ab: Record<string, number> = {}
  let plans = 0, identicalWithin = 0, identicalAcross = 0

  for (const input of inputs) {
    let runPlan: any
    try { runPlan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch (e) { if (isDesignedRefusal(e)) continue; throw e }
    const ctx = planToRunContext(runPlan)
    for (const prof of profiles) {
    const plan: any = generateStrengthPlan(prof, ctx)
    if (!plan?.weeks?.length) continue
    plans++
    const prevByDay: Record<string, string[]> = {}
    for (const w of plan.weeks) {
      const sess = (w.sessions ?? []).filter((s: any) => s.kind !== 'mobility')
      // within the week: every pair
      for (let i = 0; i < sess.length; i++) for (let j = i + 1; j < sess.length; j++) {
        const p = Math.round(jaccard(mains(sess[i]), mains(sess[j])) * 100)
        within.push(p); wb[bucket(p)] = (wb[bucket(p)] ?? 0) + 1
        if (p === 100) identicalWithin++
      }
      // the same weekday, week to week
      for (const s of sess) {
        const prev = prevByDay[s.day]
        const cur = mains(s)
        if (prev) {
          const p = Math.round(jaccard(prev, cur) * 100)
          across.push(p); ab[bucket(p)] = (ab[bucket(p)] ?? 0) + 1
          if (p === 100) identicalAcross++
        }
        prevByDay[s.day] = cur
      }
    }
    }
  }
  const mean = (x: number[]) => x.length ? (x.reduce((a, b) => a + b, 0) / x.length).toFixed(1) : 'n/a'
  const show = (label: string, n: number, arr: number[], b: Record<string, number>, ident: number) => {
    console.log(`\n${label}: ${n} pairs, mean overlap ${mean(arr)}%`)
    for (const k of ['0-24%', '25-49%', '50-74%', '75-99%', '100% (identical)'])
      if (b[k]) console.log(`   ${k.padEnd(18)} ${String(b[k]).padStart(7)}  ${(b[k] / n * 100).toFixed(1)}%`)
    console.log(`   >>> S-AB-DISTINCT fires on the last row only: ${ident} of ${n} (${(ident / n * 100).toFixed(2)}%)`)
  }
  console.log(`plans: ${plans}`)
  show('WITHIN a week (pairs of sessions)', within.length, within, wb, identicalWithin)
  show('ACROSS weeks (same weekday)', across.length, across, ab, identicalAcross)
}
main()
