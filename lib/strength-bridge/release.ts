// STRENGTH-ENGINE-01 — who may use strength, decided in ONE place (ADR-024 §9).
//
// 🔒 Admin-only while the founder tests it. A tier check alone CANNOT do this:
// `resolveTier` returns 'paid' for every admin, so "paid only" would admit every
// paying runner too. This is a separate release switch, read here and nowhere else,
// and enforced on the server by every strength route (not just hidden in the UI).

export type StrengthRelease = 'admin' | 'paid'

/** Flip to 'paid' at launch (SLT: when the December cohort is mid-plan). */
export const STRENGTH_RELEASE: StrengthRelease = 'admin'

export function canUseStrength(
  who: { isAdmin: boolean; tier: 'free' | 'trial' | 'paid' },
  release: StrengthRelease = STRENGTH_RELEASE,
): boolean {
  if (release === 'admin') return who.isAdmin === true
  return who.isAdmin === true || who.tier === 'paid' || who.tier === 'trial'
}
