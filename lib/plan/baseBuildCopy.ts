import { BRAND } from '@/lib/brand'

/**
 * §118 — the words a refused runner reads.
 *
 * THE SINGLE OWNER of base-building offer copy. Two variants, keyed on whether
 * the plan actually gets the runner to a race door, because **two outcomes
 * wearing one plan name is how a promise gets made by implication**
 * (McMillan, Coaching Board) and the SLT ruled two variants rather than one.
 *
 * ⚠️ SLT CONSTRAINTS, ALL FOUR, AND EACH ONE IS LOAD-BEARING:
 *
 * 1. **Lead with the plan, not the refusal** (Sutherland). The old string was
 *    *"a door with an apology taped to it"*. The offer is the headline now and
 *    "not yet" is the subordinate clause.
 * 2. **The clearing variant NAMES THE NUMBER** (Traynor) — *"a commitment we
 *    can actually underwrite, because we computed it."*
 * 3. 🔴 **THE NON-CLEARING VARIANT SAYS NOTHING ABOUT A MARATHON.** Hutchinson,
 *    hard rule 7: a claim about a future plan is still a claim. The old copy
 *    promised *"we will build the plan then"* to a runner who may never
 *    qualify — *"when it does not happen, the runner concludes you lied, and
 *    they will be right"* (Sutherland).
 * 4. **"Base building", never "getting running"** (Sutherland): *"they DO run —
 *    badly, not enough, but they run. The name argues with them on the one
 *    point they are most sensitive about."*
 *
 * ⚠️ No em dashes (founder call, 2026-09-11). En dashes in ranges are fine.
 */

export interface BaseBuildOffer {
  weeks: number
  endsAtKm: number
  reachesRaceDoor: boolean
  /** Units the runner reads in. ADR-015 owns the formatting, not this module. */
  distanceLabel: string
}

/**
 * The offer line. One sentence where one will do.
 *
 * ⚠️ IT DOES NOT APOLOGISE AND IT DOES NOT CONSOLE. The refusal message that
 * precedes it already states the situation; repeating it here would be the
 * "door with an apology" the SLT rejected.
 */
export function baseBuildOfferLine(o: BaseBuildOffer): string {
  return o.reachesRaceDoor
    // Underwritten: the engine computed that this plan reaches the door, so
    // the sentence is a commitment we can keep rather than an encouragement.
    ? `${o.weeks} weeks of base building takes you to ${o.distanceLabel} a week, and a race plan opens up at the end of it.`
    // ⚠️ NOT A SOFTER VERSION OF THE SAME SENTENCE. It makes no claim about a
    // race at all, because for this runner we cannot make one.
    : `${o.weeks} weeks of base building takes you to ${o.distanceLabel} a week, at a rate your body can absorb.`
}

/** The heading. Names the thing, never the shortfall. */
export function baseBuildOfferTitle(): string {
  return 'Base building'
}

/**
 * The one line that explains why this rather than the plan they asked for.
 *
 * ⚠️ It states the reason ONCE and does not repeat it. `BRAND.name` is
 * interpolated, never hardcoded.
 */
export function baseBuildOfferWhy(): string {
  return `${BRAND.name} will not sell you a race plan you cannot safely do yet. This is the one that gets you there.`
}
