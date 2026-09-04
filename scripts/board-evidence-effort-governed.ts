// Cross-distance evidence for the 2026-09-04 Coaching Board rulings.
//
// WHY THIS IS COMMITTED, not a throwaway — the same reasoning as trace-plan.ts.
// Three of the four rulings are still OPEN (docs/decisions/coaching-board-
// 2026-09-04-label-dose-effort.md §5), and each one's next step is gated on a
// number this script produces:
//
//   R1  label collisions            -> ruling (1), still to implement
//   R2  VO2max work-minute dose     -> ruling (2) + the intervals_long follow-up
//   R3  effort-governed coherence   -> ruling (3) phase 2, and the population it must fix
//   R4  effort rows goal-paced      -> ruling (4), SHIPPED: this must stay at 0
//
// Re-deriving these by hand is how the numbers in a ruling go stale. R4 in
// particular is a regression tripwire with a known-good value.
//
// The board's constraint was cross-distance: assess every distance and the full
// input space, not the 10K plan that surfaced it. So the grid is
// property-validate-plans.ts's own, verbatim — the same population the commit
// gate sweeps — with one correction it did not have at the time (see
// TARGET_TIME below), since fixed there too.
//
// It REPORTS and never exits non-zero. Mechanical assertions belong in
// validatePlan(); a tool that quietly doubles as a gate is how you get a gate
// nobody runs.
//
//   NODE_ENV=production npx tsx scripts/board-evidence-effort-governed.ts
//   NODE_ENV=production ONLY_KM=50,100 SWEEP_N=3000 npx tsx scripts/board-evidence-effort-governed.ts
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import { V1_SESSION_CATALOGUE } from '../lib/plan/sessionCatalogueData'
import { durationForMainSet } from '../lib/plan/sessionFormat'

