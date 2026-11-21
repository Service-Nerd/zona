// STRENGTH-ENGINE-01 — the prescription model (ADR-024 §4, S6–S8).
//
// `(focus, phase, experience, slot) → dose`. The catalogue never carries sets or
// reps; this is the only place they are decided.

import { STRENGTH_CONFIG as C } from './config'
import type { BlockRole, Exercise, Prescription, RunPhase, StrengthProfile } from './types'
import { PATTERN_REGION } from './catalogue'

export interface DoseContext {
  profile: StrengthProfile
  phase: RunPhase
  weekIndex: number
}

export function inNoviceBlock(ctx: DoseContext): boolean {
  return ctx.weekIndex < C.NOVICE_BLOCK_WEEKS[ctx.profile.experience]
}

function scaleSets(sets: number, ctx: DoseContext, role: BlockRole): number {
  if (ctx.phase === 'taper') {
    return role === 'main' ? C.MAINTENANCE_MAIN_SETS : C.MAINTENANCE_ACCESSORY_SETS
  }
  let s = sets
  if (ctx.phase === 'peak' && role === 'main') s = Math.max(2, s - C.PEAK_MAIN_SET_REDUCTION)
  if (ctx.phase === 'deload') s = Math.max(1, Math.round(s * C.DELOAD_SET_FACTOR))
  return s
}

export function plyoContacts(weekIndex: number, experience: StrengthProfile['experience']): number {
  const start = experience === 'new' ? C.PLYO_MIN_WEEKS_NEW : C.PLYO_MIN_WEEKS
  const steps = Math.max(0, Math.floor((weekIndex - start) / C.PLYO_CONTACTS_STEP_EVERY_WEEKS))
  return Math.min(C.PLYO_CONTACTS_MAX, C.PLYO_CONTACTS_START + steps * C.PLYO_CONTACTS_STEP)
}

/**
 * The fewest sets of a jump the S10 fill step may restore: S8's start dose, in TOTAL foot contacts, read from the item's
 * own fields (a per-side set lands twice its `contacts`). STRAVA-SOR-REVIEW-FIX-02: every jump's set now lands
 * PLYO_CONTACTS_PER_SET in total, so this is 3 for both shapes, and never above a jump's own dose.
 */
export function plyoRestoreMinSets(item: Pick<Prescription, 'contacts' | 'per_side'>): number {
  const perSet = (item.contacts ?? C.PLYO_CONTACTS_PER_SET) * (item.per_side ? 2 : 1)
  return Math.ceil(C.PLYO_CONTACTS_START / perSet)
}

export function prescribe(ex: Exercise, role: BlockRole, ctx: DoseContext): Prescription {
  const per_side = ex.unilateral
  const base = { exercise_id: ex.id, per_side }

  if (role === 'warmup') {
    return ex.measure === 'seconds'
      ? { ...base, sets: 1, seconds: C.WARMUP_ITEM_SECONDS, rir: null, rest_s: C.REST_S.warmup }
      : { ...base, sets: 1, reps: 8, rir: null, rest_s: C.REST_S.warmup }
  }
  if (role === 'mobility') {
    return { ...base, sets: 1, seconds: C.MOBILITY_ITEM_SECONDS, rir: null, rest_s: C.REST_S.mobility }
  }
  if (role === 'plyo') {
    const contacts = plyoContacts(ctx.weekIndex, ctx.profile.experience)
    // ADR-027 hotfix 3 (S8 defect fix): S8 doses TOTAL foot contacts, in sets of PLYO_CONTACTS_PER_SET.
    // STRAVA-SOR-REVIEW-FIX-02: a per-side set is the SAME set split across the legs, PLYO_CONTACTS_PER_SET / 2 each
    // side, so it lands PLYO_CONTACTS_PER_SET in total and every jump takes the same sets: 30 is 3 x 5/side, exactly.
    // The first fix halved the sets instead (20 in the start week), the second rounded up (40); both missed S8's dose.
    // A bilateral jump is unchanged byte for byte. Every S8 dose is a multiple of PLYO_CONTACTS_PER_SET, so the total
    // is the dose exactly (plyoPerSide.test.ts asserts both, and that PLYO_CONTACTS_PER_SET is even).
    const sets = ctx.phase === 'deload'
      ? Math.max(1, Math.round((contacts / C.PLYO_CONTACTS_PER_SET) * C.DELOAD_SET_FACTOR))
      : Math.max(1, Math.min(Math.ceil(contacts / C.PLYO_CONTACTS_PER_SET), Math.floor(C.PLYO_CONTACTS_MAX / C.PLYO_CONTACTS_PER_SET)))
    const perSetContacts = per_side ? C.PLYO_CONTACTS_PER_SET / 2 : C.PLYO_CONTACTS_PER_SET
    return { ...base, sets, contacts: perSetContacts, rir: null, rest_s: C.REST_S.plyo }
  }
  if (role === 'core') {
    const sets = scaleSets(C.CORE_SETS, ctx, role)
    return ex.measure === 'reps'
      ? { ...base, sets, reps: C.ACCESSORY_REPS, rir: C.RIR_MAIN, rest_s: C.REST_S.core }
      : { ...base, sets, seconds: C.CORE_SECONDS, rir: null, rest_s: C.REST_S.core }
  }

  const novice = inNoviceBlock(ctx)
  const lower = PATTERN_REGION[ex.pattern] === 'lower'
  if (role === 'main') {
    if (novice) {
      return { ...base, sets: scaleSets(C.MAIN_SETS - 1, ctx, role), reps: C.NOVICE_REPS, rir: C.NOVICE_RIR, rest_s: C.REST_S.main }
    }
    const heavy = lower && ctx.profile.focus === 'running'
    // S6 Am.2 — general focus cycles its main lifts' reps by block, on the same block boundary as the exercise
    // rotation (S9), so a new lift and a new target arrive together. Running keeps heavy 5s on its lower mains.
    const cycle = C.MAIN_REP_CYCLE_GENERAL
    const reps = heavy ? C.HEAVY_REPS_RUNNING_LOWER
      : ctx.profile.focus === 'general' ? cycle[Math.floor(ctx.weekIndex / C.BLOCK_WEEKS) % cycle.length]
      : C.MAIN_REPS_UPPER
    const rir = lower ? C.RIR_FLOOR_LOWER_HEAVY : C.RIR_MAIN
    return { ...base, sets: scaleSets(C.MAIN_SETS, ctx, role), reps, rir, rest_s: heavy ? C.REST_S.heavy : C.REST_S.main }
  }
  // accessory
  if (ex.measure === 'seconds') {
    return { ...base, sets: scaleSets(C.ACCESSORY_SETS, ctx, role), seconds: C.CORE_SECONDS, rir: null, rest_s: C.REST_S.accessory }
  }
  return {
    ...base,
    sets: scaleSets(C.ACCESSORY_SETS, ctx, role),
    reps: novice ? C.NOVICE_REPS : C.ACCESSORY_REPS,
    rir: novice ? C.NOVICE_RIR : C.RIR_MAIN,
    rest_s: C.REST_S.accessory,
  }
}
