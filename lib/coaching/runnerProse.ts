// READ-EM-DASH-01 — the em-dash rule, applied to prose the runner READS BACK.
//
// 🔴 THE RULE HAD GUARDS ON EVERY SURFACE EXCEPT THE ONE THAT GENERATES TEXT AT
// RUNTIME. `noEmDash.test.ts` holds marketing, `noEmDashApp.test.ts` holds
// `components/`, `app/dashboard/` and `lib/ui/` — all three read SOURCE. A run read
// is written by the model, in production, after every build has passed. The founder
// settled the scope on 2026-09-22: "No em dash in text or spoken word. In
// descriptions for sessions it's ok. I just don't want it in sentences." A run read
// is a sentence the runner reads.
//
// MEASURED in production, service-role read, 2026-10-08: 15 of the 83 LIVE
// `run_analysis.feedback_text` rows carry an em dash (18.1%). Across all 148 rows
// including superseded ones it is 70 (47.3%) — the generation rate is worse than the
// live rate, so the live figure understates how often the model reaches for one.
//
// 🔴 AND THE POPULATION IS TWO PRODUCERS, NOT ONE, WHICH IS WHY A PROMPT FIX ALONE
// WOULD HAVE LOOKED LIKE A FIX. The item was filed as a model problem. It is half a
// model problem: `"5km — right on the number."` and `"No activity data — RPE next
// time gives a clearer picture."` appear in production REPEATED VERBATIM, because
// they are template literals in `manualSessionFeedback.ts` — our own rule-engine
// prose, in `lib/coaching/`, outside every guard's roots. Fixing only the model
// boundary leaves the founder still reading em dashes in the short reads. Tenth
// recorded instance of the remedy applied to one twin.
//
// ⚠️ A PROMPT INSTRUCTION IS NOT A MECHANISM — the same sentence `readBudget.ts`
// carries, for the same reason. The model is TOLD not to use one and the output is
// REPAIRED if it does, because the word budget already proved the model ignores a
// stated limit (76 words against "two sentences").
//
// ⚠️ EN DASHES ARE CORRECT AND MUST SURVIVE. `CLAUDE.md`: "En dashes (–) in ranges
// are correct and must be kept (6:30–7:30 /km, Zone 4–5, RPE 1–10)." A read quotes
// pace bands and zones constantly, so a transform that reached U+2013 would corrupt
// the numbers this product exists to state precisely. Only U+2014 is touched, and
// `runnerProse.test.ts` falsifies that with a range string.

/** U+2014. Named, because the two dashes are one keystroke apart and opposite rules. */
const EM_DASH = '—'

/** U+2013, for the tests and for anyone reading this wondering which is which. */
export const EN_DASH = '–'

export function containsEmDash(text: string): boolean {
  return text.includes(EM_DASH)
}

/**
 * Replace every em dash with a comma, then tidy the punctuation that leaves behind.
 *
 * A COMMA, not a full stop, and the choice is not cosmetic. An em dash is nearly
 * always parenthetical or appositive — *"HR ran warm — 28°C will do that"* — and a
 * comma is grammatical in exactly those positions. A full stop would manufacture
 * sentence fragments out of clauses that depend on the one before them, and the
 * repo's own rule is that a sliced read is worse than a long one
 * (`readBudget.ts`: "the honest response to an over-long read is to notice it, not
 * to maim it"). Replacing the mark is not slicing; choosing the wrong replacement
 * would be.
 *
 * Idempotent: text with no em dash comes back identical, so this is safe to apply
 * at a boundary that may already have been through it.
 */
export function withoutEmDashes(text: string): string {
  if (!containsEmDash(text)) return text

  return text
    // The substitution. Absorbs the spaces on either side so `a — b` and `a—b`
    // both land on `a, b` rather than one of them keeping a stray space.
    .replace(/\s*—+\s*/g, ', ')
    // A dash FOLLOWING sentence punctuation (`...good. — but`) would leave `. , `.
    // The punctuation already did the comma's job, so drop it.
    .replace(/([.,;:!?])\s*,\s+/g, '$1 ')
    // `a, , b` from a doubled mark.
    .replace(/,(\s*,)+/g, ',')
    // A dash opening the string has nothing to be appositive TO.
    .replace(/^\s*,\s*/, '')
    // A dash closing the string (`...and that was that —`) leaves a dangling comma.
    .replace(/,\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * The field names the founder EXEMPTED, 2026-09-22 and confirmed 2026-10-08:
 * *"In descriptions for sessions it's ok."*
 *
 * ⚠️ NAMED, NOT PATTERN-MATCHED, and that is the whole point. Measured in production
 * 2026-10-08, `label` alone held **300 of the 834** em-dash prose fields in live plans, so
 * a sweep that ignored the exemption would have "fixed" the largest bucket **against his
 * stated wish** — and `CLAUDE.md` already records that a raw count of 544 on this same
 * rule *"would have misled"*.
 */
export const EM_DASH_EXEMPT_FIELDS: ReadonlySet<string> = new Set(['label', 'detail'])

/**
 * Walk a model-generated payload and repair every runner-facing string in it, leaving
 * the exempt fields alone.
 *
 * 🔴 WHY A DEEP WALK AND NOT A FIELD LIST. The enriched plan's prose fields are
 * `coach_notes`, `coach_intro`, `theme`, `confidence_risks` TODAY. A hand-kept list is
 * blind to the field nobody adds to it, which this repo has recorded as a class of its
 * own — most recently when copy moved into `lib/ui` and left the em-dash guard's
 * population. **The default here is "repair it", and the exemption is the thing that is
 * enumerated**, because that is the direction in which being wrong is cheap: a repaired
 * session description reads fine, an unrepaired sentence breaks the founder's rule.
 *
 * Arrays keep their shape and indices (`coach_notes` is a fixed-length tuple in the
 * schema, so this must not reshape it).
 */
export function withoutEmDashesDeep<T>(value: T, parentKey?: string): T {
  if (typeof value === 'string') {
    return (parentKey && EM_DASH_EXEMPT_FIELDS.has(parentKey)
      ? value
      : withoutEmDashes(value)) as unknown as T
  }
  if (Array.isArray(value)) {
    // The parent key carries THROUGH an array, so `coach_notes: [string, ...]` is
    // judged by the field name and not by the index.
    return value.map(v => withoutEmDashesDeep(v, parentKey)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = withoutEmDashesDeep(v, k)
    }
    return out as unknown as T
  }
  return value
}

