/**
 * GEN-FIX-01 Stage 2 — regenerate User A's plan with the fixed engine + surface it.
 *
 * The 2026-08-06 incident's Stage 1 corrected User A's HR in place. Stage 2 (this
 * script) replaces the still-defective plan structure (it ends 11 days before her
 * race, promises sessions it never gave, etc.) with a freshly generated plan from
 * the current engine — all 13 coaching decisions in. Per ADR-012 the change is
 * SURFACED, not silent: an APNs push tells her, and a founder note explains.
 *
 *   npx tsx scripts/gen-fix-01-stage2-regenerate.ts           # DRY RUN — writes nothing, sends nothing
 *   npx tsx scripts/gen-fix-01-stage2-regenerate.ts --apply   # archives old plan, writes new plan, sends the push
 *
 * Requires .env.local (SUPABASE_SERVICE_ROLE_KEY, APNS_* for the push). Identifies
 * User A by the incident plan signature — no id committed.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan } from '@/lib/plan/invariants'
import { sendApnsPush } from '@/lib/apnpush'
import type { GeneratorInput, Plan } from '@/types/plan'

const APPLY = process.argv.includes('--apply')

// User A's exact input — the committed, PII-free golden persona P0.
const INPUT: GeneratorInput = {
  race_date: '2026-11-18', race_distance_km: 21.1, goal: 'finish', days_available: 3, age: 43,
  current_weekly_km: 30, longest_recent_run_km: 12, resting_hr: 72, max_hr: 178,
  training_age: '<6mo', hard_session_relationship: 'love', terrain: 'mixed',
  preferred_long_run_day: 'sat', days_cannot_train: ['tue', 'sun'],
  benchmark: { type: 'race', distance_km: 5, time: '0:29:00', benchmark_date: '2026-06-30' },
} as unknown as GeneratorInput

// Fresh start from the next Monday (she has 0 completions — nothing to preserve).
const PLAN_START = '2026-08-10'

// One-off founder-correction push (not a recurring product string).
const PUSH = {
  title: 'We rebuilt your plan.',
  body:  'It now runs all the way to your race, and says what it actually gives you. Take a look.',
  tag:   'plan-rebuilt',
  data:  { url: '/dashboard' },
}

function envFile(): Record<string, string> {
  return Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]
  }))
}

const reachesRace = (plan: Plan): boolean => {
  const weeks = (plan.weeks ?? []).filter(w => w.n > 0)
  const fw = weeks[weeks.length - 1]
  if (!fw?.date || !plan.meta?.race_date) return false
  const [y, m, d] = fw.date.split('-').map(Number); const s = new Date(y, m - 1, d)
  const e = new Date(s); e.setDate(e.getDate() + 6)
  const [ry, rm, rd] = plan.meta.race_date.split('-').map(Number); const r = new Date(ry, rm - 1, rd)
  return r >= s && r <= e
}
const qualityNames = (plan: Plan): string[] => {
  const out = new Set<string>()
  for (const w of plan.weeks ?? []) for (const s of Object.values(w.sessions ?? {})) {
    if (s && (s.type === 'quality' || s.type === 'hard') && s.label) out.add(s.label)
  }
  return Array.from(out)
}

;(async () => {
  const env = envFile()
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) { console.log('MISSING supabase env'); return }
  const sb = createClient(url, key)

  // Identify User A by plan signature.
  const { data: plans, error } = await sb.from('plans').select('user_id, plan_json')
  if (error) { console.log('read error:', error.message); return }
  const match = (plans || []).filter((r: any) =>
    r.plan_json?.meta?.race_date === '2026-11-18' && r.plan_json?.meta?.plan_start === '2026-08-03')
  if (match.length !== 1) { console.log(`Signature matched ${match.length} rows — aborting (no writes).`); return }
  const uid = match[0].user_id as string
  const current = match[0].plan_json as Plan

  // Generate the new plan.
  const next = generateRulePlan(INPUT, 'trial', PLAN_START) as Plan
  const errs = validatePlan(next, INPUT).filter(v => v.severity === 'error')

  // ── Before / after ──────────────────────────────────────────────────────────
  const line = (s: string) => console.log(s)
  line(`\n=== USER A — STAGE 2 REGENERATION ${APPLY ? '(APPLYING)' : '(DRY RUN — nothing written or sent)'} ===\n`)
  line('                        CURRENT (live)                 NEW (this engine)')
  const cw = current.weeks?.filter(w => w.n > 0) ?? []; const nw = next.weeks.filter(w => w.n > 0)
  line(`weeks                   ${cw.length}                             ${nw.length}`)
  line(`final week date         ${cw[cw.length - 1]?.date}                    ${nw[nw.length - 1]?.date}`)
  line(`reaches race day        ${reachesRace(current)}                          ${reachesRace(next)}`)
  line(`zone2 ceiling           ${current.meta?.zone2_ceiling}                            ${next.meta?.zone2_ceiling}`)
  line(`quality labels          ${JSON.stringify(qualityNames(current))}`)
  line(`  (new)                 ${JSON.stringify(qualityNames(next))}`)
  line(`5K TT metric            ${(() => { const w = current.weeks?.find(w => (current.meta?.recalibration_weeks ?? []).includes(w.n)); const tt = w && Object.values(w.sessions ?? {}).find((s: any) => s?.type === 'hard'); return tt ? `${(tt as any).primary_metric}/${(tt as any).distance_km ?? '—'}km` : 'n/a' })()}  →  ${(() => { const w = next.weeks.find(w => (next.meta?.recalibration_weeks ?? []).includes(w.n)); const tt = w && Object.values(w.sessions ?? {}).find((s: any) => s?.type === 'hard'); return tt ? `${(tt as any).primary_metric}/${(tt as any).distance_km ?? '—'}km` : 'n/a' })()}`)
  line(`plan_start              ${current.meta?.plan_start}                    ${next.meta?.plan_start}`)
  line(`invariant errors (new)  ${errs.length}${errs.length ? ' — ' + errs.map(e => e.code).join(',') : ''}`)

  line(`\n=== PUSH PAYLOAD (APNs → her iOS device) ===`)
  line(`  title: ${PUSH.title}`)
  line(`  body:  ${PUSH.body}`)
  line(`  data:  ${JSON.stringify(PUSH.data)}`)

  if (errs.length) { line('\n⛔ New plan has error-severity invariant violations — NOT applying. Fix first.'); return }

  if (!APPLY) {
    line('\nDRY RUN complete. Re-run with --apply to: archive the current plan, write the new plan, send the push.')
    return
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  line('\n--- APPLYING ---')
  // 1. Archive the current plan for revert safety.
  const arch = await sb.from('plan_archive').insert({
    user_id: uid, plan_json: current,
    race_name: current.meta?.race_name ?? null, race_date: current.meta?.race_date ?? null,
  })
  line(arch.error ? `⚠️ archive failed: ${arch.error.message}` : '✅ current plan archived')
  // 2. Write the new plan.
  const up = await sb.from('plans').upsert(
    { user_id: uid, plan_json: next, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (up.error) { line(`⛔ plan write failed: ${up.error.message} — aborting before push.`); return }
  line('✅ new plan written to her account')
  // 3. Send the push (ios).
  const { data: subs } = await sb.from('push_subscriptions').select('endpoint, platform').eq('user_id', uid).eq('platform', 'ios')
  const tok = subs?.[0]?.endpoint
  if (!tok) { line('⚠️ no ios push token — plan written, but no push sent.'); return }
  const res = await sendApnsPush(tok, PUSH)
  line(res.ok ? '✅ push sent' : `⚠️ push failed: ${res.reason} (plan is written; you can send the founder note instead)`)
})().catch(e => console.log('err', e?.message ?? e))
