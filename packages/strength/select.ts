// STRENGTH-ENGINE-01 — choosing an exercise for a slot (S9, S11).
//
// Deterministic: same profile + week → same exercise. Kept for a block of
// `BLOCK_WEEKS` so loads can progress, then the next variant at that level.

import { CATALOGUE, isLoadedExercise } from './catalogue'
import { STRENGTH_CONFIG as C } from './config'
import type { EquipmentTag, Exercise, InjuryTag, Pattern, StrengthProfile } from './types'

export function equipmentSatisfied(ex: Exercise, have: readonly EquipmentTag[]): boolean {
  const kit = new Set<EquipmentTag>([...have, 'bodyweight'])
  return ex.equipment.some(option => option.every(tag => kit.has(tag)))
}

export interface SelectionContext {
  profile: StrengthProfile
  injuries: readonly InjuryTag[]
  /** 0-based count of strength weeks completed before this one. */
  weekIndex: number
  /** Running-focused lower-body slots prefer single-leg variants. */
  preferUnilateral: boolean
  /** The strength week jumps were first PLACED (S8). Absent: they have not been yet, so this week would be the first. */
  plyoFirstWeek?: number
  /** S1 Am.3 (STRENGTH-AB-SESSIONS-01) — 0 for the week's first session of a kind (A), 1 for the second (B), and so on. */
  variant?: number
}

/** Target level from experience, climbing one rung per block, capped at 3. */
export function targetLevel(ctx: SelectionContext): 1 | 2 | 3 {
  const start = ctx.profile.experience === 'new' ? 1 : ctx.profile.experience === 'some' ? 2 : 2
  const novice = C.NOVICE_BLOCK_WEEKS[ctx.profile.experience]
  const climbed = ctx.weekIndex < novice ? 0 : 1 + Math.floor((ctx.weekIndex - novice) / (C.BLOCK_WEEKS * 2))
  return Math.min(3, start + climbed) as 1 | 2 | 3
}

/**
 * STRENGTH-PLYO-BUDGET-01 — jumps climb from the JUMPS start, not the lifting level (board
 * direction, catalogue review 2026-10-17). A runner who lifts at level 2 has never jumped in
 * this plan, so the first jump is level 1 and it climbs at the same rate lifting does: one
 * rung per two blocks. Before it, a `some` lifter's first jump was bounding or a drop jump.
 */
export function plyoLevel(ctx: SelectionContext): 1 | 2 | 3 {
  // From the first jump the runner actually met, not from the week the gate opened: a run week (or chosen days,
  // PINNED-DAYS-01) can leave no leg day for weeks after the gate, and the first jump then arrived at level 2.
  const start = ctx.plyoFirstWeek ?? ctx.weekIndex
  const since = Math.max(0, ctx.weekIndex - start)
  return Math.min(3, 1 + Math.floor(since / (C.BLOCK_WEEKS * 2))) as 1 | 2 | 3
}

/** Uses external load in every way it can be done; owned by `isLoadedExercise` (STRENGTH-BW-LOG-01). */
export const isLoaded = isLoadedExercise

export function eligible(ex: Exercise, ctx: SelectionContext): boolean {
  if (!equipmentSatisfied(ex, ctx.profile.equipment)) return false
  if (ex.avoid_with.some(t => ctx.injuries.includes(t))) return false
  if (ctx.profile.bone_health_flag && (ex.impact === 'high' || ex.spinal_flexion_loaded)) return false
  if (ex.impact === 'high' && ctx.injuries.some(t => C.PLYO_RESTRICTING_INJURIES.includes(t))) return false
  return true
}

/**
 * The exercise for `pattern`, or null when nothing in the catalogue fits this
 * runner's kit and injuries (the plan carries a `pattern_unavailable` note).
 * `exclude` stops the same exercise appearing twice in one session.
 */
export function selectExercise(pattern: Pattern, ctx: SelectionContext, exclude: ReadonlySet<string> = new Set(), main = false): Exercise | null {
  let pool = CATALOGUE.filter(e => e.pattern === pattern && !exclude.has(e.id) && eligible(e, ctx))
  if (pool.length === 0) return null
  // A main lift is where load lives (S6): when the runner owns loaded kit, a
  // loaded exercise beats a harder bodyweight one.
  if (main) {
    // S9 Am.1 — a main slot is a compound you can load. Never empty: every pattern that fills
    // a main slot has a main-eligible bodyweight entry (catalogue.test.ts holds that).
    pool = pool.filter(e => !e.not_main)
    if (pool.length === 0) return null
    const loaded = pool.filter(isLoaded)
    if (loaded.length) pool = loaded
  }
  const level = pattern === 'plyometric' ? plyoLevel(ctx) : targetLevel(ctx)
  // Highest level at or below target; if nothing that low, the lowest available.
  const atOrBelow = pool.filter(e => e.level <= level)
  const bestLevel = atOrBelow.length ? Math.max(...atOrBelow.map(e => e.level)) : Math.min(...pool.map(e => e.level))
  const preferred = (list: Exercise[]): Exercise[] => {
    let c = list
    if (ctx.preferUnilateral) {
      const uni = c.filter(e => e.unilateral)
      if (uni.length) c = uni
    }
    // Prefer loaded options when the runner owns the kit: load is what moves economy (S6).
    const loaded = c.filter(isLoaded)
    if (loaded.length) c = loaded
    return [...c].sort((a, b) => a.id.localeCompare(b.id))
  }
  const candidates = preferred(pool.filter(e => e.level === bestLevel))
  const block = Math.floor(ctx.weekIndex / C.BLOCK_WEEKS)
  const first = block % candidates.length
  const variant = ctx.variant ?? 0
  if (variant === 0) return candidates[first]
  // S1 Am.3 — a B session takes the next exercise in the same rotation, so A keeps today's answer and both hold
  // for the block (S14 progresses each). Fewer candidates than sessions: the rest of the pool, ranked below.
  // The A's preferences rank first (load over bodyweight, S6; single-leg where the slot prefers it), then the level,
  // and never more than one level below the A, so a week's sessions stay at one difficulty.
  const rank = (e: Exercise) => (isLoaded(e) ? 0 : 2) + (ctx.preferUnilateral && !e.unilateral ? 1 : 0)
  const rest = pool.filter(e => !candidates.includes(e) && e.level <= bestLevel && e.level >= bestLevel - 1)
    .sort((a, b) => rank(a) - rank(b) || b.level - a.level || a.id.localeCompare(b.id))
  const order = [...candidates.slice(first), ...candidates.slice(0, first), ...rest]
  return order[variant % order.length]
}
