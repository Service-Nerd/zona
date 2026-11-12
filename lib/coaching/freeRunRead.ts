// ACT-FREE-TEASE-01 — THE SINGLE OWNER of what a FREE runner is told about the run they just
// finished. SLT 2026-11-12: the zone split of a runner's own run is FREE; the read, the verdict,
// the advice, the weekly score and the reshape stay PAID.
//
// 🔴 WHY THIS EXISTS AT ALL. In `PostRunScreen` and `SessionScreen` the whole read cluster sits
// behind `hasPaidAccess`, so a free runner logs a run, answers RPE and fatigue — both free, DS-06
// — and the screen then **stops**. That is not restraint, it is a truncation, and the two are
// indistinguishable in a screenshot, which is why it survived. It also contradicts a STANDING
// design ruling in as many words: *"Gate richness, never access. A locked row stays visible and
// readable."*
//
// 📐 AND THE NUMBER IS ALREADY IN THE FREE RUNNER'S OWN ROW. `hr_in_zone_pct`,
// `hr_above_ceiling_pct` and `hr_pct_z1…z4_5` are written at INGEST by `lib/health/adapter.ts`,
// the Strava webhook and `link-activity` — none of them tier-gated, because
// `HK-FREE-INGEST-LINE-01` moved the gate down to the analysis. Measured 2026-11-12, non-admin
// non-internal: free/trial runners hold **146 activities, 122 of them (83.6%) carrying the
// split**. No new computation, no model call, no cost.
//
// ⚠️ HUTCHINSON'S CONDITION IS BINDING AND IT IS THE WHOLE SHAPE OF THIS MODULE (SLT, 2026-11-12):
// *"the split is a MEASUREMENT and the advice is an INTERPRETATION. `78% in Zone 2` is a fact
// about a run; `that was the right easy run` is a coaching claim and needs the plan, the phase and
// the week's load. Show the fact, withhold the claim, and do not let the fact be WORDED as a
// claim."* So every sentence below is declarative and **no evaluative word appears on the free
// path** — not "good", not "held", not "too hard". `freeRunRead.test.ts` asserts that mechanically
// against a word list rather than trusting the copy to stay that way.
//
// ⚠️ IT IS NOT PATTERN 11'S LOCKED STATE, and Silvanto corrected the pattern rather than the build
// (Design Board Q1, amendment 1). Pattern 11 renders a locked percent as `—%` at 0.4 opacity
// *"because the live percent is HR-derived from `run_analysis` — paid"*. **That premise is false at
// ingest.** Dressing a real number in the withheld-number treatment teaches the runner the number
// is fake, so this is a THIRD state: measured, unadvised.

import { BRAND } from '@/lib/brand'
import { runEffortKind, type RunEffortKind, type RunEffortRow } from './runEffort'

/**
 * The band whose share is quoted, and the words for it.
 *
 * ⚠️ THE SPELLINGS ARE NOT FREE CHOICES. `lib/coaching/kitReceipts.ts` already writes "Zone 3" and
 * "Zones 1–2" as prose on the Coach screen and the Upgrade screen, and two spellings of one band
 * inside one product is the drift class this repo keeps paying for. `freeRunRead.test.ts` asserts
 * these strings against the ones `kitReceipts` emits, so a rename there fails here.
 *
 * ⚠️ The dashes are EN dashes and must stay. CLAUDE.md: em dashes are banned in runner-facing
 * sentences; **en dashes in ranges are correct** (`Zone 4–5`, `6:30–7:30 /km`).
 */
export const FREE_RUN_READ_BANDS = {
  easy: 'Zones 1–2',
  grey: 'Zone 3',
  hard: 'Zones 4–5',
} as const

export type FreeRunReadBand = keyof typeof FREE_RUN_READ_BANDS

