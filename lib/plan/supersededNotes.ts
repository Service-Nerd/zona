/**
 * Step notes that were REWRITTEN after plans had already been generated.
 *
 * 🔴 A STEP NOTE IS STAMPED INTO `plan_json` AT GENERATION, so editing the
 * catalogue changes what NEW plans say and leaves every existing plan exactly as
 * it was. Measured across the whole production `plans` table at the moment the
 * copy shipped: **336 step notes stamped**, of which **30 still carried the
 * "cruise set" sentence the founder reported, 11 the circular "just past
 * threshold", and 5 the bare "VO2max effort."**
 *
 * ⚠️ THIS IS THE SECOND TIME IN TWO DAYS AND I GOT IT WRONG AGAIN IN BETWEEN. The
 * ramp had the same shape (`backfillLegacyRamp`), I wrote the rule down —
 * *"when a fix lands in the engine, ask what an existing plan will do"* — and
 * then told the founder these strings "are read at render, so they'll reach your
 * existing plan." They are not. They are cached in his plan.
 *
 * ⚠️ WHY AN EXACT-STRING MAP RATHER THAN RE-READING THE CATALOGUE. Re-resolving a
 * note would mean index-matching a stored step back to a catalogue row whose
 * structure may have changed since; a wrong index shows the wrong instruction,
 * which is worse than stale copy. An exact match can only ever replace the
 * sentence it names.
 *
 * ⚠️ IT IS DEBT, DELIBERATELY BOUNDED. Every entry is a string that was live in
 * production, never a convenience for editing copy. It empties when a migration
 * rewrites the stored notes; until then it is the only thing that reaches a
 * runner mid-block.
 */
export const SUPERSEDED_NOTES: Readonly<Record<string, string>> = {
  // STEP-NOTE-SELF-CONTAINED-01 — referenced a session the runner may never have run.
  'Threshold now. Same effort as rep three of a cruise set.':
    'Threshold now. It should feel harder than the same pace would feel fresh.',
  // COPY-TERM-HANDLE-01 — glossed one coaching term with another.
  'Four minutes at critical velocity — just past threshold, controlled. Not a VO2max rep.':
    'Four minutes at critical velocity — a notch past comfortably hard, and controlled. Not flat out.',
  'The over — just past threshold. A gear change, not a surge.':
    'The over — a notch past comfortably hard. A gear change, not a surge.',
  'The under — back to threshold without stopping. This half is the session.':
    'The under — back to comfortably hard, without stopping. This half is the session.',
  // COPY-TERM-HANDLE-01 — named a lab measurement with no handle on the effort.
  'Three minutes at VO2max effort. Even splits — don’t blow rep one.':
    'Three minutes at VO2max effort — about as hard as you could hold for ten minutes. Even splits; don’t blow rep one.',
  'Thirty seconds at VO2max effort. Quick, not a sprint — you do this many times.':
    'Thirty seconds at VO2max effort — hard, but repeatable. Quick, not a sprint: you do this many times.',
}

/**
 * The current wording for a stored note. Unknown notes pass through untouched.
 *
 * 🔴 APOSTROPHE FORM IS NOT STABLE BETWEEN SOURCE AND STORED DATA, and an exact
 * map breaks on exactly that. Four stored steps read `don't` with a STRAIGHT
 * apostrophe while the catalogue source writes `don\u2019t`; the first version of
 * this map missed all four and I only saw it because I ran it against production
 * rather than against a fixture. Both sides are normalised before lookup.
 */
const NORMALISE = (s: string) => s.replace(/[\u2018\u2019]/g, "'")
const BY_NORMALISED = new Map(Object.entries(SUPERSEDED_NOTES).map(([k, v]) => [NORMALISE(k), v]))

export function currentNote(note: string | undefined): string | undefined {
  if (note === undefined) return undefined
  return BY_NORMALISED.get(NORMALISE(note)) ?? note
}
