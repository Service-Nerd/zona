// storedPlanProbes.ts — the two questions the daily plan audit never asked.
//
// 🔴 THE MEASUREMENT, 2026-09-24. Three live-data defects were found in one week
// and all three were found by a person happening to look:
//
//   PLAN-ZONE-VS-HRTARGET-01  a card showed two different HR bands   6 of 22 plans
//   PLAN-RESTING-HR-ZERO-01   `meta.resting_hr = 0`                 10 of 22 plans
//   PLAN-VO2MAX-BAND-01       a VO2max session in the threshold band 1 plan, 2 sessions
//
// ⚠️ AND THE OBVIOUS CONCLUSION WAS WRONG. The item was filed as *"nothing
// parses a stored plan back through PlanSchema, so every gate runs at
// generation"*. Half of that is false: `/api/ops/plan-audit` has run
// `validatePlan` over every stored plan daily since 2026-09-03 and it fired the
// morning this was written. **The gap is not that nothing reads the table — it
// is that the daily read asks exactly one question.** Measure before filing the
// general form, not after.
//
// So this module adds the two probes that would each have caught a defect the
// existing one could not:
//
//   1. `schemaCodesFor` — `PlanSchema` over the STORED row. `resting_hr: 0` made
//      10 plans schema-invalid on a rule (`.positive()`) that had been correct
//      since the day it was written, and nothing ever parsed them, so it was
//      invisible for months.
//
//   2. `hrBandCodesFor` — does each session's `zone` describe its own
//      `hr_target`, and is a session in the band its CATALOGUE CATEGORY says it
//      should be in? `validatePlan` catches the first via
//      INV-PLAN-DISPLAY-ZONE-MATCHES-WORK. It cannot catch the second, because a
//      downgraded VO2max session is internally CONSISTENT — "Zone 3" beside the
//      Zone 3 band — and consistent is all that invariant asks.
//
// ── ALERT ON TRANSITION, NOT ON STATE ────────────────────────────────────────
//
// PLAN-AUDIT-01 ruled this and it binds anything added here: its first run found
// 15 of 15 stored plans invalid, most of it legitimate historical debt the
// live-plan policy deliberately never backfills, so a probe that alerts on "is
// this plan invalid?" fires on every row every day and trains everyone to ignore
// it. These probes therefore return CODES that join the route's existing
// per-user code set, which is already compared against the last set recorded.
// A known-bad legacy plan reports once and then goes quiet; a NEW break alerts
// the next morning.
//
// Pure, and deliberately so: the route holds the service-role client, and
// `lib/plan/*` may not (it is imported by `DashboardClient`). These take a
// parsed row and return strings.

import { PlanSchema } from '../plan/schema'
import { computeZones } from '../plan/zones'
import { hrBandFor } from '../plan/hrBand'
import { DAY_ORDER } from '../plan/days'

/** Day keys are COORDINATES in a path, not fields. See `schemaCodesFor`. */
const DAY_KEYS = new Set<string>(DAY_ORDER)

/** Shape of a stored row — deliberately loose; the point is that it may be junk. */
type StoredPlan = {
  meta?: Record<string, unknown>
  weeks?: Array<{ n?: number; sessions?: Record<string, Record<string, unknown> | undefined> }>
} | null | undefined

/** At most this many distinct schema paths per plan, so one broken row cannot
 *  fill the event detail. The COUNT is always reported. */
const MAX_PATHS = 6

/**
 * `PlanSchema` over a stored row. Returns `[]` when it parses.
 *
 * Codes are `SCHEMA:<path>` so two plans failing on the same field collapse to
 * the same code and the route's transition check behaves — a path, never a
 * message, because messages carry values and would make every row look unique.
 */
