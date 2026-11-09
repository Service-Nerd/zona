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
  // 🔴 SITE-ENGINE-EMDASH-01 (founder ruling, 2026-11-05) — a step note is a
  // SENTENCE, so the em dash goes. **These 14 entries exist because the
  // catalogue edit reaches NEW plans only**: a step note is stamped into
  // `plan_json` at generation, and this file is the only thing that reaches a
  // runner mid-block. Third time this shape has come up, and the header above
  // already records getting it wrong twice.
  //
  // ⚠️ DERIVED FROM THE REAL BEFORE/AFTER, not typed: the pairs were read by
  // diffing every `note:` literal in `sessionCatalogueData.ts` against its
  // version at HEAD, so a sentence cannot be mapped to something it never said.
  // The old side is exactly what production stamped; only the mark changes.
  'Threshold effort — comfortably hard, not a race pace.':
    'Threshold effort: comfortably hard, not a race pace.',
  'The long rung. If the pace is going, it goes here — hold the effort, let the pace be what it is.':
    'The long rung. If the pace is going, it goes here: hold the effort, let the pace be what it is.',
  'The over — a notch past comfortably hard. A gear change, not a surge.':
    'The over, a notch past comfortably hard. A gear change, not a surge.',
  'The under — back to comfortably hard, without stopping. This half is the session.':
    'The under, back to comfortably hard, without stopping. This half is the session.',
  '90 seconds. Deliberately short — clearance, not recovery.':
    '90 seconds. Deliberately short: clearance, not recovery.',
  'Rung one. Settle in — this is the pace you finish on.':
    'Rung one. Settle in: this is the pace you finish on.',
  'Three minutes at VO2max effort — about as hard as you could hold for ten minutes. Even splits; don\'t blow rep one.':
    'Three minutes at VO2max effort: about as hard as you could hold for ten minutes. Even splits; don\'t blow rep one.',
  'Thirty seconds at VO2max effort — hard, but repeatable. Quick, not a sprint: you do this many times.':
    'Thirty seconds at VO2max effort: hard, but repeatable. Quick, not a sprint: you do this many times.',
  'Thirty seconds easy. Keep moving — the short float is the session.':
    'Thirty seconds easy. Keep moving: the short float is the session.',
  'Three hundred metres easy — but keep running. The float is not a rest.':
    'Three hundred metres easy, but keep running. The float is not a rest.',
  'Four minutes at critical velocity — a notch past comfortably hard, and controlled. Not flat out.':
    'Four minutes at critical velocity: a notch past comfortably hard, and controlled. Not flat out.',
  'Ninety seconds easy. Short — the point is to keep the ceiling pressure on.':
    'Ninety seconds easy. Short: the point is to keep the ceiling pressure on.',
  'Ninety seconds. Deliberately short — you start the next rep unrecovered.':
    'Ninety seconds. Deliberately short: you start the next rep unrecovered.',
  'Hands on quads, short steps, tall chest. Hiking, not trudging — you should be able to eat while you do it.':
    'Hands on quads, short steps, tall chest. Hiking, not trudging: you should be able to eat while you do it.',

  // STEP-NOTE-SELF-CONTAINED-01 — referenced a session the runner may never have run.
  'Threshold now. Same effort as rep three of a cruise set.':
    'Threshold now. It should feel harder than the same pace would feel fresh.',
  // COPY-TERM-HANDLE-01 — glossed one coaching term with another.
  'Four minutes at critical velocity — just past threshold, controlled. Not a VO2max rep.':
    'Four minutes at critical velocity: a notch past comfortably hard, and controlled. Not flat out.',
  'The over — just past threshold. A gear change, not a surge.':
    'The over, a notch past comfortably hard. A gear change, not a surge.',
  'The under — back to threshold without stopping. This half is the session.':
    'The under, back to comfortably hard, without stopping. This half is the session.',
  // COPY-TERM-HANDLE-01 — named a lab measurement with no handle on the effort.
  'Three minutes at VO2max effort. Even splits — don’t blow rep one.':
    'Three minutes at VO2max effort: about as hard as you could hold for ten minutes. Even splits; don’t blow rep one.',
  'Thirty seconds at VO2max effort. Quick, not a sprint — you do this many times.':
    'Thirty seconds at VO2max effort: hard, but repeatable. Quick, not a sprint: you do this many times.',
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

