/**
 * `BASEBUILD-GENINPUT-REMEDIATION-01` — STAMP `meta.generator_input` ON THE
 * UNSTAMPED BASE-BUILD PLANS.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * `generateBaseBuildPlan` was the second producer of a plan from a
 * `GeneratorInput` and, for its whole life, the only one that did not stamp the
 * input it was built from (BASEBUILD-GENINPUT-01 fixed the producer). The two
 * plans it had already written stay unstamped, so for them: the save gate never
 * runs, the nightly audit cannot classify a finding, and `recal-live-repair`
 * skips them.
 *
 * ── WHY IT TAKES A RACE DATE, AND WHY IT CHECKS IT ───────────────────────────
 * `generateBaseBuildPlan` sets `meta.race_date = ''` on purpose — the plan has no
 * start line and a countdown would claim one. So the race date is the one required
 * `GeneratorInput` field the stored plan does not carry, and it is the reason the
 * per-field review refused this write.
 *
 * 🔴 IT IS RECOVERABLE, AND I SAID IT WAS NOT. The backlog entry read *"the race
 * date for those two is not approximate — it is gone"*, after I checked
 * `plan_json.meta`, `plan_archive` (0 rows) and `user_settings`. The founder asked
 * *"are you confident? can we not recover it?"* and the answer was no: it survives
 * in the `plan_refused_by_design` telemetry as `weeks_to_race`, a source the review
 * never read. **Three places checked is not "nowhere".**
 *
 * ⚠️ SO THE DATE IS AN ARGUMENT, NEVER A CONSTANT, AND EVERY TARGET MUST
 * CORROBORATE IT. `weeks_to_race` is `Math.round((race_date - Date.now()) / 1 week)`
 * taken at the moment of refusal (`app/api/generate-plan/route.ts`), which pins the
 * race to a 7-day window per event. This script replays that expression against
 * each target's own refusal events and REFUSES any target whose telemetry does not
 * reproduce the supplied date. A date that cannot be corroborated is an invented
 * field, and an invented field in this stamp is worse than no stamp: `canModifyPlan`
 * only checks the field EXISTS, so any stamp unlocks the Adjust sheet and
 * `applyEdits` regenerates from whatever is there.
 *
 * ⚠️ MY FIRST INVERSION WAS WRONG IN BOTH ANCHOR AND ROUNDING — I used
 * `plan_start` + `Math.floor`, which excluded the founder's own answer from the
 * window I reported. The expression below is copied from the route, not rewritten.
 *
 * ── ORDER OF OPERATIONS (do not reorder) ─────────────────────────────────────
 * The stamp's ONLY runner-visible effect is `canModifyPlan: false -> true`. On a
 * base-build plan that door is a dead end — measured 0 of 27 and 2 of 27 offered
 * edits regenerate, and both of the 2 are perverse. `BASEBUILD-ADJUST-DOOR-01`
 * gates it. **DEPLOY THAT GATE BEFORE RUNNING THIS WITH `--apply`**, or the
 * backfill is itself the thing that opens the door.
 *
 * ── USAGE ────────────────────────────────────────────────────────────────────
 *   npx tsx scripts/backfill-generator-input.ts --race-date=YYYY-MM-DD
 *       Dry run (DEFAULT). Reads only. Prints the exact stamp and every check.
 *
 *   npx tsx scripts/backfill-generator-input.ts --race-date=YYYY-MM-DD --apply
 *       Snapshots every target plan to disk FIRST, writes, re-reads from the
 *       database, re-validates, and AUTO-REVERTS if any post-write check fails.
 *
 *   npx tsx scripts/backfill-generator-input.ts --revert=<snapshot.json>
 *       Restores `plan_json` verbatim from a snapshot. The recovery path the
 *       founder made a condition of approving this.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
}
import { validateSavedPlan, isBaseBuildPlan } from '@/lib/plan/validateStoredPlan'
import { canModifyPlan } from '@/lib/plan/modifyPlan'
import type { GeneratorInput, Plan } from '@/types/plan'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const argv = process.argv.slice(2)
const arg = (k: string) => argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1]
const APPLY = argv.includes('--apply')
const REVERT = arg('revert')
const RACE_DATE = arg('race-date')
const SNAP_DIR = '.backups'

/** The route's own expression, copied verbatim — not rewritten. */
const weeksToRace = (raceDate: string, atMs: number) =>
  Math.round((new Date(raceDate).getTime() - atMs) / 6048e5)

