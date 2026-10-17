// STRENGTH-ENGINE-01 — choosing an exercise for a slot (S9, S11).
//
// Deterministic: same profile + week → same exercise. Kept for a block of
// `BLOCK_WEEKS` so loads can progress, then the next variant at that level.

import { CATALOGUE } from './catalogue'
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
  const start = ctx.profile.experience === 'new' ? C.PLYO_MIN_WEEKS_NEW : C.PLYO_MIN_WEEKS
  const since = Math.max(0, ctx.weekIndex - start)
  return Math.min(3, 1 + Math.floor(since / (C.BLOCK_WEEKS * 2))) as 1 | 2 | 3
}

const LOAD_TAGS: readonly EquipmentTag[] = ['dumbbells', 'kettlebell', 'barbell', 'machines', 'cable']

/** Uses external load in every way it can be done (bands do not count). */
export function isLoaded(ex: Exercise): boolean {
  return ex.equipment.every(o => o.some(t => LOAD_TAGS.includes(t)))
}

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
  let candidates = pool.filter(e => e.level === bestLevel)
  if (ctx.preferUnilateral) {
    const uni = candidates.filter(e => e.unilateral)
    if (uni.length) candidates = uni
  }
  // Prefer loaded options when the runner owns the kit: load is what moves economy (S6).
  const loaded = candidates.filter(isLoaded)
  if (loaded.length) candidates = loaded
  candidates = [...candidates].sort((a, b) => a.id.localeCompare(b.id))
  const block = Math.floor(ctx.weekIndex / C.BLOCK_WEEKS)
  return candidates[block % candidates.length]
}
