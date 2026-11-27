// FREE — infrastructure. ADR-027 B3 step 4 (ADR027-B3-STRICT-01 rows D2/D3, Coaching Board 2026-11-22).
//
// L2: a CHECK's own parameters, one entry per rule, keyed by rule id. The sitting's words:
// "Tolerances become the rule's parameters in the catalogue."
//
// ── 🔴 THIS FILE HOLDS VALUES, AND THAT IS A DECLARED POSITION ON ARCH-ENG-003, NOT AN OVERSIGHT ──
// ARCH-ENG-003 is "a rule REFERENCES its § and its config key and never COPIES a value", and
// `triggers.ts` applies it to itself by holding `threshold_keys` — SYMBOLS — rather than numbers.
// It is keyed by id like this file, and the resemblance ends there: a trigger's thresholds already
// had an owner to point at, and these numbers have none. There is nothing to reference.
//
// So the choice is between a reference to a place the number does not live (which is a fiction) and
// OWNERSHIP here. ARCH-ENG-003 exists to stop a second copy drifting from the first; a table that
// is the only declaration cannot drift from anything, and the gate sweeps the tree so a second
// declaration fails the build. `RuleSchema` is untouched: a `Rule` row still carries `config_key`
// and no value field, and the schema is still strict, so the invariant ARCH-ENG-003 protects — a
// RULE ROW never holding a number — is unchanged. Recorded in ADR-027 § ARCH-ENG-003.
//
// ── WHY HERE AND NOT `GENERATION_CONFIG` ────────────────────────────────────────────────────────
// `invariants.ts` argued the opposite, in writing, in two places, citing CLAUDE.md's own tunability
// test: "Enforcement tolerance (inline, not a coaching numeric — it tunes what the CHECKER flags,
// not what the engine prescribes)". That reasoning was never in front of the board, whose conflict
// scan named only the no-benchmark paces. Both halves are right: a tolerance is not a prescription,
// AND a number written out three times with nothing holding the copies equal is a defect whatever
// file it lives in. So the fix is OWNERSHIP, in the layer that reads it, and the catalogue is that
// layer. A `GENERATION_CONFIG` key would also owe a `CoachingPrinciples` § per number
// (`configPrincipleSync` fails a new key without one), which is doctrine authoring rather than the
// naming the sitting ruled, and "No value changes" was the ruling's own condition.
//
// ⚠️ WHERE A NUMBER IS PRESCRIPTION RATHER THAN SLACK IT SAYS SO BELOW, and that is the set the
// board can adopt into `GENERATION_CONFIG` with a § when it chooses (`CHECK-PARAM-PRESCRIPTION-01`).
// Nothing here is a copy: this file is the owner, and `checkParams.test.ts` sweeps the tree so a
// second declaration of any of these numbers fails the build.
//
// 🔻 NOT a general home for every literal in a checker. One entry exists per number the sitting
// named, and the gate refuses an entry no checker reads — a parameter nothing consults is the
// decorative-config class this repo has paid for three times.

import type { RuleId } from '@/lib/engine/contracts/rule'

/** A rule's own parameters. Numbers, because this file OWNS them — see the header on ARCH-ENG-003. */
export interface CheckParams {
  /** Why this rule has parameters at all, and whether each is enforcement slack or prescription. */
  readonly note: string
  readonly values: Readonly<Record<string, number>>
}

export const CHECK_PARAMS: Readonly<Record<string, CheckParams>> = {
  // §19. SLACK. The prescription's own band is ±2%; the checker's is looser so display rounding
  // cannot raise a finding, while a whole-band mislabel still does (`invariants.ts`'s own reason).
  'INV-PLAN-LABEL-MATCHES-PACE': {
    note: 'slack — looser than the prescription\'s own band so display rounding cannot flag, per §19',
    values: { vo2_pace_tolerance_pct: 5, threshold_pace_tolerance_pct: 3 },
  },

  // §85. PRESCRIPTION. An over-under's mean sits FASTER than T pace, and not by much: the band is
  // what §85 says an over-under IS, so a checker reading it is reading doctrine, not slack. Signed,
  // never absolute — a mean slower than threshold is a tempo run with a different name.
  'INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD': {
    note: 'prescription — §85\'s own band for an over-under\'s mean; a candidate for GENERATION_CONFIG with a §',
    values: { faster_than_t_min_pct: 0, faster_than_t_max_pct: 3 },
  },

  // §30. PRESCRIPTION. The race-week shakeout's RPE ceiling. Its MINUTES half is already
  // `GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS`; the RPE half never was, which is the asymmetry
  // the sitting caught (D2).
  'INV-PLAN-RACE-WEEK-SHAKEOUT-CAP': {
    note: 'prescription — §30\'s RPE ceiling, the half RACE_WEEK_SHAKEOUT_MAX_MINS left behind',
    values: { max_rpe: 3 },
  },

  // §24b. PRESCRIPTION. The HM ceiling for a 5K/10K peak long-run segment is priced at a DISCOUNTED
  // VDOT, so the ceiling is a touch slower than the runner's raw HM pace. The Daniels fraction next
  // to it (0.84 = HM) stays inline: D1 ruled the fractions algorithm constants and exempt.
  'INV-PLAN-5K10K-LR-PACE-CAP': {
    note: 'prescription — the VDOT discount behind §24b\'s HM ceiling; the 0.84 beside it is a Daniels fraction (D1, exempt)',
    values: { vdot_discount: 0.97 },
  },

  // §90. SLACK. Absorbs session-distance rounding and MIN_SESSION_DISTANCE granularity on
  // low-volume weeks, where one dropped easy km is a large percentage.
  'INV-PLAN-INJURY-CAP-DELIVERED': {
    note: 'slack — absorbs single-km rounding on low-volume weeks, against INJURY_WEEKLY_INCREASE_CAP_PCT',
    values: { delivered_rounding_tolerance_pct: 10 },
  },

  // §94. SLACK, the same number for the same reason against a different cap. ⚠️ It was a SECOND
  // local `const` of the same name in `invariants.ts`, in a rule the verifier has not ported
  // (DELIVERED-RAMP is one of the 14 held), so nothing could ever have compared the two.
  'INV-PLAN-DELIVERED-RAMP': {
    note: 'slack — the same rounding allowance as §90\'s, against MAX_WEEKLY_VOLUME_INCREASE_PCT (§94)',
    values: { delivered_rounding_tolerance_pct: 10 },
  },
} as const

/** One parameter, by rule and name. Throws rather than defaulting: a missing parameter is a
 *  catalogue defect, and a silent `0` tolerance would turn every rounding artefact into a finding
 *  while a silent `Infinity` would turn the rule off. Absence is never a value. */
export function checkParam(rule: RuleId | string, name: string): number {
  const v = CHECK_PARAMS[rule]?.values[name]
  if (typeof v !== 'number') throw new Error(`CHECK_PARAMS: no parameter ${rule}.${name}`)
  return v
}
