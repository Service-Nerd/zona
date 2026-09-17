// Copy table for RaceTimesCard, keyed by variant.
//
// Each surface answers a different user question, so the framing differs even
// though the data is identical:
//   - status (Coach screen):    "Where you stand today" — passive status.
//   - anchor (Benchmark entry): "Where you are now"     — before-state, the
//                               recalibrate form sits directly below.
//   - result (Benchmark result): "What's changed"       — post-update confirmation.
//
// All strings live here. Do not hardcode any of these in the component.

export type RaceProjectionsVariant = 'status' | 'anchor' | 'result'

export interface RaceProjectionsCopy {
  /** Section eyebrow rendered at the top of the card. */
  eyebrow: string
  /** Shown when state is 5 (no estimate available) or fetch fails. */
  empty: {
    heading: string
    /** Body when Strava IS connected. */
    bodyWithStrava: string
    /** Body when Strava is NOT connected. */
    bodyWithoutStrava: string
  }
  /** Shown below the distance list when state ∈ {3, 4} (low-confidence estimate). */
  lowConf: {
    /** state 3 — has benchmark, low confidence. */
    withBenchmark: string
    /** state 4 — no benchmark, Strava connected. */
    withoutBenchmarkStrava: string
    /** state 4 — no benchmark, Strava not connected. */
    withoutBenchmarkNoStrava: string
  }
  /**
   * RACE-PROJ-LEAD-01 (SLT 2026-09-17) — state 4 only: the estimate came from
   * the runner's WIZARD ANSWERS, not from anything they have run.
   *
   * Measured on the live database: 11 of 19 plans (58%) carry no benchmark, so
   * this is the MAJORITY path, not an edge case. The numbers behind it are a
   * 3x4 lookup table with nine distinct outcomes for the entire population, and
   * a runner who DECLINED the training-age question gets the same figures as
   * one who answered "6-18 months" — the two are indistinguishable on screen.
   *
   * So on this state the action leads and the table follows, which is the
   * reverse of what shipped: the 2026-09-13 pass collapsed the table when an
   * arc was present (MORE evidence) and left it fully open when there was none.
   */
  bracket?: {
    /** Leads the card. Says where the numbers came from, plainly. */
    body:   string
    /** The one action that replaces a lookup with a measurement. */
    cta:    string
    /** Tap-to-expand label for the table, which is collapsed on this state. */
    toggle: string
  }
  /**
   * Recalibration nudge — only present on the `status` variant. Other surfaces
   * either ARE the recalibration UI (`anchor`) or just confirmed it (`result`),
   * so a "go recalibrate" CTA would be a tautology.
   */
  recal?: {
    body:    string
    cta:     string
    dismiss: string
  }
  /**
   * UX-COACH-01 progress arc — "where I was, where I am, what I'm aiming at".
   * Only the `status` variant carries it: `anchor` and `result` bracket a
   * recalibration, so a "since plan start" arc there would be comparing the
   * runner against a baseline they are in the middle of replacing.
   */
  arc?: {
    /** Fallback label for the baseline column. The route overrides it with a
     *  MONTH when the baseline was derived from runs rather than a benchmark —
     *  the earliest run data can begin long after the plan did. */
    was:  string
    now:  string
    goal: string
    /** Eyebrow over the arc when it IS the runner's race distance. */
    raceEyebrow: string
    /** Eyebrow when the race is too long to project (ultra) and the arc has
     *  dropped to the nearest standard distance. The hero is then honestly
     *  "aerobic fitness", not a race time the engine cannot stand behind. */
    ultraEyebrow: string
    /** Sub-line under the ultra eyebrow, naming the projectable distance.
     *  `{distance}` is interpolated (e.g. 'Marathon-equivalent'). */
    ultraSubline: string
    /** Tap-to-expand label for the per-distance reference table, which is
     *  collapsed by default when the arc is present (progressive disclosure:
     *  the arc is the hero, the table is reference the runner can open). */
    distancesToggle: string
    /** The honest caveat under an ultra arc. `{race}` is interpolated. */
    atDistance: string
    /** Caption under the `now` column, by direction. `{delta}` is interpolated. */
    direction: {
      faster: string
      slower: string
      level:  string
    }
    /** Caption under the `goal` column. `{delta}` is interpolated. */
    toGo:   string
    /** Caption under `goal` once current fitness is at or inside it. */
    reached: string
    /** Shown in place of the arc when there is no plan-start estimate to compare. */
    noBaseline: string
  }
}

export const RACE_PROJECTIONS_COPY: Record<RaceProjectionsVariant, RaceProjectionsCopy> = {
  status: {
    eyebrow: 'Race projections',
    empty: {
      heading: 'No estimate yet.',
      bodyWithStrava:    'Add a benchmark result in Profile, or complete a few easy runs with heart rate.',
      bodyWithoutStrava: 'Add a benchmark result in Profile, or complete a few easy runs with heart rate.',
    },
    lowConf: {
      withBenchmark:           'Log a benchmark result in Profile for a higher-confidence estimate.',
      withoutBenchmarkStrava:  'Log a benchmark result in Profile to improve accuracy.',
      withoutBenchmarkNoStrava:'Add a benchmark in Profile, or complete a few easy runs with heart rate.',
    },
    bracket: {
      body:   'These come from your wizard answers, not from anything you have run yet.',
      cta:    'Add a benchmark \u2192',
      toggle: 'See the rough estimates',
    },
    recal: {
      body:    'Aerobic fitness has moved since plan start. Your training zones may be set too low for where you are now.',
      cta:     'Update zones →',
      dismiss: 'Not now',
    },
    arc: {
      was:  'Plan start',
      now:  'Now',
      goal: 'Your goal',
      raceEyebrow:     'Your race',
      ultraEyebrow:    'Aerobic fitness',
      ultraSubline:    '{distance}-equivalent',
      distancesToggle: 'Estimated times at other distances',
      atDistance:      '{race} is too long to project from pace, so this tracks your aerobic fitness instead.',
      direction: {
        // Zonna voice: state the fact, do not celebrate it. No "amazing", no
        // exclamation marks. The number is the good news; the copy stays dry.
        faster: '{delta} faster',
        slower: '{delta} slower',
        level:  'Holding',
      },
      toGo:       '{delta} to go',
      reached:    'Reached',
      noBaseline: 'No plan-start estimate to compare against yet.',
    },
  },

  anchor: {
    eyebrow: 'Where you are now',
    empty: {
      heading: 'No estimate yet.',
      bodyWithStrava:    'Use the form below to log a benchmark result.',
      bodyWithoutStrava: 'Use the form below to log a benchmark result.',
    },
    lowConf: {
      withBenchmark:           'Update below for a higher-confidence estimate.',
      withoutBenchmarkStrava:  'Log a benchmark below to improve accuracy.',
      withoutBenchmarkNoStrava:'Log a benchmark below to improve accuracy.',
    },
  },

  result: {
    eyebrow: "What's changed",
    empty: {
      heading: 'No estimate yet.',
      bodyWithStrava:    'Projections will refresh once your update is processed.',
      bodyWithoutStrava: 'Projections will refresh once your update is processed.',
    },
    lowConf: {
      withBenchmark:           '',
      withoutBenchmarkStrava:  '',
      withoutBenchmarkNoStrava:'',
    },
  },
}
