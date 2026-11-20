// READ-ONLY board evidence for SIG-ULTRA-UNBUILT-01 (SLT gate check, 2026-11-20). Selects only; writes nothing.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g,'') }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function all(table: string, cols: string, f?: (q: any) => any) {
  const out: any[] = []; let from = 0
  for (;;) { let q = sb.from(table).select(cols).range(from, from + 999); if (f) q = f(q)
    const { data, error } = await q; if (error) { console.log(table, 'ERR', error.message); return out }
    out.push(...data!); if (data!.length < 1000) break; from += 1000 }
  return out
}
const dist = (pj: any) => pj?.meta?.race_distance_km ?? pj?.meta?.race_distance ?? pj?.meta?.distance ?? pj?.race_distance ?? null
const isUltra = (d: any) => { const s = String(d ?? '').toUpperCase(); const n = parseFloat(s); return /50K|100K|ULTRA|50 ?MI|100 ?MI/.test(s) || (Number.isFinite(n) && n > 42.3) }
;(async () => {
  const { data: users } = await sb.auth.admin.listUsers({ perPage: 1000 })
  const email = Object.fromEntries(users.users.map(u => [u.id, u.email ?? '']))
  const test = (id: string) => /demo|test|example|zonna\.run/i.test(email[id] ?? '')
  console.log('auth users', users.users.length)
  const plans = await all('plans', '*')
  console.log('plans columns', Object.keys(plans[0] ?? {}).join(', '))
  console.log('plan rows', plans.length)
  const m = plans.map(p => ({ u: p.user_id, d: dist(p.plan_json), gen: p.plan_json?.meta?.generated_at ?? p.created_at, live: p.superseded_at == null && p.archived_at == null }))
  const byD: Record<string, number> = {}; for (const x of m) byD[String(x.d)] = (byD[String(x.d)] ?? 0) + 1
  console.log('plans by distance', byD)
  for (const x of m.filter(x => isUltra(x.d))) console.log('ULTRA plan', String(x.u).slice(0, 8), x.d, x.gen, 'testish', test(x.u))
  const arch = await all('plan_archive', '*')
  console.log('plan_archive rows', arch.length, 'columns', Object.keys(arch[0] ?? {}).join(', '))
  const aU = arch.filter(a => isUltra(dist(a.plan_json ?? a.plan)))
  console.log('ultra in archive', aU.length, 'users', new Set(aU.map(a => a.user_id)).size, aU.map(a => String(a.user_id).slice(0, 8) + (test(a.user_id) ? '(test)' : '')).join(' '))
  // settings: declared race distance
  const us = await all('user_settings', '*')
  const raceKeys = Object.keys(us[0] ?? {}).filter(k => /race|distance/i.test(k)); console.log('user_settings race-ish columns', raceKeys)
  for (const k of raceKeys) { const c: Record<string, number> = {}; for (const r of us) c[String(r[k])] = (c[String(r[k])] ?? 0) + 1; console.log(' ', k, c) }
  // generation telemetry carrying a distance
  const ev = await all('ops_events', 'kind, detail, user_id, created_at', q => q.gte('created_at', '2026-05-01'))
  const kinds: Record<string, number> = {}; for (const e of ev) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1
  const withDist = ev.filter(e => e.detail && /distance|race/i.test(Object.keys(e.detail).join(' ')))
  const dk: Record<string, number> = {}
  for (const e of withDist) { const d = e.detail.race_distance ?? e.detail.distance ?? e.detail.raceDistance ?? e.detail.race_distance_km; dk[`${e.kind}:${d}`] = (dk[`${e.kind}:${d}`] ?? 0) + 1 }
  console.log('ops_events with a distance field (kind:distance)', dk)
  const ultraEv = withDist.filter(e => isUltra(e.detail.race_distance ?? e.detail.distance ?? e.detail.raceDistance ?? e.detail.race_distance_km))
  console.log('ultra-distance ops events', ultraEv.length, 'users', new Set(ultraEv.map(e => e.user_id)).size, ultraEv.map(e => `${e.kind}@${e.created_at.slice(0,10)}${test(e.user_id) ? '(test)' : ''}`).join(' '))
})().catch(e => { console.error(e); process.exit(1) })
;(async () => {
  // detail on every ultra plan in the archive: who (admin/test flag only, no PII), when, and engine generation
  const settings = await all('user_settings', 'user_id, is_admin')
  const admin = new Set(settings.filter(s => s.is_admin).map(s => s.user_id))
  const arch = await all('plan_archive', 'user_id, race_date, archived_at, plan_json')
  for (const a of arch) { const pj: any = a.plan_json; const d = dist(pj); if (!isUltra(d)) continue
    const sess = (pj.weeks ?? []).flatMap((w: any) => w.sessions ?? [])
    console.log('ARCHIVED ULTRA', String(a.user_id).slice(0, 8), 'admin', admin.has(a.user_id), 'dist', d, 'race', a.race_date, 'archived', String(a.archived_at).slice(0, 10), 'generated', String(pj?.meta?.generated_at ?? '').slice(0, 10), 'catalogue_id stamped', sess.filter((s: any) => s.catalogue_id).length, '/', sess.length) }
  const live = await all('plans', 'user_id, plan_json')
  for (const p of live) if (isUltra(dist(p.plan_json))) console.log('LIVE ULTRA', String(p.user_id).slice(0, 8), 'admin', admin.has(p.user_id))
  console.log('admins', admin.size)
})()
;(async () => {
  // window covered by the distance-carrying generation telemetry
  const ev = await all('ops_events', 'kind, created_at, user_id', q => q.like('kind', 'plan_%'))
  const gen = ev.filter(e => /plan_enrich_server_saved|plan_enrich_failed|plan_refused_by_design|plan_rule_invalid/.test(e.kind))
  const d = gen.map(e => e.created_at).sort()
  console.log('generation telemetry window', d[0]?.slice(0, 10), '→', d[d.length - 1]?.slice(0, 10), 'events', gen.length, 'users', new Set(gen.map(e => e.user_id)).size)
})()
