// STRENGTH-ENGINE-01 — the package's public surface. Import from here, never from a file inside.
export * from './types'
export { STRENGTH_CONFIG } from './config'
export { CATALOGUE, CATALOGUE_BY_ID, CATALOGUE_REVIEW_STATUS, PATTERN_REGION } from './catalogue'
export { generateStrengthPlan, standaloneContext, type GenerateOptions } from './generate'
export { validateStrengthPlan, recoveryEaseViolations, progressionViolations, type StrengthViolation } from './validate'
export { easeForRecovery } from './recovery'
export { suggestLoad, isLoadedLift, isNoStepSession, loadsInjury, type LiftFeel, type LiftLog, type LiftSuggestion } from './progression'
export { parseStrengthProfile, EQUIPMENT_TAGS, INJURY_TAGS, type ProfileParseResult } from './profile'
