// backfill-plan-strides.ts — PLAN-STRIDES-BACKFILL-01, 2026-09-24.
//
// Appends §28 Amendment 3's stride note to the weeks of a LIVE plan that were
// generated before Am.3 shipped and therefore carry none.
//
// ⚠️ A DELIBERATE ONE-OFF AGAINST THE LIVE-PLAN POLICY, founder-directed.
// The standing rule (2026-08-20) is that doctrine and engine fixes apply to NEW
// plans only — no backfill, no reshape, no migration. This exists because the
// founder asked for one named runner to be fixed: "I want to fix that for him."
// **It is not a precedent.** Anything that reads this as licence to backfill the
// next engine change is reading it wrong.
//
// ── WHY APPEND RATHER THAN REGENERATE ────────────────────────────────────────
//
// Regeneration is the obvious move and it is the wrong one. `plan_json.meta` does
// NOT carry `days_cannot_train` or `preferred_long_run_day`, so the inputs that
// produced the plan cannot be faithfully reproduced — regeneration would yield a
// DIFFERENT plan, not this plan plus strides. It would also sweep in every engine
// change since the plan was created and discard the AI-enriched voice.
//
// ── WHAT IT WRITES ───────────────────────────────────────────────────────────
//
// One coach note and one label edit per qualifying session. Nothing else. No
// distance, no duration, no day, no week number — so `week_n`/`day` keys stay
// intact and completions, run links and overrides are untouched
// (PLAN-WEEK-COLLISION-01's whole hazard is avoided by not going near them).
//
// The note, the label and the eligible DAY all come from the engine's own owners
// — `strideCarrierDay`, `neuromuscularNote`, `neuromuscularLabel` — so what a
// backfilled runner gets is identical to what a newly generated plan gets. Hand
// -writing the string here would be a second answer that drifts from the first.
//
// Run (DRY by default — it will not write without --apply):
//   npx tsx scripts/backfill-plan-strides.ts --plan e49ea589
//   npx tsx scripts/backfill-plan-strides.ts --plan e49ea589 --apply

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { strideCarrierDay, neuromuscularNote, neuromuscularLabel } from '../lib/plan/neuromuscular'
import { isLongRun } from '../lib/plan/sessionRole'
import { validatePlan } from '../lib/plan/invariants'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { Day } from '../lib/plan/days'

const DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const MAX_NOTES = 3   // `coach_notes` is a bounded tuple [string, string?, string?]

