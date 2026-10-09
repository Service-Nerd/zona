/** Residual across recalibration magnitudes + its effect on weekly volume. READ-ONLY. */
import { generateRulePlan, applyRecalibration } from '../lib/plan/ruleEngine'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
const base: any = { age: 35, goal: 'finish', terrain: 'road', training_age: '2-5y',
  user_declared_level: 'intermediate', recent_quality_training: 'regular', days_available: 4,
  hard_session_relationship: 'neutral', preferred_long_run_day: 'sun', injury_history: [],
  race_distance_km: 21.1, race_date: '2027-03-21', race_name: 'T', days_cannot_train: [],
  current_weekly_km: 40, longest_recent_run_km: 14,
  benchmark: { type: 'race', distance_km: 5, time: '0:24:00' } }
const quals = (p: any) => (p.weeks ?? []).filter((w: any) => w.n > 0)
  .flatMap((w: any) => Object.entries(w.sessions ?? {}).filter(([, s]: any) => s?.type === 'quality')
    .map(([d, s]: any) => ({ k: `w${w.n}${d}`, d: s.distance_km ?? null, m: s.duration_mins ?? null })))
const secs = (t: string) => { const [m, s] = t.split(':').map(Number); return m * 60 + s }
console.log('recal        Δbenchmark   comparable  mis-sized  mean err  worst err   Σkm err')
for (const to of ['0:22:00', '0:25:00', '0:26:00', '0:28:00', '0:32:00']) {
  const from = '24:00'
  const gi = JSON.parse(JSON.stringify(base))
  const recal = applyRecalibration(generateRulePlan(gi), { type: 'race', distance_km: 5, time: to } as any, 1) as any
  const giTo = JSON.parse(JSON.stringify(base)); giTo.benchmark.time = to
  const fresh = generateRulePlan(giTo) as any
  const a = quals(recal), b = quals(fresh)
  const pure = a.map((q, i) => ({ q, f: b[i] })).filter(x => x.f && x.q.m != null && x.q.m === x.f.m && x.q.d != null && x.f.d != null)
  const errs = pure.map(x => Math.abs(x.q.d! - x.f.d!) / x.f.d!)
  const mis = errs.filter(e => e > 0.001).length
  const weekly = (p: any) => (p.weeks ?? []).filter((w: any) => w.n > 0).map((w: any) =>
    Object.values(w.sessions ?? {}).reduce((t: number, s: any) => t + (sessionKmSelfPaced(s) ?? 0), 0))
  const wa = weekly(recal), wb = weekly(fresh)
  const n = Math.min(wa.length, wb.length)
  const werr = n ? wa.slice(0, n).map((k: number, i: number) => Math.abs(k - wb[i]) / (wb[i] || 1)) : []
  const d = (secs(to.slice(2)) - secs(from)) / secs(from)
  console.log(`24:00→${to.slice(2)}   ${(100 * d).toFixed(1).padStart(6)}%   ${String(pure.length).padStart(7)}   ${String(mis).padStart(7)}   ${errs.length ? (100 * errs.reduce((s, x) => s + x, 0) / errs.length).toFixed(1).padStart(6) + '%' : '    n/a'}  ${errs.length ? (100 * Math.max(...errs)).toFixed(1).padStart(6) + '%' : '    n/a'}   ${werr.length ? (100 * werr.reduce((s, x) => s + x, 0) / werr.length).toFixed(1).padStart(5) + '%' : '  n/a'}`)
}
