// TIER-BADGE-01 (Design Board, 2026-09-29) — the single owner of what a runner's access
// is CALLED and how it is TONED.
//
// ── 🔴 THE DEFECT THIS EXISTS FOR ────────────────────────────────────────────
// Me rendered `hasPaidAccess ? ((trialDaysLeft ?? 0) > 0 ? 'Trial' : 'Pro') : 'Free'` —
// THREE strings for FIVE states. `resolveTier` returns `admin | subscription | grant |
// trial | none`, so a **charity-comped runner, an admin and a paying subscriber all read
// "Pro"**. Five hundred Make-A-Wish runners receive codes this week and every one of them
// would have been told they were a subscriber.
//
// ⚠️ This is the same collapse `TIER-OWNER-01` was written for: a lapsed trial and a
// lapsed grant both resolve to `free`, so the TIER alone cannot answer "what do we say?".
// `reason` is not decoration — it is the only thing that can.
//
// ── ✅ THE WORDS ARE THE FOUNDER'S, AND HE HAS RULED ─────────────────────────
// The Design Board ruled that a distinction must EXIST and how it is ENCODED. It
// explicitly did not rule the copy: `ownership-map.md` gives voice and locked strings to
// the founder and `brand.md`.
//
// **"Gifted" was put to him with the collision named, and he kept it (2026-09-29):**
// *"Gifted is fine, keep it."* So `grant` is settled, not drafted.
//
// ⚠️ THE RESIDUAL, STATED ONCE AND NOT CHASED. The charity block elsewhere on Me reads
// **"Full access, free"** while `none` here reads **"Free"** — so the word "free"
// describes a gift on one card and no access on another. It is no longer a COLLAPSE,
// because the badge now says "Gifted" and the two never appear on the same runner's
// screen meaning different things. It is prose the founder owns; if he ever wants them
// aligned, this constant and that block are the two places.
//
// They are in one constant so that changing any of them is one edit, not a hunt.

import type { TierReason } from '@/lib/trial'
import type { StatusTone } from '@/components/shared/StatusBadge'

export interface TierBadge {
  label: string
  tone: StatusTone
}

/**
 * ⚠️ EVERY REASON IS PRESENT AND THEY ARE ALL DISTINCT. `Record<TierReason, …>` is
 * deliberate: a new `TierReason` fails the build here rather than silently falling back
 * to "Free", which is the dangerous default — it tells someone with access that they
 * have none.
 *
 * 🔴 TONE IS BINARY AND CARRIES NO RANK. The board: a tier badge marks a CATEGORY, and
 * "the moment any tier is styled up relative to another it becomes celebration"
 * (Celebrating the peak week, Wood, binding). `Free` is not a lesser visual than `Pro`;
 * it is the same label in a different colour, and the colour only says whether access is
 * currently held.
 */
export const TIER_BADGE: Record<TierReason, TierBadge> = {
  admin:        { label: 'Admin',  tone: 'held' },
  subscription: { label: 'Pro',    tone: 'held' },
  grant:        { label: 'Gifted', tone: 'held' },   // ✅ founder-ruled 2026-09-29
  trial:        { label: 'Trial',  tone: 'held' },
  none:         { label: 'Free',   tone: 'none' },
}

/**
 * The badge for a resolved reason. `null` while the tier is still resolving — the caller
 * renders NOTHING rather than guessing.
 *
 * ⚠️ A DEFAULT HERE WOULD BE A LIE. `tierReason` is null until `resolveTier` returns, and
 * defaulting to `none` would flash "FREE" at a paying subscriber on every open. Same
 * shape as the Connections subtitle, which may not assert a negative it cannot know yet.
 */
export function tierBadgeFor(reason: TierReason | null | undefined): TierBadge | null {
  return reason ? TIER_BADGE[reason] : null
}