/** The field set is PARSED FROM THE TYPE. A hand-listed set goes short the day
 *  someone widens `GeneratorInput`, and this stamp is read by a regeneration. */
function giFields(): { all: string[]; required: string[] } {
  const src = readFileSync('types/plan.ts', 'utf8')
  const i = src.indexOf('export interface GeneratorInput')
  if (i < 0) throw new Error('could not find GeneratorInput in types/plan.ts')
  const body = src.slice(i, src.indexOf('\n}', i))
  const all: string[] = [], required: string[] = []
  for (const m of Array.from(body.matchAll(/^ {2}([a-z_]+)(\??):/gm))) {
    all.push(m[1]); if (!m[2]) required.push(m[1])
  }
  if (!all.length) throw new Error('parsed 0 GeneratorInput fields — the parse is broken, not the type')
  return { all, required }
}

/**
 * THE ONE OWNER of what gets written. The dry run and the apply call this, so
 * what you review is what lands.
 *
 * ⚠️ `!== ''` MATTERS. `meta.race_date` is the empty string, not absent, and `??`
 * does not fall back on an empty string — the trap that made the first review read
 * a lost value as a present one.
 */
export function proposedStamp(
  meta: Record<string, unknown>, fields: string[], raceDate: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) {
    const v = meta[f]
    if (v !== undefined && v !== null && v !== '') out[f] = v
  }
  out.race_date = raceDate
  return out
}

interface Target {
  id: string; user_id: string; email: string; plan: Plan
  meta: Record<string, unknown>; stamp: Record<string, unknown>
  checks: string[]; ok: boolean
}

async function revert(path: string) {
  const snap = JSON.parse(readFileSync(path, 'utf8')) as {
    taken_at: string; rows: Array<{ id: string; plan_json: Plan }>
  }
  console.log(`REVERT from ${path} (taken ${snap.taken_at}) — ${snap.rows.length} row(s)`)
  for (const r of snap.rows) {
    const { error } = await db.from('plans').update({ plan_json: r.plan_json }).eq('id', r.id)
    console.log(`  ${r.id.slice(0, 8)}  ${error ? '❌ ' + error.message : '✅ restored'}`)
  }
}

