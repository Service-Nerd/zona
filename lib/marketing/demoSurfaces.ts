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
/**
 * The block every marketing device still describes: week 6 of a 16-week
 * marathon build, so 10 weeks remain.
 *
 * ⚠️ IT IS HERE BECAUSE THREE SURFACES HAVE TO AGREE AND TWO OF THEM DID
 * NOT. `PhoneFrame`'s Today still owned `WEEK_N`/`TOTAL_WEEKS` privately and
 * said "Week 6 of 16"; the Coach tab was typed "W6 of 16" by hand; and the
 * Plan tab generated a **12-week half marathon**. One device, three tabs,
 * two different races and two different block lengths. A visitor switching
 * tabs was looking at two runners.
 *
 * `buildDemoPlanScreen()` generates the real plan from this, so the Plan
 * tab's arc and the Coach tab's header now READ the block rather than
 * restating it. Change it here and all three move together.
 */
export const DEMO_BLOCK = {
  /** Marketing plan slug the Plan tab generates. Must be a 16-week race. */
  slug: 'marathon-16-week',
  weekN: 6,
  totalWeeks: 16,
} as const

/**
 * The Coach screen's race arc: where the runner was at plan start, where they
 * are now, and the goal they chose. Feeds the REAL `buildRaceProgressArc` and
 * `RaceProgressArcRow`, with the real `RACE_PROJECTIONS_COPY.status.arc`.
 *
 * ⚠️ AN ILLUSTRATION, ON THE SAME FOOTING AS `DEMO_ZONE_WEEK`, and the page
 * already draws this line explicitly: `SameWeekTwice`'s header states that the
 * PRESCRIPTION is real and generated while the EXECUTION is "two ways a runner
 * might run this week, not a measurement of anyone" — because we have roughly
 * three users and there is no honest aggregate to quote. Three benchmark times
 * are outcome data, so they sit on the illustration side of that line.
 *
 * ⚠️ §109 / §44.1: this surface may REMEMBER and COMPARE, never PREDICT.
 * `buildRaceProgressArc` enforces it — there is no projected race-day finish
 * here and there must never be one. Do not add a fourth "on track for" point.
 */
export const DEMO_RACE_ARC = {
  /** 4:12:00 at plan start. */
  baselineSeconds: 4 * 3600 + 12 * 60,
  /** 4:06:30 measured now, five weeks in. */
  currentSeconds: 4 * 3600 + 6 * 60 + 30,
  /** The runner's own target, not a forecast. */
  goalSeconds: 4 * 3600,
  raceName: 'Manchester Marathon',
} as const

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
/**
 * `SITE-EFFORT-RECORD-01` (Design Board 2026-11-05, founder overrule on the
 * ZoneRings row) — six weeks of this runner's actual effort, one column a run.
 *
 * THE SAME RUNNER AS EVERYTHING ELSE IN THIS FILE, which is the rule its header
 * already states: the 16-week marathon block of `DEMO_BLOCK`, now in week 6, and
 * the last four runs are the week `DEMO_ZONE_WEEK` summarises (z1 8, z2 71,
 * z3 9, z45 12 across 4 runs). Change one and change all three.
 *
 * ⚠️ THE TWO DRIFTED DAYS IN `DEMO_COACH_NOTE` ARE NOT GREY COLUMNS, and that
 * distinction is the product's. The note says Tuesday *"drifted 8 bpm above
 * your Zone 2 ceiling"* — a run that drifts for part of itself still spends
 * MOST of its time in Zone 2, so `runEffortKind` calls it `easy` and it draws
 * with a visible Z3 slice rather than as a grey column. Making them grey would
 * put this week's Z3 share far above the 9% the rings report. **Two surfaces
 * describing one week have to agree arithmetically, not just in tone.**
 *
 * ⚠️ AN ILLUSTRATION, exactly like `DEMO_ZONE_WEEK` and `DEMO_RACE_ARC`: a
 * plausible six weeks, not a measurement of anyone. We have roughly three users
 * and there is no honest aggregate to draw. The PRESCRIPTION on this page is
 * real and generated; the EXECUTION is drawn, and `SameWeekTwice` already says
 * so on the surface.
 *
 * The arc is the one the brand exists for: a runner whose early weeks sat in
 * the grey middle and whose recent weeks hold the zone. Four of 22 are grey,
 * and all four are in the first three weeks.
 */
