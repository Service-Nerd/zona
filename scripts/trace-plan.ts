// Plan tracer — renders a generated plan the way the Coaching Board reads one.
//
// WHY THIS EXISTS AS A COMMITTED TOOL, not a throwaway.
// The 2026-08-19 catalogue audit was built on a hand-traced 12-week 10K plan,
// and the board's rulings reference that trace as evidence (CD-14…CD-19). CD-16
// then closed with an instruction that could not be honoured without re-tracing:
// "SC-01 materially changes CD-16 — re-run the 10K trace afterwards." Re-deriving
// the trace by hand each time is how the audit's own numbers went stale.
//
// So: one command, pinned profiles, same view every time.
//
//   npx tsx scripts/trace-plan.ts                  # the audit's Task B profile
//   npx tsx scripts/trace-plan.ts --profile=task-b-5d
//   npx tsx scripts/trace-plan.ts --list
//
// The tracer REPORTS. It asserts nothing and never exits non-zero on plan
// content — mechanical assertions belong in validatePlan()/invariants, and a
// tool that quietly doubles as a gate is how you get a gate nobody runs.
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'

// Plan start is PINNED, never `today` — the lesson of SWEEP-VACUOUS-01, where a
// grid of fixed race dates silently stopped generating once real time passed them.
const PLAN_START = '2026-09-07'