/**
 * 🔴 THE META-NOTE HALF, AND IT IS NOT LATENT (EMDASH-LIB-COPY-01, code review 2026-11-09).
 *
 * `currentNote` above repairs STEP notes, and `sessionSteps.ts:422` is its only caller. The
 * four sentences repunctuated in `ruleEngine.ts` are `meta.*_note` fields read by
 * `planRationale.ts`, so **the engine was fixed and every stored plan kept its em dash while
 * the guard went green** — the exact class this module's own header records getting wrong
 * twice, and the 2026-11-05 precedent shipped 14 entries for it.
 *
 * 📐 MEASURED AGAINST PRODUCTION before writing this, not assumed: **12 of 41 stored plans
 * carry one** — 10 `hard_pref_note`, 1 `difficulty_note`, 1 `returning_runner_note`. Twelve
 * live runners read a mark the founder's rule forbids.
 *
 * ⚠️ PHRASES, NOT WHOLE STRINGS, because three of the four are TEMPLATES. `difficulty_note`
 * interpolates two week counts and `returning_runner_note` three config values, so an
 * exact-string key — the right instrument for a step note — cannot match them. Each phrase
 * below carries enough of its own sentence that it can only ever replace the one it names,
 * which is the property the header argues for.
 */
const SUPERSEDED_META_PHRASES: ReadonlyArray<{ from: string; to: string }> = [
  // hard_pref_note (§110 / §40c). Static, so an exact key would also work; kept here so all
  // four live in one place and a reader does not have to know which is which.
  { from: 'deepens \u2014 not before your legs', to: 'deepens, not before your legs' },
  // difficulty_note (§44 prep-time warning).
  { from: ' weeks \u2014 below the ', to: ' weeks: below the ' },
  // level_disagreement_note. 0 stored plans today; included because the engine can still
  // emit it and a repair that covers three of four is a repair someone has to re-open.
  { from: "says you're not one \u2014 you're a runner", to: "says you're not one: you're a runner" },
  // 🔴 returning_runner_note — REWRITTEN 2026-11-09 (Design Board refused the old copy under
  // §18 rule 2: *"no thresholds, no ratios"*). The engine edit reaches NEW plans only, and
  // **this note was about to start rendering for the first time**, so without these entries the
  // one stored carrier (`9feb0406`) would have shown exactly the prose the board refused —
  // worse than the nothing it showed before. Fourth time this shape has come up in this file.
  //
  // ⚠️ THE OLD SIDE IS WHAT PRODUCTION ACTUALLY STAMPED, read off the table, not retyped: the
  // stored fresh-return string carries an EM DASH where the code now has a semicolon, because
  // it predates `SITE-ENGINE-EMDASH-01`. Both forms are mapped — the semicolon one is 0 stored
  // plans today and the engine could still have emitted it, and this file's own header records
  // that a repair covering three of four is a repair someone has to re-open.
  //
  // ⚠️ `' km vs '` IS A SHORT, GENERIC PHRASE AND IT WAS MEASURED BEFORE BEING USED: it appears
  // in **0 of every other stored meta note**. The two long anchors around it are unique.
  { from: 'Fresh-from-layoff start: week 1 begins at 70% of your stated current weekly volume (',
    to:   'Week 1 starts at ' },
  { from: ' km vs ', to: ' km rather than the ' },
  { from: ' km stated). Returning to running needs caution, not faster ramp \u2014 the engine prefers a small base to rebuild from. Volume grows at the standard 10% per week.',
    to:   ' km you are running now, because you are coming back from a break. It climbs from there.' },
  { from: ' km stated). Returning to running needs caution, not faster ramp; the engine prefers a small base to rebuild from. Volume grows at the standard 10% per week.',
    to:   ' km you are running now, because you are coming back from a break. It climbs from there.' },
  { from: 'Returning-runner allowance active: weeks 1-3 grow at 15% per week (vs the standard 10%). Your training history allows a faster rebuild because the aerobic and structural base is still there.',
    to:   'Your first 3 weeks climb faster than they would for someone starting from scratch, because you have run before and that base is still there. After that it settles to the normal rate.' },
  // returning_runner_note (fresh-from-layoff).
  { from: 'not faster ramp \u2014 the engine prefers', to: 'not faster ramp; the engine prefers' },
]

/**
 * Repair a stored `meta.*_note` at the READ. Returns the note unchanged when it carries none
 * of the superseded phrases, which is every plan generated from 2026-11-09 onward.
 *
 * ⚠️ IT EMPTIES WHEN A MIGRATION REWRITES THE STORED NOTES, exactly as the step-note map
 * does. Until then it is the only thing that reaches a runner mid-block.
 */
export function currentMetaNote(note: string): string {
  let out = note
  for (const { from, to } of SUPERSEDED_META_PHRASES) out = out.split(from).join(to)
  return out
}
