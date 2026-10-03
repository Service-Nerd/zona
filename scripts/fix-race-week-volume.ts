/**
 * §121 REMEDIATION — take the race back out of the stored race-week `weekly_km`.
 *
 *   npm run remediate:raceweek                                  # dry run (default)
 *   npm run remediate:raceweek -- --write --i-have-authorisation # writes
 *
 * ── WHY THIS IS A ONE-INTEGER FIX AND NOT A REGENERATION ─────────────────────
 * §121 Amendment 3 is explicit: *"Display and totals only. No prescription changes.
 * Nothing placed in race week moves."* So the only wrong value in a pre-§121 plan is
 * the race week's `weekly_km`. Verified on `2e4467a0`: week 13 stored 56 against its
 * own sessions' 13.5 km, and **all 12 other weeks already matched exactly**. No stored
 * meta field folds the race in (`peak_km_target` is a target, and
 * `volume_shortfall_note` quotes the peak week, which is unaffected).
 *
 * ⚠️ I FIRST TOLD THE FOUNDER THIS NEEDED A PLAN REGENERATION AND THAT WAS AN
 * ASSUMPTION, NOT A MEASUREMENT. Regenerating would rewrite a live runner's training
 * mid-block, which the live-plan policy exists to prevent. This rewrites one integer.
 *
 * ── WHY BACKFILLING IS CONSISTENT WITH THE LIVE-PLAN POLICY ──────────────────
 * `project_live_plan_policy` says doctrine and engine fixes are NOT backfilled. Its
 * purpose is that we do not rewrite somebody's prescribed training after they have
 * started it. §121 changes **no prescription** — it corrects a displayed total. A
 * display correction is not what that policy forbids, and leaving it means 12 runners
 * keep reading an inflated race week.
 *
 * ── THE POPULATION IS NOT THE FIRING SET ─────────────────────────────────────
 * `INV-PLAN-RACE-NOT-VOLUME` only fires when the race week EXCEEDS the peak phase, so
 * it sees 1 of the 12 affected plans. Measured 2026-10-03: 28 live plans carry a race
 * week, **12 have the race folded into `weekly_km`, and 9 of those are silent.**
 * Selecting on the invariant would have fixed one twelfth of the problem — the
 * population-excludes-the-cases-at-risk class, so this script selects on the
 * ARITHMETIC instead: stored ≈ non-race sessions + race distance.
 *
 * ⚠️ READ-ONLY BY DEFAULT. It refuses to write without BOTH flags.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import type { Plan, Session, Week } from '../types/plan'

const WRITE = process.argv.includes('--write')
const AUTHORISED = process.argv.includes('--i-have-authorisation')
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : null })()
/** Session types that carry no TRAINING volume (§121 adds `race` to the two older ones). */
const NO_VOLUME = new Set(['race', 'strength', 'rest'])
const TOL = 1.01   // one rounding step; `sumWeeklyKm` Math.rounds.

if (WRITE && !AUTHORISED) {
  console.error('✗ --write refused without --i-have-authorisation.')
  process.exit(2)
}

const env: Record<string, string> = {}
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const nonRaceKm = (w: Week) => Object.values(w.sessions ?? {}).reduce(
  (t: number, s) => (!s || NO_VOLUME.has((s as Session).type)) ? t : t + ((s as Session).distance_km ?? 0), 0)

/** Everything that must come out BYTE-IDENTICAL: all sessions, all other weeks, all meta. */
function fingerprint(p: Plan, raceWeekN: number) {
  return JSON.stringify({
    meta: p.meta,
    weeks: p.weeks.map(w => ({
      ...w,
      // the ONE field this script is allowed to change, blanked for comparison
      weekly_km: w.n === raceWeekN ? '<<the one field this script may change>>' : w.weekly_km,
    })),
  })
}

