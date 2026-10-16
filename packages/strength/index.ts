// STRENGTH-ENGINE-01 — the package's public surface. Import from here, never from a file inside.
export * from './types'
export { STRENGTH_CONFIG } from './config'
export { CATALOGUE, CATALOGUE_BY_ID, CATALOGUE_REVIEW_STATUS } from './catalogue'
export { generateStrengthPlan, standaloneContext, type GenerateOptions } from './generate'
export { validateStrengthPlan, type StrengthViolation } from './validate'
export { parseStrengthProfile, EQUIPMENT_TAGS, INJURY_TAGS, type ProfileParseResult } from './profile'
