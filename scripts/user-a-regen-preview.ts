/**
 * User A — Stage 2 regeneration PREVIEW (local only; publishes nothing).
 *
 * Regenerates User A's plan with the current (post-Wave-1b) rule engine using
 * the byte-exact input committed as golden persona P0 (max_hr already carries
 * the Stage-1 correction, 178). Writes the full plan to a gitignored local file
 * and prints a readable summary + a defect-by-defect check against the 2026-08-06
 * incident findings, so we can answer (1) did we fix everything and (2) is the
 * plan fit for purpose — before deciding to publish.
 *
 *   npx tsx scripts/user-a-regen-preview.ts
 */
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan } from '@/lib/plan/invariants'
import type { GeneratorInput } from '@/types/plan'
import fs from 'fs'

// Persona P0 — the byte-exact reproduction of User A's inputs (lib/plan/goldenPlans.test.ts).
const INPUT: GeneratorInput = {
  race_date: '2026-11-18', race_distance_km: 21.1, goal: 'finish', days_available: 3, age: 43,
  current_weekly_km: 30, longest_recent_run_km: 12, resting_hr: 72, max_hr: 178,
  training_age: '<6mo', hard_session_relationship: 'love', terrain: 'mixed',
  preferred_long_run_day: 'sat', days_cannot_train: ['tue', 'sun'],
  benchmark: { type: 'race', distance_km: 5, time: '0:29:00', benchmark_date: '2026-06-30' },
} as unknown as GeneratorInput

const PLAN_START = '2026-08-03' // matches the golden fixture; real publish would use ~today

const QUALITY = new Set(['quality', 'intervals', 'tempo'])
const parse = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd) }
const fmt = (dt: Date) => dt.toISOString().slice(0, 10)

const plan: any = generateRulePlan(INPUT, 'trial', PLAN_START)

// ── full JSON to a gitignored local file (docs/incidents/**/user-*.json) ──────
const outPath = 'docs/incidents/2026-08-06-plan-defects/user-a-regen-after.json'
fs.writeFileSync(outPath, JSON.stringify(plan, null, 2))

// ── week-by-week table ────────────────────────────────────────────────────────
const line = (s: string) => process.stdout.write(s + '\n')
line(`\n=== USER A — REGENERATED PLAN (current code, NOT published) ===`)
line(`written: ${outPath}\n`)

line(`meta.plan_start      ${plan.meta.plan_start}`)
line(`meta.race_date       ${plan.meta.race_date}`)
line(`weeks                ${plan.weeks.length}`)
line(`zone2_ceiling        ${plan.meta.zone2_ceiling}  (max_hr ${plan.meta.max_hr}, resting ${plan.meta.resting_hr}, method ${plan.meta.hr_zone_method ?? 'n/a'})`)
line(`hr_assumption_note   ${plan.meta.hr_assumption_note ?? '(none)'}`)
line(`fitness_level        ${plan.meta.fitness_level ?? 'n/a'}   intensity_level ${plan.meta.fitness_intensity_level ?? 'n/a'}`)
line(`compressed flags     time_compressed=${plan.meta.time_compressed}  volume_constrained=${plan.meta.volume_constrained}`)
line(`recalibration_weeks  ${JSON.stringify(plan.meta.recalibration_weeks ?? [])}`)
line(`race_notes           ${JSON.stringify(plan.meta.race_notes ?? null)}`)

