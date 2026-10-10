/**
 * `BASEBUILD-GENINPUT-REMEDIATION-01` — PER-FIELD RECOVERABILITY REVIEW.
 *
 * 🔴 READ-ONLY. Writes nothing. The founder approved option B (backfill) on the
 * explicit condition that we can recover, that it is thoroughly tested, and that
 * we correct it if we get it wrong. This script is step one: for each unstamped
 * plan, say for EVERY `GeneratorInput` field whether the value is RECOVERABLE
 * (present in the stored plan), DERIVABLE (computable from stored data, with the
 * derivation named), or INVENTED (neither — must never be written).
 *
 * ⚠️ A STAMP CONTAINING AN INVENTED FIELD IS WORSE THAN NO STAMP. `canModifyPlan`
 * only checks the field EXISTS, so any stamp unlocks the Adjust sheet, and
 * `applyEdits` then regenerates from whatever is there. An invented value would
 * silently change something the runner never asked to change — the exact risk
 * the sheet is withheld to avoid.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

/** Parsed from the type, never hand-listed — a hand-listed field set goes short. */
function generatorInputFields(): { required: string[]; all: string[] } {
  const src = readFileSync('types/plan.ts', 'utf8')
  const i = src.indexOf('export interface GeneratorInput')
  const body = src.slice(i, src.indexOf('\n}', i))
  const all: string[] = [], required: string[] = []
  // `Array.from`, never a spread/for-of over an iterator — CLAUDE.md § TypeScript.
  for (const m of Array.from(body.matchAll(/^ {2}([a-z_]+)(\??):/gm))) {
    all.push(m[1]); if (!m[2]) required.push(m[1])
  }
  return { required, all }
}

type Verdict = 'recoverable' | 'derivable' | 'invented'

async function main() {
  const { required, all } = generatorInputFields()
  console.log(`GeneratorInput: ${all.length} fields, ${required.length} required (parsed from types/plan.ts)\n`)

  const { data: plans, error } = await db.from('plans').select('id, user_id, created_at, plan_json')
  if (error) { console.error(error.message); process.exit(1) }
  const unstamped = (plans ?? []).filter((r: Record<string, unknown>) => {
    const p = r.plan_json as { meta?: Record<string, unknown> } | null
    return !!p && !p.meta?.generator_input
  })

  const tally: Record<string, Record<Verdict, number>> = {}
  for (const f of all) tally[f] = { recoverable: 0, derivable: 0, invented: 0 }

  for (const row of unstamped as Array<Record<string, unknown>>) {
    const p = row.plan_json as { meta: Record<string, unknown>; weeks: Array<Record<string, unknown>> }
    const meta = p.meta ?? {}
    const kind = String(meta.plan_kind ?? '(race)')
    console.log(`── ${String(row.id).slice(0, 8)}  ${String(row.created_at).slice(0, 10)}  kind=${kind}`)
    const lines: string[] = []
    for (const f of all) {
      let verdict: Verdict = 'invented'
      let how = ''
      const direct = meta[f]
      // RECOVERABLE — the value is literally in meta, and not an empty sentinel.
      // ⚠️ `race_date: ''` is the known trap: the base-build writer overwrites it
      // AFTER spreading the input, so an empty string is a LOST value wearing a
      // present one. `??` does not catch it (feedback: nullish-does-not-catch-empty).
      if (direct !== undefined && direct !== null && direct !== '' &&
          !(Array.isArray(direct) && direct.length === 0 && f !== 'days_cannot_train' && f !== 'injury_history')) {
        verdict = 'recoverable'; how = `meta.${f} = ${JSON.stringify(direct)}`.slice(0, 70)
      } else if (f === 'race_date' && typeof meta.weeks_to_race === 'number' && meta.plan_start) {
        verdict = 'derivable'
        how = `plan_start + weeks_to_race*7 (±6 days — the exact day is LOST)`
      } else if (f === 'plan_start' && meta.plan_start) {
        verdict = 'recoverable'; how = `meta.plan_start`
      } else if ((f === 'days_cannot_train' || f === 'injury_history') && Array.isArray(direct)) {
        verdict = 'recoverable'; how = `meta.${f} = [] (an empty list is an ANSWER here)`
      }
      tally[f][verdict]++
      if (verdict !== 'recoverable') {
        lines.push(`     ${verdict === 'derivable' ? '🟡' : '🔴'} ${f.padEnd(28)} ${verdict.padEnd(11)} ${how || 'nothing in the stored plan carries it'}`)
      }
    }
    const req = lines.filter(l => required.some(r => l.includes(` ${r} `)))
    console.log(`     recoverable ${all.length - lines.length}/${all.length}` + (lines.length ? '' : '  ✅ complete'))
    for (const l of lines) console.log(l)
    if (req.length) console.log(`     ⚠️ ${req.length} REQUIRED field(s) not directly recoverable`)
    console.log()
  }

  // THE CRUX: which plans have the SHAPE-DRIVING inputs, and which have the race date?
  console.log('═══ THE SPLIT — can ANY plan be stamped completely? ═══')
  const KEY = ['current_weekly_km', 'longest_recent_run_km', 'race_date', 'age', 'days_available', 'race_distance_km', 'goal']
  for (const row of unstamped as Array<Record<string, unknown>>) {
    const p2 = row.plan_json as { meta: Record<string, unknown> }
    const m2 = p2.meta ?? {}
    const have = KEY.filter(f => {
      const v = m2[f]
      return v !== undefined && v !== null && v !== ''
    })
    const miss = KEY.filter(f => !have.includes(f))
    console.log(`  ${String(row.id).slice(0,8)} kind=${String(m2.plan_kind ?? '(race)').padEnd(10)} missing REQUIRED: ${miss.length ? miss.join(', ') : 'NONE — complete'}`)
  }
  console.log()

  console.log('═══ ACROSS ALL ' + unstamped.length + ' UNSTAMPED PLANS ═══')
  console.log(`${'field'.padEnd(30)} ${'req'.padEnd(4)} recoverable  derivable  INVENTED`)
  for (const f of all) {
    const t = tally[f]
    const flag = t.invented > 0 ? '  🔴' : t.derivable > 0 ? '  🟡' : ''
    console.log(`${f.padEnd(30)} ${(required.includes(f) ? 'YES' : '-').padEnd(4)} ${String(t.recoverable).padStart(11)} ${String(t.derivable).padStart(10)} ${String(t.invented).padStart(9)}${flag}`)
  }
}
main()
