// TRIGGER-AUDIT-01 — do the eleven plan-adaptation triggers key on the right
// quantity, and how often would each fire wrongly?
//
// WHY THIS EXISTS. Eleven `trigger_type` values change a runner's plan. Under
// ADR-012 a low-magnitude adjustment auto-applies SILENTLY, so a wrong trigger
// reshapes a week with no confirmation and no trace the runner would notice.
// Exactly ONE of the eleven had ever been audited (`zone_drift`, via R30 on
// 2026-09-13) and it was measured firing on 27% false positives after being live
// since May. Nothing distinguished the other ten except that nobody had looked.
//
// Hutchinson's framing, from the SLT that produced this item: an insight that
// does not touch the plan can be wrong at no cost; one that reshapes Thursday
// cannot. Every trigger is a claim that the signal is real.
//
// ⚠️ Two kinds of finding, kept separate on purpose:
//   STRUCTURAL — does the trigger key on the right QUANTITY? Decidable from the
//     code and the principles, at any n. This is where R30's defect lived: a
//     directional phenomenon measured with a symmetric metric.
//   EMPIRICAL  — how often does it fire, and how often wrongly? Needs data, and
//     our n is small. Reported with the sample size attached, never without.
//
// A structural finding does not need a large n. "This counts runs that were too
// EASY as evidence of running too hard" is wrong at n=1.
//
// Run: set -a && . ./.env.local && set +a && npx tsx scripts/trigger-audit.ts

import { createClient } from '@supabase/supabase-js'
import {
  LOAD_RATIO, SHADOW_LOAD_THRESHOLD_PCT, EF_DECLINE_THRESHOLD_PCT,
  ZONE_DISCIPLINE_BANDS, FATIGUE_ACCUMULATION_THRESHOLD, FATIGUE_HIGH_TAGS,
  LONG_RUN_SHORTFALL_CONSECUTIVE, LONG_RUN_SHORTFALL_COMPLETION_PCT,
  ZONE_DRIFT_ABOVE_CEILING_PCT,
} from '../lib/coaching/constants'
import { zoneDriftScore } from '../lib/coaching/loadCalc'

type Verdict = 'PASS' | 'STRUCTURAL DEFECT' | 'NEEDS DATA'

interface Finding {
  trigger: string
  keysOn: string
  verdict: Verdict
  note: string
}

