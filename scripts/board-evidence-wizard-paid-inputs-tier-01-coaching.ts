/**
 * `WIZARD-PAID-INPUTS-TIER-01` — Coaching Board follow-up evidence, 2026-11-20. READ-ONLY: generates plans in
 * memory only. No production read, no validatePlan, no writes.
 *
 * The SLT ruled both questions FREE and handed two questions here:
 *   (A) for 96.0% of `overdo` plans the whole effect is §96's Z2 cue on the long run. What exactly does that cue
 *       reach (which long runs carry it, which do not and why), and does placing it displace another note?
 *   (B) the injury x answer interaction, unmeasured because `cohortGrid` pins `injury_history: []`.
 *
 * Population: `cohortGrid()` (the wizard's production shape), stride 23 for (A) as in the SLT script, stride 67 per
 * injury overlay for (B). Both strides are coprime to 2^9 x 3^4. "No answer" deletes the field, as the SLT script did.
 * Injury spellings are the wizard's (`GeneratePlanScreen.tsx` INJURIES).
 *
 * Run: npx tsx scripts/board-evidence-wizard-paid-inputs-tier-01-coaching.ts
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { cohortGrid, COHORT_PLAN_START, isDesignedRefusal } from '../lib/plan/cohortGrid'
import { isLongRun, isQualitySession } from '../lib/plan/sessionRole'
import type { GeneratorInput, Plan } from '../types/plan'

const CUE = 'Zone 2 ceiling: if HR starts climbing, back off to a walk for 30 seconds before resuming.'
const strip = (i: any) => { const o = { ...i }; delete o.hard_session_relationship; delete o.terrain; return o }
const gen = (i: any): Plan | null => {
  try { return generateRulePlan(i as GeneratorInput, 'free', COHORT_PLAN_START) as Plan }
  catch (e) { if (isDesignedRefusal(e)) return null; throw e }
}
const pct = (a: number, b: number) => b ? `${(100 * a / b).toFixed(1)}%` : '-'
const bump = (m: Record<string, number>, k: string) => { m[k] = (m[k] ?? 0) + 1 }
const prescription = (p: Plan) => JSON.stringify(p.weeks.map(w => [w.n, w.weekly_km, w.type, w.phase,
  Object.entries(w.sessions).map(([d, s]: [string, any]) => [d, s?.type, s?.catalogue_id, s?.label, s?.distance_km,
    s?.duration_mins, s?.zone, s?.pace_target])]))
const sessionCopy = (p: Plan) => JSON.stringify(p.weeks.map(w =>
  Object.entries(w.sessions).map(([d, s]: [string, any]) => [d, s?.coach_notes])))
const planNotes = (p: Plan) => {
  const m = { ...(p.meta as any) }
  delete m.generator_input; delete m.generated_at; delete m.hard_session_relationship; delete m.terrain
  return JSON.stringify(m)
}
const quality = (p: Plan) => p.weeks.reduce((n, w) => n + Object.values(w.sessions).filter((s: any) => s && isQualitySession(s)).length, 0)
const totalKm = (p: Plan) => p.weeks.reduce((n, w) => n + (w.weekly_km ?? 0), 0)
const longRuns = (p: Plan) => p.weeks.flatMap(w => Object.entries(w.sessions)
  .filter(([, s]: [string, any]) => s && isLongRun(s)).map(([d, s]) => ({ w, d, s: s as any })))
const isDeloadWeek = (w: any) => w.type === 'deload' || w.badge === 'deload'

function sample(stride: number, n: number, overlay?: string[]) {
  const grid = cohortGrid(); const out: any[] = []
  for (let i = 0; i < n; i++) {
    const x = grid[(i * stride) % grid.length]
    out.push(overlay ? { ...x, injury_history: overlay } : x)
  }
  return out
}

// ---------- (A) what the overdo cue reaches ----------
function partA() {
  const S = sample(23, 2000)
  let cueOnPaced = 0, cueLostPaceNote = 0; const cueOnPacedLabel: Record<string, number> = {}, missLabel: Record<string, number> = {}
  let built = 0, plansWithCue = 0, lr = 0, lrCue = 0, lrCueInBase = 0, presc = 0, displaced = 0, lrCueFull = 0
  const missBy: Record<string, number> = {}, displacedText: Record<string, number> = {}, cuesPerPlan: number[] = []
  const cueShare: number[] = []
  const prescRows: { dq: number, dkm: number }[] = []
  for (const raw of S) {
    const b = gen(strip(raw)), o = gen({ ...strip(raw), hard_session_relationship: 'overdo' })
    if (!b || !o) continue
    built++
    if (prescription(b) !== prescription(o)) {
      presc++; prescRows.push({ dq: quality(o) - quality(b), dkm: Math.round(totalKm(o) - totalKm(b)) })
    }
    const bl = longRuns(b), ol = longRuns(o)
    // displacement is read slot-by-slot, so it is only meaningful where the prescription is unchanged
    const samePresc = prescription(b) === prescription(o)
    let k = 0, runs = 0
    for (const { w, d, s } of ol) {
      lr++
      const has = (s.coach_notes ?? []).includes(CUE)
      const bs: any = b.weeks.find(x => x.n === w.n)?.sessions?.[d as 'mon']
      if (has) {
        lrCue++; k++
        if ((s.coach_notes ?? []).length >= 3) lrCueFull++
        // the cue on a long run that also prescribes a race-pace segment (stated in the label, a note, or
        // lr_segment_pace), measured on the BASE session so a segment note the cue displaced still counts
        const paced = !!s.lr_segment_pace || /pace/i.test(String(s.label ?? ''))
          || [...(bs?.coach_notes ?? []), ...(s.coach_notes ?? [])].some((n: string) => /at (MP|HM)\b|goal pace|race pace/i.test(String(n)) && n !== CUE)
        if (paced && samePresc) { cueOnPaced++; bump(cueOnPacedLabel, `${w.phase} · ${String(s.label ?? '').slice(0, 40)}`) }
        const lostPace = (bs?.coach_notes ?? []).some((n: string) => /at (MP|HM)\b|goal pace/i.test(n) && !(s.coach_notes ?? []).includes(n))
        if (lostPace && samePresc) cueLostPaceNote++
        if (bs && (bs.coach_notes ?? []).includes(CUE)) lrCueInBase++
        if (samePresc) for (const note of (bs?.coach_notes ?? [])) if (!(s.coach_notes ?? []).includes(note)) { displaced++; bump(displacedText, String(note).slice(0, 70)) }
      } else {
        bump(missBy, `${isDeloadWeek(w) ? 'deload' : w.badge === 'race' || w.type === 'race' ? 'race week' : 'non-deload'} / ${w.phase ?? '-'}`)
        if (!isDeloadWeek(w)) bump(missLabel, `${w.phase} · ${String(s.label ?? '').slice(0, 45)}${s.lr_segment_pace ? ' [segment]' : ''}`)
      }
    }
    for (const w of o.weeks) for (const s of Object.values(w.sessions) as any[]) if (s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train') runs++
    if (k > 0) plansWithCue++
    cuesPerPlan.push(k); cueShare.push(runs ? k / runs : 0)
    void bl
  }
  cuesPerPlan.sort((a, c) => a - c); cueShare.sort((a, c) => a - c)
  console.log(`\n## (A) overdo vs no answer, no injury: ${built} built of 2,000`)
  console.log(`prescription changes: ${presc} (${pct(presc, built)})`)
  if (prescRows.length) {
    const dq: Record<string, number> = {}, dk: Record<string, number> = {}
    for (const r of prescRows) { bump(dq, String(r.dq)); bump(dk, r.dkm === 0 ? '0' : r.dkm < 0 ? '<0' : '>0') }
    console.log('  quality-session delta (overdo - none):', dq, ' total-km delta sign:', dk)
  }
  console.log(`plans carrying the cue at least once: ${plansWithCue} (${pct(plansWithCue, built)})`)
  console.log(`long runs: ${lr}; carry the cue: ${lrCue} (${pct(lrCue, lr)}); of those, already carried it without the answer (§24c): ${lrCueInBase}`)
  console.log(`cues per plan: median ${cuesPerPlan[Math.floor(cuesPerPlan.length / 2)]}, min ${cuesPerPlan[0]}, max ${cuesPerPlan[cuesPerPlan.length - 1]}`)
  console.log(`cue as a share of the plan's running sessions: median ${pct(cueShare[Math.floor(cueShare.length / 2)], 1)}`)
  console.log('long runs WITHOUT the cue, by week:', missBy)
  console.log('  non-deload misses by phase · label:', missLabel)
  console.log(`cue-carrying long runs at the 3-note cap: ${lrCueFull} (${pct(lrCueFull, lrCue)})`)
  console.log(`cue-carrying long runs that ALSO prescribe a race-pace segment: ${cueOnPaced} (${pct(cueOnPaced, lrCue)}); of those the segment's pace note was displaced by the cue: ${cueLostPaceNote}`)
  console.log('  by phase · label:', cueOnPacedLabel)
  console.log(`notes present without the answer and LOST with it (displaced by the cue), prescription-identical plans only: ${displaced}`)
  console.log('  displaced note texts:', displacedText)
}

// ---------- (B) injury x answer ----------
function partB() {
  const INJ: (string[] | null)[] = [null, ['Knee'], ['Shin splints'], ['Achilles'], ['Back'], ['Hip'], ['Plantar fasciitis']]
  console.log('\n## (B) injury x answer — each answer vs no answer, 600 inputs per overlay (stride 67), tier free')
  console.log('| injury | built | baseline early onset | overdo: presc / copy-only / cue reach of LRs | avoid: presc / mean quality delta | love: presc / mean quality delta |')
  console.log('|---|---|---|---|---|---|')
  for (const inj of INJ) {
    const S = sample(67, 600, inj ?? undefined)
    let built = 0, early = 0
    const r: Record<string, { presc: number, copy: number, dq: number, lr: number, lrCue: number }> = {}
    for (const a of ['overdo', 'avoid', 'love']) r[a] = { presc: 0, copy: 0, dq: 0, lr: 0, lrCue: 0 }
    for (const raw of S) {
      const b = gen(strip(raw)); if (!b) continue
      const vs: Record<string, Plan | null> = {}
      for (const a of ['overdo', 'avoid', 'love']) vs[a] = gen({ ...strip(raw), hard_session_relationship: a })
      if (Object.values(vs).some(v => !v)) continue
      built++
      if ((b.meta as any).early_quality_onset) early++
      for (const a of ['overdo', 'avoid', 'love']) {
        const p = vs[a]!
        const dP = prescription(b) !== prescription(p)
        if (dP) r[a].presc++
        else if (sessionCopy(b) !== sessionCopy(p)) r[a].copy++
        r[a].dq += quality(p) - quality(b)
        if (a === 'overdo') for (const { s } of longRuns(p)) { r[a].lr++; if ((s.coach_notes ?? []).includes(CUE)) r[a].lrCue++ }
      }
    }
    const o = r.overdo, av = r.avoid, l = r.love
    console.log(`| ${inj ? inj.join('+') : 'none'} | ${built} | ${early} | ${pct(o.presc, built)} / ${pct(o.copy, built)} / ${pct(o.lrCue, o.lr)} | ${pct(av.presc, built)} / ${(av.dq / built).toFixed(2)} | ${pct(l.presc, built)} / ${(l.dq / built).toFixed(2)} |`)
  }
}

if (!process.argv.includes("--d")) partA()
if (!process.argv.includes("--a") && !process.argv.includes("--d")) partB()

// ---------- (C) love x injury: when the answer moves nothing, does the plan say so? (§40c) ----------
function partC() {
  console.log('\n## (C) love vs no answer: plans where love changes NO prescription, split by whether hard_pref_note speaks')
  console.log('| injury | built | love changes prescription | silent (no change, no note) | silent AND training_age 5yr+ |')
  console.log('|---|---|---|---|---|')
  for (const inj of [null, ['Knee'], ['Achilles'], ['Plantar fasciitis']] as (string[] | null)[]) {
    const S = sample(67, 600, inj ?? undefined)
    let built = 0, moved = 0, silent = 0, silent5 = 0
    for (const raw of S) {
      const b = gen(strip(raw)), l = gen({ ...strip(raw), hard_session_relationship: 'love' })
      if (!b || !l) continue
      built++
      if (prescription(b) !== prescription(l)) { moved++; continue }
      if (!(l.meta as any).hard_pref_note) { silent++; if (raw.training_age === '5yr+') silent5++ }
    }
    console.log(`| ${inj ? inj.join('+') : 'none'} | ${built} | ${moved} (${pct(moved, built)}) | ${silent} (${pct(silent, built)}) | ${silent5} |`)
  }
}
if (!process.argv.includes("--a") && !process.argv.includes("--d")) partC()

// ---------- (D) ultra: §24e says "no Z2-ceiling cues"; §96 says every long run at every distance ----------
// cohortGrid has no ultra, so this uses ultraFuelNote.test.ts's runner WITHOUT `fitness_level` (the wizard never
// sends it), x four volumes x two distances.
function partD() {
  console.log('\n## (D) ultra long runs, overdo vs no answer')
  for (const km of [50, 100]) for (const vol of [50, 70, 90]) {
    const inp: any = { race_distance_km: km, race_date: '2027-06-12', goal: 'finish', age: 40, resting_hr: 55, max_hr: 180,
      days_available: 5, current_weekly_km: vol, longest_recent_run_km: 28, preferred_long_run_day: 'sun',
      recent_quality_training: 'occasional', injury_history: [] }
    const run = (i: any) => { try { return generateRulePlan(i, 'free', '2026-09-14') as Plan } catch (e) { if (isDesignedRefusal(e)) return null; throw e } }
    const b = run(inp), o = run({ ...inp, hard_session_relationship: 'overdo' })
    if (!b || !o) { console.log(`${km}K @${vol}: refused`); continue }
    const fuel = (s: any) => (s.coach_notes ?? []).some((n: string) => /Fuel every/.test(n))
    const ol = longRuns(o), bl = longRuns(b)
    console.log(`${km}K @${vol} km/wk: long runs ${ol.length}; Z2 cue ${ol.filter(x => (x.s.coach_notes ?? []).includes(CUE)).length}; fuel cue without answer ${bl.filter(x => fuel(x.s)).length} / with overdo ${ol.filter(x => fuel(x.s)).length}; prescription changed: ${prescription(b) !== prescription(o)}`)
  }
}
if (!process.argv.includes('--a')) partD()
