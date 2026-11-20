import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main() {
  const { data, error } = await db.from('plans').select('id, user_id, plan_json')
  if (error) throw error
  console.log('plans total', data!.length)
  const kinds: Record<string, number> = {}
  for (const r of data as any[]) {
    const meta = r.plan_json?.meta ?? {}
    const k = String(meta.plan_kind ?? (r.plan_json?.staged_race ? 'staged' : 'race?'))
    kinds[k] = (kinds[k] ?? 0) + 1
    if (k === 'base_build' || k === 'get_running' || meta.staged_race || r.plan_json?.staged_race) {
      const gi = meta.generator_input ?? {}
      let tot = 0, nodur = 0, wd = 0, over = 0
      const cap = gi.max_weekday_mins
      for (const w of r.plan_json.weeks ?? []) {
        if (!['base_build','foundation','get_running'].includes(String(w.phase))) continue
        for (const [d, s] of Object.entries<any>(w.sessions ?? {})) {
          if (!s || s.type === 'rest') continue
          tot++; if (!s.duration_mins) nodur++
        }
      }
      console.log(r.id.slice(0,8), k, 'cap', cap, 'days', gi.days_available, 'blocked', JSON.stringify(gi.days_cannot_train ?? null), 'cw', gi.current_weekly_km, 'ramp sessions', tot, 'no-duration', nodur)
    }
  }
  console.log(kinds)
}
main()
