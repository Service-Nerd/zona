// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS).
//
// L2's unit: one principle as data. B3 ports `GENERATION_CONFIG`, the invariants and
// the strength codes into entries of this shape; B1 fixes the shape.
//
// ARCH-ENG-003: a rule REFERENCES its § and its config key and never copies a value.
// There is no value field, the schema is strict so one cannot be added, and the
// explain template may not contain a digit outside a `{placeholder}` or a § reference.
// `resolveRuleConfigKey` proves the key exists in the real config object.

import { z } from 'zod'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import { STRENGTH_CONFIG } from '@/packages/strength'

/** Existing code ids are kept (ADR-027 v1.1): `INV-…` (validatePlan), `S-…` (strength). */
export const RuleIdSchema = z.string().regex(/^(INV|S)-[A-Z0-9][A-Z0-9-]*$/)

/** `§12`, `§116 Am. 16`, `§21b Am. 4c`, `S9 Am. 5` (StrengthPrinciples). */
export const PrincipleRefSchema = z.string().regex(/^(§\d+[a-z]?|S\d+)( Am\. \d+[a-z]?)?$/)

export const ConfigKeyRefSchema = z.strictObject({
  source: z.enum(['GENERATION_CONFIG', 'STRENGTH_CONFIG']),
  key: z.string().min(1),
})

/** Digits are allowed only inside `{…}` placeholders and § / S-number references. */
function explainCopiesNoValue(t: string): boolean {
  return !/\d/.test(t.replace(/\{[^}]*\}/g, '').replace(/(§\d+[a-z]?|\bS\d+)( Am\. \d+[a-z]?)?/g, ''))
}

export const RuleSchema = z.strictObject({
  id: RuleIdSchema,
  principle_ref: PrincipleRefSchema,
  scope: z.enum(['profile', 'block', 'week', 'session', 'plan', 'note', 'strength']),
  /** hard: never violated (a refusal if it cannot be met). soft: may yield, and the
   *  yield is a Decision with a lever. prefer: placement preference. */
  kind: z.enum(['hard', 'soft', 'prefer']),
  /** The numeric this rule reads, by reference. null for a rule with no tunable. */
  config_key: ConfigKeyRefSchema.nullable(),
  /** Runner-facing explanation, with `{placeholders}` the L4 layer fills from a Decision. */
  explain: z.string().min(1).refine(explainCopiesNoValue, {
    message: 'explain copies a value: numbers come from the Decision through a {placeholder} (ARCH-ENG-003)',
  }),
})

export type Rule = z.infer<typeof RuleSchema>
export type RuleId = z.infer<typeof RuleIdSchema>
export type ConfigKeyRef = z.infer<typeof ConfigKeyRefSchema>

/** Does the referenced key exist in the config object it names? */
export function resolveRuleConfigKey(rule: Pick<Rule, 'config_key'>): boolean {
  if (rule.config_key === null) return true
  const src: Record<string, unknown> = rule.config_key.source === 'GENERATION_CONFIG'
    ? GENERATION_CONFIG as unknown as Record<string, unknown>
    : STRENGTH_CONFIG as unknown as Record<string, unknown>
  return Object.prototype.hasOwnProperty.call(src, rule.config_key.key)
}
