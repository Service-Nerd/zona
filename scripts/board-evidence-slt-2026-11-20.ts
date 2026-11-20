// SLT sittings 2026-11-20 — READ-ONLY evidence for five items:
//   SESSION-JOURNEY-01 (the funnel re-measure due 2026-11-04),
//   COMP-NO-IN-PRODUCT-PATH-01 (who holds paid access, and how),
//   WAITLIST-UNREACHABLE-01 (does the waitlist table receive anything),
//   PLAN-IDENTITY-01 (how many runners have more than one plan's worth of history),
//   OPS-ARTIFACT-PLACEMENT-01 (how many runners can SEE ShareWeekButton).
// Selects only. No insert/update/delete/upsert/rpc anywhere in this file.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { getCurrentWeek } from '../lib/plan/weekResolution'
import { resolveTier } from '../lib/trial'

const env = readFileSync('/Users/russe/rts-training-hub/.env.local', 'utf8')
const g = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? ''
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('SUPABASE_SERVICE_ROLE_KEY'))

async function all(table: string, cols: string, filter?: (q: any) => any): Promise<any[]> {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) { console.error(`${table} read failed: ${error.message}`); process.exit(2) }
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

const NOW = new Date()
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000)
const FIX_DAY = new Date('2026-10-08T00:00:00Z') // day after the four 10-07 fixes

