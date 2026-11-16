// board-evidence-maxhr-reconcile.ts — MAXHR-RECENCY-01, re-measured through the OWNER.
//
// READ-ONLY. 🔴 The item claims the stored max is never raised by the runner's own runs and
// that 2 of 20 runners sit below their own recent peak. **`resolveMaxHr` already floors a
// sub-estimate `observed` max to the Tanaka age estimate** (§50, `MAX_HR_BELOW_ESTIMATE_
// TOLERANCE_PCT = 0`), so the stored number is not necessarily the number the zones are
// built on. This asks the question through the owner instead of through the column.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolveMaxHr, tanakaMaxHR } from '../lib/plan/maxHrGuard'

const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))

async function main() {
  const { data: settings } = await sb.from('user_settings')
    .select('id, max_hr, max_hr_source, birth_year, date_of_birth')
  const { data: acts } = await sb.from('strava_activities')
    .select('user_id, max_hr, start_date').not('max_hr', 'is', null)
  const peak: Record<string, { hr: number; date: string }> = {}
  for (const a of acts ?? []) {
    const u = String(a.user_id)
    if (!peak[u] || (a.max_hr as number) > peak[u].hr) peak[u] = { hr: a.max_hr as number, date: String(a.start_date).slice(0, 10) }
  }
  const today = new Date('2026-11-16')
  const ageOf = (r: Record<string, unknown>): number | null => {
    if (r.date_of_birth) return today.getFullYear() - new Date(String(r.date_of_birth)).getFullYear()
    if (r.birth_year) return today.getFullYear() - Number(r.birth_year)
    return null
  }
  let n = 0, noAge = 0, peakOverEffective = 0, flooredAlready = 0
  const rows: string[] = []
  for (const s of settings ?? []) {
    const pk = peak[String(s.id)]
    if (!pk) continue
    n++
    const age = ageOf(s as never)
    if (age == null) { noAge++; continue }
    const r = resolveMaxHr(s.max_hr as number, age, (s.max_hr_source ?? undefined) as never)
    if (r.outcome === 'floored') flooredAlready++
    // THE REAL QUESTION: does the runner's own recorded peak exceed the max the zones use?
    if (pk.hr > r.effectiveMax) {
      peakOverEffective++
      const ageD = Math.round((today.getTime() - new Date(pk.date).getTime()) / 86400000)
      rows.push(`  ${String(s.id).slice(0, 8)} stored=${s.max_hr} src=${s.max_hr_source} age=${age} tanaka=${tanakaMaxHR(age)} -> effective=${r.effectiveMax} (${r.outcome})  own peak ${pk.hr} on ${pk.date} (${ageD}d) = +${pk.hr - r.effectiveMax} OVER`)
    }
  }
  console.log(`runners with both a stored max and an HR-bearing activity: ${n}`)
  console.log(`  no age on file (resolveMaxHr cannot be asked): ${noAge}`)
  console.log(`  stored max already FLOORED to the estimate by §50: ${flooredAlready}`)
  console.log(`  🔴 own recorded peak ABOVE the max the zones are built on: ${peakOverEffective}`)
  rows.forEach(r => console.log(r))
}
main().catch(e => { console.error(e); process.exit(1) })
