/**
 * Seed the Apple-reviewer demo account.
 *
 * Targets ONE hardcoded email (zonna.demo@demo.com) so it can never touch a real user.
 * Idempotent: re-running upserts the same state.
 *
 * Produces: a mid-build plan (current week lands on today), trial-EXPIRED state
 * (so the reviewer hits the paywall and can exercise the StoreKit sandbox purchase),
 * onboarding flags cleared (straight to Today), and ~7 completed + analysed sessions
 * across the two prior weeks so Coach + Plan render populated.
 *
 * Run:  node scripts/seed-demo-account.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const DEMO_EMAIL = 'zonna.demo@demo.com'

// --- env ---------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const GIST = env.NEXT_PUBLIC_GIST_URL

const log = (...a) => console.log(...a)
const fail = (m) => { console.error('✗', m); process.exit(1) }

// --- 1. resolve demo user ---------------------------------------------
let userId = null
for (let page = 1; page <= 5 && !userId; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
  if (error) fail('listUsers: ' + error.message)
  const u = data.users.find(x => (x.email || '').toLowerCase() === DEMO_EMAIL)
  if (u) userId = u.id
  if (data.users.length < 200) break
}
if (!userId) fail(`demo account ${DEMO_EMAIL} not found in auth.users`)
log('✓ demo user:', userId)

// --- 2. canonical plan, identity neutralized --------------------------
const plan = await fetch(GIST, { cache: 'no-store' }).then(r => r.json())
plan.meta = {
  ...plan.meta,
  athlete: 'Alex Rivera',
  handle: null,
  charity: null,
}
log('✓ plan loaded:', plan.weeks.length, 'weeks · race', plan.meta.race_name, plan.meta.race_date)

// write to BOTH the plans table (canonical) and user_settings.plan_json (legacy fallback read)
{
  const { error } = await sb.from('plans').upsert({ user_id: userId, plan_json: plan, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) fail('plans upsert: ' + error.message)
  log('✓ plans row upserted')
}

// --- 3. user_settings: trial EXPIRED + onboarding cleared -------------
const FIFTEEN_DAYS_AGO = new Date(Date.now() - 15 * 86400_000).toISOString()
const NOW = new Date().toISOString()
{
  const { error } = await sb.from('user_settings').upsert({
    id: userId,
    email: DEMO_EMAIL,
    first_name: 'Alex',
    last_name: 'Rivera',
    plan_json: plan,
    trial_started_at: FIFTEEN_DAYS_AGO,   // → trial expired (>14d)
    is_admin: false,                       // reviewer must see the real free/paid gating
    has_onboarded: true,
    orientation_seen: true,
    connect_runs_seen: true,               // suppress the connect-runs banner
    connect_runs_banner_dismissed_at: NOW,
    push_permission_seen: true,
    dynamic_adjustments_enabled: true,
    resting_hr: plan.meta.resting_hr ?? 48,
    max_hr: plan.meta.max_hr ?? 188,
    date_of_birth: '1988-01-01',
    timezone: 'Europe/London',
    updated_at: NOW,
  }, { onConflict: 'id' })
  if (error) fail('user_settings upsert: ' + error.message)
  log('✓ user_settings upserted (trial expired ' + FIFTEEN_DAYS_AGO.slice(0, 10) + ')')
}

// --- 4. completed + analysed history (DYNAMIC) ------------------------
// Compute current week from plan + today, then mark every non-rest session
// from week 1 through yesterday complete. The two most-recent weeks get
// hand-crafted Kit-voice feedback (relative offsets, not fixed week_n,
// so the seed stays correct whenever it's re-run). Earlier weeks get
// generic Kit-voice feedback. Today and future sessions are left untouched
// so the reviewer sees an actionable Today screen.

// Recent Kit-voice feedback. Indexed by `weeksBack` (1 = last week, 2 = two
// weeks back) and day. Honest, a touch dry, never motivational.
const RECENT_FEEDBACK = {
  2: {
    tue: { km: 7.2,  rpe: 3, verdict: 'nailed',     zone: 86, ceil: 4,  ef: 2.1,  fb: "Easy actually stayed easy. Rare for you. Don't make it weird next time." },
    fri: { km: 9.4,  rpe: 4, verdict: 'close',      zone: 71, ceil: 18, ef: -0.4, fb: "A touch hot through the middle. Not a disaster — pull the first km back and it's clean." },
    sat: { km: 16.0, rpe: 5, verdict: 'nailed',     zone: 83, ceil: 6,  ef: 1.2,  fb: "Back-to-back day one, held in zone. That's the point of these. Now go do nothing." },
    sun: { km: 31.0, rpe: 6, verdict: 'close',      zone: 74, ceil: 14, ef: -1.8, fb: "Three hours is three hours. Drift crept in late — that's fuel and heat, not fitness. Note it." },
  },
  1: {
    tue: { km: 8.5,  rpe: 7, verdict: 'off_target', zone: 52, ceil: 33, ef: -3.1, fb: "That wasn't the quality session on the card — the recoveries weren't recoveries. Walk them properly and it lands." },
    fri: { km: 7.0,  rpe: 3, verdict: 'nailed',     zone: 88, ceil: 3,  ef: 1.9,  fb: "Kept it under control. Good. Easy is supposed to feel almost too easy." },
    sun: { km: 48.0, rpe: 8, verdict: 'close',      zone: 69, ceil: 17, ef: -2.4, fb: "Five hours, gut test survived. HR climbed in the back third — expected at this distance. Recover like you mean it." },
  },
}
const GENERIC_FB = "Held the zone. That's the point of these."

// parseLocalDate avoids UTC-offset week mismatches
const parseLocal = (s) => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
const today = new Date(); today.setHours(0,0,0,0)
const WEEK_DAYS = ['mon','tue','wed','thu','fri','sat','sun']

// resolve current week index (same logic as lib/plan.ts getCurrentWeek)
const currentWeekIdx = (() => {
  for (let i = 0; i < plan.weeks.length; i++) {
    const start = parseLocal(plan.weeks[i].date)
    const end = new Date(start); end.setDate(end.getDate() + 7)
    if (today >= start && today < end) return i
  }
  // fallback: last past week
  for (let i = plan.weeks.length - 1; i >= 0; i--) {
    if (parseLocal(plan.weeks[i].date) <= today) return i
  }
  return 0
})()
log(`✓ current week: ${currentWeekIdx + 1} of ${plan.weeks.length} (${plan.weeks[currentWeekIdx].date})`)

// clean slate for the demo user (disposable), then plain-insert — no constraint dependency
await sb.from('run_analysis').delete().eq('user_id', userId)
await sb.from('session_completions').delete().eq('user_id', userId)

let okC = 0, okA = 0, synthCounter = 0
for (let wIdx = 0; wIdx <= currentWeekIdx; wIdx++) {
  const week = plan.weeks[wIdx]
  const weekStart = parseLocal(week.date)
  const weekN = wIdx + 1
  const weeksBack = currentWeekIdx - wIdx
  const sessions = week.sessions || {}

  for (let dayIdx = 0; dayIdx < WEEK_DAYS.length; dayIdx++) {
    const dayKey = WEEK_DAYS[dayIdx]
    const dayDate = new Date(weekStart); dayDate.setDate(weekStart.getDate() + dayIdx)
    if (dayDate >= today) break  // today or future — leave actionable
    const sess = sessions[dayKey]
    if (!sess || sess.type === 'rest') continue

    // hand-crafted feedback for last 2 weeks; generic before that
    const recent = (RECENT_FEEDBACK[weeksBack] && RECENT_FEEDBACK[weeksBack][dayKey]) || null
    const isRun = sess.type === 'run' || sess.type === 'easy' || sess.type === 'long' || sess.type === 'quality' || sess.type === 'tempo' || sess.type === 'intervals' || sess.type === 'race' || sess.type === 'recovery'
    const km = recent?.km ?? (sess.distance_km ?? (isRun ? 8 : 0))
    const rpe = recent?.rpe ?? (isRun ? 4 : 3)
    const avgHr = isRun ? Math.round(plan.meta.max_hr * (0.62 + rpe * 0.02)) : null

    const c = await sb.from('session_completions').insert({
      user_id: userId, week_n: weekN, session_day: dayKey,
      status: 'complete', rpe, avg_hr: avgHr,
      strava_activity_km: km, strava_activity_name: isRun ? 'Demo run' : 'Demo session',
      updated_at: NOW,
    })
    if (c.error) console.error('  ! completion', weekN, dayKey, c.error.message); else okC++

    // run_analysis only for run-type sessions (strength etc. aren't analysed)
    if (isRun) {
      const synthId = 9_000_000_000 + (synthCounter++)
      const zone = recent?.zone ?? 80
      const ceil = recent?.ceil ?? 8
      const ef = recent?.ef ?? 0.5
      const verdict = recent?.verdict ?? 'nailed'
      const fb = recent?.fb ?? GENERIC_FB

      const a = await sb.from('run_analysis').insert({
        user_id: userId, week_n: weekN, session_day: dayKey,
        strava_activity_id: synthId, source: 'manual',
        hr_discipline_score: zone, distance_score: 92, pace_score: 80,
        ef_score: 75, total_score: Math.round(zone * 0.5 + 40), verdict,
        hr_in_zone_pct: zone, hr_above_ceiling_pct: ceil, hr_below_floor_pct: Math.max(0, 100 - zone - ceil),
        ef_trend_pct: ef,
        planned_load_km: km, actual_load_km: km,
        rule_engine_version: 'seed-1', feedback_text: fb,
      })
      if (a.error) console.error('  ! analysis', weekN, dayKey, a.error.message); else okA++
    }
  }
}
log(`✓ history: ${okC} completions, ${okA} analyses (weeks 1–${currentWeekIdx + 1}, up to yesterday)`)

// --- 5. verify readback ------------------------------------------------
const { data: us } = await sb.from('user_settings').select('trial_started_at, is_admin, has_onboarded').eq('id', userId).single()
const { count: pc } = await sb.from('plans').select('id', { count: 'exact', head: true }).eq('user_id', userId)
const { count: cc } = await sb.from('session_completions').select('id', { count: 'exact', head: true }).eq('user_id', userId)
const { count: ac } = await sb.from('run_analysis').select('id', { count: 'exact', head: true }).eq('user_id', userId)
const daysLeft = Math.ceil((new Date(us.trial_started_at).getTime() + 14 * 86400_000 - Date.now()) / 86400_000)
log('\n── verify ─────────────────────────────')
log('  plan rows         :', pc)
log('  trial days left   :', daysLeft, daysLeft <= 0 ? '(EXPIRED ✓)' : '(STILL ACTIVE ✗)')
log('  is_admin          :', us.is_admin, us.is_admin === false ? '✓' : '✗')
log('  has_onboarded     :', us.has_onboarded)
log('  completions       :', cc)
log('  analyses          :', ac)
log('────────────────────────────────────────')
log('Done.')