async function main() {
  const settings = await all('user_settings',
    'id, email, is_admin, is_internal, healthkit_connected_at, strava_athlete_id, trial_started_at, trial_extended_at, created_at:updated_at')
  const metric = new Set((await all('v_metric_users', 'user_id')).map(r => r.user_id))
  const plans = await all('plans', 'user_id, plan_json, created_at, updated_at')
  const acts = await all('strava_activities', 'user_id, created_at, source')
  const comps = await all('session_completions', 'user_id, created_at, status, superseded_at, strava_activity_id, apple_health_uuid')
  const ra = await all('run_analysis', 'user_id, created_at, total_score, superseded_at')
  const subs = await all('subscriptions', 'user_id, status, provider, is_comped, current_period_end, created_at')
  const codes = await all('charity_codes', 'claimed_by, claimed_at, expires_at, batch_id')
  const reports = await all('weekly_reports', 'user_id, week_n, zone_discipline_score, generated_at, superseded_at')
  const archive = await all('plan_archive', 'user_id, created_at:archived_at')
  const waitlist = await all('waitlist', 'created_at, source')
  const ev = await all('analytics_events', 'user_id, event, created_at',
    q => q.in('event', ['share_week_pressed', 'share_week_result', 'weekly_report_open', 'coach_open', 'ledger_view']))

  const users = settings.map(s => s.id as string)
  const pops: Record<string, (id: string) => boolean> = {
    ALL: () => true,
    METRIC: id => metric.has(id),
  }

  const hasPlan = new Set(plans.filter(p => (p.plan_json?.weeks?.length ?? 0) > 0).map(p => p.user_id))
  const connected = new Set(settings.filter(s => s.healthkit_connected_at || s.strava_athlete_id).map(s => s.id))
  const runArrived = new Set(acts.map(a => a.user_id))
  const runArrivedSinceFix = new Set(acts.filter(a => new Date(a.created_at) >= FIX_DAY).map(a => a.user_id))
  const liveComps = comps.filter(c => !c.superseded_at)
  const logged = new Set(comps.map(c => c.user_id))           // ever, superseded included (as 10-07 counted "logged a session")
  const loggedLive = new Set(liveComps.map(c => c.user_id))
  const loggedSinceFix = new Set(comps.filter(c => new Date(c.created_at) >= FIX_DAY).map(c => c.user_id))
  const logged14 = new Set(comps.filter(c => new Date(c.created_at) >= daysAgo(14)).map(c => c.user_id))
  const scored = new Set(ra.filter(r => r.total_score != null).map(r => r.user_id))
  const scoredSinceFix = new Set(ra.filter(r => r.total_score != null && new Date(r.created_at) >= FIX_DAY).map(r => r.user_id))
  const autoLinkedSinceFix = new Set(comps.filter(c => new Date(c.created_at) >= FIX_DAY && (c.strava_activity_id || c.apple_health_uuid)).map(c => c.user_id))

  console.log(`\n=== SESSION-JOURNEY-01 funnel (now ${NOW.toISOString()}) ===`)
  for (const [name, inPop] of Object.entries(pops)) {
    const n = (s: Set<string>) => users.filter(u => inPop(u) && s.has(u)).length
    console.log(`[${name}] accounts=${users.filter(inPop).length} plan=${n(hasPlan)} connected=${n(connected)} runArrivedEver=${n(runArrived)} runArrivedSince10-08=${n(runArrivedSinceFix)} loggedEver=${n(logged)} loggedLive=${n(loggedLive)} loggedSince10-08=${n(loggedSinceFix)} autoLinkedSince10-08=${n(autoLinkedSinceFix)} scoredEver=${n(scored)} scoredSince10-08=${n(scoredSinceFix)} logged14d=${n(logged14)}`)
    // users who logged since the fix who had NEVER logged before it
    const before = new Set(comps.filter(c => new Date(c.created_at) < FIX_DAY).map(c => c.user_id))
    console.log(`[${name}] new loggers since 10-08 (none before) = ${users.filter(u => inPop(u) && loggedSinceFix.has(u) && !before.has(u)).length}; plan-holders never logged = ${users.filter(u => inPop(u) && hasPlan.has(u) && !logged.has(u)).length}; plan-holders with a run arrived but never logged = ${users.filter(u => inPop(u) && hasPlan.has(u) && runArrived.has(u) && !logged.has(u)).length}`)
  }
  const compsSince = comps.filter(c => new Date(c.created_at) >= FIX_DAY)
  console.log(`completion rows since 10-08: ${compsSince.length} (auto-linked ${compsSince.filter(c => c.strava_activity_id || c.apple_health_uuid).length}); metric-pop rows: ${compsSince.filter(c => metric.has(c.user_id)).length}`)
  console.log(`activity rows since 10-08: ${acts.filter(a => new Date(a.created_at) >= FIX_DAY).length}; metric-pop: ${acts.filter(a => new Date(a.created_at) >= FIX_DAY && metric.has(a.user_id)).length}`)

  // ── Tier for every user (base inputs; first-read trial policy not modelled) ──
  const subBy = new Map(subs.map(s => [s.user_id, s]))
  const grantBy = new Map(codes.filter(c => c.claimed_by).map(c => [c.claimed_by, c]))
  const tierOf = (id: string) => {
    const s = settings.find(x => x.id === id)!
    return resolveTier({ isAdmin: s.is_admin, subStatus: subBy.get(id)?.status, subPeriodEnd: subBy.get(id)?.current_period_end,
      grantExpiresAt: grantBy.get(id)?.expires_at, trialStartedAt: s.trial_started_at, trialExtendedAt: s.trial_extended_at }, NOW)
  }
  const reasons: Record<string, Record<string, number>> = { ALL: {}, METRIC: {} }
  for (const u of users) {
    const r = tierOf(u).reason
    reasons.ALL[r] = (reasons.ALL[r] ?? 0) + 1
    if (metric.has(u)) reasons.METRIC[r] = (reasons.METRIC[r] ?? 0) + 1
  }
  console.log(`\n=== COMP-NO-IN-PRODUCT-PATH-01 ===`)
  console.log(`tier reasons ALL: ${JSON.stringify(reasons.ALL)}  METRIC: ${JSON.stringify(reasons.METRIC)}`)
  const byStatus: Record<string, number> = {}
  for (const s of subs) { const k = `${s.provider}/${s.status}/comped=${s.is_comped}`; byStatus[k] = (byStatus[k] ?? 0) + 1 }
  console.log(`subscriptions: ${subs.length} ${JSON.stringify(byStatus)}; in metric pop: ${subs.filter(s => metric.has(s.user_id)).length}`)
  const ends = subs.map(s => s.current_period_end).filter(Boolean).sort()
  console.log(`sub period_end range: ${ends[0]} → ${ends[ends.length - 1]}; created range: ${subs.map(s => s.created_at).sort()[0]} → ${subs.map(s => s.created_at).sort().slice(-1)[0]}`)
  console.log(`charity_codes: ${codes.length}, claimed ${codes.filter(c => c.claimed_by).length}, live grants ${codes.filter(c => c.claimed_by && c.expires_at && new Date(c.expires_at) > NOW).length}`)
  const lapsedWithPlan = users.filter(u => metric.has(u) && tierOf(u).reason === 'none' && hasPlan.has(u))
  const lapsedActive = lapsedWithPlan.filter(u => runArrivedSinceFix.has(u) || loggedSinceFix.has(u))
  console.log(`metric-pop on FREE (reason none) holding a plan: ${lapsedWithPlan.length}; of those with a run or log since 10-08: ${lapsedActive.length}`)
  console.log(`admins: ${settings.filter(s => s.is_admin).length}; internal: ${settings.filter(s => s.is_internal).length}`)

  console.log(`\n=== WAITLIST-UNREACHABLE-01 ===`)
  const wl = waitlist.map(w => w.created_at).sort()
  const src: Record<string, number> = {}
  for (const w of waitlist) src[w.source ?? 'null'] = (src[w.source ?? 'null'] ?? 0) + 1
  console.log(`waitlist rows: ${waitlist.length}; first ${wl[0]} last ${wl[wl.length - 1]}; sources ${JSON.stringify(src)}; since 2026-09-01: ${waitlist.filter(w => w.created_at >= '2026-09-01').length}`)

  console.log(`\n=== PLAN-IDENTITY-01 ===`)
  const archBy: Record<string, number> = {}
  for (const a of archive) archBy[a.user_id] = (archBy[a.user_id] ?? 0) + 1
  const plansPerUser: Record<string, number> = {}
  for (const p of plans) plansPerUser[p.user_id] = (plansPerUser[p.user_id] ?? 0) + 1
  const multiPlansRow = Object.values(plansPerUser).filter(n => n > 1).length
  for (const [name, inPop] of Object.entries(pops)) {
    const us = Object.keys(archBy).filter(inPop)
    const dist: Record<number, number> = {}
    for (const u of us) dist[archBy[u]] = (dist[archBy[u]] ?? 0) + 1
    console.log(`[${name}] users with ≥1 archived plan: ${us.length} (of ${users.filter(u => inPop(u) && hasPlan.has(u)).length} plan-holders); archive-count distribution ${JSON.stringify(dist)}; archived since 10-08: ${archive.filter(a => inPop(a.user_id) && new Date(a.created_at) >= FIX_DAY).length} rows / ${new Set(archive.filter(a => inPop(a.user_id) && new Date(a.created_at) >= FIX_DAY).map(a => a.user_id)).size} users`)
  }
  console.log(`users with >1 row in plans: ${multiPlansRow}`)
  const supersededComps = comps.filter(c => c.superseded_at)
  console.log(`superseded completion rows: ${supersededComps.length} across ${new Set(supersededComps.map(c => c.user_id)).size} users (metric ${new Set(supersededComps.filter(c => metric.has(c.user_id)).map(c => c.user_id)).size})`)

  console.log(`\n=== OPS-ARTIFACT-PLACEMENT-01 — ShareWeekButton reach ===`)
  // Render gate: Coach screen (hasPaidAccess = paid|trial) AND latest non-superseded report's week_n
  // === current plan week n AND zone_discipline_score != null. Mirrors DashboardClient:2094 + :5612 + :6248.
  const latest = new Map<string, any>()
  for (const r of reports.filter(r => !r.superseded_at)) {
    const cur = latest.get(r.user_id)
    if (!cur || r.week_n > cur.week_n) latest.set(r.user_id, r)
  }
  const planBy = new Map(plans.map(p => [p.user_id, p.plan_json]))
  let renderNow: string[] = []
  const gateRows: string[] = []
  for (const u of users) {
    const r = latest.get(u); const pj = planBy.get(u)
    if (!r || !pj?.weeks?.length) continue
    const cw = getCurrentWeek(pj.weeks) as any
    const t = tierOf(u)
    const paid = t.tier === 'paid' || t.tier === 'trial'
    const cur = r.week_n === (cw?.n)
    const ok = paid && cur && r.zone_discipline_score != null
    if (ok) renderNow.push(u)
    gateRows.push(`${metric.has(u) ? 'M' : 'x'} tier=${t.tier} reportWeek=${r.week_n} planWeek=${cw?.n} score=${r.zone_discipline_score} gen=${String(r.generated_at).slice(0, 10)} → ${ok ? 'RENDERS' : 'no'}`)
  }
  for (const l of gateRows) console.log('  ' + l)
  const allR = reports.filter(r => !r.superseded_at)
  const scoredR = allR.filter(r => r.zone_discipline_score != null)
  console.log(`unsuperseded reports: ${allR.length} across ${new Set(allR.map(r => r.user_id)).size} users; scored ${scoredR.length} across ${new Set(scoredR.map(r => r.user_id)).size} users; newest scored ${scoredR.map(r => r.generated_at).sort().slice(-1)[0]}`)
  console.log(`scored reports generated in last 28d: ${scoredR.filter(r => new Date(r.generated_at) >= daysAgo(28)).length} across ${new Set(scoredR.filter(r => new Date(r.generated_at) >= daysAgo(28)).map(r => r.user_id)).size} users (metric ${new Set(scoredR.filter(r => new Date(r.generated_at) >= daysAgo(28) && metric.has(r.user_id)).map(r => r.user_id)).size})`)
  console.log(`ShareWeekButton renders TODAY for: ${renderNow.length} users (metric ${renderNow.filter(u => metric.has(u)).length}) of ${users.length} accounts / ${metric.size} metric users`)
  const evc: Record<string, { n: number; u: Set<string>; um: Set<string> }> = {}
  for (const e of ev) {
    evc[e.event] ??= { n: 0, u: new Set(), um: new Set() }
    evc[e.event].n++; evc[e.event].u.add(e.user_id); if (metric.has(e.user_id)) evc[e.event].um.add(e.user_id)
  }
  for (const [k, v] of Object.entries(evc)) console.log(`event ${k}: ${v.n} events, ${v.u.size} users (metric ${v.um.size})`)
}

