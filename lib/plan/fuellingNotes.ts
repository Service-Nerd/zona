// §24e / §115 — the single owner of the fuelling cue strings.
//
// ⚠️ THIS MODULE EXISTS TO BREAK A CYCLE, AND THE CYCLE WAS REAL. The constants
// started life in `ruleEngine.ts` and `invariants.ts` imported them, which
// closed a loop (`ruleEngine` imports `validatePlan`). The symptom was not an
// import error — it was unrelated tests failing in other files, which is how a
// circular import usually presents and why it is worth a named module rather
// than a re-export.
//
// Producer and checker share these definitions instead of holding two copies of
// a prose fragment: runner-facing copy gets edited for tone, and a checker that
// matched the prose by hand would break on a comma (the designed-refusal
// matching trap this repo has already recorded).

/**
 * Practice guidance for a long session, used where no catalogue cadence exists.
 *
 * ⚠️ PRACTICE, NEVER A NUTRITION PRESCRIPTION. No grams, no calories, no
 * schedule. Zonna holds no dietary data (ADR-011) and must not imply
 * individualised nutrition advice; the note tells the runner to rehearse what
 * they already intend to use.
 */
export const FUELLING_PRACTICE_NOTE =
  'Long enough that fuelling matters. Practise what you plan to use on race day, and start before you feel you need it.'

/** §24e — the ultra cadence note interpolates a number, so the invariant
 *  matches this PREFIX rather than a whole string. */
export const ULTRA_FUELLING_PREFIX = 'Fuel every '