function env() {
  return Object.fromEntries(
    readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
      .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
  ) as Record<string, string>
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

interface Change { week: number; day: Day; note: string; labelFrom: string; labelTo: string }

async function main(): Promise<number> {
  const prefix = arg('--plan')
  const apply = process.argv.includes('--apply')
  if (!prefix) {
    console.error('usage: npx tsx scripts/backfill-plan-strides.ts --plan <id-prefix> [--apply]')
    return 64
  }

  const e = env()
  const sb = createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await sb.from('plans').select('id, user_id, plan_json')
  if (error) { console.error('read failed:', error.message); return 1 }
  const matches = (data ?? []).filter((r: { id: string }) => r.id.startsWith(prefix))
  if (matches.length !== 1) {
    console.error(`--plan ${prefix} matched ${matches.length} plans; need exactly 1`)
    return 1
  }
  const row = matches[0] as { id: string; user_id: string; plan_json: Record<string, unknown> }
  const plan = JSON.parse(JSON.stringify(row.plan_json))   // deep copy; the original stays pristine for the archive
  const meta = (plan.meta ?? {}) as Record<string, unknown>

  // ⚠️ A RECONSTRUCTED INPUT, AND ITS LIMIT IS STATED RATHER THAN HIDDEN.
  // `meta` does not carry every GeneratorInput field, so this is NOT a faithful
  // input and the ABSOLUTE violation set it produces may be wrong. What is
  // trustworthy is the DELTA: the same input is used before and after, so any
  // difference is caused by this script and nothing else.
  const input = { ...meta } as never

  const before = validatePlan(plan as never, input)
  const raceWeekN = Math.max(0, ...(plan.weeks as { n: number }[]).map(w => w.n))

  const changes: Change[] = []
  const skipped: string[] = []

  for (const w of plan.weeks as Record<string, never>[]) {
    const week = w as unknown as { n: number; type: string; sessions: Record<Day, Record<string, unknown> | undefined> }
    if (week.n < GENERATION_CONFIG.STRIDES_FIRST_WEEK) { skipped.push(`w${week.n}: before STRIDES_FIRST_WEEK`); continue }
    if (week.type === 'deload') { skipped.push(`w${week.n}: deload (§28 exempt)`); continue }
    if (week.n === raceWeekN) { skipped.push(`w${week.n}: race week (§28 exempt)`); continue }

    const already = Object.values(week.sessions).some(s =>
      s && /strides/i.test(((s.coach_notes as string[]) ?? []).join(' ')))
    if (already) { skipped.push(`w${week.n}: already carries strides — IDEMPOTENT, left alone`); continue }

    const longDay = DAYS.find(d => week.sessions[d] && isLongRun(week.sessions[d] as never))
    if (!longDay) { skipped.push(`w${week.n}: no long run found`); continue }

    // ⚠️ AN EMPTY `blocked` SET IS CORRECT HERE, and it is not laziness.
    // `meta` does not store `days_cannot_train`. It does not matter:
    // `strideCarrierDay` already skips any day with no session, and a day that
    // HAS a session cannot be one the runner declared unavailable. The answer is
    // identical either way for a plan that has already been built.
    const carrier = strideCarrierDay(week.sessions as never, longDay, new Set<Day>())
    if (!carrier) { skipped.push(`w${week.n}: no §28-eligible carrier even under Am.3`); continue }

    const s = week.sessions[carrier]!
    const notes = ((s.coach_notes as string[]) ?? []).filter(Boolean)
    if (notes.length >= MAX_NOTES) { skipped.push(`w${week.n} ${carrier}: coach_notes already full (${MAX_NOTES})`); continue }

    // §28 Am.3 — the carrier is the day AFTER the long run here, so hills are
    // refused and the alternation collapses to its safe arm. Passed as a
    // structural fact, exactly as ruleEngine does it, never inferred from a string.
    const postLR = carrier === DAYS[(DAYS.indexOf(longDay) + 1) % 7]
    const level = meta.fitness_level as string | undefined
    const injuries = (meta.injury_history as string[] | undefined) ?? []
    const note = neuromuscularNote(week.n, level, injuries, postLR)
    const labelFrom = (s.label as string) ?? ''
    const labelTo = labelFrom ? neuromuscularLabel(labelFrom, week.n, level, injuries, postLR) : labelFrom

    s.coach_notes = [...notes, note]
    if (labelTo !== labelFrom) s.label = labelTo
    changes.push({ week: week.n, day: carrier, note, labelFrom, labelTo })
  }

  const after = validatePlan(plan as never, input)
  const newCodes = after.filter(v => !before.some(b => b.code === v.code && b.week === v.week))

  console.log(`plan ${row.id.slice(0, 8)}  user ${row.user_id}`)
  console.log(`\nskipped (${skipped.length}):`)
  skipped.forEach(s => console.log(`  ${s}`))
  console.log(`\nwould change (${changes.length}):`)
  for (const c of changes) {
    console.log(`  w${c.week} ${c.day}`)
    console.log(`    + note  : ${c.note}`)
    if (c.labelTo !== c.labelFrom) console.log(`    ~ label : "${c.labelFrom}" -> "${c.labelTo}"`)
  }
  console.log(`\nvalidatePlan  before: ${before.length} violation(s)   after: ${after.length}`)
  console.log(`  NO-CARRIER before: ${before.filter(v => v.code === 'INV-PLAN-STRIDES-NO-CARRIER').length}`
    + `  after: ${after.filter(v => v.code === 'INV-PLAN-STRIDES-NO-CARRIER').length}`)
  if (newCodes.length) {
    console.error(`\n✗ REFUSING TO WRITE — the edit introduces ${newCodes.length} new violation(s):`)
    newCodes.forEach(v => console.error(`    ${v.code} w${v.week}: ${v.message}`))
    return 1
  }
  if (!changes.length) { console.log('\nnothing to do.'); return 0 }

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.')
    return 0
  }

  // Archive the PRISTINE prior first, mirroring lib/plan.ts's shape. Inserted
  // unconditionally: a spare archive row is strictly safer than none, and this
  // is the only route back if the edit is wrong.
  const prior = row.plan_json as { meta?: { race_name?: string; race_date?: string } }
  const arch = await sb.from('plan_archive').insert({
    user_id: row.user_id,
    plan_json: prior,
    race_name: prior.meta?.race_name ?? null,
    race_date: prior.meta?.race_date ?? null,
  })
  if (arch.error) { console.error(`✗ archive failed, NOT writing: ${arch.error.message}`); return 1 }
  console.log('\narchived prior plan_json to plan_archive')

  const upd = await sb.from('plans').update({ plan_json: plan }).eq('id', row.id)
  if (upd.error) { console.error(`✗ write failed: ${upd.error.message}`); return 1 }
  console.log(`✓ wrote ${changes.length} stride note(s) to plan ${row.id.slice(0, 8)}`)
  return 0
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1) })
