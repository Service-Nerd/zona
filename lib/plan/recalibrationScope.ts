import { GENERATION_CONFIG } from './generationConfig'

/**
 * §125 — THE DECLARED SCOPE OF A RECALIBRATION, ENFORCED AT THE WRITE.
 *
 * `GENERATION_CONFIG.RECALIBRATION_SCOPE` lists the fields a confirmed
 * recalibration may write. This module is what makes that list the AUTHORITY
 * rather than a comment: every write goes through `writeScoped`, and a field
 * that is not declared fails loudly in development and test.
 *
 * ⚠️ WHY THIS EXISTS AT ALL, RATHER THAN A COMMENT SAYING "ONLY WRITE THESE".
 * The defect being fixed is precisely an undeclared write: `applyRecalibration`
 * set `pace_target` on every quality session with nothing saying it might, and
 * undid §120 on every recalibrated plan for as long as it did. A list nobody
 * checks would have described that defect just as well as it describes the fix.
 *
 * ⚠️ IT THROWS ONLY OUTSIDE PRODUCTION, which is `generateRulePlan`'s own split
 * and `savePlanForUser`'s. A runner whose recalibration fails to apply is worse
 * off than one holding a plan with an out-of-scope field in it; in production
 * the write is dropped and recorded rather than taken.
 */
const SCOPE = GENERATION_CONFIG.RECALIBRATION_SCOPE

export type ScopeKind = 'session' | 'structured' | 'derived_step' | 'meta'

const allowed: Record<ScopeKind, readonly string[]> = {
  session:      SCOPE.session_fields,
  // A structured session may take the common fields AND its own.
  structured:   [...SCOPE.session_fields, ...SCOPE.structured_only_fields],
  derived_step: SCOPE.derived_step_fields,
  meta:         SCOPE.meta_fields,
}

/** Is `field` inside the declared scope for this kind of target? */
export function inRecalibrationScope(kind: ScopeKind, field: string): boolean {
  return allowed[kind].includes(field)
}

/**
 * Assigns `value` to `target[field]` if §125 declares it writable, and
 * otherwise refuses — throwing outside production so the next undeclared write
 * fails the build instead of reaching a plan.
 */
export function writeScoped<T extends object>(
  target: T, kind: ScopeKind, field: string, value: unknown,
): void {
  if (!inRecalibrationScope(kind, field)) {
    const msg = `recalibration wrote "${field}" on a ${kind}, which §125 does not declare `
      + `(GENERATION_CONFIG.RECALIBRATION_SCOPE). Take it to the Coaching Board or drop it.`
    if (process.env.NODE_ENV !== 'production') throw new Error(msg)
    console.error(msg)
    return
  }
  ;(target as Record<string, unknown>)[field] = value
}
