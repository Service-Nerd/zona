// STRENGTH-RECOVERY-01 (S13) — a strength session eased for recovery. Coaching Board, re-sat 2026-10-17:
// docs/decisions/strength-recovery-resitting-2026-10-17.md.
//
// SUBTRACT ONLY, literally: the eased session holds only exercises the original held, never more sets or reps
// on any of them, and no plyometrics. Heavy legs lose the lower-body lifts except calf / soleus work (Willy: tendon
// loading drops, never to zero); whatever upper and core work the session had stays. Every kept training item
// takes the day's sets × RECOVERY_SET_FACTOR. Warm-up and mobility are not load and are kept as written.
//
// The RUNNER decides (§59): this function is applied only once they accept. Whether recovery is off is not
// decided here either: that is `computeReadiness`, the run engine's one owner.

import { STRENGTH_CONFIG as C } from './config'
import { CATALOGUE_BY_ID, HEAVY_LEG_PATTERNS, PATTERN_REGION } from './catalogue'
import { estimateMinutes } from './session'
import type { Prescription, StrengthSession } from './types'

const patternOf = (it: Prescription) => CATALOGUE_BY_ID.get(it.exercise_id)?.pattern
const LOADED_ROLES = new Set(['main', 'accessory', 'core'])

export function easeForRecovery(s: StrengthSession): StrengthSession {
  const dropLower = s.heavy_legs
  const blocks = s.blocks
    .map(b => ({
      ...b,
      items: b.items
        .filter(it => b.role !== 'plyo' && patternOf(it) !== 'plyometric')
        .filter(it => !(dropLower && LOADED_ROLES.has(b.role) && PATTERN_REGION[patternOf(it)!] === 'lower' && patternOf(it) !== 'calf'))
        .map(it => LOADED_ROLES.has(b.role) ? { ...it, sets: Math.max(1, Math.min(it.sets, Math.round(it.sets * C.RECOVERY_SET_FACTOR))) } : it),
    }))
    .filter(b => b.items.length > 0)
  // A superset whose other half was dropped is a single lift again (S10 Am.5: a pair is two lifts).
  const tagCount = new Map<string, number>()
  for (const it of blocks.flatMap(b => b.items)) if (it.superset) tagCount.set(it.superset, (tagCount.get(it.superset) ?? 0) + 1)
  for (const b of blocks) b.items = b.items.map(({ superset, ...it }) => (superset && tagCount.get(superset)! > 1 ? { ...it, superset } : it))
  // The warm-up minutes are not in `blocks`' own estimate; keep the original's.
  const warmup = Math.max(0, s.estimated_minutes - estimateMinutes(s.blocks, 0))
  const heavy = blocks.some(b => LOADED_ROLES.has(b.role) && b.items.some(it => HEAVY_LEG_PATTERNS.includes(patternOf(it)!)))
  return { ...s, blocks, heavy_legs: heavy, estimated_minutes: Math.min(s.estimated_minutes, estimateMinutes(blocks, warmup)), eased_for: 'recovery' }
}
