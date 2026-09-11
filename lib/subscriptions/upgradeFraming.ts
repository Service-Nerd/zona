// GTM-CHARITY-04 follow-up — which story the Upgrade screen tells.
//
// WHY THIS IS A FUNCTION AND NOT AN INLINE TERNARY. It used to be one:
// `trialExpired ? loss : gain`. A boolean can hold two states and there are
// three, so a charity runner whose GRANT ended fell into the trial branch and
// was told "14 days done" months after a charity gave them the app. The access
// really had ended, so nothing was mechanically wrong and nothing failed; the
// words were just wrong about the one thing that runner would remember. That is
// the silent class this repo keeps shipping, so the choice is now a named,
// tested rule rather than a condition inside a render.
//
// Placed beside `revenuecatEvents` because this is about entitlement lifecycle,
// not about charity specifically: `subscription` is a fourth caller waiting to
// happen when a paid subscription lapses and deserves its own words too.
//
// Returns a VARIANT, never copy. The strings stay in the component with the
// rest of the brand voice, and `UpgradeScreen` owns how a variant looks.

export type UpgradeFraming =
  /** Nothing has ended. Fresh gate, during or before the trial. */
  | 'gain'
  /** The 14-day trial ran out. */
  | 'trial-ended'
  /** A charity grant ran out. */
  | 'grant-ended'

export interface UpgradeFramingInput {
  /** Trial lapsed and nothing else is carrying them. */
  trialExpired: boolean
  /** They held a charity grant (live or lapsed) and have no access now. */
  grantExpired: boolean
}

/**
 * GRANT WINS when both are set, and both usually ARE set: a comped runner's
 * 14-day trial clock lapsed long before their 90-day gift did, so by the time
 * they see this screen the trial has "expired" in the technical sense too.
 * Resolving to the trial there is precisely the bug. The gift is the thing
 * they were told about, so it is the thing we reference.
 */
export function upgradeFraming(input: UpgradeFramingInput): UpgradeFraming {
  if (input.grantExpired) return 'grant-ended'
  if (input.trialExpired) return 'trial-ended'
  return 'gain'
}

/** Has something ENDED? Drives loss framing (the amber accent and the
 *  what-stopped list), which is identical for both endings: what stopped is
 *  the same, only the reason differs. */
export function isLossFraming(f: UpgradeFraming): boolean {
  return f !== 'gain'
}