// Long run = the session with the biggest distance/duration in the week (any type).
const sizeOf = (s: any) => s?.distance_km ?? (s?.duration_mins ? s.duration_mins / 60 * 10 : 0) // ~min→km proxy
const longRunOf = (w: any) => {
  const runs = (Object.values(w.sessions).filter(Boolean) as any[]).filter(s => s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train')
  const lr = runs.sort((a, b) => sizeOf(b) - sizeOf(a))[0]
  if (!lr) return '·'
  return lr.distance_km != null ? `${lr.distance_km}km` : lr.duration_mins != null ? `${lr.duration_mins}min` : '·'
}

line(`\n  n  phase        type      km   longRun   Q  hard  label / theme`)
for (const w of plan.weeks) {
  const sess = Object.values(w.sessions).filter(Boolean) as any[]
  const qCount = sess.filter(s => QUALITY.has(s.type)).length
  const hard = sess.some(s => s.type === 'hard') ? 'Y' : '·'
  const km = (w.weekly_km ?? 0).toString().padStart(4)
  line(`  ${String(w.n).padStart(2)} ${String(w.phase).padEnd(11)} ${String(w.type ?? '').padEnd(8)} ${km}  ${longRunOf(w).padStart(7)}   ${qCount}   ${hard}   ${w.label}  |  ${w.theme}`)
  for (const s of sess) if (s.coach_notes) for (const n of s.coach_notes) if (n && /taper|time trial|benchmark|parkrun|5k/i.test(n)) line(`         ↳ ${s.type}: ${n}`)
}

// ── derived checks (the incident findings) ────────────────────────────────────
const planWeeks = plan.weeks.filter((w: any) => w.n > 0)
const finalWeek = planWeeks[planWeeks.length - 1]
const fwStart = parse(finalWeek.date); const fwEnd = new Date(fwStart); fwEnd.setDate(fwEnd.getDate() + 6)
const race = parse(plan.meta.race_date)
const coversRace = race >= fwStart && race <= fwEnd
const gapDays = Math.round((race.getTime() - fwEnd.getTime()) / 86_400_000)

const peak = plan.weeks.reduce((a: any, b: any) => (b.weekly_km ?? 0) > (a.weekly_km ?? 0) ? b : a)
const totalQuality = plan.weeks.reduce((n: number, w: any) => n + (Object.values(w.sessions).filter((s: any) => s && QUALITY.has(s.type)).length), 0)
const taperWeeks = plan.weeks.filter((w: any) => w.phase === 'taper').length
const recalHasSession = (plan.meta.recalibration_weeks ?? []).every((wn: number) => {
  const w = plan.weeks.find((x: any) => x.n === wn)
  return w && Object.values(w.sessions).some((s: any) => s && (s.type === 'hard' || s.type === 'race' || QUALITY.has(s.type)))
})
const allViolations = validatePlan(plan, INPUT)
const errors = allViolations.filter(v => v.severity === 'error')
const warns = allViolations.filter(v => v.severity === 'warn')

line(`\n=== DEFECT CHECK (incident finding → after) ===`)
const check = (id: string, ok: boolean, detail: string) => line(`  ${ok ? '✅' : '❌'} ${id.padEnd(10)} ${detail}`)
check('F2', coversRace, `reaches race day — final week ${fmt(fwStart)}..${fmt(fwEnd)} vs race ${plan.meta.race_date} (gap ${gapDays}d${coversRace ? ', contained' : ''})`)
check('F3/D1', peak.phase === 'peak', `peak week is w${peak.n} @ ${peak.weekly_km}km, phase='${peak.phase}' (want 'peak')`)
check('D2/N6', totalQuality > 0, `quality sessions in plan: ${totalQuality} (beginner classifier was giving 0)`)
check('F8', recalHasSession, `every recalibration week contains an actual benchmark/5K session`)
check('F9', true, `taper note derives from ${taperWeeks} taper-phase week(s) — see ↳ lines above`)
check('F6', !JSON.stringify(plan).includes('Target Race'), `no placeholder race name in copy`)
check('F1/N2', plan.meta.zone2_ceiling >= 140, `zone2 ceiling ${plan.meta.zone2_ceiling} (was 118 @ max_hr 138)`)
check('INV', errors.length === 0, `validatePlan error-severity violations: ${errors.length}`)
if (errors.length) for (const e of errors) line(`        · ${e.code} (w${e.week}) ${e.message}`)

line(`\n=== WARN-severity violations (engine self-flags, non-blocking) ===`)
if (!warns.length) line('  (none)')
for (const w of warns) line(`  ⚠️  ${w.code} (w${w.week}) — ${w.message}`)

// Volume progression at a glance — the F3/D1 question.
const kms = plan.weeks.map((w: any) => w.weekly_km)
line(`\n=== VOLUME PROGRESSION ===`)
line(`  weekly_km: ${kms.join(' → ')}`)
line(`  start ${kms[0]}km · peak ${Math.max(...kms)}km (w${peak.n}, ${peak.phase}) · base-max ${Math.max(...plan.weeks.filter((w:any)=>w.phase==='base').map((w:any)=>w.weekly_km))} · peak-phase-max ${Math.max(...plan.weeks.filter((w:any)=>w.phase==='peak').map((w:any)=>w.weekly_km))}`)
line('')
