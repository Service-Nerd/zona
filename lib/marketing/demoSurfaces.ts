// GTM-SITE-02 item 3 — the data the marketing site feeds to REAL app components.
//
// WHY THIS FILE EXISTS. The homepage used to describe the product in text cards
// and then show three hand-written imitations of app surfaces
// (`MockSessionCard`, `MockReflectCard`, `MockCoachNoteCard`). Hand-copied
// markup is exactly what drifted before: `PhoneFrame`'s wordmark silently
// diverged from the real `<Wordmark/>` and shipped that way until 2026-09-11.
//
// The homepage now renders `SessionCard`, `CoachNoteBlock` and `ZoneRings`
// themselves. None of the three is a client component and none requires a
// handler, so a server-rendered marketing page can mount them directly. There
// is therefore one definition of each surface, and drift is impossible: change
// the card in the app and the website changes with it.
//
// What is left over is the DATA, and that is all this file holds. No markup,
// no styling, no second copy of a component.
//
// THE NUMBERS ARE NOT DECORATIVE. They describe one coherent runner: the same
// half-marathon profile the `AnswersCard` on the homepage lists, and the same
// session the `PhoneFrame` device shot shows. If you change one, change all
// three or the page starts telling two stories.

/** Props for `components/shared/SessionCard`. Typed structurally on purpose:
 *  importing the component's own Props would pull a `.tsx` into a data module
 *  for no benefit, and `app/page.tsx` type-checks the spread at the call site. */
export interface DemoSession {
  type: string
  name: string
  detail: string
  distanceKm: number
}

/**
 * Three days from one week of the half-marathon plan the `AnswersCard`
 * describes (sub-2:00, 20 to 40 km a week, running Tue/Thu/Sat/Sun).
 *
 * Tuesday is deliberately the session in the device shot above it, down to the
 * band: "Zone 2 · < 145 bpm · 6:30-7:30 /km", 8 km. The two stills show the
 * same run because they are the same runner.
 *
 * Three types, not one, because the session colour system carries meaning and
 * the homepage was using exactly one of the eight colours it owns.
 */
export const DEMO_WEEK: DemoSession[] = [
  {
    type: 'easy',
    name: 'Easy run',
    detail: 'Zone 2 · < 145 bpm · 6:30–7:30 /km',
    distanceKm: 8,
  },
  {
    type: 'tempo',
    name: 'Tempo run',
    detail: 'Zone 3–4 · 5:20–5:35 /km',
    distanceKm: 10,
  },
  {
    type: 'long',
    name: 'Long run',
    detail: 'Zone 2 the whole way. Yes, all of it.',
    distanceKm: 16,
  },
]

/**
 * A week's zone split for `ZoneRings`. Percentages of time, not of distance,
 * which is what the rings actually plot from `run_analysis`.
 *
 * Chosen to be a GOOD week rather than a perfect one: 71% easy, and 9% still
 * leaking into Z3. A 100% clean week would be a lie about what training looks
 * like, and the product's whole argument is that the grey middle is hard to
 * stay out of. Sums to 100.
 */
export const DEMO_ZONE_WEEK = {
  pct: { z1: 8, z2: 71, z3: 9, z45: 12 },
  meta: 'across 4 runs',
}

/**
 * What Kit says after reading the week. Rendered by the real
 * `CoachNoteBlock aiGenerated`, so it carries the real byline, the real
 * AIMark sparkle and the real warn rail rather than a marketing impression of
 * them.
 *
 * Voice check: specific, unflattering, one instruction. Not motivational.
 */
export const DEMO_COACH_NOTE = {
  timestamp: 'Sunday',
  observation:
    'Tuesday drifted 8 bpm above your Zone 2 ceiling and Wednesday looked the same. Two easy days in a row above Z2 is the pattern we are trying to break.',
  instruction: 'Hold the zone on Thursday. Even if it feels too slow.',
}
