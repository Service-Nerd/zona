/**
 * `BASEBUILD-HANDOVER-01` — the words on the card when a base-build block ends.
 *
 * ⚠️ IN AN OWNER MODULE, NOT IN THE COMPONENT, and `ux-principles` says why: *"a
 * ternary in JSX cannot be called, so which branch renders cannot be proven."* Same
 * reason `linkPickerCopy.ts` exists.
 *
 * ── THE REGISTER, WHICH IS THE WHOLE CRAFT PROBLEM ──────────────────────────
 * 🧠 Sutherland (SLT): *"a plan that ends is not a neutral event. It is the most
 * psychologically loaded moment the product has… that is where people quit, and they
 * quit feeling foolish for having tried."* Sheena goes 5 → 19 km/week over fifteen
 * weeks; for her that is the most successful thing she has ever done as a runner.
 * 🔬 Wood (SLT, binding): it is a **CONTEXT CHANGE, not motivation** — *"it fires on
 * the context, not on a schedule, and it does not nag."*
 *
 * **They split, and the resolution is where the number goes.** The work is honoured by
 * the METRIC LINE, factually, and not by an adjective. *"Fifteen weeks, 5 km to 19 km a
 * week"* is the achievement stated; *"amazing work!"* is the thing this brand exists not
 * to say. Nothing here congratulates and nothing here is cold.
 *
 * 🔴 **HARD RULE 7: THE COPY MAY NOT PROMISE A PLAN THE ENGINE WILL NOT PRODUCE.**
 * Measured the day after each live block ends: Sheena's race plan generates (14 weeks);
 * **Tom's returns `PrepTimeError (warn_unacknowledged)`** and only generates once he
 * acknowledges a short runway. So the action is *"Build the marathon plan"* — an
 * instruction to try — and never *"your plan is ready"*.
 *
 * 🔴 **AND THE REFUSAL HAD NOWHERE TO GO UNTIL 2026-10-13.** This note used to say
 * *"if it refuses, `RefusalView` carries it honestly (§44's two-step pattern, which
 * `PREP-ACK-NO-WRITER-01` just made reachable)"*. `RefusalView` is not on this path:
 * the card is on Today, and every refusal surface renders under `screen === 'plan'`.
 * So a refused handover showed the runner **nothing at all**, and so did a successful
 * one. `MODIFY-WARN-ACK-01` put the reason and §44's consent step on the card itself.
 * Hard rule 7 was being kept by the COPY and broken by the WIRING.
 *
 * ⚠️ **NO QUALIFIER CLAUSE, DELIBERATELY.** MAINT-06's metric line ends *"below your
 * base, on purpose"* because a maintenance block's low volume is SURPRISING and needs
 * explaining. Nothing here is surprising, so nothing is explained. **Restraint is not
 * copying the sibling pattern's third clause because it has one.**
 *
 * ⚠️ The race is named by DISTANCE, never by the runner's own name for it, because that
 * name is unrecoverable (`generator_input.race_name === "Base building"` on both live
 * plans; the refusal telemetry never recorded it). A loss, not a lie, and nothing here
 * implies we remember something we do not.
 *
 * ⚠️ No em dashes (founder, 2026-09-11). No emoji in functional copy.
 */

import { formatDistance } from '@/lib/format'
import type { DistanceUnits } from '@/lib/format'
import { raceLabelFor } from '@/lib/plan/raceLabel'
import { raceDistanceKey } from '@/lib/plan/generationConfig'
import { raceBlockTitle, raceBlockLineFor } from '@/lib/plan/checkpointCopy'
import type { StagedRace, StagedDisplay } from '@/lib/plan/stagedRacePlan'

export interface HandoverCopy {
  eyebrow: string
  title: string
  line: string
  /** The achievement, stated as fact. `null` when the block recorded no volumes, so an
   *  incomplete record renders nothing rather than a half sentence. */
  metric: string | null
  primary: string
  secondary: string
}

export function handoverCopy(opts: {
  raceDistanceKm: number
  blockWeeks: number
  startKm: number
  deliveredKm: number
  units: DistanceUnits
}): HandoverCopy {
  const { raceDistanceKm, blockWeeks, startKm, deliveredKm, units } = opts
  // Article-ready lower case, from the single owner of that noun (REFUSAL-COPY-02).
  const label = raceLabelFor(raceDistanceKey(raceDistanceKm))
  const from = formatDistance(startKm, units)
  const to = formatDistance(deliveredKm, units)

  return {
    eyebrow: 'Base building done',
    title: "That's the base done.",
    // What happens next, and the one genuinely useful fact: the race plan is built from
    // the volume the block DELIVERED, not the figure typed fifteen weeks ago.
    line: `The ${label} block is next, and it builds from where you are now.`,
    // ⚠️ Units via `formatDistance` (ADR-015's single owner). A distance string
    // assembled by hand here is the defect ADR-015 exists to prevent.
    metric: blockWeeks > 0 && from && to && deliveredKm > startKm
      ? `${blockWeeks} weeks · ${from} to ${to} a week`
      : null,
    primary: `Build the ${label} plan`,
    // The runner's own refusal voice, and it keeps control with them. `ux-principles`
    // bars dead ends, so the secondary path is always present.
    secondary: 'Not yet',
  }
}

/**
 * NO-RUNNER-TURNED-AWAY-01 — the same card for a STAGED plan, whose base building ends at a checkpoint.
 *
 * 🔴 NOT "That's the base done", AND NO METRIC. Both state what was PLANNED (`base_build_target_km`), and the second
 * Coaching Board sitting ruled crediting planned volume a defect: the two live base-build runners had recorded 3.1 of a
 * planned 21 km, and 0 of 16.5. The checkpoint says what they RAN, after the tap, on the server's measurement
 * (Design Board amendment 5). Before the tap the card says only what is true already: the race block, and that it is
 * built now. The founder's words (`checkpointCopy.ts`).
 */
export function stagedHandoverCopy(staged: StagedRace, view: StagedDisplay): HandoverCopy {
  const label = raceLabelFor(raceDistanceKey(staged.race_distance_km))
  return {
    eyebrow: 'Checkpoint',
    title: raceBlockTitle(staged),
    line: raceBlockLineFor(staged, view.raceBlockStart),
    metric: null,
    primary: `Build the ${label} plan`,
    secondary: 'Not yet',
  }
}
