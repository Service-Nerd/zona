// ENRICH-PII-MINIMISE-01 — the runner's first name does not go to Anthropic.
//
// SLT 2026-09-20, Fried's amendment: *"That's better than any consent screen."*
// The name was sent purely for voice personalisation — `enrich.ts`'s ATHLETE
// block and `voiceRules`' "you may address X once" line. Removing it takes a
// direct identifier out of a third-party transfer **at no product cost**,
// because the voice is unchanged: the model writes a placeholder and we put the
// name back.
//
// ⚠️ SUBSTITUTION HAPPENS SERVER-SIDE, IMMEDIATELY AFTER THE MODEL RESPONDS AND
// BEFORE ANYTHING IS PERSISTED. The obvious alternative — store the token and
// resolve it at every render — was rejected: coach notes are persisted in the
// plan JSON and read by a long tail of surfaces, so one missed read site shows
// a runner the literal `{{RUNNER}}`. Resolving at the boundary means nothing
// downstream changes and the token cannot leak by omission.
//
// ⚠️ THIS IS NOT ANONYMISATION AND MUST NOT BE DESCRIBED AS SUCH. Injury
// history, race, date and volume still go to the model, and Hutchinson defended
// the injury history at the same sitting because the voice materially depends
// on it. This removes ONE direct identifier. `LEGAL-PRIVACY-01` still has to
// name everything that remains.

/** What the model is told to write in place of the runner's name. */
export const RUNNER_NAME_TOKEN = '{{RUNNER}}'

/**
 * The instruction handed to the model. Deliberately explicit that the token is
 * literal — a model told only "use a placeholder" will invent one.
 */
export const RUNNER_NAME_TOKEN_INSTRUCTION =
  `- If you address the runner by name, write exactly ${RUNNER_NAME_TOKEN} — it is substituted before they see it. Never invent a name.`

/**
 * Put the name back. Call this on EVERY string that came from a model, before
 * persisting or returning it.
 *
 * ⚠️ When the name is missing the token is removed rather than left or replaced
 * with "Athlete". A runner who never gave us a name should read a sentence with
 * no name in it, not one addressed to a placeholder — and "Athlete" is the
 * `PROFILE-NAME-01` defect (the engine said "Athlete" to everyone) that we
 * already fixed once.
 */
export function resolveRunnerName<T extends string | null | undefined>(
  text: T,
  firstName: string | null | undefined,
): T {
  if (typeof text !== 'string' || !text.includes(RUNNER_NAME_TOKEN)) return text
  const name = (firstName ?? '').trim()
  if (name) return text.split(RUNNER_NAME_TOKEN).join(name) as T
  // No name: drop the token and tidy the punctuation it leaves behind
  // (", {{RUNNER}}." → "." and "{{RUNNER}}, " → "").
  return text
    .split(`, ${RUNNER_NAME_TOKEN}`).join('')
    .split(`${RUNNER_NAME_TOKEN}, `).join('')
    .split(`${RUNNER_NAME_TOKEN} `).join('')
    .split(RUNNER_NAME_TOKEN).join('')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim() as T
}

/**
 * Deep-resolve every string in a parsed model response. Used on the enrichment
 * payload, which is an object of labels and coach notes rather than one string.
 */
export function resolveRunnerNameDeep<T>(value: T, firstName: string | null | undefined): T {
  if (typeof value === 'string') return resolveRunnerName(value, firstName) as unknown as T
  if (Array.isArray(value)) return value.map(v => resolveRunnerNameDeep(v, firstName)) as unknown as T
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveRunnerNameDeep(v, firstName)
    return out as T
  }
  return value
}

/** Guard for tests and the ops layer: did anything reach the model with a name in it? */
export function containsRunnerName(prompt: string, firstName: string | null | undefined): boolean {
  const name = (firstName ?? '').trim()
  if (name.length < 2) return false
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(prompt)
}