async function main() {
  const { data, error } = await db.from('plans').select('id,user_id,plan_json,updated_at')
  if (error) throw error
  console.log(`\n═══ §121 race-week volume remediation — ${WRITE ? '🔴 WRITE' : 'DRY RUN'} ═══\n`)
  let candidates = 0, wrote = 0, skipped = 0

  for (const row of (data ?? []) as Array<{ id: string; user_id: string; plan_json: Plan; updated_at: string }>) {
    const plan = row.plan_json
    if (!plan?.weeks?.length) continue
    if (ONLY && !row.id.startsWith(ONLY)) continue

    const rw = plan.weeks.find(w => Object.values(w.sessions ?? {}).some(s => (s as Session | undefined)?.type === 'race'))
    if (!rw) continue
    const raceS = Object.values(rw.sessions).find(s => (s as Session | undefined)?.type === 'race') as Session | undefined
    const raceKm = raceS?.distance_km ?? (plan.meta as unknown as { race_distance_km?: number }).race_distance_km ?? 0
    const correct = Math.round(nonRaceKm(rw))
    const stored = rw.weekly_km ?? 0

    // SELECT ON THE ARITHMETIC, not on the invariant.
    const raceIsIncluded = Math.abs(stored - (nonRaceKm(rw) + raceKm)) <= TOL
    if (!raceIsIncluded) continue
    // Already correct? Nothing to do (belt and braces — the two tests are independent).
    if (Math.abs(stored - correct) <= TOL) continue
    candidates++

    const u = await db.auth.admin.getUserById(row.user_id)
    console.log(`── ${u.data?.user?.email ?? '(unknown)'}  plan ${row.id.slice(0, 8)}`)
    console.log(`   race week ${rw.n}: weekly_km ${stored} → ${correct}   (race ${raceKm}km removed; sessions untouched)`)

    const before = fingerprint(plan, rw.n)
    const next: Plan = {
      ...plan,
      weeks: plan.weeks.map(w => w.n === rw.n ? { ...w, weekly_km: correct } : w),
    }
    const problems: string[] = []
    if (fingerprint(next, rw.n) !== before) problems.push('something OTHER than the race week weekly_km changed')
    const nrw = next.weeks.find(w => w.n === rw.n)!
    if ((nrw.weekly_km ?? 0) !== correct) problems.push('the new value did not take')
    if (JSON.stringify(nrw.sessions) !== JSON.stringify(rw.sessions)) problems.push('race-week SESSIONS changed')
    if (next.weeks.length !== plan.weeks.length) problems.push('week count changed')

    if (problems.length) { console.log(`   🔴 SKIPPED — ${problems.join(' · ')}\n`); skipped++; continue }
    console.log(`   ✅ guards pass: every session, every other week and all meta byte-identical`)
    if (!WRITE) { console.log(`   (dry run — nothing written)\n`); continue }

    const ins = await db.from('plan_archive').insert({
      user_id: row.user_id, plan_json: plan,
      race_name: (plan.meta as unknown as Record<string, string>).race_name ?? null,
      race_date: (plan.meta as unknown as Record<string, string>).race_date ?? null,
      archived_at: new Date().toISOString(),
    })
    if (ins.error) { console.log(`   🔴 archive failed, NOT writing: ${ins.error.message}\n`); skipped++; continue }

    const upd = await db.from('plans')
      .update({ plan_json: next, updated_at: new Date().toISOString() })
      .eq('id', row.id).eq('updated_at', row.updated_at).select('id')
    if (upd.error || !upd.data?.length) {
      console.log(`   🔴 CAS failed — the row changed since we read it. NOT written.\n`); skipped++; continue
    }

    // READ IT BACK. Every guard above ran in memory.
    const check = await db.from('plans').select('plan_json').eq('id', row.id).single()
    const got = (check.data?.plan_json as Plan | undefined)?.weeks.find(w => w.n === rw.n)?.weekly_km
    console.log(got === correct
      ? `   ✅ WRITTEN and VERIFIED FROM THE DATABASE (weekly_km = ${got})\n`
      : `   🔴 WRITTEN BUT VERIFICATION FAILED — database says ${got}, expected ${correct}\n`)
    wrote++
  }

  console.log(`\ncandidates ${candidates} · written ${wrote} · skipped ${skipped}`)
  if (!WRITE) console.log(`\nDry run. Re-run with --write --i-have-authorisation to apply.`)
}

main().catch(e => { console.error(e); process.exit(1) })