main()

// ── Addendum: the runners whose runs arrive but who never log — tier and volume (read-only) ──
async function gap() {
  const settings = await all('user_settings', 'id, is_admin, trial_started_at, trial_extended_at')
  const metric = new Set((await all('v_metric_users', 'user_id')).map(r => r.user_id))
  const plans = await all('plans', 'user_id, plan_json')
  const acts = await all('strava_activities', 'user_id, created_at, source, activity_type')
  const comps = await all('session_completions', 'user_id')
  const subs = await all('subscriptions', 'user_id, status, current_period_end')
  const logged = new Set(comps.map(c => c.user_id))
  const hasPlan = new Set(plans.filter(p => (p.plan_json?.weeks?.length ?? 0) > 0).map(p => p.user_id))
  const subBy = new Map(subs.map(s => [s.user_id, s]))
  const rows: Record<string, number> = {}
  for (const s of settings) {
    if (!metric.has(s.id) || !hasPlan.has(s.id) || logged.has(s.id)) continue
    const a = acts.filter(x => x.user_id === s.id)
    if (!a.length) continue
    const t = resolveTier({ isAdmin: s.is_admin, subStatus: subBy.get(s.id)?.status, subPeriodEnd: subBy.get(s.id)?.current_period_end,
      trialStartedAt: s.trial_started_at, trialExtendedAt: s.trial_extended_at }, NOW).tier
    const sinceFix = a.filter(x => new Date(x.created_at) >= FIX_DAY).length
    const srcs = Array.from(new Set(a.map(x => x.source))).join('+')
    const k = `tier=${t} src=${srcs} runsSince10-08=${sinceFix > 0 ? (sinceFix >= 5 ? '5+' : '1-4') : '0'}`
    rows[k] = (rows[k] ?? 0) + 1
  }
  console.log(`\n=== ADDENDUM: metric plan-holders with runs but no completion ===`)
  for (const [k, v] of Object.entries(rows).sort()) console.log(`  ${v} × ${k}`)
}
gap()