function raceDate(weeksOut: number): string {
  const d = new Date(`${PLAN_START}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeksOut * 7)
  return d.toISOString().slice(0, 10)
}

const PROFILES: Record<string, { label: string, note: string, input: any }> = {
  'task-b': {
    label: 'Audit Task B — 12-week 10K, 4 days, experienced, ambitious target',
    note: 'The profile the 2026-08-19 catalogue audit traced. CD-14…CD-19 rest on it.',
    input: {
      race_distance_km: 10, race_date: raceDate(12), goal: 'time_target',
      target_time: '0:44:59', days_available: 4, age: 43,
      current_weekly_km: 40, longest_recent_run_km: 18,
      resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
      benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
      injury_history: ['Left knee, posterior, recurring'],
      fitness_level: 'experienced', training_age: '2-5yr',
    },
  },
  'task-b-5d': {
    label: 'Audit Task B on FIVE days — the shape CD-20 permits a second quality on',
    note: 'Same runner, one more day. Isolates what day count alone changes.',
    input: {
      race_distance_km: 10, race_date: raceDate(12), goal: 'time_target',
      target_time: '0:44:59', days_available: 5, age: 43,
      current_weekly_km: 40, longest_recent_run_km: 18,
      resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
      benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
      fitness_level: 'experienced', training_age: '2-5yr',
    },
  },
  'user-a': {
    label: 'User A — live 3-day beginner HM, finish goal',
    note: 'The real plan behind the CD-19 numerator question.',
    input: {
      race_distance_km: 21.1, race_date: raceDate(13), goal: 'finish',
      days_available: 3, age: 43, current_weekly_km: 20, longest_recent_run_km: 10,
      resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
    },
  },
}

const args = process.argv.slice(2)
if (args.includes('--list')) {
  for (const [k, p] of Object.entries(PROFILES)) console.log(`${k.padEnd(12)} ${p.label}\n${' '.repeat(13)}${p.note}`)
  process.exit(0)
}
const key = (args.find(a => a.startsWith('--profile='))?.split('=')[1]) ?? 'task-b'
const profile = PROFILES[key]
if (!profile) { console.error(`Unknown profile "${key}". Try --list.`); process.exit(2) }

const tier = (args.find(a => a.startsWith('--tier='))?.split('=')[1] ?? 'paid') as 'free' | 'paid'
const plan: any = generateRulePlan(profile.input, tier, PLAN_START)

const HARD = new Set(['quality', 'intervals', 'tempo'])
const isRunning = (t: string) => t !== 'rest' && t !== 'strength' && t !== 'cross-train'

console.log(`\n${profile.label}`)
console.log(`${profile.note}`)
console.log(`plan_start ${PLAN_START} · tier ${tier} · ${plan.weeks.length} weeks · profile ${plan.meta?.volume_profile ?? '?'}\n`)

// ── Week-by-week quality map ────────────────────────────────────────────────
console.log('Wk  Phase       km    Quality sessions (day · label · zone · pace)')
console.log('─'.repeat(100))
for (const w of plan.weeks) {
  const q = Object.entries<any>(w.sessions)
    .filter(([, s]) => s && HARD.has(s.type))
    .map(([d, s]) => `${d} · ${s.label} · ${s.zone ?? '—'} · ${s.pace_target ?? '—'}`)
  const tag = w.badge ? `${w.phase}/${w.badge}` : (w.phase ?? w.type)
  console.log(`${String(w.n).padStart(2)}  ${String(tag).padEnd(11)} ${String(w.weekly_km).padStart(5)}  ${q.length ? q.join('\n' + ' '.repeat(26)) : '—'}`)
}

// ── VO2max placement — the CD-16 question ───────────────────────────────────
const vo2 = plan.weeks.flatMap((w: any) =>
  Object.entries<any>(w.sessions)
    .filter(([, s]) => s && HARD.has(s.type) && /vo2|vo₂/i.test(s.label ?? ''))
    .map(([day, s]) => ({ week: w.n, phase: w.phase, day, label: s.label, km: w.weekly_km })))

console.log(`\nVO2MAX PLACEMENT (CD-16)`)
console.log('─'.repeat(100))
if (!vo2.length) console.log('  none in this plan')
for (const v of vo2) console.log(`  W${v.week} (${v.phase}) ${v.day} — ${v.label}`)

const taperStart = plan.weeks.find((w: any) => w.phase === 'taper')?.n
if (vo2.length && taperStart) {
  const gap = taperStart - vo2[0].week
  console.log(`  first VO2max W${vo2[0].week} · taper starts W${taperStart} · gap ${gap} week(s)`)
}

// Willy's gate (CD-16 amendment 1): does the introducing week hold volume flat?
//
// COMPARE AGAINST THE LAST NON-DELOAD WEEK, never simply `iw - 1`. A deload
// commonly sits immediately before peak, so an `iw - 1` comparison measures
// recovery-week rebound and reports a large "rise" that is not a progression at
// all. The first draft of this tracer did exactly that and made a 4-day plan
// whose volume FALLS into the VO2max week look like a +6km climb.
if (vo2.length) {
  const iw = vo2[0].week
  const cur = plan.weeks.find((w: any) => w.n === iw)
  const prior = [...plan.weeks]
    .filter((w: any) => w.n < iw && w.badge !== 'deload' && w.type !== 'deload')
    .sort((a: any, b: any) => b.n - a.n)[0]
  if (prior && cur) {
    const delta = cur.weekly_km - prior.weekly_km
    const pct = (delta / prior.weekly_km) * 100
    const immediate = plan.weeks.find((w: any) => w.n === iw - 1)
    console.log(`  vs last non-deload week: W${prior.n} ${prior.weekly_km}km → W${cur.n} ${cur.weekly_km}km ` +
      `(${delta >= 0 ? '+' : ''}${delta.toFixed(1)}km, ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)` +
      `  ${delta > 0 ? '← RISING: intensity introduced on a climbing volume curve (Willy)' : '← flat or falling: gate satisfied'}`)
    if (immediate && immediate.n !== prior.n) {
      console.log(`     (W${immediate.n} is a deload at ${immediate.weekly_km}km — excluded from the comparison on purpose)`)
    }
  }
}

// ── Second quality session — the CD-20 / SC-01 question ─────────────────────
console.log(`\nSECOND QUALITY SESSION (CD-20 / SC-01)`)
console.log('─'.repeat(100))
const twoQ = plan.weeks.filter((w: any) => Object.values<any>(w.sessions).filter(s => s && HARD.has(s.type)).length >= 2)
console.log(`  weeks with 2+ quality: ${twoQ.length ? twoQ.map((w: any) => `W${w.n}`).join(', ') : 'none'}`)
console.log(`  MIN_TRAINING_DAYS_FOR_SECOND_QUALITY = ${GENERATION_CONFIG.MIN_TRAINING_DAYS_FOR_SECOND_QUALITY} · this runner has ${profile.input.days_available}`)

// ── What the engine says it had to compromise ───────────────────────────────
console.log(`\nENGINE'S OWN RECORDED ADJUSTMENTS (meta.rule_adjustments)`)
console.log('─'.repeat(100))
const adj = plan.meta?.rule_adjustments ?? []
if (!adj.length) console.log('  none')
for (const a of adj) {
  console.log(`  [${a.rule}] weeks ${a.weeks_affected.join(', ')}`)
  console.log(`     violation:  ${a.violation}`)
  console.log(`     resolution: ${a.resolution}`)
}

// ── Intensity share, on the §1 basis ────────────────────────────────────────
let hard = 0, running = 0
for (const w of plan.weeks) for (const s of Object.values<any>(w.sessions)) {
  if (!s || !isRunning(s.type)) continue
  running++; if (HARD.has(s.type)) hard++
}
console.log(`\nINTENSITY SHARE (§1 basis: sessions, plan-wide)`)
console.log('─'.repeat(100))
console.log(`  ${hard}/${running} running sessions are quality = ${((hard / running) * 100).toFixed(1)}%`)

// ── Invariant status ────────────────────────────────────────────────────────
const violations = validatePlan(plan, profile.input)
console.log(`\nINVARIANTS`)
console.log('─'.repeat(100))
if (!violations.length) console.log('  clean')
for (const v of violations) console.log(`  [${v.severity}] ${v.code} (${v.principle_ref}) w${v.week}: ${v.message}`)
console.log()
