import type { Week, Session } from '@/types/plan'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionKmSelfPaced } from './sessionDistance'
import type { Violation } from './invariants'

/**
 * §116 — the base-build on-ramp's own validator.
 *
 * ⚠️ A SEPARATE VALIDATOR, NOT AN EXEMPTION, and the precedent is
 * `validateMaintenanceBlock`. A base-build plan has no race week, no taper, no
 * quality and no peak, so running it through `validatePlan` would fire a long
 * tail of rules describing a race block it is not. `invariants.ts:820-825`
 * records that the foundation block has broken server-side invariants THREE
 * times by sharing a surface it did not fit; this is the fourth block class and
 * it deliberately does not repeat that.
 *
 * Four checks, one per binding board amendment that is mechanically checkable.
 */
export function validateBaseBuildBlock(weeks: Week[], startKm: number): Violation[] {
  const v: Violation[] = []
  const ramp = weeks.filter(w => w.phase === 'base_build')
  if (ramp.length === 0) return v

  const isDeload = (w: Week) => w.type === 'deload' || w.badge === 'deload'
  const runsOf = (w: Week) =>
    (Object.values(w.sessions ?? {}) as (Session | undefined)[])
      .filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'cross-train')

  // ── Amendment 6 (Seiler) — all easy, no quality ────────────────────────────
  const QUALITY = new Set(['quality', 'tempo', 'intervals', 'hard', 'threshold', 'vo2max', 'cruise', 'race'])
  for (const w of ramp) {
    for (const s of runsOf(w)) {
      if (QUALITY.has(s.type)) {
        v.push({
          code: 'INV-PLAN-ONRAMP-ALL-EASY',
          principle_ref: 'CoachingPrinciples §116',
          severity: 'error',
          week: w.n,
          message: `Base-build week W${w.n} prescribes a ${s.type} session. The on-ramp is all easy (§116 amendment 6, Seiler) — this runner is building tissue tolerance, not fitness they can already express.`,
          actual: s.type,
          expected: 'easy / recovery / rest only',
        })
      }
    }
  }

  // ── Amendment 1 (Willy) — the curve climbs ─────────────────────────────────
  //
  // ⚠️ §57's invariant checks a CEILING and a flat block never breaches a
  // ceiling, which is exactly how §111's named remedy stayed impossible for a
  // year. The failure mode of a ramp is the inverse, so this is the inverse bound.
  const build = ramp.filter(w => !isDeload(w))
  for (let i = 1; i < build.length; i++) {
    const prev = build[i - 1], curr = build[i]
    if ((curr.weekly_km ?? 0) <= (prev.weekly_km ?? 0)) {
      v.push({
        code: 'INV-PLAN-ONRAMP-CURVE-CLIMBS',
        principle_ref: 'CoachingPrinciples §116',
        severity: 'error',
        week: curr.n,
        message: `Base-build W${curr.n} (${curr.weekly_km}km) does not build on W${prev.n} (${prev.weekly_km}km). A ramp that does not climb is §57's flat block wearing §116's label.`,
        actual: `${curr.weekly_km}km`,
        expected: `> ${prev.weekly_km}km`,
      })
    }
  }

  // ── Amendment 7 — the handover must not be a dip ───────────────────────────
  const last = ramp[ramp.length - 1]
  if (isDeload(last)) {
    v.push({
      code: 'INV-PLAN-ONRAMP-CURVE-CLIMBS',
      principle_ref: 'CoachingPrinciples §116',
      severity: 'error',
      week: last.n,
      message: `Base-build ends on a DELOAD week (W${last.n}). §111 re-gates on the volume the runner hands over at, so the last week must sit on the build line.`,
      actual: 'deload',
      expected: 'a build week',
    })
  }

  // ── Amendment 2 (Willy) — THE PER-RUN STEP IS THE LOAD EVENT ───────────────
  //
  // His words at the sitting: *"at 8 km/wk over 4 days that is 2 km a run, at
  // 18 it is 4.5; the per-run doubling is the load event"* — not the weekly
  // total. A week can climb 10% and still double a single run if the run count
  // falls, and the weekly cap cannot see that.
  //
  // ⚠️ THIS WAS A BOARD AMENDMENT WITH NO IMPLEMENTATION until the first ramp
  // plan was generated end to end and someone looked at the weeks. Ratified,
  // documented, and unchecked is the decorative-config failure wearing a
  // board ruling.
  //
  // Measured against the LONGEST run in each week, because that is the session
  // whose per-run step actually binds. Deload weeks are exempt on the same
  // basis every other ramp check exempts them.
  const cap = GENERATION_CONFIG.WEEK1_PER_RUN_STEP_MAX_KM
  const longestOf = (w: Week) =>
    Math.max(0, ...runsOf(w).map(s => sessionKmSelfPaced(s) ?? 0))
  let prevLongest: number | null = null
  for (let i = 0; i < ramp.length; i++) {
    const w = ramp[i]
    const longest = longestOf(w)
    if (i > 0 && !isDeload(w) && !isDeload(ramp[i - 1]) && prevLongest != null && prevLongest > 0) {
      const step = longest - prevLongest
      if (step > cap + 0.05) {
        v.push({
          code: 'INV-PLAN-ONRAMP-PER-RUN-STEP',
          principle_ref: 'CoachingPrinciples §116',
          severity: 'error',
          week: w.n,
          message: `Base-build W${w.n}'s longest run steps ${prevLongest.toFixed(1)}km → ${longest.toFixed(1)}km (+${step.toFixed(1)}km). §116 amendment 2 (Willy): the per-run step is the load event, not the weekly total.`,
          actual: `+${step.toFixed(1)}km`,
          expected: `≤ +${cap}km`,
        })
      }
    }
    prevLongest = longest
  }

  // ── §118 amendment 2 — THE TOTAL BUILD IS BOUNDED ────────────────────────
  //
  // 🔴 §2 CHECKS WEEK-ON-WEEK AND CANNOT SEE THE ENDPOINT. Sixteen weeks of a
  // lawful 10% under §3's deloads compounds to a **4.17x total build**, above
  // §111's `MAX_BASE_BUILD_RATIO` of 4.0 — every week legal, the sum not.
  //
  // ⚠️ THE RATIO IS A PROPERTY OF THE CURVE, NOT THE RUNNER: 2→8.3, 3→12.5,
  // 5→20.8 and 7→29.2 are all ~4.17x. Reported as "a 7 km/week runner ends at
  // 4.2x", it would have sent someone hunting for a per-runner cap.
  //
  // ⚠️ §111's 4.0 is REUSED, not re-chosen. Willy: *"I will not have two
  // total-build ceilings in one constitution differing by 0.17 because one of
  // them was measured off a 16-week curve."*
  //
  // ⚠️ This is the CHECKER, and `GET_RUNNING_MAX_WEEKS = 15` is the producer's
  // side. They are deliberately independent: the week count is one way to stay
  // inside the ratio, and a future change to the ramp rate or deload cadence
  // would breach it at 15 weeks without anyone touching this file.
  if (startKm > 0 && ramp.length > 0) {
    const endKm = ramp[ramp.length - 1].weekly_km ?? 0
    const ratio = endKm / startKm
    const cap = GENERATION_CONFIG.MAX_BASE_BUILD_RATIO
    if (ratio > cap + 0.01) {
      v.push({
        code: 'INV-PLAN-GET-RUNNING-BUILD-RATIO',
        principle_ref: 'CoachingPrinciples §118, §111',
        severity: 'error',
        week: ramp[ramp.length - 1].n,
        message: `Base-build block ends at ${endKm.toFixed(1)}km from a ${startKm.toFixed(1)}km start — a ${ratio.toFixed(2)}x total build, above §111's ${cap}x ceiling. Every week is §2-compliant; the SUM is not, and §2 cannot see the endpoint.`,
        actual: `${ratio.toFixed(2)}x`,
        expected: `<= ${cap}x`,
      })
    }
  }

  return v
}