export const DEMO_EFFORT_RUNS = [
  // Weeks 1-3: the grey middle. Four runs mostly in Z3.
  { date: '2026-03-02', z1: 4,  z2: 38, z3: 52, z45: 6,  kind: 'grey'   as const, thisWeek: false },
  { date: '2026-03-04', z1: 6,  z2: 61, z3: 28, z45: 5,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-07', z1: 3,  z2: 41, z3: 49, z45: 7,  kind: 'grey'   as const, thisWeek: false },
  { date: '2026-03-08', z1: 9,  z2: 66, z3: 21, z45: 4,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-10', z1: 5,  z2: 44, z3: 46, z45: 5,  kind: 'grey'   as const, thisWeek: false },
  { date: '2026-03-12', z1: 7,  z2: 58, z3: 29, z45: 6,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-14', z1: 4,  z2: 22, z3: 31, z45: 43, kind: 'hard'   as const, thisWeek: false },
  { date: '2026-03-15', z1: 11, z2: 64, z3: 20, z45: 5,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-17', z1: 5,  z2: 43, z3: 47, z45: 5,  kind: 'grey'   as const, thisWeek: false },
  { date: '2026-03-19', z1: 8,  z2: 69, z3: 18, z45: 5,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-21', z1: 6,  z2: 26, z3: 24, z45: 44, kind: 'hard'   as const, thisWeek: false },
  { date: '2026-03-22', z1: 10, z2: 72, z3: 14, z45: 4,  kind: 'easy'   as const, thisWeek: false },
  // Weeks 4-5: it starts to hold.
  { date: '2026-03-24', z1: 9,  z2: 78, z3: 10, z45: 3,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-26', z1: 7,  z2: 81, z3: 9,  z45: 3,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-28', z1: 5,  z2: 29, z3: 21, z45: 45, kind: 'hard'   as const, thisWeek: false },
  { date: '2026-03-29', z1: 12, z2: 79, z3: 7,  z45: 2,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-03-31', z1: 8,  z2: 84, z3: 6,  z45: 2,  kind: 'easy'   as const, thisWeek: false },
  { date: '2026-04-02', z1: 9,  z2: 82, z3: 7,  z45: 2,  kind: 'easy'   as const, thisWeek: false },
  // Week 6 — the four runs `DEMO_ZONE_WEEK` reports, and the two
  // `DEMO_COACH_NOTE` says drifted (Tuesday and Wednesday: a visible Z3 slice,
  // still mostly Z2, so still `easy`).
  { date: '2026-04-07', z1: 7,  z2: 72, z3: 17, z45: 4,  kind: 'easy'   as const, thisWeek: true },
  { date: '2026-04-08', z1: 6,  z2: 74, z3: 16, z45: 4,  kind: 'easy'   as const, thisWeek: true },
  { date: '2026-04-11', z1: 5,  z2: 54, z3: 2,  z45: 39, kind: 'hard'   as const, thisWeek: true },
  { date: '2026-04-12', z1: 14, z2: 84, z3: 1,  z45: 1,  kind: 'easy'   as const, thisWeek: true },
]

export const DEMO_COACH_NOTE = {
  timestamp: 'Sunday',
  observation:
    'Tuesday drifted 8 bpm above your Zone 2 ceiling and Wednesday looked the same. Two easy days in a row above Z2 is the pattern we are trying to break.',
  instruction: 'Hold the zone on Thursday. Even if it feels too slow.',
}