/**
 * ⚠️ ONE NUMBER, NOT FOUR (Design Board Q1, amendment 2 — Collins): *"nobody feels a histogram. If
 * we show all four zones on free we have built a dashboard, and we killed dashboards."*
 *
 * The rule is derived from the classifier that already decided what kind of run it was, so there is
 * no new threshold and no new coaching numeric: **quote the share of the band the run spent itself
 * in.** `split` quotes the hard share, because a run with real easy AND real hard in it is
 * described by the hard part.
 *
 * 🔴 `planned` IS GONE, AND SO IS THE PLANNED TYPE. The first cut mapped it to `hard` — "for a
 * run that was MEANT to be hard the easy share is a true number about nothing" — and that was
 * wrong for the only live member of the set. `isHardEffortType` is `quality | intervals | tempo |
 * hard`, and `sessionRole.ts` measures that **`intervals` and `tempo` occur in no generated or
 * stored plan (5,664 cohort plans, 36 production plans)**: the live case is `quality`, whose
 * prescribed band is Z3, so a correctly-executed threshold session would have read *"10% of this
 * run was in Zones 4–5"* — a true number about the wrong band, reading as though they barely
 * worked. ⚠️ **And my only test case used `'intervals'`, a type the product never produces**,
 * which is `fixtures must use the PRODUCT's values` exactly.
 *
 * The special case was unnecessary as well as wrong: an intervals run lands in Z4–5 and
 * classifies `hard` on its own; a tempo lands in Z3 and classifies `grey`. **The natural band
 * already answers correctly for both, so the band is a property of the RUN and the planned type is not
 * consulted at all.**
 */
const BAND_FOR_KIND: Record<Exclude<RunEffortKind, 'unknown' | 'planned'>, FreeRunReadBand> = {
  easy:    'easy',
  grey:    'grey',
  hard:    'hard',
  split:   'hard',
}

export type FreeRunRead =
  /** The run carried heart rate: one real number, one declarative sentence, the advice withheld. */
  | { state: 'measured'; band: FreeRunReadBand; pct: number; sentence: string; locked: string; cta: string }
  /**
   * No heart rate on this run.
   *
   * ⚠️ THIS IS AN ABSENT SENSOR, NEVER A LOCK AND NEVER A FAILURE (ADR-011 §5, Sims). An
   * iPhone-only runner has no heart rate at all and upgrading would not give them one, so this
   * state carries **no upgrade link** — offering one would be selling something that cannot help.
   * Measured 2026-11-12: 24 of 146 free/trial activities are in this state.
   */
  | { state: 'no_hr'; sentence: string; sub: string }
  /** Nothing to say: no linked run at all. The card does not render. */
  | { state: 'absent' }

/** Rounded the same way `kitReceipts` rounds, so the two surfaces cannot disagree by a point. */
const pct = (n: number) => Math.round(n)

/**
 * What a free runner is told about this run.
 *
 * @param row the linked activity's stored zone columns, or null when no run is linked
 */
export function freeRunRead(row: RunEffortRow | null): FreeRunRead {
  if (!row) return { state: 'absent' }

  // ⚠️ `null` for the planned type, deliberately: see BAND_FOR_KIND. The band is what the run
  // DID, and `runEffortKind`'s `planned` short-circuit answers a different question (the effort
  // record's dots, where "this was a planned hard session" is the point).
  const kind = runEffortKind(row, null)
  if (kind === 'unknown') {
    return {
      state: 'no_hr',
      sentence: 'No heart rate on this one, so there are no zones to show.',
      sub: `A watch or chest strap that writes to Apple Health is what gives ${BRAND.coachName} the zones.`,
    }
  }

  // ⚠️ `planned` IS UNREACHABLE HERE BY CONSTRUCTION — `runEffortKind` only returns it for a
  // non-null `plannedType` and we pass null — but it is NARROWED EXPLICITLY rather than cast
  // away. An unreachable branch that is merely ASSUMED unreachable is how `if (!week) return`
  // got into this codebase; if the classifier ever changes, this falls to the hard share rather
  // than to `undefined`.
  const band: FreeRunReadBand = kind === 'planned' ? 'hard' : BAND_FOR_KIND[kind]
  const share =
    band === 'easy' ? (row.hr_pct_z1 ?? 0) + (row.hr_pct_z2 ?? 0)
    : band === 'grey' ? (row.hr_pct_z3 ?? 0)
    : (row.hr_pct_z4_5 ?? 0)

  return {
    state: 'measured',
    band,
    pct: pct(share),
    // Declarative. A fact about a run, with nothing said about whether it was the right one.
    sentence: `of this run was in ${FREE_RUN_READ_BANDS[band]}.`,
    // ⚠️ The same sentence shape free Coach already uses ("Kit's weekly read turns this into one
    // thing to do next. That part is Pro."), narrowed from the week to this run. One voice.
    locked: `${BRAND.coachName}’s read turns this into one thing to do next. That part is Pro.`,
    // Pattern 11's locked CTA form. "Unlock" rather than "See", because tapping it reaches the
    // paywall and not the read.
    cta: 'Unlock the read →',
  }
}
