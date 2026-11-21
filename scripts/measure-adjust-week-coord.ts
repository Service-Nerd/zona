// ADJUST-WEEK-COORD-01 — READ-ONLY measurement of the adjustments written to the wrong week.
//
//   npx tsx --env-file=.env.local scripts/measure-adjust-week-coord.ts [--ids]
//
// Until the fix, `/api/adjust-plan` keyed an adjustment on `getCurrentWeekIndex(weeks) + 1` (a
// POSITION): it read the sessions at that position, stored that number as the row's `week_n`,
// and wrote `weeks.find(w => w.n === week_n)`. On a plan with foundation weeks (n <= 0) the
// stored key and the written week are LATER than the runner's week by the foundation block.
//
// For every live `plan_adjustments` row on a plan whose `week.n` differs from its position, this
// prints what the row did, to which week, whether the plan still carries the misplaced write,
// and whether an exact restore source exists. It WRITES NOTHING and prints no personal data:
// plans and rows are named by a hash prefix of their id. `--ids` adds the full adjustment ids
// (not user ids) for the repair SQL in docs/runbooks/adjust-week-coord-repair.md.
//
// The repaired/not-repaired predicate is `repairState` (lib/ops/adjustWeekCoordRepair.ts),
// which carries its own both-states test.
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { findWeekByN, getWeekIndexForDate, weekNAt } from '../lib/plan/weekResolution'
import { repairState } from '../lib/ops/adjustWeekCoordRepair'
import type { Plan, Session } from '../types/plan'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const SHOW_IDS = process.argv.includes('--ids')
const ref = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 10)
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const fieldsChanged = (a: Record<string, unknown> | null, b: Record<string, unknown> | null) =>
  Array.from(new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])).filter(k => !same(a?.[k], b?.[k])).sort()

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (use --env-file=.env.local)'); process.exit(2) }
  const sb = createClient(url, key, { auth: { persistSession: false } })

  const { data: plans, error: pErr } = await sb.from('plans').select('user_id, plan_json')
  if (pErr || !plans) { console.error('plans read failed', pErr); process.exit(2) }
  const shifted = new Map<string, Plan>()
  let foundation = 0
  for (const row of plans) {
    const p = row.plan_json as Plan | null
    if (!p?.weeks?.length || !p.weeks.some((w, i) => w.n !== i + 1)) continue
    shifted.set(row.user_id as string, p)
    if (p.weeks.some(w => w.n <= 0)) foundation++
  }
  console.log(`plans: ${plans.length} · week.n != position: ${shifted.size} (with foundation weeks n<=0: ${foundation})`)

  const { data: adjs, error: aErr } = await sb.from('plan_adjustments')
    .select('id, user_id, week_n, created_at, status, trigger_type, adjustment_type, sessions_before, sessions_after')
    .is('superseded_at', null)
  if (aErr || !adjs) { console.error('plan_adjustments read failed', aErr); process.exit(2) }
  const onShifted = adjs.filter(a => shifted.has(a.user_id as string))
    .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
  console.log(`live plan_adjustments: ${adjs.length} · on shifted plans: ${onShifted.length} · distinct plans: ${new Set(onShifted.map(a => a.user_id)).size}`)

  let notRepaired = 0, signature = 0
  for (const a of onShifted) {
    const plan = shifted.get(a.user_id as string)!
    const idx = getWeekIndexForDate(plan.weeks, new Date(a.created_at as string))
    const runnersN = weekNAt(plan.weeks, idx)
    // The defect's coordinate: the position + 1 at creation. It is what was stored AND written.
    const defectN = idx + 1
    const written = findWeekByN(plan.weeks, defectN)
    const before = (a.sessions_before ?? []) as (Session | null)[]
    const after = (a.sessions_after ?? []) as (Session | null)[]
    const changed = DAYS.filter((_, i) => !same(before[i], after[i]) && after[i] != null)
    const isSignature = (a.week_n as number) === defectN && defectN !== runnersN
    if (isSignature) signature++

    // Is there an exact restore source? `plan_archive` is written by `savePlanForUser` BEFORE a
    // save; the nearest archive is only usable if it is the SAME generation as the live plan.
    const { data: arch } = await sb.from('plan_archive').select('archived_at, plan_json')
      .eq('user_id', a.user_id as string).lt('archived_at', a.created_at as string)
      .order('archived_at', { ascending: false }).limit(1)
    const archived = (arch?.[0]?.plan_json ?? null) as Plan | null
    const sameGen = archived
      ? same((archived.meta as { generated_at?: string }).generated_at, (plan.meta as { generated_at?: string }).generated_at)
      : null
    const archWritten = archived ? findWeekByN(archived.weeks, defectN) : undefined

    const st = repairState({
      writtenWeekSessions: written?.sessions as Record<string, unknown> | undefined,
      sessionsAfter: after, storedWeekN: a.week_n as number, runnersWeekN: runnersN,
    })
    if (!st.repaired) notRepaired++
    const runnersWeekHasNote = changed.filter(d => same(findWeekByN(plan.weeks, runnersN)?.sessions?.[d], after[DAYS.indexOf(d)])).length
    // On the CHANGED days: the unchanged ones include rest slots `orderedWeekSessions` materialises
    // as `{ type: 'rest' }` where the stored week has no key, so a whole-week compare reads false.
    const beforeIsRunnersWeek = changed.every(d => same(findWeekByN(plan.weeks, runnersN)?.sessions?.[d], before[DAYS.indexOf(d)]))

    console.log(`\nadj ${ref(a.id as string)}${SHOW_IDS ? ` (${a.id})` : ''} · plan ${ref(a.user_id as string)} · ${String(a.created_at).slice(0, 10)} · ${a.trigger_type}/${a.adjustment_type} · ${a.status}`)
    console.log(`  runner's week: n=${runnersN} (position ${idx + 1}) · stored week_n=${a.week_n} · written week: ${written ? `n=${written.n}, starts ${written.date}` : 'NONE'} · defect signature: ${isSignature}`)
    console.log(`  sessions_before (changed days) is the runner's week as it stands now: ${beforeIsRunnersWeek} · before→after changed ${changed.length} days, fields ${JSON.stringify(Array.from(new Set(changed.flatMap(d => fieldsChanged(before[DAYS.indexOf(d)] as never, after[DAYS.indexOf(d)] as never)))))}`)
    console.log(`  written week carries the write on ${st.writeStillPresentDays}/${st.writtenDays} days · runner's own week carries the note on ${runnersWeekHasNote}/${changed.length} changed days`)
    console.log(`  nearest earlier archive: ${archived ? `${Math.round((Date.parse(a.created_at as string) - Date.parse(arch![0].archived_at as string)) / 864e5)} d earlier, same generation: ${sameGen}, differs from what was written on ${DAYS.filter((d, i) => after[i] != null && !same(archWritten?.sessions?.[d], after[i])).length}/${st.writtenDays} days` : 'none'}`)
    console.log(`  → ${st.repaired ? 'REPAIRED' : 'NOT REPAIRED'} (write present ${st.writeStillPresentDays}/${st.writtenDays}, key corrected ${st.keyCorrected})`)
  }
  console.log(`\nsummary: ${onShifted.length} rows on shifted plans · defect signature ${signature} · NOT REPAIRED ${notRepaired}`)

  // The other week-keyed tables. Two questions per table, over ALL live plans:
  //  · ORPHAN: a `week_n` no week of the runner's live plan carries. `findWeekByN` used to send
  //    these to whatever week sat at that position; it now returns undefined.
  //  · EARLY: a row on a shifted plan written BEFORE its week began. The missed-session prompt
  //    keyed completions on position + 1, so on a foundation plan it wrote them to a later week.
  const live = new Map<string, Plan>(plans.filter(r => (r.plan_json as Plan | null)?.weeks?.length).map(r => [r.user_id as string, r.plan_json as Plan]))
  for (const t of ['session_completions', 'run_analysis', 'session_overrides', 'plan_adjustments'] as const) {
    // `session_overrides` has no `created_at`; it can be checked for orphans only.
    const cols = t === 'session_overrides' ? 'user_id, week_n' : t === 'plan_adjustments' ? 'user_id, week_n, created_at' : 'user_id, week_n, session_day, created_at'
    const { data: raw, error } = await sb.from(t).select(cols).is('superseded_at', null)
    const data = raw as unknown as { user_id: string; week_n: number; session_day?: string; created_at?: string }[] | null
    if (error || !data) { console.log(`${t}: read failed (${error?.message})`); continue }
    const onLive = data.filter(r => live.has(r.user_id as string))
    const orphan = onLive.filter(r => !live.get(r.user_id as string)!.weeks.some(w => w.n === r.week_n))
    const rows = data.filter(r => shifted.has(r.user_id as string))
    const early = rows.filter(r => {
      const w = findWeekByN(shifted.get(r.user_id as string)!.weeks, r.week_n as number)
      return w && r.created_at && Date.parse(String(r.created_at)) < Date.parse(`${w.date}T00:00:00Z`)
    })
    console.log(`${t}: ${onLive.length} live rows · orphan week_n: ${orphan.length} · on shifted plans: ${rows.length} (week_n <= 0: ${rows.filter(r => (r.week_n as number) <= 0).length}, written before their week began: ${t === 'session_overrides' ? 'n/a' : early.length})`)
    if (t === 'plan_adjustments') continue   // listed in full above
    for (const r of early) {
      const p = shifted.get(r.user_id)!
      const i = getWeekIndexForDate(p.weeks, new Date(String(r.created_at)))
      const clash = data.some(o => o.user_id === r.user_id && o.week_n === weekNAt(p.weeks, i) && o.session_day === r.session_day)
      console.log(`  ${t} · plan ${ref(r.user_id)} · week_n=${r.week_n} ${r.session_day} · written ${String(r.created_at).slice(0, 10)} when the runner was in n=${weekNAt(p.weeks, i)} (position + 1 = ${i + 1}) · a row already exists at (n=${weekNAt(p.weeks, i)}, ${r.session_day}): ${clash}`)
    }
  }
  const recal = Array.from(shifted.values()).filter(p => (p.meta as { taper_recalibrated_at?: string }).taper_recalibrated_at).length
  console.log(`shifted plans with meta.taper_recalibrated_at set: ${recal}`)
}

main().catch(e => { console.error(e); process.exit(1) })
