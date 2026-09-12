// GTM-SITE-03 — the founder story has ONE owner.
//
// It is told on two surfaces: `/about` on the web and `FounderNoteScreen` in
// the app. **The TREATMENT divergence is a decision, not drift** — the web page
// carries a photograph because a charity vetting a stranger needs a face; the
// in-app note deliberately has none, because there the voice is the asset. That
// stays. What was drifting was the NARRATIVE itself, told twice in two files:
//
//   /about : "A plateau that WOULD NOT move" · "easy days WERE NOT easy, hard
//            days WERE NOT hard, AND everything ended up in the same grey
//            middle."
//   app    : "A plateau that WOULDN'T move" · "easy days WEREN'T easy. Hard
//            days WEREN'T hard. Everything ended up in the same grey middle —
//            medium-hard on Monday..."
//
// Same story, different sentences, and nothing could tell you which was
// canonical. The thesis line was worse: hardcoded in both files with DIFFERENT
// apostrophe entities (`&rsquo;` vs `&apos;`), so one sentence rendered as two
// different characters. It now lives in `BRAND.coreTruth`.
//
// CANONICAL FORM, and why this wording won:
//   · The app's short declaratives ("easy days weren't easy. Hard days weren't
//     hard.") over the web's comma-joined clause — brand voice is "one sentence
//     is better than two", and contractions are how this brand speaks.
//   · The web's full stop over the app's em dash before "medium-hard" — no em
//     dashes in copy (founder call 2026-09-11). The app is out of the
//     `noEmDash` test's scope only because engine labels have a live coupling;
//     a hand-authored founder note has none, so the rule applies here.
//
// This module is in that test's SURFACES list, so the rule keeps being enforced
// now that the strings have moved out of the page.
export const FOUNDER_STORY = {
  /** Opening line. Both surfaces render it as their heading. */
  opener: 'The runner had a problem.',

  /** Body paragraphs, in order. Locked strings — reword in ONE place or not at all. */
  paragraphs: [
    'Heart rate spiking before the warm-up was done. Every easy run creeping into Zone 3. A plateau that wouldn’t move, no matter how many sessions went in.',
    'The diagnosis took embarrassingly long: easy days weren’t easy. Hard days weren’t hard. Everything ended up in the same grey middle. Medium-hard on Monday, medium-hard on Saturday, medium-hard on race day.',
    'So the runner built a tool. Ran a 52K with it. Started training for a 100K.',
  ],

  /** Byline. The em dash here is a MIDDLE DOT in both surfaces, not copy punctuation. */
  byline: 'Russ Shear',
  role: 'Founder',
  email: 'russ@zonna.run',
} as const
