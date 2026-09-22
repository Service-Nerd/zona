// SESSION-SIZING-ANCHOR-01 — a quality session is SIZED at the pace it RUNS.
//
// §120 §6 parked this by name as "the sizing twin of the header defect":
// `minPerKm` sizes a session and therefore sets its prescribed DISTANCE, and it
// read `pace.minPerKmQuality` for every non-VO2max quality session regardless of
// its work anchor — so a CV-anchored session's distance was computed at
// THRESHOLD pace.
//
// 🔴 IT WAS ALREADY CLOSED WHEN IT WAS FILED, BY THE SAME COMMIT THAT FILED IT.
// §120's header fix removed an `isMixedPaceRow &&` guard from BOTH `paceTarget`
// AND `minPerKm`, so every row with a paced rep block is now sized at its own
// work pace. Measured 2026-09-22 across 1,320 quality sessions: **0** are sized
// at threshold while running somewhere else. I filed it as "magnitude
// unmeasured" an hour after fixing it.
//
// ⚠️ AND THE FIRST MEASUREMENT SAID 20.2%. It counted `progressive_tempo` (267
// sessions) because `requiredPaceAnchors` returns the row's `E`-anchored opening
// third, and E is a RAMP, not a second work intensity — `hasMixedWorkAnchors`
// filters it for exactly that reason. Filtering it takes the number to zero.
// Fifth time this repo has recorded a wrong claim caused by the denominator.
//
// So this is a GATE, not a fix: the state can silently regress if anyone
// reinstates a shape-based guard on the sizing branch, and a note would not
// catch that.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { V1_SESSION_CATALOGUE, requiredPaceAnchors } from './sessionCatalogueData'
import type { GeneratorInput, Plan } from '@/types/plan'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const rowById = new Map(V1_SESSION_CATALOGUE.map(r => [r.id, r]))

/** Anchors §22 substitutes to goal, plus the ramp anchor that is not a work intensity. */
const NOT_A_DISTINCT_WORK_PACE = new Set(['T', 'goal', 'E'])

function corpus(): Plan[] {
  const plans: Plan[] = []
  for (const dist of [5, 10, 21.0975, 42.195])
  for (const days of [3, 4, 5])
  for (const lvl of ['beginner', 'intermediate', 'experienced'] as const)
  for (const goal of ['finish', 'time_target'] as const) {
    const input = {
      race_date: '2027-05-16', race_distance_km: dist, goal,
      ...(goal === 'time_target'
        ? { target_time: dist <= 10 ? '0:45:00' : dist <= 22 ? '1:45:00' : '3:45:00' }
        : {}),
      current_weekly_km: 40, longest_recent_run_km: 16,
      days_available: days, age: 38, fitness_level: lvl, training_age: '2-5yr',
      benchmark: { type: 'race', time: '0:45:00', distance_km: 10 },
      acknowledged_prep_warning: true,
    } as unknown as GeneratorInput
    try { plans.push(generateRulePlan(input, 'paid')) } catch { /* refused by design */ }
  }
  return plans
}

describe('SESSION-SIZING-ANCHOR-01 — sized at the pace it runs', () => {
  const plans = corpus()

  it('the corpus reaches the rows this is about', () => {
    // Anti-vacuous, and it is the whole reason the claim below means anything:
    // "0 sessions sized at threshold" is also what an empty corpus reports.
    let distinctAnchorSessions = 0
    for (const p of plans) for (const w of p.weeks) for (const s of Object.values(w.sessions)) {
      if (!s || s.type !== 'quality' || !s.catalogue_id) continue
      const row = rowById.get(s.catalogue_id)
      if (!row) continue
      if (requiredPaceAnchors(row).some(a => !NOT_A_DISTINCT_WORK_PACE.has(a))) distinctAnchorSessions++
    }
    expect(plans.length, 'no plans generated').toBeGreaterThan(20)
    expect(distinctAnchorSessions, 'no CV/HM/I-anchored quality sessions in the corpus').toBeGreaterThan(50)
  })

  it('a structured session prices its DISTANCE at its own work pace, not the threshold band', () => {
    // 🔴 THE FIRST VERSION OF THIS TEST WAS HOLLOW AND THE FALSIFICATION SAID SO.
    // It inferred "sized at work pace" from the derived set having a repeated
    // paced block — which is true whatever the sizing does. Reinstating the old
    // `isMixedPaceRow &&` guard on the `minPerKm` branch left it GREEN.
    //
    // Tracing why led to the real answer, and it is that
    // SESSION-SIZING-ANCHOR-01's PREMISE IS FALSE. A structured session's
    // distance comes from `segmentPricedDistance(mainMins, workPaceMinPerKm,
    // easy)` — the work pace itself — and never from `minPerKm`. `minPerKm`
    // reaches only `dur(rounded, minPerKm)` for UNSTRUCTURED sessions and the two
    // continuous tempo rows, which are genuinely threshold work. So there was
    // never a CV-anchored session sized at threshold pace to fix.
    //
    // This is therefore a SOURCE check, and it is honest about that: the
    // property worth protecting is that the pricing call reads the work pace.
    // Swap `workPaceMinPerKm` for `minPerKm` there and this goes red, which the
    // behavioural version could not do.
    const src = readFileSync(join(process.cwd(), 'lib/plan/ruleEngine.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    // ⚠️ BOUNDING THIS TOOK THREE ATTEMPTS AND THAT IS THE WHOLE LESSON.
    // `segmentPricedDistance` appears FOUR times — its own declaration, a
    // floor-growing loop, a rep-count loop, and the call that prices the session
    // that ships — and two different anchors matched the wrong one and reported
    // a failure on correct code. The site that matters is the reps branch of
    // `effectiveDistKm`, so anchor on THAT.
    const i = src.indexOf('segmentPricedKm(repPlan.mainMins')
    expect(i, 'the reps pricing call has moved — re-anchor this test').toBeGreaterThan(-1)
    const call = src.slice(i, src.indexOf(')', i) + 1)
    expect(call, 'a structured session must be priced at its WORK pace, not the threshold band')
      .toContain('repPlan.workPaceMinPerKm')
    expect(call).not.toContain('minPerKmQuality')
  })
})