export function schemaCodesFor(plan: StoredPlan): string[] {
  const parsed = PlanSchema.safeParse(plan)
  if (parsed.success) return []
  const paths = new Set<string>()
  for (const issue of parsed.error.issues) {
    // ⚠️ COLLAPSE THE COORDINATES, KEEP THE FIELD. `weeks.3.sessions.sun.type`
    // and `weeks.5.sessions.tue.type` are ONE defect in ONE field. Both the week
    // INDEX and the DAY key are coordinates: `sessions` is a fixed keyset over
    // days, so the day carries no schema meaning. Left uncollapsed, a plan with
    // a bad `type` on eleven sessions produced four codes and a different plan
    // with the same defect produced a different four — the transition check
    // would then read every plan as unique and never go quiet, which is the
    // failure PLAN-AUDIT-01 exists to avoid.
    paths.add(`SCHEMA:${issue.path.map(seg =>
      typeof seg === 'number' || DAY_KEYS.has(String(seg)) ? '#' : String(seg)).join('.')}`)
  }
  const sorted = Array.from(paths).sort()
  return sorted.length > MAX_PATHS
    ? [...sorted.slice(0, MAX_PATHS), `SCHEMA:+${sorted.length - MAX_PATHS}-more`]
    : sorted
}

/**
 * Does every session sit in the band its catalogue row says, with a `zone`
 * string that describes its own `hr_target`?
 *
 * ⚠️ `HR-BAND-MISMATCH` IS THE ONE NO OTHER CHECK CAN RAISE. A VO2max session
 * rewritten into the threshold band is self-consistent, so
 * INV-PLAN-DISPLAY-ZONE-MATCHES-WORK passes it. Only comparing against the
 * catalogue category finds it — which is exactly how `applyHrToPlan` changed a
 * live prescription and stayed green across the whole suite.
 *
 * Silent on anything it cannot resolve: no max HR, no catalogue row, a band that
 * matches neither. Guessing is the defect this was written for.
 */
export function hrBandCodesFor(plan: StoredPlan): string[] {
  const mhr = plan?.meta?.max_hr
  if (typeof mhr !== 'number' || mhr <= 0) return []
  const z = computeZones(mhr, plan?.meta?.resting_hr as number | undefined)
  const codes = new Set<string>()

  for (const w of plan?.weeks ?? []) {
    for (const s of Object.values(w?.sessions ?? {})) {
      if (!s || typeof s.hr_target !== 'string') continue

      // Which band is the session ACTUALLY in, read from its own numbers?
      const actual = s.hr_target === z.qualityHR ? 'quality'
                   : s.hr_target === z.intervalsHR ? 'intervals'
                   : null

      // (a) does the zone STRING describe the band the session is in? §84 Am.
      if (actual !== null && typeof s.zone === 'string') {
        const want = actual === 'intervals' ? z.intervalsZone : z.qualityZone
        if (s.zone !== want) codes.add('HR-ZONE-STRING-MISMATCH')
      }

      // (b) is it in the band its CATALOGUE CATEGORY says it should be in?
      const expected = hrBandFor(s as never)
      if (expected === null) continue                     // unresolvable — stay silent
      if (expected !== 'quality' && expected !== 'intervals') continue
      if (actual === null) continue                       // neither band — not ours to judge
      if (expected !== actual) codes.add('HR-BAND-MISMATCH')
    }
  }
  return Array.from(codes).sort()
}

/**
 * The full code set for one stored plan: invariant codes, plus both probes,
 * de-duplicated and sorted.
 *
 * 🔴 IT IS A FUNCTION BECAUSE THE MERGE WAS WRONG THE MOMENT IT EXISTED. The
 * route decided "is this plan clean?" with `if (!errors.length)` — correct while
 * invariants were the only source, and wrong the instant anything else could
 * contribute a code: a plan with a schema break and no invariant error would
 * have taken the CLEAN path and never been reported. That is precisely the
 * "the check reads a different source from the thing it reports" class the
 * schema probe was added to catch, reintroduced one line away from it.
 *
 * With the merge owned here, the route's emptiness test can only read this.
 */
export function storedPlanCodes(plan: StoredPlan, invariantCodes: readonly string[]): string[] {
  return Array.from(new Set([
    ...invariantCodes,
    ...schemaCodesFor(plan),
    ...hrBandCodesFor(plan),
  ])).sort()
}