async function main() {
  if (REVERT) return revert(REVERT)
  if (!RACE_DATE || !/^\d{4}-\d{2}-\d{2}$/.test(RACE_DATE)) {
    console.error('--race-date=YYYY-MM-DD is REQUIRED. It is never hardcoded: see the header.')
    process.exit(2)
  }
  const { all, required } = giFields()
  console.log(`GeneratorInput: ${all.length} fields, ${required.length} required (parsed from types/plan.ts)`)
  console.log(`race date supplied: ${RACE_DATE} (${new Date(RACE_DATE + 'T00:00:00Z')
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })})`)
  console.log(APPLY ? '\n🔴 MODE: APPLY (snapshot first, auto-revert on failure)\n' : '\n✅ MODE: DRY RUN — nothing will be written\n')

  const { data: rows, error } = await db.from('plans').select('id, user_id, plan_json')
  if (error) { console.error(error.message); process.exit(1) }
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 })
  const email = new Map((users?.users ?? []).map(u => [u.id, u.email ?? '?']))

  // POPULATION, DERIVED — never a hand-written list of ids. Base-build only: the
  // unstamped RACE plans are a different problem and are NOT invertible (their gap
  // is `current_weekly_km` / `longest_recent_run_km`, which week 1 is a
  // many-to-one image of). Stamping those would be invention.
  const all_ = (rows ?? []) as Array<{ id: string; user_id: string; plan_json: Plan }>
  const targets: Target[] = []
  let skippedRace = 0
  for (const r of all_) {
    const plan = r.plan_json
    if (!plan?.meta || plan.meta.generator_input) continue
    if (!isBaseBuildPlan(plan)) { skippedRace++; continue }
    const meta = plan.meta as unknown as Record<string, unknown>
    targets.push({
      id: r.id, user_id: r.user_id, email: email.get(r.user_id) ?? '?', plan, meta,
      stamp: proposedStamp(meta, all, RACE_DATE), checks: [], ok: true,
    })
  }
  console.log(`population: ${targets.length} unstamped base-build plan(s); ${skippedRace} unstamped race plan(s) OUT OF SCOPE (not invertible)\n`)
  if (!targets.length) { console.log('nothing to do'); return }

  for (const t of targets) {
    const fail = (s: string) => { t.checks.push('❌ ' + s); t.ok = false }
    const pass = (s: string) => t.checks.push('✅ ' + s)
    console.log(`── ${t.id.slice(0, 8)}  ${t.email}`)

    // 1. THE DATE MUST BE CORROBORATED BY THIS RUNNER'S OWN TELEMETRY.
    const { data: evs } = await db.from('ops_events')
      .select('created_at, detail').eq('user_id', t.user_id)
      .eq('kind', 'plan_refused_by_design').order('created_at')
    const witnessed = ((evs ?? []) as Array<{ created_at: string; detail: Record<string, unknown> }>)
      .filter(e => typeof e.detail?.weeks_to_race === 'number')
    if (!witnessed.length) {
      fail('no plan_refused_by_design event carries weeks_to_race — the date cannot be corroborated')
    } else {
      const bad = witnessed.filter(e =>
        weeksToRace(RACE_DATE, Date.parse(e.created_at)) !== e.detail.weeks_to_race)
      if (bad.length) {
        fail(`${bad.length}/${witnessed.length} refusal event(s) contradict ${RACE_DATE}: `
          + bad.map(e => `${e.created_at.slice(0, 10)} recorded ${e.detail.weeks_to_race}, `
            + `${RACE_DATE} predicts ${weeksToRace(RACE_DATE, Date.parse(e.created_at))}`).join('; '))
      } else {
        pass(`${witnessed.length}/${witnessed.length} refusal event(s) reproduce ${RACE_DATE} `
          + `(weeks_to_race ${Array.from(new Set(witnessed.map(e => e.detail.weeks_to_race))).join(', ')})`)
      }
    }

    // 2. STAMP HYGIENE.
    const extra = Object.keys(t.stamp).filter(k => !all.includes(k))
    const missing = required.filter(k => t.stamp[k] === undefined)
    extra.length ? fail(`stamp carries non-GeneratorInput keys: ${extra}`)
                 : pass(`${Object.keys(t.stamp).length}/${all.length} fields, no foreign keys`)
    missing.length ? fail(`required field(s) absent, would be INVENTED: ${missing}`)
                   : pass(`all ${required.length} required fields present`)
    const drift = Object.keys(t.stamp).filter(k =>
      k !== 'race_date' && JSON.stringify(t.stamp[k]) !== JSON.stringify(t.meta[k]))
    drift.length ? fail(`value(s) differ from the stored meta they came from: ${drift}`)
                 : pass('every value byte-identical to the stored meta; race_date is the only new value')
    const rt = JSON.parse(JSON.stringify(t.stamp))
    JSON.stringify(rt) === JSON.stringify(t.stamp)
      ? pass('survives the plan_json JSON round trip') : fail('does not survive the JSON round trip')

    // 3. THE SAVE GATE, which the stamp turns ON for the first time.
    const next = { ...t.plan, meta: { ...t.plan.meta, generator_input: t.stamp } } as unknown as Plan
    const v = validateSavedPlan(next, t.stamp as unknown as GeneratorInput)
    const errs = v.filter(x => x.severity === 'error')
    errs.length ? fail(`save gate: ${errs.length} error(s) — ${errs.map(e => e.code).slice(0, 5)}`)
                : pass(`save gate: 0 errors, ${v.filter(x => x.severity === 'warn').length} warn(s)`)

    // 4. THE PLAN ITSELF IS UNTOUCHED. The live-plan policy is "do not rewrite a
    //    runner's plan mid-block", so this asserts we did not.
    const metaMinus = (p: Plan) => {
      const m = { ...(p.meta as object) } as Record<string, unknown>; delete m.generator_input
      return JSON.stringify(m)
    }
    JSON.stringify(t.plan.weeks) === JSON.stringify(next.weeks)
      ? pass('weeks byte-identical') : fail('weeks changed')
    metaMinus(t.plan) === metaMinus(next)
      ? pass('meta byte-identical apart from the stamp') : fail('meta changed beyond the stamp')

    // 5. THE DOOR. After BASEBUILD-ADJUST-DOOR-01 this must stay SHUT.
    canModifyPlan(next) === false
      ? pass('Adjust door stays shut (BASEBUILD-ADJUST-DOOR-01)')
      : fail('Adjust door would OPEN — the gate is missing or not deployed; '
           + 'measured 0/27 and 2/27 offered edits regenerate, both of the 2 perverse')

    for (const c of t.checks) console.log(`     ${c}`)
    console.log(`     stamp: ${JSON.stringify(t.stamp)}`)
    console.log(`     ${t.ok ? '✅ WOULD STAMP' : '⛔ REFUSED — not written'}`)
    console.log()
  }

  const go = targets.filter(t => t.ok)
  console.log(`${go.length} of ${targets.length} target(s) pass every check`)
  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write.')
    console.log('⚠️ Deploy BASEBUILD-ADJUST-DOOR-01 first, or check 5 fails by design.')
    return
  }
  if (!go.length) { console.log('nothing passes; nothing written'); return }

  // SNAPSHOT BEFORE THE WRITE. The founder's condition, and it is taken from the
  // database rather than from the objects in memory, so it is what is actually there.
  mkdirSync(SNAP_DIR, { recursive: true })
  const snapPath = `${SNAP_DIR}/geninput-backfill-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  const { data: fresh } = await db.from('plans').select('id, plan_json').in('id', go.map(t => t.id))
  writeFileSync(snapPath, JSON.stringify({ taken_at: new Date().toISOString(), rows: fresh ?? [] }, null, 2))
  console.log(`\n📦 snapshot: ${snapPath} (${(fresh ?? []).length} row(s))`)
  console.log(`   revert with: npx tsx scripts/backfill-generator-input.ts --revert=${snapPath}`)

  for (const t of go) {
    const next = { ...t.plan, meta: { ...t.plan.meta, generator_input: t.stamp } }
    const { error: e } = await db.from('plans').update({ plan_json: next }).eq('id', t.id)
    console.log(`  ${t.id.slice(0, 8)}  ${e ? '❌ ' + e.message : 'written'}`)
    if (e) { console.log('  write failed — reverting everything'); await revert(snapPath); process.exit(1) }
  }

  // RE-READ FROM THE DATABASE AND RE-CHECK. A write that returned ok is what the
  // old delete route believed too (DB-USER-PURGE-01): verify from the source.
  console.log('\n── post-write verification (re-read from the database) ──')
  let bad = 0
  const { data: after } = await db.from('plans').select('id, plan_json').in('id', go.map(t => t.id))
  for (const r of (after ?? []) as Array<{ id: string; plan_json: Plan }>) {
    const t = go.find(x => x.id === r.id)!
    const gi = (r.plan_json.meta as unknown as Record<string, unknown>).generator_input
    const errs = validateSavedPlan(r.plan_json, gi as GeneratorInput).filter(x => x.severity === 'error')
    const weeksOk = JSON.stringify(r.plan_json.weeks) === JSON.stringify(t.plan.weeks)
    const stampOk = JSON.stringify(gi) === JSON.stringify(t.stamp)
    const doorOk  = canModifyPlan(r.plan_json) === false
    const ok = !!gi && !errs.length && weeksOk && stampOk && doorOk
    if (!ok) bad++
    console.log(`  ${r.id.slice(0, 8)}  stamp=${stampOk ? '✅' : '❌'} weeks=${weeksOk ? '✅' : '❌'} `
      + `gate=${errs.length ? '❌ ' + errs.length : '✅'} door=${doorOk ? '✅ shut' : '❌ OPEN'}  ${ok ? '✅' : '❌'}`)
  }
  if (bad) {
    console.log(`\n❌ ${bad} row(s) failed post-write verification — REVERTING`)
    await revert(snapPath)
    process.exit(1)
  }
  console.log(`\n✅ ${go.length} row(s) stamped and verified. Snapshot kept at ${snapPath}`)
}
main()