const PLAN_START = '2026-04-27'
function raceDate(w: number) {
  const d = new Date(`${PLAN_START}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + w * 7)
  return d.toISOString().slice(0, 10)
}
const baseInput = {
  athlete_name: 'Athlete', age: 35, race_name: 'Test', target_time: '0:45:00',
  primary_metric: 'distance' as const, injury_history: [], plan_start: PLAN_START,
}
// ⚠️ The property sweep's baseInput used to set target_time '0:45:00' for EVERY
// distance, giving a 100K runner a 27 sec/km goal pace — so any goal-paced
// measurement on that grid was meaningless, and the first run of this script had
// to be discarded because of it. Fixed in property-validate-plans.ts on
// 2026-09-04 (TARGET_TIME_BY_DISTANCE); kept in step here deliberately rather
// than imported, so the two grids can be diffed by eye.
const TARGET_TIME: Record<number, string> = {
  5: '0:22:00', 10: '0:45:00', 21.1: '1:45:00', 42.2: '3:45:00', 50: '6:00:00', 100: '14:00:00',
}
const distancesAndDates: any[] = [
  { race_distance_km: 5, race_date: raceDate(10) }, { race_distance_km: 5, race_date: raceDate(9) },
  { race_distance_km: 10, race_date: raceDate(13) }, { race_distance_km: 10, race_date: raceDate(12) },
  { race_distance_km: 21.1, race_date: raceDate(15) }, { race_distance_km: 21.1, race_date: raceDate(13) },
  { race_distance_km: 42.2, race_date: raceDate(18) }, { race_distance_km: 42.2, race_date: raceDate(17) },
  { race_distance_km: 50, race_date: raceDate(23) }, { race_distance_km: 100, race_date: raceDate(26) },
]
const cwks = [5, 12, 25, 40, 60]
const lrrFractions = [0.2, 0.35, 0.5, 0.75]
const dayOptions: any[] = [
  { days_available: 2, days_cannot_train: ['mon','tue','wed','thu','sat'] },
  { days_available: 3, days_cannot_train: ['mon','tue','thu','sat'] },
  { days_available: 3, days_cannot_train: ['tue','thu'] },
  { days_available: 4, days_cannot_train: ['tue','thu'] },
  { days_available: 5, days_cannot_train: ['tue'] },
  { days_available: 7, days_cannot_train: [] },
  { days_available: 4, days_cannot_train: [] },
  { days_available: 5, days_cannot_train: [] },
  { days_available: 6, days_cannot_train: [] },
]
const fitnessSets = [undefined, 'beginner', 'intermediate', 'experienced']
const trainingAgeSets = [undefined, '<6mo', '6-18mo', '2-5yr', '5yr+']
const declaredSets = [undefined, 'beginner', 'intermediate', 'experienced']
const hardSets = ['love', 'avoid', 'neutral']
const injurySets = [[], ['knee'], ['achilles'], ['shin_splints'], ['hip_flexor'], ['back']]
const maxWeekdays = [undefined, 30, 45, 60, 90]
const foundationGapDays = [0, 10, 24, 40]
const TANAKA_AT_35 = 184
const hrSets: any[] = [
  { hr: {} }, { hr: { resting_hr: 55, max_hr: TANAKA_AT_35 } },
  { hr: { resting_hr: 55, max_hr: Math.round(TANAKA_AT_35 * 0.7), max_hr_source: 'observed' } },
  { hr: { max_hr: TANAKA_AT_35 } },
]
const goalSets: any[] = [{ goal: undefined }, { goal: 'time_target' }]
const longRunDays: any[] = [{ d: undefined }, { d: 'sun' }, { d: 'sat' }]
const benchmarkSets: any[] = [{ b: undefined }, { b: { type: 'race', distance_km: 10, time: '0:48:30' } }]
const tiers: Array<'free' | 'paid'> = ['free', 'paid']

const SWEEP_N = Number(process.env.SWEEP_N ?? 6000)
const SEED = Number(process.env.SWEEP_SEED ?? 20260904)
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]

const PHASE = process.env.PHASE ?? 'build'
const ONLY = process.env.ONLY_KM ? process.env.ONLY_KM.split(',').map(Number) : null
const DISTS = ONLY ? distancesAndDates.filter(d => ONLY.includes(d.race_distance_km)) : distancesAndDates

function randomInput(): any {
  const d = pick(DISTS); const cwk = pick(cwks); const days = pick(dayOptions)
  const hrSet = pick(hrSets); const g = pick(goalSets); const lrd = pick(longRunDays); const bm = pick(benchmarkSets)
  return {
    ...baseInput, ...d, target_time: TARGET_TIME[d.race_distance_km], current_weekly_km: cwk,
    longest_recent_run_km: Math.max(3, Math.round(cwk * pick(lrrFractions))), ...days,
    ...(() => { const f = pick(fitnessSets); return f ? { fitness_level: f } : {} })(),
    ...(() => { const t = pick(trainingAgeSets); return t ? { training_age: t } : {} })(),
    ...(() => { const x = pick(declaredSets); return x ? { user_declared_level: x } : {} })(),
    hard_session_relationship: pick(hardSets), injury_history: pick(injurySets),
    max_weekday_mins: pick(maxWeekdays), ...hrSet.hr,
    ...(g.goal ? { goal: g.goal } : {}),
    ...(lrd.d ? { preferred_long_run_day: lrd.d } : {}),
    ...(bm.b ? { benchmark: bm.b } : {}),
  }
}

const distName = (km: number) => km === 5 ? '5K' : km === 10 ? '10K' : km === 21.1 ? 'HM'
  : km === 42.2 ? 'MAR' : km === 50 ? '50K' : '100K'

// ── measurement accumulators ────────────────────────────────────────────────
type Bucket = { plans: number; sessions: number; hits: number; worst: number; examples: string[] }
const mk = (): Bucket => ({ plans: 0, sessions: 0, hits: 0, worst: 0, examples: [] })

// R1 — duplicate build-phase goal-paced labels
const r1 = new Map<string, Bucket>()
const r1LabelToRows = new Map<string, Set<string>>()
// R2 — vo2max work-minute shortfall vs target
const r2 = new Map<string, Bucket>()
const r2ByRow = new Map<string, { n: number; short: number; worstShort: number; workMins: number[] }>()
// R3 — effort-governed duration coherence
const r3 = new Map<string, Bucket>()
const r3Rows = new Map<string, { n: number; incoherent: number; worstGapMins: number; worstCapBreach: number }>()
let r3CapBreaches = 0
const r3Tiny: any[] = []
const r4: string[] = []
// R6 — EG-01 evidence. For each vo2max row, what work-minute doses are even
// ACHIEVABLE across the real spread of runner I-paces? The band is [12,18] and
// rep count is an integer, so a long rep quantises coarsely. This asks whether
// the row can ever reach its target, not whether one plan did.
const r6 = new Map<string, { paces: number[]; work: number[]; reachedTarget: number; n: number }>()
// R5 — EG-02 GATE. What actually moves if effort-governed durations are restated
// honestly? Candidate phase-2 constants, for MEASUREMENT ONLY (they are coaching
// numerics and would need board ratification before shipping). Sensitivity is
// swept via EG2_RECOVERY_SECS.
const EG2_RECOVERY_SECS = Number(process.env.EG2_RECOVERY_SECS ?? 75)
const EG2_TRANSITION_MINS = Number(process.env.EG2_TRANSITION_MINS ?? 5)
const r5 = {
  sessions: 0, plansTouched: 0,
  statedMins: 0, honestMins: 0, worstDelta: 0,
  capExemptStructured: 0, capBreachesIfNotExempt: 0,
  qualitySessions: 0, runningSessions: 0,   // §1 numerator/denominator — session counts
  weekMinsBefore: 0, weekMinsAfter: 0,
}

const bump = (m: Map<string, Bucket>, k: string) => { if (!m.has(k)) m.set(k, mk()); return m.get(k)! }

function parsePaceMid(p: string | null | undefined): number | null {
  if (!p) return null
  const nums = Array.from(p.matchAll(/(\d+):(\d{2})/g)).map(m => +m[1] + +m[2] / 60)
  if (!nums.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}
function lengthMins(len: string, paceMid: number | null): number | null {
  const s = len.trim()
  const mirror = s.match(/^same as the (.+)$/i); if (mirror) return lengthMins(mirror[1], paceMid)
  let m = s.match(/^(\d+(?:\.\d+)?)\s*min$/i); if (m) return +m[1]
  m = s.match(/^(\d+):(\d{2})$/); if (m) return +m[1] + +m[2] / 60
  m = s.match(/^(\d+)\s*s$/i); if (m) return +m[1] / 60
  m = s.match(/^(\d+(?:\.\d+)?)\s*m$/i); if (m) return paceMid == null ? null : (+m[1] / 1000) * paceMid
  m = s.match(/^(\d+(?:\.\d+)?)\s*km$/i); if (m) return paceMid == null ? null : +m[1] * paceMid
  return null // open / landmark / "until ready"
}
function sessionSplit(dur: number) {
  const warmup = Math.max(15, dur * 0.10)
  const cooldown = dur * 0.10
  return { warmup, cooldown, main: Math.max(0, dur - warmup - cooldown) }
}

let generated = 0, refused = 0, threw = 0
const REFUSAL = /is not enough preparation|days\/week is (not enough|below)/

for (let i = 0; i < SWEEP_N; i++) {
  const input = randomInput()
  const tier = pick(tiers)
  let plan: any
  try {
    plan = generateRulePlan(input, tier, PLAN_START)
  } catch (e: any) {
    if (REFUSAL.test(String(e?.message))) { refused++; continue }
    threw++; continue
  }
  generated++
  const dk = distName(input.race_distance_km)
  const fitness = plan.meta.fitness_intensity_level ?? plan.meta.fitness_level

  // ── R1 ────────────────────────────────────────────────────────────────────
  const b1 = bump(r1, dk); b1.plans++
  const buildGoalPaced: { label: string; cid: string }[] = []
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions ?? {}) as any[]) {
      if (!s || s.type !== 'quality') continue
      if (!/-pace /.test(s.label ?? '')) continue
      // LBL-01 — per-PHASE, not build-only. Build was where the defect was
      // reported; taper carries its own single phase word ("sharpener") and had
      // never been measured, so scoping the fix to build would have been a guess.
      if (w.phase !== PHASE) continue
      buildGoalPaced.push({ label: s.label, cid: s.catalogue_id ?? '(none)' })
      b1.sessions++
      if (!r1LabelToRows.has(s.label)) r1LabelToRows.set(s.label, new Set())
      r1LabelToRows.get(s.label)!.add(s.catalogue_id ?? '(none)')
    }
  }
  // a plan "hits" when two build goal-paced sessions share a label but differ in row
  const byLabel = new Map<string, Set<string>>()
  for (const x of buildGoalPaced) {
    if (!byLabel.has(x.label)) byLabel.set(x.label, new Set())
    byLabel.get(x.label)!.add(x.cid)
  }
  let r1hit = false
  for (const rows of Array.from(byLabel.values())) if (rows.size > 1) r1hit = true
  if (r1hit) { b1.hits++; if (b1.examples.length < 2) b1.examples.push(`${dk} ${input.days_available}d ${fitness}`) }

  // ── R2 ────────────────────────────────────────────────────────────────────
  const b2 = bump(r2, dk); b2.plans++
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions ?? {}) as any[]) {
      if (!s?.derived_set || !s.catalogue_id) continue
      const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
      if (row?.category !== 'vo2max') continue
      if (!s.pace_target) continue // effort-governed handled in R3
      const mid = parsePaceMid(s.pace_target)
      const blocks = s.derived_set.blocks ?? []
      let work = 0, ok = true
      for (const bl of blocks) {
        const rep = typeof bl.repeat === 'number' ? bl.repeat : 0
        for (const st of bl.steps ?? []) {
          if (st.role !== 'work') continue
          const mins = lengthMins(st.length, mid)
          if (mins == null) { ok = false; break }
          work += rep * mins
        }
      }
      if (!ok || work <= 0) continue
      b2.sessions++
      {
        const rk2 = s.catalogue_id as string
        if (!r6.has(rk2)) r6.set(rk2, { paces: [], work: [], reachedTarget: 0, n: 0 })
        const e = r6.get(rk2)!
        e.n++; e.work.push(work); if (mid != null) e.paces.push(mid)
      }
      const target = (GENERATION_CONFIG.VO2MAX_WORK_TARGET_MINS as any)[fitness]?.[w.phase]
        ?? GENERATION_CONFIG.VO2MAX_WORK_MIN_MINS
      const shortPct = (target - work) / target * 100
      const rk = s.catalogue_id
      if (!r2ByRow.has(rk)) r2ByRow.set(rk, { n: 0, short: 0, worstShort: 0, workMins: [] })
      const rr = r2ByRow.get(rk)!
      rr.n++; rr.workMins.push(work)
      if (shortPct > 10) { rr.short++; b2.hits++ }
      if (work >= target - 0.5) r6.get(s.catalogue_id as string)!.reachedTarget++
      if (shortPct > rr.worstShort) rr.worstShort = shortPct
      if (shortPct > b2.worst) { b2.worst = shortPct; b2.examples = [`${rk} ${work.toFixed(1)}min vs target ${target} (${fitness}/${w.phase})`] }
    }
  }

  // §1 counting basis — SESSIONS, plan-wide (CD-19, 2026-08-20). Captured so the
  // claim "a duration change cannot move §1" is measured, not asserted.
  for (const w of plan.weeks) {
    for (const sn of Object.values(w.sessions ?? {}) as any[]) {
      if (!sn || ['rest','strength','cross-train'].includes(sn.type)) continue
      r5.runningSessions++
      if (['quality','intervals','tempo'].includes(sn.type)) r5.qualitySessions++
    }
    r5.weekMinsBefore += Object.values(w.sessions ?? {}).reduce((a: number, x: any) => a + (x?.duration_mins ?? 0), 0)
  }

  // ── R3 ────────────────────────────────────────────────────────────────────
  const b3 = bump(r3, dk); b3.plans++
  for (const w of plan.weeks) {
    for (const [, s] of Object.entries(w.sessions ?? {}) as [string, any][]) {
      if (!s?.derived_set || !s.catalogue_id || s.duration_mins == null) continue
      const row = V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)
      if (!row) continue
      // effort-governed = every work step carries an rpe and no pace
      const steps = (s.derived_set.blocks ?? []).flatMap((b: any) => (b.steps ?? []).map((st: any) => ({ ...st, _rep: typeof b.repeat === 'number' ? b.repeat : 1 })))
      const workSteps = steps.filter((st: any) => st.role === 'work')
      if (!workSteps.length || !workSteps.every((st: any) => st.rpe != null && st.pace == null)) continue
      b3.sessions++
      if (/-pace /.test(s.label ?? '')) { r4.push(`${dk} ${s.catalogue_id} "${s.label}" rpe=${workSteps[0].rpe} pace_target='${s.pace_target ?? ''}' dur=${s.duration_mins}`) }
      const rk = s.catalogue_id
      if (!r3Rows.has(rk)) r3Rows.set(rk, { n: 0, incoherent: 0, worstGapMins: 0, worstCapBreach: 0 })
      const rr = r3Rows.get(rk)!; rr.n++
      // lower bound: sum only CLOSED steps (open/landmark contribute 0)
      const mid = parsePaceMid(s.pace_target) ?? parsePaceMid(
        steps.find((st: any) => st.pace)?.pace ?? null)
      let lower = 0
      for (const st of steps) {
        const mins = lengthMins(st.length, mid)
        if (mins != null) lower += st._rep * mins
      }
      const avail = sessionSplit(s.duration_mins).main
      // ── R5 (EG-02 gate) ────────────────────────────────────────────────
      // Honest duration = closed steps + a priced standing recovery per rep +
      // a landmark transition, run through the SAME floor-aware inverse the
      // engine sizes against.
      {
        const repBlock = (s.derived_set.blocks ?? []).find((b: any) => typeof b.repeat === 'number' && b.repeat > 1)
        const reps = repBlock?.repeat ?? 0
        const openPerRep = (repBlock?.steps ?? []).filter((st: any) => /until ready|^open$/i.test(st.length ?? '')).length
        const honestMain = lower + reps * openPerRep * (EG2_RECOVERY_SECS / 60) + EG2_TRANSITION_MINS
        const honestTotal = durationForMainSet(honestMain)
        r5.sessions++
        r5.statedMins += s.duration_mins
        r5.honestMins += honestTotal
        const delta = honestTotal - s.duration_mins
        if (delta > r5.worstDelta) r5.worstDelta = delta
        const cap = input.max_weekday_mins
        // §81 — structured sessions (quality/tempo/intervals/hard) are EXEMPT
        // from the weekday cap. Count both, so the exemption is visible rather
        // than assumed.
        if (cap && ['quality','tempo','intervals','hard'].includes(s.type)) r5.capExemptStructured++
        else if (cap && honestTotal > cap) r5.capBreachesIfNotExempt++
      }
      if (lower > avail + 2) {
        rr.incoherent++; b3.hits++
        const gap = lower - avail
        if (gap > rr.worstGapMins) rr.worstGapMins = gap
        // does the honest duration breach the runner's weekday cap?
        const honest = 15 + lower + s.duration_mins * 0.10
        const cap = input.max_weekday_mins
        if (cap && honest > cap && s.duration_mins <= cap) {
          r3CapBreaches++
          const breach = honest - cap
          if (breach > rr.worstCapBreach) rr.worstCapBreach = breach
        }
        if (s.duration_mins < 40 && r3Tiny.length < 6) r3Tiny.push({
          dk, rk, label: s.label, dur: s.duration_mins, dist: s.distance_km,
          metric: s.primary_metric, closed: +lower.toFixed(1), week: w.n, tier,
          input: { cwk: input.current_weekly_km, lrr: input.longest_recent_run_km,
            days: input.days_available, blocked: input.days_cannot_train?.length,
            fit: input.fitness_level, ta: input.training_age, decl: input.user_declared_level,
            cap: input.max_weekday_mins, inj: input.injury_history, goal: input.goal },
        })
        if (b3.examples.length < 2) b3.examples.push(`${dk} ${rk} stated ${s.duration_mins}min, main ${avail.toFixed(1)} < closed steps ${lower.toFixed(1)}`)
      }
    }
  }
}

// ── report ──────────────────────────────────────────────────────────────────
console.log(`\nSWEEP_N=${SWEEP_N} seed=${SEED} — generated ${generated}, refused ${refused}, threw ${threw}\n`)

const ORDER = ['5K', '10K', 'HM', 'MAR', '50K', '100K']

console.log(`═══ R1 — ${PHASE}-phase goal-paced label collisions (same label, different catalogue row) ═══`)
console.log('dist   plans  goalPacedSessions  plansWithCollision  %')
for (const d of ORDER) {
  const b = r1.get(d); if (!b) continue
  console.log(`${d.padEnd(6)} ${String(b.plans).padStart(5)}  ${String(b.sessions).padStart(17)}  ${String(b.hits).padStart(18)}  ${(b.hits / b.plans * 100).toFixed(1)}%`)
}
console.log('\n  labels shared by >1 catalogue row:')
for (const [label, rows] of Array.from(r1LabelToRows).sort()) {
  if (rows.size > 1) console.log(`    "${label}" ← ${Array.from(rows).sort().join(', ')}`)
}

console.log('\n═══ R2 — VO2max work-minute shortfall vs VO2MAX_WORK_TARGET_MINS ═══')
console.log('row                     n      >10% short   worst short   work-min range')
for (const [rk, rr] of Array.from(r2ByRow).sort()) {
  const mn = Math.min(...rr.workMins), mx = Math.max(...rr.workMins)
  console.log(`${rk.padEnd(22)} ${String(rr.n).padStart(6)}  ${String(rr.short).padStart(10)}   ${rr.worstShort.toFixed(1).padStart(10)}%   ${mn.toFixed(1)}–${mx.toFixed(1)}`)
}
console.log('\ndist   vo2maxSessions  shortfalls  worst')
for (const d of ORDER) {
  const b = r2.get(d); if (!b || !b.sessions) continue
  console.log(`${d.padEnd(6)} ${String(b.sessions).padStart(14)}  ${String(b.hits).padStart(10)}  ${b.worst.toFixed(1)}%  ${b.examples[0] ?? ''}`)
}

console.log('\n═══ R3 — effort-governed rows: stated duration vs own closed-step lower bound ═══')
console.log('row                     n      incoherent   worst gap   worst weekday-cap breach')
for (const [rk, rr] of Array.from(r3Rows).sort()) {
  console.log(`${rk.padEnd(22)} ${String(rr.n).padStart(6)}  ${String(rr.incoherent).padStart(10)}   ${rr.worstGapMins.toFixed(1).padStart(7)}min   ${rr.worstCapBreach.toFixed(1)}min`)
}
console.log(`\n  plans where the honest duration breaches max_weekday_mins but the stated one does not: ${r3CapBreaches}`)
console.log('\ndist   effortSessions  incoherent')
for (const d of ORDER) {
  const b = r3.get(d); if (!b || !b.sessions) continue
  console.log(`${d.padEnd(6)} ${String(b.sessions).padStart(14)}  ${String(b.hits).padStart(10)}   ${b.examples[0] ?? ''}`)
}
console.log('\n  tiny stated durations (<40 min) with incoherent structure:')
for (const t of r3Tiny) console.log('   ' + JSON.stringify(t))
console.log('\n═══ R6 — EG-01: is the target dose even REACHABLE for each vo2max row? ═══')
console.log('  band [' + GENERATION_CONFIG.VO2MAX_WORK_MIN_MINS + ',' + GENERATION_CONFIG.VO2MAX_WORK_MAX_MINS + '] min of work; rep count is an integer, so rep LENGTH sets the granularity')
console.log('row                     n     reached target   work min/median/max   I-pace min/median/max')
for (const [rk, e] of Array.from(r6)) {
  const med = (a: number[]) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] ?? 0 }
  const wl = e.work, pl = e.paces
  console.log(`${rk.padEnd(22)} ${String(e.n).padStart(5)}   ${String(e.reachedTarget).padStart(6)} (${(e.reachedTarget/e.n*100).toFixed(0)}%)   ` +
    `${Math.min(...wl).toFixed(1)}/${med(wl).toFixed(1)}/${Math.max(...wl).toFixed(1)}          ` +
    `${Math.min(...pl).toFixed(2)}/${med(pl).toFixed(2)}/${Math.max(...pl).toFixed(2)}`)
}

console.log(`\n═══ R5 — EG-02 GATE: what a corrected effort-governed duration actually moves ═══`)
console.log(`  candidate constants: recovery ${EG2_RECOVERY_SECS}s/rep, transition ${EG2_TRANSITION_MINS} min`)
console.log(`  effort-governed sessions repriced: ${r5.sessions}`)
console.log(`  stated total ${r5.statedMins.toFixed(0)} min -> honest ${r5.honestMins.toFixed(0)} min  (+${(r5.honestMins - r5.statedMins).toFixed(0)} min, ${((r5.honestMins/r5.statedMins - 1)*100).toFixed(1)}%)`)
console.log(`  worst single-session delta: +${r5.worstDelta.toFixed(1)} min`)
console.log(`  §1 basis is SESSIONS (CD-19): quality ${r5.qualitySessions} / running ${r5.runningSessions} = ${(r5.qualitySessions/r5.runningSessions*100).toFixed(1)}% — INVARIANT under any duration change`)
console.log(`  plan-wide minutes before: ${r5.weekMinsBefore.toFixed(0)}; effort sessions are ${(r5.statedMins/r5.weekMinsBefore*100).toFixed(2)}% of them, rising to ${(r5.honestMins/(r5.weekMinsBefore - r5.statedMins + r5.honestMins)*100).toFixed(2)}%`)
console.log(`  §81 weekday-cap EXEMPT (structured): ${r5.capExemptStructured}; would-breach if not exempt: ${r5.capBreachesIfNotExempt}`)
console.log(`\n═══ R4 — effort-governed rows relabelled goal-paced (§22/§40b tension) : ${r4.length} ═══`)
for (const x of Array.from(new Set(r4)).slice(0, 8)) console.log('   ' + x)
console.log()