const findings: Finding[] = []

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: ra, error } = await sb.from('run_analysis')
    .select('hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, ef_trend_pct, planned_load_km, actual_load_km, source')
  if (error) throw new Error(error.message)
  const rows = (ra ?? []).filter((r: any) => r.source !== 'manual')
  const withHr = rows.filter((r: any) => r.hr_in_zone_pct != null)

  console.log(`\nProduction sample: ${rows.length} non-manual analyses, ${withHr.length} with HR.\n`)

  // ── 1. zone_drift ─────────────────────────────────────────────────────────
  // Keys on zoneDisciplineScore() = km-weighted mean of hr_in_zone_pct.
  // SAME non-directional quantity R30 was fixed for on 2026-09-13.
  const drifters = withHr.filter((r: any) => r.hr_in_zone_pct < ZONE_DISCIPLINE_BANDS.loose)
  const wrongWay = drifters.filter((r: any) => (r.hr_below_floor_pct ?? 0) > (r.hr_above_ceiling_pct ?? 0))
  // Live check, not a stored verdict: confirm the directional function actually
  // discriminates. If someone collapses it back into zoneDisciplineScore this
  // fails rather than printing a stale PASS.
  const gentle = zoneDriftScore([{ aboveCeilingPct: 0, actualLoadKm: 10 }])
  const hot    = zoneDriftScore([{ aboveCeilingPct: 60, actualLoadKm: 10 }])
  const directional = gentle !== null && hot !== null
    && gentle <= ZONE_DRIFT_ABOVE_CEILING_PCT && hot > ZONE_DRIFT_ABOVE_CEILING_PCT
  findings.push({
    trigger: 'zone_drift',
    keysOn: `zoneDriftScore > ${ZONE_DRIFT_ABOVE_CEILING_PCT}% (mean hr_above_ceiling_pct, DIRECTIONAL)`,
    verdict: directional ? 'PASS' : 'STRUCTURAL DEFECT',
    note: directional
      ? `FIXED 2026-09-13 (§12 Amendment 1). Was \`zoneDisciplineScore < ${ZONE_DISCIPLINE_BANDS.loose}\` — `
        + `the mean of hr_in_zone_pct, a BAND — while §12 prescribes a CAP. `
        + `${wrongWay.length}/${drifters.length} runs under the old threshold were predominantly too EASY, `
        + `and the trigger silently rewrote every easy/long coach note to "Easy sessions trending hard". `
        + `Now keys on the direction of the miss, and APPENDS its note rather than destroying the `
        + `existing prescription. Guarded by planAdjustment.test.ts, which previously passed `
        + `hrInZoneData: [] and never exercised this gate at all.`
      : `REGRESSED — zoneDriftScore no longer discriminates above-cap from below-cap.`,
  })

  // ── 2. shadow_load ────────────────────────────────────────────────────────
  const loaded = rows.filter((r: any) => r.planned_load_km > 0 && r.actual_load_km != null)
  const shadowFires = loaded.filter((r: any) =>
    ((r.actual_load_km - r.planned_load_km) / r.planned_load_km) * 100 > SHADOW_LOAD_THRESHOLD_PCT)
  findings.push({
    trigger: 'shadow_load',
    keysOn: `(actual-planned)/planned > ${SHADOW_LOAD_THRESHOLD_PCT}%`,
    verdict: 'PASS',
    note: `Directional by construction (over-running only, never under). `
      + `Would fire on ${shadowFires.length}/${loaded.length} runs with load data. `
      + `The quantity matches the claim.`,
  })

  // ── 3. ef_decline ─────────────────────────────────────────────────────────
  const efRows = rows.filter((r: any) => r.ef_trend_pct != null)
  const efFires = efRows.filter((r: any) => r.ef_trend_pct < EF_DECLINE_THRESHOLD_PCT)
  findings.push({
    trigger: 'ef_decline',
    keysOn: `ef_trend_pct < ${EF_DECLINE_THRESHOLD_PCT}%`,
    verdict: efRows.length >= 20 ? 'PASS' : 'NEEDS DATA',
    note: `Directional (decline only). Compares against the runner's OWN rolling baseline, `
      + `not a population norm. Fires on ${efFires.length}/${efRows.length} rows carrying a trend. `
      + `⚠️ EF is confounded by heat, terrain and fatigue — we hold elevation and never read it, `
      + `and hold no weather at all, so a decline cannot currently be attributed.`,
  })

  // ── 4. acute_chronic_high ─────────────────────────────────────────────────
  findings.push({
    trigger: 'acute_chronic_high',
    keysOn: `acuteChronicRatio >= ${LOAD_RATIO.watch}`,
    verdict: 'PASS',
    note: `Directional (ratio above a ceiling). Standard ACWR; Willy's own territory. `
      + `⚠️ Known and already filed: R26 — non-run activity is absent from the chronic side, `
      + `so a cross-training runner's ratio reads high. That inflates firing, it does not invert it.`,
  })

  // ── 5. fatigue_accumulation ───────────────────────────────────────────────
  findings.push({
    trigger: 'fatigue_accumulation',
    keysOn: `${FATIGUE_ACCUMULATION_THRESHOLD} consecutive tags in [${FATIGUE_HIGH_TAGS.join(', ')}]`,
    verdict: 'PASS',
    note: `Self-reported and directional. The runner said "Heavy/Wrecked/Cooked" three times running; `
      + `there is no measurement to be wrong about. Softens rather than skips.`,
  })

  // ── 6. long_run_shortfall ─────────────────────────────────────────────────
  findings.push({
    trigger: 'long_run_shortfall',
    keysOn: `${LONG_RUN_SHORTFALL_CONSECUTIVE} consecutive long runs below ${(LONG_RUN_SHORTFALL_COMPLETION_PCT * 100).toFixed(0)}% completion`,
    verdict: 'NEEDS DATA',
    note: `Directional (under-completion only). ⚠️ Completion is a DISTANCE ratio, and a beginner's `
      + `long run is duration-anchored with distance_km null — the SESSION-KM class. Needs checking `
      + `against sessionKm() rather than raw distance before it is trusted for that cohort.`,
  })

  // ── 7. readiness_signal ───────────────────────────────────────────────────
  findings.push({
    trigger: 'readiness_signal',
    keysOn: 'pre-session readiness (RHR/HRV/sleep), quality+long sessions only',
    verdict: 'PASS',
    note: `Softens, never skips, and only on quality/long. §ENGINE-03-pre already hardened the `
      + `RHR single-spike false positive (persistence-or-corroboration).`,
  })

  // ── 8. rpe_disconnect ─────────────────────────────────────────────────────
  findings.push({
    trigger: 'rpe_disconnect',
    keysOn: 'RPE >= 8 on an easy session, ONLY when no HR data exists',
    verdict: 'PASS',
    note: `Self-reported, directional, and correctly gated to the no-HR case so it cannot `
      + `contradict a measured zone read. Lowest priority.`,
  })

  // ── 9/10/11. user-initiated ───────────────────────────────────────────────
  for (const t of ['skip_with_reason', 'session_reorder', 'manual']) {
    findings.push({
      trigger: t,
      keysOn: 'explicit user action',
      verdict: 'PASS',
      note: `The runner asked for it. No signal to be wrong about; ADR-012 governs whether the `
        + `RESULT needs confirmation, which is a separate question from whether the trigger is real.`,
    })
  }

  // ── report ────────────────────────────────────────────────────────────────
  const pad = (s: string, n: number) => s.length > n ? s : s + ' '.repeat(n - s.length)
  for (const f of findings) {
    const mark = f.verdict === 'PASS' ? '✓' : f.verdict === 'NEEDS DATA' ? '?' : '✗'
    console.log(`${mark} ${pad(f.trigger, 22)} ${f.verdict}`)
    console.log(`    keys on: ${f.keysOn}`)
    console.log(`    ${f.note}\n`)
  }
  const defects = findings.filter(f => f.verdict === 'STRUCTURAL DEFECT')
  const needsData = findings.filter(f => f.verdict === 'NEEDS DATA')
  console.log(`${findings.length} triggers audited — ${defects.length} structural defect(s), ${needsData.length} needing data, ${findings.length - defects.length - needsData.length} pass.`)
  if (defects.length) {
    console.log(`\nSTRUCTURAL DEFECTS (these are wrong at any n):`)
    for (const d of defects) console.log(`  · ${d.trigger}`)
    process.exitCode = 1
  }
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
