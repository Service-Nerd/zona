/**
 * The plan-read predicate registry. One owner per predicate: each is defined in exactly one file
 * below, and `registry.test.ts` fails on a duplicate id or a predicate missing its §, class,
 * source or description.
 */
import { NOTE_TRUTH } from './noteTruth'
import { RACE_PLAN } from './racePlan'
import { ON_RAMP } from './onRamp'
import { STRENGTH } from './strength'
import { MAINTENANCE } from './maintenance'
import type { MaintenancePredicate, PlanPredicate, StrengthPredicate } from '../types'

export const PLAN_PREDICATES: readonly PlanPredicate[] = [...NOTE_TRUTH, ...RACE_PLAN, ...ON_RAMP]
export const STRENGTH_PREDICATES: readonly StrengthPredicate[] = STRENGTH
export const MAINTENANCE_PREDICATES: readonly MaintenancePredicate[] = MAINTENANCE

export const ALL_PREDICATES = [...PLAN_PREDICATES, ...STRENGTH_PREDICATES, ...MAINTENANCE_PREDICATES]
