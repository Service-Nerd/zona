/** SLT evidence for `BASEBUILD-HANDOVER-01`. READ-ONLY. How many runners does the
 *  base-build path actually reach, and what happens to them at the end of it? */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
}
import type { Plan } from '@/types/plan'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function main() {
  const { data: evs } = await db.from('ops_events')
    .select('user_id, created_at, detail').eq('kind', 'plan_refused_by_design').order('created_at')
  const rows = (evs ?? []) as Array<{ user_id: string; created_at: string; detail: Record<string, unknown> }>
  console.log(`── THE FUNNEL (plan_refused_by_design, all time) ──`)
  console.log(`  refusal events: ${rows.length}   distinct runners: ${new Set(rows.map(r => r.user_id)).size}`)

  const withRamp = rows.filter(r => r.detail?.onramp)
  const byOutcome: Record<string, Set<string>> = {}
  for (const r of withRamp) {
    const o = String((r.detail.onramp as Record<string, unknown>).outcome ?? '?')
    ;(byOutcome[o] ??= new Set()).add(r.user_id)
  }
  console.log(`  carrying an on-ramp assessment: ${withRamp.length} events`)
  for (const [o, s] of Object.entries(byOutcome)) console.log(`     outcome=${o.padEnd(14)} ${s.size} runner(s)`)

  const { data: plans } = await db.from('plans').select('user_id, plan_json')
  const bb = (plans ?? []).filter((p: { plan_json: Plan }) =>
    (p.plan_json?.meta as unknown as Record<string, unknown>)?.plan_kind === 'base_build')
  const offered = byOutcome.offered?.size ?? 0
  console.log(`\n  ACCEPTED (base_build plans live): ${bb.length}`)
  console.log(`  take-up among runners offered one: ${offered ? `${bb.length}/${offered}` : 'n/a'}`)

  console.log(`\n── WHAT HAPPENS AT THE END OF EACH LIVE BLOCK ──`)
  const today = new Date('2026-10-10')
  for (const p of bb as Array<{ user_id: string; plan_json: Plan }>) {
    const m = p.plan_json.meta as unknown as Record<string, unknown>
    const start = String(m.plan_start)
    const weeks = p.plan_json.weeks.length
    const end = new Date(Date.parse(start) + weeks * 7 * 864e5)
    // The race date now lives in the stamp (BASEBUILD-GENINPUT-REMEDIATION-01).
    const race = (m.generator_input as { race_date?: string } | undefined)?.race_date
    const weeksToRace = race ? Math.floor((Date.parse(race) - end.getTime()) / 6048e5) : null
    console.log(`  ${start} + ${weeks}w → ends ${end.toISOString().slice(0,10)}`
      + `   race ${race ?? '(none)'}   ${weeksToRace} weeks between`
      + `   | ${Math.floor((end.getTime() - today.getTime()) / 864e5)} days from today`)
  }
  console.log(`\n  ⚠️ Nothing reads \`base_build_onramp\`; no code path detects a finished block.`)
  console.log(`  The only route to a race plan is the wizard, which ARCHIVES the completed plan.`)
}
main()

/**
 * THE QUESTION THE SLT ACTUALLY NEEDS: when the block ends in January, does the race
 * plan the handover would offer EXIST?
 *
 * ⚠️ I nearly reported "both fall below the 14-week marathon minimum, so they would be
 * refused". `DISTANCE_CONFIGS.minWeeks` is 14 for a marathon, but the REFUSAL gate is
 * `PREP_TIME_THRESHOLDS.MARATHON = { block: 10, warn: 16 }` — two different numbers for
 * two different jobs. 12 and 13 weeks clear the hard block and land in the WARN band.
 * Measured rather than inferred, below.
 */
async function handoverOutcome() {
  const { generateRulePlan } = await import('@/lib/plan/ruleEngine')
  const { data: plans } = await db.from('plans').select('user_id, plan_json')
  const bb = (plans ?? []).filter((p: { plan_json: Plan }) =>
    (p.plan_json?.meta as unknown as Record<string, unknown>)?.plan_kind === 'base_build')

  console.log(`\n── WHAT THE JANUARY HANDOVER WOULD ACTUALLY PRODUCE ──`)
  for (const p of bb as Array<{ plan_json: Plan }>) {
    const m = p.plan_json.meta as unknown as Record<string, unknown>
    const gi = m.generator_input as Record<string, unknown>
    const start = String(m.plan_start)
    const end = new Date(Date.parse(start) + p.plan_json.weeks.length * 7 * 864e5)
    const endIso = end.toISOString().slice(0, 10)
    const target = Number(m.base_build_target_km ?? 0)

    // At handover the runner's volume is the block's TARGET, not what they started with.
    // Their longest run is the block's own longest, which is what the ramp built.
    const longest = p.plan_json.weeks.at(-1)
      ? Math.max(...Object.values(p.plan_json.weeks.at(-1)!.sessions ?? {})
          .filter(Boolean).map(s => (s as { distance_km?: number }).distance_km ?? 0))
      : 0

    const projected = { ...gi, plan_start: endIso, current_weekly_km: target,
      longest_recent_run_km: Math.round(longest) || Number(gi.longest_recent_run_km) } as never

    let outcome: string
    try {
      const plan = generateRulePlan(projected, 'trial', endIso, undefined, endIso)
      outcome = `✅ GENERATES — ${plan.weeks.length} weeks`
    } catch (e) {
      const err = e as Error & { reason?: string }
      outcome = `⛔ ${err.name}${err.reason ? ` (${err.reason})` : ''}`
    }
    console.log(`  block ends ${endIso} · volume ${Number(gi.current_weekly_km)} → ${target} km/wk · `
      + `longest ${Math.round(longest)} km`)
    console.log(`     race plan at handover: ${outcome}`)
  }
}
handoverOutcome()
