/**
 * REAL-CORPUS-01 — refresh the real-input regression corpus from production.
 *
 *   npx tsx --env-file=.env.local scripts/sync-plan-corpus.ts
 *
 * Reads `plan_json.meta.generator_input` from every stored plan (persisted since
 * PV2-A, fff1ab3) and rewrites lib/plan/__fixtures__/real-inputs.json.
 *
 * WHY: the property sweep's grid is hand-authored and was repeatedly wrong about
 * what real people enter. It tested `max_weekday_mins` 45/60/90 while both real
 * users had chosen 30, and 0 of 18,060 swept plans carried a foundation block.
 * Three defects shipped behind a green sweep in one day. Four REAL inputs then
 * caught two of them immediately. Invented inputs test invented users.
 *
 * The output is COMMITTED so `npm run verify` stays offline and deterministic —
 * this script is run by a human when the corpus is worth refreshing, not by CI.
 *
 * REDACTION: `athlete_name` and `race_name` are dropped. Neither affects plan
 * structure (race_name is display only), and they are the only free-text
 * identifying fields in the input. Everything retained is a value the engine
 * actually consumes.
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = join(process.cwd(), 'lib/plan/__fixtures__/real-inputs.json')
const REDACT = ['athlete_name', 'race_name'] as const

async function main() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Run with:  npx tsx --env-file=.env.local scripts/sync-plan-corpus.ts')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data, error } = await supabase
  .from('plans')
  .select('id, created_at, plan_json')
  .order('created_at', { ascending: true })

if (error) { console.error('query failed:', error.message); process.exit(1) }

const existing = JSON.parse(readFileSync(OUT, 'utf8')) as {
  cases: Array<{ id: string; note?: string }>
}
const notes = new Map(existing.cases.map(c => [c.id, c.note]))

let skipped = 0
const cases = (data ?? []).flatMap(row => {
  const meta = (row.plan_json as Record<string, any>)?.meta ?? {}
  const input = meta.generator_input
  if (!input) { skipped++; return [] }
  const clean = { ...input }
  for (const f of REDACT) delete clean[f]
  const id = String(row.id).slice(0, 8)
  return [{
    id,
    captured: String(row.created_at).slice(0, 10),
    plan_start: meta.plan_start ?? String(row.created_at).slice(0, 10),
    tier: meta.tier ?? 'trial',
    // Hand-written notes explain WHY a case earns its place. Preserved across
    // refreshes — losing them would reduce the corpus to anonymous rows.
    ...(notes.get(id) ? { note: notes.get(id) } : {}),
    input: clean,
  }]
})

const out = {
  ...existing,
  captured_at: new Date().toISOString().slice(0, 10),
  source: 'plans.plan_json->meta->generator_input (persisted since PV2-A, fff1ab3)',
  cases,
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')

console.log(`✓ corpus refreshed: ${cases.length} cases (${skipped} plans skipped — pre-PV2-A, no persisted input)`)
const caps = Array.from(new Set(cases.map(c => (c.input as Record<string, unknown>).max_weekday_mins).filter(Boolean)))
console.log(`  max_weekday_mins values present: ${caps.sort().join(', ') || 'none'}`)
console.log(`  wrote ${OUT}`)
console.log('  Review the diff, then commit — this file is a test fixture.')
}

main().catch(e => { console.error(e); process.exit(1) })
