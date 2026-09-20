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

/**
 * §80 Amendment 2 (Coaching Board 2026-09-20) — the unrehearsed-fuelling tail on
 * the long-run shortfall note.
 *
 * ⚠️ WHY A SECOND FUELLING STRING AND NOT `FUELLING_PRACTICE_NOTE`. That one is a
 * SESSION note: "this run is long enough that fuelling matters, practise it."
 * This one is a PLAN-level consequence: the race is materially longer than
 * anything the plan will rehearse, so the fuelling itself is untested. Different
 * claim, different surface, and collapsing them would make one of the two lie.
 *
 * Sims at the sitting: *"Three and a half hours beyond your longest run is a
 * different problem from being tired, and this cohort's failure mode is
 * under-fuelling."* The existing tail says the DISTANCE will be new territory and
 * says nothing about the fuelling.
 *
 * ⚠️ PRACTICE, NEVER A NUTRITION PRESCRIPTION — same constraint as
 * `FUELLING_PRACTICE_NOTE`. No grams, no schedule (ADR-011: we hold no dietary
 * data).
 */
export const LR_SHORTFALL_UNREHEARSED_FUELLING =
  'That also means your fuelling goes untested past the point your longest run reaches, so practise it on the long runs you do have.'
