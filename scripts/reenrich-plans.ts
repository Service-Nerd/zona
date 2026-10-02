// OPS-ENRICH-REMEDIATE-01 — restore the AI voice for runners whose enrichment failed.
//
// ⚠️ DRY RUN BY DEFAULT. Pass `--write` to persist, and it will refuse unless
// `--i-have-authorisation` is also present, because this touches LIVE PLANS.
//
// ── WHY A SCRIPT AND NOT A BACKFILL ──────────────────────────────────────────
// The 2026-08-20 live-plan policy is that engine fixes apply to NEW plans only.
// This is deliberately NOT an engine fix: `mergePlan` can write only
// `meta.notes`, `coach_intro`, `confidence_*`, `week.label`, `week.theme`,
// `session.label` and `session.coach_notes` — every one of them COPY, enforced by
// `EnrichedPlanSchema` rather than by convention. No prescription field is
// reachable. What is restored is the thing a paying runner was promised.
//
// 🔴 AND THE RECORDED BLOCKER HAS EXPIRED. `PLAN-STRIDES-BACKFILL-01` (2026-09-24)
// states: *"regeneration is not reliably possible — `plan_json.meta` does not carry
// `days_cannot_train` or `preferred_long_run_day`"*. That is no longer true:
// PV2-A persists the whole input at `meta.generator_input`, and this script reads
// it. Another item stating an impossibility that had quietly been lifted.
//
// ⚠️ AND WE DO NOT REGENERATE ANYWAY. The rule plan is intact — only the voice was
// discarded — so this re-runs the ENRICHER over the stored plan. The prescription
// is not recomputed, which is what makes "no impact" checkable rather than hoped
// for: the script DIFFS every session's numerics before and after and refuses to
// write if a single one moved.
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { createClient } from '@supabase/supabase-js'
import { enrich } from '../lib/plan/enrich'
import { judgeEnrichHealth, enrichmentStateOf, type EnrichStateRow } from '../lib/ops/enrichHealth'
import { getUserTier } from '../lib/trial'
import { PlanSchema } from '../lib/plan/schema'
import type { Plan, Session } from '../types/plan'

const WRITE = process.argv.includes('--write')
const AUTHORISED = process.argv.includes('--i-have-authorisation')
/** `--only <id-prefix>` — remediate ONE runner. The first write of anything that
 *  edits live plans should touch one row, be read back, and stop; a flag makes
 *  that the easy path rather than a thing to remember. */
const ONLY = (() => {
  const i = process.argv.indexOf('--only')
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
})()

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null

/** Every JSON path whose value differs between two plans. */
function diffPaths(a: Json, b: Json, path = ''): string[] {
  if (a === b) return []
  const bothObj = a && b && typeof a === 'object' && typeof b === 'object'
  if (!bothObj) return [path || '(root)']
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)])
  const out: string[] = []
  // CLAUDE.md § TypeScript: iterating a Set directly needs downlevelIteration here.
  for (const k of Array.from(keys)) {
    const av = (a as Record<string, Json>)[k]
    const bv = (b as Record<string, Json>)[k]
    out.push(...diffPaths(av as Json, bv as Json, path ? `${path}.${k}` : k))
  }
  return out
}

/**
 * The ONLY paths the enricher is allowed to move — `mergePlan`'s entire write
 * surface, mirrored here so the script's permission list and the merge's
 * behaviour can be compared rather than assumed. A path not matched here is a
 * refusal, which is the safe direction.
 */
function isCopyPath(path: string): boolean {
  return /^meta\.(notes|coach_intro|confidence_score|confidence_risks)(\.|$)/.test(path)
    || /^weeks\.\d+\.(label|theme)$/.test(path)
    || /^weeks\.\d+\.sessions\.[a-z]+\.(label|coach_notes)(\.|$)/.test(path)
    // ENRICH-PARTIAL-02's provenance stamp is written BY the revert, not by the
    // model, and a session gaining it is the system being honest about authorship.
    || /^weeks\.\d+\.sessions\.[a-z]+\.enrichment_reverted$/.test(path)
    || /^weeks\.\d+\.enrichment_reverted$/.test(path)
    || /^meta\.enrichment$/.test(path)
}

