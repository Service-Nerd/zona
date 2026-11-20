// READ-ONLY board evidence for RUNKED-GARMIN-01 (SLT 2026-11-20). Selects only; writes nothing.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g,'') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function all(table: string, cols: string, f?: (q: any) => any) {
  const out: any[] = []; let from = 0
  for (;;) { let q = sb.from(table).select(cols).range(from, from + 999); if (f) q = f(q)
    const { data, error } = await q; if (error) throw new Error(table + ': ' + error.message)
    out.push(...data!); if (data!.length < 1000) break; from += 1000 }
  return out
}
const pct = (n: number, d: number) => d ? `${n}/${d} (${(100 * n / d).toFixed(1)}%)` : `${n}/0`
;(async () => {
  const one = await sb.from('strava_activities').select('*').limit(1)
  console.log('columns:', Object.keys(one.data?.[0] ?? {}).join(', '))
  const acts = await all('strava_activities', '*')
  console.log('total activity rows', acts.length)
  const by = (k: string) => acts.reduce((m: any, a: any) => (m[a[k]] = (m[a[k]] ?? 0) + 1, m), {})
  console.log('by source', by('source'))
  const names = by('name'); console.log('names (top)', Object.entries(names).sort((a: any, b: any) => b[1] - a[1]).slice(0, 15))
  const g = acts.filter(a => a.name === 'Run (Connect)')
  const gUsers = new Set(g.map(a => a.user_id))
  console.log('Run (Connect) rows', g.length, 'users', gUsers.size, 'dates', g.map(a => a.start_date).sort()[0], '→', g.map(a => a.start_date).sort().slice(-1)[0])
  const fields = ['splits_metric','hr_bpm_histogram','raw_payload','avg_hr','max_hr','hr_pct_z2','hr_in_zone_pct','elevation_gain','distance_m','calories_kcal','avg_temp_c','avg_cadence','hr_zones','splits','laps','polyline','map']
  const ah = acts.filter(a => a.source === 'apple_health')
  for (const f of fields) if (f in (acts[0] ?? {})) {
    const nz = (x: any) => x[f] != null && x[f] !== 0
    console.log(`field ${f}: Garmin(Connect) ${pct(g.filter(nz).length, g.length)} | all apple_health ${pct(ah.filter(nz).length, ah.length)}`)
  }
  // per-user Garmin share
  for (const u of Array.from(gUsers)) { const mine = acts.filter(a => a.user_id === u)
    console.log('garmin user', String(u).slice(0, 8), 'connect rows', mine.filter(a => a.name === 'Run (Connect)').length, 'of', mine.length, 'latest any row', mine.map(a => a.start_date).sort().slice(-1)[0]) }
  // since ACTIVITY-NAME-WRITER-01 the writer app is no longer on the row
  const after = ah.filter(a => a.start_date >= '2026-10-08')
  console.log('apple_health rows since 2026-10-08 (writer app not recorded):', after.length)
  // ops_events that DO carry source_name
  const ev = await all('ops_events', 'kind, detail, user_id, created_at', q => q.in('kind', ['health_ingest_rejected']))
  const sn = ev.reduce((m: any, e: any) => { const s = e.detail?.source_name ?? 'null'; m[s] = (m[s] ?? 0) + 1; return m }, {})
  console.log('health_ingest_rejected by source_name', sn)
  // platform / non-iPhone demand
  const subs = await all('push_subscriptions', 'user_id, platform')
  const plat = subs.reduce((m: any, s: any) => { (m[s.platform] ??= new Set()).add(s.user_id); return m }, {})
  console.log('push_subscriptions users by platform', Object.fromEntries(Object.entries(plat).map(([k, v]: any) => [k, v.size])))
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 })
  console.log('auth users', users.users.length)
  const actUsers = new Set(acts.map(a => a.user_id))
  const ahUsers = new Set(ah.map(a => a.user_id))
  console.log('users with any activity', actUsers.size, 'with apple_health rows', ahUsers.size)
  const str = acts.filter(a => a.source === 'strava'); console.log('strava-source rows', str.length, 'users', new Set(str.map(a => a.user_id)).size)
  // any mention of garmin anywhere in feedback-ish tables
  for (const t of ['waitlist', 'feedback', 'user_feedback']) { const r = await sb.from(t).select('*').limit(2000); if (r.error) { console.log(t, 'n/a'); continue }
    const hits = (r.data ?? []).filter((x: any) => JSON.stringify(x).toLowerCase().includes('garmin') || JSON.stringify(x).toLowerCase().includes('android'))
    console.log(t, 'rows', r.data?.length, 'garmin/android mentions', hits.length) }
})().catch(e => { console.error(e); process.exit(1) })
;(async () => {
  // what raw_payload carries for apple_health rows after the name stopped recording the writer
  const r = await sb.from('strava_activities').select('raw_payload, start_date').eq('source', 'apple_health').gte('start_date', '2026-10-08').limit(300)
  const keys: Record<string, number> = {}; const src: Record<string, number> = {}
  for (const x of r.data ?? []) { const p: any = x.raw_payload; if (!p) { keys['<null>'] = (keys['<null>'] ?? 0) + 1; continue }
    for (const k of Object.keys(p)) keys[k] = (keys[k] ?? 0) + 1
    const s = p.sourceName ?? p.source_name ?? p.sourceBundleId; if (s != null) src[s] = (src[s] ?? 0) + 1 }
  console.log('raw_payload keys since 10-08', keys); console.log('writer app since 10-08 (from raw_payload)', src)
})()
;(async () => {
  // writer app over ALL apple_health rows: raw_payload.sourceName (the row's name stopped carrying it on 2026-10-08)
  const rows = await all('strava_activities', 'user_id, start_date, raw_payload, avg_hr, distance_m, elevation_gain', q => q.eq('source', 'apple_health'))
  const writer = (r: any) => { const s = String(r.raw_payload?.sourceName ?? ''); return /connect|garmin/i.test(s) ? 'garmin' : /apple watch|^fitness$/i.test(s) ? 'apple_watch' : s || '<none>' }
  const agg: Record<string, { rows: number; users: Set<string>; hrSamples: number[]; withHr: number; recent: Set<string> }> = {}
  for (const r of rows) { const w = writer(r); const a = (agg[w] ??= { rows: 0, users: new Set(), hrSamples: [], withHr: 0, recent: new Set() })
    a.rows++; a.users.add(r.user_id); a.hrSamples.push((r.raw_payload?.hrSamples ?? []).length); if (r.avg_hr != null) a.withHr++
    if (r.start_date >= '2026-10-21') a.recent.add(r.user_id) }
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }
  console.log('ALL-TIME writer split (apple_health rows):')
  for (const [w, a] of Object.entries(agg).sort((x, y) => y[1].rows - x[1].rows))
    console.log(`  ${w}: rows ${a.rows}, users ${a.users.size}, users active since 10-21 ${a.recent.size}, avg_hr present ${a.withHr}/${a.rows}, median hrSamples ${med(a.hrSamples)}`)
})()