/** Kept for reference in the refusal message; no longer the safety check. */
function prescriptionFingerprint(plan: Plan): string {
  return JSON.stringify(plan.weeks.map(w => ({
    n: w.n, phase: w.phase, type: w.type, weekly_km: w.weekly_km,
    sessions: Object.entries(w.sessions ?? {}).map(([day, s]) => {
      const sn = s as Session | undefined
      return [day, sn && {
        type: sn.type, role: sn.role, zone: sn.zone, distance_km: sn.distance_km,
        duration_mins: sn.duration_mins, primary_metric: sn.primary_metric,
        pace_target: sn.pace_target, hr_target: sn.hr_target,
        catalogue_id: sn.catalogue_id, derived_set: sn.derived_set,
        duration_anchored: sn.duration_anchored,
      }]
    }),
  })))
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await db.from('plans').select('user_id, created_at, updated_at, plan_json')
  if (error) { console.error('could not read plans:', error.message); process.exit(1) }

  const rows: EnrichStateRow[] = (data ?? []).map(r => ({
    user_id: String(r.user_id), created_at: String(r.created_at),
    enrichment: enrichmentStateOf(r.plan_json as never),
  }))
  const verdict = judgeEnrichHealth(rows)

  console.log(`\nmode: ${WRITE ? (AUTHORISED ? 'WRITE (authorised)' : 'WRITE REFUSED — missing --i-have-authorisation') : 'DRY RUN (writes nothing)'}`)
  console.log(`eligible plans ${verdict.eligible} · with voice ${verdict.withVoice} · WITHOUT ${verdict.withoutVoice} (${verdict.withoutVoicePct}%)\n`)
  if (WRITE && !AUTHORISED) { console.error('refusing: --write needs --i-have-authorisation'); process.exit(2) }
  if (!verdict.affected.length) { console.log('nothing to remediate.'); return }

  const targets = ONLY
    ? verdict.affected.filter(a => a.user_id.startsWith(ONLY))
    : verdict.affected
  if (ONLY) console.log(`--only ${ONLY} → ${targets.length} of ${verdict.affected.length} target(s)\n`)
  for (const target of targets) {
    const row = (data ?? []).find(r => String(r.user_id) === target.user_id)
    const plan = row?.plan_json as Plan | undefined
    const input = plan?.meta?.generator_input
    console.log(`── ${target.user_id.slice(0, 8)}  ${target.created_at.slice(0, 16)}  ${target.enrichment}`)
    if (!plan) { console.log('   SKIP: no plan_json'); continue }
    if (!input) {
      // The honest failure mode: a plan predating PV2-A cannot be re-enriched
      // faithfully, because the enricher is told about the runner from the input.
      console.log('   SKIP: no meta.generator_input (predates PV2-A) — cannot re-enrich faithfully')
      continue
    }
    const before = JSON.stringify(plan)

    // 🔴 THE TIER IS RESOLVED, NOT ASSUMED, AND THE FIRST CUT ASSUMED IT.
    // This read `const tier = 'paid'` with a comment saying "these runners are
    // paid/trial" as though the difference did not matter. It does: `mergePlan`
    // gates `coach_intro`, `confidence_score` and `confidence_risks` on paid
    // (INV-PLAN-008), and BOTH affected runners are **trial** — so the dry run
    // was reporting "would restore voice" while about to grant paid-only fields
    // to runners not entitled to them, and a trial that has since lapsed would
    // leave them holding paid artefacts on the free tier.
    // Found only because the founder asked whether I was confident to run it.
    // `getUserTier` is the single owner of the admin → subscription → grant →
    // trial → free order (TIER-OWNER-01); re-deriving it here is how that order
    // came to exist in three places before.
    const tier = await getUserTier(target.user_id)
    if (tier === 'free') {
      // A free runner is never enriched by design (`meta.enrichment: 'skipped'`),
      // so re-enriching one would hand them a PAID feature. Refuse, loudly.
      console.log('   SKIP: resolves to FREE now — enriching would grant a paid feature')
      continue
    }
    console.log(`   tier resolves to: ${tier}`)
    const res = await enrich(plan, input as never, tier, target.user_id, 'km')
    if (res.outcome.status !== 'applied') {
      const o = res.outcome as { status: string; reason?: string }
      console.log(`   STILL FAILS: ${o.reason ?? o.status} — this runner needs the underlying cause fixed first`)
      continue
    }
    // 🔴 SET THE STATE MARKER. `mergePlan` restores the COPY and never touches
    // `meta.enrichment` — the ROUTE sets that. So the first write of this script
    // left a plan carrying Kit's words and still stamped `failed_invalid_copy`,
    // and only an independent read of the database caught it. Two consequences,
    // both real:
    //   · `sessionNotesAreAiAuthored` gates on `ENRICHED_STATES`, so the AIMark
    //     would not render over copy a model demonstrably wrote. That is the
    //     MODEST direction (AI-PROVENANCE-01: failing to credit is not a false
    //     claim) so nothing was misrepresented — but the runner lost the byline.
    //   · `judgeEnrichHealth` would go on counting that runner as having NO
    //     voice, so the health route I built as the source of truth would report
    //     a problem it had just fixed. A remediation that does not update the
    //     state it is judged by is not finished.
    // `'applied'` is the route's own value for a clean full merge, which is what
    // `outcome.status === 'applied'` above has already established.
    res.plan.meta.enrichment = 'applied'

    // 🔴 A FULL DEEP DIFF, NOT A FINGERPRINT. The first version hashed a
    // hand-listed set of prescription fields — which is a WHITELIST, and anything
    // I failed to list could change silently. That is the same
    // "the population excludes the cases at risk" flaw this repo keeps finding in
    // other people's checks, written into the safety check of a script that edits
    // live runner data. So: diff EVERY path and allow only the copy fields that
    // are supposed to move.
    const changed = diffPaths(plan as unknown as Json, res.plan as unknown as Json)
    const illegal = changed.filter(path => !isCopyPath(path))
    if (illegal.length) {
      console.log(`   🔴 REFUSED: ${illegal.length} non-copy path(s) changed. NOT writing. First few:`)
      for (const p2 of illegal.slice(0, 8)) console.log(`        ${p2}`)
      continue
    }
    // 🔴 IT MUST SURVIVE THE ACTUAL SAVE BOUNDARY, AND MY FIRST CHECK MODELLED THE
    // WRONG ONE. I asserted the plan round-trips through `PlanSchema` unchanged —
    // and it refused BOTH runners, because Zod strips unknown keys and PlanSchema
    // does not describe ~30 `meta` fields including `generator_input`. That is not
    // a save risk: the route writes `plan_json: finalPlan` DIRECTLY, and both
    // `PlanSchema.safeParse` consumers (`lib/plan.ts`, `storedPlanProbes`) read only
    // `.success` / `.error.issues`, never `.data`. So nothing strips anything.
    //
    // The real boundary is JSON — a JSONB column stores what `JSON.stringify` emits,
    // which silently drops `undefined`, turns a Date into a string and NaN into null.
    const roundTripped = JSON.parse(JSON.stringify(res.plan)) as Json
    const lostInJson = diffPaths(res.plan as unknown as Json, roundTripped)
    if (lostInJson.length) {
      console.log(`   🔴 REFUSED: ${lostInJson.length} path(s) would not survive JSON. First few:`)
      for (const p2 of lostInJson.slice(0, 8)) console.log(`        ${p2}`)
      continue
    }
    // And schema validity must not get WORSE than the plan already stored. Equality
    // is the wrong test (the original fails too); regression is the right one.
    const beforeOk = PlanSchema.safeParse(plan).success
    const afterOk = PlanSchema.safeParse(res.plan).success
    if (beforeOk && !afterOk) {
      console.log('   🔴 REFUSED: the stored plan satisfies PlanSchema and the enriched one does not')
      continue
    }
    console.log(`   ✅ would restore voice · ${changed.length} path(s) changed, ALL copy · nothing else moved`)
    console.log(`        deep-diffed ${before.length} bytes · survives JSON · PlanSchema no worse (${beforeOk ? 'valid' : 'already invalid'} before, ${afterOk ? 'valid' : 'invalid'} after)`)
    if (WRITE && AUTHORISED) {
      // 🔴 COMPARE-AND-SWAP, NOT A BLIND UPDATE. The enricher takes ~30 s per plan.
      // If the runner regenerates, reshapes or logs in that window, a blind
      // `.eq('user_id')` write would silently clobber the newer plan with one built
      // from a stale read — and `plan_json` is a single column, so there is no merge
      // to fall back on. The route guards the same hazard with `shouldServerPersist`;
      // this is the script's equivalent and it is the difference between "probably
      // fine" and "cannot clobber".
      const stamp = (row as { updated_at?: string } | undefined)?.updated_at ?? null
      const q = db.from('plans')
        .update({ plan_json: res.plan, updated_at: new Date().toISOString() })
        .eq('user_id', target.user_id)
      const { data: wrote, error: wErr } = stamp
        ? await q.eq('updated_at', stamp).select('user_id')
        : await q.select('user_id')
      if (wErr) console.log(`   WRITE FAILED: ${wErr.message}`)
      else if (!wrote?.length) console.log('   ABORTED: the plan changed while we were enriching (CAS miss) — re-run')
      else console.log('   WRITTEN')
    }
  }
  if (!WRITE) console.log('\nDRY RUN — nothing was written.')
}
main()
